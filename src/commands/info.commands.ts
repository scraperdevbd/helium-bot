import { ApplicationCommandOptionType, PermissionsBitField, Role, TextChannel } from 'discord.js';
import { HeliumCommand } from '../core/types.js';
import { CONFIG } from '../config/config.js';
import { db } from '../config/database.js';

export const infoCommands: HeliumCommand[] = [
  {
    name: 'channelinfo',
    description: 'Detailed channel settings, topic, and type inspection',
    category: 'Info',
    aliases: ['ci', 'channel', 'aboutchannel'],
    slashOptions: [
      { name: 'channel', description: 'Target channel', type: ApplicationCommandOptionType.Channel, required: false },
    ],
    execute: async (ctx) => {
      const channel = (ctx.interaction ? ctx.interaction.options.getChannel('channel') : ctx.message?.mentions.channels.first()) || ctx.channel;
      if (!channel) return ctx.replyError('Missing Channel', 'Could not find target channel.');

      const createdTime = (channel && 'createdTimestamp' in channel && channel.createdTimestamp) ? channel.createdTimestamp : Date.now();
      return ctx.replyInfo(
        `Channel: #${'name' in channel ? channel.name : channel.id}`,
        `**ID:** \`${channel.id}\`\n` +
        `**Type:** \`${channel.type}\`\n` +
        ('topic' in channel && channel.topic ? `**Topic:** \`${channel.topic}\`\n` : '') +
        ('rateLimitPerUser' in channel ? `**Slowmode:** \`${channel.rateLimitPerUser}s\`\n` : '') +
        `**Created:** <t:${Math.floor(createdTime / 1000)}:R>`
      );
    },
  },
  {
    name: 'roleinfo',
    description: 'Inspect permissions and statistics of a role',
    category: 'Info',
    aliases: ['ri', 'aboutroleinfo', 'roledetails'],
    slashOptions: [
      { name: 'role', description: 'Target role', type: ApplicationCommandOptionType.Role, required: true },
    ],
    execute: async (ctx) => {
      const role = (ctx.interaction ? ctx.interaction.options.getRole('role', true) : ctx.message?.mentions.roles.first()) as Role;
      if (!role) return ctx.replyError('Missing Role', 'Please specify a target role.');

      return ctx.replyInfo(
        `Role: @${role.name}`,
        `**ID:** \`${role.id}\`\n` +
        `**Position:** \`${role.position}\`\n` +
        `**Members Count:** \`${role.members.size}\`\n` +
        `**Color:** \`#${role.color.toString(16).padStart(6, '0')}\`\n` +
        `**Hoisted:** \`${role.hoist ? 'Yes' : 'No'}\`\n` +
        `**Mentionable:** \`${role.mentionable ? 'Yes' : 'No'}\``
      );
    },
  },
  {
    name: 'permissions',
    description: 'Inspect permissions granted to yourself or a specified user',
    category: 'Info',
    aliases: ['perms', 'myperms', 'checkperms'],
    slashOptions: [
      { name: 'user', description: 'User to inspect', type: ApplicationCommandOptionType.User, required: false },
    ],
    execute: async (ctx) => {
      const user = (ctx.interaction ? ctx.interaction.options.getUser('user') : ctx.message?.mentions.users.first()) || ctx.user;
      const member = await ctx.guild?.members.fetch(user.id).catch(() => null);

      if (!member) return ctx.replyError('Not Found', 'Member is not in this server.');

      const keyPerms = member.permissions.toArray().slice(0, 15);
      return ctx.replyInfo(
        `Permissions: ${user.username}`,
        `**Administrator:** \`${member.permissions.has(PermissionsBitField.Flags.Administrator) ? 'YES' : 'NO'}\`\n\n` +
        `**Active Key Permissions:**\n` +
        keyPerms.map(p => `• \`${p}\``).join('\n')
      );
    },
  },
  {
    name: 'shards',
    description: 'View active shard status and latency',
    category: 'Info',
    aliases: ['shardinfo', 'clusters'],
    execute: async (ctx) => {
      return ctx.replyInfo(
        'Gateway Shard Metrics',
        `**Shard ID:** \`0 / 1\`\n` +
        `**Shard Status:** \`READY - CONNECTED\`\n` +
        `**Ping:** \`${ctx.client.ws.ping}ms\`\n` +
        `**Guilds in Shard:** \`${ctx.client.guilds.cache.size}\``
      );
    },
  },
  {
    name: 'prefix',
    description: 'Inspect or configure guild prefix',
    category: 'Info',
    aliases: ['setprefix', 'botprefix', 'changeprefix'],
    slashOptions: [
      { name: 'new_prefix', description: 'New prefix character(s)', type: ApplicationCommandOptionType.String, required: false },
    ],
    execute: async (ctx) => {
      const newPrefix = ctx.interaction ? ctx.interaction.options.getString('new_prefix') : ctx.args[0];

      if (newPrefix) {
        if (!ctx.member?.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
          return ctx.replyError('Missing Permissions', 'You need `Manage Server` permission to alter prefix.');
        }

        db.prepare('UPDATE guilds SET prefix = ? WHERE id = ?').run(newPrefix, ctx.guild!.id);
        return ctx.replySuccess('Prefix Changed', `Prefix for this server has been updated to **\`${newPrefix}\`**.`);
      }

      const conf = db.prepare('SELECT prefix FROM guilds WHERE id = ?').get(ctx.guild!.id) as any;
      return ctx.replyInfo('Server Prefix', `Current prefix is **\`${conf?.prefix || CONFIG.PREFIX}\`**.`);
    },
  },
  {
    name: 'credits',
    description: 'View the creator and developer of Helium bot',
    category: 'Info',
    aliases: ['dev', 'author', 'creator', 'support', 'community'],
    execute: async (ctx) => {
      return ctx.replyInfo(
        `${CONFIG.BOT_NAME} Bot Creator & Support Community`,
        `**Primary Author & Architect:** **${CONFIG.AUTHOR}**\n` +
        `**Discord Handle:** \`${CONFIG.AUTHOR_DISCORD}\`\n` +
        `**Contact Email:** \`scraperdev.bd@gmail.com\`\n` +
        `**Community & Support Server:** [discord.gg/rQbFHJYnCK](https://discord.gg/rQbFHJYnCK)\n` +
        `**GitHub:** [github.com/scraperdevbd](https://github.com/scraperdevbd)\n\n` +
        `*Note: The custom emojis configured in this bot are private assets; when deploying or self-hosting, replace or configure custom emojis in \`src/config/config.ts\`.*`
      );
    },
  },
];
