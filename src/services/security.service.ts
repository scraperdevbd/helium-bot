import { ChannelType, Guild, GuildMember, PermissionFlagsBits, PermissionsBitField, TextChannel, User } from 'discord.js';
import { db } from '../config/database.js';
import { CONFIG } from '../config/config.js';
import { HeliumEmbed } from '../core/embed.js';
import { Logger } from '../core/logger.js';

export interface SecurityEventData {
  guildId: string;
  actorId: string;
  targetId?: string;
  eventType: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskScore: number;
  reason: string;
  evidence?: string;
}

export class SecurityService {
  // Sliding window: Map<guildId:actorId, Array<{ type: string, timestamp: number }>>
  private static eventWindows = new Map<string, Array<{ type: string; timestamp: number }>>();
  // Join tracker for anti-raid: Map<guildId, Array<number>>
  private static joinTimestamps = new Map<string, number[]>();
  // Guild raid mode active map
  private static raidModeActive = new Map<string, boolean>();

  private static getWindowKey(guildId: string, actorId: string): string {
    return `${guildId}:${actorId}`;
  }

  /**
   * Log and evaluate a security event with risk scoring and threshold evaluation
   */
  static async handleSecurityTrigger(
    guild: Guild,
    actor: { id: string },
    eventType: string,
    evidenceDetail: string
  ): Promise<boolean> {
    const actorId = actor.id;
    if (actorId === guild.ownerId) return false;
    if (actorId === guild.client.user?.id) return false;

    // Check trusted entities
    const isTrusted = db.prepare(
      'SELECT id FROM trusted_entities WHERE guild_id = ? AND entity_id = ?'
    ).get(guild.id, actorId);
    if (isTrusted) return false;

    // Fetch guild config with auto-default insertion
    let guildConfig = db.prepare('SELECT * FROM guilds WHERE id = ?').get(guild.id) as any;
    if (!guildConfig) {
      db.prepare('INSERT OR IGNORE INTO guilds (id, antinuke_enabled) VALUES (?, 1)').run(guild.id);
      guildConfig = db.prepare('SELECT * FROM guilds WHERE id = ?').get(guild.id) as any;
    }
    if (guildConfig && guildConfig.antinuke_enabled === 0) return false;

    const threshold = guildConfig?.antinuke_threshold || 3;
    const windowKey = this.getWindowKey(guild.id, actorId);
    const now = Date.now();
    const windowDuration = 30 * 1000; // 30 seconds sliding window

    const recent = (this.eventWindows.get(windowKey) || []).filter(e => now - e.timestamp < windowDuration);
    recent.push({ type: eventType, timestamp: now });
    this.eventWindows.set(windowKey, recent);

    // Calculate risk score based on frequency and severity
    let riskScore = 0;
    for (const item of recent) {
      if (item.type.includes('BAN') || item.type.includes('KICK')) riskScore += 25;
      else if (item.type.includes('CHANNEL_DELETE') || item.type.includes('ROLE_DELETE')) riskScore += 50;
      else if (item.type.includes('ADMIN') || item.type.includes('BOT_ADD')) riskScore += 40;
      else riskScore += 15;
    }

    const eventId = `SEC-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;
    // Destructive actions (channel deletion, role deletion) trigger IMMEDIATE punishment for unwhitelisted actors
    const isInstantNuke = eventType.includes('CHANNEL_DELETE') || eventType.includes('ROLE_DELETE');
    const shouldPunish = isInstantNuke || recent.length >= threshold || riskScore >= 50;

    let actionTaken = 'LOGGED';
    if (shouldPunish) {
      const punishment = guildConfig?.antinuke_action || 'ban';
      actionTaken = punishment.toUpperCase();

      try {
        const member = await guild.members.fetch(actorId).catch(() => null);
        if (punishment === 'ban') {
          await guild.bans.create(actorId, {
            reason: `[${CONFIG.BOT_NAME} Anti-Nuke ${eventId}] Unauthorized destructive action: ${eventType} (${evidenceDetail})`
          }).catch(async () => {
            if (member && member.bannable) {
              await member.ban({ reason: `[${CONFIG.BOT_NAME} Anti-Nuke ${eventId}] ${eventType}` });
            }
          });
        } else if (punishment === 'kick') {
          if (member && member.kickable) {
            await member.kick(`[${CONFIG.BOT_NAME} Anti-Nuke ${eventId}] Unauthorized action: ${eventType}`);
          }
        } else if (punishment === 'strip_roles') {
          if (member) {
            const manageableRoles = member.roles.cache.filter(r => r.name !== '@everyone' && r.editable);
            await member.roles.remove(manageableRoles, `[${CONFIG.BOT_NAME} Anti-Nuke ${eventId}] Dangerous activity stripped`);
          }
        }
      } catch (err) {
        Logger.error(`Anti-Nuke punishment execution error for ${actorId}:`, err);
      }
    }

    // Insert security event to DB
    const stmt = db.prepare(`
      INSERT INTO security_events (
        event_id, guild_id, actor_id, target_id, event_type,
        severity, risk_score, action_taken, reason, evidence, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      eventId,
      guild.id,
      actorId,
      evidenceDetail,
      eventType,
      shouldPunish ? 'CRITICAL' : 'HIGH',
      riskScore,
      actionTaken,
      `Threshold exceeded (${recent.length}/${threshold}) - ${eventType}`,
      evidenceDetail,
      now
    );

    // Dispatch embed to security log channel
    if (guildConfig.security_log_channel) {
      const channel = guild.channels.cache.get(guildConfig.security_log_channel) as TextChannel;
      if (channel && channel.isTextBased()) {
        const embed = HeliumEmbed.security(
          `Security Incident: ${eventId}`,
          `**Type:** \`${eventType}\`\n` +
          `**Actor:** <@${actorId}> (\`${actorId}\`)\n` +
          `**Severity:** \`${shouldPunish ? 'CRITICAL' : 'HIGH'}\`\n` +
          `**Risk Score:** \`${riskScore} pts\`\n` +
          `**Action Taken:** \`${actionTaken}\`\n` +
          `**Evidence:** ${evidenceDetail}\n` +
          `**Window Events:** \`${recent.length}\` actions in 30s`
        );
        channel.send({ embeds: [embed] }).catch(() => null);
      }
    }

    return shouldPunish;
  }

