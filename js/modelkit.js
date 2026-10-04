import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// Shared materials and building blocks for the low-poly weapon models (see guns.js / models.js).
// Barrels point down -Z; the origin is the right-hand grip.

// Set before models are built; phones use plain boxes to save GPU memory.
export const modelQuality = { rounded: true, remoteShadows: true };

const std = (color, roughness, metalness = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
export const M = {
  dark: std('#363a40', 0.5, 0.25),
  mid: std('#5a616a', 0.45, 0.25),
  black: std('#1d1f23', 0.55, 0.2),
  poly: std('#26292e', 0.85),
  rubber: std('#17181b', 0.95),
  wood: std('#7a4b26', 0.7),
  woodDark: std('#53321a', 0.75),
  olive: std('#4d5a32', 0.7, 0.1),
  tan: std('#a08a62', 0.75),
  fde: std('#8f7a55', 0.8),
  steel: std('#cfd5da', 0.25, 0.7),
  gunmetal: std('#4a5058', 0.3, 0.65),
  brass: std('#c8a24a', 0.35, 0.7),
  red: std('#b02a22', 0.55),
  orange: std('#d9822b', 0.6),
  lens: std('#2a6cff', 0.1, 0.3, { emissive: '#0a2a66' }),
  glass: std('#9fd2ff', 0.05, 0.2, { transparent: true, opacity: 0.16, depthWrite: false }),
  // Inside of open scope tubes (seen from the eyepiece).
  tube: std('#141518', 0.6, 0.2, { side: THREE.DoubleSide }),
  reticle: new THREE.MeshBasicMaterial({ color: '#050505' }),
  dot: new THREE.MeshBasicMaterial({ color: '#ff2a2a' }),
  glow: new THREE.MeshBasicMaterial({ color: '#7dffb0' }),
  led: std('#ff2020', 0.5, 0, { emissive: '#ff2020', emissiveIntensity: 2 }),
  gray: std('#8d9399', 0.7),
  tape: std('#2a2d31', 0.95),
  zombie: std('#5f8f3a', 0.9),
  white: std('#e8ecef', 0.45, 0.1),
  cyan: new THREE.MeshBasicMaterial({ color: '#3fe8ff' }),
  purple: std('#b06bff', 0.5, 0, { emissive: '#7a2cff', emissiveIntensity: 1.2 }),
  gold: std('#e8b923', 0.3, 0.8),
  bone: std('#d8cfb8', 0.6),
};

export function box(p, mat, sx, sy, sz, x, y, z, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  p.add(m);
  return m;
}
// Box with softened edges, for receivers, stocks and grips.
export function rbox(p, mat, sx, sy, sz, x, y, z, rx = 0, ry = 0, rz = 0) {
  if (!modelQuality.rounded) return box(p, mat, sx, sy, sz, x, y, z, rx, ry, rz);
  const r = Math.min(sx, sy, sz) * 0.22;
  const m = new THREE.Mesh(new RoundedBoxGeometry(sx, sy, sz, 2, r), mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  p.add(m);
  return m;
}
// Cylinder along Z: radius `r` at the front (-Z), `r2` at the back.
export function cyl(p, mat, r, len, x, y, z, seg = 12, r2 = r) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r2, r, len, seg), mat);
  m.rotation.x = Math.PI / 2;
  m.position.set(x, y, z);
  p.add(m);
  return m;
}
// Upright cylinder (along Y).
export function cylY(p, mat, r, len, x, y, z, seg = 10) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), mat);
  m.position.set(x, y, z);
  p.add(m);
  return m;
}
// Cylinder across the gun (along X).
export function cylX(p, mat, r, len, x, y, z, seg = 10) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), mat);
  m.rotation.z = Math.PI / 2;
  m.position.set(x, y, z);
  p.add(m);
  return m;
}
// Open-ended tube along Z (you can look through it).
export function tube(p, mat, r, len, x, y, z, r2 = r, seg = 18) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r2, r, len, seg, 1, true), mat);
  m.rotation.x = Math.PI / 2;
  m.position.set(x, y, z);
  p.add(m);
  return m;
}
// Ring facing along Z.
export function ring(p, mat, r, t, x, y, z, seg = 20) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(r, t, 6, seg), mat);
  m.position.set(x, y, z);
  p.add(m);
  return m;
}
export function sphere(p, mat, r, x, y, z, ws = 10, hs = 8) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, ws, hs), mat);
  m.position.set(x, y, z);
  p.add(m);
  return m;
}
export function grp(p, name, x = 0, y = 0, z = 0) {
  const o = new THREE.Group();
  o.name = name;
  o.position.set(x, y, z);
  p.add(o);
  return o;
}
export const anchor = grp;

