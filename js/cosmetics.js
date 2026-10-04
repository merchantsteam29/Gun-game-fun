import * as THREE from 'three';

// 3D cosmetics for player avatars. Coordinates are in the avatar's bone spaces:
// head items in the neck group (head cube center y=0.15, half-size 0.14, face toward -Z),
// back items in the spine group (torso back face at z≈0.15).
const M = {
  dark: new THREE.MeshStandardMaterial({ color: '#2c3036', roughness: 0.7 }),
  black: new THREE.MeshStandardMaterial({ color: '#141518', roughness: 0.5 }),
  lens: new THREE.MeshStandardMaterial({ color: '#1a2a3a', roughness: 0.1, metalness: 0.5, emissive: '#0b2033' }),
  gold: new THREE.MeshStandardMaterial({ color: '#e8b923', roughness: 0.3, metalness: 0.8 }),
  gem: new THREE.MeshStandardMaterial({ color: '#d0213a', roughness: 0.2, metalness: 0.3, emissive: '#400010' }),
  steel: new THREE.MeshStandardMaterial({ color: '#9aa1a8', roughness: 0.35, metalness: 0.7 }),
  horn: new THREE.MeshStandardMaterial({ color: '#efe6cf', roughness: 0.6 }),
  leather: new THREE.MeshStandardMaterial({ color: '#7a4f2a', roughness: 0.8 }),
  red: new THREE.MeshStandardMaterial({ color: '#c0262d', roughness: 0.8 }),
  pink: new THREE.MeshStandardMaterial({ color: '#ff5fb4', roughness: 0.7 }),
  white: new THREE.MeshStandardMaterial({ color: '#f4f4f4', roughness: 0.8 }),
  halo: new THREE.MeshStandardMaterial({ color: '#fff3a0', emissive: '#ffd84a', emissiveIntensity: 1.6 }),
  flame: new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }),
  stache: new THREE.MeshStandardMaterial({ color: '#3b2a1e', roughness: 0.9 }),
};
const hairMats = new Map();
const hairMat = (c) => { if (!hairMats.has(c)) hairMats.set(c, new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 })); return hairMats.get(c); };

function add(g, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  g.add(m);
  return m;
}
const B = (x, y, z) => new THREE.BoxGeometry(x, y, z);
const C = (r0, r1, h, s = 16) => new THREE.CylinderGeometry(r0, r1, h, s);
const dome = (r) => new THREE.SphereGeometry(r, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2);

// Hats that cover the top of the head hide spiky / mohawk hair.
const COVERING = ['helmet', 'cap', 'beanie', 'cowboy', 'tophat', 'viking'];

const HATS = {
  helmet(g, body) {
    add(g, dome(0.185), body, 0, 0.22, 0.01).scale.set(1, 0.85, 1.05);
    add(g, C(0.19, 0.19, 0.035), M.dark, 0, 0.22, 0.01);
  },
  cap(g, body) {
    add(g, dome(0.155), body, 0, 0.27, 0.005).scale.set(1, 0.6, 1);
    add(g, B(0.2, 0.018, 0.14), body, 0, 0.275, -0.18);
    add(g, C(0.02, 0.02, 0.02, 8), M.dark, 0, 0.365, 0);
  },
  beanie(g, body) {
    add(g, dome(0.16), body, 0, 0.255, 0);
    add(g, C(0.155, 0.155, 0.06), M.dark, 0, 0.27, 0);
    add(g, new THREE.SphereGeometry(0.045, 10, 8), M.white, 0, 0.43, 0);
  },
  cowboy(g) {
    add(g, C(0.3, 0.3, 0.02, 20), M.leather, 0, 0.305, 0).scale.set(1, 1, 0.85);
    add(g, C(0.12, 0.14, 0.16), M.leather, 0, 0.39, 0);
    add(g, C(0.142, 0.142, 0.03), M.dark, 0, 0.33, 0);
  },
  tophat(g) {
    add(g, C(0.22, 0.22, 0.02, 20), M.black, 0, 0.305, 0);
    add(g, C(0.13, 0.13, 0.27), M.black, 0, 0.45, 0);
    add(g, C(0.133, 0.133, 0.04), M.red, 0, 0.34, 0);
  },
  crown(g) {
    add(g, C(0.15, 0.15, 0.08, 16).toNonIndexed(), M.gold, 0, 0.335, 0);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      add(g, new THREE.ConeGeometry(0.035, 0.08, 6), M.gold, Math.cos(a) * 0.13, 0.41, Math.sin(a) * 0.13);
      add(g, new THREE.SphereGeometry(0.018, 8, 6), M.gem, Math.cos(a + 0.6) * 0.152, 0.335, Math.sin(a + 0.6) * 0.152);
    }
  },
  viking(g) {
    add(g, dome(0.185), M.steel, 0, 0.22, 0.01).scale.set(1, 0.85, 1.05);
    add(g, C(0.19, 0.19, 0.035), M.leather, 0, 0.22, 0.01);
    add(g, B(0.03, 0.12, 0.02), M.steel, 0, 0.17, -0.19); // nose guard
    for (const s of [-1, 1]) add(g, new THREE.ConeGeometry(0.04, 0.2, 8), M.horn, s * 0.21, 0.33, 0, 0, 0, -s * 0.9);
  },
  party(g) {
    add(g, new THREE.ConeGeometry(0.1, 0.28, 14), M.pink, 0.02, 0.44, 0, 0, 0, -0.15);
    add(g, new THREE.SphereGeometry(0.04, 8, 6), M.white, 0.04, 0.585, 0);
    add(g, C(0.075, 0.075, 0.02), M.halo, 0.015, 0.39, 0, 0, 0, -0.15);
  },
  halo(g) {
    const t = add(g, new THREE.TorusGeometry(0.15, 0.018, 8, 24), M.halo, 0, 0.5, 0, Math.PI / 2);
    t.castShadow = false;
  },
  headband(g) {
    add(g, B(0.3, 0.05, 0.3), M.red, 0, 0.24, 0);
    add(g, B(0.04, 0.12, 0.02), M.red, 0.03, 0.2, 0.16, 0.3, 0, 0.3);
    add(g, B(0.04, 0.12, 0.02), M.red, -0.03, 0.19, 0.16, 0.3, 0, -0.2);
  },
};

