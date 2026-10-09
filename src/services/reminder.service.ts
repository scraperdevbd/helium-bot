import { Client, TextChannel } from 'discord.js';
import { db } from '../config/database.js';
import { HeliumEmbed } from '../core/embed.js';

export class ReminderService {
  static createReminder(userId: string, channelId: string, message: string, delaySeconds: number): number {
    const remindAt = Date.now() + delaySeconds * 1000;
    const res = db.prepare(`
      INSERT INTO reminders (user_id, channel_id, message, remind_at, completed)
      VALUES (?, ?, ?, ?, 0)
    `).run(userId, channelId, message, remindAt);

    return Number(res.lastInsertRowid);
  }

  static async checkReminders(client: Client) {
    const now = Date.now();
    const pending = db.prepare('SELECT * FROM reminders WHERE remind_at <= ? AND completed = 0').all(now) as any[];

    for (const r of pending) {
      db.prepare('UPDATE reminders SET completed = 1 WHERE id = ?').run(r.id);

      try {
        const channel = client.channels.cache.get(r.channel_id) as TextChannel;
        if (channel && channel.isTextBased()) {
          const embed = HeliumEmbed.info(
            'Scheduled Reminder',
            `<@${r.user_id}>, you asked to be reminded:\n\n**${r.message}**`
          );
          await channel.send({ content: `<@${r.user_id}>`, embeds: [embed] }).catch(() => null);
        } else {
          // Send via DM if channel not found
          const user = await client.users.fetch(r.user_id).catch(() => null);
          if (user) {
            const embed = HeliumEmbed.info('Scheduled Reminder', `You asked to be reminded:\n\n**${r.message}**`);
            await user.send({ embeds: [embed] }).catch(() => null);
          }
        }
      } catch {}
    }
  }
}
