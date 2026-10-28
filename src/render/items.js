// Items: one InstancedMesh per item type, synced from sim.state.items each frame
// with interpolation and state visuals: wobble squash, tumble tilt, the gobble
// flight (a curved Bezier into the mouth with spin and a squish), the golden
// glint and the 'almost' shimmer (per-instance FX attribute read by the toon
// shader), optional shape-code icons for colour-blind play, and soft blob
// shadows when the tier has no shadow maps. Allocation-free per frame.

import { bakeObject, disposeObject } from './bake.js';
import { gobblePath, gobbleScale } from './pure/interp.js';
import { shapeIndex, cueColours } from './pure/colourBlind.js';

const GOBBLE_DUR = 0.32;

export function createItemLayer(THREE, { mats, buildItemMesh, catalogue, settings }) {
  const group = new THREE.Group();
  group.name = 'gp-items';
  const layers = []; // by typeIndex: { mesh, fx, cap, count, typeId, height }
  let types = null;
  let n = 0;
  // per-item render state
  let gT = new Float32Array(0), gx = new Float32Array(0), gy = new Float32Array(0), gz = new Float32Array(0);

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), qt = new THREE.Quaternion();
  const pos = new THREE.Vector3(), scl = new THREE.Vector3(), axis = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const tmpP = { x: 0, y: 0, z: 0 }, gs = { s: 1, sy: 1 };
  let triangles = 0, lastCulled = 0;

  // ---- icons (shape codes) and blob shadows: one instanced mesh each
  const ICON_MAX = 64;
  const iconGeo = new THREE.InstancedBufferGeometry();
  const iq = new THREE.PlaneGeometry(1, 1);
  iconGeo.index = iq.index;
  iconGeo.setAttribute('position', iq.getAttribute('position'));
  const iconData = new Float32Array(ICON_MAX * 8);
  const iconBuf = new THREE.InstancedInterleavedBuffer(iconData, 8, 1);
  iconBuf.setUsage(THREE.DynamicDrawUsage);
  iconGeo.setAttribute('aPos', new THREE.InterleavedBufferAttribute(iconBuf, 4, 0)); // xyz, size
  iconGeo.setAttribute('aIcon', new THREE.InterleavedBufferAttribute(iconBuf, 4, 4)); // shape, r, g, b
  iconGeo.instanceCount = 0;
  const iconMat = new THREE.ShaderMaterial({
    name: 'gp-icons',
    uniforms: {},
    vertexShader: /* glsl */`
attribute vec4 aPos; attribute vec4 aIcon;
varying vec2 vUv; varying vec4 vIcon;
void main() {
  vUv = position.xy + 0.5; vIcon = aIcon;
  vec4 mv = viewMatrix * vec4( aPos.xyz, 1.0 );
  mv.xy += position.xy * aPos.w;
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: /* glsl */`
#include <common>
varying vec2 vUv; varying vec4 vIcon;
float sdShape( vec2 q, int s ) {
  if ( s == 0 ) return length( q ) - 0.62;
  if ( s == 1 ) { q.y += 0.15; vec2 k = vec2( 0.866, 0.5 ); q.x = abs( q.x ); return max( dot( q, k ), -q.y ) - 0.42; }
  if ( s == 2 ) { vec2 d = abs( q ) - vec2( 0.52 ); return max( d.x, d.y ); }
  float a = atan( q.y, q.x ) + 1.5708; float r = length( q );
  float k = 0.42 + 0.3 * pow( abs( cos( a * 2.5 ) ), 2.0 );
  return r - k;
}
void main() {
  vec2 q = vUv * 2.0 - 1.0;
  float d = sdShape( q, int( vIcon.x + 0.5 ) );
  float fill = 1.0 - smoothstep( -0.02, 0.03, d );
  float ring = 1.0 - smoothstep( 0.06, 0.13, d );
  if ( ring < 0.01 ) discard;
  vec3 col = mix( vec3( 0.12, 0.09, 0.12 ), vIcon.yzw, fill );
  gl_FragColor = vec4( col, ring * 0.92 );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
    transparent: true, depthWrite: false, depthTest: true,
  });
  const icons = new THREE.Mesh(iconGeo, iconMat);
  icons.frustumCulled = false;
  icons.renderOrder = 12;
  icons.name = 'gp-item-icons';
  group.add(icons);
  const icColGood = new THREE.Color(), icColAlmost = new THREE.Color();

  const BLOB_MAX = 600;
  const blobGeo = new THREE.InstancedBufferGeometry();
  const bq = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  blobGeo.index = bq.index;
  blobGeo.setAttribute('position', bq.getAttribute('position'));
  blobGeo.setAttribute('uv', bq.getAttribute('uv'));
  const blobData = new Float32Array(BLOB_MAX * 4);
  const blobBuf = new THREE.InstancedBufferAttribute(blobData, 4);
  blobBuf.setUsage(THREE.DynamicDrawUsage);
  blobGeo.setAttribute('aBlob', blobBuf); // x, y, z, radius
  blobGeo.instanceCount = 0;
  const blobMat = new THREE.ShaderMaterial({
    name: 'gp-blobs',
    uniforms: { uCol: { value: new THREE.Color('#3a2a40') }, uAlpha: { value: 0.28 } },
    vertexShader: /* glsl */`
attribute vec4 aBlob; varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * viewMatrix * vec4( aBlob.xyz + position * aBlob.w * 2.0, 1.0 ); }`,
    fragmentShader: /* glsl */`
#include <common>
uniform vec3 uCol; uniform float uAlpha; varying vec2 vUv;
void main() { float r = length( vUv * 2.0 - 1.0 ); float a = ( 1.0 - smoothstep( 0.2, 1.0, r ) ) * uAlpha; if ( a < 0.01 ) discard; gl_FragColor = vec4( uCol, a );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
    transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -6,
  });
  const blobs = new THREE.Mesh(blobGeo, blobMat);
  blobs.frustumCulled = false;
  blobs.renderOrder = 1;
  blobs.name = 'gp-item-blobs';
  group.add(blobs);
  // far LOD: every distant item, of any type, as a soft low-poly lump in its
  // type's average colour, scaled to its bounding box. One draw call in all.
  let farCap = 256;
  const farGeo = new THREE.IcosahedronGeometry(0.5, 0);
  farGeo.translate(0, 0.5, 0);
  let farFxArr = new Float32Array(farCap * 3);
  let farFx = new THREE.InstancedBufferAttribute(farFxArr, 3);
  farGeo.setAttribute('aFx', farFx);
  const farMat = mats.itemFx(mats.toon('#ffffff', { rim: false }));
  let far = makeFar(farCap);
  function makeFar(cap) {
    const m = new THREE.InstancedMesh(farGeo, farMat, cap);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.setColorAt(0, new THREE.Color(1, 1, 1));
    m.instanceColor.setUsage(THREE.DynamicDrawUsage);
    m.count = 0;
    m.castShadow = false;
    m.receiveShadow = true;
    m.frustumCulled = false;
    m.name = 'gp-item-far';
    group.add(m);
    return m;
  }
  function growFar(need) {
    group.remove(far); far.dispose?.();
    farCap = Math.ceil(need * 1.5);
    farFxArr = new Float32Array(farCap * 3);
    farFx = new THREE.InstancedBufferAttribute(farFxArr, 3);
    farGeo.setAttribute('aFx', farFx);
    far = makeFar(farCap);
  }
  let blobsOn = false;
  let heightAt = null;

  function fallbackMesh() {
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1), mats.toon('#ff9a6b'));
    m.position.y = 0.5;
    g.add(m);
    return g;
  }

  function buildLayer(ti, cap) {
    const typeId = types[ti];
    let obj;
    try { obj = buildItemMesh ? buildItemMesh(THREE, mats, typeId) : null; } catch (e) { console.warn('[render] buildItemMesh failed', typeId, e); }
    if (!obj) obj = fallbackMesh();
    const baked = bakeObject(THREE, obj, mats);
    disposeObject(obj);
    const fxArr = new Float32Array(cap * 3);
    const fx = new THREE.InstancedBufferAttribute(fxArr, 3);
    fx.setUsage(THREE.DynamicDrawUsage);
    baked.geometry.setAttribute('aFx', fx);
    const mesh = new THREE.InstancedMesh(baked.geometry, baked.materials.length === 1 ? baked.materials[0] : baked.materials, cap);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.count = 0;
    mesh.name = 'item:' + typeId;
    mesh.boundingSphere = new THREE.Sphere();
    group.add(mesh);
    const cat = catalogue ? catalogue[typeId] : null;
    const bb = baked.geometry.boundingBox;
    const cA = baked.geometry.getAttribute('color');
    let cr = 0, cg = 0, cb = 0;
    for (let k = 0; k < cA.count; k++) { cr += cA.getX(k); cg += cA.getY(k); cb += cA.getZ(k); }
    const nk = Math.max(1, cA.count);
    const layer = {
      avg: new THREE.Color(cr / nk, cg / nk, cb / nk),
      bx: bb.max.x - bb.min.x, by: Math.max(0.02, bb.max.y - bb.min.y), bz: bb.max.z - bb.min.z,
      ox: (bb.max.x + bb.min.x) / 2, oy: bb.min.y, oz: (bb.max.z + bb.min.z) / 2,
      mesh, fx, fxArr, cap, cursor: 0, typeId, tris: baked.triangles,
      height: cat && cat.size ? (cat.height || cat.size) / cat.size : 1,
      shape: shapeIndex(cat ? cat.shape : 'circle'),
      minX: 0, minY: 0, minZ: 0, maxX: 0, maxY: 0, maxZ: 0, maxS: 0,
    };
    layers[ti] = layer;
    return layer;
  }

  function disposeLayers() {
    for (const l of layers) if (l) { group.remove(l.mesh); l.mesh.geometry.dispose(); l.mesh.dispose?.(); }
    layers.length = 0;
  }

  function setup(itemsState, opts = {}) {
    disposeLayers();
    heightAt = opts.heightAt || null;
    types = itemsState ? itemsState.types : null;
    n = itemsState ? itemsState.count : 0;
    gT = new Float32Array(Math.max(1, n)).fill(-1);
    gx = new Float32Array(Math.max(1, n)); gy = new Float32Array(Math.max(1, n)); gz = new Float32Array(Math.max(1, n));
    if (!itemsState || !types) return;
    // capacity per type: current count plus slack for spawns
    const counts = new Int32Array(types.length);
    for (let i = 0; i < n; i++) counts[itemsState.typeIndex[i]]++;
    triangles = 0;
    for (let ti = 0; ti < types.length; ti++) if (counts[ti] > 0) buildLayer(ti, counts[ti] + 8);
  }

  function ensureCapacity(itemsState) {
    if (itemsState.count !== n) {
      // the sim grew its arrays (spawned items): keep per-item state, extend
      const old = n;
      n = itemsState.count;
      const grow = (a, fill) => { const b = new Float32Array(Math.max(1, n)); b.fill(fill); b.set(a.subarray(0, Math.min(old, n))); return b; };
      gT = grow(gT, -1); gx = grow(gx, 0); gy = grow(gy, 0); gz = grow(gz, 0);
    }
    if (itemsState.types !== types) types = itemsState.types;
  }

  function growLayer(ti, need) {
    const l = layers[ti];
    const nl = buildLayer(ti, Math.ceil(need * 1.5) + 8);
    if (l) {
      // keep what was already written this frame
      nl.cursor = l.cursor;
      nl.mesh.instanceMatrix.array.set(l.mesh.instanceMatrix.array.subarray(0, l.cursor * 16));
      nl.fxArr.set(l.fxArr.subarray(0, l.cursor * 3));
      nl.minX = l.minX; nl.minY = l.minY; nl.minZ = l.minZ; nl.maxX = l.maxX; nl.maxY = l.maxY; nl.maxZ = l.maxZ; nl.maxS = l.maxS;
      group.remove(l.mesh); l.mesh.geometry.dispose();
    }
    return nl;
  }

  // player: interpolated {x, y, z, yaw, size}; time: render clock
  function sync(it, alpha, dt, player, time, opts) {
    if (!it || !types) return;
    ensureCapacity(it);
    const a = alpha < 0 ? 0 : alpha > 1 ? 1 : alpha;
    for (const l of layers) if (l) { l.cursor = 0; l.minX = l.minY = l.minZ = Infinity; l.maxX = l.maxY = l.maxZ = -Infinity; l.maxS = 0; }
    const shapeCodes = !!opts.shapeCodes;
    let nIcons = 0, nBlobs = 0;
    const ps = Math.max(0.02, player.size);
    const mouthX = player.x + Math.sin(player.yaw) * ps * 0.5;
    const mouthY = player.y + ps * 0.42;
    const mouthZ = player.z + Math.cos(player.yaw) * ps * 0.5;
    const iconR2 = (ps * 14 + 4) * (ps * 14 + 4);
    // per-instance culling: skip items that would be under cullPx on screen or past the fog
    const cx = opts.camX ?? player.x, cy = opts.camY ?? player.y, cz = opts.camZ ?? player.z;
    const kPx = (opts.pxPerRad || 600) / Math.max(0.3, opts.cullPx || 1.5);
    const far2 = (opts.far || 1e6) * (opts.far || 1e6);
    let culled = 0, nFar = 0;
    const kLod = (opts.pxPerRad || 600) / Math.max(1, opts.lodPx || 10);

    for (let i = 0; i < n; i++) {
      const st = it.state[i];
      if (st === 5) { gT[i] = -1; continue; }
      let g = gT[i];
      if (st === 3 || st === 4) {
        if (g < 0 && st === 3) {
          g = 0;
          gx[i] = it.px[i] + (it.x[i] - it.px[i]) * a;
          gy[i] = it.py[i] + (it.y[i] - it.py[i]) * a;
          gz[i] = it.pz[i] + (it.z[i] - it.pz[i]) * a;
        }
        if (g >= 0 && g < 1) g = Math.min(1, g + dt / GOBBLE_DUR);
        else if (g < 0) continue; // gone and never seen being gobbled
        gT[i] = g;
        if (g >= 1) { if (st === 4) continue; }
      } else gT[i] = -1;

      if (g < 0) {
        const dx = it.x[i] - cx, dy = it.y[i] - cy, dz = it.z[i] - cz;
        const d2 = dx * dx + dy * dy + dz * dz;
        const sz = it.size[i] || 0.1;
        if (d2 > far2 || sz * sz * kPx * kPx < d2) { culled++; continue; }
        if (sz * sz * kLod * kLod < d2) {
          const lt = layers[it.typeIndex[i]] || buildLayer(it.typeIndex[i], 16);
          if (nFar >= farCap) growFar(nFar + 1);
          const s0 = sz * (it.scale[i] || 1);
          q.setFromAxisAngle(up, it.rotY[i]);
          axis.set(lt.ox * s0, lt.oy * s0, lt.oz * s0).applyQuaternion(q);
          pos.set(it.px[i] + (it.x[i] - it.px[i]) * a + axis.x, it.py[i] + (it.y[i] - it.py[i]) * a + axis.y, it.pz[i] + (it.z[i] - it.pz[i]) * a + axis.z);
          scl.set(Math.max(0.05, lt.bx) * s0, lt.by * s0, Math.max(0.05, lt.bz) * s0);
          m4.compose(pos, q, scl);
          m4.toArray(far.instanceMatrix.array, nFar * 16);
          lt.avg.toArray(far.instanceColor.array, nFar * 3);
          farFxArr[nFar * 3] = it.almost[i] && !it.gobbleable[i] ? 1 : 0;
          farFxArr[nFar * 3 + 1] = it.golden[i] ? 1 : 0;
          farFxArr[nFar * 3 + 2] = 0;
          nFar++;
          continue;
        }
      }
      const ti = it.typeIndex[i];
      let l = layers[ti];
      if (!l) l = buildLayer(ti, 16);
      if (l.cursor >= l.cap) l = growLayer(ti, l.cap + 1);
      const size = it.size[i] || 0.1;
      let rotY = it.rotY[i];
      let sx = size, sy = size, sz = size;
      let glow = 0;
      if (g >= 0) {
        gobblePath(g, gx[i], gy[i], gz[i], mouthX, mouthY - size * 0.3, mouthZ, Math.max(size, ps * 0.35) * 0.9, (i & 1) ? 0.6 : -0.6, tmpP);
        pos.set(tmpP.x, tmpP.y, tmpP.z);
        gobbleScale(g, gs);
        sx = sz = size * gs.s / Math.sqrt(gs.sy);
        sy = size * gs.s * gs.sy;
        rotY += g * Math.PI * 2.5;
        glow = 1 - g;
        q.setFromAxisAngle(up, rotY);
      } else {
        pos.set(it.px[i] + (it.x[i] - it.px[i]) * a, it.py[i] + (it.y[i] - it.py[i]) * a, it.pz[i] + (it.z[i] - it.pz[i]) * a);
        const s = it.scale[i] || 1;
        sx = sy = sz = size * s;
        q.setFromAxisAngle(up, rotY);
        const tilt = it.tilt[i];
        if (tilt) {
          const ta = it.tiltAxis[i];
          axis.set(Math.cos(ta), 0, Math.sin(ta));
          qt.setFromAxisAngle(axis, tilt);
          q.premultiply(qt);
        }
        if (st === 1) {
          // wobbling: a little squash-and-stretch on top of the sim's tilt
          const an = it.anim[i];
          const w = Math.exp(-an * 3.5) * Math.sin(an * 22) * 0.08;
          sy *= 1 + w; sx *= 1 - w * 0.5; sz *= 1 - w * 0.5;
        }
      }
      scl.set(sx, sy, sz);
      m4.compose(pos, q, scl);
      const c = l.cursor++;
      m4.toArray(l.mesh.instanceMatrix.array, c * 16);
      const fo = c * 3;
      l.fxArr[fo] = it.almost[i] && !it.gobbleable[i] ? 1 : 0;
      l.fxArr[fo + 1] = it.golden[i] ? 1 : 0;
      l.fxArr[fo + 2] = glow;
      // bounds
      if (pos.x < l.minX) l.minX = pos.x; if (pos.x > l.maxX) l.maxX = pos.x;
      if (pos.y < l.minY) l.minY = pos.y; if (pos.y > l.maxY) l.maxY = pos.y;
      if (pos.z < l.minZ) l.minZ = pos.z; if (pos.z > l.maxZ) l.maxZ = pos.z;
      const ms = Math.max(sx, sy * l.height, sz);
      if (ms > l.maxS) l.maxS = ms;

      if (g < 0) {
        // shape-code icons over nearby items you can (or nearly can) gobble
        if (shapeCodes && nIcons < ICON_MAX && (it.gobbleable[i] || it.almost[i])) {
          const dx = pos.x - player.x, dz = pos.z - player.z;
          if (dx * dx + dz * dz < iconR2) {
            const o = nIcons * 8;
            iconData[o] = pos.x; iconData[o + 1] = pos.y + size * l.height + Math.max(0.05, ps * 0.12); iconData[o + 2] = pos.z;
            iconData[o + 3] = Math.max(0.05, Math.min(size * 0.6, ps * 0.14) + ps * 0.04);
            const col = it.gobbleable[i] ? icColGood : icColAlmost;
            iconData[o + 4] = l.shape; iconData[o + 5] = col.r; iconData[o + 6] = col.g; iconData[o + 7] = col.b;
            nIcons++;
          }
        }
        if (blobsOn && nBlobs < BLOB_MAX) {
          const o = nBlobs * 4;
          blobData[o] = pos.x;
          blobData[o + 1] = (heightAt ? safeH(heightAt, pos.x, pos.z, pos.y) : pos.y) + 0.004 + size * 0.01;
          blobData[o + 2] = pos.z;
          blobData[o + 3] = size * 0.55;
          nBlobs++;
        }
      }
    }

    triangles = 0;
    for (const l of layers) {
      if (!l) continue;
      l.mesh.count = l.cursor;
      l.mesh.visible = l.cursor > 0;
      if (l.cursor > 0) {
        l.mesh.instanceMatrix.clearUpdateRanges();
        l.mesh.instanceMatrix.addUpdateRange(0, l.cursor * 16);
        l.mesh.instanceMatrix.needsUpdate = true;
        l.fx.clearUpdateRanges();
        l.fx.addUpdateRange(0, l.cursor * 3);
        l.fx.needsUpdate = true;
        const bs = l.mesh.boundingSphere;
        bs.center.set((l.minX + l.maxX) * 0.5, (l.minY + l.maxY) * 0.5, (l.minZ + l.maxZ) * 0.5);
        bs.radius = Math.hypot(l.maxX - l.minX, l.maxY - l.minY, l.maxZ - l.minZ) * 0.5 + l.maxS * 1.2;
        triangles += l.tris * l.cursor;
      }
    }
    lastCulled = culled;
    far.count = nFar;
    far.visible = nFar > 0;
    if (nFar) {
      far.instanceMatrix.clearUpdateRanges(); far.instanceMatrix.addUpdateRange(0, nFar * 16); far.instanceMatrix.needsUpdate = true;
      far.instanceColor.clearUpdateRanges(); far.instanceColor.addUpdateRange(0, nFar * 3); far.instanceColor.needsUpdate = true;
      farFx.clearUpdateRanges(); farFx.addUpdateRange(0, nFar * 3); farFx.needsUpdate = true;
      triangles += nFar * 20;
    }
    iconGeo.instanceCount = nIcons;
    icons.visible = nIcons > 0;
    if (nIcons) { iconBuf.clearUpdateRanges(); iconBuf.addUpdateRange(0, nIcons * 8); iconBuf.needsUpdate = true; }
    blobGeo.instanceCount = nBlobs;
    blobs.visible = nBlobs > 0;
    if (nBlobs) { blobBuf.clearUpdateRanges(); blobBuf.addUpdateRange(0, nBlobs * 4); blobBuf.needsUpdate = true; }
  }

  function applyColours() {
    const c = cueColours(settings?.get?.('colourBlind') || 'none');
    icColGood.set(c.iconGood);
    icColAlmost.set(c.iconAlmost);
  }
  applyColours();

  return {
    group, setup, sync, applyColours,
    setBlobs(on) { blobsOn = !!on; if (!on) { blobGeo.instanceCount = 0; blobs.visible = false; } },
    get triangles() { return triangles; },
    get culled() { return lastCulled; },
    get layerCount() { return layers.filter(Boolean).length; },
    dispose() {
      disposeLayers();
      iconGeo.dispose(); iq.dispose(); iconMat.dispose();
      blobGeo.dispose(); bq.dispose(); blobMat.dispose();
      farGeo.dispose(); far.dispose?.();
    },
  };
}

function safeH(fn, x, z, fb) {
  const h = fn(x, z);
  return Number.isFinite(h) ? h : fb;
}
