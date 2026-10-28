// Bake a multi-mesh Object3D (as built by buildItemMesh) into one BufferGeometry
// with as few material groups as possible, so each item type becomes a single
// InstancedMesh and (usually) a single draw call. Plain-coloured opaque
// materials are folded into vertex colours; textured, transparent or emissive
// materials keep their own group.

export function bakeObject(THREE, root, mats) {
  root.updateMatrixWorld(true);
  const buckets = new Map(); // key -> { material, parts: [{geo, matrix, color, start, count}] }
  const nm = new THREE.Matrix3();
  let hasUv = true;

  const isPlain = (m) => m && !m.userData?.wmBlink && !m.map && !m.transparent && m.opacity >= 1 && !m.alphaMap &&
    (!m.emissive || (m.emissive.r + m.emissive.g + m.emissive.b) * (m.emissiveIntensity ?? 1) < 0.01) &&
    !(m.defines && (m.defines.GP_SWAY !== undefined)) && m.side !== THREE.DoubleSide && !m.isShaderMaterial;

  root.traverse((o) => {
    if (!o.isMesh || o.userData.gpOutline || !o.visible || !o.geometry || !o.geometry.getAttribute('position')) return;
    const g = o.geometry;
    const groups = g.groups && g.groups.length ? g.groups : [{ start: 0, count: g.index ? g.index.count : g.getAttribute('position').count, materialIndex: 0 }];
    for (const gr of groups) {
      const m = Array.isArray(o.material) ? o.material[gr.materialIndex ?? 0] : o.material;
      if (!m) continue;
      const plain = isPlain(m);
      const key = plain ? 'vc' : m.uuid;
      if (!buckets.has(key)) buckets.set(key, { material: m, plain, parts: [] });
      buckets.get(key).parts.push({ geo: g, matrix: o.matrixWorld, color: m.color || null, vcol: !!m.vertexColors, start: gr.start, count: gr.count });
      if (!plain && !g.getAttribute('uv')) hasUv = false;
    }
  });

  // count vertices and indices
  let nV = 0, nI = 0;
  for (const b of buckets.values()) for (const p of b.parts) {
    const pos = p.geo.getAttribute('position');
    if (p.geo.index) { nI += p.count; nV += pos.count; } else { nI += p.count; nV += p.count; }
  }
  const anyTex = [...buckets.values()].some((b) => !b.plain);
  const P = new Float32Array(nV * 3), N = new Float32Array(nV * 3), C = new Float32Array(nV * 3);
  const UV = anyTex && hasUv ? new Float32Array(nV * 2) : null;
  const I = nV > 65535 ? new Uint32Array(nI) : new Uint16Array(nI);
  // extra per-vertex attributes to copy through (e.g. World-meshes' LED 'blink' [rateHz, phase])
  const EXTRA = ['blink'];
  const extras = [];
  for (const name of EXTRA) {
    let size = 0;
    for (const b of buckets.values()) for (const p of b.parts) { const a = p.geo.getAttribute(name); if (a) size = a.itemSize; }
    if (size) extras.push({ name, size, data: new Float32Array(nV * size) });
  }
  const v = new THREE.Vector3(), n = new THREE.Vector3();
  let vo = 0, io = 0;
  const geo = new THREE.BufferGeometry();
  const materials = [];

  for (const b of buckets.values()) {
    const gStart = io;
    for (const p of b.parts) {
      const g = p.geo;
      const pos = g.getAttribute('position');
      let nor = g.getAttribute('normal');
      if (!nor) { g.computeVertexNormals(); nor = g.getAttribute('normal'); }
      const uv = g.getAttribute('uv');
      const col = p.vcol ? g.getAttribute('color') : null;
      nm.getNormalMatrix(p.matrix);
      const flip = p.matrix.determinant() < 0;
      const cr = p.color ? p.color.r : 1, cg = p.color ? p.color.g : 1, cb = p.color ? p.color.b : 1;
      const base = vo;
      const writeV = (src) => {
        v.fromBufferAttribute(pos, src).applyMatrix4(p.matrix);
        n.fromBufferAttribute(nor, src).applyMatrix3(nm).normalize();
        P[vo * 3] = v.x; P[vo * 3 + 1] = v.y; P[vo * 3 + 2] = v.z;
        N[vo * 3] = n.x; N[vo * 3 + 1] = n.y; N[vo * 3 + 2] = n.z;
        let r = b.plain ? cr : 1, gg = b.plain ? cg : 1, bb = b.plain ? cb : 1;
        if (col) { r *= col.getX(src); gg *= col.getY(src); bb *= col.getZ(src); }
        C[vo * 3] = r; C[vo * 3 + 1] = gg; C[vo * 3 + 2] = bb;
        if (UV) { UV[vo * 2] = uv ? uv.getX(src) : 0; UV[vo * 2 + 1] = uv ? uv.getY(src) : 0; }
        for (const e of extras) {
          const a = g.getAttribute(e.name);
          for (let c = 0; c < e.size; c++) e.data[vo * e.size + c] = a ? a.getComponent(src, c) : 0;
        }
        vo++;
      };
      if (g.index) {
        for (let k = 0; k < pos.count; k++) writeV(k);
        for (let k = 0; k < p.count; k += 3) {
          const a = g.index.getX(p.start + k), bI = g.index.getX(p.start + k + 1), c = g.index.getX(p.start + k + 2);
          I[io++] = base + a; I[io++] = base + (flip ? c : bI); I[io++] = base + (flip ? bI : c);
        }
      } else {
        for (let k = 0; k < p.count; k++) writeV(p.start + k);
        for (let k = 0; k < p.count; k += 3) {
          I[io++] = base + k; I[io++] = base + (flip ? k + 2 : k + 1); I[io++] = base + (flip ? k + 1 : k + 2);
        }
      }
    }
    geo.addGroup(gStart, io - gStart, materials.length);
    let mat;
    if (b.plain) mat = mats.itemFx(mats.toon('#ffffff', { vertexColors: true }));
    else if (b.material.name === 'gp-toon' || b.material.name === 'gp-sway') mat = mats.itemFx(b.material);
    else { mat = safeMaterial(b.material); mats.sanitize?.({ traverse: (f) => f({ material: mat }) }); }
    materials.push(mat);
  }

  geo.setAttribute('position', new THREE.BufferAttribute(P.subarray(0, vo * 3), 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(N.subarray(0, vo * 3), 3));
  geo.setAttribute('color', new THREE.BufferAttribute(C.subarray(0, vo * 3), 3));
  if (UV) geo.setAttribute('uv', new THREE.BufferAttribute(UV.subarray(0, vo * 2), 2));
  for (const e of extras) geo.setAttribute(e.name, new THREE.BufferAttribute(e.data.subarray(0, vo * e.size), e.size));
  geo.setIndex(new THREE.BufferAttribute(I.subarray(0, io), 1));
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return { geometry: geo, materials, triangles: io / 3 };
}

export function disposeObject(root) {
  root.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
}

// three's uniform refresh crashes if a MeshBasicMaterial carries an 'emissive'
// property (it has no emissive uniform), so use a clean clone for those.
const _safe = new WeakMap();
export function safeMaterial(m) {
  if (!m || !m.isMeshBasicMaterial || !('emissive' in m)) return m;
  let c = _safe.get(m);
  if (!c) {
    c = m.clone();
    delete c.emissive; delete c.emissiveIntensity;
    c.onBeforeCompile = m.onBeforeCompile;
    if (m.customProgramCacheKey !== c.customProgramCacheKey) c.customProgramCacheKey = m.customProgramCacheKey;
    _safe.set(m, c);
  }
  return c;
}
