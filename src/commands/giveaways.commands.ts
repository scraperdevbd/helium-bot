import { ApplicationCommandOptionType, PermissionsBitField, TextChannel } from 'discord.js';
import { HeliumCommand } from '../core/types.js';
import { GiveawayService } from '../services/giveaway.service.js';
import { db } from '../config/database.js';

export const giveawayCommands: HeliumCommand[] = [
  {
    name: 'giveaway',
    description: 'Launch an interactive community giveaway with button entry',
    category: 'Giveaways',
    aliases: ['gstart', 'gcreate', 'startgiveaway', 'hostgiveaway'],
    permissions: [PermissionsBitField.Flags.ManageGuild],
    slashOptions: [
      { name: 'prize', description: 'Prize to win', type: ApplicationCommandOptionType.String, required: true },
      { name: 'winners', description: 'Number of winners', type: ApplicationCommandOptionType.Integer, required: true },
      { name: 'minutes', description: 'Duration in minutes', type: ApplicationCommandOptionType.Integer, required: true },
    ],
    execute: async (ctx) => {
      const prize = ctx.interaction ? ctx.interaction.options.getString('prize', true) : ctx.args[0];
      const winners = ctx.interaction ? ctx.interaction.options.getInteger('winners', true) : parseInt(ctx.args[1] || '1');
      const minutes = ctx.interaction ? ctx.interaction.options.getInteger('minutes', true) : parseInt(ctx.args[2] || '60');

      if (!prize || isNaN(winners) || isNaN(minutes) || minutes <= 0) {
        return ctx.replyError('Invalid Arguments', 'Usage: `&giveaway "<prize>" <winners> <minutes>`');
      }

      await GiveawayService.startGiveaway(ctx.channel as TextChannel, prize, winners, minutes * 60, ctx.user);
      return ctx.replySuccess('Giveaway Launched', `Giveaway for **${prize}** has begun in <#${ctx.channel!.id}>!`);
    },
  },
  {
    name: 'giveaway-end',
    description: 'Immediately conclude a giveaway by message ID',
    category: 'Giveaways',
    aliases: ['gend', 'stopgiveaway', 'finishgiveaway'],
    permissions: [PermissionsBitField.Flags.ManageGuild],
    slashOptions: [
      { name: 'message_id', description: 'Giveaway message ID', type: ApplicationCommandOptionType.String, required: true },
    ],
    execute: async (ctx) => {
      const messageId = ctx.interaction ? ctx.interaction.options.getString('message_id', true) : ctx.args[0];
      if (!messageId) return ctx.replyError('Missing ID', 'Please provide giveaway message ID.');

      try {
        const winners = await GiveawayService.endGiveaway(ctx.channel as TextChannel, messageId);
        return ctx.replySuccess('Giveaway Concluded', `Winners picked: ${winners.map(w => `<@${w}>`).join(', ') || 'No entries'}`);
      } catch (err: any) {
        return ctx.replyError('Error', err.message);
      }
    },
  },
  {
    name: 'giveaway-reroll',
    description: 'Pick new random winners for an ended giveaway',
    category: 'Giveaways',
    aliases: ['greroll', 'rerollgiveaway', 'picknewwinner'],
    permissions: [PermissionsBitField.Flags.ManageGuild],
    slashOptions: [
      { name: 'message_id', description: 'Giveaway message ID', type: ApplicationCommandOptionType.String, required: true },
    ],
    execute: async (ctx) => {
      const messageId = ctx.interaction ? ctx.interaction.options.getString('message_id', true) : ctx.args[0];
      if (!messageId) return ctx.replyError('Missing ID', 'Please specify the giveaway message ID.');

      const giveaway = db.prepare('SELECT id, prize, winner_count FROM giveaways WHERE message_id = ?').get(messageId) as any;
      if (!giveaway) return ctx.replyError('Not Found', 'Giveaway message not found.');

      const entries = db.prepare('SELECT user_id FROM giveaway_entries WHERE giveaway_id = ?').all(giveaway.id) as { user_id: string }[];
      if (entries.length === 0) return ctx.replyError('No Entries', 'No valid entries to reroll.');

      const shuffled = entries.map(e => e.user_id).sort(() => 0.5 - Math.random());
      const newWinner = shuffled[0];

      return ctx.replySuccess('Giveaway Rerolled', `New winner for **${giveaway.prize}**: <@${newWinner}>!`);
    },
  },
  {
    name: 'giveaways',
    description: 'List active and recent giveaways in this guild',
    category: 'Giveaways',
    aliases: ['glist', 'activegiveaways', 'ongoinggiveaways'],
    execute: async (ctx) => {
      const active = db.prepare('SELECT * FROM giveaways WHERE guild_id = ? ORDER BY id DESC LIMIT 5').all(ctx.guild!.id) as any[];
      if (active.length === 0) return ctx.replyInfo('Giveaways', 'No giveaways recorded for this server.');

      const text = active.map(g => `• **${g.prize}** (${g.winner_count} winners) — Status: \`${g.ended ? 'Ended' : 'Active'}\`\n  Channel: <#${g.channel_id}> • ID: \`${g.message_id}\``).join('\n\n');
      return ctx.replyInfo('Server Giveaways', text);
    },
  },
];
