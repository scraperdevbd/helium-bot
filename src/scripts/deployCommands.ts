import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
dotenv.config();

import { CONFIG } from '../config/config.js';
import { CommandRegistry } from '../core/registry.js';
import { allCommands } from '../commands/index.js';
import { Logger } from '../core/logger.js';

async function deploy() {
  CommandRegistry.registerAll(allCommands);
  const slashData = CommandRegistry.toSlashData();

  if (!CONFIG.TOKEN || !CONFIG.CLIENT_ID) {
    Logger.error('DISCORD_TOKEN and CLIENT_ID are required in environment variables.', null, 'Deploy');
    process.exit(1);
  }

  const rest = new REST({ version: '10' }).setToken(CONFIG.TOKEN);

  try {
    Logger.info(`Author: ${CONFIG.AUTHOR}`, 'Deploy');
    Logger.info(`Syncing ${slashData.length} slash commands globally...`, 'Deploy');
    await rest.put(Routes.applicationCommands(CONFIG.CLIENT_ID), { body: slashData });
    Logger.success(`Successfully deployed ${slashData.length} slash commands!`, 'Deploy');
  } catch (err) {
    Logger.error('Failed to deploy slash commands:', err, 'Deploy');
    process.exit(1);
  }
}

deploy();
