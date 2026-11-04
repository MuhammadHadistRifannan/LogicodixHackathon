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
    const { mesh, idle, texture } = character.model;
    const [root, idleRig, map] = await Promise.all([
      this.loader.loadAsync(mesh),
      this.loader.loadAsync(idle),
      texture ? this.textureLoader.loadAsync(texture) : null,
    ]);
    if (map) applyTexture(root, map);
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
    return { root, mixer, size, center };
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

  /** Atur kamera agar seluruh badan pas di panggung, kaki di bawah. */
  frame({ size, center }) {
    const half = FOV * Math.PI / 360;
    const fitHeight = (size.y * 1.1) / 2 / Math.tan(half);
    const fitWidth = (Math.max(size.x, size.z) * 1.1) / 2 / (Math.tan(half) * this.camera.aspect);
    const distance = Math.max(fitHeight, fitWidth);
    this.camera.position.set(center.x, center.y, center.z + distance);
    this.camera.lookAt(center);
  }
}
