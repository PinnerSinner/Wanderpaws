// Procedural markings painted straight into vertex colours, evaluated on the
// rest-pose positions so they ride along with the skinning. All seeded and
// deterministic: the same look always paints the same animal.
//   patches  soft blotches (calico, piebald, tortoise shell)
//   stripes  tabby bands across the back and rings on legs and tail
//   spots    round spots (Dalmatian, frog, deep-sea octopus)
//   socks    white paws and lower legs (plus a tail tip)
//   blaze    a stripe down the face plus a bib (collie)
//   saddle   a dark back patch (beagle)
//   mask     a face mask around the eyes and muzzle (husky, Siamese)
//   bands    rings along tails and bodies (red panda, snake, mallard collar)

function hash3(x, y, z, s) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1274126177) ^ Math.imul(s | 0, 1103515245);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function noise3(x, y, z, s) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), uz = fz * fz * (3 - 2 * fz);
  const l = (a, b, t) => a + (b - a) * t;
  const c000 = hash3(ix, iy, iz, s), c100 = hash3(ix + 1, iy, iz, s), c010 = hash3(ix, iy + 1, iz, s), c110 = hash3(ix + 1, iy + 1, iz, s);
  const c001 = hash3(ix, iy, iz + 1, s), c101 = hash3(ix + 1, iy, iz + 1, s), c011 = hash3(ix, iy + 1, iz + 1, s), c111 = hash3(ix + 1, iy + 1, iz + 1, s);
  return l(l(l(c000, c100, ux), l(c010, c110, ux), uy), l(l(c001, c101, ux), l(c011, c111, ux), uy), uz) * 2 - 1;
}
const ss = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

