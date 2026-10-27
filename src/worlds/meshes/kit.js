// Geometry kit for World-meshes: accumulate coloured primitives into a handful of
// merged BufferGeometries (one per material layer), so each item or prop costs
// one to three draw calls. Everything here is build-time only, never per frame.
//
// Usage:
//   const b = createBuilder(THREE);
//   b.box(0.4, 0.2, 0.3, '#ff7a59', { y: 0.1, r: 0.03 });
//   b.cyl(0.05, 0.05, 0.4, '#fff', { x: 0.2, y: 0.2, seg: 8 });
//   const group = b.toGroup(mats);
//
// Common options on every primitive:
//   x, y, z        translation (primitive centre)
//   rx, ry, rz     Euler rotation (XYZ), radians
//   s, sx, sy, sz  scale
//   layer          'main' (vertex-colour toon, default) | 'glow' (emissive, optional blink)
//                  | 'sway' (foliage) | 'trans' (translucent) | 'tex:<key>' (textured)
//   cf(lx,ly,lz,wx,wy,wz,nx,ny,nz) -> colour, per-vertex colour function (local + built coords)
//   blink: [rateHz, phase] for glow parts (0 rate = steady)
//   m              a THREE.Matrix4 applied after the TRS above

const _cache = new WeakMap();

export function kitFor(THREE) {
  let k = _cache.get(THREE);
  if (!k) { k = makeKit(THREE); _cache.set(THREE, k); }
  return k;
}

export function createBuilder(THREE) { return new (kitFor(THREE).Builder)(); }

