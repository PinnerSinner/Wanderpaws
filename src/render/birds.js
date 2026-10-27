// Birds from state.birds (boids, structure-of-arrays): one InstancedMesh with
// a little procedural bird whose wings flap in the vertex shader.

const KINDS = [
  { color: '#9aa3b5', scale: 0.34 },  // 0 pigeon
  { color: '#f4f2ee', scale: 0.55 },  // 1 gull
  { color: '#2b2a33', scale: 0.5 },   // 2 toucan-ish dark
  { color: '#ffb36b', scale: 0.12 },  // 3 butterfly / small
];

function birdGeometry(THREE) {
  // body: a stretched diamond; wings: two flat triangles marked with aWing = +-1
  const P = [], W = [], I = [];
  const v = (x, y, z, w) => { P.push(x, y, z); W.push(w); return P.length / 3 - 1; };
  const nose = v(0, 0.02, 0.5, 0), tail = v(0, 0.03, -0.45, 0), top = v(0, 0.12, 0.05, 0), bot = v(0, -0.08, 0.05, 0);
  const l = v(-0.12, 0.02, 0.05, 0), r = v(0.12, 0.02, 0.05, 0);
  I.push(nose, top, l, nose, r, top, nose, l, bot, nose, bot, r, tail, l, top, tail, top, r, tail, bot, l, tail, r, bot);
  // tail fan
  const t1 = v(-0.12, 0.03, -0.62, 0), t2 = v(0.12, 0.03, -0.62, 0);
  I.push(tail, t2, t1, tail, t1, t2);
  // wings
  const wl0 = v(-0.08, 0.04, 0.16, 0), wl1 = v(-0.08, 0.04, -0.12, 0), wlt = v(-0.62, 0.05, -0.08, -1), wlm = v(-0.36, 0.05, 0.12, -0.6);
  I.push(wl0, wlm, wl1, wl1, wlm, wlt, wl0, wl1, wlm, wl1, wlt, wlm);
  const wr0 = v(0.08, 0.04, 0.16, 0), wr1 = v(0.08, 0.04, -0.12, 0), wrt = v(0.62, 0.05, -0.08, 1), wrm = v(0.36, 0.05, 0.12, 0.6);
  I.push(wr0, wr1, wrm, wr1, wrt, wrm, wr0, wrm, wr1, wr1, wrm, wrt);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('aWing', new THREE.Float32BufferAttribute(W, 1));
  g.setIndex(I);
  g.computeVertexNormals();
  return g;
}

export function createBirds(THREE, { mats, max = 64 }) {
  const geo = birdGeometry(THREE);
  const mesh = new THREE.InstancedMesh(geo, mats.bird(), max);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.count = 0;
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  mesh.name = 'gp-birds';
  const colors = KINDS.map((k) => new THREE.Color(k.color));
  for (let i = 0; i < max; i++) mesh.setColorAt(i, colors[0]);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, 'YXZ');
  const p = new THREE.Vector3(), s = new THREE.Vector3();
  let cap = max;
  const lastKind = new Int8Array(max).fill(-1);

  // b: state.birds. alpha: interpolation, extrapolated back from velocity.
  function sync(b, alpha, scaleMul = 1) {
    const n = b && b.count && b.x ? Math.min(b.count, cap) : 0;
    const back = (1 - (alpha < 0 ? 0 : alpha > 1 ? 1 : alpha)) / 60;
    let colorDirty = false;
    for (let i = 0; i < n; i++) {
      const vx = b.vx ? b.vx[i] : 0, vy = b.vy ? b.vy[i] : 0, vz = b.vz ? b.vz[i] : 0;
      p.set(b.x[i] - vx * back, b.y[i] - vy * back, b.z[i] - vz * back);
      const h = Math.hypot(vx, vz);
      e.set(-Math.atan2(vy, h + 1e-4) * 0.8, Math.atan2(vx, vz), 0);
      q.setFromEuler(e);
      const k = b.kind ? b.kind[i] % KINDS.length : 0;
      const sc = KINDS[k].scale * scaleMul;
      s.set(sc, sc, sc);
      m4.compose(p, q, s);
      mesh.setMatrixAt(i, m4);
      if (lastKind[i] !== k) { mesh.setColorAt(i, colors[k]); lastKind[i] = k; colorDirty = true; }
    }
    mesh.count = n;
    mesh.visible = n > 0;
    if (n) mesh.instanceMatrix.needsUpdate = true;
    if (colorDirty && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  return {
    mesh, sync,
    setCap(c) { cap = Math.min(max, c); },
    dispose() { geo.dispose(); mesh.dispose?.(); },
  };
}
