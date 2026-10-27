// W5 Marcoverse easter eggs: M1 to M14 (SPEC §7), plus MX extras, G8 and G9.

import { EV, say, egg, withLines, zoneEgg, gobbleEgg, findNpc, npcDist, countEvents, sayOnce, distXZ, playerName, teaTimeEgg, geraldDisguiseEgg } from './common.js';

export const HOP_ZONES = ['hop1', 'hop2', 'hop3', 'hop4', 'hop5', 'hop6', 'hop7', 'hop8'];

// Split bark times into groups (gaps over `gap` seconds start a new group).
export function barkGroups(times, gap = 0.8) {
  const groups = [];
  let n = 0;
  for (let i = 0; i < times.length; i++) {
    if (i > 0 && times[i] - times[i - 1] > gap) { groups.push(n); n = 0; }
    n++;
  }
  if (n) groups.push(n);
  return groups;
}

export function makeEggsW5(P) {
  const M1 = zoneEgg('M1', 'w5', { zone: 'skyline', secs: 3, line: 'egg.M1.line', after(ctx) { ctx.flag('M1.logo', true); } });

  // M2: packet-loss pigeon: bits of Gerald's data drift off behind him.
  const M2 = withLines(egg('M2', 'w5', {
    tick(ctx) {
      if ((ctx.state.tick & 255) !== 0) return; // about every 4 s
      const n = ctx.flag('M2.dropped') || 0;
      if (n >= 24) return;
      const g = findNpc(ctx, 'gerald');
      if (!g) return;
      ctx.flag('M2.dropped', n + 1);
      ctx.spawnItem('packet', g.x - Math.sin(g.yaw || 0) * 6, g.z - Math.cos(g.yaw || 0) * 6, {});
    },
    onEvent(ev, ctx) {
      if (ctx.isFound() || ev.type !== EV.GOBBLE || ev.itemType !== 'packet') return;
      const g = findNpc(ctx, 'gerald');
      if (!g || distXZ(ev.x, ev.z, g.x, g.z) > 25 * Math.max(1, ctx.player.size / 8)) return;
      ctx.found();
      say(ctx, 'gerald', 'egg.M2.line');
    },
  }), ['egg.M2.line']);

  // M3: the 404 door is Not Found while you look at it; turn your back and it opens.
  const M3 = withLines(egg('M3', 'w5', {
    tick(ctx) {
      if ((ctx.state.tick & 3) !== 0) return;
      const p = ctx.player;
      const d = ctx.dist(P.door.x, P.door.z);
      if (ctx.zone('room404').inside && !ctx.isFound()) { ctx.found(); say(ctx, 'narrator', 'egg.M3.line2'); }
      if (d > 140) return;
      const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
      const facing = (fx * (P.door.x - p.x) + fz * (P.door.z - p.z)) / Math.max(1e-3, d);
      const open = !!ctx.flag('M3.open');
      if (!open && facing < -0.3) {
        const t = (ctx.flag('M3.t') || 0) + 4 / 60;
        ctx.flag('M3.t', t);
        if (t > 1.5) {
          ctx.flag('M3.open', true);
          ctx.revealItem('M3');
          ctx.emit({ type: EV.GATE, id: 'door404', open: true });
          sayOnce(ctx, 'narrator', 'egg.M3.line1', null, 20);
        }
      } else if (!open) ctx.flag('M3.t', 0);
      else if (facing > 0.6 && d > 25 + p.size) {
        ctx.flag('M3.open', false);
        ctx.flag('M3.t', 0);
        ctx.emit({ type: EV.GATE, id: 'door404', open: false });
      }
    },
  }), ['egg.M3.line1', 'egg.M3.line2']);

  const M4 = zoneEgg('M4', 'w5', { zone: 'subnet', secs: 2, line: 'egg.M4.line' });

  // M5: Packet's TTL counts down with every hop (router tower) it guides you past.
  const M5 = withLines(egg('M5', 'w5', {
    tick(ctx) {
      if (ctx.isFound() || (ctx.state.tick & 7) !== 0) return;
      let seen = ctx.flag('M5.seen');
      if (!seen) { seen = {}; ctx.flag('M5.seen', seen); }
      for (const id of HOP_ZONES) {
        if (seen[id] || !ctx.zone(id).inside) continue;
        seen[id] = true;
        const n = Object.keys(seen).length;
        say(ctx, 'packet', 'egg.M5.line1', { ttl: 64 - n });
        if (n >= HOP_ZONES.length) { ctx.found(); say(ctx, 'packet', 'egg.M5.line2'); }
        return;
      }
    },
  }), ['egg.M5.line1', 'egg.M5.line2']);

  const M6 = zoneEgg('M6', 'w5', { zone: 'hologram', secs: 2, line: 'egg.M6.line' });
  const M7 = zoneEgg('M7', 'w5', { zone: 'plaque', secs: 2, line: 'egg.M7.line' });

  // M8: bark the HTTPS port at the firewall: 4 barks, pause, 4 barks, pause, 3 barks.
  const M8 = withLines(egg('M8', 'w5', {
    onEvent(ev, ctx) {
      if (ctx.isFound() || ev.type !== EV.BARK) return;
      if (ctx.dist(P.firewall.x, P.firewall.z) > 160) return;
      let arr = ctx.flag('M8.barks');
      if (!arr) { arr = []; ctx.flag('M8.barks', arr); }
      const now = ctx.state.time;
      if (arr.length && now - arr[arr.length - 1] > 3) arr.length = 0;
      arr.push(now);
      if (arr.length > 20) arr.shift();
    },
    tick(ctx) {
      if (ctx.isFound() || (ctx.state.tick & 3) !== 0) return;
      const arr = ctx.flag('M8.barks');
      if (!arr || !arr.length) return;
      const quiet = ctx.state.time - arr[arr.length - 1];
      if (quiet < 1.0) return;
      const g = barkGroups(arr);
      const tail = g.slice(-3);
      const done = quiet > 3;
      if (done) arr.length = 0;
      if (tail.length === 3 && tail[0] === 4 && tail[1] === 4 && tail[2] === 3) {
        arr.length = 0;
        ctx.found();
        ctx.flag('M8.open', true);
        ctx.revealItem('M8');
        ctx.emit({ type: EV.GATE, id: 'firewall', open: true });
        say(ctx, 'packet', 'egg.M8.line');
      } else if (done && g.length >= 2) sayOnce(ctx, 'packet', 'egg.M8.wrong', null, 12);
    },
  }), ['egg.M8.line', 'egg.M8.wrong']);

  const M9 = zoneEgg('M9', 'w5', { zone: 'dns', secs: 2, line: 'egg.M9.line', vars: (ctx) => ({ name: playerName(ctx) }) });

  // M10: the three-way handshake. SYN (walk up), SYN-ACK (it waves), ACK (play-bow).
  const M10 = withLines(egg('M10', 'w5', {
    tick(ctx) {
      if (ctx.isFound() || (ctx.state.tick & 7) !== 0) return;
      const t = ctx.flag('M10.synack');
      const r = 22 * Math.max(1, ctx.player.size / 8);
      if (t != null) {
        if (ctx.state.time - t > 10) { ctx.flag('M10.synack', null); say(ctx, 'synpacket', 'egg.M10.line3'); }
        return;
      }
      if (npcDist(ctx, 'synpacket') > r) return;
      if (ctx.flag('M10.cool') && ctx.state.time - ctx.flag('M10.cool') < 6) return;
      ctx.flag('M10.synack', ctx.state.time);
      ctx.flag('M10.cool', ctx.state.time);
      ctx.setNpcAnim('synpacket', 'wave');
      say(ctx, 'synpacket', 'egg.M10.line1');
    },
    onEvent(ev, ctx) {
      if (ctx.isFound() || ev.type !== EV.PLAY_BOW || ctx.flag('M10.synack') == null) return;
      if (npcDist(ctx, 'synpacket') > 30 * Math.max(1, ctx.player.size / 8)) return;
      ctx.found();
      const n = findNpc(ctx, 'synpacket');
      ctx.spawnItem('handshake', n ? n.x + 8 : P.syn.x + 8, n ? n.z : P.syn.z, { golden: true });
      say(ctx, 'synpacket', 'egg.M10.line2');
    },
  }), ['egg.M10.line1', 'egg.M10.line2', 'egg.M10.line3']);

  const M11 = gobbleEgg('M11', 'w5', { type: 'loaderball', line: 'egg.M11.line' });

  // M12: three kittens tangled in the cable spaghetti (unlocks Router-Cat).
  const M12 = withLines(egg('M12', 'w5', {
    tick(ctx) {
      if (ctx.isFound() || (ctx.state.tick & 7) !== 0) return;
      let got = ctx.flag('M12.got');
      if (!got) { got = {}; ctx.flag('M12.got', got); }
      for (const id of ['kitten1', 'kitten2', 'kitten3']) {
        if (got[id] || npcDist(ctx, id) > 9 * Math.max(1, ctx.player.size / 4)) continue;
        got[id] = true;
        ctx.setNpcAnim(id, 'hop');
        const n = Object.keys(got).length;
        if (n < 3) say(ctx, id, 'egg.M12.line1', { n });
        else { ctx.found(); say(ctx, id, 'egg.M12.line2'); }
        return;
      }
    },
  }), ['egg.M12.line1', 'egg.M12.line2']);

  const M13 = withLines(egg('M13', 'w5', {
    tick(ctx) {
      if (ctx.isFound() || (ctx.state.tick & 7) !== 0) return;
      const z = ctx.zone('lag');
      if (!z.inside || z.time < 3) return;
      ctx.found();
      say(ctx, 'player', 'egg.M13.line');
    },
  }), ['egg.M13.line']);

  // M14: bark at the castle's big switch and it does exactly what IT support says.
  const M14 = withLines(egg('M14', 'w5', {
    init(ctx) { ctx.flag('M14.lights', 1); },
    tick(ctx) {
      const t0 = ctx.flag('M14.t');
      if (t0 == null) return;
      const dt = ctx.state.time - t0;
      const v = dt < 0.6 ? 1 - dt / 0.6 : dt < 2.6 ? 0 : Math.min(1, (dt - 2.6) / 1.2);
      ctx.flag('M14.lights', v);
      if (dt > 4) ctx.flag('M14.t', null);
    },
    onEvent(ev, ctx) {
      if (ev.type !== EV.BARK || !ctx.zone('castleGate').inside || ctx.flag('M14.t') != null) return;
      ctx.flag('M14.t', ctx.state.time);
      ctx.emit({ type: 'lights', id: 'datacastle', cycle: true });
      if (!ctx.isFound()) { ctx.found(); say(ctx, 'packet', 'egg.M14.line'); }
    },
  }), ['egg.M14.line']);

  const MX1 = withLines(egg('MX1', 'w5', {
    onEvent(ev, ctx) {
      if (ctx.isFound() || ev.type !== EV.BARK) return;
      let inHop = false;
      for (const id of HOP_ZONES) if (ctx.zone(id).inside) { inHop = true; break; }
      if (!inHop) return;
      if (countEvents(ctx, 'MX1.barks', ctx.state.time, 6) < 10) return;
      ctx.found();
      say(ctx, 'packet', 'egg.MX1.line');
    },
  }), ['egg.MX1.line']);

  const MX2 = withLines(egg('MX2', 'w5', {
    tick(ctx) {
      if (ctx.isFound() || (ctx.state.tick & 15) !== 0) return;
      if (ctx.player.size < 100 || !ctx.zone('localhost').inside) return;
      ctx.found();
      say(ctx, 'narrator', 'egg.MX2.line');
    },
  }), ['egg.MX2.line']);

  return [M1, M2, M3, M4, M5, M6, M7, M8, M9, M10, M11, M12, M13, M14, MX1, MX2, teaTimeEgg('w5', ['teaurn']), geraldDisguiseEgg('w5')];
}
