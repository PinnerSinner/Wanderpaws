// Eggs: ids match SPEC §7, every one is wired, every copy key exists, and the
// trickier ones actually trigger through a mock ctx.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { WORLDS, getWorld } from '../../src/worlds/index.js';
import { CATALOGUE, CATALOGUE_ORDER } from '../../src/worlds/catalogue.js';
import { hasCopy, tRaw, allKeys } from '../../src/core/copy/index.js';
import { EV } from '../../src/core/events.js';
import { morse, morseOn } from '../../src/worlds/eggs/w1.js';
import { barkGroups } from '../../src/worlds/eggs/w5.js';
import { makeHarness } from './mockctx.js';

const SPEC_COUNTS = { w1: ['C', 13], w2: ['L', 13], w3: ['T', 13], w4: ['H', 13], w5: ['M', 14] };

test('SPEC §7 egg ids are all present, in the right world, and unique', () => {
  const spec = fs.readFileSync(new URL('../../SPEC.md', import.meta.url), 'utf8');
  for (const w of WORLDS) {
    const [p, n] = SPEC_COUNTS[w.id];
    const ids = w.eggs.map((e) => e.id);
    assert.equal(new Set(ids).size, ids.length, `${w.id} has duplicate egg ids`);
    for (let i = 1; i <= n; i++) {
      const id = `${p}${i}`;
      assert.ok(ids.includes(id), `${w.id} is missing ${id}`);
      assert.ok(spec.includes(`- ${id} `), `${id} is not in SPEC`);
    }
    assert.ok(ids.includes('G8') && ids.includes('G9'), `${w.id} needs G8 and G9`);
    for (const e of w.eggs) {
      if (/^[CLTHM]\d+$/.test(e.id)) assert.equal(e.id[0], p, `${e.id} in the wrong world`);
      assert.ok(e.init || e.onEvent || e.tick, `${e.id} does nothing`);
    }
  }
  const all = WORLDS.flatMap((w) => w.eggs.map((e) => e.id)).filter((id) => id !== 'G8' && id !== 'G9');
  assert.equal(new Set(all).size, all.length, 'egg ids unique across worlds');
});

test('every copy key referenced exists (worlds, items, journal, eggs, lines)', () => {
  const missing = [];
  const need = (k) => { if (!hasCopy(k, 'en-GB')) missing.push(k); };
  for (const w of WORLDS) {
    need(w.nameKey); need(w.introKey); need(w.outroKey);
    for (const e of w.eggs) {
      need(e.nameKey); need(e.descKey); need(e.hintKey);
      for (const l of e.lines || []) need(l);
    }
  }
  for (const id of CATALOGUE_ORDER) { need(CATALOGUE[id].nameKey); need(CATALOGUE[id].journalKey); }
  assert.deepEqual(missing, []);
});

test("Seu Zé's lines are pt-BR with an English translation", () => {
  for (const k of ['egg.C8.line', 'egg.C8.call', 'egg.T11.line']) {
    assert.ok(hasCopy(`${k}.en`, 'en-GB'), `${k}.en`);
    assert.notEqual(tRaw(k), tRaw(`${k}.en`));
  }
});

test('world copy: British, no em dashes', () => {
  for (const k of allKeys('en-GB')) {
    if (!/^(world|item|journal|egg)\./.test(k)) continue;
    const v = String(tRaw(k));
    assert.ok(!v.includes('\u2014'), `em dash in ${k}`);
    assert.ok(!/\b(color|favorite|center)\b/i.test(v), `American spelling in ${k}: ${v}`);
  }
});

