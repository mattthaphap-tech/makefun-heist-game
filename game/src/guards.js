// guards.js — the museum guards: Bram, Okafor and Sable. Each walks a
// waypoint loop, looking where it walks. A guard that sees Rin stops,
// stares, and walks toward the last place it saw her; a guard that loses her
// gives up and goes back to its route. A guard that touches Rin catches her.

import { GUARD } from './config.js';
import { circleHitsRect, hasLineOfSight, inCone } from './util.js';

export class Guard {
  constructor(name, route, color, index) {
    this.name = name;
    this.route = route;
    this.color = color;
    this.index = index;
    this.x = route[0].x;
    this.y = route[0].y;
    this.wp = 1; // next waypoint
    this.facing = Math.PI / 2;
    this.state = 'patrol'; // patrol | suspicious | chase | investigate
    this.lastSeen = null; // {x, y} of Rin, or null
    this.loseTimer = 0;
    this.investigateTarget = null;
    this.investigateTimer = 0;
    this.paused = 0; // brief stop at each waypoint, so cones are readable
    this.walkPhase = index * 2.1; // stride cycle, seeded per guard so the three never march in step
    this.moving = false;
  }

  // Move toward (tx, ty) at speed, sliding along walls and cases.
  moveToward(tx, ty, speed, dt, blockers) {
    const dx = tx - this.x;
    const dy = ty - this.y;
    const d = Math.hypot(dx, dy);
    if (d < 2) return true;
    const step = Math.min(d, speed * dt);
    const nx = this.x + (dx / d) * step;
    const ny = this.y + (dy / d) * step;
    this.facing = Math.atan2(dy, dx);
    const ox = this.x;
    const oy = this.y;
    this.tryMove(nx, this.y, blockers);
    this.tryMove(this.x, ny, blockers);
    // The stride cycle advances only while the guard actually moves, so
    // the walk animation freezes the moment he stops to stare.
    if (Math.hypot(this.x - ox, this.y - oy) > 0.05) {
      this.moving = true;
      this.walkPhase += dt * 9;
    } else {
      this.moving = false;
    }
    return d <= step + 2;
  }

  tryMove(nx, ny, blockers) {
    for (const b of blockers) {
      if (circleHitsRect(nx, ny, GUARD.radius, b)) return;
    }
    this.x = nx;
    this.y = ny;
  }

  // Does this guard see Rin right now?
  sees(thief, blockers) {
    return inCone(
      this.x, this.y, this.facing,
      GUARD.coneRange, GUARD.coneHalfAngle,
      thief.x, thief.y, blockers,
    );
  }

  // Lure this guard to a noise point (the noisemaker tool).
  lureTo(x, y, seconds) {
    if (this.state === 'chase') return;
    this.state = 'investigate';
    this.investigateTarget = { x, y };
    this.investigateTimer = seconds;
    this.lastSeen = null;
  }

  update(dt, thief, blockers) {
    const seen = this.sees(thief, blockers);

    if (this.state === 'investigate') {
      this.investigateTimer -= dt;
      if (this.investigateTarget) {
        const arrived = this.moveToward(
          this.investigateTarget.x, this.investigateTarget.y,
          GUARD.patrolSpeed, dt, blockers,
        );
        if (arrived || this.investigateTimer <= 0) {
          this.state = 'patrol';
          this.investigateTarget = null;
          this.paused = 0.8;
        }
      }
      if (seen) this.notice(thief);
      return seen;
    }

    if (seen) {
      this.notice(thief, dt);
    } else if (this.state === 'chase' || this.state === 'suspicious') {
      this.loseTimer -= dt;
      this.suspicionTime = 0;
      if (this.loseTimer <= 0) {
        this.state = 'patrol';
        this.lastSeen = null;
      }
    }

    if (this.state === 'chase' && this.lastSeen) {
      const arrived = this.moveToward(
        this.lastSeen.x, this.lastSeen.y, GUARD.chaseSpeed, dt, blockers,
      );
      if (arrived) this.lastSeen = null;
    } else if (this.state === 'suspicious') {
      // Stand and stare at Rin: a fair warning before the chase.
      this.facing = Math.atan2(thief.y - this.y, thief.x - this.x);
    } else if (this.state === 'patrol') {
      if (this.paused > 0) {
        this.paused -= dt;
      } else {
        const target = this.route[this.wp];
        const arrived = this.moveToward(
          target.x, target.y, GUARD.patrolSpeed, dt, blockers,
        );
        if (arrived) {
          this.wp = (this.wp + 1) % this.route.length;
          this.paused = 0.7;
        }
      }
    }
    return seen;
  }

  notice(thief, dt) {
    this.lastSeen = { x: thief.x, y: thief.y };
    this.loseTimer = GUARD.loseInterestAfter;
    if (this.state === 'patrol' || this.state === 'investigate') {
      this.state = 'suspicious';
    }
    // Suspicion hardens into a chase after a short stare (time, not frames).
    if (this.state === 'suspicious') {
      this.suspicionTime = (this.suspicionTime || 0) + dt;
      if (this.suspicionTime > 0.9) this.state = 'chase';
    }
  }

  // True when this guard is close enough to grab Rin.
  catches(thief) {
    return Math.hypot(thief.x - this.x, thief.y - this.y) < GUARD.catchDistance;
  }
}

export function createGuards(routes) {
  const names = ['Bram', 'Okafor', 'Sable'];
  const colors = ['#d64545', '#e07b39', '#c94f7c'];
  return routes.map((route, i) => new Guard(names[i], route, colors[i], i));
}
