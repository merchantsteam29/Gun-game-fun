import * as THREE from 'three';
import {
  M, box, rbox, cyl, cylY, ring, sphere, grp, anchor, rail, trigger, grip, brake, flashHider, can, irons,
  redDot, holo, microDot, scope, lpvo, vents, rifleMag, swivel,
} from './modelkit.js';
import { cleanMods } from './mods.js';

// Gun models, built in two steps:
//  1. a builder makes the gun's body (no optic, muzzle device or underbarrel) and returns a
//     "spec" describing where attachments go: the top rail, iron-sight height, muzzle, the
//     underbarrel mount and so on;
//  2. finishGun() adds the attachments you picked (mods.js) — optic, suppressor/compensator,
//     extended or fast mag, grip or laser — and works out the sight height for aiming.
// Barrel points down -Z; origin is the right-hand grip. Named children drive animation:
// mag, bolt, pump, slide, cyl, lid, spin (groups) and fore, muzzle, port (anchors).

// Two-tone finishes per gun.
const F = {
  black: { body: M.dark, lower: M.black, furn: M.poly },
  tan: { body: M.dark, lower: M.dark, furn: M.fde },
  olive: { body: M.dark, lower: M.black, furn: M.olive },
  wood: { body: M.gunmetal, lower: M.dark, furn: M.woodDark },
  sand: { body: M.tan, lower: M.tan, furn: M.tan },
};

// ---------- Shared bodies ----------

// AR-pattern receiver: upper/lower, mag well, ejection port, forward assist, charging handle.
function arReceiver(g, f, len = 0.3, z = -0.05) {
  rbox(g, f.body, 0.066, 0.056, len, 0, 0.078, z);
  rbox(g, f.lower, 0.06, 0.05, len * 0.72, 0, 0.03, z + 0.02);
  box(g, f.lower, 0.062, 0.045, 0.085, 0, 0.005, -0.14); // mag well
  box(g, M.black, 0.064, 0.008, 0.09, 0, 0.03, -0.14); // flared lip
  box(g, M.steel, 0.003, 0.02, 0.06, 0.034, 0.08, -0.03); // ejection port
  box(g, M.black, 0.002, 0.012, 0.064, 0.034, 0.063, -0.03); // dust cover
  cyl(g, M.dark, 0.009, 0.026, 0.036, 0.085, 0.04, 8); // forward assist
  box(g, M.dark, 0.012, 0.018, 0.018, 0.036, 0.098, 0.012); // brass deflector
  box(g, M.black, 0.03, 0.012, 0.05, 0, 0.11, z + len / 2 - 0.02); // charging handle
  box(g, M.black, 0.05, 0.01, 0.012, 0, 0.11, z + len / 2 + 0.004);
  box(g, M.black, 0.01, 0.01, 0.014, -0.032, 0.03, -0.1); // mag release
  box(g, M.black, 0.006, 0.012, 0.02, -0.032, 0.055, 0.03); // selector
  for (const s of [-1, 1]) box(g, M.gunmetal, 0.002, 0.006, len * 0.5, s * 0.0335, 0.095, z); // receiver bevel lines
}
// Collapsible stock on a buffer tube.
function arStock(g, mat, z = 0.27) {
  cyl(g, M.black, 0.017, 0.14, 0, 0.068, z - 0.1);
  for (let i = 0; i < 5; i++) box(g, M.dark, 0.036, 0.004, 0.008, 0, 0.05, z - 0.15 + i * 0.022); // position notches
  rbox(g, mat, 0.056, 0.095, 0.17, 0, 0.05, z);
  box(g, mat, 0.05, 0.026, 0.12, 0, 0.104, z - 0.01);
  box(g, M.rubber, 0.06, 0.112, 0.02, 0, 0.046, z + 0.09);
  for (let i = 0; i < 3; i++) box(g, M.black, 0.058, 0.004, 0.006, 0, 0.0 + i * 0.03, z + 0.08);
  swivel(g, 0.03, 0.02, z - 0.04);
}
// Fixed rifle stock (wood or polymer).
function fixedStock(g, mat, z = 0.27, len = 0.3) {
  rbox(g, mat, 0.064, 0.105, len, 0, 0.03, z);
  box(g, mat, 0.056, 0.03, len * 0.6, 0, 0.088, z - 0.03); // comb
  box(g, M.rubber, 0.066, 0.118, 0.02, 0, 0.028, z + len / 2 + 0.01);
  swivel(g, 0.035, -0.005, z + 0.05);
}
// Free-float M-LOK handguard with a top rail.
function handguard(g, mat, y, z0, z1, w = 0.074) {
  const len = z0 - z1, zc = (z0 + z1) / 2;
  rbox(g, mat, w, w, len, 0, y, zc);
  const n = Math.floor(len / 0.06);
  for (let i = 0; i < n; i++) {
    for (const s of [-1, 1]) box(g, M.black, 0.004, 0.011, 0.032, s * (w / 2 + 0.001), y - 0.008, z0 - 0.04 - i * 0.06);
    box(g, M.black, 0.011, 0.004, 0.032, 0, y - w / 2 - 0.001, z0 - 0.04 - i * 0.06);
  }
  box(g, M.black, w + 0.004, w + 0.004, 0.01, 0, y, z1 - 0.004);
  rail(g, y + w / 2 + 0.006, z0, z1 + 0.01, 0.024);
}
// Barrel with a slight taper and a gas block.
function barrel(g, r, y, z0, z1, mat = M.gunmetal, gas = true) {
  const len = z0 - z1;
  cyl(g, mat, r, len, 0, y, (z0 + z1) / 2, 12, r * 1.12);
  if (gas) box(g, M.black, r * 2.4, r * 2.6, 0.022, 0, y + r * 0.3, z0 - 0.025);
}
// Iron sights folded flat (when an optic is fitted).
function foldedIrons(p, base, front, rear) {
  box(p, M.black, 0.016, 0.01, 0.03, 0, base + 0.005, front);
  box(p, M.black, 0.026, 0.01, 0.024, 0, base + 0.005, rear);
}
// Standard bolt / charging part on the right side (moves on reload).
function sideBolt(g, x, y, z, len = 0.045) {
  const b = grp(g, 'bolt', x, y, z);
  box(b, M.steel, 0.02, 0.016, len, 0, 0, 0);
  return b;
}

// ---------- Attachments ----------