function makeKit(THREE) {
  const tmpC = new THREE.Color();
  const tmpV = new THREE.Vector3();
  const tmpN = new THREE.Vector3();
  const tmpM = new THREE.Matrix4();
  const tmpNM = new THREE.Matrix3();
  const tmpE = new THREE.Euler();
  const tmpQ = new THREE.Quaternion();
  const tmpS = new THREE.Vector3();
  const tmpP = new THREE.Vector3();
  const colourCache = new Map();

  function rgb(c) {
    if (Array.isArray(c)) return c;
    if (c && c.isColor) return [c.r, c.g, c.b];
    let v = colourCache.get(c);
    if (!v) { tmpC.set(c); v = [tmpC.r, tmpC.g, tmpC.b]; colourCache.set(c, v); }
    return v;
  }

  function matrixFrom(o) {
    tmpE.set(o.rx || 0, o.ry || 0, o.rz || 0, o.order || 'XYZ');
    tmpQ.setFromEuler(tmpE);
    const s = o.s ?? 1;
    tmpS.set((o.sx ?? 1) * s, (o.sy ?? 1) * s, (o.sz ?? 1) * s);
    tmpP.set(o.x || 0, o.y || 0, o.z || 0);
    tmpM.compose(tmpP, tmpQ, tmpS);
    if (o.m) tmpM.premultiply(o.m);
    return tmpM;
  }

  // A rounded box: per-face grids with extra rows near the edges, pushed out
  // onto a radius r around an inner box. k = arc steps per 45 degrees.
  function roundedBox(w, h, d, r, k = 1) {
    r = Math.max(0, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4));
    if (r <= 1e-4) return new THREE.BoxGeometry(w, h, d);
    const hx = w / 2, hy = h / 2, hz = d / 2;
    const axisCoords = (half) => {
      const inner = half - r;
      const c = [-half];
      for (let i = k - 1; i >= 1; i--) c.push(-inner - r * Math.tan((i / k) * Math.PI / 4) / 1.0001);
      c.push(-inner);
      if (inner > 1e-4) c.push(inner); // flat middle
      for (let i = 1; i <= k - 1; i++) c.push(inner + r * Math.tan((i / k) * Math.PI / 4) / 1.0001);
      c.push(half);
      return c;
    };
    const cx = axisCoords(hx), cy = axisCoords(hy), cz = axisCoords(hz);
    const pos = [], nor = [], idx = [];
    // face: fixed axis a with sign, varying u, v axes
    const face = (a, sign, ua, va, uc, vc) => {
      const base = pos.length / 3;
      for (let j = 0; j < vc.length; j++) {
        for (let i = 0; i < uc.length; i++) {
          const p = [0, 0, 0];
          p[a] = sign * [hx, hy, hz][a];
          p[ua] = uc[i]; p[va] = vc[j];
          pos.push(p[0], p[1], p[2]);
        }
      }
      const nu = uc.length;
      for (let j = 0; j < vc.length - 1; j++) {
        for (let i = 0; i < nu - 1; i++) {
          const q = base + j * nu + i;
          // winding so normals point outward
          if (sign > 0) idx.push(q, q + 1, q + nu + 1, q, q + nu + 1, q + nu);
          else idx.push(q, q + nu + 1, q + 1, q, q + nu, q + nu + 1);
        }
      }
    };
    face(0, 1, 1, 2, cy, cz); // +x : u=y, v=z
    face(0, -1, 1, 2, cy, cz);
    face(1, 1, 2, 0, cz, cx); // +y : u=z, v=x
    face(1, -1, 2, 0, cz, cx);
    face(2, 1, 0, 1, cx, cy); // +z : u=x, v=y
    face(2, -1, 0, 1, cx, cy);
    const ix = hx - r, iy = hy - r, iz = hz - r;
    for (let i = 0; i < pos.length; i += 3) {
      const px = pos[i], py = pos[i + 1], pz = pos[i + 2];
      const qx = Math.max(-ix, Math.min(ix, px));
      const qy = Math.max(-iy, Math.min(iy, py));
      const qz = Math.max(-iz, Math.min(iz, pz));
      let nx = px - qx, ny = py - qy, nz = pz - qz;
      const l = Math.hypot(nx, ny, nz) || 1;
      nx /= l; ny /= l; nz /= l;
      pos[i] = qx + nx * r; pos[i + 1] = qy + ny * r; pos[i + 2] = qz + nz * r;
      nor.push(nx, ny, nz);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setIndex(idx);
    return g;
  }

  class Layer {
    constructor(name) {
      this.name = name;
      this.pos = []; this.nor = []; this.col = []; this.uv = []; this.blink = []; this.idx = [];
      this.extra = null; // { name, size, data[] } for custom attributes
      this.map = null; this.opts = null;
    }
    get count() { return this.pos.length / 3; }
  }

  class Builder {
    constructor() { this.layers = new Map(); this.defaults = {}; }
    layer(name) {
      let l = this.layers.get(name);
      if (!l) { l = new Layer(name); this.layers.set(name, l); }
      return l;
    }
    // Set defaults merged into every subsequent primitive's options (e.g. a parent transform)
    push(o) { const prev = this.defaults; this.defaults = { ...prev, ...o }; return prev; }
    pop(prev) { this.defaults = prev; }

    add(geo, color, o = {}) {
      if (this.defaults.m && o.m) {
        o = { ...o, m: o.m.clone().premultiply(this.defaults.m) };
      } else if (this.defaults.m) o = { ...o, m: this.defaults.m };
      if (this.defaults.layer && !o.layer) o = { ...o, layer: this.defaults.layer };
      const L = this.layer(o.layer || 'main');
      if (o.map) L.map = o.map;
      if (o.layerOpts) L.opts = o.layerOpts;
      if (o.df) {
        // deform in local space, then recompute normals (unless told not to)
        const PP = geo.attributes.position;
        for (let i = 0; i < PP.count; i++) {
          tmpV.fromBufferAttribute(PP, i);
          o.df(tmpV, i);
          PP.setXYZ(i, tmpV.x, tmpV.y, tmpV.z);
        }
        if (o.dfNormals !== false) geo.computeVertexNormals();
      }
      if (o.fc && o.cf && geo.index) { const g2 = geo.toNonIndexed(); geo.dispose(); geo = g2; }
      const m = matrixFrom(o);
      tmpNM.getNormalMatrix(m);
      const P = geo.attributes.position, N = geo.attributes.normal, U = geo.attributes.uv;
      if (!N) geo.computeVertexNormals();
      const NN = geo.attributes.normal;
      const base = L.count;
      const c0 = o.cf ? null : rgb(color);
      const bl = o.blink || [0, 0];
      const flip = m.determinant() < 0;
      const start = L.pos.length;
      for (let i = 0; i < P.count; i++) {
        tmpV.fromBufferAttribute(P, i);
        const lx = tmpV.x, ly = tmpV.y, lz = tmpV.z;
        tmpV.applyMatrix4(m);
        tmpN.fromBufferAttribute(NN, i).applyMatrix3(tmpNM).normalize();
        L.pos.push(tmpV.x, tmpV.y, tmpV.z);
        L.nor.push(tmpN.x, tmpN.y, tmpN.z);
        if (!o.fc) {
          const c = c0 || rgb(o.cf(lx, ly, lz, tmpV.x, tmpV.y, tmpV.z, tmpN.x, tmpN.y, tmpN.z));
          L.col.push(c[0], c[1], c[2]);
        }
        if (U) L.uv.push(U.getX(i), U.getY(i)); else L.uv.push(0, 0);
        L.blink.push(bl[0], bl[1]);
      }
      if (o.fc) {
        // flat colour per triangle, sampled at the centroid (crisp stripes and patches)
        for (let i = 0; i < P.count; i += 3) {
          let lx = 0, ly = 0, lz = 0, wx = 0, wy = 0, wz = 0, nx = 0, ny = 0, nz = 0;
          for (let k = 0; k < 3; k++) {
            lx += P.getX(i + k); ly += P.getY(i + k); lz += P.getZ(i + k);
            const q = start + (i + k) * 3;
            wx += L.pos[q]; wy += L.pos[q + 1]; wz += L.pos[q + 2];
            nx += L.nor[q]; ny += L.nor[q + 1]; nz += L.nor[q + 2];
          }
          const c = o.cf ? rgb(o.cf(lx / 3, ly / 3, lz / 3, wx / 3, wy / 3, wz / 3, nx / 3, ny / 3, nz / 3)) : c0;
          for (let k = 0; k < 3; k++) L.col.push(c[0], c[1], c[2]);
        }
      }
      if (geo.index) {
        const I = geo.index.array;
        if (flip) for (let i = 0; i < I.length; i += 3) L.idx.push(base + I[i], base + I[i + 2], base + I[i + 1]);
        else for (let i = 0; i < I.length; i++) L.idx.push(base + I[i]);
      } else {
        for (let i = 0; i < P.count; i += 3) {
          if (flip) L.idx.push(base + i, base + i + 2, base + i + 1);
          else L.idx.push(base + i, base + i + 1, base + i + 2);
        }
      }
      geo.dispose();
      return this;
    }

    // ---------- primitives (all centred on their origin unless noted) ----------
    box(w, h, d, col, o = {}) {
      const g = o.r ? roundedBox(w, h, d, o.r, o.rk || 1) : new THREE.BoxGeometry(w, h, d);
      return this.add(g, col, o);
    }
    cyl(rt, rb, h, col, o = {}) {
      return this.add(new THREE.CylinderGeometry(rt, rb, h, o.seg || 12, o.hs || 1, !!o.open, o.ts || 0, o.tl ?? Math.PI * 2), col, o);
    }
    cone(r, h, col, o = {}) { return this.cyl(0, r, h, col, o); }
    ball(r, col, o = {}) {
      const seg = o.seg || 12;
      return this.add(new THREE.SphereGeometry(r, seg, o.hseg || Math.max(4, Math.round(seg * 0.66)), 0, Math.PI * 2, o.t0 || 0, o.tl ?? Math.PI), col, o);
    }
    dome(r, col, o = {}) { return this.ball(r, col, { ...o, tl: o.tl ?? Math.PI / 2 }); }
    torus(R, r, col, o = {}) {
      return this.add(new THREE.TorusGeometry(R, r, o.rs || 6, o.ts || 16, o.arc ?? Math.PI * 2), col, o);
    }
    capsule(r, len, col, o = {}) {
      return this.add(new THREE.CapsuleGeometry(r, len, o.cs || 3, o.seg || 10), col, o);
    }
    lathe(pts, col, o = {}) {
      const v = pts.map((p) => new THREE.Vector2(p[0], p[1]));
      return this.add(new THREE.LatheGeometry(v, o.seg || 14, o.p0 || 0, o.pl ?? Math.PI * 2), col, o);
    }
    // 2D outline [[x,y],...] in the XY plane extruded along Z by depth, centred on z
    extrude(pts, depth, col, o = {}) {
      const sh = new THREE.Shape(pts.map((p) => new THREE.Vector2(p[0], p[1])));
      if (o.holes) for (const h of o.holes) sh.holes.push(new THREE.Path(h.map((p) => new THREE.Vector2(p[0], p[1]))));
      const g = new THREE.ExtrudeGeometry(sh, {
        depth, bevelEnabled: !!o.bevel, bevelSize: o.bevel || 0, bevelThickness: o.bevel || 0,
        bevelSegments: o.bs || 1, curveSegments: o.curve || 6, steps: 1,
      });
      g.translate(0, 0, -depth / 2);
      return this.add(g, col, o);
    }
    tube(pts, radius, col, o = {}) {
      const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p[0], p[1], p[2])), !!o.closed, 'catmullrom', o.tension ?? 0.5);
      return this.add(new THREE.TubeGeometry(curve, o.ts || Math.max(6, pts.length * 4), radius, o.rs || 6, !!o.closed), col, o);
    }
    // flat quad facing +Y (w along x, d along z); use rx to stand it up
    plane(w, d, col, o = {}) {
      const g = new THREE.PlaneGeometry(w, d, o.ws || 1, o.ds || 1);
      g.rotateX(-Math.PI / 2);
      return this.add(g, col, o);
    }
    // vertical quad facing +Z
    quad(w, h, col, o = {}) { return this.add(new THREE.PlaneGeometry(w, h, o.ws || 1, o.hs || 1), col, o); }
    circle(r, col, o = {}) {
      const g = new THREE.CircleGeometry(r, o.seg || 16); g.rotateX(-Math.PI / 2);
      return this.add(g, col, o);
    }
    ico(r, col, o = {}) { return this.add(new THREE.IcosahedronGeometry(r, o.detail || 0), col, o); }
    dodeca(r, col, o = {}) { return this.add(new THREE.DodecahedronGeometry(r, o.detail || 0), col, o); }
    octa(r, col, o = {}) { return this.add(new THREE.OctahedronGeometry(r, o.detail || 0), col, o); }
    geo(g, col, o = {}) { return this.add(g, col, o); }

    // A segment between two points (cylinder), handy for rails, legs and spokes
    rod(a, b, r, col, o = {}) {
      const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
      const len = Math.hypot(dx, dy, dz);
      const g = new THREE.CylinderGeometry(o.r2 ?? r, r, len, o.seg || 6, 1, !!o.open);
      g.translate(0, len / 2, 0);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx / len, dy / len, dz / len));
      const m = new THREE.Matrix4().compose(new THREE.Vector3(a[0], a[1], a[2]), q, new THREE.Vector3(1, 1, 1));
      if (o.m) m.premultiply(o.m);
      return this.add(g, col, { ...o, x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, m });
    }

    // ---------- whole-builder operations ----------
    triangles() { let n = 0; for (const L of this.layers.values()) n += L.idx.length / 3; return n; }

    bounds() {
      const b = { minX: Infinity, minY: Infinity, minZ: Infinity, maxX: -Infinity, maxY: -Infinity, maxZ: -Infinity };
      for (const L of this.layers.values()) {
        const p = L.pos;
        for (let i = 0; i < p.length; i += 3) {
          if (p[i] < b.minX) b.minX = p[i]; if (p[i] > b.maxX) b.maxX = p[i];
          if (p[i + 1] < b.minY) b.minY = p[i + 1]; if (p[i + 1] > b.maxY) b.maxY = p[i + 1];
          if (p[i + 2] < b.minZ) b.minZ = p[i + 2]; if (p[i + 2] > b.maxZ) b.maxZ = p[i + 2];
        }
      }
      return b;
    }

    // Affine remap of every vertex: p' = (p + t) * s  (per axis). Normals renormalised.
    transform(tx, ty, tz, sx, sy, sz) {
      for (const L of this.layers.values()) {
        const p = L.pos, n = L.nor;
        for (let i = 0; i < p.length; i += 3) {
          p[i] = (p[i] + tx) * sx; p[i + 1] = (p[i + 1] + ty) * sy; p[i + 2] = (p[i + 2] + tz) * sz;
          let nx = n[i] / sx, ny = n[i + 1] / sy, nz = n[i + 2] / sz;
          const l = Math.hypot(nx, ny, nz) || 1;
          n[i] = nx / l; n[i + 1] = ny / l; n[i + 2] = nz / l;
        }
      }
      return this;
    }

    // Storybook contact shading: darken vertices near the ground a touch.
    ao(height, amount = 0.2, band = 0.25) {
      const h = Math.max(1e-6, height * band);
      for (const L of this.layers.values()) {
        if (L.name !== 'main' && L.name !== 'sway') continue;
        for (let i = 0; i < L.col.length; i += 3) {
          const y = L.pos[i + 1];
          const t = Math.min(1, Math.max(0, y / h));
          const f = 1 - amount * (1 - t * t * (3 - 2 * t));
          L.col[i] *= f; L.col[i + 1] *= f; L.col[i + 2] *= f;
        }
      }
      return this;
    }

    // Build plain BufferGeometries per layer.
    geometries() {
      const out = {};
      for (const [name, L] of this.layers) {
        if (!L.idx.length) continue;
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(L.pos, 3));
        g.setAttribute('normal', new THREE.Float32BufferAttribute(L.nor, 3));
        g.setAttribute('color', new THREE.Float32BufferAttribute(L.col, 3));
        if (name.startsWith('tex:') || name === 'water' || L.wantUv) g.setAttribute('uv', new THREE.Float32BufferAttribute(L.uv, 2));
        if (name === 'glow') g.setAttribute('blink', new THREE.Float32BufferAttribute(L.blink, 2));
        g.setIndex(L.count > 65535 ? new THREE.Uint32BufferAttribute(L.idx, 1) : new THREE.Uint16BufferAttribute(L.idx, 1));
        g.computeBoundingBox(); g.computeBoundingSphere();
        out[name] = { geometry: g, map: L.map, opts: L.opts };
      }
      return out;
    }

    toGroup(mats, matFor) {
      const group = new THREE.Group();
      const geos = this.geometries();
      for (const name of Object.keys(geos)) {
        const { geometry, map, opts } = geos[name];
        const mat = (matFor && matFor(name, map, opts)) || layerMaterial(THREE, mats, name, map, opts);
        const mesh = new THREE.Mesh(geometry, mat);
        mesh.name = name;
        mesh.castShadow = name !== 'glow' && name !== 'trans';
        mesh.receiveShadow = name === 'main' || name.startsWith('tex:');
        group.add(mesh);
      }
      return group;
    }
  }

  return { Builder, roundedBox, rgb };
}

