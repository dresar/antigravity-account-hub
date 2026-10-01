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
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const PROFILES_DIR = process.env.PROFILES_DIR || path.join(__dirname, 'profiles');
const IDENTITY_FILE = path.join(DATA_DIR, 'identity.json');

// ── VPS-local adaptation ──
// LOCAL_MODE=true  : kelola langsung ~/.gemini asli milik user di VPS ini
//                    (tanpa symlink, tanpa hapus folder global) — aman.
// LOCAL_MODE=false : mode profil lama (isolated profile dir + symlink).
const LOCAL_MODE = process.env.LOCAL_MODE !== 'false';
const LOCAL_HOME = process.env.LOCAL_HOME || os.homedir();
const AGY_BIN = process.env.AGY_BIN || path.join(LOCAL_HOME, '.local', 'bin', 'agy');

fs.mkdirSync(DATA_DIR, { recursive: true });
if (!LOCAL_MODE) fs.mkdirSync(PROFILES_DIR, { recursive: true });

const PRIMARY_PROFILE_ID = 'primary';
const PRIMARY_PROFILE_DIR = LOCAL_MODE ? LOCAL_HOME : path.join(PROFILES_DIR, PRIMARY_PROFILE_ID);
const PRIMARY_GEMINI_DIR = path.join(PRIMARY_PROFILE_DIR, '.gemini');

fs.mkdirSync(path.join(PRIMARY_GEMINI_DIR, 'antigravity-cli'), { recursive: true });

function initializeIdentityDatabase() {
  if (!fs.existsSync(IDENTITY_FILE)) {
    const initialIdentity = {
      email: '',
      name: 'Eka Syarif Maulana',
      provider: 'Google OAuth',
      status: 'disconnected',
      createdAt: null,
      lastVerifiedAt: null,
      notes: 'Akun Antigravity CLI VPS'
    };
    fs.writeFileSync(IDENTITY_FILE, JSON.stringify(initialIdentity, null, 2), 'utf-8');
  }
}

initializeIdentityDatabase();

function readIdentity() {
  try {
    const raw = fs.readFileSync(IDENTITY_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {
      email: '',
      name: 'Eka Syarif Maulana',
      provider: 'Google OAuth',
      status: 'disconnected',
      createdAt: null,
      lastVerifiedAt: null,
      notes: ''
    };
  }
}

function writeIdentity(identity) {
  fs.writeFileSync(IDENTITY_FILE, JSON.stringify(identity, null, 2), 'utf-8');
}

function isPrimaryAuthenticated() {
  const cliDir = path.join(PRIMARY_GEMINI_DIR, 'antigravity-cli');
  if (!fs.existsSync(cliDir)) {
    return false;
  }

  try {
    if (LOCAL_MODE) {
      // Deteksi langsung & ketat: token OAuth file-based yang dipakai agy di VPS ini.
      // Jangan pakai heuristik jumlah file — itu false-positive setelah logout.
      const tokenFile = path.join(cliDir, 'antigravity-oauth-token');
      return fs.existsSync(tokenFile);
    }
    const files = fs.readdirSync(cliDir);
    return files.includes('history.jsonl') || files.includes('jetski_state.pbtxt') || files.includes('conversation_summaries.db') || files.length >= 3;
  } catch {
    return false;
  }
}

function ensureGlobalSymlink() {
  if (LOCAL_MODE) return; // kelola ~/.gemini asli — tidak perlu symlink
  if (os.platform() === 'linux') {
    const rootGemini = path.join(os.homedir(), '.gemini');
    try {
      if (fs.existsSync(rootGemini) || fs.lstatSync(rootGemini).isSymbolicLink()) {
        const stats = fs.lstatSync(rootGemini);
        if (stats.isSymbolicLink()) {
          const target = fs.readlinkSync(rootGemini);
          if (target === PRIMARY_GEMINI_DIR) {
            return;
          }
        }
        fs.rmSync(rootGemini, { recursive: true, force: true });
      }
    } catch {}

    try {
      fs.symlinkSync(PRIMARY_GEMINI_DIR, rootGemini, 'dir');
    } catch (err) {
      console.error(err);
    }
  }
}

ensureGlobalSymlink();

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
  return res.status(401).json({ error: 'Sesi tidak valid' });
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
  return res.status(401).json({ error: 'PIN yang dimasukkan salah' });
});

