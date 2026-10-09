import { HeliumCommand } from '../core/types.js';
import { moderationCommands } from './moderation.commands.js';
import { securityCommands } from './security.commands.js';
import { automodCommands } from './automod.commands.js';
import { loggingCommands } from './logging.commands.js';
import { ticketCommands } from './tickets.commands.js';
import { roleCommands } from './roles.commands.js';
import { welcomeCommands } from './welcome.commands.js';
import { levelingCommands } from './leveling.commands.js';
import { economyCommands } from './economy.commands.js';
import { giveawayCommands } from './giveaways.commands.js';
import { musicCommands } from './music.commands.js';
import { utilityCommands } from './utility.commands.js';
import { infoCommands } from './info.commands.js';
import { automationCommands } from './automation.commands.js';
import { ownerCommands } from './owner.commands.js';
import { dashboardCommands } from './dashboard.commands.js';

export const allCommands: HeliumCommand[] = [
  ...moderationCommands,
  ...securityCommands,
  ...automodCommands,
  ...loggingCommands,
  ...ticketCommands,
  ...roleCommands,
  ...welcomeCommands,
  ...levelingCommands,
  ...economyCommands,
  ...giveawayCommands,
  ...musicCommands,
  ...utilityCommands,
  ...infoCommands,
  ...automationCommands,
  ...ownerCommands,
  ...dashboardCommands,
];