// Adds the chosen attachments and sets userData.sight / adsZ / mount info.
export function finishGun(g, id, s, mods) {
  const m = cleanMods(id, mods) || { optic: 'irons', muzzle: 'none', mag: 'std', under: 'none' };
  // Optic (on the top rail; pistols carry it on the slide so it moves with it)
  const op = s.opticParent || g;
  const py = op === g ? 0 : op.position.y;
  let sight = s.ironY;
  if (m.optic === 'irons' || !s.rail) {
    if (s.irons) s.irons();
  } else {
    if (s.folded) s.folded();
    const [base, oz] = s.rail;
    const small = !!s.small;
    if (m.optic === 'reddot') {
      if (small) { microDot(op, base + 0.021, oz, base, 0.016); sight = py + base + 0.021; }
      else { redDot(op, base + 0.039, oz, base); sight = py + base + 0.039; }
    } else if (m.optic === 'holo') { holo(op, base + 0.041, oz, base); sight = py + base + 0.041; }
    else if (m.optic === 'lpvo') { lpvo(op, base + 0.05, oz - 0.01, 0.16, 0.028, 0.044, base); sight = py + base + 0.05; g.userData.adsZ = -0.13; }
    else if (m.optic === 'scope') {
      const big = s.bigScope;
      scope(op, base + (big ? 0.062 : 0.05), oz, big ? 0.44 : 0.38, big ? 0.036 : 0.032, base);
      sight = py + base + (big ? 0.062 : 0.05);
    }
  }
  g.userData.sight = sight;

  // Muzzle: device + where the flash comes out
  if (s.muzzle) {
    const [my, mz, mr] = s.muzzle;
    let tip = mz;
    if (m.muzzle === 'suppressor' && mr) { can(g, Math.max(0.016, mr * 1.9), my, mz - 0.085, 0.17); tip = mz - 0.17; }
    else if (m.muzzle === 'comp' && mr) { brake(g, mr * 1.05, my, mz - 0.03, 0.06); tip = mz - 0.06; }
    else if (s.device === 'flash') { flashHider(g, mr, my, mz - 0.025, 0.05); tip = mz - 0.05; }
    else if (s.device === 'brake') { brake(g, mr, my, mz - 0.03, 0.06); tip = mz - 0.06; }
    else if (s.device === 'bigbrake') {
      cyl(g, M.black, 0.045, 0.12, 0, my, mz - 0.06, 10);
      for (const sx of [-1, 1]) for (const dz of [-0.03, 0.025]) box(g, M.dark, 0.02, 0.07, 0.03, sx * 0.05, my, mz - 0.06 + dz);
      tip = mz - 0.12;
    }
    anchor(g, 'muzzle', 0, my, tip - 0.005);
  }

  // Magazine
  const mag = g.getObjectByName('mag');
  if (mag && s.magMods !== false) {
    if (m.mag === 'ext') mag.scale.set(1, 1.45, 1.06);
    if (m.mag === 'fast') {
      const bb = new THREE.Box3();
      g.updateMatrixWorld(true);
      bb.setFromObject(mag);
      const lo = mag.worldToLocal(new THREE.Vector3(0, bb.min.y, 0)).y;
      box(mag, M.orange, 0.03, 0.012, 0.03, 0, lo - 0.004, 0); // pull tab
      if (s.coupled) { // second mag taped alongside
        for (const c of [...mag.children]) { if (c.isMesh) { const k = c.clone(); k.position.x += 0.054; mag.add(k); } }
        for (const y of [-0.04, -0.1]) box(mag, M.tape, 0.11, 0.022, 0.074, 0.027, y, 0.006, 0.12);
      }
    }
  }
  if (m.mag === 'ext' && s.tube) { // tube-fed: magazine extension
    const [ty, tz, tr] = s.tube;
    cyl(g, M.dark, tr, 0.14, 0, ty, tz - 0.07, 10);
    box(g, M.black, tr * 2.6, 0.03, 0.02, 0, (ty + (s.muzzle ? s.muzzle[0] : ty)) / 2, tz - 0.12); // barrel clamp
  }

  // Underbarrel
  if (s.under && m.under !== 'none') {
    const [uy, uz, upar] = s.under;
    const p = upar || g;
    box(p, M.black, 0.026, 0.008, 0.07, 0, uy - 0.004, uz); // rail section
    if (m.under === 'grip') {
      rbox(p, M.poly, 0.032, 0.085, 0.038, 0, uy - 0.05, uz, 0.08);
      for (let i = 0; i < 3; i++) box(p, M.black, 0.034, 0.004, 0.04, 0, uy - 0.03 - i * 0.02, uz);
      const fore = g.getObjectByName('fore');
      if (fore && !upar) fore.position.set(0, uy - 0.06, uz);
    } else if (m.under === 'laser') {
      rbox(p, M.black, 0.03, 0.028, 0.06, 0, uy - 0.022, uz);
      sphere(p, M.dot, 0.005, 0, uy - 0.022, uz - 0.031, 6, 4);
      box(p, M.dark, 0.008, 0.008, 0.012, 0.016, uy - 0.016, uz + 0.01); // switch
    }
  }
}

// ---------- Guns ----------
// Each returns its spec: rail [baseY, opticZ], ironY, irons(), folded(), muzzle [y, z, r],
// device ('flash' | 'brake' | 'bigbrake' | none), under [y, z, parent?], tube [y, zEnd, r],
// coupled (rifle mags tape together), small (pistol-size optic), opticParent.