// ---------- Details ----------

// Picatinny rail along Z between z0 (rear) and z1 (front); `y` is the top surface.
export function rail(p, y, z0, z1, w = 0.028) {
  const len = z0 - z1;
  box(p, M.black, w, 0.01, len, 0, y - 0.007, (z0 + z1) / 2);
  const n = Math.max(1, Math.floor(len / 0.026));
  for (let i = 0; i < n; i++) box(p, M.black, w + 0.006, 0.006, 0.012, 0, y - 0.001, z0 - 0.013 - i * 0.026);
}
// Trigger guard + curved trigger just in front of the grip.
export function trigger(p, z = -0.035, y = 0.0, len = 0.07) {
  box(p, M.black, 0.012, 0.007, len, 0, y - 0.05, z);
  box(p, M.black, 0.012, 0.045, 0.007, 0, y - 0.028, z - len / 2, -0.15);
  box(p, M.steel, 0.006, 0.02, 0.006, 0, y - 0.018, z + 0.004, 0.15);
  box(p, M.steel, 0.006, 0.014, 0.006, 0, y - 0.034, z + 0.009, 0.55);
}
// Angled pistol grip with finger grooves and a beavertail.
export function grip(p, mat, x, y, z, h = 0.12, rake = -0.3) {
  const g = rbox(p, mat, 0.046, h, 0.062, x, y, z, rake);
  for (let i = 0; i < 3; i++) box(g, M.black, 0.048, 0.004, 0.008, 0, h / 2 - 0.035 - i * 0.025, -0.031);
  for (const s of [-1, 1]) box(g, M.black, 0.002, h * 0.55, 0.04, s * 0.0235, -0.005, 0.004); // stippling panels
  return g;
}
// Muzzle brake with side ports.
export function brake(p, r, y, z, len = 0.06) {
  cyl(p, M.black, r * 1.4, len, 0, y, z, 10);
  for (const s of [-1, 1]) box(p, M.dark, 0.006, r * 1.6, len * 0.22, s * r * 1.38, y, z - len * 0.15);
  for (const s of [-1, 1]) box(p, M.dark, 0.006, r * 1.6, len * 0.22, s * r * 1.38, y, z + len * 0.2);
  cyl(p, M.black, r * 0.75, 0.004, 0, y, z - len / 2 - 0.002, 8);
}
// Three-prong flash hider.
export function flashHider(p, r, y, z, len = 0.05) {
  cyl(p, M.black, r * 1.15, len * 0.4, 0, y, z + len * 0.3, 10);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 2;
    box(p, M.black, r * 0.6, r * 0.6, len * 0.65, Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.9, z - len * 0.17);
  }
}
// Suppressor can.
export function can(p, r, y, z, len = 0.16) {
  cyl(p, M.poly, r, len, 0, y, z, 14);
  cyl(p, M.gunmetal, r * 1.04, 0.012, 0, y, z + len / 2 - 0.006, 14);
  cyl(p, M.gunmetal, r * 1.04, 0.012, 0, y, z - len / 2 + 0.006, 14);
  cyl(p, M.black, r * 0.35, 0.004, 0, y, z - len / 2 - 0.001, 8);
}
// Iron sights: a front post with protective ears and a rear aperture ring, sight line at `y`.
export function irons(p, y, front, rear, base) {
  box(p, M.black, 0.016, y - base - 0.006, 0.012, 0, (y + base) / 2 - 0.007, front); // front base
  box(p, M.black, 0.004, 0.012, 0.004, 0, y - 0.006, front); // post (tip on the sight line)
  for (const s of [-1, 1]) box(p, M.black, 0.004, 0.018, 0.012, s * 0.012, y - 0.004, front); // ears
  box(p, M.black, 0.03, y - base - 0.012, 0.016, 0, (y + base) / 2 - 0.012, rear); // rear base
  ring(p, M.black, 0.0085, 0.003, 0, y, rear, 14); // aperture
  for (const s of [-1, 1]) box(p, M.black, 0.005, 0.02, 0.012, s * 0.016, y - 0.002, rear);
}
// Open reflex sight with a red dot centered on the sight line `y`.
export function redDot(p, y, z, base) {
  const w = 0.08, h = 0.062, t = 0.008, d = 0.034;
  box(p, M.black, 0.034, y - h / 2 - base, d + 0.016, 0, (base + y - h / 2) / 2, z); // mount
  box(p, M.black, w + t * 2, t, d, 0, y - h / 2 - t / 2, z);
  box(p, M.black, w + t * 2, t, d + 0.006, 0, y + h / 2 + t / 2, z - 0.003); // hood
  for (const s of [-1, 1]) box(p, M.black, t, h, d, s * (w / 2 + t / 2), y, z);
  const lens = new THREE.Mesh(new THREE.PlaneGeometry(w, h), M.glass);
  lens.position.set(0, y, z - d / 2 + 0.002);
  p.add(lens);
  sphere(p, M.dot, 0.0034, 0, y, z - d / 2, 8, 6);
  box(p, M.dark, 0.012, 0.016, 0.016, w / 2 + t + 0.006, y + 0.008, z); // brightness knob
}
// Holographic sight: boxy housing with a wide window and a ring-and-dot reticle.
export function holo(p, y, z, base) {
  const w = 0.07, h = 0.052, d = 0.05, t = 0.007;
  box(p, M.black, 0.044, y - h / 2 - base - t, 0.1, 0, (base + y - h / 2 - t) / 2, z + 0.02); // base / battery box
  box(p, M.dark, 0.036, 0.016, 0.03, 0, y - h / 2 - t - 0.004, z + 0.055);
  box(p, M.black, w + t * 2, t, d, 0, y - h / 2 - t / 2, z);
  box(p, M.black, w + t * 2, t, d, 0, y + h / 2 + t / 2, z);
  for (const s of [-1, 1]) box(p, M.black, t, h, d, s * (w / 2 + t / 2), y, z);
  const lens = new THREE.Mesh(new THREE.PlaneGeometry(w, h), M.glass);
  lens.position.set(0, y, z - d / 2 + 0.002);
  p.add(lens);
  ring(p, M.dot, 0.011, 0.0007, 0, y, z - d / 2 + 0.001, 24);
  sphere(p, M.dot, 0.0015, 0, y, z - d / 2 + 0.001, 6, 4);
  for (const s of [-1, 1]) box(p, M.dark, 0.008, 0.012, 0.012, s * 0.016, y + h / 2 + t + 0.004, z + 0.012); // buttons
}
// Tube-style micro red dot (open both ends).
export function microDot(p, y, z, base, r = 0.022) {
  const len = 0.05;
  box(p, M.black, 0.03, y - r - base, 0.04, 0, (base + y - r) / 2, z);
  tube(p, M.tube, r, len, 0, y, z);
  ring(p, M.black, r, 0.003, 0, y, z - len / 2, 18);
  ring(p, M.black, r, 0.003, 0, y, z + len / 2, 18);
  cylY(p, M.dark, 0.008, 0.012, 0, y + r + 0.004, z, 8);
  cylX(p, M.dark, 0.008, 0.012, r + 0.004, y, z, 8);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(r * 0.95, 18), M.glass);
  lens.position.set(0, y, z - len / 2 + 0.003);
  p.add(lens);
  sphere(p, M.dot, 0.0028, 0, y, z - len / 2 + 0.002, 6, 4);
}
// Magnified scope you can actually look through: open tube, lenses and a crosshair reticle.
// Centered on the sight line `y`; `base` is the rail height its rings stand on.
export function scope(p, y, z, len, r = 0.03, base = null) {
  const front = z - len / 2, back = z + len / 2;
  tube(p, M.tube, r * 0.72, len * 0.56, 0, y, z); // main tube
  tube(p, M.tube, r * 1.25, len * 0.24, 0, y, front + len * 0.12, r * 0.74); // objective bell
  tube(p, M.tube, r * 1.02, len * 0.18, 0, y, back - len * 0.09, r * 1.02); // ocular
  tube(p, M.tube, r * 0.74, len * 0.06, 0, y, back - len * 0.21, r * 1.02); // ocular taper
  ring(p, M.black, r * 1.25, 0.004, 0, y, front, 22);
  ring(p, M.black, r * 1.02, 0.005, 0, y, back, 22);
  ring(p, M.rubber, r * 1.02, 0.006, 0, y, back - 0.004, 22); // eyecup
  // Turrets
  cylY(p, M.dark, r * 0.42, r * 0.7, 0, y + r * 0.72 + r * 0.3, z - len * 0.02, 12);
  cylY(p, M.black, r * 0.46, r * 0.18, 0, y + r * 0.72 + r * 0.62, z - len * 0.02, 12);
  cylX(p, M.dark, r * 0.42, r * 0.7, r * 0.72 + r * 0.3, y, z - len * 0.02, 12);
  cylX(p, M.dark, r * 0.3, r * 0.5, -(r * 0.72 + r * 0.22), y, z + len * 0.05, 10); // parallax knob
  // Lenses and the reticle (thin cross with a center dot, just behind the objective)
  const lensF = new THREE.Mesh(new THREE.CircleGeometry(r * 1.2, 22), M.glass);
  lensF.position.set(0, y, front + 0.002);
  p.add(lensF);
  const rz = front + len * 0.25;
  const rr = r * 0.72;
  box(p, M.reticle, rr * 2, 0.0012, 0.0012, 0, y, rz);
  box(p, M.reticle, 0.0012, rr * 2, 0.0012, 0, y, rz);
  for (const s of [-1, 1]) { // thick outer posts
    box(p, M.reticle, rr * 0.6, 0.0035, 0.0012, s * rr * 0.7, y, rz);
    box(p, M.reticle, 0.0035, rr * 0.6, 0.0012, 0, y + s * rr * 0.7, rz);
  }
  sphere(p, M.dot, 0.0018, 0, y, rz, 6, 4);
  // Rings down to the rail
  if (base != null) {
    for (const dz of [-len * 0.22, len * 0.18]) {
      ring(p, M.black, r * 0.78, 0.006, 0, y, z + dz, 16);
      box(p, M.black, 0.032, y - r * 0.72 - base, 0.02, 0, (base + y - r * 0.72) / 2, z + dz);
      box(p, M.dark, 0.008, 0.01, 0.016, 0.02, base + 0.006, z + dz); // clamp nut
    }
  }
}
// Low-power variable optic with a wide field of view: the body flares toward the objective so
// the picture through it stays big when the gun is brought up close to the eye.
export function lpvo(p, y, z, len, rBack, rFront, base) {
  const front = z - len / 2, back = z + len / 2;
  tube(p, M.tube, rFront, len, 0, y, z, rBack, 24);
  ring(p, M.black, rFront, 0.005, 0, y, front, 24);
  ring(p, M.rubber, rBack, 0.006, 0, y, back, 24);
  ring(p, M.dark, (rFront + rBack) / 2 + 0.002, 0.004, 0, y, z + len * 0.2, 24); // power ring
  cylY(p, M.dark, rBack * 0.42, rBack * 0.6, 0, y + (rFront + rBack) / 2 + rBack * 0.25, z, 12);
  cylX(p, M.dark, rBack * 0.42, rBack * 0.6, (rFront + rBack) / 2 + rBack * 0.25, y, z, 12);
  const lensF = new THREE.Mesh(new THREE.CircleGeometry(rFront * 0.97, 24), M.glass);
  lensF.position.set(0, y, front + 0.002);
  p.add(lensF);
  // Reticle: fine cross, thick lower post and an illuminated center dot.
  const rz = front + 0.006, rr = rFront * 0.95;
  box(p, M.reticle, rr * 2, 0.001, 0.001, 0, y, rz);
  box(p, M.reticle, 0.001, rr, 0.001, 0, y + rr / 2, rz);
  box(p, M.reticle, 0.003, rr, 0.001, 0, y - rr / 2 - 0.004, rz);
  sphere(p, M.dot, 0.0016, 0, y, rz, 6, 4);
  if (base != null) {
    for (const dz of [-len * 0.25, len * 0.28]) {
      const r = rBack + (rFront - rBack) * (0.5 - dz / len);
      ring(p, M.black, r + 0.003, 0.005, 0, y, z + dz, 18);
      box(p, M.black, 0.03, Math.max(0.004, y - r - base), 0.018, 0, (base + y - r) / 2, z + dz);
    }
  }
}
// Rows of dark slots, e.g. handguard vents or M-LOK cuts on both sides.
export function vents(p, y, z0, n, gap, w, h = 0.018, l = 0.024) {
  for (let i = 0; i < n; i++) for (const s of [-1, 1]) box(p, M.black, 0.004, h, l, s * w, y, z0 - i * gap);
}
// Curved rifle magazine, built inside a 'mag' group (top at y=0).
export function rifleMag(mag, mat = M.black, w = 0.046, d = 0.07) {
  box(mag, mat, w, 0.1, d, 0, -0.045, 0, 0.1);
  box(mag, mat, w, 0.09, d, 0, -0.128, 0.017, 0.3);
  box(mag, M.dark, w + 0.004, 0.012, d + 0.006, 0, -0.172, 0.03, 0.3); // base plate
  for (const s of [-1, 1]) box(mag, M.dark, 0.002, 0.07, 0.02, s * (w / 2 + 0.001), -0.06, -0.015, 0.12); // ribs
}
// Sling swivel loop.
export function swivel(p, x, y, z) {
  const m = ring(p, M.steel, 0.009, 0.0022, x, y, z, 10);
  m.rotation.y = Math.PI / 2;
  return m;
}
