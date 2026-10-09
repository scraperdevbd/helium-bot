<div align="center">

# 🔴 HELIUM BOT
### High-Performance • Security-First • Red-Themed • All-In-One Discord System

[![Discord Community](https://img.shields.io/badge/Discord-Community_Server-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/rQbFHJYnCK)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Discord.js](https://img.shields.io/badge/Discord.js-v14.18-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.js.org/)
[![SQLite](https://img.shields.io/badge/SQLite-WAL_Mode-003B57?style=for-the-badge&logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

<p align="center">
  <b>Helium</b> is a production-grade, open-source All-In-One Discord bot engineered in TypeScript for high-traffic servers. Built with a signature Crimson Red design language, robust sliding-window Anti-Nuke defense, an interactive Web Command Center Dashboard, automated tier warning phrase roles, and a zero-loss SQLite storage engine.
</p>

[Join Community Server](https://discord.gg/rQbFHJYnCK) • [Report Issue](https://github.com/scraperdevbd/helium-bot/issues) • [Contact Author](mailto:scraperdev.bd@gmail.com)

</div>

---

## ⚡ Key Architecture & Features

### 🛡️ 1. Enterprise Anti-Nuke & Anti-Raid Defense
- **Instant Destructive Action Mitigation**: Any unauthorized, unwhitelisted member attempting to delete channels, purge roles, or execute mass bans is **instantly punished** (Banned, Kicked, or Stripped of all administrative roles).
- **Sliding-Window Threat Analysis**: Tracks rapid events over rolling 30-second windows with heuristic risk scoring.
- **Top-Role Hierarchy Guard**: Periodically audits the bot's own role standing; if top permissions are revoked, automatically creates an emergency private broadcast channel alerting server ownership.
- **Trusted Whitelist**: Manage immunity for co-owner bots, system integrations, and authorized staff.
- **Lockdown & Panic Modes**: 1-click global lockdown across all guild channels in high-severity situations.

### ⚠️ 2. Automated Warning Phrase Roles & Max 3 Warnings Limit
- **Automated Severity Roles**: Issuing warnings automatically provisions and synchronizes color-coded warning tier roles:
  - 🟡 **Warning 1** (`#FEE75C` Yellow)
  - 🟠 **Warning 2** (`#E67E22` Orange)
  - 🔴 **Warning 3** (`#ED4245` Red)
- **Hard Maximum Limit of 3 Warnings**: A user can receive a maximum of 3 warnings.
- **Interactive Escalation Prompt**: On the 3rd warning (or if attempting to warn a maxed member), the bot halts additional warnings and presents interactive `[👢 Kick User]`, `[🔨 Ban User]`, and `[🔄 Reset Warnings]` buttons for instant moderator action.

### 🌐 3. Interactive Web Command Center Dashboard
- **Standalone Dashboard**: Protected by Discord User ID authentication and Master PIN (`2026`).
- **Interactive Member Picker Popup**: Browse all server members with realtime search by display name, username, or ID. Displays actual Discord member avatars and profile banners (or computed accent color gradients) for 1-click selection across Moderation, Developers, Whitelist, and Economy.
- **Live Embed Studio**: Build rich embeds with live WYSIWYG preview, Discord markdown parser, and 1-click dispatch to any channel.
- **Bot Identity Customization**: Change the bot's server nickname and display identity instantly across embeds with zero downtime.
- **Maintenance Gate**: Toggle Maintenance Mode so only authorized developer team members can interact with commands.

### 💬 4. 157+ Slash & 491+ Prefix Commands (648 Total Surface)
- Fully registered Discord Slash Commands (`/`) respecting platform constraints.
- Prefix command engine (`&`) with quoted multi-word arguments (`&warn @user "Rule 4 violation"`), subcommands, and Levenshtein typo suggestions.

---

## ⚠️ Important Note: Custom Emojis

> [!WARNING]
> **The custom emojis configured in this bot (`<:tick:...>`, `<a:shield:...>`, etc.) are hosted on the creator's private Discord servers and are NOT available to the general public.**
> 
> When hosting or running your own instance of Helium, **you must replace the emoji IDs with your own server's emojis** or standard emoji representations in [`src/config/config.ts`](src/config/config.ts):
>
> ```typescript
> // src/config/config.ts
> EMOJIS: {
>   TICK: '<:your_tick:ID>',
>   CROSS: '<:your_cross:ID>',
>   STAR: '<:your_star:ID>',
>   SHIELD: '<a:your_shield:ID>',
>   SETTINGS: '<a:your_settings:ID>',
>   WIFI: '<:your_wifi:ID>',
>   KEY: '<:your_key:ID>',
>   MAIL: '<a:your_mail:ID>',
>   WARNING: '<a:your_warning:ID>',
> }
> ```

---

## 🚀 Quick Setup & Installation

### Prerequisites
- [Node.js](https://nodejs.org/) v18.0.0 or higher (Node 20+ / Node 24 recommended)
- A Discord Application & Bot Token from the [Discord Developer Portal](https://discord.com/developers/applications)

### Privileged Gateway Intents Required
Enable the following in your Discord Developer Application:
- ✅ **Server Members Intent**
- ✅ **Message Content Intent**
- ✅ **Presence Intent**

### 1. Clone & Install
```bash
git clone https://github.com/scraperdevbd/helium-bot.git
cd helium-bot
npm install
```

### 2. Configure Environment
Create your `.env` file from the provided template:
```bash
cp .env.example .env
```
Open `.env` and fill in your details:
```env
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_application_client_id_here
DEFAULT_PREFIX=&
OWNER_IDS=your_discord_user_id_here
DATABASE_PATH=./data/helium.db
ADMIN_DASHBOARD_KEY=2026
DASHBOARD_PORT=3000
NODE_ENV=production
```
*(**Note:** `.env` is ignored by `.gitignore` and must never be committed publicly).*

### 3. Deploy Slash Commands
```bash
npm run register
```

### 4. Build & Start
```bash
# Build TypeScript
npm run build

# Start Production Bot & Dashboard
npm start
```
The bot will connect to Discord and launch the Web Dashboard on `http://localhost:3000`.

---

## 🧪 Testing Suite
Helium includes an automated validation suite testing command surface, database schema, SQLite WAL mode, quoted arg parsing, typo suggestion algorithms, and dashboard authentication:
```bash
npm test
```

---

## 📚 Documentation
- [COMMANDS.md](COMMANDS.md) — Comprehensive directory of all 157+ slash commands and 491+ prefix aliases.
- [SECURITY.md](SECURITY.md) — Threat models, anti-nuke risk scoring, and raid prevention architecture.
- [DATABASE.md](DATABASE.md) — SQLite database schema, WAL mode, tables, and indexes.
- [CONFIGURATION.md](CONFIGURATION.md) — Server settings, logging channel routing, and AutoMod rules.
- [DEPLOYMENT.md](DEPLOYMENT.md) — Production VPS, PM2 process management, and Docker deployment.
- [SETUP.md](SETUP.md) — Step-by-step developer setup and permissions checklist.

---

## 👥 Creator, Support & Community

* **Primary Author & Architect:** **req.akira aka ScraperDevBD**
* **Discord Community Server:** [discord.gg/rQbFHJYnCK](https://discord.gg/rQbFHJYnCK)
* **Direct Discord Handle:** `@req.akira`
* **Contact Email:** [scraperdev.bd@gmail.com](mailto:scraperdev.bd@gmail.com)
* **GitHub Profile:** [@scraperdevbd](https://github.com/scraperdevbd)

---

## 📄 License
This project is open-source and released under the **[MIT License](LICENSE)**.
