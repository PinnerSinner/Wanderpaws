// Tiny allocation-free 3D helpers for the rig (no three). Matrices are 3x3,
// row-major Float64Array(9). Euler conventions match three.js exactly so the
// view can apply rig angles straight onto bones.

// out = rotation matrix for Euler (x, y, z) in 'XYZ' or 'YXZ' order.
export function mat3FromEuler(out, x, y, z, order) {
  const a = Math.cos(x), b = Math.sin(x), c = Math.cos(y), d = Math.sin(y), e = Math.cos(z), f = Math.sin(z);
  if (order === 'YXZ') {
    const ce = c * e, cf = c * f, de = d * e, df = d * f;
    out[0] = ce + df * b; out[1] = de * b - cf; out[2] = a * d;
    out[3] = a * f; out[4] = a * e; out[5] = -b;
    out[6] = cf * b - de; out[7] = df + ce * b; out[8] = a * c;
  } else {
    const ae = a * e, af = a * f, be = b * e, bf = b * f;
    out[0] = c * e; out[1] = -c * f; out[2] = d;
    out[3] = af + be * d; out[4] = ae - bf * d; out[5] = -b * c;
    out[6] = bf - ae * d; out[7] = be + af * d; out[8] = a * c;
  }
  return out;
}

export function mat3Mul(out, A, B) {
  const a0 = A[0], a1 = A[1], a2 = A[2], a3 = A[3], a4 = A[4], a5 = A[5], a6 = A[6], a7 = A[7], a8 = A[8];
  const b0 = B[0], b1 = B[1], b2 = B[2], b3 = B[3], b4 = B[4], b5 = B[5], b6 = B[6], b7 = B[7], b8 = B[8];
  out[0] = a0 * b0 + a1 * b3 + a2 * b6; out[1] = a0 * b1 + a1 * b4 + a2 * b7; out[2] = a0 * b2 + a1 * b5 + a2 * b8;
  out[3] = a3 * b0 + a4 * b3 + a5 * b6; out[4] = a3 * b1 + a4 * b4 + a5 * b7; out[5] = a3 * b2 + a4 * b5 + a5 * b8;
  out[6] = a6 * b0 + a7 * b3 + a8 * b6; out[7] = a6 * b1 + a7 * b4 + a8 * b7; out[8] = a6 * b2 + a7 * b5 + a8 * b8;
  return out;
}

// v (3-array) = M * v
export function mat3Apply(M, v) {
  const x = v[0], y = v[1], z = v[2];
  v[0] = M[0] * x + M[1] * y + M[2] * z;
  v[1] = M[3] * x + M[4] * y + M[5] * z;
  v[2] = M[6] * x + M[7] * y + M[8] * z;
  return v;
}
// v = M^T * v (inverse for rotations)
export function mat3ApplyT(M, v) {
  const x = v[0], y = v[1], z = v[2];
  v[0] = M[0] * x + M[3] * y + M[6] * z;
  v[1] = M[1] * x + M[4] * y + M[7] * z;
  v[2] = M[2] * x + M[5] * y + M[8] * z;
  return v;
}

export const IDENT = () => { const m = new Float64Array(9); m[0] = m[4] = m[8] = 1; return m; };

// Analytic 2-bone IK in a bone's parent frame. The chain hangs down (-Y) at
// rest. (dx, dy, dz) is the target relative to the joint, a and b the segment
// lengths, bendFwd +1 puts the middle joint forward (+Z), -1 backward.
// Writes { upperRx, upperRz, lowerRx, reach } into out. Rotation order XYZ:
// rz tilts sideways first, then rx swings (negative rx swings forward).
export function solveTwoBone(out, dx, dy, dz, a, b, bendFwd) {
  const side = Math.atan2(dx, Math.max(1e-6, -dy));
  const dyz = Math.hypot(dx, dy);
  let d = Math.hypot(dyz, dz);
  const dmax = (a + b) * 0.9995, dmin = Math.abs(a - b) + 1e-4;
  out.reach = d / (a + b);
  if (d > dmax) d = dmax;
  if (d < dmin) d = dmin;
  const phi = Math.atan2(dz, dyz); // forward angle of the joint->target line from straight down
  let ca = (a * a + d * d - b * b) / (2 * a * d);
  ca = ca < -1 ? -1 : ca > 1 ? 1 : ca;
  const alpha = Math.acos(ca);
  const u = phi + bendFwd * alpha; // upper segment forward angle
  // knee in the swing plane
  const kz = a * Math.sin(u), ky = -a * Math.cos(u);
  const tz = d * Math.sin(phi), ty = -d * Math.cos(phi);
  const l = Math.atan2(tz - kz, -(ty - ky));
  out.upperRx = -u;
  out.upperRz = side;
  out.lowerRx = -(l - u);
  return out;
}
