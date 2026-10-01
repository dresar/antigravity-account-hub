let currentIdentity = null;
let activeSessionId = null;

const authOverlay = document.getElementById('authOverlay');
const authForm = document.getElementById('authForm');
const pinInput = document.getElementById('pinInput');
const authError = document.getElementById('authError');
const btnLogout = document.getElementById('btnLogout');

const headerStatusBadge = document.getElementById('headerStatusBadge');
const headerStatusText = document.getElementById('headerStatusText');

const accountAvatar = document.getElementById('accountAvatar');
const accountEmail = document.getElementById('accountEmail');
const accountBadge = document.getElementById('accountBadge');
const accountName = document.getElementById('accountName');
const accountNotes = document.getElementById('accountNotes');
const loginBtnLabel = document.getElementById('loginBtnLabel');
const btnOpenLoginModal = document.getElementById('btnOpenLoginModal');
const btnDisconnect = document.getElementById('btnDisconnect');
const btnTestCli = document.getElementById('btnTestCli');
const cliTestOutput = document.getElementById('cliTestOutput');

const infoProvider = document.getElementById('infoProvider');
const infoConnectedAt = document.getElementById('infoConnectedAt');
const infoVerifiedAt = document.getElementById('infoVerifiedAt');

const sysHostname = document.getElementById('sysHostname');
const sysMemory = document.getElementById('sysMemory');
const sysUptime = document.getElementById('sysUptime');

const loginModal = document.getElementById('loginModal');
const btnCloseLoginModal = document.getElementById('btnCloseLoginModal');
const btnCancelInit = document.getElementById('btnCancelInit');
const btnCancelVerify = document.getElementById('btnCancelVerify');
const stepInit = document.getElementById('stepInit');
const stepLoading = document.getElementById('stepLoading');
const stepVerify = document.getElementById('stepVerify');
const inputEmail = document.getElementById('inputEmail');
const inputName = document.getElementById('inputName');
const btnRequestOAuthUrl = document.getElementById('btnRequestOAuthUrl');
const linkGoogleOAuth = document.getElementById('linkGoogleOAuth');
const btnCopyUrl = document.getElementById('btnCopyUrl');
const inputAuthCode = document.getElementById('inputAuthCode');
const btnSubmitCode = document.getElementById('btnSubmitCode');

const toast = document.getElementById('toast');
const toastMsg = document.getElementById('toastMsg');
const toastIcon = document.getElementById('toastIcon');

function showToast(message, isError = false) {
  toastMsg.textContent = message;
  toastIcon.setAttribute('data-lucide', isError ? 'alert-triangle' : 'check');
  toastIcon.className = `w-4 h-4 ${isError ? 'text-rose-400' : 'text-emerald-400'}`;
  toast.className = `fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-xl bg-surface-card border ${isError ? 'border-rose-500/40 text-rose-200' : 'border-emerald-500/40 text-emerald-200'} shadow-2xl text-xs font-medium flex items-center gap-2 transform translate-y-0 opacity-100 transition-all duration-200`;

  if (window.lucide) {
    window.lucide.createIcons();
  }

  setTimeout(() => {
    toast.className = 'fixed bottom-5 right-5 z-50 px-4 py-2 rounded-lg bg-surface-card border border-surface-border shadow-xl text-xs font-medium text-white flex items-center gap-2 transform translate-y-16 opacity-0 transition-all duration-200 pointer-events-none';
  }, 3500);
}

function formatDateTime(isoString) {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    return d.toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return isoString;
  }
}

async function checkAuthStatus() {
  try {
    const res = await fetch('/api/auth/check');
    const data = await res.json();
    if (data.authenticated) {
      authOverlay.classList.add('hidden');
      await loadIdentity();
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
      await loadIdentity();
    } else {
      authError.textContent = data.error || 'PIN yang dimasukkan salah';
      authError.classList.remove('hidden');
      pinInput.focus();
    }
  } catch {
    authError.textContent = 'Gagal menghubungi server';
    authError.classList.remove('hidden');
  }
});

