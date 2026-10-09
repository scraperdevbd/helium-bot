import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionsBitField,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';
import { HeliumCommand } from '../core/types.js';
import { CONFIG } from '../config/config.js';
import { CommandRegistry } from '../core/registry.js';
import { ReminderService } from '../services/reminder.service.js';

export const utilityCommands: HeliumCommand[] = [
  {
    name: 'help',
    description: 'Explore Helium command categories, search features, and view documentation',
    category: 'Utility',
    aliases: ['commands', 'cmds', 'h', 'manual'],
    slashOptions: [
      { name: 'command', description: 'Command name to inspect', type: ApplicationCommandOptionType.String, required: false },
    ],
    execute: async (ctx) => {
      const query = ctx.interaction ? ctx.interaction.options.getString('command') : ctx.args[0];

      if (query) {
        const cmd = CommandRegistry.get(query);
        if (!cmd) return ctx.replyError('Not Found', `Command \`${query}\` does not exist.`);

        return ctx.replyInfo(
          `Command: &${cmd.name}`,
          `**Category:** \`${cmd.category}\`\n` +
          `**Description:** ${cmd.description}\n` +
          `**Usage:** \`&${cmd.name}${cmd.usage ? ' ' + cmd.usage : ''}\`\n` +
          `**Aliases:** ${cmd.aliases?.map(a => `\`&${a}\``).join(', ') || '`None`'}\n` +
          `**Cooldown:** \`${cmd.cooldown || 2}s\`\n` +
          `**Required Permissions:** ${cmd.permissions?.map(p => `\`${new PermissionsBitField(p).toArray().join(', ')}\``).join(', ') || '`Everyone`'}`
        );
      }

      const totalCmds = CommandRegistry.getAll().length;
      const totalAliases = CommandRegistry.getAliasCount();

      const embed = new EmbedBuilder()
        .setColor(CONFIG.COLORS.PRIMARY)
        .setTitle(`${CONFIG.EMOJIS.STAR} ${CONFIG.BOT_NAME} — All-In-One Command Center`)
        .setDescription(
          `${CONFIG.BOT_NAME} is a production-grade, red-themed Discord bot developed by **${CONFIG.AUTHOR}**.\n\n` +
          `**Prefix:** \`${CONFIG.PREFIX}\` • **Slash Commands:** \`${totalCmds}+\` • **Prefix Aliases:** \`${totalAliases}+\`\n\n` +
          `**Command Categories:**\n` +
          `• **Security / Anti-Nuke:** Sliding-window raid defense, lockdown, whitelist\n` +
          `• **Moderation:** Bans, timeouts, cases, purge, slowmode, warnings\n` +
          `• **AutoMod:** Native Discord AutoMod rules, links, invites, spam filter\n` +
          `• **Logging:** 7 dedicated audit channels for real-time tracking\n` +
          `• **Tickets:** Modals, transcript archives, role permissions\n` +
          `• **Roles & Welcome:** Autoroles, backup/restore, verification gate\n` +
          `• **Leveling & Economy:** XP leaderboards, wallet, bank, market store\n` +
          `• **Utility & Info:** Reminders, polls, calculator, snowflake inspector\n\n` +
          `Select a category from the menu below or type \`&help <command>\` for details.`
        )
        .setFooter({ text: `${CONFIG.FOOTER_TEXT} • Author: ${CONFIG.AUTHOR}` })
        .setTimestamp();

      const select = new StringSelectMenuBuilder()
        .setCustomId('helium_help_category_select')
        .setPlaceholder('Select a category to view commands...')
        .addOptions(
          new StringSelectMenuOptionBuilder().setLabel('Overview / Home').setValue('Overview').setDescription('Return to main Helium dashboard'),
          new StringSelectMenuOptionBuilder().setLabel('Moderation').setValue('Moderation').setDescription('Bans, kicks, timeouts, warnings, cases'),
          new StringSelectMenuOptionBuilder().setLabel('Security & Anti-Nuke').setValue('Security').setDescription('Anti-nuke, anti-raid, panic, lockdown'),
          new StringSelectMenuOptionBuilder().setLabel('AutoMod').setValue('AutoMod').setDescription('Invite blocker, spam filter, caps lock'),
          new StringSelectMenuOptionBuilder().setLabel('Logging').setValue('Logging').setDescription('Configurable audit and server logs'),
          new StringSelectMenuOptionBuilder().setLabel('Tickets & Support').setValue('Tickets').setDescription('Ticket panels, claiming, transcripts'),
          new StringSelectMenuOptionBuilder().setLabel('Roles & Verification').setValue('Roles').setDescription('Autoroles, role menus, backups, gate'),
          new StringSelectMenuOptionBuilder().setLabel('Leveling & Economy').setValue('Leveling').setDescription('XP, ranks, balances, market store'),
          new StringSelectMenuOptionBuilder().setLabel('Giveaways & Music').setValue('Giveaways').setDescription('Interactive giveaways and audio queue'),
          new StringSelectMenuOptionBuilder().setLabel('Utility & Tools').setValue('Utility').setDescription('Calculator, timestamps, reminders, info')
        );

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
      return ctx.reply({ embeds: [embed], components: [row] });
    },
  },
  {
    name: 'ping',
    description: 'Check WebSocket and API roundtrip latency',
    category: 'Utility',
    aliases: ['latency', 'speed', 'connection'],
    execute: async (ctx) => {
      const ws = ctx.client.ws.ping;
      return ctx.replyConnection(
        'Helium Connection Latency',
        `**WebSocket Latency:** \`${ws}ms\`\n` +
        `**Response Status:** \`OPTIMAL\`\n` +
        `**Cluster:** \`Primary Gateway Shard 0\``
      );
    },
  },
  {
    name: 'botinfo',
    description: 'Detailed Helium bot statistics, system health, and author credits',
    category: 'Utility',
    aliases: ['about', 'info', 'stats', 'botstats', 'credits'],
    execute: async (ctx) => {
      const uptime = Math.floor(process.uptime());
      const hours = Math.floor(uptime / 3600);
      const mins = Math.floor((uptime % 3600) / 60);
      const secs = uptime % 60;
      const mem = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);

      return ctx.replyInfo(
        `${CONFIG.BOT_NAME} — System Metrics & Community`,
        `**Developer / Author:** **${CONFIG.AUTHOR}**\n` +
        `**Discord:** \`${CONFIG.AUTHOR_DISCORD}\` • **Email:** \`scraperdev.bd@gmail.com\`\n` +
        `**Community Server:** [discord.gg/rQbFHJYnCK](https://discord.gg/rQbFHJYnCK)\n` +
        `**Bot Version:** \`v${CONFIG.VERSION}\` • **Node.js:** \`${process.version}\`\n\n` +
        `**Guilds Served:** \`${ctx.client.guilds.cache.size}\`\n` +
        `**Users Cached:** \`${ctx.client.users.cache.size}\`\n` +
        `**Commands Surface:** \`${CommandRegistry.getTotalCount()}\` (\`${CommandRegistry.getAll().length}\` slash + \`${CommandRegistry.getAliasCount()}\` aliases)\n` +
        `**Memory Usage:** \`${mem} MB\`\n` +
        `**Process Uptime:** \`${hours}h ${mins}m ${secs}s\`\n` +
        `**Database Engine:** \`SQLite (WAL Mode Active)\`\n\n` +
        `*Notice: Built-in custom emojis are private assets. Self-hosters can customize emojis in \`src/config/config.ts\`.*`
      );
    },
  },
  {
    name: 'uptime',
    description: 'View bot process uptime duration',
    category: 'Utility',
    aliases: ['up', 'runtime'],
    execute: async (ctx) => {
      const uptime = Math.floor(process.uptime());
      const hours = Math.floor(uptime / 3600);
      const mins = Math.floor((uptime % 3600) / 60);
      const secs = uptime % 60;

      return ctx.replyInfo('Uptime', `Helium has been continuously active for **${hours}h ${mins}m ${secs}s**.`);
    },
  },
  {
    name: 'serverinfo',
    description: 'Comprehensive guild information and statistics',
    category: 'Utility',
    aliases: ['guildinfo', 'server', 'guildstats'],
    execute: async (ctx) => {
      const g = ctx.guild!;
      return ctx.replyInfo(
        `${g.name} — Server Information`,
        `**Server ID:** \`${g.id}\`\n` +
        `**Owner:** <@${g.ownerId}>\n` +
        `**Created:** <t:${Math.floor(g.createdTimestamp / 1000)}:R>\n` +
        `**Members Count:** \`${g.memberCount}\`\n` +
        `**Channels:** \`${g.channels.cache.size}\`\n` +
        `**Roles:** \`${g.roles.cache.size}\`\n` +
        `**Verification Level:** \`${g.verificationLevel}\`\n` +
        `**Boost Tier:** \`Tier ${g.premiumTier}\` (\`${g.premiumSubscriptionCount || 0} boosts\`)`
      );
    },
  },
  {
    name: 'userinfo',
    description: 'Detailed user account and guild membership profile',
    category: 'Utility',
    aliases: ['whois', 'user', 'memberinfo', 'ui'],
    slashOptions: [
      { name: 'user', description: 'User to view profile for', type: ApplicationCommandOptionType.User, required: false },
    ],
    execute: async (ctx) => {
      const user = (ctx.interaction ? ctx.interaction.options.getUser('user') : ctx.message?.mentions.users.first()) || ctx.user;
      const member = await ctx.guild?.members.fetch(user.id).catch(() => null);

      return ctx.replyInfo(
        `${user.username} — Member Profile`,
        `**User ID:** \`${user.id}\`\n` +
        `**Account Created:** <t:${Math.floor(user.createdTimestamp / 1000)}:F> (<t:${Math.floor(user.createdTimestamp / 1000)}:R>)\n` +
        (member ? `**Joined Server:** <t:${Math.floor(member.joinedTimestamp! / 1000)}:F>\n` : '') +
        (member ? `**Highest Role:** <@&${member.roles.highest.id}>\n` : '') +
        (member ? `**Roles Count:** \`${member.roles.cache.size - 1}\`\n` : '') +
        `**Bot Account:** \`${user.bot ? 'Yes' : 'No'}\``
      );
    },
  },
  {
    name: 'avatar',
    description: 'Display a members profile avatar in maximum resolution',
    category: 'Utility',
    aliases: ['av', 'pfp', 'picture', 'icon'],
    slashOptions: [
      { name: 'user', description: 'User whose avatar to display', type: ApplicationCommandOptionType.User, required: false },
    ],
    execute: async (ctx) => {
      const user = (ctx.interaction ? ctx.interaction.options.getUser('user') : ctx.message?.mentions.users.first()) || ctx.user;
      const avatarUrl = user.displayAvatarURL({ size: 1024 });

      const embed = new EmbedBuilder()
        .setColor(CONFIG.COLORS.PRIMARY)
        .setTitle(`${CONFIG.EMOJIS.STAR} ${user.username}'s Avatar`)
        .setImage(avatarUrl)
        .setDescription(`[Download High-Res Avatar](${avatarUrl})`)
        .setFooter({ text: CONFIG.FOOTER_TEXT });

      return ctx.reply({ embeds: [embed] });
    },
  },
  {
    name: 'banner',
    description: 'Display a users profile banner',
    category: 'Utility',
    aliases: ['userbanner', 'profilebanner'],
    slashOptions: [
      { name: 'user', description: 'Target user', type: ApplicationCommandOptionType.User, required: false },
    ],
    execute: async (ctx) => {
      const user = (ctx.interaction ? ctx.interaction.options.getUser('user') : ctx.message?.mentions.users.first()) || ctx.user;
      const fetched = await user.fetch();
      const bannerUrl = fetched.bannerURL({ size: 1024 });

      if (!bannerUrl) return ctx.replyWarning('No Banner', `${user.username} has no custom profile banner.`);

      const embed = new EmbedBuilder()
        .setColor(CONFIG.COLORS.PRIMARY)
        .setTitle(`${CONFIG.EMOJIS.STAR} ${user.username}'s Banner`)
        .setImage(bannerUrl)
        .setDescription(`[Download High-Res Banner](${bannerUrl})`)
        .setFooter({ text: CONFIG.FOOTER_TEXT });

      return ctx.reply({ embeds: [embed] });
    },
  },
  {
    name: 'snowflake',
    description: 'Deconstruct and decode a Discord snowflake ID creation time',
    category: 'Utility',
    aliases: ['inspectid', 'snow', 'idtime'],
    slashOptions: [
      { name: 'id', description: 'Discord Snowflake ID', type: ApplicationCommandOptionType.String, required: true },
    ],
    execute: async (ctx) => {
      const id = ctx.interaction ? ctx.interaction.options.getString('id', true) : ctx.args[0];
      if (!id || !/^\d{17,20}$/.test(id)) return ctx.replyError('Invalid Snowflake', 'Please provide a valid numeric snowflake ID.');

      const bin = BigInt(id);
      const timestamp = Number((bin >> 22n) + 1420070400000n);

      return ctx.replyInfo(
        'Snowflake Decoded',
        `**Snowflake ID:** \`${id}\`\n` +
        `**Created At:** <t:${Math.floor(timestamp / 1000)}:F>\n` +
        `**Relative Age:** <t:${Math.floor(timestamp / 1000)}:R>`
      );
    },
  },
  {
    name: 'timestamp',
    description: 'Generate Discord markdown timestamp formats from seconds/minutes',
    category: 'Utility',
    aliases: ['timecode', 'maketime', 'converttime'],
    slashOptions: [
      { name: 'seconds', description: 'Seconds from now', type: ApplicationCommandOptionType.Integer, required: true },
    ],
    execute: async (ctx) => {
      const seconds = ctx.interaction ? ctx.interaction.options.getInteger('seconds', true) : parseInt(ctx.args[0] || '60');
      const targetUnix = Math.floor(Date.now() / 1000) + seconds;

      return ctx.replyInfo(
        'Discord Timestamp Formats',
        `**Target:** <t:${targetUnix}:F>\n\n` +
        `• Relative: \`<t:${targetUnix}:R>\` ➔ <t:${targetUnix}:R>\n` +
        `• Full Date/Time: \`<t:${targetUnix}:F>\` ➔ <t:${targetUnix}:F>\n` +
        `• Short Date: \`<t:${targetUnix}:d>\` ➔ <t:${targetUnix}:d>\n` +
        `• Short Time: \`<t:${targetUnix}:t>\` ➔ <t:${targetUnix}:t>`
      );
    },
  },
  {
    name: 'remind',
    description: 'Schedule a future reminder message delivered by Helium',
    category: 'Utility',
    aliases: ['reminder', 'timer', 'remindme'],
    slashOptions: [
      { name: 'minutes', description: 'Time in minutes', type: ApplicationCommandOptionType.Integer, required: true },
      { name: 'message', description: 'Reminder message', type: ApplicationCommandOptionType.String, required: true },
    ],
    execute: async (ctx) => {
      const minutes = ctx.interaction ? ctx.interaction.options.getInteger('minutes', true) : parseInt(ctx.args[0] || '10');
      const msg = (ctx.interaction ? ctx.interaction.options.getString('message', true) : ctx.args.slice(1).join(' ')) || 'Timer finished!';

      if (isNaN(minutes) || minutes <= 0) return ctx.replyError('Invalid Time', 'Please provide a duration in minutes.');

      ReminderService.createReminder(ctx.user.id, ctx.channel!.id, msg, minutes * 60);
      return ctx.replySuccess('Reminder Scheduled', `I will remind you about **"${msg}"** in **${minutes}m**.`);
    },
  },
  {
    name: 'poll',
    description: 'Create an interactive server poll with voting buttons',
    category: 'Utility',
    aliases: ['vote', 'createpoll', 'surveypoll'],
    slashOptions: [
      { name: 'question', description: 'Poll question', type: ApplicationCommandOptionType.String, required: true },
    ],
    execute: async (ctx) => {
      const question = (ctx.interaction ? ctx.interaction.options.getString('question', true) : ctx.args.join(' ')) || 'Community Poll';

      const embed = new EmbedBuilder()
        .setColor(CONFIG.COLORS.PRIMARY)
        .setTitle(`${CONFIG.EMOJIS.STAR} Community Poll`)
        .setDescription(`**${question}**\n\nVote using the buttons below!`)
        .setFooter({ text: `${CONFIG.FOOTER_TEXT} • Created by ${ctx.user.tag}` })
        .setTimestamp();

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('helium_poll_yes').setLabel('Yes').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('helium_poll_no').setLabel('No').setStyle(ButtonStyle.Secondary)
      );

      return ctx.reply({ embeds: [embed], components: [row] });
    },
  },
  {
    name: 'calculator',
    description: 'Perform a mathematical evaluation',
    category: 'Utility',
    aliases: ['calc', 'math', 'evaluate'],
    slashOptions: [
      { name: 'expression', description: 'Math expression e.g. 24 * 60', type: ApplicationCommandOptionType.String, required: true },
    ],
    execute: async (ctx) => {
      const expr = (ctx.interaction ? ctx.interaction.options.getString('expression', true) : ctx.args.join(' ')) || '';
      if (!expr || !/^[0-9+\-*/().\s]+$/.test(expr)) {
        return ctx.replyError('Invalid Expression', 'Only standard math symbols `0-9 + - * / ( ) .` are accepted.');
      }

      try {
        const result = Function(`"use strict"; return (${expr})`)();
        return ctx.replyInfo('Math Calculation', `**Expression:** \`${expr}\`\n**Result:** \`${result}\``);
      } catch {
        return ctx.replyError('Calculation Error', 'Could not evaluate the expression.');
      }
    },
  },
  {
    name: 'embed',
    description: 'Generate a formatted Red-themed custom announcement embed',
    category: 'Utility',
    aliases: ['customembed', 'makeembed', 'announcementembed'],
    permissions: [PermissionsBitField.Flags.ManageMessages],
    slashOptions: [
      { name: 'title', description: 'Embed title', type: ApplicationCommandOptionType.String, required: true },
      { name: 'description', description: 'Embed message content', type: ApplicationCommandOptionType.String, required: true },
    ],
    execute: async (ctx) => {
      const title = ctx.interaction ? ctx.interaction.options.getString('title', true) : ctx.args[0];
      const desc = (ctx.interaction ? ctx.interaction.options.getString('description', true) : ctx.args.slice(1).join(' ')) || '';

      if (!title || !desc) return ctx.replyError('Invalid Arguments', 'Usage: `&embed "<title>" <description>`');

      const embed = new EmbedBuilder()
        .setColor(CONFIG.COLORS.PRIMARY)
        .setTitle(title)
        .setDescription(desc)
        .setFooter({ text: CONFIG.FOOTER_TEXT })
        .setTimestamp();

      return ctx.reply({ embeds: [embed] });
    },
  },
  {
    name: 'color',
    description: 'Inspect preview and RGB breakdown of a hex color code',
    category: 'Utility',
    aliases: ['hex', 'hexcolor', 'palette'],
    slashOptions: [
      { name: 'hex', description: 'Hex code without # e.g. ED4245', type: ApplicationCommandOptionType.String, required: true },
    ],
    execute: async (ctx) => {
      let hex = (ctx.interaction ? ctx.interaction.options.getString('hex', true) : ctx.args[0] || 'ED4245').replace('#', '');
      const num = parseInt(hex, 16);
      if (isNaN(num)) return ctx.replyError('Invalid Hex', 'Please specify a valid 6-character hex color code.');

      const r = (num >> 16) & 255;
      const g = (num >> 8) & 255;
      const b = num & 255;

      const embed = new EmbedBuilder()
        .setColor(num)
        .setTitle(`Hex Color: #${hex.toUpperCase()}`)
        .setDescription(`**RGB:** \`rgb(${r}, ${g}, ${b})\`\n**Integer Value:** \`${num}\``)
        .setFooter({ text: CONFIG.FOOTER_TEXT });

      return ctx.reply({ embeds: [embed] });
    },
  },
];
