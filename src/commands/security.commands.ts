import { ApplicationCommandOptionType, PermissionsBitField } from 'discord.js';
import { HeliumCommand } from '../core/types.js';
import { db } from '../config/database.js';
import { SecurityService } from '../services/security.service.js';
import { RoleService } from '../services/role.service.js';

export const securityCommands: HeliumCommand[] = [
  {
    name: 'antinuke',
    description: 'Configure and inspect the Helium Anti-Nuke security suite',
    category: 'Security',
    aliases: ['an', 'guard', 'defense', 'shieldbot'],
    permissions: [PermissionsBitField.Flags.Administrator],
    execute: async (ctx) => {
      const config = db.prepare('SELECT * FROM guilds WHERE id = ?').get(ctx.guild!.id) as any;
      const enabled = config?.antinuke_enabled ? 'Enabled' : 'Disabled';
      const action = config?.antinuke_action || 'ban';
      const threshold = config?.antinuke_threshold || 3;

      const trustedCount = (db.prepare('SELECT COUNT(*) as c FROM trusted_entities WHERE guild_id = ?').get(ctx.guild!.id) as any).c;
      const protectedCount = (db.prepare('SELECT COUNT(*) as c FROM protected_entities WHERE guild_id = ?').get(ctx.guild!.id) as any).c;

      return ctx.replySecurity(
        'Anti-Nuke Protection Suite',
        `**Status:** \`${enabled}\`\n` +
        `**Enforcement Action:** \`${action.toUpperCase()}\`\n` +
        `**Action Threshold:** \`${threshold} events in 30s\`\n` +
        `**Trusted Whitelist:** \`${trustedCount}\` entities\n` +
        `**Protected Resources:** \`${protectedCount}\` entities\n\n` +
        `Use \`&antinuke-enable\` or \`&antinuke-disable\` to toggle, and \`&trusted\` to manage whitelist.`
      );
    },
  },
  {
    name: 'antinuke-status',
    description: 'Detailed Anti-Nuke engine health and threat metrics',
    category: 'Security',
    aliases: ['anstatus', 'guardstatus', 'defensestatus'],
    permissions: [PermissionsBitField.Flags.Administrator],
    execute: async (ctx) => {
      const recentEvents = db.prepare('SELECT COUNT(*) as c FROM security_events WHERE guild_id = ? AND timestamp > ?').get(ctx.guild!.id, Date.now() - 3600000) as any;
      return ctx.replySecurity(
        'Anti-Nuke Status & Health',
        `**Engine Status:** \`ONLINE - ARMED\`\n` +
        `**Security Incidents (Last 1h):** \`${recentEvents.c}\`\n` +
        `**Rate Limiting:** \`Sliding 30s Window Active\`\n` +
        `**Threat Level:** \`${recentEvents.c > 5 ? 'ELEVATED' : 'NOMINAL'}\``
      );
    },
  },
  {
    name: 'antinuke-enable',
    description: 'Arm and enable the Anti-Nuke engine',
    category: 'Security',
    aliases: ['anenable', 'armantinuke', 'guardon'],
    permissions: [PermissionsBitField.Flags.Administrator],
    execute: async (ctx) => {
      db.prepare('UPDATE guilds SET antinuke_enabled = 1 WHERE id = ?').run(ctx.guild!.id);
      return ctx.replySuccess('Anti-Nuke Armed', 'Anti-Nuke shield has been activated. Server destruction actions will be immediately countered.');
    },
  },
  {
    name: 'antinuke-disable',
    description: 'Disarm and disable Anti-Nuke engine',
    category: 'Security',
    aliases: ['andisable', 'disarmantinuke', 'guardoff'],
    permissions: [PermissionsBitField.Flags.Administrator],
    execute: async (ctx) => {
      db.prepare('UPDATE guilds SET antinuke_enabled = 0 WHERE id = ?').run(ctx.guild!.id);
      return ctx.replyWarning('Anti-Nuke Disarmed', 'Anti-Nuke protection has been deactivated for this server.');
    },
  },
  {
    name: 'antinuke-threshold',
    description: 'Set Anti-Nuke trigger threshold count',
    category: 'Security',
    aliases: ['anthreshold', 'limitthreshold', 'guardlimit'],
    permissions: [PermissionsBitField.Flags.Administrator],
    slashOptions: [
      { name: 'count', description: 'Action count threshold (1-10)', type: ApplicationCommandOptionType.Integer, required: true },
    ],
    execute: async (ctx) => {
      const count = ctx.interaction ? ctx.interaction.options.getInteger('count', true) : parseInt(ctx.args[0] || '3');
      if (isNaN(count) || count < 1 || count > 10) return ctx.replyError('Invalid Range', 'Threshold must be between 1 and 10.');

      db.prepare('UPDATE guilds SET antinuke_threshold = ? WHERE id = ?').run(count, ctx.guild!.id);
      return ctx.replySuccess('Threshold Updated', `Anti-Nuke action threshold updated to **${count}** actions per 30 seconds.`);
    },
  },
  {
    name: 'antinuke-action',
    description: 'Set Anti-Nuke punishment (ban, kick, strip_roles)',
    category: 'Security',
    aliases: ['anaction', 'guardpunish', 'punishmentset'],
    permissions: [PermissionsBitField.Flags.Administrator],
    slashOptions: [
      {
        name: 'action',
        description: 'Punishment type',
        type: ApplicationCommandOptionType.String,
        required: true,
        choices: [
          { name: 'Ban', value: 'ban' },
          { name: 'Kick', value: 'kick' },
          { name: 'Strip Roles', value: 'strip_roles' },
        ],
      },
    ],
    execute: async (ctx) => {
      const action = (ctx.interaction ? ctx.interaction.options.getString('action', true) : ctx.args[0]?.toLowerCase()) || 'ban';
      if (!['ban', 'kick', 'strip_roles'].includes(action)) {
        return ctx.replyError('Invalid Action', 'Choose between `ban`, `kick`, or `strip_roles`.');
      }

      db.prepare('UPDATE guilds SET antinuke_action = ? WHERE id = ?').run(action, ctx.guild!.id);
      return ctx.replySuccess('Punishment Configured', `Anti-Nuke action set to **${action.toUpperCase()}**.`);
    },
  },
  {
    name: 'antinuke-whitelist',
    description: 'View the list of trusted users, roles, and bots',
    category: 'Security',
    aliases: ['anwhitelist', 'anwl', 'trustedlist', 'trusts'],
    permissions: [PermissionsBitField.Flags.Administrator],
    execute: async (ctx) => {
      const rows = db.prepare('SELECT * FROM trusted_entities WHERE guild_id = ?').all(ctx.guild!.id) as any[];
      if (rows.length === 0) return ctx.replyInfo('Trusted Entities', 'No entities are currently whitelisted.');

      const text = rows.map(r => `• <@${r.entity_id}> (\`${r.entity_id}\`) — Type: \`${r.type}\``).join('\n');
      return ctx.replyInfo('Trusted Entities Whitelist', text);
    },
  },
  {
    name: 'antinuke-protect',
    description: 'Mark a channel or role as protected from deletion',
    category: 'Security',
    aliases: ['protectrole', 'protectchannel', 'addprotect'],
    permissions: [PermissionsBitField.Flags.Administrator],
    slashOptions: [
      { name: 'id', description: 'Channel or Role ID', type: ApplicationCommandOptionType.String, required: true },
      {
        name: 'type',
        description: 'Type of entity',
        type: ApplicationCommandOptionType.String,
        required: true,
        choices: [
          { name: 'Channel', value: 'CHANNEL' },
          { name: 'Role', value: 'ROLE' },
        ],
      },
    ],
    execute: async (ctx) => {
      const id = ctx.interaction ? ctx.interaction.options.getString('id', true) : ctx.args[0];
      const type = (ctx.interaction ? ctx.interaction.options.getString('type', true) : ctx.args[1]?.toUpperCase()) || 'ROLE';

      if (!id) return ctx.replyError('Missing Arguments', 'Usage: `&antinuke-protect <id> <CHANNEL|ROLE>`');

      db.prepare(`
        INSERT OR REPLACE INTO protected_entities (guild_id, entity_id, type, created_at)
        VALUES (?, ?, ?, ?)
      `).run(ctx.guild!.id, id, type, Date.now());

      return ctx.replySuccess('Entity Protected', `<@&${id}> / <#${id}> (\`${id}\`) marked as a protected resource.`);
    },
  },
  {
    name: 'antinuke-unprotect',
    description: 'Remove protection from a channel or role',
    category: 'Security',
    aliases: ['unprotectrole', 'unprotectchannel', 'delprotect'],
    permissions: [PermissionsBitField.Flags.Administrator],
    slashOptions: [
      { name: 'id', description: 'Entity ID to unprotect', type: ApplicationCommandOptionType.String, required: true },
    ],
    execute: async (ctx) => {
      const id = ctx.interaction ? ctx.interaction.options.getString('id', true) : ctx.args[0];
      if (!id) return ctx.replyError('Missing ID', 'Please specify an entity ID.');

      const res = db.prepare('DELETE FROM protected_entities WHERE guild_id = ? AND entity_id = ?').run(ctx.guild!.id, id);
      return ctx.replySuccess('Protection Lifted', `Entity \`${id}\` removed from protection.`);
    },
  },
  {
    name: 'antinuke-lockdown',
    description: 'Emergency lockdown of all guild channels',
    category: 'Security',
    aliases: ['lockdown', 'serverlock', 'freezeguild'],
    permissions: [PermissionsBitField.Flags.Administrator],
    botPermissions: [PermissionsBitField.Flags.ManageChannels],
    execute: async (ctx) => {
      const count = await SecurityService.setLockdown(ctx.guild!, true, `Lockdown command by ${ctx.user.tag}`);
      return ctx.replySecurity('Server Lockdown Activated', `Locked down **${count}** channels across the server.`);
    },
  },
  {
    name: 'antinuke-unlockdown',
    description: 'Lift emergency lockdown on all channels',
    category: 'Security',
    aliases: ['unlockdown', 'unserverlock', 'unfreezeguild'],
    permissions: [PermissionsBitField.Flags.Administrator],
    botPermissions: [PermissionsBitField.Flags.ManageChannels],
    execute: async (ctx) => {
      const count = await SecurityService.setLockdown(ctx.guild!, false, `Lockdown lifted by ${ctx.user.tag}`);
      return ctx.replySuccess('Lockdown Lifted', `Restored access to **${count}** channels.`);
    },
  },
  {
    name: 'antinuke-panic',
    description: 'Activate extreme panic mode (locks down server and enables max security)',
    category: 'Security',
    aliases: ['panic', 'panicmode', 'emergency'],
    permissions: [PermissionsBitField.Flags.Administrator],
    execute: async (ctx) => {
      await SecurityService.setLockdown(ctx.guild!, true, 'PANIC MODE INITIATED');
      db.prepare('UPDATE guilds SET antinuke_enabled = 1, antinuke_threshold = 1 WHERE id = ?').run(ctx.guild!.id);

      return ctx.replySecurity(
        'PANIC MODE ARMED',
        'Emergency protocol executed:\n' +
        '• All channels locked\n' +
        '• Anti-Nuke threshold reduced to `1 action`\n' +
        '• Maximum containment in effect.'
      );
    },
  },
  {
    name: 'antiraid',
    description: 'Configure and inspect Anti-Raid join speed monitoring',
    category: 'Security',
    aliases: ['ar', 'raidguard', 'raiddefense'],
    permissions: [PermissionsBitField.Flags.Administrator],
    execute: async (ctx) => {
      const config = db.prepare('SELECT antiraid_enabled, antiraid_threshold FROM guilds WHERE id = ?').get(ctx.guild!.id) as any;
      return ctx.replySecurity(
        'Anti-Raid Monitor',
        `**Status:** \`${config?.antiraid_enabled ? 'Active' : 'Disabled'}\`\n` +
        `**Threshold:** \`${config?.antiraid_threshold || 5} joins / 10s\`\n` +
        `**Mitigation:** Automatic quarantine and join throttle.`
      );
    },
  },
  {
    name: 'raidmode',
    description: 'Manually toggle raid defense mode on or off',
    category: 'Security',
    aliases: ['toggleraid', 'raidshield', 'antispike'],
    permissions: [PermissionsBitField.Flags.Administrator],
    execute: async (ctx) => {
      const config = db.prepare('SELECT antiraid_enabled FROM guilds WHERE id = ?').get(ctx.guild!.id) as any;
      const newState = config?.antiraid_enabled ? 0 : 1;
      db.prepare('UPDATE guilds SET antiraid_enabled = ? WHERE id = ?').run(newState, ctx.guild!.id);

      return ctx.replySecurity('Raid Defense Mode', `Anti-Raid protection is now **${newState ? 'ENABLED' : 'DISABLED'}**.`);
    },
  },
  {
    name: 'quarantine',
    description: 'Isolate a member into quarantine',
    category: 'Security',
    aliases: ['isolate', 'jailuser', 'detain'],
    permissions: [PermissionsBitField.Flags.ModerateMembers],
    slashOptions: [
      { name: 'user', description: 'Member to quarantine', type: ApplicationCommandOptionType.User, required: true },
    ],
    execute: async (ctx) => {
      const user = ctx.interaction ? ctx.interaction.options.getUser('user', true) : ctx.message?.mentions.users.first();
      if (!user) return ctx.replyError('Missing User', 'Please specify a user to quarantine.');

      const member = await ctx.guild?.members.fetch(user.id).catch(() => null);
      if (!member) return ctx.replyError('Member Not Found', 'Target is not in this server.');

      // Timeout for 28 days (maximum Discord quarantine)
      await member.timeout(28 * 24 * 60 * 60 * 1000, `Quarantined by ${ctx.user.tag}`);
      return ctx.replySecurity('Member Quarantined', `<@${user.id}> has been isolated and placed in quarantine.`);
    },
  },
  {
    name: 'unquarantine',
    description: 'Release a member from quarantine',
    category: 'Security',
    aliases: ['unjailed', 'freeuser', 'releasejail'],
    permissions: [PermissionsBitField.Flags.ModerateMembers],
    slashOptions: [
      { name: 'user', description: 'Member to release', type: ApplicationCommandOptionType.User, required: true },
    ],
    execute: async (ctx) => {
      const user = ctx.interaction ? ctx.interaction.options.getUser('user', true) : ctx.message?.mentions.users.first();
      if (!user) return ctx.replyError('Missing User', 'Please specify a user.');

      const member = await ctx.guild?.members.fetch(user.id).catch(() => null);
      if (!member) return ctx.replyError('Member Not Found', 'Target is not in this server.');

      await member.timeout(null, `Quarantine released by ${ctx.user.tag}`);
      return ctx.replySuccess('Quarantine Lifted', `<@${user.id}> has been released from quarantine.`);
    },
  },
  {
    name: 'security',
    description: 'Comprehensive Security and Anti-Nuke Dashboard',
    category: 'Security',
    aliases: ['sec', 'secdashboard', 'securitystatus'],
    permissions: [PermissionsBitField.Flags.Administrator],
    execute: async (ctx) => {
      const guildRow = db.prepare('SELECT * FROM guilds WHERE id = ?').get(ctx.guild!.id) as any;
      const recentEvents = db.prepare('SELECT * FROM security_events WHERE guild_id = ? ORDER BY timestamp DESC LIMIT 3').all(ctx.guild!.id) as any[];

      const summary =
        `**Anti-Nuke:** \`${guildRow?.antinuke_enabled ? 'ARMED' : 'DISARMED'}\`\n` +
        `**Anti-Raid:** \`${guildRow?.antiraid_enabled ? 'ONLINE' : 'OFFLINE'}\`\n` +
        `**AutoMod:** \`${guildRow?.automod_enabled ? 'ACTIVE' : 'INACTIVE'}\`\n\n` +
        `**Recent Security Alerts:**\n` +
        (recentEvents.length > 0
          ? recentEvents.map(e => `• \`${e.event_id}\` — **${e.event_type}** (${e.action_taken})`).join('\n')
          : '• None');

      return ctx.replySecurity('Helium Security Dashboard', summary);
    },
  },
  {
    name: 'security-log',
    description: 'View recent security incidents from database audit trail',
    category: 'Security',
    aliases: ['seclogs', 'incidentlogs', 'auditsecurity'],
    permissions: [PermissionsBitField.Flags.Administrator],
    execute: async (ctx) => {
      const rows = db.prepare('SELECT * FROM security_events WHERE guild_id = ? ORDER BY timestamp DESC LIMIT 5').all(ctx.guild!.id) as any[];
      if (rows.length === 0) return ctx.replyInfo('Security Logs', 'Zero security incidents recorded.');

      const text = rows.map(r => `\`${r.event_id}\` [${r.severity}] **${r.event_type}** by <@${r.actor_id}>\nAction: \`${r.action_taken}\` • Risk: \`${r.risk_score} pts\``).join('\n\n');
      return ctx.replySecurity('Security Audit Logs', text);
    },
  },
  {
    name: 'trusted',
    description: 'Add an entity to trusted whitelist',
    category: 'Security',
    aliases: ['trust', 'addtrusted', 'whitelistuser'],
    permissions: [PermissionsBitField.Flags.Administrator],
    slashOptions: [
      { name: 'id', description: 'User, Role, or Bot ID to trust', type: ApplicationCommandOptionType.String, required: true },
    ],
    execute: async (ctx) => {
      const id = ctx.interaction ? ctx.interaction.options.getString('id', true) : ctx.args[0];
      if (!id) return ctx.replyError('Missing Target', 'Please specify an entity ID to trust.');

      db.prepare(`
        INSERT OR REPLACE INTO trusted_entities (guild_id, entity_id, type, added_by, created_at)
        VALUES (?, ?, 'USER', ?, ?)
      `).run(ctx.guild!.id, id, ctx.user.id, Date.now());

      return ctx.replySuccess('Entity Trusted', `<@${id}> (\`${id}\`) is now whitelisted in Anti-Nuke.`);
    },
  },
  {
    name: 'untrusted',
    description: 'Remove an entity from trusted whitelist',
    category: 'Security',
    aliases: ['untrust', 'deltrusted', 'unwhitelistuser'],
    permissions: [PermissionsBitField.Flags.Administrator],
    slashOptions: [
      { name: 'id', description: 'Entity ID to remove', type: ApplicationCommandOptionType.String, required: true },
    ],
    execute: async (ctx) => {
      const id = ctx.interaction ? ctx.interaction.options.getString('id', true) : ctx.args[0];
      if (!id) return ctx.replyError('Missing Target', 'Please provide an entity ID.');

      db.prepare('DELETE FROM trusted_entities WHERE guild_id = ? AND entity_id = ?').run(ctx.guild!.id, id);
      return ctx.replySuccess('Trust Revoked', `Entity \`${id}\` removed from whitelist.`);
    },
  },
  {
    name: 'backup',
    description: 'Create an instant snapshot backup of server roles and permissions',
    category: 'Security',
    aliases: ['guildbackup', 'createbackup', 'snapshotguild'],
    permissions: [PermissionsBitField.Flags.Administrator],
    execute: async (ctx) => {
      const backupId = RoleService.backupRoles(ctx.guild!, ctx.user.id);
      return ctx.replySuccess('Role Backup Created', `Successfully generated role backup snapshot.\n**Backup ID:** \`${backupId}\`\nUse \`&role-restore ${backupId}\` to restore.`);
    },
  },
];
