import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { ChannelType, REST, Routes, EmbedBuilder, ColorResolvable } from 'discord.js';
import { HeliumClient } from '../core/client.js';
import { CONFIG, setDynamicBotName } from '../config/config.js';
import { db } from '../config/database.js';
import { Logger } from '../core/logger.js';
import { CommandRegistry } from '../core/registry.js';
import { DashboardSessionManager } from './session.js';
import { SecurityService } from '../services/security.service.js';
import { RoleService } from '../services/role.service.js';
import { DeveloperService } from '../services/developer.service.js';
import { ModerationService } from '../services/moderation.service.js';
import { HeliumEmbed } from '../core/embed.js';

export class DashboardServer {
  private static app = express();
  private static server: any = null;
  private static client: HeliumClient | null = null;
  private static maintenanceMode = false;

  static start(client: HeliumClient) {
    this.client = client;
    const app = this.app;

    app.use(express.json());

    // Resolve public web files directory
    let publicDir = path.join(process.cwd(), 'src', 'dashboard', 'public');
    if (!fs.existsSync(publicDir)) {
      publicDir = path.join(process.cwd(), 'dist', 'dashboard', 'public');
    }

    // Auth Middleware for protected API routes
    const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
      const token = (req.query.token as string) ||
        (req.headers.authorization ? req.headers.authorization.replace('Bearer ', '').trim() : '');

      if (!token || !DashboardSessionManager.validateWebToken(token)) {
        res.status(401).json({ error: 'Unauthorized: Valid session token required.' });
        return;
      }
      next();
    };

    // Public login endpoint (authenticates with PIN key 2026 + Discord user ID)
    app.post('/api/auth/login', (req: Request, res: Response) => {
      const { key, userId } = req.body;
      if (!key || !userId) {
        return res.status(400).json({ error: 'Missing activation key or Discord User ID.' });
      }

      const user = client.users.cache.get(userId);
      if (!user) {
        return res.status(404).json({ error: 'Discord User ID not found in bot cache. Please ensure you share a server with Helium.' });
      }

      const access = DashboardSessionManager.validateAccess(user, null, key);
      if (!access.allowed) {
        return res.status(403).json({ error: access.reason || 'Authentication failed.' });
      }

      const session = DashboardSessionManager.createSession(user);
      Logger.info(`Web dashboard session initiated for ${user.tag} (${user.id})`, 'DashboardServer');
      return res.json({
        token: session.webToken,
        user: { id: user.id, tag: user.tag, avatar: user.displayAvatarURL() },
        expiresAt: session.expiresAt
      });
    });

    // Check token validity
    app.get('/api/auth/verify', (req: Request, res: Response) => {
      const token = (req.query.token as string) ||
        (req.headers.authorization ? req.headers.authorization.replace('Bearer ', '').trim() : '');

      if (!token || !DashboardSessionManager.validateWebToken(token)) {
        return res.status(401).json({ valid: false });
      }
      return res.json({ valid: true });
    });

    // 1. Bot Stats & Operational Health
    app.get('/api/stats', authMiddleware, (req: Request, res: Response) => {
      const mem = process.memoryUsage();
      const uptimeSec = Math.floor(process.uptime());
      const days = Math.floor(uptimeSec / 86400);
      const hours = Math.floor((uptimeSec % 86400) / 3600);
      const mins = Math.floor((uptimeSec % 3600) / 60);
      const secs = uptimeSec % 60;
      const uptimeStr = `${days}d ${hours}h ${mins}m ${secs}s`;

      const guildCount = client.guilds.cache.size;
      const cachedUsers = client.users.cache.size;
      const ping = client.ws.ping;
      const slashCmdCount = CommandRegistry.getAll().length;
      const prefixAliasCount = CommandRegistry.getAliasCount();

      let totalCases = 0;
      let totalTickets = 0;
      let totalEvents = 0;
      try {
        totalCases = (db.prepare('SELECT COUNT(*) as c FROM moderation_cases').get() as any)?.c || 0;
        totalTickets = (db.prepare('SELECT COUNT(*) as c FROM tickets').get() as any)?.c || 0;
        totalEvents = (db.prepare('SELECT COUNT(*) as c FROM security_events').get() as any)?.c || 0;
      } catch (err) {}

      return res.json({
        status: client.isReady() ? 'Operational' : 'Reconnecting',
        author: CONFIG.AUTHOR,
        version: '1.0.0',
        uptime: uptimeStr,
        uptimeSeconds: uptimeSec,
        ping: ping >= 0 ? `${ping}ms` : 'Connecting',
        pingRaw: ping,
        guildCount,
        cachedUsers,
        slashCmdCount,
        prefixAliasCount,
        maintenanceMode: DeveloperService.isMaintenanceMode(),
        dbStatus: 'SQLite 3 (WAL Mode)',
        memory: {
          heapUsedMb: (mem.heapUsed / 1024 / 1024).toFixed(1),
          heapTotalMb: (mem.heapTotal / 1024 / 1024).toFixed(1),
          rssMb: (mem.rss / 1024 / 1024).toFixed(1),
        },
        metrics: {
          totalCases,
          totalTickets,
          totalEvents,
        }
      });
    });

