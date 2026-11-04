const CURVE_POINTS = 64;

// Kurva daya-sama: terdengar lebih alami daripada fade linear.
function fadeCurve(volume, rising) {
  const curve = new Float32Array(CURVE_POINTS);
  for (let i = 0; i < CURVE_POINTS; i += 1) {
    const t = i / (CURVE_POINTS - 1);
    curve[i] = volume * (rising ? Math.sin((t * Math.PI) / 2) : Math.cos((t * Math.PI) / 2));
  }
  return curve;
}

/**
 * Musik latar yang berulang: fade in saat mulai, fade out menjelang akhir durasi,
 * lalu mulai lagi dari awal dengan fade in. Volume diatur lewat GainNode (Web Audio)
 * supaya presisi dan tetap bekerja di iOS.
 *
 * Browser memblokir suara otomatis; bila itu terjadi, musik mulai pada interaksi
 * pertama pengguna (klik, ketuk, atau tombol).
 */
export class BackgroundMusic {
  constructor(src, { volume = 0.6, fadeIn = 3, fadeOut = 4, muted = false } = {}) {
    this.volume = volume;
    this.fadeIn = fadeIn;
    this.fadeOut = fadeOut;
    this.wanted = false;
    this.playing = false;
    this.muted = muted;
    this.onChange = null;
    this.ctx = null;
    this.gain = null;
    this.pauseTimer = 0;
    this.gestureArmed = false;
    this.onGesture = () => this.#attempt(true);

    this.audio = new Audio(src);
    this.audio.preload = "auto";
    this.audio.addEventListener("ended", () => this.#onEnded());
    this.audio.addEventListener("seeked", () => this.playing && this.#schedule());
    document.addEventListener("visibilitychange", () => this.#onVisibility());
  }

  /** Mulai (atau lanjutkan) musik. Aman dipanggil berulang. */
  start() {
    this.wanted = true;
    this.#attempt();
  }

  /** Bisukan atau nyalakan lagi. Mute menjeda lagu dengan fade; nyalakan melanjutkan dengan fade in. */
  setMuted(muted) {
    if (muted === this.muted) return;
    this.muted = muted;
    if (muted) {
      this.#disarmGesture();
      if (this.playing) this.#fadeOutAndPause(0.4);
    } else {
      this.#attempt();
    }
    this.onChange?.();
  }

  /** Hentikan dengan fade out singkat, misalnya saat masuk pertandingan. */
  stop(fadeSeconds = 1.2) {
    this.wanted = false;
    this.#disarmGesture();
    if (this.playing) this.#fadeOutAndPause(fadeSeconds);
  }

  #ensureGraph() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.gain = this.ctx.createGain();
    this.gain.gain.value = 0;
    this.ctx.createMediaElementSource(this.audio).connect(this.gain).connect(this.ctx.destination);
  }

  async #attempt(fromGesture = false) {
    if (!this.wanted || this.muted || this.playing || document.hidden) return;
    try {
      this.#ensureGraph();
      clearTimeout(this.pauseTimer);
      await this.audio.play();
      // Tanpa izin autoplay, resume() menggantung, jadi percobaan otomatis diberi batas waktu.
      // Dari interaksi pengguna izin sudah ada; tunggu sampai selesai walau halaman sedang sibuk.
      const resumed = this.ctx.resume();
      await (fromGesture ? resumed : Promise.race([resumed, new Promise((resolve) => setTimeout(resolve, 400))]));
      if (this.ctx.state !== "running") throw new Error("AudioContext masih tertahan");
      if (!this.wanted || this.muted) {
        // Dibisukan atau dihentikan selagi menunggu izin memutar.
        this.audio.pause();
        return;
      }
      this.playing = true;
      this.#disarmGesture();
      this.#schedule();
      this.onChange?.();
    } catch {
      this.audio.pause();
      this.#armGesture();
    }
  }

  #armGesture() {
    if (this.gestureArmed) return;
    this.gestureArmed = true;
    for (const type of ["pointerdown", "keydown", "touchend"]) {
      window.addEventListener(type, this.onGesture, { passive: true });
    }
  }

  #disarmGesture() {
    if (!this.gestureArmed) return;
    this.gestureArmed = false;
    for (const type of ["pointerdown", "keydown", "touchend"]) {
      window.removeEventListener(type, this.onGesture);
    }
  }

  /** Jadwalkan fade in dari posisi sekarang dan fade out yang berakhir tepat di ujung durasi. */
  #schedule() {
    const { audio, ctx } = this;
    const param = this.gain.gain;
    const now = ctx.currentTime;
    param.cancelScheduledValues(now);
    param.setValueAtTime(0, now);
    param.setValueCurveAtTime(fadeCurve(this.volume, true), now, this.fadeIn);

    const remaining = audio.duration - audio.currentTime;
    if (!Number.isFinite(remaining)) return;
    const outStart = remaining - this.fadeOut;
    if (outStart >= this.fadeIn) {
      param.setValueAtTime(this.volume, now + this.fadeIn);
      param.setValueCurveAtTime(fadeCurve(this.volume, false), now + outStart, this.fadeOut);
    } else if (remaining > 0.5) {
      // Sisa durasi pendek: langsung turun tanpa menunggu fade in selesai.
      param.cancelScheduledValues(now);
      param.setValueAtTime(0, now);
      param.setValueCurveAtTime(fadeCurve(this.volume, false), now, remaining);
    }
  }

  #onEnded() {
    this.playing = false;
    this.onChange?.();
    if (!this.wanted) return;
    this.audio.currentTime = 0;
    this.#attempt();
  }

  #fadeOutAndPause(seconds) {
    const param = this.gain.gain;
    const now = this.ctx.currentTime;
    const level = param.value;
    param.cancelScheduledValues(now);
    param.setValueAtTime(level, now);
    param.linearRampToValueAtTime(0, now + seconds);
    this.playing = false;
    this.onChange?.();
    clearTimeout(this.pauseTimer);
    this.pauseTimer = setTimeout(() => this.audio.pause(), seconds * 1000 + 50);
  }

  #onVisibility() {
    if (document.hidden) {
      if (this.playing) this.#fadeOutAndPause(0.4);
    } else if (this.wanted) {
      this.#attempt();
    }
  }
}
