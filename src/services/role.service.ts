import {
  ActionRowBuilder,
  Guild,
  GuildMember,
  PermissionsBitField,
  Role,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextChannel,
} from 'discord.js';
import { db } from '../config/database.js';
import { HeliumEmbed } from '../core/embed.js';

export class RoleService {
  /**
   * Create a full snapshot backup of guild roles
   */
  static backupRoles(guild: Guild, creatorId: string): string {
    const backupId = `ROLE-${Date.now().toString(36).toUpperCase()}`;
    const rolesData = guild.roles.cache.map(r => ({
      name: r.name,
      color: r.color,
      hoist: r.hoist,
      position: r.position,
      permissions: r.permissions.bitfield.toString(),
      mentionable: r.mentionable,
    }));

    db.prepare(`
      INSERT INTO role_backups (id, guild_id, data, created_by, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(backupId, guild.id, JSON.stringify(rolesData), creatorId, Date.now());

    return backupId;
  }

  /**
   * Restore roles from snapshot backup
   */
  static async restoreRoles(guild: Guild, backupId: string): Promise<number> {
    const backup = db.prepare('SELECT data FROM role_backups WHERE id = ? AND guild_id = ?').get(backupId, guild.id) as any;
    if (!backup) throw new Error('Role backup ID not found.');

    const rolesData = JSON.parse(backup.data) as any[];
    let restoredCount = 0;

    for (const r of rolesData) {
      if (r.name === '@everyone') continue;
      const exists = guild.roles.cache.find(existing => existing.name === r.name);
      if (!exists) {
        try {
          await guild.roles.create({
            name: r.name,
            color: r.color,
            hoist: r.hoist,
            permissions: BigInt(r.permissions),
            mentionable: r.mentionable,
            reason: `[Helium Role Restore] Backup ${backupId}`,
          });
          restoredCount++;
        } catch {}
      }
    }
    return restoredCount;
  }

  /**
   * Deploy interactive role selection menu
   */
  static async sendRoleMenu(channel: TextChannel, title: string, roles: Role[]) {
    const embed = HeliumEmbed.info(
      title || 'Role Selection',
      'Select a role from the dropdown menu below to assign or remove it from your profile.'
    );

    const select = new StringSelectMenuBuilder()
      .setCustomId('helium_role_menu_select')
      .setPlaceholder('Choose a role to toggle...')
      .addOptions(
        roles.slice(0, 25).map(r =>
          new StringSelectMenuOptionBuilder()
            .setLabel(r.name)
            .setValue(r.id)
            .setDescription(`Toggle ${r.name} role`)
        )
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
    return channel.send({ embeds: [embed], components: [row] });
  }

  /**
   * Add temporary role to user
   */
  static async addTempRole(member: GuildMember, role: Role, durationSeconds: number) {
    await member.roles.add(role, `Temporary role for ${durationSeconds}s`);
    const expiresAt = Date.now() + durationSeconds * 1000;

    db.prepare(`
      INSERT INTO temp_roles (guild_id, user_id, role_id, expires_at)
      VALUES (?, ?, ?, ?)
    `).run(member.guild.id, member.id, role.id, expiresAt);
  }

  /**
   * Background checker for expired temp roles
   */
  static async checkExpiredTempRoles(clientGuilds: any) {
    const now = Date.now();
    const expired = db.prepare('SELECT * FROM temp_roles WHERE expires_at <= ?').all(now) as any[];

    for (const item of expired) {
      try {
        const guild = clientGuilds.cache.get(item.guild_id);
        if (guild) {
          const member = await guild.members.fetch(item.user_id).catch(() => null);
          if (member) {
            await member.roles.remove(item.role_id, 'Temporary role expired');
          }
        }
      } catch {}
      db.prepare('DELETE FROM temp_roles WHERE id = ?').run(item.id);
    }
  }
}
