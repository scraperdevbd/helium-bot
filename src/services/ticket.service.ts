import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Guild,
  GuildMember,
  PermissionsBitField,
  TextChannel,
  User,
} from 'discord.js';
import { db } from '../config/database.js';
import { CONFIG } from '../config/config.js';
import { HeliumEmbed } from '../core/embed.js';

export class TicketService {
  /**
   * Deploy a ticket creation panel in a channel
   */
  static async sendPanel(channel: TextChannel, title: string, description: string) {
    const embed = HeliumEmbed.info(
      title || 'Support Tickets',
      description || 'Click the button below to open a private support ticket with staff.'
    );

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('helium_ticket_create')
        .setLabel('Create Ticket')
        .setStyle(ButtonStyle.Danger) // Red themed button
    );

    return channel.send({ embeds: [embed], components: [row] });
  }

  /**
   * Handle user clicking "Create Ticket"
   */
  static async createTicket(guild: Guild, user: User, subject: string = 'General Support'): Promise<TextChannel | null> {
    // Check if user already has an open ticket
    const existing = db.prepare(
      'SELECT channel_id FROM tickets WHERE guild_id = ? AND user_id = ? AND status = "OPEN"'
    ).get(guild.id, user.id) as { channel_id: string } | undefined;

    if (existing) {
      const existingChan = guild.channels.cache.get(existing.channel_id) as TextChannel;
      if (existingChan) return existingChan;
    }

    const lastNum = db.prepare('SELECT MAX(ticket_number) as m FROM tickets WHERE guild_id = ?').get(guild.id) as { m: number | null };
    const ticketNumber = (lastNum?.m || 0) + 1;
    const channelName = `ticket-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}-${ticketNumber}`;

    const channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          deny: [PermissionsBitField.Flags.ViewChannel],
        },
        {
          id: user.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory,
            PermissionsBitField.Flags.AttachFiles,
          ],
        },
        {
          id: guild.client.user!.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ManageChannels,
          ],
        },
      ],
    });

    db.prepare(`
      INSERT INTO tickets (guild_id, channel_id, user_id, ticket_number, status, subject, created_at)
      VALUES (?, ?, ?, ?, 'OPEN', ?, ?)
    `).run(guild.id, channel.id, user.id, ticketNumber, subject, Date.now());

    const welcomeEmbed = HeliumEmbed.info(
      `Support Ticket #${ticketNumber}`,
      `Welcome <@${user.id}>! Staff has been notified and will assist you shortly.\n\n` +
      `**Subject:** \`${subject}\`\n` +
      `**Author:** <@${user.id}>\n\n` +
      `Use the controls below to manage this ticket.`
    );

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('helium_ticket_close')
        .setLabel('Close Ticket')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('helium_ticket_claim')
        .setLabel('Claim Ticket')
        .setStyle(ButtonStyle.Secondary)
    );

    await channel.send({ content: `<@${user.id}>`, embeds: [welcomeEmbed], components: [row] });
    return channel;
  }

  /**
   * Close and archive ticket
   */
  static async closeTicket(channel: TextChannel, closedBy: User): Promise<string> {
    const ticket = db.prepare('SELECT * FROM tickets WHERE channel_id = ?').get(channel.id) as any;
    if (!ticket) return 'Ticket not found in database.';

    // Fetch messages for transcript
    const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
    let transcript = `--- Helium Ticket #${ticket.ticket_number} Transcript ---\nClosed by: ${closedBy.tag} (${closedBy.id})\n\n`;

    if (messages) {
      const sorted = Array.from(messages.values()).reverse();
      for (const m of sorted) {
        transcript += `[${new Date(m.createdTimestamp).toISOString()}] ${m.author.tag}: ${m.cleanContent}\n`;
      }
    }

    db.prepare('UPDATE tickets SET status = "CLOSED", closed_at = ? WHERE channel_id = ?').run(Date.now(), channel.id);

    // Send closing message
    const embed = HeliumEmbed.warning('Ticket Closed', `This ticket was closed by <@${closedBy.id}>. Channel will be deleted in 5 seconds.`);
    await channel.send({ embeds: [embed] });

    setTimeout(() => {
      channel.delete('Ticket closed').catch(() => null);
    }, 5000);

    return transcript;
  }

  /**
   * Claim ticket
   */
  static claimTicket(channelId: string, staffUser: User): boolean {
    const res = db.prepare('UPDATE tickets SET claimed_by = ? WHERE channel_id = ?').run(staffUser.id, channelId);
    return res.changes > 0;
  }
}
