// STUB (lead): replaced by the Worlds agent.
export function buildItemMesh(THREE, mats, typeId) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), mats.toon('#ff7a59'));
  m.position.y = 0.5;
  const g = new THREE.Group(); g.add(m); return g;
}
export function buildScenery(THREE, mats, world) {
  const g = new THREE.Group();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), mats.toon(world.palette.ground));
  ground.rotation.x = -Math.PI / 2; g.add(ground);
  return { group: g, update() {} };
}
export function buildHuman(THREE, mats, kind) {
  const g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 1, 4, 8), mats.toon('#4a7fd0'));
  b.position.y = 0.8; g.add(b);
  return { object3d: g, update() {} };
}