// ---------------------------------------------------------------------------
// Materials per layer. The toon and sway materials come from the render
// materials factory (cached there). The blink material is ours: unlit vertex
// colours modulated by a per-vertex [rate, phase] attribute and the shared
// time uniform, with a per-instance phase offset so instanced LEDs don't sync.

const _blinkCache = new WeakMap();

export function blinkMaterial(THREE, mats, o = {}) {
  let per = _blinkCache.get(mats);
  if (!per) { per = new Map(); _blinkCache.set(mats, per); }
  const key = JSON.stringify(o);
  if (per.has(key)) return per.get(key);
  const m = new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: !!o.transparent, opacity: o.opacity ?? 1,
    depthWrite: !o.transparent, side: o.side ?? THREE.FrontSide, toneMapped: false,
  });
  const time = (mats && mats.uniforms && mats.uniforms.time) || { value: 0 };
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uBlinkTime = time;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 blink;\nuniform float uBlinkTime;\nvarying float vBlink;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float bPhase = blink.y;
        #ifdef USE_INSTANCING
          bPhase += instanceMatrix[3][0] * 0.137 + instanceMatrix[3][2] * 0.071;
        #endif
        float bOn = step(0.5, fract(uBlinkTime * blink.x + bPhase));
        vBlink = blink.x > 0.0 ? mix(0.28, 1.15, bOn) : 1.0;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vBlink;')
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4( diffuse * vBlink, opacity );');
  };
  m.customProgramCacheKey = () => 'wm-blink-' + key;
  m.userData.wmBlink = true;
  per.set(key, m);
  return m;
}

export function layerMaterial(THREE, mats, name, map, opts) {
  if (name === 'main') return mats.toon('#ffffff', { vertexColors: true });
  if (name === 'glow') return blinkMaterial(THREE, mats, opts || {});
  if (name === 'sway') return mats.sway('#ffffff', { vertexColors: true, ...(opts || {}) });
  if (name === 'trans') return mats.toon('#ffffff', { vertexColors: true, transparent: true, opacity: (opts && opts.opacity) ?? 0.55 });
  if (name === 'water') return mats.water(opts || {});
  if (name.startsWith('tex:')) {
    if (map) return mats.toon('#ffffff', { vertexColors: true, map, ...(opts || {}) });
    return mats.toon('#ffffff', { vertexColors: true });
  }
  return mats.toon('#ffffff', { vertexColors: true });
}
