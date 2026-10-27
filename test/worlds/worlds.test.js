// Data validation for every world (CONTRACTS §5).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WORLDS, getWorld } from '../../src/worlds/index.js';
import { CATALOGUE, itemsForWorld } from '../../src/worlds/catalogue.js';
import { SCENERY, HUMANS, CRITTERS, NPC_ANIMS } from '../../src/worlds/ids.js';
import { expandItems, insideAnyCollider, countNear, isWet } from '../../src/worlds/layout.js';
import { hasCopy } from '../../src/core/copy/index.js';
import { estimatePacing } from './pacing.js';

const SURFACES = ['sand', 'pavement', 'grass', 'water', 'snow', 'ice', 'wood', 'rock', 'leaves', 'data'];
const HAZARDS = ['tide', 'cyclist', 'pigeons', 'puddle', 'hose', 'jogger', 'slipperyRock', 'toucan', 'marmoset', 'thinIce', 'snowballKids', 'highlandCow', 'firewall', 'lagZone', 'packetLoss'];
const BEHAVIOURS = ['idle', 'wander', 'pathLoop', 'vendor', 'react', 'gerald', 'marco', 'marcoJog', ...NPC_ANIMS];
const WEATHER = ['clear', 'rain', 'fog', 'parade', 'aurora', 'datastorm', 'snow'];
const STAR3 = ['noHazards', 'collectAll', 'golden', 'combo', 'par'];
const ACTIVITIES = ['fetch', 'herding', 'sniffTrail', 'sitStay'];
const PALETTE = ['skyTop', 'skyBottom', 'horizon', 'fog', 'fogNear', 'fogFar', 'sun', 'sunIntensity', 'ambient', 'ground', 'accent', 'water', 'waterDeep', 'foam', 'outline'];

test('five worlds in order, getWorld finds each', () => {
  assert.deepEqual(WORLDS.map((w) => w.id), ['w1', 'w2', 'w3', 'w4', 'w5']);
  WORLDS.forEach((w, i) => { assert.equal(w.index, i + 1); assert.equal(getWorld(w.id), w); });
  assert.equal(getWorld('nope'), WORLDS[0]);
});

