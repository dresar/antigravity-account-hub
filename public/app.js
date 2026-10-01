let term = null;
let fitAddon = null;
let ws = null;
let activeProfileId = localStorage.getItem('agy_active_profile') || 'default';
let profilesList = [];
let isConnected = false;
let reconnectTimer = null;

const authOverlay = document.getElementById('authOverlay');
const authForm = document.getElementById('authForm');
const pinInput = document.getElementById('pinInput');
const authError = document.getElementById('authError');
const btnLogout = document.getElementById('btnLogout');
const profileSelect = document.getElementById('profileSelect');
const connStatusBadge = document.getElementById('connStatusBadge');
const connStatusText = document.getElementById('connStatusText');
const btnRestartSession = document.getElementById('btnRestartSession');
const terminalContainer = document.getElementById('terminalContainer');

const newProfileModal = document.getElementById('newProfileModal');
const btnOpenNewProfileModal = document.getElementById('btnOpenNewProfileModal');
const btnCloseNewProfileModal = document.getElementById('btnCloseNewProfileModal');
const btnCancelNewProfile = document.getElementById('btnCancelNewProfile');
const newProfileForm = document.getElementById('newProfileForm');
const profileNameInput = document.getElementById('profileNameInput');
const profileNoteInput = document.getElementById('profileNoteInput');

const manageProfilesModal = document.getElementById('manageProfilesModal');
const btnOpenManageProfilesModal = document.getElementById('btnOpenManageProfilesModal');
const btnCloseManageProfilesModal = document.getElementById('btnCloseManageProfilesModal');
const btnCloseManageProfilesDone = document.getElementById('btnCloseManageProfilesDone');
const profilesListContainer = document.getElementById('profilesListContainer');

function updateStatus(status) {
  if (status === 'connected') {
    isConnected = true;
    connStatusBadge.className = 'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
    connStatusBadge.firstElementChild.className = 'w-2 h-2 rounded-full bg-emerald-400';
    connStatusText.textContent = 'Terhubung';
  } else if (status === 'connecting') {
    isConnected = false;
    connStatusBadge.className = 'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20';
    connStatusBadge.firstElementChild.className = 'w-2 h-2 rounded-full bg-amber-400 animate-pulse';
    connStatusText.textContent = 'Menghubungkan';
  } else {
    isConnected = false;
    connStatusBadge.className = 'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20';
    connStatusBadge.firstElementChild.className = 'w-2 h-2 rounded-full bg-rose-400';
    connStatusText.textContent = 'Terputus';
  }
}

async function checkAuthStatus() {
  try {
    const res = await fetch('/api/auth/check');
    const data = await res.json();
    if (data.authenticated) {
      authOverlay.classList.add('hidden');
      await initializeDashboard();
    } else {
      authOverlay.classList.remove('hidden');
      pinInput.value = '';
      pinInput.focus();
    }
  } catch {
    authOverlay.classList.remove('hidden');
  }
}

authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const pin = pinInput.value.trim();
  authError.classList.add('hidden');

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin })
    });
    const data = await res.json();
    if (data.success) {
      authOverlay.classList.add('hidden');
      await initializeDashboard();
    } else {
      authError.textContent = data.error || 'PIN salah';
      authError.classList.remove('hidden');
      pinInput.focus();
    }
  } catch {
    authError.textContent = 'Gagal menghubungi server';
    authError.classList.remove('hidden');
  }
});

btnLogout.addEventListener('click', async () => {
  if (confirm('Yakin ingin logout dari dashboard?')) {
    await fetch('/api/auth/logout', { method: 'POST' });
    if (ws) {
      ws.close();
    }
    location.reload();
  }
});

