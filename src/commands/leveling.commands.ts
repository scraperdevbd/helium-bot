import { ApplicationCommandOptionType, PermissionsBitField } from 'discord.js';
import { HeliumCommand } from '../core/types.js';
import { LevelingService } from '../services/leveling.service.js';
import { db } from '../config/database.js';

export const levelingCommands: HeliumCommand[] = [
  {
    name: 'level',
    description: 'Inspect your or another members server XP and level rank',
    category: 'Leveling',
    aliases: ['lvl', 'rank', 'profile', 'myrank', 'statsrank'],
    slashOptions: [
      { name: 'user', description: 'User to inspect', type: ApplicationCommandOptionType.User, required: false },
    ],
    execute: async (ctx) => {
      const user = (ctx.interaction ? ctx.interaction.options.getUser('user') : ctx.message?.mentions.users.first()) || ctx.user;
      const rankData = LevelingService.getUserRank(user.id);
      const nextLevelXp = LevelingService.getXpForLevel(rankData.level + 1);

      return ctx.replyInfo(
        `${user.username} — Level Profile`,
        `**Rank:** \`#${rankData.rank}\`\n` +
        `**Level:** \`${rankData.level}\`\n` +
        `**Total XP:** \`${rankData.xp.toLocaleString()} XP\`\n` +
        `**Next Level:** \`${Math.round(nextLevelXp).toLocaleString()} XP\``
      );
    },
  },
  {
    name: 'leaderboard',
    description: 'Display top 10 most active members by XP',
    category: 'Leveling',
    aliases: ['lb', 'top', 'levels', 'toprank', 'richestlevels'],
    execute: async (ctx) => {
      const top = LevelingService.getLeaderboard(10);
      if (top.length === 0) return ctx.replyInfo('XP Leaderboard', 'No user activity recorded yet.');

      const text = top.map((t, idx) => `**#${idx + 1}** <@${t.id}> — Level **${t.level}** (\`${t.xp.toLocaleString()} XP\`)`).join('\n');
      return ctx.replyInfo('Community XP Leaderboard', text);
    },
  },
  {
    name: 'setlevel',
    description: 'Set a users level manually',
    category: 'Leveling',
    aliases: ['givelevel', 'modlevel', 'adminlevel'],
    permissions: [PermissionsBitField.Flags.Administrator],
    slashOptions: [
      { name: 'user', description: 'Target user', type: ApplicationCommandOptionType.User, required: true },
      { name: 'level', description: 'Level number', type: ApplicationCommandOptionType.Integer, required: true },
    ],
    execute: async (ctx) => {
      const user = ctx.interaction ? ctx.interaction.options.getUser('user', true) : ctx.message?.mentions.users.first();
      const level = ctx.interaction ? ctx.interaction.options.getInteger('level', true) : parseInt(ctx.args[1] || '0');

      if (!user || isNaN(level) || level < 0) return ctx.replyError('Invalid Arguments', 'Usage: `&setlevel @user <level>`');

      const xp = LevelingService.getXpForLevel(level);
      db.prepare('INSERT OR REPLACE INTO users (id, xp, level) VALUES (?, ?, ?)').run(user.id, xp, level);

      return ctx.replySuccess('Level Updated', `<@${user.id}> level set to **${level}** (\`${Math.round(xp)} XP\`).`);
    },
  },
  {
    name: 'setxp',
    description: 'Adjust a users XP total directly',
    category: 'Leveling',
    aliases: ['givexp', 'addxp', 'adminxp'],
    permissions: [PermissionsBitField.Flags.Administrator],
    slashOptions: [
      { name: 'user', description: 'Target user', type: ApplicationCommandOptionType.User, required: true },
      { name: 'xp', description: 'XP points', type: ApplicationCommandOptionType.Integer, required: true },
    ],
    execute: async (ctx) => {
      const user = ctx.interaction ? ctx.interaction.options.getUser('user', true) : ctx.message?.mentions.users.first();
      const xp = ctx.interaction ? ctx.interaction.options.getInteger('xp', true) : parseInt(ctx.args[1] || '0');

      if (!user || isNaN(xp) || xp < 0) return ctx.replyError('Invalid Arguments', 'Usage: `&setxp @user <xp>`');

      const level = LevelingService.getLevel(xp);
      db.prepare('INSERT OR REPLACE INTO users (id, xp, level) VALUES (?, ?, ?)').run(user.id, xp, level);

      return ctx.replySuccess('XP Updated', `<@${user.id}> XP set to **${xp}** (Level ${level}).`);
    },
  },
  {
    name: 'leveltoggle',
    description: 'Enable or disable XP and leveling for the server',
    category: 'Leveling',
    aliases: ['leveling', 'xptoggle', 'togglelevels'],
    permissions: [PermissionsBitField.Flags.ManageGuild],
    execute: async (ctx) => {
      const config = db.prepare('SELECT leveling_enabled FROM guilds WHERE id = ?').get(ctx.guild!.id) as any;
      const newState = config?.leveling_enabled ? 0 : 1;
      db.prepare('UPDATE guilds SET leveling_enabled = ? WHERE id = ?').run(newState, ctx.guild!.id);

      return ctx.replySuccess('Leveling System', `Leveling system is now **${newState ? 'ENABLED' : 'DISABLED'}**.`);
    },
  },
];
