// Critter NPCs: pigeons (and Gerald, and his cousin Nigel), gulls, a toucan,
// a marmoset, a squirrel, a sloth, a Highland cow (fringe!), a wild haggis
// (shorter legs on one side, obviously), kittens, a Magellanic penguin in
// sunglasses, a frog, a duckling, a butterfly and a fox.
//
//   createCritterView({ THREE, mats, kind, quality, disguise, realScale = true }) -> {
//     object3d, update(npc, dt), setLook(look), setDisguise(id), setEmotion(e), dispose()
//   }
//
// Every critter rides the same procedural rigs as the player animals, driven
// by a fake player state built from the npc record (CONTRACTS §3.3 npcs):
// npc.anim (NPC_ANIMS) picks the gait or idle, npc.mood the emotion, and
// movement is read from x/z versus px/pz. Gerald's disguise comes from
// npc.disguise, or npc.mood = 'disguise:<id>', or setDisguise(id).
// Scale: real world metres by default (a pigeon is about 0.32 m long, the
// Highland cow about 2.1 m), origin at the feet, facing +Z, like buildHuman.
// Pass realScale: false for unit size (body length 1). view.metres says how
// long the critter is.

import { createAnimalView } from './index.js';
import { makeShapes } from './shapes.js';

const P = (o) => ({ bounce: 0.5, sleek: 0.5, weight: 0.4, wag: 0.5, gaitFreq: 1, snap: 0.6, extraIdle: 'none', idleBias: {}, ...o });
const L = (o) => ({ base: '#999999', secondary: '#888888', belly: '#dddddd', tips: '#777777', eyes: '#2a1d14', nose: '#2a1d17', pattern: 'none', patternColor: '#ffffff', patternSeed: 3, patternAmount: 0.5, accessories: { head: null, neck: null, back: null, face: null, badge: null }, trail: null, soundPack: null, decal: null, ...o });

const PIGEON_LOOK = { base: '#a3abb8', secondary: '#7f8898', belly: '#b9c0cc', tips: '#e8a23a', eyes: '#e8742a', nose: '#3a3a40', pattern: 'bands', patternColor: '#5f9a88', patternAmount: 0.6 };

