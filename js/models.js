import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// Low-poly weapon models. Barrel points down -Z; origin is the right-hand grip.
// Named children drive animation: mag, bolt, pump, slide, cyl, lid, pin, spin (groups) and
// fore, muzzle, port (anchor points). userData.sight is the sight-line height for ADS.
const M = {
  dark: new THREE.MeshStandardMaterial({ color: '#363a40', roughness: 0.5, metalness: 0.25 }),
  mid: new THREE.MeshStandardMaterial({ color: '#5a616a', roughness: 0.45, metalness: 0.25 }),
  black: new THREE.MeshStandardMaterial({ color: '#1d1f23', roughness: 0.55, metalness: 0.2 }),
  poly: new THREE.MeshStandardMaterial({ color: '#26292e', roughness: 0.85, metalness: 0.0 }),
  wood: new THREE.MeshStandardMaterial({ color: '#7a4b26', roughness: 0.7 }),
  woodDark: new THREE.MeshStandardMaterial({ color: '#53321a', roughness: 0.75 }),
  olive: new THREE.MeshStandardMaterial({ color: '#4d5a32', roughness: 0.7, metalness: 0.1 }),
  tan: new THREE.MeshStandardMaterial({ color: '#a08a62', roughness: 0.75 }),
  steel: new THREE.MeshStandardMaterial({ color: '#cfd5da', roughness: 0.25, metalness: 0.7 }),
  gunmetal: new THREE.MeshStandardMaterial({ color: '#4a5058', roughness: 0.3, metalness: 0.65 }),
  brass: new THREE.MeshStandardMaterial({ color: '#c8a24a', roughness: 0.35, metalness: 0.7 }),
  red: new THREE.MeshStandardMaterial({ color: '#b02a22', roughness: 0.55 }),
  orange: new THREE.MeshStandardMaterial({ color: '#d9822b', roughness: 0.6 }),
  lens: new THREE.MeshStandardMaterial({ color: '#2a6cff', roughness: 0.1, metalness: 0.3, emissive: '#0a2a66' }),
  glass: new THREE.MeshStandardMaterial({ color: '#9fd2ff', roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.16, depthWrite: false }),
  dot: new THREE.MeshBasicMaterial({ color: '#ff2a2a' }),
  glow: new THREE.MeshBasicMaterial({ color: '#7dffb0' }),
  led: new THREE.MeshStandardMaterial({ color: '#ff2020', emissive: '#ff2020', emissiveIntensity: 2 }),
  gray: new THREE.MeshStandardMaterial({ color: '#8d9399', roughness: 0.7 }),
  tape: new THREE.MeshStandardMaterial({ color: '#2a2d31', roughness: 0.95 }),
  zombie: new THREE.MeshStandardMaterial({ color: '#5f8f3a', roughness: 0.9 }),
  bone: new THREE.MeshStandardMaterial({ color: '#d8cfb8', roughness: 0.6 }),
};

function box(p, mat, sx, sy, sz, x, y, z, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  p.add(m);
  return m;
}
// Box with softened edges, for receivers, stocks and grips.
function rbox(p, mat, sx, sy, sz, x, y, z, rx = 0, ry = 0, rz = 0) {
  const r = Math.min(sx, sy, sz) * 0.22;
  const m = new THREE.Mesh(new RoundedBoxGeometry(sx, sy, sz, 2, r), mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  p.add(m);
  return m;
}
// Cylinder along Z.
function cyl(p, mat, r, len, x, y, z, seg = 12, r2 = r) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r2, r, len, seg), mat);
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

// ---------- Shared details ----------

// Picatinny rail along Z between z0 (rear) and z1 (front); `y` is the top surface.
function rail(p, y, z0, z1, w = 0.028) {
  const len = z0 - z1;
  box(p, M.black, w, 0.01, len, 0, y - 0.007, (z0 + z1) / 2);
  const n = Math.max(1, Math.floor(len / 0.026));
  for (let i = 0; i < n; i++) box(p, M.black, w + 0.006, 0.006, 0.012, 0, y - 0.001, z0 - 0.013 - i * 0.026);
}
// Trigger guard + trigger just in front of the grip.
function trigger(p, z = -0.035, y = 0.0, len = 0.07) {
  box(p, M.black, 0.012, 0.007, len, 0, y - 0.05, z);
  box(p, M.black, 0.012, 0.05, 0.007, 0, y - 0.026, z - len / 2);
  box(p, M.steel, 0.006, 0.03, 0.007, 0, y - 0.022, z + 0.006, 0.35);
}
// Angled pistol grip with finger grooves.
function grip(p, mat, x, y, z, h = 0.12, rake = -0.3) {
  const g = rbox(p, mat, 0.046, h, 0.062, x, y, z, rake);
  for (let i = 0; i < 3; i++) box(g, M.black, 0.048, 0.004, 0.008, 0, h / 2 - 0.035 - i * 0.025, -0.031);
  return g;
}
// Muzzle brake with side ports.
function brake(p, r, y, z, len = 0.06) {
  cyl(p, M.black, r * 1.4, len, 0, y, z, 10);
  for (const s of [-1, 1]) box(p, M.dark, 0.006, r * 1.6, len * 0.22, s * r * 1.38, y, z - len * 0.15);
  cyl(p, M.black, r * 0.75, 0.004, 0, y, z - len / 2 - 0.002, 8);
}
// Suppressor can.
function can(p, r, y, z, len = 0.16) {
  cyl(p, M.poly, r, len, 0, y, z, 14);
  cyl(p, M.gunmetal, r * 1.04, 0.012, 0, y, z + len / 2 - 0.006, 14);
  cyl(p, M.gunmetal, r * 1.04, 0.012, 0, y, z - len / 2 + 0.006, 14);
}
// Iron sights: front post and rear aperture, both topping out at `y`.
function irons(p, y, front, rear, base) {
  box(p, M.black, 0.012, y - base, 0.012, 0, (y + base) / 2 - 0.004, front);
  box(p, M.black, 0.005, 0.012, 0.004, 0, y - 0.004, front);
  for (const s of [-1, 1]) box(p, M.black, 0.01, y - base + 0.006, 0.012, s * 0.012, (y + base) / 2 - 0.004, rear);
}
// Red-dot optic with an open window centered on the sight line `y`.
function redDot(p, y, z, base) {
  const w = 0.08, h = 0.062, t = 0.008, d = 0.034;
  box(p, M.black, 0.034, y - h / 2 - base, d + 0.016, 0, (base + y - h / 2) / 2, z); // mount
  box(p, M.black, w + t * 2, t, d, 0, y - h / 2 - t / 2, z);
  box(p, M.black, w + t * 2, t, d, 0, y + h / 2 + t / 2, z);
  for (const s of [-1, 1]) box(p, M.black, t, h, d, s * (w / 2 + t / 2), y, z);
  const lens = new THREE.Mesh(new THREE.PlaneGeometry(w, h), M.glass);
  lens.position.set(0, y, z - d / 2 + 0.002);
  p.add(lens);
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.0034, 8, 6), M.dot);
  dot.position.set(0, y, z - d / 2);
  p.add(dot);
  box(p, M.dark, 0.012, 0.016, 0.016, w / 2 + t + 0.006, y + 0.008, z); // brightness knob
}
// Scope tube with bells and a lens.
function scope(p, y, z, len, r = 0.03) {
  cyl(p, M.black, r * 0.75, len, 0, y, z, 14);
  cyl(p, M.black, r * 1.25, len * 0.22, 0, y, z - len * 0.45, 14, r * 0.85);
  cyl(p, M.black, r * 1.1, len * 0.16, 0, y, z + len * 0.45, 14, r * 0.9);
  cyl(p, M.dark, r * 0.85, 0.03, 0, y + r * 0.9, z, 10).rotation.x = 0; // turret
  cyl(p, M.lens, r * 1.15, 0.004, 0, y, z - len * 0.56, 14);
}
// Ring of short dark slots, e.g. handguard vents.
function vents(p, y, z0, n, gap, w) {
  for (let i = 0; i < n; i++) for (const s of [-1, 1]) box(p, M.black, 0.004, 0.018, 0.024, s * w, y, z0 - i * gap);
}

