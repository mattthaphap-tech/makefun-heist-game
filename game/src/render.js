// render.js — every pixel of the game is drawn here on one canvas: the
// museum floor, walls and display cases, the vault and the exit, the guards
// with their vision cones, the sweeping cameras, Rin, the HUD with its alarm
// meter, and the title / caught / escaped screens. Warm marble, crimson
// carpet, gold trim and lamplight: the whole look is code, no images.

import { COLORS, VIEW, NIGHT } from './config.js';
import { CAMERA, GUARD } from './config.js';
import { formatTime } from './util.js';

// Deterministic hash in [0,1) — decor that must look the same every run.
function hash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function diamond(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.lineTo(x + s, y);
  ctx.lineTo(x, y + s);
  ctx.lineTo(x - s, y);
  ctx.closePath();
}

// Soft vision cone: a faint wide halo plus a radial gradient that fades
// with distance, so the edge melts into the floor instead of a hard line.
// rgb is a 'r, g, b' string; peakAlpha is the brightness at the source.
function drawCone(ctx, x, y, facing, range, halfAngle, rgb, peakAlpha) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, range, facing - halfAngle - 0.06, facing + halfAngle + 0.06);
  ctx.closePath();
  ctx.fillStyle = `rgba(${rgb}, 0.05)`;
  ctx.fill();
  const g = ctx.createRadialGradient(x, y, 8, x, y, range);
  g.addColorStop(0, `rgba(${rgb}, ${peakAlpha})`);
  g.addColorStop(0.65, `rgba(${rgb}, ${peakAlpha * 0.45})`);
  g.addColorStop(1, `rgba(${rgb}, 0)`);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, range, facing - halfAngle, facing + halfAngle);
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.fill();
  // A whisper of an edge, so the cone stays readable.
  ctx.strokeStyle = `rgba(${rgb}, 0.28)`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, range, facing - halfAngle, facing + halfAngle);
  ctx.stroke();
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    // Offscreen canvas for the night: the darkness overlay is painted
    // here, light pools are cut out of it, and it is composited over the
    // room each frame. Reused, never reallocated.
    this.dark = document.createElement('canvas');
    this.dark.width = VIEW.w;
    this.dark.height = VIEW.h;
  }

  draw(game) {
    const ctx = this.ctx;
    const { level, guards, cameras, thief, loot, tools, alarm, state } = game;
    ctx.clearRect(0, 0, VIEW.w, VIEW.h);
    // The room trembles a little as the alarm climbs.
    const shake = state === 'play' && alarm > 40 ? ((alarm - 40) / 60) * 2.5 : 0;
    ctx.save();
    if (shake > 0) ctx.translate(Math.sin(game.now * 47) * shake, Math.cos(game.now * 39) * shake);
    this.drawFloor(ctx, game);
    this.drawWalls(ctx, level.walls);
    // The banner hangs in front of the walls: it is drawn after them, so
    // no divider cuts a gap through the title, and before the cases, so
    // a case never covers the tagline.
    if (state === 'title') this.drawTitleBanner(ctx);
    this.drawCases(ctx, level.cases, loot);
    this.drawVault(ctx, loot.vault, game.now);
    this.drawExit(ctx, loot.exit);
    // Night falls over the room: the static world dims, light pools stay
    // open around the actors, and the cones and characters drawn after it
    // read as light cutting through the dark. The HUD is drawn last and
    // never dims.
    this.drawNight(ctx, game);
    for (const cam of cameras) this.drawCamera(ctx, cam, game.now);
    for (const g of guards) this.drawGuard(ctx, g, game.now);
    this.drawThief(ctx, thief, game.now);
    this.drawToolsFx(ctx, tools, game.now);
    this.drawParticles(ctx, game.particles || []);
    this.drawDust(ctx, game.now);
    ctx.restore();
    this.drawHud(ctx, game);
    if (state === 'caught') this.drawCaught(ctx, game);
    if (state === 'won') this.drawWon(ctx, game);
    this.drawVignette(ctx);
  }

  spotlight(ctx, x, y, r, a) {
    const g = ctx.createRadialGradient(x, y, 4, x, y, r);
    g.addColorStop(0, `rgba(255, 214, 150, ${a})`);
    g.addColorStop(1, 'rgba(255, 214, 150, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Night lighting: a darkness layer over the room with light pools cut
  // into it. Every pool is a radial gradient on the offscreen canvas, so
  // the light falls off softly and the cones drawn after it stay bright.
  // The title banner is feathered out of the dark so it stays readable.
  drawNight(ctx, game) {
    const d = this.dark.getContext('2d');
    d.clearRect(0, 0, VIEW.w, VIEW.h);
    d.globalCompositeOperation = 'source-over';
    d.fillStyle = `rgba(5, 7, 18, ${NIGHT.overlayAlpha})`;
    d.fillRect(0, 0, VIEW.w, VIEW.h);
    d.globalCompositeOperation = 'destination-out';
    const hole = (x, y, r) => {
      const g = d.createRadialGradient(x, y, r * 0.15, x, y, r);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(0.7, 'rgba(0,0,0,0.75)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      d.fillStyle = g;
      d.beginPath();
      d.arc(x, y, r, 0, Math.PI * 2);
      d.fill();
    };
    // Feather the dark away from the title banner (y 60..136).
    const bg = d.createLinearGradient(0, 52, 0, 144);
    bg.addColorStop(0, 'rgba(0,0,0,0)');
    bg.addColorStop(0.12, 'rgba(0,0,0,0.9)');
    bg.addColorStop(0.88, 'rgba(0,0,0,0.9)');
    bg.addColorStop(1, 'rgba(0,0,0,0)');
    d.fillStyle = bg;
    d.fillRect(0, 52, VIEW.w, 92);
    // Exhibit spotlights, the Opal, the exit.
    for (const c of game.level.cases) hole(c.x + c.w / 2, c.y + c.h / 2, NIGHT.caseLight);
    hole(game.loot.vault.x, game.loot.vault.y, NIGHT.vaultLight);
    hole(game.loot.exit.x + 43, game.loot.exit.y + 38, NIGHT.exitLight);
    // Every eye in the room carries its own light.
    for (const cam of game.cameras) hole(cam.x, cam.y, NIGHT.cameraLight);
    for (const g of game.guards) hole(g.x, g.y, NIGHT.guardLight);
    hole(game.thief.x, game.thief.y, NIGHT.thiefLight);
    ctx.drawImage(this.dark, 0, 0);
  }

  drawMedallion(ctx, x, y) {
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 46, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, 38, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(212, 175, 55, 0.35)';
    diamond(ctx, x, y, 13);
    ctx.fill();
    diamond(ctx, x - 24, y, 5);
    ctx.fill();
    diamond(ctx, x + 24, y, 5);
    ctx.fill();
  }

  drawFloor(ctx, game) {
    // Warm marble: large checkerboard tiles with seeded veining.
    const T = 160;
    for (let ty = 0; ty < VIEW.h / T; ty++) {
      for (let tx = 0; tx < VIEW.w / T; tx++) {
        ctx.fillStyle = (tx + ty) % 2 === 0 ? COLORS.floor : COLORS.floorAlt;
        ctx.fillRect(tx * T, ty * T, T, T);
        const s = tx * 7 + ty * 13;
        ctx.strokeStyle = 'rgba(214, 186, 140, 0.10)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(tx * T + hash(s) * T, ty * T);
        ctx.quadraticCurveTo(tx * T + hash(s + 1) * T, ty * T + T * 0.5, tx * T + hash(s + 2) * T, ty * T + T);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(tx * T, ty * T + hash(s + 3) * T);
        ctx.quadraticCurveTo(tx * T + T * 0.5, ty * T + hash(s + 4) * T, tx * T + T, ty * T + hash(s + 5) * T);
        ctx.stroke();
      }
    }
    // Grout lines.
    ctx.strokeStyle = COLORS.floorGrout;
    ctx.lineWidth = 2;
    for (let x = 0; x <= VIEW.w; x += T) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, VIEW.h); ctx.stroke();
    }
    for (let y = 0; y <= VIEW.h; y += T) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(VIEW.w, y); ctx.stroke();
    }
    // Gold baseboard around the room's inner edge.
    ctx.strokeStyle = COLORS.gold;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 2;
    ctx.strokeRect(25, 25, VIEW.w - 50, VIEW.h - 50);
    ctx.globalAlpha = 1;
    // A second hairline inlay inside the baseboard, with gold diamonds
    // set into its corners: the floor reads as one designed surface.
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(33, 33, VIEW.w - 66, VIEW.h - 66);
    ctx.fillStyle = 'rgba(212, 175, 55, 0.6)';
    for (const [dx, dy] of [[33, 33], [VIEW.w - 33, 33], [33, VIEW.h - 33], [VIEW.w - 33, VIEW.h - 33]]) {
      diamond(ctx, dx, dy, 6);
      ctx.fill();
    }
    // Gold fan inlays on the floor at the two doorways: twin arcs with
    // radial ticks, marking the thresholds between the three rooms.
    for (const wx of [429, 869]) {
      ctx.strokeStyle = 'rgba(212, 175, 55, 0.45)';
      ctx.lineWidth = 2;
      for (const r of [58, 48]) {
        ctx.beginPath();
        ctx.arc(wx, 400, r, -Math.PI / 2, Math.PI / 2);
        ctx.stroke();
      }
      ctx.lineWidth = 1;
      for (const a of [-1.05, -0.52, 0, 0.52, 1.05]) {
        ctx.beginPath();
        ctx.moveTo(wx + Math.cos(a) * 48, 400 + Math.sin(a) * 48);
        ctx.lineTo(wx + Math.cos(a) * 58, 400 + Math.sin(a) * 58);
        ctx.stroke();
      }
    }
    // Inlaid gold medallions in the two open wings.
    this.drawMedallion(ctx, 330, 400);
    this.drawMedallion(ctx, 1000, 400);
    // A crimson carpet runner with gold borders down the central hall.
    ctx.fillStyle = COLORS.carpet;
    ctx.fillRect(560, 24, 160, 752);
    ctx.strokeStyle = COLORS.carpetGold;
    ctx.lineWidth = 3;
    ctx.strokeRect(566, 24, 148, 752);
    ctx.strokeStyle = 'rgba(201, 162, 39, 0.45)';
    ctx.lineWidth = 1;
    ctx.strokeRect(576, 24, 128, 752);
    ctx.fillStyle = COLORS.carpetGold;
    for (let y = 90; y < 760; y += 110) {
      diamond(ctx, 640, y, 7);
      ctx.fill();
    }
    // Warm spotlight pools under every exhibit.
    for (const c of game.level.cases) {
      this.spotlight(ctx, c.x + c.w / 2, c.y + c.h / 2, 120, 0.10);
    }
    this.spotlight(ctx, game.loot.vault.x, game.loot.vault.y, 160, 0.16);
    this.spotlight(ctx, game.loot.exit.x + 43, game.loot.exit.y + 38, 110, 0.08);
  }

  drawTitleBanner(ctx) {
    // A shallow gold-trimmed banner under the HUD: the whole room stays
    // visible behind the title, guards and cameras included. Kept small
    // (26px title, top at y=60) so the alarm meter in the HUD above it
    // always has clear air — the two never touch.
    ctx.fillStyle = 'rgba(10, 9, 18, 0.88)';
    ctx.fillRect(0, 60, VIEW.w, 76);
    ctx.fillStyle = COLORS.gold;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(0, 134, VIEW.w, 2);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#e8c85a';
    ctx.font = 'bold 26px Georgia, "Times New Roman", serif';
    try { ctx.letterSpacing = '2px'; } catch (e) { /* older canvas */ }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('MIDNIGHT AT THE MARROW MUSEUM', 36, 97);
    try { ctx.letterSpacing = '0px'; } catch (e) { /* older canvas */ }
    ctx.fillStyle = '#dbe7ff';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('One thief. Three guards. Two cameras. One Opal. One Crown.', 36, 123);
  }

  drawWalls(ctx, walls) {
    for (const w of walls) {
      // Dark wood panelling.
      ctx.fillStyle = COLORS.wall;
      ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.fillStyle = COLORS.wallTop;
      ctx.fillRect(w.x, w.y, w.w, 3);
      // Gold trim on the room-facing edges.
      ctx.fillStyle = 'rgba(212, 175, 55, 0.45)';
      if (w.w > w.h) {
        ctx.fillRect(w.x, w.y + (w.y < VIEW.h / 2 ? w.h - 2 : 0), w.w, 2);
      } else {
        ctx.fillRect(w.x, w.y, 2, w.h);
        ctx.fillRect(w.x + w.w - 2, w.y, 2, w.h);
      }
      // Panel seams.
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.lineWidth = 1;
      if (w.w > 200) {
        for (let x = w.x + 110; x < w.x + w.w; x += 110) {
          ctx.beginPath(); ctx.moveTo(x, w.y); ctx.lineTo(x, w.y + w.h); ctx.stroke();
        }
      }
      if (w.h > 200) {
        for (let y = w.y + 110; y < w.y + w.h; y += 110) {
          ctx.beginPath(); ctx.moveTo(w.x, y); ctx.lineTo(w.x + w.w, y); ctx.stroke();
        }
      }
      // Pilasters: a column face at each doorway end of the two dividers,
      // and down the long outer walls, so the rooms read as architecture.
      if (w.x === 420 || w.x === 860) {
        const py = (w.y + w.h < 400) ? w.y + w.h - 32 : w.y;
        this.drawPilaster(ctx, w.x - 6, py, 30, 32);
      }
      if (w.w === 24 && w.h === 800) {
        for (const py of [190, 390, 590]) this.drawPilaster(ctx, w.x, py, w.w, 36);
      }
    }
  }

  drawPilaster(ctx, x, y, w, h) {
    // A column face: lighter wood, gold capital and base, fluted grooves.
    ctx.fillStyle = '#3a2a1a';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = COLORS.gold;
    ctx.globalAlpha = 0.6;
    ctx.fillRect(x, y, w, 2); // capital
    ctx.fillRect(x, y + h - 2, w, 2); // base
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.moveTo(x + w / 3, y + 3); ctx.lineTo(x + w / 3, y + h - 3);
    ctx.moveTo(x + (2 * w) / 3, y + 3); ctx.lineTo(x + (2 * w) / 3, y + h - 3);
    ctx.stroke();
  }

  drawExhibit(ctx, c, crownTaken) {
    const cx = c.x + c.w / 2;
    const cy = c.y + 38;
    // Velvet cushion every exhibit rests on.
    ctx.fillStyle = '#4a1620';
    ctx.beginPath(); ctx.ellipse(cx, cy + 8, 30, 9, 0, 0, Math.PI * 2); ctx.fill();
    switch (c.label) {
      case 'JADE': {
        ctx.fillStyle = '#4a9e6a';
        ctx.beginPath(); ctx.ellipse(cx, cy, 20, 12, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.beginPath(); ctx.ellipse(cx - 6, cy - 4, 7, 4, -0.4, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'COINS': {
        ctx.fillStyle = '#d4af37';
        for (const [dx, dy] of [[-14, 4], [0, -2], [14, 4]]) {
          ctx.beginPath(); ctx.arc(cx + dx, cy + dy, 9, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = '#8a6d00';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('$', cx, cy + 1);
        break;
      }
      case 'MASKS': {
        for (const dx of [-16, 16]) {
          ctx.fillStyle = dx < 0 ? '#2dd4bf' : '#e8c85a';
          ctx.beginPath(); ctx.ellipse(cx + dx, cy, 11, 14, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#1a1a22';
          ctx.beginPath(); ctx.arc(cx + dx - 4, cy - 3, 1.8, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(cx + dx + 4, cy - 3, 1.8, 0, Math.PI * 2); ctx.fill();
        }
        break;
      }
      case 'SCROLLS': {
        ctx.fillStyle = '#e8dcc0';
        roundRect(ctx, cx - 26, cy - 8, 52, 7, 3); ctx.fill();
        roundRect(ctx, cx - 22, cy + 2, 44, 7, 3); ctx.fill();
        ctx.fillStyle = '#b09a6a';
        ctx.fillRect(cx - 26, cy - 8, 4, 7);
        ctx.fillRect(cx + 22, cy - 8, 4, 7);
        break;
      }
      case 'CROWNS': {
        // An empty cushion when Rin has lifted it: the case tells the story.
        if (crownTaken) break;
        ctx.fillStyle = '#d4af37';
        ctx.beginPath();
        ctx.moveTo(cx - 18, cy + 10);
        ctx.lineTo(cx - 18, cy - 6);
        ctx.lineTo(cx - 9, cy + 2);
        ctx.lineTo(cx, cy - 10);
        ctx.lineTo(cx + 9, cy + 2);
        ctx.lineTo(cx + 18, cy - 6);
        ctx.lineTo(cx + 18, cy + 10);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#c94f7c';
        ctx.beginPath(); ctx.arc(cx, cy + 2, 3, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'VASES': {
        ctx.fillStyle = '#7fb3d9';
        ctx.beginPath();
        ctx.moveTo(cx - 5, cy - 12);
        ctx.lineTo(cx + 5, cy - 12);
        ctx.lineTo(cx + 5, cy - 6);
        ctx.bezierCurveTo(cx + 13, cy - 2, cx + 13, cy + 8, cx, cy + 12);
        ctx.bezierCurveTo(cx - 13, cy + 8, cx - 13, cy - 2, cx - 5, cy - 6);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#d4af37';
        ctx.fillRect(cx - 8, cy - 2, 16, 2);
        break;
      }
      case 'RELIC': {
        ctx.fillStyle = '#e8c85a';
        ctx.beginPath();
        ctx.moveTo(cx, cy - 12);
        ctx.lineTo(cx + 8, cy);
        ctx.lineTo(cx, cy + 12);
        ctx.lineTo(cx - 8, cy);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#4a3a1a';
        ctx.fillRect(cx - 12, cy + 12, 24, 3);
        break;
      }
      default: break;
    }
  }

  drawCases(ctx, cases, loot) {
    for (const c of cases) {
      // Brass base.
      ctx.fillStyle = '#4a3a1a';
      roundRect(ctx, c.x, c.y + c.h - 10, c.w, 10, 3);
      ctx.fill();
      // Cabinet body.
      ctx.fillStyle = COLORS.caseBody;
      roundRect(ctx, c.x, c.y, c.w, c.h, 8);
      ctx.fill();
      // The exhibit itself, in the lower half of the case.
      this.drawExhibit(ctx, c, loot && loot.crownTaken);
      // Glass top with a diagonal shine streak.
      ctx.fillStyle = 'rgba(127, 212, 255, 0.16)';
      roundRect(ctx, c.x + 8, c.y + 8, c.w - 16, c.h - 26, 5);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
      ctx.beginPath();
      ctx.moveTo(c.x + 18, c.y + c.h - 20);
      ctx.lineTo(c.x + 46, c.y + 10);
      ctx.lineTo(c.x + 58, c.y + 10);
      ctx.lineTo(c.x + 30, c.y + c.h - 20);
      ctx.closePath();
      ctx.fill();
      // Gold rim.
      ctx.strokeStyle = COLORS.caseGold;
      ctx.lineWidth = 2;
      roundRect(ctx, c.x, c.y, c.w, c.h, 8);
      ctx.stroke();
      // Brass plaque with the label, inside the glass at the top — a guard
      // walking past can never cover it.
      ctx.font = 'bold 11px Georgia, serif';
      const tw = ctx.measureText(c.label).width;
      const px = c.x + c.w / 2 - tw / 2 - 8;
      const py = c.y + 10;
      ctx.fillStyle = 'rgba(10, 8, 6, 0.72)';
      roundRect(ctx, px, py, tw + 16, 16, 3);
      ctx.fill();
      ctx.fillStyle = '#e8d9a0';
      ctx.textAlign = 'center';
      ctx.fillText(c.label, c.x + c.w / 2, py + 12);
    }
  }

  drawVault(ctx, vault, now) {
    // Velvet rope barrier, open toward the wall: gold posts on the sides and
    // the bottom, red ropes sagging between them. (The vault sits too close
    // to the top wall for a rope there — the HUD would swallow it.)
    const posts = [
      [vault.x - 52, vault.y],
      [vault.x + 52, vault.y],
      [vault.x + 52, vault.y + 52],
      [vault.x - 52, vault.y + 52],
    ];
    const ropes = [[0, 3], [3, 2], [2, 1]]; // left, bottom, right
    ctx.strokeStyle = COLORS.rope;
    ctx.lineWidth = 3;
    for (const [i, j] of ropes) {
      const [ax, ay] = posts[i];
      const [bx, by] = posts[j];
      const mx = (ax + bx) / 2;
      const my = (ay + by) / 2;
      const nx = mx - vault.x;
      const ny = my - vault.y;
      const nl = Math.hypot(nx, ny) || 1;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.quadraticCurveTo(mx + (nx / nl) * 9, my + (ny / nl) * 9, bx, by);
      ctx.stroke();
    }
    for (const [px, py] of posts) {
      ctx.fillStyle = '#1a1a22';
      ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = COLORS.gold;
      ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI * 2); ctx.fill();
    }
    // Pedestal: a marble base step, then the gold-trimmed plinth, with a
    // vault-wheel emblem on its front — the Opal sits in a little safe.
    ctx.fillStyle = '#2c2138';
    roundRect(ctx, vault.x - 42, vault.y - 6, 84, 44, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.4)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, vault.x - 42, vault.y - 6, 84, 44, 6);
    ctx.stroke();
    ctx.fillStyle = COLORS.vaultPedestal;
    roundRect(ctx, vault.x - 34, vault.y - 34, 68, 68, 8);
    ctx.fill();
    ctx.strokeStyle = COLORS.caseGold;
    ctx.lineWidth = 2;
    roundRect(ctx, vault.x - 34, vault.y - 34, 68, 68, 8);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.10)';
    roundRect(ctx, vault.x - 28, vault.y - 28, 56, 10, 4);
    ctx.fill();
    // Vault wheel: a gold ring with spokes on the plinth front, below the Opal.
    ctx.strokeStyle = COLORS.gold;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(vault.x, vault.y + 26, 6, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(vault.x - 6, vault.y + 26); ctx.lineTo(vault.x + 6, vault.y + 26);
    ctx.moveTo(vault.x, vault.y + 20); ctx.lineTo(vault.x, vault.y + 32);
    ctx.stroke();
    ctx.fillStyle = COLORS.gold;
    ctx.beginPath(); ctx.arc(vault.x, vault.y + 26, 2, 0, Math.PI * 2); ctx.fill();
    // Placard above the pedestal, on a dark plaque so it stays readable —
    // Sable's patrol line runs straight through the pedestal itself.
    const vaultLabel = (text) => {
      ctx.font = 'bold 10px sans-serif';
      const tw = ctx.measureText(text).width;
      ctx.fillStyle = 'rgba(10, 8, 6, 0.72)';
      roundRect(ctx, vault.x - tw / 2 - 6, vault.y - 38, tw + 12, 15, 3);
      ctx.fill();
      ctx.fillStyle = '#e8d9a0';
      ctx.textAlign = 'center';
      ctx.fillText(text, vault.x, vault.y - 26);
    };
    if (!vault.taken) {
      // The Sun Opal: a pulsing gold diamond with a glow and sparkle rays.
      // The glow is the brightest thing in the dark room: the cover's focal point.
      const pulse = 1 + 0.12 * Math.sin(now * 3);
      const halo = ctx.createRadialGradient(vault.x, vault.y, 20, vault.x, vault.y, 92);
      halo.addColorStop(0, 'rgba(255, 215, 94, 0.16)');
      halo.addColorStop(1, 'rgba(255, 215, 94, 0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(vault.x, vault.y, 92, 0, Math.PI * 2);
      ctx.fill();
      const g = ctx.createRadialGradient(vault.x, vault.y, 2, vault.x, vault.y, 58 * pulse);
      g.addColorStop(0, COLORS.opalGlow);
      g.addColorStop(1, 'rgba(255, 215, 94, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(vault.x, vault.y, 58 * pulse, 0, Math.PI * 2);
      ctx.fill();
      // Slow-turning sparkle rays.
      ctx.strokeStyle = 'rgba(255, 246, 201, 0.7)';
      ctx.lineWidth = 1.5;
      const ra = now * 0.7;
      for (let i = 0; i < 4; i++) {
        const a = ra + (i * Math.PI) / 2;
        ctx.beginPath();
        ctx.moveTo(vault.x + Math.cos(a) * 20, vault.y + Math.sin(a) * 20);
        ctx.lineTo(vault.x + Math.cos(a) * 30, vault.y + Math.sin(a) * 30);
        ctx.stroke();
      }
      ctx.fillStyle = COLORS.opal;
      ctx.beginPath();
      ctx.moveTo(vault.x, vault.y - 18);
      ctx.lineTo(vault.x + 13, vault.y);
      ctx.lineTo(vault.x, vault.y + 18);
      ctx.lineTo(vault.x - 13, vault.y);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fff6c9';
      ctx.beginPath();
      ctx.moveTo(vault.x, vault.y - 18);
      ctx.lineTo(vault.x + 6, vault.y - 4);
      ctx.lineTo(vault.x - 6, vault.y - 4);
      ctx.closePath();
      ctx.fill();
      vaultLabel('SUN OPAL');
    } else {
      vaultLabel('EMPTY');
    }
  }

  drawExit(ctx, exit) {
    const open = exit.open;
    // A real doorway: flanking pilasters and a gold arch band over the
    // door. The arch is decorative; the hitbox stays the door rect.
    ctx.fillStyle = '#3a2a1a';
    ctx.fillRect(exit.x - 8, exit.y - 8, 10, exit.h + 16);
    ctx.fillRect(exit.x + exit.w - 2, exit.y - 8, 10, exit.h + 16);
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.6)';
    ctx.lineWidth = 1;
    ctx.strokeRect(exit.x - 8.5, exit.y - 8.5, 11, exit.h + 17);
    ctx.strokeRect(exit.x + exit.w - 2.5, exit.y - 8.5, 11, exit.h + 17);
    ctx.strokeStyle = COLORS.gold;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(exit.x + exit.w / 2, exit.y, exit.w / 2 + 8, Math.PI, 0);
    ctx.stroke();
    // Gold door frame.
    ctx.strokeStyle = COLORS.gold;
    ctx.lineWidth = 3;
    ctx.strokeRect(exit.x - 4, exit.y - 4, exit.w + 8, exit.h + 8);
    ctx.fillStyle = open ? COLORS.exitOpen : COLORS.exitLocked;
    ctx.fillRect(exit.x, exit.y, exit.w, exit.h);
    ctx.strokeStyle = open ? '#b8ffce' : '#93a5b5';
    ctx.lineWidth = 3;
    ctx.strokeRect(exit.x, exit.y, exit.w, exit.h);
    ctx.fillStyle = open ? '#063d1e' : '#e8eef5';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(open ? 'EXIT' : 'LOCKED', exit.x + exit.w / 2, exit.y + exit.h / 2 - 4);
    ctx.font = '10px sans-serif';
    ctx.fillText(open ? 'GO! GO! GO!' : 'NEEDS OPAL', exit.x + exit.w / 2, exit.y + exit.h / 2 + 16);
    if (open) {
      // A green glow spilling out of the open door.
      const g = ctx.createLinearGradient(exit.x + exit.w, 0, exit.x + exit.w + 90, 0);
      g.addColorStop(0, 'rgba(55, 214, 122, 0.35)');
      g.addColorStop(1, 'rgba(55, 214, 122, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(exit.x + exit.w, exit.y, 90, exit.h);
    }
  }

  drawCamera(ctx, cam, now) {
    if (!cam.disabled) {
      drawCone(ctx, cam.x, cam.y, cam.angle, CAMERA.coneRange, CAMERA.coneHalfAngle, '255, 80, 80', 0.38);
    } else {
      drawCone(ctx, cam.x, cam.y, cam.angle, CAMERA.coneRange * 0.45, CAMERA.coneHalfAngle, '120, 130, 150', 0.06);
    }
    // Wall mount base.
    ctx.fillStyle = '#3a3f4a';
    ctx.beginPath();
    ctx.arc(cam.x, cam.y, 7, 0, Math.PI * 2);
    ctx.fill();
    // Camera body, angled along its sweep.
    const bx = cam.x + Math.cos(cam.angle) * 9;
    const by = cam.y + Math.sin(cam.angle) * 9;
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(cam.angle);
    ctx.fillStyle = '#2a2f3a';
    roundRect(ctx, -6, -5, 18, 10, 3);
    ctx.fill();
    ctx.fillStyle = cam.disabled ? '#7a828f' : '#ff5a5a';
    ctx.beginPath();
    ctx.arc(12, 0, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Blinking red tally light on the mount.
    if (!cam.disabled) {
      ctx.fillStyle = `rgba(255, 90, 90, ${0.45 + 0.45 * Math.sin(now * 4)})`;
      ctx.beginPath();
      ctx.arc(cam.x, cam.y - 9, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#dbe7ff';
    ctx.font = 'bold 10px sans-serif';
    // Labels on the right-hand wall point left so they never run off-canvas.
    if (cam.x > VIEW.w / 2) {
      ctx.textAlign = 'right';
      ctx.fillText(cam.disabled ? `${cam.label} OFFLINE` : cam.label, cam.x - 14, cam.y + 4);
    } else {
      ctx.textAlign = 'left';
      ctx.fillText(cam.disabled ? `${cam.label} OFFLINE` : cam.label, cam.x + 14, cam.y + 4);
    }
  }

  drawGuard(ctx, g, now) {
    const alerted = g.state === 'chase' || g.state === 'suspicious';
    // Cones are light in the dark room now: brighter at the source.
    drawCone(ctx, g.x, g.y, g.facing, GUARD.coneRange, GUARD.coneHalfAngle,
      alerted ? '255, 90, 60' : '255, 214, 90', alerted ? 0.38 : 0.34);
    // Flashlight beam: a short pale wedge along the facing, swinging
    // gently with the stride while he walks.
    const swing = g.moving ? Math.sin(g.walkPhase) * 0.05 : 0;
    const beamAngle = g.facing + swing;
    const fg = ctx.createRadialGradient(g.x, g.y, 4, g.x, g.y, 78);
    fg.addColorStop(0, 'rgba(255, 244, 200, 0.26)');
    fg.addColorStop(1, 'rgba(255, 244, 200, 0)');
    ctx.beginPath();
    ctx.moveTo(g.x, g.y);
    ctx.arc(g.x, g.y, 78, beamAngle - 0.14, beamAngle + 0.14);
    ctx.closePath();
    ctx.fillStyle = fg;
    ctx.fill();
    // Walk bob and stride.
    const bob = g.moving ? Math.sin(g.walkPhase * 2) * 1.2 : 0;
    const x = g.x;
    const y = g.y + bob;
    const fx = Math.cos(g.facing);
    const fy = Math.sin(g.facing);
    const px = -fy;
    const py = fx;
    // Soft shadow (stays on the floor, not bobbing).
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(g.x, g.y + 10, 12, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Stride: two shoes alternating forward along the facing.
    if (g.moving) {
      const s = Math.sin(g.walkPhase) * 6;
      ctx.fillStyle = '#14100c';
      for (const [along, side] of [[s, -6], [-s, 6]]) {
        ctx.beginPath();
        ctx.ellipse(x + fx * along + px * side, y + fy * along + py * side, 4, 2.6, g.facing, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Shoulders: an ellipse across the facing, sized to the build.
    // Bram is broad, Okafor is tall, Sable is slim — three silhouettes.
    const build = g.name === 'Bram' ? { along: 12, across: 17 } : g.name === 'Okafor' ? { along: 16, across: 13 } : { along: 11, across: 12 };
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(g.facing);
    ctx.fillStyle = g.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, build.along, build.across, 0, 0, Math.PI * 2);
    ctx.fill();
    // Gold belt across the chest.
    ctx.strokeStyle = 'rgba(255, 215, 90, 0.85)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -build.across + 1);
    ctx.lineTo(0, build.across - 1);
    ctx.stroke();
    // Gold badge dot on the chest, forward.
    ctx.fillStyle = '#ffd75e';
    ctx.beginPath();
    ctx.arc(build.along - 4, 0, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Hand flashlight at the forward side, lens glowing.
    ctx.save();
    ctx.translate(x + fx * 8 + px * 10, y + fy * 8 + py * 10);
    ctx.rotate(g.facing);
    ctx.fillStyle = '#1f2733';
    roundRect(ctx, -5, -2.5, 11, 5, 2);
    ctx.fill();
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath();
    ctx.arc(7, 0, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Peaked cap: dark navy, with a gold brim pointing where he looks.
    ctx.fillStyle = '#1f2733';
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffd75e';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(x + fx * 6, y + fy * 6);
    ctx.lineTo(x + fx * 15, y + fy * 15);
    ctx.stroke();
    // Cap band in the guard's colour, and a gold button on top.
    ctx.strokeStyle = g.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 8, g.facing - 1.1, g.facing + 1.1);
    ctx.stroke();
    ctx.fillStyle = '#ffd75e';
    ctx.beginPath();
    ctx.arc(x, y, 1.6, 0, Math.PI * 2);
    ctx.fill();
    // "!" alert badge, popping while he stares.
    if (alerted) {
      const pop = 1 + 0.18 * Math.sin(now * 9);
      ctx.save();
      ctx.translate(x, y - 26);
      ctx.scale(pop, pop);
      ctx.fillStyle = '#ff4d4d';
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', 0, 1);
      ctx.restore();
    }
    ctx.fillStyle = '#ffd9d9';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(g.name.toUpperCase(), x, y + 27);
  }

  drawThief(ctx, thief, now) {
    // The stride cycle drives the bob and the feet, so Rin only walks
    // when she is actually moving.
    const bob = thief.moving ? Math.sin(thief.walkPhase * 2) * 1.5 : 0;
    const x = thief.x;
    const y = thief.y + bob;
    const fx = Math.cos(thief.facing);
    const fy = Math.sin(thief.facing);
    const bx = -fx;
    const by = -fy;
    const px = -fy;
    const py = fx;
    // Soft shadow (stays on the floor, not bobbing).
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(x, thief.y + 11, 13, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    // Stride: two dark shoes alternating forward along the facing.
    if (thief.moving) {
      const s = Math.sin(thief.walkPhase) * 6;
      ctx.fillStyle = '#14100c';
      for (const [along, side] of [[s, -5], [-s, 5]]) {
        ctx.beginPath();
        ctx.ellipse(x + fx * along + px * side, y + fy * along + py * side, 4, 2.4, thief.facing, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Teal scarf trailing behind, flowing: a wide main strand and a
    // thinner second strand, both waving harder while she moves.
    const wave = thief.moving ? 5 : 3;
    const flutter = Math.sin(now * 6) * wave;
    const flutter2 = Math.sin(now * 6 + 1.4) * wave * 0.7;
    ctx.strokeStyle = COLORS.thiefScarf;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + bx * 8, y + by * 8);
    ctx.quadraticCurveTo(
      x + bx * 17 + px * flutter, y + by * 17 + py * flutter,
      x + bx * 27 + px * flutter * 1.4, y + by * 27 + py * flutter * 1.4,
    );
    ctx.stroke();
    ctx.strokeStyle = 'rgba(45, 212, 191, 0.65)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x + bx * 8 + px * 3, y + by * 8 + py * 3);
    ctx.quadraticCurveTo(
      x + bx * 15 + px * flutter2, y + by * 15 + py * flutter2,
      x + bx * 22 + px * flutter2 * 1.4, y + by * 22 + py * flutter2 * 1.4,
    );
    ctx.stroke();
    // Cloak: a dark teardrop behind the hood, so Rin reads as a cloaked
    // figure rather than a circle.
    ctx.fillStyle = '#1b1f2e';
    ctx.beginPath();
    ctx.ellipse(x + bx * 6, y + by * 6, 12, 9, thief.facing, 0, Math.PI * 2);
    ctx.fill();
    // Hood: a dark slate circle with a point at the back.
    ctx.fillStyle = '#232838';
    ctx.beginPath();
    ctx.arc(x, y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + bx * 10 - px * 5, y + by * 10 - py * 5);
    ctx.lineTo(x + bx * 19, y + by * 19);
    ctx.lineTo(x + bx * 10 + px * 5, y + by * 10 + py * 5);
    ctx.closePath();
    ctx.fill();
    // Warm rim light on the hood's upper edge.
    ctx.strokeStyle = 'rgba(255, 220, 150, 0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 12, -Math.PI * 0.85, -Math.PI * 0.15);
    ctx.stroke();
    // Face: pale, toward the facing direction, with two eyes.
    const ex = x + fx * 4;
    const ey = y + fy * 4;
    ctx.fillStyle = '#e8d9c0';
    ctx.beginPath();
    ctx.arc(ex, ey, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a1a22';
    ctx.beginPath();
    ctx.arc(ex + fx * 2 + px * 3, ey + fy * 2 + py * 3, 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(ex + fx * 2 - px * 3, ey + fy * 2 - py * 3, 1.4, 0, Math.PI * 2);
    ctx.fill();
    // Lockpick glint at the facing edge.
    ctx.fillStyle = '#ffd75e';
    ctx.beginPath();
    ctx.arc(x + fx * 15, y + fy * 15, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8e8e8';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('RIN', x, y - 21);
  }

  drawToolsFx(ctx, tools, now) {
    if (tools.noisePoint && now < tools.noisePoint.until) {
      const p = tools.noisePoint;
      const age = 1 - (tools.noisePoint.until - now) / 1.2;
      ctx.strokeStyle = `rgba(255, 214, 90, ${0.9 - age * 0.7})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 12 + age * 46, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#ffd65a';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('CLINK!', p.x, p.y - 18);
    }
    if (tools.empFlash > 0 && tools.empAt) {
      const a = tools.empAt;
      ctx.strokeStyle = `rgba(127, 212, 255, ${tools.empFlash})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(a.x, a.y, (0.6 - tools.empFlash) * 420 + 30, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  drawParticles(ctx, particles) {
    for (const p of particles) {
      const a = Math.max(0, p.life / p.max);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.5 + a * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  drawDust(ctx, now) {
    for (let i = 0; i < 36; i++) {
      const x = hash(i * 3 + 1) * VIEW.w + Math.sin(now * 0.12 + i) * 7;
      const y = hash(i * 3 + 2) * VIEW.h + Math.cos(now * 0.09 + i * 1.7) * 7;
      const a = 0.08 + 0.10 * (0.5 + 0.5 * Math.sin(now * 0.6 + i * 2.3));
      ctx.fillStyle = `rgba(255, 230, 180, ${a.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(x, y, 0.8 + hash(i * 3 + 3) * 1.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawBolt(ctx, x, y, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x + 2, y - 9);
    ctx.lineTo(x - 4, y + 1);
    ctx.lineTo(x - 1, y + 1);
    ctx.lineTo(x - 2, y + 9);
    ctx.lineTo(x + 4, y - 1);
    ctx.lineTo(x + 1, y - 1);
    ctx.closePath();
    ctx.fill();
  }

  drawBell(ctx, x, y) {
    ctx.fillStyle = '#dbe7ff';
    ctx.beginPath();
    ctx.arc(x, y - 1, 6, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(x - 6, y - 1, 12, 2);
    ctx.beginPath();
    ctx.arc(x, y + 4, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // A keyboard key drawn as a chip: dark face, pale rim, bold letter.
  drawKeycap(ctx, x, y, label) {
    ctx.font = 'bold 11px sans-serif';
    const w = ctx.measureText(label).width + 12;
    ctx.fillStyle = '#1c2436';
    roundRect(ctx, x, y - 8, w, 16, 4);
    ctx.fill();
    ctx.strokeStyle = '#5a6b7a';
    ctx.lineWidth = 1;
    roundRect(ctx, x + 0.5, y - 7.5, w - 1, 15, 4);
    ctx.stroke();
    ctx.fillStyle = '#e8eef5';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w / 2, y + 1);
    ctx.textBaseline = 'alphabetic';
    return w;
  }

  // A hint line made of text runs and keycap chips, centred on the bar.
  drawHintLine(ctx, segments, y) {
    ctx.font = '12px sans-serif';
    let total = 0;
    for (const s of segments) {
      if (s.k) {
        ctx.font = 'bold 11px sans-serif';
        total += ctx.measureText(s.k).width + 12 + 4;
        ctx.font = '12px sans-serif';
      } else {
        total += ctx.measureText(s.t).width;
      }
    }
    let x = (VIEW.w - total) / 2;
    for (const s of segments) {
      if (s.k) {
        x += this.drawKeycap(ctx, x, y, s.k) + 4;
      } else {
        ctx.fillStyle = s.c || '#9fb3d9';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(s.t, x, y + 1);
        ctx.textBaseline = 'alphabetic';
        x += ctx.measureText(s.t).width;
      }
    }
  }

  drawHud(ctx, game) {
    const { alarm, loot, tools, elapsed } = game;
    // Top bar.
    ctx.fillStyle = COLORS.hudBg;
    ctx.fillRect(0, 0, VIEW.w, 56);
    // Gold divider under the bar.
    ctx.fillStyle = COLORS.gold;
    ctx.globalAlpha = 0.7;
    ctx.fillRect(0, 56, VIEW.w, 2);
    ctx.globalAlpha = 1;
    // Title, museum serif in gold: 22px on a 29 baseline, so the caps
    // sit well clear of the frame edge — the old 24px on 25 sat so high
    // the tops of the letters read as clipped by the canvas edge.
    // In the title state the banner below is the masthead, so the HUD
    // does not repeat the title.
    if (game.state !== 'title') {
      ctx.fillStyle = '#e8c85a';
      ctx.font = 'bold 22px Georgia, "Times New Roman", serif';
      try { ctx.letterSpacing = '1px'; } catch (e) { /* older canvas */ }
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText('MIDNIGHT AT THE MARROW MUSEUM', 16, 29);
      try { ctx.letterSpacing = '0px'; } catch (e) { /* older canvas */ }
      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#9fb3d9';
      ctx.fillText(loot.taken ? 'Opal stolen — reach the EXIT!' : 'Steal the SUN OPAL, then reach the EXIT', 16, 48);
    }

    // Alarm meter (centre): gradient fill, segment ticks, glow when hot.
    const ax = 470, ay = 14, aw = 340, ah = 22;
    ctx.fillStyle = '#101827';
    roundRect(ctx, ax, ay, aw, ah, 6);
    ctx.fill();
    const frac = alarm / 100;
    if (frac > 0) {
      const grad = ctx.createLinearGradient(ax, 0, ax + aw, 0);
      grad.addColorStop(0, COLORS.alarmLow);
      grad.addColorStop(0.5, COLORS.alarmMid);
      grad.addColorStop(1, COLORS.alarmHigh);
      if (frac > 0.75) {
        ctx.shadowColor = '#ff4d4d';
        ctx.shadowBlur = 14;
      }
      ctx.fillStyle = grad;
      roundRect(ctx, ax + 2, ay + 2, Math.max(8, (aw - 4) * frac), ah - 4, 4);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.strokeStyle = 'rgba(8, 13, 26, 0.55)';
    ctx.lineWidth = 2;
    for (let i = 1; i < 5; i++) {
      const tx = ax + (aw / 5) * i;
      ctx.beginPath();
      ctx.moveTo(tx, ay + 3);
      ctx.lineTo(tx, ay + ah - 3);
      ctx.stroke();
    }
    ctx.strokeStyle = '#5a6b7a';
    ctx.lineWidth = 1.5;
    roundRect(ctx, ax, ay, aw, ah, 6);
    ctx.stroke();
    // Alarm label centred INSIDE the bar: the old label sat below the bar,
    // sandwiched against the title banner, so the meter read as crowded.
    // Inside the bar it stays clear of the title in every state; a dark
    // offset under the white text keeps it legible over any fill colour.
    const alarmText = `ALARM ${Math.floor(alarm)}%`;
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillText(alarmText, ax + aw / 2 + 1, ay + ah / 2 + 1);
    ctx.fillStyle = '#fff';
    ctx.fillText(alarmText, ax + aw / 2, ay + ah / 2);
    ctx.textBaseline = 'alphabetic';

    // Tools + timer (right): lay the cluster out first, then draw a
    // subtle panel behind it, so the right side reads as one UI block.
    ctx.fillStyle = COLORS.hudText;
    ctx.font = 'bold 14px sans-serif';
    const timeStr = formatTime(elapsed);
    const tw = ctx.measureText(timeStr).width;
    ctx.textAlign = 'right';
    const clockX = VIEW.w - 16 - tw - 14;
    // Noisemaker: bell icon + count.
    const nStr = `×${tools.noise}`;
    const nw = ctx.measureText(nStr).width;
    const bellX = clockX - 18 - nw - 12;
    // EMP: bolt icon + count.
    const eStr = `×${tools.emp}`;
    const ew = ctx.measureText(eStr).width;
    const boltX = clockX - 18 - nw - 26 - ew - 12;
    // Panel behind the cluster.
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.28)';
    ctx.lineWidth = 1;
    roundRect(ctx, boltX - 16, 8, VIEW.w - 16 - (boltX - 16), 40, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = COLORS.hudText;
    ctx.fillText(timeStr, VIEW.w - 16, 25);
    // Clock icon left of the time.
    ctx.strokeStyle = '#dbe7ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(clockX, 20, 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(clockX, 20);
    ctx.lineTo(clockX, 14);
    ctx.moveTo(clockX, 20);
    ctx.lineTo(clockX + 5, 20);
    ctx.stroke();
    ctx.fillText(nStr, clockX - 18, 25);
    this.drawBell(ctx, bellX, 20);
    ctx.fillText(eStr, clockX - 18 - nw - 26, 25);
    this.drawBolt(ctx, boltX, 20, '#ffd75e');
    // Loot status, second line: Opal and Crown side by side, gold once stolen.
    ctx.font = '12px sans-serif';
    const opalText = loot.taken ? '◆ SUN OPAL — STOLEN' : '◆ SUN OPAL — IN THE VAULT';
    const crownText = loot.crownTaken ? '♦ CROWN — STOLEN  ·  ' : '♦ CROWN — IN ITS CASE  ·  ';
    const ow = ctx.measureText(opalText).width;
    ctx.fillStyle = loot.crownTaken ? '#ffd75e' : '#9fb3d9';
    ctx.fillText(crownText, VIEW.w - 16 - ow, 48);
    ctx.fillStyle = loot.taken ? '#ffd75e' : '#9fb3d9';
    ctx.fillText(opalText, VIEW.w - 16, 48);

    // Bottom hint bar, with keycap chips: it reads as a finished game's
    // control strip, not a line of plain text. On the title screen it
    // carries the start prompt.
    ctx.fillStyle = 'rgba(8, 13, 26, 0.75)';
    ctx.fillRect(0, VIEW.h - 30, VIEW.w, 30);
    if (game.state === 'title') {
      this.drawHintLine(ctx, [
        { t: 'Press ', c: '#2dd4bf' }, { k: 'ENTER' }, { t: ' or click to begin', c: '#2dd4bf' },
        { t: '    —    ', c: '#9fb3d9' },
        { k: 'WASD' }, { t: ' move  ·  ', c: '#9fb3d9' }, { k: 'Q' }, { t: ' EMP  ·  ', c: '#9fb3d9' },
        { k: 'F' }, { t: ' noisemaker  ·  ', c: '#9fb3d9' }, { k: 'R' }, { t: ' restart', c: '#9fb3d9' },
      ], VIEW.h - 15);
    } else {
      this.drawHintLine(ctx, [
        { k: 'WASD' }, { t: ' / arrows — move      ', c: '#9fb3d9' },
        { k: 'Q' }, { t: ' — EMP (kills cameras)      ', c: '#9fb3d9' },
        { k: 'F' }, { t: ' or click — throw noisemaker      ', c: '#9fb3d9' },
        { k: 'M' }, { t: ' — mute      ', c: '#9fb3d9' },
        { k: 'R' }, { t: ' — restart', c: '#9fb3d9' },
      ], VIEW.h - 15);
    }

    // SPOTTED flash when anyone sees Rin.
    if (game.spotted) {
      ctx.fillStyle = 'rgba(255, 60, 60, 0.16)';
      ctx.fillRect(0, 0, VIEW.w, VIEW.h);
      ctx.fillStyle = '#ff6b6b';
      ctx.font = 'bold 26px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SPOTTED!', VIEW.w / 2, 108);
    }
  }

  drawCaught(ctx, game) {
    const since = game.now - game.caughtAt;
    // The bust lands: a red flash that decays over the first second,
    // then a slow red pulse breathing under the panel.
    const flash = Math.max(0, 0.45 - since * 0.45);
    const pulse = 0.06 + 0.03 * Math.sin(game.now * 2);
    ctx.fillStyle = 'rgba(20, 4, 8, 0.72)';
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);
    if (flash > 0) {
      ctx.fillStyle = `rgba(255, 40, 40, ${flash})`;
      ctx.fillRect(0, 0, VIEW.w, VIEW.h);
    }
    ctx.fillStyle = `rgba(255, 40, 40, ${pulse})`;
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);
    // Kicker, then the big title, then a gold rule: a designed hierarchy.
    ctx.fillStyle = '#d4af37';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    try { ctx.letterSpacing = '3px'; } catch (e) { /* older canvas */ }
    ctx.fillText('THE MUSEUM WINS', VIEW.w / 2, VIEW.h / 2 - 74);
    try { ctx.letterSpacing = '0px'; } catch (e) { /* older canvas */ }
    ctx.fillStyle = '#ff6b6b';
    ctx.font = 'bold 52px Georgia, serif';
    ctx.fillText('CAUGHT!', VIEW.w / 2, VIEW.h / 2 - 30);
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(VIEW.w / 2 - 60, VIEW.h / 2 - 16, 120, 2);
    ctx.fillStyle = '#fff';
    ctx.font = '18px sans-serif';
    ctx.fillText(game.caughtBy || 'The guards were faster than the plan.', VIEW.w / 2, VIEW.h / 2 + 8);
    ctx.fillStyle = '#9fb3d9';
    ctx.font = '15px sans-serif';
    ctx.fillText(`Alarm peaked at ${Math.floor(game.peakAlarm)}% — Opal: ${game.loot.taken ? 'stolen' : 'in the vault'} · Crown: ${game.loot.crownTaken ? 'stolen' : 'in its case'}.`, VIEW.w / 2, VIEW.h / 2 + 36);
    ctx.fillStyle = '#2dd4bf';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('Press R to try again', VIEW.w / 2, VIEW.h / 2 + 78);
  }

  drawWon(ctx, game) {
    const since = game.now - game.wonAt;
    ctx.fillStyle = 'rgba(4, 20, 10, 0.72)';
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);
    // Gold rays rotating slowly behind the text.
    ctx.save();
    ctx.translate(VIEW.w / 2, VIEW.h / 2 - 10);
    ctx.rotate(game.now * 0.15);
    ctx.fillStyle = 'rgba(255, 215, 94, 0.05)';
    for (let i = 0; i < 12; i++) {
      ctx.rotate(Math.PI / 6);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(520, -26);
      ctx.lineTo(520, 26);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    // An expanding gold ring from the centre, fading as it grows.
    if (since < 1.2) {
      const r = 40 + since * 420;
      ctx.strokeStyle = `rgba(255, 215, 94, ${Math.max(0, 0.5 - since * 0.4)})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(VIEW.w / 2, VIEW.h / 2 - 10, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    // A gold flash that decays over the first second.
    const flash = Math.max(0, 0.35 - since * 0.35);
    if (flash > 0) {
      ctx.fillStyle = `rgba(255, 215, 94, ${flash})`;
      ctx.fillRect(0, 0, VIEW.w, VIEW.h);
    }
    // Kicker, then the title popping in, then a gold rule.
    ctx.fillStyle = '#d4af37';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    try { ctx.letterSpacing = '3px'; } catch (e) { /* older canvas */ }
    ctx.fillText('THE SUN OPAL IS YOURS', VIEW.w / 2, VIEW.h / 2 - 84);
    try { ctx.letterSpacing = '0px'; } catch (e) { /* older canvas */ }
    const pop = 1 + 0.18 * Math.exp(-since * 4);
    ctx.save();
    ctx.translate(VIEW.w / 2, VIEW.h / 2 - 40);
    ctx.scale(pop, pop);
    ctx.fillStyle = '#ffd75e';
    ctx.font = 'bold 48px Georgia, serif';
    ctx.fillText('CLEAN GETAWAY!', 0, 0);
    ctx.restore();
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(VIEW.w / 2 - 60, VIEW.h / 2 - 26, 120, 2);
    ctx.fillStyle = '#fff';
    ctx.font = '18px sans-serif';
    ctx.fillText(`Rin slips into the night with the Sun Opal${game.loot.crownTaken ? ' and the Crown' : ''} in ${formatTime(game.elapsed)}.`, VIEW.w / 2, VIEW.h / 2 - 2);
    // GHOST now means never seen AND both loots in hand: the Crown is
    // what raises the rating.
    const rating = game.peakAlarm < 35 && game.loot.crownTaken ? 'GHOST — never seen, both loots' : game.peakAlarm < 75 ? 'SHADOW — nearly spotted' : 'LOUD — but rich';
    ctx.fillStyle = '#2dd4bf';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(`Rating: ${rating}`, VIEW.w / 2, VIEW.h / 2 + 32);
    ctx.fillStyle = '#9fb3d9';
    ctx.font = '15px sans-serif';
    ctx.fillText(game.loot.crownTaken ? 'The Crown gleams in her pocket. Press R to run it again' : 'The Crown still gleams in its case. Press R to run it again', VIEW.w / 2, VIEW.h / 2 + 68);
  }

  drawVignette(ctx) {
    const g = ctx.createRadialGradient(
      VIEW.w / 2, VIEW.h / 2, VIEW.h * 0.42, VIEW.w / 2, VIEW.h / 2, VIEW.h * 0.85,
    );
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.34)'); // lighter now: the night overlay already darkens the room
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  }
}
