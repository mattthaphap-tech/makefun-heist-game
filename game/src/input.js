// input.js — keyboard (WASD and arrows to move, Q for EMP, F for a
// noisemaker, Enter to start, R to restart, M to mute) and mouse (click to
// throw a noisemaker at that spot, click to start). Tracks held keys so the
// thief moves smoothly, and records single presses as events the game reads.

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set(); // keys pressed since last takePresses()
    this.click = null; // {x, y} canvas coords of the last click, or null
    this.canvas = canvas;

    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) {
        e.preventDefault();
      }
      if (!e.repeat) this.pressed.add(k);
      this.keys.add(k);
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.key.toLowerCase());
    });
    canvas.addEventListener('mousedown', (e) => {
      const r = canvas.getBoundingClientRect();
      this.click = {
        x: ((e.clientX - r.left) / r.width) * canvas.width,
        y: ((e.clientY - r.top) / r.height) * canvas.height,
      };
    });
    // Touch: a tap is a click (noisemaker), a drag moves Rin toward the finger.
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      const t = e.touches[0];
      this.click = {
        x: ((t.clientX - r.left) / r.width) * canvas.width,
        y: ((t.clientY - r.top) / r.height) * canvas.height,
      };
    }, { passive: false });
  }

  // Movement vector from held keys, normalized.
  moveVector() {
    let x = 0;
    let y = 0;
    if (this.keys.has('a') || this.keys.has('arrowleft')) x -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) x += 1;
    if (this.keys.has('w') || this.keys.has('arrowup')) y -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) y += 1;
    if (x !== 0 && y !== 0) {
      x *= Math.SQRT1_2;
      y *= Math.SQRT1_2;
    }
    return { x, y };
  }

  takePresses() {
    const p = this.pressed;
    this.pressed = new Set();
    return p;
  }

  takeClick() {
    const c = this.click;
    this.click = null;
    return c;
  }
}
