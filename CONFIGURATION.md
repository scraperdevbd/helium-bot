# Helium — Server Configuration Guide

> **Author:** `@req.akira` | **Theme:** Red (`#ED4245`) | **Default Prefix:** `&`

---

## 1. Initial Setup Checklist

When inviting Helium to a new Discord server, execute the following setup sequence to protect and configure your community:

### Step 1: Set Log Routing Channels
Assign dedicated channels for security events, staff moderation, and server events:
```text
&securitylogs #security-alerts
&modlogs #mod-logs
&logs-config #server-logs
&memberlogs #joins-leaves
```

### Step 2: Configure Anti-Nuke
Inspect current protection and arm the engine:
```text
&antinuke
&antinuke-enable
&antinuke-threshold 3
&antinuke-action ban
```

### Step 3: Whitelist Trusted Staff & Helper Bots
Prevent automated false alarms by whitelisting trusted administrators or essential helper bots:
```text
&trusted 123456789012345678
```

### Step 4: Protect Critical Roles and Channels
Ensure core channels and administrator roles cannot be purged:
```text
&antinuke-protect 987654321098765432 ROLE
&antinuke-protect 112233445566778899 CHANNEL
```

### Step 5: Enable Discord AutoMod & Custom Filters
Protect chats from invite flooding and duplicate message spam:
```text
&automod-enable
&automod-invites
&automod-spam
&automod-logs #automod-logs
```

### Step 6: Deploy Verification Gate & Autoroles
Set up a verification channel to prevent self-bot raids:
```text
&verification #verify @Member
&autorole @Unverified
```

### Step 7: Deploy Support Tickets
Deploy an interactive support ticket panel in your support channel:
```text
&ticket-panel #support "Community Support" "Click below to open a ticket with staff."
&ticket-settings #ticket-transcripts
```

---

## 2. Dynamic Placeholders for Welcome & Goodbye

When customizing welcome/goodbye notices (`&welcome` / `&goodbye`), the following variables are dynamically evaluated:

- `{user}` — User mention (`<@123...>`) on join, or username (`User#0000`) on leave
- `{server}` — Server name
- `{count}` — Total member count after the event

---

## 3. Automated Warning Phrase Roles & Max 3 Limit

When moderators issue warnings via `&warn @user <reason>` or `/warn`, Helium automatically provisions and synchronizes warning tier roles:
- 🟡 **Warning 1** (`#FEE75C` Yellow)
- 🟠 **Warning 2** (`#E67E22` Orange)
- 🔴 **Warning 3** (`#ED4245` Red)

**Hard Limit**: A user can receive a maximum of **3 warnings**. Upon receiving their 3rd warning (or if warned again), the bot halts additional warnings and prompts staff with interactive `[Kick User]` and `[Ban User]` buttons.

---

## 4. Community Support & Assistance

- **Discord Community Server:** [discord.gg/rQbFHJYnCK](https://discord.gg/rQbFHJYnCK)
- **Developer Email:** `scraperdev.bd@gmail.com`
- **Developer Discord:** `@req.akira`
- **GitHub:** [github.com/scraperdevbd](https://github.com/scraperdevbd)
- *Note: Custom emojis in `src/config/config.ts` are private assets; configure your own server emoji IDs for self-hosting.*
