// Lights and mood: the moving sun, hemisphere and ambient from the palette,
// soft shadows that follow the player and scale with size, fog, and the sky
// colours graded by the time of day. Allocation-free per frame.

import { sunState, createSunState } from './pure/sun.js';

const DEFAULT_PALETTE = {
  skyTop: '#7fc8f0', skyBottom: '#ffe3b0', horizon: '#ffe3b0', fog: '#ffe3b0', fogNear: 30, fogFar: 160,
  sun: '#fff1d0', sunIntensity: 2, ambient: '#bcd8f0', ground: '#f2dcae', accent: '#ff7a59',
  water: '#3cc0c8', waterDeep: '#1e7fa0', foam: '#ffffff', outline: '#3a2a22',
};

export function createLighting(THREE, { scene, mats, sky }) {
  const sun = new THREE.DirectionalLight('#fff1d0', 3);
  sun.name = 'gp-sun';
  sun.castShadow = false;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  sun.shadow.intensity = 0.62;
  scene.add(sun);
  scene.add(sun.target);

  const hemi = new THREE.HemisphereLight('#bcd8f0', '#f2dcae', 1.6);
  hemi.name = 'gp-hemi';
  scene.add(hemi);
  const amb = new THREE.AmbientLight('#ffffff', 0.25);
  amb.name = 'gp-amb';
  scene.add(amb);

  const fog = new THREE.Fog('#ffe3b0', 30, 160);
  scene.fog = fog;

  const S = createSunState();
  const c = {
    top: new THREE.Color(), horizon: new THREE.Color(), bottom: new THREE.Color(), fog: new THREE.Color(),
    sun: new THREE.Color(), ambient: new THREE.Color(), ground: new THREE.Color(),
    warmSun: new THREE.Color('#ffa860'), warmSky: new THREE.Color('#ffb48a'), night: new THREE.Color('#1c2350'),
    nightTop: new THREE.Color('#0d1236'), moon: new THREE.Color('#9fb4ff'), tmp: new THREE.Color(), white: new THREE.Color('#ffffff'), violet: new THREE.Color('#7c74b8'),
    palSun: new THREE.Color(), palTop: new THREE.Color(), palHor: new THREE.Color(), palBot: new THREE.Color(),
    palFog: new THREE.Color(), palAmb: new THREE.Color(), palGround: new THREE.Color(), outline: new THREE.Color(),
  };
  const v = new THREE.Vector3();
  let palette = DEFAULT_PALETTE;
  let shadowTier = { shadows: false, shadowMap: 0, shadowRadius: 0 };
  const mood = { warmth: 0, night: 0, day: 1, sunScreen: new THREE.Vector3(), sunVisible: 0 };

  function setPalette(p) {
    palette = { ...DEFAULT_PALETTE, ...(p || {}) };
    c.palSun.set(palette.sun);
    c.palTop.set(palette.skyTop);
    c.palHor.set(palette.horizon || palette.skyBottom);
    c.palBot.set(palette.skyBottom || palette.horizon);
    c.palFog.set(palette.fog || palette.horizon);
    c.palAmb.set(palette.ambient);
    c.palGround.set(palette.ground);
    mats.uniforms.outlineColor.value.set(palette.outline || '#3a2a22');
  }
  setPalette(DEFAULT_PALETTE);

  function setShadows(tier) {
    shadowTier = tier;
    sun.castShadow = !!tier.shadows;
    if (tier.shadows) {
      if (sun.shadow.mapSize.x !== tier.shadowMap) {
        sun.shadow.mapSize.set(tier.shadowMap, tier.shadowMap);
        if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
      }
      sun.shadow.radius = tier.shadowRadius;
    }
  }

  // tod: time of day 0..1. focus: {x, y, z}. size: player display size.
  // fogScale: multiplier for fog distances (grows with the player).
  function update(tod, focus, size, camera, { fogScale = 1, weatherFog = 0, studio = false } = {}) {
    sunState(tod, S);
    mood.warmth = S.warmth; mood.night = S.night; mood.day = S.day;

    // sun colour and strength
    c.sun.copy(c.palSun).lerp(c.warmSun, S.warmth * 0.5);
    if (S.moon) c.sun.copy(c.moon);
    const baseI = (palette.sunIntensity ?? 2) * 1.5;
    const intensity = S.moon ? baseI * 0.32 * S.night : baseI * (0.35 + 0.65 * S.day);
    sun.color.copy(c.sun);
    sun.intensity = intensity;

    // sky colours
    c.top.copy(c.palTop).lerp(c.warmSky, S.warmth * 0.25).lerp(c.nightTop, S.night * 0.85);
    c.horizon.copy(c.palHor).lerp(c.warmSky, S.warmth * 0.55).lerp(c.night, S.night * 0.75);
    c.bottom.copy(c.palBot).lerp(c.warmSky, S.warmth * 0.3).lerp(c.night, S.night * 0.8);
    c.fog.copy(c.palFog).lerp(c.horizon, 0.45);

    // hemisphere: sky-tinted from above, ground bounce from below
    c.ambient.copy(c.palAmb).lerp(c.top, 0.3).lerp(c.warmSky, S.warmth * 0.2);
    c.ground.copy(c.palGround).lerp(c.warmSun, S.warmth * 0.25).multiplyScalar(0.85);
    hemi.color.copy(c.ambient);
    hemi.groundColor.copy(c.ground);
    hemi.intensity = studio ? 1.5 : 1.35 + S.night * 0.3;
    amb.color.copy(c.ambient);
    amb.intensity = 0.25;

    // shared material uniforms
    mats.uniforms.sunDir.value.set(S.lx, S.ly, S.lz);
    mats.uniforms.sunColor.value.copy(c.sun);
    mats.uniforms.skyColor.value.copy(c.horizon).lerp(c.top, 0.35);
    mats.uniforms.rimColor.value.copy(c.sun).lerp(c.warmSun, 0.35 + S.warmth * 0.4);
    mats.uniforms.shadowTint.value.copy(c.top).lerp(c.white, 0.35).lerp(c.violet, 0.45);
    // view-space light direction for the rim
    if (camera) {
      v.set(S.lx, S.ly, S.lz).transformDirection(camera.matrixWorldInverse);
      mats.uniforms.sunView.value.copy(v);
    }

    // sky dome
    if (sky) {
      const u = sky.uniforms;
      u.uTop.value.copy(c.top);
      u.uHorizon.value.copy(c.horizon);
      u.uBottom.value.copy(c.bottom);
      u.uSunDir.value.set(S.moon ? -S.x : S.x, S.moon ? -S.y : S.y, S.z);
      u.uSunColor.value.copy(S.moon ? c.moon : c.sun);
      u.uWarm.value = S.warmth;
      u.uNight.value = S.night;
      u.uSunSize.value = S.moon ? 0.6 : 1;
      u.uCloudColor.value.copy(c.white).lerp(c.warmSky, S.warmth * 0.4).lerp(c.night, S.night * 0.7);
    }

    // fog
    fog.color.copy(c.fog);
    const fs = Math.max(1, fogScale);
    const wf = 1 - Math.min(0.85, weatherFog);
    fog.near = (palette.fogNear ?? 30) * fs * wf;
    fog.far = (palette.fogFar ?? 160) * fs * (0.25 + 0.75 * wf);

    // sun position and the shadow camera, following the player and scaling with size
    const s = Math.max(0.05, size);
    const ext = Math.min(600, Math.max(4, s * 9 + 3));
    sun.target.position.set(focus.x, focus.y, focus.z);
    sun.position.set(focus.x + S.lx * ext * 2, focus.y + S.ly * ext * 2, focus.z + S.lz * ext * 2);
    if (sun.castShadow) {
      const cam = sun.shadow.camera;
      if (cam.right !== ext) {
        cam.left = -ext; cam.right = ext; cam.top = ext; cam.bottom = -ext;
        cam.near = 0.1; cam.far = ext * 5;
        cam.updateProjectionMatrix();
      }
      // texel snapping to stop shadow shimmer as the focus moves
      const texel = (2 * ext) / (shadowTier.shadowMap || 1024);
      sun.target.position.x = Math.round(focus.x / texel) * texel;
      sun.target.position.z = Math.round(focus.z / texel) * texel;
      sun.position.x = sun.target.position.x + S.lx * ext * 2;
      sun.position.z = sun.target.position.z + S.lz * ext * 2;
      sun.shadow.bias = -0.0003;
      sun.shadow.normalBias = 0.015 * Math.max(1, s);
    }

    // sun screen position (god rays)
    if (camera) {
      mood.sunScreen.set(camera.position.x + S.x * 1000, camera.position.y + S.y * 1000, camera.position.z + S.z * 1000).project(camera);
      const vis = S.moon ? 0 : S.day * (mood.sunScreen.z < 1 ? 1 : 0);
      mood.sunVisible = vis;
    }
    return mood;
  }

  return { sun, hemi, amb, fog, setPalette, setShadows, update, mood, sunState: S, colours: c, get palette() { return palette; } };
}
