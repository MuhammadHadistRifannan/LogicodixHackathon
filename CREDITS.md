# Credits

## Model karakter
- `assets/characters/gadjah-mada/3d/*.fbx`: sumber dan lisensi belum dicatat. Isi nama
  pembuat, URL, dan lisensi di sini sebelum di-commit.
- `avatar.png` dan `portrait.png` di tiap folder karakter adalah render dari model di atas.
- `assets/characters/leak/3d/*.fbx` dan `assets/characters/leak/texture/*`: model topeng Rangda
  "Rangda" oleh Kramaa (@MiguelOrtega), https://sketchfab.com/3d-models/rangda-66c7c7748f8a4bcdb8143c0c3a844ba4,
  lisensi CC BY 4.0. Diubah: animasi bawaan dibuang, tulang dikembalikan ke bind pose
  (`leak_static.fbx`), dan ditambah animasi idle melayang 4 detik (`leak_idle.fbx`).

## Musik
- `assets/musics/background/backsound-music-fix.mp3`: sumber, pembuat, dan lisensi belum dicatat.
  Isi di sini sebelum di-commit.

## Pustaka
- [Three.js](https://threejs.org/) (lisensi MIT): `assets/vendor/three.module.js`, lihat
  `assets/vendor/three.LICENSE`. FBXLoader, fflate, dan NURBS di `assets/vendor/addons/` berasal dari
  `three/examples/jsm` (MIT; fflate juga MIT) dengan import diubah ke path relatif.

## Aturan menambah aset
Aset pihak ketiga (gambar, sprite, model, audio, font) hanya boleh masuk repo bila lisensinya
jelas (CC0 atau setara, atau CC-BY dengan atribusi). Catat setiap aset di sini: nama, sumber
(URL), lisensi, dan pembuat, sebelum di-commit.
