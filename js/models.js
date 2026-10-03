import * as THREE from 'three';

// Low-poly weapon models built from primitives. Barrel points down -Z; origin is the grip.
const M = {
  dark: new THREE.MeshStandardMaterial({ color: '#3a3e44', roughness: 0.55, metalness: 0.15 }),
  mid: new THREE.MeshStandardMaterial({ color: '#5d646d', roughness: 0.5, metalness: 0.15 }),
  wood: new THREE.MeshStandardMaterial({ color: '#7a4b26', roughness: 0.8 }),
  olive: new THREE.MeshStandardMaterial({ color: '#4d5a32', roughness: 0.7, metalness: 0.2 }),
  steel: new THREE.MeshStandardMaterial({ color: '#d5dade', roughness: 0.3, metalness: 0.4 }),
  tan: new THREE.MeshStandardMaterial({ color: '#a08a62', roughness: 0.8 }),
};

function box(g, mat, sx, sy, sz, x, y, z, rx = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
  m.position.set(x, y, z);
  m.rotation.x = rx;
  g.add(m);
  return m;
}
function cyl(g, mat, r, len, x, y, z, seg = 12) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), mat);
  m.rotation.x = Math.PI / 2;
  m.position.set(x, y, z);
  g.add(m);
  return m;
}
function muzzle(g, x, y, z) {
  const o = new THREE.Object3D();
  o.name = 'muzzle';
  o.position.set(x, y, z);
  g.add(o);
}

const builders = {
  ar(g) {
    box(g, M.dark, 0.07, 0.1, 0.5, 0, 0.05, -0.12);
    cyl(g, M.dark, 0.018, 0.32, 0, 0.06, -0.52);
    box(g, M.mid, 0.08, 0.08, 0.22, 0, 0.04, -0.3);
    box(g, M.dark, 0.05, 0.17, 0.08, 0, -0.07, -0.14, 0.25);
    box(g, M.dark, 0.05, 0.12, 0.06, 0, -0.05, 0.06, -0.3);
    box(g, M.mid, 0.06, 0.1, 0.22, 0, 0.03, 0.22);
    box(g, M.dark, 0.025, 0.05, 0.1, 0, 0.12, -0.05);
    muzzle(g, 0, 0.06, -0.7);
  },
  shotgun(g) {
    box(g, M.dark, 0.08, 0.09, 0.4, 0, 0.05, -0.08);
    cyl(g, M.dark, 0.025, 0.5, 0, 0.07, -0.5);
    cyl(g, M.dark, 0.02, 0.42, 0, 0.025, -0.46);
    box(g, M.wood, 0.075, 0.07, 0.18, 0, 0.02, -0.4);
    box(g, M.wood, 0.05, 0.12, 0.06, 0, -0.05, 0.08, -0.3);
    box(g, M.wood, 0.065, 0.11, 0.26, 0, 0.02, 0.26);
    muzzle(g, 0, 0.07, -0.76);
  },
  gl(g) {
    cyl(g, M.olive, 0.065, 0.55, 0, 0.07, -0.3, 14);
    cyl(g, M.dark, 0.11, 0.17, 0, 0.0, -0.04, 10);
    box(g, M.dark, 0.05, 0.13, 0.06, 0, -0.07, 0.1, -0.3);
    box(g, M.olive, 0.06, 0.1, 0.24, 0, 0.03, 0.24);
    box(g, M.dark, 0.04, 0.08, 0.08, 0, 0.16, -0.15);
    box(g, M.dark, 0.05, 0.1, 0.06, 0, -0.03, -0.38);
    muzzle(g, 0, 0.07, -0.6);
  },
  pistol(g) {
    box(g, M.dark, 0.045, 0.055, 0.21, 0, 0.05, -0.06);
    box(g, M.mid, 0.04, 0.035, 0.18, 0, 0.015, -0.05);
    box(g, M.dark, 0.042, 0.12, 0.06, 0, -0.04, 0.02, -0.25);
    muzzle(g, 0, 0.05, -0.18);
  },
  knife(g) {
    box(g, M.dark, 0.035, 0.035, 0.13, 0, 0, 0.02);
    box(g, M.mid, 0.06, 0.02, 0.02, 0, 0, -0.05);
    const blade = box(g, M.steel, 0.008, 0.035, 0.2, 0, 0.004, -0.16);
    blade.scale.y = 1;
    muzzle(g, 0, 0, -0.26);
  },
  frag(g) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), M.olive);
    s.scale.y = 1.2;
    g.add(s);
    box(g, M.mid, 0.02, 0.03, 0.03, 0, 0.07, 0);
    box(g, M.mid, 0.015, 0.09, 0.015, 0.03, 0.03, 0, 0);
    muzzle(g, 0, 0, 0);
  },
};

export function buildGun(id) {
  const g = new THREE.Group();
  builders[id](g);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
  return g;
}

export function buildProjectile(kind) {
  if (kind === 'frag') {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), M.olive);
    m.castShadow = true;
    return m;
  }
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.16, 10), M.tan);
  m.castShadow = true;
  return m;
}
