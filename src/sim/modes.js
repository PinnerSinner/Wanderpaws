// Modes, timers, stars and the finish.
//   story / daily: world timer; star 1 goal, star 2 stretch before the timer, star 3 the world twist.
//   chill: no timer, stars 1 and 3 only; ends at the goal once star 3 is settled (or at the stretch).
//   zoomies: 3-minute run, endless respawn waves, combo score. Stars: goal, stretch, a 30-combo.
//   speedrun: no timer, ends the moment you reach the goal; star 2 is under par.
import { EV } from '../core/events.js';
import { TUNE } from './tune.js';
import { IS_GONE } from './items.js';
import { announceWeather } from './weather.js';

const WARN_AT = [60, 30, 10];

export function initModes(S) {
  const g = S.world.goals || {};
  const st = S.state;
  const goals = {
    start: g.start || 0.25, goal: g.goal || 1, stretch: g.stretch || (g.goal || 1) * 1.5,
    par: g.par || (g.timer || 300) * 0.7, timer: g.timer || 300, growthK: g.growthK || 1,
    milestones: (g.milestones || []).slice().sort((a, b) => a - b),
    star3: { kind: 'noHazards', ...(g.star3 || {}) },
  };
  if (S.mode === 'zoomies') goals.star3 = { kind: 'combo', count: 30 };
  if (goals.star3.kind === 'collectAll' && !goals.star3.count) {
    let n = 0;
    const ty = goals.star3.type;
    for (let i = 0; i < S.I.count; i++) if (S.I.state[i] !== IS_GONE && S.I.types[S.I.typeIndex[i]] === ty) n++;
    goals.star3.count = n || 1;
  }
  if (goals.star3.kind === 'combo' && !goals.star3.count) goals.star3.count = 30;
  st.goals = goals;
  const m = S.mode;
  st.timeLeft = m === 'zoomies' ? 180 : (m === 'chill' || m === 'speedrun') ? null : goals.timer;
  S.modeCtl = { warned: 0, waveT: 20, cap: m === 'chill' ? 3600 : m === 'speedrun' ? goals.timer * 3 : Infinity };
}

function award(S, idx) {
  const st = S.state;
  if (st.stars[idx]) return;
  st.stars[idx] = true;
  S.emit({ type: EV.STAR, index: idx });
}

function star3Done(S) {
  const st = S.state, s3 = st.goals.star3, R = S.run;
  switch (s3.kind) {
    case 'collectAll': return (st.starProgress.collected[s3.type] || 0) >= s3.count;
    case 'golden': return R.goldenFound.length > 0 || (s3.type ? R.goldenFound.indexOf(s3.type) >= 0 : false);
    case 'combo': return st.starProgress.maxCombo >= (s3.count || 30);
    default: return false; // noHazards and par are settled at the goal or the finish
  }
}

export function stepModes(S, dt) {
  const st = S.state, p = st.player, R = S.run, C = S.modeCtl, g = st.goals;
  if (st.phase === 'intro') {
    st.introLeft -= dt;
    if (st.introLeft <= 0) {
      st.introLeft = 0;
      st.phase = 'play';
      S.emit({ type: EV.GO });
      announceWeather(S);
    }
    return;
  }
  if (st.phase !== 'play') return;
  R.playTime += dt;
  // timer
  if (st.timeLeft != null) {
    const before = st.timeLeft;
    st.timeLeft = Math.max(0, st.timeLeft - dt);
    for (let k = 0; k < WARN_AT.length; k++) {
      if (before > WARN_AT[k] && st.timeLeft <= WARN_AT[k]) S.emit({ type: EV.TIMER_WARN, secondsLeft: WARN_AT[k] });
    }
  }
  // zoomies: endless waves
  if (S.mode === 'zoomies') {
    C.waveT -= dt;
    if (C.waveT <= 0) { C.waveT = 15; respawnWave(S); }
  }
  // stars
  if (!R.reachedGoal && p.size >= g.goal) {
    R.reachedGoal = true; R.goalTime = R.playTime;
    award(S, 0);
    S.setCamHint('pullback', 1.2);
    if (g.star3.kind === 'par' && R.playTime <= g.par) award(S, 2);
  }
  if (!R.reachedStretch && p.size >= g.stretch) {
    R.reachedStretch = true; R.stretchTime = R.playTime;
    if (S.mode !== 'chill' && S.mode !== 'speedrun') award(S, 1);
    S.setCamHint('pullback', 1.2);
  }
  if (!st.stars[2] && star3Done(S)) award(S, 2);
  // finishing
  const s3k = g.star3.kind;
  const settled = st.stars[2] || s3k === 'noHazards' || s3k === 'par';
  let reason = null;
  if (st.timeLeft != null && st.timeLeft <= 0) reason = 'timeout';
  else if (S.mode === 'speedrun' && R.reachedGoal) reason = 'goal';
  else if (S.mode === 'chill' && R.reachedGoal && (settled || R.reachedStretch)) reason = 'goal';
  else if ((S.mode === 'story' || S.mode === 'daily') && R.reachedStretch && settled) reason = 'stretch';
  else if (R.playTime >= C.cap) reason = 'timeout';
  if (reason) finishRun(S, reason);
}

function respawnWave(S) {
  const I = S.I, X = S.X;
  let n = 0;
  for (let i = 0; i < X.spareStart && n < 60; i++) {
    if (I.state[i] !== IS_GONE || I.golden[i] || X.flag[i]) continue;
    S.items.reveal(i, true); n++;
  }
  if (n) S.emit({ type: EV.ACTIVITY, kind: 'wave', phase: 'start', count: n });
}

export function finishRun(S, reason) {
  const st = S.state, p = st.player, R = S.run, g = st.goals;
  if (st.phase === 'finished') return;
  // end any combo so it pays out
  if (p.combo.count >= 2) { S.emit({ type: EV.COMBO_END, count: p.combo.count }); R.biccies += Math.floor(p.combo.count / 5); }
  p.combo.count = 0; p.combo.mult = 1; p.combo.timer = 0;
  if (g.star3.kind === 'noHazards' && R.reachedGoal && st.starProgress.hazardsTouched === 0) award(S, 2);
  if (S.mode === 'speedrun' && R.reachedGoal && R.goalTime <= g.par) award(S, 1);
  st.phase = 'finished';
  const stars = st.stars.slice();
  st.result = {
    stars, starCount: stars.filter(Boolean).length,
    size: p.size, gobbled: R.gobbled, biccies: R.biccies,
    time: R.reachedGoal ? R.goalTime : R.playTime, playTime: R.playTime,
    goldenFound: R.goldenFound.slice(), eggsFound: R.eggsFound.slice(),
    maxCombo: st.starProgress.maxCombo, distance: Math.round(R.distance * 10) / 10,
    pigeonsScared: R.pigeonsScared, hazardsTouched: st.starProgress.hazardsTouched,
    worldId: st.worldId, mode: S.mode, speciesId: S.species.id, playerName: S.playerName,
    score: R.score, reachedGoal: R.reachedGoal, reachedStretch: R.reachedStretch,
    goalTime: R.goalTime, stretchTime: R.stretchTime, reason,
    collected: { ...st.starProgress.collected }, barks: R.barks, sigUses: R.sigUses,
  };
  S.emit({ type: EV.FINISH, result: st.result, reason });
  void TUNE;
}