export function paintPattern(arr, info, look, ctx, pc) {
  const { pos, nor, tags, TAGS, pat, uu, n } = info;
  const seed = (look.patternSeed >>> 0) || 1;
  const amt = Math.max(0, Math.min(1, look.patternAmount ?? 0.5));
  const T = (name) => TAGS.indexOf(name);
  const tLeg = T('leg'), tPaw = T('paw'), tTail = T('tail'), tHead = T('head'), tFace = T('face'), tMuz = T('muzzle'), tBody = T('body'), tEar = T('ear'), tShell = T('shell'), tArm = T('arm'), tNeck = T('neck'), tWing = T('wing');
  const spots = [];
  if (look.pattern === 'spots') {
    // seeded spot centres over the bounding box, jittered grid so they don't clump
    const bb = ctx.bbox;
    const cell = 0.085 + 0.05 * (1 - amt);
    let k = 0;
    for (let x = bb[0]; x <= bb[3]; x += cell) for (let y = bb[1]; y <= bb[4]; y += cell) for (let z = bb[2]; z <= bb[5]; z += cell) {
      k++;
      if (hash3(k, 7, 3, seed) > 0.35 + 0.5 * amt) continue;
      spots.push(x + (hash3(k, 1, 0, seed) - 0.5) * cell, y + (hash3(k, 2, 0, seed) - 0.5) * cell, z + (hash3(k, 3, 0, seed) - 0.5) * cell, cell * (0.18 + 0.22 * hash3(k, 4, 0, seed)) * (0.8 + amt * 0.7));
    }
  }
  const eyeY = ctx.eyeY ?? 0.7, headZ = ctx.headZ ?? 0.35, bodyTop = ctx.bodyTop ?? 0.6, zMin = ctx.zMin ?? -0.4, zMax = ctx.zMax ?? 0.4;
  for (let i = 0; i < n; i++) {
    if (!pat[i]) continue;
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    const ny = nor[i * 3 + 1];
    const tag = tags[i];
    let m = 0;
    switch (look.pattern) {
      case 'patches': {
        const f = noise3(x * 5.5 + seed * 0.37, y * 5.5, z * 5.5, seed) + 0.45 * noise3(x * 13, y * 13, z * 13, seed + 9);
        m = ss(0.32 - amt * 0.55, 0.4 - amt * 0.55, f);
        break;
      }
      case 'stripes': {
        const w = noise3(x * 6, y * 6, z * 6, seed) * 0.22;
        if (tag === tLeg || tag === tTail || tag === tArm) {
          const v = Math.sin((y + z * 0.3) * 60 + w * 3 + uu[i] * 20);
          m = ss(0.8 - amt * 0.5, 0.9 - amt * 0.5, v);
        } else {
          const v = Math.sin(z * 34 + w * 4 + x * x * 20);
          const dorsal = ss(-0.35, 0.25, ny);
          m = ss(0.78 - amt * 0.6, 0.9 - amt * 0.6, v) * dorsal;
          if (tag === tHead || tag === tFace) m *= ss(eyeY - 0.02, eyeY + 0.05, y) * 0.9;
        }
        break;
      }
      case 'spots': {
        let best = 0;
        for (let s = 0; s < spots.length; s += 4) {
          const dx = x - spots[s], dy = y - spots[s + 1], dz = z - spots[s + 2];
          const d2 = dx * dx + dy * dy + dz * dz, r = spots[s + 3];
          if (d2 < r * r) { const v = 1 - ss(r * 0.7, r, Math.sqrt(d2)); if (v > best) best = v; }
        }
        m = best;
        if (tag === tMuz || tag === tPaw) m *= 0.4;
        break;
      }
      case 'socks': {
        if (tag === tLeg || tag === tPaw) m = 1 - ss(0.09 + amt * 0.12, 0.12 + amt * 0.12, y);
        else if (tag === tTail) m = ss(0.65, 0.8, uu[i]);
        else if (tag === tBody || tag === tNeck) m = ss(-0.1, -0.6, ny) * ss(zMin + 0.1, zMax, z) * 0.9; // white chest and belly
        else if (tag === tMuz) m = 0.8;
        break;
      }
      case 'blaze': {
        if (tag === tHead || tag === tFace || tag === tMuz) {
          const front = z > headZ - 0.02 ? 1 : 0;
          m = (1 - ss(0.02 + amt * 0.03, 0.035 + amt * 0.04, Math.abs(x))) * front * ss(eyeY + 0.12, eyeY - 0.02, y + 0.0);
          if (tag === tMuz) m = Math.max(m, 0.95);
        } else if (tag === tBody || tag === tNeck) {
          m = ss(-0.15, -0.65, ny) * 0.95 + (z > zMax - 0.12 ? ss(0.2, -0.3, ny) : 0);
        } else if (tag === tLeg || tag === tPaw) m = 1 - ss(0.07 + amt * 0.08, 0.1 + amt * 0.08, y);
        else if (tag === tTail) m = ss(0.7, 0.85, uu[i]);
        break;
      }
      case 'saddle': {
        if (tag === tBody) {
          const along = ss(zMin, zMin + 0.12, z) * (1 - ss(zMax - 0.18, zMax - 0.05, z));
          m = ss(bodyTop - 0.16 - amt * 0.08, bodyTop - 0.1 - amt * 0.08, y) * along * ss(-0.2, 0.3, ny);
        } else if (tag === tTail) m = 1 - ss(0.6, 0.7, uu[i]);
        break;
      }
      case 'mask': {
        if (tag === tHead || tag === tFace || tag === tMuz) {
          const front = ss(headZ - 0.06, headZ + 0.04, z);
          const low = 1 - ss(eyeY + 0.05, eyeY + 0.09, y);
          m = front * low;
          if (tag === tMuz) m = 1;
        } else if (tag === tEar) m = 0.85;
        else if (tag === tLeg || tag === tPaw) m = 1 - ss(0.1, 0.2, y) ;
        else if (tag === tTail) m = ss(0.55, 0.75, uu[i]);
        else if (tag === tBody) m = ss(-0.3, -0.75, ny) * 0.8;
        break;
      }
      case 'bands': {
        if (tag === tTail || tag === tArm) m = ss(0.25, 0.35, Math.sin(uu[i] * Math.PI * (6 + amt * 6)));
        else if (tag === tBody && ctx.bandsBody) m = ss(0.3, 0.45, Math.sin(uu[i] * Math.PI * (10 + amt * 14)));
        else if (tag === tNeck && ctx.bandsNeck) m = 1 - ss(0.0, 0.06, Math.abs(uu[i] - 0.25));
        else if (tag === tWing) m = ss(0.55, 0.6, uu[i]) * 0.8;
        else if (tag === tShell) m = ss(0.4, 0.5, Math.sin(Math.hypot(x, z) * 40));
        break;
      }
      default: break;
    }
    if (m > 0.001) {
      if (m > 1) m = 1;
      arr[i * 3] += (pc[0] - arr[i * 3]) * m;
      arr[i * 3 + 1] += (pc[1] - arr[i * 3 + 1]) * m;
      arr[i * 3 + 2] += (pc[2] - arr[i * 3 + 2]) * m;
    }
  }
}
