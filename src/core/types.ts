import {
  ApplicationCommandOptionData,
  ChatInputCommandInteraction,
  Guild,
  GuildMember,
  Message,
  MessageReplyOptions,
  InteractionReplyOptions,
  TextBasedChannel,
  User,
  EmbedBuilder,
} from 'discord.js';
import type { HeliumClient } from './client.js';

export type CommandCategory =
  | 'Moderation'
  | 'Security'
  | 'AutoMod'
  | 'Logging'
  | 'Tickets'
  | 'Roles'
  | 'Welcome'
  | 'Leveling'
  | 'Economy'
  | 'Giveaways'
  | 'Music'
  | 'Utility'
  | 'Info'
  | 'Automation'
  | 'Owner';

export interface CommandContext {
  client: HeliumClient;
  guild: Guild | null;
  channel: TextBasedChannel | null;
  member: GuildMember | null;
  user: User;
  interaction?: ChatInputCommandInteraction;
  message?: Message;
  args: string[];
  reply: (options: string | InteractionReplyOptions | MessageReplyOptions) => Promise<any>;
  replyEmbed: (embed: EmbedBuilder, ephemeral?: boolean) => Promise<any>;
  replySuccess: (title: string, description: string, ephemeral?: boolean) => Promise<any>;
  replyError: (title: string, description: string, ephemeral?: boolean) => Promise<any>;
  replySecurity: (title: string, description: string, ephemeral?: boolean) => Promise<any>;
  replyWarning: (title: string, description: string, ephemeral?: boolean) => Promise<any>;
  replyInfo: (title: string, description: string, ephemeral?: boolean) => Promise<any>;
  replySettings: (title: string, description: string, ephemeral?: boolean) => Promise<any>;
  replyConnection: (title: string, description: string, ephemeral?: boolean) => Promise<any>;
}

export interface HeliumCommand {
  name: string;
  description: string;
  category: CommandCategory;
  aliases?: string[];
  usage?: string;
  examples?: string[];
  permissions?: bigint[];
  botPermissions?: bigint[];
  cooldown?: number; // seconds
  ownerOnly?: boolean;
  guildOnly?: boolean;
  slashOptions?: ApplicationCommandOptionData[];
  execute: (ctx: CommandContext) => Promise<any>;
}

export interface GuildSettings {
  id: string;
  prefix: string;
  mod_log_channel?: string | null;
  server_log_channel?: string | null;
  security_log_channel?: string | null;
  member_log_channel?: string | null;
  voice_log_channel?: string | null;
  automod_log_channel?: string | null;
  ticket_log_channel?: string | null;
  welcome_channel?: string | null;
  welcome_message?: string | null;
  welcome_enabled: number;
  goodbye_channel?: string | null;
  goodbye_message?: string | null;
  goodbye_enabled: number;
  autorole_id?: string | null;
  verify_channel?: string | null;
  verify_role_id?: string | null;
  mute_role_id?: string | null;
  antinuke_enabled: number;
  antinuke_action: string;
  antinuke_threshold: number;
  antiraid_enabled: number;
  antiraid_threshold: number;
  automod_enabled: number;
  automod_links: number;
  automod_invites: number;
  automod_caps: number;
  automod_badwords: number;
  automod_badwords_list: string;
  automod_spam: number;
  leveling_enabled: number;
  economy_enabled: number;
  created_at?: number;
}
