import { Client, ClientOptions, Collection, GatewayIntentBits, Partials } from 'discord.js';
import { CONFIG } from '../config/config.js';
import { HeliumCommand } from './types.js';
import { initDatabase } from '../config/database.js';
import { RoleService } from '../services/role.service.js';
import { ReminderService } from '../services/reminder.service.js';
import { Logger } from './logger.js';

export class HeliumClient extends Client {
  public commands: Collection<string, HeliumCommand> = new Collection();
  public aliases: Collection<string, string> = new Collection();

  constructor(options?: Partial<ClientOptions>) {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.AutoModerationConfiguration,
        GatewayIntentBits.AutoModerationExecution,
      ],
      partials: [
        Partials.Message,
        Partials.Channel,
        Partials.Reaction,
        Partials.GuildMember,
        Partials.User,
      ],
      ...options,
    });
  }

  public async start() {
    Logger.info('Initializing Helium database...', 'Startup');
    initDatabase();

    // Start background background jobs (15s interval)
    setInterval(() => {
      try {
        RoleService.checkExpiredTempRoles(this.guilds);
        ReminderService.checkReminders(this);
      } catch (err) {
        Logger.error('Background worker error:', err);
      }
    }, 15000);

    if (CONFIG.TOKEN) {
      await this.login(CONFIG.TOKEN);
    } else {
      Logger.warn('No DISCORD_TOKEN specified in environment. Running in offline/verification mode.', 'Config');
    }
  }
}
