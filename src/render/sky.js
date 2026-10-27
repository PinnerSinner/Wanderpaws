// Sky dome: a gradient with a sun disc and halo, soft drifting clouds, stars
// at night and an optional pastel aurora band. One draw call, follows the camera.

import { NOISE } from './glsl.js';

export function createSky(THREE) {
  const uniforms = {
    uTop: { value: new THREE.Color('#7fc8f0') },
    uHorizon: { value: new THREE.Color('#ffe3b0') },
    uBottom: { value: new THREE.Color('#ffe3b0') },
    uSunDir: { value: new THREE.Vector3(0.3, 0.6, 0.4).normalize() },
    uSunColor: { value: new THREE.Color('#fff1d0') },
    uWarm: { value: 0 },
    uNight: { value: 0 },
    uTime: { value: 0 },
    uClouds: { value: 1 },
    uCloudColor: { value: new THREE.Color('#ffffff') },
    uAurora: { value: 0 },
    uSunSize: { value: 1 },
    uStudio: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    name: 'gp-sky',
    uniforms,
    vertexShader: /* glsl */`
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
  gl_Position = p.xyww;
}`,
    fragmentShader: /* glsl */`
#include <common>
uniform vec3 uTop, uHorizon, uBottom, uSunDir, uSunColor, uCloudColor;
uniform float uWarm, uNight, uTime, uClouds, uAurora, uSunSize, uStudio;
varying vec3 vDir;
${NOISE}
void main() {
  vec3 d = normalize( vDir );
  float h = d.y;
  // gradient: horizon band, then the top colour; below the horizon fades to the bottom colour
  float up = pow( clamp( h, 0.0, 1.0 ), 0.55 );
  vec3 col = mix( uHorizon, uTop, up );
  col = mix( col, uBottom, smoothstep( 0.0, -0.25, h ) );

  // the sun: warm glow around it (wide at sunset), a halo and a soft disc
  float sd = dot( d, uSunDir );
  float sdc = clamp( sd, 0.0, 1.0 );
  float glowW = mix( 6.0, 2.5, uWarm );
  col += uSunColor * pow( sdc, glowW ) * ( 0.18 + 0.45 * uWarm ) * ( 1.0 - uNight );
  col += uSunColor * pow( sdc, 64.0 ) * 0.35 * ( 1.0 - uNight * 0.6 );
  float disc = smoothstep( 0.99935 - 0.0003 * uSunSize, 0.99965 - 0.0002 * uSunSize, sd );
  col = mix( col, uSunColor * 1.8 + vec3( 0.25 ), disc * ( 1.0 - uStudio ) );
  // horizon warmth on the sun's side at golden hour
  float az = clamp( dot( normalize( d.xz + 1e-4 ), normalize( uSunDir.xz + 1e-4 ) ) * 0.5 + 0.5, 0.0, 1.0 );
  col += vec3( 1.0, 0.45, 0.25 ) * uWarm * 0.22 * pow( az, 3.0 ) * exp( -abs( h ) * 7.0 ) * ( 1.0 - uNight );

  // stars
  if ( uNight > 0.01 && h > 0.0 ) {
    vec2 sp = d.xz / ( h + 0.35 ) * 180.0;
    vec2 cell = floor( sp );
    float r = gpHash12( cell );
    vec2 off = vec2( gpHash12( cell + 7.1 ), gpHash12( cell + 3.3 ) ) - 0.5;
    float star = smoothstep( 0.35, 0.0, length( fract( sp ) - 0.5 - off * 0.6 ) ) * step( 0.93, r );
    float tw = 0.75 + 0.25 * sin( uTime * ( 0.8 + r * 1.4 ) + r * 40.0 );
    col += vec3( 1.0, 0.97, 0.9 ) * star * tw * uNight * smoothstep( 0.0, 0.25, h ) * 0.9;
  }

  // aurora: soft pastel curtains, slow drift (no flicker)
  if ( uAurora > 0.01 && h > 0.05 ) {
    float a = atan( d.z, d.x );
    float wave = sin( a * 3.0 + uTime * 0.05 ) * 0.06 + gpNoise( vec2( a * 4.0, uTime * 0.03 ) ) * 0.1;
    float band = smoothstep( 0.0, 0.12, h - 0.18 - wave ) * ( 1.0 - smoothstep( 0.12, 0.42, h - 0.18 - wave ) );
    float curtain = 0.55 + 0.45 * gpNoise( vec2( a * 22.0, uTime * 0.06 ) );
    vec3 ac = mix( vec3( 0.55, 1.0, 0.8 ), vec3( 0.8, 0.6, 1.0 ), smoothstep( 0.18, 0.5, h + wave ) );
    col += ac * band * curtain * uAurora * 0.55;
  }

  // clouds: soft fbm puffs projected on a dome, drifting slowly
  if ( uClouds > 0.01 && h > -0.02 ) {
    vec2 cp = d.xz / ( h + 0.18 ) * 1.4 + vec2( uTime * 0.006, uTime * 0.002 );
    float c = gpFbm( cp );
    c = smoothstep( 0.52, 0.78, c ) * smoothstep( -0.02, 0.18, h );
    // lit from the sun side, a little darker underneath
    vec3 cc = mix( uCloudColor * 0.82 + uHorizon * 0.18, uCloudColor + uSunColor * 0.15, clamp( sd * 0.5 + 0.5, 0.0, 1.0 ) );
    cc = mix( cc, uHorizon * 1.05, smoothstep( 0.3, 0.0, h ) * 0.6 );
    col = mix( col, cc, c * 0.85 * uClouds );
  }

  gl_FragColor = vec4( col, 1.0 );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: true,
    fog: false,
  });
  const geo = new THREE.SphereGeometry(1, 32, 16);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'gp-sky';
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  mesh.matrixAutoUpdate = true;

  return {
    mesh, uniforms,
    follow(camera) {
      mesh.position.copy(camera.position);
      const r = camera.far * 0.9;
      mesh.scale.setScalar(r);
    },
    dispose() { geo.dispose(); mat.dispose(); },
  };
}
