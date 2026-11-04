/**
 * Efek suara antarmuka (UI) yang pendek, misalnya hover di roster.
 * Memakai Web Audio (AudioBuffer) supaya latensinya rendah dan bisa diputar
 * berkali-kali dengan cepat. Berkas didekode sekali lalu dipakai ulang.
 *
 * Browser baru mengizinkan suara setelah interaksi pertama pengguna (klik,
 * ketuk, atau tombol); sebelum itu play() diam-diam diabaikan.
 */
export class UiSound {
  constructor(src, { volume = 0.5, minInterval = 0.06, muted = false } = {}) {
    this.src = src;
    this.volume = volume;
    this.minInterval = minInterval;
    this.muted = muted;
    this.ctx = null;
    this.gain = null;
    this.buffer = null;
    this.loading = null;
    this.current = null;
    this.lastPlay = -Infinity;

    this.onGesture = () => this.#unlock();
    for (const type of ["pointerdown", "keydown", "touchend"]) {
      window.addEventListener(type, this.onGesture, { passive: true });
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (muted) this.#stopCurrent(0.05);
  }

  /** Putar sekali. Klip sebelumnya dipotong dengan fade singkat agar tidak menumpuk. */
  play() {
    if (this.muted || !this.ctx || this.ctx.state !== "running" || !this.buffer) return;
    const now = this.ctx.currentTime;
    if (now - this.lastPlay < this.minInterval) return;
    this.lastPlay = now;
    this.#stopCurrent(0.03);

    const source = this.ctx.createBufferSource();
    source.buffer = this.buffer;
    const gain = this.ctx.createGain();
    gain.gain.value = this.volume;
    source.connect(gain).connect(this.gain);
    source.addEventListener("ended", () => {
      if (this.current?.source === source) this.current = null;
    });
    source.start(now);
    this.current = { source, gain };
  }

  #stopCurrent(fadeSeconds) {
    if (!this.current || !this.ctx) return;
    const { source, gain } = this.current;
    const now = this.ctx.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(0, now + fadeSeconds);
    try {
      source.stop(now + fadeSeconds);
    } catch {
      // Sudah berhenti.
    }
    this.current = null;
  }

  async #unlock() {
    try {
      if (!this.ctx) {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.gain = this.ctx.createGain();
        this.gain.connect(this.ctx.destination);
      }
      await this.ctx.resume();
      await this.#load();
      if (this.ctx.state === "running") {
        for (const type of ["pointerdown", "keydown", "touchend"]) {
          window.removeEventListener(type, this.onGesture);
        }
      }
    } catch (error) {
      console.warn("Efek suara tidak tersedia", error);
    }
  }

  #load() {
    if (!this.loading) {
      this.loading = fetch(this.src)
        .then((response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.arrayBuffer();
        })
        .then((data) => this.ctx.decodeAudioData(data))
        .then((buffer) => {
          this.buffer = buffer;
        })
        .catch((error) => {
          this.loading = null; // coba lagi pada interaksi berikutnya
          throw error;
        });
    }
    return this.loading;
  }
}
