import { Message } from 'discord.js';
import { HeliumClient } from '../core/client.js';
import { CommandRegistry } from '../core/registry.js';
import { AutoModService } from '../services/automod.service.js';
import { LevelingService } from '../services/leveling.service.js';
import { db } from '../config/database.js';
import { CONFIG } from '../config/config.js';

import { DeveloperService } from '../services/developer.service.js';
import { HeliumEmbed } from '../core/embed.js';

export async function handleMessageCreate(message: Message, client: HeliumClient) {
  if (message.author.bot || !message.guild) return;

  // 1. AutoMod message safety inspection
  const modResult = await AutoModService.checkMessage(message);
  if (modResult.violated) return;

  // 2. XP & Leveling progression
  LevelingService.handleMessageXP(message);

  // 3. Determine Guild Prefix
  const config = db.prepare('SELECT prefix FROM guilds WHERE id = ?').get(message.guild.id) as any;
  const prefix = config?.prefix || CONFIG.PREFIX;

  // 4. Execute Prefix Command
  if (message.content.startsWith(prefix)) {
    if (DeveloperService.isMaintenanceMode() && !DeveloperService.isDeveloper(message.author.id)) {
      message.reply({
        embeds: [
          HeliumEmbed.warning(
            'Maintenance Mode Active',
            'Helium is currently under maintenance. Only authorized developers can execute commands at this time.'
          ),
        ],
      }).catch(() => {});
      return;
    }

    await CommandRegistry.handleMessage(message, client, prefix);
  }
}
