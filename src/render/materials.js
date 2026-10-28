// The materials factory (CONTRACTS §4.2): soft storybook toon, wind sway,
// animated water, inverted-hull outlines and additive glow, all cached and all
// sharing one set of uniforms that the renderer updates each frame.
//
// The toon look: a 3-band ramp with smooth edges (cool shadow band, soft mid,
// warm lit band), a warm rim light biased to the sun side, and sky-tinted
// ambient from the hemisphere light. Works with instancing, vertex colours,
// skinning and shadows because it patches MeshToonMaterial rather than
// replacing it.

import { NOISE, HEIGHT } from './glsl.js';
import { cueColours } from './pure/colourBlind.js';

export function createMaterials(THREE, settings) {
  const uniforms = {
    time: { value: 0 },
    wind: { value: new THREE.Vector2(0.85, 0.35) },
    sunDir: { value: new THREE.Vector3(0.4, 0.8, 0.3).normalize() },
    tint: { value: new THREE.Color(1, 1, 1) },
    // additions (render-internal, still shared)
    sunView: { value: new THREE.Vector3(0, 1, 0) },
    sunColor: { value: new THREE.Color('#fff1d0') },
    skyColor: { value: new THREE.Color('#9fd8f5') },
    rimColor: { value: new THREE.Color('#ffe2b8') },
    rimStrength: { value: 0.45 },
    shadowTint: { value: new THREE.Color('#8a86b8') },
    outlineColor: { value: new THREE.Color('#3a2a22') },
    almostColor: { value: new THREE.Color('#ffb347') },
    goldenColor: { value: new THREE.Color('#ffd75e') },
    heightTex: { value: null },
    heightBounds: { value: new THREE.Vector4(0, 0, 0, 0) },
    waterScale: { value: 1 },
  };

  // 1x1 "no data" height field: everything reads as deep water.
  const noHeight = makeHalfTex(THREE, new Float32Array([-1000]), 1, 1);
  uniforms.heightTex.value = noHeight;

  const cache = new Map();
  const itemCache = new WeakMap();
  const owned = new Set();

  function colorKey(c) {
    if (c && c.isColor) return c.getHexString();
    if (typeof c === 'number') return c.toString(16);
    return String(c ?? '#ffffff').toLowerCase();
  }

  // ------------------------------------------------------------------ toon
  // An explicit program key: three's default key is onBeforeCompile.toString(),
  // and minified closures from different modules can stringify identically,
  // which would share the wrong program. Variants differ by defines.
  const toonKey = () => 'gp-toon-v1';

  function patchToon(shader, mat) {
    const u = shader.uniforms;
    u.gpTime = uniforms.time;
    u.gpWind = uniforms.wind;
    u.gpTint = uniforms.tint;
    u.gpSunView = uniforms.sunView;
    u.gpRimColor = uniforms.rimColor;
    u.gpRimStrength = mat.userData.gpRim || uniforms.rimStrength;
    u.gpShadowTint = uniforms.shadowTint;
    u.gpAlmostColor = uniforms.almostColor;
    u.gpGoldenColor = uniforms.goldenColor;
    u.gpSwayStrength = mat.userData.gpSwayStrength || { value: 0 };
    u.gpSwayFreq = mat.userData.gpSwayFreq || { value: 1 };

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
uniform float gpTime;
uniform vec2 gpWind;
uniform float gpSwayStrength;
uniform float gpSwayFreq;
#ifdef GP_ITEMFX
attribute vec3 aFx;
varying vec3 vFx;
varying vec3 vGpWorld;
#endif
#ifdef GP_BIRD
attribute float aWing;
attribute float aFlap;
#endif
`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
#if defined( GP_SWAY ) || defined( GP_ITEMFX )
  vec4 gpW = vec4( transformed, 1.0 );
  #ifdef USE_INSTANCING
    gpW = instanceMatrix * gpW;
  #endif
  gpW = modelMatrix * gpW;
#endif
#ifdef GP_SWAY
  {
    float gpH = max( transformed.y, 0.0 );
    #if defined( GP_SWAY_ALPHA ) && defined( USE_COLOR_ALPHA )
      float gpAmt = color.a * 2.0;
    #else
      float gpAmt = 0.04 * pow( gpH, 1.25 );
    #endif
    float gpPh = gpTime * gpSwayFreq * 2.2 + dot( gpW.xz, vec2( 0.31, 0.23 ) );
    float gpGust = 0.55 + 0.45 * sin( gpTime * 0.43 + gpW.x * 0.035 + gpW.z * 0.02 ) * sin( gpTime * 0.21 + gpW.z * 0.05 + 1.3 );
    float gpS = ( sin( gpPh ) * 0.6 + sin( gpPh * 2.37 + 1.7 ) * 0.22 + 0.4 ) * gpGust;
    vec2 gpOff = gpWind * gpS * gpAmt * gpSwayStrength;
    transformed.xz += gpOff;
    transformed.y -= dot( gpOff, gpOff ) * 0.3 / max( gpH, 0.2 );
  }
#endif
#ifdef GP_BIRD
  {
    float gpPhase = float( gl_InstanceID ) * 1.618;
    float gpFlap = sin( gpTime * ( 9.0 + mod( gpPhase, 3.0 ) ) + gpPhase * 6.0 );
    float gpA = ( gpFlap * 0.9 * aFlap + ( 1.0 - aFlap ) * 0.15 ) * abs( aWing );
    float gpC = cos( gpA ), gpSn = sin( gpA );
    vec2 xy = transformed.xy;
    float fold = mix( 0.08, 1.0, aFlap );
    float wx = sign( xy.x ) * ( 0.1 + ( abs( xy.x ) - 0.1 ) * fold );
    if ( abs( aWing ) > 0.0 || abs( xy.x ) > 0.1 ) xy.x = abs( aWing ) > 0.0 ? wx : xy.x;
    transformed.x = xy.x * gpC;
    transformed.y = xy.y + abs( xy.x ) * gpSn;
  }
#endif
#ifdef GP_ITEMFX
  vFx = aFx;
  vGpWorld = gpW.xyz;
#endif
`);

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float gpTime;
uniform vec3 gpTint;
uniform vec3 gpSunView;
uniform vec3 gpRimColor;
uniform float gpRimStrength;
uniform vec3 gpShadowTint;
uniform vec3 gpAlmostColor;
uniform vec3 gpGoldenColor;
#ifdef GP_ITEMFX
varying vec3 vFx;
varying vec3 vGpWorld;
#endif
`)
      .replace('#include <gradientmap_pars_fragment>', `
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
  float d = dot( normal, lightDirection );
  float w = fwidth( d ) * 1.5 + 0.05;
  float b1 = smoothstep( -0.12 - w, -0.12 + w, d );
  float b2 = smoothstep( 0.38 - w, 0.38 + w, d );
  vec3 lo = gpShadowTint * 0.34;
  vec3 mid = vec3( 0.80, 0.78, 0.80 );
  return mix( mix( lo, mid, b1 ), vec3( 1.0, 0.99, 0.96 ), b2 );
}
`)
      .replace('#include <opaque_fragment>', `
{
  vec3 gpV = normalize( vViewPosition );
  float gpNdV = clamp( dot( normal, gpV ), 0.0, 1.0 );
  float gpEdge = 1.0 - gpNdV;
#ifndef GP_NORIM
  float gpRim = smoothstep( 0.58, 0.96, gpEdge );
  float gpSunSide = clamp( dot( normal, gpSunView ) * 0.6 + 0.55, 0.0, 1.0 );
  outgoingLight += gpRimColor * gpRim * gpRimStrength * gpSunSide * ( 0.35 + 0.65 * diffuseColor.rgb );
#endif
#ifdef GP_ITEMFX
  // 'almost': a soft warm rim shimmer, a slow pulse (about 0.7 Hz), never a flash
  float gpPulse = 0.6 + 0.4 * sin( gpTime * 4.4 );
  float gpRimA = smoothstep( 0.3, 0.92, gpEdge );
  outgoingLight += gpAlmostColor * vFx.x * ( gpRimA * gpPulse * 1.1 + 0.08 );
  // golden: a gilded tint with a slow glint band sweeping across
  float gpBand = sin( dot( vGpWorld, vec3( 0.9, 0.6, 0.7 ) ) * 2.5 - gpTime * 2.2 );
  float gpGlint = smoothstep( 0.9, 1.0, gpBand );
  outgoingLight = mix( outgoingLight, outgoingLight * gpGoldenColor * 1.3 + gpGoldenColor * 0.12, vFx.y * 0.75 );
  outgoingLight += gpGoldenColor * vFx.y * ( gpGlint * 1.2 + smoothstep( 0.5, 1.0, gpEdge ) * 0.5 );
  // gobble warm-up glow
  outgoingLight = mix( outgoingLight, vec3( 1.0, 0.96, 0.88 ) * 1.25, vFx.z * 0.55 );
#endif
}
outgoingLight *= gpTint;
#include <opaque_fragment>`);
  }

  function makeToon(color, o = {}) {
    const m = new THREE.MeshToonMaterial({
      color: new THREE.Color(color ?? '#ffffff'),
      emissive: o.emissive != null ? new THREE.Color(o.emissive) : new THREE.Color(0, 0, 0),
      map: o.map || null,
      vertexColors: !!o.vertexColors,
      transparent: !!o.transparent || (o.opacity != null && o.opacity < 1),
      opacity: o.opacity ?? 1,
      side: o.side ?? THREE.FrontSide,
    });
    if (o.flatShading) m.flatShading = true;
    if (o.emissiveIntensity != null) m.emissiveIntensity = o.emissiveIntensity;
    m.defines = m.defines || {};
    if (o.rim === false) m.defines.GP_NORIM = '';
    if (o.rimStrength != null) m.userData.gpRim = { value: o.rimStrength };
    m.onBeforeCompile = (shader) => patchToon(shader, m);
    m.customProgramCacheKey = toonKey;
    return m;
  }

  function toon(color, o = {}) {
    const key = 't|' + colorKey(color) + '|' + optKey(o);
    let m = cache.get(key);
    if (!m) { m = makeToon(color, o); m.name = 'gp-toon'; cache.set(key, m); }
    return m;
  }

  function sway(color, o = {}) {
    const key = 's|' + colorKey(color) + '|' + optKey(o) + '|' + (o.strength ?? 1) + '|' + (o.frequency ?? 1) + '|' + (o.weight || 'height');
    let m = cache.get(key);
    if (!m) {
      m = makeToon(color, o);
      m.name = 'gp-sway';
      m.defines.GP_SWAY = '';
      if (o.weight === 'alpha') m.defines.GP_SWAY_ALPHA = '';
      m.userData.gpSwayStrength = { value: o.strength ?? 1 };
      m.userData.gpSwayFreq = { value: o.frequency ?? 1 };
      cache.set(key, m);
    }
    return m;
  }

  // Render-internal: the per-instance FX variant of a toon material, used by
  // the item instancer (reads the aFx attribute: almost, golden, gobble glow).
  function itemFx(base) {
    let m = itemCache.get(base);
    if (m) return m;
    m = base.clone();
    m.defines = { ...(base.defines || {}), GP_ITEMFX: '' };
    m.userData = { ...base.userData };
    m.onBeforeCompile = (shader) => patchToon(shader, m);
    m.customProgramCacheKey = toonKey;
    m.name = (base.name || 'gp') + '-fx';
    itemCache.set(base, m);
    owned.add(m);
    return m;
  }

  // Render-internal: the flapping bird material.
  function bird() {
    const key = 'bird';
    let m = cache.get(key);
    if (!m) {
      m = makeToon('#ffffff', {});
      m.defines.GP_BIRD = '';
      m.name = 'gp-bird';
      cache.set(key, m);
    }
    return m;
  }

  // ------------------------------------------------------------------ water
  function water(o = {}) {
    const key = 'w|' + colorKey(o.shallow) + colorKey(o.deep) + colorKey(o.foam) + '|' + (o.opacity ?? '');
    let m = cache.get(key);
    if (m) return m;
    m = new THREE.ShaderMaterial({
      name: 'gp-water',
      uniforms: {
        ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
        gpTime: uniforms.time,
        gpSunDir: uniforms.sunDir,
        gpSunColor: uniforms.sunColor,
        gpSky: uniforms.skyColor,
        gpHeightTex: uniforms.heightTex,
        gpHeightBounds: uniforms.heightBounds,
        gpScale: uniforms.waterScale,
        gpShallow: { value: new THREE.Color(o.shallow || '#5fd6d0') },
        gpDeep: { value: new THREE.Color(o.deep || '#1e7fa0') },
        gpFoam: { value: new THREE.Color(o.foam || '#ffffff') },
        gpAlphaShallow: { value: o.opacity ?? 0.62 },
      },
      vertexShader: /* glsl */`
#include <common>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
uniform float gpTime;
uniform float gpScale;
varying vec3 vW;
void main() {
  vec4 w = modelMatrix * vec4( position, 1.0 );
  float s = 1.0 / gpScale;
  float wave = sin( w.x * 0.35 * s + gpTime * 1.1 ) * 0.5 + sin( w.z * 0.27 * s - gpTime * 0.9 + w.x * 0.1 * s ) * 0.5;
  w.y += wave * 0.035 * gpScale;
  vW = w.xyz;
  vec4 mvPosition = viewMatrix * w;
  gl_Position = projectionMatrix * mvPosition;
  #include <logdepthbuf_vertex>
  #include <fog_vertex>
}`,
      fragmentShader: /* glsl */`
#include <common>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
uniform float gpTime;
uniform float gpScale;
uniform vec3 gpSunDir;
uniform vec3 gpSunColor;
uniform vec3 gpSky;
uniform vec3 gpShallow;
uniform vec3 gpDeep;
uniform vec3 gpFoam;
uniform float gpAlphaShallow;
varying vec3 vW;
${NOISE}
${HEIGHT}
void main() {
  #include <logdepthbuf_fragment>
  float t = gpTime;
  float s = 1.0 / gpScale;
  vec2 p = vW.xz * s;
  vec3 V = normalize( cameraPosition - vW );
  float nx = cos( p.x * 0.9 + t * 1.3 ) * 0.5 + cos( p.x * 2.3 + p.y * 1.1 - t * 1.9 ) * 0.25 + ( gpNoise( p * 1.7 + t * 0.4 ) - 0.5 ) * 0.7;
  float nz = cos( p.y * 0.8 - t * 1.1 ) * 0.5 + cos( p.y * 2.1 - p.x * 0.7 + t * 1.7 ) * 0.25 + ( gpNoise( p * 1.9 - t * 0.35 + 7.0 ) - 0.5 ) * 0.7;
  vec3 N = normalize( vec3( nx * 0.22, 1.0, nz * 0.22 ) );

  float ground = gpGround( vW.xz );
  bool hasGround = ground > -999.0;
  float depth = hasGround ? max( vW.y - ground, 0.0 ) : 50.0;
  float dk = 1.0 - exp( -depth * 0.9 * s );
  vec3 col = mix( gpShallow, gpDeep, dk );

  float ndl = clamp( dot( N, gpSunDir ), 0.0, 1.0 );
  col *= 0.82 + 0.28 * ndl;
  float fres = pow( 1.0 - clamp( dot( N, V ), 0.0, 1.0 ), 4.0 );
  col = mix( col, gpSky, fres * 0.6 );

  vec3 R = reflect( -gpSunDir, N );
  float rv = clamp( dot( R, V ), 0.0, 1.0 );
  float spec = pow( rv, 90.0 );
  float sparkle = smoothstep( 0.72, 0.96, gpNoise( p * 7.0 + vec2( t * 0.6, -t * 0.45 ) ) )
                * smoothstep( 0.55, 0.95, gpNoise( p * 2.3 - t * 0.25 ) );
  col += gpSunColor * ( spec * 0.45 + sparkle * pow( rv, 6.0 ) * 1.6 + sparkle * 0.08 );

  // foam: a soft line hugging the shore plus bands rolling in
  float wob = gpNoise( p * 0.9 + t * 0.12 );
  float fw = 0.14;
  float dn = depth * s;
  float shore = 1.0 - smoothstep( 0.0, fw, dn + ( wob - 0.5 ) * 0.25 );
  float lines = sin( dn / fw * 2.6 - t * 1.5 + wob * 3.5 );
  float band = smoothstep( 0.78, 0.97, lines ) * ( 1.0 - smoothstep( 0.0, fw * 4.0, dn ) );
  float breakup = smoothstep( 0.25, 0.65, gpNoise( p * 3.0 + vec2( t * 0.2, 0.0 ) ) );
  float foam = hasGround ? clamp( smoothstep( 0.3, 0.75, shore ) + band * 0.75 * breakup, 0.0, 1.0 ) : 0.0;
  col = mix( col, gpFoam, foam * 0.92 );

  float alpha = mix( gpAlphaShallow, 0.97, dk );
  alpha = max( alpha, foam * 0.95 );
  if ( hasGround ) alpha *= smoothstep( 0.0, 0.02, dn );
  gl_FragColor = vec4( col, alpha );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`,
      transparent: true,
      depthWrite: true,
      fog: true,
    });
    cache.set(key, m);
    return m;
  }

  // ------------------------------------------------------------------ outline
  function outlineMaterial(thickness, color) {
    const key = 'o|' + thickness.toFixed(4) + '|' + (color ? colorKey(color) : 'pal');
    let m = cache.get(key);
    if (m) return m;
    m = new THREE.ShaderMaterial({
      name: 'gp-outline',
      uniforms: {
        ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
        gpThickness: { value: thickness },
        gpOutlineColor: color ? { value: new THREE.Color(color) } : uniforms.outlineColor,
      },
      vertexShader: /* glsl */`
#include <common>
#include <batching_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
uniform float gpThickness;
void main() {
  #include <morphinstance_vertex>
  #include <batching_vertex>
  #include <beginnormal_vertex>
  #include <morphnormal_vertex>
  #include <skinbase_vertex>
  #include <skinnormal_vertex>
  #include <begin_vertex>
  #include <morphtarget_vertex>
  #include <skinning_vertex>
  transformed += normalize( objectNormal ) * gpThickness;
  #include <project_vertex>
  #include <logdepthbuf_vertex>
  #include <fog_vertex>
}`,
      fragmentShader: /* glsl */`
#include <common>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
uniform vec3 gpOutlineColor;
void main() {
  #include <logdepthbuf_fragment>
  gl_FragColor = vec4( gpOutlineColor, 1.0 );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`,
      side: THREE.BackSide,
      fog: true,
    });
    cache.set(key, m);
    return m;
  }

  function outline(mesh, thickness = 0.02, color = null) {
    if (!mesh || !mesh.geometry) return null;
    const mat = outlineMaterial(thickness, color);
    let o;
    if (mesh.isSkinnedMesh) {
      o = new THREE.SkinnedMesh(mesh.geometry, mat);
      o.bind(mesh.skeleton, mesh.bindMatrix);
    } else if (mesh.isInstancedMesh) {
      o = new THREE.InstancedMesh(mesh.geometry, mat, mesh.count);
      o.instanceMatrix = mesh.instanceMatrix;
    } else {
      o = new THREE.Mesh(mesh.geometry, mat);
    }
    o.name = 'gp-outline';
    o.userData.gpOutline = true;
    o.castShadow = false;
    o.receiveShadow = false;
    o.raycast = () => {};
    o.matrixAutoUpdate = true;
    mesh.add(o);
    return o;
  }

  // ------------------------------------------------------------------ glow
  function glow(color, o = {}) {
    const key = 'g|' + colorKey(color) + '|' + (o.opacity ?? 1);
    let m = cache.get(key);
    if (!m) {
      m = new THREE.MeshBasicMaterial({
        color: new THREE.Color(color ?? '#ffffff'),
        transparent: true, opacity: o.opacity ?? 1,
        blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false,
      });
      m.name = 'gp-glow';
      cache.set(key, m);
    }
    return m;
  }

  // ------------------------------------------------------------------ height field
  // Sample a terrain height function into a small texture so the water shader
  // can find the shoreline (foam) without knowing anything about the mesh.
  function setHeightField(heightAt, bounds, res = 128) {
    if (!heightAt || !bounds) { uniforms.heightTex.value = noHeight; uniforms.heightBounds.value.set(0, 0, 0, 0); return; }
    const w = res, h = res;
    const sx = (bounds.maxX - bounds.minX) || 1, sz = (bounds.maxZ - bounds.minZ) || 1;
    const data = new Float32Array(w * h);
    for (let j = 0; j < h; j++) {
      const z = bounds.minZ + (j / (h - 1)) * sz;
      for (let i = 0; i < w; i++) {
        const x = bounds.minX + (i / (w - 1)) * sx;
        let y = 0;
        try { y = heightAt(x, z); } catch { y = 0; }
        data[j * w + i] = Number.isFinite(y) ? y : 0;
      }
    }
    const old = uniforms.heightTex.value;
    uniforms.heightTex.value = makeHalfTex(THREE, data, w, h);
    if (old && old !== noHeight) old.dispose();
    // texel centres: uv = (x - minX) / size maps 0..1 onto texel centres closely enough
    uniforms.heightBounds.value.set(bounds.minX, bounds.minZ, 1 / sx, 1 / sz);
  }

  // ------------------------------------------------------------------ settings
  function applyColourBlind() {
    const c = cueColours(settings?.get?.('colourBlind') || 'none');
    uniforms.almostColor.value.set(c.almost);
    uniforms.goldenColor.value.set(c.golden);
  }
  applyColourBlind();
  const unsub = settings?.subscribe?.((k) => { if (k === 'colourBlind') applyColourBlind(); });

  // Make foreign materials safe to render: unique program keys for custom
  // onBeforeCompile hooks (minifier-proof), and no stray 'emissive' on basic
  // materials (three's uniform refresh would read a missing uniform).
  const fnIds = new WeakMap();
  let fnNext = 1;
  const defaultKey = THREE.Material.prototype.customProgramCacheKey;
  function sanitizeMaterial(m) {
    if (!m || m.userData.gpSanitised) return;
    m.userData.gpSanitised = true;
    if (m.isMeshBasicMaterial && 'emissive' in m) { delete m.emissive; delete m.emissiveIntensity; }
    const obc = m.onBeforeCompile;
    if (typeof obc === 'function' && m.customProgramCacheKey === defaultKey) {
      let id = fnIds.get(obc);
      if (!id) { id = fnNext++; fnIds.set(obc, id); }
      const src = obc.toString();
      m.customProgramCacheKey = () => src + '|gpfn' + id;
    }
  }
  function sanitize(root) {
    if (!root) return;
    root.traverse((o) => {
      if (!o.material) return;
      if (Array.isArray(o.material)) o.material.forEach(sanitizeMaterial); else sanitizeMaterial(o.material);
    });
  }

  function dispose() {
    for (const m of cache.values()) m.dispose();
    for (const m of owned) m.dispose();
    cache.clear();
    owned.clear();
    noHeight.dispose();
    if (uniforms.heightTex.value && uniforms.heightTex.value !== noHeight) uniforms.heightTex.value.dispose();
    if (unsub) unsub();
  }

  return {
    uniforms, toon, sway, water, outline, glow, sanitize,
    // render-internal extras
    itemFx, bird, setHeightField, applyColourBlind, dispose,
    get cacheSize() { return cache.size; },
  };
}

function optKey(o) {
  if (!o) return '';
  return [
    o.rim === false ? 'nr' : '', o.rimStrength ?? '',
    o.emissive != null ? String(o.emissive) : '', o.emissiveIntensity ?? '',
    o.map ? o.map.uuid : '', o.vertexColors ? 'vc' : '',
    o.transparent ? 'tr' : '', o.opacity ?? '', o.side ?? '', o.flatShading ? 'fs' : '',
  ].join(',');
}

function makeHalfTex(THREE, data, w, h) {
  const half = new Uint16Array(data.length);
  for (let i = 0; i < data.length; i++) half[i] = THREE.DataUtils.toHalfFloat(data[i]);
  const tex = new THREE.DataTexture(half, w, h, THREE.RedFormat, THREE.HalfFloatType);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}
