// Reusable body parts for the animal builders: eyes with lids and shines,
// noses, chains (tails, trunks, ears) skinned smoothly along their bones.

export function makeParts(THREE, S, B, bones, q) {
  const idx = (name) => B.boneIndex.get(name);
  const wp = (name) => { const b = bones[idx(name)]; return new THREE.Vector3().setFromMatrixPosition(b.matrixWorld); };
  const M4 = () => new THREE.Matrix4();
  const seg = (n) => Math.max(4, Math.round(n * q));
  const ss = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

  // Blend weights between two bones by t (0 = all a).
  const w2 = (a, b, t) => [idx(a), 1 - t, idx(b), t];

  // Weight function along a chain of bone names (centres at segment middles).
  function chainWeights(names) {
    const ids = names.map(idx);
    const n = ids.length;
    return (s) => {
      // s in segments (0..n)
      const c0 = Math.floor(s - 0.5);
      const t = s - 0.5 - c0;
      const a = Math.max(0, Math.min(n - 1, c0)), b = Math.max(0, Math.min(n - 1, c0 + 1));
      return [ids[a], 1 - t, ids[b], t];
    };
  }

  // A tube along a chain's rest positions. radius(u) shapes it; extra: region fn, tag.
  function chainTube(chain, n, radiusFn, o = {}) {
    const names = o.names || []; if (!o.names) for (let i = 0; i < n; i++) names.push(`${chain}${i}`);
    const pts = [];
    const sub = o.sub || 3;
    const P = names.map(wp); P.push(wp(o.tip || `${chain}Tip`));
    if (o.startAt) P[0] = o.startAt;
    for (let i = 0; i < n; i++) for (let k = 0; k < sub; k++) pts.push(P[i].clone().lerp(P[i + 1], k / sub).toArray());
    pts.push(P[n].toArray());
    const rad = pts.map((_, i) => radiusFn(i / (pts.length - 1)));
    const g = S.tube(pts, rad, seg(o.radial || 10), o.cap ?? 3);
    if (o.squash) { // flatten cross-section along an axis in world (e.g. ears)
      g.applyMatrix4(o.squash);
    }
    const cw = chainWeights(names);
    B.add(g, {
      bone: 'root', tag: o.tag || 'tail', region: o.region || 'base', pattern: o.pattern,
      weights: (w, l, i, gu) => cw((gu ? gu[i] : 0) * n),
    });
  }

  // Big storybook eye on bone eye<s>, with the lid on lid<s>.
  // o: { r, outward (radians), pupil: 'round'|'slit'|'wide'|'bar', irisFrac, lidRegion, shineScale }
  function eye(s, o) {
    const r = o.r;
    const out = (s === 'L' ? 1 : -1) * (o.outward ?? 0.35);
    const up = o.up ?? 0;
    const rot = M4().makeRotationFromEuler(new THREE.Euler(-up, out, 0, 'YXZ'));
    // white
    B.add(S.ellipsoid(r, r, r * 0.92, seg(14), seg(10)), { bone: `eye${s}`, matrix: rot.clone(), region: o.white || 'white', pattern: false, tag: 'eye' });
    // iris (flattened sphere poking out the front)
    const ir = r * (o.irisFrac ?? 0.72);
    const irisG = S.ellipsoid(ir, ir * (o.irisTall ?? 1), ir * 0.35, seg(12), seg(6));
    irisG.translate(0, 0, r * 0.82);
    B.add(irisG, { bone: `eye${s}`, matrix: rot.clone(), region: 'eyes', pattern: false, tag: 'eye' });
    // pupil
    const pr = ir * (o.pupilFrac ?? 0.62);
    let px = pr, py = pr;
    if (o.pupil === 'slit') { px = pr * 0.28; py = pr * 1.15; }
    else if (o.pupil === 'bar') { px = pr * 1.2; py = pr * 0.38; }
    const pupG = S.ellipsoid(px, py, ir * 0.3, seg(10), seg(6));
    pupG.translate(0, 0, r * 0.92);
    B.add(pupG, { bone: `eye${s}`, matrix: rot.clone(), region: 'pupil', pattern: false, tag: 'eye' });
    // shines: one big, one small (part of the eye so they sparkle as it moves)
    const sh = (o.shineScale ?? 1) * r;
    const s1 = S.ellipsoid(sh * 0.24, sh * 0.24, sh * 0.12, 6, 4); s1.translate(r * 0.28 * (s === 'L' ? 1 : 1), r * 0.3, r * 1.02);
    const s2 = S.ellipsoid(sh * 0.11, sh * 0.11, sh * 0.06, 5, 3); s2.translate(-r * 0.22, -r * 0.24, r * 1.0);
    B.add(s1, { bone: `eye${s}`, matrix: rot.clone(), region: 'shine', pattern: false, tag: 'eye' });
    B.add(s2, { bone: `eye${s}`, matrix: rot.clone(), region: 'shine', pattern: false, tag: 'eye' });
    // lid: top hemisphere shell, rotated by the rig (open = tucked back)
    const lr = r * 1.1;
    const lid = new THREE.SphereGeometry(lr, seg(12), seg(5), 0, Math.PI * 2, 0, Math.PI * 0.5);
    lid.deleteAttribute('uv');
    const lidRot = M4().makeRotationFromEuler(new THREE.Euler(0, out, 0, 'YXZ'));
    B.add(lid, { bone: `lid${s}`, matrix: lidRot, region: o.lidRegion || 'base', pattern: false, tag: 'face' });
  }

  return { idx, wp, w2, chainWeights, chainTube, eye, seg, ss, M4 };
}
