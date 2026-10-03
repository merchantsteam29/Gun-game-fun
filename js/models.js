import * as THREE from 'three';

// Low-poly weapon models. Barrel points down -Z; origin is the right-hand grip.
// Named children drive animation: mag, bolt, pump, slide, cyl, lid, pin (groups) and
// fore, muzzle, port (anchor points). userData.sight is the iron-sight line height for ADS.
const M = {
  dark: new THREE.MeshStandardMaterial({ color: '#3a3e44', roughness: 0.55, metalness: 0.15 }),
  mid: new THREE.MeshStandardMaterial({ color: '#5d646d', roughness: 0.5, metalness: 0.15 }),
  black: new THREE.MeshStandardMaterial({ color: '#202226', roughness: 0.6, metalness: 0.1 }),
  wood: new THREE.MeshStandardMaterial({ color: '#7a4b26', roughness: 0.8 }),
  olive: new THREE.MeshStandardMaterial({ color: '#4d5a32', roughness: 0.7, metalness: 0.1 }),
  tan: new THREE.MeshStandardMaterial({ color: '#a08a62', roughness: 0.8 }),
  steel: new THREE.MeshStandardMaterial({ color: '#d5dade', roughness: 0.3, metalness: 0.4 }),
  brass: new THREE.MeshStandardMaterial({ color: '#c8a24a', roughness: 0.4, metalness: 0.5 }),
  red: new THREE.MeshStandardMaterial({ color: '#b02a22', roughness: 0.6 }),
  lens: new THREE.MeshStandardMaterial({ color: '#2a6cff', roughness: 0.1, metalness: 0.3, emissive: '#0a2a66' }),
  led: new THREE.MeshStandardMaterial({ color: '#ff2020', emissive: '#ff2020', emissiveIntensity: 2 }),
  gray: new THREE.MeshStandardMaterial({ color: '#8d9399', roughness: 0.7 }),
  zombie: new THREE.MeshStandardMaterial({ color: '#5f8f3a', roughness: 0.9 }),
};

function box(p, mat, sx, sy, sz, x, y, z, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  p.add(m);
  return m;
}
// Cylinder along Z.
function cyl(p, mat, r, len, x, y, z, seg = 12) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), mat);
  m.rotation.x = Math.PI / 2;
  m.position.set(x, y, z);
  p.add(m);
  return m;
}
function grp(p, name, x = 0, y = 0, z = 0) {
  const o = new THREE.Group();
  o.name = name;
  o.position.set(x, y, z);
  p.add(o);
  return o;
}
const anchor = grp;

