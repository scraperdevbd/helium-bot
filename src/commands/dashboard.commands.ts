import { ApplicationCommandOptionType, MessageFlags } from 'discord.js';
import { HeliumCommand } from '../core/types.js';
import { DashboardSessionManager } from '../dashboard/session.js';
import { DashboardRenderer } from '../dashboard/renderer.js';

export const dashboardCommands: HeliumCommand[] = [
  {
    name: 'admindashboard',
    description: 'Launch the interactive Helium Admin Command Center & Web Dashboard',
    category: 'Owner',
    aliases: ['admindash', 'dash', 'botdashboard'],
    slashOptions: [
      {
        name: 'key',
        description: 'Dashboard security activation key',
        type: ApplicationCommandOptionType.String,
        required: true,
      },
    ],
    execute: async (ctx) => {
      const key = ctx.interaction ? ctx.interaction.options.getString('key', true) : ctx.args[0];

      // Proactively scrub the plain-text command invocation message if sent in a channel
      // so the security activation key is not left lingering in Discord chat history
      if (ctx.message && ctx.message.deletable) {
        await ctx.message.delete().catch(() => {});
      }

      // Validate credentials, permissions, and activation key without echoing the key
      const access = DashboardSessionManager.validateAccess(ctx.user, ctx.member, key);
      if (!access.allowed) {
        return ctx.replySecurity(
          'Dashboard Access Denied',
          access.reason || 'You are not authorized to access the Helium Admin Dashboard.'
        );
      }

      // Create new session
      const session = DashboardSessionManager.createSession(ctx.user, ctx.guild?.id);
      const rendered = DashboardRenderer.render(session, ctx.client, ctx.guild);

      if (ctx.interaction) {
        return ctx.interaction.reply({
          ...rendered,
          flags: MessageFlags.Ephemeral,
        });
      } else if (ctx.channel && 'send' in ctx.channel) {
        return (ctx.channel as any).send(rendered);
      } else {
        return ctx.reply(rendered);
      }
    },
  },
];
