// util.js — small geometry helpers. No dependencies, no network.

// True when point (x, y) lies inside rect {x, y, w, h}.
export function pointInRect(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

// True when a circle at (x, y) with radius r touches rect.
export function circleHitsRect(x, y, r, rect) {
  const cx = Math.max(rect.x, Math.min(x, rect.x + rect.w));
  const cy = Math.max(rect.y, Math.min(y, rect.y + rect.h));
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy < r * r;
}

// Line of sight: true when the segment from (x1, y1) to (x2, y2) is not
// blocked by any rect in blockers. Samples along the segment; the rooms are
// small so sampling is exact enough and keeps the code short.
export function hasLineOfSight(x1, y1, x2, y2, blockers) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(2, Math.ceil(dist / 7));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const px = x1 + dx * t;
    const py = y1 + dy * t;
    for (const b of blockers) {
      if (pointInRect(px, py, b)) return false;
    }
  }
  return true;
}

// True when target is inside a vision cone from (ox, oy) facing angle,
// with the given range and half-angle, and line of sight is clear.
export function inCone(ox, oy, facing, range, halfAngle, tx, ty, blockers) {
  const dx = tx - ox;
  const dy = ty - oy;
  const dist = Math.hypot(dx, dy);
  if (dist > range) return false;
  let a = Math.atan2(dy, dx) - facing;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  if (Math.abs(a) > halfAngle) return false;
  return hasLineOfSight(ox, oy, tx, ty, blockers);
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
