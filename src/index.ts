import dotenv from 'dotenv';
dotenv.config();

import { HeliumClient } from './core/client.js';
import { CommandRegistry } from './core/registry.js';
import { allCommands } from './commands/index.js';
import { handleReady } from './events/ready.js';
import { handleInteractionCreate } from './events/interactionCreate.js';
import { handleMessageCreate } from './events/messageCreate.js';
import { handleGuildMemberAdd } from './events/guildMemberAdd.js';
import { handleGuildMemberRemove } from './events/guildMemberRemove.js';
import {
  handleChannelDelete,
  handleGuildBanAdd,
  handleMessageDelete,
  handleMessageUpdate,
  handleRoleDelete,
} from './events/guildAuditEvents.js';
import { Logger } from './core/logger.js';
import { CONFIG } from './config/config.js';
import { DashboardServer } from './dashboard/server.js';
import { SecurityService } from './services/security.service.js';

// Global error handlers
process.on('unhandledRejection', (reason, promise) => {
  Logger.error('Unhandled Promise Rejection:', reason, 'Process');
});

process.on('uncaughtException', (err) => {
  Logger.error('Uncaught Exception:', err, 'Process');
});

async function main() {
  Logger.info(`Starting Helium AIO Discord Bot...`, 'Bootstrap');
  Logger.info(`Developer / Author: ${CONFIG.AUTHOR}`, 'Bootstrap');
  Logger.info(`Theme: Red Palette | Prefix: ${CONFIG.PREFIX}`, 'Bootstrap');

  // Register all commands and aliases
  CommandRegistry.registerAll(allCommands);
  Logger.info(
    `Command Registry Loaded: ${CommandRegistry.getAll().length} canonical commands | ${CommandRegistry.getAliasCount()} aliases | Total: ${CommandRegistry.getTotalCount()}`,
    'Bootstrap'
  );

  const client = new HeliumClient();

  // Attach event handlers
  client.on('ready', () => handleReady(client));
  client.on('interactionCreate', (interaction) => handleInteractionCreate(interaction, client));
  client.on('messageCreate', (message) => handleMessageCreate(message, client));
  client.on('guildMemberAdd', (member) => handleGuildMemberAdd(member));
  client.on('guildMemberRemove', (member) => handleGuildMemberRemove(member as any));
  client.on('messageDelete', (message) => handleMessageDelete(message as any));
  client.on('messageUpdate', (oldMsg, newMsg) => handleMessageUpdate(oldMsg as any, newMsg as any));
  client.on('channelDelete', (channel) => handleChannelDelete(channel));
  client.on('roleDelete', (role) => handleRoleDelete(role));
  client.on('guildBanAdd', (ban) => handleGuildBanAdd(ban));
  client.on('guildMemberUpdate', (_oldMember, newMember) => {
    if (newMember.id === client.user?.id) {
      SecurityService.checkAndEnforceTopRole(newMember.guild).catch(() => {});
    }
  });

  // Start Web Admin Dashboard Server
  DashboardServer.start(client);

  await client.start();
}

main().catch((err) => {
  Logger.error('Fatal startup failure:', err, 'Bootstrap');
});
