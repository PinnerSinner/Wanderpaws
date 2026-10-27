// Light post-processing for Medium and up: render to an HDR target (MSAA),
// a cheap bloom (bright pass at quarter res, two blur levels), god rays on
// High (a radial blur of the sky near the sun at half res, using depth as the
// sky mask), then one final pass for tone mapping, warm colour grading, a soft
// vignette, photo filters and the sRGB conversion.

import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';

const VERT = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }`;

export const PHOTO_FILTERS = ['none', 'golden', 'dreamy', 'storybook', 'mono'];

export function createPost(THREE, renderer) {
  const size = new THREE.Vector2();
  const rtOpts = { type: THREE.HalfFloatType, depthBuffer: false };
  let scene = null;
  let samples = 4;
  let w = 1, h = 1;

  function makeSceneRT() {
    const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples });
    rt.depthTexture = new THREE.DepthTexture(w, h);
    rt.depthTexture.type = THREE.UnsignedIntType;
    return rt;
  }
  scene = makeSceneRT();
  const brightRT = new THREE.WebGLRenderTarget(1, 1, rtOpts);
  const blurA = new THREE.WebGLRenderTarget(1, 1, rtOpts);
  const blurB = new THREE.WebGLRenderTarget(1, 1, rtOpts);
  const blurC = new THREE.WebGLRenderTarget(1, 1, rtOpts);
  const blurD = new THREE.WebGLRenderTarget(1, 1, rtOpts);
  const raysRT = new THREE.WebGLRenderTarget(1, 1, rtOpts);
  for (const t of [brightRT, blurA, blurB, blurC, blurD, raysRT]) { t.texture.minFilter = THREE.LinearFilter; t.texture.magFilter = THREE.LinearFilter; }

  const brightMat = new THREE.ShaderMaterial({
    uniforms: { tSrc: { value: null }, uThreshold: { value: 1.0 }, uKnee: { value: 0.5 }, uTexel: { value: new THREE.Vector2() } },
    vertexShader: VERT,
    fragmentShader: /* glsl */`
uniform sampler2D tSrc; uniform float uThreshold, uKnee; uniform vec2 uTexel; varying vec2 vUv;
void main() {
  // 4-tap box downsample, then a soft-knee threshold
  vec3 c = texture2D( tSrc, vUv + uTexel * vec2( -1.0, -1.0 ) ).rgb + texture2D( tSrc, vUv + uTexel * vec2( 1.0, -1.0 ) ).rgb
         + texture2D( tSrc, vUv + uTexel * vec2( -1.0, 1.0 ) ).rgb + texture2D( tSrc, vUv + uTexel * vec2( 1.0, 1.0 ) ).rgb;
  c *= 0.25;
  float l = max( c.r, max( c.g, c.b ) );
  float soft = clamp( l - uThreshold + uKnee, 0.0, 2.0 * uKnee );
  soft = soft * soft / ( 4.0 * uKnee + 1e-4 );
  float contrib = max( soft, l - uThreshold ) / max( l, 1e-4 );
  gl_FragColor = vec4( min( c * contrib, vec3( 8.0 ) ), 1.0 );
}`,
    depthTest: false, depthWrite: false,
  });
  const blurMat = new THREE.ShaderMaterial({
    uniforms: { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } },
    vertexShader: VERT,
    fragmentShader: /* glsl */`
uniform sampler2D tSrc; uniform vec2 uDir; varying vec2 vUv;
void main() {
  vec3 c = texture2D( tSrc, vUv ).rgb * 0.227027;
  c += texture2D( tSrc, vUv + uDir * 1.384615 ).rgb * 0.316216;
  c += texture2D( tSrc, vUv - uDir * 1.384615 ).rgb * 0.316216;
  c += texture2D( tSrc, vUv + uDir * 3.230769 ).rgb * 0.070270;
  c += texture2D( tSrc, vUv - uDir * 3.230769 ).rgb * 0.070270;
  gl_FragColor = vec4( c, 1.0 );
}`,
    depthTest: false, depthWrite: false,
  });
  const raysMat = new THREE.ShaderMaterial({
    uniforms: {
      tSrc: { value: null }, tDepth: { value: null }, uSun: { value: new THREE.Vector2(0.5, 0.8) },
      uStrength: { value: 0 }, uAspect: { value: 1 },
    },
    vertexShader: VERT,
    fragmentShader: /* glsl */`
