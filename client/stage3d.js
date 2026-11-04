import {
  AnimationMixer,
  Box3,
  DirectionalLight,
  DoubleSide,
  HemisphereLight,
  LoopRepeat,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
  WebGLRenderer,
} from "../assets/vendor/three.module.js";
import { FBXLoader } from "../assets/vendor/addons/loaders/FBXLoader.js";

const FOV = 24;
const YAW = -0.38;
const MAX_PIXEL_RATIO = 2;

/**
 * Ganti material semua mesh dengan satu material bertekstur. Dipakai untuk FBX
 * tanpa material (mis. hasil rig Mixamo dari OBJ). DoubleSide karena potongan
 * kain dan rambut model game sering hanya satu sisi.
 */
function applyTexture(root, map) {
  map.colorSpace = SRGBColorSpace;
  const material = new MeshStandardMaterial({ map, side: DoubleSide, roughness: 0.8, metalness: 0 });
  root.traverse((node) => {
    if (node.isMesh) node.material = material;
  });
}

// Peta tekstur di model.materials -> properti MeshStandardMaterial.
const MAP_SLOTS = {
  map: "map",
  normal: "normalMap",
  roughness: "roughnessMap",
  metalness: "metalnessMap",
  ao: "aoMap",
  alpha: "alphaMap",
};

/**
 * Muat semua tekstur di model.materials (dedup per URL) lalu ganti tiap material
 * FBX yang namanya cocok dengan MeshStandardMaterial PBR. Mesh tanpa material
 * bernama "__DEFAULT" (penamaan FBXLoader). Material yang tidak terdaftar dibiarkan.
 */
async function loadMaterials(textureLoader, specs) {
  const cache = new Map();
  const texture = (url, srgb) => {
    if (!cache.has(url)) {
      cache.set(
        url,
        textureLoader.loadAsync(url).then((tex) => {
          if (srgb) tex.colorSpace = SRGBColorSpace;
          return tex;
        }),
      );
    }
    return cache.get(url);
  };
  const built = {};
  await Promise.all(
    Object.entries(specs).map(async ([name, spec]) => {
      const params = {
        side: DoubleSide,
        roughness: spec.roughness ? 1 : (spec.roughnessValue ?? 0.8),
        metalness: spec.metalness ? 1 : (spec.metalnessValue ?? 0),
      };
      if (spec.color) params.color = spec.color;
      await Promise.all(
        Object.entries(MAP_SLOTS).map(async ([key, slot]) => {
          if (spec[key]) params[slot] = await texture(spec[key], key === "map");
        }),
      );
      // Rambut dan hiasan berlubang: potong per piksel, tanpa sorting transparansi.
      if (params.alphaMap) params.alphaTest = spec.alphaTest ?? 0.5;
      built[name] = new MeshStandardMaterial(params);
    }),
  );
  return built;
}

function applyMaterials(root, materials) {
  const swap = (material) => materials[material?.name] ?? material;
  root.traverse((node) => {
    if (!node.isMesh) return;
    node.material = Array.isArray(node.material) ? node.material.map(swap) : swap(node.material);
  });
}

/**
 * Penampil 3D untuk panggung menu: satu canvas, satu scene, satu model tampil
 * pada satu waktu. Mesh dan animasi idle dimuat dari FBX terpisah (rig sama).
 */
export class StageViewer {
  constructor(container) {
    this.renderer = new WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.setClearColor(0x000000, 0);
    this.canvas = this.renderer.domElement;
    this.canvas.className = "stage-canvas";
    container.append(this.canvas);

    this.scene = new Scene();
    this.scene.add(new HemisphereLight(0xffffff, 0x554433, 1.6));
    const key = new DirectionalLight(0xfff0dd, 2.2);
    key.position.set(60, 120, 140);
    const rim = new DirectionalLight(0xffb066, 1.6);
    rim.position.set(-120, 80, -60);
    this.scene.add(key, rim);

    this.camera = new PerspectiveCamera(FOV, 3 / 4, 1, 2000);
    this.container = container;
    this.loader = new FBXLoader();
    this.textureLoader = new TextureLoader();
    this.entries = new Map();
    this.current = null;
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    this.lastTime = 0;

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
  }

