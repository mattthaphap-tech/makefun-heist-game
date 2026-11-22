// config.js — one place for every tuning number of Midnight at the Marrow Museum.
// All art is drawn on canvas; all sound is made with WebAudio oscillators.
// Nothing here loads from the network.

export const WORLD = { w: 1280, h: 800 };

export const COLORS = {
  floor: '#2a2118', // warm dark marble
  floorAlt: '#33291d',
  floorGrout: '#1c150e',
  carpet: '#571d29', // deep crimson runner
  carpetGold: '#c9a227',
  gold: '#d4af37',
  rope: '#a03040',
  wall: '#241a12', // dark wood panelling
  wallTop: '#4a3420',
  caseBody: '#2c3a46',
  caseGlass: '#7fd4ff',
  caseGold: '#d4af37',
  vaultPedestal: '#453752',
  opal: '#ffd75e',
  opalGlow: 'rgba(255, 215, 94, 0.35)',
  exitLocked: '#5a6b7a',
  exitOpen: '#37d67a',
  thief: '#e8e8e8',
  thiefScarf: '#2dd4bf',
  guardBody: '#d64545',
  guardCap: '#7a1f1f',
  coneGuard: 'rgba(255, 214, 90, 0.16)',
  coneGuardEdge: 'rgba(255, 214, 90, 0.55)',
  coneCamera: 'rgba(255, 90, 90, 0.15)',
  coneCameraEdge: 'rgba(255, 90, 90, 0.55)',
  coneOff: 'rgba(120, 130, 150, 0.10)',
  hudBg: 'rgba(10, 8, 16, 0.92)',
  hudText: '#e8dcc0',
  alarmLow: '#37d67a',
  alarmMid: '#ffb020',
  alarmHigh: '#ff4d4d',
};

export const THIEF = {
  radius: 13,
  speed: 155, // px per second
  spawn: { x: 640, y: 718 },
};

export const GUARD = {
  radius: 14,
  patrolSpeed: 82,
  chaseSpeed: 108,
  coneRange: 205,
  coneHalfAngle: Math.PI / 5.2, // ~35 degrees each side
  catchDistance: 26,
  // How fast the global alarm climbs while any eye is on Rin.
  alarmRisePerSecond: 46,
  alarmFallPerSecond: 14,
  // A guard that loses Rin returns to patrol after this long.
  loseInterestAfter: 2.2,
};

export const CAMERA = {
  coneRange: 245,
  coneHalfAngle: Math.PI / 6, // 30 degrees each side
  sweepHalfAngle: Math.PI / 3.2, // sweeps ~56 degrees each side of base
  sweepSpeed: 0.55, // radians per second
  alarmRisePerSecond: 40,
};

export const TOOLS = {
  empStart: 2,
  empRadius: 270,
  empDisableSeconds: 6,
  noiseStart: 3,
  noiseRadius: 130,
  noiseLureSeconds: 4,
  noiseLureRange: 330,
};

export const ALARM = { max: 100, caughtAt: 100 };

// The Crown: the second, optional loot. It sits in the CROWNS case in the
// right wing; walking close enough lifts it. Taking it is what turns a
// SHADOW run into a GHOST run, so it is worth the detour past Sable.
export const CROWN = { grabRadius: 56 };

// Night lighting: the museum after dark. A darkness overlay covers the
// playfield; radial light pools are cut into it around the thief, the
// guards, the cameras, the exhibits, the Opal and the exit, so the cones
// read as light cutting through the dark. The HUD stays out of the dark.
export const NIGHT = {
  overlayAlpha: 0.34,
  thiefLight: 190,
  guardLight: 150,
  cameraLight: 130,
  caseLight: 130,
  vaultLight: 185,
  exitLight: 130,
};

// Curated palette: gold, maroon, dark wood, warm marble. Every surface in
// the museum belongs to this family; the only accents allowed out of it are
// the thief's teal scarf (the intruder) and the red of danger.
export const PALETTE = {
  ink: '#0b0e1a',
  gold: '#d4af37',
  goldBright: '#e8c85a',
  goldDim: 'rgba(212, 175, 55, 0.5)',
  maroon: '#571d29',
  maroonDeep: '#3d1420',
  wood: '#241a12',
  woodLight: '#4a3420',
  marble: '#2a2118',
  marbleAlt: '#33291d',
  cream: '#e8dcc0',
  slate: '#9fb3d9',
};

// Canvas size for the game and for the screenshots.
export const VIEW = { w: 1280, h: 800 };
