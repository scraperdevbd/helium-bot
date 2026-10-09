import { ApplicationCommandOptionType, PermissionsBitField } from 'discord.js';
import { HeliumCommand } from '../core/types.js';
import { db } from '../config/database.js';

export const loggingCommands: HeliumCommand[] = [
  {
    name: 'logs',
    description: 'Inspect active logging channels across the server',
    category: 'Logging',
    aliases: ['logstatus', 'loggingstatus', 'channelslogs'],
    permissions: [PermissionsBitField.Flags.ManageGuild],
    execute: async (ctx) => {
      const config = db.prepare('SELECT * FROM guilds WHERE id = ?').get(ctx.guild!.id) as any;
      const fmt = (id?: string) => (id ? `<#${id}>` : '`Disabled`');

      return ctx.replySettings(
        'Server Logging Channels',
        `**Moderation Logs:** ${fmt(config?.mod_log_channel)}\n` +
        `**Server / Message Logs:** ${fmt(config?.server_log_channel)}\n` +
        `**Member Join/Leave Logs:** ${fmt(config?.member_log_channel)}\n` +
        `**Security / Anti-Nuke Logs:** ${fmt(config?.security_log_channel)}\n` +
        `**AutoMod Logs:** ${fmt(config?.automod_log_channel)}\n` +
        `**Voice Activity Logs:** ${fmt(config?.voice_log_channel)}\n` +
        `**Ticket Logs:** ${fmt(config?.ticket_log_channel)}\n\n` +
        `Use \`&modlogs #channel\` or \`&securitylogs #channel\` to configure routing.`
      );
    },
  },
  {
    name: 'logs-config',
    description: 'Set master server and message activity log channel',
    category: 'Logging',
    aliases: ['setlogs', 'configlogs', 'setlogchannel'],
    permissions: [PermissionsBitField.Flags.ManageGuild],
    slashOptions: [
      { name: 'channel', description: 'Log channel', type: ApplicationCommandOptionType.Channel, required: true },
    ],
    execute: async (ctx) => {
      const channel = ctx.interaction ? ctx.interaction.options.getChannel('channel', true) : ctx.message?.mentions.channels.first();
      if (!channel) return ctx.replyError('Missing Channel', 'Please specify a target channel.');

      db.prepare('UPDATE guilds SET server_log_channel = ? WHERE id = ?').run(channel.id, ctx.guild!.id);
      return ctx.replySuccess('Server Logs Configured', `Server message updates and channel logs routed to <#${channel.id}>.`);
    },
  },
  {
    name: 'modlogs',
    description: 'Set moderation actions log channel',
    category: 'Logging',
    aliases: ['setmodlogs', 'modlogchannel', 'moderationlogs'],
    permissions: [PermissionsBitField.Flags.ManageGuild],
    slashOptions: [
      { name: 'channel', description: 'Log channel for punishments', type: ApplicationCommandOptionType.Channel, required: true },
    ],
    execute: async (ctx) => {
      const channel = ctx.interaction ? ctx.interaction.options.getChannel('channel', true) : ctx.message?.mentions.channels.first();
      if (!channel) return ctx.replyError('Missing Channel', 'Please specify a target channel.');

      db.prepare('UPDATE guilds SET mod_log_channel = ? WHERE id = ?').run(channel.id, ctx.guild!.id);
      return ctx.replySuccess('Mod Logs Configured', `Punishment cases and warnings routed to <#${channel.id}>.`);
    },
  },
  {
    name: 'messagelogs',
    description: 'Set message delete and edit log channel',
    category: 'Logging',
    aliases: ['setmessagelogs', 'msglogs', 'editdeletelogs'],
    permissions: [PermissionsBitField.Flags.ManageGuild],
    slashOptions: [
      { name: 'channel', description: 'Channel for message edit/delete logs', type: ApplicationCommandOptionType.Channel, required: true },
    ],
    execute: async (ctx) => {
      const channel = ctx.interaction ? ctx.interaction.options.getChannel('channel', true) : ctx.message?.mentions.channels.first();
      if (!channel) return ctx.replyError('Missing Channel', 'Please specify a target channel.');

      db.prepare('UPDATE guilds SET server_log_channel = ? WHERE id = ?').run(channel.id, ctx.guild!.id);
      return ctx.replySuccess('Message Logs Configured', `Message deletion and edit records routed to <#${channel.id}>.`);
    },
  },
  {
    name: 'memberlogs',
    description: 'Set member join and leave log channel',
    category: 'Logging',
    aliases: ['setmemberlogs', 'joinleavelogs', 'userlogs'],
    permissions: [PermissionsBitField.Flags.ManageGuild],
    slashOptions: [
      { name: 'channel', description: 'Channel for member joins and leaves', type: ApplicationCommandOptionType.Channel, required: true },
    ],
    execute: async (ctx) => {
      const channel = ctx.interaction ? ctx.interaction.options.getChannel('channel', true) : ctx.message?.mentions.channels.first();
      if (!channel) return ctx.replyError('Missing Channel', 'Please specify a target channel.');

      db.prepare('UPDATE guilds SET member_log_channel = ? WHERE id = ?').run(channel.id, ctx.guild!.id);
      return ctx.replySuccess('Member Logs Configured', `Member joins and leaves routed to <#${channel.id}>.`);
    },
  },
  {
    name: 'rolelogs',
    description: 'Configure channel for role creation, edit, and deletion logs',
    category: 'Logging',
    aliases: ['setrolelogs', 'roleslogging', 'rolechangelogs'],
    permissions: [PermissionsBitField.Flags.ManageGuild],
    slashOptions: [
      { name: 'channel', description: 'Channel for role changes', type: ApplicationCommandOptionType.Channel, required: true },
    ],
    execute: async (ctx) => {
      const channel = ctx.interaction ? ctx.interaction.options.getChannel('channel', true) : ctx.message?.mentions.channels.first();
      if (!channel) return ctx.replyError('Missing Channel', 'Please specify a target channel.');

      db.prepare('UPDATE guilds SET server_log_channel = ? WHERE id = ?').run(channel.id, ctx.guild!.id);
      return ctx.replySuccess('Role Logs Configured', `Role audit logs routed to <#${channel.id}>.`);
    },
  },
  {
    name: 'channellogs',
    description: 'Configure channel for channel lifecycle events',
    category: 'Logging',
    aliases: ['setchannellogs', 'channelslogging', 'channelchangelogs'],
    permissions: [PermissionsBitField.Flags.ManageGuild],
    slashOptions: [
      { name: 'channel', description: 'Channel for channel events', type: ApplicationCommandOptionType.Channel, required: true },
    ],
    execute: async (ctx) => {
      const channel = ctx.interaction ? ctx.interaction.options.getChannel('channel', true) : ctx.message?.mentions.channels.first();
      if (!channel) return ctx.replyError('Missing Channel', 'Please specify a target channel.');

      db.prepare('UPDATE guilds SET server_log_channel = ? WHERE id = ?').run(channel.id, ctx.guild!.id);
      return ctx.replySuccess('Channel Logs Configured', `Channel changes routed to <#${channel.id}>.`);
    },
  },
  {
    name: 'voicelogs',
    description: 'Configure channel for voice state updates',
    category: 'Logging',
    aliases: ['setvoicelogs', 'vcjoinlogs', 'audiologs'],
    permissions: [PermissionsBitField.Flags.ManageGuild],
    slashOptions: [
      { name: 'channel', description: 'Channel for voice join/leave logs', type: ApplicationCommandOptionType.Channel, required: true },
    ],
    execute: async (ctx) => {
      const channel = ctx.interaction ? ctx.interaction.options.getChannel('channel', true) : ctx.message?.mentions.channels.first();
      if (!channel) return ctx.replyError('Missing Channel', 'Please specify a target channel.');

      db.prepare('UPDATE guilds SET voice_log_channel = ? WHERE id = ?').run(channel.id, ctx.guild!.id);
      return ctx.replySuccess('Voice Logs Configured', `Voice join/leave activity routed to <#${channel.id}>.`);
    },
  },
  {
    name: 'securitylogs',
    description: 'Configure channel for Anti-Nuke and Anti-Raid security alerts',
    category: 'Logging',
    aliases: ['setsecuritylogs', 'secchannel', 'antinukelogs'],
    permissions: [PermissionsBitField.Flags.Administrator],
    slashOptions: [
      { name: 'channel', description: 'Channel for security incident alerts', type: ApplicationCommandOptionType.Channel, required: true },
    ],
    execute: async (ctx) => {
      const channel = ctx.interaction ? ctx.interaction.options.getChannel('channel', true) : ctx.message?.mentions.channels.first();
      if (!channel) return ctx.replyError('Missing Channel', 'Please specify a target channel.');

      db.prepare('UPDATE guilds SET security_log_channel = ? WHERE id = ?').run(channel.id, ctx.guild!.id);
      return ctx.replySuccess('Security Logs Configured', `High-priority security alerts routed to <#${channel.id}>.`);
    },
  },
  {
    name: 'auditlogs',
    description: 'View recent Discord native audit log entries',
    category: 'Logging',
    aliases: ['serveraudit', 'dispaudit', 'guildlogs'],
    permissions: [PermissionsBitField.Flags.ViewAuditLog],
    botPermissions: [PermissionsBitField.Flags.ViewAuditLog],
    execute: async (ctx) => {
      const logs = await ctx.guild?.fetchAuditLogs({ limit: 5 }).catch(() => null);
      if (!logs || logs.entries.size === 0) return ctx.replyInfo('Audit Logs', 'No recent audit entries available.');

      const text = logs.entries.map(e => `• **${e.action}** by <@${e.executor?.id}> (<t:${Math.floor(e.createdTimestamp / 1000)}:R>)`).join('\n');
      return ctx.replyInfo('Recent Server Audit Log Entries', text);
    },
  },
];