const HAIR = {
  short(g, mat, covered) {
    if (!covered) add(g, B(0.29, 0.05, 0.29), mat, 0, 0.305, 0);
    add(g, B(0.29, 0.1, 0.04), mat, 0, 0.24, 0.145);
    for (const s of [-1, 1]) add(g, B(0.02, 0.08, 0.12), mat, s * 0.145, 0.24, 0.07);
  },
  mohawk(g, mat, covered) {
    if (covered) return HAIR.short(g, mat, true);
    add(g, B(0.06, 0.13, 0.27), mat, 0, 0.36, 0.01);
  },
  long(g, mat, covered) {
    if (!covered) add(g, B(0.3, 0.05, 0.3), mat, 0, 0.305, 0);
    add(g, B(0.3, 0.32, 0.06), mat, 0, 0.15, 0.16);
    for (const s of [-1, 1]) add(g, B(0.03, 0.22, 0.2), mat, s * 0.155, 0.2, 0.05);
  },
  spiky(g, mat, covered) {
    if (covered) return HAIR.short(g, mat, true);
    add(g, B(0.29, 0.04, 0.29), mat, 0, 0.3, 0);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      add(g, new THREE.ConeGeometry(0.045, 0.13, 6), mat, Math.cos(a) * 0.08, 0.37, Math.sin(a) * 0.08, Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4);
    }
    add(g, new THREE.ConeGeometry(0.05, 0.16, 6), mat, 0, 0.39, 0);
  },
};

const FACE = {
  goggles(g) {
    add(g, B(0.27, 0.075, 0.05), M.black, 0, 0.19, -0.14);
    for (const s of [-1, 1]) add(g, B(0.09, 0.05, 0.01), M.lens, s * 0.06, 0.19, -0.166);
    add(g, B(0.29, 0.02, 0.29), M.dark, 0, 0.19, 0);
  },
  shades(g) {
    add(g, B(0.27, 0.015, 0.02), M.black, 0, 0.205, -0.15);
    for (const s of [-1, 1]) add(g, B(0.1, 0.05, 0.012), M.lens, s * 0.06, 0.185, -0.152);
    for (const s of [-1, 1]) add(g, B(0.01, 0.015, 0.16), M.black, s * 0.142, 0.2, -0.07);
  },
  bandana(g) {
    add(g, B(0.3, 0.12, 0.3), M.red, 0, 0.075, 0);
    add(g, new THREE.ConeGeometry(0.1, 0.12, 3), M.red, 0, 0.02, -0.15, Math.PI, 0, 0).scale.set(1.4, 1, 0.3);
  },
  mustache(g) {
    add(g, B(0.1, 0.025, 0.02), M.stache, 0, 0.09, -0.148);
    for (const s of [-1, 1]) add(g, B(0.05, 0.022, 0.02), M.stache, s * 0.065, 0.08, -0.148, 0, 0, s * 0.5);
  },
};

const BACK = {
  backpack(g) {
    add(g, B(0.38, 0.34, 0.12), M.dark, 0, 0.32, 0.21);
    add(g, B(0.3, 0.06, 0.13), M.leather, 0, 0.17, 0.22);
  },
  jetpack(g) {
    add(g, B(0.3, 0.3, 0.06), M.dark, 0, 0.33, 0.18);
    for (const s of [-1, 1]) {
      add(g, C(0.07, 0.07, 0.34), M.steel, s * 0.09, 0.33, 0.25);
      add(g, new THREE.ConeGeometry(0.06, 0.08, 10), M.dark, s * 0.09, 0.12, 0.25, Math.PI, 0, 0);
      add(g, new THREE.ConeGeometry(0.04, 0.14, 8), M.flame, s * 0.09, 0.02, 0.25, Math.PI, 0, 0).castShadow = false;
    }
  },
  cape(g, body) {
    add(g, B(0.46, 0.7, 0.025), body, 0, 0.18, 0.18, 0.12);
    add(g, B(0.5, 0.05, 0.05), M.gold, 0, 0.53, 0.16);
  },
};

// Returns { head, back } groups for the given cosmetics. `body` is the player's color material.
export function buildCosmetics(cos, body) {
  const head = new THREE.Group(), back = new THREE.Group();
  const covered = COVERING.includes(cos.hat);
  if (HAIR[cos.hair]) HAIR[cos.hair](head, hairMat(cos.hairColor), covered);
  if (FACE[cos.face]) FACE[cos.face](head);
  if (HATS[cos.hat]) HATS[cos.hat](head, body);
  if (BACK[cos.back]) BACK[cos.back](back, body);
  return { head, back };
}