export const CRITTER_DEFS = {
  pigeon: { metres: 0.32, plan: 'c_pigeon', arch: 'waddler', pers: P({ bounce: 0.6, gaitFreq: 1.6, extraIdle: 'preen' }), look: L(PIGEON_LOOK) },
  gerald: { metres: 0.36, plan: 'c_gerald', arch: 'waddler', pers: P({ bounce: 0.7, gaitFreq: 1.5, extraIdle: 'preen', snap: 0.9 }), look: L({ ...PIGEON_LOOK, base: '#9ca4b4', secondary: '#6f7889', eyes: '#f29a2e' }), smug: true },
  nigel: { metres: 0.34, plan: 'c_nigel', arch: 'waddler', pers: P({ bounce: 0.6, gaitFreq: 1.5, extraIdle: 'preen' }), look: L({ ...PIGEON_LOOK, base: '#8d8a86', secondary: '#6a6662', patternColor: '#8a5a9a' }), disguise: 'flatcap' },
  gull: { metres: 0.5, plan: 'c_gull', arch: 'waddler', pers: P({ bounce: 0.4, gaitFreq: 1.3, extraIdle: 'preen' }), look: L({ base: '#f4f4f2', secondary: '#f8f8f6', belly: '#ffffff', tips: '#f2c23a', eyes: '#f2d23a', nose: '#f2c23a', pattern: 'bands', patternColor: '#8a929e', patternAmount: 0.5 }) },
  toucan: { metres: 0.5, plan: 'c_toucan', arch: 'waddler', pers: P({ bounce: 0.6, gaitFreq: 1.4, extraIdle: 'preen' }), look: L({ base: '#1c1b1f', secondary: '#1c1b1f', belly: '#f8e8a0', tips: '#e0402a', eyes: '#2a6ae0', nose: '#f29a1a' }) },
  duckling: { metres: 0.16, plan: 'c_duckling', arch: 'waddler', pers: P({ bounce: 0.8, gaitFreq: 1.9, extraIdle: 'preen' }), look: L({ base: '#ffd94a', secondary: '#ffe066', belly: '#fff0a0', tips: '#f2a13a', eyes: '#1c1c1c', nose: '#f29a2e' }) },
  magpenguin: { metres: 0.6, plan: 'c_magpenguin', arch: 'waddler', pers: P({ bounce: 0.7, gaitFreq: 1.4, extraIdle: 'flap' }), look: L({ base: '#22262c', secondary: '#22262c', belly: '#f7f5ef', tips: '#f7f5ef', nose: '#3a3a3a', eyes: '#1a1a1a', accessories: { head: null, neck: null, back: null, face: 'sunglasses', badge: null } }) },
  frog: { metres: 0.12, plan: 'c_frog', arch: 'hopper', pers: P({ bounce: 0.9, extraIdle: 'croak' }), look: L({ base: '#5fb548', secondary: '#4a9a37', belly: '#e6f0b8', tips: '#2f6e25', eyes: '#f2c94c', nose: '#3f7f2e', pattern: 'spots', patternColor: '#2f6e25' }) },
  kitten: { metres: 0.28, plan: 'c_kitten', arch: 'quadruped', style: 'c_kitten', pers: P({ bounce: 0.6, sleek: 0.9, wag: 0.4, gaitFreq: 1.3, extraIdle: 'groom' }), look: L({ base: '#9a8c7c', secondary: '#7a6c5c', belly: '#efe4d4', tips: '#efe4d4', eyes: '#5aa7e0', nose: '#e8a0a8', pattern: 'stripes', patternColor: '#5a4c3e', patternAmount: 0.5 }) },
  fox: { metres: 0.85, plan: 'c_fox', arch: 'quadruped', style: 'c_fox', pers: P({ bounce: 0.45, sleek: 0.85, wag: 0.35, gaitFreq: 1.1, extraIdle: 'groom' }), look: L({ base: '#e0702e', secondary: '#c85a20', belly: '#fbf2e6', tips: '#fbf2e6', eyes: '#d9a03a', nose: '#1c1814', pattern: 'socks', patternColor: '#2a1c16', patternAmount: 0.6 }) },
  squirrel: { metres: 0.3, plan: 'c_squirrel', arch: 'quadruped', style: 'c_squirrel', pers: P({ bounce: 0.9, sleek: 0.8, wag: 0.8, gaitFreq: 1.6, extraIdle: 'groom' }), look: L({ base: '#9a9a9e', secondary: '#7f7f84', belly: '#f2f0ea', tips: '#c8a07a', eyes: '#1c1410', nose: '#3a2a2a' }) },
  marmoset: { metres: 0.22, plan: 'c_marmoset', arch: 'quadruped', style: 'c_marmoset', pers: P({ bounce: 0.9, sleek: 0.9, wag: 0.6, gaitFreq: 1.6, extraIdle: 'groom' }), look: L({ base: '#8a7e70', secondary: '#3a302a', belly: '#b8aa98', tips: '#f7f4ee', eyes: '#3a2414', nose: '#2a201a', pattern: 'bands', patternColor: '#3a302a', patternAmount: 0.6 }) },
  sloth: { metres: 0.6, plan: 'c_sloth', arch: 'quadruped', style: 'c_sloth', pers: P({ bounce: 0.05, sleek: 0.1, weight: 0.8, wag: 0, gaitFreq: 0.35, snap: 0.05, extraIdle: 'chill' }), look: L({ base: '#9a8466', secondary: '#7a6650', belly: '#e8dcc4', tips: '#3a2a1e', eyes: '#1c140e', nose: '#2a1e16' }), emotion: 'sleepy' },
  highlandcow: { metres: 2.1, plan: 'c_highlandcow', arch: 'quadruped', style: 'c_highlandcow', pers: P({ bounce: 0.15, sleek: 0.15, weight: 0.95, wag: 0.3, gaitFreq: 0.7, snap: 0.2, extraIdle: 'chill' }), look: L({ base: '#c06a30', secondary: '#9a5228', belly: '#b0602a', tips: '#8a4a1e', eyes: '#1c140e', nose: '#3a2420' }), emotion: 'proud' },
  haggis: { metres: 0.38, plan: 'c_haggis', arch: 'quadruped', style: 'c_haggis', pers: P({ bounce: 0.8, sleek: 0.4, weight: 0.5, wag: 0.6, gaitFreq: 1.5, extraIdle: 'chill' }), look: L({ base: '#7a4a2e', secondary: '#5a3420', belly: '#9a6a48', tips: '#4a2a18', eyes: '#1c120c', nose: '#2a1a12' }) },
  butterfly: { custom: 'butterfly', metres: 0.08 },
};

// Disguise ids (G9 running gag). Maps world-data names onto cosmetic meshes.
export const DISGUISES = {
  touristhat: { slot: 'head', id: 'touristhat' }, bowler: { slot: 'head', id: 'bowler' }, explorer: { slot: 'head', id: 'explorer' },
  tartan: { slot: 'neck', id: 'scarf' }, scarf: { slot: 'neck', id: 'scarf' }, hoodie: { slot: 'head', id: 'hoodie' }, beret: { slot: 'head', id: 'beret' },
  flatcap: { slot: 'head', id: 'flatcap' }, sunglasses: { slot: 'face', id: 'sunglasses' }, swimring: { slot: 'back', id: 'swimring' },
  crown: { slot: 'head', id: 'carnivalcrown' }, moustache: { slot: 'face', id: 'moustache' }, partyhat: { slot: 'head', id: 'partyhat' },
};

