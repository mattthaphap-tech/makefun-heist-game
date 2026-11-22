// level.js — the Marrow Museum floor plan: walls, display cases (cover that
// blocks both movement and sight), the Sun Opal vault, the exit door, guard
// patrol routes and camera mounts. Three routes cross the hall: the left
// gallery, the central hall and the right wing.

import { WORLD } from './config.js';

const WALL = 24; // outer wall thickness

export function buildLevel() {
  // Walls the thief and the guards cannot cross. Display cases count as
  // blockers too (they block sight as well as movement).
  const walls = [
    // Outer shell (as four thick walls).
    { x: 0, y: 0, w: WORLD.w, h: WALL },
    { x: 0, y: WORLD.h - WALL, w: WORLD.w, h: WALL },
    { x: 0, y: 0, w: WALL, h: WORLD.h },
    { x: WORLD.w - WALL, y: 0, w: WALL, h: WORLD.h },
    // Interior divider A: left gallery | central hall, doorway 300..500.
    { x: 420, y: WALL, w: 18, h: 276 },
    { x: 420, y: 500, w: 18, h: 276 },
    // Interior divider B: central hall | right wing, doorway 340..460.
    { x: 860, y: WALL, w: 18, h: 316 },
    { x: 860, y: 460, w: 18, h: 316 },
  ];

  // Display cases: low glass cabinets. Hide behind them; guards and cameras
  // cannot see through them.
  const cases = [
    { x: 120, y: 140, w: 150, h: 70, label: 'JADE' },
    { x: 120, y: 560, w: 150, h: 70, label: 'COINS' },
    { x: 520, y: 120, w: 170, h: 70, label: 'MASKS' },
    { x: 560, y: 600, w: 170, h: 70, label: 'SCROLLS' },
    { x: 950, y: 150, w: 150, h: 70, label: 'CROWNS' },
    { x: 950, y: 560, w: 150, h: 70, label: 'VASES' },
    { x: 600, y: 330, w: 120, h: 60, label: 'RELIC' },
  ];

  // All sight blockers: walls plus cases.
  const blockers = [...walls, ...cases];

  // The loot: the Sun Opal, on a pedestal in the top-right wing.
  const vault = { x: 1120, y: 96, r: 30, taken: false, name: 'SUN OPAL' };

  // The getaway door, bottom-left wall. Locked until the Opal is taken.
  const exit = { x: WALL, y: 700, w: 86, h: 76, open: false };

  // Guard patrol routes (waypoint loops).
  const guardRoutes = [
    // Bram patrols the left gallery. The loop runs in the two clear
    // lanes either side of the JADE and COINS cases (x 120..270): the
    // left lane at x 90, the right lane at x 350, joined above the JADE
    // case (y 240) and below the COINS case (y 650).
    [
      { x: 90, y: 240 },
      { x: 90, y: 650 },
      { x: 350, y: 650 },
      { x: 350, y: 240 },
    ],
    // Okafor patrols the central hall. The loop runs below the MASKS
    // case (y 240) and above the SCROLLS case (y 560), in the lanes
    // either side of them (x 490 and x 780).
    [
      { x: 490, y: 240 },
      { x: 780, y: 240 },
      { x: 780, y: 560 },
      { x: 490, y: 560 },
    ],
    // Sable patrols the right wing, past the vault. The loop runs above
    // the CROWNS case (y 120) and below the VASES case (y 650), in the
    // lanes either side of them (x 920 and x 1150).
    [
      { x: 920, y: 120 },
      { x: 1150, y: 120 },
      { x: 1150, y: 650 },
      { x: 920, y: 650 },
    ],
  ];

  // Security cameras mounted on walls. baseAngle is the middle of the sweep.
  // CAM 1 hangs just below the top wall (and below the HUD bar) so its mount
  // and label stay visible; CAM 2 sits on the right wall.
  const cameraMounts = [
    { x: 640, y: 66, baseAngle: Math.PI / 2, label: 'CAM 1' },
    { x: WORLD.w - WALL - 6, y: 400, baseAngle: Math.PI, label: 'CAM 2' },
  ];

  return { walls, cases, blockers, vault, exit, guardRoutes, cameraMounts };
}
