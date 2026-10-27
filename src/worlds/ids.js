// Shared id lists so World-data (places things) and World-meshes (builds them)
// can work in parallel. Seeded by the lead, owned by World-data from here on.
// World-meshes must provide a builder for every id below.

// Static scenery (non-gobble-able). Rough footprint in metres [w, h, d] for scale.
export const SCENERY = {
  // shared
  palm: { dims: [3, 9, 3], note: 'Coconut palm, sways' },
  streetlamp: { dims: [0.4, 5, 0.4] },
  bunting: { dims: [12, 0.6, 0.1], note: 'A strung line of flags between two points (scale x = length), flutters' },
  flagpole: { dims: [0.2, 6, 0.2], note: 'With a fluttering pennant' },
  rock: { dims: [2, 1.4, 2] },
  bush: { dims: [1.6, 1.2, 1.6], note: 'Sways' },
  fence: { dims: [4, 1, 0.1], note: 'Picket or rope fence section' },
  // w1 Copacabana
  wavepavement: { dims: [1, 0, 1], note: 'The black-and-white wave promenade strip; scale x/z to the promenade rectangle' },
  avenue: { dims: [1, 0, 1], note: 'Road with lane markings; scale to rect' },
  hotelblock: { dims: [24, 30, 16], note: 'Art deco seafront hotel or apartment block, pastel, balconies' },
  apartmentblock: { dims: [16, 40, 14], note: 'Tall seafront flats, varied colours' },
  lifeguardtower: { dims: [3, 6, 3], note: 'Posto with a flag; Captain Kev lives here' },
  kioskbig: { dims: [4, 3.2, 4], note: 'Beach kiosk with a thatched or round roof (the scenery version)' },
  sugarloaf: { dims: [300, 220, 200], note: 'Distant backdrop mountain silhouette, out at sea' },
  coconutstall: { dims: [3, 2.6, 2], note: 'Green coconut stall with a cart' },
  cyclelane: { dims: [1, 0, 1], note: 'Red cycle lane strip; scale to rect' },
  showertap: { dims: [0.6, 2.5, 0.6], note: 'Beach shower post' },
  beachhut: { dims: [3, 3, 3], note: 'Beach hut with the 127.0.0.1 sign (egg C2)' },
  footvolleycourt: { dims: [16, 0.05, 8], note: 'Rope court lines on sand' },
  caipistand: { dims: [3, 2.6, 2], note: 'Lime squash stand with a striped awning (egg C3)' },
  // w2 London
  terrace: { dims: [30, 12, 9], note: 'Row of Georgian or Victorian terraced houses, coloured doors' },
  parkgate: { dims: [6, 3, 0.4] },
  railings: { dims: [6, 1.2, 0.1], note: 'Black park railings' },
  pond: { dims: [1, 0, 1], note: 'Pond edge kerb; the water itself is a water body' },
  oaktree: { dims: [10, 14, 10], note: 'Big rounded oak, sways' },
  plane_tree: { dims: [8, 16, 8], note: 'London plane, sways' },
  admiralcolumn: { dims: [5, 40, 5], note: 'A tall column with a little statue on top (Nigel perches here)' },
  gallerywindow: { dims: [4, 3, 0.4], note: 'Shop or gallery window with "Portrait of a Good Boy"' },
  coffeecart: { dims: [2.5, 2.4, 1.6] },
  busstop: { dims: [4, 2.6, 1.4], note: 'With a 127 timetable' },
  road: { dims: [1, 0, 1], note: 'Tarmac road with markings; scale to rect' },
  pavement: { dims: [1, 0, 1], note: 'Paving slabs; scale to rect' },
  hedge: { dims: [6, 1.6, 1.2] },
  sentrybox: { dims: [1.4, 2.8, 1.4] },
  // w3 Tijuca
  jungletree: { dims: [12, 22, 12], note: 'Tall Atlantic rainforest tree with buttress roots, sways' },
  fern: { dims: [2, 1.5, 2], note: 'Sways' },
  waterfall: { dims: [14, 24, 4], note: 'Animated cascade with spray, cave behind' },
  cliff: { dims: [30, 25, 10] },
  ropebridge: { dims: [24, 2, 2.5], note: 'Sagging rope bridge between two points' },
  lilypad: { dims: [1.2, 0.05, 1.2] },
  jaguarstatue: { dims: [2.5, 2, 1.2], note: 'Stone jaguar, eyes follow you (egg T10)' },
  lookoutdeck: { dims: [10, 4, 8], note: 'Viewpoint platform over the city' },
  citybackdrop: { dims: [600, 80, 50], note: 'Distant Rio skyline and bay seen from the lookout' },
  vine: { dims: [0.3, 10, 0.3], note: 'Hanging vine, sways' },
  trailmap: { dims: [2, 1.8, 0.2], note: 'Trail map as a star topology (egg T9)' },
  // w4 Highlands
  mountain: { dims: [200, 120, 200], note: 'Snowy backdrop mountain' },
  pine: { dims: [5, 12, 5], note: 'Snowy pine (scenery version), sways' },
  curlingrink: { dims: [40, 0.05, 6], note: 'Ice sheet with house rings' },
  stonewall: { dims: [8, 1.2, 0.8], note: 'Dry stone dyke' },
  bothyhut: { dims: [8, 5, 6], note: 'Stone bothy with a smoking chimney' },
  skiliftline: { dims: [1, 1, 1], note: 'Cable between pylons; scale to length' },
  icesculpture: { dims: [2, 2.2, 2], note: 'Ice router on a plinth (egg H12)' },
  heather: { dims: [2, 0.6, 2], note: 'Purple heather clump, sways' },
  piperstage: { dims: [3, 0.4, 3] },
  // w5 Marcoverse
  cloudisland: { dims: [120, 30, 120], note: 'Fluffy floating cloud platform base' },
  serverskyline: { dims: [40, 120, 40], note: 'Server-rack skyscraper with blinking LEDs' },
  cableriver: { dims: [1, 0, 1], note: 'Glowing cable bundle river; scale to rect' },
  routertower: { dims: [20, 80, 20], note: 'Tower with antenna, blinking' },
  datacastle: { dims: [160, 140, 120], note: 'Data-centre castle; lights go off and on (egg M14)' },
  door404: { dims: [10, 18, 2], note: 'The 404 door (egg M3)' },
  dnssign: { dims: [6, 12, 1], note: 'DNS signpost (egg M9)' },
  subnetsign: { dims: [12, 8, 1], note: '192.168.0.0/16 district sign (egg M4)' },
  binarypavement: { dims: [1, 0, 1], note: 'Wave pavement made of 1s and 0s; scale to rect' },
  hologram: { dims: [12, 10, 12], note: 'Marco teaching cats hologram (egg M6)' },
  firewallgate: { dims: [30, 20, 4], note: 'Flaming-but-cosy firewall gate (egg M8)' },
  plaque: { dims: [3, 2, 0.3], note: 'Generic sign or plaque; text from params' },
};

// People and Packet, built by World-meshes via buildHuman(kind).
export const HUMANS = ['marco', 'kev', 'ze', 'pru', 'packet', 'hologrammarco',
  'sunbather', 'jogger', 'cyclist', 'tourist', 'footvolleyer', 'vendor', 'kid', 'commuter', 'queuer', 'sentry',
  'birdwatcher', 'hiker', 'piper', 'skier', 'curler', 'techie', 'reader'];

// Animal NPCs, built by Animals via createCritterView(kind).
export const CRITTERS = ['pigeon', 'gerald', 'nigel', 'gull', 'toucan', 'marmoset', 'squirrel', 'sloth', 'highlandcow', 'haggis', 'kitten', 'magpenguin', 'frog', 'duckling', 'butterfly', 'fox'];

// Animation names any human or critter may be asked to play.
export const NPC_ANIMS = ['idle', 'walk', 'run', 'sit', 'lie', 'wave', 'cheer', 'tut', 'throw', 'flee', 'dance', 'sell', 'read', 'point', 'fly', 'peck', 'swim', 'hop'];
