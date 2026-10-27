// The idle director (deterministic, weighted, never repeats back to back) and
// the emotion layer the rig and dialogue read.
import { EV } from '../core/events.js';
import { TUNE, IDLE_ANIMS } from './tune.js';

const LONG = { sit: 1, lie: 1, sniff: 0.6 };

export function pickIdle(rng, bias, last, sleepy) {
  let total = 0;
  for (let k = 0; k < IDLE_ANIMS.length; k++) {
    const a = IDLE_ANIMS[k];
    if (a === last) continue;
    let w = bias && bias[a] != null ? bias[a] : 1;
    if (sleepy && (a === 'lie' || a === 'yawn')) w *= 4;
    total += Math.max(0, w);
  }
  let r = rng.next() * total;
  for (let k = 0; k < IDLE_ANIMS.length; k++) {
    const a = IDLE_ANIMS[k];
    if (a === last) continue;
    let w = bias && bias[a] != null ? bias[a] : 1;
    if (sleepy && (a === 'lie' || a === 'yawn')) w *= 4;
    r -= Math.max(0, w);
    if (r <= 0) return a;
  }
  return IDLE_ANIMS[0] === last ? IDLE_ANIMS[1] : IDLE_ANIMS[0];
}

export function stepIdle(S, dt) {
  const st = S.state, p = st.player, R = S.run;
  const idle = st.phase !== 'intro' && R.inputMag === 0 && p.speed < 0.08 * p.size && p.grounded && !p.sig.active && p.sig.phase !== 'charge' && !p.playBow && p.stagger <= 0;
  if (!idle) {
    p.idleTime = 0;
    if (p.idleAnim) p.idleAnim = null;
    R.idleNext = TUNE.idleStart;
    return;
  }
  p.idleTime += dt;
  if (p.idleAnim) {
    R.idleAnimT -= dt;
    if (R.idleAnimT <= 0) {
      p.idleAnim = null;
      R.idleNext = p.idleTime + S.rngIdle.range(1.0, 3.4);
    }
    return;
  }
  if (p.idleTime >= R.idleNext) {
    const sleepy = p.idleTime > TUNE.sleepyAfter;
    const bias = S.species.personality && S.species.personality.idleBias;
    const a = pickIdle(S.rngIdle, bias, R.lastIdle, sleepy);
    R.lastIdle = a;
    p.idleAnim = a;
    const base = LONG[a] ? 4.5 : 2.2;
    R.idleAnimT = base * S.rngIdle.range(0.6, 1.4) * (sleepy && a === 'lie' ? 3 : 1);
    S.emit({ type: EV.IDLE, seconds: p.idleTime, anim: a });
  }
}

export function stepEmotion(S, dt) {
  const st = S.state, p = st.player, R = S.run;
  if (R.scaredT > 0) R.scaredT -= dt;
  if (R.proudT > 0) R.proudT -= dt;
  if (R.happyT > 0) R.happyT -= dt;
  let e = 'happy';
  const sp = S.species;
  if (R.scaredT > 0 || p.stagger > 0) e = 'scared';
  else if (R.proudT > 0 || (st.phase === 'finished' && st.result && st.result.reachedGoal)) e = 'proud';
  else if (p.combo.count >= 3 || R.zoom > 0.75 || (p.inWater && (sp.swims || sp.floats) && p.speedNorm > 0.4)) e = 'excited';
  else if (p.idleTime > TUNE.sleepyAfter) e = 'sleepy';
  else if (p.inWater && !sp.swims && !sp.floats) e = 'neutral';
  else if (st.flags.hatStolen) e = 'neutral';
  p.emotion = e;
}
