// W4 Snowy Highlands easter eggs: H1 to H13 (SPEC §7), plus HX extras, G8 and G9.

import { EV, say, egg, withLines, zoneEgg, gobbleEgg, npcEgg, findNpc, npcDist, findItems, countEvents, distXZ, teaTimeEgg, geraldDisguiseEgg } from './common.js';

export function makeEggsW4(P) {
  // H1: knock a curling stone into the house. Stones on the rink can't be gobbled
  // until one has been delivered (they are for curling, not lunch).
  const H1 = withLines(egg('H1', 'w4', {
    init(ctx) { ctx.flag('nogobble:curlingstone', true); },
    tick(ctx) {
      if (ctx.isFound() || (ctx.state.tick & 3) !== 0) return;
      let list = ctx.flag('H1.stones');
      if (!list || (ctx.state.tick & 127) === 0) { list = findItems(ctx, 'curlingstone', P.rink.x, P.rink.z, 30); ctx.flag('H1.stones', list); }
      const it = ctx.state.items;
      for (const i of list) {
        if (it.state[i] >= 3) continue;
        if (distXZ(it.x[i], it.z[i], P.house.x, P.house.z) > 1.9) continue;
        ctx.found();
        ctx.flag('nogobble:curlingstone', false);
        for (const id of ['curler1', 'curler2', 'curler3']) ctx.setNpcAnim(id, 'cheer');
        say(ctx, 'curler1', 'egg.H1.line');
        return;
      }
    },
  }), ['egg.H1.line']);

  // H2: sit by the hidden loch cove for 20 s and something surfaces.
  const H2 = withLines(egg('H2', 'w4', {
    tick(ctx) {
      if (ctx.isFound()) return;
      const z = ctx.zone('lochCove');
      if (!z.inside || ctx.stillTime() < 20) return;
      ctx.found();
      ctx.emit({ type: 'surface', who: 'gerald', prop: 'rubberring', x: P.cove.x, z: P.cove.z });
      say(ctx, 'narrator', 'egg.H2.line1');
      say(ctx, 'gerald', 'egg.H2.line2');
    },
  }), ['egg.H2.line1', 'egg.H2.line2']);

  // H3: the belly-slide course down the glen, top to bottom in good time, ends at the golden snowflake.
  const H3 = withLines(egg('H3', 'w4', {
    tick(ctx) {
      if (ctx.isFound() || (ctx.state.tick & 3) !== 0) return;
      if (ctx.zone('slideTop').inside) { if (ctx.flag('H3.t') == null) say(ctx, 'narrator', 'egg.H3.line1'); ctx.flag('H3.t', ctx.state.time); return; }
      const t = ctx.flag('H3.t');
      if (t == null || !ctx.zone('slideEnd').inside) return;
      const limit = ctx.species.id === 'penguin' ? 30 : 24;
      if (ctx.state.time - t > limit) { ctx.flag('H3.t', null); say(ctx, 'narrator', 'egg.H3.line3'); return; }
      ctx.found();
      ctx.spawnItem('snowflake', P.slideEnd.x, P.slideEnd.z, { golden: true });
      say(ctx, 'narrator', 'egg.H3.line2');
    },
  }), ['egg.H3.line1', 'egg.H3.line2', 'egg.H3.line3']);

  // H4: the piper's drone pitches down as you grow (audio reads flags['H4.pitch']).
  const H4 = withLines(egg('H4', 'w4', {
    tick(ctx) {
      if ((ctx.state.tick & 15) !== 0) return;
      const d = npcDist(ctx, 'piper');
      const pitch = Math.max(0.5, Math.pow(ctx.state.goals.start / ctx.player.size, 0.18));
      ctx.flag('H4.pitch', pitch);
      if (ctx.isFound()) return;
      if (d > 14 * Math.max(1, ctx.player.size / 3)) { ctx.flag('H4.t', 0); return; }
      const t = (ctx.flag('H4.t') || 0) + 16 / 60;
      ctx.flag('H4.t', t);
      if (t > 5 && ctx.player.size > ctx.state.goals.start * 1.6) { ctx.found(); say(ctx, 'narrator', 'egg.H4.line'); }
    },
  }), ['egg.H4.line']);

  const H5 = gobbleEgg('H5', 'w4', {
    type: 'snowman', line: 'egg.H5.line',
    after(ctx, ev) { ctx.emit({ type: 'carrotcam', x: ev.x, z: ev.z }); },
  });

  const H6 = zoneEgg('H6', 'w4', {
    zone: 'hamish', secs: 3, line: 'egg.H6.line',
    after(ctx) { const c = findNpc(ctx, 'hamish'); if (c) c.mood = 'judging'; },
  });

  const H7 = zoneEgg('H7', 'w4', { zone: 'liftsign', secs: 2, line: 'egg.H7.line' });

  const H8 = withLines(egg('H8', 'w4', {
    tick(ctx) {
      if (ctx.isFound() || (ctx.state.tick & 7) !== 0) return;
      if (npcDist(ctx, 'pru') > Math.max(4, ctx.player.size * 2) || ctx.stillTime() < 1.5) return;
      ctx.found();
      ctx.buff('tea', 6);
      say(ctx, 'pru', 'egg.H8.line');
    },
  }), ['egg.H8.line']);

  // H9: aurora at dusk (the last quarter of the timer, or the weather roll). Stop and look up.
  const H9 = withLines(egg('H9', 'w4', {
    tick(ctx) {
      if (ctx.isFound() || (ctx.state.tick & 15) !== 0) return;
      const s = ctx.state;
      const timer = s.goals.timer || 360;
      const dusk = (s.weather && s.weather.kind === 'aurora') || (s.mode === 'chill' ? s.time > 300 : s.time > timer * 0.72);
      if (!dusk) return;
      if (!ctx.flag('aurora')) ctx.flag('aurora', true);
      if (ctx.stillTime() < 3) return;
      ctx.found();
      say(ctx, 'narrator', 'egg.H9.line');
    },
  }), ['egg.H9.line']);

  // H10: sit still on fresh snow for 5 s: a snow angel shaped like your species.
  const H10 = withLines(egg('H10', 'w4', {
    tick(ctx) {
      if ((ctx.state.tick & 7) !== 0) return;
      const p = ctx.player;
      const ready = p.surface === 'snow' && ctx.stillTime() >= 5;
      if (!ready) { if (ctx.flag('H10.made')) ctx.flag('H10.made', false); return; }
      if (ctx.flag('H10.made')) return;
      ctx.flag('H10.made', true);
      ctx.emit({ type: 'snowAngel', x: p.x, z: p.z, species: ctx.species.id, size: p.size });
      if (!ctx.isFound()) { ctx.found(); say(ctx, 'player', 'egg.H10.line'); }
    },
  }), ['egg.H10.line']);

  const H11 = withLines(egg('H11', 'w4', {
    tick(ctx) {
      if (ctx.isFound() || (ctx.state.tick & 7) !== 0) return;
      const g = findNpc(ctx, 'gerald');
      if (!g) return;
      const dx = (g.x - P.loch.x) / P.loch.rx, dz = (g.z - P.loch.z) / P.loch.rz;
      if (dx * dx + dz * dz > 0.9) return;
      if (ctx.dist(g.x, g.z) > 10 * Math.max(1, ctx.player.size / 3)) return;
      ctx.found();
      say(ctx, 'gerald', 'egg.H11.line');
    },
  }), ['egg.H11.line']);

  const H12 = zoneEgg('H12', 'w4', { zone: 'sculpture', secs: 2, line: 'egg.H12.line' });

  const H13 = withLines(egg('H13', 'w4', {
    tick(ctx) {
      if (ctx.isFound() || (ctx.state.tick & 7) !== 0) return;
      if (npcDist(ctx, 'haggis') > 4 * Math.max(1, ctx.player.size / 2)) return;
      ctx.found();
      say(ctx, 'narrator', 'egg.H13.line');
    },
  }), ['egg.H13.line']);

  const HX1 = withLines(egg('HX1', 'w4', {
    onEvent(ev, ctx) {
      if (ctx.isFound() || ev.type !== EV.BARK) return;
      if (npcDist(ctx, 'piper') > 14 * Math.max(1, ctx.player.size / 3)) return;
      if (countEvents(ctx, 'HX1.barks', ctx.state.time, 4) < 3) return;
      ctx.found();
      for (const n of ctx.state.npcs || []) if (n.kind === 'kid' || n.kind === 'curler' || n.kind === 'piper') ctx.setNpcAnim(n.id, 'dance');
      say(ctx, 'piper', 'egg.HX1.line');
    },
  }), ['egg.HX1.line']);

  const HX2 = withLines(egg('HX2', 'w4', {
    onEvent(ev, ctx) {
      if (ctx.isFound() || ev.type !== EV.PLAY_BOW) return;
      if (npcDist(ctx, 'hamish') > 8 * Math.max(1, ctx.player.size / 3)) return;
      ctx.found();
      say(ctx, 'narrator', 'egg.HX2.line');
    },
  }), ['egg.HX2.line']);

  return [H1, H2, H3, H4, H5, H6, H7, H8, H9, H10, H11, H12, H13, HX1, HX2, teaTimeEgg('w4'), geraldDisguiseEgg('w4')];
}
