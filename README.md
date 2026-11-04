# Logicodix

Game aksi bertema Nusantara. Proyek ini sedang dibangun ulang dari awal; versi
sebelumnya (MOBA fisika 3v3) ada di riwayat git, commit `970afd2`.

Arah produk ada di [PRD.md](./PRD.md). Catatan: PRD masih menggambarkan versi
lama dan akan disesuaikan seiring pembangunan ulang.

## Status

Tahap 1: menu pilih karakter (Gadjah Mada, Leak, Nyi Roro Kidul).

## Menjalankan

Prasyarat: Node.js 20 atau lebih baru.

```bash
npm install
npm run check
npm run server   # http://127.0.0.1:8787
npm start        # server lokal + jendela Electron
```

## Struktur

| Folder | Isi |
|---|---|
| `client/` | Kode browser: `main.js` (menu), `characters.js` (daftar karakter), `stage3d.js` (penampil 3D dengan animasi idle), `music.js` (musik latar dengan fade). |
| `server/` | Server statis dan `/healthz`. |
| `assets/characters/` | Model, avatar, dan portrait per karakter (lihat README di dalamnya). |
| `assets/musics/` | Musik latar (`background/`). |
| `assets/vendor/` | Three.js dan FBXLoader (`addons/`, import sudah dibuat relatif). |
| `electron/`, `android/` | Cangkang desktop dan Android (Capacitor). |
| `scripts/` | Peluncur, pemeriksaan, dan build. |

## Menambah karakter

1. Buat folder `assets/characters/<id>/` dan isi `avatar.png`, `portrait.png`, dan FBX di `3d/`.
2. Tambahkan satu entri di `client/characters.js` (termasuk `model.mesh` dan `model.idle`).