uniform sampler2D tSrc; uniform sampler2D tDepth; uniform vec2 uSun; uniform float uStrength, uAspect; varying vec2 vUv;
float skyMask( vec2 uv ) {
  float d = texture2D( tDepth, uv ).r;
  vec2 dd = ( uv - uSun ) * vec2( uAspect, 1.0 );
  float near = exp( -dot( dd, dd ) * 7.0 );
  vec3 c = texture2D( tSrc, uv ).rgb;
  return step( 0.99999, d ) * near * clamp( max( c.r, max( c.g, c.b ) ), 0.0, 2.0 );
}
void main() {
  vec2 delta = ( vUv - uSun ) / 28.0 * 0.92;
  vec2 uv = vUv;
  float acc = 0.0, wgt = 1.0;
  for ( int i = 0; i < 28; i ++ ) { acc += skyMask( uv ) * wgt; wgt *= 0.955; uv -= delta; }
  gl_FragColor = vec4( vec3( acc / 28.0 * uStrength ), 1.0 );
}`,
    depthTest: false, depthWrite: false,
  });
  const finalMat = new THREE.ShaderMaterial({
    uniforms: {
      tScene: { value: null }, tBloomA: { value: null }, tBloomB: { value: null }, tRays: { value: null },
      uBloom: { value: 0.0 }, uRays: { value: 0 }, uRaysColor: { value: new THREE.Color('#ffd7a0') },
      uExposure: { value: 1.0 }, uWarm: { value: 0 }, uSat: { value: 1.06 }, uVignette: { value: 0.22 },
      uLift: { value: new THREE.Color('#2a1c3a') }, uFilter: { value: 0 }, uTime: { value: 0 }, uAspect: { value: 1 },
    },
    vertexShader: VERT,
    fragmentShader: /* glsl */`