test('every egg survives a noisy run with every species', () => {
  const kinds = [EV.GOBBLE, EV.BARK, EV.PLAY_BOW, EV.JUMP, EV.LAND, EV.SHAKE, EV.SPLASH, EV.SIG, EV.IDLE, EV.BUMP, EV.HAZARD];
  for (const w of WORLDS) {
    for (const sp of ['oli', 'penguin', 'capybara', 'cat']) {
      const h = makeHarness(w, { speciesId: sp, mode: 'chill' });
      const pts = [w.spawn, ...w.zones.map((z) => ({ x: z.x, z: z.z }))];
      let k = 0;
      for (const p of pts) {
        h.moveTo(p.x, p.z);
        h.seconds(1.5);
        const ev = { type: kinds[k++ % kinds.length], x: p.x, z: p.z, itemType: CATALOGUE_ORDER[k % CATALOGUE_ORDER.length], kind: 'puddle', hazardKind: 'marmoset' };
        h.event(ev);
        h.seconds(0.5);
      }
      h.seconds(30);
    }
  }
});

test('C1: Morse PING schedule and the PONG', () => {
  const s = morse('PING');
  assert.equal(s.spans.length, 4 + 2 + 2 + 3);
  assert.ok(morseOn(s, 0.05));
  const w = getWorld('w1');
  const h = makeHarness(w);
  const R = { x: 13.2, z: -8.2 };
  // find a time when the LED is off, gobble: timed out and a new router spawns
  while (morseOn(s, h.state.time)) h.tick();
  h.event({ type: EV.GOBBLE, itemType: 'router', x: R.x, z: R.z });
  assert.ok(!h.log.found.has('C1'));
  assert.equal(h.log.spawned.at(-1).type, 'router');
  while (!morseOn(s, h.state.time)) h.tick();
  h.event({ type: EV.GOBBLE, itemType: 'router', x: R.x, z: R.z });
  assert.ok(h.log.found.has('C1'));
  assert.ok(h.log.said.some((l) => l.key === 'egg.C1.line1'));
});

test('C11: three barks at the posto', () => {
  const h = makeHarness(getWorld('w1'));
  h.moveTo(-12, -11);
  for (let i = 0; i < 3; i++) { h.event({ type: EV.BARK }); h.seconds(0.5); }
  assert.ok(h.log.found.has('C11'));
});

test('C5: hopping the footvolley net three times', () => {
  const h = makeHarness(getWorld('w1'));
  for (let i = 0; i < 3; i++) {
    h.moveTo(i % 2 ? 26 : 22, -16); h.event({ type: EV.JUMP });
    h.moveTo(i % 2 ? 22 : 26, -16); h.event({ type: EV.LAND });
  }
  assert.ok(h.log.found.has('C5'));
  assert.ok(h.log.spawned.some((s) => s.type === 'football' && s.golden));
});

test('C12 only in Chill, after sunset', () => {
  const story = makeHarness(getWorld('w1'));
  story.seconds(370);
  assert.ok(!story.log.found.has('C12'));
  const chill = makeHarness(getWorld('w1'), { mode: 'chill' });
  chill.seconds(370);
  assert.ok(chill.log.found.has('C12'));
  assert.equal(chill.state.flags.fireworks, true);
});

test('G8: tea gives Tea Time; L13 doubles it in London', () => {
  const h = makeHarness(getWorld('w2'));
  h.event({ type: EV.GOBBLE, itemType: 'teamug', x: 0, z: 0 });
  assert.deepEqual(h.log.buffs.at(-1), ['tea', 6]);
  const pru = getWorld('w2').cast.find((c) => c.id === 'pru');
  h.moveTo(pru.x + 1, pru.z); h.seconds(2);
  assert.ok(h.log.found.has('L13'));
  h.event({ type: EV.GOBBLE, itemType: 'teamug', x: 0, z: 0 });
  assert.deepEqual(h.log.buffs.at(-1), ['tea', 12]);
});

test('L3: thirty seconds at the bus stop brings the 127', () => {
  const h = makeHarness(getWorld('w2'));
  const z = getWorld('w2').zones.find((q) => q.id === 'busstop');
  h.moveTo(z.x, z.z); h.seconds(31);
  assert.ok(h.log.found.has('L3'));
  assert.ok(h.log.spawned.some((s) => s.type === 'doubledecker'));
});

test('L5: queue jumpers get tutted at in sync', () => {
  const h = makeHarness(getWorld('w2'));
  const z = getWorld('w2').zones.find((q) => q.id === 'queueFront');
  h.moveTo(z.x, z.z); h.tick(2);
  assert.ok(h.log.found.has('L5'));
  assert.ok(h.state.npcs.filter((n) => /^q\d$/.test(n.id)).every((n) => n.anim === 'tut'));
});

