# Helium — Security & Anti-Nuke Engine Architecture

> **Author:** `@req.akira` | **Theme:** Red (`#ED4245` / `#8B0000`)

---

## 1. Threat Mitigation Philosophy

Traditional Discord security bots rely on simplistic counters that reset on a minute mark, creating easy vulnerabilities for coordinated attackers.

**Helium uses an in-memory sliding window combined with dynamic risk scoring.** Each administrative action within a guild generates a weighted risk value:

```text
Event Trigger (e.g. Channel Deletion)
   ↓
Actor Validation (Check Server Owner & Whitelist)
   ↓
Sliding Window Filter (30-second window per actor)
   ↓
Risk Engine Calculation (Accumulate severity points)
   ↓
Threshold Evaluation (Count >= limit OR Risk >= 75 pts)
   ↓
Punishment Execution (Ban / Kick / Strip Roles)
   ↓
Audit Trail Insertion (security_events table with unique SEC-ID)
   ↓
Owner & Staff Dispatch (Red-themed security embed)
```

---

## 2. Event Severity & Risk Scoring Matrix

| Action Type | Base Points | Severity Level |
|---|---|---|
| Mass Ban (`BAN_ADD`) | 25 pts | HIGH |
| Mass Kick (`KICK_ADD`) | 25 pts | HIGH |
| Channel Deletion (`CHANNEL_DELETE`) | 35 pts | HIGH |
| Role Deletion (`ROLE_DELETE`) | 35 pts | HIGH |
| Bot Addition (`BOT_ADD`) | 40 pts | CRITICAL |
| Dangerous Permission Grant (`ADMIN_ESCALATE`) | 40 pts | CRITICAL |
| Webhook Creation (`WEBHOOK_CREATE`) | 20 pts | MEDIUM |

When cumulative points exceed **75 points** or the action count exceeds the guild threshold (default: **3 actions in 30 seconds**), Helium takes immediate defensive action.

---

## 3. Configurable Penalties

Guild administrators can choose how Helium neutralizes rogue actors:

1. **`ban` (Default)**: Immediately bans the actor from the server.
2. **`kick`**: Ejects the actor from the server.
3. **`strip_roles`**: Strips all manageable roles from the actor, removing administrative rights while retaining their user account for investigation.

---

## 4. Emergency Modes

### 4.1 Server Lockdown (`&antinuke-lockdown` / `/antinuke-lockdown`)
Iterates through all guild text and voice channels, editing `@everyone` overwrites:
- Denies `SendMessages`
- Denies `AddReactions`
- Denies `CreatePublicThreads`

### 4.2 Panic Mode (`&antinuke-panic` / `/antinuke-panic`)
- Locks down every channel in the server.
- Sets Anti-Nuke action threshold to **1 action** (zero tolerance).
- Flags high threat level in security alerts.

---

## 5. Anti-Raid Join Defense

Helium continuously tracks join velocity:
- If more than 5 members join within **10 seconds**, Anti-Raid triggers.
- Incoming accounts newer than 1 day are automatically kicked or isolated.
- The server enters raid throttle until velocity normalizes.

---

## 6. Whitelist & Protected Resources

- **`&trusted <id>`**: Excludes trusted administrators, staff, or helper bots from automated Anti-Nuke penalties.
- **`&antinuke-protect <id> <CHANNEL|ROLE>`**: Marks crucial channels (rules, announcements) and roles as protected resources.