const ANIM_SPEED = { idle: 0, walk: 0.24, run: 0.75, flee: 0.95, sit: 0, lie: 0, wave: 0, cheer: 0, tut: 0, throw: 0, dance: 0, sell: 0, read: 0, point: 0, fly: 0.55, peck: 0, swim: 0.3, hop: 0.35 };
const ANIM_IDLE = { sit: 'sit', lie: 'lie', read: 'sit', sell: 'look', point: 'look', tut: 'look', wave: 'species', peck: 'sniff', throw: 'species' };

function speciesFor(kind, def) {
  const id = `critter:${kind}`;
  return {
    id, planId: def.plan, styleId: def.style, archetype: def.arch,
    nameKey: `species.critter.${kind}.name`,
    stats: { speed: 1, accel: 1, turn: 1, jump: 1, reach: 1, startSize: 1, waterSpeed: 0.7, slideSpeed: 1 },
    swims: false, floats: kind === 'duckling', canJump: true,
    traits: {}, affinity: { surfaces: {} }, hitbox: { radius: 0.4, height: 0.6 },
    personality: def.pers, signature: { kind: null, duration: 1, cooldown: 1 }, sounds: { voice: kind },
    defaults: def.look, presets: [], unlock: { kind: 'start' }, smug: !!def.smug,
  };
}

export function createCritterView({ THREE, mats, kind = 'pigeon', quality = 'medium', disguise = null, realScale = true } = {}) {
  const def = CRITTER_DEFS[kind] || CRITTER_DEFS.pigeon;
  if (def.custom === 'butterfly') { const b = createButterfly(THREE, mats); b.object3d.scale.setScalar(realScale ? 0.25 : 2.5); b.metres = def.metres; return b; }
  const sp = speciesFor(CRITTER_DEFS[kind] ? kind : 'pigeon', def);
  const look = JSON.parse(JSON.stringify(def.look));
  const inner = createAnimalView({ THREE, mats, species: sp, look, quality });
  const group = new THREE.Group();
  group.name = `critter:${kind}`;
  const holder = inner.object3d;
  const scale = realScale ? def.metres : 1;
  holder.scale.setScalar(scale);
  group.add(holder);
  if (def.emotion) inner.setEmotion(def.emotion);
  let curDisguise = null;
  const fake = {
    x: 0, y: 0, z: 0, yaw: 0, vx: 0, vy: 0, vz: 0, speed: 0, speedNorm: 0, size: 1, displaySize: 1,
    grounded: true, airborne: false, inWater: false, waterDepth: 0, sprinting: false, turnRate: 0, landImpact: 0,
    gulp: 0, stagger: 0, sig: { kind: null, active: false, t: 0, power: 0, aimYaw: 0 }, emotion: 'happy', idleAnim: null,
    barkT: 99, playBow: false, shakeT: 0, buffs: { tea: 0, wobble: 0, speed: 0 },
  };
  let lastYaw = null, peckT = 0;

  function setDisguise(id) {
    const d = id ? DISGUISES[id] || null : null;
    const key = d ? d.id : null;
    if (key === curDisguise) return;
    curDisguise = key;
    const acc = { head: null, neck: null, back: null, face: def.look.accessories?.face || null, badge: null };
    if (d) acc[d.slot] = d.id;
    inner.setLook({ ...look, accessories: acc });
  }
  setDisguise(disguise || def.disguise || null);

  return {
    object3d: group,
    kind,
    metres: def.metres,
    view: inner,
    update(npc, dt) {
      const n = npc || {};
      if (!(dt > 0)) dt = 1 / 60;
      const anim = n.anim || 'idle';
      // movement from the tick delta (sim runs at 60 Hz)
      const dx = (n.x ?? 0) - (n.px ?? n.x ?? 0), dz = (n.z ?? 0) - (n.pz ?? n.z ?? 0);
      let vx = dx * 60, vz = dz * 60;
      let sn = ANIM_SPEED[anim] ?? 0;
      const moving = Math.hypot(vx, vz);
      if (moving > 0.01) sn = Math.max(sn, Math.min(1, moving / (6 * scale)));
      if (sn > 0 && moving < 0.01) { vx = Math.sin(n.yaw || 0) * sn * 6 * scale; vz = Math.cos(n.yaw || 0) * sn * 6 * scale; }
      const yaw = n.yaw || 0;
      fake.turnRate = lastYaw === null ? 0 : Math.max(-8, Math.min(8, ((yaw - lastYaw + Math.PI * 3) % (Math.PI * 2) - Math.PI) / dt));
      lastYaw = yaw;
      // the fake player is in the critter's own (unit) space
      fake.vx = vx / scale; fake.vz = vz / scale; fake.yaw = yaw;
      fake.speedNorm = sn; fake.speed = Math.hypot(fake.vx, fake.vz);
      fake.airborne = anim === 'fly'; fake.grounded = !fake.airborne; fake.vy = fake.airborne ? Math.sin((n.animT || 0) * 3) * 1.5 : 0;
      fake.inWater = anim === 'swim'; fake.waterDepth = fake.inWater ? 1 : 0;
      fake.idleAnim = ANIM_IDLE[anim] || (anim === 'idle' && (n.animT || 0) > 4 ? (Math.floor((n.animT || 0) / 6) % 3 === 0 ? 'look' : Math.floor((n.animT || 0) / 6) % 3 === 1 ? 'species' : null) : null);
      fake.playBow = anim === 'dance';
      const mood = typeof n.mood === 'string' ? n.mood : null;
      fake.emotion = anim === 'flee' ? 'scared' : anim === 'cheer' || anim === 'dance' ? 'excited' : (mood && !mood.startsWith('disguise:') ? mood : def.emotion || (def.smug ? 'proud' : 'happy'));
      // pecks: quick jabs of the head
      if (anim === 'peck') { peckT += dt; fake.gulp = (peckT % 0.6) < 0.08 ? 1 : Math.max(0, fake.gulp - dt * 4); }
      fake.barkT = anim === 'cheer' || anim === 'tut' ? ((n.animT || 0) % 1.1) : 99;
      if (anim === 'hop') { const u = ((n.animT || 0) * 2.2) % 1; fake.airborne = u < 0.5; fake.grounded = !fake.airborne; fake.vy = (0.25 - u) * 8; fake.landImpact = u > 0.5 && u < 0.56 ? 0.6 : 0; }
      const dz2 = n.disguise || (mood && mood.startsWith('disguise:') ? mood.slice(9) : null);
      if (dz2) setDisguise(dz2);
      inner.update(fake, dt);
      if (def.smug) {
        // Gerald: permanently pleased with himself, half-lidded
        const b = inner.rig.pose.bones;
        if (b.lidL) { b.lidL.rx = Math.max(b.lidL.rx, -0.1); b.lidR.rx = Math.max(b.lidR.rx, -0.1); }
      }
    },
    setLook(l) { inner.setLook(l); },
    setDisguise,
    setEmotion(e) { inner.setEmotion(e); },
    stats() { return inner.stats(); },
    dispose() { inner.dispose(); group.removeFromParent(); },
  };
}