  /**
   * Anti-Raid: check incoming joins and trigger quarantine / raid mode if velocity spikes
   */
  static handleJoinVelocity(guild: Guild, member: GuildMember): { raidTriggered: boolean; reason?: string } {
    const guildConfig = db.prepare('SELECT * FROM guilds WHERE id = ?').get(guild.id) as any;
    if (!guildConfig || !guildConfig.antiraid_enabled) return { raidTriggered: false };

    const threshold = guildConfig.antiraid_threshold || 5;
    const now = Date.now();
    const timestamps = (this.joinTimestamps.get(guild.id) || []).filter(t => now - t < 10000);
    timestamps.push(now);
    this.joinTimestamps.set(guild.id, timestamps);

    // Account age check (under 3 days old is suspicious)
    const accountAgeDays = (now - member.user.createdTimestamp) / (1000 * 60 * 60 * 24);

    if (timestamps.length >= threshold) {
      this.raidModeActive.set(guild.id, true);
      // Log anti-raid alert
      if (guildConfig.security_log_channel) {
        const channel = guild.channels.cache.get(guildConfig.security_log_channel) as TextChannel;
        if (channel && channel.isTextBased()) {
          const embed = HeliumEmbed.security(
            'Anti-Raid Activated',
            `**Velocity:** \`${timestamps.length}\` joins within 10 seconds!\n` +
            `**Status:** Server entered automatic raid mitigation.\n` +
            `**Account Age:** <@${member.id}> created ${accountAgeDays.toFixed(1)} days ago.`
          );
          channel.send({ embeds: [embed] }).catch(() => null);
        }
      }
      return { raidTriggered: true, reason: 'High join velocity (Raid spike)' };
    }

    return { raidTriggered: false };
  }

  /**
   * Emergency Server Lockdown
   */
  static async setLockdown(guild: Guild, lock: boolean, reason: string): Promise<number> {
    let affected = 0;
    const everyoneRole = guild.roles.everyone;

    for (const [, channel] of guild.channels.cache) {
      if (channel.isTextBased() && 'permissionOverwrites' in channel) {
        try {
          await channel.permissionOverwrites.edit(everyoneRole, {
            SendMessages: lock ? false : null,
            AddReactions: lock ? false : null,
            CreatePublicThreads: lock ? false : null,
          }, { reason: `[Helium Lockdown] ${reason}` });
          affected++;
        } catch {}
      }
    }
    return affected;
  }

