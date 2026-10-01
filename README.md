# Antigravity Identity Hub

Aplikasi web manajemen otentikasi akun tunggal Google untuk Antigravity CLI (`agy`) di VPS Ubuntu. Aplikasi ini mencatat identitas akun aktif ke dalam basis data berkas JSON (`data/identity.json`) dan menyediakan antarmuka grafis untuk menghubungkan, menguji, dan memutuskan sambungan akun tanpa terminal.

## Cara Kerja Sistem

1. **Otentikasi Akun Tunggal**: Sistem fokus pada satu akun Google aktif yang terpasang langsung ke `/root/.gemini` di VPS.
2. **Basis Data Identitas JSON**: Detail akun seperti alamat email, nama pemilik, status koneksi, dan waktu verifikasi tersimpan di `data/identity.json`.
3. **Pemeriksaan Status CLI**: Melakukan pengujian token berkala langsung ke binary `agy` untuk memastikan sesi Google OAuth tetap aktif dan siap menerima perintah.
4. **Pencegahan Error OAuth**: Backend menyaring parameter otentikasi agar tautan Google tidak mengalami duplikasi `client_id` atau terpotong oleh pembungkus terminal.

## Struktur Berkas Basis Data

```json
{
  "email": "ekasyarifmaulanaa1@gmail.com",
  "name": "Eka Syarif Maulana",
  "provider": "Google OAuth",
  "status": "connected",
  "createdAt": "2026-10-01T07:20:00.000Z",
  "lastVerifiedAt": "2026-10-01T07:25:00.000Z",
  "notes": "Akun Antigravity CLI VPS"
}
```

## Konfigurasi Lingkungan (`.env`)

```text
PORT=3838
AUTH_PIN=16799
DATA_DIR=/DATA/AppData/antigravity-hub/data
PROFILES_DIR=/DATA/AppData/antigravity-hub/profiles
```

## Akses Layanan

- **Alamat Web**: `http://103.253.213.185:3838`
- **PIN Akses**: `16799`
