// A minimal stand-in for buildScenery, used only when the real one throws or
// returns an empty group: a vertex-coloured terrain from heightAt/surfaceAt and
// the water bodies. Keeps the level readable while World-meshes is in progress.

const SURFACE = {
  sand: '#f0d6a6', pavement: '#d9d4cc', grass: '#9fd27e', water: '#c9a77a', snow: '#f6f8ff',
  ice: '#cfe8f6', wood: '#c08a5a', rock: '#a9a3a0', leaves: '#7fb069', data: '#b9a6e8',
};

export function buildFallbackScenery(THREE, mats, world) {
  const group = new THREE.Group();
  group.name = 'fallback-scenery';
  const b = world.bounds || { minX: -60, maxX: 60, minZ: -40, maxZ: 40 };
  const pad = 40;
  const w = b.maxX - b.minX + pad * 2, d = b.maxZ - b.minZ + pad * 2;
  const segX = Math.min(160, Math.max(40, Math.round(w / 1.8))), segZ = Math.min(160, Math.max(40, Math.round(d / 1.8)));
  const g = new THREE.PlaneGeometry(w, d, segX, segZ).rotateX(-Math.PI / 2);
  g.translate((b.minX + b.maxX) / 2, 0, (b.minZ + b.maxZ) / 2);
  const pos = g.getAttribute('position');
  const cols = new Float32Array(pos.count * 3);
  const c = new THREE.Color(), ground = new THREE.Color(world.palette?.ground || '#f2dcae');
  const h = world.heightAt || (() => 0);
  const s = world.surfaceAt || (() => 'sand');
  const cache = {};
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    let y = 0;
    try { y = h(x, z); } catch { y = 0; }
    pos.setY(i, Number.isFinite(y) ? y : 0);
    let sf = 'sand';
    try { sf = s(x, z); } catch { /* keep */ }
    const hex = SURFACE[sf] || null;
    if (hex) { if (!cache[hex]) cache[hex] = new THREE.Color(hex); c.copy(cache[hex]); } else c.copy(ground);
    const n = Math.sin(x * 0.37 + z * 0.11) * Math.sin(z * 0.29 - x * 0.07) * 0.035;
    cols[i * 3] = c.r * (1 + n); cols[i * 3 + 1] = c.g * (1 + n); cols[i * 3 + 2] = c.b * (1 + n);
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  g.computeVertexNormals();
  const terrain = new THREE.Mesh(g, mats.toon('#ffffff', { vertexColors: true, rim: false }));
  terrain.receiveShadow = true;
  terrain.name = 'fallback-terrain';
  group.add(terrain);

  const waters = [];
  for (const wb of world.water || []) {
    const r = wb.rect || { minX: b.minX - pad, maxX: b.maxX + pad, minZ: b.minZ - pad, maxZ: b.maxZ + pad };
    const extra = wb.kind === 'sea' ? 400 : 0;
    const ww = r.maxX - r.minX + extra, wd = r.maxZ - r.minZ + extra;
    const wg = new THREE.PlaneGeometry(ww, wd, Math.min(64, Math.ceil(ww / 4)), Math.min(64, Math.ceil(wd / 4))).rotateX(-Math.PI / 2);
    const pal = world.palette || {};
    const m = new THREE.Mesh(wg, mats.water({ shallow: pal.water, deep: pal.waterDeep, foam: pal.foam }));
    m.position.set((r.minX + r.maxX) / 2, wb.level || 0, (r.minZ + r.maxZ) / 2);
    m.renderOrder = 2;
    m.userData.water = wb;
    group.add(m);
    waters.push(m);
  }

  return {
    group,
    update(dt, state) {
      const t = state ? state.time : 0;
      for (const m of waters) {
        const wb = m.userData.water;
        const tide = wb.tide ? wb.tide.amp * Math.sin((Math.PI * 2 * t) / (wb.tide.period || 60)) : 0;
        m.position.y = (wb.level || 0) + tide;
      }
    },
    dispose() { g.dispose(); for (const m of waters) m.geometry.dispose(); },
  };
}
