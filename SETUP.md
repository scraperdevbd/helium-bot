# Helium — Setup Guide

> **Author:** `@req.akira` | **Theme:** Red (`#ED4245`) | **Prefix:** `&`

---

## 1. Prerequisites

- **Node.js**: v20+ or v24+
- **NPM**: v10+
- **Discord Bot Application** registered on the [Discord Developer Portal](https://discord.com/developers/applications)

---

## 2. Discord Developer Portal Setup

1. Create a new Application called **Helium**.
2. Navigate to the **Bot** tab:
   - Click **Add Bot**.
   - Copy the bot token into your `.env` file under `DISCORD_TOKEN`.
   - Enable the following **Privileged Gateway Intents**:
     - `PRESENCE INTENT` (Optional)
     - `SERVER MEMBERS INTENT` (**Required** for Anti-Raid, Welcome, Autoroles)
     - `MESSAGE CONTENT INTENT` (**Required** for prefix `&` parser and AutoMod)
3. Navigate to the **OAuth2 -> URL Generator** tab:
   - **Scopes**: `bot`, `applications.commands`
   - **Bot Permissions**: `Administrator` (or select Ban Members, Kick Members, Manage Roles, Manage Channels, Manage Messages, View Audit Log, Send Messages, Embed Links).
   - Copy the invite URL and invite Helium to your guild.

---

## 3. Environment Variables Configuration

Create a `.env` file in the project root:

```env
# Bot Authentication
DISCORD_TOKEN=MTE5OT...
CLIENT_ID=123456789012345678

# Default Prefix
DEFAULT_PREFIX=&

# Owner / Developer IDs (Comma separated)
OWNER_IDS=123456789012345678

# SQLite Database Location
DATABASE_PATH=./data/helium.db

# Environment Mode
NODE_ENV=production
```

---

## 4. Slash Commands Global Deployment

Helium includes a dedicated deployment utility to push all 156+ slash commands to the Discord REST API:

```bash
npm run register
```

You will see:
```text
[Deploy] Syncing 156 slash commands globally...
[Deploy] Successfully deployed 156 slash commands!
```

---

## 5. Starting the Bot

### Development Mode (with hot reloading):
```bash
npm run dev
```

### Production Build & Execution:
```bash
npm run build
npm start
```

---

## 6. Verification & Automated Tests

To ensure your environment, database, and commands are fully operational:

```bash
npm test
```
All 9 comprehensive automated tests should pass with green checks.

---

## 7. Custom Emojis Configuration Notice

> **Important**: The custom Discord emojis referenced in this bot (`src/config/config.ts`) are private assets hosted on the creator's Discord server and are not publicly available on other servers.
>
> If you are self-hosting this bot, you must either:
> 1. Upload your own custom emojis to your server and update their IDs in `src/config/config.ts`.
> 2. Or replace them with standard UTF-8 characters if preferred.

---

## 8. Community & Support

- **Discord Community Server:** [discord.gg/rQbFHJYnCK](https://discord.gg/rQbFHJYnCK)
- **Email:** `scraperdev.bd@gmail.com`
- **Discord Handle:** `@req.akira`
- **GitHub:** [github.com/scraperdevbd](https://github.com/scraperdevbd)