  /** Muat (sekali) mesh dan animasi idle karakter. Hasilnya di-cache. */
  load(character) {
    if (!this.entries.has(character.id)) {
      this.entries.set(character.id, this.#loadEntry(character));
    }
    return this.entries.get(character.id);
  }

  async #loadEntry(character) {
    const { mesh, idle, texture, materials } = character.model;
    const [root, idleRig, map, built] = await Promise.all([
      this.loader.loadAsync(mesh),
      this.loader.loadAsync(idle),
      texture ? this.textureLoader.loadAsync(texture) : null,
      materials ? loadMaterials(this.textureLoader, materials) : null,
    ]);
    if (map) applyTexture(root, map);
    if (built) applyMaterials(root, built);
    root.rotation.y = YAW;
    root.visible = false;
    this.scene.add(root);

    const box = new Box3().setFromObject(root);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());

    const mixer = new AnimationMixer(root);
    const clip = idleRig.animations[0];
    if (clip) {
      const action = mixer.clipAction(clip);
      action.setLoop(LoopRepeat, Infinity);
      action.play();
    }
    return { root, mixer, size, center, framing: character.model.frame ?? {} };
  }

  /**
   * Tampilkan karakter dan mulai merender. isCurrent() dicek setelah pemuatan
   * selesai; bila sudah usang (pemain pindah karakter), tidak ada yang berubah.
   */
  async show(character, isCurrent = () => true) {
    const entry = await this.load(character);
    if (!isCurrent()) return null;
    if (this.current) this.current.root.visible = false;
    this.current = entry;
    entry.root.visible = true;
    this.frame(entry);
    this.start();
    return entry;
  }

  hide() {
    if (this.current) this.current.root.visible = false;
    this.current = null;
    this.stop();
  }

  start() {
    this.lastTime = performance.now();
    this.renderer.setAnimationLoop((time) => this.tick(time));
  }

  stop() {
    this.renderer.setAnimationLoop(null);
  }

  tick(time) {
    if (!this.current) return;
    const delta = this.reducedMotion.matches ? 0 : Math.min((time - this.lastTime) / 1000, 0.1);
    this.lastTime = time;
    this.current.mixer.update(delta);
    this.renderer.render(this.scene, this.camera);
  }

  resize() {
    const { clientWidth: width, clientHeight: height } = this.container;
    if (!width || !height) return;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    if (this.current) this.frame(this.current);
  }

  /**
   * Atur kamera agar model pas di panggung. Bawaan: seluruh badan memenuhi tinggi
   * panggung, kaki di bawah. model.frame mengubahnya untuk karakter yang bukan
   * badan penuh (mis. kepala melayang):
   *   fill   = bagian tinggi panggung yang diisi model (0..1, bawaan 1)
   *   anchor = posisi tengah model dari bawah panggung (0..1, bawaan 0.5)
   */
  frame({ size, center, framing = {} }) {
    const fill = framing.fill ?? 1;
    const anchor = framing.anchor ?? 0.5;
    const half = FOV * Math.PI / 360;
    const viewHeight = (size.y * 1.1) / fill;
    const fitHeight = viewHeight / 2 / Math.tan(half);
    const fitWidth = ((Math.max(size.x, size.z) * 1.1) / fill) / 2 / (Math.tan(half) * this.camera.aspect);
    const distance = Math.max(fitHeight, fitWidth);
    // Geser titik pandang ke bawah agar tengah model tampil di ketinggian anchor.
    const target = new Vector3(center.x, center.y - (anchor - 0.5) * viewHeight, center.z);
    this.camera.position.set(target.x, target.y, target.z + distance);
    this.camera.lookAt(target);
  }
}
