let currentProfiles = [];
let currentActiveProfileId = 'default';
let activeLoginSessionId = null;
let targetLoginProfileId = null;

const authOverlay = document.getElementById('authOverlay');
const authForm = document.getElementById('authForm');
const pinInput = document.getElementById('pinInput');
const authError = document.getElementById('authError');
const btnLogout = document.getElementById('btnLogout');

const activeAccountTitle = document.getElementById('activeAccountTitle');
const activeAccountNote = document.getElementById('activeAccountNote');
const activeAccountSyncTime = document.getElementById('activeAccountSyncTime');
const totalAccountsBadge = document.getElementById('totalAccountsBadge');
const accountsGrid = document.getElementById('accountsGrid');
const btnTestCli = document.getElementById('btnTestCli');
const cliTestResult = document.getElementById('cliTestResult');

const newAccountModal = document.getElementById('newAccountModal');
const btnOpenNewAccountModal = document.getElementById('btnOpenNewAccountModal');
const btnCloseNewAccountModal = document.getElementById('btnCloseNewAccountModal');
const btnCancelStep1 = document.getElementById('btnCancelStep1');
const btnCancelStep3 = document.getElementById('btnCancelStep3');
const wizardStep1 = document.getElementById('wizardStep1');
const wizardStep2 = document.getElementById('wizardStep2');
const wizardStep3 = document.getElementById('wizardStep3');
const newAccName = document.getElementById('newAccName');
const newAccNote = document.getElementById('newAccNote');
const btnStartLoginFlow = document.getElementById('btnStartLoginFlow');
const googleOAuthLink = document.getElementById('googleOAuthLink');
const authCodeInput = document.getElementById('authCodeInput');
const btnSubmitAuthCode = document.getElementById('btnSubmitAuthCode');

const sysModal = document.getElementById('sysModal');
const btnOpenSysModal = document.getElementById('btnOpenSysModal');
const btnCloseSysModal = document.getElementById('btnCloseSysModal');
const btnCloseSysModalDone = document.getElementById('btnCloseSysModalDone');
const sysHost = document.getElementById('sysHost');
const sysRam = document.getElementById('sysRam');
const sysAgyPath = document.getElementById('sysAgyPath');
const sysActiveAcc = document.getElementById('sysActiveAcc');

const toast = document.getElementById('toast');
const toastMsg = document.getElementById('toastMsg');
const toastIcon = document.getElementById('toastIcon');

function showToast(message, isError = false) {
  toastMsg.textContent = message;
  toastIcon.setAttribute('data-lucide', isError ? 'alert-triangle' : 'check');
  toastIcon.className = `w-4 h-4 ${isError ? 'text-rose-400' : 'text-emerald-400'}`;
  toast.className = `fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-xl bg-cardbg border ${isError ? 'border-rose-500/40 text-rose-200' : 'border-emerald-500/40 text-emerald-200'} shadow-2xl text-xs font-medium flex items-center gap-2 transform translate-y-0 opacity-100 transition-all duration-200`;

  if (window.lucide) {
    window.lucide.createIcons();
  }

  setTimeout(() => {
    toast.className = 'fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-xl bg-cardbg border border-bordercol shadow-2xl text-xs font-medium text-white flex items-center gap-2 transform translate-y-20 opacity-0 transition-all duration-200 pointer-events-none';
  }, 3500);
}

async function checkAuthStatus() {
  try {
    const res = await fetch('/api/auth/check');
    const data = await res.json();
    if (data.authenticated) {
      authOverlay.classList.add('hidden');
      await refreshDashboard();
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
      await refreshDashboard();
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
    location.reload();
  }
});

async function refreshDashboard() {
  try {
    const res = await fetch('/api/profiles');
    if (res.status === 401) {
      checkAuthStatus();
      return;
    }
    const data = await res.json();
    currentProfiles = data.profiles || [];
    currentActiveProfileId = data.activeProfileId || 'default';

    renderActiveHero();
    renderAccountsGrid();
  } catch (err) {
    showToast('Gagal memuat profil akun', true);
  }
}