for (const w of WORLDS) {
  test(`${w.id}: required fields`, () => {
    for (const k of ['id', 'index', 'nameKey', 'introKey', 'outroKey', 'music', 'ambience', 'palette', 'timeOfDay', 'bounds', 'spawn', 'heightAt', 'surfaceAt', 'water', 'colliders', 'scenery', 'items', 'zones', 'hazards', 'cast', 'crowd', 'flocks', 'activities', 'eggs', 'goals', 'weather', 'golden']) {
      assert.ok(w[k] !== undefined, `${w.id} missing ${k}`);
    }
    for (const k of PALETTE) assert.ok(w.palette[k] !== undefined, `${w.id} palette.${k}`);
    assert.ok(w.timeOfDay.start < w.timeOfDay.end);
    assert.ok(w.bounds.minX < w.bounds.maxX && w.bounds.minZ < w.bounds.maxZ);
    assert.ok(Array.isArray(w.items.anchors) && Array.isArray(w.items.fill));
    for (const wt of w.weather) assert.ok(WEATHER.includes(wt), `${w.id} weather ${wt}`);
  });

  test(`${w.id}: heightAt and surfaceAt are finite and valid over the bounds`, () => {
    const b = w.bounds;
    const N = 60;
    for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
      const x = b.minX + (b.maxX - b.minX) * i / N, z = b.minZ + (b.maxZ - b.minZ) * j / N;
      const h = w.heightAt(x, z);
      assert.ok(Number.isFinite(h), `${w.id} heightAt(${x}, ${z}) = ${h}`);
      assert.ok(SURFACES.includes(w.surfaceAt(x, z)), `${w.id} surfaceAt(${x}, ${z}) = ${w.surfaceAt(x, z)}`);
    }
    assert.equal(w.heightAt(12.3, -4.5), w.heightAt(12.3, -4.5));
  });

  test(`${w.id}: spawn on dry land, in bounds, clear of colliders`, () => {
    const { x, z } = w.spawn;
    const b = w.bounds;
    assert.ok(x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ);
    assert.equal(insideAnyCollider(w, x, z, w.goals.start), null);
    assert.ok(!isWet(w, x, z), 'spawn is in water');
    assert.ok(Number.isFinite(w.spawn.yaw));
  });

  test(`${w.id}: items exist in the catalogue and belong to the world`, () => {
    const allowed = new Set(itemsForWorld(w.id).map((i) => i.id));
    for (const a of w.items.anchors) {
      assert.ok(CATALOGUE[a.type], `${w.id} anchor type ${a.type}`);
      assert.ok(allowed.has(a.type), `${w.id} uses ${a.type} which isn't listed for it`);
      assert.ok(Number.isFinite(a.x) && Number.isFinite(a.z));
      assert.equal(insideAnyCollider(w, a.x, a.z, 0, 1.5), null, `${w.id} ${a.type} anchor inside a tall collider at ${a.x}, ${a.z}`);
    }
    for (const f of w.items.fill) for (const t of f.types) {
      assert.ok(CATALOGUE[t], `${w.id} fill type ${t}`);
      assert.ok(allowed.has(t), `${w.id} fill uses ${t}`);
    }
    assert.ok(CATALOGUE[w.golden.type], 'golden type');
    assert.ok(w.eggs.some((e) => e.id === w.golden.eggId), 'golden egg exists');
  });

  test(`${w.id}: item count is curated (about 400 to 700)`, () => {
    const n = expandItems(w, 1).length;
    assert.ok(n >= 400 && n <= 720, `${w.id} has ${n} items`);
  });

  test(`${w.id}: enough starter fodder near spawn`, () => {
    const list = expandItems(w, 1);
    const n = countNear(list, CATALOGUE, w.spawn.x, w.spawn.z, 15, w.goals.start * 0.6);
    assert.ok(n >= 25, `${w.id} only ${n} gobble-able items within 15 m of spawn`);
  });

  test(`${w.id}: scenery meshes, cast and crowd kinds all exist`, () => {
    for (const s of w.scenery) {
      assert.ok(SCENERY[s.mesh], `${w.id} scenery ${s.mesh}`);
      assert.ok(Number.isFinite(s.x) && Number.isFinite(s.z));
      assert.ok(typeof s.scale === 'number' || (Array.isArray(s.scale) && s.scale.length === 3));
      if (s.params && s.params.textKey) assert.ok(hasCopy(s.params.textKey, 'en-GB'), `copy ${s.params.textKey}`);
    }
    const ids = new Set();
    for (const c of w.cast) {
      assert.ok(c.kind === 'human' ? HUMANS.includes(c.mesh) : CRITTERS.includes(c.mesh), `${w.id} cast ${c.id} mesh ${c.mesh}`);
      assert.ok(c.id && c.speaker, `${w.id} cast needs id and speaker`);
      assert.ok(BEHAVIOURS.includes(c.behaviour), `${w.id} behaviour ${c.behaviour}`);
      assert.ok(!ids.has(c.id)); ids.add(c.id);
    }
    for (const c of w.crowd) {
      assert.ok(HUMANS.includes(c.kind) || CRITTERS.includes(c.kind), `${w.id} crowd kind ${c.kind}`);
      assert.ok(BEHAVIOURS.includes(c.behaviour), `${w.id} behaviour ${c.behaviour}`);
      if (c.id) { assert.ok(!ids.has(c.id), `dup id ${c.id}`); ids.add(c.id); }
    }
    for (const f of w.flocks) assert.ok(['pigeon', 'gull'].includes(f.kind));
    assert.ok(w.flocks.reduce((a, f) => a + f.count, 0) <= 64);
  });

  test(`${w.id}: cast per SPEC §5`, () => {
    const ids = w.cast.map((c) => c.id);
    for (const id of ['gerald', 'marco', 'pru']) assert.ok(ids.includes(id), `${w.id} is missing ${id}`);
    if (w.id === 'w1') { assert.ok(ids.includes('kev')); assert.ok(ids.includes('ze')); }
    if (w.id === 'w3') assert.ok(ids.includes('ze'));
    if (w.id === 'w5') assert.ok(ids.includes('packet'));
    const disguises = w.cast.find((c) => c.id === 'gerald').params.disguise;
    assert.ok(disguises, 'Gerald needs a disguise (G9)');
  });

  test(`${w.id}: hazards, activities and zones are well formed`, () => {
    for (const h of w.hazards) {
      assert.ok(HAZARDS.includes(h.kind), `${w.id} hazard ${h.kind}`);
      if (h.kind !== 'tide') assert.ok(h.path || (Number.isFinite(h.x) && Number.isFinite(h.z)), `${w.id} ${h.kind} needs a place`);
    }
    if (w.hazards.some((h) => h.kind === 'tide')) assert.ok(w.water.some((q) => q.tide), 'tide needs a tidal sea');
    for (const a of w.activities) assert.ok(ACTIVITIES.includes(a.kind));
    assert.deepEqual([...new Set(w.activities.map((a) => a.kind))].sort(), [...ACTIVITIES].sort());
    const zid = new Set();
    for (const z of w.zones) { assert.ok(!zid.has(z.id), `dup zone ${z.id}`); zid.add(z.id); assert.ok(z.r > 0); }
    for (const q of w.water) {
      assert.ok(['sea', 'pond', 'river', 'loch'].includes(q.kind));
      assert.ok(q.rect && q.rect.minX < q.rect.maxX && q.rect.minZ < q.rect.maxZ, 'water bodies need a rect');
    }
    for (const c of w.colliders) {
      assert.ok(c.kind === 'box' || c.kind === 'cyl');
      assert.ok(c.h > 0);
      if (c.kind === 'box') assert.ok(c.w > 0 && c.d > 0 && Number.isFinite(c.rot));
      else assert.ok(c.r > 0);
      if (c.pass) assert.ok(['squeeze', 'under'].includes(c.pass));
    }
  });

  test(`${w.id}: goals per SPEC §4.3`, () => {
    const g = w.goals;
    assert.ok(g.start < g.goal && g.goal < g.stretch, 'start < goal < stretch');
    assert.ok(Math.abs(g.stretch / g.goal - 1.5) < 0.01, 'stretch is 1.5x goal');
    assert.ok(g.timer >= 240 && g.timer <= 360, 'timer 4 to 6 minutes');
    assert.ok(g.par > 0 && g.par <= g.timer);
    assert.ok(g.growthK > 0);
    assert.ok(g.milestones.length >= 4 && g.milestones.length <= 6);
    for (let i = 1; i < g.milestones.length; i++) assert.ok(g.milestones[i] > g.milestones[i - 1]);
    assert.ok(g.milestones[0] > g.start);
    assert.ok(STAR3.includes(g.star3.kind));
  });

  test(`${w.id}: the item ladder lets a greedy bot reach the stretch size in time`, () => {
    const r = estimatePacing(w);
    assert.ok(r.goalT != null && r.goalT < w.goals.timer * 0.7, `${w.id} goal at ${r.goalT}`);
    assert.ok(r.stretchT != null && r.stretchT < w.goals.timer * 0.8, `${w.id} stretch at ${r.stretchT}`);
  });
}

