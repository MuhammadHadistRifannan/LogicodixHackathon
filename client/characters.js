// Daftar karakter yang bisa dipilih. Folder aset: assets/characters/<id>/.
// avatar = foto kotak di menu pilih, portrait = gambar besar di panggung (juga
// placeholder selagi model 3D dimuat). model = mesh FBX + FBX animasi idle (rig sama).
// model.texture (opsional) = tekstur warna untuk mesh yang FBX-nya tidak membawa material.
// model.materials (opsional) = tekstur PBR per nama material FBX ({ map, normal, roughness,
// metalness, ao, alpha, color }). model.frame (opsional) = { fill, anchor } untuk framing kamera.
// background = gambar latar layar pilih (assets/background-characters/<id>/); null memakai latar bawaan.
// backgroundVideo = video latar (diulang dengan cross-fade); gambar background jadi placeholder dan
// cadangan bila video tidak didukung atau reduced motion aktif.
// Isi null bila belum ada; menu menampilkan siluet atau gambar statis sementara.
const dir = (id) => `/assets/characters/${id}`;
const bgDir = (id) => `/assets/background-characters/${id}`;

// Nama berkas tekstur Leak: <material>_<peta>.jpg (ekspor Substance).
const LEAK_FILES = { map: "albedo", normal: "normal", roughness: "roughness", metalness: "metallic", alpha: "opacity", ao: "AO" };
const leakPbr = (material, maps) =>
  Object.fromEntries(maps.map((key) => [key, `${dir("leak")}/texture/${material}_${LEAK_FILES[key]}.jpg`]));

export const CHARACTERS = Object.freeze([
  {
    id: "gadjah-mada",
    name: "Gadjah Mada",
    epithet: "Mahapatih Majapahit",
    lore: "Panglima Majapahit yang bersumpah tidak akan menikmati palapa sebelum seluruh Nusantara bersatu di bawah satu panji.",
    avatar: `${dir("gadjah-mada")}/avatar.png`,
    portrait: `${dir("gadjah-mada")}/portrait.png`,
    background: encodeURI(`${bgDir("gadjah-mada")}/Pelataran Candi Majapahit Saat Senja.webp`),
    backgroundVideo: `${bgDir("gadjah-mada")}/pelataran.webm`,
    model: {
      mesh: `${dir("gadjah-mada")}/3d/original-pose.fbx`,
      idle: `${dir("gadjah-mada")}/3d/gadjah-mada-idle.fbx`,
    },
  },
  {
    id: "leak",
    name: "Leak",
    epithet: "Penyihir Bayangan dari Bali",
    lore: "Sosok bayangan dalam cerita rakyat Bali. Ia menguasai ilmu hitam, bergerak di malam hari, dan mengubah wujud sesuka hati.",
    avatar: null,
    portrait: null,
    background: null,
    backgroundVideo: null,
    model: {
      mesh: `${dir("leak")}/3d/leak_static.fbx`,
      idle: `${dir("leak")}/3d/leak_idle.fbx`,
      // Kepala melayang: isi 60% tinggi panggung, tengah kepala di 62% dari bawah.
      frame: { fill: 0.6, anchor: 0.62 },
      // Tekstur PBR per nama material FBX. "__DEFAULT" = lidah (mesh tanpa material).
      materials: {
        MaskMain: leakPbr("MaskMain", ["map", "normal", "roughness", "metalness"]),
        Hair01: leakPbr("Hair01", ["map", "normal", "metalness", "alpha"]),
        Jewery: leakPbr("Jewery", ["map", "normal", "roughness", "alpha"]),
        Jewery2: leakPbr("Jewery2", ["map", "normal", "roughness", "metalness", "alpha"]),
        __DEFAULT: { ...leakPbr("DefaultMaterial", ["normal", "roughness", "metalness", "ao"]), color: "#8f2a22" },
      },
    },
  },
  {
    id: "nyi-roro-kidul",
    name: "Nyi Roro Kidul",
    epithet: "Ratu Laut Selatan",
    lore: "Ratu gaib yang bersemayam di Laut Selatan dalam kisah Jawa, penguasa ombak dan pantai selatan.",
    avatar: `${dir("nyi-roro-kidul")}/avatar.png`,
    portrait: null,
    background: `${bgDir("nyi-roro-kidul")}/pelataran.webp`,
    backgroundVideo: `${bgDir("nyi-roro-kidul")}/pelataran.webm`,
    model: {
      mesh: `${dir("nyi-roro-kidul")}/3d/kadita_mixamo.fbx`,
      idle: `${dir("nyi-roro-kidul")}/3d/kadita_idle.fbx`,
      // FBX hasil Mixamo ini tidak membawa material, jadi tekstur dipasang manual.
      texture: `${dir("nyi-roro-kidul")}/texture/kadita_high.png`,
    },
  },
]);
