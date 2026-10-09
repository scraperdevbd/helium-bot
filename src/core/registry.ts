import {
  ApplicationCommandOptionType,
  ChatInputCommandInteraction,
  Message,
  MessageFlags,
  PermissionsBitField,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
  SlashCommandBuilder,
} from 'discord.js';
import { HeliumClient } from './client.js';
import { CommandContext, HeliumCommand } from './types.js';
import { CONFIG } from '../config/config.js';
import { HeliumEmbed } from './embed.js';
import { PermissionEngine } from './permissions.js';
import { CooldownManager } from './cooldowns.js';
import { Logger } from './logger.js';

export class CommandRegistry {
  private static commands: Map<string, HeliumCommand> = new Map();
  private static aliases: Map<string, string> = new Map();

  static register(command: HeliumCommand) {
    this.commands.set(command.name.toLowerCase(), command);
    if (command.aliases) {
      for (const alias of command.aliases) {
        this.aliases.set(alias.toLowerCase(), command.name.toLowerCase());
      }
    }
  }

  static registerAll(commands: HeliumCommand[]) {
    for (const cmd of commands) {
      this.register(cmd);
    }
  }

  static get(nameOrAlias: string): HeliumCommand | undefined {
    const key = nameOrAlias.toLowerCase();
    const primary = this.aliases.get(key) || key;
    return this.commands.get(primary);
  }

  static getAll(): HeliumCommand[] {
    return Array.from(this.commands.values());
  }

  static getAliasCount(): number {
    return this.aliases.size;
  }

  static getTotalCount(): number {
    return this.commands.size + this.aliases.size;
  }

  /**
   * Parse quoted command line string into arguments
   * Supports: &ban @user "Violating server rule 4"
   */
  static parseArgs(raw: string): string[] {
    const args: string[] = [];
    const regex = /[^\s"']+|"([^"]*)"|'([^']*)'/gi;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(raw)) !== null) {
      // Index 1 has double quotes content, Index 2 has single quotes content
      if (match[1] !== undefined) {
        args.push(match[1]);
      } else if (match[2] !== undefined) {
        args.push(match[2]);
      } else {
        args.push(match[0]);
      }
    }

    return args;
  }

  /**
   * Suggest nearest command name on typo using Levenshtein distance
   */
  static suggestCommand(input: string): string | null {
    let closest: string | null = null;
    let minDistance = 3; // Max threshold

    const allNames = [...this.commands.keys(), ...this.aliases.keys()];
    for (const name of allNames) {
      const dist = this.levenshtein(input.toLowerCase(), name);
      if (dist < minDistance) {
        minDistance = dist;
        closest = name;
      }
    }

    return closest;
  }

  private static levenshtein(a: string, b: string): number {
    const matrix: number[][] = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[b.length][a.length];
  }

