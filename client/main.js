import { CHARACTERS } from "./characters.js";
import { StageViewer } from "./stage3d.js";
import { LoopVideo } from "./loopvideo.js";
import { BackgroundMusic } from "./music.js";
import { UiSound } from "./sfx.js";

const STORAGE_KEY = "logicodix.character";

const els = {
  scene: document.getElementById("scene"),
  art: document.getElementById("stageArt"),
  name: document.getElementById("identityName"),
  epithet: document.getElementById("identityEpithet"),
  lore: document.getElementById("identityLore"),
  roster: document.getElementById("roster"),
};

let selectedIndex = loadSelected();
let hoverIndex = null;
let shownIndex = -1;
let viewer = null;
let sceneLayers = [];

function loadSelected() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const index = CHARACTERS.findIndex((character) => character.id === saved);
    return index >= 0 ? index : 0;
  } catch {
    return 0;
  }
}

function saveSelected() {
  try {
    localStorage.setItem(STORAGE_KEY, CHARACTERS[selectedIndex].id);
  } catch {
    // Storage bisa tidak tersedia; pilihan tetap berlaku selama sesi.
  }
}

function restartAnimation(element, className) {
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
}

function buildScene() {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canPlayVideo = !reducedMotion && LoopVideo.supported();
  sceneLayers = CHARACTERS.map((character) => {
    if (!character.background && !character.backgroundVideo) return null;
    const layer = document.createElement("div");
    layer.className = "scene-layer";
    if (character.background) {
      const img = document.createElement("img");
      img.className = "scene-img";
      img.src = character.background;
      img.alt = "";
      img.draggable = false;
      img.decoding = "async";
      layer.append(img);
    }
    const loop = character.backgroundVideo && canPlayVideo ? new LoopVideo(layer, character.backgroundVideo) : null;
    return { layer, loop };
  });
  els.scene.replaceChildren(...sceneLayers.filter(Boolean).map((entry) => entry.layer));
}

function showScene(index) {
  sceneLayers.forEach((entry, i) => {
    if (!entry) return;
    const active = i === index;
    entry.layer.classList.toggle("is-active", active);
    if (!entry.loop) return;
    clearTimeout(entry.stopTimer);
    if (active) entry.loop.start();
    else entry.stopTimer = setTimeout(() => entry.loop.stop(), 450);
  });
}

// Hemat baterai: jeda video latar saat tab tidak terlihat.
document.addEventListener("visibilitychange", () => {
  const entry = sceneLayers[shownIndex];
  if (!entry?.loop) return;
  if (document.hidden) entry.loop.stop();
  else entry.loop.start();
});

function buildPhoto(character) {
  const photo = document.createElement("span");
  photo.className = "tile-photo";
  if (character.avatar) {
    const img = document.createElement("img");
    img.src = character.avatar;
    img.alt = "";
    img.draggable = false;
    photo.append(img);
  } else {
    photo.classList.add("silhouette");
  }
  return photo;
}

function buildRoster() {
  const tiles = CHARACTERS.map((character, index) => {
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "tile";
    tile.dataset.index = String(index);
    tile.setAttribute("aria-label", `${character.name}, ${character.epithet}`);
    tile.append(buildPhoto(character));
    return tile;
  });
  els.roster.replaceChildren(...tiles);
}

function syncTiles() {
  for (const tile of els.roster.children) {
    const selected = Number(tile.dataset.index) === selectedIndex;
    tile.setAttribute("aria-pressed", String(selected));
    tile.tabIndex = selected ? 0 : -1;
  }
}

function renderStage(character, index) {
  // Placeholder statis (portrait atau siluet) selalu dipasang; model 3D menimpanya saat siap.
  let art;
  if (character.portrait) {
    art = document.createElement("img");
    art.src = character.portrait;
    art.alt = character.name;
    art.draggable = false;
    art.className = "stage-portrait";
  } else {
    art = document.createElement("div");
    art.className = "stage-portrait silhouette";
    art.setAttribute("role", "img");
    art.setAttribute("aria-label", `${character.name}, model belum tersedia`);
  }
  els.art.querySelector(".stage-portrait")?.remove();
  els.art.append(art);
  els.art.classList.remove("is-live");
  restartAnimation(art, "swap-left");

  if (!viewer || !character.model) {
    viewer?.hide();
    return;
  }
  viewer
    .show(character, () => shownIndex === index)
    .then((entry) => {
      if (entry) els.art.classList.add("is-live");
    })
    .catch((error) => console.warn(`Model ${character.id} gagal dimuat`, error));
}

