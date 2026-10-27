// The dressing-room showroom: a soft studio with a curved backdrop that melts
// into the floor, a round podium, warm key light and a turntable camera that
// auto-rotates gently and can be dragged to orbit.

export const STUDIO_PALETTE = {
  skyTop: '#ffe9d6', skyBottom: '#ffd9c4', horizon: '#ffe1cf', fog: '#ffe1cf', fogNear: 18, fogFar: 60,
  sun: '#fff4e6', sunIntensity: 1.9, ambient: '#ffe6ee', ground: '#f6d2c0', accent: '#ff7a59',
  water: '#4fcac8', waterDeep: '#1f7fa8', foam: '#ffffff', outline: '#3a2a22',
};
export const STUDIO_TOD = 0.42;

export function createShowroomStage(THREE, { mats }) {
  const group = new THREE.Group();
  group.name = 'stage:showroom';
  const geos = [];
  const floorG = new THREE.CircleGeometry(40, 48).rotateX(-Math.PI / 2); geos.push(floorG);
  const floor = new THREE.Mesh(floorG, mats.toon('#f8d8c6', { rim: false }));
  floor.receiveShadow = true;
  group.add(floor);
  const podG = new THREE.CylinderGeometry(1.15, 1.25, 0.16, 48); geos.push(podG);
  const podium = new THREE.Mesh(podG, mats.toon('#fff1e6'));
  podium.position.y = 0.08;
  podium.receiveShadow = true;
  podium.castShadow = true;
  group.add(podium);
  const ringG = new THREE.TorusGeometry(1.2, 0.035, 8, 64).rotateX(Math.PI / 2); geos.push(ringG);
  const ring = new THREE.Mesh(ringG, mats.toon('#ffb38a'));
  ring.position.y = 0.16;
  group.add(ring);
  // soft confetti dots on the floor for charm
  const dotG = new THREE.CircleGeometry(0.09, 12).rotateX(-Math.PI / 2); geos.push(dotG);
  const dots = new THREE.InstancedMesh(dotG, mats.toon('#ffffff', { rim: false }), 40);
  const m4 = new THREE.Matrix4();
  const palette = ['#ffb3c7', '#ffd88a', '#a8e6cf', '#b8d0ff', '#e0c2ff'];
  const c = new THREE.Color();
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 40; i++) {
    const a = rnd() * Math.PI * 2, r = 1.8 + rnd() * 5;
    m4.makeTranslation(Math.cos(a) * r, 0.005, Math.sin(a) * r);
    dots.setMatrixAt(i, m4);
    dots.setColorAt(i, c.set(palette[i % palette.length]));
  }
  group.add(dots);

  const hero = { x: 0, y: 0.16, z: 0, yaw: 0 };
  const cam = { yaw: Math.PI + 0.5, pitch: 0.22, idle: 99, dist: 3.4 };

  function addLook(dx, dy) {
    cam.yaw -= dx;
    cam.pitch = Math.max(-0.05, Math.min(0.9, cam.pitch + dy));
    cam.idle = 0;
  }

  function update(dt) {
    cam.idle += dt;
    if (cam.idle > 2.5) cam.yaw += dt * 0.28 * Math.min(1, (cam.idle - 2.5) / 1.5);
  }

  function camera(time, aspect, fovDeg, pos, look, heroSize = 1, framing = 'left', reduced = false) {
    const s = heroSize;
    const d = cam.dist * s;
    const yaw = cam.yaw + (reduced ? 0 : Math.sin(time * 0.3) * 0.02);
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    const tx = hero.x, ty = hero.y + 0.42 * s, tz = hero.z;
    const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    pos.set(tx - fx * cp * d, ty + sp * d + 0.2 * s, tz - fz * cp * d);
    const halfW = d * Math.tan((fovDeg * Math.PI) / 360) * Math.max(1, aspect);
    const off = framing === 'centre' || aspect < 1.25 ? 0 : framing === 'right' ? -halfW * 0.3 : halfW * 0.3;
    look.set(tx - Math.cos(yaw) * off, ty, tz + Math.sin(yaw) * off);
  }

  return {
    group, hero, addLook, update, camera,
    palette: STUDIO_PALETTE, tod: STUDIO_TOD,
    heightAt: (x, z) => (x * x + z * z < 1.3 ? 0.16 : 0),
    dispose() { for (const g of geos) g.dispose(); dots.dispose?.(); },
  };
}