  /**
   * Execute interaction slash command
   */
  static async handleInteraction(interaction: ChatInputCommandInteraction, client: HeliumClient) {
    const command = this.get(interaction.commandName);
    if (!command) return;

    const ctx: CommandContext = {
      client,
      guild: interaction.guild,
      channel: interaction.channel,
      member: interaction.member as any,
      user: interaction.user,
      interaction,
      args: interaction.options.data.map(o => (o.value !== undefined ? String(o.value) : '')),
      reply: async (opts) => {
        if (interaction.deferred || interaction.replied) {
          return interaction.followUp(opts as any);
        }
        return interaction.reply(opts as any);
      },
      replyEmbed: async (embed, ephemeral = false) => {
        const payload: any = { embeds: [embed] };
        if (ephemeral) payload.flags = MessageFlags.Ephemeral;
        if (interaction.deferred || interaction.replied) {
          return interaction.followUp(payload);
        }
        return interaction.reply(payload);
      },
      replySuccess: async (title, desc, ephemeral = false) => {
        return ctx.replyEmbed(HeliumEmbed.success(title, desc), ephemeral);
      },
      replyError: async (title, desc, ephemeral = true) => {
        return ctx.replyEmbed(HeliumEmbed.error(title, desc), ephemeral);
      },
      replySecurity: async (title, desc, ephemeral = false) => {
        return ctx.replyEmbed(HeliumEmbed.security(title, desc), ephemeral);
      },
      replyWarning: async (title, desc, ephemeral = false) => {
        return ctx.replyEmbed(HeliumEmbed.warning(title, desc), ephemeral);
      },
      replyInfo: async (title, desc, ephemeral = false) => {
        return ctx.replyEmbed(HeliumEmbed.info(title, desc), ephemeral);
      },
      replySettings: async (title, desc, ephemeral = false) => {
        return ctx.replyEmbed(HeliumEmbed.settings(title, desc), ephemeral);
      },
      replyConnection: async (title, desc, ephemeral = false) => {
        return ctx.replyEmbed(HeliumEmbed.connection(title, desc), ephemeral);
      },
    };

    // Owner check
    if (command.ownerOnly && !CONFIG.OWNER_IDS.includes(interaction.user.id)) {
      return ctx.replyError('Unauthorized', 'This command is restricted to the bot owner (@req.akira).');
    }

    // Guild check
    if (command.guildOnly && !interaction.guild) {
      return ctx.replyError('Server Only', 'This command can only be executed inside a Discord server.');
    }

    // Permissions check
    if (command.permissions && interaction.member) {
      if (!PermissionEngine.hasPermissions(interaction.member as any, command.permissions)) {
        return ctx.replyError('Missing Permissions', 'You do not have the required permissions to use this command.');
      }
    }

    // Bot Permissions check
    if (command.botPermissions && interaction.guild?.members.me) {
      if (!PermissionEngine.botHasPermissions(interaction.guild.members.me, command.botPermissions)) {
        return ctx.replyError('Bot Missing Permissions', 'Helium lacks the required Discord permissions to perform this action.');
      }
    }

    // Cooldown check
    const cooldownRemaining = CooldownManager.check(command.name, interaction.user.id, command.cooldown || 2);
    if (cooldownRemaining > 0) {
      return ctx.replyWarning('Cooldown Active', `Please wait **${cooldownRemaining}s** before reusing this command.`);
    }

    try {
      await command.execute(ctx);
    } catch (err: any) {
      Logger.error(`Error executing slash /${command.name}:`, err);
      if (!interaction.replied && !interaction.deferred) {
        await ctx.replyError('Execution Failed', 'An unexpected error occurred while executing this command.');
      }
    }
  }

  /**
   * Execute message prefix command
   */
  static async handleMessage(message: Message, client: HeliumClient, prefix: string) {
    if (!message.content.startsWith(prefix) || message.author.bot) return;

    const raw = message.content.slice(prefix.length).trim();
    if (!raw) return;

    const parsed = this.parseArgs(raw);
    const cmdName = parsed[0]?.toLowerCase();
    const args = parsed.slice(1);

    const command = this.get(cmdName);
    if (!command) {
      const suggestion = this.suggestCommand(cmdName);
      if (suggestion) {
        const embed = HeliumEmbed.warning(
          'Command Not Found',
          `Unknown command \`${prefix}${cmdName}\`.\nDid you mean **\`${prefix}${suggestion}\`**?`
        );
        message.reply({ embeds: [embed] }).catch(() => null);
      }
      return;
    }

    const safeReply = async (opts: any) => {
      try {
        return await message.reply(opts);
      } catch (err: any) {
        // Fall back to channel.send if message reference unknown or deleted (50035 or 10008)
        if (err.code !== 50035 && err.code !== 10008) throw err;
      }
      if (message.channel && 'send' in message.channel) {
        return await (message.channel as any).send(opts);
      }
    };

    const ctx: CommandContext = {
      client,
      guild: message.guild,
      channel: message.channel,
      member: message.member,
      user: message.author,
      message,
      args,
      reply: async (opts) => safeReply(opts),
      replyEmbed: async (embed) => safeReply({ embeds: [embed] }),
      replySuccess: async (title, desc) => safeReply({ embeds: [HeliumEmbed.success(title, desc)] }),
      replyError: async (title, desc) => safeReply({ embeds: [HeliumEmbed.error(title, desc)] }),
      replySecurity: async (title, desc) => safeReply({ embeds: [HeliumEmbed.security(title, desc)] }),
      replyWarning: async (title, desc) => safeReply({ embeds: [HeliumEmbed.warning(title, desc)] }),
      replyInfo: async (title, desc) => safeReply({ embeds: [HeliumEmbed.info(title, desc)] }),
      replySettings: async (title, desc) => safeReply({ embeds: [HeliumEmbed.settings(title, desc)] }),
      replyConnection: async (title, desc) => safeReply({ embeds: [HeliumEmbed.connection(title, desc)] }),
    };

    // Owner check
    if (command.ownerOnly && !CONFIG.OWNER_IDS.includes(message.author.id)) {
      return ctx.replyError('Unauthorized', 'This command is restricted to the bot owner (@req.akira).');
    }

    // Guild check
    if (command.guildOnly && !message.guild) {
      return ctx.replyError('Server Only', 'This command can only be executed inside a Discord server.');
    }

    // Permissions check
    if (command.permissions && message.member) {
      if (!PermissionEngine.hasPermissions(message.member, command.permissions)) {
        return ctx.replyError('Missing Permissions', 'You do not have the required permissions to use this command.');
      }
    }

    // Bot Permissions check
    if (command.botPermissions && message.guild?.members.me) {
      if (!PermissionEngine.botHasPermissions(message.guild.members.me, command.botPermissions)) {
        return ctx.replyError('Bot Missing Permissions', 'Helium lacks the required Discord permissions to perform this action.');
      }
    }

    // Cooldown check
    const cooldownRemaining = CooldownManager.check(command.name, message.author.id, command.cooldown || 2);
    if (cooldownRemaining > 0) {
      return ctx.replyWarning('Cooldown Active', `Please wait **${cooldownRemaining}s** before reusing this command.`);
    }

    try {
      await command.execute(ctx);
    } catch (err: any) {
      Logger.error(`Error executing prefix &${command.name}:`, err);
      await ctx.replyError('Execution Failed', 'An unexpected error occurred while executing this command.');
    }
  }

