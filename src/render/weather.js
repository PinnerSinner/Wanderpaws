// Weather particles that cost no CPU at all: a fixed set of instanced quads
// whose positions are computed in the vertex shader and wrapped in a box that
// travels with the camera. Rain streaks, drifting snow, a samba-parade
// confetti drizzle and data-storm glyphs. Fog and aurora are handled by the
// lighting and sky. Slow, soft and photosensitivity-safe.

const KIND = { rain: 0, snow: 1, parade: 2, datastorm: 3 };

export function createWeather(THREE, { capacity = 1100 } = {}) {
  const seeds = new Float32Array(capacity * 4);
  let s = 12345;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = 0; i < capacity * 4; i++) seeds[i] = rnd();
  const geo = new THREE.InstancedBufferGeometry();
  const quad = new THREE.PlaneGeometry(1, 1);
  geo.index = quad.index;
  geo.setAttribute('position', quad.getAttribute('position'));
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 4));
  geo.instanceCount = 0;

  const uniforms = {
    ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
    uTime: { value: 0 },
    uCam: { value: new THREE.Vector3() },
    uBox: { value: new THREE.Vector3(30, 18, 30) },
    uKind: { value: 0 },
    uIntensity: { value: 1 },
    uScale: { value: 1 },
    uWind: { value: new THREE.Vector2(0.8, 0.3) },
    uColA: { value: new THREE.Color('#dfefff') },
    uColB: { value: new THREE.Color('#ffffff') },
  };
  const mat = new THREE.ShaderMaterial({
    name: 'gp-weather',
    uniforms,
    vertexShader: /* glsl */`
#include <common>
#include <fog_pars_vertex>
attribute vec4 aSeed;
uniform float uTime, uKind, uIntensity, uScale;
uniform vec3 uCam, uBox;
uniform vec2 uWind;
varying vec2 vUv;
varying float vSeed;
varying float vFade;
void main() {
  vUv = position.xy + 0.5;
  vSeed = aSeed.w;
  if ( aSeed.w > uIntensity ) { gl_Position = vec4( 0.0, 0.0, -2.0, 1.0 ); return; }
  int k = int( uKind + 0.5 );
  vec3 vel; float size; float stretch = 1.0;
  if ( k == 0 ) { vel = vec3( uWind.x * 2.0, -11.0 - aSeed.y * 4.0, uWind.y * 2.0 ); size = 0.018; stretch = 22.0; }
  else if ( k == 1 ) { vel = vec3( uWind.x * 0.6, -0.9 - aSeed.y * 0.5, uWind.y * 0.6 ); size = 0.06 + aSeed.x * 0.05; }
  else if ( k == 2 ) { vel = vec3( uWind.x * 0.4, -0.7 - aSeed.y * 0.4, uWind.y * 0.4 ); size = 0.07 + aSeed.z * 0.04; }
  else { vel = vec3( 0.0, -1.1 - aSeed.y * 0.8, 0.0 ); size = 0.16 + aSeed.x * 0.08; }
  vel *= uScale;
  size *= uScale;
  vec3 box = uBox;
  vec3 p = aSeed.xyz * box + vel * uTime;
  if ( k == 1 || k == 2 ) p.xz += vec2( sin( uTime * 0.7 + aSeed.x * 30.0 ), cos( uTime * 0.6 + aSeed.z * 30.0 ) ) * 0.4 * uScale;
  p = mod( p - uCam + box * 0.5, box ) - box * 0.5 + uCam;
  // fade near the box edges so wrapping never pops
  vec3 rel = abs( p - uCam ) / ( box * 0.5 );
  vFade = 1.0 - smoothstep( 0.75, 1.0, max( rel.x, max( rel.y, rel.z ) ) );
  vec4 mvPosition = viewMatrix * vec4( p, 1.0 );
  vec2 c = position.xy;
  if ( k == 0 ) {
    // streak along the projected fall direction
    vec3 vv = ( viewMatrix * vec4( normalize( vel ), 0.0 ) ).xyz;
    vec2 dir = normalize( vv.xy + vec2( 1e-4 ) );
    vec2 side = vec2( -dir.y, dir.x );
    mvPosition.xy += side * c.x * size + dir * c.y * size * stretch;
  } else {
    float ang = uTime * ( 0.5 + aSeed.z * 2.0 ) + aSeed.x * 6.28;
    if ( k == 2 ) c.x *= cos( uTime * 5.0 + aSeed.y * 20.0 );
    if ( k == 3 ) ang = 0.0;
    float cs = cos( ang ), sn = sin( ang );
    mvPosition.xy += vec2( cs * c.x - sn * c.y, sn * c.x + cs * c.y ) * size;
  }
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`,
    fragmentShader: /* glsl */`
#include <common>
#include <fog_pars_fragment>
uniform float uKind;
uniform vec3 uColA, uColB;
varying vec2 vUv;
varying float vSeed;
varying float vFade;
vec3 hsv( float h ) { return clamp( abs( mod( h * 6.0 + vec3( 0.0, 4.0, 2.0 ), 6.0 ) - 3.0 ) - 1.0, 0.0, 1.0 ); }
void main() {
  vec2 q = vUv * 2.0 - 1.0;
  int k = int( uKind + 0.5 );
  float a; vec3 col = mix( uColA, uColB, fract( vSeed * 7.31 ) );
  if ( k == 0 ) { a = ( 1.0 - abs( q.x ) ) * ( 1.0 - q.y * q.y ) * 0.45; }
  else if ( k == 1 ) { a = pow( clamp( 1.0 - length( q ), 0.0, 1.0 ), 1.2 ) * 0.95; }
  else if ( k == 2 ) {
    vec2 b = abs( q ) - vec2( 0.8, 0.5 ); a = 1.0 - smoothstep( -0.1, 0.02, max( b.x, b.y ) );
    col = mix( hsv( fract( vSeed * 13.7 ) ), vec3( 1.0 ), 0.3 );
  } else {
    float one = step( 0.5, fract( vSeed * 3.7 ) );
    float zero = 1.0 - smoothstep( 0.0, 0.16, abs( length( q * vec2( 1.6, 1.0 ) ) - 0.7 ) );
    float bar = ( 1.0 - smoothstep( 0.12, 0.22, abs( q.x ) ) ) * ( 1.0 - smoothstep( 0.8, 0.9, abs( q.y ) ) );
    a = mix( zero, bar, one ) * 0.85;
    col *= 1.3;
  }
  a *= vFade;
  if ( a < 0.01 ) discard;
  gl_FragColor = vec4( col, a );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`,
    transparent: true,
    depthWrite: false,
    fog: true,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'gp-weather';
  mesh.frustumCulled = false;
  mesh.renderOrder = 11;
  mesh.visible = false;

  let cap = capacity;
  let kind = 'clear';
  let intensity = 0;

  function set(k, inten = 1) {
    kind = k;
    intensity = inten;
    const id = KIND[k];
    if (id === undefined || inten <= 0.001) { mesh.visible = false; geo.instanceCount = 0; return; }
    mesh.visible = true;
    uniforms.uKind.value = id;
    if (id === 0) { uniforms.uColA.value.set('#d8e8ff'); uniforms.uColB.value.set('#ffffff'); }
    else if (id === 1) { uniforms.uColA.value.set('#ffffff'); uniforms.uColB.value.set('#e6f0ff'); }
    else if (id === 3) { uniforms.uColA.value.set('#9effd8'); uniforms.uColB.value.set('#d4b8ff'); }
    const want = id === 0 ? cap : id === 1 ? Math.round(cap * 0.8) : id === 2 ? Math.round(cap * 0.45) : Math.round(cap * 0.3);
    geo.instanceCount = Math.min(capacity, want);
  }

  function update(time, camPos, size, wind) {
    uniforms.uTime.value = time;
    uniforms.uCam.value.copy(camPos);
    // the weather box scales with the player so it always fills the view
    const sc = Math.max(0.3, Math.min(40, size * 1.2 + 0.4));
    uniforms.uScale.value = sc;
    uniforms.uBox.value.set(28 * sc, 16 * sc, 28 * sc);
    uniforms.uIntensity.value = Math.min(1, Math.max(0, intensity));
    if (wind) uniforms.uWind.value.copy(wind);
  }

  return {
    mesh, set, update,
    get kind() { return kind; },
    setCap(n) { cap = Math.min(capacity, n); set(kind, intensity); },
    get count() { return mesh.visible ? Math.round(geo.instanceCount * Math.min(1, intensity)) : 0; },
    dispose() { geo.dispose(); quad.dispose(); mat.dispose(); },
  };
}