btnLogout.addEventListener('click', async () => {
  if (confirm('Keluar dari dashboard ini?')) {
    await fetch('/api/auth/logout', { method: 'POST' });
    location.reload();
  }
});

async function loadIdentity() {
  try {
    const res = await fetch('/api/identity');
    if (res.status === 401) {
      checkAuthStatus();
      return;
    }
    const data = await res.json();
    currentIdentity = data.identity || {};

    if (data.system) {
      sysHostname.textContent = data.system.hostname || '-';
      sysMemory.textContent = `${data.system.memory.usedMb} MB / ${data.system.memory.totalMb} MB`;
      const hours = Math.floor(data.system.uptime / 3600);
      const minutes = Math.floor((data.system.uptime % 3600) / 60);
      sysUptime.textContent = `${hours} jam ${minutes} menit`;
    }

    renderIdentity();
  } catch {
    showToast('Gagal memuat status identitas akun', true);
  }
}

function renderIdentity() {
  const isConnected = currentIdentity.status === 'connected';

  if (isConnected) {
    headerStatusBadge.className = 'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
    headerStatusBadge.firstElementChild.className = 'w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse';
    headerStatusText.textContent = 'Terhubung';

    accountAvatar.className = 'w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center font-bold text-sm shrink-0';
    accountAvatar.textContent = (currentIdentity.name || currentIdentity.email || 'G').slice(0, 1).toUpperCase();

    accountEmail.textContent = currentIdentity.email || 'Akun Google Terautentikasi';
    accountBadge.className = 'px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30';
    accountBadge.textContent = 'Aktif di CLI VPS';

    accountName.textContent = currentIdentity.name ? `Pemilik: ${currentIdentity.name}` : '';
    accountNotes.textContent = currentIdentity.notes || 'Kredensial disimpan permanen di basis data identitas JSON.';

    loginBtnLabel.textContent = 'Ganti Akun';
    btnDisconnect.classList.remove('hidden');
  } else {
    headerStatusBadge.className = 'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20';
    headerStatusBadge.firstElementChild.className = 'w-1.5 h-1.5 rounded-full bg-amber-400';
    headerStatusText.textContent = 'Belum Terhubung';

    accountAvatar.className = 'w-12 h-12 rounded-xl bg-slate-800 text-slate-400 border border-slate-700 flex items-center justify-center font-bold text-sm shrink-0';
    accountAvatar.textContent = '?';

    accountEmail.textContent = 'Belum Ada Akun Terhubung';
    accountBadge.className = 'px-2 py-0.5 rounded-md text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20';
    accountBadge.textContent = 'Perlu Login Google';

    accountName.textContent = 'Klik tombol "Hubungkan Akun" di sebelah kanan untuk memulai otentikasi.';
    accountNotes.textContent = 'Setelah login, identitas akun akan otomatis dicatat ke data/identity.json.';

    loginBtnLabel.textContent = 'Hubungkan Akun';
    btnDisconnect.classList.add('hidden');
  }

  infoProvider.textContent = currentIdentity.provider || 'Google OAuth';
  infoConnectedAt.textContent = formatDateTime(currentIdentity.createdAt);
  infoVerifiedAt.textContent = formatDateTime(currentIdentity.lastVerifiedAt);

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

btnTestCli.addEventListener('click', async () => {
  btnTestCli.disabled = true;
  cliTestOutput.classList.remove('hidden');
  cliTestOutput.innerHTML = '<span class="text-blue-400 animate-pulse">Menghubungi Antigravity CLI di VPS...</span>';

  try {
    const res = await fetch('/api/system/test-cli', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      cliTestOutput.innerHTML = `<span class="text-emerald-400 font-bold">✓ Kredensial Valid & Siap Digunakan!</span><br><span class="text-slate-400">${data.output}</span>`;
      showToast('Token CLI aktif dan siap dipakai');
    } else {
      cliTestOutput.innerHTML = `<span class="text-amber-400 font-bold">⚠️ Perhatian:</span><br><span class="text-slate-400">${data.output || 'Akun belum terotentikasi. Silakan lakukan login Google.'}</span>`;
      showToast('Kredensial belum aktif', true);
    }
    await loadIdentity();
  } catch {
    cliTestOutput.innerHTML = '<span class="text-rose-400">Gagal menguji CLI di server.</span>';
    showToast('Gagal terhubung ke CLI', true);
  } finally {
    btnTestCli.disabled = false;
  }
});

btnDisconnect.addEventListener('click', async () => {
  if (!confirm('Putuskan sambungan akun Google dari Antigravity CLI? Token di server akan dibersihkan.')) {
    return;
  }

  try {
    const res = await fetch('/api/auth/disconnect', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast('Sambungan akun berhasil diputuskan');
      cliTestOutput.classList.add('hidden');
      await loadIdentity();
    } else {
      showToast(data.error || 'Gagal memutuskan akun', true);
    }
  } catch {
    showToast('Terjadi kesalahan jaringan', true);
  }
});

btnOpenLoginModal.addEventListener('click', () => {
  inputEmail.value = currentIdentity.email || '';
  inputName.value = currentIdentity.name || '';
  inputAuthCode.value = '';

  stepInit.classList.remove('hidden');
  stepLoading.classList.add('hidden');
  stepVerify.classList.add('hidden');

  loginModal.classList.remove('hidden');
  inputEmail.focus();
});

btnCloseLoginModal.addEventListener('click', () => {
  loginModal.classList.add('hidden');
});

btnCancelInit.addEventListener('click', () => {
  loginModal.classList.add('hidden');
});

btnCancelVerify.addEventListener('click', () => {
  loginModal.classList.add('hidden');
});

btnRequestOAuthUrl.addEventListener('click', async () => {
  const email = inputEmail.value.trim();
  const name = inputName.value.trim();

  stepInit.classList.add('hidden');
  stepLoading.classList.remove('hidden');

  try {
    const res = await fetch('/api/auth/start-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name })
    });
    const data = await res.json();
    if (data.success && data.authUrl) {
      activeSessionId = data.sessionId;
      linkGoogleOAuth.href = data.authUrl;

      stepLoading.classList.add('hidden');
      stepVerify.classList.remove('hidden');
      inputAuthCode.focus();
    } else {
      alert(data.error || 'Gagal mengambil tautan otorisasi Google');
      stepLoading.classList.add('hidden');
      stepInit.classList.remove('hidden');
    }
  } catch {
    alert('Terjadi kesalahan jaringan');
    stepLoading.classList.add('hidden');
    stepInit.classList.remove('hidden');
  }
});

