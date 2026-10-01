# Antigravity Remote Web Hub

Aplikasi web modern untuk meremote Antigravity CLI (`agy`) langsung dari browser dengan manajemen multi-akun instan tanpa perlu login-logout berulang di terminal SSH.

## Fitur Utama

- **Realtime Web Terminal**: Antarmuka terminal interaktif bertenaga `xterm.js` dan `node-pty` dengan dukungan warna ANSI, kursor, dan link URL OAuth yang dapat diklik langsung.
- **Multi-Account Profile Switcher**: Gonta-ganti akun Google / Antigravity dengan 1 klik dari dropdown menu. Setiap akun memiliki direktori environment `$HOME/.gemini` yang terisolasi sepenuhnya.
- **Session Persistence (tmux)**: Sesi CLI tetap hidup di background VPS saat tab browser ditutup atau koneksi internet perangkat terputus.
- **Mobile Friendly Controls**: Dilengkapi tombol bantuan keyboard (ESC, TAB, Ctrl+C, Ctrl+D, Enter, panah navigasi) dan shortcut slash commands (`/plan`, `/goal`, `/help`, `/clear`).
- **Keamanan Terproteksi**: Proteksi otentikasi Master PIN dan websocket handshake guard.

## Akses Aplikasi

- **Direct Web URL**: `http://103.253.213.185:3838`
- **Master PIN**: `16799`
- **Nginx Reverse Proxy**: Dikonfigurasi untuk domain `agy.serverinka.cloud` (port 80/443 SSL)

## Struktur Direktori

```text
/DATA/AppData/antigravity-hub/
├── data/
│   └── profiles.json
├── profiles/
│   ├── default/
│   │   └── .gemini/
│   └── <profile-id>/
├── public/
│   ├── app.js
│   ├── index.html
│   └── style.css
├── .env
├── package.json
└── server.js
```

## Perintah Manajemen Layanan (VPS)

- Cek status daemon:
  ```bash
  systemctl status antigravity-hub
  ```

- Restart daemon:
  ```bash
  systemctl restart antigravity-hub
  ```

- Lihat live logs:
  ```bash
  journalctl -u antigravity-hub -f
  ```

- Cek sesi tmux aktif:
  ```bash
  tmux list-sessions
  ```