test('L8: brollies are un-gobble-able until it rains (or the shower passes)', () => {
  const h = makeHarness(getWorld('w2'));
  h.tick(16);
  assert.equal(h.state.flags['nogobble:brolly'], true);
  h.state.weather.kind = 'rain';
  h.tick(16);
  assert.equal(h.state.flags['nogobble:brolly'], false);
});

test('T12: lily pads in pitch order', () => {
  const w = getWorld('w3');
  const h = makeHarness(w);
  for (let i = 0; i < 5; i++) {
    const z = w.zones.find((q) => q.id === `lily${i + 1}`);
    h.moveTo(z.x, z.z); h.tick(4);
    h.moveTo(z.x + 20, z.z); h.tick(4);
  }
  assert.ok(h.log.found.has('T12'));
  assert.ok(h.log.spawned.some((s) => s.type === 'lilyflower' && s.golden));
});

test('T3: only the capybara gets piled on', () => {
  const a = makeHarness(getWorld('w3'), { speciesId: 'oli' }); a.seconds(12);
  assert.ok(!a.log.found.has('T3'));
  const b = makeHarness(getWorld('w3'), { speciesId: 'capybara' }); b.seconds(12);
  assert.ok(b.log.found.has('T3'));
});

test('H10: snow angels on fresh snow', () => {
  const h = makeHarness(getWorld('w4'));
  h.state.player.surface = 'snow';
  h.seconds(6);
  assert.ok(h.log.found.has('H10'));
  assert.ok(h.log.emitted.some((e) => e.type === 'snowAngel'));
});

test('M8: barking the HTTPS port opens the firewall', () => {
  assert.deepEqual(barkGroups([0, 0.3, 0.6, 0.9, 2, 2.3, 2.6, 2.9, 4, 4.3, 4.6]), [4, 4, 3]);
  const w = getWorld('w5');
  const h = makeHarness(w);
  h.moveTo(-450, -550);
  const bark = () => { h.event({ type: EV.BARK }); h.seconds(0.3); };
  for (let i = 0; i < 4; i++) bark(); h.seconds(0.8);
  for (let i = 0; i < 4; i++) bark(); h.seconds(0.8);
  for (let i = 0; i < 3; i++) bark(); h.seconds(1.5);
  assert.ok(h.log.found.has('M8'));
  assert.equal(h.state.flags['M8.open'], true);
  const fw = w.hazards.find((q) => q.id === 'firewall');
  assert.equal(fw.openFlag, 'M8.open');
});

test('M10: SYN, SYN-ACK, ACK', () => {
  const w = getWorld('w5');
  const h = makeHarness(w);
  const syn = w.cast.find((c) => c.id === 'synpacket');
  h.moveTo(syn.x + 10, syn.z); h.seconds(0.5);
  assert.ok(h.log.said.some((l) => l.key === 'egg.M10.line1'));
  h.event({ type: EV.PLAY_BOW });
  assert.ok(h.log.found.has('M10'));
  assert.ok(h.log.spawned.some((s) => s.type === 'handshake' && s.golden));
});

test('M3: the 404 door opens when you turn your back', () => {
  const w = getWorld('w5');
  const h = makeHarness(w);
  h.moveTo(310, -330);
  h.state.player.yaw = -Math.PI / 2; // facing -x, away from the door at x 330
  h.seconds(2);
  assert.equal(h.state.flags['M3.open'], true);
  assert.ok(h.log.revealed.includes('M3'));
  h.moveTo(380, -330); h.tick(8);
  assert.ok(h.log.found.has('M3'));
});

test('M12: three kittens', () => {
  const w = getWorld('w5');
  const h = makeHarness(w);
  for (const id of ['kitten1', 'kitten2', 'kitten3']) { const k = w.cast.find((c) => c.id === id); h.moveTo(k.x + 2, k.z); h.tick(16); }
  assert.ok(h.log.found.has('M12'));
});
