// Primitive shapes for the procedural animals. Everything returns an indexed
// BufferGeometry with normals. Chunky and rounded on purpose.

export function makeShapes(THREE) {
  const M = () => new THREE.Matrix4();

  // A sphere with an optional per-vertex deform(v: Vector3, n: unit dir) -> void.
  function blob(r, ws, hs, deform) {
    const g = new THREE.SphereGeometry(r, ws, hs);
    if (deform) {
      const p = g.getAttribute('position');
      const v = new THREE.Vector3(), d = new THREE.Vector3();
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i); d.copy(v).normalize();
        deform(v, d);
        p.setXYZ(i, v.x, v.y, v.z);
      }
      g.computeVertexNormals();
    }
    return g;
  }

  function ellipsoid(rx, ry, rz, ws = 16, hs = 12) {
    const g = new THREE.SphereGeometry(1, ws, hs);
    g.scale(rx, ry, rz);
    g.computeVertexNormals();
    return g;
  }

  // Capsule between two points a and b (arrays) with radii ra, rb (tapered).
  function limb(a, b, ra, rb, radial = 10, rings = 4) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
    const len = A.distanceTo(B);
    const pts = [];
    const capN = 4;
    // lathe profile along +Y from 0 (bottom, radius ra at a) to len (rb at b)
    for (let i = 0; i <= capN; i++) { const t = (i / capN) * Math.PI / 2; pts.push(new THREE.Vector2(Math.sin(t) * ra, ra - Math.cos(t) * ra - ra)); }
    for (let i = 1; i < rings; i++) { const t = i / rings; pts.push(new THREE.Vector2(ra + (rb - ra) * t, len * t)); }
    for (let i = 0; i <= capN; i++) { const t = (i / capN) * Math.PI / 2; pts.push(new THREE.Vector2(Math.cos(t) * rb, len + Math.sin(t) * rb)); }
    pts[0].x = 0.0001; pts[pts.length - 1].x = 0.0001;
    const g = new THREE.LatheGeometry(pts, radial);
    // orient +Y to A->B
    const dir = B.clone().sub(A).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    g.applyMatrix4(M().makeRotationFromQuaternion(q));
    g.translate(A.x, A.y, A.z);
    return mergeLatheSeam(g);
  }

  // Lathe geometry has a duplicated seam column; weld it for smooth normals.
  function mergeLatheSeam(g) {
    g.deleteAttribute('uv');
    const m = weld(g);
    m.computeVertexNormals();
    return m;
  }

  function weld(g, tol = 1e-5) {
    const pos = g.getAttribute('position');
    const map = new Map();
    const remap = new Uint32Array(pos.count);
    const out = [];
    for (let i = 0; i < pos.count; i++) {
      const key = Math.round(pos.getX(i) / tol) + ',' + Math.round(pos.getY(i) / tol) + ',' + Math.round(pos.getZ(i) / tol);
      let j = map.get(key);
      if (j === undefined) { j = out.length / 3; map.set(key, j); out.push(pos.getX(i), pos.getY(i), pos.getZ(i)); }
      remap[i] = j;
    }
    const src = g.index ? g.index.array : Array.from({ length: pos.count }, (_, i) => i);
    const idx = [];
    for (let i = 0; i < src.length; i += 3) {
      const a = remap[src[i]], b = remap[src[i + 1]], c = remap[src[i + 2]];
      if (a !== b && b !== c && a !== c) idx.push(a, b, c);
    }
    const ng = new THREE.BufferGeometry();
    ng.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
    ng.setIndex(idx);
    ng.computeVertexNormals();
    return ng;
  }

  // Loft along Z: slices are superellipses. prof(t) -> { rx, ry, cy, cx?, e? } for t in 0..1
  // mapping z from z0 to z1. Ends are closed with poles.
  function loft(z0, z1, prof, segZ = 16, segR = 18) {
    const verts = [], idx = [];
    const ring = segR;
    const p0 = prof(0), p1 = prof(1);
    verts.push(p0.cx || 0, p0.cy, z0); // pole 0
    for (let i = 1; i < segZ; i++) {
      const t = i / segZ;
      // ease the slice spacing towards the ends for rounder caps
      const tt = 0.5 - 0.5 * Math.cos(t * Math.PI);
      const z = z0 + (z1 - z0) * tt;
      const p = prof(tt);
      const e = p.e || 2;
      for (let j = 0; j < ring; j++) {
        const a = (j / ring) * Math.PI * 2;
        const ca = Math.cos(a), sa = Math.sin(a);
        const sx = Math.sign(ca) * Math.pow(Math.abs(ca), 2 / e), sy = Math.sign(sa) * Math.pow(Math.abs(sa), 2 / e);
        const ry = sa < 0 && p.ryLow ? p.ryLow : p.ry;
        verts.push((p.cx || 0) + sx * p.rx, p.cy + sy * ry, z);
      }
    }
    verts.push(p1.cx || 0, p1.cy, z1); // pole 1
    const last = verts.length / 3 - 1;
    for (let j = 0; j < ring; j++) { const a = 1 + j, b = 1 + ((j + 1) % ring); idx.push(0, b, a); }
    for (let i = 0; i < segZ - 2; i++) {
      for (let j = 0; j < ring; j++) {
        const a = 1 + i * ring + j, b = 1 + i * ring + ((j + 1) % ring);
        const c = a + ring, d = b + ring;
        idx.push(a, b, d, a, d, c);
      }
    }
    const lr = 1 + (segZ - 2) * ring;
    for (let j = 0; j < ring; j++) { const a = lr + j, b = lr + ((j + 1) % ring); idx.push(last, a, b); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  // Tube through points (array of [x,y,z]) with radii, closed rounded ends.
  // Returns geometry plus `u` per vertex (0..1 along the tube) as userData.u.
  function tube(points, radii, radial = 10, capRings = 3) {
    const P = points.map((p) => new THREE.Vector3(...p));
    const n = P.length;
    const tang = [], norm = [], bin = [];
    for (let i = 0; i < n; i++) {
      const t = new THREE.Vector3();
      if (i === 0) t.subVectors(P[1], P[0]); else if (i === n - 1) t.subVectors(P[n - 1], P[n - 2]); else t.subVectors(P[i + 1], P[i - 1]);
      tang.push(t.normalize());
    }
    // parallel transport frames
    let up = Math.abs(tang[0].y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    let nn = new THREE.Vector3().crossVectors(tang[0], up).normalize();
    for (let i = 0; i < n; i++) {
      if (i > 0) {
        const axis = new THREE.Vector3().crossVectors(tang[i - 1], tang[i]);
        const s = axis.length();
        if (s > 1e-6) { axis.normalize(); const ang = Math.asin(Math.min(1, s)); nn.applyAxisAngle(axis, ang); }
      }
      norm.push(nn.clone());
      bin.push(new THREE.Vector3().crossVectors(tang[i], nn).normalize());
    }
    const lens = [0];
    for (let i = 1; i < n; i++) lens.push(lens[i - 1] + P[i].distanceTo(P[i - 1]));
    const total = lens[n - 1] || 1;
    const verts = [], us = [], idx = [];
    const ringAt = (c, T, N, B, r, u) => {
      for (let j = 0; j < radial; j++) {
        const a = (j / radial) * Math.PI * 2;
        const ca = Math.cos(a), sa = Math.sin(a);
        verts.push(c.x + (N.x * ca + B.x * sa) * r, c.y + (N.y * ca + B.y * sa) * r, c.z + (N.z * ca + B.z * sa) * r);
        us.push(u);
      }
    };
    // start cap (pole + rings)
    verts.push(...P[0].clone().addScaledVector(tang[0], -radii[0]).toArray()); us.push(0);
    for (let k = 1; k <= capRings; k++) {
      const a = (k / (capRings + 1)) * Math.PI / 2;
      ringAt(P[0].clone().addScaledVector(tang[0], -Math.cos(a) * radii[0]), tang[0], norm[0], bin[0], Math.sin(a) * radii[0], 0);
    }
    for (let i = 0; i < n; i++) ringAt(P[i], tang[i], norm[i], bin[i], radii[i], lens[i] / total);
    for (let k = capRings; k >= 1; k--) {
      const a = (k / (capRings + 1)) * Math.PI / 2;
      ringAt(P[n - 1].clone().addScaledVector(tang[n - 1], Math.cos(a) * radii[n - 1]), tang[n - 1], norm[n - 1], bin[n - 1], Math.sin(a) * radii[n - 1], 1);
    }
    verts.push(...P[n - 1].clone().addScaledVector(tang[n - 1], radii[n - 1]).toArray()); us.push(1);
    const rings = capRings * 2 + n;
    const last = verts.length / 3 - 1;
    for (let j = 0; j < radial; j++) idx.push(0, 1 + ((j + 1) % radial), 1 + j);
    for (let i = 0; i < rings - 1; i++) for (let j = 0; j < radial; j++) {
      const a = 1 + i * radial + j, b = 1 + i * radial + ((j + 1) % radial), c = a + radial, d = b + radial;
      idx.push(a, b, d, a, d, c);
    }
    const lr = 1 + (rings - 1) * radial;
    for (let j = 0; j < radial; j++) idx.push(last, lr + j, lr + ((j + 1) % radial));
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    g.userData.u = us;
    return g;
  }

  // Flat-ish rounded leaf/ear shape: an ellipsoid squashed in one axis, then bent.
  function leaf(w, h, t, ws = 12, hs = 10) {
    return ellipsoid(w, h, t, ws, hs);
  }

  function cone(rb, h, seg = 12) {
    const g = new THREE.ConeGeometry(rb, h, seg, 1, false);
    g.deleteAttribute('uv');
    return weld(g);
  }

  function torus(r, tube, rs = 8, ts = 20, arc = Math.PI * 2) {
    const g = new THREE.TorusGeometry(r, tube, rs, ts, arc);
    g.deleteAttribute('uv');
    return arc >= Math.PI * 2 - 1e-6 ? weld(g) : g;
  }

  function box(w, h, d, r = 0) {
    if (r <= 0) { const g = new THREE.BoxGeometry(w, h, d); g.deleteAttribute('uv'); return g; }
    // rounded box from a deformed sphere (superellipsoid)
    return superBox(w / 2, h / 2, d / 2, 6, 12, 10);
  }

  function superBox(rx, ry, rz, e = 6, ws = 14, hs = 10) {
    return blob(1, ws, hs, (v, d) => {
      const f = (c) => Math.sign(c) * Math.pow(Math.abs(c), 2 / e);
      v.set(f(d.x) * rx, f(d.y) * ry, f(d.z) * rz);
    });
  }

  function cylinder(rt, rb, h, seg = 12, open = false) {
    const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1, open);
    g.deleteAttribute('uv');
    return weld(g);
  }

  return { blob, ellipsoid, limb, loft, tube, leaf, cone, torus, box, superBox, cylinder, weld, M };
}