uniform sampler2D tScene, tBloomA, tBloomB, tRays;
uniform float uBloom, uRays, uExposure, uWarm, uSat, uVignette, uFilter, uTime, uAspect;
uniform vec3 uRaysColor, uLift;
varying vec2 vUv;
vec3 neutralTone( vec3 color ) {
  const float StartCompression = 0.8 - 0.04;
  const float Desaturation = 0.15;
  float x = min( color.r, min( color.g, color.b ) );
  float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
  color -= offset;
  float peak = max( color.r, max( color.g, color.b ) );
  if ( peak < StartCompression ) return color;
  float d = 1.0 - StartCompression;
  float newPeak = 1.0 - d * d / ( peak + d - StartCompression );
  color *= newPeak / peak;
  float g = 1.0 - 1.0 / ( Desaturation * ( peak - newPeak ) + 1.0 );
  return mix( color, vec3( newPeak ), g );
}
vec3 toSRGB( vec3 c ) {
  return mix( c * 12.92, pow( c, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), step( vec3( 0.0031308 ), c ) );
}
void main() {
  vec3 c = texture2D( tScene, vUv ).rgb;
  c += ( texture2D( tBloomA, vUv ).rgb * 0.6 + texture2D( tBloomB, vUv ).rgb * 0.8 ) * uBloom;
  c += texture2D( tRays, vUv ).r * uRaysColor * uRays;
  c *= uExposure;
  // warm grade: push the highlights golden at sunset, keep the shadows soft violet
  float l = dot( c, vec3( 0.2126, 0.7152, 0.0722 ) );
  c = mix( c, c * vec3( 1.06, 1.0, 0.9 ), uWarm );
  c = mix( vec3( l ), c, uSat );
  c = max( c, vec3( 0.0 ) );
  c = neutralTone( c );
  c += uLift * 0.06 * ( 1.0 - smoothstep( 0.0, 0.5, l ) );
  // photo filters
  int f = int( uFilter + 0.5 );
  if ( f == 1 ) { c = mix( c, c * vec3( 1.12, 1.0, 0.82 ), 0.8 ); }
  else if ( f == 2 ) { c = mix( c, vec3( dot( c, vec3( 0.3, 0.55, 0.15 ) ) ) * vec3( 1.05, 0.98, 1.1 ), 0.25 ) + vec3( 0.04, 0.02, 0.06 ); }
  else if ( f == 3 ) { c = floor( c * 7.0 + 0.5 ) / 7.0 * 0.6 + c * 0.4; c = mix( vec3( dot( c, vec3( 0.33 ) ) ), c, 1.15 ); }
  else if ( f == 4 ) { float m = dot( c, vec3( 0.3, 0.59, 0.11 ) ); c = vec3( m ) * vec3( 1.06, 1.0, 0.9 ); }
  vec2 v = ( vUv - 0.5 ) * vec2( uAspect, 1.0 ) / max( uAspect, 1.0 );
  float vig = 1.0 - uVignette * smoothstep( 0.25, 0.85, length( v ) * 1.3 );
  c *= vig;
  c = toSRGB( clamp( c, 0.0, 1.0 ) );
  gl_FragColor = vec4( c, 1.0 );
}`,
    depthTest: false, depthWrite: false, toneMapped: false,
  });

  const quad = new FullScreenQuad(null);
  let bloomOn = true, raysOn = false;
  const sunUv = new THREE.Vector2();

  function setSize(width, height, pixelRatio) {
    w = Math.max(1, Math.floor(width * pixelRatio));
    h = Math.max(1, Math.floor(height * pixelRatio));
    scene.setSize(w, h);
    if (scene.depthTexture) { scene.depthTexture.image.width = w; scene.depthTexture.image.height = h; }
    const qw = Math.max(1, w >> 2), qh = Math.max(1, h >> 2);
    brightRT.setSize(qw, qh); blurA.setSize(qw, qh); blurB.setSize(qw, qh);
    blurC.setSize(Math.max(1, qw >> 1), Math.max(1, qh >> 1)); blurD.setSize(Math.max(1, qw >> 1), Math.max(1, qh >> 1));
    raysRT.setSize(Math.max(1, w >> 1), Math.max(1, h >> 1));
    finalMat.uniforms.uAspect.value = w / h;
    raysMat.uniforms.uAspect.value = w / h;
  }

  function pass(mat, target) {
    quad.material = mat;
    renderer.setRenderTarget(target);
    quad.render(renderer);
  }

  // mood: { warmth, sunScreen (NDC), sunVisible } from lighting
  function render(scene3, camera, mood, opts) {
    renderer.setRenderTarget(scene);
    renderer.render(scene3, camera);
    const fu = finalMat.uniforms;
    if (bloomOn) {
      brightMat.uniforms.tSrc.value = scene.texture;
      brightMat.uniforms.uTexel.value.set(1 / w, 1 / h);
      brightMat.uniforms.uThreshold.value = opts.bloomThreshold ?? 0.95;
      pass(brightMat, brightRT);
      blurMat.uniforms.tSrc.value = brightRT.texture; blurMat.uniforms.uDir.value.set(1 / brightRT.width, 0); pass(blurMat, blurA);
      blurMat.uniforms.tSrc.value = blurA.texture; blurMat.uniforms.uDir.value.set(0, 1 / brightRT.height); pass(blurMat, blurB);
      blurMat.uniforms.tSrc.value = blurB.texture; blurMat.uniforms.uDir.value.set(2 / blurC.width, 0); pass(blurMat, blurC);
      blurMat.uniforms.tSrc.value = blurC.texture; blurMat.uniforms.uDir.value.set(0, 2 / blurC.height); pass(blurMat, blurD);
      fu.tBloomA.value = blurB.texture; fu.tBloomB.value = blurD.texture;
      fu.uBloom.value = opts.bloom ?? 0.55;
    } else {
      fu.tBloomA.value = blurB.texture; fu.tBloomB.value = blurD.texture; fu.uBloom.value = 0;
    }
    fu.uRays.value = 0;
    if (raysOn && mood && mood.sunVisible > 0.01) {
      sunUv.set(mood.sunScreen.x * 0.5 + 0.5, mood.sunScreen.y * 0.5 + 0.5);
      if (sunUv.x > -0.3 && sunUv.x < 1.3 && sunUv.y > -0.3 && sunUv.y < 1.5) {
        raysMat.uniforms.tSrc.value = scene.texture;
        raysMat.uniforms.tDepth.value = scene.depthTexture;
        raysMat.uniforms.uSun.value.copy(sunUv);
        raysMat.uniforms.uStrength.value = 1;
        pass(raysMat, raysRT);
        fu.uRays.value = 0.55 * mood.sunVisible * (0.6 + mood.warmth * 0.8);
      }
    }
    fu.tRays.value = raysRT.texture;
    fu.tScene.value = scene.texture;
    fu.uWarm.value = mood ? 0.15 + mood.warmth * 0.6 : 0.2;
    fu.uFilter.value = opts.filter || 0;
    fu.uVignette.value = opts.vignette ?? 0.22;
    fu.uExposure.value = opts.exposure ?? 1;
    pass(finalMat, null);
  }

  function configure(tier) {
    bloomOn = !!tier.bloom;
    raysOn = !!tier.godRays;
    const want = tier.msaa || 0;
    if (want !== samples) {
      samples = want;
      scene.dispose();
      scene = makeSceneRT();
      scene.setSize(w, h);
    }
  }

  renderer.getSize(size);

  return {
    render, setSize, configure,
    get passes() { return 1 + (bloomOn ? 5 : 0) + (raysOn ? 1 : 0) + 1; },
    dispose() {
      for (const t of [scene, brightRT, blurA, blurB, blurC, blurD, raysRT]) t.dispose();
      brightMat.dispose(); blurMat.dispose(); raysMat.dispose(); finalMat.dispose(); quad.dispose();
    },
  };
}
