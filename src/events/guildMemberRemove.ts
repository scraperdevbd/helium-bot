import { GuildMember } from 'discord.js';
import { WelcomeService } from '../services/welcome.service.js';
import { LoggingService } from '../services/logging.service.js';

export async function handleGuildMemberRemove(member: GuildMember) {
  await WelcomeService.handleMemberLeave(member);
  await LoggingService.logMemberLeave(member.guild, member.id, member.user.tag);
}
