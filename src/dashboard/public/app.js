// Helium Minimalist Command Center - Interaction Engine
(() => {
  let authToken = localStorage.getItem('helium_dash_token') || '';
  let activeTab = 'overview';
  let pollInterval = null;
  let activeGuildId = '';
  let currentBadwords = [];

  // Check query param token first
  const queryParams = new URLSearchParams(window.location.search);
  const paramToken = queryParams.get('token');
  if (paramToken) {
    authToken = paramToken;
    localStorage.setItem('helium_dash_token', authToken);
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  // DOM Elements
  const sidebar = document.getElementById('sidebar');
  const sidebarToggle = document.getElementById('sidebarToggle');
  const navButtons = document.querySelectorAll('.nav-button');
  const tabPanes = document.querySelectorAll('.tab-pane');
  const viewTitle = document.getElementById('viewTitle');
  const toastContainer = document.getElementById('toastContainer');
  const confirmModal = document.getElementById('confirmModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalDesc = document.getElementById('modalDesc');
  const modalCancel = document.getElementById('modalCancel');
  const modalConfirm = document.getElementById('modalConfirm');
  const loginModal = document.getElementById('loginModal');
  const loginForm = document.getElementById('loginForm');
  const btnLogout = document.getElementById('btnLogout');
  const globalGuildSelect = document.getElementById('globalGuildSelect');

  // Member Picker Elements & State
  const userPickerModal = document.getElementById('userPickerModal');
  const userPickerClose = document.getElementById('userPickerClose');
  const userPickerSearch = document.getElementById('userPickerSearch');
  const userPickerClearSearch = document.getElementById('userPickerClearSearch');
  const userPickerGrid = document.getElementById('userPickerGrid');
  const userPickerCountBadge = document.getElementById('userPickerCountBadge');
  const userPickerSubtitle = document.getElementById('userPickerSubtitle');

  let cachedServerMembers = [];
  let memberPickerCallback = null;
  let pendingConfirmAction = null;

  // Initialize
  function init() {
    setupNavigation();
    setupModals();
    setupHandlers();
    setupEmbedStudio();

    if (!authToken) {
      showLogin();
    } else {
      verifyAndStart();
    }
  }

  // Toast System
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast-item toast-${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(6px)';
      toast.style.transition = 'all 0.2s ease';
      setTimeout(() => toast.remove(), 200);
    }, 3500);
  }

  // Confirmation Modal
  function askConfirmation(title, description, onConfirm) {
    modalTitle.textContent = title;
    modalDesc.textContent = description;
    pendingConfirmAction = onConfirm;
    confirmModal.classList.add('active');
  }

  function setupModals() {
    modalCancel.addEventListener('click', () => {
      confirmModal.classList.remove('active');
      pendingConfirmAction = null;
    });

    modalConfirm.addEventListener('click', async () => {
      confirmModal.classList.remove('active');
      if (pendingConfirmAction) {
        await pendingConfirmAction();
        pendingConfirmAction = null;
      }
    });

    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const userId = document.getElementById('loginUserId').value.trim();
      const key = document.getElementById('loginKey').value.trim();

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, key }),
        });
        const data = await res.json();
        if (res.ok && data.token) {
          authToken = data.token;
          localStorage.setItem('helium_dash_token', authToken);
          loginModal.classList.remove('active');
          showToast('Dashboard unlocked successfully.', 'success');
          startApp();
        } else {
          showToast(data.error || 'Authentication failed. Check your ID and PIN.', 'error');
        }
      } catch (err) {
        showToast('Network error during authentication.', 'error');
      }
    });

    btnLogout.addEventListener('click', () => {
      localStorage.removeItem('helium_dash_token');
      authToken = '';
      if (pollInterval) clearInterval(pollInterval);
      showLogin();
      showToast('Session closed.', 'info');
    });

    // Member Picker Modal Event Listeners
    userPickerClose?.addEventListener('click', closeMemberPicker);
    userPickerModal?.addEventListener('click', (e) => {
      if (e.target === userPickerModal) closeMemberPicker();
    });

    userPickerSearch?.addEventListener('input', () => {
      if (userPickerClearSearch) {
        userPickerClearSearch.style.display = userPickerSearch.value ? 'block' : 'none';
      }
      renderMemberPickerGrid();
    });

    userPickerClearSearch?.addEventListener('click', () => {
      userPickerSearch.value = '';
      userPickerClearSearch.style.display = 'none';
      userPickerSearch.focus();
      renderMemberPickerGrid();
    });

    // Global ESC key to close modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && userPickerModal?.classList.contains('active')) {
        closeMemberPicker();
      }
    });
  }

  function showLogin() {
    loginModal.classList.add('active');
  }

  async function verifyAndStart() {
    try {
      const res = await fetch(`/api/auth/verify?token=${authToken}`);
      const data = await res.json();
      if (res.ok && data.valid) {
        startApp();
      } else {
        localStorage.removeItem('helium_dash_token');
        showLogin();
      }
    } catch {
      showLogin();
    }
  }

  function startApp() {
    loadInitialData();
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(refreshLiveStats, 5000);
  }

  // Navigation
  function setupNavigation() {
    sidebarToggle.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
    });

    navButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        switchTab(tab);
      });
    });

    globalGuildSelect.addEventListener('change', (e) => {
      activeGuildId = e.target.value;
      if (activeGuildId) {
        cachedServerMembers = [];
        loadSelectedGuild(activeGuildId);
      }
    });

    // Timeout duration toggle on moderation form
    const modActionType = document.getElementById('modActionType');
    const modDurationGroup = document.getElementById('modDurationGroup');
    modActionType.addEventListener('change', () => {
      modDurationGroup.style.display = modActionType.value === 'timeout' ? 'flex' : 'none';
    });
  }

  function switchTab(tab) {
    activeTab = tab;
    navButtons.forEach(b => b.classList.toggle('active', b.getAttribute('data-tab') === tab));
    tabPanes.forEach(p => p.classList.toggle('active', p.id === `pane-${tab}`));

    const titles = {
      overview: 'Overview & Diagnostics',
      server: 'Server Configuration',
      security: 'Anti-Nuke Threat Engine',
      automod: 'Discord AutoMod & Filter Rules',
      moderation: 'Moderation Hub & Punishments',
      logs: 'Audit Logging Routing Channels',
      features: 'Features & Economy Banker',
      embeds: 'Interactive Live Embed Studio',
      database: 'Storage & Role Backups',
    };
    viewTitle.textContent = titles[tab] || 'Command Center';
  }

  // API Fetch Helper
  async function apiFetch(url, options = {}) {
    options.headers = {
      ...options.headers,
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    };
    const res = await fetch(url, options);
    if (res.status === 401) {
      showToast('Session expired. Please re-authenticate.', 'error');
      showLogin();
      throw new Error('Unauthorized');
    }
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Request failed');
    }
    return data;
  }

  // Initial Data Load
  async function loadInitialData() {
    await Promise.allSettled([
      refreshLiveStats(),
      loadGuildsList(),
      loadDevelopers(),
      loadModerationCases(),
      loadDatabaseStats()
    ]);
  }

  // Live Stats Polling
  async function refreshLiveStats() {
    try {
      const data = await apiFetch('/api/stats');
      document.getElementById('wsPing').textContent = data.ping;
      document.getElementById('botUptime').textContent = data.uptime;
      document.getElementById('statGuildCount').textContent = data.guildCount;
      document.getElementById('statUserCount').textContent = data.cachedUsers;
      document.getElementById('statCmdCount').textContent = data.slashCmdCount;
      document.getElementById('statAliasCount').textContent = data.prefixAliasCount;
      document.getElementById('statMem').textContent = `${data.memory.heapUsedMb} MB`;
      document.getElementById('diagDb').textContent = data.dbStatus;
      document.getElementById('diagMaint').textContent = data.maintenanceMode ? 'Maintenance (Active)' : 'Operational (Normal)';
      document.getElementById('tagMaintState').textContent = data.maintenanceMode ? 'ACTIVE' : 'OFF';

      const pingPill = document.getElementById('pingPill');
      const dot = pingPill.querySelector('.dot-indicator');
      if (data.pingRaw > 200) {
        dot.style.background = 'var(--status-amber)';
      } else {
        dot.style.background = 'var(--status-green)';
      }
    } catch (err) {
      console.warn('Failed to refresh stats', err);
    }
  }

  // Guilds List
  async function loadGuildsList() {
    try {
      const data = await apiFetch('/api/guilds');
      const guilds = data.guilds || [];
      globalGuildSelect.innerHTML = guilds.map(g => `
        <option value="${g.id}">${g.name} (${g.memberCount} members)</option>
      `).join('');

      if (guilds.length > 0) {
        activeGuildId = guilds[0].id;
        globalGuildSelect.value = activeGuildId;
        await loadSelectedGuild(activeGuildId);
      }
    } catch (err) {
      console.error(err);
    }
  }

  // Load Active Selected Guild Full Details
  async function loadSelectedGuild(guildId) {
    try {
      const data = await apiFetch(`/api/guild/${guildId}`);
      const s = data.settings || {};

      // 1. Populate Dropdowns (Channels & Roles)
      populateDropdowns(data.channels || [], data.roles || []);

      // 2. Server Setup View
      document.getElementById('cfgPrefix').value = s.prefix || '&';
      document.getElementById('cfgAutorole').value = s.autorole_id || '';
      document.getElementById('cfgVerifyRole').value = s.verify_role_id || '';
      document.getElementById('cfgVerifyChannel').value = s.verify_channel || '';
      document.getElementById('cfgWelcomeEnabled').checked = Boolean(s.welcome_enabled);
      document.getElementById('cfgWelcomeChannel').value = s.welcome_channel || '';
      document.getElementById('cfgWelcomeMsg').value = s.welcome_message || '';
      document.getElementById('cfgGoodbyeEnabled').checked = Boolean(s.goodbye_enabled);
      document.getElementById('cfgGoodbyeChannel').value = s.goodbye_channel || '';

      // 3. Anti-Nuke View
      document.getElementById('cfgAntinukeEnabled').checked = Boolean(s.antinuke_enabled ?? 1);
      document.getElementById('cfgAntinukeThreshold').value = s.antinuke_threshold ?? 3;
      document.getElementById('cfgAntinukeAction').value = s.antinuke_action || 'ban';
      document.getElementById('cfgAntiraidEnabled').checked = Boolean(s.antiraid_enabled ?? 1);
      document.getElementById('cfgAntiraidThreshold').value = s.antiraid_threshold ?? 5;
      renderWhitelistTable(data.trusted || []);

      // 4. AutoMod View
      document.getElementById('amMaster').checked = Boolean(s.automod_enabled ?? 1);
      document.getElementById('amInvites').checked = Boolean(s.automod_invites ?? 1);
      document.getElementById('amLinks').checked = Boolean(s.automod_links);
      document.getElementById('amSpam').checked = Boolean(s.automod_spam ?? 1);
      document.getElementById('amCaps').checked = Boolean(s.automod_caps);
      document.getElementById('amBadwords').checked = Boolean(s.automod_badwords);
      try {
        currentBadwords = JSON.parse(s.automod_badwords_list || '[]');
      } catch {
        currentBadwords = [];
      }
      renderBadwordsChips();

      // 5. Audit Logs View
      document.getElementById('logSecurity').value = s.security_log_channel || '';
      document.getElementById('logMod').value = s.mod_log_channel || '';
      document.getElementById('logMember').value = s.member_log_channel || '';
      document.getElementById('logMessage').value = s.server_log_channel || '';
      document.getElementById('logVoice').value = s.voice_log_channel || '';
      document.getElementById('logServer').value = s.automod_log_channel || '';

      // 6. Security Events & Pre-fetch Members
      loadSecurityEvents(guildId);
      loadTickets(guildId);
      fetchServerMembers(true);
    } catch (err) {
      console.error(err);
    }
  }

  function populateDropdowns(channels, roles) {
    const channelOptions = '<option value="">None</option>' + channels.map(c => `<option value="${c.id}">#${c.name}</option>`).join('');
    const roleOptions = '<option value="">Disabled</option>' + roles.map(r => `<option value="${r.id}">@${r.name}</option>`).join('');

    const channelSelects = [
      'cfgVerifyChannel', 'cfgWelcomeChannel', 'cfgGoodbyeChannel',
      'broadcastChannel', 'slowmodeChannel', 'logSecurity', 'logMod',
      'logMember', 'logMessage', 'logVoice', 'logServer', 'embedTargetChannel'
    ];
    channelSelects.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = channelOptions;
    });

    const roleSelects = ['cfgAutorole', 'cfgVerifyRole'];
    roleSelects.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = roleOptions;
    });
  }

  function renderWhitelistTable(entities) {
    const tbody = document.querySelector('#whitelistTable tbody');
    if (!entities || entities.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" class="text-muted text-center">No whitelisted entities.</td></tr>';
      return;
    }
    tbody.innerHTML = entities.map(e => `
      <tr>
        <td><code>${e.entity_id}</code></td>
        <td><span class="tag">${e.type.toUpperCase()}</span></td>
        <td><button class="btn btn-secondary btn-sm" onclick="window.heliumRemoveWhitelist('${e.entity_id}')">Revoke</button></td>
      </tr>
    `).join('');
  }

  window.heliumRemoveWhitelist = async (entityId) => {
    try {
      const res = await apiFetch('/api/security/whitelist', {
        method: 'POST',
        body: JSON.stringify({ guildId: activeGuildId, entityId, action: 'remove' })
      });
      showToast(res.message, 'success');
      loadSelectedGuild(activeGuildId);
    } catch (err) {
      showToast('Failed to revoke whitelist entity.', 'error');
    }
  };

  function renderBadwordsChips() {
    const container = document.getElementById('badwordsChips');
    if (currentBadwords.length === 0) {
      container.innerHTML = '<span class="text-muted">No custom words registered.</span>';
      return;
    }
    container.innerHTML = currentBadwords.map((w, idx) => `
      <div class="chip">
        <span>${w}</span>
        <button class="chip-remove" onclick="window.heliumRemoveWord(${idx})">✕</button>
      </div>
    `).join('');
  }

  window.heliumRemoveWord = (idx) => {
    currentBadwords.splice(idx, 1);
    renderBadwordsChips();
  };

  async function loadSecurityEvents(guildId) {
    try {
      const data = await apiFetch(`/api/security?guildId=${guildId}`);
      const tbody = document.querySelector('#securityEventsTable tbody');
      if (data.recentEvents && data.recentEvents.length > 0) {
        tbody.innerHTML = data.recentEvents.map(e => `
          <tr>
            <td><strong>${e.event_type}</strong></td>
            <td><code>${e.actor_id}</code></td>
            <td><span class="tag text-red">${e.severity}</span></td>
            <td>${e.action_taken}</td>
            <td>${new Date(e.timestamp).toLocaleTimeString()}</td>
          </tr>
        `).join('');
      } else {
        tbody.innerHTML = '<tr><td colspan="5" class="text-muted text-center">No threats recorded. System secure.</td></tr>';
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function loadModerationCases() {
    try {
      const data = await apiFetch('/api/moderation');
      const tbody = document.querySelector('#modCasesTable tbody');
      if (data.cases && data.cases.length > 0) {
        tbody.innerHTML = data.cases.map(c => `
          <tr>
            <td>#${c.caseId || c.id}</td>
            <td><code>${c.userId}</code></td>
            <td><span class="micro-badge">${c.action}</span></td>
            <td><code>${c.moderatorId}</code></td>
            <td>${c.reason}</td>
            <td>${new Date(c.createdAt).toLocaleDateString()}</td>
            <td><button class="btn btn-secondary btn-sm" onclick="window.heliumRevokeCase(${c.id})">Revoke</button></td>
          </tr>
        `).join('');
      } else {
        tbody.innerHTML = '<tr><td colspan="7" class="text-muted text-center">No infractions recorded.</td></tr>';
      }
    } catch (err) {
      console.error(err);
    }
  }

  window.heliumRevokeCase = async (caseId) => {
    askConfirmation('Revoke Case?', `Are you sure you want to revoke and delete case #${caseId}?`, async () => {
      try {
        const res = await apiFetch('/api/moderation/revoke', {
          method: 'POST',
          body: JSON.stringify({ caseId, guildId: activeGuildId })
        });
        showToast(res.message, 'success');
        loadModerationCases();
      } catch (err) {
        showToast('Failed to revoke case.', 'error');
      }
    });
  };

  async function loadTickets(guildId) {
    try {
      const data = await apiFetch(`/api/features?guildId=${guildId}`);
      const tbody = document.querySelector('#ticketsTable tbody');
      if (data.tickets?.list && data.tickets.list.length > 0) {
        tbody.innerHTML = data.tickets.list.map(t => `
          <tr>
            <td>#${t.ticket_number}</td>
            <td><code>${t.user_id}</code></td>
            <td><code>${t.channel_id}</code></td>
            <td><button class="btn btn-secondary btn-sm" onclick="window.heliumCloseTicket('${t.channel_id}')">Close</button></td>
          </tr>
        `).join('');
      } else {
        tbody.innerHTML = '<tr><td colspan="4" class="text-muted text-center">No open tickets.</td></tr>';
      }
    } catch (err) {
      console.error(err);
    }
  }

  window.heliumCloseTicket = async (channelId) => {
    try {
      const res = await apiFetch('/api/features/tickets/close', {
        method: 'POST',
        body: JSON.stringify({ channelId })
      });
      showToast(res.message, 'success');
      loadTickets(activeGuildId);
    } catch (err) {
      showToast('Failed to close ticket.', 'error');
    }
  };

  async function loadDatabaseStats() {
    try {
      const data = await apiFetch('/api/database');
      const tblBody = document.querySelector('#dbTablesTable tbody');
      if (data.tables) {
        tblBody.innerHTML = data.tables.map(t => `
          <tr>
            <td><code>${t.name}</code></td>
            <td>${t.count.toLocaleString()}</td>
            <td><span class="micro-badge">READY</span></td>
          </tr>
        `).join('');
      }

      const bkpBody = document.querySelector('#dbBackupsTable tbody');
      if (data.backups && data.backups.length > 0) {
        bkpBody.innerHTML = data.backups.map(b => `
          <tr>
            <td><code>${b.id}</code></td>
            <td>${new Date(b.createdAt).toLocaleDateString()}</td>
            <td><button class="btn btn-secondary btn-sm" onclick="window.heliumRestoreBackup('${b.id}')">Restore</button></td>
          </tr>
        `).join('');
      } else {
        bkpBody.innerHTML = '<tr><td colspan="3" class="text-muted text-center">No backups recorded.</td></tr>';
      }
    } catch (err) {
      console.error(err);
    }
  }

  window.heliumRestoreBackup = async (backupId) => {
    askConfirmation('Restore Role Hierarchy?', `Restore all roles from snapshot ${backupId}? Existing permissions will be updated.`, async () => {
      try {
        const res = await apiFetch('/api/database/restore', {
          method: 'POST',
          body: JSON.stringify({ guildId: activeGuildId, backupId })
        });
        showToast(res.message, 'success');
      } catch (err) {
        showToast('Failed to restore roles from snapshot.', 'error');
      }
    });
  };

  // Button Action Handlers
  function setupHandlers() {
    // 1. Refresh Stats
    document.getElementById('btnRefreshStats').addEventListener('click', async () => {
      await refreshLiveStats();
      showToast('Diagnostics refreshed.', 'success');
    });

    // 2. Save Server Setup
    document.getElementById('btnSaveServerConfig').addEventListener('click', async () => {
      if (!activeGuildId) return;
      try {
        const res = await apiFetch(`/api/guild/${activeGuildId}/config`, {
          method: 'POST',
          body: JSON.stringify({
            prefix: document.getElementById('cfgPrefix').value.trim() || '&',
            autorole_id: document.getElementById('cfgAutorole').value || null,
            verify_role_id: document.getElementById('cfgVerifyRole').value || null,
            verify_channel: document.getElementById('cfgVerifyChannel').value || null,
            welcome_enabled: document.getElementById('cfgWelcomeEnabled').checked,
            welcome_channel: document.getElementById('cfgWelcomeChannel').value || null,
            welcome_message: document.getElementById('cfgWelcomeMsg').value.trim() || null,
            goodbye_enabled: document.getElementById('cfgGoodbyeEnabled').checked,
            goodbye_channel: document.getElementById('cfgGoodbyeChannel').value || null,
          })
        });
        showToast(res.message, 'success');
      } catch (err) {
        showToast('Error saving server configuration.', 'error');
      }
    });

    // 3. Broadcast Announcement
    document.getElementById('btnSendBroadcast').addEventListener('click', async () => {
      const channelId = document.getElementById('broadcastChannel').value;
      const title = document.getElementById('broadcastTitle').value.trim();
      const message = document.getElementById('broadcastMessage').value.trim();
      if (!channelId || !message) {
        showToast('Select a channel and enter a message.', 'error');
        return;
      }
      try {
        const res = await apiFetch('/api/system/broadcast', {
          method: 'POST',
          body: JSON.stringify({ channelId, title, message })
        });
        showToast(res.message, 'success');
        document.getElementById('broadcastMessage').value = '';
      } catch (err) {
        showToast('Failed to broadcast announcement.', 'error');
      }
    });

    // 4. Save Security Policy
    document.getElementById('btnSaveSecurityConfig').addEventListener('click', async () => {
      if (!activeGuildId) return;
      try {
        const res = await apiFetch(`/api/security/${activeGuildId}/config`, {
          method: 'POST',
          body: JSON.stringify({
            antinuke_enabled: document.getElementById('cfgAntinukeEnabled').checked,
            antinuke_threshold: document.getElementById('cfgAntinukeThreshold').value,
            antinuke_action: document.getElementById('cfgAntinukeAction').value,
            antiraid_enabled: document.getElementById('cfgAntiraidEnabled').checked,
            antiraid_threshold: document.getElementById('cfgAntiraidThreshold').value,
          })
        });
        showToast(res.message, 'success');
      } catch (err) {
        showToast(err.message || 'Error saving security policy.', 'error');
      }
    });

    // 5. Add Whitelist Entity
    document.getElementById('btnAddWhitelist').addEventListener('click', async () => {
      const entityId = document.getElementById('whitelistInputId').value.trim();
      const type = document.getElementById('whitelistInputType').value;
      if (!entityId || !activeGuildId) return;

      try {
        const res = await apiFetch('/api/security/whitelist', {
          method: 'POST',
          body: JSON.stringify({ guildId: activeGuildId, entityId, type, action: 'add' })
        });
        showToast(res.message, 'success');
        document.getElementById('whitelistInputId').value = '';
        loadSelectedGuild(activeGuildId);
      } catch (err) {
        showToast('Failed to add entity to whitelist.', 'error');
      }
    });

    // 6. Emergency Lockdown / Unlock / Panic
    document.getElementById('secBtnLockdown').addEventListener('click', () => {
      askConfirmation('Lockdown Server Channels?', 'Freeze messaging permissions on all server channels immediately?', async () => {
        try {
          const res = await apiFetch('/api/security/lockdown', { method: 'POST', body: JSON.stringify({ guildId: activeGuildId }) });
          showToast(res.message, 'success');
        } catch { showToast('Lockdown failed.', 'error'); }
      });
    });

    document.getElementById('secBtnUnlock').addEventListener('click', async () => {
      try {
        const res = await apiFetch('/api/security/unlockdown', { method: 'POST', body: JSON.stringify({ guildId: activeGuildId }) });
        showToast(res.message, 'success');
      } catch { showToast('Failed to lift lockdown.', 'error'); }
    });

    document.getElementById('secBtnPanic').addEventListener('click', () => {
      askConfirmation('ARM PANIC MODE?', 'Maximum alert: Locks down all channels and reduces threat threshold to 1 action.', async () => {
        try {
          const res = await apiFetch('/api/security/panic', { method: 'POST', body: JSON.stringify({ guildId: activeGuildId }) });
          showToast(res.message, 'success');
          loadSelectedGuild(activeGuildId);
        } catch { showToast('Panic mode failed.', 'error'); }
      });
    });

    // 7. Save AutoMod
    document.getElementById('btnSaveAutomod').addEventListener('click', async () => {
      if (!activeGuildId) return;
      try {
        const res = await apiFetch(`/api/automod/${activeGuildId}/config`, {
          method: 'POST',
          body: JSON.stringify({
            automod_enabled: document.getElementById('amMaster').checked,
            automod_invites: document.getElementById('amInvites').checked,
            automod_links: document.getElementById('amLinks').checked,
            automod_spam: document.getElementById('amSpam').checked,
            automod_caps: document.getElementById('amCaps').checked,
            automod_badwords: document.getElementById('amBadwords').checked,
            badwords: currentBadwords
          })
        });
        showToast(res.message, 'success');
      } catch (err) {
        showToast('Failed to save AutoMod config.', 'error');
      }
    });

    // Add Badword
    document.getElementById('btnAddBadword').addEventListener('click', () => {
      const input = document.getElementById('inputNewBadword');
      const val = input.value.trim().toLowerCase();
      if (val && !currentBadwords.includes(val)) {
        currentBadwords.push(val);
        renderBadwordsChips();
        input.value = '';
      }
    });

    // 8. Execute Punishment
    document.getElementById('btnExecutePunish').addEventListener('click', async () => {
      const action = document.getElementById('modActionType').value;
      const userId = document.getElementById('modTargetUserId').value.trim();
      const reason = document.getElementById('modActionReason').value.trim();
      const durationMinutes = document.getElementById('modTimeoutMinutes').value;

      if (!userId || !activeGuildId) {
        showToast('Enter a Discord User ID.', 'error');
        return;
      }

      askConfirmation(`Execute ${action.toUpperCase()}?`, `Confirm executing ${action.toUpperCase()} on user ${userId}?`, async () => {
        try {
          const res = await apiFetch('/api/moderation/punish', {
            method: 'POST',
            body: JSON.stringify({ guildId: activeGuildId, userId, action, reason, durationMinutes })
          });
          showToast(res.message, 'success');
          clearModSelectedMember();
          document.getElementById('modActionReason').value = '';
          loadModerationCases();
        } catch (err) {
          showToast('Punishment failed. Ensure bot has higher role hierarchy.', 'error');
        }
      });
    });

    // Set Slowmode
    document.getElementById('btnSetSlowmode').addEventListener('click', async () => {
      const channelId = document.getElementById('slowmodeChannel').value;
      const seconds = document.getElementById('slowmodeSeconds').value;
      if (!channelId) {
        showToast('Select a channel.', 'error');
        return;
      }
      try {
        const res = await apiFetch('/api/moderation/slowmode', {
          method: 'POST',
          body: JSON.stringify({ channelId, seconds })
        });
        showToast(res.message, 'success');
      } catch {
        showToast('Failed to update slowmode.', 'error');
      }
    });

    // 9. Save Audit Logs Routing
    document.getElementById('btnSaveLogs').addEventListener('click', async () => {
      if (!activeGuildId) return;
      try {
        const res = await apiFetch(`/api/logs/${activeGuildId}/config`, {
          method: 'POST',
          body: JSON.stringify({
            security_log_channel: document.getElementById('logSecurity').value || null,
            mod_log_channel: document.getElementById('logMod').value || null,
            member_log_channel: document.getElementById('logMember').value || null,
            server_log_channel: document.getElementById('logMessage').value || null,
            voice_log_channel: document.getElementById('logVoice').value || null,
            automod_log_channel: document.getElementById('logServer').value || null,
          })
        });
        showToast(res.message, 'success');
      } catch (err) {
        showToast('Error saving log routes.', 'error');
      }
    });

    // 10. Economy Banker
    document.getElementById('btnAdjustEco').addEventListener('click', async () => {
      const userId = document.getElementById('ecoUserId').value.trim();
      const type = document.getElementById('ecoType').value;
      const target = document.getElementById('ecoTarget').value;
      const amount = document.getElementById('ecoAmount').value;
      if (!userId || !amount) {
        showToast('Enter user ID and amount.', 'error');
        return;
      }
      try {
        const res = await apiFetch('/api/features/economy/adjust', {
          method: 'POST',
          body: JSON.stringify({ userId, type, target, amount })
        });
        showToast(res.message, 'success');
        document.getElementById('ecoUserId').value = '';
      } catch {
        showToast('Failed to update balance.', 'error');
      }
    });

    // 11. Database Snapshots
    const triggerSnapshot = async () => {
      try {
        const res = await apiFetch('/api/database/backup', {
          method: 'POST',
          body: JSON.stringify({ guildId: activeGuildId })
        });
        showToast(res.message, 'success');
        loadDatabaseStats();
      } catch {
        showToast('Failed to take backup snapshot.', 'error');
      }
    };
    document.getElementById('btnInstantBackupQuick').addEventListener('click', triggerSnapshot);
    document.getElementById('btnCreateBackupTab').addEventListener('click', triggerSnapshot);

    // 12. System Operations (Maintenance, Sync, Reload)
    document.getElementById('btnToggleMaint').addEventListener('click', async () => {
      try {
        const res = await apiFetch('/api/system/maintenance', { method: 'POST' });
        showToast(`Maintenance mode is now ${res.maintenanceMode ? 'ACTIVE' : 'OFF'}.`, 'info');
        refreshLiveStats();
      } catch { showToast('Failed to toggle maintenance.', 'error'); }
    });

    document.getElementById('btnSyncCommands').addEventListener('click', async () => {
      showToast('Deploying slash commands globally...', 'info');
      try {
        const res = await apiFetch('/api/system/sync', { method: 'POST' });
        showToast(res.message, 'success');
      } catch { showToast('Sync failed.', 'error'); }
    });

    document.getElementById('btnReloadCommands').addEventListener('click', async () => {
      try {
        const res = await apiFetch('/api/system/reload', { method: 'POST' });
        showToast(res.message, 'success');
      } catch { showToast('Reload failed.', 'error'); }
    });

    document.getElementById('btnRefreshModCases').addEventListener('click', () => {
      loadModerationCases();
      showToast('Cases refreshed.', 'success');
    });

    // 13. Authorized Developer Team Controls
    document.getElementById('btnAddDeveloper')?.addEventListener('click', async () => {
      const input = document.getElementById('newDevUserId');
      const userId = input.value.trim();
      if (!userId || !/^\d{17,20}$/.test(userId)) {
        showToast('Please enter a valid 17-20 digit Discord User ID.', 'error');
        return;
      }

      try {
        await apiFetch('/api/developers/add', {
          method: 'POST',
          body: JSON.stringify({ userId })
        });
        showToast(`Developer ${userId} authorized!`, 'success');
        input.value = '';
        loadDevelopers();
      } catch (err) {
        showToast(err.message || 'Failed to authorize developer.', 'error');
      }
    });

    // 14. Bot Server Identity (Rename)
    document.getElementById('btnUpdateBotName')?.addEventListener('click', async () => {
      const input = document.getElementById('cfgBotName');
      const name = input.value.trim();
      if (!name) {
        showToast('Please enter a bot name or nickname.', 'error');
        return;
      }

      try {
        const res = await apiFetch('/api/system/botname', {
          method: 'POST',
          body: JSON.stringify({ name, guildId: activeGuildId })
        });
        showToast(res.message, 'success');
        const prevBotName = document.getElementById('prevBotName');
        if (prevBotName) prevBotName.textContent = name;
      } catch (err) {
        showToast(err.message || 'Failed to update bot identity.', 'error');
      }
    });

    // 15. Member Picker Quick Select Triggers
    document.getElementById('btnPickModUser')?.addEventListener('click', () => {
      openMemberPicker(selectModMember);
    });
    document.getElementById('btnBrowseModUser')?.addEventListener('click', () => {
      openMemberPicker(selectModMember);
    });
    document.getElementById('btnRemoveModUser')?.addEventListener('click', () => {
      clearModSelectedMember();
    });

    document.getElementById('btnPickDevUser')?.addEventListener('click', () => {
      openMemberPicker((m) => {
        const input = document.getElementById('newDevUserId');
        if (input) input.value = m.id;
        showToast(`Selected developer: ${m.displayName} (@${m.username})`, 'info');
      });
    });

    document.getElementById('btnPickWhitelistUser')?.addEventListener('click', () => {
      openMemberPicker((m) => {
        const input = document.getElementById('whitelistInputId');
        const typeSelect = document.getElementById('whitelistInputType');
        if (input) input.value = m.id;
        if (typeSelect) typeSelect.value = 'user';
        showToast(`Selected whitelist: ${m.displayName} (@${m.username})`, 'info');
      });
    });

    document.getElementById('btnPickEcoUser')?.addEventListener('click', () => {
      openMemberPicker((m) => {
        const input = document.getElementById('ecoUserId');
        if (input) input.value = m.id;
        showToast(`Selected account: ${m.displayName} (@${m.username})`, 'info');
      });
    });
    document.getElementById('btnBrowseEcoUser')?.addEventListener('click', () => {
      openMemberPicker((m) => {
        const input = document.getElementById('ecoUserId');
        if (input) input.value = m.id;
        showToast(`Selected account: ${m.displayName} (@${m.username})`, 'info');
      });
    });
  }

  // =========================================================================
  // Member Picker Core Functions
  // =========================================================================
  async function fetchServerMembers(force = false) {
    if (!activeGuildId) return [];
    if (!force && cachedServerMembers.length > 0) return cachedServerMembers;
    try {
      const data = await apiFetch(`/api/guild/${activeGuildId}/members`);
      cachedServerMembers = data.members || [];
      return cachedServerMembers;
    } catch (err) {
      console.error('Failed to load server members:', err);
      return [];
    }
  }

  async function openMemberPicker(onSelect) {
    if (!activeGuildId) {
      showToast('Please select a server first.', 'error');
      return;
    }
    memberPickerCallback = onSelect;
    userPickerModal.classList.add('active');
    userPickerSearch.value = '';
    if (userPickerClearSearch) userPickerClearSearch.style.display = 'none';
    setTimeout(() => userPickerSearch?.focus(), 80);

    if (cachedServerMembers.length === 0) {
      userPickerGrid.innerHTML = `
        <div class="member-loading-state">
          <div class="spinner-sm"></div>
          <span>Loading server members & banners...</span>
        </div>
      `;
      await fetchServerMembers(true);
    }
    renderMemberPickerGrid();
  }

  function closeMemberPicker() {
    userPickerModal?.classList.remove('active');
    memberPickerCallback = null;
  }

  function renderMemberPickerGrid() {
    if (!userPickerGrid) return;
    const query = userPickerSearch ? userPickerSearch.value.trim().toLowerCase() : '';
    const filtered = cachedServerMembers.filter(m => {
      if (!query) return true;
      return (
        (m.displayName && m.displayName.toLowerCase().includes(query)) ||
        (m.username && m.username.toLowerCase().includes(query)) ||
        (m.tag && m.tag.toLowerCase().includes(query)) ||
        (m.id && m.id.includes(query))
      );
    });

    if (userPickerCountBadge) {
      userPickerCountBadge.textContent = `${filtered.length} member${filtered.length === 1 ? '' : 's'}`;
    }

    if (filtered.length === 0) {
      userPickerGrid.innerHTML = `
        <div class="member-empty-state">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <div>No server members matching "<strong>${escapeHtml(query)}</strong>"</div>
        </div>
      `;
      return;
    }

    userPickerGrid.innerHTML = filtered.map(m => {
      const bannerStyle = m.banner
        ? `background-image: url('${m.banner}');`
        : `background: linear-gradient(135deg, ${m.bannerColor} 0%, rgba(13, 14, 21, 0.95) 100%);`;

      const botBadge = m.bot ? `<span class="member-bot-badge">BOT</span>` : '';
      const roleBadge = m.highestRole ? `
        <span class="member-card-role" title="${escapeHtml(m.highestRole.name)}">
          <span class="member-role-dot" style="background-color: ${m.highestRole.color && m.highestRole.color !== '#000000' ? m.highestRole.color : 'var(--red-primary)'}"></span>
          ${escapeHtml(m.highestRole.name)}
        </span>
      ` : `<span></span>`;

      return `
        <div class="member-card" data-member-id="${m.id}" tabindex="0" role="button" title="Select ${escapeHtml(m.displayName)}">
          <div class="member-card-banner" style="${bannerStyle}"></div>
          <div class="member-card-avatar-wrap">
            <img class="member-card-avatar" src="${m.avatar}" alt="${escapeHtml(m.displayName)}" loading="lazy" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
          </div>
          <div class="member-card-body">
            <div class="member-card-name-row">
              <span class="member-card-name" title="${escapeHtml(m.displayName)}">${escapeHtml(m.displayName)}</span>
              ${botBadge}
            </div>
            <span class="member-card-handle">@${escapeHtml(m.username)}</span>
            <div class="member-card-meta-row">
              ${roleBadge}
              <span class="member-card-id">${m.id.slice(-4)}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Attach click events
    userPickerGrid.querySelectorAll('.member-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.getAttribute('data-member-id');
        const member = cachedServerMembers.find(m => m.id === id);
        if (member && memberPickerCallback) {
          memberPickerCallback(member);
          closeMemberPicker();
        }
      });
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          card.click();
        }
      });
    });
  }

  function selectModMember(member) {
    const input = document.getElementById('modTargetUserId');
    const avatar = document.getElementById('modSelectedAvatar');
    const name = document.getElementById('modSelectedName');
    const id = document.getElementById('modSelectedId');
    const pill = document.getElementById('modSelectedUserPill');
    const wrapper = document.getElementById('modInputWrapper');

    if (input) input.value = member.id;
    if (avatar) avatar.src = member.avatar;
    if (name) name.textContent = `${member.displayName} (@${member.username})`;
    if (id) id.textContent = member.id;
    if (pill) pill.style.display = 'flex';
    if (wrapper) wrapper.style.display = 'none';
  }

  function clearModSelectedMember() {
    const input = document.getElementById('modTargetUserId');
    const pill = document.getElementById('modSelectedUserPill');
    const wrapper = document.getElementById('modInputWrapper');

    if (input) input.value = '';
    if (pill) pill.style.display = 'none';
    if (wrapper) wrapper.style.display = 'flex';
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, m => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[m]);
  }

  // Developer Team Management
  async function loadDevelopers() {
    try {
      const data = await apiFetch('/api/developers');
      const devs = data.developers || [];
      const tbody = document.querySelector('#developersTable tbody');
      const badge = document.getElementById('devCountBadge');
      if (badge) badge.textContent = `${devs.length} DEV${devs.length === 1 ? '' : 'S'}`;

      if (!tbody) return;
      if (devs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-muted text-center">No authorized developers recorded.</td></tr>';
        return;
      }

      tbody.innerHTML = devs.map(d => `
        <tr>
          <td><code>${d.userId}</code></td>
          <td>
            ${d.isOwner
              ? '<span class="tag text-red">PRIMARY OWNER</span>'
              : '<span class="tag">AUTHORIZED DEV</span>'}
          </td>
          <td>
            ${d.isOwner
              ? '<span class="text-muted" style="font-size:0.75rem;">Permanent</span>'
              : `<button class="btn btn-secondary btn-sm" onclick="window.heliumRemoveDeveloper('${d.userId}')">Revoke</button>`}
          </td>
        </tr>
      `).join('');
    } catch (err) {
      console.error(err);
    }
  }

  window.heliumRemoveDeveloper = async (userId) => {
    try {
      await apiFetch('/api/developers/remove', {
        method: 'POST',
        body: JSON.stringify({ userId })
      });
      showToast('Developer revoked.', 'success');
      loadDevelopers();
    } catch (err) {
      showToast(err.message || 'Failed to revoke developer.', 'error');
    }
  };

  // Embed Studio State & Logic
  let embedFields = [];

  function setupEmbedStudio() {
    // Dynamic fields handling
    const btnAddField = document.getElementById('btnAddEmbedField');
    if (btnAddField) {
      btnAddField.addEventListener('click', () => {
        embedFields.push({ name: '', value: '', inline: false });
        renderEmbedFieldsEditor();
        updateEmbedPreview();
      });
    }

    // Color swatches click
    document.querySelectorAll('.swatch').forEach(sw => {
      sw.addEventListener('click', () => {
        const c = sw.getAttribute('data-color');
        const picker = document.getElementById('embedColorPicker');
        const hex = document.getElementById('embedColorHex');
        if (picker) picker.value = c;
        if (hex) hex.value = c;
        updateEmbedPreview();
      });
    });

    // Reactive input listeners for instant live preview updates
    const embedInputIds = [
      'embedMessageContent', 'embedAuthorName', 'embedAuthorIcon',
      'embedTitle', 'embedDescription', 'embedColorPicker', 'embedColorHex',
      'embedThumbnail', 'embedImage', 'embedFooterText', 'embedFooterIcon'
    ];

    embedInputIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => {
          if (id === 'embedColorPicker') {
            const hex = document.getElementById('embedColorHex');
            if (hex) hex.value = el.value;
          } else if (id === 'embedColorHex') {
            if (/^#[0-9A-Fa-f]{6}$/.test(el.value)) {
              const picker = document.getElementById('embedColorPicker');
              if (picker) picker.value = el.value;
            }
          }
          updateEmbedPreview();
        });
      }
    });

    // Presets
    document.getElementById('btnPresetAnnouncement')?.addEventListener('click', () => {
      document.getElementById('embedTitle').value = '📢 Important Announcement';
      document.getElementById('embedDescription').value = 'Attention all server members!\n\nWe have updated our server guidelines. Please check out the new channels and verify your roles.\n\nEnjoy your time in the community!';
      document.getElementById('embedColorPicker').value = '#5865F2';
      document.getElementById('embedColorHex').value = '#5865F2';
      document.getElementById('embedAuthorName').value = 'Helium Network Broadcast';
      document.getElementById('embedFooterText').value = 'Helium Sentinel • req.akira aka ScraperDevBD';
      embedFields = [
        { name: 'Server Update', value: 'Security modules are now running at 100% capacity.', inline: true },
        { name: 'Support', value: 'Open a ticket in #support for questions.', inline: true }
      ];
      renderEmbedFieldsEditor();
      updateEmbedPreview();
    });

    document.getElementById('btnPresetRules')?.addEventListener('click', () => {
      document.getElementById('embedTitle').value = '📜 Official Server Rules';
      document.getElementById('embedDescription').value = 'Please respect and follow the server rules below at all times:\n\n**1.** Be respectful to everyone.\n**2.** No spamming, mass mentions, or phishing links.\n**3.** Follow Discord Community Guidelines.\n**4.** Listen to staff instructions.';
      document.getElementById('embedColorPicker').value = '#ED4245';
      document.getElementById('embedColorHex').value = '#ED4245';
      document.getElementById('embedAuthorName').value = 'Helium Rule Enforcement';
      document.getElementById('embedFooterText').value = 'Zero Tolerance Policy • req.akira aka ScraperDevBD';
      embedFields = [];
      renderEmbedFieldsEditor();
      updateEmbedPreview();
    });

    document.getElementById('btnPresetSecurity')?.addEventListener('click', () => {
      document.getElementById('embedTitle').value = '🛡️ Security Protocol Active';
      document.getElementById('embedDescription').value = 'Helium Anti-Nuke defense systems are fully armed and monitoring role hierarchy, channel operations, and administrative privileges.';
      document.getElementById('embedColorPicker').value = '#ED4245';
      document.getElementById('embedColorHex').value = '#ED4245';
      document.getElementById('embedAuthorName').value = 'Helium Defense Operations';
      document.getElementById('embedFooterText').value = 'Active Protection • req.akira aka ScraperDevBD';
      embedFields = [
        { name: 'Top Role Hierarchy', value: 'Verified Active', inline: true },
        { name: 'Anti-Raid Filter', value: 'Threshold: 5 joins / 10s', inline: true }
      ];
      renderEmbedFieldsEditor();
      updateEmbedPreview();
    });

    // Dispatch Embed Button
    document.getElementById('btnDispatchEmbed')?.addEventListener('click', async () => {
      const channelId = document.getElementById('embedTargetChannel').value;
      if (!channelId) {
        showToast('Please select a target channel.', 'error');
        return;
      }

      const title = document.getElementById('embedTitle').value.trim();
      const description = document.getElementById('embedDescription').value.trim();
      if (!title && !description) {
        showToast('Please provide at least a title or description for the embed.', 'error');
        return;
      }

      const payload = {
        channelId,
        content: document.getElementById('embedMessageContent').value.trim(),
        title,
        description,
        color: document.getElementById('embedColorHex').value.trim() || '#ED4245',
        authorName: document.getElementById('embedAuthorName').value.trim(),
        authorIcon: document.getElementById('embedAuthorIcon').value.trim(),
        thumbnailUrl: document.getElementById('embedThumbnail').value.trim(),
        imageUrl: document.getElementById('embedImage').value.trim(),
        footerText: document.getElementById('embedFooterText').value.trim(),
        footerIcon: document.getElementById('embedFooterIcon').value.trim(),
        fields: embedFields.filter(f => f.name.trim() && f.value.trim())
      };

      try {
        const res = await apiFetch('/api/embeds/send', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        showToast(res.message || 'Embed dispatched successfully!', 'success');
      } catch (err) {
        showToast(err.message || 'Failed to dispatch embed.', 'error');
      }
    });

    updateEmbedPreview();
  }

  function renderEmbedFieldsEditor() {
    const container = document.getElementById('embedFieldsList');
    if (!container) return;
    if (embedFields.length === 0) {
      container.innerHTML = '<span class="text-muted-xs">No fields added. Click "+ Add Field" above to add tabular information.</span>';
      return;
    }

    container.innerHTML = embedFields.map((f, i) => `
      <div class="embed-field-item">
        <input type="text" class="input-text" placeholder="Field Title" value="${escapeHtml(f.name)}" oninput="window.heliumUpdateField(${i}, 'name', this.value)">
        <input type="text" class="input-text" placeholder="Field Value" value="${escapeHtml(f.value)}" oninput="window.heliumUpdateField(${i}, 'value', this.value)">
        <label class="field-inline-toggle">
          <input type="checkbox" ${f.inline ? 'checked' : ''} onchange="window.heliumUpdateField(${i}, 'inline', this.checked)">
          Inline
        </label>
        <button type="button" class="btn btn-secondary btn-sm" onclick="window.heliumRemoveField(${i})">✕</button>
      </div>
    `).join('');
  }

  window.heliumUpdateField = (index, key, val) => {
    if (embedFields[index]) {
      embedFields[index][key] = val;
      updateEmbedPreview();
    }
  };

  window.heliumRemoveField = (index) => {
    embedFields.splice(index, 1);
    renderEmbedFieldsEditor();
    updateEmbedPreview();
  };

  // Live Discord Client WYSIWYG Preview Renderer
  function updateEmbedPreview() {
    const color = document.getElementById('embedColorHex')?.value || '#ED4245';
    const embedBox = document.getElementById('discordEmbedBox');
    if (embedBox) embedBox.style.borderLeftColor = color;

    // Outside text
    const outside = document.getElementById('embedMessageContent')?.value || '';
    const prevOutside = document.getElementById('prevOutsideContent');
    if (prevOutside) {
      prevOutside.textContent = outside;
      prevOutside.style.display = outside.trim() ? 'block' : 'none';
    }

    // Author
    const authorName = document.getElementById('embedAuthorName')?.value || '';
    const authorIcon = document.getElementById('embedAuthorIcon')?.value || '';
    const prevAuthorRow = document.getElementById('prevAuthorRow');
    const prevAuthorName = document.getElementById('prevAuthorName');
    const prevAuthorIcon = document.getElementById('prevAuthorIcon');
    if (prevAuthorRow && prevAuthorName && prevAuthorIcon) {
      if (authorName.trim()) {
        prevAuthorRow.style.display = 'flex';
        prevAuthorName.textContent = authorName;
        if (authorIcon.startsWith('http')) {
          prevAuthorIcon.src = authorIcon;
          prevAuthorIcon.style.display = 'block';
        } else {
          prevAuthorIcon.style.display = 'none';
        }
      } else {
        prevAuthorRow.style.display = 'none';
      }
    }

    // Title
    const title = document.getElementById('embedTitle')?.value || '';
    const prevTitle = document.getElementById('prevTitle');
    if (prevTitle) {
      if (title.trim()) {
        prevTitle.style.display = 'block';
        prevTitle.innerHTML = parseDiscordMarkdownAndEmojis(title);
      } else {
        prevTitle.style.display = 'none';
      }
    }

    // Description
    const desc = document.getElementById('embedDescription')?.value || '';
    const prevDesc = document.getElementById('prevDesc');
    if (prevDesc) {
      if (desc.trim()) {
        prevDesc.style.display = 'block';
        prevDesc.innerHTML = parseDiscordMarkdownAndEmojis(desc);
      } else {
        prevDesc.style.display = 'none';
      }
    }

    // Thumbnail
    const thumbUrl = document.getElementById('embedThumbnail')?.value || '';
    const prevThumbContainer = document.getElementById('prevThumbnailContainer');
    const prevThumb = document.getElementById('prevThumbnail');
    if (prevThumbContainer && prevThumb) {
      if (thumbUrl.startsWith('http')) {
        prevThumb.src = thumbUrl;
        prevThumbContainer.style.display = 'block';
      } else {
        prevThumbContainer.style.display = 'none';
      }
    }

    // Banner Image
    const imgUrl = document.getElementById('embedImage')?.value || '';
    const prevImgContainer = document.getElementById('prevImageContainer');
    const prevImg = document.getElementById('prevImage');
    if (prevImgContainer && prevImg) {
      if (imgUrl.startsWith('http')) {
        prevImg.src = imgUrl;
        prevImgContainer.style.display = 'block';
      } else {
        prevImgContainer.style.display = 'none';
      }
    }

    // Fields
    const prevFieldsGrid = document.getElementById('prevFieldsGrid');
    if (prevFieldsGrid) {
      const validFields = embedFields.filter(f => f.name.trim() || f.value.trim());
      if (validFields.length > 0) {
        prevFieldsGrid.style.display = 'grid';
        prevFieldsGrid.innerHTML = validFields.map(f => `
          <div class="discord-field">
            <div class="discord-field-name">${parseDiscordMarkdownAndEmojis(f.name)}</div>
            <div class="discord-field-val">${parseDiscordMarkdownAndEmojis(f.value)}</div>
          </div>
        `).join('');
      } else {
        prevFieldsGrid.style.display = 'none';
        prevFieldsGrid.innerHTML = '';
      }
    }

    // Footer
    const footerText = document.getElementById('embedFooterText')?.value || '';
    const footerIcon = document.getElementById('embedFooterIcon')?.value || '';
    const prevFooterRow = document.getElementById('prevFooterRow');
    const prevFooterText = document.getElementById('prevFooterText');
    const prevFooterIcon = document.getElementById('prevFooterIcon');
    if (prevFooterRow && prevFooterText && prevFooterIcon) {
      if (footerText.trim()) {
        prevFooterRow.style.display = 'flex';
        prevFooterText.textContent = footerText;
        if (footerIcon.startsWith('http')) {
          prevFooterIcon.src = footerIcon;
          prevFooterIcon.style.display = 'block';
        } else {
          prevFooterIcon.style.display = 'none';
        }
      } else {
        prevFooterRow.style.display = 'none';
      }
    }
  }

  // Parse Discord Markdown & Custom Emojis (<:name:id> / <a:name:id>)
  function parseDiscordMarkdownAndEmojis(text) {
    if (!text) return '';
    let parsed = escapeHtml(text);

    // 1. Parse custom Discord emojis <:name:id> and <a:name:id>
    parsed = parsed.replace(/&lt;(a)?:([a-zA-Z0-9_~]+):([0-9]+)&gt;/g, (match, anim, name, id) => {
      const ext = anim ? 'gif' : 'png';
      return `<img class="discord-inline-emoji" src="https://cdn.discordapp.com/emojis/${id}.${ext}?size=48&quality=lossless" alt=":${name}:" title=":${name}:" loading="lazy" />`;
    });

    // 2. Bold **text**
    parsed = parsed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // 3. Italics *text* or _text_
    parsed = parsed.replace(/\*(.*?)\*/g, '<em>$1</em>');
    // 4. Strikethrough ~~text~~
    parsed = parsed.replace(/~~(.*?)~~/g, '<del>$1</del>');
    // 5. Inline code `code`
    parsed = parsed.replace(/`([^`]+)`/g, '<code style="background: rgba(0,0,0,0.25); padding: 1px 4px; border-radius: 3px; font-family: monospace;">$1</code>');
    // 6. Line breaks
    parsed = parsed.replace(/\n/g, '<br>');

    return parsed;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Run on load
  document.addEventListener('DOMContentLoaded', init);
})();