function createButterfly(THREE, mats) {
  const S = makeShapes(THREE);
  const g = new THREE.Group();
  g.name = 'critter:butterfly';
  const body = new THREE.Mesh(S.ellipsoid(0.02, 0.02, 0.09, 8, 6), mats.toon('#2a2230'));
  body.position.y = 0.3;
  g.add(body);
  const wingMat = mats.toon('#ffffff', { vertexColors: true, side: THREE.DoubleSide });
  const mk = (s) => {
    const w = new THREE.Group();
    const geo = new THREE.BufferGeometry();
    // two lobes per wing
    const shape = new THREE.Shape();
    shape.moveTo(0, 0); shape.bezierCurveTo(0.1, 0.12, 0.2, 0.08, 0.16, -0.01); shape.bezierCurveTo(0.2, -0.08, 0.1, -0.12, 0, -0.02);
    const sg = new THREE.ShapeGeometry(shape, 8);
    sg.rotateX(-Math.PI / 2);
    if (s < 0) sg.scale(-1, 1, 1);
    const pos = sg.getAttribute('position');
    const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const r = Math.hypot(pos.getX(i), pos.getZ(i));
      const edge = r > 0.15 ? 1 : 0;
      col[i * 3] = edge ? 0.05 : 0.95; col[i * 3 + 1] = edge ? 0.04 : 0.45; col[i * 3 + 2] = edge ? 0.06 : 0.08;
    }
    geo.copy(sg);
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const m = new THREE.Mesh(geo, wingMat);
    w.add(m);
    w.position.y = 0.3;
    return w;
  };
  const L = mk(1), R = mk(-1);
  g.add(L, R);
  let t = 0;
  return {
    object3d: g, kind: 'butterfly',
    update(npc, dt) {
      t += dt || 1 / 60;
      const flap = Math.sin(t * 18) * 0.9 + 0.2;
      L.rotation.z = flap; R.rotation.z = -flap;
      const bob = Math.sin(t * 3) * 0.04;
      body.position.y = L.position.y = R.position.y = 0.3 + bob;
      body.rotation.x = -0.2;
    },
    setLook() {}, setDisguise() {}, setEmotion() {},
    stats() { return { drawCalls: 3, triangles: 200 }; },
    dispose() { g.traverse((o) => { if (o.isMesh) o.geometry.dispose(); }); g.removeFromParent(); },
  };
}