  /**
   * Convert registered commands to JSON payload for Discord API slash command registration
   */
  static toSlashData(limit = 100): RESTPostAPIChatInputApplicationCommandsJSONBody[] {
    const list: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [];
    const sorted = Array.from(this.commands.values()).sort((a, b) => {
      if (a.ownerOnly && !b.ownerOnly) return 1;
      if (!a.ownerOnly && b.ownerOnly) return -1;
      return 0;
    });

    for (const cmd of sorted) {
      if (list.length >= limit) break;
      const builder = new SlashCommandBuilder()
        .setName(cmd.name.toLowerCase())
        .setDescription(cmd.description.substring(0, 100));

      if (cmd.slashOptions && Array.isArray(cmd.slashOptions)) {
        for (const opt of cmd.slashOptions as any[]) {
          const optType = opt.type;
          const optName = String(opt.name || 'option').toLowerCase().replace(/[^a-z0-9_-]/g, '').substring(0, 32);
          const optDesc = String(opt.description || optName).substring(0, 100);
          const optReq = Boolean(opt.required);

          switch (optType) {
            case ApplicationCommandOptionType.String:
              builder.addStringOption(o => {
                o.setName(optName).setDescription(optDesc).setRequired(optReq);
                if (opt.choices && Array.isArray(opt.choices)) {
                  for (const choice of opt.choices) {
                    if (choice && choice.name && choice.value !== undefined) {
                      o.addChoices({ name: String(choice.name).substring(0, 100), value: String(choice.value) });
                    }
                  }
                }
                return o;
              });
              break;
            case ApplicationCommandOptionType.Integer:
              builder.addIntegerOption(o => {
                o.setName(optName).setDescription(optDesc).setRequired(optReq);
                if (opt.choices && Array.isArray(opt.choices)) {
                  for (const choice of opt.choices) {
                    if (choice && choice.name && choice.value !== undefined) {
                      o.addChoices({ name: String(choice.name).substring(0, 100), value: Number(choice.value) });
                    }
                  }
                }
                return o;
              });
              break;
            case ApplicationCommandOptionType.Number:
              builder.addNumberOption(o => o.setName(optName).setDescription(optDesc).setRequired(optReq));
              break;
            case ApplicationCommandOptionType.Boolean:
              builder.addBooleanOption(o => o.setName(optName).setDescription(optDesc).setRequired(optReq));
              break;
            case ApplicationCommandOptionType.User:
              builder.addUserOption(o => o.setName(optName).setDescription(optDesc).setRequired(optReq));
              break;
            case ApplicationCommandOptionType.Channel:
              builder.addChannelOption(o => o.setName(optName).setDescription(optDesc).setRequired(optReq));
              break;
            case ApplicationCommandOptionType.Role:
              builder.addRoleOption(o => o.setName(optName).setDescription(optDesc).setRequired(optReq));
              break;
            case ApplicationCommandOptionType.Mentionable:
              builder.addMentionableOption(o => o.setName(optName).setDescription(optDesc).setRequired(optReq));
              break;
            case ApplicationCommandOptionType.Attachment:
              builder.addAttachmentOption(o => o.setName(optName).setDescription(optDesc).setRequired(optReq));
              break;
            default:
              builder.addStringOption(o => o.setName(optName).setDescription(optDesc).setRequired(optReq));
              break;
          }
        }
      }

      list.push(builder.toJSON());
    }
    return list;
  }
}