    // 2. Guilds list
    app.get('/api/guilds', authMiddleware, (req: Request, res: Response) => {
      const guilds = client.guilds.cache.map(g => {
        const row = db.prepare('SELECT * FROM guilds WHERE id = ?').get(g.id) as any;
        return {
          id: g.id,
          name: g.name,
          icon: g.iconURL() || null,
          memberCount: g.memberCount,
          ownerId: g.ownerId,
          prefix: row?.prefix || CONFIG.PREFIX,
          antinuke: Boolean(row?.antinuke_enabled ?? 1),
          antiraid: Boolean(row?.antiraid_enabled ?? 1),
          automod: Boolean(row?.automod_enabled ?? 1),
        };
      });

      return res.json({ guilds });
    });

    // 3. Single Guild Full Details (Channels, Roles, Settings)
    app.get('/api/guild/:guildId', authMiddleware, (req: Request, res: Response) => {
      const guild = client.guilds.cache.get(req.params.guildId as string);
      if (!guild) {
        return res.status(404).json({ error: 'Server not found in bot cache.' });
      }

      // Ensure guild row exists
      let guildRow = db.prepare('SELECT * FROM guilds WHERE id = ?').get(guild.id) as any;
      if (!guildRow) {
        db.prepare('INSERT OR IGNORE INTO guilds (id, prefix, created_at) VALUES (?, ?, ?)').run(guild.id, CONFIG.PREFIX, Date.now());
        guildRow = db.prepare('SELECT * FROM guilds WHERE id = ?').get(guild.id) as any;
      }

      // Extract text channels & roles
      const textChannels = guild.channels.cache
        .filter(c => c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement)
        .map(c => ({ id: c.id, name: c.name }))
        .sort((a, b) => a.name.localeCompare(b.name));

      const roles = guild.roles.cache
        .filter(r => r.name !== '@everyone')
        .map(r => ({ id: r.id, name: r.name, color: r.hexColor }))
        .sort((a, b) => a.name.localeCompare(b.name));

      const trusted = db.prepare('SELECT * FROM trusted_entities WHERE guild_id = ?').all(guild.id);

      return res.json({
        id: guild.id,
        name: guild.name,
        icon: guild.iconURL(),
        memberCount: guild.memberCount,
        ownerId: guild.ownerId,
        channels: textChannels,
        roles,
        settings: guildRow,
        trusted,
      });
    });

    // 3.5. Guild Members List for Interactive Member Picker Popup
    app.get('/api/guild/:guildId/members', authMiddleware, async (req: Request, res: Response) => {
      const guildId = req.params.guildId as string;
      const guild = client.guilds.cache.get(guildId);
      if (!guild) {
        return res.status(404).json({ error: 'Server not found in bot cache.' });
      }

      try {
        if (guild.members.cache.size < 50 && guild.memberCount > guild.members.cache.size) {
          await guild.members.fetch({ limit: 100 }).catch(() => {});
        }

        const defaultBannerColors = ['#5865F2', '#57F287', '#FEE75C', '#EB459E', '#ED4245', '#99AAB5', '#FF73FA', '#1ABC9C', '#E67E22', '#3498DB'];
        const memberList = Array.from(guild.members.cache.values());

        // Try to fetch full user objects for members without banner in cache (up to 30)
        await Promise.allSettled(
          memberList.slice(0, 30).map(async (m) => {
            if (!m.user.banner && !m.user.hexAccentColor) {
              try {
                await m.user.fetch();
              } catch {}
            }
          })
        );

        const members = memberList.map((m, idx) => {
          let bannerUrl: string | null = null;
          try {
            if (m.user.banner) {
              bannerUrl = m.user.bannerURL({ size: 512 }) ?? null;
            }
          } catch {}

          // Fallback banner color: accentColor > calculated default Discord banner color
          const colorHash = Math.abs(m.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0));
          const fallbackColor = defaultBannerColors[colorHash % defaultBannerColors.length];
          const bannerColor = m.user.hexAccentColor || fallbackColor;

          return {
            id: m.id,
            username: m.user.username,
            displayName: m.displayName || m.user.username,
            tag: m.user.tag || m.user.username,
            avatar: m.user.displayAvatarURL({ size: 128 }),
            banner: bannerUrl,
            bannerColor,
            bot: m.user.bot,
            highestRole: m.roles.highest && m.roles.highest.name !== '@everyone'
              ? { name: m.roles.highest.name, color: m.roles.highest.hexColor }
              : null
          };
        });

        // Sort: humans first, then alphabetically by display name
        members.sort((a, b) => {
          if (a.bot !== b.bot) return a.bot ? 1 : -1;
          return a.displayName.localeCompare(b.displayName);
        });

        return res.json({ members });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    });

