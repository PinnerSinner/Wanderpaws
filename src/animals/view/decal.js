// Optional photo face decal (Look.decal, a data URL): a circular crop with a
// soft feathered edge on a small plane over the face. Processed locally in a
// canvas; nothing leaves the browser.

export function createDecal(THREE, mats, bones, attach, species) {
  const face = attach && attach.face;
  let mesh = null, tex = null, token = 0;
  const holder = new THREE.Group();
  if (face) {
    const bone = bones.find((b) => b.name === face.bone) || bones[0];
    holder.position.set(face.pos[0], face.pos[1] - (face.spread || 0.08) * 0.35, face.pos[2] + 0.004);
    holder.scale.setScalar(face.scale || 1);
    bone.add(holder);
  }
  function clear() {
    if (mesh) { mesh.removeFromParent(); mesh.geometry.dispose(); mesh.material.dispose(); mesh = null; }
    if (tex) { tex.dispose(); tex = null; }
  }
  return {
    set(url) {
      const my = ++token;
      clear();
      if (!url || !face || typeof Image === 'undefined' || typeof document === 'undefined') return;
      const img = new Image();
      img.onload = () => {
        if (my !== token) return;
        const S = 128;
        const cv = document.createElement('canvas');
        cv.width = cv.height = S;
        const g = cv.getContext('2d');
        const m = Math.min(img.width, img.height);
        g.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, S, S);
        // feathered circular mask
        g.globalCompositeOperation = 'destination-in';
        const rg = g.createRadialGradient(S / 2, S / 2, S * 0.3, S / 2, S / 2, S / 2);
        rg.addColorStop(0, 'rgba(0,0,0,1)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = rg; g.fillRect(0, 0, S, S);
        tex = new THREE.CanvasTexture(cv);
        tex.colorSpace = THREE.SRGBColorSpace;
        const size = (face.spread || 0.08) * 2.6;
        const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
        mesh = new THREE.Mesh(new THREE.CircleGeometry(size / 2, 24), mat);
        mesh.renderOrder = 2;
        holder.add(mesh);
      };
      img.src = url;
    },
    dispose() { token++; clear(); holder.removeFromParent(); },
  };
}