function show(index) {
  if (index === shownIndex) return;
  shownIndex = index;
  const character = CHARACTERS[index];
  els.name.textContent = character.name;
  els.epithet.textContent = character.epithet;
  els.lore.textContent = character.lore;
  showScene(index);
  restartAnimation(els.name, "swap-right");
  restartAnimation(els.epithet, "swap-right");
  restartAnimation(els.lore, "swap-right");
  renderStage(character, index);
}

function refresh() {
  syncTiles();
  show(hoverIndex ?? selectedIndex);
}

function select(index) {
  selectedIndex = index;
  saveSelected();
  refresh();
}

/** Bunyi hover hanya bila karakter yang tampil benar-benar berganti karena aksi pemain. */
function cue(index) {
  if (index !== shownIndex) hoverSound.play();
}

function moveSelection(step) {
  const next = (selectedIndex + step + CHARACTERS.length) % CHARACTERS.length;
  cue(next);
  select(next);
  els.roster.children[next].focus();
}

function bindRoster() {
  els.roster.addEventListener("click", (event) => {
    const tile = event.target.closest(".tile");
    if (!tile) return;
    // Mouse sudah berbunyi saat hover; ini untuk ketuk layar sentuh dan Enter/Spasi.
    cue(Number(tile.dataset.index));
    select(Number(tile.dataset.index));
  });

  els.roster.addEventListener("pointerover", (event) => {
    if (event.pointerType !== "mouse") return;
    const tile = event.target.closest(".tile");
    if (!tile) return;
    hoverIndex = Number(tile.dataset.index);
    cue(hoverIndex);
    refresh();
  });

  els.roster.addEventListener("pointerleave", () => {
    if (hoverIndex === null) return;
    hoverIndex = null;
    refresh();
  });

  els.roster.addEventListener("keydown", (event) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    moveSelection(step);
  });
}

function preloadPortraits() {
  for (const character of CHARACTERS) {
    if (character.portrait) new Image().src = character.portrait;
  }
}

function createViewer() {
  try {
    viewer = new StageViewer(els.art);
  } catch (error) {
    console.warn("WebGL tidak tersedia, panggung memakai gambar statis", error);
    viewer = null;
    return;
  }
  // Muat semua model di latar belakang agar pindah karakter terasa instan.
  setTimeout(() => {
    for (const character of CHARACTERS) {
      if (character.model) viewer.load(character).catch(() => {});
    }
  }, 0);
}

function registerServiceWorker() {
  const native = window.Capacitor?.isNativePlatform?.();
  if (native || !("serviceWorker" in navigator)) return;
  if (location.protocol !== "http:" && location.protocol !== "https:") return;
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}

buildScene();
buildRoster();
bindRoster();
preloadPortraits();
createViewer();
refresh();
registerServiceWorker();

// Musik latar menu utama dan pemilihan karakter. Panggil music.stop() saat masuk pertandingan.
const MUTE_KEY = "logicodix.music-muted";
const musicToggle = document.getElementById("musicToggle");

function loadMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

const music = new BackgroundMusic("/assets/musics/background/backsound-music-fix.mp3", { muted: loadMuted() });
// Tombol musik juga membisukan efek suara, supaya ada satu kontrol suara saja.
const hoverSound = new UiSound("/assets/menu-assets/sounds/hover_character_selection.mp3", {
  volume: 0.5,
  muted: music.muted,
});

function syncMusicToggle() {
  musicToggle.classList.toggle("is-muted", music.muted);
  musicToggle.classList.toggle("is-playing", music.playing);
  musicToggle.setAttribute("aria-label", music.muted ? "Nyalakan musik" : "Matikan musik");
}

music.onChange = syncMusicToggle;
musicToggle.addEventListener("click", () => {
  music.setMuted(!music.muted);
  hoverSound.setMuted(music.muted);
  try {
    localStorage.setItem(MUTE_KEY, music.muted ? "1" : "0");
  } catch {
    // Storage bisa tidak tersedia; pilihan tetap berlaku selama sesi.
  }
});
syncMusicToggle();
music.start();