async function loadProfiles() {
  try {
    const res = await fetch('/api/profiles');
    if (res.status === 401) {
      checkAuthStatus();
      return;
    }
    const data = await res.json();
    profilesList = data.profiles || [];

    profileSelect.innerHTML = '';
    profilesList.forEach((p) => {
      const option = document.createElement('option');
      option.value = p.id;
      option.textContent = p.name;
      if (p.id === activeProfileId) {
        option.selected = true;
      }
      profileSelect.appendChild(option);
    });

    if (!profilesList.some((p) => p.id === activeProfileId)) {
      activeProfileId = profilesList[0]?.id || 'default';
      localStorage.setItem('agy_active_profile', activeProfileId);
      profileSelect.value = activeProfileId;
    }
  } catch (err) {
    console.error(err);
  }
}

profileSelect.addEventListener('change', (e) => {
  const selectedId = e.target.value;
  if (selectedId !== activeProfileId) {
    switchActiveProfile(selectedId);
  }
});

function switchActiveProfile(newId) {
  activeProfileId = newId;
  localStorage.setItem('agy_active_profile', newId);
  connectWebSocket();
}

function initTerminal() {
  if (term) {
    return;
  }

  term = new Terminal({
    cursorBlink: true,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    fontSize: 13,
    lineHeight: 1.25,
    theme: {
      background: '#0d1117',
      foreground: '#c9d1d9',
      cursor: '#58a6ff',
      selectionBackground: '#1f6feb40',
      black: '#484f58',
      red: '#ff7b72',
      green: '#3fb950',
      yellow: '#d29922',
      blue: '#58a6ff',
      magenta: '#bc8cff',
      cyan: '#39c5cf',
      white: '#b1bac4',
      brightBlack: '#6e7681',
      brightRed: '#ffa198',
      brightGreen: '#56d364',
      brightYellow: '#e3b341',
      brightBlue: '#79c0ff',
      brightMagenta: '#d2a8ff',
      brightCyan: '#56d4dd',
      brightWhite: '#f0f6fc'
    }
  });

  fitAddon = new FitAddon.FitAddon();
  term.loadAddon(fitAddon);

  if (window.WebLinksAddon?.WebLinksAddon) {
    term.loadAddon(new window.WebLinksAddon.WebLinksAddon());
  }

  terminalContainer.innerHTML = '';
  term.open(terminalContainer);
  fitAddon.fit();

  term.onData((data) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  });

  window.addEventListener('resize', handleWindowResize);
}

function handleWindowResize() {
  if (fitAddon && term) {
    fitAddon.fit();
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'resize',
        cols: term.cols,
        rows: term.rows
      }));
    }
  }
}

