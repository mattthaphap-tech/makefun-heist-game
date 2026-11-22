// audio.js — all sound is synthesized with WebAudio oscillators: no audio
// files, no network. Sound starts only after the first key or click, as
// browsers require. Every call is guarded so a game without audio still plays.

export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.startAmbient();
    } catch (e) {
      this.ctx = null;
    }
  }

  // A low museum-at-night drone: two detuned sines, barely audible, started
  // once with the audio context so the hall never feels silent.
  startAmbient() {
    if (!this.ctx || this.ambientStarted) return;
    this.ambientStarted = true;
    try {
      const g = this.ctx.createGain();
      g.gain.value = 0.012;
      g.connect(this.ctx.destination);
      for (const f of [55, 82.41]) {
        const o = this.ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = f;
        o.connect(g);
        o.start();
      }
    } catch (e) {
      /* sound is decoration; never break the game */
    }
  }

  // A short tone: frequency slides from f1 to f2 over `dur` seconds.
  tone(f1, f2, dur, type, vol) {
    if (this.muted || !this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(f1, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t + dur);
      g.gain.setValueAtTime(vol || 0.08, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g).connect(this.ctx.destination);
      o.start(t);
      o.stop(t + dur + 0.02);
    } catch (e) {
      /* sound is decoration; never break the game */
    }
  }

  step() {
    // Alternate the pitch a touch so footsteps don't sound like a metronome.
    this.stepAlt = !this.stepAlt;
    this.tone(this.stepAlt ? 180 : 165, 140, 0.05, 'triangle', 0.02);
  }

  pickup() {
    this.tone(660, 990, 0.18, 'sine', 0.1);
    setTimeout(() => this.tone(990, 1320, 0.22, 'sine', 0.09), 90);
  }

  spotted() {
    this.tone(220, 440, 0.25, 'square', 0.06);
  }

  alarmTick() {
    this.tone(880, 880, 0.07, 'square', 0.04);
  }

  emp() {
    this.tone(1200, 120, 0.4, 'sawtooth', 0.07);
  }

  noisePing() {
    this.tone(1500, 900, 0.3, 'sine', 0.08);
  }

  caught() {
    this.tone(330, 55, 0.7, 'sawtooth', 0.1);
  }

  win() {
    [523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => this.tone(f, f, 0.3, 'sine', 0.09), i * 110);
    });
  }
}
