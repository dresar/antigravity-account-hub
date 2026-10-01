import express from 'express';
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { exec, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3838', 10);
const AUTH_PIN = process.env.AUTH_PIN || '16799';
const PROFILES_DIR = process.env.PROFILES_DIR || path.join(__dirname, 'profiles');
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const PROFILES_FILE = path.join(DATA_DIR, 'profiles.json');

fs.mkdirSync(PROFILES_DIR, { recursive: true });
fs.mkdirSync(DATA_DIR, { recursive: true });

function initializeProfilesDatabase() {
  if (!fs.existsSync(PROFILES_FILE)) {
    const initialProfiles = [
      {
        id: 'default',
        name: 'Akun Utama',
        note: 'Profil default Antigravity',
        createdAt: new Date().toISOString(),
        lastUsed: new Date().toISOString()
      }
    ];
    fs.writeFileSync(PROFILES_FILE, JSON.stringify(initialProfiles, null, 2), 'utf-8');
  }
}

initializeProfilesDatabase();

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

function ensureProfileFolder(profileId) {
  const profilePath = path.join(PROFILES_DIR, profileId);
  fs.mkdirSync(profilePath, { recursive: true });
  fs.mkdirSync(path.join(profilePath, '.gemini'), { recursive: true });
  return profilePath;
}

let nodePty = null;
try {
  const ptyModule = await import('node-pty');
  nodePty = ptyModule.default || ptyModule;
} catch {
  nodePty = null;
}

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ noServer: true });

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
  return res.json({ profiles });
});

app.post('/api/profiles', authenticateRequest, (req, res) => {
  const { name, note } = req.body;
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'Nama profil harus diisi' });
  }

  const profiles = readProfiles();
  const idSlug = name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || `acc-${Date.now()}`;

  let finalId = idSlug;
  let counter = 1;
  while (profiles.some((p) => p.id === finalId)) {
    finalId = `${idSlug}-${counter}`;
    counter++;
  }

  ensureProfileFolder(finalId);

  const newProfile = {
    id: finalId,
    name: name.trim(),
    note: (note || '').trim(),
    createdAt: new Date().toISOString(),
    lastUsed: new Date().toISOString()
  };

  profiles.push(newProfile);
  writeProfiles(profiles);

  return res.json({ success: true, profile: newProfile });
});

app.delete('/api/profiles/:id', authenticateRequest, (req, res) => {
  const { id } = req.params;
  if (id === 'default') {
    return res.status(400).json({ error: 'Profil default tidak boleh dihapus' });
  }

  let profiles = readProfiles();
  profiles = profiles.filter((p) => p.id !== id);
  writeProfiles(profiles);

  if (os.platform() === 'linux') {
    exec(`tmux kill-session -t agy_${id}`, () => {});
  }

  return res.json({ success: true });
});

app.post('/api/session/restart', authenticateRequest, (req, res) => {
  const { profileId } = req.body;
  const targetId = profileId || 'default';

  if (os.platform() === 'linux') {
    exec(`tmux kill-session -t agy_${targetId}`, () => {
      return res.json({ success: true, message: 'Sesi di-reset' });
    });
  } else {
    return res.json({ success: true, message: 'Sesi di-reset' });
  }
});

app.get('/api/system/status', authenticateRequest, (req, res) => {
  const uptimeSeconds = os.uptime();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;

  exec('which agy', (error, stdout) => {
    const agyPath = stdout.trim() || 'agy';
    exec('tmux list-sessions 2>/dev/null', (tmuxErr, tmuxOut) => {
      const activeSessions = tmuxOut
        ? tmuxOut
            .split('\n')
            .filter((line) => line.includes('agy_'))
            .map((line) => line.split(':')[0])
        : [];

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
        activeSessions
      });
    });
  });
});

server.on('upgrade', (request, socket, head) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  if (requestUrl.pathname !== '/ws/terminal') {
    socket.destroy();
    return;
  }

  const tokenParam = requestUrl.searchParams.get('token');
  const cookieHeader = request.headers.cookie || '';
  const parsedCookies = Object.fromEntries(
    cookieHeader.split(';').map((pair) => {
      const [key, ...values] = pair.trim().split('=');
      return [key, decodeURIComponent(values.join('='))];
    })
  );

  const activeToken = tokenParam || parsedCookies.auth_token;
  if (activeToken !== AUTH_PIN) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }

  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request, requestUrl);
  });
});

wss.on('connection', (ws, request, requestUrl) => {
  const profileId = requestUrl.searchParams.get('profile') || 'default';
  const profileDir = ensureProfileFolder(profileId);

  const profiles = readProfiles();
  const targetProfile = profiles.find((p) => p.id === profileId);
  if (targetProfile) {
    targetProfile.lastUsed = new Date().toISOString();
    writeProfiles(profiles);
  }

  const sessionName = `agy_${profileId}`;
  let ptyProcess = null;

  if (nodePty) {
    const isWindows = os.platform() === 'win32';
    if (isWindows) {
      ptyProcess = nodePty.spawn('cmd.exe', ['/c', 'agy'], {
        name: 'xterm-256color',
        cols: 100,
        rows: 30,
        cwd: profileDir,
        env: {
          ...process.env,
          USERPROFILE: profileDir,
          APPDATA: path.join(profileDir, 'AppData', 'Roaming'),
          LOCALAPPDATA: path.join(profileDir, 'AppData', 'Local'),
          HOME: profileDir
        }
      });
    } else {
      const tmuxCommand = `tmux new-session -A -s ${sessionName} "env HOME='${profileDir}' agy"`;
      ptyProcess = nodePty.spawn('bash', ['-c', tmuxCommand], {
        name: 'xterm-256color',
        cols: 100,
        rows: 30,
        cwd: profileDir,
        env: {
          ...process.env,
          HOME: profileDir,
          TERM: 'xterm-256color'
        }
      });
    }
  } else {
    const isWindows = os.platform() === 'win32';
    const shellCmd = isWindows ? 'cmd.exe' : 'bash';
    const shellArgs = isWindows ? ['/c', 'agy'] : ['-c', `HOME='${profileDir}' agy`];
    ptyProcess = spawn(shellCmd, shellArgs, {
      cwd: profileDir,
      env: {
        ...process.env,
        HOME: profileDir
      }
    });

    ptyProcess.stdout?.on('data', (chunk) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(chunk.toString());
      }
    });
    ptyProcess.stderr?.on('data', (chunk) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(chunk.toString());
      }
    });
  }

  if (nodePty && ptyProcess) {
    ptyProcess.onData((data) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(data);
      }
    });
  }

  ws.on('message', (message) => {
    try {
      const text = message.toString();
      if (text.startsWith('{') && text.endsWith('}')) {
        const parsed = JSON.parse(text);
        if (parsed.type === 'resize' && ptyProcess?.resize) {
          ptyProcess.resize(Math.max(parsed.cols, 10), Math.max(parsed.rows, 5));
          return;
        }
      }
      if (nodePty && ptyProcess?.write) {
        ptyProcess.write(text);
      } else if (ptyProcess?.stdin) {
        ptyProcess.stdin.write(text);
      }
    } catch (err) {
      if (nodePty && ptyProcess?.write) {
        ptyProcess.write(message.toString());
      }
    }
  });

  ws.on('close', () => {
    if (!os.platform().includes('linux') && ptyProcess) {
      ptyProcess.kill();
    }
  });

  ws.on('error', () => {
    if (!os.platform().includes('linux') && ptyProcess) {
      ptyProcess.kill();
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Antigravity Remote Hub running on http://0.0.0.0:${PORT}`);
});