test('size-gated secrets: each world has a gap for small animals and a step for big ones', () => {
  for (const w of WORLDS) {
    const hasLow = w.colliders.some((c) => c.h > w.goals.start * 0.45 && c.h < w.goals.stretch * 0.45 && c.h >= 1);
    assert.ok(hasLow, `${w.id} needs a wall the big ones can step over`);
  }
});

test('third-star specifics', () => {
  assert.equal(getWorld('w1').goals.star3.kind, 'noHazards');
  const w2 = getWorld('w2');
  assert.equal(w2.goals.star3.kind, 'collectAll');
  assert.equal(w2.items.anchors.filter((a) => a.type === 'teamug').length, 12);
  assert.ok(w2.items.fill.every((f) => !f.types.includes('teamug')));
  assert.equal(getWorld('w3').goals.star3.kind, 'golden');
  assert.ok(getWorld('w3').items.anchors.some((a) => a.type === 'mango' && a.golden));
  assert.deepEqual(getWorld('w4').goals.star3, { kind: 'combo', count: 30 });
  assert.equal(getWorld('w5').goals.star3.kind, 'par');
});

test('every world hides a golden rubber duck (or the debugging duck in W5)', () => {
  for (const w of WORLDS) {
    const t = w.id === 'w5' ? 'debugduck' : 'rubberduck';
    assert.ok(w.items.anchors.some((a) => a.type === t && a.golden), `${w.id} golden duck`);
  }
});

test('W5 is huge', () => {
  const b = getWorld('w5').bounds;
  assert.ok(b.maxX - b.minX >= 2000 && b.maxZ - b.minZ >= 2000);
});
