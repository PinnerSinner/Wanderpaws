// placeholder, replaced below
export function createCritterView({ THREE, mats }) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), mats.toon('#888888')));
  return { object3d: g, update() {}, setLook() {}, setDisguise() {}, dispose() {} };
}
