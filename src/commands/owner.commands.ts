import { ApplicationCommandOptionType, REST, Routes } from 'discord.js';
import { HeliumCommand } from '../core/types.js';
import { CONFIG } from '../config/config.js';
import { CommandRegistry } from '../core/registry.js';
import { Logger } from '../core/logger.js';

export const ownerCommands: HeliumCommand[] = [
  {
    name: 'eval',
    description: 'Execute arbitrary JavaScript code in runtime (Owner Only)',
    category: 'Owner',
    aliases: ['e', 'evaluate', 'exec'],
    ownerOnly: true,
    slashOptions: [
      { name: 'code', description: 'JavaScript code snippet', type: ApplicationCommandOptionType.String, required: true },
    ],
    execute: async (ctx) => {
      const code = (ctx.interaction ? ctx.interaction.options.getString('code', true) : ctx.args.join(' ')) || '';
      if (!code) return ctx.replyError('Missing Code', 'Provide code to evaluate.');

      try {
        let result = eval(code);
        if (result instanceof Promise) result = await result;
        const inspected = typeof result === 'string' ? result : JSON.stringify(result, null, 2);

        return ctx.replyInfo('Eval Result', `\`\`\`js\n${(inspected || 'undefined').substring(0, 1800)}\n\`\`\``);
      } catch (err: any) {
        return ctx.replyError('Eval Error', `\`\`\`js\n${err.message}\n\`\`\``);
      }
    },
  },
  {
    name: 'sync',
    description: 'Sync and deploy all slash commands globally with Discord API (Owner Only)',
    category: 'Owner',
    aliases: ['deploy', 'registerslash', 'syncslash'],
    ownerOnly: true,
    execute: async (ctx) => {
      if (!CONFIG.TOKEN || !CONFIG.CLIENT_ID) {
        return ctx.replyError('Config Missing', 'DISCORD_TOKEN or CLIENT_ID is missing in configuration.');
      }

      try {
        const rest = new REST({ version: '10' }).setToken(CONFIG.TOKEN);
        const slashData = CommandRegistry.toSlashData();

        Logger.info(`Registering ${slashData.length} slash commands globally...`, 'Deploy');
        await rest.put(Routes.applicationCommands(CONFIG.CLIENT_ID), { body: slashData });

        return ctx.replySuccess('Slash Commands Synced', `Successfully registered **${slashData.length}** slash commands globally with Discord!`);
      } catch (err: any) {
        Logger.error('Failed to sync slash commands:', err);
        return ctx.replyError('Sync Failed', err.message);
      }
    },
  },
  {
    name: 'reload',
    description: 'Reload internal command registry cache (Owner Only)',
    category: 'Owner',
    aliases: ['refresh', 'reloadcmds'],
    ownerOnly: true,
    execute: async (ctx) => {
      const total = CommandRegistry.getTotalCount();
      return ctx.replySuccess('Registry Reloaded', `Command registry refreshed. Active commands + aliases: **${total}**.`);
    },
  },
  {
    name: 'shutdown',
    description: 'Gracefully disconnect and terminate Helium process (Owner Only)',
    category: 'Owner',
    aliases: ['exit', 'killbot', 'halt'],
    ownerOnly: true,
    execute: async (ctx) => {
      await ctx.replyWarning('Shutting Down', 'Helium is terminating gracefully...');
      setTimeout(() => process.exit(0), 1000);
    },
  },
  {
    name: 'guilds',
    description: 'List all servers Helium is currently serving (Owner Only)',
    category: 'Owner',
    aliases: ['serverlist', 'botguilds'],
    ownerOnly: true,
    execute: async (ctx) => {
      const list = ctx.client.guilds.cache.map(g => `• **${g.name}** (\`${g.id}\`) — ${g.memberCount} members`).slice(0, 20).join('\n');
      return ctx.replyInfo(`Connected Guilds (${ctx.client.guilds.cache.size})`, list || 'None');
    },
  },
  {
    name: 'leaveserver',
    description: 'Force bot to leave a specified guild by ID (Owner Only)',
    category: 'Owner',
    aliases: ['leaveguild', 'forceleave'],
    ownerOnly: true,
    slashOptions: [
      { name: 'id', description: 'Guild ID to leave', type: ApplicationCommandOptionType.String, required: true },
    ],
    execute: async (ctx) => {
      const id = ctx.interaction ? ctx.interaction.options.getString('id', true) : ctx.args[0];
      if (!id) return ctx.replyError('Missing Guild ID', 'Please specify a guild ID.');

      const guild = ctx.client.guilds.cache.get(id);
      if (!guild) return ctx.replyError('Guild Not Found', 'Bot is not in that guild.');

      await guild.leave();
      return ctx.replySuccess('Left Guild', `Successfully departed from **${guild.name}** (\`${id}\`).`);
    },
  },
];
