# Helium — Database Architecture & Schema

> **Author:** `@req.akira` | **Database:** SQLite (WAL Mode Active)

---

## 1. Engine Configuration

Helium utilizes `better-sqlite3` configured with Write-Ahead Logging (WAL) for synchronous, high-throughput, non-blocking disk operations:

```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
```

---

## 2. Table Schemas

### `guilds`
Server-level configuration, routing channels, and security settings:
- `id` (TEXT PRIMARY KEY) — Discord Guild ID
- `prefix` (TEXT DEFAULT '&') — Custom guild prefix
- `mod_log_channel` (TEXT) — Punishments log channel
- `server_log_channel` (TEXT) — Message and general server logs
- `security_log_channel` (TEXT) — Anti-Nuke and raid alert logs
- `member_log_channel` (TEXT) — Join and leave logs
- `voice_log_channel` (TEXT) — Voice activity logs
- `automod_log_channel` (TEXT) — AutoMod filter violation logs
- `ticket_log_channel` (TEXT) — Ticket transcript archive
- `welcome_channel` (TEXT), `welcome_message` (TEXT), `welcome_enabled` (INTEGER)
- `goodbye_channel` (TEXT), `goodbye_message` (TEXT), `goodbye_enabled` (INTEGER)
- `autorole_id` (TEXT) — Default role granted on member join
- `verify_channel` (TEXT), `verify_role_id` (TEXT) — Verification gate settings
- `antinuke_enabled` (INTEGER DEFAULT 1), `antinuke_action` (TEXT DEFAULT 'ban'), `antinuke_threshold` (INTEGER DEFAULT 3)
- `antiraid_enabled` (INTEGER DEFAULT 1), `antiraid_threshold` (INTEGER DEFAULT 5)
- `automod_enabled` (INTEGER DEFAULT 1), `automod_invites` (INTEGER DEFAULT 1), `automod_links` (INTEGER DEFAULT 0), `automod_spam` (INTEGER DEFAULT 1), `automod_caps` (INTEGER DEFAULT 0)
- `leveling_enabled` (INTEGER DEFAULT 1), `economy_enabled` (INTEGER DEFAULT 1)

### `users`
Global user profiles, financial balances, and XP levels:
- `id` (TEXT PRIMARY KEY) — Discord User ID
- `xp` (INTEGER DEFAULT 0) — Total accumulated XP
- `level` (INTEGER DEFAULT 0) — Calculated user level
- `wallet` (INTEGER DEFAULT 1000) — Liquid wallet cash
- `bank` (INTEGER DEFAULT 0) — Stored bank credits
- `bank_capacity` (INTEGER DEFAULT 10000) — Bank holding limit
- `last_daily` (INTEGER) — Daily claim timestamp
- `last_weekly` (INTEGER) — Weekly claim timestamp
- `inventory` (TEXT DEFAULT '[]') — JSON serialized array of purchased assets

### `moderation_cases`
Immutable audit log of all moderation disciplinary actions:
- `id` (INTEGER PRIMARY KEY AUTOINCREMENT)
- `guild_id` (TEXT NOT NULL)
- `case_id` (INTEGER NOT NULL) — Sequentially incremented per guild
- `user_id` (TEXT NOT NULL) — Target user
- `moderator_id` (TEXT NOT NULL) — Acting staff
- `action` (TEXT NOT NULL) — `BAN`, `KICK`, `TIMEOUT`, `UNTIMEOUT`, `WARN`, `SOFTBAN`, `UNBAN`
- `reason` (TEXT NOT NULL)
- `duration` (INTEGER)
- `created_at` (INTEGER NOT NULL)

### `security_events`
Anti-Nuke threat evaluation records:
- `event_id` (TEXT PRIMARY KEY) — Formatted `SEC-XXXX-YYY`
- `guild_id` (TEXT NOT NULL)
- `actor_id` (TEXT NOT NULL)
- `target_id` (TEXT)
- `event_type` (TEXT NOT NULL) — e.g. `CHANNEL_DELETE`, `BAN_ADD`
- `severity` (TEXT NOT NULL) — `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`
- `risk_score` (INTEGER NOT NULL) — Accumulated sliding-window score
- `action_taken` (TEXT NOT NULL) — `BAN`, `KICK`, `STRIP_ROLES`, `LOGGED`
- `reason` (TEXT NOT NULL)
- `evidence` (TEXT)
- `timestamp` (INTEGER NOT NULL)

### `tickets`
Interactive support ticket channel records:
- `id` (INTEGER PRIMARY KEY AUTOINCREMENT)
- `guild_id` (TEXT NOT NULL)
- `channel_id` (TEXT NOT NULL UNIQUE)
- `user_id` (TEXT NOT NULL)
- `ticket_number` (INTEGER NOT NULL)
- `status` (TEXT NOT NULL DEFAULT 'OPEN') — `OPEN`, `CLOSED`, `CLAIMED`
- `claimed_by` (TEXT)
- `subject` (TEXT)
- `created_at` (INTEGER NOT NULL)
- `closed_at` (INTEGER)

### `giveaways` & `giveaway_entries`
Giveaway tracker with atomic entry toggles:
- `id` (INTEGER PRIMARY KEY AUTOINCREMENT)
- `guild_id` (TEXT NOT NULL)
- `channel_id` (TEXT NOT NULL)
- `message_id` (TEXT NOT NULL UNIQUE)
- `prize` (TEXT NOT NULL)
- `winner_count` (INTEGER DEFAULT 1)
- `end_time` (INTEGER NOT NULL)
- `ended` (INTEGER DEFAULT 0)
- `winners` (TEXT DEFAULT '[]')
- `created_by` (TEXT NOT NULL)

### `role_backups`
Role hierarchy snapshots:
- `id` (TEXT PRIMARY KEY) — `ROLE-XXXX`
- `guild_id` (TEXT NOT NULL)
- `data` (TEXT NOT NULL) — JSON array of roles with permissions, colors, and flags

### Additional Tables
- `trusted_entities`: Anti-Nuke whitelist entries
- `protected_entities`: Protected roles and channels
- `warnings`: User infractions record
- `mod_notes`: Private staff notes
- `temp_roles`: Timed roles with expiration timestamps
- `reminders`: Scheduled user reminders
- `shop_items`: Economy store assets
