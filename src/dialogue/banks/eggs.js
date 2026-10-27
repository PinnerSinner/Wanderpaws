// Ready-made lines for easter eggs (SPEC §7), so World-data's eggs can call
// ctx.say(speaker, 'bark.<speaker>.egg-<ID>') and get a voiced, recordable line.
// Each tag holds one line; its id is the tag itself (e.g. bark.kev.egg-C11).

export default {
  player: {
    'egg-C1': ['PONG!'],
    'egg-C2': ['There\'s no place like home. {name} has a little nap.'],
    'egg-C10': ['The page reads: "Layer 2: barking at the wrong frame."'],
    'egg-L6': ['Cat-5. Its brother Dog-6 is still in testing.'],
    'egg-L10': ['"In memory of the three seconds of sun, 14th July."'],
    'egg-T5': ['Brazil nut. From Brazil. Unlike the ones at Christmas.'],
    'egg-T8': ['The sticky note says the password is "banana".'],
    'egg-H7': ['"Load balancer: distributing skiers across three pistes."'],
    'egg-H12': ['"Frozen packet." Someone left it in the cold too long.'],
    'egg-M4': ['"192.168.0.0/16. Your neighbours are on a different VLAN."'],
    'egg-M7': ['"The Cloud is just someone else\'s computer."'],
    'egg-M9': ['DNS lookup: "Who\'s a good boy?" resolves to {name}.'],
    'egg-M11': ['Thanks for your patience.'],
  },
  kev: {
    'egg-C11': ['Oi. I can see you.'],
  },
  ze: {
    'egg-C8': [['Acabou o biscoito! Ganhou um chapéu!', 'The biscuits are gone! You\'ve won a hat!']],
    'egg-T11': [['AÇAÍ! OLHA O AÇAÍ! MAIS ALTO QUE A CACHOEIRA!', 'AÇAÍ! GET YOUR AÇAÍ! LOUDER THAN THE WATERFALL!']],
    'egg-C9': [['Um canudinho pra você! Saúde!', 'A little straw for you! Cheers!']],
  },
  marco: {
    'egg-C4': ['Fancy a game of fetch? I\'ve got a spare!'],
    'egg-M6': ['Right, class. Today: the OSI model. No napping at layer one.'],
    'egg-M10': ['SYN, SYN-ACK, ACK! A perfect three-way handshake!'],
    'egg-M14': ['Have you tried turning it off and on again?'],
  },
  pru: {
    'egg-L13': ['It\'s the water, dear. London water. Makes a proper brew.'],
    'egg-H8': ['Found my flask, did you? Go on then, have a sip.'],
  },
  packet: {
    'egg-M5': ['TTL decreasing! {count} hops left! Still loving it!'],
    'egg-M3': ['Error 404: door not found. Try looking away.'],
  },
  gerald: {
    'egg-H2': ['This is a rubber ring. I am relaxing. Do not look at me.'],
    'egg-H11': ['I am gliding. Majestically. Whoa. WHOA.'],
    'egg-M2': ['Is it me, or am I losing bits of myself? Packet loss. Rude.'],
  },
  narrator: {
    'egg-L3': ['The 127 to Localhost pulled up, exactly on time.'],
    'egg-C5': ['GOLAÇO!'],
    'egg-H1': ['Good stone!'],
  },
  nigel: {
    'egg-L2': ['Oi! Gerald\'s my cousin, and \'e owes me a fiver!'],
  },
};