function connectWebSocket() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  if (ws) {
    ws.onclose = null;
    ws.close();
    ws = null;
  }

  updateStatus('connecting');

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws/terminal?profile=${encodeURIComponent(activeProfileId)}`;

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    updateStatus('connected');
    if (term) {
      term.clear();
      fitAddon.fit();
      ws.send(JSON.stringify({
        type: 'resize',
        cols: term.cols,
        rows: term.rows
      }));
      term.focus();
    }
  };

  ws.onmessage = (event) => {
    if (term) {
      term.write(event.data);
    }
  };

  ws.onclose = () => {
    updateStatus('disconnected');
    reconnectTimer = setTimeout(() => {
      connectWebSocket();
    }, 3000);
  };

  ws.onerror = () => {
    updateStatus('disconnected');
  };
}

btnRestartSession.addEventListener('click', async () => {
  if (confirm(`Reset dan mulai ulang sesi untuk profil aktif (${profileSelect.options[profileSelect.selectedIndex]?.text || activeProfileId})?`)) {
    try {
      await fetch('/api/session/restart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: activeProfileId })
      });
      connectWebSocket();
    } catch (err) {
      console.error(err);
    }
  }
});

document.querySelectorAll('.key-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const key = btn.getAttribute('data-key');
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    switch (key) {
      case 'ctrl-c':
        ws.send('\x03');
        break;
      case 'tab':
        ws.send('\t');
        break;
      case 'esc':
        ws.send('\x1b');
        break;
      case 'up':
        ws.send('\x1b[A');
        break;
      case 'down':
        ws.send('\x1b[B');
        break;
      case 'enter':
        ws.send('\r');
        break;
    }
    if (term) term.focus();
  });
});

document.querySelectorAll('.cmd-chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    const cmd = chip.getAttribute('data-cmd');
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    ws.send(`${cmd}\r`);
    if (term) term.focus();
  });
});

btnOpenNewProfileModal.addEventListener('click', () => {
  newProfileForm.reset();
  newProfileModal.classList.remove('hidden');
  profileNameInput.focus();
});

btnCloseNewProfileModal.addEventListener('click', () => {
  newProfileModal.classList.add('hidden');
});

btnCancelNewProfile.addEventListener('click', () => {
  newProfileModal.classList.add('hidden');
});

newProfileForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = profileNameInput.value.trim();
  const note = profileNoteInput.value.trim();

  if (!name) return;

  try {
    const res = await fetch('/api/profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, note })
    });
    const data = await res.json();
    if (data.success && data.profile) {
      newProfileModal.classList.add('hidden');
      await loadProfiles();
      switchActiveProfile(data.profile.id);
    } else {
      alert(data.error || 'Gagal membuat profil akun');
    }
  } catch (err) {
    alert('Terjadi kesalahan jaringan');
  }
});

btnOpenManageProfilesModal.addEventListener('click', () => {
  renderManageProfilesList();
  manageProfilesModal.classList.remove('hidden');
});

btnCloseManageProfilesModal.addEventListener('click', () => {
  manageProfilesModal.classList.add('hidden');
});

btnCloseManageProfilesDone.addEventListener('click', () => {
  manageProfilesModal.classList.add('hidden');
});

function renderManageProfilesList() {
  profilesListContainer.innerHTML = '';
  profilesList.forEach((p) => {
    const item = document.createElement('div');
    item.className = 'flex items-center justify-between p-3 rounded-xl bg-darkbg border border-bordercol';

    const info = document.createElement('div');
    info.className = 'flex flex-col';

    const titleRow = document.createElement('div');
    titleRow.className = 'flex items-center gap-2';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'text-xs font-semibold text-white';
    nameSpan.textContent = p.name;
    titleRow.appendChild(nameSpan);

    if (p.id === activeProfileId) {
      const activeBadge = document.createElement('span');
      activeBadge.className = 'px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
      activeBadge.textContent = 'Aktif';
      titleRow.appendChild(activeBadge);
    }

    info.appendChild(titleRow);

    if (p.note) {
      const noteSpan = document.createElement('span');
      noteSpan.className = 'text-[11px] text-slate-400 mt-0.5';
      noteSpan.textContent = p.note;
      info.appendChild(noteSpan);
    }

    item.appendChild(info);

    const actions = document.createElement('div');
    actions.className = 'flex items-center gap-1.5';

    if (p.id !== 'default') {
      const btnDel = document.createElement('button');
      btnDel.className = 'p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-colors text-xs';
      btnDel.title = 'Hapus Akun';
      btnDel.innerHTML = '<i data-lucide="trash-2" class="w-3.5 h-3.5"></i>';
      btnDel.addEventListener('click', async () => {
        if (confirm(`Hapus akun "${p.name}"? Data token profil ini akan dihapus.`)) {
          await deleteProfile(p.id);
        }
      });
      actions.appendChild(btnDel);
    }

    item.appendChild(actions);
    profilesListContainer.appendChild(item);
  });

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

async function deleteProfile(id) {
  try {
    const res = await fetch(`/api/profiles/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      if (activeProfileId === id) {
        activeProfileId = 'default';
        localStorage.setItem('agy_active_profile', 'default');
      }
      await loadProfiles();
      renderManageProfilesList();
      if (activeProfileId === 'default') {
        connectWebSocket();
      }
    }
  } catch (err) {
    console.error(err);
  }
}

async function initializeDashboard() {
  await loadProfiles();
  initTerminal();
  connectWebSocket();
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) {
    window.lucide.createIcons();
  }
  checkAuthStatus();
});
