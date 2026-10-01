# Antigravity Account Hub

Aplikasi Web GUI modern khusus untuk manajemen multi-akun Google OAuth dan otentikasi Antigravity CLI (`agy`) di VPS Ubuntu. Tanpa tampilan terminal CLI mentah, semua proses login, logout, dan perpindahan akun dilakukan 100% melalui antarmuka web grafis yang bersih.

## Fitur Utama

- **100% Tampilan GUI Grafis**: Alur login dan manajemen akun dilakukan murni menggunakan kartu akun, tombol interaktif, dan modal wizard, bukan terminal CLI hitam.
- **Automated OAuth Interceptor**: Backend secara otomatis menangkap URL resmi otentikasi Google dari CLI dan menyediakan tombol otorisasi langsung bagi pengguna.
- **One-Click Account Switcher**: Berganti akun aktif di VPS dengan 1 klik tombol `Gunakan Akun`. Sistem otomatis menyinkronkan profil kredensial ke `/root/.gemini/antigravity-cli`.
- **Token Health Check**: Fitur pengujian langsung untuk memastikan kredensial akun aktif valid dan siap digunakan oleh Antigravity CLI.
- **Logout & Profil Isolasi**: Tiap akun memiliki direktori environment terisolasi (`/DATA/AppData/antigravity-hub/profiles/<id>`) sehingga sesi akun tidak pernah bercampur atau tertimpa.
- **Master PIN Guard**: Seluruh dashboard diproteksi dengan Master PIN demi keamanan di VPS publik.

## Konfigurasi Environment (`.env`)

```text
PORT=3838
AUTH_PIN=16799
PROFILES_DIR=/DATA/AppData/antigravity-hub/profiles
DATA_DIR=/DATA/AppData/antigravity-hub/data
```

## Alur Login Akun Baru di Web

1. Klik tombol **Tambah Akun**.
2. Masukkan label nama akun (misal: *Akun Cadangan 1*).
3. Klik tombol **Dapatkan Link Login**; sistem akan menampilkan tombol otorisasi Google resmi.
4. Klik tombol Google, berikan izin akses, dan salin kode otorisasi (`4/0A...`).
5. Tempel kode otorisasi ke formulir web dan klik **Verifikasi & Simpan Akun**.
6. Akun langsung aktif dan siap digunakan di seluruh perintah VPS!

## Akses Layanan

- **URL Dashboard**: `http://103.253.213.185:3838`
- **Domain SSL**: `https://agy.serverinka.cloud` *(jika CNAME agy diarahkan di Cloudflare)*
- **Master PIN**: `16799`
