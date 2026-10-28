// Accessory meshes for the head, neck, back, face and badge slots. Each item
// is one vertex-coloured mesh (one draw call) parented to a bone at the
// species' attachment point, scaled with the model. A few have secondary
// motion: capes flutter with speed, fairy wings flap, bobbles and pom-poms
// jiggle, the rosette ribbons sway.

import { getCosmetic } from '../cosmetics.js';
import { hexToRgb } from '../../core/math.js';
import { srgbToLinear } from './builder.js';

const SLOTS = ['head', 'neck', 'back', 'face', 'badge'];

export function createAccessories(THREE, mats, S, bones, skel, attach, species) {
  const byName = (n) => bones[skel.index[n]] || bones[0];
  const holders = {};
  const current = {};
  const live = {};
  const mat = mats.toon('#ffffff', { vertexColors: true });
  const glassMat = mats.toon('#cfefff', { transparent: true, opacity: 0.45 });
  const M = () => new THREE.Matrix4();

  for (const slot of SLOTS) {
    const a = attach[slot];
    const h = new THREE.Group();
    h.name = `acc:${slot}`;
    if (a) {
      h.position.set(a.pos[0], a.pos[1], a.pos[2]);
      h.rotation.x = a.tilt || 0;
      h.scale.setScalar(a.scale || 1);
      byName(a.bone).add(h);
    }
    holders[slot] = h;
  }

  // --- tiny vertex-colour kit
  function kit() {
    const parts = [];
    return {
      add(g, color, m) {
        if (m) g.applyMatrix4(m);
        if (g.index) g = g.toNonIndexed();
        if (!g.getAttribute('normal')) g.computeVertexNormals();
        parts.push([g, color]);
        return g;
      },
      build(material = mat) {
        let n = 0;
        for (const [g] of parts) n += g.getAttribute('position').count;
        const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
        let o = 0;
        for (const [g, c] of parts) {
          const p = g.getAttribute('position'), nn = g.getAttribute('normal');
          const cols = typeof c === 'function' ? null : lin(c);
          for (let i = 0; i < p.count; i++) {
            pos[(o + i) * 3] = p.getX(i); pos[(o + i) * 3 + 1] = p.getY(i); pos[(o + i) * 3 + 2] = p.getZ(i);
            nor[(o + i) * 3] = nn.getX(i); nor[(o + i) * 3 + 1] = nn.getY(i); nor[(o + i) * 3 + 2] = nn.getZ(i);
            const cc = cols || lin(c(p.getX(i), p.getY(i), p.getZ(i)));
            col[(o + i) * 3] = cc[0]; col[(o + i) * 3 + 1] = cc[1]; col[(o + i) * 3 + 2] = cc[2];
          }
          o += p.count;
          g.dispose();
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
        geo.computeBoundingSphere();
        const mesh = new THREE.Mesh(geo, material);
        mesh.castShadow = true;
        return mesh;
      },
    };
  }
  const linCache = new Map();
  function lin(hex) {
    let v = linCache.get(hex);
    if (!v) { const c = hexToRgb(hex); v = [srgbToLinear(c.r), srgbToLinear(c.g), srgbToLinear(c.b)]; linCache.set(hex, v); }
    return v;
  }
  const T = (x, y, z) => M().makeTranslation(x, y, z);
  const R = (x, y, z) => M().makeRotationFromEuler(new THREE.Euler(x, y, z));
  const TR = (x, y, z, rx, ry, rz) => T(x, y, z).multiply(R(rx, ry, rz));
  const shade = (hex, k) => { const c = hexToRgb(hex); const f = (v) => Math.round(Math.max(0, Math.min(1, v * k)) * 255).toString(16).padStart(2, '0'); return '#' + f(c.r) + f(c.g) + f(c.b); };

  // --- builders: return { mesh, anim? }
  const B = {
    // head (built for a head of radius ~0.165, origin on top of the head)
    bowler(c) { const k = kit(); k.add(S.blob(0.085, 18, 10, (v) => { if (v.y < 0) v.y *= 0.1; v.y *= 0.95; }), c[0], T(0, 0.01, 0)); k.add(S.cylinder(0.13, 0.13, 0.012, 24), c[0], T(0, 0.005, 0)); k.add(S.cylinder(0.087, 0.087, 0.022, 20, true), c[1], T(0, 0.022, 0)); return { mesh: k.build() }; },
    carnivalcrown(c) {
      const k = kit();
      k.add(S.cylinder(0.085, 0.09, 0.045, 20), c[0], T(0, 0.02, 0));
      for (let i = 0; i < 9; i++) { const a = (i - 4) * 0.28; k.add(S.ellipsoid(0.022, 0.09 + (4 - Math.abs(i - 4)) * 0.015, 0.008, 8, 6), [c[1], c[2], '#f2c234'][i % 3], TR(Math.sin(a) * 0.08, 0.1 + (4 - Math.abs(i - 4)) * 0.01, -0.02 + Math.cos(a) * 0.02, -0.25, a, -a * 0.6)); }
      for (let i = 0; i < 5; i++) { const a = (i - 2) * 0.5; k.add(S.ellipsoid(0.012, 0.012, 0.008, 6, 4), i % 2 ? '#3ac0e0' : '#e0407a', T(Math.sin(a) * 0.09, 0.025, Math.cos(a) * 0.09)); }
      return { mesh: k.build() };
    },
    partyhat(c) {
      const k = kit();
      const cone = S.cone(0.06, 0.17, 16); k.add(cone, (x, y) => (Math.sin(y * 70) > 0 ? c[0] : c[1]), T(0, 0.085, 0));
      const pom = k.add(S.blob(0.025, 10, 8, (v, d) => v.multiplyScalar(1 + 0.15 * Math.sin(d.x * 12) * Math.sin(d.y * 12))), c[1], T(0, 0.175, 0)); void pom;
      return { mesh: k.build(), anim: 'jiggle', tilt: 0.3 };
    },
    goggles(c) {
      const k = kit();
      k.add(S.torus(0.155, 0.012, 6, 28), c[0], TR(0, -0.05, 0, Math.PI / 2 - 0.25, 0, 0));
      for (const s of [1, -1]) { k.add(S.cylinder(0.04, 0.04, 0.03, 16), '#8a6a3a', TR(s * 0.045, 0.0, 0.12, Math.PI / 2 - 0.5, 0, 0)); k.add(S.cylinder(0.032, 0.032, 0.034, 16), c[1], TR(s * 0.045, 0.002, 0.123, Math.PI / 2 - 0.5, 0, 0)); }
      return { mesh: k.build() };
    },
    flatcap(c) { const k = kit(); k.add(S.blob(0.1, 18, 10, (v) => { if (v.y < 0) v.y *= 0.05; v.y *= 0.45; v.z *= 1.05; }), (x, y, z) => (Math.sin(x * 120) * Math.sin(z * 120) > 0.3 ? c[1] : c[0]), T(0, 0.0, -0.005)); k.add(S.ellipsoid(0.085, 0.01, 0.06, 14, 6), c[1], TR(0, 0.012, 0.085, 0.2, 0, 0)); return { mesh: k.build(), tilt: -0.05 }; },
    bobblehat(c) {
      const k = kit();
      k.add(S.blob(0.095, 18, 12, (v) => { if (v.y < 0) v.y *= 0.1; v.y *= 1.05; }), (x, y) => (Math.sin(y * 90) > 0.2 ? c[0] : c[1]), T(0, 0.005, 0));
      k.add(S.torus(0.093, 0.022, 8, 24), c[1], TR(0, 0.012, 0, Math.PI / 2, 0, 0));
      const mesh = k.build();
      const bob = kit(); bob.add(S.blob(0.04, 12, 10, (v, d) => v.multiplyScalar(1 + 0.12 * Math.sin(d.x * 14) * Math.sin(d.z * 14))), c[1]);
      const bm = bob.build(); bm.position.y = 0.115; mesh.add(bm);
      return { mesh, anim: 'bobble', bob: bm };
    },
    beret(c) { const k = kit(); k.add(S.ellipsoid(0.11, 0.032, 0.11, 18, 8), c[0], TR(0.015, 0.02, -0.01, 0, 0, 0.25)); k.add(S.cylinder(0.006, 0.008, 0.02, 6), c[1], TR(0.025, 0.055, -0.01, 0, 0, 0.25)); return { mesh: k.build() }; },
    tiara(c) {
      const k = kit();
      k.add(S.torus(0.09, 0.006, 4, 20, Math.PI), c[0], TR(0, 0.0, 0.0, 0, 0, 0));
      for (let i = -2; i <= 2; i++) { const a = Math.PI / 2 + i * 0.35; k.add(S.cone(0.012, 0.04 + (2 - Math.abs(i)) * 0.015, 4), c[0], T(Math.cos(a) * 0.09, Math.sin(a) * 0.09 + 0.02, 0)); }
      k.add(S.ellipsoid(0.016, 0.02, 0.01, 8, 6), c[1], T(0, 0.12, 0.008));
      return { mesh: k.build(), tilt: -0.35 };
    },
    crown(c) {
      const k = kit();
      k.add(S.cylinder(0.075, 0.07, 0.05, 20, true), c[0], T(0, 0.025, 0));
      for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; k.add(S.cone(0.02, 0.05, 4), c[0], T(Math.sin(a) * 0.072, 0.07, Math.cos(a) * 0.072)); k.add(S.ellipsoid(0.01, 0.01, 0.01, 6, 4), c[1], T(Math.sin(a) * 0.075, 0.03, Math.cos(a) * 0.075)); }
      return { mesh: k.build() };
    },
    bearskin(c) { const k = kit(); k.add(S.blob(0.1, 16, 14, (v, d) => { v.y = v.y * 1.9 + 0.07; if (d.y < -0.5) v.y = -0.05 + v.y * 0.1; v.multiplyScalar(1 + 0.04 * Math.sin(d.x * 20 + d.y * 13)); }), c[0], T(0, 0.08, -0.01)); k.add(S.torus(0.14, 0.006, 4, 20, Math.PI), c[1], TR(0, -0.03, 0.02, 0, Math.PI / 2, Math.PI)); return { mesh: k.build() }; },

    // neck (ring axis along local +Y; holder tilts it along the neck)
    collarred(c) { return collar(c, false); },
    collarteal(c) { return collar(c, false); },
    goodanimal(c) { return collar(c, true); },
    bandanared(c) { return bandana(c); },
    bandanablue(c) { return bandana(c); },
    bowtie(c) { const k = kit(); for (const s of [1, -1]) k.add(S.blob(0.035, 10, 8, (v, d) => { v.x *= 1.2; v.y *= 0.85 * (0.6 + 0.4 * Math.abs(d.x)); v.z *= 0.4; }), c[0], T(s * 0.04, 0, 0.105)); k.add(S.ellipsoid(0.016, 0.02, 0.012, 8, 6), c[1], T(0, 0, 0.115)); k.add(S.torus(0.105, 0.006, 4, 24), c[1], R(Math.PI / 2, 0, 0)); return { mesh: k.build() }; },
    scarf(c) {
      const k = kit();
      const tartan = (x, y, z) => { const a = Math.sin((x + z) * 90) > 0.4, b = Math.sin((x - z + y) * 90) > 0.4; return a && b ? c[2] : a || b ? c[1] : c[0]; };
      k.add(S.torus(0.11, 0.032, 10, 28), tartan, R(Math.PI / 2, 0, 0));
      k.add(S.superBox(0.03, 0.08, 0.012, 4, 10, 8), tartan, TR(0.04, -0.07, 0.11, 0.2, 0, 0.15));
      k.add(S.superBox(0.028, 0.06, 0.012, 4, 10, 8), tartan, TR(-0.01, -0.05, 0.12, 0.25, 0, -0.1));
      return { mesh: k.build() };
    },
    lei(c) { const k = kit(); for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; k.add(S.blob(0.024, 8, 6, (v, d) => v.multiplyScalar(1 + 0.25 * Math.sin(Math.atan2(d.x, d.z) * 5))), c[i % 3], T(Math.sin(a) * 0.115, -0.01 - 0.02 * Math.max(0, Math.cos(a)), Math.cos(a) * 0.115)); } return { mesh: k.build() }; },

    // back (origin on top of the back, +Z towards the head)
    cape(c) {
      const k = kit();
      const g = new THREE.PlaneGeometry(0.3, 0.36, 8, 10);
      const p = g.getAttribute('position');
      for (let i = 0; i < p.count; i++) { const x0 = p.getX(i), y = p.getY(i); const u = (0.18 - y) / 0.36; const x = x0 * (0.75 + 0.45 * u); const a = Math.min(1.35, Math.abs(x) / 0.2); p.setXYZ(i, Math.sign(x) * Math.sin(a) * 0.21, 0.012 + (Math.cos(a) - 1) * 0.21 - u * 0.015, 0.07 - u * 0.36); }
      g.computeVertexNormals();
      k.add(g, (x, y, z) => (z < -0.26 ? c[1] : c[0]));
      const back = new THREE.PlaneGeometry(0.3, 0.36, 8, 10); const bp = back.getAttribute('position');
      for (let i = 0; i < bp.count; i++) { bp.setXYZ(i, p.getX(i), p.getY(i) - 0.002, p.getZ(i)); }
      back.index.array.reverse && (back.setIndex(Array.from(back.index.array).reverse()));
      back.computeVertexNormals();
      k.add(back, shade(c[0], 0.75));
      k.add(S.ellipsoid(0.02, 0.02, 0.012, 8, 6), c[1], T(0, 0.02, 0.08));
      return { mesh: k.build(), anim: 'cape' };
    },
    backpack(c) { const k = kit(); k.add(S.superBox(0.07, 0.06, 0.08, 5, 14, 10), c[0], T(0, 0.055, -0.01)); k.add(S.superBox(0.072, 0.02, 0.05, 5, 12, 8), shade(c[0], 0.85), TR(0, 0.11, 0.0, 0.3, 0, 0)); k.add(S.ellipsoid(0.01, 0.01, 0.01, 6, 4), c[1], T(0, 0.085, 0.06)); for (const s of [1, -1]) k.add(S.torus(0.09, 0.008, 4, 16, Math.PI), c[1], TR(s * 0.05, -0.02, 0.02, 0, Math.PI / 2, 0)); return { mesh: k.build() }; },
    swimring(c) { const k = kit(); k.add(S.torus(0.2, 0.05, 10, 28), (x, y, z) => (Math.sin(Math.atan2(x, z) * 4) > 0 ? c[0] : c[1]), TR(0, -0.13, 0, Math.PI / 2, 0, 0)); return { mesh: k.build() }; },
    fairywings(c) {
      const g = new THREE.Group();
      const wingM = mats.toon(c[0], { transparent: true, opacity: 0.6, side: THREE.DoubleSide });
      const wings = [];
      for (const s of [1, -1]) {
        const w = new THREE.Group(); w.position.set(s * 0.03, 0.03, 0.02);
        const a = new THREE.Mesh(S.ellipsoid(0.11, 0.008, 0.06, 12, 6), wingM); a.position.set(s * 0.1, 0.03, 0.02); a.rotation.y = -s * 0.5;
        const b = new THREE.Mesh(S.ellipsoid(0.07, 0.008, 0.045, 10, 6), wingM); b.position.set(s * 0.07, 0.0, -0.06); b.rotation.y = s * 0.4;
        w.add(a, b); g.add(w); wings.push([w, s]);
      }
      return { mesh: g, anim: 'wings', wings, extraMat: wingM };
    },

    // face (origin at the eyes' midpoint, just in front)
    sunglasses(c, a) { const sp = (a && a.spread) || 0.08; const k = kit(); for (const s of [1, -1]) k.add(S.blob(0.038, 14, 8, (v) => { v.z *= 0.25; v.y *= 0.8; }), c[0], T(s * sp * 0.95, 0, 0.01)); k.add(S.limb([-sp * 0.5, 0.01, 0.012], [sp * 0.5, 0.01, 0.012], 0.006, 0.006, 6, 1), c[1]); for (const s of [1, -1]) k.add(S.limb([s * sp * 1.4, 0.01, 0], [s * sp * 1.5, 0.015, -0.12], 0.005, 0.005, 5, 1), c[1]); return { mesh: k.build() }; },
    monocle(c, a) { const sp = (a && a.spread) || 0.08; const k = kit(); k.add(S.torus(0.04, 0.006, 6, 20), c[0], T(sp, 0, 0.012)); k.add(S.limb([sp, -0.04, 0.012], [sp * 0.7, -0.12, -0.02], 0.003, 0.003, 4, 2), c[0]); const mesh = k.build(); const glass = new THREE.Mesh(S.cylinder(0.036, 0.036, 0.004, 16), glassMat); glass.rotation.x = Math.PI / 2; glass.position.set(sp, 0, 0.012); mesh.add(glass); return { mesh }; },
    heartglasses(c, a) {
      const sp = (a && a.spread) || 0.08;
      const heart = new THREE.Shape(); const h = 0.035;
      heart.moveTo(0, -h); heart.bezierCurveTo(-h * 1.6, -h * 0.1, -h * 0.9, h * 1.2, 0, h * 0.45); heart.bezierCurveTo(h * 0.9, h * 1.2, h * 1.6, -h * 0.1, 0, -h);
      const k = kit();
      for (const s of [1, -1]) { const g = new THREE.ExtrudeGeometry(heart, { depth: 0.008, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.003, bevelSegments: 2, curveSegments: 8 }); g.deleteAttribute('uv'); k.add(g, s > 0 ? c[0] : c[0], T(s * sp, 0, 0.008)); }
      k.add(S.limb([-sp * 0.5, 0.008, 0.012], [sp * 0.5, 0.008, 0.012], 0.005, 0.005, 6, 1), c[1]);
      return { mesh: k.build() };
    },
    moustache(c) { const k = kit(); for (const s of [1, -1]) k.add(S.tube([[0, 0, 0], [s * 0.03, -0.006, 0], [s * 0.055, 0.0, -0.005], [s * 0.065, 0.015, -0.01]], [0.012, 0.014, 0.01, 0.005], 8, 2), c[0], T(0, -0.085, 0.07)); return { mesh: k.build() }; },
    snorkel(c, a) { const sp = (a && a.spread) || 0.08; const k = kit(); k.add(S.blob(0.05, 16, 8, (v) => { v.x *= sp * 2.2 / 0.05 * 0.6; v.z *= 0.3; v.y *= 0.8; }), c[0], T(0, 0, 0.012)); k.add(S.tube([[sp * 1.5, -0.03, -0.01], [sp * 1.7, 0.05, -0.03], [sp * 1.7, 0.16, -0.04]], [0.012, 0.012, 0.014], 8, 2), c[0]); const mesh = k.build(); const glass = new THREE.Mesh(S.ellipsoid(sp * 1.2, 0.035, 0.01, 16, 8), glassMat); glass.position.z = 0.03; mesh.add(glass); return { mesh }; },

    // badges: a little rosette or pin (origin on the chest, facing +Z)
    badge_good(c) { return rosette(c, true); },
    badge_tea(c) { const k = kit(); k.add(S.cylinder(0.022, 0.018, 0.03, 12), c[0], R(Math.PI / 2, 0, 0)); k.add(S.torus(0.012, 0.004, 4, 10), c[0], TR(0.024, 0, 0, 0, 0, 0)); k.add(S.cylinder(0.019, 0.019, 0.004, 12), c[1], TR(0, 0, 0.016, Math.PI / 2, 0, 0)); return { mesh: k.build() }; },
    badge_ping(c) { const k = kit(); k.add(S.superBox(0.03, 0.02, 0.008, 5, 10, 6), c[1]); for (let i = 0; i < 3; i++) k.add(S.ellipsoid(0.004, 0.004, 0.004, 5, 4), c[0], T(-0.012 + i * 0.012, 0.004, 0.008)); return { mesh: k.build() }; },
    badge_star(c) { const s = new THREE.Shape(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.014 : 0.032; const a = (i / 10) * Math.PI * 2; if (i === 0) s.moveTo(Math.sin(a) * r, Math.cos(a) * r); else s.lineTo(Math.sin(a) * r, Math.cos(a) * r); } const g = new THREE.ExtrudeGeometry(s, { depth: 0.008, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.003, bevelSegments: 1 }); g.deleteAttribute('uv'); const k = kit(); k.add(g, c[0]); return { mesh: k.build() }; },
  };

  function collar(c, rosetteToo) {
    const k = kit();
    k.add(S.torus(0.108, 0.016, 8, 28), c[0], R(Math.PI / 2, 0, 0));
    k.add(S.cylinder(0.02, 0.02, 0.006, 14), c[1], TR(0, -0.03, 0.12, Math.PI / 2, 0, 0));
    k.add(S.torus(0.008, 0.003, 4, 8), c[1], T(0, -0.008, 0.118));
    if (rosetteToo) {
      const pet = (x, y) => (Math.hypot(x, y) < 0.022 ? c[1] : c[0]);
      for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; k.add(S.ellipsoid(0.016, 0.009, 0.005, 6, 4), c[0], TR(Math.sin(a) * 0.024, -0.04 + Math.cos(a) * 0.024, 0.126, 0, 0, -a)); }
      k.add(S.cylinder(0.02, 0.02, 0.008, 14), pet, TR(0, -0.04, 0.13, Math.PI / 2, 0, 0));
      for (const s of [1, -1]) k.add(S.superBox(0.009, 0.03, 0.003, 4, 6, 4), c[0], TR(s * 0.012, -0.085, 0.125, 0, 0, s * 0.25));
    }
    return { mesh: k.build() };
  }
  function bandana(c) {
    const k = kit();
    k.add(S.torus(0.106, 0.012, 6, 28), c[0], R(Math.PI / 2, 0, 0));
    const tri = S.blob(1, 12, 8, (v, d) => { const t = (1 - d.y) / 2; v.set(d.x * 0.1 * (1 - t * 0.85), d.y * 0.06 - 0.06, d.z * 0.012); });
    k.add(tri, (x, y) => (Math.sin(x * 160) * Math.sin(y * 160) > 0.6 ? c[1] : c[0]), TR(0, -0.01, 0.1, 0.35, 0, 0));
    return { mesh: k.build() };
  }
  function rosette(c) {
    const k = kit();
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; k.add(S.ellipsoid(0.016, 0.009, 0.005, 6, 4), c[0], TR(Math.sin(a) * 0.024, Math.cos(a) * 0.024, 0, 0, 0, -a)); }
    k.add(S.cylinder(0.02, 0.02, 0.008, 14), c[1], TR(0, 0, 0.004, Math.PI / 2, 0, 0));
    for (const s of [1, -1]) k.add(S.superBox(0.009, 0.028, 0.003, 4, 6, 4), c[0], TR(s * 0.012, -0.045, -0.002, 0, 0, s * 0.25));
    return { mesh: k.build() };
  }

  function clear(slot) {
    const l = live[slot];
    if (!l) return;
    l.mesh.removeFromParent();
    l.mesh.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
    if (l.extraMat) l.extraMat.dispose && 0;
    live[slot] = null;
  }

  let t = 0;
  const jig = { x: 0, v: 0, z: 0, vz: 0 };
  return {
    set(look) {
      const acc = (look && look.accessories) || {};
      for (const slot of SLOTS) {
        const id = acc[slot] || null;
        if (current[slot] === id) continue;
        clear(slot);
        current[slot] = id;
        if (!id || !attach[slot]) continue;
        const cos = getCosmetic(id);
        const fn = B[id];
        if (!cos || !fn) continue;
        const built = fn(cos.colors || ['#888888', '#cccccc', '#ffffff'], attach[slot]);
        if (built.tilt) built.mesh.rotation.x = built.tilt;
        built.mesh.name = `acc-${id}`;
        holders[slot].add(built.mesh);
        live[slot] = built;
      }
    },
    update(pose, dt, core) {
      t += dt;
      const speed = core ? core.speedN : 0;
      const accF = core ? core.accF : 0, accY = core ? core.accY : 0;
      // shared jiggle spring for pom-poms and bobbles
      jig.v += (-120 * jig.x - 8 * jig.v - accF * 0.6) * dt; jig.x += jig.v * dt;
      jig.vz += (-120 * jig.z - 8 * jig.vz - accY * 0.4) * dt; jig.z += jig.vz * dt;
      if (jig.x > 0.6) jig.x = 0.6; else if (jig.x < -0.6) jig.x = -0.6;
      if (jig.z > 0.6) jig.z = 0.6; else if (jig.z < -0.6) jig.z = -0.6;
      for (const slot of SLOTS) {
        const l = live[slot];
        if (!l || !l.anim) continue;
        if (l.anim === 'cape') {
          l.mesh.rotation.x = -(speed * 0.55 + Math.max(0, Math.sin(t * (6 + speed * 8))) * (0.02 + speed * 0.12) - jig.z * 0.2);
        } else if (l.anim === 'wings') {
          const f = Math.sin(t * 14) * 0.5;
          for (const [w, s] of l.wings) w.rotation.z = s * (0.2 + f);
        } else if (l.anim === 'bobble') {
          l.bob.position.x = jig.z * 0.03; l.bob.position.z = -jig.x * 0.05; l.bob.position.y = 0.115 + jig.z * 0.01;
        } else if (l.anim === 'jiggle') {
          l.mesh.rotation.z = jig.z * 0.4; l.mesh.rotation.x = 0.3 - jig.x * 0.4;
        }
      }
      void pose;
    },
    dispose() { for (const slot of SLOTS) { clear(slot); holders[slot].removeFromParent(); } },
  };
}
