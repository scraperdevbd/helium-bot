import {
  AuditLogEvent,
  DMChannel,
  GuildBan,
  GuildChannel,
  Message,
  NonThreadGuildBasedChannel,
  Role,
} from 'discord.js';
import { LoggingService } from '../services/logging.service.js';
import { SecurityService } from '../services/security.service.js';

export async function handleMessageDelete(message: Message) {
  await LoggingService.logMessageDelete(message);
}

export async function handleMessageUpdate(oldMsg: Message, newMsg: Message) {
  await LoggingService.logMessageUpdate(oldMsg, newMsg);
}

export async function handleChannelDelete(channel: DMChannel | NonThreadGuildBasedChannel) {
  if (!('guild' in channel)) return;
  const guild = channel.guild;

  // Audit log check for actor with retry loop to catch asynchronous audit log write
  let entry = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.ChannelDelete, limit: 6 }).catch(() => null);
    if (logs) {
      entry = logs.entries.find(e => e.targetId === channel.id && Date.now() - e.createdTimestamp < 20000);
      if (entry) break;
    }
    await new Promise(resolve => setTimeout(resolve, 400));
  }

  // Fallback: If targetId was not matched, take newest entry if created within 5 seconds
  if (!entry) {
    const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.ChannelDelete, limit: 1 }).catch(() => null);
    const newest = logs?.entries.first();
    if (newest && Date.now() - newest.createdTimestamp < 5000) {
      entry = newest;
    }
  }

  if (entry && entry.executor) {
    await SecurityService.handleSecurityTrigger(
      guild,
      entry.executor,
      'CHANNEL_DELETE',
      `Deleted channel #${channel.name} (${channel.id})`
    );
  }

  await LoggingService.logChannelUpdate(guild, 'Channel Deleted', `Channel \`#${channel.name}\` was removed.`);
}

export async function handleRoleDelete(role: Role) {
  const guild = role.guild;
  let entry = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.RoleDelete, limit: 6 }).catch(() => null);
    if (logs) {
      entry = logs.entries.find(e => e.targetId === role.id && Date.now() - e.createdTimestamp < 20000);
      if (entry) break;
    }
    await new Promise(resolve => setTimeout(resolve, 400));
  }

  if (!entry) {
    const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.RoleDelete, limit: 1 }).catch(() => null);
    const newest = logs?.entries.first();
    if (newest && Date.now() - newest.createdTimestamp < 5000) {
      entry = newest;
    }
  }

  if (entry && entry.executor) {
    await SecurityService.handleSecurityTrigger(
      guild,
      entry.executor,
      'ROLE_DELETE',
      `Deleted role @${role.name} (${role.id})`
    );
  }

  await LoggingService.logRoleUpdate(guild, 'Role Deleted', `Role \`@${role.name}\` was deleted.`);
}

export async function handleGuildBanAdd(ban: GuildBan) {
  const guild = ban.guild;
  const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanAdd, limit: 1 }).catch(() => null);
  const entry = logs?.entries.first();

  if (entry && entry.executor) {
    await SecurityService.handleSecurityTrigger(
      guild,
      entry.executor,
      'BAN_ADD',
      `Banned member <@${ban.user.id}> (${ban.user.id})`
    );
  }
}
