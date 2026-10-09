import { Guild, Message, TextChannel } from 'discord.js';
import { db } from '../config/database.js';
import { HeliumEmbed } from '../core/embed.js';

export class LoggingService {
  private static getChannel(guild: Guild, column: string): TextChannel | null {
    const config = db.prepare(`SELECT ${column} FROM guilds WHERE id = ?`).get(guild.id) as any;
    if (!config || !config[column]) return null;
    const channel = guild.channels.cache.get(config[column]) as TextChannel;
    return channel && channel.isTextBased() ? channel : null;
  }

  static async logMessageDelete(message: Message) {
    if (!message.guild || message.author?.bot) return;
    const channel = this.getChannel(message.guild, 'server_log_channel');
    if (!channel) return;

    const embed = HeliumEmbed.warning(
      'Message Deleted',
      `**Author:** <@${message.author?.id}> (\`${message.author?.id}\`)\n` +
      `**Channel:** <#${message.channel.id}>\n` +
      `**Content:** \`\`\`${message.content ? message.content.substring(0, 800) : '[No Text Content / Attachment]'}\`\`\``
    );
    channel.send({ embeds: [embed] }).catch(() => null);
  }

  static async logMessageUpdate(oldMsg: Message, newMsg: Message) {
    if (!oldMsg.guild || oldMsg.author?.bot || oldMsg.content === newMsg.content) return;
    const channel = this.getChannel(oldMsg.guild, 'server_log_channel');
    if (!channel) return;

    const embed = HeliumEmbed.info(
      'Message Edited',
      `**Author:** <@${oldMsg.author?.id}> (\`${oldMsg.author?.id}\`)\n` +
      `**Channel:** <#${oldMsg.channel.id}>\n` +
      `**Before:** \`\`\`${oldMsg.content.substring(0, 400)}\`\`\`\n` +
      `**After:** \`\`\`${newMsg.content.substring(0, 400)}\`\`\``
    );
    channel.send({ embeds: [embed] }).catch(() => null);
  }

  static async logMemberJoin(guild: Guild, userId: string, accountAgeDays: number) {
    const channel = this.getChannel(guild, 'member_log_channel');
    if (!channel) return;

    const embed = HeliumEmbed.info(
      'Member Joined',
      `**User:** <@${userId}> (\`${userId}\`)\n` +
      `**Account Created:** \`${accountAgeDays.toFixed(1)} days ago\`\n` +
      `**Server Total:** \`${guild.memberCount}\` members`
    );
    channel.send({ embeds: [embed] }).catch(() => null);
  }

  static async logMemberLeave(guild: Guild, userId: string, username: string) {
    const channel = this.getChannel(guild, 'member_log_channel');
    if (!channel) return;

    const embed = HeliumEmbed.warning(
      'Member Left',
      `**User:** \`${username}\` (<@${userId}>)\n` +
      `**Server Total:** \`${guild.memberCount}\` members`
    );
    channel.send({ embeds: [embed] }).catch(() => null);
  }

  static async logRoleUpdate(guild: Guild, title: string, description: string) {
    const channel = this.getChannel(guild, 'server_log_channel');
    if (!channel) return;

    const embed = HeliumEmbed.settings(title, description);
    channel.send({ embeds: [embed] }).catch(() => null);
  }

  static async logChannelUpdate(guild: Guild, title: string, description: string) {
    const channel = this.getChannel(guild, 'server_log_channel');
    if (!channel) return;

    const embed = HeliumEmbed.settings(title, description);
    channel.send({ embeds: [embed] }).catch(() => null);
  }
}
