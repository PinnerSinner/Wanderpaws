// The shared animation brain every archetype sits on:
//   - locomotion signals (speed, local acceleration, turn rate, air, swim)
//   - a spring-damped root (squash and stretch, corner lean, accel pitch)
//   - head-leads-body look-ahead and eye saccades
//   - the emotion layer (wag, ears, tail height, bounce, blink, mouth)
//   - the idle layer (crossfaded idle clips from player.idleAnim)
//   - reactions (bark, gulp-bounce, stagger, landing, play-bow)
//   - signature move envelopes
// It writes plain numbers into core.c (controls); the archetype solver turns
// controls into bone transforms. No allocations after creation.

import { clamp, clamp01, damp, springStep, smoothstep, TAU, angleDelta } from '../../core/math.js';

export const EMO = {
  //            wag  freq  perk  tail  bounce eyeOpen mouth tongue chin crouch tremble blink
  happy:    [0.55, 3.2, 0.25, 0.5, 1.0, 1.0, 0.35, 0.55, 0.0, 0.0, 0.0, 1.0],
  excited:  [0.9, 5.8, 0.7, 0.85, 1.45, 1.0, 0.6, 0.85, -0.1, 0.0, 0.0, 0.8],
  scared:   [0.04, 7.0, -0.95, -1.0, 0.6, 1.15, 0.0, 0.0, 0.15, 0.45, 1.0, 1.6],
  sleepy:   [0.08, 1.2, -0.45, -0.25, 0.55, 0.45, 0.05, 0.0, 0.2, 0.1, 0.0, 0.5],
  proud:    [0.3, 2.0, 0.85, 0.95, 1.1, 0.85, 0.12, 0.0, -0.28, 0.0, 0.0, 0.9],
  neutral:  [0.18, 2.2, 0.05, 0.2, 0.9, 1.0, 0.1, 0.1, 0.0, 0.0, 0.0, 1.0],
};

const CTRL_KEYS = ['crouch', 'sit', 'lie', 'bow', 'rear', 'headPitch', 'headYaw', 'headRoll', 'neck', 'jaw', 'tongue',
  'eyeClose', 'sniff', 'noseDown', 'scratch', 'paw', 'groom', 'shake', 'earBack', 'wagAdd', 'tailLift', 'hop', 'stretch',
  'tuck', 'spread', 'curl', 'reach', 'trunk', 'flap', 'slide', 'shell', 'twist', 'spin', 'pant', 'gulp', 'tremble',
  'glow', 'puff', 'swim', 'air', 'stagger', 'bodyRoll', 'bodyYaw', 'charge', 'aim', 'squint', 'ledRate', 'colour', 'butt'];

// Small deterministic LCG for blink and saccade timing (visual only).
function lcg(seed) { let s = seed >>> 0 || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }

