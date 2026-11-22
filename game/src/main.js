// main.js — the game loop and the rules. Owns the thief, the alarm meter, the
// win/lose flow and the ?scene= staging used for the entry screenshots.
// Guards, cameras, loot and tools each own their own behaviour; this file
// only wires them together.

import { COLORS, THIEF, GUARD, CAMERA, VIEW } from './config.js';
import { buildLevel } from './level.js';
import { createGuards } from './guards.js';
import { createCameras } from './cameras.js';
import { Loot } from './loot.js';
import { Tools } from './tools.js';
import { Sound } from './audio.js';
import { Input } from './input.js';
import { Renderer } from './render.js';
import { circleHitsRect, clamp } from './util.js';

const canvas = document.getElementById('game');
canvas.width = VIEW.w;
canvas.height = VIEW.h;

class Game {
  constructor() {
    this.level = buildLevel();
    this.guards = createGuards(this.level.guardRoutes);
    this.cameras = createCameras(this.level.cameraMounts);
    this.loot = new Loot(this.level.vault, this.level.exit, this.level.cases.find((c) => c.label === 'CROWNS'));
    this.tools = new Tools();
    this.sound = new Sound();
    this.input = new Input(canvas);
    this.renderer = new Renderer(canvas);
    this.thief = { x: THIEF.spawn.x, y: THIEF.spawn.y, facing: -Math.PI / 2, moving: false, walkPhase: 0 };
    this.state = 'title'; // title | play | caught | won
    this.alarm = 0;
    this.peakAlarm = 0;
    this.spotted = false;
    this.elapsed = 0;
    this.now = 0;
    this.caughtBy = '';
    this.caughtAt = 0; // clock time of the bust, for the red flash
    this.wonAt = 0; // clock time of the getaway, for the gold flourish
    this.alarmBeepAt = 0;
    this.stepAt = 0;
    this.particles = []; // cosmetic gold sparkles; never affect the rules
    this.sparkleAt = 0;
    this.applyScene(new URLSearchParams(window.location.search).get('scene') || 'cover');
  }

  // Stage a moment of the heist for a screenshot. The game itself is the
  // same code in every scene; only starting positions differ.
  applyScene(scene) {
    // Deterministic camera sweep for the staged frames: the sweep runs
    // 0.55 rad/s, so starting at -0.825 puts both cameras at their base
    // angle about 1.5 s in, when the screenshots are taken — CAM 1
    // points straight down the hall instead of washing the title banner.
    this.cameras[0].sweepT = -0.825;
    this.cameras[1].sweepT = -0.825;
    if (scene === 'loot') {
      this.state = 'play';
      this.thief.x = 1000; this.thief.y = 128;
      this.thief.facing = Math.PI / 4;
      this.alarm = 12;
      const sable = this.guards[2];
      sable.x = 1060; sable.y = 300; sable.facing = -Math.PI / 2;
      sable.state = 'patrol';
    } else if (scene === 'alarm') {
      // Rin ducks behind the RELIC case while Okafor stares at the last place
      // he saw her: line of sight is blocked, so the alarm holds instead of
      // climbing to a bust during the screenshot.
      this.state = 'play';
      this.thief.x = 700; this.thief.y = 420;
      this.thief.facing = -Math.PI / 2;
      this.alarm = 82;
      const okafor = this.guards[1];
      okafor.x = 760; okafor.y = 300;
      okafor.state = 'suspicious';
      okafor.suspicionTime = 0.5;
      okafor.lastSeen = { x: 700, y: 420 };
      okafor.loseTimer = 2.2;
      okafor.facing = Math.atan2(420 - 300, 700 - 760);
    } else if (scene === 'escape') {
      this.state = 'play';
      this.level.vault.taken = true;
      this.level.exit.open = true;
      // She lifted the Crown on the way out: both loot in hand for the
      // getaway frame, and the win screen can show the full haul.
      this.loot.crownTaken = true;
      this.thief.x = 210; this.thief.y = 720;
      this.thief.facing = Math.PI;
      this.alarm = 30;
      // Bram walks UP the left gallery, away from Rin: his next waypoint is
      // the top of the gallery, so he never turns toward the exit.
      const bram = this.guards[0];
      bram.x = 90; bram.y = 650; bram.wp = 0; bram.facing = -Math.PI / 2;
      bram.state = 'patrol';
    }
    // 'cover' and anything else: the opening state, title over a live room.
  }

