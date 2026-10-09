import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Guild, TextChannel, User } from 'discord.js';
import { db } from '../config/database.js';
import { HeliumEmbed } from '../core/embed.js';

export class GiveawayService {
  static async startGiveaway(channel: TextChannel, prize: string, winnerCount: number, durationSeconds: number, creator: User) {
    const endTime = Date.now() + durationSeconds * 1000;

    const embed = HeliumEmbed.info(
      `GIVEAWAY: ${prize}`,
      `**Prize:** \`${prize}\`\n` +
      `**Winners:** \`${winnerCount}\`\n` +
      `**Hosted By:** <@${creator.id}>\n` +
      `**Ends:** <t:${Math.floor(endTime / 1000)}:R>\n\n` +
      `Click the button below to enter!`
    );

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('helium_giveaway_enter')
        .setLabel('Enter Giveaway')
        .setStyle(ButtonStyle.Danger) // Red themed
    );

    const msg = await channel.send({ embeds: [embed], components: [row] });

    db.prepare(`
      INSERT INTO giveaways (guild_id, channel_id, message_id, prize, winner_count, end_time, ended, created_by)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?)
    `).run(channel.guild.id, channel.id, msg.id, prize, winnerCount, endTime, creator.id);

    return msg;
  }

  static enterGiveaway(messageId: string, userId: string): { success: boolean; message: string } {
    const giveaway = db.prepare('SELECT id, ended FROM giveaways WHERE message_id = ?').get(messageId) as any;
    if (!giveaway) return { success: false, message: 'Giveaway not found.' };
    if (giveaway.ended) return { success: false, message: 'This giveaway has already ended.' };

    try {
      db.prepare('INSERT INTO giveaway_entries (giveaway_id, user_id) VALUES (?, ?)').run(giveaway.id, userId);
      const count = db.prepare('SELECT COUNT(*) as c FROM giveaway_entries WHERE giveaway_id = ?').get(giveaway.id) as { c: number };
      return { success: true, message: `Entered giveaway! Total entries: ${count.c}` };
    } catch {
      // User already entered - remove entry (toggle)
      db.prepare('DELETE FROM giveaway_entries WHERE giveaway_id = ? AND user_id = ?').run(giveaway.id, userId);
      return { success: true, message: 'You left the giveaway.' };
    }
  }

  static async endGiveaway(channel: TextChannel, messageId: string): Promise<string[]> {
    const giveaway = db.prepare('SELECT * FROM giveaways WHERE message_id = ?').get(messageId) as any;
    if (!giveaway) throw new Error('Giveaway not found.');
    if (giveaway.ended) throw new Error('Giveaway already ended.');

    const entries = db.prepare('SELECT user_id FROM giveaway_entries WHERE giveaway_id = ?').all(giveaway.id) as { user_id: string }[];
    const winners: string[] = [];

    if (entries.length > 0) {
      const shuffled = entries.map(e => e.user_id).sort(() => 0.5 - Math.random());
      winners.push(...shuffled.slice(0, giveaway.winner_count));
    }

    db.prepare('UPDATE giveaways SET ended = 1, winners = ? WHERE id = ?').run(JSON.stringify(winners), giveaway.id);

    const winnerText = winners.length > 0 ? winners.map(w => `<@${w}>`).join(', ') : 'No valid entries';
    const embed = HeliumEmbed.info(
      `GIVEAWAY ENDED: ${giveaway.prize}`,
      `**Winners:** ${winnerText}\n` +
      `**Prize:** \`${giveaway.prize}\`\n` +
      `**Total Entries:** \`${entries.length}\``
    );

    const msg = await channel.messages.fetch(messageId).catch(() => null);
    if (msg) {
      await msg.edit({ embeds: [embed], components: [] }).catch(() => null);
    }
    await channel.send(`Congratulations ${winnerText}! You won the **${giveaway.prize}**!`).catch(() => null);

    return winners;
  }
}
