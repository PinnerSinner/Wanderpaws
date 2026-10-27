// W1 Copacabana easter eggs: C1 to C13 (SPEC §7), plus CX extras, G8 and G9.
// P holds the key positions from the layout (w1-copacabana.js).

import { EV, egg, withLines, zoneEgg, gobbleEgg, findNpc, npcDist, findItems, near, countEvents, sayOnce, distXZ, teaTimeEgg, geraldDisguiseEgg } from './common.js';

// Morse schedule: [[on, off], ...] in seconds plus the cycle length.
export function morse(word, unit = 0.3) {
  const CODE = { P: '.--.', I: '..', N: '-.', G: '--.' };
  const spans = [];
  let t = 0;
  for (const ch of word) {
    const code = CODE[ch] || '';
    for (let i = 0; i < code.length; i++) {
      const len = code[i] === '.' ? unit : unit * 3;
      spans.push([t, t + len]);
      t += len + unit;
    }
    t += unit * 2; // 3 units between letters
  }
  t += unit * 4; // 7 units before it repeats
  return { spans, length: t };
}

export function morseOn(sched, time) {
  const m = time % sched.length;
  for (const [a, b] of sched.spans) if (m >= a && m < b) return true;
  return false;
}

export function makeEggsW1(P) {
  const ping = morse('PING');

  const C1 = withLines(egg('C1', 'w1', {
    tick(ctx) {
      const on = morseOn(ping, ctx.state.time);
      if (ctx.flag('C1.led') !== on) ctx.flag('C1.led', on);
    },
    onEvent(ev, ctx) {
      if (ctx.isFound() || ev.type !== EV.GOBBLE || ev.itemType !== 'router' || !near(ev, P.router.x, P.router.z, 2.5)) return;
      if (morseOn(ping, ctx.state.time) || ctx.flag('C1.led')) {
        ctx.found();
        ctx.say('narrator', 'egg.C1.line1');
      } else {
        ctx.say('narrator', 'egg.C1.line2');
        ctx.spawnItem('router', P.router.x, P.router.z, {});
      }
    },
  }), ['egg.C1.line1', 'egg.C1.line2']);

  const C2 = zoneEgg('C2', 'w1', {
    zone: 'hut127', secs: 3, line: 'egg.C2.line',
    after(ctx) { ctx.emit({ type: 'nap', x: P.hut.x, z: P.hut.z }); },
  });

  const C3 = withLines(egg('C3', 'w1', {
    onEvent(ev, ctx) {
      if (ev.type !== EV.GOBBLE || ev.itemType !== 'caipirinha') return;
      ctx.buff('wobble', 8);
      if (!ctx.isFound()) { ctx.found(); ctx.say('player', 'egg.C3.line'); }
    },
  }), ['egg.C3.line']);

  const C4 = withLines(egg('C4', 'w1', {
    onEvent(ev, ctx) {
      if (ctx.isFound() || ev.type !== EV.PLAY_BOW) return;
      if (npcDist(ctx, 'marco') > Math.max(7, ctx.player.size * 3)) return;
      ctx.found();
      ctx.setNpcAnim('marco', 'throw');
      ctx.say('marco', 'egg.C4.line');
    },
  }), ['egg.C4.line']);

  // C5: knock the footvolley ball over the net three times (or hop the net yourself).
  const C5 = withLines(egg('C5', 'w1', {
    tick(ctx) {
      if (ctx.isFound()) return;
      const it = ctx.state.items;
      if (!it) return;
      let idx = ctx.flag('C5.idx');
      if (idx == null || idx < 0 || idx >= it.count) {
        const f = findItems(ctx, 'football', P.ball.x, P.ball.z, 4);
        idx = f.length ? f[0] : -1;
        ctx.flag('C5.idx', idx);
        if (idx < 0) {
          // the ball got gobbled: the lads have a spare after a moment
          const wait = (ctx.flag('C5.wait') || 0) + 1 / 60;
          ctx.flag('C5.wait', wait);
          if (wait > 5) { ctx.flag('C5.wait', 0); ctx.flag('C5.idx', ctx.spawnItem('football', P.ball.x, P.ball.z, {})); ctx.say('fv1', 'egg.C5.line3'); }
          return;
        }
      }
      if (it.state[idx] >= 3) { ctx.flag('C5.idx', -1); return; }
      const x = it.x[idx], z = it.z[idx];
      if (Math.abs(z - P.net.z) > 4.5) return;
      const side = x < P.net.x ? -1 : 1;
      const prev = ctx.flag('C5.side');
      if (prev == null) { ctx.flag('C5.side', side); return; }
      if (side !== prev) { ctx.flag('C5.side', side); bumpCount(ctx, side); }
    },
    onEvent(ev, ctx) {
      if (ctx.isFound()) return;
      const p = ctx.player;
      if (ev.type === EV.JUMP) ctx.flag('C5.jumpSide', p.x < P.net.x ? -1 : 1);
      else if (ev.type === EV.LAND) {
        const js = ctx.flag('C5.jumpSide');
        ctx.flag('C5.jumpSide', 0);
        if (!js || Math.abs(p.z - P.net.z) > 4.5 || Math.abs(p.x - P.net.x) > 4) return;
        const side = p.x < P.net.x ? -1 : 1;
        if (side !== js) bumpCount(ctx, side);
      }
    },
  }), ['egg.C5.line1', 'egg.C5.line2', 'egg.C5.line3']);

  function bumpCount(ctx, side) {
    const n = (ctx.flag('C5.count') || 0) + 1;
    ctx.flag('C5.count', n);
    if (n < 3) { ctx.say('fv2', 'egg.C5.line1'); return; }
    ctx.found();
    for (const id of ['fv1', 'fv2', 'fv3', 'fv4']) ctx.setNpcAnim(id, 'cheer');
    ctx.say('fv1', 'egg.C5.line2');
    ctx.spawnItem('football', P.net.x + side * 3, P.net.z, { golden: true });
  }

  const C6 = gobbleEgg('C6', 'w1', {
    type: 'sandcastle', x: P.castle.x, z: P.castle.z, r: 3, line: 'egg.C6.line',
    after(ctx) { ctx.spawnItem('flipflop', P.castle.x, P.castle.z, { golden: true }); },
  });

  const C7 = withLines(egg('C7', 'w1', {
    tick(ctx) {
      if (ctx.isFound() || (ctx.state.tick & 7) !== 0) return;
      const d = npcDist(ctx, 'magpenguin');
      if (d > 3.5) return;
      if (ctx.species.id === 'penguin') {
        ctx.found();
        ctx.setNpcAnim('magpenguin', 'wave');
        ctx.say('magpenguin', 'egg.C7.line1');
      } else sayOnce(ctx, 'magpenguin', 'egg.C7.line2', null, 30);
    },
  }), ['egg.C7.line1', 'egg.C7.line2']);

  // C8: ten biscuit packets from Seu Zé. He drops a fresh one every so often.
  const C8 = withLines(egg('C8', 'w1', {
    tick(ctx) {
      if (ctx.isFound()) return;
      const t = (ctx.flag('C8.t') || 0) + 1 / 60;
      if (t < 8) { ctx.flag('C8.t', t); return; }
      ctx.flag('C8.t', 0);
      const dropped = ctx.flag('C8.dropped') || 0;
      if (dropped >= 16) return;
      const ze = findNpc(ctx, 'ze');
      if (!ze) return;
      ctx.flag('C8.dropped', dropped + 1);
      ctx.spawnItem('biscuitpacket', ze.x - Math.sin(ze.yaw || 0) * 1.2, ze.z - Math.cos(ze.yaw || 0) * 1.2, {});
      if (dropped % 3 === 0) sayOnce(ctx, 'ze', 'egg.C8.call', null, 20);
    },
    onEvent(ev, ctx) {
      if (ctx.isFound() || ev.type !== EV.GOBBLE || ev.itemType !== 'biscuitpacket') return;
      const ze = findNpc(ctx, 'ze');
      if (!ze || distXZ(ev.x, ev.z, ze.x, ze.z) > 16) return;
      const n = (ctx.flag('C8.count') || 0) + 1;
      ctx.flag('C8.count', n);
      if (n >= 10) { ctx.found(); ctx.say('ze', 'egg.C8.line'); }
    },
  }), ['egg.C8.line', 'egg.C8.call']);

  const C9 = zoneEgg('C9', 'w1', { zone: 'coconut', secs: 4, speaker: 'coco', line: 'egg.C9.line', buff: ['speed', 6] });

  const C10 = zoneEgg('C10', 'w1', { zone: 'reader', secs: 2, line: 'egg.C10.line' });

  const C11 = withLines(egg('C11', 'w1', {
    onEvent(ev, ctx) {
      if (ctx.isFound() || ev.type !== EV.BARK) return;
      if (ctx.dist(P.tower.x, P.tower.z) > 10) return;
      if (countEvents(ctx, 'C11.barks', ctx.state.time, 4) < 3) return;
      ctx.found();
      ctx.setNpcAnim('kev', 'point');
      ctx.say('kev', 'egg.C11.line');
    },
  }), ['egg.C11.line']);

  // C12: dawdle until sunset in Chill and soft fireworks bloom out at sea.
  const C12 = withLines(egg('C12', 'w1', {
    tick(ctx) {
      if (ctx.isFound() || ctx.state.mode !== 'chill' || ctx.state.time < 360) return;
      ctx.found();
      ctx.flag('fireworks', true);
      ctx.emit({ type: 'fireworks', x: P.fireworks.x, z: P.fireworks.z });
      ctx.say('narrator', 'egg.C12.line');
    },
  }), ['egg.C12.line']);

  // C13: the pavement spells MARCOVERSE from above. Sim-side: stand still on the
  // compass-rose tile for 5 s (the photo-mode view is render-only).
  const C13 = zoneEgg('C13', 'w1', {
    zone: 'mosaic', secs: 5, line: 'egg.C13.line',
    after(ctx) { ctx.flag('C13.logo', true); },
  });

  // Extras
  const CX1 = withLines(egg('CX1', 'w1', {
    onEvent(ev, ctx) {
      if (ctx.isFound() || ev.type !== EV.SHAKE) return;
      const npcs = ctx.state.npcs || [];
      const r = Math.max(3, ctx.player.size * 4);
      for (const n of npcs) {
        if (n.kind !== 'sunbather' && n.kind !== 'reader') continue;
        if (ctx.dist(n.x, n.z) > r) continue;
        ctx.found();
        ctx.say(n.id, 'egg.CX1.line');
        return;
      }
    },
  }), ['egg.CX1.line']);

  const CX2 = withLines(egg('CX2', 'w1', {
    onEvent(ev, ctx) {
      if (ctx.isFound() || ev.type !== EV.GOBBLE || ev.itemType !== 'flipflop') return;
      const last = ctx.flag('CX2.last');
      ctx.flag('CX2.last', ctx.state.time);
      if (last != null && ctx.state.time - last < 2.5) { ctx.found(); ctx.say('player', 'egg.CX2.line'); }
    },
  }), ['egg.CX2.line']);

  return [C1, C2, C3, C4, C5, C6, C7, C8, C9, C10, C11, C12, C13, CX1, CX2, teaTimeEgg('w1'), geraldDisguiseEgg('w1')];
}