const builders = {
  ar(g) {
    // Upper / lower receiver
    rbox(g, M.dark, 0.07, 0.06, 0.36, 0, 0.07, -0.06);
    rbox(g, M.mid, 0.066, 0.05, 0.26, 0, 0.025, -0.02);
    box(g, M.steel, 0.004, 0.022, 0.07, 0.036, 0.07, -0.03); // ejection port
    rail(g, 0.112, 0.1, -0.2);
    // Handguard + barrel + brake
    rbox(g, M.poly, 0.08, 0.08, 0.26, 0, 0.055, -0.33);
    vents(g, 0.055, -0.24, 5, 0.04, 0.041);
    rail(g, 0.105, -0.22, -0.45, 0.024);
    cyl(g, M.gunmetal, 0.016, 0.24, 0, 0.06, -0.57);
    box(g, M.black, 0.018, 0.036, 0.018, 0, 0.087, -0.44); // gas block / folded front post
    brake(g, 0.016, 0.06, -0.71);
    // Mag (slightly curved)
    const mag = grp(g, 'mag', 0, -0.02, -0.14);
    box(mag, M.black, 0.048, 0.1, 0.075, 0, -0.04, 0, 0.12);
    box(mag, M.black, 0.048, 0.09, 0.075, 0, -0.12, 0.016, 0.32);
    box(mag, M.dark, 0.05, 0.012, 0.08, 0, -0.165, 0.03, 0.32);
    box(g, M.dark, 0.06, 0.03, 0.09, 0, 0.0, -0.14); // mag well
    grip(g, M.poly, 0, -0.05, 0.06);
    trigger(g, 0.0, 0.0);
    // Buffer tube + adjustable stock
    cyl(g, M.black, 0.018, 0.14, 0, 0.06, 0.18);
    rbox(g, M.poly, 0.06, 0.11, 0.17, 0, 0.035, 0.27);
    box(g, M.black, 0.062, 0.12, 0.02, 0, 0.032, 0.36);
    box(g, M.dark, 0.03, 0.02, 0.06, 0, 0.098, 0.08); // charging handle
    redDot(g, 0.15, -0.05, 0.112);
    const bolt = grp(g, 'bolt', 0.045, 0.07, 0.0);
    box(bolt, M.steel, 0.022, 0.018, 0.05, 0, 0, 0);
    anchor(g, 'fore', 0, 0.0, -0.32);
    anchor(g, 'muzzle', 0, 0.06, -0.75);
    g.userData.sight = 0.15;
  },
  smg(g) {
    rbox(g, M.dark, 0.064, 0.09, 0.34, 0, 0.05, -0.08);
    box(g, M.black, 0.066, 0.02, 0.3, 0, 0.008, -0.08);
    rail(g, 0.105, 0.06, -0.2, 0.024);
    can(g, 0.024, 0.06, -0.34, 0.14);
    const mag = grp(g, 'mag', 0, 0.0, -0.1);
    box(mag, M.black, 0.044, 0.22, 0.05, 0, -0.12, 0);
    box(mag, M.dark, 0.046, 0.012, 0.054, 0, -0.226, 0);
    grip(g, M.poly, 0, -0.055, 0.06, 0.12, -0.25);
    trigger(g, 0.0, 0.01, 0.06);
    rbox(g, M.poly, 0.04, 0.1, 0.045, 0, -0.04, -0.21); // vertical fore grip
    // Folding wire stock
    for (const s of [-1, 1]) box(g, M.mid, 0.012, 0.012, 0.2, s * 0.025, 0.06, 0.17);
    box(g, M.mid, 0.012, 0.012, 0.2, 0, 0.0, 0.17, -0.28);
    rbox(g, M.poly, 0.064, 0.09, 0.026, 0, 0.035, 0.275);
    irons(g, 0.128, -0.22, 0.04, 0.1);
    const bolt = grp(g, 'bolt', 0.04, 0.07, -0.05);
    box(bolt, M.steel, 0.02, 0.018, 0.04, 0, 0, 0);
    box(bolt, M.dark, 0.024, 0.01, 0.01, 0.014, 0, 0.012);
    anchor(g, 'fore', 0, -0.08, -0.21);
    anchor(g, 'muzzle', 0, 0.06, -0.42);
    g.userData.sight = 0.128;
  },
  burst(g) {
    // Bullpup shell
    rbox(g, M.olive, 0.08, 0.12, 0.62, 0, 0.04, -0.06);
    rbox(g, M.poly, 0.082, 0.04, 0.2, 0, -0.005, -0.3);
    box(g, M.black, 0.084, 0.035, 0.06, 0, 0.0, 0.2); // butt pad
    cyl(g, M.gunmetal, 0.018, 0.22, 0, 0.06, -0.47);
    brake(g, 0.018, 0.06, -0.6, 0.05);
    // Carry handle with integrated sight rail
    box(g, M.dark, 0.03, 0.06, 0.3, 0, 0.14, -0.08);
    for (const z of [-0.2, 0.04]) box(g, M.dark, 0.03, 0.04, 0.03, 0, 0.11, z);
    rail(g, 0.178, 0.06, -0.22, 0.026);
    irons(g, 0.19, -0.2, 0.05, 0.178);
    grip(g, M.poly, 0, -0.07, -0.06, 0.12, -0.3);
    trigger(g, -0.12, -0.02);
    const mag = grp(g, 'mag', 0, -0.03, 0.12);
    box(mag, M.black, 0.048, 0.16, 0.075, 0, -0.06, 0, 0.2);
    box(mag, M.dark, 0.05, 0.012, 0.08, 0, -0.14, 0.015, 0.2);
    const bolt = grp(g, 'bolt', 0.05, 0.08, -0.15);
    box(bolt, M.steel, 0.02, 0.02, 0.05, 0, 0, 0);
    anchor(g, 'fore', 0, -0.03, -0.3);
    anchor(g, 'muzzle', 0, 0.06, -0.63);
    g.userData.sight = 0.19;
  },
  lmg(g) {
    rbox(g, M.dark, 0.1, 0.13, 0.42, 0, 0.05, -0.05);
    box(g, M.steel, 0.004, 0.03, 0.08, 0.051, 0.06, -0.04); // ejection port
    // Heavy barrel with heat shield and carry handle
    cyl(g, M.gunmetal, 0.022, 0.5, 0, 0.06, -0.5);
    cyl(g, M.mid, 0.036, 0.22, 0, 0.06, -0.34);
    for (let i = 0; i < 4; i++) box(g, M.black, 0.074, 0.006, 0.02, 0, 0.098, -0.26 - i * 0.05);
    box(g, M.black, 0.02, 0.05, 0.02, 0, 0.11, -0.38);
    box(g, M.black, 0.02, 0.02, 0.16, 0, 0.135, -0.38);
    brake(g, 0.022, 0.06, -0.78, 0.07);
    box(g, M.black, 0.014, 0.05, 0.014, 0, 0.115, -0.7); // front post
    grip(g, M.poly, 0, -0.06, 0.08);
    trigger(g, 0.02, 0.0);
    rbox(g, M.poly, 0.07, 0.11, 0.24, 0, 0.03, 0.28);
    box(g, M.black, 0.072, 0.12, 0.02, 0, 0.03, 0.4);
    const lid = grp(g, 'lid', 0, 0.115, 0.1);
    rbox(lid, M.mid, 0.1, 0.026, 0.22, 0, 0, -0.11);
    box(lid, M.dark, 0.02, 0.04, 0.06, 0, 0.03, -0.18);
    rail(lid, 0.024, -0.02, -0.14, 0.024);
    const mag = grp(g, 'mag', 0.0, -0.03, -0.08);
    rbox(mag, M.olive, 0.13, 0.14, 0.14, 0.03, -0.08, 0);
    box(mag, M.tan, 0.132, 0.02, 0.142, 0.03, -0.04, 0);
    box(mag, M.black, 0.03, 0.03, 0.05, 0.1, -0.06, 0);
    // Bipod (folded)
    for (const s of [-1, 1]) box(g, M.dark, 0.012, 0.012, 0.26, s * 0.03, 0.0, -0.52);
    const bolt = grp(g, 'bolt', 0.06, 0.06, -0.08);
    box(bolt, M.steel, 0.03, 0.025, 0.04, 0, 0, 0);
    anchor(g, 'fore', 0, 0.0, -0.36);
    anchor(g, 'muzzle', 0, 0.06, -0.82);
    g.userData.sight = 0.17;
  },
  sniper(g) {
    rbox(g, M.dark, 0.07, 0.09, 0.32, 0, 0.05, -0.04);
    cyl(g, M.gunmetal, 0.019, 0.62, 0, 0.065, -0.5);
    brake(g, 0.019, 0.065, -0.83, 0.07);
    // Chassis stock
    rbox(g, M.olive, 0.075, 0.08, 0.36, 0, 0.02, -0.33);
    vents(g, 0.02, -0.22, 5, 0.045, 0.038);
    rbox(g, M.olive, 0.07, 0.13, 0.32, 0, 0.0, 0.25);
    box(g, M.olive, 0.05, 0.04, 0.12, 0, 0.085, 0.24); // cheek riser
    box(g, M.black, 0.072, 0.14, 0.025, 0, 0.0, 0.41);
    grip(g, M.olive, 0, -0.06, 0.06);
    trigger(g, 0.0, -0.005);
    scope(g, 0.14, -0.06, 0.36, 0.032);
    for (const z of [-0.12, 0.02]) {
      box(g, M.black, 0.03, 0.05, 0.02, 0, 0.1, z);
      cyl(g, M.black, 0.03, 0.022, 0, 0.14, z, 12);
    }
    const mag = grp(g, 'mag', 0, 0.0, -0.08);
    box(mag, M.black, 0.045, 0.08, 0.08, 0, -0.03, 0);
    const bolt = grp(g, 'bolt', 0.035, 0.08, 0.05);
    box(bolt, M.steel, 0.07, 0.014, 0.014, 0.035, 0, 0);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.017, 10, 8), M.black);
    knob.position.set(0.07, 0, 0);
    bolt.add(knob);
    // Bipod (folded)
    for (const s of [-1, 1]) box(g, M.dark, 0.012, 0.012, 0.24, s * 0.028, -0.025, -0.54);
    anchor(g, 'fore', 0, -0.02, -0.36);
    anchor(g, 'muzzle', 0, 0.065, -0.87);
    g.userData.sight = 0.14;
  },
  shotgun(g) {
    rbox(g, M.dark, 0.08, 0.09, 0.4, 0, 0.05, -0.08);
    box(g, M.steel, 0.004, 0.035, 0.09, 0.041, 0.055, -0.06); // loading port
    cyl(g, M.gunmetal, 0.024, 0.5, 0, 0.075, -0.5);
    cyl(g, M.dark, 0.02, 0.42, 0, 0.028, -0.46);
    box(g, M.black, 0.02, 0.02, 0.03, 0, 0.05, -0.72); // barrel clamp
    rail(g, 0.104, 0.06, -0.16, 0.026);
    const pump = grp(g, 'pump', 0, 0.02, -0.4);
    rbox(pump, M.wood, 0.076, 0.07, 0.18, 0, 0, 0);
    for (let i = 0; i < 5; i++) box(pump, M.woodDark, 0.078, 0.006, 0.01, 0, -0.012, -0.06 + i * 0.03);
    anchor(pump, 'fore', 0, -0.03, 0);
    grip(g, M.wood, 0, -0.05, 0.08);
    trigger(g, 0.01, 0.0);
    rbox(g, M.wood, 0.066, 0.11, 0.26, 0, 0.02, 0.26);
    box(g, M.black, 0.068, 0.12, 0.02, 0, 0.018, 0.39);
    box(g, M.steel, 0.012, 0.018, 0.012, 0, 0.11, -0.72);
    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.005, 6, 4), M.glow);
    bead.position.set(0, 0.12, -0.72);
    g.add(bead);
    // Shell saddle
    for (let i = 0; i < 4; i++) cyl(g, M.red, 0.009, 0.05, 0.044, 0.02, -0.02 - i * 0.022, 8).rotation.set(0, 0, 0);
    anchor(g, 'port', 0.05, 0.03, -0.1);
    anchor(g, 'muzzle', 0, 0.075, -0.76);
    g.userData.sight = 0.12;
  },
  gl(g) {
    cyl(g, M.olive, 0.062, 0.5, 0, 0.07, -0.33, 14);
    cyl(g, M.black, 0.07, 0.03, 0, 0.07, -0.58, 14);
    for (let i = 0; i < 3; i++) cyl(g, M.black, 0.065, 0.012, 0, 0.07, -0.2 - i * 0.1, 14);
    const drum = grp(g, 'cyl', 0, 0.0, -0.04);
    cyl(drum, M.dark, 0.11, 0.17, 0, 0, 0, 10);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      box(drum, M.black, 0.02, 0.02, 0.172, Math.cos(a) * 0.105, Math.sin(a) * 0.105, 0, 0, 0, a);
    }
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      cyl(drum, M.tan, 0.026, 0.174, Math.cos(a) * 0.06, Math.sin(a) * 0.06, 0, 8);
    }
    cyl(g, M.steel, 0.015, 0.2, 0, 0.0, -0.04, 8);
    grip(g, M.poly, 0, -0.07, 0.1, 0.13);
    trigger(g, 0.05, -0.02);
    rbox(g, M.olive, 0.06, 0.1, 0.24, 0, 0.03, 0.24);
    box(g, M.black, 0.062, 0.11, 0.02, 0, 0.03, 0.36);
    // Folding ladder sight
    box(g, M.dark, 0.04, 0.05, 0.08, 0, 0.14, -0.15);
    for (const s of [-1, 1]) box(g, M.black, 0.006, 0.05, 0.006, s * 0.016, 0.19, -0.15);
    box(g, M.black, 0.04, 0.006, 0.006, 0, 0.2, -0.15);
    rbox(g, M.poly, 0.05, 0.1, 0.06, 0, -0.03, -0.38);
    anchor(g, 'fore', 0, -0.07, -0.38);
    anchor(g, 'muzzle', 0, 0.07, -0.6);
    g.userData.sight = 0.2;
  },
  pistol(g) {
    const slide = grp(g, 'slide', 0, 0, 0);
    rbox(slide, M.dark, 0.045, 0.055, 0.21, 0, 0.05, -0.06);
    for (let i = 0; i < 5; i++) for (const s of [-1, 1]) box(slide, M.black, 0.002, 0.04, 0.005, s * 0.0225, 0.05, 0.02 + i * 0.01);
    box(slide, M.steel, 0.004, 0.018, 0.04, 0.023, 0.06, -0.05); // ejection port
    box(slide, M.black, 0.01, 0.015, 0.012, 0, 0.083, -0.15);
    box(slide, M.black, 0.03, 0.012, 0.01, 0, 0.082, 0.035);
    for (const x of [-0.008, 0.008]) {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.0022, 5, 4), M.glow);
      d.position.set(x, 0.09, 0.03);
      slide.add(d);
    }
    const fd = new THREE.Mesh(new THREE.SphereGeometry(0.0025, 5, 4), M.glow);
    fd.position.set(0, 0.091, -0.15);
    slide.add(fd);
    cyl(g, M.black, 0.007, 0.004, 0, 0.05, -0.166, 8);
    rbox(g, M.mid, 0.04, 0.035, 0.18, 0, 0.015, -0.05);
    box(g, M.black, 0.03, 0.01, 0.06, 0, -0.006, -0.11); // accessory rail
    trigger(g, -0.02, 0.025, 0.055);
    grip(g, M.poly, 0, -0.04, 0.02);
    const mag = grp(g, 'mag', 0, -0.02, 0.02);
    box(mag, M.dark, 0.034, 0.06, 0.045, 0, -0.07, 0.01, -0.25);
    box(mag, M.black, 0.04, 0.012, 0.05, 0, -0.1, 0.02, -0.25);
    anchor(g, 'fore', -0.04, -0.05, 0.0);
    anchor(g, 'muzzle', 0, 0.05, -0.18);
    g.userData.sight = 0.092;
  },
  revolver(g) {
    rbox(g, M.steel, 0.04, 0.055, 0.12, 0, 0.042, -0.02);
    cyl(g, M.steel, 0.017, 0.2, 0, 0.058, -0.17, 12);
    rbox(g, M.steel, 0.014, 0.03, 0.2, 0, 0.078, -0.17);
    box(g, M.steel, 0.024, 0.024, 0.18, 0, 0.034, -0.16); // ejector shroud
    box(g, M.black, 0.008, 0.02, 0.012, 0, 0.098, -0.26); // front blade
    const c = grp(g, 'cyl', 0, 0.035, -0.04);
    cyl(c, M.gunmetal, 0.033, 0.062, 0, 0, 0, 12);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      box(c, M.black, 0.006, 0.006, 0.064, Math.cos(a) * 0.033, Math.sin(a) * 0.033, 0);
      cyl(c, M.brass, 0.007, 0.004, Math.cos(a + 0.5) * 0.019, Math.sin(a + 0.5) * 0.019, 0.032, 6);
    }
    box(g, M.steel, 0.012, 0.04, 0.018, 0, 0.075, 0.045, 0.6); // hammer
    trigger(g, 0.0, 0.015, 0.05);
    rbox(g, M.wood, 0.044, 0.12, 0.056, 0, -0.05, 0.045, -0.35);
    box(g, M.woodDark, 0.046, 0.08, 0.01, 0, -0.05, 0.045, -0.35);
    box(g, M.steel, 0.01, 0.025, 0.02, 0, 0.075, 0.03);
    anchor(g, 'fore', -0.04, -0.05, 0.02);
    anchor(g, 'muzzle', 0, 0.058, -0.27);
    g.userData.sight = 0.098;
  },
  mpistol(g) {
    const slide = grp(g, 'slide', 0, 0, 0);
    rbox(slide, M.dark, 0.048, 0.06, 0.24, 0, 0.05, -0.07);
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) box(slide, M.black, 0.002, 0.044, 0.006, s * 0.024, 0.05, 0.02 + i * 0.012);
    box(slide, M.black, 0.01, 0.015, 0.012, 0, 0.085, -0.17);
    box(slide, M.black, 0.03, 0.012, 0.01, 0, 0.084, 0.03);
    rbox(g, M.mid, 0.042, 0.04, 0.2, 0, 0.012, -0.06);
    brake(g, 0.012, 0.05, -0.21, 0.035);
    trigger(g, -0.02, 0.02, 0.055);
    grip(g, M.poly, 0, -0.04, 0.02);
    const mag = grp(g, 'mag', 0, -0.02, 0.02);
    box(mag, M.black, 0.036, 0.2, 0.045, 0, -0.1, 0.03, -0.25);
    box(mag, M.dark, 0.04, 0.012, 0.05, 0, -0.195, 0.055, -0.25);
    rbox(g, M.poly, 0.03, 0.07, 0.035, 0, -0.03, -0.14);
    anchor(g, 'fore', 0, -0.07, -0.14);
    anchor(g, 'muzzle', 0, 0.05, -0.23);
    g.userData.sight = 0.095;
  },
  dmr(g) {
    rbox(g, M.tan, 0.07, 0.1, 0.46, 0, 0.05, -0.1);
    box(g, M.steel, 0.004, 0.022, 0.07, 0.036, 0.065, -0.04);
    cyl(g, M.gunmetal, 0.017, 0.4, 0, 0.065, -0.5);
    brake(g, 0.017, 0.065, -0.73, 0.06);
    rbox(g, M.tan, 0.075, 0.085, 0.26, 0, 0.035, -0.36);
    vents(g, 0.035, -0.27, 5, 0.04, 0.038);
    rail(g, 0.1, 0.08, -0.22, 0.026);
    const mag = grp(g, 'mag', 0, -0.02, -0.12);
    box(mag, M.black, 0.05, 0.12, 0.08, 0, -0.05, 0, 0.15);
    box(mag, M.dark, 0.052, 0.012, 0.084, 0, -0.11, 0.01, 0.15);
    grip(g, M.poly, 0, -0.05, 0.06);
    trigger(g, 0.0, 0.0);
    rbox(g, M.tan, 0.06, 0.12, 0.24, 0, 0.02, 0.24);
    box(g, M.black, 0.062, 0.13, 0.02, 0, 0.02, 0.37);
    // Short magnified optic on a raised mount
    for (const z of [-0.14, -0.02]) box(g, M.black, 0.028, 0.03, 0.018, 0, 0.11, z);
    cyl(g, M.black, 0.022, 0.16, 0, 0.13, -0.08, 14);
    cyl(g, M.black, 0.03, 0.04, 0, 0.13, -0.17, 14, 0.023);
    cyl(g, M.lens, 0.027, 0.004, 0, 0.13, -0.191, 14);
    const bolt = grp(g, 'bolt', 0.045, 0.07, -0.02);
    box(bolt, M.steel, 0.025, 0.02, 0.05, 0, 0, 0);
    anchor(g, 'fore', 0, -0.01, -0.36);
    anchor(g, 'muzzle', 0, 0.065, -0.77);
    g.userData.sight = 0.13;
  },
  minigun(g) {
    rbox(g, M.dark, 0.14, 0.14, 0.3, 0, 0.0, -0.05);
    cyl(g, M.mid, 0.06, 0.08, 0, 0.0, -0.22, 14);
    box(g, M.black, 0.15, 0.02, 0.2, 0, 0.0, -0.05);
    const spin = grp(g, 'spin', 0, 0.0, -0.42);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      cyl(spin, M.gunmetal, 0.013, 0.55, Math.cos(a) * 0.04, Math.sin(a) * 0.04, 0, 8);
    }
    cyl(spin, M.mid, 0.058, 0.03, 0, 0, -0.22, 12);
    cyl(spin, M.mid, 0.058, 0.03, 0, 0, 0.0, 12);
    cyl(spin, M.mid, 0.058, 0.03, 0, 0, 0.18, 12);
    cyl(spin, M.black, 0.012, 0.56, 0, 0, 0, 6);
    const mag = grp(g, 'mag', 0.0, -0.08, 0.0);
    rbox(mag, M.olive, 0.16, 0.14, 0.18, 0.05, -0.05, 0);
    box(mag, M.tan, 0.162, 0.02, 0.182, 0.05, -0.0, 0);
    // Ammo belt feeding into the receiver
    for (let i = 0; i < 5; i++) cyl(g, M.brass, 0.008, 0.04, 0.09 - i * 0.012, -0.03 + i * 0.014, 0.02, 6).rotation.set(0, 0, Math.PI / 2);
    grip(g, M.poly, 0, -0.09, 0.08, 0.12, -0.2);
    trigger(g, 0.04, -0.04);
    // Carry handle that the left hand holds
    box(g, M.dark, 0.03, 0.08, 0.15, 0, 0.11, -0.05);
    box(g, M.black, 0.034, 0.03, 0.12, 0, 0.16, -0.08);
    anchor(g, 'fore', -0.02, 0.12, -0.1);
    anchor(g, 'muzzle', 0, 0.0, -0.72);
    g.userData.sight = 0.17;
  },
  doublebarrel(g) {
    cyl(g, M.gunmetal, 0.022, 0.55, -0.022, 0.06, -0.42);
    cyl(g, M.gunmetal, 0.022, 0.55, 0.022, 0.06, -0.42);
    box(g, M.dark, 0.016, 0.01, 0.55, 0, 0.083, -0.42); // rib
    rbox(g, M.steel, 0.08, 0.07, 0.14, 0, 0.04, -0.08);
    box(g, M.gunmetal, 0.082, 0.04, 0.06, 0, 0.03, -0.06);
    rbox(g, M.wood, 0.07, 0.06, 0.2, 0, 0.02, -0.3);
    trigger(g, -0.0, 0.0, 0.06);
    grip(g, M.wood, 0, -0.05, 0.03, 0.12, -0.3);
    rbox(g, M.wood, 0.066, 0.11, 0.28, 0, 0.0, 0.2);
    box(g, M.black, 0.068, 0.12, 0.02, 0, -0.002, 0.34);
    for (const s of [-1, 1]) box(g, M.steel, 0.012, 0.02, 0.025, s * 0.012, 0.085, -0.04, 0.5); // hammers
    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.005, 6, 4), M.brass);
    bead.position.set(0, 0.093, -0.68);
    g.add(bead);
    anchor(g, 'fore', 0, -0.02, -0.3);
    anchor(g, 'port', 0, 0.06, -0.14);
    anchor(g, 'muzzle', 0, 0.06, -0.7);
    g.userData.sight = 0.1;
  },
  rocket(g) {
    cyl(g, M.olive, 0.075, 0.9, 0, 0.09, -0.2, 16);
    for (const z of [-0.45, 0.05]) cyl(g, M.tape, 0.077, 0.04, 0, 0.09, z, 16);
    cyl(g, M.dark, 0.088, 0.08, 0, 0.09, -0.64, 16, 0.082);
    cyl(g, M.dark, 0.088, 0.1, 0, 0.09, 0.25, 16, 0.095);
    const mag = grp(g, 'mag', 0, 0.09, -0.7);
    const war = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 12), M.olive);
    war.rotation.x = -Math.PI / 2;
    mag.add(war);
    cyl(mag, M.black, 0.061, 0.03, 0, 0, 0.09, 12);
    grip(g, M.poly, 0, -0.05, 0.0, 0.13);
    trigger(g, -0.06, 0.0);
    rbox(g, M.poly, 0.05, 0.12, 0.06, 0, -0.03, -0.3);
    // Side-mounted sight box
    rbox(g, M.dark, 0.06, 0.08, 0.12, 0.1, 0.14, -0.15);
    cyl(g, M.lens, 0.022, 0.004, 0.1, 0.15, -0.212, 12);
    box(g, M.black, 0.03, 0.03, 0.04, 0.07, 0.12, -0.15);
    box(g, M.orange, 0.02, 0.012, 0.06, 0, 0.17, -0.2);
    anchor(g, 'fore', 0, -0.05, -0.3);
    anchor(g, 'muzzle', 0, 0.09, -0.75);
    g.userData.sight = 0.19;
  },
  crossbow(g) {
    rbox(g, M.wood, 0.06, 0.07, 0.6, 0, 0.03, -0.12);
    box(g, M.black, 0.03, 0.012, 0.5, 0, 0.068, -0.2); // flight groove
    // Recurve limbs + string
    for (const s of [-1, 1]) {
      box(g, M.dark, 0.18, 0.026, 0.04, s * 0.11, 0.05, -0.38, 0, s * 0.18);
      box(g, M.dark, 0.08, 0.024, 0.035, s * 0.23, 0.05, -0.35, 0, -s * 0.35);
      box(g, M.black, 0.003, 0.003, 0.2, s * 0.13, 0.055, -0.24, 0, -s * 1.1);
    }
    box(g, M.dark, 0.06, 0.06, 0.06, 0, 0.04, -0.38);
    const mag = grp(g, 'mag', 0, 0.078, -0.25);
    box(mag, M.steel, 0.01, 0.01, 0.42, 0, 0, 0);
    box(mag, M.red, 0.002, 0.03, 0.05, 0, 0.012, 0.18);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.01, 0.03, 4), M.steel);
    tip.rotation.x = -Math.PI / 2;
    tip.position.z = -0.225;
    mag.add(tip);
    grip(g, M.poly, 0, -0.05, 0.05);
    trigger(g, 0.0, 0.0);
    rbox(g, M.wood, 0.06, 0.1, 0.22, 0, 0.0, 0.26);
    rail(g, 0.1, 0.06, -0.06, 0.024);
    irons(g, 0.12, -0.06, 0.04, 0.1);
    anchor(g, 'fore', 0, -0.02, -0.3);
    anchor(g, 'muzzle', 0, 0.075, -0.48);
    g.userData.sight = 0.12;
  },
  handcannon(g) {
    const slide = grp(g, 'slide', 0, 0, 0);
    rbox(slide, M.steel, 0.05, 0.065, 0.27, 0, 0.055, -0.08);
    for (let i = 0; i < 3; i++) box(slide, M.black, 0.052, 0.004, 0.14, 0, 0.06 - i * 0.012, -0.13); // lightening cuts
    box(slide, M.dark, 0.012, 0.018, 0.015, 0, 0.095, -0.2);
    box(slide, M.dark, 0.032, 0.012, 0.01, 0, 0.093, 0.03);
    box(slide, M.black, 0.004, 0.02, 0.05, 0.026, 0.06, -0.04);
    rbox(g, M.dark, 0.045, 0.04, 0.22, 0, 0.01, -0.07);
    cyl(g, M.black, 0.012, 0.004, 0, 0.055, -0.217, 8);
    trigger(g, -0.02, 0.022, 0.055);
    grip(g, M.poly, 0, -0.045, 0.02, 0.13);
    box(g, M.steel, 0.012, 0.03, 0.016, 0, 0.07, 0.055, 0.6); // hammer
    const mag = grp(g, 'mag', 0, -0.02, 0.02);
    box(mag, M.dark, 0.036, 0.06, 0.05, 0, -0.08, 0.01, -0.25);
    box(mag, M.black, 0.042, 0.012, 0.055, 0, -0.112, 0.02, -0.25);
    anchor(g, 'fore', -0.04, -0.05, 0.0);
    anchor(g, 'muzzle', 0, 0.055, -0.23);
    g.userData.sight = 0.1;
  },
  sawedoff(g) {
    cyl(g, M.gunmetal, 0.022, 0.26, -0.022, 0.05, -0.2);
    cyl(g, M.gunmetal, 0.022, 0.26, 0.022, 0.05, -0.2);
    for (const s of [-1, 1]) cyl(g, M.black, 0.024, 0.012, s * 0.022, 0.05, -0.327, 10);
    rbox(g, M.steel, 0.08, 0.07, 0.1, 0, 0.035, -0.03);
    box(g, M.wood, 0.06, 0.04, 0.1, 0, 0.0, -0.13);
    trigger(g, 0.0, 0.01, 0.05);
    rbox(g, M.wood, 0.05, 0.13, 0.07, 0, -0.06, 0.03, -0.45);
    box(g, M.tape, 0.052, 0.04, 0.072, 0, -0.08, 0.04, -0.45);
    for (const s of [-1, 1]) box(g, M.steel, 0.012, 0.02, 0.025, s * 0.012, 0.075, 0.0, 0.5);
    anchor(g, 'fore', -0.04, -0.05, 0.0);
    anchor(g, 'port', 0, 0.05, -0.08);
    anchor(g, 'muzzle', 0, 0.05, -0.34);
    g.userData.sight = 0.09;
  },
  br(g) {
    // Heavy battle rifle: long receiver, wood furniture, big mag, scope-less with a tall rear peep.
    rbox(g, M.gunmetal, 0.072, 0.065, 0.4, 0, 0.068, -0.07);
    rbox(g, M.dark, 0.068, 0.05, 0.28, 0, 0.022, -0.03);
    box(g, M.steel, 0.004, 0.024, 0.08, 0.037, 0.07, -0.04);
    rbox(g, M.woodDark, 0.078, 0.07, 0.3, 0, 0.045, -0.36);
    for (let i = 0; i < 4; i++) box(g, M.black, 0.08, 0.008, 0.012, 0, 0.065, -0.26 - i * 0.06);
    cyl(g, M.gunmetal, 0.018, 0.26, 0, 0.065, -0.6);
    brake(g, 0.018, 0.065, -0.75, 0.07);
    box(g, M.black, 0.012, 0.05, 0.012, 0, 0.11, -0.66);
    box(g, M.black, 0.006, 0.014, 0.004, 0, 0.13, -0.66);
    for (const s of [-1, 1]) box(g, M.black, 0.008, 0.05, 0.03, s * 0.014, 0.115, 0.06);
    const mag = grp(g, 'mag', 0, -0.02, -0.15);
    box(mag, M.black, 0.052, 0.13, 0.08, 0, -0.06, 0, 0.1);
    box(mag, M.dark, 0.054, 0.012, 0.084, 0, -0.125, 0.008, 0.1);
    grip(g, M.woodDark, 0, -0.05, 0.06);
    trigger(g, 0.0, 0.0);
    rbox(g, M.woodDark, 0.064, 0.115, 0.3, 0, 0.025, 0.27);
    box(g, M.black, 0.066, 0.125, 0.02, 0, 0.022, 0.42);
    const bolt = grp(g, 'bolt', 0.046, 0.075, -0.02);
    box(bolt, M.steel, 0.022, 0.02, 0.05, 0, 0, 0);
    anchor(g, 'fore', 0, 0.0, -0.36);
    anchor(g, 'muzzle', 0, 0.065, -0.79);
    g.userData.sight = 0.13;
  },
  pdw(g) {
    // Compact bullpup-style PDW with a top-mounted horizontal mag and a red dot.
    rbox(g, M.poly, 0.07, 0.11, 0.36, 0, 0.035, -0.06);
    box(g, M.dark, 0.072, 0.03, 0.1, 0, -0.02, -0.2);
    const mag = grp(g, 'mag', 0, 0.096, -0.08);
    box(mag, M.glass, 0.05, 0.025, 0.28, 0, 0, 0);
    box(mag, M.brass, 0.03, 0.012, 0.24, 0, -0.002, 0);
    cyl(g, M.black, 0.016, 0.07, 0, 0.055, -0.27);
    can(g, 0.022, 0.055, -0.33, 0.08);
    grip(g, M.poly, 0, -0.06, -0.02, 0.11, -0.15);
    trigger(g, -0.08, -0.015, 0.06);
    rbox(g, M.poly, 0.06, 0.09, 0.04, 0, -0.04, -0.2);
    box(g, M.black, 0.072, 0.12, 0.02, 0, 0.03, 0.13);
    redDot(g, 0.15, -0.02, 0.11);
    const bolt = grp(g, 'bolt', 0.04, 0.05, 0.04);
    box(bolt, M.steel, 0.018, 0.016, 0.04, 0, 0, 0);
    anchor(g, 'fore', 0, -0.08, -0.2);
    anchor(g, 'muzzle', 0, 0.055, -0.38);
    g.userData.sight = 0.15;
  },
  autoshot(g) {
    // Mag-fed combat shotgun with a drum and a heat shield.
    rbox(g, M.dark, 0.08, 0.1, 0.38, 0, 0.05, -0.06);
    rail(g, 0.11, 0.06, -0.18, 0.026);
    cyl(g, M.gunmetal, 0.024, 0.34, 0, 0.07, -0.42);
    cyl(g, M.black, 0.03, 0.04, 0, 0.07, -0.6, 10);
    for (let i = 0; i < 5; i++) box(g, M.black, 0.056, 0.008, 0.03, 0, 0.098, -0.3 - i * 0.05);
    rbox(g, M.poly, 0.08, 0.06, 0.2, 0, 0.02, -0.32);
    const mag = grp(g, 'mag', 0, -0.02, -0.12);
    cyl(mag, M.black, 0.08, 0.07, 0, -0.08, 0, 14).rotation.set(0, 0, Math.PI / 2); // drum, axis across the gun
    box(mag, M.dark, 0.05, 0.05, 0.06, 0, -0.01, 0);
    grip(g, M.poly, 0, -0.05, 0.07);
    trigger(g, 0.01, 0.0);
    rbox(g, M.poly, 0.066, 0.11, 0.24, 0, 0.025, 0.26);
    box(g, M.black, 0.068, 0.12, 0.02, 0, 0.022, 0.38);
    irons(g, 0.13, -0.2, 0.04, 0.11);
    const bolt = grp(g, 'bolt', 0.045, 0.07, -0.02);
    box(bolt, M.steel, 0.024, 0.02, 0.05, 0, 0, 0);
    anchor(g, 'fore', 0, -0.01, -0.32);
    anchor(g, 'muzzle', 0, 0.07, -0.63);
    g.userData.sight = 0.13;
  },
  amr(g) {
    // Huge bolt-action anti-materiel rifle with a big brake and bipod.
    rbox(g, M.dark, 0.085, 0.1, 0.4, 0, 0.05, -0.04);
    cyl(g, M.gunmetal, 0.026, 0.72, 0, 0.068, -0.6);
    for (let i = 0; i < 6; i++) box(g, M.black, 0.058, 0.006, 0.03, 0, 0.096, -0.32 - i * 0.07);
    cyl(g, M.black, 0.045, 0.12, 0, 0.068, -1.0, 10);
    for (const s of [-1, 1]) box(g, M.dark, 0.02, 0.07, 0.06, s * 0.05, 0.068, -1.0);
    rbox(g, M.olive, 0.09, 0.08, 0.34, 0, 0.02, -0.36);
    rbox(g, M.olive, 0.08, 0.14, 0.34, 0, -0.005, 0.26);
    box(g, M.olive, 0.06, 0.04, 0.14, 0, 0.09, 0.24);
    box(g, M.black, 0.082, 0.15, 0.03, 0, -0.005, 0.44);
    grip(g, M.olive, 0, -0.065, 0.06, 0.13);
    trigger(g, 0.0, -0.01);
    scope(g, 0.16, -0.08, 0.42, 0.038);
    for (const z of [-0.18, 0.04]) { box(g, M.black, 0.034, 0.06, 0.024, 0, 0.115, z); cyl(g, M.black, 0.035, 0.026, 0, 0.16, z, 12); }
    const mag = grp(g, 'mag', 0, 0.0, -0.12);
    box(mag, M.black, 0.055, 0.12, 0.1, 0, -0.05, 0);
    const bolt = grp(g, 'bolt', 0.045, 0.08, 0.06);
    box(bolt, M.steel, 0.08, 0.016, 0.016, 0.04, 0, 0);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 8), M.black);
    knob.position.set(0.08, 0, 0);
    bolt.add(knob);
    for (const s of [-1, 1]) box(g, M.dark, 0.014, 0.014, 0.3, s * 0.035, -0.03, -0.66);
    anchor(g, 'fore', 0, -0.02, -0.38);
    anchor(g, 'muzzle', 0, 0.068, -1.07);
    g.userData.sight = 0.16;
  },
  railgun(g) {
    // Sci-fi coil gun: twin rails with glowing coils.
    rbox(g, M.black, 0.08, 0.1, 0.42, 0, 0.05, -0.05);
    for (const s of [-1, 1]) box(g, M.gunmetal, 0.014, 0.04, 0.56, s * 0.026, 0.07, -0.5);
    for (let i = 0; i < 6; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.008, 6, 16), M.glow);
      ring.position.set(0, 0.07, -0.3 - i * 0.07);
      g.add(ring);
    }
    box(g, M.glow, 0.004, 0.01, 0.5, 0, 0.07, -0.5);
    rbox(g, M.mid, 0.07, 0.07, 0.2, 0, -0.02, -0.2);
    const mag = grp(g, 'mag', 0, -0.03, -0.12);
    rbox(mag, M.dark, 0.06, 0.1, 0.07, 0, -0.04, 0);
    box(mag, M.glow, 0.062, 0.01, 0.02, 0, -0.02, -0.02);
    grip(g, M.poly, 0, -0.06, 0.07);
    trigger(g, 0.01, -0.005);
    rbox(g, M.black, 0.066, 0.12, 0.26, 0, 0.03, 0.27);
    box(g, M.glow, 0.068, 0.012, 0.1, 0, 0.05, 0.27);
    redDot(g, 0.16, -0.06, 0.1);
    anchor(g, 'fore', 0, -0.02, -0.24);
    anchor(g, 'muzzle', 0, 0.07, -0.79);
    g.userData.sight = 0.16;
  },
  bpistol(g) {
    const slide = grp(g, 'slide', 0, 0, 0);
    rbox(slide, M.tan, 0.046, 0.056, 0.22, 0, 0.05, -0.065);
    for (let i = 0; i < 5; i++) for (const s of [-1, 1]) box(slide, M.black, 0.002, 0.04, 0.005, s * 0.023, 0.05, 0.02 + i * 0.01);
    box(slide, M.black, 0.01, 0.015, 0.012, 0, 0.084, -0.16);
    box(slide, M.black, 0.03, 0.012, 0.01, 0, 0.083, 0.035);
    rbox(g, M.dark, 0.04, 0.035, 0.19, 0, 0.015, -0.055);
    brake(g, 0.01, 0.05, -0.19, 0.03);
    trigger(g, -0.02, 0.025, 0.055);
    grip(g, M.tan, 0, -0.04, 0.02);
    box(g, M.orange, 0.004, 0.012, 0.012, 0.024, 0.02, 0.005); // fire selector
    const mag = grp(g, 'mag', 0, -0.02, 0.02);
    box(mag, M.dark, 0.034, 0.1, 0.045, 0, -0.08, 0.02, -0.25);
    anchor(g, 'fore', -0.04, -0.05, 0.0);
    anchor(g, 'muzzle', 0, 0.05, -0.21);
    g.userData.sight = 0.092;
  },
  flare(g) {
    // Chunky orange break-action flare pistol.
    rbox(g, M.orange, 0.05, 0.06, 0.12, 0, 0.04, -0.02);
    cyl(g, M.orange, 0.03, 0.2, 0, 0.055, -0.17, 14);
    cyl(g, M.black, 0.022, 0.004, 0, 0.055, -0.272, 12);
    box(g, M.black, 0.014, 0.04, 0.03, 0, 0.08, 0.04, 0.5);
    const mag = grp(g, 'mag', 0, 0.055, -0.08);
    cyl(mag, M.red, 0.018, 0.08, 0, 0, 0, 10);
    trigger(g, 0.0, 0.015, 0.05);
    rbox(g, M.orange, 0.044, 0.12, 0.056, 0, -0.05, 0.045, -0.35);
    box(g, M.black, 0.046, 0.08, 0.01, 0, -0.05, 0.045, -0.35);
    anchor(g, 'fore', -0.04, -0.05, 0.02);
    anchor(g, 'muzzle', 0, 0.055, -0.28);
    g.userData.sight = 0.095;
  },
  machete(g) {
    rbox(g, M.poly, 0.034, 0.038, 0.13, 0, 0, 0.02);
    box(g, M.black, 0.05, 0.012, 0.014, 0, -0.012, -0.05);
    box(g, M.steel, 0.006, 0.05, 0.4, 0, 0.008, -0.25);
    box(g, M.gunmetal, 0.007, 0.012, 0.4, 0, 0.03, -0.25);
    box(g, M.steel, 0.006, 0.06, 0.08, 0, 0.012, -0.47, -0.25);
    anchor(g, 'muzzle', 0, 0, -0.5);
  },
  sledge(g) {
    rbox(g, M.wood, 0.034, 0.04, 0.75, 0, 0, -0.26);
    cyl(g, M.tape, 0.023, 0.18, 0, 0, 0.02, 8);
    rbox(g, M.gunmetal, 0.09, 0.09, 0.2, 0, 0.0, -0.64, 0, Math.PI / 2, 0);
    for (const s of [-1, 1]) box(g, M.steel, 0.095, 0.095, 0.012, s * 0.1, 0.0, -0.64, 0, Math.PI / 2, 0);
    anchor(g, 'fore', 0, 0, -0.25);
    anchor(g, 'muzzle', 0, 0, -0.64);
  },
  impact(g) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.05, 14, 12), M.dark);
    g.add(s);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.008, 6, 16), M.orange);
    band.rotation.x = Math.PI / 2;
    g.add(band);
    for (let i = 0; i < 6; i++) {
      const n = new THREE.Mesh(new THREE.ConeGeometry(0.01, 0.025, 6), M.orange);
      const a = (i / 6) * Math.PI * 2;
      n.position.set(Math.cos(a) * 0.05, 0.02, Math.sin(a) * 0.05);
      g.add(n);
    }
    cyl(g, M.mid, 0.014, 0.03, 0, 0.06, 0, 10).rotation.x = 0;
    const pin = grp(g, 'pin', -0.02, 0.075, 0);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.004, 6, 12), M.steel);
    ring.rotation.y = Math.PI / 2;
    pin.add(ring);
    anchor(g, 'muzzle', 0, 0, 0);
  },
  katana(g) {
    rbox(g, M.black, 0.035, 0.04, 0.22, 0, 0, 0.04);
    for (let i = 0; i < 6; i++) box(g, M.bone, 0.037, 0.03, 0.006, 0, 0, -0.04 + i * 0.03, 0, 0, i % 2 ? 0.5 : -0.5);
    cyl(g, M.brass, 0.022, 0.01, 0, 0, 0.155, 8);
    const tsuba = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.012, 16), M.brass);
    tsuba.rotation.x = Math.PI / 2;
    tsuba.scale.set(1, 1, 0.75);
    tsuba.position.z = -0.08;
    g.add(tsuba);
    box(g, M.brass, 0.014, 0.034, 0.03, 0, 0.004, -0.1);
    box(g, M.steel, 0.008, 0.038, 0.66, 0, 0.005, -0.44);
    box(g, M.gunmetal, 0.009, 0.006, 0.66, 0, 0.022, -0.44); // spine
    box(g, M.steel, 0.008, 0.038, 0.06, 0, 0.0, -0.785, 0.35);
    anchor(g, 'muzzle', 0, 0, -0.8);
  },
  bat(g) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.019, 0.75, 14), M.wood);
    m.rotation.x = Math.PI / 2;
    m.position.z = -0.3;
    g.add(m);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.046, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.wood);
    cap.rotation.x = -Math.PI / 2;
    cap.position.z = -0.675;
    g.add(cap);
    cyl(g, M.tape, 0.021, 0.16, 0, 0, 0.03, 10);
    cyl(g, M.black, 0.03, 0.02, 0, 0, 0.12, 10);
    for (let i = 0; i < 3; i++) box(g, M.red, 0.002, 0.04, 0.012, 0.042, 0, -0.48 - i * 0.04); // decal stripes
    anchor(g, 'fore', 0, 0, -0.1);
    anchor(g, 'muzzle', 0, 0, -0.65);
  },
  flash(g) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.14, 14), M.steel);
    g.add(c);
    for (const y of [-0.04, 0.04]) {
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.015, 14), M.dark);
      band.position.y = y;
      g.add(band);
    }
    for (let i = 0; i < 4; i++) box(g, M.black, 0.012, 0.03, 0.012, Math.cos(i * 1.57) * 0.038, 0.0, Math.sin(i * 1.57) * 0.038);
    box(g, M.mid, 0.015, 0.1, 0.015, 0.04, 0.02, 0);
    const pin = grp(g, 'pin', -0.03, 0.085, 0);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.004, 6, 12), M.steel);
    ring.rotation.y = Math.PI / 2;
    pin.add(ring);
    anchor(g, 'muzzle', 0, 0, 0);
  },
  tknife(g) {
    rbox(g, M.black, 0.022, 0.028, 0.08, 0, 0, 0.02);
    cyl(g, M.steel, 0.008, 0.004, 0, 0, 0.062, 8);
    box(g, M.steel, 0.005, 0.03, 0.13, 0, 0, -0.09);
    box(g, M.steel, 0.005, 0.021, 0.021, 0, 0.0, -0.155, Math.PI / 4);
    anchor(g, 'muzzle', 0, 0, -0.18);
  },
  knife(g) {
    rbox(g, M.poly, 0.034, 0.036, 0.13, 0, 0, 0.02);
    for (let i = 0; i < 4; i++) box(g, M.black, 0.036, 0.038, 0.005, 0, 0, -0.02 + i * 0.025);
    box(g, M.gunmetal, 0.07, 0.016, 0.018, 0, 0, -0.05);
    cyl(g, M.gunmetal, 0.018, 0.012, 0, 0, 0.09, 8);
    box(g, M.steel, 0.007, 0.034, 0.18, 0, 0.004, -0.15);
    box(g, M.gunmetal, 0.008, 0.008, 0.12, 0, 0.022, -0.12); // spine
    for (let i = 0; i < 4; i++) box(g, M.gunmetal, 0.008, 0.006, 0.006, 0, 0.027, -0.08 - i * 0.018, 0.7);
    box(g, M.steel, 0.007, 0.025, 0.04, 0, 0.0, -0.245, 0.45);
    anchor(g, 'muzzle', 0, 0, -0.26);
  },
  claws(g) {
    rbox(g, M.zombie, 0.08, 0.08, 0.1, 0, 0, 0);
    for (let i = -1; i <= 1; i++) {
      box(g, M.zombie, 0.02, 0.02, 0.05, i * 0.025, 0.02, -0.07, 0.15, i * 0.12, 0);
      box(g, M.bone, 0.008, 0.018, 0.16, i * 0.025, 0.025, -0.16, 0.2, i * 0.12, 0);
    }
    anchor(g, 'muzzle', 0, 0, -0.24);
  },
  axe(g) {
    rbox(g, M.wood, 0.035, 0.042, 0.7, 0, 0, -0.24);
    cyl(g, M.tape, 0.024, 0.16, 0, 0, 0.02, 8);
    box(g, M.red, 0.046, 0.15, 0.1, 0, 0.065, -0.56);
    box(g, M.steel, 0.012, 0.19, 0.05, 0, 0.075, -0.62);
    box(g, M.steel, 0.006, 0.2, 0.012, 0, 0.075, -0.65); // edge
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.1, 6), M.red);
    spike.position.set(0, -0.07, -0.56);
    spike.rotation.x = Math.PI;
    g.add(spike);
    anchor(g, 'fore', 0, 0, -0.22);
    anchor(g, 'muzzle', 0, 0.08, -0.6);
  },
  frag(g) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.055, 14, 12), M.olive);
    s.scale.y = 1.2;
    g.add(s);
    for (let i = 0; i < 3; i++) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.054 - Math.abs(i - 1) * 0.012, 0.0035, 4, 16), M.olive);
      band.rotation.x = Math.PI / 2;
      band.position.y = (i - 1) * 0.035;
      g.add(band);
    }
    cyl(g, M.mid, 0.016, 0.03, 0, 0.07, 0, 10).rotation.x = 0;
    box(g, M.mid, 0.015, 0.09, 0.015, 0.03, 0.03, 0, 0, 0, -0.12);
    const pin = grp(g, 'pin', -0.02, 0.08, 0);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.004, 6, 12), M.steel);
    ring.rotation.y = Math.PI / 2;
    pin.add(ring);
    anchor(g, 'muzzle', 0, 0, 0);
  },
  sticky(g) {
    cyl(g, M.dark, 0.045, 0.12, 0, 0, 0, 14).rotation.x = 0;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.047, 0.047, 0.02, 14), M.orange);
    band.position.y = 0.035;
    g.add(band);
    const blob = new THREE.Mesh(new THREE.SphereGeometry(0.052, 12, 8), M.olive);
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
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.15, 14), M.gray);
    g.add(c);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.047, 0.047, 0.03, 14), M.dark);
    band.position.y = 0.03;
    g.add(band);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.015, 14), M.mid);
    top.position.y = 0.082;
    g.add(top);
    for (let i = 0; i < 4; i++) box(g, M.black, 0.01, 0.01, 0.01, Math.cos(i * 1.57) * 0.025, 0.09, Math.sin(i * 1.57) * 0.025);
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
  g.traverse((o) => { if (o.isMesh) o.castShadow = o.material !== M.glass; });
  const parts = {};
  g.traverse((o) => { if (o.name) parts[o.name] = o; });
  for (const p of Object.values(parts)) p.userData.base = p.position.clone();
  g.userData.parts = parts;
  return g;
}