    // 4. Update Guild General Settings (Prefix, Welcome, Autorole, Verify)
    app.post('/api/guild/:guildId/config', authMiddleware, (req: Request, res: Response) => {
      const { guildId } = req.params;
      const {
        prefix,
        welcome_enabled,
        welcome_channel,
        welcome_message,
        goodbye_enabled,
        goodbye_channel,
        goodbye_message,
        autorole_id,
        verify_role_id,
        verify_channel
      } = req.body;

      try {
        db.prepare(`
          UPDATE guilds SET
            prefix = COALESCE(?, prefix),
            welcome_enabled = COALESCE(?, welcome_enabled),
            welcome_channel = COALESCE(?, welcome_channel),
            welcome_message = COALESCE(?, welcome_message),
            goodbye_enabled = COALESCE(?, goodbye_enabled),
            goodbye_channel = COALESCE(?, goodbye_channel),
            goodbye_message = COALESCE(?, goodbye_message),
            autorole_id = COALESCE(?, autorole_id),
            verify_role_id = COALESCE(?, verify_role_id),
            verify_channel = COALESCE(?, verify_channel)
          WHERE id = ?
        `).run(
          prefix,
          welcome_enabled !== undefined ? (welcome_enabled ? 1 : 0) : null,
          welcome_channel,
          welcome_message,
          goodbye_enabled !== undefined ? (goodbye_enabled ? 1 : 0) : null,
          goodbye_channel,
          goodbye_message,
          autorole_id,
          verify_role_id,
          verify_channel,
          guildId
        );

        Logger.info(`Updated guild configuration for ${guildId} via Web Dashboard`);
        return res.json({ success: true, message: 'Server configuration saved.' });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    });

    // 5. Anti-Nuke & Defense Suite
    app.get('/api/security', authMiddleware, (req: Request, res: Response) => {
      const guildId = (req.query.guildId as string) || client.guilds.cache.first()?.id;
      let antinukeConfig: any = null;
      let recentEvents: any[] = [];
      let trusted: any[] = [];

      if (guildId) {
        antinukeConfig = db.prepare('SELECT antinuke_enabled, antinuke_threshold, antinuke_action, antiraid_enabled, antiraid_threshold FROM guilds WHERE id = ?').get(guildId);
        recentEvents = db.prepare('SELECT * FROM security_events WHERE guild_id = ? ORDER BY timestamp DESC LIMIT 20').all(guildId);
        trusted = db.prepare('SELECT * FROM trusted_entities WHERE guild_id = ?').all(guildId);
      }

      return res.json({
        guildId,
        config: antinukeConfig || {
          antinuke_enabled: 1,
          antinuke_threshold: 3,
          antinuke_action: 'ban',
          antiraid_enabled: 1,
          antiraid_threshold: 5
        },
        recentEvents,
        trusted,
        protections: {
          massBan: true,
          massKick: true,
          channelDelete: true,
          roleDelete: true,
          webhookDefense: true,
          botAddProtection: true
        }
      });
    });

    // Update Anti-Nuke Settings
    app.post('/api/security/:guildId/config', authMiddleware, (req: Request, res: Response) => {
      const guildId = req.params.guildId as string;
      const { antinuke_enabled, antinuke_threshold, antinuke_action, antiraid_enabled, antiraid_threshold } = req.body;

      try {
        if (antinuke_enabled) {
          const guild = client.guilds.cache.get(guildId);
          if (guild) {
            const roleCheck = SecurityService.botHasTopRole(guild);
            if (!roleCheck.hasTopRole) {
              return res.status(400).json({
                error: 'Anti-Nuke cannot be enabled: Helium must possess the highest role in the server (above all administrator and staff roles) to guarantee server defense.'
              });
            }
          }
        }

        db.prepare(`
          UPDATE guilds SET
            antinuke_enabled = COALESCE(?, antinuke_enabled),
            antinuke_threshold = COALESCE(?, antinuke_threshold),
            antinuke_action = COALESCE(?, antinuke_action),
            antiraid_enabled = COALESCE(?, antiraid_enabled),
            antiraid_threshold = COALESCE(?, antiraid_threshold)
          WHERE id = ?
        `).run(
          antinuke_enabled !== undefined ? (antinuke_enabled ? 1 : 0) : null,
          antinuke_threshold !== undefined ? Number(antinuke_threshold) : null,
          antinuke_action,
          antiraid_enabled !== undefined ? (antiraid_enabled ? 1 : 0) : null,
          antiraid_threshold !== undefined ? Number(antiraid_threshold) : null,
          guildId
        );

        Logger.security(`Anti-Nuke settings updated for guild ${guildId} via Web Dashboard`);
        return res.json({ success: true, message: 'Anti-Nuke settings updated.' });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    });

    // Add / Remove Trusted Whitelist Entity
    app.post('/api/security/whitelist', authMiddleware, (req: Request, res: Response) => {
      const { guildId, entityId, type, action } = req.body;
      if (!guildId || !entityId) {
        return res.status(400).json({ error: 'Missing guildId or entityId.' });
      }

      try {
        if (action === 'remove') {
          db.prepare('DELETE FROM trusted_entities WHERE guild_id = ? AND entity_id = ?').run(guildId, entityId);
          return res.json({ success: true, message: `Entity ${entityId} removed from whitelist.` });
        } else {
          db.prepare(`
            INSERT OR REPLACE INTO trusted_entities (guild_id, entity_id, type, added_by, created_at)
            VALUES (?, ?, ?, ?, ?)
          `).run(guildId, entityId, type || 'user', 'Web Dashboard', Date.now());
          return res.json({ success: true, message: `Entity ${entityId} added to trusted whitelist.` });
        }
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    });

    // Emergency Lockdown
    app.post('/api/security/lockdown', authMiddleware, async (req: Request, res: Response) => {
      const targetGuildId = req.body.guildId || client.guilds.cache.first()?.id;
      const guild = client.guilds.cache.get(targetGuildId);

      if (!guild) return res.status(404).json({ error: 'Target server not found.' });

      try {
        const count = await SecurityService.setLockdown(guild, true, 'Emergency Lockdown triggered via Web Dashboard');
        return res.json({ success: true, message: `Locked down ${count} channels across ${guild.name}.` });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    });

    // Lift Lockdown
    app.post('/api/security/unlockdown', authMiddleware, async (req: Request, res: Response) => {
      const targetGuildId = req.body.guildId || client.guilds.cache.first()?.id;
      const guild = client.guilds.cache.get(targetGuildId);

      if (!guild) return res.status(404).json({ error: 'Target server not found.' });

      try {
        const count = await SecurityService.setLockdown(guild, false, 'Lockdown lifted via Web Dashboard');
        return res.json({ success: true, message: `Restored access to ${count} channels in ${guild.name}.` });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    });

    // Panic Mode
    app.post('/api/security/panic', authMiddleware, async (req: Request, res: Response) => {
      const targetGuildId = req.body.guildId || client.guilds.cache.first()?.id;
      const guild = client.guilds.cache.get(targetGuildId);

      if (!guild) return res.status(404).json({ error: 'Target server not found.' });

      try {
        await SecurityService.setLockdown(guild, true, 'PANIC MODE TRIGGERED VIA WEB DASHBOARD');
        db.prepare('UPDATE guilds SET antinuke_enabled = 1, antinuke_threshold = 1 WHERE id = ?').run(guild.id);
        return res.json({ success: true, message: `PANIC MODE ARMED: All channels frozen and Anti-Nuke threshold set to 1 action.` });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    });

    // 6. AutoMod Engine & Word Filter
    app.get('/api/automod', authMiddleware, (req: Request, res: Response) => {
      const guildId = (req.query.guildId as string) || client.guilds.cache.first()?.id;
      let config: any = null;

      if (guildId) {
        config = db.prepare('SELECT automod_enabled, automod_links, automod_invites, automod_caps, automod_badwords, automod_badwords_list, automod_spam FROM guilds WHERE id = ?').get(guildId);
      }

      let badwordsList: string[] = [];
      try {
        badwordsList = JSON.parse(config?.automod_badwords_list || '[]');
      } catch {}

      return res.json({
        guildId,
        config: config || {
          automod_enabled: 1,
          automod_links: 0,
          automod_invites: 1,
          automod_caps: 0,
          automod_badwords: 0,
          automod_spam: 1,
        },
        badwords: badwordsList,
      });
    });

    // Update AutoMod Config & Bad Words
    app.post('/api/automod/:guildId/config', authMiddleware, (req: Request, res: Response) => {
      const { guildId } = req.params;
      const {
        automod_enabled,
        automod_links,
        automod_invites,
        automod_caps,
        automod_badwords,
        automod_spam,
        badwords
      } = req.body;

      try {
        db.prepare(`
          UPDATE guilds SET
            automod_enabled = COALESCE(?, automod_enabled),
            automod_links = COALESCE(?, automod_links),
            automod_invites = COALESCE(?, automod_invites),
            automod_caps = COALESCE(?, automod_caps),
            automod_badwords = COALESCE(?, automod_badwords),
            automod_spam = COALESCE(?, automod_spam),
            automod_badwords_list = COALESCE(?, automod_badwords_list)
          WHERE id = ?
        `).run(
          automod_enabled !== undefined ? (automod_enabled ? 1 : 0) : null,
          automod_links !== undefined ? (automod_links ? 1 : 0) : null,
          automod_invites !== undefined ? (automod_invites ? 1 : 0) : null,
          automod_caps !== undefined ? (automod_caps ? 1 : 0) : null,
          automod_badwords !== undefined ? (automod_badwords ? 1 : 0) : null,
          automod_spam !== undefined ? (automod_spam ? 1 : 0) : null,
          badwords !== undefined ? JSON.stringify(badwords) : null,
          guildId
        );

        return res.json({ success: true, message: 'AutoMod configuration saved.' });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    });

    // 7. Moderation Hub & Cases
    app.get('/api/moderation', authMiddleware, (req: Request, res: Response) => {
      const guildId = (req.query.guildId as string) || client.guilds.cache.first()?.id;
      let cases: any[] = [];

      if (guildId) {
        cases = db.prepare('SELECT * FROM moderation_cases WHERE guild_id = ? ORDER BY created_at DESC LIMIT 30').all(guildId);
      } else {
        cases = db.prepare('SELECT * FROM moderation_cases ORDER BY created_at DESC LIMIT 30').all();
      }

      return res.json({
        totalCases: cases.length,
        cases: cases.map(c => ({
          id: c.id,
          caseId: c.case_id,
          userId: c.user_id,
          moderatorId: c.moderator_id,
          action: c.action,
          reason: c.reason,
          duration: c.duration,
          createdAt: new Date(c.created_at).toISOString(),
        }))
      });
    });

    // Execute Moderation Punishment (Warn, Timeout, Kick, Ban)
    app.post('/api/moderation/punish', authMiddleware, async (req: Request, res: Response) => {
      const { guildId, userId, action, reason, durationMinutes } = req.body;
      if (!guildId || !userId || !action) {
        return res.status(400).json({ error: 'Missing guildId, userId, or action.' });
      }

      const guild = client.guilds.cache.get(guildId);
      if (!guild) return res.status(404).json({ error: 'Server not found.' });

      try {
        const targetMember = await guild.members.fetch(userId).catch(() => null);
        const modReason = reason || `Moderation action via Web Dashboard by Operator`;

        let warnMsg = '';
        if (action === 'warn') {
          const warnResult = await ModerationService.addWarning(guild, userId, 'WebDashboard', modReason);
          if (warnResult.alreadyMaxed) {
            return res.status(400).json({
              error: `User <@${userId}> already has the maximum limit of 3 warnings (3/3). Please Kick or Ban this user.`
            });
          }
          if (warnResult.maxReached) {
            warnMsg = `Warning 3/3 issued (${warnResult.roleCreated || 'Warning 3'} assigned). User has reached maximum warnings - recommended to Kick or Ban!`;
          } else {
            warnMsg = `Warning ${warnResult.totalWarns}/3 issued (${warnResult.roleCreated || `Warning ${warnResult.totalWarns}`} assigned).`;
          }
        } else if (action === 'timeout') {
          if (!targetMember) return res.status(404).json({ error: 'Member not found in server.' });
          const ms = (Number(durationMinutes) || 10) * 60 * 1000;
          await targetMember.timeout(ms, modReason);
        } else if (action === 'kick') {
          if (!targetMember) return res.status(404).json({ error: 'Member not found in server.' });
          await targetMember.kick(modReason);
        } else if (action === 'ban') {
          await guild.bans.create(userId, { reason: modReason });
        } else {
          return res.status(400).json({ error: `Unsupported action ${action}` });
        }

        // Record Case
        const caseCount = (db.prepare('SELECT COUNT(*) as c FROM moderation_cases WHERE guild_id = ?').get(guild.id) as any)?.c || 0;
        const newCaseId = caseCount + 1;
        db.prepare(`
          INSERT INTO moderation_cases (guild_id, case_id, user_id, moderator_id, action, reason, duration, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(guild.id, newCaseId, userId, 'WebDashboard', action.toUpperCase(), modReason, durationMinutes || null, Date.now());

        Logger.info(`Moderation action ${action.toUpperCase()} executed on ${userId} via Web Dashboard`);
        return res.json({
          success: true,
          caseId: newCaseId,
          message: warnMsg || `Successfully executed ${action.toUpperCase()} on user ${userId}.`
        });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    });

    // Revoke / Delete Case
    app.post('/api/moderation/revoke', authMiddleware, (req: Request, res: Response) => {
      const { caseId, guildId } = req.body;
      if (!caseId) return res.status(400).json({ error: 'Missing caseId.' });

      try {
        db.prepare('DELETE FROM moderation_cases WHERE id = ?' + (guildId ? ' AND guild_id = ?' : '')).run(...(guildId ? [caseId, guildId] : [caseId]));
        return res.json({ success: true, message: `Case #${caseId} revoked successfully.` });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    });

    // Set Channel Slowmode
    app.post('/api/moderation/slowmode', authMiddleware, async (req: Request, res: Response) => {
      const { channelId, seconds } = req.body;
      const channel = client.channels.cache.get(channelId);

      if (!channel || !channel.isTextBased() || !('setRateLimitPerUser' in channel)) {
        return res.status(404).json({ error: 'Text channel not found.' });
      }

      try {
        await (channel as any).setRateLimitPerUser(Number(seconds) || 0, 'Configured via Web Dashboard');
        return res.json({ success: true, message: `Slowmode set to ${seconds}s in #${(channel as any).name}.` });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    });

    // 8. Audit Logging Routing
    app.get('/api/logs', authMiddleware, (req: Request, res: Response) => {
      const guildId = (req.query.guildId as string) || client.guilds.cache.first()?.id;
      let row: any = null;

      if (guildId) {
        row = db.prepare('SELECT mod_log_channel, member_log_channel, server_log_channel, voice_log_channel, security_log_channel, automod_log_channel, ticket_log_channel FROM guilds WHERE id = ?').get(guildId);
      }

      return res.json({
        guildId,
        channels: row || {
          mod_log_channel: null,
          member_log_channel: null,
          server_log_channel: null,
          voice_log_channel: null,
          security_log_channel: null,
          automod_log_channel: null,
          ticket_log_channel: null
        }
      });
    });

    // Update Logging Channels
    app.post('/api/logs/:guildId/config', authMiddleware, (req: Request, res: Response) => {
      const { guildId } = req.params;
      const {
        mod_log_channel,
        member_log_channel,
        server_log_channel,
        voice_log_channel,
        security_log_channel,
        automod_log_channel,
        ticket_log_channel
      } = req.body;

      try {
        db.prepare(`
          UPDATE guilds SET
            mod_log_channel = ?,
            member_log_channel = ?,
            server_log_channel = ?,
            voice_log_channel = ?,
            security_log_channel = ?,
            automod_log_channel = ?,
            ticket_log_channel = ?
          WHERE id = ?
        `).run(
          mod_log_channel || null,
          member_log_channel || null,
          server_log_channel || null,
          voice_log_channel || null,
          security_log_channel || null,
          automod_log_channel || null,
          ticket_log_channel || null,
          guildId
        );

        return res.json({ success: true, message: 'Audit logging channels updated.' });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    });

    // 9. Feature Suite (Tickets, Economy, Leveling, Verification)
    app.get('/api/features', authMiddleware, (req: Request, res: Response) => {
      const guildId = (req.query.guildId as string) || client.guilds.cache.first()?.id;

      let ticketCount = 0;
      let economyUserCount = 0;
      let levelUserCount = 0;
      let openTicketsList: any[] = [];

      try {
        ticketCount = (db.prepare('SELECT COUNT(*) as c FROM tickets' + (guildId ? ' WHERE guild_id = ?' : '')).get(...(guildId ? [guildId] : [])) as any)?.c || 0;
        openTicketsList = db.prepare('SELECT * FROM tickets WHERE status = ?' + (guildId ? ' AND guild_id = ?' : '') + ' LIMIT 10').all('OPEN', ...(guildId ? [guildId] : []));
        economyUserCount = (db.prepare('SELECT COUNT(*) as c FROM users').get() as any)?.c || 0;
        levelUserCount = (db.prepare('SELECT COUNT(*) as c FROM users WHERE xp > 0').get() as any)?.c || 0;
      } catch (e) {}

      return res.json({
        tickets: { enabled: true, activeTickets: ticketCount, list: openTicketsList },
        economy: { enabled: true, enrolledUsers: economyUserCount },
        leveling: { enabled: true, rankedUsers: levelUserCount },
        verification: { enabled: true },
      });
    });

    // Close Ticket directly from Dashboard
    app.post('/api/features/tickets/close', authMiddleware, async (req: Request, res: Response) => {
      const { channelId } = req.body;
      if (!channelId) return res.status(400).json({ error: 'Missing channelId.' });

      try {
        db.prepare('UPDATE tickets SET status = ?, closed_at = ? WHERE channel_id = ?').run('CLOSED', Date.now(), channelId);
        const channel = client.channels.cache.get(channelId);
        if (channel && 'delete' in channel) {
          await (channel as any).delete('Ticket closed via Web Dashboard').catch(() => {});
        }
        return res.json({ success: true, message: 'Ticket closed and archived.' });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    });

    // Adjust User Economy Balance
    app.post('/api/features/economy/adjust', authMiddleware, (req: Request, res: Response) => {
      const { userId, type, target, amount } = req.body;
      if (!userId || !amount) return res.status(400).json({ error: 'Missing userId or amount.' });

      const amt = Number(amount);
      const field = target === 'bank' ? 'bank' : 'wallet';

      try {
        let user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
        if (!user) {
          db.prepare('INSERT INTO users (id, wallet, bank, created_at) VALUES (?, 1000, 0, ?)').run(userId, Date.now());
          user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
        }

        let newBalance = user[field];
        if (type === 'set') newBalance = amt;
        else if (type === 'remove') newBalance = Math.max(0, newBalance - amt);
        else newBalance = newBalance + amt;

        db.prepare(`UPDATE users SET ${field} = ? WHERE id = ?`).run(newBalance, userId);
        return res.json({ success: true, newBalance, message: `Updated user ${userId} ${field} balance to ${newBalance.toLocaleString()} coins.` });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    });

    // 10. Database Manifest & Backups
    app.get('/api/database', authMiddleware, (req: Request, res: Response) => {
      const tables = [
        'guilds', 'users', 'moderation_cases', 'warnings', 'security_events',
        'trusted_entities', 'protected_entities', 'tickets', 'giveaways',
        'role_backups', 'role_menus', 'shop_items', 'reminders'
      ];

      const tableStats = tables.map(tbl => {
        try {
          const count = (db.prepare(`SELECT COUNT(*) as c FROM ${tbl}`).get() as any)?.c || 0;
          return { name: tbl, count };
        } catch {
          return { name: tbl, count: 0 };
        }
      });

      const backups = db.prepare('SELECT id, guild_id, created_by, created_at FROM role_backups ORDER BY created_at DESC LIMIT 15').all();

      return res.json({
        engine: 'SQLite 3 (better-sqlite3)',
        mode: 'Write-Ahead Logging (WAL)',
        tables: tableStats,
        backups: backups.map((b: any) => ({
          id: b.id,
          guildId: b.guild_id,
          createdBy: b.created_by,
          createdAt: new Date(b.created_at).toISOString()
        }))
      });
    });

    // Create Snapshot Backup
    app.post('/api/database/backup', authMiddleware, (req: Request, res: Response) => {
      const targetGuildId = req.body.guildId || client.guilds.cache.first()?.id;
      const guild = client.guilds.cache.get(targetGuildId);

      if (!guild) return res.status(404).json({ error: 'Server not found.' });

      try {
        const backupId = RoleService.backupRoles(guild, req.body.userId || 'WebDashboard');
        Logger.info(`Snapshot backup ${backupId} created for ${guild.name} via Web Dashboard`);
        return res.json({ success: true, backupId, message: `Backup ${backupId} created.` });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    });

    // Restore Snapshot Backup
    app.post('/api/database/restore', authMiddleware, async (req: Request, res: Response) => {
      const { guildId, backupId } = req.body;
      const targetGuildId = guildId || client.guilds.cache.first()?.id;
      const guild = client.guilds.cache.get(targetGuildId);

      if (!guild || !backupId) return res.status(400).json({ error: 'Missing guild or backupId.' });

      try {
        const count = await RoleService.restoreRoles(guild, backupId);
        return res.json({ success: true, count, message: `Successfully restored ${count} roles from backup ${backupId}.` });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    });

    // 11. System Controls (Broadcast Announcement, Sync Slash, Maintenance)
    app.post('/api/system/broadcast', authMiddleware, async (req: Request, res: Response) => {
      const { channelId, title, message } = req.body;
      if (!channelId || !message) return res.status(400).json({ error: 'Missing channelId or message.' });

      const channel = client.channels.cache.get(channelId);
      if (!channel || !channel.isTextBased() || !('send' in channel)) {
        return res.status(404).json({ error: 'Text channel not found.' });
      }

      try {
        const embed = HeliumEmbed.info(title || 'Helium Announcement', message);
        await (channel as any).send({ embeds: [embed] });
        return res.json({ success: true, message: `Announcement broadcast to #${(channel as any).name}!` });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    });

    // Sync Slash Commands directly to guilds (clearing global commands to prevent duplicate entries)
    app.post('/api/system/sync', authMiddleware, async (req: Request, res: Response) => {
      if (!CONFIG.TOKEN || !CONFIG.CLIENT_ID) {
        return res.status(500).json({ error: 'DISCORD_TOKEN or CLIENT_ID missing in config.' });
      }

      try {
        const rest = new REST({ version: '10' }).setToken(CONFIG.TOKEN);
        const slashData = CommandRegistry.toSlashData(100);

        // Clear global commands to ensure Discord does not show duplicates
        await rest.put(Routes.applicationCommands(CONFIG.CLIENT_ID), { body: [] });

        for (const guild of client.guilds.cache.values()) {
          await rest.put(Routes.applicationGuildCommands(CONFIG.CLIENT_ID, guild.id), { body: slashData });
        }
        return res.json({ success: true, count: slashData.length, message: `Synced ${slashData.length} slash commands without duplicates!` });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    });

    // Toggle Maintenance Mode
    app.post('/api/system/maintenance', authMiddleware, (req: Request, res: Response) => {
      const nextMode = !DeveloperService.isMaintenanceMode();
      DeveloperService.setMaintenanceMode(nextMode);
      Logger.warn(`Maintenance mode is now ${nextMode ? 'ENABLED' : 'DISABLED'} via Dashboard`);
      return res.json({ maintenanceMode: nextMode });
    });

    // Developer Management: List developers
    app.get('/api/developers', authMiddleware, (req: Request, res: Response) => {
      const developers = DeveloperService.getDevelopers();
      return res.json({ developers });
    });

    // Developer Management: Add developer
    app.post('/api/developers/add', authMiddleware, (req: Request, res: Response) => {
      const { userId } = req.body;
      if (!userId || typeof userId !== 'string' || !/^\d{17,20}$/.test(userId.trim())) {
        return res.status(400).json({ error: 'Valid 17-20 digit Discord User ID required.' });
      }
      const trimmedId = userId.trim();
      const success = DeveloperService.addDeveloper(trimmedId, 'Dashboard');
      if (!success) {
        return res.status(500).json({ error: 'Failed to record developer.' });
      }
      Logger.info(`Developer ${trimmedId} authorized via Web Dashboard`);
      return res.json({ success: true, developers: DeveloperService.getDevelopers() });
    });

    // Developer Management: Remove developer
    app.post('/api/developers/remove', authMiddleware, (req: Request, res: Response) => {
      const { userId } = req.body;
      if (!userId) return res.status(400).json({ error: 'Missing userId.' });
      if (CONFIG.OWNER_IDS.includes(userId)) {
        return res.status(400).json({ error: 'Cannot remove primary bot owners.' });
      }
      DeveloperService.removeDeveloper(userId);
      Logger.info(`Developer ${userId} removed via Web Dashboard`);
      return res.json({ success: true, developers: DeveloperService.getDevelopers() });
    });

    // Bot Identity Customization (Bot Name & Nickname)
    app.post('/api/system/botname', authMiddleware, async (req: Request, res: Response) => {
      const { name, guildId } = req.body;
      if (!name || typeof name !== 'string' || name.trim().length < 1) {
        return res.status(400).json({ error: 'Please provide a valid bot name.' });
      }

      const trimmedName = name.trim();
      let nicknameUpdated = false;
      let usernameUpdated = false;
      let notes: string[] = [];

      // 1. Update guild nickname for instant server visibility
      const targetGuild = guildId ? client.guilds.cache.get(guildId) : client.guilds.cache.first();
      if (targetGuild && targetGuild.members.me) {
        try {
          await targetGuild.members.me.setNickname(trimmedName);
          nicknameUpdated = true;
        } catch (err: any) {
          notes.push(`Nickname error: ${err.message}`);
        }
      }

      // 2. Update global username if within Discord's rate limits
      if (client.user) {
        try {
          await client.user.setUsername(trimmedName);
          usernameUpdated = true;
        } catch (err: any) {
          notes.push(`Global username note: ${err.message}`);
        }
      }

      // Persist dynamic bot name in active runtime and database
      setDynamicBotName(trimmedName);
      try {
        db.prepare("INSERT OR REPLACE INTO bot_settings (key, value) VALUES ('bot_name', ?)").run(trimmedName);
      } catch {}

      Logger.info(`Bot identity updated to "${trimmedName}" via Dashboard`);
      return res.json({
        success: nicknameUpdated || usernameUpdated,
        name: trimmedName,
        nicknameUpdated,
        usernameUpdated,
        message: nicknameUpdated || usernameUpdated
          ? `Bot identity successfully updated to "${trimmedName}"!`
          : `Update notice: ${notes.join(' | ') || 'Failed to update name.'}`,
      });
    });

    // Embed Studio: Dispatch live custom embed to any text channel
    app.post('/api/embeds/send', authMiddleware, async (req: Request, res: Response) => {
      const {
        channelId,
        content,
        title,
        description,
        color,
        authorName,
        authorIcon,
        footerText,
        footerIcon,
        imageUrl,
        thumbnailUrl,
        fields,
      } = req.body;

      if (!channelId) {
        return res.status(400).json({ error: 'Target Discord channel is required.' });
      }

      const channel = client.channels.cache.get(channelId);
      if (!channel || !channel.isTextBased() || !('send' in channel)) {
        return res.status(404).json({ error: 'Target text channel not found or bot lacks write access.' });
      }

      try {
        const embed = new EmbedBuilder();
        if (title && title.trim()) embed.setTitle(title.trim());
        if (description && description.trim()) embed.setDescription(description.trim());
        if (color && color.trim()) embed.setColor(color.trim() as ColorResolvable);
        else embed.setColor(CONFIG.COLORS.PRIMARY as ColorResolvable);

        if (authorName && authorName.trim()) {
          embed.setAuthor({
            name: authorName.trim(),
            iconURL: authorIcon && authorIcon.startsWith('http') ? authorIcon.trim() : undefined,
          });
        }

        if (footerText && footerText.trim()) {
          embed.setFooter({
            text: footerText.trim(),
            iconURL: footerIcon && footerIcon.startsWith('http') ? footerIcon.trim() : undefined,
          });
        }

        if (imageUrl && imageUrl.startsWith('http')) {
          embed.setImage(imageUrl.trim());
        }

        if (thumbnailUrl && thumbnailUrl.startsWith('http')) {
          embed.setThumbnail(thumbnailUrl.trim());
        }

        if (Array.isArray(fields)) {
          for (const f of fields) {
            if (f.name && f.name.trim() && f.value && f.value.trim()) {
              embed.addFields({ name: f.name.trim(), value: f.value.trim(), inline: Boolean(f.inline) });
            }
          }
        }

        embed.setTimestamp(new Date());

        const payload: any = { embeds: [embed] };
        if (content && content.trim().length > 0) {
          payload.content = content.trim();
        }

        await (channel as any).send(payload);
        Logger.info(`Custom live embed dispatched to channel #${(channel as any).name} via Dashboard`, 'EmbedStudio');
        return res.json({ success: true, message: `Embed successfully sent to #${(channel as any).name}!` });
      } catch (err: any) {
        Logger.error('Failed to send custom embed:', err);
        return res.status(500).json({ error: err.message || 'Discord API rejected embed payload.' });
      }
    });

    // Reload Command Registry
    app.post('/api/system/reload', authMiddleware, (req: Request, res: Response) => {
      const total = CommandRegistry.getTotalCount();
      return res.json({ success: true, count: total, message: `Command cache verified. Total active commands: ${total}` });
    });

    // Static Asset Serving & Express 5 Compatible SPA Catch-All
    if (fs.existsSync(publicDir)) {
      app.use(express.static(publicDir));

      app.use((req: Request, res: Response) => {
        const indexPath = path.join(publicDir, 'index.html');
        if (fs.existsSync(indexPath)) {
          res.sendFile(indexPath);
        } else {
          res.status(404).send('Dashboard Web UI index.html not found.');
        }
      });
    }

    const port = CONFIG.DASHBOARD_PORT || 3000;
    try {
      this.server = app.listen(port, () => {
        Logger.info(`Web Admin Dashboard server listening at http://localhost:${port}`, 'DashboardServer');
      });
    } catch (err: any) {
      Logger.error(`Failed to launch Web Dashboard server on port ${port}:`, err);
    }
  }

  static stop() {
    if (this.server) {
      this.server.close();
      Logger.info('Web Dashboard server stopped.', 'DashboardServer');
    }
  }
}
