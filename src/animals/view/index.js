// STUB (lead): replaced by the Animals agent.
export function createAnimalView({ THREE, mats, species, look }) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.5, 4, 8), mats.toon(look.base));
  body.rotation.x = Math.PI / 2; body.position.y = 0.35; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), mats.toon(look.base));
  head.position.set(0, 0.55, 0.45); g.add(head);
  return { object3d: g, update() {}, setLook() {}, setEmotion() {}, dispose() {} };
}
export function createCritterView({ THREE, mats }) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), mats.toon('#888888')));
  return { object3d: g, update() {}, setLook() {}, dispose() {} };
}