app.get('/api/auth/check', (req, res) => {
  const token = req.cookies.auth_token || req.headers.authorization?.replace('Bearer ', '');
  return res.json({ authenticated: token === AUTH_PIN });
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('auth_token');
  return res.json({ success: true });
});

app.get('/api/identity', authenticateRequest, (req, res) => {
  const identity = readIdentity();
  const authenticated = isPrimaryAuthenticated();

  if (authenticated && identity.status === 'disconnected') {
    identity.status = 'connected';
    writeIdentity(identity);
  } else if (!authenticated && identity.status === 'connected') {
    identity.status = 'disconnected';
    writeIdentity(identity);
  }

  return res.json({
    identity,
    system: {
      hostname: os.hostname(),
      platform: os.platform(),
      uptime: Math.round(os.uptime()),
      memory: {
        totalMb: Math.round(os.totalmem() / (1024 * 1024)),
        usedMb: Math.round((os.totalmem() - os.freemem()) / (1024 * 1024))
      }
    }
  });
});

app.post('/api/identity/update', authenticateRequest, (req, res) => {
  const { name, notes, email } = req.body;
  const identity = readIdentity();

  if (name !== undefined) identity.name = String(name).trim();
  if (notes !== undefined) identity.notes = String(notes).trim();
  if (email !== undefined) identity.email = String(email).trim();

  writeIdentity(identity);
  return res.json({ success: true, identity });
});

