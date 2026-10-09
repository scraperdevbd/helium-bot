import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Guild, GuildMember, TextChannel } from 'discord.js';
import { db } from '../config/database.js';
import { HeliumEmbed } from '../core/embed.js';

export class VerificationService {
  static async sendVerificationPanel(channel: TextChannel, roleId: string) {
    db.prepare('UPDATE guilds SET verify_channel = ?, verify_role_id = ? WHERE id = ?').run(
      channel.id,
      roleId,
      channel.guild.id
    );

    const embed = HeliumEmbed.security(
      'Member Verification',
      'Welcome to the server! To gain full access to channels and protect against automated raids, please click the verification button below.'
    );

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('helium_verify_btn')
        .setLabel('Verify Account')
        .setStyle(ButtonStyle.Danger) // Red themed
    );

    return channel.send({ embeds: [embed], components: [row] });
  }

  static async handleVerifyClick(member: GuildMember): Promise<{ success: boolean; message: string }> {
    const config = db.prepare('SELECT verify_role_id FROM guilds WHERE id = ?').get(member.guild.id) as any;
    if (!config || !config.verify_role_id) {
      return { success: false, message: 'Verification role is not configured for this server.' };
    }

    const role = member.guild.roles.cache.get(config.verify_role_id);
    if (!role) {
      return { success: false, message: 'Verification role not found on the server.' };
    }

    if (member.roles.cache.has(role.id)) {
      return { success: false, message: 'You are already verified.' };
    }

    try {
      await member.roles.add(role, 'Helium Verification Gate Passed');
      return { success: true, message: `Successfully verified! Role <@&${role.id}> has been granted.` };
    } catch (err: any) {
      return { success: false, message: `Failed to grant role: ${err.message}` };
    }
  }
}
