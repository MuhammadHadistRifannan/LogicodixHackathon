import { readdir, readFile, stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const targets = ["client", "server", "electron", "scripts"];
const required = [
  "index.html",
  "styles.css",
  "manifest.webmanifest",
  "package.json",
  "client/main.js",
  "client/characters.js",
  "client/music.js",
  "assets/musics/background/backsound-music-fix.mp3",
  "assets/menu-assets/sounds/hover_character_selection.mp3",
  "client/sfx.js",
  "server/index.js",
  "electron/main.js",
  "scripts/start.mjs",
];

async function collect(directory) {
  const files = [];
  let entries = [];
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const entry of entries) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collect(full)));
    else if (/\.(?:js|mjs)$/.test(entry.name)) files.push(full);
  }
  return files;
}

for (const file of required) {
  const info = await stat(path.join(root, file)).catch(() => null);
  if (!info?.isFile()) errors.push(`File wajib tidak ditemukan: ${file}`);
}

let checked = 0;
for (const target of targets) {
  for (const file of await collect(path.join(root, target))) {
    const result = spawnSync(process.execPath, ["--check", file], { cwd: root, encoding: "utf8" });
    checked += 1;
    if (result.status !== 0) {
      errors.push(`Sintaks gagal: ${path.relative(root, file)}\n${result.stderr.trim()}`);
    }
  }
}

// Setiap karakter harus punya folder aset, dan gambar yang dirujuk harus ada.
const { CHARACTERS } = await import(path.join(root, "client", "characters.js"));
const ids = new Set();
for (const character of CHARACTERS) {
  if (ids.has(character.id)) errors.push(`ID karakter ganda: ${character.id}`);
  ids.add(character.id);
  const folder = await stat(path.join(root, "assets", "characters", character.id)).catch(() => null);
  if (!folder?.isDirectory()) errors.push(`Folder aset tidak ada: assets/characters/${character.id}/`);
  for (const key of ["avatar", "portrait", "background", "backgroundVideo"]) {
    if (!character[key]) continue;
    const file = await stat(path.join(root, decodeURI(character[key]))).catch(() => null);
    if (!file?.isFile()) errors.push(`${character.id}: berkas ${key} tidak ditemukan (${character[key]})`);
  }
  for (const [material, spec] of Object.entries(character.model?.materials ?? {})) {
    for (const [key, value] of Object.entries(spec)) {
      if (key === "color" || typeof value !== "string") continue;
      const file = await stat(path.join(root, value)).catch(() => null);
      if (!file?.isFile()) errors.push(`${character.id}: tekstur ${material}.${key} tidak ditemukan (${value})`);
    }
  }
  for (const key of ["mesh", "idle", "texture"]) {
    if (!character.model) break;
    if (key === "texture" && !character.model.texture) continue;
    const file = await stat(path.join(root, character.model[key] ?? "")).catch(() => null);
    if (!file?.isFile()) errors.push(`${character.id}: model.${key} tidak ditemukan (${character.model[key]})`);
  }
}

const html = await readFile(path.join(root, "index.html"), "utf8");
if (!html.includes("/client/main.js")) errors.push("index.html tidak memuat client/main.js.");

const manifest = JSON.parse(await readFile(path.join(root, "manifest.webmanifest"), "utf8"));
for (const size of ["192x192", "512x512"]) {
  if (!manifest.icons?.some((icon) => icon.sizes === size && icon.type === "image/png")) {
    errors.push(`Manifest butuh ikon PNG ${size}.`);
  }
}

if (errors.length > 0) {
  console.error("Pemeriksaan gagal:");
  for (const error of errors) console.error(` - ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Pemeriksaan lulus: ${checked} file JS valid, ${CHARACTERS.length} karakter terdaftar.`);
}