// Projectiles point down -Z (userData.aligned = should face its velocity).
export function buildProjectile(kind) {
  const g = new THREE.Group();
  g.userData.aligned = true;
  if (kind === 'gl') {
    cyl(g, M.tan, 0.05, 0.12, 0, 0, 0.02, 12);
    cyl(g, M.brass, 0.052, 0.04, 0, 0, 0.08, 12);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.olive);
    nose.rotation.x = -Math.PI / 2;
    nose.position.z = -0.04;
    g.add(nose);
  } else if (kind === 'rocket') {
    cyl(g, M.olive, 0.05, 0.4, 0, 0, 0, 12);
    cyl(g, M.tape, 0.052, 0.03, 0, 0, -0.1, 12);
    const war = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 12), M.olive);
    war.rotation.x = -Math.PI / 2;
    war.position.z = -0.27;
    g.add(war);
    box(g, M.dark, 0.18, 0.01, 0.08, 0, 0, 0.17);
    box(g, M.dark, 0.01, 0.18, 0.08, 0, 0, 0.17);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.25, 8),
      new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending }));
    flame.rotation.x = -Math.PI / 2;
    flame.position.z = 0.33;
    g.add(flame);
  } else if (kind === 'flare') {
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshBasicMaterial({ color: '#ff5a2a' }));
    g.add(core);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8),
      new THREE.MeshBasicMaterial({ color: '#ff8a3a', transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
    g.add(halo);
  } else if (kind === 'crossbow') {
    box(g, M.steel, 0.012, 0.012, 0.5, 0, 0, 0);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.04, 4), M.steel);
    tip.rotation.x = -Math.PI / 2;
    tip.position.z = -0.27;
    g.add(tip);
    box(g, M.red, 0.04, 0.002, 0.06, 0, 0, 0.22);
    box(g, M.red, 0.002, 0.04, 0.06, 0, 0, 0.22);
  } else {
    const gun = buildGun(kind);
    gun.scale.setScalar(1.3);
    g.add(gun);
    g.userData.aligned = kind === 'tknife';
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
