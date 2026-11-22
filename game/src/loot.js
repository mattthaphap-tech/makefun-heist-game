// loot.js — the Sun Opal vault, the Crown in its case, and the getaway
// door. Rin takes the Opal by walking onto its pedestal; the door unlocks
// at once, and reaching it with the Opal is the win. The Crown is the
// second, optional loot: walking close to the CROWNS case lifts it, and
// taking it is what turns a SHADOW run into a GHOST run. Both grabs are
// automatic, so the game stays readable in a single screenshot.

import { CROWN } from './config.js';

export class Loot {
  constructor(vault, exit, crownCase) {
    this.vault = vault; // {x, y, r, taken, name}
    this.exit = exit; // {x, y, w, h, open}
    this.crownCase = crownCase || null; // the CROWNS display case rect
    this.crownTaken = false;
    this.grabbedAt = 0;
  }

  get taken() {
    return this.vault.taken;
  }

  // Centre of the Crown in its case, for the grab burst and the HUD.
  get crownCenter() {
    if (!this.crownCase) return { x: 0, y: 0 };
    return {
      x: this.crownCase.x + this.crownCase.w / 2,
      y: this.crownCase.y + this.crownCase.h / 2,
    };
  }

  // Call every frame with Rin's position and the running clock.
  update(thief, now) {
    if (!this.vault.taken) {
      const d = Math.hypot(thief.x - this.vault.x, thief.y - this.vault.y);
      if (d < this.vault.r + 14) {
        this.vault.taken = true;
        this.exit.open = true;
        this.grabbedAt = now;
        return 'grabbed';
      }
    }
    // The Crown: the case is a blocker, so Rin can only reach its edge —
    // the grab radius is generous enough to lift it from beside the glass.
    if (!this.crownTaken && this.crownCase) {
      const c = this.crownCenter;
      const d = Math.hypot(thief.x - c.x, thief.y - c.y);
      if (d < CROWN.grabRadius) {
        this.crownTaken = true;
        this.grabbedAt = now;
        return 'crown';
      }
    }
    return null;
  }

  // True when Rin stands inside the open exit doorway.
  escaped(thief) {
    if (!this.exit.open) return false;
    return (
      thief.x > this.exit.x - 6 &&
      thief.x < this.exit.x + this.exit.w + 6 &&
      thief.y > this.exit.y - 6 &&
      thief.y < this.exit.y + this.exit.h + 6
    );
  }
}