app.post('/api/auth/start-login', authenticateRequest, async (req, res) => {
  const { email, name } = req.body;

  ensureGlobalSymlink();

  const sessionId = `login_${Date.now()}`;
  const isWindows = os.platform() === 'win32';
  const spawnCmd = isWindows ? 'cmd.exe' : 'bash';
  const spawnArgs = isWindows
    ? ['/c', AGY_BIN]
    : ['-c', `export HOME='${PRIMARY_PROFILE_DIR}'; exec ${AGY_BIN}`];

  let ptyProcess = null;
  try {
    ptyProcess = pty.spawn(spawnCmd, spawnArgs, {
      name: 'xterm-color',
      cols: 1000,
      rows: 40,
      cwd: PRIMARY_PROFILE_DIR,
      env: {
        ...process.env,
        HOME: PRIMARY_PROFILE_DIR,
        USERPROFILE: PRIMARY_PROFILE_DIR,
        TERM: 'xterm-color'
      }
    });
  } catch (spawnError) {
    return res.status(500).json({ error: 'Gagal menjalankan Antigravity CLI' });
  }

  let capturedAuthUrl = null;
  let buffer = '';
  let sentEnter = false;

  const sessionData = {
    sessionId,
    ptyProcess,
    buffer: '',
    emailDraft: (email || '').trim(),
    nameDraft: (name || '').trim(),
    createdAt: Date.now()
  };

  pendingLoginSessions.set(sessionId, sessionData);

  const urlPromise = new Promise((resolve) => {
    const dataHandler = (chunk) => {
      buffer += chunk;
      sessionData.buffer += chunk;

      if (!sentEnter && (buffer.includes('Google OAuth') || buffer.includes('Select login method'))) {
        sentEnter = true;
        setTimeout(() => {
          ptyProcess.write('\r');
        }, 400);
      }

      const cleanText = buffer
        .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
        .replace(/\x1b\]8;;[^\x1b]*\x1b\\/g, '')
        .replace(/[\r\n\x07]/g, ' ');

      const match = cleanText.match(/(https:\/\/accounts\.google\.com\/o\/oauth2\/auth\?[^'"><\s]+?state=[A-Za-z0-9_-]+)/);
      if (match) {
        try {
          const parsed = new URL(match[1]);
          if (parsed.searchParams.get('client_id') && parsed.searchParams.get('state')) {
            capturedAuthUrl = parsed.href;
            resolve(capturedAuthUrl);
          }
        } catch {}
      }
    };

    ptyProcess.onData(dataHandler);

    setTimeout(() => {
      resolve(capturedAuthUrl);
    }, 12000);
  });

  const authUrl = await urlPromise;

  if (!authUrl) {
    try {
      ptyProcess.kill();
    } catch {}
    pendingLoginSessions.delete(sessionId);
    return res.status(500).json({
      error: 'Gagal mendapatkan tautan otentikasi Google dari CLI. Silakan coba kembali.'
    });
  }

  return res.json({
    success: true,
    sessionId,
    authUrl
  });
});

app.post('/api/auth/submit-code', authenticateRequest, async (req, res) => {
  const { sessionId, code, email, name } = req.body;
  if (!sessionId || !code) {
    return res.status(400).json({ error: 'Kode otorisasi wajib diisi' });
  }

  const session = pendingLoginSessions.get(sessionId);
  if (!session || !session.ptyProcess) {
    return res.status(404).json({ error: 'Sesi login telah kedaluwarsa. Silakan mulai kembali.' });
  }

  const cleanCode = code.trim();
  session.ptyProcess.write(`${cleanCode}\r\n`);

  const verificationPromise = new Promise((resolve) => {
    let checkCount = 0;
    const interval = setInterval(() => {
      checkCount++;
      const hasToken = isPrimaryAuthenticated();
      const isBufferSuccess = session.buffer.includes('Signed in') || session.buffer.includes('Welcome') || session.buffer.includes('signed in');
      const isBufferError = session.buffer.includes('invalid') || session.buffer.includes('Invalid') || session.buffer.includes('failed to authenticate');

      if (hasToken || isBufferSuccess) {
        clearInterval(interval);
        resolve({ success: true });
      } else if (isBufferError && checkCount >= 4) {
        clearInterval(interval);
        resolve({ success: false, error: 'Kode otorisasi yang dimasukkan tidak valid atau sudah kedaluwarsa' });
      } else if (checkCount >= 12) {
        clearInterval(interval);
        resolve({ success: hasToken, error: 'Waktu tunggu verifikasi telah habis' });
      }
    }, 1000);
  });

  const verificationResult = await verificationPromise;

  let detectedEmail = (email || session.emailDraft || '').trim();
  const emailMatch = session.buffer.match(/Signed in as\s+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
  if (emailMatch) {
    detectedEmail = emailMatch[1];
  }

  try {
    session.ptyProcess.kill();
  } catch {}
  pendingLoginSessions.delete(sessionId);

  if (verificationResult.success) {
    const identity = readIdentity();
    identity.email = detectedEmail || identity.email || 'Akun Google Terverifikasi';
    if (name) identity.name = name.trim();
    identity.status = 'connected';
    identity.createdAt = new Date().toISOString();
    identity.lastVerifiedAt = new Date().toISOString();
    writeIdentity(identity);

    ensureGlobalSymlink();

    return res.json({
      success: true,
      identity,
      message: 'Akun Google berhasil terhubung ke Antigravity CLI'
    });
  }

  return res.status(400).json({
    error: verificationResult.error || 'Verifikasi kode otorisasi gagal'
  });
});

app.post('/api/auth/disconnect', authenticateRequest, (req, res) => {
  try {
    if (LOCAL_MODE) {
      // VPS-local mode: hanya cabut token OAuth, JANGAN hapus seluruh ~/.gemini
      const tokenFile = path.join(PRIMARY_GEMINI_DIR, 'antigravity-cli', 'antigravity-oauth-token');
      if (fs.existsSync(tokenFile)) fs.rmSync(tokenFile, { force: true });
    } else if (fs.existsSync(PRIMARY_GEMINI_DIR)) {
      fs.rmSync(PRIMARY_GEMINI_DIR, { recursive: true, force: true });
      fs.mkdirSync(path.join(PRIMARY_GEMINI_DIR, 'antigravity-cli'), { recursive: true });
    }

    const identity = readIdentity();
    identity.status = 'disconnected';
    identity.lastVerifiedAt = new Date().toISOString();
    writeIdentity(identity);

    return res.json({
      success: true,
      message: 'Akun berhasil diputuskan dari Antigravity CLI'
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Gagal memutuskan akun' });
  }
});

app.post('/api/system/test-cli', authenticateRequest, (req, res) => {
  ensureGlobalSymlink();

  const isWindows = os.platform() === 'win32';
  const testCmd = isWindows ? AGY_BIN + ' models' : `HOME='${PRIMARY_PROFILE_DIR}' ${AGY_BIN} models`;

  exec(testCmd, { timeout: 8000 }, (error, stdout, stderr) => {
    const output = (stdout || stderr || '').trim();
    const isReady = output.includes('Gemini') || output.includes('Available models');

    const identity = readIdentity();
    if (isReady) {
      identity.status = 'connected';
      identity.lastVerifiedAt = new Date().toISOString();
      writeIdentity(identity);
    } else {
      identity.status = 'disconnected';
      writeIdentity(identity);
    }

    return res.json({
      success: !error && isReady,
      output: output.slice(0, 300),
      identity
    });
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Antigravity Identity Hub running on http://0.0.0.0:${PORT}`);
});
