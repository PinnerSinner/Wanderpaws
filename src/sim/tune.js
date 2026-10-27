// Every gameplay number the sim uses, in one place. Units: metres, seconds, radians.
// Sizes are "characteristic lengths": a 0.25 m dog is about 25 cm nose to tail.

export const TUNE = {
  // Movement (top speed = speedK * size^speedExp * multipliers)
  speedK: 4.6,
  speedExp: 0.85,
  sprintMult: 1.7,          // full zoomies multiplier
  sprintBuild: 1.0,         // seconds to build full zoomies
  sprintFade: 0.4,
  accelK: 4.2,              // top speeds per second, at rest (ramps down near top speed)
  accelRamp: 0.9,           // extra accel when slow (fraction)
  decelK: 7.5,              // top speeds per second when releasing the stick
  turnSlow: 10.5,           // rad/s at standstill
  turnFast: 3.4,            // rad/s at top sprint
  pivotAngle: 2.3,          // above this delta and slow, pivot quickly
  airControl: 0.55,
  grip: 22,                 // how fast actual velocity follows intent (per second)
  // Jumping and gravity (scale with size so it feels the same in body lengths)
  gravityK: 26,             // g = gravityK * sqrt(size)
  jumpK: 1.05,              // jump height in body lengths
  coyote: 0.12,
  jumpBuffer: 0.13,
  jumpCut: 0.5,             // vy multiplier when jump released early
  lowGravity: 0.4,
  stepUp: 0.45,             // * size
  stepDown: 0.35,           // * size, snap down slopes and kerbs
  maxSlope: 1.4,            // rise over run that blocks walking up terrain
  // Gobbling
  gobbleRatio: 0.6,
  gobbleRatioAssist: 0.75,
  almostBand: 0.15,         // almost = size <= player.size * (ratio + band)
  reachK: 0.6,
  assistReach: 1.25,
  pullTime: 0.25,           // state 3 duration
  dropGrace: 0.8,           // dropped items can't be re-gobbled for this long
  comboWindow: 1.2,
  comboStep: 0.05,
  comboMax: 1.5,
  teaReach: 0.35,           // tea buff reach bonus (fraction)
  teaTime: 6,
  bumpSpeed: 0.4,           // fraction of top speed that makes a solid hit a bump
  bumpCooldown: 1.2,
  stagger: 0.6,
  // Items
  itemRadiusK: 0.42,        // footprint radius = size * k
  itemGravityK: 20,
  itemRestitution: 0.33,
  itemFriction: 5,
  itemVcapK: 22,            // cap = itemVcapK * size^0.85 + 2
  wobbleFreq: 2.6,
  // Misc
  slowMoTime: 0.35,
  slowMoRate: 0.4,          // sim time scale at full slow-mo
  introTime: 2.0,
  barkHold: 0.4,
  shakeTime: 1.0,
  idleStart: 3.0,
  sleepyAfter: 22,
};

// Surface feel: speed multiplier and grip (traction) multiplier.
export const SURFACES = {
  sand: { speed: 0.94, grip: 0.9 },
  pavement: { speed: 1.0, grip: 1.0 },
  grass: { speed: 0.98, grip: 1.0 },
  water: { speed: 1.0, grip: 0.5 },
  snow: { speed: 0.9, grip: 0.7 },
  ice: { speed: 1.0, grip: 0.12 },
  wood: { speed: 1.0, grip: 1.0 },
  rock: { speed: 0.98, grip: 0.9 },
  leaves: { speed: 0.96, grip: 0.85 },
  data: { speed: 1.04, grip: 1.0 },
};

export const MODE_TIMERS = { story: 'world', daily: 'world', zoomies: 180, chill: null, speedrun: null };

export const IDLE_ANIMS = ['sniff', 'sit', 'scratch', 'yawn', 'look', 'playbow', 'shake', 'lie', 'species'];
