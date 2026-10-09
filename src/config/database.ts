import Database from 'better-sqlite3';
import type { Database as DatabaseInstance } from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { CONFIG, setDynamicBotName } from './config.js';

const dbDir = path.dirname(CONFIG.DATABASE_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db: DatabaseInstance = new Database(CONFIG.DATABASE_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS guilds (
      id TEXT PRIMARY KEY,
      prefix TEXT DEFAULT '&',
      mod_log_channel TEXT,
      server_log_channel TEXT,
      security_log_channel TEXT,
      member_log_channel TEXT,
      voice_log_channel TEXT,
      automod_log_channel TEXT,
      ticket_log_channel TEXT,
      welcome_channel TEXT,
      welcome_message TEXT,
      welcome_enabled INTEGER DEFAULT 0,
      goodbye_channel TEXT,
      goodbye_message TEXT,
      goodbye_enabled INTEGER DEFAULT 0,
      autorole_id TEXT,
      verify_channel TEXT,
      verify_role_id TEXT,
      mute_role_id TEXT,
      antinuke_enabled INTEGER DEFAULT 1,
      antinuke_action TEXT DEFAULT 'ban',
      antinuke_threshold INTEGER DEFAULT 3,
      antiraid_enabled INTEGER DEFAULT 1,
      antiraid_threshold INTEGER DEFAULT 5,
      automod_enabled INTEGER DEFAULT 1,
      automod_links INTEGER DEFAULT 0,
      automod_invites INTEGER DEFAULT 1,
      automod_caps INTEGER DEFAULT 0,
      automod_badwords INTEGER DEFAULT 0,
      automod_badwords_list TEXT DEFAULT '[]',
      automod_spam INTEGER DEFAULT 1,
      leveling_enabled INTEGER DEFAULT 1,
      economy_enabled INTEGER DEFAULT 1,
      created_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      xp INTEGER DEFAULT 0,
      level INTEGER DEFAULT 0,
      wallet INTEGER DEFAULT 1000,
      bank INTEGER DEFAULT 0,
      bank_capacity INTEGER DEFAULT 10000,
      last_daily INTEGER DEFAULT 0,
      last_weekly INTEGER DEFAULT 0,
      inventory TEXT DEFAULT '[]',
      created_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS moderation_cases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      case_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      moderator_id TEXT NOT NULL,
      action TEXT NOT NULL,
      reason TEXT NOT NULL,
      duration INTEGER,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS warnings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      moderator_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS mod_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      moderator_id TEXT NOT NULL,
      note TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS security_events (
      event_id TEXT PRIMARY KEY,
      guild_id TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      target_id TEXT,
      event_type TEXT NOT NULL,
      severity TEXT NOT NULL,
      risk_score INTEGER NOT NULL,
      action_taken TEXT NOT NULL,
      reason TEXT NOT NULL,
      evidence TEXT,
      timestamp INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS trusted_entities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      type TEXT NOT NULL,
      added_by TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      UNIQUE(guild_id, entity_id)
    );

    CREATE TABLE IF NOT EXISTS protected_entities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      type TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      UNIQUE(guild_id, entity_id)
    );

    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      channel_id TEXT NOT NULL UNIQUE,
      user_id TEXT NOT NULL,
      ticket_number INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'OPEN',
      claimed_by TEXT,
      subject TEXT,
      created_at INTEGER NOT NULL,
      closed_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS giveaways (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      message_id TEXT NOT NULL UNIQUE,
      prize TEXT NOT NULL,
      winner_count INTEGER DEFAULT 1,
      end_time INTEGER NOT NULL,
      ended INTEGER DEFAULT 0,
      winners TEXT DEFAULT '[]',
      created_by TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS giveaway_entries (
      giveaway_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      PRIMARY KEY (giveaway_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      message TEXT NOT NULL,
      remind_at INTEGER NOT NULL,
      completed INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS role_backups (
      id TEXT PRIMARY KEY,
      guild_id TEXT NOT NULL,
      data TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS temp_roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role_id TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS role_menus (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      message_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      roles TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS shop_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      price INTEGER NOT NULL,
      description TEXT NOT NULL,
      role_id TEXT
    );

    CREATE TABLE IF NOT EXISTS developers (
      user_id TEXT PRIMARY KEY,
      added_by TEXT NOT NULL,
      added_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bot_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_cases_guild ON moderation_cases(guild_id, case_id);
    CREATE INDEX IF NOT EXISTS idx_warnings_user ON warnings(guild_id, user_id);
    CREATE INDEX IF NOT EXISTS idx_security_guild ON security_events(guild_id, timestamp);
    CREATE INDEX IF NOT EXISTS idx_reminders_time ON reminders(remind_at, completed);
  `);

  // Insert default shop items if empty
  const itemCount = db.prepare('SELECT COUNT(*) as c FROM shop_items').get() as { c: number };
  if (itemCount.c === 0) {
    const insertShop = db.prepare('INSERT INTO shop_items (name, price, description) VALUES (?, ?, ?)');
    insertShop.run('VIP Role Key', 5000, 'Unlocks VIP status key in community');
    insertShop.run('Custom Title', 15000, 'Custom display title in profile');
    insertShop.run('XP Booster', 7500, 'Boosts XP gain rate');
    insertShop.run('Helium Pass', 25000, 'Exclusive access pass to elite channels');
  }

  try {
    const row = db.prepare("SELECT value FROM bot_settings WHERE key = 'bot_name'").get() as any;
    if (row && row.value) {
      setDynamicBotName(row.value);
    }
  } catch {}
}