const builders = {
  ar(g) {
    box(g, M.dark, 0.07, 0.1, 0.5, 0, 0.05, -0.12);
    cyl(g, M.dark, 0.018, 0.32, 0, 0.06, -0.52);
    box(g, M.mid, 0.08, 0.08, 0.22, 0, 0.04, -0.3);
    const mag = grp(g, 'mag', 0, -0.02, -0.14);
    box(mag, M.black, 0.05, 0.17, 0.08, 0, -0.07, 0, 0.25);
    box(g, M.black, 0.05, 0.12, 0.06, 0, -0.05, 0.06, -0.3);
    box(g, M.mid, 0.06, 0.1, 0.22, 0, 0.03, 0.22);
    box(g, M.dark, 0.025, 0.05, 0.1, 0, 0.12, -0.05);
    box(g, M.dark, 0.02, 0.04, 0.02, 0, 0.11, -0.38);
    const bolt = grp(g, 'bolt', 0.045, 0.07, 0.0);
    box(bolt, M.steel, 0.025, 0.02, 0.05, 0, 0, 0);
    anchor(g, 'fore', 0, -0.0, -0.32);
    anchor(g, 'muzzle', 0, 0.06, -0.7);
    g.userData.sight = 0.135;
  },
  smg(g) {
    box(g, M.dark, 0.065, 0.09, 0.34, 0, 0.05, -0.08);
    cyl(g, M.dark, 0.016, 0.14, 0, 0.06, -0.31);
    const mag = grp(g, 'mag', 0, 0.0, -0.1);
    box(mag, M.black, 0.045, 0.22, 0.055, 0, -0.12, 0);
    box(g, M.black, 0.045, 0.12, 0.055, 0, -0.06, 0.06, -0.25);
    box(g, M.black, 0.04, 0.1, 0.04, 0, -0.04, -0.21);
    box(g, M.mid, 0.015, 0.06, 0.2, 0.025, 0.04, 0.17);
    box(g, M.mid, 0.015, 0.06, 0.2, -0.025, 0.04, 0.17);
    box(g, M.dark, 0.06, 0.08, 0.03, 0, 0.04, 0.27);
    box(g, M.dark, 0.02, 0.035, 0.05, 0, 0.11, -0.02);
    const bolt = grp(g, 'bolt', 0.04, 0.07, -0.05);
    box(bolt, M.steel, 0.02, 0.02, 0.04, 0, 0, 0);
    anchor(g, 'fore', 0, -0.08, -0.21);
    anchor(g, 'muzzle', 0, 0.06, -0.39);
    g.userData.sight = 0.128;
  },
  burst(g) {
    box(g, M.olive, 0.08, 0.13, 0.62, 0, 0.04, -0.06);
    cyl(g, M.dark, 0.02, 0.22, 0, 0.06, -0.47);
    box(g, M.dark, 0.03, 0.07, 0.3, 0, 0.14, -0.08);
    box(g, M.black, 0.05, 0.12, 0.06, 0, -0.07, -0.06, -0.3);
    const mag = grp(g, 'mag', 0, -0.03, 0.12);
    box(mag, M.black, 0.05, 0.16, 0.08, 0, -0.06, 0, 0.2);
    const bolt = grp(g, 'bolt', 0.05, 0.08, -0.15);
    box(bolt, M.steel, 0.02, 0.02, 0.05, 0, 0, 0);
    anchor(g, 'fore', 0, -0.03, -0.3);
    anchor(g, 'muzzle', 0, 0.06, -0.6);
    g.userData.sight = 0.19;
  },
  lmg(g) {
    box(g, M.dark, 0.1, 0.13, 0.42, 0, 0.05, -0.05);
    cyl(g, M.dark, 0.025, 0.5, 0, 0.06, -0.5);
    cyl(g, M.mid, 0.035, 0.2, 0, 0.06, -0.33);
    box(g, M.black, 0.05, 0.12, 0.06, 0, -0.06, 0.08, -0.3);
    box(g, M.mid, 0.07, 0.11, 0.24, 0, 0.03, 0.28);
    const lid = grp(g, 'lid', 0, 0.115, 0.1);
    box(lid, M.mid, 0.1, 0.025, 0.22, 0, 0, -0.11);
    box(lid, M.dark, 0.02, 0.04, 0.06, 0, 0.03, -0.18);
    const mag = grp(g, 'mag', 0.0, -0.03, -0.08);
    box(mag, M.olive, 0.13, 0.14, 0.14, 0.03, -0.08, 0);
    box(g, M.dark, 0.015, 0.015, 0.25, 0.03, -0.0, -0.5);
    box(g, M.dark, 0.015, 0.015, 0.25, -0.03, -0.0, -0.5);
    const bolt = grp(g, 'bolt', 0.06, 0.06, -0.08);
    box(bolt, M.steel, 0.03, 0.025, 0.04, 0, 0, 0);
    anchor(g, 'fore', 0, -0.0, -0.36);
    anchor(g, 'muzzle', 0, 0.06, -0.77);
    g.userData.sight = 0.17;
  },
  sniper(g) {
    box(g, M.dark, 0.07, 0.09, 0.32, 0, 0.05, -0.04);
    cyl(g, M.dark, 0.02, 0.62, 0, 0.065, -0.5);
    box(g, M.olive, 0.075, 0.08, 0.36, 0, 0.02, -0.33);
    box(g, M.olive, 0.07, 0.13, 0.32, 0, 0.0, 0.25);
    box(g, M.olive, 0.05, 0.12, 0.06, 0, -0.06, 0.06, -0.3);
    cyl(g, M.black, 0.032, 0.3, 0, 0.14, -0.06);
    cyl(g, M.black, 0.04, 0.06, 0, 0.14, -0.22);
    cyl(g, M.black, 0.037, 0.05, 0, 0.14, 0.1);
    cyl(g, M.lens, 0.034, 0.005, 0, 0.14, -0.252);
    box(g, M.black, 0.02, 0.04, 0.02, 0, 0.1, -0.12);
    box(g, M.black, 0.02, 0.04, 0.02, 0, 0.1, 0.02);
    const mag = grp(g, 'mag', 0, 0.0, -0.08);
    box(mag, M.black, 0.045, 0.08, 0.08, 0, -0.03, 0);
    const bolt = grp(g, 'bolt', 0.035, 0.08, 0.05);
    box(bolt, M.steel, 0.07, 0.015, 0.015, 0.035, 0, 0);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), M.steel);
    knob.position.set(0.07, 0, 0);
    bolt.add(knob);
    anchor(g, 'fore', 0, -0.02, -0.36);
    anchor(g, 'muzzle', 0, 0.065, -0.82);
    g.userData.sight = 0.14;
  },
  shotgun(g) {
    box(g, M.dark, 0.08, 0.09, 0.4, 0, 0.05, -0.08);
    cyl(g, M.dark, 0.025, 0.5, 0, 0.07, -0.5);
    cyl(g, M.dark, 0.02, 0.42, 0, 0.025, -0.46);
    const pump = grp(g, 'pump', 0, 0.02, -0.4);
    box(pump, M.wood, 0.075, 0.07, 0.18, 0, 0, 0);
    anchor(pump, 'fore', 0, -0.03, 0);
    box(g, M.wood, 0.05, 0.12, 0.06, 0, -0.05, 0.08, -0.3);
    box(g, M.wood, 0.065, 0.11, 0.26, 0, 0.02, 0.26);
    box(g, M.steel, 0.015, 0.02, 0.015, 0, 0.11, -0.72);
    anchor(g, 'port', 0.05, 0.03, -0.1);
    anchor(g, 'muzzle', 0, 0.07, -0.76);
    g.userData.sight = 0.12;
  },
  gl(g) {
    cyl(g, M.olive, 0.065, 0.55, 0, 0.07, -0.3, 14);
    const drum = grp(g, 'cyl', 0, 0.0, -0.04);
    cyl(drum, M.dark, 0.11, 0.17, 0, 0, 0, 10);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      cyl(drum, M.tan, 0.025, 0.172, Math.cos(a) * 0.06, Math.sin(a) * 0.06, 0, 8);
    }
    box(g, M.black, 0.05, 0.13, 0.06, 0, -0.07, 0.1, -0.3);
    box(g, M.olive, 0.06, 0.1, 0.24, 0, 0.03, 0.24);
    box(g, M.dark, 0.04, 0.08, 0.08, 0, 0.16, -0.15);
    box(g, M.black, 0.05, 0.1, 0.06, 0, -0.03, -0.38);
    anchor(g, 'fore', 0, -0.07, -0.38);
    anchor(g, 'muzzle', 0, 0.07, -0.6);
    g.userData.sight = 0.2;
  },
  pistol(g) {
    const slide = grp(g, 'slide', 0, 0, 0);
    box(slide, M.dark, 0.045, 0.055, 0.21, 0, 0.05, -0.06);
    box(slide, M.steel, 0.01, 0.015, 0.012, 0, 0.083, -0.15);
    box(g, M.mid, 0.04, 0.035, 0.18, 0, 0.015, -0.05);
    box(g, M.black, 0.042, 0.12, 0.06, 0, -0.04, 0.02, -0.25);
    const mag = grp(g, 'mag', 0, -0.02, 0.02);
    box(mag, M.dark, 0.034, 0.06, 0.045, 0, -0.07, 0.01, -0.25);
    anchor(g, 'fore', -0.04, -0.05, 0.0);
    anchor(g, 'muzzle', 0, 0.05, -0.18);
    g.userData.sight = 0.092;
  },
  revolver(g) {
    box(g, M.steel, 0.04, 0.05, 0.11, 0, 0.04, -0.02);
    cyl(g, M.steel, 0.018, 0.2, 0, 0.055, -0.17, 10);
    box(g, M.steel, 0.012, 0.03, 0.2, 0, 0.075, -0.17);
    const c = grp(g, 'cyl', 0, 0.035, -0.04);
    cyl(c, M.steel, 0.032, 0.06, 0, 0, 0, 6);
    box(g, M.wood, 0.042, 0.12, 0.055, 0, -0.05, 0.04, -0.35);
    box(g, M.steel, 0.01, 0.025, 0.02, 0, 0.075, 0.03);
    anchor(g, 'fore', -0.04, -0.05, 0.02);
    anchor(g, 'muzzle', 0, 0.055, -0.27);
    g.userData.sight = 0.098;
  },
  mpistol(g) {
    const slide = grp(g, 'slide', 0, 0, 0);
    box(slide, M.dark, 0.048, 0.06, 0.24, 0, 0.05, -0.07);
    box(g, M.mid, 0.042, 0.04, 0.2, 0, 0.012, -0.06);
    box(g, M.black, 0.044, 0.12, 0.06, 0, -0.04, 0.02, -0.25);
    const mag = grp(g, 'mag', 0, -0.02, 0.02);
    box(mag, M.black, 0.036, 0.2, 0.045, 0, -0.1, 0.03, -0.25);
    box(g, M.black, 0.03, 0.07, 0.035, 0, -0.03, -0.14);
    anchor(g, 'fore', 0, -0.07, -0.14);
    anchor(g, 'muzzle', 0, 0.05, -0.2);
    g.userData.sight = 0.095;
  },
  knife(g) {
    box(g, M.black, 0.035, 0.035, 0.13, 0, 0, 0.02);
    box(g, M.mid, 0.06, 0.02, 0.02, 0, 0, -0.05);
    box(g, M.steel, 0.008, 0.035, 0.2, 0, 0.004, -0.16);
    anchor(g, 'muzzle', 0, 0, -0.26);
  },
  claws(g) {
    const fist = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.1), M.zombie);
    g.add(fist);
    for (let i = -1; i <= 1; i++) box(g, M.steel, 0.008, 0.02, 0.2, i * 0.025, 0.02, -0.14, 0.15, i * 0.12, 0);
    anchor(g, 'muzzle', 0, 0, -0.24);
  },
  axe(g) {
    box(g, M.wood, 0.035, 0.04, 0.7, 0, 0, -0.24);
    box(g, M.red, 0.045, 0.16, 0.1, 0, 0.07, -0.56);
    box(g, M.steel, 0.012, 0.2, 0.05, 0, 0.08, -0.62);
    box(g, M.red, 0.04, 0.08, 0.06, 0, -0.05, -0.55);
    anchor(g, 'fore', 0, 0, -0.22);
    anchor(g, 'muzzle', 0, 0.08, -0.6);
  },
  frag(g) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), M.olive);
    s.scale.y = 1.2;
    g.add(s);
    box(g, M.mid, 0.02, 0.03, 0.03, 0, 0.07, 0);
    box(g, M.mid, 0.015, 0.09, 0.015, 0.03, 0.03, 0, 0);
    const pin = grp(g, 'pin', -0.02, 0.08, 0);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.004, 6, 12), M.steel);
    ring.rotation.y = Math.PI / 2;
    pin.add(ring);
    anchor(g, 'muzzle', 0, 0, 0);
  },
  sticky(g) {
    cyl(g, M.dark, 0.045, 0.12, 0, 0, 0, 12).rotation.x = 0;
    const blob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), M.olive);
    blob.position.y = -0.06;
    blob.scale.y = 0.5;
    g.add(blob);
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), M.led);
    led.position.y = 0.065;
    g.add(led);
    const pin = grp(g, 'pin', -0.03, 0.06, 0);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.004, 6, 12), M.steel);
    ring.rotation.y = Math.PI / 2;
    pin.add(ring);
    anchor(g, 'muzzle', 0, 0, 0);
  },
  smoke(g) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.15, 12), M.gray);
    g.add(c);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.047, 0.047, 0.03, 12), M.dark);
    band.position.y = 0.03;
    g.add(band);
    box(g, M.mid, 0.015, 0.1, 0.015, 0.045, 0.02, 0);
    const pin = grp(g, 'pin', -0.03, 0.09, 0);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.004, 6, 12), M.steel);
    ring.rotation.y = Math.PI / 2;
    pin.add(ring);
    anchor(g, 'muzzle', 0, 0, 0);
  },
};

export function buildGun(id) {
  const g = new THREE.Group();
  (builders[id] || builders.ar)(g);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  const parts = {};
  g.traverse((o) => { if (o.name) parts[o.name] = o; });
  for (const p of Object.values(parts)) p.userData.base = p.position.clone();
  g.userData.parts = parts;
  return g;
}

export function buildProjectile(kind) {
  if (kind === 'gl') {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.16, 10), M.tan);
    m.castShadow = true;
    return m;
  }
  const g = buildGun(kind);
  g.scale.setScalar(1.3);
  return g;
}