btnCopyUrl.addEventListener('click', () => {
  if (linkGoogleOAuth.href && linkGoogleOAuth.href !== '#') {
    navigator.clipboard.writeText(linkGoogleOAuth.href);
    showToast('Tautan login Google berhasil disalin');
  }
});

btnSubmitCode.addEventListener('click', async () => {
  const code = inputAuthCode.value.trim();
  const email = inputEmail.value.trim();
  const name = inputName.value.trim();

  if (!code) {
    alert('Silakan tempelkan kode otorisasi dari Google terlebih dahulu');
    return;
  }

  btnSubmitCode.disabled = true;
  btnSubmitCode.innerHTML = '<span class="animate-pulse">Memverifikasi kode...</span>';

  try {
    const res = await fetch('/api/auth/submit-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: activeSessionId,
        code,
        email,
        name
      })
    });
    const data = await res.json();
    if (data.success) {
      loginModal.classList.add('hidden');
      showToast(data.message || 'Akun Google berhasil terhubung');
      cliTestOutput.classList.add('hidden');
      await loadIdentity();
    } else {
      alert(data.error || 'Verifikasi kode otorisasi gagal');
    }
  } catch {
    alert('Terjadi kesalahan saat memverifikasi kode');
  } finally {
    btnSubmitCode.disabled = false;
    btnSubmitCode.innerHTML = '<i data-lucide="check-circle" class="w-3.5 h-3.5"></i><span>Verifikasi & Simpan</span>';
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }
});

window.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) {
    window.lucide.createIcons();
  }
  checkAuthStatus();
});