  /**
   * Verify if the bot possesses the top role hierarchy position in the guild
   */
  static botHasTopRole(guild: Guild): { hasTopRole: boolean; botHighestPos: number; maxOtherPos: number } {
    const botMember = guild.members.me;
    if (!botMember) return { hasTopRole: false, botHighestPos: 0, maxOtherPos: 0 };
    const botHighestPos = botMember.roles.highest.position;

    let maxOtherPos = 0;
    for (const member of guild.members.cache.values()) {
      if (member.id === botMember.id || member.id === guild.ownerId) continue;
      if (member.roles.highest.position > maxOtherPos) {
        maxOtherPos = member.roles.highest.position;
      }
    }

    return {
      hasTopRole: botHighestPos >= maxOtherPos && botHighestPos > 1,
      botHighestPos,
      maxOtherPos,
    };
  }

  /**
   * Attempt to enable Anti-Nuke with top role prerequisite enforcement
   */
  static async enableAntiNuke(guild: Guild): Promise<{ success: boolean; message: string }> {
    const roleCheck = this.botHasTopRole(guild);
    if (!roleCheck.hasTopRole) {
      return {
        success: false,
        message: 'Anti-Nuke cannot be enabled: Helium must possess the top role hierarchy in the server (above all administrator and staff roles) to mitigate rogue actions.',
      };
    }

    db.prepare('UPDATE guilds SET antinuke_enabled = 1 WHERE id = ?').run(guild.id);
    return {
      success: true,
      message: 'Anti-Nuke armed successfully with verified top role hierarchy.',
    };
  }

  /**
   * Role hierarchy watchdog: Disarms Anti-Nuke, spawns private alert channel on demotion, and auto-recovers
   */
  static async checkAndEnforceTopRole(guild: Guild): Promise<void> {
    const config = db.prepare('SELECT antinuke_enabled FROM guilds WHERE id = ?').get(guild.id) as any;
    const isEnabled = Boolean(config?.antinuke_enabled ?? 1);
    const roleCheck = this.botHasTopRole(guild);

    if (isEnabled && !roleCheck.hasTopRole) {
      // 1. Instantly disarm Anti-Nuke
      db.prepare('UPDATE guilds SET antinuke_enabled = 0 WHERE id = ?').run(guild.id);
      Logger.security(`TOP ROLE LOST in ${guild.name} (${guild.id})! Anti-Nuke automatically disabled.`);

      // 2. Create private alert channel if not already existing
      let alertChannel = guild.channels.cache.find(c => c.name === 'helium-security-alert') as TextChannel;
      if (!alertChannel) {
        try {
          alertChannel = await guild.channels.create({
            name: 'helium-security-alert',
            type: ChannelType.GuildText,
            permissionOverwrites: [
              {
                id: guild.roles.everyone.id,
                deny: [PermissionFlagsBits.ViewChannel],
              },
              {
                id: guild.client.user!.id,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks],
              },
              {
                id: guild.ownerId,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
              },
            ],
            reason: 'Helium lost top role - Anti-Nuke disabled alert',
          }) as TextChannel;

          const alertEmbed = HeliumEmbed.security(
            'CRITICAL SECURITY ALERT: TOP ROLE LOST',
            `🚨 <@${guild.ownerId}>\n\n` +
            `**Helium has lost its top role hierarchy position!**\n\n` +
            `• **Anti-Nuke Status:** Automatically **DISABLED** to prevent failed containment.\n` +
            `• **Action Required:** Move Helium's bot role to the top of your server's role list (above all administrator and staff roles).\n` +
            `• **Automatic Recovery:** Once Helium's top role is restored, this channel will automatically self-delete and Anti-Nuke will be re-armed.`
          );

          await alertChannel.send({ content: `<@${guild.ownerId}>`, embeds: [alertEmbed] });
        } catch (err) {
          Logger.error('Failed to create security alert channel:', err);
        }
      }
    } else if (!isEnabled && roleCheck.hasTopRole) {
      // Re-arm and delete private alert channel
      const alertChannel = guild.channels.cache.find(c => c.name === 'helium-security-alert');
      if (alertChannel) {
        await alertChannel.delete('Helium top role restored to server').catch(() => {});
      }

      db.prepare('UPDATE guilds SET antinuke_enabled = 1 WHERE id = ?').run(guild.id);
      Logger.security(`Top role restored in ${guild.name}! Anti-Nuke re-armed.`);
    }
  }
}
