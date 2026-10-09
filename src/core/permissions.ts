import { GuildMember, PermissionResolvable, PermissionsBitField } from 'discord.js';
import { db } from '../config/database.js';

export class PermissionEngine {
  /**
   * Check if a member has required permissions
   */
  static hasPermissions(member: GuildMember, permissions: bigint[]): boolean {
    if (member.id === member.guild.ownerId) return true;
    if (member.permissions.has(PermissionsBitField.Flags.Administrator)) return true;
    return permissions.every(perm => member.permissions.has(perm));
  }

  /**
   * Check if the bot has required permissions in the guild
   */
  static botHasPermissions(guildMemberMe: GuildMember, permissions: bigint[]): boolean {
    if (guildMemberMe.permissions.has(PermissionsBitField.Flags.Administrator)) return true;
    return permissions.every(perm => guildMemberMe.permissions.has(perm));
  }

  /**
   * Check if an actor can moderate a target member respecting role hierarchy
   */
  static canModerate(actor: GuildMember, target: GuildMember): { allowed: boolean; reason?: string } {
    if (target.id === actor.guild.ownerId) {
      return { allowed: false, reason: 'Cannot moderate the Server Owner.' };
    }
    if (target.id === actor.id) {
      return { allowed: false, reason: 'You cannot perform moderation actions on yourself.' };
    }
    if (target.id === actor.client.user?.id) {
      return { allowed: false, reason: 'Cannot moderate the bot itself.' };
    }

    const botMember = actor.guild.members.me;
    if (botMember && target.roles.highest.position >= botMember.roles.highest.position) {
      return { allowed: false, reason: 'Target has a role higher than or equal to Helium.' };
    }

    if (actor.id !== actor.guild.ownerId && target.roles.highest.position >= actor.roles.highest.position) {
      return { allowed: false, reason: 'Target has a role higher than or equal to yours.' };
    }

    // Check if target is marked as protected in the database
    const isProtected = db.prepare(
      'SELECT id FROM protected_entities WHERE guild_id = ? AND entity_id = ?'
    ).get(actor.guild.id, target.id);

    if (isProtected) {
      return { allowed: false, reason: 'Target is a protected entity in Helium Anti-Nuke.' };
    }

    return { allowed: true };
  }

  /**
   * Check if an entity is trusted in the guild
   */
  static isTrusted(guildId: string, entityId: string): boolean {
    const row = db.prepare(
      'SELECT id FROM trusted_entities WHERE guild_id = ? AND entity_id = ?'
    ).get(guildId, entityId);
    return !!row;
  }
}