export const GUNS = {
  // ---------------- Rifles ----------------
  ar(g) {
    const f = F.black;
    arReceiver(g, f);
    rail(g, 0.112, 0.1, -0.19);
    handguard(g, f.furn, 0.07, -0.2, -0.5);
    barrel(g, 0.012, 0.065, -0.5, -0.72);
    const mag = grp(g, 'mag', 0, -0.02, -0.14);
    rifleMag(mag);
    grip(g, f.furn, 0, -0.05, 0.06);
    trigger(g, 0.0, 0.0);
    arStock(g, f.furn);
    sideBolt(g, 0.045, 0.07, 0.0);
    anchor(g, 'fore', 0, 0.0, -0.32);
    return {
      rail: [0.112, -0.04], ironY: 0.137, coupled: true,
      irons: () => irons(g, 0.137, -0.47, 0.06, 0.112), folded: () => foldedIrons(g, 0.112, -0.47, 0.06),
      muzzle: [0.065, -0.72, 0.013], device: 'flash', under: [0.033, -0.38],
    };
  },
  carbine(g) {
    const f = F.tan;
    arReceiver(g, f, 0.28, -0.04);
    rail(g, 0.112, 0.08, -0.18);
    handguard(g, f.furn, 0.07, -0.19, -0.4, 0.072);
    barrel(g, 0.012, 0.065, -0.4, -0.56);
    box(g, f.furn, 0.03, 0.026, 0.05, 0, 0.022, -0.36, 0.5); // hand stop
    const mag = grp(g, 'mag', 0, -0.02, -0.12);
    rifleMag(mag, M.fde);
    grip(g, f.furn, 0, -0.05, 0.06);
    trigger(g, 0.0, 0.0);
    arStock(g, f.furn, 0.25);
    sideBolt(g, 0.043, 0.07, 0.0);
    anchor(g, 'fore', 0, -0.01, -0.3);
    return {
      rail: [0.112, -0.03], ironY: 0.137, coupled: true,
      irons: () => irons(g, 0.137, -0.37, 0.06, 0.112), folded: () => foldedIrons(g, 0.112, -0.37, 0.06),
      muzzle: [0.065, -0.56, 0.013], device: 'brake', under: [0.034, -0.28],
    };
  },
  br(g) {
    const f = F.wood;
    rbox(g, f.body, 0.07, 0.06, 0.42, 0, 0.072, -0.07);
    rbox(g, f.furn, 0.074, 0.06, 0.34, 0, 0.03, -0.05);
    box(g, M.steel, 0.003, 0.024, 0.075, 0.036, 0.076, -0.04);
    rail(g, 0.112, 0.08, -0.14);
    rbox(g, f.furn, 0.078, 0.07, 0.3, 0, 0.045, -0.37);
    vents(g, 0.06, -0.27, 4, 0.06, 0.04, 0.012, 0.03);
    box(g, M.gunmetal, 0.04, 0.012, 0.26, 0, 0.087, -0.37);
    for (let i = 0; i < 6; i++) box(g, M.black, 0.03, 0.004, 0.012, 0, 0.094, -0.27 - i * 0.04);
    barrel(g, 0.014, 0.068, -0.52, -0.75, M.gunmetal, false);
    cyl(g, M.dark, 0.008, 0.2, 0, 0.042, -0.6, 8);
    box(g, M.dark, 0.026, 0.05, 0.02, 0, 0.055, -0.6);
    const mag = grp(g, 'mag', 0, -0.02, -0.15);
    box(mag, M.black, 0.052, 0.13, 0.08, 0, -0.06, 0, 0.08);
    box(mag, M.dark, 0.056, 0.012, 0.086, 0, -0.125, 0.006, 0.08);
    for (const s of [-1, 1]) box(mag, M.dark, 0.002, 0.09, 0.02, s * 0.027, -0.06, -0.02, 0.08);
    grip(g, f.furn, 0, -0.05, 0.06);
    trigger(g, 0.0, 0.0);
    fixedStock(g, f.furn, 0.27);
    const bolt = sideBolt(g, 0.046, 0.075, -0.02, 0.05);
    box(bolt, M.steel, 0.016, 0.012, 0.012, 0.014, 0, -0.02);
    anchor(g, 'fore', 0, 0.0, -0.36);
    return {
      rail: [0.112, -0.03], ironY: 0.13,
      irons: () => irons(g, 0.13, -0.68, 0.07, 0.1), folded: () => box(g, M.black, 0.012, 0.03, 0.012, 0, 0.1, -0.68),
      muzzle: [0.068, -0.75, 0.016], device: 'brake', under: [0.01, -0.4],
    };
  },
  burst(g) {
    rbox(g, M.olive, 0.08, 0.11, 0.62, 0, 0.04, -0.06);
    box(g, M.black, 0.082, 0.02, 0.4, 0, -0.01, -0.1);
    rbox(g, M.poly, 0.082, 0.04, 0.2, 0, -0.005, -0.3);
    vents(g, 0.04, -0.25, 4, 0.04, 0.041);
    box(g, M.rubber, 0.084, 0.12, 0.03, 0, 0.035, 0.24);
    barrel(g, 0.014, 0.06, -0.37, -0.57, M.gunmetal, false);
    box(g, M.dark, 0.032, 0.04, 0.32, 0, 0.13, -0.08); // carry handle
    for (const z of [-0.22, 0.06]) box(g, M.dark, 0.032, 0.05, 0.03, 0, 0.1, z);
    for (const s of [-1, 1]) box(g, M.olive, 0.004, 0.035, 0.26, s * 0.017, 0.13, -0.08);
    rail(g, 0.162, 0.06, -0.22, 0.026);
    grip(g, M.poly, 0, -0.07, -0.06, 0.12, -0.3);
    trigger(g, -0.12, -0.02);
    const mag = grp(g, 'mag', 0, -0.03, 0.12);
    rifleMag(mag, M.black, 0.046, 0.066);
    const bolt = grp(g, 'bolt', 0.05, 0.08, -0.15);
    box(bolt, M.steel, 0.02, 0.02, 0.05, 0, 0, 0);
    anchor(g, 'fore', 0, -0.03, -0.3);
    return {
      rail: [0.162, -0.08], ironY: 0.19, coupled: true,
      irons: () => irons(g, 0.19, -0.2, 0.05, 0.162), folded: () => foldedIrons(g, 0.162, -0.2, 0.05),
      muzzle: [0.06, -0.57, 0.016], device: 'brake', under: [-0.025, -0.3],
    };
  },
  laser(g) {
    rbox(g, M.white, 0.078, 0.1, 0.48, 0, 0.05, -0.08);
    box(g, M.black, 0.08, 0.02, 0.4, 0, 0.0, -0.08);
    for (const s of [-1, 1]) box(g, M.cyan, 0.004, 0.012, 0.34, s * 0.04, 0.06, -0.1);
    box(g, M.black, 0.082, 0.04, 0.06, 0, 0.06, 0.08);
    cyl(g, M.dark, 0.03, 0.16, 0, 0.06, -0.4, 14);
    cyl(g, M.cyan, 0.022, 0.03, 0, 0.06, -0.49, 14);
    for (let i = 0; i < 3; i++) cyl(g, M.black, 0.034, 0.012, 0, 0.06, -0.35 - i * 0.04, 14);
    ring(g, M.cyan, 0.026, 0.003, 0, 0.06, -0.505, 16);
    const mag = grp(g, 'mag', 0, -0.03, -0.08);
    rbox(mag, M.dark, 0.05, 0.08, 0.1, 0, -0.04, 0);
    box(mag, M.cyan, 0.052, 0.012, 0.06, 0, -0.03, 0);
    grip(g, M.white, 0, -0.05, 0.08);
    trigger(g, 0.02, 0.0);
    rbox(g, M.white, 0.06, 0.1, 0.18, 0, 0.04, 0.24);
    box(g, M.cyan, 0.062, 0.008, 0.12, 0, 0.04, 0.24);
    rail(g, 0.108, 0.04, -0.16, 0.024);
    anchor(g, 'fore', 0, -0.01, -0.3);
    return {
      rail: [0.108, -0.06], ironY: 0.13,
      irons: () => irons(g, 0.13, -0.3, 0.02, 0.1), folded: () => foldedIrons(g, 0.108, -0.3, 0.02),
      muzzle: [0.06, -0.5, 0], under: [0.0, -0.26],
    };
  },

  // ---------------- SMGs ----------------
  smg(g) {
    rbox(g, M.dark, 0.06, 0.08, 0.34, 0, 0.055, -0.08);
    box(g, M.black, 0.062, 0.016, 0.3, 0, 0.012, -0.08);
    box(g, M.black, 0.04, 0.012, 0.12, 0, 0.1, -0.12); // claw mount (optic base)
    box(g, M.steel, 0.003, 0.02, 0.05, 0.031, 0.06, -0.03);
    cyl(g, M.black, 0.008, 0.16, -0.032, 0.085, -0.12, 8);
    rbox(g, M.poly, 0.066, 0.06, 0.15, 0, 0.03, -0.25);
    for (let i = 0; i < 4; i++) box(g, M.black, 0.068, 0.006, 0.01, 0, 0.012, -0.2 - i * 0.03);
    barrel(g, 0.011, 0.06, -0.325, -0.36, M.gunmetal, false);
    const mag = grp(g, 'mag', 0, 0.0, -0.1);
    box(mag, M.black, 0.04, 0.12, 0.05, 0, -0.06, 0, 0.12);
    box(mag, M.black, 0.04, 0.1, 0.05, 0, -0.16, 0.02, 0.3);
    box(mag, M.dark, 0.044, 0.012, 0.054, 0, -0.208, 0.034, 0.3);
    grip(g, M.poly, 0, -0.055, 0.06, 0.12, -0.25);
    trigger(g, 0.0, 0.01, 0.06);
    for (const s of [-1, 1]) box(g, M.mid, 0.01, 0.014, 0.2, s * 0.026, 0.07, 0.15);
    rbox(g, M.rubber, 0.06, 0.09, 0.026, 0, 0.045, 0.26);
    const bolt = grp(g, 'bolt', -0.04, 0.085, -0.05);
    box(bolt, M.steel, 0.02, 0.014, 0.03, 0, 0, 0);
    box(bolt, M.black, 0.024, 0.01, 0.01, -0.014, 0, 0.012);
    anchor(g, 'fore', 0, -0.03, -0.24);
    return {
      rail: [0.106, -0.12], ironY: 0.128, coupled: true,
      irons: () => irons(g, 0.128, -0.22, 0.04, 0.1), folded: () => foldedIrons(g, 0.106, -0.22, 0.03),
      muzzle: [0.06, -0.36, 0.011], device: 'flash', under: [0.0, -0.27],
    };
  },
  pdw(g) {
    rbox(g, M.poly, 0.07, 0.1, 0.38, 0, 0.035, -0.05);
    rbox(g, M.olive, 0.072, 0.03, 0.12, 0, -0.02, -0.2);
    box(g, M.black, 0.074, 0.06, 0.04, 0, -0.04, 0.03);
    const mag = grp(g, 'mag', 0, 0.096, -0.08);
    box(mag, M.glass, 0.05, 0.026, 0.28, 0, 0, 0);
    box(mag, M.brass, 0.028, 0.012, 0.25, 0, -0.002, 0);
    box(mag, M.black, 0.052, 0.008, 0.03, 0, 0.0, 0.14);
    for (const s of [-1, 1]) box(g, M.black, 0.008, 0.03, 0.1, s * 0.022, 0.12, -0.04); // optic posts
    box(g, M.black, 0.052, 0.008, 0.1, 0, 0.136, -0.04);
    barrel(g, 0.012, 0.055, -0.24, -0.3, M.black, false);
    grip(g, M.poly, 0, -0.06, -0.02, 0.11, -0.15);
    trigger(g, -0.08, -0.015, 0.06);
    rbox(g, M.poly, 0.06, 0.085, 0.04, 0, -0.04, -0.2);
    box(g, M.rubber, 0.072, 0.12, 0.02, 0, 0.03, 0.14);
    const bolt = grp(g, 'bolt', 0.04, 0.05, 0.04);
    box(bolt, M.steel, 0.018, 0.016, 0.04, 0, 0, 0);
    anchor(g, 'fore', 0, -0.08, -0.2);
    return {
      rail: [0.14, -0.04], ironY: 0.155,
      irons: () => { ring(g, M.black, 0.008, 0.003, 0, 0.155, 0.0, 12); box(g, M.black, 0.004, 0.015, 0.004, 0, 0.148, -0.08); },
      muzzle: [0.055, -0.3, 0.013], device: 'flash', under: [-0.085, -0.25], magMods: true,
    };
  },
  vector(g) {
    rbox(g, M.black, 0.062, 0.07, 0.3, 0, 0.07, -0.06);
    rbox(g, M.mid, 0.064, 0.15, 0.13, 0, -0.005, -0.12, -0.12);
    box(g, M.black, 0.066, 0.01, 0.12, 0, -0.08, -0.13, -0.12);
    box(g, M.black, 0.066, 0.06, 0.14, 0, 0.05, -0.25);
    vents(g, 0.05, -0.2, 3, 0.04, 0.034, 0.02, 0.02);
    barrel(g, 0.012, 0.06, -0.32, -0.38, M.gunmetal, false);
    rail(g, 0.108, 0.06, -0.18, 0.024);
    const mag = grp(g, 'mag', 0, -0.06, -0.04);
    box(mag, M.black, 0.038, 0.17, 0.05, 0, -0.085, 0);
    box(mag, M.dark, 0.042, 0.012, 0.054, 0, -0.17, 0);
    grip(g, M.poly, 0, -0.06, 0.06, 0.11, -0.15);
    trigger(g, 0.0, 0.0, 0.055);
    box(g, M.dark, 0.012, 0.012, 0.18, 0, 0.06, 0.15);
    box(g, M.dark, 0.012, 0.012, 0.16, 0, 0.0, 0.16, -0.32);
    rbox(g, M.rubber, 0.05, 0.09, 0.03, 0, 0.03, 0.25);
    const bolt = grp(g, 'bolt', 0.035, 0.08, -0.02);
    box(bolt, M.steel, 0.018, 0.016, 0.04, 0, 0, 0);
    anchor(g, 'fore', 0, -0.06, -0.2);
    return {
      rail: [0.108, -0.06], ironY: 0.13,
      irons: () => irons(g, 0.13, -0.17, 0.05, 0.108), folded: () => foldedIrons(g, 0.108, -0.17, 0.05),
      muzzle: [0.06, -0.38, 0.012], under: [0.02, -0.27],
    };
  },

  // ---------------- Heavy ----------------
  lmg(g) {
    rbox(g, M.dark, 0.1, 0.12, 0.42, 0, 0.05, -0.05);
    box(g, M.steel, 0.003, 0.03, 0.08, 0.051, 0.055, -0.04);
    box(g, M.black, 0.102, 0.02, 0.38, 0, -0.005, -0.05);
    barrel(g, 0.02, 0.06, -0.26, -0.75, M.gunmetal, false);
    cyl(g, M.mid, 0.034, 0.22, 0, 0.06, -0.34, 12);
    vents(g, 0.06, -0.26, 5, 0.04, 0.034, 0.012, 0.022);
    box(g, M.black, 0.02, 0.05, 0.02, 0, 0.105, -0.38);
    box(g, M.black, 0.02, 0.02, 0.16, 0, 0.13, -0.38);
    grip(g, M.poly, 0, -0.06, 0.08);
    trigger(g, 0.02, 0.0);
    fixedStock(g, M.poly, 0.28, 0.24);
    const lid = grp(g, 'lid', 0, 0.11, 0.1);
    rbox(lid, M.mid, 0.1, 0.024, 0.22, 0, 0, -0.11);
    box(lid, M.dark, 0.02, 0.03, 0.05, 0, 0.026, -0.18);
    rail(lid, 0.022, -0.02, -0.14, 0.024);
    const mag = grp(g, 'mag', 0.0, -0.03, -0.08);
    rbox(mag, M.olive, 0.13, 0.14, 0.14, 0.03, -0.08, 0);
    box(mag, M.tan, 0.132, 0.02, 0.142, 0.03, -0.04, 0);
    box(mag, M.black, 0.03, 0.03, 0.05, 0.1, -0.06, 0);
    for (let i = 0; i < 6; i++) cyl(mag, M.brass, 0.006, 0.03, 0.01 + i * 0.012, 0.012, 0.0, 6).rotation.set(0, 0, 0);
    for (const s of [-1, 1]) {
      box(g, M.dark, 0.012, 0.012, 0.26, s * 0.03, 0.0, -0.53);
      box(g, M.rubber, 0.018, 0.018, 0.02, s * 0.03, 0.0, -0.67);
    }
    const bolt = grp(g, 'bolt', 0.06, 0.06, -0.08);
    box(bolt, M.steel, 0.03, 0.025, 0.04, 0, 0, 0);
    anchor(g, 'fore', 0, 0.0, -0.36);
    return {
      rail: [0.022, -0.08], opticParent: lid, ironY: 0.17,
      irons: () => irons(g, 0.17, -0.7, 0.03, 0.08),
      muzzle: [0.06, -0.75, 0.021], device: 'flash', under: [0.026, -0.42],
    };
  },
  minigun(g) {
    rbox(g, M.dark, 0.14, 0.14, 0.3, 0, 0.0, -0.05);
    cyl(g, M.mid, 0.06, 0.08, 0, 0.0, -0.22, 14);
    box(g, M.black, 0.15, 0.02, 0.2, 0, 0.0, -0.05);
    for (const s of [-1, 1]) box(g, M.black, 0.004, 0.08, 0.2, s * 0.071, 0.0, -0.05);
    const spin = grp(g, 'spin', 0, 0.0, -0.42);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      cyl(spin, M.gunmetal, 0.013, 0.55, Math.cos(a) * 0.04, Math.sin(a) * 0.04, 0, 8);
      cyl(spin, M.black, 0.009, 0.004, Math.cos(a) * 0.04, Math.sin(a) * 0.04, -0.277, 6);
    }
    for (const z of [-0.22, 0.0, 0.18]) cyl(spin, M.mid, 0.058, 0.03, 0, 0, z, 12);
    cyl(spin, M.black, 0.012, 0.56, 0, 0, 0, 6);
    const mag = grp(g, 'mag', 0.0, -0.08, 0.0);
    rbox(mag, M.olive, 0.16, 0.14, 0.18, 0.05, -0.05, 0);
    box(mag, M.tan, 0.162, 0.02, 0.182, 0.05, -0.0, 0);
    box(mag, M.black, 0.02, 0.05, 0.12, 0.135, -0.05, 0);
    for (let i = 0; i < 5; i++) cyl(g, M.brass, 0.008, 0.04, 0.09 - i * 0.012, -0.03 + i * 0.014, 0.02, 6).rotation.set(0, 0, Math.PI / 2);
    grip(g, M.poly, 0, -0.09, 0.08, 0.12, -0.2);
    trigger(g, 0.04, -0.04);
    box(g, M.dark, 0.03, 0.08, 0.15, 0, 0.11, -0.05);
    box(g, M.black, 0.034, 0.03, 0.12, 0, 0.16, -0.08);
    box(g, M.rubber, 0.04, 0.034, 0.08, 0, 0.162, -0.08);
    anchor(g, 'fore', -0.02, 0.12, -0.1);
    return { ironY: 0.17, muzzle: [0.0, -0.7, 0] };
  },

  // ---------------- Marksman & snipers ----------------
  dmr(g) {
    arReceiver(g, F.sand, 0.36, -0.08);
    rail(g, 0.112, 0.1, -0.24);
    handguard(g, M.tan, 0.068, -0.26, -0.5, 0.076);
    barrel(g, 0.014, 0.065, -0.5, -0.74, M.gunmetal, false);
    const mag = grp(g, 'mag', 0, -0.02, -0.12);
    box(mag, M.black, 0.05, 0.12, 0.08, 0, -0.05, 0, 0.12);
    box(mag, M.dark, 0.054, 0.012, 0.084, 0, -0.112, 0.008, 0.12);
    grip(g, M.poly, 0, -0.05, 0.06);
    trigger(g, 0.0, 0.0);
    rbox(g, M.tan, 0.058, 0.11, 0.24, 0, 0.03, 0.24);
    box(g, M.tan, 0.05, 0.03, 0.16, 0, 0.096, 0.22);
    box(g, M.rubber, 0.062, 0.12, 0.02, 0, 0.03, 0.37);
    sideBolt(g, 0.045, 0.07, -0.02, 0.05);
    anchor(g, 'fore', 0, -0.01, -0.36);
    return {
      rail: [0.112, -0.05], ironY: 0.137,
      irons: () => irons(g, 0.137, -0.47, 0.06, 0.112), folded: () => foldedIrons(g, 0.112, -0.47, 0.06),
      muzzle: [0.065, -0.74, 0.016], device: 'brake', under: [0.03, -0.42],
    };
  },
  sniper(g) {
    rbox(g, M.gunmetal, 0.066, 0.075, 0.3, 0, 0.06, -0.04);
    barrel(g, 0.016, 0.065, -0.2, -0.81, M.gunmetal, false);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      box(g, M.black, 0.004, 0.004, 0.3, Math.cos(a) * 0.017, 0.065 + Math.sin(a) * 0.017, -0.5);
    }
    rbox(g, M.olive, 0.075, 0.075, 0.36, 0, 0.022, -0.33);
    vents(g, 0.022, -0.22, 5, 0.045, 0.038);
    rbox(g, M.olive, 0.07, 0.12, 0.32, 0, 0.004, 0.25);
    box(g, M.olive, 0.05, 0.035, 0.12, 0, 0.083, 0.24);
    box(g, M.rubber, 0.072, 0.13, 0.025, 0, 0.004, 0.41);
    box(g, M.dark, 0.02, 0.05, 0.03, 0, -0.07, 0.3);
    grip(g, M.olive, 0, -0.06, 0.06);
    trigger(g, 0.0, -0.005);
    rail(g, 0.105, 0.08, -0.2);
    const mag = grp(g, 'mag', 0, 0.0, -0.08);
    box(mag, M.black, 0.045, 0.08, 0.08, 0, -0.03, 0);
    box(mag, M.dark, 0.048, 0.01, 0.084, 0, -0.07, 0);
    const bolt = grp(g, 'bolt', 0.035, 0.08, 0.05);
    box(bolt, M.steel, 0.07, 0.014, 0.014, 0.035, 0, 0);
    sphere(bolt, M.black, 0.017, 0.07, 0, 0);
    for (const s of [-1, 1]) box(g, M.dark, 0.012, 0.012, 0.24, s * 0.028, -0.025, -0.54);
    swivel(g, 0.0, -0.025, -0.45);
    anchor(g, 'fore', 0, -0.02, -0.36);
    return { rail: [0.105, -0.06], ironY: 0.155, muzzle: [0.065, -0.81, 0.018], device: 'brake' };
  },
  amr(g) {
    rbox(g, M.dark, 0.085, 0.1, 0.4, 0, 0.05, -0.04);
    barrel(g, 0.022, 0.068, -0.24, -0.94, M.gunmetal, false);
    for (let i = 0; i < 6; i++) box(g, M.black, 0.058, 0.006, 0.03, 0, 0.096, -0.32 - i * 0.07);
    rbox(g, M.olive, 0.09, 0.08, 0.34, 0, 0.02, -0.36);
    rbox(g, M.olive, 0.08, 0.14, 0.34, 0, -0.005, 0.26);
    box(g, M.olive, 0.06, 0.04, 0.14, 0, 0.09, 0.24);
    box(g, M.rubber, 0.082, 0.15, 0.03, 0, -0.005, 0.44);
    grip(g, M.olive, 0, -0.065, 0.06, 0.13);
    trigger(g, 0.0, -0.01);
    rail(g, 0.108, 0.1, -0.26, 0.03);
    const mag = grp(g, 'mag', 0, 0.0, -0.12);
    box(mag, M.black, 0.055, 0.12, 0.1, 0, -0.05, 0);
    box(mag, M.dark, 0.06, 0.012, 0.104, 0, -0.112, 0);
    const bolt = grp(g, 'bolt', 0.045, 0.08, 0.06);
    box(bolt, M.steel, 0.08, 0.016, 0.016, 0.04, 0, 0);
    sphere(bolt, M.black, 0.02, 0.08, 0, 0);
    for (const s of [-1, 1]) {
      box(g, M.dark, 0.014, 0.014, 0.3, s * 0.035, -0.03, -0.66);
      box(g, M.rubber, 0.022, 0.022, 0.024, s * 0.035, -0.03, -0.82);
    }
    anchor(g, 'fore', 0, -0.02, -0.38);
    return { rail: [0.108, -0.08], ironY: 0.17, bigScope: true, muzzle: [0.068, -0.94, 0.026], device: 'bigbrake' };
  },
  railgun(g) {
    rbox(g, M.black, 0.08, 0.1, 0.42, 0, 0.05, -0.05);
    for (const s of [-1, 1]) {
      box(g, M.gunmetal, 0.014, 0.04, 0.56, s * 0.026, 0.07, -0.5);
      box(g, M.glow, 0.002, 0.006, 0.5, s * 0.034, 0.08, -0.5);
    }
    for (let i = 0; i < 6; i++) ring(g, M.glow, 0.045, 0.008, 0, 0.07, -0.3 - i * 0.07, 16);
    box(g, M.glow, 0.004, 0.01, 0.5, 0, 0.07, -0.5);
    rbox(g, M.mid, 0.07, 0.07, 0.2, 0, -0.02, -0.2);
    const mag = grp(g, 'mag', 0, -0.03, -0.12);
    rbox(mag, M.dark, 0.06, 0.1, 0.07, 0, -0.04, 0);
    box(mag, M.glow, 0.062, 0.01, 0.02, 0, -0.02, -0.02);
    grip(g, M.poly, 0, -0.06, 0.07);
    trigger(g, 0.01, -0.005);
    rbox(g, M.black, 0.066, 0.12, 0.26, 0, 0.03, 0.27);
    for (let i = 0; i < 3; i++) box(g, M.glow, 0.068, 0.008, 0.02, 0, 0.05, 0.2 + i * 0.05);
    rail(g, 0.1, 0.08, -0.14, 0.026);
    anchor(g, 'fore', 0, -0.02, -0.24);
    return {
      rail: [0.1, -0.04], ironY: 0.13,
      irons: () => irons(g, 0.13, -0.2, 0.05, 0.1), folded: () => foldedIrons(g, 0.1, -0.2, 0.05),
      muzzle: [0.07, -0.79, 0], under: [-0.055, -0.22],
    };
  },

  // ---------------- Shotguns ----------------
  shotgun(g) {
    rbox(g, M.dark, 0.075, 0.085, 0.4, 0, 0.05, -0.08);
    box(g, M.steel, 0.003, 0.035, 0.09, 0.039, 0.055, -0.06);
    box(g, M.black, 0.04, 0.008, 0.36, 0, 0.096, -0.1);
    barrel(g, 0.021, 0.075, -0.25, -0.75, M.gunmetal, false);
    cyl(g, M.dark, 0.019, 0.42, 0, 0.03, -0.46);
    box(g, M.black, 0.026, 0.07, 0.026, 0, 0.052, -0.7);
    rail(g, 0.104, 0.06, -0.16, 0.026);
    const pump = grp(g, 'pump', 0, 0.02, -0.4);
    rbox(pump, M.wood, 0.076, 0.07, 0.18, 0, 0, 0);
    for (let i = 0; i < 6; i++) box(pump, M.woodDark, 0.078, 0.006, 0.01, 0, -0.012, -0.07 + i * 0.028);
    anchor(pump, 'fore', 0, -0.03, 0);
    grip(g, M.wood, 0, -0.05, 0.08);
    trigger(g, 0.01, 0.0);
    rbox(g, M.wood, 0.066, 0.11, 0.26, 0, 0.02, 0.26);
    box(g, M.rubber, 0.068, 0.12, 0.02, 0, 0.018, 0.39);
    swivel(g, 0.0, -0.035, 0.32);
    for (let i = 0; i < 4; i++) cyl(g, M.red, 0.009, 0.05, 0.044, 0.02, -0.02 - i * 0.022, 8).rotation.set(0, 0, 0);
    box(g, M.black, 0.004, 0.03, 0.1, 0.04, 0.02, -0.053);
    anchor(g, 'port', 0.05, 0.03, -0.1);
    return {
      rail: [0.104, -0.05], ironY: 0.12,
      irons: () => { box(g, M.steel, 0.012, 0.018, 0.012, 0, 0.11, -0.72); sphere(g, M.glow, 0.005, 0, 0.12, -0.72, 6, 4); },
      muzzle: [0.075, -0.75, 0.023], tube: [0.03, -0.67, 0.019], under: [-0.015, 0, pump],
    };
  },
  autoshot(g) {
    rbox(g, M.dark, 0.08, 0.1, 0.38, 0, 0.05, -0.06);
    rail(g, 0.11, 0.06, -0.18, 0.026);
    barrel(g, 0.022, 0.07, -0.25, -0.59, M.gunmetal, false);
    for (let i = 0; i < 5; i++) box(g, M.black, 0.056, 0.008, 0.03, 0, 0.098, -0.3 - i * 0.05);
    box(g, M.dark, 0.06, 0.006, 0.26, 0, 0.094, -0.4);
    rbox(g, M.poly, 0.08, 0.06, 0.2, 0, 0.02, -0.32);
    vents(g, 0.02, -0.25, 4, 0.045, 0.041, 0.012, 0.03);
    const mag = grp(g, 'mag', 0, -0.02, -0.12);
    cyl(mag, M.black, 0.08, 0.07, 0, -0.08, 0, 16).rotation.set(0, 0, Math.PI / 2);
    for (const s of [-1, 1]) ring(mag, M.dark, 0.06, 0.004, s * 0.036, -0.08, 0, 16).rotation.set(0, Math.PI / 2, 0);
    box(mag, M.dark, 0.05, 0.05, 0.06, 0, -0.01, 0);
    grip(g, M.poly, 0, -0.05, 0.07);
    trigger(g, 0.01, 0.0);
    rbox(g, M.poly, 0.066, 0.11, 0.24, 0, 0.025, 0.26);
    box(g, M.rubber, 0.068, 0.12, 0.02, 0, 0.022, 0.38);
    sideBolt(g, 0.045, 0.07, -0.02, 0.05);
    anchor(g, 'fore', 0, -0.01, -0.32);
    return {
      rail: [0.11, -0.05], ironY: 0.13,
      irons: () => irons(g, 0.13, -0.2, 0.04, 0.11), folded: () => foldedIrons(g, 0.11, -0.2, 0.04),
      muzzle: [0.07, -0.59, 0.023], device: 'brake', under: [-0.01, -0.36],
    };
  },
  slug(g) {
    rbox(g, M.olive, 0.078, 0.088, 0.38, 0, 0.05, -0.08);
    box(g, M.steel, 0.003, 0.035, 0.09, 0.04, 0.055, -0.06);
    rail(g, 0.1, 0.06, -0.16, 0.026);
    barrel(g, 0.023, 0.075, -0.25, -0.71, M.gunmetal, false);
    cyl(g, M.dark, 0.019, 0.38, 0, 0.03, -0.44);
    const pump = grp(g, 'pump', 0, 0.02, -0.38);
    rbox(pump, M.poly, 0.078, 0.07, 0.17, 0, 0, 0);
    for (let i = 0; i < 4; i++) box(pump, M.black, 0.08, 0.006, 0.01, 0, -0.012, -0.05 + i * 0.033);
    anchor(pump, 'fore', 0, -0.03, 0);
    grip(g, M.poly, 0, -0.05, 0.08);
    trigger(g, 0.01, 0.0);
    rbox(g, M.olive, 0.064, 0.11, 0.24, 0, 0.02, 0.25);
    box(g, M.rubber, 0.066, 0.12, 0.02, 0, 0.018, 0.37);
    box(g, M.black, 0.004, 0.034, 0.1, 0.041, 0.02, -0.053);
    for (let i = 0; i < 4; i++) cyl(g, M.brass, 0.009, 0.05, 0.044, 0.02, -0.02 - i * 0.022, 8).rotation.set(0, 0, 0);
    anchor(g, 'port', 0.05, 0.03, -0.1);
    return {
      rail: [0.1, -0.05], ironY: 0.13,
      irons: () => irons(g, 0.13, -0.66, 0.0, 0.1), folded: () => box(g, M.black, 0.014, 0.04, 0.012, 0, 0.1, -0.66),
      muzzle: [0.075, -0.71, 0.024], device: 'brake', tube: [0.03, -0.63, 0.019], under: [-0.015, 0, pump],
    };
  },
  doublebarrel(g) {
    cyl(g, M.gunmetal, 0.021, 0.55, -0.022, 0.06, -0.42, 12);
    cyl(g, M.gunmetal, 0.021, 0.55, 0.022, 0.06, -0.42, 12);
    for (const s of [-1, 1]) cyl(g, M.black, 0.016, 0.004, s * 0.022, 0.06, -0.697, 10);
    box(g, M.dark, 0.016, 0.01, 0.55, 0, 0.083, -0.42);
    rbox(g, M.steel, 0.08, 0.07, 0.14, 0, 0.04, -0.08);
    for (const s of [-1, 1]) box(g, M.gunmetal, 0.002, 0.04, 0.08, s * 0.041, 0.04, -0.08);
    box(g, M.gunmetal, 0.082, 0.04, 0.06, 0, 0.03, -0.06);
    rbox(g, M.wood, 0.07, 0.06, 0.2, 0, 0.02, -0.3);
    for (let i = 0; i < 5; i++) box(g, M.woodDark, 0.072, 0.004, 0.012, 0, 0.0, -0.24 - i * 0.025);
    trigger(g, -0.0, 0.0, 0.06);
    grip(g, M.wood, 0, -0.05, 0.03, 0.12, -0.3);
    rbox(g, M.wood, 0.066, 0.11, 0.28, 0, 0.0, 0.2);
    box(g, M.rubber, 0.068, 0.12, 0.02, 0, -0.002, 0.34);
    for (const s of [-1, 1]) box(g, M.steel, 0.012, 0.02, 0.025, s * 0.012, 0.085, -0.04, 0.5);
    box(g, M.black, 0.02, 0.006, 0.12, 0, 0.091, -0.2); // short rail on the rib
    anchor(g, 'fore', 0, -0.02, -0.3);
    anchor(g, 'port', 0, 0.06, -0.14);
    return {
      rail: [0.094, -0.2], ironY: 0.1,
      irons: () => sphere(g, M.brass, 0.005, 0, 0.093, -0.68, 6, 4),
      muzzle: [0.06, -0.7, 0], under: [-0.01, -0.36],
    };
  },

  // ---------------- Launchers & bows ----------------
  gl(g) {
    cyl(g, M.olive, 0.062, 0.5, 0, 0.07, -0.33, 16);
    cyl(g, M.black, 0.07, 0.03, 0, 0.07, -0.58, 16);
    for (let i = 0; i < 3; i++) cyl(g, M.black, 0.065, 0.012, 0, 0.07, -0.2 - i * 0.1, 16);
    const drum = grp(g, 'cyl', 0, 0.0, -0.04);
    cyl(drum, M.dark, 0.11, 0.17, 0, 0, 0, 12);
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
    box(g, M.rubber, 0.062, 0.11, 0.02, 0, 0.03, 0.36);
    box(g, M.black, 0.028, 0.008, 0.1, 0, 0.136, -0.32); // optic rail on the tube
    rbox(g, M.poly, 0.05, 0.1, 0.06, 0, -0.03, -0.38);
    anchor(g, 'fore', 0, -0.07, -0.38);
    return {
      rail: [0.14, -0.32], ironY: 0.2,
      irons: () => {
        box(g, M.dark, 0.04, 0.05, 0.08, 0, 0.14, -0.15);
        for (const s of [-1, 1]) box(g, M.black, 0.006, 0.05, 0.006, s * 0.016, 0.19, -0.15);
        box(g, M.black, 0.04, 0.006, 0.006, 0, 0.2, -0.15);
        box(g, M.black, 0.004, 0.012, 0.004, 0, 0.194, -0.15);
      },
      muzzle: [0.07, -0.6, 0], under: [0.008, -0.5],
    };
  },
  rocket(g) {
    cyl(g, M.olive, 0.075, 0.9, 0, 0.09, -0.2, 18);
    for (const z of [-0.45, 0.05]) cyl(g, M.tape, 0.077, 0.04, 0, 0.09, z, 18);
    cyl(g, M.dark, 0.088, 0.08, 0, 0.09, -0.64, 18, 0.082);
    cyl(g, M.dark, 0.088, 0.1, 0, 0.09, 0.25, 18, 0.095);
    ring(g, M.black, 0.085, 0.006, 0, 0.09, -0.68, 18);
    const mag = grp(g, 'mag', 0, 0.09, -0.7);
    const war = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 14), M.olive);
    war.rotation.x = -Math.PI / 2;
    mag.add(war);
    cyl(mag, M.black, 0.061, 0.03, 0, 0, 0.09, 14);
    grip(g, M.poly, 0, -0.05, 0.0, 0.13);
    trigger(g, -0.06, 0.0);
    rbox(g, M.poly, 0.05, 0.12, 0.06, 0, -0.03, -0.3);
    rbox(g, M.dark, 0.06, 0.08, 0.12, 0.1, 0.14, -0.15);
    cyl(g, M.lens, 0.022, 0.004, 0.1, 0.15, -0.212, 12);
    box(g, M.black, 0.03, 0.03, 0.04, 0.07, 0.12, -0.15);
    box(g, M.orange, 0.03, 0.01, 0.14, 0, 0.167, -0.3); // optic rail on the tube
    anchor(g, 'fore', 0, -0.05, -0.3);
    return {
      rail: [0.172, -0.3], ironY: 0.19,
      irons: () => irons(g, 0.19, -0.42, -0.05, 0.165),
      muzzle: [0.09, -0.75, 0], under: [0.015, -0.48], magMods: false,
    };
  },
  crossbow(g) {
    rbox(g, M.wood, 0.06, 0.07, 0.6, 0, 0.03, -0.12);
    box(g, M.black, 0.03, 0.012, 0.5, 0, 0.068, -0.2);
    for (const s of [-1, 1]) {
      box(g, M.dark, 0.18, 0.026, 0.04, s * 0.11, 0.05, -0.38, 0, s * 0.18);
      box(g, M.dark, 0.08, 0.024, 0.035, s * 0.23, 0.05, -0.35, 0, -s * 0.35);
      cylY(g, M.black, 0.012, 0.03, s * 0.27, 0.05, -0.33, 8);
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
    box(g, M.rubber, 0.062, 0.11, 0.02, 0, 0.0, 0.375);
    rail(g, 0.1, 0.06, -0.06, 0.024);
    anchor(g, 'fore', 0, -0.02, -0.3);
    return {
      rail: [0.1, 0.0], ironY: 0.12,
      irons: () => irons(g, 0.12, -0.06, 0.04, 0.1),
      muzzle: [0.075, -0.48, 0], under: [-0.005, -0.32], magMods: false,
    };
  },
  harpoon(g) {
    cyl(g, M.dark, 0.03, 0.62, 0, 0.05, -0.2, 14);
    cyl(g, M.black, 0.036, 0.05, 0, 0.05, -0.52, 14);
    for (const s of [-1, 1]) box(g, M.orange, 0.012, 0.012, 0.26, s * 0.035, 0.07, -0.38, 0, s * 0.08, 0);
    const mag = grp(g, 'mag', 0, 0.09, -0.3);
    box(mag, M.steel, 0.01, 0.01, 0.62, 0, 0, 0);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.06, 4), M.steel);
    tip.rotation.x = -Math.PI / 2;
    tip.position.z = -0.33;
    mag.add(tip);
    for (const s of [-1, 1]) box(mag, M.steel, 0.004, 0.03, 0.012, s * 0.012, 0, -0.29, 0, 0, s * 0.6);
    grip(g, M.poly, 0, -0.05, 0.06, 0.13);
    trigger(g, 0.0, -0.005);
    rbox(g, M.olive, 0.05, 0.08, 0.16, 0, 0.03, 0.18);
    box(g, M.black, 0.026, 0.008, 0.12, 0, 0.084, -0.04); // rail
    anchor(g, 'fore', 0, -0.02, -0.32);
    return {
      rail: [0.088, -0.04], ironY: 0.12,
      irons: () => irons(g, 0.12, -0.12, 0.06, 0.08),
      muzzle: [0.09, -0.62, 0], under: [0.02, -0.4], magMods: false,
    };
  },

  // ---------------- Pistols ----------------
  pistol(g) {
    const slide = grp(g, 'slide', 0, 0, 0);
    rbox(slide, M.dark, 0.045, 0.052, 0.21, 0, 0.052, -0.06);
    for (let i = 0; i < 5; i++) for (const s of [-1, 1]) box(slide, M.black, 0.002, 0.038, 0.005, s * 0.0225, 0.052, 0.02 + i * 0.01);
    for (let i = 0; i < 3; i++) for (const s of [-1, 1]) box(slide, M.black, 0.002, 0.03, 0.004, s * 0.0225, 0.055, -0.13 - i * 0.009);
    box(slide, M.steel, 0.003, 0.016, 0.04, 0.023, 0.062, -0.05);
    cyl(g, M.black, 0.007, 0.004, 0, 0.052, -0.166, 8);
    rbox(g, M.poly, 0.04, 0.034, 0.18, 0, 0.016, -0.05);
    box(g, M.black, 0.03, 0.01, 0.06, 0, -0.006, -0.11);
    trigger(g, -0.02, 0.025, 0.055);
    grip(g, M.poly, 0, -0.04, 0.02);
    const mag = grp(g, 'mag', 0, -0.02, 0.02);
    box(mag, M.dark, 0.034, 0.06, 0.045, 0, -0.07, 0.01, -0.25);
    box(mag, M.black, 0.04, 0.012, 0.05, 0, -0.1, 0.02, -0.25);
    anchor(g, 'fore', -0.04, -0.05, 0.0);
    return {
      rail: [0.078, -0.02], small: true, opticParent: slide, ironY: 0.092,
      irons: () => {
        box(slide, M.black, 0.01, 0.014, 0.012, 0, 0.084, -0.15);
        box(slide, M.black, 0.03, 0.012, 0.01, 0, 0.083, 0.035);
        for (const x of [-0.008, 0.008]) sphere(slide, M.glow, 0.0022, x, 0.09, 0.03, 5, 4);
        sphere(slide, M.glow, 0.0025, 0, 0.091, -0.15, 5, 4);
      },
      muzzle: [0.052, -0.166, 0.009], under: [-0.011, -0.11],
    };
  },
  bpistol(g) {
    const slide = grp(g, 'slide', 0, 0, 0);
    rbox(slide, M.tan, 0.046, 0.054, 0.22, 0, 0.05, -0.065);
    for (let i = 0; i < 5; i++) for (const s of [-1, 1]) box(slide, M.black, 0.002, 0.038, 0.005, s * 0.023, 0.05, 0.02 + i * 0.01);
    box(slide, M.black, 0.03, 0.006, 0.12, 0, 0.078, -0.06);
    rbox(g, M.dark, 0.04, 0.035, 0.19, 0, 0.015, -0.055);
    cyl(g, M.black, 0.009, 0.01, 0, 0.05, -0.178, 8);
    trigger(g, -0.02, 0.025, 0.055);
    grip(g, M.tan, 0, -0.04, 0.02);
    box(g, M.orange, 0.004, 0.012, 0.012, 0.024, 0.02, 0.005);
    const mag = grp(g, 'mag', 0, -0.02, 0.02);
    box(mag, M.dark, 0.034, 0.1, 0.045, 0, -0.08, 0.02, -0.25);
    box(mag, M.black, 0.04, 0.012, 0.05, 0, -0.13, 0.035, -0.25);
    anchor(g, 'fore', -0.04, -0.05, 0.0);
    return {
      rail: [0.078, -0.03], small: true, opticParent: slide, ironY: 0.092,
      irons: () => { box(slide, M.black, 0.01, 0.015, 0.012, 0, 0.084, -0.16); box(slide, M.black, 0.03, 0.012, 0.01, 0, 0.083, 0.035); },
      muzzle: [0.05, -0.18, 0.01], device: 'brake', under: [-0.004, -0.12],
    };
  },
  handcannon(g) {
    const slide = grp(g, 'slide', 0, 0, 0);
    rbox(slide, M.steel, 0.05, 0.065, 0.27, 0, 0.055, -0.08);
    for (let i = 0; i < 3; i++) box(slide, M.black, 0.052, 0.004, 0.14, 0, 0.06 - i * 0.012, -0.13);
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) box(slide, M.gunmetal, 0.002, 0.04, 0.005, s * 0.025, 0.055, 0.0 + i * 0.012);
    box(slide, M.black, 0.004, 0.02, 0.05, 0.026, 0.06, -0.04);
    rbox(g, M.dark, 0.045, 0.04, 0.22, 0, 0.01, -0.07);
    cyl(g, M.black, 0.012, 0.004, 0, 0.055, -0.217, 8);
    trigger(g, -0.02, 0.022, 0.055);
    grip(g, M.poly, 0, -0.045, 0.02, 0.13);
    box(g, M.steel, 0.012, 0.03, 0.016, 0, 0.07, 0.055, 0.6);
    const mag = grp(g, 'mag', 0, -0.02, 0.02);
    box(mag, M.dark, 0.036, 0.06, 0.05, 0, -0.08, 0.01, -0.25);
    box(mag, M.black, 0.042, 0.012, 0.055, 0, -0.112, 0.02, -0.25);
    anchor(g, 'fore', -0.04, -0.05, 0.0);
    return {
      rail: [0.088, -0.05], small: true, opticParent: slide, ironY: 0.1,
      irons: () => { box(slide, M.dark, 0.012, 0.018, 0.015, 0, 0.095, -0.2); box(slide, M.dark, 0.032, 0.012, 0.01, 0, 0.093, 0.03); },
      muzzle: [0.055, -0.217, 0.012], under: [-0.01, -0.14],
    };
  },
  mpistol(g) {
    const slide = grp(g, 'slide', 0, 0, 0);
    rbox(slide, M.dark, 0.048, 0.058, 0.24, 0, 0.05, -0.07);
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) box(slide, M.black, 0.002, 0.042, 0.006, s * 0.024, 0.05, 0.02 + i * 0.012);
    rbox(g, M.mid, 0.042, 0.04, 0.2, 0, 0.012, -0.06);
    cyl(g, M.black, 0.009, 0.012, 0, 0.05, -0.192, 8);
    trigger(g, -0.02, 0.02, 0.055);
    grip(g, M.poly, 0, -0.04, 0.02);
    const mag = grp(g, 'mag', 0, -0.02, 0.02);
    box(mag, M.black, 0.036, 0.2, 0.045, 0, -0.1, 0.03, -0.25);
    box(mag, M.dark, 0.04, 0.012, 0.05, 0, -0.195, 0.055, -0.25);
    rbox(g, M.poly, 0.03, 0.07, 0.035, 0, -0.03, -0.14);
    anchor(g, 'fore', 0, -0.07, -0.14);
    return {
      rail: [0.079, -0.04], small: true, opticParent: slide, ironY: 0.095,
      irons: () => { box(slide, M.black, 0.01, 0.015, 0.012, 0, 0.085, -0.17); box(slide, M.black, 0.03, 0.012, 0.01, 0, 0.084, 0.03); },
      muzzle: [0.05, -0.192, 0.011], device: 'brake', under: [-0.008, -0.1],
    };
  },
  microsmg(g) {
    rbox(g, M.dark, 0.05, 0.07, 0.22, 0, 0.05, -0.06);
    for (const s of [-1, 1]) box(g, M.black, 0.002, 0.04, 0.16, s * 0.026, 0.05, -0.06);
    barrel(g, 0.011, 0.055, -0.17, -0.23, M.gunmetal, false);
    box(g, M.black, 0.03, 0.04, 0.03, 0, 0.0, -0.13);
    trigger(g, -0.02, 0.02, 0.05);
    grip(g, M.poly, 0, -0.04, 0.02);
    const mag = grp(g, 'mag', 0, -0.02, 0.02);
    box(mag, M.black, 0.034, 0.18, 0.04, 0, -0.1, 0.03, -0.25);
    for (const s of [-1, 1]) box(g, M.mid, 0.008, 0.008, 0.14, s * 0.02, 0.06, 0.1);
    box(g, M.mid, 0.05, 0.008, 0.008, 0, 0.06, 0.17);
    const slide = grp(g, 'slide', 0, 0, 0);
    box(slide, M.steel, 0.012, 0.012, 0.03, 0, 0.092, -0.03);
    anchor(g, 'fore', -0.04, -0.05, 0.0);
    return {
      rail: [0.086, -0.1], small: true, ironY: 0.097,
      irons: () => { box(g, M.black, 0.014, 0.022, 0.012, 0, 0.092, -0.14); box(g, M.black, 0.026, 0.012, 0.01, 0, 0.09, 0.02); },
      muzzle: [0.055, -0.23, 0.011], under: [-0.02, -0.17],
    };
  },
  revolver(g) {
    rbox(g, M.steel, 0.04, 0.055, 0.12, 0, 0.042, -0.02);
    cyl(g, M.steel, 0.016, 0.2, 0, 0.058, -0.17, 12, 0.018);
    rbox(g, M.steel, 0.014, 0.03, 0.2, 0, 0.078, -0.17);
    for (const s of [-1, 1]) box(g, M.gunmetal, 0.002, 0.012, 0.18, s * 0.008, 0.082, -0.17);
    box(g, M.steel, 0.024, 0.024, 0.18, 0, 0.034, -0.16);
    cyl(g, M.black, 0.009, 0.004, 0, 0.058, -0.272, 8);
    const c = grp(g, 'cyl', 0, 0.035, -0.04);
    cyl(c, M.gunmetal, 0.033, 0.062, 0, 0, 0, 14);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      box(c, M.black, 0.006, 0.006, 0.064, Math.cos(a) * 0.033, Math.sin(a) * 0.033, 0);
      cyl(c, M.brass, 0.007, 0.004, Math.cos(a + 0.5) * 0.019, Math.sin(a + 0.5) * 0.019, 0.032, 6);
    }
    box(g, M.steel, 0.012, 0.04, 0.018, 0, 0.075, 0.045, 0.6);
    trigger(g, 0.0, 0.015, 0.05);
    rbox(g, M.wood, 0.044, 0.12, 0.056, 0, -0.05, 0.045, -0.35);
    box(g, M.woodDark, 0.046, 0.08, 0.01, 0, -0.05, 0.045, -0.35);
    box(g, M.steel, 0.01, 0.025, 0.02, 0, 0.075, 0.03);
    anchor(g, 'fore', -0.04, -0.05, 0.02);
    return {
      rail: [0.094, -0.14], small: true, ironY: 0.098,
      irons: () => box(g, M.black, 0.008, 0.02, 0.012, 0, 0.098, -0.26),
      muzzle: [0.058, -0.272, 0.016], under: [0.022, -0.17],
    };
  },
  autorev(g) {
    rbox(g, M.gunmetal, 0.042, 0.06, 0.13, 0, 0.042, -0.02);
    cyl(g, M.black, 0.02, 0.22, 0, 0.03, -0.18, 12);
    cyl(g, M.black, 0.012, 0.004, 0, 0.03, -0.292, 8);
    rbox(g, M.gunmetal, 0.03, 0.04, 0.26, 0, 0.08, -0.12);
    vents(g, 0.08, -0.04, 4, 0.04, 0.015, 0.016, 0.022);
    const c = grp(g, 'cyl', 0, 0.045, -0.04);
    cyl(c, M.steel, 0.034, 0.066, 0, 0, 0, 14);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      box(c, M.black, 0.006, 0.006, 0.068, Math.cos(a) * 0.034, Math.sin(a) * 0.034, 0);
    }
    trigger(g, 0.0, 0.015, 0.05);
    rbox(g, M.black, 0.044, 0.12, 0.056, 0, -0.05, 0.045, -0.35);
    box(g, M.orange, 0.046, 0.06, 0.01, 0, -0.04, 0.05, -0.35);
    anchor(g, 'fore', -0.04, -0.05, 0.02);
    return {
      rail: [0.1, -0.12], small: true, ironY: 0.108,
      irons: () => { box(g, M.black, 0.008, 0.02, 0.012, 0, 0.108, -0.24); box(g, M.black, 0.026, 0.012, 0.012, 0, 0.104, 0.02); },
      muzzle: [0.03, -0.292, 0.02], under: [0.008, -0.2],
    };
  },
  sawedoff(g) {
    cyl(g, M.gunmetal, 0.021, 0.26, -0.022, 0.05, -0.2, 12);
    cyl(g, M.gunmetal, 0.021, 0.26, 0.022, 0.05, -0.2, 12);
    for (const s of [-1, 1]) cyl(g, M.black, 0.024, 0.012, s * 0.022, 0.05, -0.327, 10);
    box(g, M.dark, 0.014, 0.008, 0.26, 0, 0.072, -0.2);
    rbox(g, M.steel, 0.08, 0.07, 0.1, 0, 0.035, -0.03);
    box(g, M.wood, 0.06, 0.04, 0.1, 0, 0.0, -0.13);
    trigger(g, 0.0, 0.01, 0.05);
    rbox(g, M.wood, 0.05, 0.13, 0.07, 0, -0.06, 0.03, -0.45);
    box(g, M.tape, 0.052, 0.04, 0.072, 0, -0.08, 0.04, -0.45);
    for (const s of [-1, 1]) box(g, M.steel, 0.012, 0.02, 0.025, s * 0.012, 0.075, 0.0, 0.5);
    anchor(g, 'fore', -0.04, -0.05, 0.0);
    anchor(g, 'port', 0, 0.05, -0.08);
    return {
      rail: [0.077, -0.14], small: true, ironY: 0.09,
      irons: () => sphere(g, M.brass, 0.005, 0, 0.082, -0.31, 6, 4),
      muzzle: [0.05, -0.333, 0], under: [-0.02, -0.14],
    };
  },
  flare(g) {
    rbox(g, M.orange, 0.05, 0.06, 0.12, 0, 0.04, -0.02);
    cyl(g, M.orange, 0.03, 0.2, 0, 0.055, -0.17, 14);
    cyl(g, M.black, 0.022, 0.004, 0, 0.055, -0.272, 12);
    ring(g, M.black, 0.03, 0.004, 0, 0.055, -0.26, 16);
    box(g, M.black, 0.014, 0.04, 0.03, 0, 0.08, 0.04, 0.5);
    const mag = grp(g, 'mag', 0, 0.055, -0.08);
    cyl(mag, M.red, 0.018, 0.08, 0, 0, 0, 10);
    trigger(g, 0.0, 0.015, 0.05);
    rbox(g, M.orange, 0.044, 0.12, 0.056, 0, -0.05, 0.045, -0.35);
    box(g, M.black, 0.046, 0.08, 0.01, 0, -0.05, 0.045, -0.35);
    anchor(g, 'fore', -0.04, -0.05, 0.02);
    return {
      rail: [0.085, -0.12], small: true, ironY: 0.095,
      irons: () => box(g, M.black, 0.008, 0.014, 0.01, 0, 0.09, -0.25),
      muzzle: [0.055, -0.272, 0], under: [0.024, -0.15], magMods: false,
    };
  },
};
