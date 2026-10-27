// Pooled GPU particles: one instanced quad mesh, one draw call. The CPU only
// writes a particle once when it spawns (start position, velocity, birth time,
// life, sizes, colour, shape); the vertex shader integrates motion with drag
// and gravity, so there's no per-frame CPU work per particle.
//
// Shapes: soft dot, ring, confetti, droplet, heart, sparkle, glyph 0/1, paw
// print, bubble, five-point star, leaf. Ground-aligned particles (rings,
// ripples, footprints) lie flat on the terrain.

import { createRingPool } from './pure/pool.js';

export const PK = Object.freeze({
  DOT: 0, RING: 1, CONFETTI: 2, DROP: 3, HEART: 4, SPARKLE: 5, GLYPH0: 6, GLYPH1: 7,
  PAW: 8, BUBBLE: 10, STAR: 12, LEAF: 13, NOTE: 14,
});
export const PF = Object.freeze({ GROUND: 1, FLIP: 4, POP: 8 });

const STRIDE = 20;

export function createParticles(THREE, { capacity = 2500, cap = 1000 } = {}) {
  const pool = createRingPool(capacity, cap);
  const data = new Float32Array(capacity * STRIDE);
  // park everything as long dead
  for (let i = 0; i < capacity; i++) { data[i * STRIDE + 3] = -1e6; data[i * STRIDE + 7] = 0.001; }
  const buf = new THREE.InstancedInterleavedBuffer(data, STRIDE, 1);
  buf.setUsage(THREE.DynamicDrawUsage);

  const geo = new THREE.InstancedBufferGeometry();
  const quad = new THREE.PlaneGeometry(1, 1);
  geo.index = quad.index;
  geo.setAttribute('position', quad.getAttribute('position'));
  geo.setAttribute('aP0', new THREE.InterleavedBufferAttribute(buf, 4, 0));
  geo.setAttribute('aV0', new THREE.InterleavedBufferAttribute(buf, 4, 4));
  geo.setAttribute('aS', new THREE.InterleavedBufferAttribute(buf, 4, 8));
  geo.setAttribute('aC', new THREE.InterleavedBufferAttribute(buf, 4, 12));
  geo.setAttribute('aK', new THREE.InterleavedBufferAttribute(buf, 4, 16));
  geo.instanceCount = cap;

  const uniforms = {
    ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
    uTime: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    name: 'gp-particles',
    uniforms,
    vertexShader: /* glsl */`
#include <common>
#include <fog_pars_vertex>
attribute vec4 aP0;
attribute vec4 aV0;
attribute vec4 aS;
attribute vec4 aC;
attribute vec4 aK;
uniform float uTime;
varying vec4 vC;
varying vec2 vUv;
varying float vKind;
varying float vT;
void main() {
  float age = uTime - aP0.w;
  float life = max( aV0.w, 1e-3 );
  float t = age / life;
  if ( t < 0.0 || t > 1.0 ) { gl_Position = vec4( 0.0, 0.0, -2.0, 1.0 ); return; }
  float drag = aS.w;
  float k = drag > 0.001 ? ( 1.0 - exp( -drag * age ) ) / drag : age;
  vec3 p = aP0.xyz + aV0.xyz * k;
  p.y -= 0.5 * aS.z * age * age;
  float flags = aK.w;
  float ground = mod( flags, 2.0 );
  float flip = mod( floor( flags / 4.0 ), 2.0 );
  float pop = mod( floor( flags / 8.0 ), 2.0 );
  float e = pop > 0.5 ? 1.0 - pow( 1.0 - t, 3.0 ) : t;
  float sz = mix( aS.x, aS.y, e );
  float ang = aK.z + aK.y * age;
  vec2 corner = position.xy;
  if ( flip > 0.5 ) corner.x *= cos( age * 7.0 + aK.z * 3.0 );
  float c = cos( ang ), s = sin( ang );
  vec2 rc = vec2( c * corner.x - s * corner.y, s * corner.x + c * corner.y ) * sz;
  vec4 mvPosition;
  if ( ground > 0.5 ) {
    mvPosition = viewMatrix * vec4( p + vec3( rc.x, 0.0, rc.y ), 1.0 );
  } else {
    mvPosition = viewMatrix * vec4( p, 1.0 );
    mvPosition.xy += rc;
  }
  gl_Position = projectionMatrix * mvPosition;
  vUv = position.xy + 0.5;
  vC = aC;
  vKind = aK.x;
  vT = t;
  #include <fog_vertex>
}`,
    fragmentShader: /* glsl */`
#include <common>
#include <fog_pars_fragment>
varying vec4 vC;
varying vec2 vUv;
varying float vKind;
varying float vT;
float circ( vec2 q, vec2 c, float r ) { return 1.0 - smoothstep( r - 0.08, r + 0.02, length( q - c ) ); }
float heart( vec2 q ) {
  q.y = -q.y * 1.1 + 0.15;
  q.x = abs( q.x );
  float a = atan( q.x, q.y ) / 3.14159;
  float r = length( q );
  float h = abs( a );
  float d = ( 13.0 * h - 22.0 * h * h + 10.0 * h * h * h ) / ( 6.0 - 5.0 * h );
  return 1.0 - smoothstep( d * 0.78 - 0.08, d * 0.78, r );
}
float star5( vec2 q ) {
  float a = atan( q.y, q.x ) + 1.5708;
  float r = length( q );
  float k = 0.55 + 0.45 * pow( abs( cos( a * 2.5 ) ), 2.5 );
  return 1.0 - smoothstep( k * 0.9 - 0.06, k * 0.9, r );
}
void main() {
  vec2 q = vUv * 2.0 - 1.0;
  float r = length( q );
  int k = int( vKind + 0.5 );
  float a = 0.0;
  float fade = smoothstep( 0.0, 0.06, vT ) * ( 1.0 - smoothstep( 0.6, 1.0, vT ) );
  if ( k == 0 ) { a = pow( clamp( 1.0 - r, 0.0, 1.0 ), 1.4 ); }
  else if ( k == 1 ) { a = ( 1.0 - smoothstep( 0.0, 0.14, abs( r - 0.82 ) ) ) * ( 1.0 - vT ); fade = smoothstep( 0.0, 0.05, vT ); }
  else if ( k == 2 ) { vec2 b = abs( q ) - vec2( 0.85, 0.5 ); a = 1.0 - smoothstep( -0.08, 0.02, max( b.x, b.y ) ); }
  else if ( k == 3 ) { vec2 qq = q; qq.y += 0.25; float d = length( qq * vec2( 1.0, 1.0 + max( 0.0, qq.y ) * 1.4 ) ); a = 1.0 - smoothstep( 0.55, 0.65, d ); }
  else if ( k == 4 ) { a = heart( q ); }
  else if ( k == 5 ) { float s = 0.05 / ( abs( q.x * q.y ) + 0.035 ); a = clamp( s * ( 1.0 - r ), 0.0, 1.0 ) + pow( clamp( 1.0 - r * 2.0, 0.0, 1.0 ), 2.0 ); a = clamp( a, 0.0, 1.0 ); }
  else if ( k == 6 ) { float d = length( q * vec2( 1.5, 1.0 ) ); a = 1.0 - smoothstep( 0.0, 0.14, abs( d - 0.7 ) ); }
  else if ( k == 7 ) { a = ( 1.0 - smoothstep( 0.14, 0.24, abs( q.x ) ) ) * ( 1.0 - smoothstep( 0.8, 0.9, abs( q.y ) ) ); }
  else if ( k == 8 ) { a = max( circ( q * vec2( 1.0, 1.15 ), vec2( 0.0, -0.3 ), 0.4 ), max( max( circ( q, vec2( -0.5, 0.25 ), 0.17 ), circ( q, vec2( 0.5, 0.25 ), 0.17 ) ), max( circ( q, vec2( -0.18, 0.58 ), 0.17 ), circ( q, vec2( 0.18, 0.58 ), 0.17 ) ) ) ); }
  else if ( k == 10 ) { a = ( 1.0 - smoothstep( 0.0, 0.12, abs( r - 0.8 ) ) ) * 0.8 + circ( q, vec2( -0.3, 0.3 ), 0.18 ) * 0.9; }
  else if ( k == 12 ) { a = star5( q ); }
  else if ( k == 13 ) { float d = abs( q.x ) + q.y * q.y * 0.6; a = ( 1.0 - smoothstep( 0.42, 0.5, abs( q.x ) * 1.8 + q.y * q.y ) ); }
  else if ( k == 14 ) { a = max( circ( q * vec2( 1.0, 1.3 ), vec2( -0.15, -0.55 ), 0.32 ), ( 1.0 - smoothstep( 0.06, 0.13, abs( q.x - 0.13 ) ) ) * step( -0.6, q.y ) * step( q.y, 0.7 ) ); }
  else { a = 1.0 - smoothstep( 0.8, 1.0, r ); }
  a *= vC.a * fade;
  if ( a < 0.004 ) discard;
  gl_FragColor = vec4( vC.rgb, a );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`,
    transparent: true,
    depthWrite: false,
    fog: true,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -4,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'gp-particles';
  mesh.frustumCulled = false;
  mesh.renderOrder = 10;

  let now = 0;
  const range = [0, 0];

  function spawn(kind, x, y, z, vx, vy, vz, life, s0, s1, r, g, b, a, gravity = 0, drag = 0, spin = 0, rot = 0, flags = 0) {
    const i = pool.alloc(now, life);
    const o = i * STRIDE;
    data[o] = x; data[o + 1] = y; data[o + 2] = z; data[o + 3] = now;
    data[o + 4] = vx; data[o + 5] = vy; data[o + 6] = vz; data[o + 7] = life;
    data[o + 8] = s0; data[o + 9] = s1; data[o + 10] = gravity; data[o + 11] = drag;
    data[o + 12] = r; data[o + 13] = g; data[o + 14] = b; data[o + 15] = a;
    data[o + 16] = kind; data[o + 17] = spin; data[o + 18] = rot; data[o + 19] = flags;
    return i;
  }

  function update(time) {
    now = time;
    uniforms.uTime.value = time;
    if (pool.takeDirty(range)) {
      buf.clearUpdateRanges();
      buf.addUpdateRange(range[0] * STRIDE, (range[1] - range[0] + 1) * STRIDE);
      buf.needsUpdate = true;
    }
  }

  function setCap(n) {
    pool.setCap(Math.min(capacity, n), now);
    geo.instanceCount = pool.cap;
  }

  function clear() {
    for (let i = 0; i < capacity; i++) { data[i * STRIDE + 3] = -1e6; data[i * STRIDE + 7] = 0.001; }
    pool.clear();
  }

  return {
    mesh, spawn, update, setCap, clear, pool,
    get now() { return now; },
    alive() { return pool.alive(now); },
    dispose() { geo.dispose(); quad.dispose(); mat.dispose(); },
  };
}