function hashId(id) { let h = 2166136261; for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

export function createCore(species, plan) {
  const P = species.personality || {};
  const rnd = lcg(hashId(species.id || 'x'));
  const c = {};
  for (const k of CTRL_KEYS) c[k] = 0;
  const emo = { wag: 0.2, freq: 2.2, perk: 0, tail: 0.2, bounce: 1, eyeOpen: 1, mouth: 0.1, tongue: 0.1, chin: 0, crouch: 0, tremble: 0, blink: 1 };
  const core = {
    species, plan, P, c, emo,
    t: 0, dt: 0,
    // locomotion
    speed: 0, v: 0, speedN: 0, move: 0, sprint: 0,
    accF: 0, accR: 0, accY: 0, yawRate: 0, vyN: 0,
    grounded: true, air: 0, swim: 0, floatW: 0, inWaterRaw: false,
    // springs
    squash: { x: 0, v: 0 }, lean: { x: 0, v: 0 }, pitch: { x: 0, v: 0 },
    headYaw: { x: 0, v: 0 }, headPitch: { x: 0, v: 0 }, bob: { x: 0, v: 0 },
    // emotion / face
    emotion: 'happy', emoOverride: null, wagPhase: 0,
    blink: 0, blinkT: 0, nextBlink: 1.5, blinkDouble: false,
    lookX: 0, lookY: 0, lookTX: 0, lookTY: 0, nextLook: 1,
    // idle crossfade
    idleCur: null, idleCurT: 0, idleCurW: 0, idlePrev: null, idlePrevT: 0, idlePrevW: 0,
    idleSeed: 0,
    // reactions
    prevGulp: 0, prevLand: 0, barkW: 0, staggerT: 0, shakeT: 0, shakeOn: false,
    bowW: 0,
    // signature
    sigKind: species.signature?.kind || null, sigActive: false, sigT: 0, sigU: 0, sigW: 0, chargeW: 0, sigPower: 0, sigAim: 0,
    // previous tick values
    pvx: 0, pvz: 0, pvy: 0, pyaw: 0, havePrev: false,
    rnd,
  };
  return core;
}

function resetControls(c) { for (const k of CTRL_KEYS) c[k] = 0; }

// ---------------------------------------------------------------------------
// Idle clips: each adds weighted controls. t = seconds into the clip.

function idleClip(core, name, t, w) {
  if (w <= 0.001 || !name) return;
  const c = core.c;
  const s = Math.sin, ex = core.P.extraIdle;
  switch (name) {
    case 'sniff': {
      c.noseDown += w * (0.75 + 0.15 * s(t * 0.9));
      c.sniff += w;
      c.headYaw += w * 0.35 * s(t * 1.1);
      c.wagAdd += w * 0.2;
      c.earBack -= w * 0.2;
      break;
    }
    case 'sit': {
      c.sit += w;
      c.headRoll += w * 0.18 * smoothstep(2.5, 3.2, t % 7) * (1 - smoothstep(4.5, 5.2, t % 7));
      c.wagAdd += w * 0.15;
      break;
    }
    case 'scratch': {
      const env = smoothstep(0.2, 0.6, t) * (1 - smoothstep(2.6, 3.0, t));
      c.sit += w;
      c.scratch += w * env;
      c.headRoll += w * 0.4 * env;
      c.headPitch += w * 0.15 * env;
      c.eyeClose += w * 0.75 * env;
      c.jaw += w * 0.25 * env;
      c.tongue += w * 0.4 * env;
      break;
    }
    case 'yawn': {
      const open = smoothstep(0.2, 0.9, t) * (1 - smoothstep(1.6, 2.2, t));
      c.jaw += w * open * 1.1;
      c.eyeClose += w * open;
      c.headPitch -= w * open * 0.45;
      c.earBack += w * open * 0.7;
      c.tongue += w * open * 0.3;
      c.stretch += w * open * 0.3;
      // a little lick afterwards
      const lick = smoothstep(2.2, 2.35, t) * (1 - smoothstep(2.5, 2.7, t));
      c.tongue += w * lick * 0.8; c.jaw += w * lick * 0.25;
      break;
    }
    case 'look': {
      const cyc = t % 6;
      const yaw = cyc < 0.4 ? cyc / 0.4 * 0.75 : cyc < 2.3 ? 0.75 : cyc < 2.9 ? 0.75 - (cyc - 2.3) / 0.6 * 1.5 : cyc < 4.8 ? -0.75 : -0.75 + (cyc - 4.8) / 1.2 * 0.75;
      c.headYaw += w * yaw * smoothstep(0, 0.3, t);
      c.headPitch -= w * 0.1;
      c.earBack -= w * 0.4;
      break;
    }
    case 'playbow': {
      c.bow += w;
      c.wagAdd += w * 1.2;
      c.hop += w * 0.02 * Math.max(0, s(t * 9));
      c.earBack -= w * 0.3;
      c.jaw += w * 0.35; c.tongue += w * 0.6;
      c.butt += w;
      break;
    }
    case 'shake': {
      // 1.4 s full-body shake: ramps up then down, frequency rises low to high.
      const d = 1.4;
      const u = clamp01(t / d);
      const env = smoothstep(0, 0.18, u) * (1 - smoothstep(0.75, 1, u));
      c.shake += w * env;
      c.eyeClose += w * env * 0.85;
      c.jaw += w * env * 0.15;
      break;
    }
    case 'lie': {
      const down = smoothstep(0, 0.8, t);
      c.lie += w * down;
      c.headPitch += w * 0.12 * down;
      c.eyeClose += w * 0.55 * smoothstep(4, 6, t) * (0.7 + 0.3 * s(t * 0.4));
      c.wagAdd -= w * 0.15;
      break;
    }
    case 'species': {
      speciesIdle(core, ex, t, w);
      break;
    }
    default: break;
  }
}

function speciesIdle(core, kind, t, w) {
  const c = core.c;
  const s = Math.sin;
  switch (kind) {
    case 'beg': {
      c.sit += w; c.paw += w * smoothstep(0.3, 0.7, t);
      c.headRoll += w * 0.3 * s(t * 0.8); c.wagAdd += w * 0.8;
      c.jaw += w * 0.3; c.tongue += w * 0.7; c.earBack -= w * 0.5;
      break;
    }
    case 'groom': {
      c.sit += w;
      const lick = (t % 1.6) / 1.6;
      c.groom += w * smoothstep(0.2, 0.5, t);
      c.headPitch += w * (0.35 + 0.12 * s(lick * TAU * 2));
      c.headYaw += w * 0.15;
      c.tongue += w * 0.6 * (s(t * 11) > 0 ? 1 : 0.2);
      c.eyeClose += w * 0.6;
      break;
    }
    case 'chill': {
      c.lie += w * 0.8; c.eyeClose += w * 0.9;
      c.earBack += w * 0.15 * (s(t * 9) > 0.7 ? 1 : 0);
      c.glow += w * 0.3;
      break;
    }
    case 'flap': {
      const env = smoothstep(0, 0.3, t) * (1 - smoothstep(2.2, 2.6, t % 4));
      c.flap += w * env; c.headPitch -= w * 0.35 * env; c.hop += w * 0.015 * Math.max(0, s(t * 14)) * env;
      c.jaw += w * 0.4 * env;
      break;
    }
    case 'binky': {
      const cyc = t % 2.2;
      const u = clamp01(cyc / 0.6);
      const up = Math.sin(Math.PI * u);
      c.hop += w * up * 0.22; c.twist += w * Math.sin(TAU * u) * up; c.tuck += w * up;
      c.sniff += w * (1 - up);
      break;
    }
    case 'preen': {
      const side = s(t * 0.5) > 0 ? 1 : -1;
      c.headYaw += w * side * 1.3; c.headPitch += w * 0.6; c.flap += w * 0.15;
      c.jaw += w * 0.2 * (s(t * 12) > 0 ? 1 : 0);
      break;
    }
    case 'retract': {
      const cyc = t % 5;
      const inn = smoothstep(0.2, 0.7, cyc) * (1 - smoothstep(2.6, 3.4, cyc));
      c.shell += w * inn * 0.75; c.eyeClose += w * inn * 0.5;
      break;
    }
    case 'croak': {
      const p = (t * 1.6) % 1;
      c.puff += w * Math.max(0, Math.sin(p * Math.PI)) ** 2;
      c.sit += w;
      break;
    }
    case 'stand': {
      const up = smoothstep(0.2, 0.9, t) * (1 - smoothstep(2.6, 3.3, t % 4.5));
      c.rear += w * up; c.spread += w * up * 0.5; c.headYaw += w * 0.4 * s(t * 0.9) * up;
      break;
    }
    case 'ink': {
      c.colour += w * (0.5 + 0.5 * s(t * 2)); c.curl += w * 0.4 * (0.5 + 0.5 * s(t * 1.3));
      break;
    }
    case 'taste': {
      c.curl += w * 0.45; c.headPitch -= w * 0.35;
      c.tongue += w * ((t * 2.2) % 1 < 0.3 ? 1 : 0);
      break;
    }
    case 'trumpet': {
      const up = smoothstep(0.2, 0.8, t) * (1 - smoothstep(2.0, 2.6, t % 4));
      c.trunk += w * up; c.jaw += w * up * 0.7; c.spread += w * up; c.headPitch -= w * up * 0.25;
      break;
    }
    case 'reboot': {
      c.sit += w; const off = (t % 4) < 1.2 ? 1 : 0;
      c.eyeClose += w * off; c.ledRate += w * (off ? 0 : 3); c.glow += w * (1 - off) * 0.6;
      break;
    }
    default: {
      c.sit += w * 0.5; c.headRoll += w * 0.25 * s(t);
    }
  }
}

// ---------------------------------------------------------------------------
// Signature move poses: u = 0..1 progress through the move.

function sigPose(core, kind, u, w, chargeW) {
  const c = core.c;
  const s = Math.sin;
  const t = core.t;
  if (chargeW > 0.001) {
    // holding the button before release
    switch (kind) {
      case 'sniffBoost': c.noseDown += chargeW; c.sniff += chargeW * 1.5; c.earBack -= chargeW * 0.3; c.wagAdd += chargeW * 0.6; break;
      case 'pounce': c.crouch += chargeW * 0.9; c.butt += chargeW; c.earBack -= chargeW * 0.4; c.charge += chargeW; break;
      case 'superHop': c.crouch += chargeW; c.charge += chargeW; break;
      default: c.crouch += chargeW * 0.4; c.charge += chargeW; break;
    }
  }
  if (w <= 0.001) return;
  const pulse = s(Math.PI * clamp01(u));
  switch (kind) {
    case 'sniffBoost': {
      const sniffPart = 1 - smoothstep(0.15, 0.3, u);
      c.noseDown += w * sniffPart; c.sniff += w * sniffPart * 1.5;
      c.stretch += w * (1 - sniffPart); c.earBack += w * (1 - sniffPart) * 0.9; c.tailLift -= w * 0.2 * (1 - sniffPart);
      c.jaw += w * 0.3 * (1 - sniffPart); c.tongue += w * 0.6 * (1 - sniffPart);
      break;
    }
    case 'pounce': {
      const leap = smoothstep(0, 0.15, u) * (1 - smoothstep(0.75, 0.95, u));
      c.stretch += w * leap * 1.2; c.reach += w * leap; c.earBack += w * 0.6 * leap; c.jaw += w * 0.45 * leap;
      c.crouch += w * smoothstep(0.8, 0.95, u) * (1 - smoothstep(0.95, 1, u)) * 0.8;
      c.hop += w * leap * 0.12 * s(Math.PI * clamp01(u / 0.85));
      break;
    }
    case 'chillAura': {
      c.sit += w * 0.9; c.eyeClose += w * 0.85; c.glow += w; c.headRoll += w * 0.12 * s(t * 1.4);
      break;
    }
    case 'bellySlide': {
      c.slide += w; c.headPitch -= w * 0.2; c.jaw += w * 0.3;
      break;
    }
    case 'superHop': {
      c.tuck += w * pulse; c.stretch += w * (1 - pulse) * 0.6; c.twist += w * s(TAU * u) * pulse * 0.9;
      c.earBack += w * 0.5 * pulse; c.hop += w * 0.08 * pulse;
      break;
    }
    case 'flapGlide': {
      const flapping = 1 - smoothstep(0.25, 0.4, u);
      c.spread += w; c.flap += w * flapping; c.tuck += w; c.headPitch -= w * 0.15; c.jaw += w * 0.4 * flapping;
      break;
    }
    case 'shellUp': {
      c.shell += w; c.spin += w * u;
      break;
    }
    case 'tongueSnap': {
      const out = u < 0.45 ? smoothstep(0, 0.45, u) : 1 - smoothstep(0.45, 1, u);
      c.jaw += w; c.tongue += w * out * 3; c.aim += w; c.headPitch -= w * 0.08;
      break;
    }
    case 'standTall': {
      const up = smoothstep(0, 0.12, u) * (1 - smoothstep(0.88, 1, u));
      c.rear += w * up; c.spread += w * up; c.jaw += w * up * 0.6; c.headPitch -= w * up * 0.15; c.earBack -= w * up * 0.5;
      break;
    }
    case 'eightArmGrab': {
      const reach = smoothstep(0, 0.3, u) * (1 - smoothstep(0.45, 0.65, u));
      const pull = smoothstep(0.5, 0.75, u) * (1 - smoothstep(0.9, 1, u));
      c.reach += w * reach; c.curl += w * pull; c.jaw += w * reach * 0.5; c.hop += w * reach * 0.05;
      break;
    }
    case 'coilPull': {
      c.curl += w * smoothstep(0, 0.25, u) * (1 - smoothstep(0.85, 1, u)); c.headPitch -= w * 0.3; c.jaw += w * 0.25;
      break;
    }
    case 'trunkHoover': {
      c.trunk -= w * 0.0; c.reach += w; c.spread += w; c.jaw += w * 0.2; c.tremble += w * 0.4;
      break;
    }
    case 'wifiPurr': {
      c.sit += w * 0.7; c.glow += w; c.eyeClose += w * 0.7; c.tremble += w * 0.25; c.ledRate += w * 4; c.wagAdd += w * 0.4;
      break;
    }
    default: break;
  }
}

// ---------------------------------------------------------------------------

export function updateCore(core, player, dt) {
  const c = core.c, P = core.P, emo = core.emo;
  if (!(dt > 0)) dt = 1 / 60;
  if (dt > 0.1) dt = 0.1;
  core.dt = dt;
  core.t += dt;
  resetControls(c);
  const pl = player || {};
  const size = Math.max(0.05, Number(pl.displaySize) || Number(pl.size) || 1);
  const sleek = P.sleek ?? 0.5, weight = P.weight ?? 0.5, bounce = P.bounce ?? 0.5;

  // --- locomotion signals
  const vx = num(pl.vx), vz = num(pl.vz), vy = num(pl.vy), yaw = num(pl.yaw);
  const speed = Math.hypot(vx, vz);
  core.speed = speed;
  core.v = speed / size; // body lengths per second
  const sn = clamp01(num(pl.speedNorm, core.v / 10));
  core.speedN = damp(core.speedN, sn, 10, dt);
  core.move = damp(core.move, smoothstep(0.015, 0.1, sn), 9, dt);
  core.sprint = damp(core.sprint, pl.sprinting ? 1 : 0, 4, dt);
  if (core.havePrev) {
    const ax = (vx - core.pvx) / dt, az = (vz - core.pvz) / dt, ay = (vy - core.pvy) / dt;
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    const aF = (ax * fx + az * fz) / size;
    const aR = (ax * -fz + az * fx) / size; // + = towards the left (+X local)
    core.accF = damp(core.accF, clamp(aF, -40, 40), 12, dt);
    core.accR = damp(core.accR, clamp(aR, -40, 40), 12, dt);
    core.accY = damp(core.accY, clamp(ay / size, -60, 60), 12, dt);
  }
  core.pvx = vx; core.pvz = vz; core.pvy = vy; core.havePrev = true;
  let tr = num(pl.turnRate, NaN);
  if (!Number.isFinite(tr)) tr = core.havePrev ? angleDelta(core.pyaw, yaw) / dt : 0;
  core.pyaw = yaw;
  core.yawRate = damp(core.yawRate, clamp(tr, -12, 12), 14, dt);
  core.vyN = clamp(vy / (size * 7), -1.5, 1.5);
  const airborne = !!pl.airborne || pl.grounded === false;
  core.grounded = !airborne;
  core.air = damp(core.air, airborne ? 1 : 0, airborne ? 14 : 22, dt);
  const deep = !!pl.inWater && num(pl.waterDepth, 1) > size * 0.25;
  core.inWaterRaw = deep;
  core.swim = damp(core.swim, deep ? 1 : 0, 5, dt);
  c.swim = core.swim;
  c.air = core.air * (1 - core.swim);

  // --- emotion
  const e = core.emoOverride || pl.emotion || 'happy';
  core.emotion = EMO[e] ? e : 'happy';
  const E = EMO[core.emotion];
  const wagMul = P.wag ?? 0.5;
  const er = 3.5;
  emo.wag = damp(emo.wag, E[0] * (0.25 + wagMul), er, dt);
  emo.freq = damp(emo.freq, E[1] * (0.85 + 0.3 * sleek), er, dt);
  emo.perk = damp(emo.perk, E[2], er, dt);
  emo.tail = damp(emo.tail, E[3], er, dt);
  emo.bounce = damp(emo.bounce, E[4], er, dt);
  emo.eyeOpen = damp(emo.eyeOpen, E[5], er, dt);
  emo.mouth = damp(emo.mouth, E[6] * (1 - core.swim * 0.7), er, dt);
  emo.tongue = damp(emo.tongue, E[7] * (core.species.archetype === 'quadruped' ? 1 : 0.3), er, dt);
  emo.chin = damp(emo.chin, E[8], er, dt);
  emo.crouch = damp(emo.crouch, E[9], er, dt);
  emo.tremble = damp(emo.tremble, E[10], er, dt);
  emo.blink = damp(emo.blink, E[11], er, dt);
  // excitement and sprinting both whip the tail faster
  const wagF = emo.freq * (1 + 0.5 * core.sprint);
  core.wagPhase = (core.wagPhase + dt * wagF * TAU) % (TAU * 1000);
  c.crouch += emo.crouch;
  c.tremble += emo.tremble;
  c.headPitch += emo.chin;
  c.pant += emo.mouth * (0.6 + 0.4 * core.move);
  c.jaw += emo.mouth * (0.5 + 0.5 * core.move);
  c.tongue += emo.tongue * (0.5 + 0.5 * core.move);

  // --- blink (deterministic random timing)
  core.blinkT += dt;
  if (core.blinkT >= core.nextBlink) {
    core.blinkT = 0;
    const base = 3.2 / Math.max(0.3, emo.blink);
    core.nextBlink = core.blinkDouble ? 0.22 : base * (0.6 + 0.8 * core.rnd());
    core.blinkDouble = !core.blinkDouble && core.rnd() < 0.2;
  }
  const bdur = core.emotion === 'sleepy' ? 0.3 : 0.14;
  const bt = core.blinkT / bdur;
  core.blink = bt < 1 ? Math.sin(Math.PI * bt) : 0;

  // --- eye saccades and head look-ahead
  core.nextLook -= dt;
  if (core.nextLook <= 0) {
    core.nextLook = 0.7 + core.rnd() * 2.2;
    core.lookTX = (core.rnd() - 0.5) * 0.7 * (1 - core.move * 0.6);
    core.lookTY = (core.rnd() - 0.5) * 0.3;
  }
  const lookAhead = clamp(core.yawRate * 0.16, -0.7, 0.7);
  core.lookX = damp(core.lookX, clamp(core.lookTX + lookAhead * 1.4, -0.8, 0.8), 25, dt);
  core.lookY = damp(core.lookY, core.lookTY, 25, dt);

  // --- idle layer (only while still)
  const ia = pl.idleAnim || null;
  if (ia !== core.idleCur) {
    if (core.idleCur && core.idleCurW > 0.05) { core.idlePrev = core.idleCur; core.idlePrevT = core.idleCurT; core.idlePrevW = core.idleCurW; }
    core.idleCur = ia; core.idleCurT = 0; core.idleCurW = 0;
  }
  core.idleCurT += dt; core.idlePrevT += dt;
  core.idleCurW = damp(core.idleCurW, ia ? 1 - core.move : 0, 4.5, dt);
  core.idlePrevW = damp(core.idlePrevW, 0, 6, dt);
  // shake can also be fired by shakeT (seconds remaining or since start) from the sim
  const shakeSig = num(pl.shakeT) > 0;
  if (shakeSig && !core.shakeOn) core.shakeT = 0;
  core.shakeOn = shakeSig;
  if (shakeSig && ia !== 'shake') { core.shakeT += dt; idleClip(core, 'shake', core.shakeT, 1); }
  idleClip(core, core.idleCur, core.idleCurT, core.idleCurW);
  idleClip(core, core.idlePrev, core.idlePrevT, core.idlePrevW);
  // a gentle breathing and weight-shift layer is always on when still
  c.headYaw += (1 - core.move) * 0.05 * Math.sin(core.t * 0.37);

  // --- play-bow (held bark)
  core.bowW = damp(core.bowW, pl.playBow ? 1 : 0, 8, dt);
  if (core.bowW > 0.001) { c.bow += core.bowW; c.wagAdd += core.bowW * 1.2; c.butt += core.bowW; c.jaw += 0.3 * core.bowW; c.tongue += 0.5 * core.bowW; }

  // --- bark: a quick head jerk with the mouth open
  const bt2 = num(pl.barkT, 99);
  const bark = bt2 < 0.35 ? Math.sin(Math.PI * clamp01(bt2 / 0.35)) : 0;
  c.jaw += bark * 0.9; c.headPitch -= bark * 0.3; c.earBack -= bark * 0.6; c.hop += bark * 0.025;

  // --- gulp bounce: impulse on the rising edge, cheeks follow the decay
  const gulp = clamp01(num(pl.gulp));
  if (gulp > core.prevGulp + 0.15) core.squash.v -= 4.5 * (0.6 + 0.4 * (1 - sleek));
  core.prevGulp = gulp;
  c.gulp = gulp;
  c.jaw += gulp > 0.7 ? (gulp - 0.7) * 2 : 0;
  c.headPitch -= gulp * 0.12;

  // --- landing
  const land = clamp01(num(pl.landImpact));
  if (land > core.prevLand + 0.2) core.squash.v -= (4.5 + 3 * weight) * land;
  core.prevLand = land;
  c.crouch += land * 0.35;

  // --- stagger wobble
  const stg = num(pl.stagger);
  c.stagger = clamp01(stg);
  if (stg > 0) {
    const a = clamp01(stg);
    c.headRoll += a * 0.4 * Math.sin(core.t * 13); c.headYaw += a * 0.3 * Math.sin(core.t * 9);
    c.bodyRoll += a * 0.25 * Math.sin(core.t * 11); c.eyeClose += a * 0.3; c.squint += a;
  }

  // --- signature
  const sg = pl.sig || null;
  const dur = core.species.signature?.duration || 1;
  if (sg) {
    core.sigActive = !!sg.active;
    core.sigT = num(sg.t);
    core.sigPower = clamp01(num(sg.power));
    core.sigAim = num(sg.aimYaw);
  } else { core.sigActive = false; }
  core.sigU = clamp01(core.sigT / dur);
  core.sigW = damp(core.sigW, core.sigActive ? 1 : 0, core.sigActive ? 16 : 7, dt);
  core.chargeW = damp(core.chargeW, !core.sigActive && core.sigPower > 0.02 ? core.sigPower : 0, 10, dt);
  sigPose(core, core.sigKind, core.sigActive ? core.sigU : 1, core.sigW, core.chargeW);

  // --- tea buff: cosy little sway
  if (pl.buffs && num(pl.buffs.wobble) > 0) { c.bodyRoll += 0.12 * Math.sin(core.t * 2.3); c.headRoll += 0.15 * Math.sin(core.t * 1.7 + 1); }

  // --- root springs
  const stiff = 5.5 - 2.0 * weight + 2.5 * sleek;
  const zeta = 0.32 + 0.25 * sleek + 0.15 * weight - 0.12 * bounce;
  const stretchT = core.air * clamp(Math.abs(core.vyN) * 0.14 * (0.6 + bounce * 0.6), 0, 0.2) - c.crouch * 0.04;
  springStep(core.squash, stretchT, stiff, zeta, dt);
  if (core.squash.x < -0.35) { core.squash.x = -0.35; core.squash.v = Math.max(0, core.squash.v); }
  if (core.squash.x > 0.35) { core.squash.x = 0.35; core.squash.v = Math.min(0, core.squash.v); }
  const leanT = clamp(-core.yawRate * (0.05 + 0.1 * core.speedN) * (1 - core.air * 0.5), -0.45, 0.45) + c.bodyRoll;
  springStep(core.lean, leanT, 2.6 + sleek * 1.5, 0.55, dt);
  const pitchT = clamp(-core.accF * 0.012, -0.22, 0.22);
  springStep(core.pitch, pitchT, 2.4, 0.6, dt);
  const hyT = clamp(core.yawRate * (0.12 + 0.06 * (P.snap ?? 0.5)), -0.75, 0.75) + c.headYaw;
  springStep(core.headYaw, hyT, 3 + 3 * (P.snap ?? 0.5), 0.75, dt);
  springStep(core.headPitch, c.headPitch, 3 + 3 * (P.snap ?? 0.5), 0.8, dt);
  return core;
}

function num(v, d = 0) { return typeof v === 'number' && v === v ? v : d; }
export { num };
