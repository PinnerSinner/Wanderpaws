// Projectiles from state.projectiles (Marco's tennis ball, snowballs) as one
// instanced mesh, plus small hazard visuals driven by state.hazards (the hose
// spray as pooled droplets). Allocation-free per frame.

import { PK } from './particles.js';
import { createEmitter } from './pure/pool.js';

const LOOK = {
  ball: { color: '#d8f05a', r: 0.034 },
  snowball: { color: '#f6f9ff', r: 0.09 },
};

export function createProjectiles(THREE, { mats, max = 32 }) {
  const geo = new THREE.IcosahedronGeometry(1, 2);
  const mesh = new THREE.InstancedMesh(geo, mats.toon('#ffffff'), max);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.count = 0;
  mesh.castShadow = true;
  mesh.frustumCulled = false;
  mesh.name = 'gp-projectiles';
  const colors = { ball: new THREE.Color(LOOK.ball.color), snowball: new THREE.Color(LOOK.snowball.color), none: new THREE.Color('#ffffff') };
  for (let i = 0; i < max; i++) mesh.setColorAt(i, colors.ball);
  const m4 = new THREE.Matrix4();
  const lastKind = new Int8Array(max).fill(-1);
  const water = new THREE.Color('#d8f2ff');
  const hoseEm = createEmitter();
  let seed = 9;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

  function sync(pr, alpha) {
    const n = pr && pr.count && pr.x ? Math.min(pr.count, max) : 0;
    let m = 0, dirty = false;
    const a = alpha < 0 ? 0 : alpha > 1 ? 1 : alpha;
    for (let i = 0; i < n; i++) {
      const k = pr.kind ? pr.kind[i] : 1;
      const name = pr.kinds ? pr.kinds[k] : (k === 2 ? 'snowball' : 'ball');
      if (!name || name === 'none') continue;
      const look = LOOK[name] || LOOK.ball;
      const x = pr.px ? pr.px[i] + (pr.x[i] - pr.px[i]) * a : pr.x[i];
      const y = pr.py ? pr.py[i] + (pr.y[i] - pr.py[i]) * a : pr.y[i];
      const z = pr.pz ? pr.pz[i] + (pr.z[i] - pr.pz[i]) * a : pr.z[i];
      m4.makeScale(look.r, look.r, look.r).setPosition(x, y + look.r, z);
      mesh.setMatrixAt(m, m4);
      const kc = name === 'snowball' ? 1 : 0;
      if (lastKind[m] !== kc) { mesh.setColorAt(m, colors[name] || colors.ball); lastKind[m] = kc; dirty = true; }
      m++;
    }
    mesh.count = m;
    mesh.visible = m > 0;
    if (m) mesh.instanceMatrix.needsUpdate = true;
    if (dirty && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  // hazards: the garden hose sprays an arc of droplets along its yaw
  function hazards(list, dt, particles, heightAt) {
    if (!list || !list.length || !particles) return;
    for (let i = 0; i < list.length; i++) {
      const h = list[i];
      if (!h || h.kind !== 'hose' || h.active === false) continue;
      const n = hoseEm.take(40, dt);
      const len = h.r || 4;
      const gy = heightAt ? heightAt(h.x, h.z) : 0;
      for (let k = 0; k < n; k++) {
        const yaw = (h.yaw || 0) + (rnd() - 0.5) * 0.18;
        const sp = len * (0.9 + rnd() * 0.3);
        particles.spawn(PK.DROP, h.x, gy + 0.6, h.z, Math.sin(yaw) * sp, 2.6 + rnd(), Math.cos(yaw) * sp,
          0.9, 0.05, 0.03, water.r, water.g, water.b, 0.8, 9.8, 0.4, 0, 0, 0);
      }
    }
  }

  return {
    mesh, sync, hazards,
    dispose() { geo.dispose(); mesh.dispose?.(); },
  };
}
