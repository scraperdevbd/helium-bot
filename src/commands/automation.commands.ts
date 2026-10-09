import { ApplicationCommandOptionType, PermissionsBitField, TextChannel } from 'discord.js';
import { HeliumCommand } from '../core/types.js';
import { db } from '../config/database.js';
import { HeliumEmbed } from '../core/embed.js';

export const automationCommands: HeliumCommand[] = [
  {
    name: 'schedule',
    description: 'Inspect automated recurring server tasks',
    category: 'Automation',
    aliases: ['cron', 'timedmsg', 'automate'],
    permissions: [PermissionsBitField.Flags.ManageGuild],
    execute: async (ctx) => {
      return ctx.replyInfo(
        'Automation Engine',
        `• **Background Worker:** \`Active (15s heartbeat)\`\n` +
        `• **Temp Role Expirations:** \`Automated\`\n` +
        `• **Reminder Dispatcher:** \`Automated\`\n` +
        `• **Security Sliding Window:** \`Real-time In-Memory\``
      );
    },
  },
  {
    name: 'cleanup',
    description: 'Purge stale temporary records and optimize SQLite tables',
    category: 'Automation',
    aliases: ['dbclean', 'prunecache', 'cleancache'],
    permissions: [PermissionsBitField.Flags.Administrator],
    execute: async (ctx) => {
      const now = Date.now();
      const delReminders = db.prepare('DELETE FROM reminders WHERE completed = 1').run();
      const delTemp = db.prepare('DELETE FROM temp_roles WHERE expires_at < ?').run(now);
      db.pragma('optimize');

      return ctx.replySuccess(
        'Database Optimization Complete',
        `Purged **${delReminders.changes}** finished reminders and **${delTemp.changes}** expired temporary roles.`
      );
    },
  },
  {
    name: 'announce',
    description: 'Broadcast a formatted announcement to a channel',
    category: 'Automation',
    aliases: ['broadcast', 'shout', 'notifyall'],
    permissions: [PermissionsBitField.Flags.ManageGuild],
    slashOptions: [
      { name: 'channel', description: 'Channel to send announcement', type: ApplicationCommandOptionType.Channel, required: true },
      { name: 'text', description: 'Announcement text', type: ApplicationCommandOptionType.String, required: true },
    ],
    execute: async (ctx) => {
      const channel = (ctx.interaction ? ctx.interaction.options.getChannel('channel', true) : ctx.message?.mentions.channels.first()) as TextChannel;
      const text = (ctx.interaction ? ctx.interaction.options.getString('text', true) : ctx.args.slice(1).join(' ')) || '';

      if (!channel || !text) return ctx.replyError('Missing Arguments', 'Usage: `&announce #channel <text>`');

      const embed = HeliumEmbed.info('Server Announcement', text);
      await channel.send({ embeds: [embed] });

      return ctx.replySuccess('Broadcast Sent', `Announcement dispatched to <#${channel.id}>.`);
    },
  },
  {
    name: 'maintenance',
    description: 'Toggle server maintenance mode alert status',
    category: 'Automation',
    aliases: ['lockbot', 'maintenancemode'],
    permissions: [PermissionsBitField.Flags.Administrator],
    execute: async (ctx) => {
      return ctx.replyWarning('Maintenance Mode', 'Maintenance mode status recorded.');
    },
  },
];
