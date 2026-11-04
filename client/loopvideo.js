const FADE_MS = 1500;

/**
 * Video latar yang berulang tanpa lompatan. Dua elemen video bertumpuk: saat klip
 * hampir habis, salinan kedua mulai dari awal dan memudar masuk di atas yang pertama.
 * Video bisu, tanpa kontrol, dan tidak mengambil fokus.
 */
export class LoopVideo {
  constructor(container, src) {
    this.videos = [this.#create(src), this.#create(src)];
    container.append(...this.videos);
    this.front = this.videos[0];
    this.running = false;
    this.fading = false;
    this.layer = 1;
    this.frame = 0;
    this.timer = 0;
    this.videos.forEach((video) => video.addEventListener("ended", () => this.#onEnded(video)));
  }

  static supported() {
    const probe = document.createElement("video");
    return probe.canPlayType('video/webm; codecs="vp9"') !== "";
  }

  #create(src) {
    const video = document.createElement("video");
    video.className = "scene-video";
    video.src = src;
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.disablePictureInPicture = true;
    video.tabIndex = -1;
    video.setAttribute("aria-hidden", "true");
    video.addEventListener("error", () => this.stop());
    return video;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.fading = false;
    const [first, second] = this.videos;
    this.front = first;
    second.pause();
    second.classList.remove("is-on");
    first.currentTime = 0;
    first.style.zIndex = String(++this.layer);
    first.play().then(() => first.classList.add("is-on"), () => this.stop());
    this.frame = requestAnimationFrame(() => this.#tick());
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.frame);
    clearTimeout(this.timer);
    for (const video of this.videos) {
      video.pause();
      video.classList.remove("is-on");
    }
  }

  #tick() {
    if (!this.running) return;
    const { duration, currentTime } = this.front;
    if (!this.fading && duration && duration - currentTime <= FADE_MS / 1000) this.#crossfade();
    this.frame = requestAnimationFrame(() => this.#tick());
  }

  #onEnded(video) {
    // Tab sempat tersembunyi sehingga tick terlewat: lanjutkan segera dari awal.
    if (this.running && video === this.front && !this.fading) this.#crossfade();
  }

  #crossfade() {
    this.fading = true;
    const outgoing = this.front;
    const incoming = this.videos[1 - this.videos.indexOf(outgoing)];
    incoming.currentTime = 0;
    incoming.style.zIndex = String(++this.layer);
    incoming.play().then(
      () => incoming.classList.add("is-on"),
      () => this.stop(),
    );
    this.front = incoming;
    this.timer = setTimeout(() => {
      outgoing.pause();
      outgoing.classList.remove("is-on");
      this.fading = false;
    }, FADE_MS + 100);
  }
}
