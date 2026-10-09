import { Message } from 'discord.js';
import { db } from '../config/database.js';

export class LevelingService {
  private static xpCooldowns = new Map<string, number>();

  static getLevel(xp: number): number {
    return Math.floor(0.1 * Math.sqrt(xp));
  }

  static getXpForLevel(level: number): number {
    return Math.pow(level / 0.1, 2);
  }

  static handleMessageXP(message: Message) {
    if (!message.guild || message.author.bot) return;

    const config = db.prepare('SELECT leveling_enabled FROM guilds WHERE id = ?').get(message.guild.id) as any;
    if (config && config.leveling_enabled === 0) return;

    const userId = message.author.id;
    const now = Date.now();
    const lastXp = this.xpCooldowns.get(userId) || 0;

    if (now - lastXp < 60000) return; // 1 minute cooldown between XP
    this.xpCooldowns.set(userId, now);

    const xpEarned = Math.floor(Math.random() * 15) + 10; // 10-25 XP

    const user = db.prepare('SELECT xp, level FROM users WHERE id = ?').get(userId) as any;
    if (!user) {
      db.prepare('INSERT INTO users (id, xp, level, created_at) VALUES (?, ?, ?, ?)').run(
        userId,
        xpEarned,
        0,
        now
      );
    } else {
      const newXp = user.xp + xpEarned;
      const newLevel = this.getLevel(newXp);
      db.prepare('UPDATE users SET xp = ?, level = ? WHERE id = ?').run(newXp, newLevel, userId);

      if (newLevel > user.level) {
        // Leveled up!
        if ('send' in message.channel && typeof message.channel.send === 'function') {
          message.channel.send(`Congrats <@${userId}>, you leveled up to level **${newLevel}**!`).catch(() => null);
        }
      }
    }
  }

  static getUserRank(userId: string) {
    const user = db.prepare('SELECT xp, level FROM users WHERE id = ?').get(userId) as any;
    if (!user) return { xp: 0, level: 0, rank: 1 };

    const rankResult = db.prepare('SELECT COUNT(*) as rank FROM users WHERE xp > ?').get(user.xp) as { rank: number };
    return {
      xp: user.xp,
      level: user.level,
      rank: rankResult.rank + 1,
    };
  }

  static getLeaderboard(limit: number = 10) {
    return db.prepare('SELECT id, xp, level FROM users ORDER BY xp DESC LIMIT ?').all(limit) as any[];
  }
}
