// Colours for the item state cues, per colour-blind setting. Pure: no three.
// The cues never rely on hue alone: the shimmer also pulses gently and
// shape codes can be switched on, but the hues are picked to stay distinct.

const SETS = {
  none: {
    almost: '#ffb347',     // warm apricot rim shimmer
    golden: '#ffd75e',
    gobble: '#ffffff',
    iconGood: '#ffffff',
    iconAlmost: '#ffc46b',
    ring: '#fff3d6',
  },
  // Red-green deficiencies: keep to blue/yellow contrasts.
  deuteranopia: {
    almost: '#ffd23f', golden: '#fff1a8', gobble: '#ffffff',
    iconGood: '#8fd3ff', iconAlmost: '#ffd23f', ring: '#eaf6ff',
  },
  protanopia: {
    almost: '#ffe14a', golden: '#fff3b0', gobble: '#ffffff',
    iconGood: '#7cc8ff', iconAlmost: '#ffe14a', ring: '#eaf6ff',
  },
  // Blue-yellow deficiency: keep to red/cyan contrasts.
  tritanopia: {
    almost: '#ff6f91', golden: '#ffd0dc', gobble: '#ffffff',
    iconGood: '#5fe3e0', iconAlmost: '#ff6f91', ring: '#ffe9ef',
  },
};

export function cueColours(mode) {
  return SETS[mode] || SETS.none;
}

export const CB_MODES = Object.keys(SETS);

// Shape code index used by the icon shader.
export const SHAPE_INDEX = { circle: 0, triangle: 1, square: 2, star: 3 };
export function shapeIndex(shape) { return SHAPE_INDEX[shape] ?? 0; }