  reset() {
    this.level = buildLevel();
    this.guards = createGuards(this.level.guardRoutes);
    this.cameras = createCameras(this.level.cameraMounts);
    this.loot = new Loot(this.level.vault, this.level.exit, this.level.cases.find((c) => c.label === 'CROWNS'));
    this.tools = new Tools();
    this.thief = { x: THIEF.spawn.x, y: THIEF.spawn.y, facing: -Math.PI / 2, moving: false, walkPhase: 0 };
    this.state = 'title';
    this.alarm = 0;
    this.peakAlarm = 0;
    this.spotted = false;
    this.elapsed = 0;
    this.caughtBy = '';
    this.caughtAt = 0;
    this.wonAt = 0;
    this.particles = [];
    this.sparkleAt = 0;
    this.applyScene(new URLSearchParams(window.location.search).get('scene') || 'cover');
  }

  // A burst of gold sparkles when Rin grabs the Opal. Cosmetic only.
  spawnBurst(x, y) {
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 50 + Math.random() * 110;
      const life = 0.5 + Math.random() * 0.5;
      this.particles.push({
        x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 20,
        life, max: life,
        size: 2 + Math.random() * 2.5,
        color: Math.random() < 0.7 ? '#ffd75e' : '#fff6c9',
      });
    }
  }

  // Move Rin with collision against walls and cases, axis by axis.
  moveThief(vx, vy, dt) {
    const nx = this.thief.x + vx * THIEF.speed * dt;
    const ny = this.thief.y + vy * THIEF.speed * dt;
    if (vx !== 0 || vy !== 0) {
      this.thief.facing = Math.atan2(vy, vx);
      this.thief.moving = true;
      this.thief.walkPhase += dt * 11; // the stride cycle, only while walking
    } else {
      this.thief.moving = false;
    }
    let blocked = false;
    for (const b of this.level.blockers) {
      if (circleHitsRect(nx, this.thief.y, THIEF.radius, b)) { blocked = true; break; }
    }
    if (!blocked) this.thief.x = nx;
    blocked = false;
    for (const b of this.level.blockers) {
      if (circleHitsRect(this.thief.x, ny, THIEF.radius, b)) { blocked = true; break; }
    }
    if (!blocked) this.thief.y = ny;
    this.thief.x = clamp(this.thief.x, 24 + THIEF.radius, VIEW.w - 24 - THIEF.radius);
    this.thief.y = clamp(this.thief.y, 24 + THIEF.radius, VIEW.h - 24 - THIEF.radius);
  }

  update(dt) {
    this.now += dt;
    const presses = this.input.takePresses();
    const click = this.input.takeClick();

    if (presses.has('m')) this.sound.muted = !this.sound.muted;
    if (presses.has('r') && (this.state === 'caught' || this.state === 'won')) {
      this.reset();
      return;
    }

    // The world stays alive behind the title screen.
    for (const cam of this.cameras) cam.update(dt);
    if (this.state === 'title') {
      for (const g of this.guards) g.update(dt, this.thief, this.level.blockers);
      if (presses.has('enter') || click) {
        this.state = 'play';
        this.sound.ensure();
      }
      return;
    }
    if (this.state !== 'play') return;

    this.sound.ensure();
    this.elapsed += dt;

    // Movement.
    const mv = this.input.moveVector();
    this.moveThief(mv.x, mv.y, dt);
    if (this.thief.moving && this.now - this.stepAt > 0.32) {
      this.stepAt = this.now;
      this.sound.step();
    }

    // Tools.
    if (presses.has('q')) {
      const res = this.tools.useEmp(this.thief, this.cameras, this.now);
      if (res === 'ok') this.sound.emp();
    }
    if (presses.has('f')) {
      const res = this.tools.useNoise(this.thief.x, this.thief.y - 40, this.guards, this.now);
      if (res === 'ok') this.sound.noisePing();
    }
    if (click) {
      const res = this.tools.useNoise(click.x, click.y, this.guards, this.now);
      if (res === 'ok') this.sound.noisePing();
    }
    this.tools.update(this.now);

    // Eyes on Rin: guards and cameras feed one alarm meter.
    let seen = false;
    let rise = 0;
    for (const g of this.guards) {
      if (g.update(dt, this.thief, this.level.blockers)) {
        seen = true;
        rise += GUARD.alarmRisePerSecond;
      }
      if (g.catches(this.thief)) {
        this.caughtBy = `${g.name} grabbed Rin by the scarf.`;
        this.endCaught();
        return;
      }
    }
    for (const cam of this.cameras) {
      if (cam.sees(this.thief, this.level.blockers)) {
        seen = true;
        rise += CAMERA.alarmRisePerSecond;
      }
    }
    if (seen) {
      if (!this.spotted) this.sound.spotted();
      this.alarm = clamp(this.alarm + rise * dt, 0, 100);
      if (this.now - this.alarmBeepAt > 0.5) {
        this.alarmBeepAt = this.now;
        this.sound.alarmTick();
      }
    } else {
      this.alarm = clamp(this.alarm - GUARD.alarmFallPerSecond * dt, 0, 100);
    }
    this.spotted = seen;
    this.peakAlarm = Math.max(this.peakAlarm, this.alarm);
    if (this.alarm >= 100) {
      this.caughtBy = 'The alarm hit 100% — the museum locked down with Rin inside.';
      this.endCaught();
      return;
    }

    // Loot and getaway.
    const grabbed = this.loot.update(this.thief, this.now);
    if (grabbed === 'grabbed') {
      this.sound.pickup();
      this.spawnBurst(this.level.vault.x, this.level.vault.y);
    } else if (grabbed === 'crown') {
      this.sound.pickup();
      const c = this.loot.crownCenter;
      this.spawnBurst(c.x, c.y);
    }
    // Gold sparkles drift off the Opal while it sits in the vault.
    if (!this.loot.taken && this.now - this.sparkleAt > 0.35) {
      this.sparkleAt = this.now;
      this.particles.push({
        x: this.level.vault.x + (Math.random() - 0.5) * 56,
        y: this.level.vault.y + (Math.random() - 0.5) * 56,
        vx: (Math.random() - 0.5) * 8,
        vy: -14 - Math.random() * 10,
        life: 0.9, max: 0.9,
        size: 1.6 + Math.random() * 1.4,
        color: '#ffd75e',
      });
    }
    // Particles age; they never affect the rules.
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    if (this.loot.escaped(this.thief)) {
      this.state = 'won';
      this.wonAt = this.now;
      // A gold burst at the door as Rin slips out.
      this.spawnBurst(this.level.exit.x + 43, this.level.exit.y + 38);
      this.sound.win();
    }
  }

  endCaught() {
    this.state = 'caught';
    this.caughtAt = this.now;
    this.sound.caught();
  }

  frame(t) {
    const dt = Math.min(0.05, (t - (this.lastT || t)) / 1000 || 0.016);
    this.lastT = t;
    this.update(dt);
    this.renderer.draw(this);
    requestAnimationFrame((nt) => this.frame(nt));
  }

  start() {
    requestAnimationFrame((t) => this.frame(t));
  }
}

const game = new Game();
game.start();
// A handle for automated play-testing in a browser console.
window.__game = game;
