import { ApplicationCommandOptionType, PermissionsBitField, Role, TextChannel } from 'discord.js';
import { HeliumCommand } from '../core/types.js';
import { db } from '../config/database.js';
import { VerificationService } from '../services/verification.service.js';

export const welcomeCommands: HeliumCommand[] = [
  {
    name: 'welcome',
    description: 'Configure automated welcome greeting channel and template',
    category: 'Welcome',
    aliases: ['setwelcome', 'welcomemsg', 'greetchannel'],
    permissions: [PermissionsBitField.Flags.ManageGuild],
    slashOptions: [
      { name: 'channel', description: 'Channel to send welcome greetings', type: ApplicationCommandOptionType.Channel, required: true },
      { name: 'message', description: 'Template using {user}, {server}, {count}', type: ApplicationCommandOptionType.String, required: false },
    ],
    execute: async (ctx) => {
      const channel = ctx.interaction ? ctx.interaction.options.getChannel('channel', true) : ctx.message?.mentions.channels.first();
      const msg = (ctx.interaction ? ctx.interaction.options.getString('message') : ctx.args.slice(1).join(' ')) || 'Welcome {user} to {server}! You are member #{count}.';

      if (!channel) return ctx.replyError('Missing Channel', 'Please provide a target channel.');

      db.prepare(`
        UPDATE guilds SET welcome_enabled = 1, welcome_channel = ?, welcome_message = ? WHERE id = ?
      `).run(channel.id, msg, ctx.guild!.id);

      return ctx.replySuccess('Welcome System Enabled', `Welcome announcements routed to <#${channel.id}>.\n**Message Format:**\n> ${msg}`);
    },
  },
  {
    name: 'goodbye',
    description: 'Configure goodbye departure announcements',
    category: 'Welcome',
    aliases: ['setgoodbye', 'leavemsg', 'farewellchannel'],
    permissions: [PermissionsBitField.Flags.ManageGuild],
    slashOptions: [
      { name: 'channel', description: 'Channel to send leave notices', type: ApplicationCommandOptionType.Channel, required: true },
      { name: 'message', description: 'Template text', type: ApplicationCommandOptionType.String, required: false },
    ],
    execute: async (ctx) => {
      const channel = ctx.interaction ? ctx.interaction.options.getChannel('channel', true) : ctx.message?.mentions.channels.first();
      const msg = (ctx.interaction ? ctx.interaction.options.getString('message') : ctx.args.slice(1).join(' ')) || '{user} left {server}. We now have {count} members.';

      if (!channel) return ctx.replyError('Missing Channel', 'Please provide a target channel.');

      db.prepare(`
        UPDATE guilds SET goodbye_enabled = 1, goodbye_channel = ?, goodbye_message = ? WHERE id = ?
      `).run(channel.id, msg, ctx.guild!.id);

      return ctx.replySuccess('Goodbye System Enabled', `Departures logged in <#${channel.id}>.`);
    },
  },
  {
    name: 'verification',
    description: 'Setup button-based raid verification gate in a channel',
    category: 'Welcome',
    aliases: ['verifygate', 'verifychannel', 'gatekeeper'],
    permissions: [PermissionsBitField.Flags.Administrator],
    slashOptions: [
      { name: 'channel', description: 'Channel for verification button', type: ApplicationCommandOptionType.Channel, required: true },
      { name: 'role', description: 'Role granted on successful verification', type: ApplicationCommandOptionType.Role, required: true },
    ],
    execute: async (ctx) => {
      const channel = (ctx.interaction ? ctx.interaction.options.getChannel('channel', true) : ctx.message?.mentions.channels.first()) as TextChannel;
      const role = (ctx.interaction ? ctx.interaction.options.getRole('role', true) : ctx.message?.mentions.roles.first()) as Role;

      if (!channel || !role) return ctx.replyError('Missing Arguments', 'Usage: `&verification #channel @role`');

      await VerificationService.sendVerificationPanel(channel, role.id);
      return ctx.replySuccess('Verification Gate Deployed', `Interactive button posted in <#${channel.id}>. Members clicking will receive <@&${role.id}>.`);
    },
  },
  {
    name: 'verify',
    description: 'Manually trigger verification for your account',
    category: 'Welcome',
    aliases: ['pass', 'checkin', 'getverified'],
    execute: async (ctx) => {
      if (!ctx.member) return;
      const result = await VerificationService.handleVerifyClick(ctx.member);
      if (result.success) return ctx.replySuccess('Verification Complete', result.message);
      return ctx.replyError('Verification Failed', result.message);
    },
  },
  {
    name: 'welcometest',
    description: 'Simulate a test member join greeting',
    category: 'Welcome',
    aliases: ['testwelcome', 'simulatejoin', 'trywelcome'],
    permissions: [PermissionsBitField.Flags.ManageGuild],
    execute: async (ctx) => {
      const config = db.prepare('SELECT welcome_channel, welcome_message FROM guilds WHERE id = ?').get(ctx.guild!.id) as any;
      if (!config?.welcome_channel) return ctx.replyWarning('Not Configured', 'Welcome channel is not set up.');

      const text = (config.welcome_message || 'Welcome {user} to {server}!')
        .replace('{user}', `<@${ctx.user.id}>`)
        .replace('{server}', ctx.guild!.name)
        .replace('{count}', ctx.guild!.memberCount.toString());

      return ctx.replyInfo('Test Welcome Message', text);
    },
  },
  {
    name: 'goodbyetest',
    description: 'Simulate a test member leave message',
    category: 'Welcome',
    aliases: ['testgoodbye', 'simulateleave', 'trygoodbye'],
    permissions: [PermissionsBitField.Flags.ManageGuild],
    execute: async (ctx) => {
      const config = db.prepare('SELECT goodbye_channel, goodbye_message FROM guilds WHERE id = ?').get(ctx.guild!.id) as any;
      if (!config?.goodbye_channel) return ctx.replyWarning('Not Configured', 'Goodbye channel is not set up.');

      const text = (config.goodbye_message || '{user} left {server}!')
        .replace('{user}', ctx.user.tag)
        .replace('{server}', ctx.guild!.name)
        .replace('{count}', ctx.guild!.memberCount.toString());

      return ctx.replyInfo('Test Goodbye Message', text);
    },
  },
];
