import { ApplicationCommandOptionType, PermissionsBitField, TextChannel } from 'discord.js';
import { HeliumCommand } from '../core/types.js';
import { TicketService } from '../services/ticket.service.js';
import { db } from '../config/database.js';

export const ticketCommands: HeliumCommand[] = [
  {
    name: 'ticket',
    description: 'Inspect ticket status or create a support ticket',
    category: 'Tickets',
    aliases: ['t', 'support', 'openticket'],
    slashOptions: [
      { name: 'subject', description: 'Brief ticket subject', type: ApplicationCommandOptionType.String, required: false },
    ],
    execute: async (ctx) => {
      const subject = (ctx.interaction ? ctx.interaction.options.getString('subject') : ctx.args.join(' ')) || 'General Inquiry';
      const channel = await TicketService.createTicket(ctx.guild!, ctx.user, subject);
      if (channel) {
        return ctx.replySuccess('Ticket Created', `Your support ticket has been opened in <#${channel.id}>.`);
      }
      return ctx.replyError('Ticket Error', 'Failed to initialize ticket channel.');
    },
  },
  {
    name: 'ticket-panel',
    description: 'Send the interactive ticket creation embed panel into a channel',
    category: 'Tickets',
    aliases: ['ticketpanel', 'sendpanel', 'supportpanel'],
    permissions: [PermissionsBitField.Flags.ManageGuild],
    slashOptions: [
      { name: 'channel', description: 'Channel to send ticket panel into', type: ApplicationCommandOptionType.Channel, required: true },
      { name: 'title', description: 'Panel title', type: ApplicationCommandOptionType.String, required: false },
      { name: 'description', description: 'Panel description', type: ApplicationCommandOptionType.String, required: false },
    ],
    execute: async (ctx) => {
      const channel = (ctx.interaction ? ctx.interaction.options.getChannel('channel', true) : ctx.message?.mentions.channels.first()) as TextChannel;
      const title = (ctx.interaction ? ctx.interaction.options.getString('title') : '') || 'Helium Support Tickets';
      const desc = (ctx.interaction ? ctx.interaction.options.getString('description') : '') || 'Need assistance from server staff? Click the button below to open a private ticket.';

      if (!channel || !channel.isTextBased()) return ctx.replyError('Invalid Channel', 'Please select a valid text channel.');

      await TicketService.sendPanel(channel, title, desc);
      return ctx.replySuccess('Panel Deployed', `Ticket panel successfully posted in <#${channel.id}>.`);
    },
  },
  {
    name: 'ticket-create',
    description: 'Directly open a support ticket',
    category: 'Tickets',
    aliases: ['newticket', 'maketicket', 'startticket'],
    slashOptions: [
      { name: 'subject', description: 'Reason for contacting support', type: ApplicationCommandOptionType.String, required: false },
    ],
    execute: async (ctx) => {
      const subject = (ctx.interaction ? ctx.interaction.options.getString('subject') : ctx.args.join(' ')) || 'Support Request';
      const channel = await TicketService.createTicket(ctx.guild!, ctx.user, subject);
      if (channel) {
        return ctx.replySuccess('Ticket Ready', `Head over to <#${channel.id}> for assistance.`);
      }
      return ctx.replyError('Failed', 'Could not open ticket.');
    },
  },
  {
    name: 'ticket-close',
    description: 'Close and archive the current ticket channel',
    category: 'Tickets',
    aliases: ['closeticket', 'tclose', 'endticket'],
    execute: async (ctx) => {
      if (!ctx.channel || !('name' in ctx.channel) || !ctx.channel.name || !ctx.channel.name.startsWith('ticket-')) {
        return ctx.replyError('Not a Ticket', 'This command can only be executed inside an active ticket channel.');
      }

      await TicketService.closeTicket(ctx.channel as TextChannel, ctx.user);
      return ctx.replySuccess('Ticket Closing', 'Generating transcript and closing ticket...');
    },
  },
  {
    name: 'ticket-claim',
    description: 'Claim the active ticket as the handling staff member',
    category: 'Tickets',
    aliases: ['claimticket', 'tclaim', 'taketicket'],
    permissions: [PermissionsBitField.Flags.ManageMessages],
    execute: async (ctx) => {
      if (!ctx.channel || !('name' in ctx.channel) || !ctx.channel.name || !ctx.channel.name.startsWith('ticket-')) {
        return ctx.replyError('Not a Ticket', 'Must be executed within a ticket channel.');
      }

      TicketService.claimTicket(ctx.channel.id, ctx.user);
      return ctx.replySuccess('Ticket Claimed', `This ticket is now officially assigned to <@${ctx.user.id}>.`);
    },
  },
  {
    name: 'ticket-unclaim',
    description: 'Unclaim a previously claimed ticket',
    category: 'Tickets',
    aliases: ['unclaimticket', 'tunclaim', 'dropticket'],
    permissions: [PermissionsBitField.Flags.ManageMessages],
    execute: async (ctx) => {
      if (!ctx.channel || !('name' in ctx.channel) || !ctx.channel.name || !ctx.channel.name.startsWith('ticket-')) {
        return ctx.replyError('Not a Ticket', 'Must be executed within a ticket channel.');
      }

      db.prepare('UPDATE tickets SET claimed_by = NULL WHERE channel_id = ?').run(ctx.channel.id);
      return ctx.replyInfo('Ticket Unclaimed', 'This ticket has been released back to general staff pool.');
    },
  },
  {
    name: 'ticket-add',
    description: 'Add an additional user to the active ticket',
    category: 'Tickets',
    aliases: ['tadd', 'ticketadduser', 'inviteuser'],
    permissions: [PermissionsBitField.Flags.ManageMessages],
    slashOptions: [
      { name: 'user', description: 'User to add to ticket', type: ApplicationCommandOptionType.User, required: true },
    ],
    execute: async (ctx) => {
      const user = ctx.interaction ? ctx.interaction.options.getUser('user', true) : ctx.message?.mentions.users.first();
      if (!user) return ctx.replyError('Missing User', 'Please specify a user to add.');

      if (ctx.channel && 'permissionOverwrites' in ctx.channel) {
        await ctx.channel.permissionOverwrites.edit(user.id, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true,
        });
        return ctx.replySuccess('Member Added', `<@${user.id}> was granted access to this ticket.`);
      }
      return ctx.replyError('Error', 'Cannot manage permissions on this channel.');
    },
  },
  {
    name: 'ticket-remove',
    description: 'Remove a user from the active ticket',
    category: 'Tickets',
    aliases: ['tremove', 'ticketdeluser', 'kickticket'],
    permissions: [PermissionsBitField.Flags.ManageMessages],
    slashOptions: [
      { name: 'user', description: 'User to remove from ticket', type: ApplicationCommandOptionType.User, required: true },
    ],
    execute: async (ctx) => {
      const user = ctx.interaction ? ctx.interaction.options.getUser('user', true) : ctx.message?.mentions.users.first();
      if (!user) return ctx.replyError('Missing User', 'Please specify a user to remove.');

      if (ctx.channel && 'permissionOverwrites' in ctx.channel) {
        await ctx.channel.permissionOverwrites.delete(user.id);
        return ctx.replySuccess('Member Removed', `<@${user.id}> was removed from this ticket.`);
      }
      return ctx.replyError('Error', 'Cannot manage permissions on this channel.');
    },
  },
  {
    name: 'ticket-transcript',
    description: 'Generate transcript of the active ticket',
    category: 'Tickets',
    aliases: ['transcript', 'ttranscript', 'ticketsave'],
    execute: async (ctx) => {
      if (!ctx.channel || !('name' in ctx.channel) || !ctx.channel.name || !ctx.channel.name.startsWith('ticket-')) {
        return ctx.replyError('Not a Ticket', 'Must be executed within an active ticket.');
      }

      const messages = await (ctx.channel as TextChannel).messages.fetch({ limit: 50 });
      let output = `--- Transcript for #${(ctx.channel as TextChannel).name} ---\n\n`;
      for (const m of Array.from(messages.values()).reverse()) {
        output += `[${new Date(m.createdTimestamp).toLocaleTimeString()}] ${m.author.tag}: ${m.cleanContent}\n`;
      }

      return ctx.replyInfo('Ticket Transcript (Last 50 Messages)', `\`\`\`${output.substring(0, 1800)}\`\`\``);
    },
  },
  {
    name: 'ticket-reopen',
    description: 'Reopen a previously closed ticket',
    category: 'Tickets',
    aliases: ['reopenticket', 'treopen', 'resumeticket'],
    permissions: [PermissionsBitField.Flags.ManageMessages],
    execute: async (ctx) => {
      db.prepare('UPDATE tickets SET status = "OPEN", closed_at = NULL WHERE channel_id = ?').run(ctx.channel!.id);
      return ctx.replySuccess('Ticket Reopened', 'Ticket status has been reset to OPEN.');
    },
  },
  {
    name: 'ticket-settings',
    description: 'Configure ticket category and log channel',
    category: 'Tickets',
    aliases: ['ticketconfig', 'tsettings', 'ticketsetup'],
    permissions: [PermissionsBitField.Flags.ManageGuild],
    slashOptions: [
      { name: 'channel', description: 'Channel to log closed tickets', type: ApplicationCommandOptionType.Channel, required: true },
    ],
    execute: async (ctx) => {
      const channel = ctx.interaction ? ctx.interaction.options.getChannel('channel', true) : ctx.message?.mentions.channels.first();
      if (!channel) return ctx.replyError('Missing Channel', 'Please provide a channel.');

      db.prepare('UPDATE guilds SET ticket_log_channel = ? WHERE id = ?').run(channel.id, ctx.guild!.id);
      return ctx.replySuccess('Ticket Logs Configured', `Ticket transcripts will be archived in <#${channel.id}>.`);
    },
  },
];
