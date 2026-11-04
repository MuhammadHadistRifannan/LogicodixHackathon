# Aset karakter

Satu folder per karakter. Nama folder sama dengan `id` di `client/characters.js`.

| Folder | Karakter |
|---|---|
| `gadjah-mada/` | Gadjah Mada |
| `leak/` | Leak |
| `nyi-roro-kidul/` | Nyi Roro Kidul |

Isi tiap folder:

| Berkas | Fungsi |
|---|---|
| `avatar.png` | Foto kotak (512x512, kepala dan bahu) di menu pilih karakter. |
| `portrait.png` | Gambar badan penuh (900x1200, latar transparan) di panggung menu. Harus dirender dari frame pertama animasi idle dengan kamera `StageViewer` (rasio 3:4), supaya peralihan ke model 3D tidak meloncat. Render ulang bila model, idle, atau framing kamera berubah. |
| `3d/*.fbx` | Model 3D dan animasi. Menu memakai satu FBX berisi mesh (`model.mesh`) dan satu FBX animasi idle (`model.idle`); keduanya harus satu rig (nama tulang sama). |

Isi `assets/` otomatis disajikan server dan disalin ke build Android.
Selama model 3D dimuat, `portrait.png` tampil sebagai placeholder. Jika `model` bernilai
`null` atau WebGL tidak tersedia, panggung tetap memakai `portrait.png`.

Jika `avatar` atau `portrait` di `client/characters.js` diisi `null`, menu
menampilkan siluet sementara.

Latar layar pilih karakter ada di folder terpisah: `assets/background-characters/<id>/`
(gambar di `background`, video opsional di `backgroundVideo`, keduanya diisi di `client/characters.js`).
Video diputar bisu dan diulang dengan cross-fade 1,5 detik; gambar menjadi placeholder dan cadangan
(browser tanpa dukungan VP9, atau reduced motion aktif). Format yang disarankan: WebM VP9, 1280x720.
Karakter tanpa `background` memakai latar gelap bawaan.
