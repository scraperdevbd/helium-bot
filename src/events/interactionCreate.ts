import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  GuildMember,
  Interaction,
  MessageFlags,
  PermissionsBitField,
  StringSelectMenuInteraction,
  TextChannel,
} from 'discord.js';
import { HeliumClient } from '../core/client.js';
import { CommandRegistry } from '../core/registry.js';
import { TicketService } from '../services/ticket.service.js';
import { VerificationService } from '../services/verification.service.js';
import { GiveawayService } from '../services/giveaway.service.js';
import { ModerationService } from '../services/moderation.service.js';
import { CONFIG } from '../config/config.js';
import { db } from '../config/database.js';
import { HeliumEmbed } from '../core/embed.js';
import { DashboardSessionManager } from '../dashboard/session.js';
import { DashboardRenderer } from '../dashboard/renderer.js';
import { SecurityService } from '../services/security.service.js';
import { RoleService } from '../services/role.service.js';

import { DeveloperService } from '../services/developer.service.js';

export async function handleInteractionCreate(interaction: Interaction, client: HeliumClient) {
  // Slash commands router
  if (interaction.isChatInputCommand()) {
    if (DeveloperService.isMaintenanceMode() && !DeveloperService.isDeveloper(interaction.user.id)) {
      await interaction.reply({
        content: 'Helium is currently in maintenance mode. Only authorized developers can execute commands.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    await CommandRegistry.handleInteraction(interaction as ChatInputCommandInteraction, client);
    return;
  }

  // Interactive buttons router
  if (interaction.isButton()) {
    const id = interaction.customId;

    if (id === 'helium_ticket_create') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const channel = await TicketService.createTicket(interaction.guild!, interaction.user, 'Support Inquiry');
      if (channel) {
        await interaction.editReply({ content: `Your ticket has been opened in <#${channel.id}>.` });
      } else {
        await interaction.editReply({ content: 'Could not create ticket channel.' });
      }
      return;
    }

    if (id === 'helium_ticket_close') {
      await interaction.reply({ content: 'Closing ticket and preparing transcript...', flags: MessageFlags.Ephemeral });
      await TicketService.closeTicket(interaction.channel as TextChannel, interaction.user);
      return;
    }

    if (id === 'helium_ticket_claim') {
      TicketService.claimTicket(interaction.channel!.id, interaction.user);
      await interaction.reply({ content: `Ticket claimed by <@${interaction.user.id}>.` });
      return;
    }

    if (id === 'helium_verify_btn') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const res = await VerificationService.handleVerifyClick(interaction.member as GuildMember);
      await interaction.editReply({ content: res.message });
      return;
    }

    if (id === 'helium_giveaway_enter') {
      const res = GiveawayService.enterGiveaway(interaction.message.id, interaction.user.id);
      await interaction.reply({ content: res.message, flags: MessageFlags.Ephemeral });
      return;
    }

    if (id === 'helium_poll_yes' || id === 'helium_poll_no') {
      const choice = id === 'helium_poll_yes' ? 'YES' : 'NO';
      await interaction.reply({ content: `Your vote **${choice}** has been registered!`, flags: MessageFlags.Ephemeral });
      return;
    }

    // Warning Escalation Action Buttons (Kick / Ban / Clear on 3 Warnings)
    if (id.startsWith('mod_warn_kick_')) {
      const targetUserId = id.replace('mod_warn_kick_', '');
      const modMember = interaction.member as GuildMember;

      if (!modMember.permissions.has(PermissionsBitField.Flags.KickMembers)) {
        await interaction.reply({ content: 'You do not have permission to kick members.', flags: MessageFlags.Ephemeral });
        return;
      }

      const targetMember = await interaction.guild?.members.fetch(targetUserId).catch(() => null);
      if (!targetMember || !targetMember.kickable) {
        await interaction.reply({ content: 'Cannot kick this member (Role hierarchy or member already left).', flags: MessageFlags.Ephemeral });
        return;
      }

      await targetMember.kick(`[${CONFIG.BOT_NAME}] Maximum warnings reached (3/3). Action by ${interaction.user.tag}`);
      const caseId = await ModerationService.createCase(interaction.guild!, {
        guildId: interaction.guild!.id,
        userId: targetUserId,
        moderatorId: interaction.user.id,
        action: 'KICK',
        reason: 'Maximum warnings threshold reached (3/3)',
      });

      await interaction.reply({
        content: `👢 <@${targetUserId}> has been **kicked** following 3 warnings. (Case #${caseId})`,
      });
      return;
    }

    if (id.startsWith('mod_warn_ban_')) {
      const targetUserId = id.replace('mod_warn_ban_', '');
      const modMember = interaction.member as GuildMember;

      if (!modMember.permissions.has(PermissionsBitField.Flags.BanMembers)) {
        await interaction.reply({ content: 'You do not have permission to ban members.', flags: MessageFlags.Ephemeral });
        return;
      }

      await interaction.guild?.bans.create(targetUserId, {
        reason: `[${CONFIG.BOT_NAME}] Maximum warnings reached (3/3). Action by ${interaction.user.tag}`,
      });
      const caseId = await ModerationService.createCase(interaction.guild!, {
        guildId: interaction.guild!.id,
        userId: targetUserId,
        moderatorId: interaction.user.id,
        action: 'BAN',
        reason: 'Maximum warnings threshold reached (3/3)',
      });

      await interaction.reply({
        content: `🔨 <@${targetUserId}> has been **permanently banned** following 3 warnings. (Case #${caseId})`,
      });
      return;
    }

    if (id.startsWith('mod_warn_clear_')) {
      const targetUserId = id.replace('mod_warn_clear_', '');
      const modMember = interaction.member as GuildMember;

      if (!modMember.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
        await interaction.reply({ content: 'You do not have permission to clear warnings.', flags: MessageFlags.Ephemeral });
        return;
      }

      const cleared = await ModerationService.clearWarnings(interaction.guild!, targetUserId);
      await interaction.reply({
        content: `🔄 Successfully cleared all **${cleared}** warnings and removed warning phrase roles for <@${targetUserId}>.`,
      });
      return;
    }

    // Dashboard Action Buttons router
    if (id.startsWith('dash_btn_')) {
      const parts = id.split('_'); // ['dash', 'btn', action, ...sessionIdParts]
      const action = parts[2];
      const sessionId = parts.slice(3).join('_');
      const session = DashboardSessionManager.getSession(sessionId);

      if (!session) {
        await interaction.reply({
          content: 'This dashboard session has expired or is invalid. Please execute `&admindashboard` again with your authorization key.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (session.userId !== interaction.user.id) {
        await interaction.reply({
          content: 'Access Denied: You do not own this dashboard session.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      DashboardSessionManager.touchSession(sessionId);

      if (action === 'close') {
        DashboardSessionManager.closeSession(sessionId);
        await interaction.update({
          content: 'Dashboard session safely closed. Controls deactivated.',
          embeds: [],
          components: [],
        });
        return;
      }

      if (action === 'refresh') {
        const rendered = DashboardRenderer.render(session, client, interaction.guild);
        await interaction.update(rendered);
        return;
      }

      if (action === 'lock' && interaction.guild) {
        await SecurityService.setLockdown(interaction.guild, true, `Dashboard Emergency Lockdown by ${interaction.user.tag}`);
        const rendered = DashboardRenderer.render(session, client, interaction.guild);
        await interaction.update(rendered);
        return;
      }

      if (action === 'unlock' && interaction.guild) {
        await SecurityService.setLockdown(interaction.guild, false, `Dashboard Lockdown lifted by ${interaction.user.tag}`);
        const rendered = DashboardRenderer.render(session, client, interaction.guild);
        await interaction.update(rendered);
        return;
      }

      if (action === 'panic' && interaction.guild) {
        await SecurityService.setLockdown(interaction.guild, true, 'DASHBOARD PANIC MODE TRIGGERED');
        db.prepare('UPDATE guilds SET antinuke_enabled = 1, antinuke_threshold = 1 WHERE id = ?').run(interaction.guild.id);
        const rendered = DashboardRenderer.render(session, client, interaction.guild);
        await interaction.update(rendered);
        return;
      }

      if (action === 'backup' && interaction.guild) {
        RoleService.backupRoles(interaction.guild, interaction.user.id);
        const rendered = DashboardRenderer.render(session, client, interaction.guild);
        await interaction.update(rendered);
        return;
      }
    }
  }

  // Interactive String Select Menus router
  if (interaction.isStringSelectMenu()) {
    const select = interaction as StringSelectMenuInteraction;

    // Help category selection
    if (select.customId === 'helium_help_category_select') {
      const category = select.values[0];

      if (category.toLowerCase() === 'overview') {
        const totalCmds = CommandRegistry.getAll().length;
        const totalAliases = CommandRegistry.getAliasCount();

        const embed = new EmbedBuilder()
          .setColor(CONFIG.COLORS.PRIMARY)
          .setTitle(`${CONFIG.EMOJIS.STAR} ${CONFIG.BOT_NAME} — All-In-One Command Center`)
          .setDescription(
            `${CONFIG.BOT_NAME} is a production-grade, red-themed Discord bot developed by **${CONFIG.AUTHOR}**.\n\n` +
            `**Prefix:** \`${CONFIG.PREFIX}\` • **Slash Commands:** \`${totalCmds}+\` • **Prefix Aliases:** \`${totalAliases}+\`\n\n` +
            `**Command Categories:**\n` +
            `• **Security / Anti-Nuke:** Sliding-window raid defense, lockdown, whitelist\n` +
            `• **Moderation:** Bans, timeouts, cases, purge, slowmode, warnings\n` +
            `• **AutoMod:** Native Discord AutoMod rules, links, invites, spam filter\n` +
            `• **Logging:** 7 dedicated audit channels for real-time tracking\n` +
            `• **Tickets:** Modals, transcript archives, role permissions\n` +
            `• **Roles & Welcome:** Autoroles, backup/restore, verification gate\n` +
            `• **Leveling & Economy:** XP leaderboards, wallet, bank, market store\n` +
            `• **Giveaways & Music:** Interactive giveaways, audio queue management\n` +
            `• **Utility & Info:** Reminders, polls, calculator, snowflake inspector\n\n` +
            `Select a category from the menu below or type \`&help <command>\` for details.`
          )
          .setFooter({ text: `${CONFIG.FOOTER_TEXT} • Author: ${CONFIG.AUTHOR}` })
          .setTimestamp();

        await select.update({ embeds: [embed] });
        return;
      }

      const cmds = CommandRegistry.getAll().filter(c =>
        c.category.toLowerCase() === category.toLowerCase() ||
        (category.toLowerCase() === 'giveaways' && (c.category.toLowerCase() === 'giveaways' || c.category.toLowerCase() === 'music'))
      );

      const embed = new EmbedBuilder()
        .setColor(CONFIG.COLORS.PRIMARY)
        .setTitle(`${CONFIG.EMOJIS.STAR} ${category} Commands (${cmds.length})`)
        .setDescription(
          cmds.length > 0
            ? cmds.map(c => `• **\`&${c.name}\`** — ${c.description}${c.aliases ? `\n  *Aliases:* ${c.aliases.map(a => `\`&${a}\``).join(', ')}` : ''}`).join('\n\n')
            : 'No commands found for this category.'
        )
        .setFooter({ text: `${CONFIG.FOOTER_TEXT} • Author: ${CONFIG.AUTHOR}` })
        .setTimestamp();

      await select.update({ embeds: [embed] });
      return;
    }

    // Role menu selection
    if (select.customId === 'helium_role_menu_select') {
      const roleId = select.values[0];
      const member = select.member as GuildMember;
      const role = select.guild?.roles.cache.get(roleId);

      if (!role) {
        await select.reply({ content: 'Role not found.', ephemeral: true });
        return;
      }

      if (member.roles.cache.has(role.id)) {
        await member.roles.remove(role, 'Helium Self-Role Toggle');
        await select.reply({ content: `Removed role <@&${role.id}> from your profile.`, ephemeral: true });
      } else {
        await member.roles.add(role, 'Helium Self-Role Toggle');
        await select.reply({ content: `Granted role <@&${role.id}>!`, ephemeral: true });
      }
      return;
    }

    // Dashboard Module Navigation select menu
    if (select.customId.startsWith('dash_nav_')) {
      const sessionId = select.customId.replace('dash_nav_', '');
      const session = DashboardSessionManager.getSession(sessionId);

      if (!session) {
        await select.reply({
          content: 'This dashboard session has expired. Please execute `&admindashboard` to re-open.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (session.userId !== select.user.id) {
        await select.reply({
          content: 'Access Denied: You do not own this dashboard session.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const selectedPage = select.values[0] as any;
      session.currentPage = selectedPage;
      DashboardSessionManager.touchSession(sessionId);

      const rendered = DashboardRenderer.render(session, client, select.guild);
      await select.update(rendered);
      return;
    }
  }
}
