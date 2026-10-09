import { Guild, GuildMember, Role, TextChannel, User } from 'discord.js';
import { db } from '../config/database.js';
import { CONFIG } from '../config/config.js';
import { HeliumEmbed } from '../core/embed.js';
import { Logger } from '../core/logger.js';

export const MAX_WARNINGS = 3;

export interface WarningTierRole {
  tier: number;
  name: string;
  color: number;
}

export const WARNING_ROLES: WarningTierRole[] = [
  { tier: 1, name: 'Warning 1', color: 0xFEE75C }, // Yellow
  { tier: 2, name: 'Warning 2', color: 0xE67E22 }, // Orange
  { tier: 3, name: 'Warning 3', color: 0xED4245 }, // Red
];

export interface CaseData {
  guildId: string;
  userId: string;
  moderatorId: string;
  action: 'BAN' | 'UNBAN' | 'KICK' | 'TIMEOUT' | 'UNTIMEOUT' | 'WARN' | 'SOFTBAN';
  reason: string;
  duration?: number;
}

export class ModerationService {
  /**
   * Automatically creates or assigns roles according to warning count phrase
   */
  static async syncWarningRoles(guild: Guild, member: GuildMember, warningCount: number): Promise<Role | null> {
    if (!guild || !member) return null;

    try {
      const allTierNames = WARNING_ROLES.map(r => r.name.toLowerCase());
      const rolesToRemove = member.roles.cache.filter(r => allTierNames.includes(r.name.toLowerCase()));

      if (warningCount <= 0) {
        if (rolesToRemove.size > 0) {
          await member.roles.remove(rolesToRemove, 'All warnings cleared');
        }
        return null;
      }

      const clampedTier = Math.min(warningCount, MAX_WARNINGS);
      const targetTier = WARNING_ROLES.find(r => r.tier === clampedTier)!;

      // Find or dynamically create the role in guild
      let targetRole = guild.roles.cache.find(r => r.name.toLowerCase() === targetTier.name.toLowerCase());
      if (!targetRole) {
        targetRole = await guild.roles.create({
          name: targetTier.name,
          color: targetTier.color,
          reason: `[${CONFIG.BOT_NAME}] Auto-created role for warning tier ${targetTier.name}`,
          permissions: [],
        });
      }

      // Remove any prior warning tier roles
      const toRemove = rolesToRemove.filter(r => r.id !== targetRole!.id);
      if (toRemove.size > 0) {
        await member.roles.remove(toRemove, 'Warning phrase escalation');
      }

      // Add target role
      if (!member.roles.cache.has(targetRole.id)) {
        await member.roles.add(targetRole, `Warning phrase reached ${targetTier.name}`);
      }

      return targetRole;
    } catch (err) {
      Logger.error(`Failed to sync warning roles for member ${member.id}:`, err);
      return null;
    }
  }

  /**
   * Create a moderation case in DB and dispatch to mod logs
   */
  static async createCase(guild: Guild, data: CaseData): Promise<number> {
    const lastCase = db.prepare(
      'SELECT MAX(case_id) as maxId FROM moderation_cases WHERE guild_id = ?'
    ).get(data.guildId) as { maxId: number | null };

    const caseId = (lastCase?.maxId || 0) + 1;
    const now = Date.now();

    db.prepare(`
      INSERT INTO moderation_cases (guild_id, case_id, user_id, moderator_id, action, reason, duration, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.guildId,
      caseId,
      data.userId,
      data.moderatorId,
      data.action,
      data.reason,
      data.duration || null,
      now
    );

    // Fetch guild config for mod_log_channel
    const config = db.prepare('SELECT mod_log_channel FROM guilds WHERE id = ?').get(guild.id) as any;
    if (config?.mod_log_channel) {
      const channel = guild.channels.cache.get(config.mod_log_channel) as TextChannel;
      if (channel && channel.isTextBased()) {
        const embed = HeliumEmbed.security(
          `Moderation Case #${caseId} | ${data.action}`,
          `**Target:** <@${data.userId}> (\`${data.userId}\`)\n` +
          `**Moderator:** <@${data.moderatorId}>\n` +
          `**Action:** \`${data.action}\`\n` +
          (data.duration ? `**Duration:** \`${Math.round(data.duration / 1000)}s\`\n` : '') +
          `**Reason:** ${data.reason}\n` +
          `**Timestamp:** <t:${Math.floor(now / 1000)}:f>`
        );
        channel.send({ embeds: [embed] }).catch(() => null);
      }
    }

    return caseId;
  }

  /**
   * Add a warning to user (Max 3 warnings allowed)
   */
  static async addWarning(
    guild: Guild,
    userId: string,
    moderatorId: string,
    reason: string
  ): Promise<{ totalWarns: number; maxReached: boolean; roleCreated?: string; alreadyMaxed: boolean }> {
    const existing = this.getWarnings(guild.id, userId);

    if (existing.length >= MAX_WARNINGS) {
      return {
        totalWarns: existing.length,
        maxReached: true,
        alreadyMaxed: true,
      };
    }

    const now = Date.now();
    db.prepare(`
      INSERT INTO warnings (guild_id, user_id, moderator_id, reason, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(guild.id, userId, moderatorId, reason, now);

    const count = existing.length + 1;
    let roleCreated: string | undefined;

    const member = await guild.members.fetch(userId).catch(() => null);
    if (member) {
      const role = await this.syncWarningRoles(guild, member, count);
      if (role) roleCreated = role.name;
    }

    return {
      totalWarns: count,
      maxReached: count >= MAX_WARNINGS,
      alreadyMaxed: false,
      roleCreated,
    };
  }

  /**
   * Get warnings for a user
   */
  static getWarnings(guildId: string, userId: string) {
    return db.prepare(
      'SELECT * FROM warnings WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC'
    ).all(guildId, userId) as any[];
  }

  /**
   * Clear warnings for a user and remove warning roles
   */
  static async clearWarnings(guild: Guild, userId: string): Promise<number> {
    const result = db.prepare('DELETE FROM warnings WHERE guild_id = ? AND user_id = ?').run(guild.id, userId);
    const member = await guild.members.fetch(userId).catch(() => null);
    if (member) {
      await this.syncWarningRoles(guild, member, 0);
    }
    return result.changes;
  }

  /**
   * Mod notes
   */
  static addNote(guildId: string, userId: string, moderatorId: string, note: string) {
    return db.prepare(`
      INSERT INTO mod_notes (guild_id, user_id, moderator_id, note, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(guildId, userId, moderatorId, note, Date.now());
  }

  static getNotes(guildId: string, userId: string) {
    return db.prepare('SELECT * FROM mod_notes WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC').all(guildId, userId) as any[];
  }
}
