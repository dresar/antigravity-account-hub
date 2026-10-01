import express from 'express';
import { createServer } from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { exec } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import pty from 'node-pty';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3838', 10);
const AUTH_PIN = process.env.AUTH_PIN || '16799';
const PROFILES_DIR = process.env.PROFILES_DIR || path.join(__dirname, 'profiles');
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const PROFILES_FILE = path.join(DATA_DIR, 'profiles.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

fs.mkdirSync(PROFILES_DIR, { recursive: true });
fs.mkdirSync(DATA_DIR, { recursive: true });

function initializeDatabase() {
  if (!fs.existsSync(PROFILES_FILE)) {
    const initialProfiles = [
      {
        id: 'default',
        name: 'Akun Utama',
        note: 'Akun default Antigravity di VPS',
        createdAt: new Date().toISOString(),
        lastUsed: new Date().toISOString()
      }
    ];
    fs.writeFileSync(PROFILES_FILE, JSON.stringify(initialProfiles, null, 2), 'utf-8');
  }

  if (!fs.existsSync(CONFIG_FILE)) {
    const initialConfig = {
      activeProfileId: 'default'
    };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(initialConfig, null, 2), 'utf-8');
  }
}

initializeDatabase();

function readProfiles() {
  try {
    const raw = fs.readFileSync(PROFILES_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeProfiles(profiles) {
  fs.writeFileSync(PROFILES_FILE, JSON.stringify(profiles, null, 2), 'utf-8');
}

function readConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { activeProfileId: 'default' };
  }
}

function writeConfig(config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

function ensureProfileFolder(profileId) {
  const profilePath = path.join(PROFILES_DIR, profileId);
  fs.mkdirSync(profilePath, { recursive: true });
  fs.mkdirSync(path.join(profilePath, '.gemini', 'antigravity-cli'), { recursive: true });
  return profilePath;
}

function isProfileAuthenticated(profileId) {
  const profileDir = path.join(PROFILES_DIR, profileId);
  const geminiDir = path.join(profileDir, '.gemini');
  if (!fs.existsSync(geminiDir)) {
    return false;
  }

  const cliDir = path.join(geminiDir, 'antigravity-cli');
  if (!fs.existsSync(cliDir)) {
    return false;
  }

  try {
    const files = fs.readdirSync(cliDir);
    const hasHistory = files.includes('history.jsonl') || files.includes('conversation_summaries.db') || files.includes('presence');
    const hasAnyConfig = files.length > 2;
    return hasHistory || hasAnyConfig;
  } catch {
    return false;
  }
}

function setActiveProfileGlobal(profileId) {
  const profileDir = ensureProfileFolder(profileId);
  const profileGemini = path.join(profileDir, '.gemini');

  if (os.platform() === 'linux') {
    const rootGemini = path.join(os.homedir(), '.gemini');
    try {
      if (fs.existsSync(rootGemini) || fs.lstatSync(rootGemini).isSymbolicLink()) {
        fs.rmSync(rootGemini, { recursive: true, force: true });
      }
    } catch {}

    try {
      fs.symlinkSync(profileGemini, rootGemini, 'dir');
    } catch (err) {
      console.error(err);
    }
  }

  const config = readConfig();
  config.activeProfileId = profileId;
  writeConfig(config);

  const profiles = readProfiles();
  const target = profiles.find((p) => p.id === profileId);
  if (target) {
    target.lastUsed = new Date().toISOString();
    writeProfiles(profiles);
  }
}

const initialConfig = readConfig();
setActiveProfileGlobal(initialConfig.activeProfileId || 'default');

const pendingLoginSessions = new Map();

const app = express();
const server = createServer(app);

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

function authenticateRequest(req, res, next) {
  const token = req.cookies.auth_token || req.headers.authorization?.replace('Bearer ', '');
  if (token === AUTH_PIN) {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized' });
}

app.post('/api/auth/login', (req, res) => {
  const { pin } = req.body;
  if (pin === AUTH_PIN) {
    res.cookie('auth_token', AUTH_PIN, {
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000,
      sameSite: 'lax'
    });
    return res.json({ success: true });
  }
  return res.status(401).json({ error: 'PIN salah' });
});

app.get('/api/auth/check', (req, res) => {
  const token = req.cookies.auth_token || req.headers.authorization?.replace('Bearer ', '');
  return res.json({ authenticated: token === AUTH_PIN });
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('auth_token');
  return res.json({ success: true });
});

app.get('/api/profiles', authenticateRequest, (req, res) => {
  const profiles = readProfiles();
  const config = readConfig();

  const enrichedProfiles = profiles.map((p) => {
    return {
      ...p,
      isActive: p.id === config.activeProfileId,
      isAuthenticated: isProfileAuthenticated(p.id)
    };
  });

  return res.json({
    activeProfileId: config.activeProfileId,
    profiles: enrichedProfiles
  });
});

app.post('/api/profiles/active', authenticateRequest, (req, res) => {
  const { profileId } = req.body;
  if (!profileId) {
    return res.status(400).json({ error: 'Profile ID harus diisi' });
  }

  const profiles = readProfiles();
  const exists = profiles.some((p) => p.id === profileId);
  if (!exists) {
    return res.status(404).json({ error: 'Profil tidak ditemukan' });
  }

  setActiveProfileGlobal(profileId);
  return res.json({ success: true, activeProfileId: profileId });
});

app.post('/api/profiles/start-login', authenticateRequest, async (req, res) => {
  const { profileName, note, existingProfileId } = req.body;

  let targetId = existingProfileId;
  const profiles = readProfiles();

  if (!targetId) {
    if (!profileName || typeof profileName !== 'string') {
      return res.status(400).json({ error: 'Nama akun harus diisi' });
    }

    const idSlug = profileName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || `acc-${Date.now()}`;

    targetId = idSlug;
    let counter = 1;
    while (profiles.some((p) => p.id === targetId)) {
      targetId = `${idSlug}-${counter}`;
      counter++;
    }

    ensureProfileFolder(targetId);

    const newProfile = {
      id: targetId,
      name: profileName.trim(),
      note: (note || '').trim(),
      createdAt: new Date().toISOString(),
      lastUsed: new Date().toISOString()
    };

    profiles.push(newProfile);
    writeProfiles(profiles);
  }

  const profileDir = ensureProfileFolder(targetId);
  const sessionId = `login_${targetId}_${Date.now()}`;

  const isWindows = os.platform() === 'win32';
  const spawnCmd = isWindows ? 'cmd.exe' : 'bash';
  const spawnArgs = isWindows
    ? ['/c', 'agy']
    : ['-c', `export HOME='${profileDir}'; exec agy`];

  let ptyProcess = null;
  try {
    ptyProcess = pty.spawn(spawnCmd, spawnArgs, {
      name: 'xterm-color',
      cols: 100,
      rows: 30,
      cwd: profileDir,
      env: {
        ...process.env,
        HOME: profileDir,
        USERPROFILE: profileDir,
        TERM: 'xterm-color'
      }
    });
  } catch (spawnError) {
    return res.status(500).json({ error: 'Gagal menjalankan proses CLI' });
  }

  let capturedAuthUrl = null;
  let buffer = '';
  let sentEnter = false;

  const sessionData = {
    sessionId,
    profileId: targetId,
    ptyProcess,
    buffer: '',
    createdAt: Date.now()
  };

  pendingLoginSessions.set(sessionId, sessionData);

  const urlPromise = new Promise((resolve) => {
    const dataHandler = (chunk) => {
      buffer += chunk;
      sessionData.buffer += chunk;

      if (!sentEnter && (buffer.includes('Google OAuth') || buffer.includes('Select login method'))) {
        sentEnter = true;
        ptyProcess.write('\r');
      }

      const match = buffer.match(/(https:\/\/accounts\.google\.com\/o\/oauth2\/auth\S+)/);
      if (match) {
        capturedAuthUrl = match[1].replace(/[\r\n\x1b].*$/, '');
        resolve(capturedAuthUrl);
      }
    };

    ptyProcess.onData(dataHandler);

    setTimeout(() => {
      resolve(capturedAuthUrl);
    }, 8000);
  });

  const authUrl = await urlPromise;

  if (!authUrl) {
    ptyProcess.kill();
    pendingLoginSessions.delete(sessionId);
    return res.status(500).json({
      error: 'Gagal mendapatkan link login dari Antigravity CLI. Coba beberapa saat lagi.'
    });
  }

  return res.json({
    success: true,
    sessionId,
    profileId: targetId,
    authUrl
  });
});

app.post('/api/profiles/submit-code', authenticateRequest, async (req, res) => {
  const { sessionId, code } = req.body;
  if (!sessionId || !code) {
    return res.status(400).json({ error: 'Session ID dan Kode Otorisasi harus diisi' });
  }

  const session = pendingLoginSessions.get(sessionId);
  if (!session || !session.ptyProcess) {
    return res.status(404).json({ error: 'Sesi login telah kedaluwarsa. Silakan mulai ulang.' });
  }

  const cleanCode = code.trim();
  session.ptyProcess.write(`${cleanCode}\r`);

  const verificationPromise = new Promise((resolve) => {
    let checkCount = 0;
    const interval = setInterval(() => {
      checkCount++;
      const authenticated = isProfileAuthenticated(session.profileId);
      if (authenticated || checkCount >= 10) {
        clearInterval(interval);
        resolve(authenticated);
      }
    }, 1000);
  });

  const isSuccess = await verificationPromise;

  try {
    session.ptyProcess.kill();
  } catch {}
  pendingLoginSessions.delete(sessionId);

  if (isSuccess) {
    setActiveProfileGlobal(session.profileId);
    return res.json({
      success: true,
      message: 'Akun berhasil terautentikasi dan dijadikan akun aktif di VPS'
    });
  }

  return res.json({
    success: true,
    message: 'Kode telah dikirimkan ke CLI'
  });
});

app.post('/api/profiles/logout', authenticateRequest, (req, res) => {
  const { profileId } = req.body;
  if (!profileId) {
    return res.status(400).json({ error: 'Profile ID harus diisi' });
  }

  const profileDir = path.join(PROFILES_DIR, profileId);
  const geminiDir = path.join(profileDir, '.gemini');

  try {
    if (fs.existsSync(geminiDir)) {
      fs.rmSync(geminiDir, { recursive: true, force: true });
      fs.mkdirSync(geminiDir, { recursive: true });
    }
  } catch (err) {
    return res.status(500).json({ error: 'Gagal membersihkan sesi akun' });
  }

  return res.json({ success: true, message: 'Akun berhasil di-logout' });
});

app.delete('/api/profiles/:id', authenticateRequest, (req, res) => {
  const { id } = req.params;
  if (id === 'default') {
    return res.status(400).json({ error: 'Profil default tidak boleh dihapus' });
  }

  const config = readConfig();
  if (config.activeProfileId === id) {
    setActiveProfileGlobal('default');
  }

  let profiles = readProfiles();
  profiles = profiles.filter((p) => p.id !== id);
  writeProfiles(profiles);

  const profileDir = path.join(PROFILES_DIR, id);
  try {
    if (fs.existsSync(profileDir)) {
      fs.rmSync(profileDir, { recursive: true, force: true });
    }
  } catch {}

  return res.json({ success: true });
});

app.get('/api/system/status', authenticateRequest, (req, res) => {
  const uptimeSeconds = os.uptime();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const config = readConfig();

  exec('which agy', (error, stdout) => {
    const agyPath = stdout.trim() || 'agy';
    return res.json({
      platform: os.platform(),
      hostname: os.hostname(),
      uptime: uptimeSeconds,
      memory: {
        totalMb: Math.round(totalMem / (1024 * 1024)),
        usedMb: Math.round(usedMem / (1024 * 1024)),
        freeMb: Math.round(freeMem / (1024 * 1024))
      },
      agyPath,
      activeProfileId: config.activeProfileId
    });
  });
});

app.post('/api/system/test-cli', authenticateRequest, (req, res) => {
  exec('agy models', { timeout: 8000 }, (error, stdout, stderr) => {
    const output = (stdout || stderr || '').trim();
    const isReady = output.includes('Gemini') || output.includes('Available models');
    return res.json({
      success: !error && isReady,
      output: output.slice(0, 300)
    });
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Antigravity Account Hub running on http://0.0.0.0:${PORT}`);
});
