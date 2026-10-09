# Helium — Complete Command Inventory

> **Author:** req.akira aka ScraperDevBD | **Community:** [discord.gg/rQbFHJYnCK](https://discord.gg/rQbFHJYnCK) | **Total Surface:** 649 Commands
> *Notice: Custom emojis configured in the bot are private assets; you must configure your own custom emoji IDs in `src/config/config.ts` when self-hosting.*

---

## 1. Moderation (26 Canonical, 85+ Aliases)

| Command | Aliases | Description |
|---|---|---|
| `/ban` | `&ban`, `&b`, `&forceban`, `&banish`, `&permaban` | Permanently ban a member |
| `/unban` | `&unban`, `&ub`, `&pardon`, `&liftban`, `&revokeban` | Revoke a ban by user ID |
| `/kick` | `&kick`, `&k`, `&boot`, `&removeuser`, `&eject` | Kick a member |
| `/timeout` | `&timeout`, `&mute`, `&tm`, `&silence`, `&quiet`, `&shush` | Timeout/mute a member |
| `/untimeout` | `&untimeout`, `&unmute`, `&untm`, `&unsilence`, `&liftmute` | Remove timeout from a member |
| `/warn` | `&warn`, `&w`, `&strike`, `&infraction`, `&caution` | Issue an official warning |
| `/warnings` | `&warnings`, `&warns`, `&strikes`, `&infractions` | View member warnings |
| `/clearwarnings`| `&clearwarnings`, `&clearwarns`, `&resetwarns`, `&delwarns`| Purge user warnings |
| `/softban` | `&softban`, `&sb`, `&kickban`, `&cleankick` | Ban and unban to purge 24h messages |
| `/purge` | `&purge`, `&clear`, `&clean`, `&prune`, `&wipe` | Bulk delete messages |
| `/slowmode` | `&slowmode`, `&sm`, `&slow`, `&cooldownchannel` | Set channel slowmode |
| `/lock` | `&lock`, `&lockchannel`, `&lockdownchannel` | Lock channel for @everyone |
| `/unlock` | `&unlock`, `&unlockchannel`, `&openchannel` | Unlock channel |
| `/hide` | `&hide`, `&hidechannel`, `&cloakchannel` | Hide channel from @everyone |
| `/unhide` | `&unhide`, `&revealchannel`, `&showchannel` | Unhide channel |
| `/nick` | `&nick`, `&nickname`, `&setnick`, `&changenick` | Update member nickname |
| `/massban` | `&massban`, `&multiban`, `&bulkban`, `&batchban` | Ban multiple IDs at once |
| `/masskick` | `&masskick`, `&multikick`, `&bulkkick` | Kick multiple members at once |
| `/modnote` | `&modnote`, `&note`, `&addnote`, `&usernote` | Attach staff note to member |
| `/viewnotes` | `&viewnotes`, `&notes`, `&getnotes`, `&listnotes` | View staff notes for member |
| `/case` | `&case`, `&viewcase`, `&casedetail` | View details of case by ID |
| `/cases` | `&cases`, `&modcases`, `&caselist` | List recent guild cases |
| `/reason` | `&reason`, `&setreason`, `&editreason` | Update case reason |
| `/history` | `&history`, `&modhistory`, `&record`, `&punishments`| Full member punishment record |
| `/report` | `&report`, `&flag`, `&reportuser` | Submit incident report |
| `/appeal` | `&appeal`, `&submitappeal`, `&requestunban` | Submit punishment appeal |

---

## 2. Security & Anti-Nuke (21 Canonical, 70+ Aliases)

| Command | Aliases | Description |
|---|---|---|
| `/antinuke` | `&antinuke`, `&an`, `&guard`, `&defense`, `&shieldbot` | Anti-Nuke suite control panel |
| `/antinuke-status` | `&antinuke-status`, `&anstatus`, `&guardstatus` | Security health and metrics |
| `/antinuke-enable` | `&antinuke-enable`, `&anenable`, `&guardon` | Arm Anti-Nuke protection |
| `/antinuke-disable`| `&antinuke-disable`, `&andisable`, `&guardoff` | Disarm Anti-Nuke protection |
| `/antinuke-threshold`| `&antinuke-threshold`, `&anthreshold`, `&guardlimit`| Set action trigger threshold |
| `/antinuke-action` | `&antinuke-action`, `&anaction`, `&guardpunish` | Set punishment (ban/kick/strip) |
| `/antinuke-whitelist`| `&antinuke-whitelist`, `&anwhitelist`, `&trustedlist`| View whitelisted entities |
| `/antinuke-protect` | `&antinuke-protect`, `&protectrole`, `&protectchannel`| Protect channel/role from deletion |
| `/antinuke-unprotect`| `&antinuke-unprotect`, `&unprotectrole` | Unprotect channel/role |
| `/antinuke-lockdown` | `&antinuke-lockdown`, `&lockdown`, `&serverlock` | Emergency guild lockdown |
| `/antinuke-unlockdown`| `&antinuke-unlockdown`, `&unlockdown` | Lift guild lockdown |
| `/antinuke-panic` | `&antinuke-panic`, `&panic`, `&panicmode` | Maximum containment protocol |
| `/antiraid` | `&antiraid`, `&ar`, `&raidguard` | Inspect join velocity monitor |
| `/raidmode` | `&raidmode`, `&toggleraid`, `&raidshield` | Toggle anti-raid defense |
| `/quarantine` | `&quarantine`, `&isolate`, `&jailuser` | Quarantine suspicious user |
| `/unquarantine` | `&unquarantine`, `&unjailed`, `&freeuser` | Release user from quarantine |
| `/security` | `&security`, `&sec`, `&secdashboard` | Comprehensive security dashboard |
| `/security-log` | `&security-log`, `&seclogs`, `&incidentlogs` | Audit trail of security events |
| `/trusted` | `&trusted`, `&trust`, `&addtrusted` | Whitelist trusted entity |
| `/untrusted` | `&untrusted`, `&untrust`, `&deltrusted` | Remove entity from whitelist |
| `/backup` | `&backup`, `&guildbackup`, `&snapshotguild` | Snapshot server roles/perms |

---

## 3. AutoMod (12 Canonical, 45+ Aliases)

| Command | Aliases | Description |
|---|---|---|
| `/automod` | `&automod`, `&am`, `&filterbot` | AutoMod configuration panel |
| `/automod-status` | `&automod-status`, `&amstatus`, `&rulesstatus` | AutoMod engine status |
| `/automod-enable` | `&automod-enable`, `&amenable` | Turn on AutoMod |
| `/automod-disable`| `&automod-disable`, `&amdisable` | Turn off AutoMod |
| `/automod-invites`| `&automod-invites`, `&antiinvite`, `&blockinvites`| Toggle Discord invite blocker |
| `/automod-links` | `&automod-links`, `&antilinks`, `&blocklinks` | Toggle external link blocker |
| `/automod-spam` | `&automod-spam`, `&antispam`, `&floodfilter` | Toggle duplicate message spam |
| `/automod-caps` | `&automod-caps`, `&anticaps`, `&capsfilter` | Toggle >70% caps lock filter |
| `/automod-keyword`| `&automod-keyword`, `&badwords`, `&blockword` | Inspect or block banned words |
| `/automod-mention`| `&automod-mention`, `&antimention` | Mass mention limit info (>5) |
| `/automod-test` | `&automod-test`, `&testautomod`, `&filtertest` | Test text against filter |
| `/automod-logs` | `&automod-logs`, `&amlogs`, `&filterlogs` | Set AutoMod violations channel |

---

## 4. Logging & Auditing (10 Canonical, 35+ Aliases)

| Command | Aliases | Description |
|---|---|---|
| `/logs` | `&logs`, `&logstatus`, `&loggingstatus` | Inspect all 7 log channels |
| `/logs-config` | `&logs-config`, `&setlogs`, `&configlogs` | Configure server activity logs |
| `/modlogs` | `&modlogs`, `&setmodlogs`, `&modlogchannel` | Set punishments log channel |
| `/messagelogs` | `&messagelogs`, `&setmessagelogs`, `&msglogs` | Set message edit/delete channel |
| `/memberlogs` | `&memberlogs`, `&setmemberlogs`, `&joinleavelogs`| Set join/leave log channel |
| `/rolelogs` | `&rolelogs`, `&setrolelogs`, `&rolechangelogs` | Set role modification logs |
| `/channellogs` | `&channellogs`, `&setchannellogs` | Set channel event logs |
| `/voicelogs` | `&voicelogs`, `&setvoicelogs`, `&vcjoinlogs` | Set voice activity logs |
| `/securitylogs` | `&securitylogs`, `&setsecuritylogs`, `&secchannel`| Set high-severity alerts channel |
| `/auditlogs` | `&auditlogs`, `&serveraudit`, `&guildlogs` | Native Discord audit log entries |

---

## 5. Tickets & Support (11 Canonical, 35+ Aliases)

| Command | Aliases | Description |
|---|---|---|
| `/ticket` | `&ticket`, `&t`, `&support` | Open a support ticket |
| `/ticket-panel` | `&ticket-panel`, `&sendpanel`, `&supportpanel` | Deploy interactive ticket panel |
| `/ticket-create` | `&ticket-create`, `&newticket`, `&maketicket` | Directly open ticket |
| `/ticket-close` | `&ticket-close`, `&closeticket`, `&tclose` | Close ticket and archive |
| `/ticket-claim` | `&ticket-claim`, `&claimticket`, `&tclaim` | Claim ticket as staff |
| `/ticket-unclaim`| `&ticket-unclaim`, `&unclaimticket` | Release claimed ticket |
| `/ticket-add` | `&ticket-add`, `&tadd`, `&inviteuser` | Add user to ticket |
| `/ticket-remove` | `&ticket-remove`, `&tremove`, `&kickticket` | Remove user from ticket |
| `/ticket-transcript`| `&ticket-transcript`, `&transcript`, `&ticketsave`| Generate message transcript |
| `/ticket-reopen` | `&ticket-reopen`, `&reopenticket`, `&treopen` | Reopen closed ticket |
| `/ticket-settings`| `&ticket-settings`, `&ticketconfig`, `&tsettings`| Configure ticket log channel |

---

## 6. Roles & Verification (10 Canonical, 35+ Aliases)

| Command | Aliases | Description |
|---|---|---|
| `/role` | `&role`, `&r`, `&inspectrole` | View role properties and stats |
| `/role-add` | `&role-add`, `&addrole`, `&giverole` | Assign role to member |
| `/role-remove` | `&role-remove`, `&removerole`, `&takerole` | Strip role from member |
| `/role-temp` | `&role-temp`, `&temprole`, `&timedrole` | Temporary role with timer |
| `/role-menu` | `&role-menu`, `&reactionroles`, `&selectroles` | Dropdown self-assign menu |
| `/role-backup` | `&role-backup`, `&backuproles`, `&saveroles` | Snapshot all guild roles |
| `/role-restore` | `&role-restore`, `&restoreroles`, `&loadroles` | Restore roles from snapshot |
| `/autorole` | `&autorole`, `&joinrole`, `&welcomerole` | Set default join role |
| `/role-all` | `&role-all`, `&giveroleall`, `&roleeveryone` | Mass role assignment |
| `/role-persist` | `&role-persist`, `&stickyroles`, `&retainroles` | Sticky role tracking |

---

## 7. Welcome & Verification (6 Canonical, 25+ Aliases)

| Command | Aliases | Description |
|---|---|---|
| `/welcome` | `&welcome`, `&setwelcome`, `&welcomemsg` | Configure welcome greetings |
| `/goodbye` | `&goodbye`, `&setgoodbye`, `&leavemsg` | Configure goodbye notices |
| `/verification`| `&verification`, `&verifygate`, `&gatekeeper` | Setup button verification gate |
| `/verify` | `&verify`, `&pass`, `&getverified` | Self verify account |
| `/welcometest` | `&welcometest`, `&testwelcome`, `&simulatejoin`| Test greeting format |
| `/goodbyetest` | `&goodbyetest`, `&testgoodbye`, `&simulateleave`| Test goodbye format |

---

## 8. Leveling & Economy (15 Canonical, 65+ Aliases)

| Command | Aliases | Description |
|---|---|---|
| `/level` | `&level`, `&lvl`, `&rank`, `&profile`, `&myrank` | Inspect rank, level, and XP |
| `/leaderboard` | `&leaderboard`, `&lb`, `&top`, `&levels` | Top 10 most active members |
| `/setlevel` | `&setlevel`, `&givelevel`, `&modlevel` | Manually set user level |
| `/setxp` | `&setxp`, `&givexp`, `&adminxp` | Manually set user XP |
| `/leveltoggle` | `&leveltoggle`, `&leveling`, `&xptoggle` | Toggle XP system |
| `/balance` | `&balance`, `&bal`, `&wallet`, `&bank`, `&money`| Wallet & bank balance |
| `/daily` | `&daily`, `&dailyreward`, `&claimdaily` | Claim daily stipend ($500) |
| `/weekly` | `&weekly`, `&weeklyreward`, `&claimweekly` | Claim weekly bonus ($3,000) |
| `/deposit` | `&deposit`, `&dep`, `&bankdep` | Deposit wallet cash into bank |
| `/withdraw` | `&withdraw`, `&with`, `&takecash` | Withdraw cash from bank |
| `/pay` | `&pay`, `&give`, `&transfer`, `&wire` | Transfer funds to another user |
| `/shop` | `&shop`, `&store`, `&market`, `&buyables` | Browse server store |
| `/buy` | `&buy`, `&purchase`, `&orderitem` | Purchase item from store |
| `/inventory` | `&inventory`, `&inv`, `&bag`, `&storage` | View purchased assets |
| `/addmoney` | `&addmoney`, `&givecash`, `&adminmoney` | Admin cash grant |

---

## 9. Giveaways (4 Canonical, 20+ Aliases)

| Command | Aliases | Description |
|---|---|---|
| `/giveaway` | `&giveaway`, `&gstart`, `&startgiveaway` | Launch interactive giveaway |
| `/giveaway-end`| `&giveaway-end`, `&gend`, `&stopgiveaway` | End giveaway and pick winner |
| `/giveaway-reroll`| `&giveaway-reroll`, `&greroll` | Reroll new winner |
| `/giveaways` | `&giveaways`, `&glist`, `&activegiveaways` | List recent guild giveaways |

---

## 10. Music & Audio (10 Canonical, 35+ Aliases)

| Command | Aliases | Description |
|---|---|---|
| `/music` | `&music`, `&m`, `&audioplayer` | Inspect audio player engine |
| `/play` | `&play`, `&p`, `&addsong` | Add track to playback queue |
| `/queue` | `&queue`, `&q`, `&playlist` | View audio queue |
| `/skip` | `&skip`, `&s`, `&next` | Skip to next track |
| `/stop` | `&stop`, `&disconnect`, `&leave` | Stop audio and clear queue |
| `/volume` | `&volume`, `&vol`, `&setvolume` | Adjust volume (0-200%) |
| `/pause` | `&pause`, `&hold`, `&waitmusic` | Pause playback |
| `/resume` | `&resume`, `&unpause`, `&continue` | Resume playback |
| `/loop` | `&loop`, `&repeat`, `&loopqueue` | Toggle queue repeat |
| `/shuffle` | `&shuffle`, `&mix`, `&randomizequeue` | Shuffle queue |

---

## 11. Utility, Tools & Information (21 Canonical, 85+ Aliases)

| Command | Aliases | Description |
|---|---|---|
| `/help` | `&help`, `&commands`, `&cmds`, `&h`, `&manual` | Command navigator with dropdowns |
| `/ping` | `&ping`, `&latency`, `&speed`, `&connection` | WebSocket & API latency |
| `/botinfo` | `&botinfo`, `&about`, `&info`, `&stats` | Bot metrics and author credits |
| `/uptime` | `&uptime`, `&up`, `&runtime` | Continuous process uptime |
| `/serverinfo` | `&serverinfo`, `&guildinfo`, `&server` | Detailed server metrics |
| `/userinfo` | `&userinfo`, `&whois`, `&user`, `&ui` | User join and account age |
| `/avatar` | `&avatar`, `&av`, `&pfp`, `&picture` | High resolution avatar |
| `/banner` | `&banner`, `&userbanner`, `&profilebanner` | Profile banner image |
| `/snowflake` | `&snowflake`, `&inspectid`, `&snow` | Decode Discord snowflake ID |
| `/timestamp` | `&timestamp`, `&timecode`, `&maketime` | Generate markdown timestamps |
| `/remind` | `&remind`, `&reminder`, `&timer` | Schedule background reminder |
| `/poll` | `&poll`, `&vote`, `&createpoll` | Interactive voting poll |
| `/calculator` | `&calculator`, `&calc`, `&math` | Arithmetic evaluator |
| `/embed` | `&embed`, `&customembed`, `&makeembed` | Red-themed custom embed |
| `/color` | `&color`, `&hex`, `&palette` | Hex color code preview |
| `/channelinfo` | `&channelinfo`, `&ci`, `&channel` | Channel settings inspection |
| `/roleinfo` | `&roleinfo`, `&ri`, `&aboutroleinfo` | Role details and permissions |
| `/permissions` | `&permissions`, `&perms`, `&myperms` | Member permissions inspector |
| `/shards` | `&shards`, `&shardinfo`, `&clusters` | Shard 0 status and metrics |
| `/prefix` | `&prefix`, `&setprefix`, `&changeprefix` | Guild prefix configuration |
| `/credits` | `&credits`, `&dev`, `&author`, `&creator` | Credits to @req.akira |

---

## 12. Automation & Owner Tools (10 Canonical, 30+ Aliases)

| Command | Aliases | Description |
|---|---|---|
| `/schedule` | `&schedule`, `&cron`, `&timedmsg` | Background task inspector |
| `/cleanup` | `&cleanup`, `&dbclean`, `&prunecache` | Clean expired DB records |
| `/announce` | `&announce`, `&broadcast`, `&shout` | Post broadcast announcement |
| `/maintenance`| `&maintenance`, `&lockbot`, `&maintenancemode`| Server maintenance flag |
| `/eval` | `&eval`, `&e`, `&evaluate` | Runtime JavaScript evaluator (Owner) |
| `/sync` | `&sync`, `&deploy`, `&syncslash` | Sync slash commands with API (Owner) |
| `/reload` | `&reload`, `&refresh`, `&reloadcmds` | Refresh command registry (Owner) |
| `/shutdown` | `&shutdown`, `&exit`, `&killbot` | Gracefully exit process (Owner) |
| `/guilds` | `&guilds`, `&serverlist`, `&botguilds` | List active guilds (Owner) |
| `/leaveserver` | `&leaveserver`, `&leaveguild` | Force leave guild by ID (Owner) |
