// Item registry: one builder per catalogue id, plus normalisation to the
// contract: largest horizontal extent 1 (or less for naturally slender things,
// see normaliseItem), sitting on y = 0, facing +Z, height = item.height / item.size.
import { CATALOGUE } from '../../catalogue.js';
import { createBuilder } from '../kit.js';
import { shared, w1 } from './w1.js';
import { w2 } from './w2.js';
import { w3 } from './w3.js';
import { w4 } from './w4.js';
import { w5 } from './w5.js';

export const ITEM_BUILDERS = { ...shared, ...w1, ...w2, ...w3, ...w4, ...w5 };

// Generic fallback so a freshly added catalogue id never crashes the game:
// a friendly gift box in the world's accent colour.
function fallback(b) {
  b.box(0.9, 0.7, 0.9, '#ff9ec7', { y: 0.35, r: 0.08 });
  b.box(0.96, 0.16, 0.96, '#ff7a59', { y: 0.74, r: 0.06 });
  b.box(0.16, 0.72, 0.92, '#ffd23f', { y: 0.36 });
  b.box(0.92, 0.72, 0.16, '#ffd23f', { y: 0.36 });
  b.ball(0.14, '#ffd23f', { x: -0.1, y: 0.86, sx: 1.4, sz: 0.6, rz: 0.5, seg: 8 });
  b.ball(0.14, '#ffd23f', { x: 0.1, y: 0.86, sx: 1.4, sz: 0.6, rz: -0.5, seg: 8 });
}

// Normalisation rule (documented in REQUESTS.md):
// - final height is exactly item.height / item.size (render scales by item.size)
// - horizontal extent is 1 when the model is at least as wide as the catalogue
//   implies; models that are naturally slender (a post box, a lamppost, a pine)
//   keep their real proportions, so their extent is below 1, never above.
export function normaliseItem(b, item) {
  const bb = b.bounds();
  const w = bb.maxX - bb.minX, d = bb.maxZ - bb.minZ, h = Math.max(1e-6, bb.maxY - bb.minY);
  const horiz = Math.max(w, d, 1e-6);
  const r = item ? item.height / item.size : h / horiz;
  const r0 = h / horiz;
  const hFinal = Math.min(1, r / r0);
  const sH = hFinal / horiz, sY = r / h;
  b.transform(-(bb.minX + bb.maxX) / 2, -bb.minY, -(bb.minZ + bb.maxZ) / 2, sH, sY, sH);
  b.ao(r, 0.16, 0.2);
  return { width: w * sH, depth: d * sH, height: r };
}

export function buildItemBuilder(THREE, typeId) {
  const item = CATALOGUE[typeId] || null;
  const b = createBuilder(THREE);
  const fn = ITEM_BUILDERS[typeId] || fallback;
  fn(b, { THREE, item });
  const dims = normaliseItem(b, item);
  return { b, dims, item, known: !!ITEM_BUILDERS[typeId] };
}

export function buildItemMesh(THREE, mats, typeId) {
  const { b, dims, known } = buildItemBuilder(THREE, typeId);
  const group = b.toGroup(mats);
  group.name = 'item:' + typeId;
  group.userData.typeId = typeId;
  group.userData.triangles = b.triangles();
  group.userData.dims = dims;
  group.userData.fallback = !known;
  return group;
}
