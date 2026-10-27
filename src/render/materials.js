// STUB (lead): replaced by the Render agent (keep this API).
export function createMaterials(THREE) {
  const cache = new Map();
  const uniforms = { time: { value: 0 }, wind: { value: new THREE.Vector2(1, 0) }, sunDir: { value: new THREE.Vector3(0.5, 1, 0.3) }, tint: { value: new THREE.Color(1, 1, 1) } };
  const toon = (color, o = {}) => { const k = color + JSON.stringify(o); if (!cache.has(k)) cache.set(k, new THREE.MeshLambertMaterial({ color, ...(o.vertexColors ? { vertexColors: true } : {}) })); return cache.get(k); };
  return { uniforms, toon, sway: toon, water: () => new THREE.MeshLambertMaterial({ color: '#3cc0c8', transparent: true, opacity: 0.8 }), outline() {}, glow: (c) => new THREE.MeshBasicMaterial({ color: c }) };
}
