import { AutoModerationRuleCreateOptions, AutoModerationRuleEventType, AutoModerationRuleTriggerType, Guild, Message, TextChannel } from 'discord.js';
import { db } from '../config/database.js';
import { HeliumEmbed } from '../core/embed.js';
import { Logger } from '../core/logger.js';

export class AutoModService {
  private static lastMessages = new Map<string, { content: string; timestamp: number; count: number }>();

  /**
   * Evaluate a message against enabled AutoMod rules
   */
  static async checkMessage(message: Message): Promise<{ violated: boolean; reason?: string }> {
    if (!message.guild || message.author.bot || !message.member) return { violated: false };
    if (message.member.permissions.has('ManageMessages')) return { violated: false };

    const config = db.prepare('SELECT * FROM guilds WHERE id = ?').get(message.guild.id) as any;
    if (!config || !config.automod_enabled) return { violated: false };

    const content = message.content;

    // 1. Invite Filter
    if (config.automod_invites) {
      const inviteRegex = /(discord\.(gg|io|me|li)\/.+|discordapp\.com\/invite\/.+|discord\.com\/invite\/.+)/i;
      if (inviteRegex.test(content)) {
        await this.handleViolation(message, 'Discord Invite Link Detected', config.automod_log_channel);
        return { violated: true, reason: 'Discord Invite Links are prohibited.' };
      }
    }

    // 2. Link Filter
    if (config.automod_links) {
      const linkRegex = /https?:\/\/[^\s]+/i;
      if (linkRegex.test(content)) {
        await this.handleViolation(message, 'Unauthorized Web Link Detected', config.automod_log_channel);
        return { violated: true, reason: 'External links are prohibited.' };
      }
    }

    // 3. Mass Mentions (> 5)
    if (message.mentions.users.size > 5) {
      await this.handleViolation(message, `Mass Mentions Detected (${message.mentions.users.size} mentions)`, config.automod_log_channel);
      return { violated: true, reason: 'Mass mentions are prohibited.' };
    }

    // 4. Excessive Caps (> 70% uppercase and len > 10)
    if (config.automod_caps && content.length > 10) {
      const letters = content.replace(/[^a-zA-Z]/g, '');
      if (letters.length > 8) {
        const uppercase = letters.replace(/[^A-Z]/g, '').length;
        if (uppercase / letters.length > 0.7) {
          await this.handleViolation(message, 'Excessive Caps Lock (>70%)', config.automod_log_channel);
          return { violated: true, reason: 'Excessive capital letters prohibited.' };
        }
      }
    }

    // 5. Spam / Rapid Duplicates
    if (config.automod_spam) {
      const spamKey = `${message.guild.id}:${message.author.id}`;
      const now = Date.now();
      const prev = this.lastMessages.get(spamKey);

      if (prev && prev.content === content && now - prev.timestamp < 5000) {
        prev.count += 1;
        prev.timestamp = now;
        if (prev.count >= 3) {
          await this.handleViolation(message, 'Rapid Duplicate Message Spam', config.automod_log_channel);
          return { violated: true, reason: 'Spamming duplicate messages is prohibited.' };
        }
      } else {
        this.lastMessages.set(spamKey, { content, timestamp: now, count: 1 });
      }
    }

    return { violated: false };
  }

  private static async handleViolation(message: Message, reason: string, logChannelId?: string) {
    try {
      await message.delete();
    } catch {}

    if (logChannelId && message.guild) {
      const channel = message.guild.channels.cache.get(logChannelId) as TextChannel;
      if (channel && channel.isTextBased()) {
        const embed = HeliumEmbed.warning(
          'AutoMod Filter Triggered',
          `**User:** <@${message.author.id}> (\`${message.author.id}\`)\n` +
          `**Channel:** <#${message.channel.id}>\n` +
          `**Reason:** \`${reason}\`\n` +
          `**Filtered Content:** \`\`\`${message.content.substring(0, 500)}\`\`\``
        );
        channel.send({ embeds: [embed] }).catch(() => null);
      }
    }
  }

  /**
   * Helper to inspect native Discord AutoMod status in guild
   */
  static async getNativeRules(guild: Guild) {
    try {
      return await guild.autoModerationRules.fetch();
    } catch (e) {
      return null;
    }
  }
}
