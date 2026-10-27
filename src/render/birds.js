// Birds from state.birds (boids, structure-of-arrays): one InstancedMesh with
// a little procedural bird whose wings flap in the vertex shader.

const KINDS = [
  { color: '#9aa0b8', scale: 0.45 },  // 0 pigeon (geometry is about 0.4 m long at scale 1)
  { color: '#f4f2ee', scale: 0.72 },  // 1 gull
  { color: '#2b2a33', scale: 0.6 },   // 2 toucan-ish dark
  { color: '#ffb36b', scale: 0.14 },  // 3 butterfly / small
];

function birdGeometry(THREE) {
  // a chubby body (squashed sphere), a little head and beak, and two wings whose
  // vertices carry aWing (signed span weight) for the flap in the vertex shader
  const body = new THREE.SphereGeometry(0.2, 10, 7);
  body.scale(0.8, 0.75, 1.35);
  const head = new THREE.SphereGeometry(0.11, 8, 6); head.translate(0, 0.13, 0.27);
  const beak = new THREE.ConeGeometry(0.035, 0.1, 5); beak.rotateX(Math.PI / 2); beak.translate(0, 0.12, 0.4);
  const tail = new THREE.ConeGeometry(0.09, 0.2, 4); tail.scale(1.4, 0.3, 1); tail.rotateX(-Math.PI / 2); tail.translate(0, 0.02, -0.33);
  const parts = [body, head, beak, tail];
  const P = [], N = [], W = [], I = [];
  let base = 0;
  for (const g of parts) {
    const ng = g.toNonIndexed(); ng.computeVertexNormals();
    const pa = ng.getAttribute('position'), na = ng.getAttribute('normal');
    for (let k = 0; k < pa.count; k++) { P.push(pa.getX(k), pa.getY(k), pa.getZ(k)); N.push(na.getX(k), na.getY(k), na.getZ(k)); W.push(0); I.push(base + k); }
    base += pa.count;
    g.dispose(); ng.dispose();
  }
  // wings: a rounded quad strip each side, both faces
  const wing = (sgn) => {
    const pts = [[0.1, 0.12], [0.1, -0.1], [0.33, 0.1], [0.36, -0.1], [0.55, 0.02], [0.52, -0.1]];
    const idx = [[0, 1, 2], [1, 3, 2], [2, 3, 4], [3, 5, 4]];
    for (const [a, b, c] of idx) {
      for (const tri of [[a, b, c], [a, c, b]]) {
        for (const v of tri) {
          const [x, z] = pts[v];
          P.push(sgn * x, 0.06, z); N.push(0, tri[1] === b ? 1 : -1, 0); W.push(sgn * Math.min(1, (x - 0.1) / 0.45)); I.push(base++);
        }
      }
    }
  };
  wing(1); wing(-1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('aWing', new THREE.Float32BufferAttribute(W, 1));
  g.setIndex(I);
  return g;
}

export function createBirds(THREE, { mats, max = 64 }) {
  const geo = birdGeometry(THREE);
  const flapArr = new Float32Array(max).fill(1);
  const flap = new THREE.InstancedBufferAttribute(flapArr, 1);
  flap.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aFlap', flap);
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
      const sp = Math.hypot(h, vy);
      // walking or perched birds fold their wings
      const target = sp > 1.2 ? 1 : 0;
      flapArr[i] += (target - flapArr[i]) * 0.15;
      e.set(-Math.atan2(vy, h + 1e-4) * 0.8 * flapArr[i], h > 0.05 ? Math.atan2(vx, vz) : e.y, 0);
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
    if (n) { mesh.instanceMatrix.needsUpdate = true; flap.needsUpdate = true; }
    if (colorDirty && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  return {
    mesh, sync,
    setCap(c) { cap = Math.min(max, c); },
    dispose() { geo.dispose(); mesh.dispose?.(); },
  };
}