function renderActiveHero() {
  const activeProfile = currentProfiles.find((p) => p.id === currentActiveProfileId) || {
    name: 'Akun Utama',
    note: 'Belum ada profil aktif',
    isAuthenticated: false
  };

  activeAccountTitle.textContent = activeProfile.name;
  activeAccountNote.textContent = activeProfile.note || 'Akun ini sedang aktif terhubung ke Antigravity CLI di VPS.';
  activeAccountSyncTime.textContent = activeProfile.lastUsed ? `Sinkron: ${new Date(activeProfile.lastUsed).toLocaleTimeString('id-ID')}` : '';

  totalAccountsBadge.textContent = `${currentProfiles.length} Akun Tersimpan`;
}

function renderAccountsGrid() {
  accountsGrid.innerHTML = '';

  currentProfiles.forEach((p) => {
    const card = document.createElement('div');
    const isActive = p.id === currentActiveProfileId;

    card.className = `p-5 rounded-2xl bg-cardbg border ${isActive ? 'border-brand-500/50 ring-1 ring-brand-500/20 shadow-lg shadow-brand-500/5' : 'border-bordercol hover:border-slate-600'} transition-all flex flex-col justify-between gap-4`;

    const topDiv = document.createElement('div');
    topDiv.className = 'space-y-3';

    const headerRow = document.createElement('div');
    headerRow.className = 'flex items-start justify-between gap-2';

    const titleGroup = document.createElement('div');
    titleGroup.className = 'flex items-center gap-2.5';

    const avatar = document.createElement('div');
    avatar.className = `w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${isActive ? 'bg-brand-600 text-white shadow-md shadow-brand-500/30' : 'bg-panelbg border border-bordercol text-slate-300'}`;
    avatar.textContent = p.name.slice(0, 2).toUpperCase();

    const titleSubGroup = document.createElement('div');
    const nameEl = document.createElement('h4');
    nameEl.className = 'font-bold text-xs text-white';
    nameEl.textContent = p.name;

    const idEl = document.createElement('span');
    idEl.className = 'text-[10px] font-mono text-slate-400 block';
    idEl.textContent = `@${p.id}`;

    titleSubGroup.appendChild(nameEl);
    titleSubGroup.appendChild(idEl);
    titleGroup.appendChild(avatar);
    titleGroup.appendChild(titleSubGroup);

    const badgeGroup = document.createElement('div');
    badgeGroup.className = 'flex flex-col items-end gap-1';

    if (isActive) {
      const activePill = document.createElement('span');
      activePill.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30';
      activePill.textContent = 'Aktif di VPS';
      badgeGroup.appendChild(activePill);
    }

    const authStatusPill = document.createElement('span');
    authStatusPill.className = `px-2 py-0.5 rounded-full text-[10px] font-medium ${p.isAuthenticated ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`;
    authStatusPill.textContent = p.isAuthenticated ? 'Terhubung' : 'Perlu Login';
    badgeGroup.appendChild(authStatusPill);

    headerRow.appendChild(titleGroup);
    headerRow.appendChild(badgeGroup);

    const noteEl = document.createElement('p');
    noteEl.className = 'text-xs text-slate-400 line-clamp-2';
    noteEl.textContent = p.note || 'Tidak ada catatan khusus untuk akun ini.';

    topDiv.appendChild(headerRow);
    topDiv.appendChild(noteEl);

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'pt-3 border-t border-bordercol/80 flex items-center justify-between gap-1.5';

    const leftActions = document.createElement('div');
    leftActions.className = 'flex items-center gap-1.5';

    if (!isActive) {
      const btnSetActive = document.createElement('button');
      btnSetActive.className = 'h-7 px-2.5 rounded-lg bg-brand-600/90 hover:bg-brand-500 text-white font-medium text-[11px] flex items-center gap-1 transition-all active:scale-95';
      btnSetActive.innerHTML = '<i data-lucide="check" class="w-3 h-3"></i><span>Gunakan Akun</span>';
      btnSetActive.addEventListener('click', () => setActiveProfile(p.id));
      leftActions.appendChild(btnSetActive);
    }

    const btnReAuth = document.createElement('button');
    btnReAuth.className = 'h-7 px-2.5 rounded-lg bg-panelbg border border-bordercol hover:border-slate-500 text-slate-300 hover:text-white text-[11px] font-medium flex items-center gap-1 transition-colors';
    btnReAuth.title = 'Hubungkan / Login Ulang Google';
    btnReAuth.innerHTML = '<i data-lucide="key-round" class="w-3 h-3 text-blue-400"></i><span>Login</span>';
    btnReAuth.addEventListener('click', () => startReAuthForProfile(p.id, p.name));
    leftActions.appendChild(btnReAuth);

    const rightActions = document.createElement('div');
    rightActions.className = 'flex items-center gap-1';

    if (p.isAuthenticated) {
      const btnLogoutAcc = document.createElement('button');
      btnLogoutAcc.className = 'h-7 w-7 rounded-lg bg-panelbg border border-bordercol hover:border-amber-500/40 text-slate-400 hover:text-amber-400 flex items-center justify-center transition-colors';
      btnLogoutAcc.title = 'Logout Sesi Akun Ini';
      btnLogoutAcc.innerHTML = '<i data-lucide="log-out" class="w-3 h-3"></i>';
      btnLogoutAcc.addEventListener('click', () => logoutProfile(p.id, p.name));
      rightActions.appendChild(btnLogoutAcc);
    }

    if (p.id !== 'default') {
      const btnDeleteAcc = document.createElement('button');
      btnDeleteAcc.className = 'h-7 w-7 rounded-lg bg-panelbg border border-bordercol hover:border-rose-500/40 text-slate-400 hover:text-rose-400 flex items-center justify-center transition-colors';
      btnDeleteAcc.title = 'Hapus Profil Akun';
      btnDeleteAcc.innerHTML = '<i data-lucide="trash-2" class="w-3 h-3"></i>';
      btnDeleteAcc.addEventListener('click', () => deleteProfile(p.id, p.name));
      rightActions.appendChild(btnDeleteAcc);
    }

    actionsDiv.appendChild(leftActions);
    actionsDiv.appendChild(rightActions);

    card.appendChild(topDiv);
    card.appendChild(actionsDiv);
    accountsGrid.appendChild(card);
  });

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

async function setActiveProfile(profileId) {
  try {
    const res = await fetch('/api/profiles/active', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileId })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Akun aktif di VPS berhasil dialihkan');
      await refreshDashboard();
    } else {
      showToast(data.error || 'Gagal mengubah akun aktif', true);
    }
  } catch {
    showToast('Terjadi kesalahan jaringan', true);
  }
}

