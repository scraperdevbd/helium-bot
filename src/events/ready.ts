import { ActivityType, REST, Routes } from 'discord.js';
import { HeliumClient } from '../core/client.js';
import { CONFIG } from '../config/config.js';
import { CommandRegistry } from '../core/registry.js';
import { Logger } from '../core/logger.js';
import { SecurityService } from '../services/security.service.js';

export function handleReady(client: HeliumClient) {
  Logger.info(`Logged in as ${client.user?.tag}!`, 'Ready');
  Logger.info(`Author: ${CONFIG.AUTHOR} (GitHub: ${CONFIG.AUTHOR_GITHUB})`, 'Identity');
  Logger.info(`Theme: Red / Crimson Palette | Emojis: Strict Custom Approved`, 'Theme');
  Logger.info(`Loaded ${CommandRegistry.getAll().length} canonical commands & ${CommandRegistry.getAliasCount()} aliases`, 'Commands');

  client.user?.setPresence({
    status: 'online',
    activities: [
      {
        name: `&help | Dev: ${CONFIG.AUTHOR}`,
        type: ActivityType.Watching,
      },
    ],
  });

  // Automatically register and deploy slash commands immediately to all connected guilds
  if (CONFIG.TOKEN && CONFIG.CLIENT_ID) {
    const rest = new REST({ version: '10' }).setToken(CONFIG.TOKEN);
    const slashData = CommandRegistry.toSlashData(100);

    // Clear global commands so Discord will never display duplicate entries
    rest.put(Routes.applicationCommands(CONFIG.CLIENT_ID), { body: [] }).catch(() => {});

    Logger.info(`Auto-registering ${slashData.length} slash commands to all connected guilds...`, 'Deploy');
    for (const guild of client.guilds.cache.values()) {
      rest.put(Routes.applicationGuildCommands(CONFIG.CLIENT_ID, guild.id), { body: slashData })
        .then(() => Logger.info(`Instantly registered ${slashData.length} slash commands to guild: ${guild.name} (${guild.id})`, 'Deploy'))
        .catch(err => Logger.warn(`Guild deploy note for ${guild.name}: ${err.message}`, 'Deploy'));
    }
  }

  // 1-minute Anti-Nuke Top Role Monitor
  setInterval(() => {
    for (const guild of client.guilds.cache.values()) {
      SecurityService.checkAndEnforceTopRole(guild).catch(() => {});
    }
  }, 60000);
}
