// Event-driven effects: maps bus events to particles and camera moves, plus
// the continuous emitters (cosmetic trails, sprint dust, water ripples and the
// footprint fallback). Everything scales with the player's size.
// Colours are soft and pastel; nothing strobes (photosensitivity-safe).

import { EV } from '../core/events.js';
import { PK, PF } from './particles.js';
import { createEmitter } from './pure/pool.js';

const CONFETTI = ['#ff9eb5', '#ffd27a', '#9fe3c8', '#a9c8ff', '#d7b4ff', '#fff3c4', '#ffb38a'];

export function createEffects(THREE, { particles, bus, getCtx }) {
  const col = new THREE.Color();
  const confetti = CONFETTI.map((h) => new THREE.Color(h));
  const C = {
    white: new THREE.Color('#fffaf0'), warm: new THREE.Color('#ffe7b8'), gold: new THREE.Color('#ffd35e'),
    sand: new THREE.Color('#e9d2a2'), dust: new THREE.Color('#efe0c0'), snow: new THREE.Color('#ffffff'),
    water: new THREE.Color('#d8f6ff'), print: new THREE.Color('#8a6a48'), printSnow: new THREE.Color('#9fb0cc'),
    star: new THREE.Color('#ffe48a'), heart: new THREE.Color('#ff8fb1'), crumb: new THREE.Color('#e0a860'),
    bubble: new THREE.Color('#e8fbff'), feather: new THREE.Color('#c9cdd8'), note: new THREE.Color('#fff2c9'),
    ring: new THREE.Color('#fff3d6'),
  };
  let seed = 1;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const rs = () => rnd() * 2 - 1;
  const trailEm = createEmitter(), dustEm = createEmitter();
  let rippleT = 0, stepDist = 0, lastStepEvent = -10, stepSide = 1;
  let lastX = NaN, lastZ = NaN;
  const offs = [];

  const P = (kind, x, y, z, vx, vy, vz, life, s0, s1, c, a, g = 0, drag = 0, spin = 0, rot = 0, flags = 0) =>
    particles.spawn(kind, x, y, z, vx, vy, vz, life, s0, s1, c.r, c.g, c.b, a, g, drag, spin, rot, flags);

  function ground(ctx, x, z, fallback) {
    if (!ctx.heightAt) return fallback;
    const h = ctx.heightAt(x, z);
    return Number.isFinite(h) ? h : fallback;
  }

  function setSand(hex) { if (hex) { C.sand.set(hex); C.dust.set(hex).lerp(C.white, 0.35); C.print.set(hex).multiplyScalar(0.62); } }

  // ------------------------------------------------------------ bursts
  function gobble(ev) {
    const ctx = getCtx(); const p = ctx.player; if (!p) return;
    const s = Math.max(0.02, p.size);
    const mx = p.x + Math.sin(p.yaw) * s * 0.45, my = p.y + s * 0.45, mz = p.z + Math.cos(p.yaw) * s * 0.45;
    const combo = ev.combo || 0;
    const n = Math.min(12, 5 + combo);
    const isz = Math.max(0.02, Math.min(ev.size || s * 0.3, s));
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2, sp = (0.8 + rnd() * 1.6) * s;
      const food = ev.food && i % 2 === 0;
      P(food ? PK.DOT : PK.SPARKLE, mx, my, mz, Math.cos(a) * sp, (0.6 + rnd() * 1.4) * s, Math.sin(a) * sp,
        0.45 + rnd() * 0.35, isz * 0.35 + s * 0.06, 0, food ? C.crumb : (i & 1 ? C.white : C.warm), food ? 0.9 : 1.0,
        3.5 * s, 3.5, rs() * 4, rnd() * 6, PF.POP);
    }
    // expanding ring pulse at the feet
    const gy = ground(ctx, p.x, p.z, p.y) + s * 0.02;
    const reach = Math.max(s * 0.5, p.reach || s * 0.6);
    P(PK.RING, p.x, gy, p.z, 0, 0, 0, 0.55, s * 0.4, reach * 2.6, C.ring, 0.85, 0, 0, 0, 0, PF.GROUND | PF.POP);
    if (combo >= 5) P(PK.RING, p.x, gy, p.z, 0, 0, 0, 0.75, s * 0.3, reach * 3.6, C.warm, 0.5, 0, 0, 0, 0, PF.GROUND | PF.POP);
    if (ev.golden) golden(mx, my, mz, s);
  }

  function golden(x, y, z, s) {
    for (let i = 0; i < 14; i++) {
      const a = rnd() * Math.PI * 2, sp = (0.5 + rnd()) * s * 1.4;
      P(PK.SPARKLE, x, y, z, Math.cos(a) * sp, (1 + rnd() * 2) * s, Math.sin(a) * sp, 0.9 + rnd() * 0.5, s * 0.16, 0, C.gold, 1, 1.2 * s, 2, rs() * 3, 0, PF.POP);
    }
    P(PK.STAR, x, y + s * 0.3, z, 0, s * 0.9, 0, 1.4, s * 0.15, s * 0.45, C.gold, 1, 0, 1.5, 1.2, 0, PF.POP);
  }

  function milestone() {
    const ctx = getCtx(); const p = ctx.player; if (!p) return;
    const s = Math.max(0.02, p.size);
    const n = Math.round(ctx.confetti || 70);
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2, r = s * (0.3 + rnd() * 2.2);
      const c = confetti[i % confetti.length];
      P(PK.CONFETTI, p.x + Math.cos(a) * r * 0.3, p.y + s * (0.8 + rnd() * 0.8), p.z + Math.sin(a) * r * 0.3,
        Math.cos(a) * r * 1.6, s * (2.2 + rnd() * 2.2), Math.sin(a) * r * 1.6,
        2.4 + rnd() * 1.4, s * 0.09, s * 0.07, c, 0.95, 2.2 * s, 1.8, rs() * 3, rnd() * 6, PF.FLIP);
    }
    const gy = ground(ctx, p.x, p.z, p.y) + s * 0.02;
    P(PK.RING, p.x, gy, p.z, 0, 0, 0, 1.0, s * 0.5, s * 7, C.warm, 0.7, 0, 0, 0, 0, PF.GROUND | PF.POP);
  }

  function splash(x, z, size, yOverride) {
    const ctx = getCtx(); const p = ctx.player;
    const s = Math.max(0.02, size || (p ? p.size : 0.3));
    const y = yOverride ?? (ctx.waterLevel != null ? ctx.waterLevel : (p ? p.y : 0));
    for (let i = 0; i < 16; i++) {
      const a = rnd() * Math.PI * 2, sp = (0.6 + rnd() * 1.4) * s;
      P(PK.DROP, x + Math.cos(a) * s * 0.2, y, z + Math.sin(a) * s * 0.2, Math.cos(a) * sp, (2 + rnd() * 2.5) * s, Math.sin(a) * sp,
        0.6 + rnd() * 0.4, s * 0.08, s * 0.04, C.water, 0.9, 9 * s, 0.6, 0, 0, 0);
    }
    P(PK.RING, x, y + 0.01, z, 0, 0, 0, 0.9, s * 0.3, s * 2.6, C.water, 0.7, 0, 0, 0, 0, PF.GROUND | PF.POP);
    P(PK.RING, x, y + 0.01, z, 0, 0, 0, 1.3, s * 0.2, s * 4, C.water, 0.45, 0, 0, 0, 0, PF.GROUND | PF.POP);
  }

  function shake() {
    const ctx = getCtx(); const p = ctx.player; if (!p) return;
    const s = Math.max(0.02, p.size);
    for (let i = 0; i < 26; i++) {
      const a = rnd() * Math.PI * 2, sp = (1.2 + rnd() * 1.6) * s;
      P(PK.DROP, p.x + Math.cos(a) * s * 0.25, p.y + s * (0.35 + rnd() * 0.25), p.z + Math.sin(a) * s * 0.25,
        Math.cos(a) * sp, (0.6 + rnd() * 1.4) * s, Math.sin(a) * sp, 0.5 + rnd() * 0.4, s * 0.06, s * 0.03, C.water, 0.9, 8 * s, 1.2, 0, 0, 0);
    }
  }

  function dustPuff(x, y, z, s, n, strength) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rnd() * 0.5, sp = (0.5 + rnd() * 0.6) * s * strength;
      P(PK.DOT, x + Math.cos(a) * s * 0.2, y + s * 0.04, z + Math.sin(a) * s * 0.2, Math.cos(a) * sp, s * 0.25 * strength, Math.sin(a) * sp,
        0.6 + rnd() * 0.4, s * 0.12, s * 0.4, C.dust, 0.55, -0.15 * s, 3.2, 0, 0, PF.POP);
    }
  }

  function land(ev) {
    const ctx = getCtx(); const p = ctx.player; if (!p || p.inWater) return;
    const s = Math.max(0.02, p.size);
    const imp = Math.max(0.2, Math.min(1, ev.impact ?? 0.5));
    const gy = ground(ctx, p.x, p.z, p.y);
    dustPuff(p.x, gy, p.z, s, Math.round(6 + imp * 6), 0.6 + imp);
    if (imp > 0.55) P(PK.RING, p.x, gy + s * 0.02, p.z, 0, 0, 0, 0.5, s * 0.3, s * 1.8 * imp, C.dust, 0.5, 0, 0, 0, 0, PF.GROUND | PF.POP);
  }

  function footprint(x, z, surface, side, yaw, s) {
    const ctx = getCtx();
    if (surface !== 'sand' && surface !== 'snow') return;
    const gy = ground(ctx, x, z, ctx.player ? ctx.player.y : 0) + 0.004 + s * 0.004;
    const ox = -Math.cos(yaw) * side * s * 0.12, oz = Math.sin(yaw) * side * s * 0.12;
    P(PK.PAW, x + ox, gy, z + oz, 0, 0, 0, 6, s * 0.16, s * 0.16, surface === 'snow' ? C.printSnow : C.print, 0.32, 0, 0, 0, -yaw + Math.PI, PF.GROUND);
  }

  function bump() {
    const ctx = getCtx(); const p = ctx.player; if (!p) return;
    const s = Math.max(0.02, p.size);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      P(PK.STAR, p.x + Math.cos(a) * s * 0.3, p.y + s * 0.95, p.z + Math.sin(a) * s * 0.3, Math.cos(a) * s * 0.6, s * 0.5, Math.sin(a) * s * 0.6,
        0.8, s * 0.14, s * 0.08, C.star, 1, 0, 2, 3, a, 0);
    }
  }

  function sparkleBurst(n, colour) {
    const ctx = getCtx(); const p = ctx.player; if (!p) return;
    const s = Math.max(0.02, p.size);
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2, sp = (0.4 + rnd()) * s;
      P(PK.SPARKLE, p.x, p.y + s * 0.7, p.z, Math.cos(a) * sp, (0.8 + rnd() * 1.5) * s, Math.sin(a) * sp, 0.9 + rnd() * 0.6, s * 0.14, 0, colour, 1, 0.6 * s, 1.5, 0, 0, PF.POP);
    }
  }

  function bark() {
    const ctx = getCtx(); const p = ctx.player; if (!p) return;
    const s = Math.max(0.02, p.size);
    const hx = p.x + Math.sin(p.yaw) * s * 0.6, hz = p.z + Math.cos(p.yaw) * s * 0.6;
    P(PK.RING, hx, p.y + s * 0.6, hz, Math.sin(p.yaw) * s * 0.8, s * 0.2, Math.cos(p.yaw) * s * 0.8, 0.45, s * 0.12, s * 0.6, C.white, 0.6, 0, 2, 0, 0, PF.POP);
  }

  function feathers(x, z) {
    const ctx = getCtx(); const p = ctx.player;
    const s = 0.3;
    const y = ground(ctx, x, z, p ? p.y : 0) + 0.3;
    for (let i = 0; i < 6; i++) {
      P(PK.LEAF, x + rs() * 0.4, y, z + rs() * 0.4, rs() * 0.6, 0.8 + rnd(), rs() * 0.6, 1.6, s * 0.18, s * 0.14, C.feather, 0.9, 0.8, 1.5, rs() * 3, rnd() * 6, PF.FLIP);
    }
  }

  // ------------------------------------------------------------ bus
  const on = (type, fn) => { offs.push(bus.on(type, (ev) => { try { fn(ev || {}); } catch (e) { console.warn('[fx]', type, e); } })); };
  if (bus) {
    on(EV.GOBBLE, gobble);
    on(EV.MILESTONE, (ev) => { milestone(); getCtx().onMilestone?.(ev); });
    on(EV.SPLASH, (ev) => splash(ev.x ?? getCtx().player?.x ?? 0, ev.z ?? getCtx().player?.z ?? 0, ev.size));
    on(EV.SHAKE, shake);
    on(EV.LAND, land);
    on(EV.FOOTSTEP, (ev) => {
      lastStepEvent = getCtx().time;
      const p = getCtx().player; if (!p) return;
      footprint(ev.x ?? p.x, ev.z ?? p.z, ev.surface || p.surface, ev.side === 'left' || ev.side < 0 ? -1 : 1, p.yaw, p.size);
    });
    on(EV.BUMP, () => { bump(); getCtx().onBump?.(); });
    on(EV.STAR, () => sparkleBurst(16, C.gold));
    on(EV.EGG, () => sparkleBurst(20, C.warm));
    on(EV.GOLDEN, () => { const p = getCtx().player; if (p) golden(p.x, p.y + p.size * 0.6, p.z, p.size); });
    on(EV.BARK, bark);
    on(EV.PIGEON_SCARE, (ev) => { const p = getCtx().player; if (p) feathers(ev.x ?? p.x, ev.z ?? p.z); });
    on('note', () => { const p = getCtx().player; if (p) P(PK.NOTE, p.x, p.y + p.size, p.z, rs() * 0.3, p.size * 0.8, rs() * 0.3, 1.4, p.size * 0.2, p.size * 0.25, C.note, 1, 0, 1, 0, rs() * 0.3, PF.POP); });
  }

  // ------------------------------------------------------------ continuous
  function tick(dt) {
    const ctx = getCtx(); const p = ctx.player; if (!p) return;
    const s = Math.max(0.02, p.size);
    const sp = Math.hypot(p.vx || 0, p.vz || 0);
    const moving = sp > s * 0.4;
    // cosmetic trail
    const trail = ctx.trail;
    const tn = trailEm.take(trail && moving ? 16 : 0, dt);
    for (let i = 0; i < tn; i++) {
      const kind = trail.includes('heart') ? PK.HEART : trail.includes('bubble') ? PK.BUBBLE : trail.includes('note') ? PK.NOTE : trail.includes('leaf') ? PK.LEAF : PK.SPARKLE;
      const c = kind === PK.HEART ? C.heart : kind === PK.BUBBLE ? C.bubble : kind === PK.LEAF ? col.set('#9fd67a') : C.warm;
      const bx = p.x - Math.sin(p.yaw) * s * 0.45, bz = p.z - Math.cos(p.yaw) * s * 0.45;
      P(kind, bx + rs() * s * 0.2, p.y + s * (0.3 + rnd() * 0.4), bz + rs() * s * 0.2, rs() * s * 0.2, s * (0.3 + rnd() * 0.4), rs() * s * 0.2,
        0.9 + rnd() * 0.5, s * 0.1, s * 0.04, c, 0.95, kind === PK.BUBBLE ? -0.2 * s : 0, 1.5, rs() * 2, 0, PF.POP);
    }
    // sprint dust
    const dusty = p.grounded !== false && !p.inWater && p.sprinting && moving && p.surface !== 'water' && p.surface !== 'ice';
    const dn = dustEm.take(dusty ? 14 : 0, dt);
    if (dn) {
      const gy = ground(ctx, p.x, p.z, p.y);
      for (let i = 0; i < dn; i++) {
        const bx = p.x - Math.sin(p.yaw) * s * 0.4, bz = p.z - Math.cos(p.yaw) * s * 0.4;
        const c = p.surface === 'snow' ? C.snow : C.dust;
        P(PK.DOT, bx + rs() * s * 0.2, gy + s * 0.05, bz + rs() * s * 0.2, rs() * s * 0.3 - p.vx * 0.1, s * 0.3, rs() * s * 0.3 - p.vz * 0.1,
          0.55 + rnd() * 0.3, s * 0.1, s * 0.35, c, 0.45, -0.1 * s, 3, 0, 0, PF.POP);
      }
    }
    // water ripples
    if (p.inWater) {
      rippleT -= dt;
      if (rippleT <= 0) {
        rippleT = moving ? 0.22 : 0.9;
        const wy = ctx.waterLevel != null ? ctx.waterLevel : p.y + (p.waterDepth || 0);
        P(PK.RING, p.x, wy + 0.01, p.z, 0, 0, 0, 1.2, s * 0.5, s * 2.4, C.water, 0.5, 0, 0, 0, 0, PF.GROUND | PF.POP);
      }
    }
    // footprint fallback when the sim doesn't send FOOTSTEP events
    if (Number.isFinite(lastX) && p.grounded !== false && !p.inWater && ctx.time - lastStepEvent > 1.5) {
      stepDist += Math.hypot(p.x - lastX, p.z - lastZ);
      const stride = s * 0.42;
      if (stepDist > stride) {
        stepDist = 0;
        stepSide = -stepSide;
        footprint(p.x, p.z, p.surface, stepSide, p.yaw, s);
      }
    }
    lastX = p.x; lastZ = p.z;
  }

  return {
    tick, gobble, milestone, splash, shake, land, bump, golden, setSand,
    reset() { lastX = NaN; lastZ = NaN; stepDist = 0; rippleT = 0; trailEm.reset(); dustEm.reset(); },
    dispose() { for (const f of offs) f(); offs.length = 0; },
  };
}