async function logoutProfile(profileId, profileName) {
  if (!confirm(`Logout sesi Google untuk akun "${profileName}"? Kredensial lokal akan dibersihkan.`)) {
    return;
  }

  try {
    const res = await fetch('/api/profiles/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileId })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Akun "${profileName}" berhasil di-logout`);
      await refreshDashboard();
    } else {
      showToast(data.error || 'Gagal logout akun', true);
    }
  } catch {
    showToast('Terjadi kesalahan jaringan', true);
  }
}

async function deleteProfile(profileId, profileName) {
  if (!confirm(`Hapus permanen akun "${profileName}" dari daftar?`)) {
    return;
  }

  try {
    const res = await fetch(`/api/profiles/${profileId}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast(`Akun "${profileName}" telah dihapus`);
      await refreshDashboard();
    } else {
      showToast(data.error || 'Gagal menghapus akun', true);
    }
  } catch {
    showToast('Terjadi kesalahan jaringan', true);
  }
}

btnTestCli.addEventListener('click', async () => {
  btnTestCli.disabled = true;
  cliTestResult.classList.remove('hidden');
  cliTestResult.innerHTML = '<span class="text-blue-400 animate-pulse">Menghubungi CLI Antigravity di VPS...</span>';

  try {
    const res = await fetch('/api/system/test-cli', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      cliTestResult.innerHTML = `<span class="text-emerald-400 font-bold">✓ Kredensial Valid & Siap Digunakan!</span><br><span class="text-slate-400">${data.output}</span>`;
      showToast('Token CLI aktif dan valid!');
    } else {
      cliTestResult.innerHTML = `<span class="text-amber-400 font-bold">⚠️ Perhatian:</span><br><span class="text-slate-400">${data.output || 'Silakan lakukan login Google untuk mengaktifkan akun.'}</span>`;
      showToast('Akun belum terautentikasi', true);
    }
  } catch {
    cliTestResult.innerHTML = '<span class="text-rose-400">Gagal menguji CLI. Pastikan server VPS berjalan normal.</span>';
    showToast('Gagal terhubung ke CLI', true);
  } finally {
    btnTestCli.disabled = false;
  }
});

btnOpenNewAccountModal.addEventListener('click', () => {
  targetLoginProfileId = null;
  newAccName.value = '';
  newAccNote.value = '';
  newAccName.disabled = false;
  newAccNote.disabled = false;
  authCodeInput.value = '';

  wizardStep1.classList.remove('hidden');
  wizardStep2.classList.add('hidden');
  wizardStep3.classList.add('hidden');

  newAccountModal.classList.remove('hidden');
  newAccName.focus();
});

function startReAuthForProfile(profileId, profileName) {
  targetLoginProfileId = profileId;
  newAccName.value = profileName;
  newAccNote.value = 'Login ulang profil';
  newAccName.disabled = true;
  newAccNote.disabled = true;
  authCodeInput.value = '';

  wizardStep1.classList.remove('hidden');
  wizardStep2.classList.add('hidden');
  wizardStep3.classList.add('hidden');

  newAccountModal.classList.remove('hidden');
}

btnCloseNewAccountModal.addEventListener('click', () => {
  newAccountModal.classList.add('hidden');
});

btnCancelStep1.addEventListener('click', () => {
  newAccountModal.classList.add('hidden');
});

btnCancelStep3.addEventListener('click', () => {
  newAccountModal.classList.add('hidden');
});

btnStartLoginFlow.addEventListener('click', async () => {
  const name = newAccName.value.trim();
  const note = newAccNote.value.trim();

  if (!name && !targetLoginProfileId) {
    alert('Nama akun harus diisi');
    return;
  }

  wizardStep1.classList.add('hidden');
  wizardStep2.classList.remove('hidden');

  try {
    const res = await fetch('/api/profiles/start-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profileName: name,
        note,
        existingProfileId: targetLoginProfileId
      })
    });
    const data = await res.json();
    if (data.success && data.authUrl) {
      activeLoginSessionId = data.sessionId;
      googleOAuthLink.href = data.authUrl;

      wizardStep2.classList.add('hidden');
      wizardStep3.classList.remove('hidden');
      authCodeInput.focus();
    } else {
      alert(data.error || 'Gagal memulai otentikasi Google');
      wizardStep2.classList.add('hidden');
      wizardStep1.classList.remove('hidden');
    }
  } catch {
    alert('Terjadi kesalahan saat memulai sesi');
    wizardStep2.classList.add('hidden');
    wizardStep1.classList.remove('hidden');
  }
});

btnSubmitAuthCode.addEventListener('click', async () => {
  const code = authCodeInput.value.trim();
  if (!code) {
    alert('Silakan tempelkan kode otorisasi dari Google terlebih dahulu');
    return;
  }

  btnSubmitAuthCode.disabled = true;
  btnSubmitAuthCode.innerHTML = '<span class="animate-pulse">Memverifikasi...</span>';

  try {
    const res = await fetch('/api/profiles/submit-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: activeLoginSessionId,
        code
      })
    });
    const data = await res.json();
    if (data.success) {
      newAccountModal.classList.add('hidden');
      showToast(data.message || 'Akun berhasil terhubung!');
      await refreshDashboard();
    } else {
      alert(data.error || 'Gagal memverifikasi kode');
    }
  } catch {
    alert('Terjadi kesalahan jaringan saat verifikasi');
  } finally {
    btnSubmitAuthCode.disabled = false;
    btnSubmitAuthCode.innerHTML = '<i data-lucide="check-circle" class="w-3.5 h-3.5"></i><span>Verifikasi & Simpan Akun</span>';
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }
});

btnOpenSysModal.addEventListener('click', async () => {
  try {
    const res = await fetch('/api/system/status');
    const data = await res.json();
    sysHost.textContent = data.hostname || '-';
    sysRam.textContent = `${data.memory.usedMb} MB / ${data.memory.totalMb} MB`;
    sysAgyPath.textContent = data.agyPath || 'agy';
    sysActiveAcc.textContent = `@${data.activeProfileId || 'default'}`;

    sysModal.classList.remove('hidden');
  } catch {
    showToast('Gagal memuat status sistem', true);
  }
});

btnCloseSysModal.addEventListener('click', () => {
  sysModal.classList.add('hidden');
});

btnCloseSysModalDone.addEventListener('click', () => {
  sysModal.classList.add('hidden');
});

window.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) {
    window.lucide.createIcons();
  }
  checkAuthStatus();
});
