import { ApplicationCommandOptionType, PermissionsBitField } from 'discord.js';
import { HeliumCommand } from '../core/types.js';
import { db } from '../config/database.js';
import { AutoModService } from '../services/automod.service.js';

export const automodCommands: HeliumCommand[] = [
  {
    name: 'automod',
    description: 'Configure and inspect Discord AutoMod and custom filter layers',
    category: 'AutoMod',
    aliases: ['am', 'filterbot', 'autoprotect'],
    permissions: [PermissionsBitField.Flags.ManageGuild],
    execute: async (ctx) => {
      const config = db.prepare('SELECT * FROM guilds WHERE id = ?').get(ctx.guild!.id) as any;
      const nativeRules = await AutoModService.getNativeRules(ctx.guild!);

      return ctx.replySettings(
        'Helium AutoMod Configuration',
        `**Master Engine:** \`${config?.automod_enabled ? 'ENABLED' : 'DISABLED'}\`\n` +
        `**Discord AutoMod Native Rules:** \`${nativeRules?.size || 0} active\`\n\n` +
        `**Filter Rules:**\n` +
        `• Discord Invites: \`${config?.automod_invites ? 'BLOCKED' : 'ALLOWED'}\`\n` +
        `• Web Links: \`${config?.automod_links ? 'BLOCKED' : 'ALLOWED'}\`\n` +
        `• Duplicate Spam: \`${config?.automod_spam ? 'FILTERED' : 'OFF'}\`\n` +
        `• Caps Lock (>70%): \`${config?.automod_caps ? 'FILTERED' : 'OFF'}\`\n\n` +
        `Use \`&automod-enable\` / \`&automod-disable\` or specific filters like \`&automod-invites\` to toggle.`
      );
    },
  },
  {
    name: 'automod-status',
    description: 'Status of active AutoMod protection in the guild',
    category: 'AutoMod',
    aliases: ['amstatus', 'rulesstatus', 'filterstatus'],
    permissions: [PermissionsBitField.Flags.ManageGuild],
    execute: async (ctx) => {
      const config = db.prepare('SELECT * FROM guilds WHERE id = ?').get(ctx.guild!.id) as any;
      return ctx.replyInfo(
        'AutoMod Engine Status',
        `**Status:** \`${config?.automod_enabled ? 'Active Protection' : 'Disabled'}\`\n` +
        `**AutoMod Logs Channel:** ${config?.automod_log_channel ? `<#${config.automod_log_channel}>` : '`Not configured`'}`
      );
    },
  },
  {
    name: 'automod-enable',
    description: 'Turn on master AutoMod protection',
    category: 'AutoMod',
    aliases: ['amenable', 'startautomod', 'activateautomod'],
    permissions: [PermissionsBitField.Flags.ManageGuild],
    execute: async (ctx) => {
      db.prepare('UPDATE guilds SET automod_enabled = 1 WHERE id = ?').run(ctx.guild!.id);
      return ctx.replySuccess('AutoMod Activated', 'Master AutoMod protection has been turned on.');
    },
  },
  {
    name: 'automod-disable',
    description: 'Turn off master AutoMod protection',
    category: 'AutoMod',
    aliases: ['amdisable', 'stopautomod', 'deactivateautomod'],
    permissions: [PermissionsBitField.Flags.ManageGuild],
    execute: async (ctx) => {
      db.prepare('UPDATE guilds SET automod_enabled = 0 WHERE id = ?').run(ctx.guild!.id);
      return ctx.replyWarning('AutoMod Deactivated', 'Master AutoMod protection has been disabled.');
    },
  },
  {
    name: 'automod-invites',
    description: 'Toggle automatic blocking of Discord invite links',
    category: 'AutoMod',
    aliases: ['antiinvite', 'blockinvites', 'invitefilter'],
    permissions: [PermissionsBitField.Flags.ManageGuild],
    execute: async (ctx) => {
      const config = db.prepare('SELECT automod_invites FROM guilds WHERE id = ?').get(ctx.guild!.id) as any;
      const newState = config?.automod_invites ? 0 : 1;
      db.prepare('UPDATE guilds SET automod_invites = ? WHERE id = ?').run(newState, ctx.guild!.id);
      return ctx.replySuccess('Invite Filter Updated', `Discord invite link filter is now **${newState ? 'ENABLED' : 'DISABLED'}**.`);
    },
  },
  {
    name: 'automod-links',
    description: 'Toggle automatic blocking of external web links',
    category: 'AutoMod',
    aliases: ['antilinks', 'blocklinks', 'linkfilter'],
    permissions: [PermissionsBitField.Flags.ManageGuild],
    execute: async (ctx) => {
      const config = db.prepare('SELECT automod_links FROM guilds WHERE id = ?').get(ctx.guild!.id) as any;
      const newState = config?.automod_links ? 0 : 1;
      db.prepare('UPDATE guilds SET automod_links = ? WHERE id = ?').run(newState, ctx.guild!.id);
      return ctx.replySuccess('Link Filter Updated', `External link filter is now **${newState ? 'ENABLED' : 'DISABLED'}**.`);
    },
  },
  {
    name: 'automod-spam',
    description: 'Toggle rapid duplicate message spam protection',
    category: 'AutoMod',
    aliases: ['antispam', 'spamfilter', 'floodfilter'],
    permissions: [PermissionsBitField.Flags.ManageGuild],
    execute: async (ctx) => {
      const config = db.prepare('SELECT automod_spam FROM guilds WHERE id = ?').get(ctx.guild!.id) as any;
      const newState = config?.automod_spam ? 0 : 1;
      db.prepare('UPDATE guilds SET automod_spam = ? WHERE id = ?').run(newState, ctx.guild!.id);
      return ctx.replySuccess('Anti-Spam Updated', `Duplicate message spam filter is now **${newState ? 'ENABLED' : 'DISABLED'}**.`);
    },
  },
  {
    name: 'automod-caps',
    description: 'Toggle excessive capital letters filter',
    category: 'AutoMod',
    aliases: ['anticaps', 'capsfilter', 'blockcaps'],
    permissions: [PermissionsBitField.Flags.ManageGuild],
    execute: async (ctx) => {
      const config = db.prepare('SELECT automod_caps FROM guilds WHERE id = ?').get(ctx.guild!.id) as any;
      const newState = config?.automod_caps ? 0 : 1;
      db.prepare('UPDATE guilds SET automod_caps = ? WHERE id = ?').run(newState, ctx.guild!.id);
      return ctx.replySuccess('Caps Filter Updated', `Excessive caps lock filter is now **${newState ? 'ENABLED' : 'DISABLED'}**.`);
    },
  },
  {
    name: 'automod-keyword',
    description: 'Inspect or configure filtered keywords',
    category: 'AutoMod',
    aliases: ['badwords', 'blockword', 'filterword', 'bannedwords'],
    permissions: [PermissionsBitField.Flags.ManageGuild],
    slashOptions: [
      { name: 'word', description: 'Word to add to blocklist', type: ApplicationCommandOptionType.String, required: false },
    ],
    execute: async (ctx) => {
      const word = ctx.interaction ? ctx.interaction.options.getString('word') : ctx.args[0];
      const config = db.prepare('SELECT automod_badwords_list FROM guilds WHERE id = ?').get(ctx.guild!.id) as any;
      const list: string[] = JSON.parse(config?.automod_badwords_list || '[]');

      if (word) {
        if (!list.includes(word.toLowerCase())) {
          list.push(word.toLowerCase());
          db.prepare('UPDATE guilds SET automod_badwords_list = ? WHERE id = ?').run(JSON.stringify(list), ctx.guild!.id);
          return ctx.replySuccess('Keyword Blocked', `Added \`${word}\` to the filtered keywords list.`);
        } else {
          return ctx.replyWarning('Already Filtered', `Keyword \`${word}\` is already in the filter list.`);
        }
      }

      return ctx.replyInfo('Blocked Keywords', list.length > 0 ? list.map(w => `• \`${w}\``).join('\n') : 'No custom keywords configured.');
    },
  },
  {
    name: 'automod-mention',
    description: 'Mass mention limit settings info',
    category: 'AutoMod',
    aliases: ['antimention', 'mentionlimit', 'spammention'],
    permissions: [PermissionsBitField.Flags.ManageGuild],
    execute: async (ctx) => {
      return ctx.replyInfo('Mass Mention Protection', 'Messages containing **more than 5 mentions** are automatically deleted and logged.');
    },
  },
  {
    name: 'automod-test',
    description: 'Test text against current AutoMod rule filter',
    category: 'AutoMod',
    aliases: ['testautomod', 'checkfilter', 'filtertest'],
    slashOptions: [
      { name: 'sample', description: 'Sample text string to test', type: ApplicationCommandOptionType.String, required: true },
    ],
    execute: async (ctx) => {
      const text = (ctx.interaction ? ctx.interaction.options.getString('sample', true) : ctx.args.join(' ')) || '';
      const containsInvite = /(discord\.(gg|io|me|li)\/.+|discordapp\.com\/invite\/.+|discord\.com\/invite\/.+)/i.test(text);
      const containsLink = /https?:\/\/[^\s]+/i.test(text);

      return ctx.replyInfo(
        'AutoMod Test Result',
        `**Sample Text:** \`${text.substring(0, 100)}\`\n` +
        `• Invite Detected: \`${containsInvite ? 'YES' : 'NO'}\`\n` +
        `• Link Detected: \`${containsLink ? 'YES' : 'NO'}\``
      );
    },
  },
  {
    name: 'automod-logs',
    description: 'Set channel for AutoMod violations logging',
    category: 'AutoMod',
    aliases: ['amlogs', 'filterlogs', 'automodhistory'],
    permissions: [PermissionsBitField.Flags.ManageGuild],
    slashOptions: [
      { name: 'channel', description: 'Log channel for AutoMod violations', type: ApplicationCommandOptionType.Channel, required: true },
    ],
    execute: async (ctx) => {
      const channel = ctx.interaction ? ctx.interaction.options.getChannel('channel', true) : ctx.message?.mentions.channels.first();
      if (!channel) return ctx.replyError('Missing Channel', 'Please specify a target channel.');

      db.prepare('UPDATE guilds SET automod_log_channel = ? WHERE id = ?').run(channel.id, ctx.guild!.id);
      return ctx.replySuccess('AutoMod Logs Configured', `AutoMod violation alerts will now be dispatched to <#${channel.id}>.`);
    },
  },
];
