import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Guild,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';
import { DashboardSession } from './session.js';
import { CONFIG } from '../config/config.js';
import { db } from '../config/database.js';
import { CommandRegistry } from '../core/registry.js';
import { HeliumClient } from '../core/client.js';

export class DashboardRenderer {
  /**
   * Render the complete embed and components for a dashboard session page
   */
  static render(session: DashboardSession, client: HeliumClient, guild?: Guild | null) {
    let embed: EmbedBuilder;
    const actionRows: ActionRowBuilder<any>[] = [];

    switch (session.currentPage) {
      case 'security':
        embed = this.renderSecurityPage(session, guild);
        break;
      case 'automod':
        embed = this.renderAutoModPage(session, guild);
        break;
      case 'moderation':
        embed = this.renderModerationPage(session, guild);
        break;
      case 'logs':
        embed = this.renderLogsPage(session, guild);
        break;
      case 'features':
        embed = this.renderFeaturesPage(session, guild);
        break;
      case 'database':
        embed = this.renderDatabasePage(session);
        break;
      case 'overview':
      default:
        embed = this.renderOverviewPage(session, client, guild);
        break;
    }

    // 1. Navigation Select Menu
    const navSelect = new StringSelectMenuBuilder()
      .setCustomId(`dash_nav_${session.id}`)
      .setPlaceholder('Navigate dashboard modules...')
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel('Overview / System Health')
          .setValue('overview')
          .setDescription('Bot status, metrics, and global metrics')
          .setDefault(session.currentPage === 'overview'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Anti-Nuke & Defense Suite')
          .setValue('security')
          .setDescription('Sliding-window threat engine and containment')
          .setDefault(session.currentPage === 'security'),
        new StringSelectMenuOptionBuilder()
          .setLabel('AutoMod Engine & Filters')
          .setValue('automod')
          .setDescription('Native Discord AutoMod and custom filters')
          .setDefault(session.currentPage === 'automod'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Moderation Management')
          .setValue('moderation')
          .setDescription('Cases, punishments, and staff logs')
          .setDefault(session.currentPage === 'moderation'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Audit Logging Channels')
          .setValue('logs')
          .setDescription('Channel routing for all 7 audit categories')
          .setDefault(session.currentPage === 'logs'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Feature Suite Status')
          .setValue('features')
          .setDescription('Tickets, economy, leveling, verification')
          .setDefault(session.currentPage === 'features'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Database & Backups')
          .setValue('database')
          .setDescription('SQLite storage health and snapshot backups')
          .setDefault(session.currentPage === 'database')
      );

    actionRows.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(navSelect));

    // 2. Context Action Buttons Row
    const actionRow = new ActionRowBuilder<ButtonBuilder>();

    // Page-specific action buttons
    if (session.currentPage === 'security' && guild) {
      actionRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`dash_btn_lock_${session.id}`)
          .setLabel('Emergency Lockdown')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`dash_btn_unlock_${session.id}`)
          .setLabel('Lift Lockdown')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`dash_btn_panic_${session.id}`)
          .setLabel('Panic Mode')
          .setStyle(ButtonStyle.Danger)
      );
    } else if (session.currentPage === 'database') {
      actionRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`dash_btn_backup_${session.id}`)
          .setLabel('Create Instant Backup')
          .setStyle(ButtonStyle.Danger)
      );
    }

    // Universal controls (Refresh, Web Link, Close)
    actionRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`dash_btn_refresh_${session.id}`)
        .setLabel('Refresh')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setLabel('Open Web Dashboard')
        .setStyle(ButtonStyle.Link)
        .setURL(`${CONFIG.DASHBOARD_URL}/?token=${session.webToken}`),
      new ButtonBuilder()
        .setCustomId(`dash_btn_close_${session.id}`)
        .setLabel('Close')
        .setStyle(ButtonStyle.Secondary)
    );

    actionRows.push(actionRow);

    return { embeds: [embed], components: actionRows };
  }

  private static renderOverviewPage(session: DashboardSession, client: HeliumClient, guild?: Guild | null): EmbedBuilder {
    const uptime = Math.floor(process.uptime());
    const hours = Math.floor(uptime / 3600);
    const mins = Math.floor((uptime % 3600) / 60);
    const secs = uptime % 60;
    const mem = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);

    const guildConf = guild ? db.prepare('SELECT * FROM guilds WHERE id = ?').get(guild.id) as any : null;
    const recentSec = guild ? (db.prepare('SELECT COUNT(*) as c FROM security_events WHERE guild_id = ?').get(guild.id) as any)?.c || 0 : 0;

    return new EmbedBuilder()
      .setColor(CONFIG.COLORS.PRIMARY)
      .setTitle(`${CONFIG.EMOJIS.SETTINGS} Helium Admin Dashboard — System Overview`)
      .setDescription(
        `Authorized Session: <@${session.userId}> (\`${session.userId}\`)\n` +
        `Web Access: [Launch Web Dashboard](${CONFIG.DASHBOARD_URL}/?token=${session.webToken})\n\n` +
        `**System Diagnostics:**\n` +
        `• **Engine Status:** \`ONLINE - OPTIMAL\`\n` +
        `• **Gateway Ping:** \`${client.ws.ping}ms\`\n` +
        `• **Continuous Uptime:** \`${hours}h ${mins}m ${secs}s\`\n` +
        `• **Memory Usage:** \`${mem} MB\`\n` +
        `• **Database Health:** \`CONNECTED (SQLite WAL Mode)\`\n\n` +
        `**Command Surface:**\n` +
        `• **Slash Commands:** \`${CommandRegistry.getAll().length}\` registered\n` +
        `• **Prefix Aliases:** \`${CommandRegistry.getAliasCount()}\` active\n` +
        `• **Total Surface:** \`${CommandRegistry.getTotalCount()}\` commands\n\n` +
        `**Guild Fleet:**\n` +
        `• **Servers Served:** \`${client.guilds.cache.size}\`\n` +
        `• **Cached Members:** \`${client.users.cache.size}\` (In-Memory Cache)\n` +
        (guild ? `• **Current Server:** \`${guild.name}\` (Prefix: \`${guildConf?.prefix || CONFIG.PREFIX}\`)\n` : '') +
        (guild ? `• **Anti-Nuke Status:** \`${guildConf?.antinuke_enabled ? 'ARMED' : 'DISARMED'}\` (${recentSec} incidents logged)\n` : '')
      )
      .setFooter({ text: `${CONFIG.FOOTER_TEXT} • Session expires in 10m` })
      .setTimestamp();
  }

  private static renderSecurityPage(session: DashboardSession, guild?: Guild | null): EmbedBuilder {
    if (!guild) {
      return new EmbedBuilder()
        .setColor(CONFIG.COLORS.DANGER)
        .setTitle(`${CONFIG.EMOJIS.SHIELD} Security Management`)
        .setDescription('Please execute the dashboard inside a server to configure Anti-Nuke.');
    }

    const conf = db.prepare('SELECT * FROM guilds WHERE id = ?').get(guild.id) as any;
    const events = db.prepare('SELECT * FROM security_events WHERE guild_id = ? ORDER BY timestamp DESC LIMIT 5').all(guild.id) as any[];
    const trustedCount = (db.prepare('SELECT COUNT(*) as c FROM trusted_entities WHERE guild_id = ?').get(guild.id) as any)?.c || 0;
    const protectedCount = (db.prepare('SELECT COUNT(*) as c FROM protected_entities WHERE guild_id = ?').get(guild.id) as any)?.c || 0;

    return new EmbedBuilder()
      .setColor(CONFIG.COLORS.DANGER)
      .setTitle(`${CONFIG.EMOJIS.SHIELD} Anti-Nuke Defense Suite — ${guild.name}`)
      .setDescription(
        `**Protection Core:**\n` +
        `• **Anti-Nuke Status:** \`${conf?.antinuke_enabled ? 'ARMED' : 'DISARMED'}\`\n` +
        `• **Enforcement Penalty:** \`${(conf?.antinuke_action || 'ban').toUpperCase()}\`\n` +
        `• **Sliding Action Threshold:** \`${conf?.antinuke_threshold || 3} actions / 30s\`\n` +
        `• **Anti-Raid Monitor:** \`${conf?.antiraid_enabled ? 'ACTIVE' : 'OFF'}\` (${conf?.antiraid_threshold || 5} joins/10s)\n` +
        `• **Whitelisted Entities:** \`${trustedCount}\` trusted accounts\n` +
        `• **Protected Resources:** \`${protectedCount}\` channels/roles\n\n` +
        `**Recent Security Incidents:**\n` +
        (events.length > 0
          ? events.map(e => `• \`${e.event_id}\` [${e.severity}] **${e.event_type}** by <@${e.actor_id}> (Action: \`${e.action_taken}\`)`).join('\n')
          : '• `No security breaches recorded.`') +
        `\n\n*Use emergency containment controls below to lock channels or trigger panic mode.*`
      )
      .setFooter({ text: CONFIG.FOOTER_TEXT })
      .setTimestamp();
  }

  private static renderAutoModPage(session: DashboardSession, guild?: Guild | null): EmbedBuilder {
    if (!guild) {
      return new EmbedBuilder().setColor(CONFIG.COLORS.PRIMARY).setTitle('AutoMod').setDescription('Execute inside a guild.');
    }

    const conf = db.prepare('SELECT * FROM guilds WHERE id = ?').get(guild.id) as any;
    const words: string[] = JSON.parse(conf?.automod_badwords_list || '[]');

    return new EmbedBuilder()
      .setColor(CONFIG.COLORS.PRIMARY)
      .setTitle(`${CONFIG.EMOJIS.SETTINGS} AutoMod Filter Center — ${guild.name}`)
      .setDescription(
        `**Master Engine:** \`${conf?.automod_enabled ? 'ONLINE' : 'OFFLINE'}\`\n` +
        `**Violations Log Channel:** ${conf?.automod_log_channel ? `<#${conf.automod_log_channel}>` : '`Not Routed`'}\n\n` +
        `**Filter Rules Configuration:**\n` +
        `• **Discord Invite Links:** \`${conf?.automod_invites ? 'BLOCKED' : 'ALLOWED'}\`\n` +
        `• **External Web Links:** \`${conf?.automod_links ? 'BLOCKED' : 'ALLOWED'}\`\n` +
        `• **Duplicate Message Spam:** \`${conf?.automod_spam ? 'FILTERED' : 'OFF'}\`\n` +
        `• **Excessive Caps (>70%):** \`${conf?.automod_caps ? 'FILTERED' : 'OFF'}\`\n` +
        `• **Mass Mentions (>5):** \`AUTOMATIC BLOCK\`\n` +
        `• **Filtered Keywords:** \`${words.length}\` custom banned terms`
      )
      .setFooter({ text: CONFIG.FOOTER_TEXT })
      .setTimestamp();
  }

  private static renderModerationPage(session: DashboardSession, guild?: Guild | null): EmbedBuilder {
    if (!guild) {
      return new EmbedBuilder().setColor(CONFIG.COLORS.PRIMARY).setTitle('Moderation').setDescription('Execute inside a guild.');
    }

    const casesCount = (db.prepare('SELECT COUNT(*) as c FROM moderation_cases WHERE guild_id = ?').get(guild.id) as any)?.c || 0;
    const warnsCount = (db.prepare('SELECT COUNT(*) as c FROM warnings WHERE guild_id = ?').get(guild.id) as any)?.c || 0;
    const recent = db.prepare('SELECT * FROM moderation_cases WHERE guild_id = ? ORDER BY case_id DESC LIMIT 4').all(guild.id) as any[];

    return new EmbedBuilder()
      .setColor(CONFIG.COLORS.PRIMARY)
      .setTitle(`${CONFIG.EMOJIS.STAR} Moderation Center — ${guild.name}`)
      .setDescription(
        `**Server Disciplinary Metrics:**\n` +
        `• **Total Moderation Cases:** \`${casesCount}\` cases\n` +
        `• **Active Infraction Warnings:** \`${warnsCount}\` warnings\n\n` +
        `**Recent Punishment Actions:**\n` +
        (recent.length > 0
          ? recent.map(c => `• Case \`#${c.case_id}\` **${c.action}** ➔ <@${c.user_id}> (Mod: <@${c.moderator_id}>)`).join('\n')
          : '• `No moderation cases logged yet.`')
      )
      .setFooter({ text: CONFIG.FOOTER_TEXT })
      .setTimestamp();
  }

  private static renderLogsPage(session: DashboardSession, guild?: Guild | null): EmbedBuilder {
    if (!guild) {
      return new EmbedBuilder().setColor(CONFIG.COLORS.PRIMARY).setTitle('Logs').setDescription('Execute inside a guild.');
    }

    const conf = db.prepare('SELECT * FROM guilds WHERE id = ?').get(guild.id) as any;
    const fmt = (id?: string) => (id ? `<#${id}>` : '`Unassigned`');

    return new EmbedBuilder()
      .setColor(CONFIG.COLORS.PRIMARY)
      .setTitle(`${CONFIG.EMOJIS.SETTINGS} Audit Logging Routing — ${guild.name}`)
      .setDescription(
        `**Assigned Channel Destinations:**\n` +
        `• **Security Incident Alerts:** ${fmt(conf?.security_log_channel)}\n` +
        `• **Moderation Cases:** ${fmt(conf?.mod_log_channel)}\n` +
        `• **Server & Message Activity:** ${fmt(conf?.server_log_channel)}\n` +
        `• **Member Joins & Leaves:** ${fmt(conf?.member_log_channel)}\n` +
        `• **AutoMod Violations:** ${fmt(conf?.automod_log_channel)}\n` +
        `• **Voice State Activity:** ${fmt(conf?.voice_log_channel)}\n` +
        `• **Support Ticket Archives:** ${fmt(conf?.ticket_log_channel)}\n\n` +
        `*Use prefix commands \`&modlogs\` or \`&securitylogs\` to adjust destinations.*`
      )
      .setFooter({ text: CONFIG.FOOTER_TEXT })
      .setTimestamp();
  }

  private static renderFeaturesPage(session: DashboardSession, guild?: Guild | null): EmbedBuilder {
    if (!guild) {
      return new EmbedBuilder().setColor(CONFIG.COLORS.PRIMARY).setTitle('Features').setDescription('Execute inside a guild.');
    }

    const conf = db.prepare('SELECT * FROM guilds WHERE id = ?').get(guild.id) as any;
    const ticketsCount = (db.prepare('SELECT COUNT(*) as c FROM tickets WHERE guild_id = ? AND status = "OPEN"').get(guild.id) as any)?.c || 0;
    const giveawaysCount = (db.prepare('SELECT COUNT(*) as c FROM giveaways WHERE guild_id = ? AND ended = 0').get(guild.id) as any)?.c || 0;

    return new EmbedBuilder()
      .setColor(CONFIG.COLORS.PRIMARY)
      .setTitle(`${CONFIG.EMOJIS.STAR} Feature Suite Management — ${guild.name}`)
      .setDescription(
        `**Community Modules:**\n` +
        `• **Support Tickets:** \`${ticketsCount} open tickets\` (Panel ready)\n` +
        `• **Verification Gate:** ${conf?.verify_channel ? `<#${conf.verify_channel}>` : '`Disabled`'} (Role: ${conf?.verify_role_id ? `<@&${conf.verify_role_id}>` : '`None`'})\n` +
        `• **Join Autorole:** ${conf?.autorole_id ? `<@&${conf.autorole_id}>` : '`Disabled`'}\n` +
        `• **Welcome Greetings:** \`${conf?.welcome_enabled ? 'Active' : 'Disabled'}\` (${conf?.welcome_channel ? `<#${conf.welcome_channel}>` : '`None`'})\n` +
        `• **Leveling XP System:** \`${conf?.leveling_enabled ? 'Enabled' : 'Disabled'}\`\n` +
        `• **Economy Currency:** \`${conf?.economy_enabled ? 'Enabled' : 'Disabled'}\`\n` +
        `• **Active Giveaways:** \`${giveawaysCount} ongoing\``
      )
      .setFooter({ text: CONFIG.FOOTER_TEXT })
      .setTimestamp();
  }

  private static renderDatabasePage(session: DashboardSession): EmbedBuilder {
    const usersCount = (db.prepare('SELECT COUNT(*) as c FROM users').get() as any)?.c || 0;
    const casesCount = (db.prepare('SELECT COUNT(*) as c FROM moderation_cases').get() as any)?.c || 0;
    const secCount = (db.prepare('SELECT COUNT(*) as c FROM security_events').get() as any)?.c || 0;
    const tickCount = (db.prepare('SELECT COUNT(*) as c FROM tickets').get() as any)?.c || 0;
    const backupCount = (db.prepare('SELECT COUNT(*) as c FROM role_backups').get() as any)?.c || 0;

    return new EmbedBuilder()
      .setColor(CONFIG.COLORS.PRIMARY)
      .setTitle(`${CONFIG.EMOJIS.KEY} Database Storage & Snapshot Health`)
      .setDescription(
        `**Database Engine:** \`SQLite (better-sqlite3)\`\n` +
        `**Journal Mode:** \`WAL (Write-Ahead Logging Active)\`\n` +
        `**File Path:** \`${CONFIG.DATABASE_PATH}\`\n\n` +
        `**Table Record Metrics:**\n` +
        `• **Registered Users:** \`${usersCount.toLocaleString()}\` records\n` +
        `• **Moderation Cases:** \`${casesCount.toLocaleString()}\` records\n` +
        `• **Security Event Audits:** \`${secCount.toLocaleString()}\` records\n` +
        `• **Support Tickets:** \`${tickCount.toLocaleString()}\` records\n` +
        `• **Role Backups Saved:** \`${backupCount.toLocaleString()}\` snapshots\n\n` +
        `*Click "Create Instant Backup" below to take an immediate database snapshot.*`
      )
      .setFooter({ text: CONFIG.FOOTER_TEXT })
      .setTimestamp();
  }
}
