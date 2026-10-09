import { GuildMember } from 'discord.js';
import { SecurityService } from '../services/security.service.js';
import { WelcomeService } from '../services/welcome.service.js';
import { LoggingService } from '../services/logging.service.js';

export async function handleGuildMemberAdd(member: GuildMember) {
  const accountAgeDays = (Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24);

  // 1. Anti-Raid velocity evaluation
  const raid = SecurityService.handleJoinVelocity(member.guild, member);
  if (raid.raidTriggered) {
    if (accountAgeDays < 1 && member.kickable) {
      member.kick('Helium Anti-Raid: Suspicious fresh account during raid spike').catch(() => null);
      return;
    }
  }

  // 2. Welcome greetings & Autoroles
  await WelcomeService.handleMemberJoin(member);

  // 3. Member logging
  await LoggingService.logMemberJoin(member.guild, member.id, accountAgeDays);
}
