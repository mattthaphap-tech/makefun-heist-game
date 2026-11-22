// tools.js — Rin's two tools, both spent from a small stock, so every use is
// a decision. EMP (Q) shuts down cameras near Rin. Noisemaker (F, or a mouse
// click) pings a spot on the floor; the nearest guard in range walks over to
// look at it, which opens a path somewhere else.

import { TOOLS } from './config.js';

export class Tools {
  constructor() {
    this.emp = TOOLS.empStart;
    this.noise = TOOLS.noiseStart;
    this.noisePoint = null; // {x, y, until} — the ringing spot, drawn briefly
    this.empFlash = 0; // seconds left of the EMP burst ring
    this.empAt = null;
  }

  // Shut down every camera within EMP radius of Rin for a few seconds.
  useEmp(thief, cameras, now) {
    if (this.emp <= 0) return 'empty';
    this.emp -= 1;
    let hit = 0;
    for (const cam of cameras) {
      const d = Math.hypot(cam.x - thief.x, cam.y - thief.y);
      if (d <= TOOLS.empRadius) {
        cam.disable(TOOLS.empDisableSeconds);
        hit += 1;
      }
    }
    this.empFlash = 0.6;
    this.empAt = { x: thief.x, y: thief.y };
    return hit > 0 ? 'ok' : 'none-in-range';
  }

  // Throw a noisemaker at (x, y). The nearest guard in lure range goes to it.
  useNoise(x, y, guards, now) {
    if (this.noise <= 0) return 'empty';
    this.noise -= 1;
    this.noisePoint = { x, y, until: now + 1.2 };
    let best = null;
    let bestD = TOOLS.noiseLureRange;
    for (const g of guards) {
      const d = Math.hypot(g.x - x, g.y - y);
      if (d < bestD) {
        bestD = d;
        best = g;
      }
    }
    if (best) best.lureTo(x, y, TOOLS.noiseLureSeconds);
    return best ? 'ok' : 'no-guard-near';
  }

  update(now) {
    if (this.empFlash > 0) this.empFlash -= 1 / 60;
  }
}
