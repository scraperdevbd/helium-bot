import { GuildMember, TextChannel } from 'discord.js';
import { db } from '../config/database.js';
import { HeliumEmbed } from '../core/embed.js';

export class WelcomeService {
  static async handleMemberJoin(member: GuildMember) {
    const config = db.prepare('SELECT * FROM guilds WHERE id = ?').get(member.guild.id) as any;
    if (!config) return;

    // Autorole assignment
    if (config.autorole_id) {
      const role = member.guild.roles.cache.get(config.autorole_id);
      if (role && role.editable) {
        member.roles.add(role, 'Helium Autorole').catch(() => null);
      }
    }

    // Welcome message
    if (config.welcome_enabled && config.welcome_channel) {
      const channel = member.guild.channels.cache.get(config.welcome_channel) as TextChannel;
      if (channel && channel.isTextBased()) {
        const text = (config.welcome_message || 'Welcome {user} to {server}! You are member #{count}.')
          .replace('{user}', `<@${member.id}>`)
          .replace('{server}', member.guild.name)
          .replace('{count}', member.guild.memberCount.toString());

        const embed = HeliumEmbed.info('Welcome to the Server', text);
        channel.send({ content: `<@${member.id}>`, embeds: [embed] }).catch(() => null);
      }
    }
  }

  static async handleMemberLeave(member: GuildMember) {
    const config = db.prepare('SELECT * FROM guilds WHERE id = ?').get(member.guild.id) as any;
    if (!config || !config.goodbye_enabled || !config.goodbye_channel) return;

    const channel = member.guild.channels.cache.get(config.goodbye_channel) as TextChannel;
    if (channel && channel.isTextBased()) {
      const text = (config.goodbye_message || '{user} has left {server}. We now have {count} members.')
        .replace('{user}', member.user.tag)
        .replace('{server}', member.guild.name)
        .replace('{count}', member.guild.memberCount.toString());

      const embed = HeliumEmbed.warning('Member Left', text);
      channel.send({ embeds: [embed] }).catch(() => null);
    }
  }
}
