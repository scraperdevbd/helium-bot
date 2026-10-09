import { ApplicationCommandOptionType, PermissionsBitField, Role, TextChannel } from 'discord.js';
import { HeliumCommand } from '../core/types.js';
import { RoleService } from '../services/role.service.js';
import { db } from '../config/database.js';

export const roleCommands: HeliumCommand[] = [
  {
    name: 'role',
    description: 'Inspect details and permissions of a role',
    category: 'Roles',
    aliases: ['r', 'inspectrole', 'aboutrole'],
    slashOptions: [
      { name: 'role', description: 'Role to inspect', type: ApplicationCommandOptionType.Role, required: true },
    ],
    execute: async (ctx) => {
      const role = (ctx.interaction ? ctx.interaction.options.getRole('role', true) : ctx.message?.mentions.roles.first()) as Role;
      if (!role) return ctx.replyError('Missing Role', 'Please specify a target role.');

      return ctx.replyInfo(
        `Role: @${role.name}`,
        `**ID:** \`${role.id}\`\n` +
        `**Color:** \`#${role.color.toString(16).padStart(6, '0')}\`\n` +
        `**Position:** \`${role.position}\`\n` +
        `**Hoisted:** \`${role.hoist ? 'Yes' : 'No'}\`\n` +
        `**Mentionable:** \`${role.mentionable ? 'Yes' : 'No'}\`\n` +
        `**Members Count:** \`${role.members.size}\`\n` +
        `**Created:** <t:${Math.floor(role.createdTimestamp / 1000)}:R>`
      );
    },
  },
  {
    name: 'role-add',
    description: 'Assign a role to a member',
    category: 'Roles',
    aliases: ['addrole', 'giverole', 'radd'],
    permissions: [PermissionsBitField.Flags.ManageRoles],
    botPermissions: [PermissionsBitField.Flags.ManageRoles],
    slashOptions: [
      { name: 'user', description: 'Member to receive role', type: ApplicationCommandOptionType.User, required: true },
      { name: 'role', description: 'Role to give', type: ApplicationCommandOptionType.Role, required: true },
    ],
    execute: async (ctx) => {
      const user = ctx.interaction ? ctx.interaction.options.getUser('user', true) : ctx.message?.mentions.users.first();
      const role = (ctx.interaction ? ctx.interaction.options.getRole('role', true) : ctx.message?.mentions.roles.first()) as Role;

      if (!user || !role) return ctx.replyError('Missing Arguments', 'Usage: `&role-add @user @role`');
      const member = await ctx.guild?.members.fetch(user.id).catch(() => null);
      if (!member) return ctx.replyError('Member Not Found', 'Target user is not in this server.');

      if (role.position >= ctx.guild!.members.me!.roles.highest.position) {
        return ctx.replyError('Hierarchy Error', 'Cannot manage a role equal to or higher than Helium.');
      }

      await member.roles.add(role, `Assigned by ${ctx.user.tag}`);
      return ctx.replySuccess('Role Assigned', `Added <@&${role.id}> to <@${user.id}>.`);
    },
  },
  {
    name: 'role-remove',
    description: 'Remove a role from a member',
    category: 'Roles',
    aliases: ['removerole', 'takerole', 'rdel'],
    permissions: [PermissionsBitField.Flags.ManageRoles],
    botPermissions: [PermissionsBitField.Flags.ManageRoles],
    slashOptions: [
      { name: 'user', description: 'Member to strip role from', type: ApplicationCommandOptionType.User, required: true },
      { name: 'role', description: 'Role to remove', type: ApplicationCommandOptionType.Role, required: true },
    ],
    execute: async (ctx) => {
      const user = ctx.interaction ? ctx.interaction.options.getUser('user', true) : ctx.message?.mentions.users.first();
      const role = (ctx.interaction ? ctx.interaction.options.getRole('role', true) : ctx.message?.mentions.roles.first()) as Role;

      if (!user || !role) return ctx.replyError('Missing Arguments', 'Usage: `&role-remove @user @role`');
      const member = await ctx.guild?.members.fetch(user.id).catch(() => null);
      if (!member) return ctx.replyError('Member Not Found', 'Target user is not in this server.');

      await member.roles.remove(role, `Removed by ${ctx.user.tag}`);
      return ctx.replySuccess('Role Removed', `Removed <@&${role.id}> from <@${user.id}>.`);
    },
  },
  {
    name: 'role-temp',
    description: 'Assign a role for a limited time duration',
    category: 'Roles',
    aliases: ['temprole', 'timedrole', 'rtemp'],
    permissions: [PermissionsBitField.Flags.ManageRoles],
    botPermissions: [PermissionsBitField.Flags.ManageRoles],
    slashOptions: [
      { name: 'user', description: 'Member to receive temp role', type: ApplicationCommandOptionType.User, required: true },
      { name: 'role', description: 'Role to assign', type: ApplicationCommandOptionType.Role, required: true },
      { name: 'minutes', description: 'Duration in minutes', type: ApplicationCommandOptionType.Integer, required: true },
    ],
    execute: async (ctx) => {
      const user = ctx.interaction ? ctx.interaction.options.getUser('user', true) : ctx.message?.mentions.users.first();
      const role = (ctx.interaction ? ctx.interaction.options.getRole('role', true) : ctx.message?.mentions.roles.first()) as Role;
      const minutes = ctx.interaction ? ctx.interaction.options.getInteger('minutes', true) : parseInt(ctx.args[2] || '60');

      if (!user || !role || isNaN(minutes) || minutes <= 0) {
        return ctx.replyError('Invalid Arguments', 'Usage: `&role-temp @user @role <minutes>`');
      }

      const member = await ctx.guild?.members.fetch(user.id).catch(() => null);
      if (!member) return ctx.replyError('Member Not Found', 'Target user is not in this server.');

      await RoleService.addTempRole(member, role, minutes * 60);
      return ctx.replySuccess('Temporary Role Assigned', `<@${user.id}> received <@&${role.id}> for **${minutes}m**.`);
    },
  },
  {
    name: 'role-menu',
    description: 'Create an interactive dropdown menu for self-assignable roles',
    category: 'Roles',
    aliases: ['reactionroles', 'selfroles', 'selectroles'],
    permissions: [PermissionsBitField.Flags.ManageRoles],
    slashOptions: [
      { name: 'title', description: 'Menu title', type: ApplicationCommandOptionType.String, required: true },
    ],
    execute: async (ctx) => {
      const title = (ctx.interaction ? ctx.interaction.options.getString('title', true) : ctx.args.join(' ')) || 'Self Roles Menu';
      const availableRoles = ctx.guild!.roles.cache.filter(r => !r.managed && r.name !== '@everyone').first(5);

      if (availableRoles.length === 0) return ctx.replyError('No Roles', 'No valid roles available to add to menu.');

      await RoleService.sendRoleMenu(ctx.channel as TextChannel, title, availableRoles);
      return ctx.replySuccess('Role Menu Deployed', `Interactive menu posted in <#${ctx.channel!.id}>.`);
    },
  },
  {
    name: 'role-backup',
    description: 'Take an instant backup snapshot of all server roles',
    category: 'Roles',
    aliases: ['backuproles', 'saveroles', 'snapshotroles'],
    permissions: [PermissionsBitField.Flags.Administrator],
    execute: async (ctx) => {
      const backupId = RoleService.backupRoles(ctx.guild!, ctx.user.id);
      return ctx.replySuccess('Roles Backed Up', `Role hierarchy saved to snapshot.\n**Backup ID:** \`${backupId}\``);
    },
  },
  {
    name: 'role-restore',
    description: 'Restore missing roles from a previous backup snapshot',
    category: 'Roles',
    aliases: ['restoreroles', 'loadroles', 'applyroles'],
    permissions: [PermissionsBitField.Flags.Administrator],
    slashOptions: [
      { name: 'id', description: 'Backup ID', type: ApplicationCommandOptionType.String, required: true },
    ],
    execute: async (ctx) => {
      const backupId = ctx.interaction ? ctx.interaction.options.getString('id', true) : ctx.args[0];
      if (!backupId) return ctx.replyError('Missing ID', 'Usage: `&role-restore <backupId>`');

      try {
        const restored = await RoleService.restoreRoles(ctx.guild!, backupId);
        return ctx.replySuccess('Roles Restored', `Restored **${restored}** roles from backup snapshot \`${backupId}\`.`);
      } catch (err: any) {
        return ctx.replyError('Restore Failed', err.message);
      }
    },
  },
  {
    name: 'autorole',
    description: 'Configure default role automatically granted to new members',
    category: 'Roles',
    aliases: ['joinrole', 'welcomerole', 'defaultrole'],
    permissions: [PermissionsBitField.Flags.ManageRoles],
    slashOptions: [
      { name: 'role', description: 'Role to give on join (or blank to disable)', type: ApplicationCommandOptionType.Role, required: false },
    ],
    execute: async (ctx) => {
      const role = (ctx.interaction ? ctx.interaction.options.getRole('role') : ctx.message?.mentions.roles.first()) as Role | undefined;

      if (!role) {
        db.prepare('UPDATE guilds SET autorole_id = NULL WHERE id = ?').run(ctx.guild!.id);
        return ctx.replySuccess('Autorole Disabled', 'New joins will not receive any automated role.');
      }

      db.prepare('UPDATE guilds SET autorole_id = ? WHERE id = ?').run(role.id, ctx.guild!.id);
      return ctx.replySuccess('Autorole Configured', `New members will automatically receive <@&${role.id}> on join.`);
    },
  },
  {
    name: 'role-all',
    description: 'Assign a role to all human members in the server',
    category: 'Roles',
    aliases: ['giveroleall', 'massaddrole', 'roleeveryone'],
    permissions: [PermissionsBitField.Flags.Administrator],
    botPermissions: [PermissionsBitField.Flags.ManageRoles],
    slashOptions: [
      { name: 'role', description: 'Role to distribute to everyone', type: ApplicationCommandOptionType.Role, required: true },
    ],
    execute: async (ctx) => {
      const role = (ctx.interaction ? ctx.interaction.options.getRole('role', true) : ctx.message?.mentions.roles.first()) as Role;
      if (!role) return ctx.replyError('Missing Role', 'Please specify a target role.');

      let granted = 0;
      for (const [, member] of ctx.guild!.members.cache) {
        if (!member.user.bot && !member.roles.cache.has(role.id)) {
          member.roles.add(role, `Mass role by ${ctx.user.tag}`).catch(() => null);
          granted++;
        }
      }

      return ctx.replySuccess('Mass Role In Progress', `Assigning <@&${role.id}> to **${granted}** human members.`);
    },
  },
  {
    name: 'role-persist',
    description: 'Check sticky/persistent role status',
    category: 'Roles',
    aliases: ['stickyroles', 'retainroles', 'saveroleonleave'],
    permissions: [PermissionsBitField.Flags.ManageRoles],
    execute: async (ctx) => {
      return ctx.replyInfo('Role Persistence', 'Helium automatically tracks previously assigned roles to restore upon member re-join.');
    },
  },
];
