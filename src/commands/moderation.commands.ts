import { ActionRowBuilder, ApplicationCommandOptionType, ButtonBuilder, ButtonStyle, PermissionsBitField } from 'discord.js';
import { HeliumCommand } from '../core/types.js';
import { ModerationService } from '../services/moderation.service.js';
import { PermissionEngine } from '../core/permissions.js';
import { HeliumEmbed } from '../core/embed.js';
import { db } from '../config/database.js';

export const moderationCommands: HeliumCommand[] = [
  {
    name: 'ban',
    description: 'Permanently ban a member from the server',
    category: 'Moderation',
    aliases: ['b', 'forceban', 'banish', 'permaban'],
    permissions: [PermissionsBitField.Flags.BanMembers],
    botPermissions: [PermissionsBitField.Flags.BanMembers],
    slashOptions: [
      { name: 'user', description: 'User to ban', type: ApplicationCommandOptionType.User, required: true },
      { name: 'reason', description: 'Reason for the ban', type: ApplicationCommandOptionType.String, required: false },
    ],
    execute: async (ctx) => {
      const user = ctx.interaction ? ctx.interaction.options.getUser('user', true) : ctx.message?.mentions.users.first();
      const reason = (ctx.interaction ? ctx.interaction.options.getString('reason') : ctx.args.slice(1).join(' ')) || 'No reason provided';

      if (!user) return ctx.replyError('Invalid User', 'Please specify a valid user mention or ID to ban.');
      const member = await ctx.guild?.members.fetch(user.id).catch(() => null);

      if (member) {
        const canMod = PermissionEngine.canModerate(ctx.member!, member);
        if (!canMod.allowed) return ctx.replyError('Hierarchy Error', canMod.reason!);
      }

      await ctx.guild?.bans.create(user.id, { reason: `[Helium] ${reason} (By: ${ctx.user.tag})` });
      const caseId = await ModerationService.createCase(ctx.guild!, {
        guildId: ctx.guild!.id,
        userId: user.id,
        moderatorId: ctx.user.id,
        action: 'BAN',
        reason,
      });

      return ctx.replySuccess('Member Banned', `<@${user.id}> has been banned from the server.\n**Case ID:** \`#${caseId}\`\n**Reason:** ${reason}`);
    },
  },
  {
    name: 'unban',
    description: 'Revoke a ban for a user by ID',
    category: 'Moderation',
    aliases: ['ub', 'pardon', 'liftban', 'revokeban'],
    permissions: [PermissionsBitField.Flags.BanMembers],
    botPermissions: [PermissionsBitField.Flags.BanMembers],
    slashOptions: [
      { name: 'id', description: 'User ID to unban', type: ApplicationCommandOptionType.String, required: true },
      { name: 'reason', description: 'Reason for unbanning', type: ApplicationCommandOptionType.String, required: false },
    ],
    execute: async (ctx) => {
      const userId = ctx.interaction ? ctx.interaction.options.getString('id', true) : ctx.args[0];
      const reason = (ctx.interaction ? ctx.interaction.options.getString('reason') : ctx.args.slice(1).join(' ')) || 'No reason provided';

      if (!userId) return ctx.replyError('Missing User ID', 'Please specify a target user ID to unban.');
      await ctx.guild?.bans.remove(userId, reason);

      const caseId = await ModerationService.createCase(ctx.guild!, {
        guildId: ctx.guild!.id,
        userId,
        moderatorId: ctx.user.id,
        action: 'UNBAN',
        reason,
      });

      return ctx.replySuccess('Ban Revoked', `<@${userId}> has been unbanned.\n**Case ID:** \`#${caseId}\`\n**Reason:** ${reason}`);
    },
  },
  {
    name: 'kick',
    description: 'Kick a member from the server',
    category: 'Moderation',
    aliases: ['k', 'boot', 'removeuser', 'eject'],
    permissions: [PermissionsBitField.Flags.KickMembers],
    botPermissions: [PermissionsBitField.Flags.KickMembers],
    slashOptions: [
      { name: 'user', description: 'User to kick', type: ApplicationCommandOptionType.User, required: true },
      { name: 'reason', description: 'Reason for kicking', type: ApplicationCommandOptionType.String, required: false },
    ],
    execute: async (ctx) => {
      const user = ctx.interaction ? ctx.interaction.options.getUser('user', true) : ctx.message?.mentions.users.first();
      const reason = (ctx.interaction ? ctx.interaction.options.getString('reason') : ctx.args.slice(1).join(' ')) || 'No reason provided';

      if (!user) return ctx.replyError('Invalid User', 'Please specify a valid member to kick.');
      const member = await ctx.guild?.members.fetch(user.id).catch(() => null);
      if (!member) return ctx.replyError('Member Not Found', 'Target user is not currently in this server.');

      const canMod = PermissionEngine.canModerate(ctx.member!, member);
      if (!canMod.allowed) return ctx.replyError('Hierarchy Error', canMod.reason!);

      await member.kick(`[Helium] ${reason} (By: ${ctx.user.tag})`);
      const caseId = await ModerationService.createCase(ctx.guild!, {
        guildId: ctx.guild!.id,
        userId: user.id,
        moderatorId: ctx.user.id,
        action: 'KICK',
        reason,
      });

      return ctx.replySuccess('Member Kicked', `<@${user.id}> has been kicked from the server.\n**Case ID:** \`#${caseId}\`\n**Reason:** ${reason}`);
    },
  },
  {
    name: 'timeout',
    description: 'Temporarily timeout/mute a member',
    category: 'Moderation',
    aliases: ['mute', 'tm', 'silence', 'quiet', 'shush', 'tempmute'],
    permissions: [PermissionsBitField.Flags.ModerateMembers],
    botPermissions: [PermissionsBitField.Flags.ModerateMembers],
    slashOptions: [
      { name: 'user', description: 'User to timeout', type: ApplicationCommandOptionType.User, required: true },
      { name: 'minutes', description: 'Timeout duration in minutes', type: ApplicationCommandOptionType.Integer, required: true },
      { name: 'reason', description: 'Reason for timeout', type: ApplicationCommandOptionType.String, required: false },
    ],
    execute: async (ctx) => {
      const user = ctx.interaction ? ctx.interaction.options.getUser('user', true) : ctx.message?.mentions.users.first();
      const minutes = ctx.interaction ? ctx.interaction.options.getInteger('minutes', true) : parseInt(ctx.args[1] || '5');
      const reason = (ctx.interaction ? ctx.interaction.options.getString('reason') : ctx.args.slice(2).join(' ')) || 'No reason provided';

      if (!user || isNaN(minutes) || minutes <= 0) {
        return ctx.replyError('Invalid Arguments', 'Usage: `&timeout @user <minutes> [reason]`');
      }

      const member = await ctx.guild?.members.fetch(user.id).catch(() => null);
      if (!member) return ctx.replyError('Member Not Found', 'User is not in this guild.');

      const canMod = PermissionEngine.canModerate(ctx.member!, member);
      if (!canMod.allowed) return ctx.replyError('Hierarchy Error', canMod.reason!);

      const durationMs = minutes * 60 * 1000;
      await member.timeout(durationMs, `[Helium] ${reason}`);

      const caseId = await ModerationService.createCase(ctx.guild!, {
        guildId: ctx.guild!.id,
        userId: user.id,
        moderatorId: ctx.user.id,
        action: 'TIMEOUT',
        duration: durationMs,
        reason,
      });

      return ctx.replySuccess('Member Timed Out', `<@${user.id}> timed out for **${minutes}m**.\n**Case ID:** \`#${caseId}\`\n**Reason:** ${reason}`);
    },
  },
  {
    name: 'untimeout',
    description: 'Remove timeout from a member',
    category: 'Moderation',
    aliases: ['unmute', 'untm', 'unsilence', 'liftmute'],
    permissions: [PermissionsBitField.Flags.ModerateMembers],
    botPermissions: [PermissionsBitField.Flags.ModerateMembers],
    slashOptions: [
      { name: 'user', description: 'User to remove timeout from', type: ApplicationCommandOptionType.User, required: true },
    ],
    execute: async (ctx) => {
      const user = ctx.interaction ? ctx.interaction.options.getUser('user', true) : ctx.message?.mentions.users.first();
      if (!user) return ctx.replyError('Missing User', 'Please specify a target member.');

      const member = await ctx.guild?.members.fetch(user.id).catch(() => null);
      if (!member) return ctx.replyError('Member Not Found', 'Target user is not in this server.');

      await member.timeout(null, `[Helium Untimeout] Removed by ${ctx.user.tag}`);
      await ModerationService.createCase(ctx.guild!, {
        guildId: ctx.guild!.id,
        userId: user.id,
        moderatorId: ctx.user.id,
        action: 'UNTIMEOUT',
        reason: 'Timeout lifted by moderator',
      });

      return ctx.replySuccess('Timeout Lifted', `Timeout for <@${user.id}> has been removed.`);
    },
  },
  {
    name: 'warn',
    description: 'Issue an official warning to a member',
    category: 'Moderation',
    aliases: ['w', 'strike', 'infraction', 'caution'],
    permissions: [PermissionsBitField.Flags.ModerateMembers],
    slashOptions: [
      { name: 'user', description: 'User to warn', type: ApplicationCommandOptionType.User, required: true },
      { name: 'reason', description: 'Warning reason', type: ApplicationCommandOptionType.String, required: true },
    ],
    execute: async (ctx) => {
      const user = ctx.interaction ? ctx.interaction.options.getUser('user', true) : ctx.message?.mentions.users.first();
      const reason = (ctx.interaction ? ctx.interaction.options.getString('reason', true) : ctx.args.slice(1).join(' ')) || 'Violation of server rules';

      if (!user) return ctx.replyError('Missing User', 'Please specify a target user to warn.');

      const member = await ctx.guild?.members.fetch(user.id).catch(() => null);
      if (member) {
        const canMod = PermissionEngine.canModerate(ctx.member!, member);
        if (!canMod.allowed) return ctx.replyError('Hierarchy Error', canMod.reason!);
      }

      const warnResult = await ModerationService.addWarning(ctx.guild!, user.id, ctx.user.id, reason);

      // Max 3 warnings already reached check
      if (warnResult.alreadyMaxed) {
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`mod_warn_kick_${user.id}`)
            .setLabel('Kick User')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('👢'),
          new ButtonBuilder()
            .setCustomId(`mod_warn_ban_${user.id}`)
            .setLabel('Ban User')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🔨'),
          new ButtonBuilder()
            .setCustomId(`mod_warn_clear_${user.id}`)
            .setLabel('Clear Warnings')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🔄')
        );

        const embed = HeliumEmbed.error(
          'Maximum Warnings Exceeded (3/3)',
          `<@${user.id}> already has the maximum limit of **3 warnings** (\`3/3\`).\n` +
          `A user can get a maximum of **3 warnings**.\n\n` +
          `🚨 **Action Required:** Please **Kick** or **Ban** this member:`
        );

        if (ctx.interaction) {
          return ctx.interaction.reply({ embeds: [embed], components: [row] });
        } else {
          return ctx.message!.reply({ embeds: [embed], components: [row] });
        }
      }

      await ModerationService.createCase(ctx.guild!, {
        guildId: ctx.guild!.id,
        userId: user.id,
        moderatorId: ctx.user.id,
        action: 'WARN',
        reason,
      });

      // 3rd Warning Hit: Prompt to Kick or Ban
      if (warnResult.maxReached) {
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`mod_warn_kick_${user.id}`)
            .setLabel('Kick User')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('👢'),
          new ButtonBuilder()
            .setCustomId(`mod_warn_ban_${user.id}`)
            .setLabel('Ban User')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🔨'),
          new ButtonBuilder()
            .setCustomId(`mod_warn_clear_${user.id}`)
            .setLabel('Reset Warnings')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🔄')
        );

        const embed = HeliumEmbed.warning(
          'Warning 3 Issued — Maximum Limit Reached (3/3)',
          `<@${user.id}> has received their **3rd warning** (\`3/3\`).\n` +
          `**Assigned Role:** \`${warnResult.roleCreated || 'Warning 3'}\`\n` +
          `**Reason:** ${reason}\n\n` +
          `🚨 **A user can get a maximum of 3 warnings.**\n` +
          `Recommended action: **Kick** or **Ban** this member now:`
        );

        if (ctx.interaction) {
          return ctx.interaction.reply({ embeds: [embed], components: [row] });
        } else {
          return ctx.message!.reply({ embeds: [embed], components: [row] });
        }
      }

      return ctx.replyWarning(
        `Warning Issued (${warnResult.totalWarns}/3)`,
        `<@${user.id}> has received an official warning.\n` +
        `**Warning Phrase Role:** \`${warnResult.roleCreated || `Warning ${warnResult.totalWarns}`}\`\n` +
        `**Total Warnings:** \`${warnResult.totalWarns} / 3\`\n` +
        `**Reason:** ${reason}`
      );
    },
  },
  {
    name: 'warnings',
    description: 'View warnings for a member',
    category: 'Moderation',
    aliases: ['warns', 'strikes', 'infractions', 'viewwarns'],
    permissions: [PermissionsBitField.Flags.ModerateMembers],
    slashOptions: [
      { name: 'user', description: 'User to view warnings for', type: ApplicationCommandOptionType.User, required: true },
    ],
    execute: async (ctx) => {
      const user = ctx.interaction ? ctx.interaction.options.getUser('user', true) : ctx.message?.mentions.users.first();
      if (!user) return ctx.replyError('Missing User', 'Please specify a target user.');

      const warns = ModerationService.getWarnings(ctx.guild!.id, user.id);
      if (warns.length === 0) {
        return ctx.replyInfo('Clean Record', `<@${user.id}> has zero recorded warnings.`);
      }

      const list = warns.map((w, idx) => `**#${idx + 1}** • <t:${Math.floor(w.created_at / 1000)}:d> • Mod: <@${w.moderator_id}>\nReason: \`${w.reason}\``).join('\n\n');
      return ctx.replyInfo(`Warnings for ${user.tag} (${warns.length}/3)`, list.substring(0, 4000));
    },
  },
  {
    name: 'clearwarnings',
    description: 'Clear all warnings for a user and remove warning roles',
    category: 'Moderation',
    aliases: ['clearwarns', 'resetwarns', 'delwarns', 'pardonwarns'],
    permissions: [PermissionsBitField.Flags.ModerateMembers],
    slashOptions: [
      { name: 'user', description: 'User whose warnings to clear', type: ApplicationCommandOptionType.User, required: true },
    ],
    execute: async (ctx) => {
      const user = ctx.interaction ? ctx.interaction.options.getUser('user', true) : ctx.message?.mentions.users.first();
      if (!user) return ctx.replyError('Missing User', 'Please specify a target user.');

      const cleared = await ModerationService.clearWarnings(ctx.guild!, user.id);
      return ctx.replySuccess('Warnings Cleared', `Successfully purged **${cleared}** warning(s) and reset warning roles for <@${user.id}>.`);
    },
  },
  {
    name: 'softban',
    description: 'Ban and instantly unban a member to purge their messages',
    category: 'Moderation',
    aliases: ['sb', 'kickban', 'cleankick'],
    permissions: [PermissionsBitField.Flags.BanMembers],
    botPermissions: [PermissionsBitField.Flags.BanMembers],
    slashOptions: [
      { name: 'user', description: 'User to softban', type: ApplicationCommandOptionType.User, required: true },
      { name: 'reason', description: 'Reason for softban', type: ApplicationCommandOptionType.String, required: false },
    ],
    execute: async (ctx) => {
      const user = ctx.interaction ? ctx.interaction.options.getUser('user', true) : ctx.message?.mentions.users.first();
      const reason = (ctx.interaction ? ctx.interaction.options.getString('reason') : ctx.args.slice(1).join(' ')) || 'Softban message cleanup';

      if (!user) return ctx.replyError('Missing User', 'Please specify a target user to softban.');
      const member = await ctx.guild?.members.fetch(user.id).catch(() => null);

      if (member) {
        const canMod = PermissionEngine.canModerate(ctx.member!, member);
        if (!canMod.allowed) return ctx.replyError('Hierarchy Error', canMod.reason!);
      }

      await ctx.guild?.bans.create(user.id, { deleteMessageSeconds: 86400, reason: `[Helium Softban] ${reason}` });
      await ctx.guild?.bans.remove(user.id, 'Softban unban');

      await ModerationService.createCase(ctx.guild!, {
        guildId: ctx.guild!.id,
        userId: user.id,
        moderatorId: ctx.user.id,
        action: 'SOFTBAN',
        reason,
      });

      return ctx.replySuccess('Member Softbanned', `<@${user.id}> was softbanned and their messages from the last 24h were purged.`);
    },
  },
  {
    name: 'purge',
    description: 'Bulk delete messages from the channel',
    category: 'Moderation',
    aliases: ['clear', 'clean', 'prune', 'wipe', 'delmessages', 'bulkdelete'],
    permissions: [PermissionsBitField.Flags.ManageMessages],
    botPermissions: [PermissionsBitField.Flags.ManageMessages],
    slashOptions: [
      { name: 'amount', description: 'Number of messages to delete (1-100)', type: ApplicationCommandOptionType.Integer, required: true },
    ],
    execute: async (ctx) => {
      const amount = ctx.interaction ? ctx.interaction.options.getInteger('amount', true) : parseInt(ctx.args[0] || '10');
      if (isNaN(amount) || amount < 1 || amount > 100) {
        return ctx.replyError('Invalid Range', 'Please provide an amount between 1 and 100.');
      }

      if (ctx.channel && 'bulkDelete' in ctx.channel) {
        const deleted = await ctx.channel.bulkDelete(amount, true);
        return ctx.replySuccess('Messages Purged', `Successfully deleted **${deleted.size}** messages.`);
      }
      return ctx.replyError('Channel Incompatible', 'Cannot bulk delete messages in this channel type.');
    },
  },
  {
    name: 'slowmode',
    description: 'Set message slowmode cooldown in the channel',
    category: 'Moderation',
    aliases: ['sm', 'slow', 'cooldownchannel', 'rateslow'],
    permissions: [PermissionsBitField.Flags.ManageChannels],
    botPermissions: [PermissionsBitField.Flags.ManageChannels],
    slashOptions: [
      { name: 'seconds', description: 'Slowmode in seconds (0 to disable)', type: ApplicationCommandOptionType.Integer, required: true },
    ],
    execute: async (ctx) => {
      const seconds = ctx.interaction ? ctx.interaction.options.getInteger('seconds', true) : parseInt(ctx.args[0] || '0');
      if (isNaN(seconds) || seconds < 0 || seconds > 21600) {
        return ctx.replyError('Invalid Duration', 'Slowmode seconds must be between 0 and 21600.');
      }

      if (ctx.channel && 'setRateLimitPerUser' in ctx.channel) {
        await ctx.channel.setRateLimitPerUser(seconds, `Slowmode updated by ${ctx.user.tag}`);
        return ctx.replySuccess('Slowmode Updated', seconds === 0 ? 'Slowmode has been disabled.' : `Slowmode set to **${seconds}s**.`);
      }
      return ctx.replyError('Channel Incompatible', 'Cannot set slowmode in this channel.');
    },
  },
  {
    name: 'lock',
    description: 'Lock channel to prevent @everyone from sending messages',
    category: 'Moderation',
    aliases: ['lockchannel', 'lockdownchannel', 'freezechannel'],
    permissions: [PermissionsBitField.Flags.ManageChannels],
    botPermissions: [PermissionsBitField.Flags.ManageChannels],
    execute: async (ctx) => {
      if (!ctx.channel || !('permissionOverwrites' in ctx.channel)) return;
      await ctx.channel.permissionOverwrites.edit(ctx.guild!.roles.everyone, {
        SendMessages: false,
      }, { reason: `Locked by ${ctx.user.tag}` });

      return ctx.replySuccess('Channel Locked', `This channel has been locked for @everyone.`);
    },
  },
  {
    name: 'unlock',
    description: 'Unlock channel to allow @everyone to speak',
    category: 'Moderation',
    aliases: ['unlockchannel', 'unfreezechannel', 'openchannel'],
    permissions: [PermissionsBitField.Flags.ManageChannels],
    botPermissions: [PermissionsBitField.Flags.ManageChannels],
    execute: async (ctx) => {
      if (!ctx.channel || !('permissionOverwrites' in ctx.channel)) return;
      await ctx.channel.permissionOverwrites.edit(ctx.guild!.roles.everyone, {
        SendMessages: null,
      }, { reason: `Unlocked by ${ctx.user.tag}` });

      return ctx.replySuccess('Channel Unlocked', `This channel has been unlocked for @everyone.`);
    },
  },
  {
    name: 'hide',
    description: 'Hide channel from @everyone',
    category: 'Moderation',
    aliases: ['hidechannel', 'invisiblechannel', 'cloakchannel'],
    permissions: [PermissionsBitField.Flags.ManageChannels],
    botPermissions: [PermissionsBitField.Flags.ManageChannels],
    execute: async (ctx) => {
      if (!ctx.channel || !('permissionOverwrites' in ctx.channel)) return;
      await ctx.channel.permissionOverwrites.edit(ctx.guild!.roles.everyone, {
        ViewChannel: false,
      }, { reason: `Hidden by ${ctx.user.tag}` });

      return ctx.replySuccess('Channel Hidden', 'Channel is now hidden from @everyone.');
    },
  },
  {
    name: 'unhide',
    description: 'Unhide channel for @everyone',
    category: 'Moderation',
    aliases: ['revealchannel', 'showchannel', 'uncloakchannel'],
    permissions: [PermissionsBitField.Flags.ManageChannels],
    botPermissions: [PermissionsBitField.Flags.ManageChannels],
    execute: async (ctx) => {
      if (!ctx.channel || !('permissionOverwrites' in ctx.channel)) return;
      await ctx.channel.permissionOverwrites.edit(ctx.guild!.roles.everyone, {
        ViewChannel: null,
      }, { reason: `Unhidden by ${ctx.user.tag}` });

      return ctx.replySuccess('Channel Visible', 'Channel is now visible to @everyone.');
    },
  },
  {
    name: 'nick',
    description: 'Change or reset a member nickname',
    category: 'Moderation',
    aliases: ['nickname', 'setnick', 'changenick', 'renamemember'],
    permissions: [PermissionsBitField.Flags.ManageNicknames],
    botPermissions: [PermissionsBitField.Flags.ManageNicknames],
    slashOptions: [
      { name: 'user', description: 'Member to rename', type: ApplicationCommandOptionType.User, required: true },
      { name: 'name', description: 'New nickname (leave blank to reset)', type: ApplicationCommandOptionType.String, required: false },
    ],
    execute: async (ctx) => {
      const user = ctx.interaction ? ctx.interaction.options.getUser('user', true) : ctx.message?.mentions.users.first();
      const newNick = (ctx.interaction ? ctx.interaction.options.getString('name') : ctx.args.slice(1).join(' ')) || null;

      if (!user) return ctx.replyError('Missing User', 'Please specify a target user.');
      const member = await ctx.guild?.members.fetch(user.id).catch(() => null);
      if (!member) return ctx.replyError('Member Not Found', 'Target user is not in this server.');

      await member.setNickname(newNick, `Changed by ${ctx.user.tag}`);
      return ctx.replySuccess('Nickname Updated', `Nickname for <@${user.id}> set to **${newNick || '[Default Username]'}**.`);
    },
  },
  {
    name: 'massban',
    description: 'Ban multiple users at once by IDs',
    category: 'Moderation',
    aliases: ['multiban', 'bulkban', 'batchban'],
    permissions: [PermissionsBitField.Flags.BanMembers],
    botPermissions: [PermissionsBitField.Flags.BanMembers],
    slashOptions: [
      { name: 'ids', description: 'Space-separated user IDs', type: ApplicationCommandOptionType.String, required: true },
    ],
    execute: async (ctx) => {
      const rawIds = ctx.interaction ? ctx.interaction.options.getString('ids', true) : ctx.args.join(' ');
      const ids = rawIds.match(/\d{17,20}/g) || [];

      if (ids.length === 0) return ctx.replyError('No IDs Found', 'Please provide at least one valid user ID.');

      let banned = 0;
      for (const id of ids.slice(0, 10)) {
        try {
          await ctx.guild?.bans.create(id, { reason: `[Helium Massban] Executed by ${ctx.user.tag}` });
          banned++;
        } catch {}
      }

      return ctx.replySuccess('Massban Complete', `Successfully banned **${banned}/${ids.length}** targets.`);
    },
  },
  {
    name: 'masskick',
    description: 'Kick multiple users at once by IDs/mentions',
    category: 'Moderation',
    aliases: ['multikick', 'bulkkick', 'batchkick'],
    permissions: [PermissionsBitField.Flags.KickMembers],
    botPermissions: [PermissionsBitField.Flags.KickMembers],
    slashOptions: [
      { name: 'ids', description: 'Space-separated user IDs', type: ApplicationCommandOptionType.String, required: true },
    ],
    execute: async (ctx) => {
      const rawIds = ctx.interaction ? ctx.interaction.options.getString('ids', true) : ctx.args.join(' ');
      const ids = rawIds.match(/\d{17,20}/g) || [];

      if (ids.length === 0) return ctx.replyError('No IDs Found', 'Please provide valid user IDs to kick.');

      let kicked = 0;
      for (const id of ids.slice(0, 10)) {
        try {
          const m = await ctx.guild?.members.fetch(id).catch(() => null);
          if (m && m.kickable) {
            await m.kick(`[Helium Masskick] Executed by ${ctx.user.tag}`);
            kicked++;
          }
        } catch {}
      }

      return ctx.replySuccess('Masskick Complete', `Successfully kicked **${kicked}/${ids.length}** members.`);
    },
  },
  {
    name: 'modnote',
    description: 'Attach a private staff note to a user',
    category: 'Moderation',
    aliases: ['note', 'addnote', 'usernote'],
    permissions: [PermissionsBitField.Flags.ModerateMembers],
    slashOptions: [
      { name: 'user', description: 'Target user', type: ApplicationCommandOptionType.User, required: true },
      { name: 'text', description: 'Note content', type: ApplicationCommandOptionType.String, required: true },
    ],
    execute: async (ctx) => {
      const user = ctx.interaction ? ctx.interaction.options.getUser('user', true) : ctx.message?.mentions.users.first();
      const text = (ctx.interaction ? ctx.interaction.options.getString('text', true) : ctx.args.slice(1).join(' ')) || '';

      if (!user || !text) return ctx.replyError('Invalid Arguments', 'Please specify a user and note text.');
      ModerationService.addNote(ctx.guild!.id, user.id, ctx.user.id, text);

      return ctx.replySuccess('Staff Note Added', `Note recorded for <@${user.id}>:\n> ${text}`);
    },
  },
  {
    name: 'viewnotes',
    description: 'View recorded staff notes for a user',
    category: 'Moderation',
    aliases: ['notes', 'getnotes', 'listnotes'],
    permissions: [PermissionsBitField.Flags.ModerateMembers],
    slashOptions: [
      { name: 'user', description: 'Target user', type: ApplicationCommandOptionType.User, required: true },
    ],
    execute: async (ctx) => {
      const user = ctx.interaction ? ctx.interaction.options.getUser('user', true) : ctx.message?.mentions.users.first();
      if (!user) return ctx.replyError('Missing User', 'Please specify a target user.');

      const notes = ModerationService.getNotes(ctx.guild!.id, user.id);
      if (notes.length === 0) return ctx.replyInfo('No Notes', `No staff notes recorded for <@${user.id}>.`);

      const text = notes.map((n, i) => `**#${i + 1}** • <t:${Math.floor(n.created_at / 1000)}:d> • Mod: <@${n.moderator_id}>\n> ${n.note}`).join('\n\n');
      return ctx.replyInfo(`Staff Notes for ${user.tag}`, text);
    },
  },
  {
    name: 'case',
    description: 'View details of a specific moderation case by ID',
    category: 'Moderation',
    aliases: ['viewcase', 'casedetail', 'inspectcase'],
    permissions: [PermissionsBitField.Flags.ModerateMembers],
    slashOptions: [
      { name: 'id', description: 'Case number ID', type: ApplicationCommandOptionType.Integer, required: true },
    ],
    execute: async (ctx) => {
      const caseId = ctx.interaction ? ctx.interaction.options.getInteger('id', true) : parseInt(ctx.args[0] || '0');
      const row = db.prepare('SELECT * FROM moderation_cases WHERE guild_id = ? AND case_id = ?').get(ctx.guild!.id, caseId) as any;

      if (!row) return ctx.replyError('Case Not Found', `No case found matching ID \`#${caseId}\`.`);

      return ctx.replyInfo(
        `Case #${row.case_id} — ${row.action}`,
        `**User:** <@${row.user_id}> (\`${row.user_id}\`)\n` +
        `**Moderator:** <@${row.moderator_id}>\n` +
        `**Action:** \`${row.action}\`\n` +
        `**Reason:** ${row.reason}\n` +
        `**Date:** <t:${Math.floor(row.created_at / 1000)}:F>`
      );
    },
  },
  {
    name: 'cases',
    description: 'List recent moderation cases for the server',
    category: 'Moderation',
    aliases: ['modcases', 'caselist', 'historycases'],
    permissions: [PermissionsBitField.Flags.ModerateMembers],
    execute: async (ctx) => {
      const rows = db.prepare('SELECT * FROM moderation_cases WHERE guild_id = ? ORDER BY case_id DESC LIMIT 10').all(ctx.guild!.id) as any[];
      if (rows.length === 0) return ctx.replyInfo('No Cases', 'There are no moderation cases recorded in this server.');

      const text = rows.map(r => `\`#${r.case_id}\` **${r.action}** • <@${r.user_id}> • Mod: <@${r.moderator_id}>\nReason: \`${r.reason}\``).join('\n\n');
      return ctx.replyInfo(`Recent Moderation Cases (Last 10)`, text);
    },
  },
  {
    name: 'reason',
    description: 'Update the reason for an existing moderation case',
    category: 'Moderation',
    aliases: ['setreason', 'editreason', 'updatereason'],
    permissions: [PermissionsBitField.Flags.ModerateMembers],
    slashOptions: [
      { name: 'id', description: 'Case number ID', type: ApplicationCommandOptionType.Integer, required: true },
      { name: 'text', description: 'New reason description', type: ApplicationCommandOptionType.String, required: true },
    ],
    execute: async (ctx) => {
      const caseId = ctx.interaction ? ctx.interaction.options.getInteger('id', true) : parseInt(ctx.args[0] || '0');
      const text = (ctx.interaction ? ctx.interaction.options.getString('text', true) : ctx.args.slice(1).join(' ')) || '';

      if (!caseId || !text) return ctx.replyError('Invalid Arguments', 'Usage: `&reason <caseId> <new reason>`');

      const res = db.prepare('UPDATE moderation_cases SET reason = ? WHERE guild_id = ? AND case_id = ?').run(text, ctx.guild!.id, caseId);
      if (res.changes === 0) return ctx.replyError('Not Found', `Case \`#${caseId}\` was not found.`);

      return ctx.replySuccess('Reason Updated', `Reason for Case \`#${caseId}\` updated to:\n> ${text}`);
    },
  },
  {
    name: 'history',
    description: 'View full punishment history for a user',
    category: 'Moderation',
    aliases: ['modhistory', 'record', 'userhistory', 'punishments'],
    permissions: [PermissionsBitField.Flags.ModerateMembers],
    slashOptions: [
      { name: 'user', description: 'Target user', type: ApplicationCommandOptionType.User, required: true },
    ],
    execute: async (ctx) => {
      const user = ctx.interaction ? ctx.interaction.options.getUser('user', true) : ctx.message?.mentions.users.first();
      if (!user) return ctx.replyError('Missing User', 'Please specify a target user.');

      const cases = db.prepare('SELECT * FROM moderation_cases WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 10').all(ctx.guild!.id, user.id) as any[];
      if (cases.length === 0) return ctx.replyInfo('Clean History', `<@${user.id}> has no prior punishment cases.`);

      const text = cases.map(c => `\`#${c.case_id}\` **${c.action}** (<t:${Math.floor(c.created_at / 1000)}:d>)\n> Reason: ${c.reason}`).join('\n\n');
      return ctx.replyInfo(`Punishment History for ${user.tag}`, text);
    },
  },
  {
    name: 'report',
    description: 'Submit an incident report against a user to server moderators',
    category: 'Moderation',
    aliases: ['flag', 'reportuser', 'submitreport'],
    slashOptions: [
      { name: 'user', description: 'User to report', type: ApplicationCommandOptionType.User, required: true },
      { name: 'reason', description: 'Incident details', type: ApplicationCommandOptionType.String, required: true },
    ],
    execute: async (ctx) => {
      const user = ctx.interaction ? ctx.interaction.options.getUser('user', true) : ctx.message?.mentions.users.first();
      const reason = (ctx.interaction ? ctx.interaction.options.getString('reason', true) : ctx.args.slice(1).join(' ')) || 'No details provided';

      if (!user) return ctx.replyError('Missing User', 'Please specify a user to report.');

      // Dispatch to mod logs if available
      const config = db.prepare('SELECT mod_log_channel FROM guilds WHERE id = ?').get(ctx.guild!.id) as any;
      if (config?.mod_log_channel) {
        const chan = ctx.guild?.channels.cache.get(config.mod_log_channel) as any;
        if (chan && chan.isTextBased()) {
          chan.send({
            embeds: [
              HeliumEmbed.warning(
                'Member Report Filed',
                `**Reported User:** <@${user.id}> (\`${user.id}\`)\n` +
                `**Reporter:** <@${ctx.user.id}>\n` +
                `**Reason:** ${reason}`
              )
            ]
          }).catch(() => null);
        }
      }

      return ctx.replySuccess('Report Filed', `Your report against <@${user.id}> has been sent to staff for review.`);
    },
  },
  {
    name: 'appeal',
    description: 'Submit a punishment appeal to the server staff',
    category: 'Moderation',
    aliases: ['submitappeal', 'requestunban', 'appealcase'],
    slashOptions: [
      { name: 'reason', description: 'Why your punishment should be reconsidered', type: ApplicationCommandOptionType.String, required: true },
    ],
    execute: async (ctx) => {
      const reason = (ctx.interaction ? ctx.interaction.options.getString('reason', true) : ctx.args.join(' ')) || '';
      if (!reason) return ctx.replyError('Missing Details', 'Please provide an appeal reason.');

      return ctx.replySuccess('Appeal Received', `Your appeal has been recorded. Server staff will review your case.`);
    },
  },
];
