import * as THREE from 'three';
import {
  M, box, rbox, cyl, cylY, ring, sphere, grp, anchor, rail, trigger, grip, brake, flashHider, can, irons,
  redDot, holo, microDot, scope, lpvo, vents, rifleMag, swivel,
} from './modelkit.js';

// Gun models. Barrel points down -Z; origin is the right-hand grip.
// Named children drive animation: mag, bolt, pump, slide, cyl, lid, spin (groups) and
// fore, muzzle, port (anchor points). userData.sight is the sight-line height for ADS
// (the optic / iron sight is centered on it); userData.adsZ moves the gun closer to the eye
// for magnified optics so you look into the scope.

// AR-style lower: receiver halves, mag well, ejection port, forward assist, charging handle.
function arReceiver(g, upperMat = M.dark, lowerMat = M.dark, len = 0.3, z = -0.05) {
  rbox(g, upperMat, 0.066, 0.056, len, 0, 0.078, z);
  rbox(g, lowerMat, 0.06, 0.05, len * 0.72, 0, 0.03, z + 0.02);
  box(g, lowerMat, 0.062, 0.045, 0.085, 0, 0.005, -0.14); // mag well
  box(g, M.steel, 0.003, 0.02, 0.06, 0.034, 0.08, -0.03); // ejection port
  box(g, M.black, 0.002, 0.012, 0.064, 0.034, 0.063, -0.03); // dust cover
  cyl(g, M.dark, 0.009, 0.026, 0.036, 0.085, 0.04, 8); // forward assist
  box(g, M.dark, 0.012, 0.018, 0.018, 0.036, 0.098, 0.012); // brass deflector
  box(g, M.black, 0.03, 0.012, 0.05, 0, 0.11, z + len / 2 - 0.02); // charging handle
  box(g, M.black, 0.05, 0.01, 0.012, 0, 0.11, z + len / 2 + 0.004);
  box(g, M.black, 0.01, 0.01, 0.014, -0.032, 0.03, -0.1); // mag release
  box(g, M.black, 0.006, 0.012, 0.02, -0.032, 0.055, 0.03); // selector
}
// Collapsible stock on a buffer tube.
function arStock(g, mat = M.poly, z = 0.27) {
  cyl(g, M.black, 0.017, 0.14, 0, 0.068, z - 0.1);
  rbox(g, mat, 0.056, 0.095, 0.17, 0, 0.05, z);
  box(g, mat, 0.05, 0.026, 0.12, 0, 0.104, z - 0.01); // cheek riser
  box(g, M.rubber, 0.06, 0.112, 0.02, 0, 0.046, z + 0.09); // butt pad
  for (let i = 0; i < 3; i++) box(g, M.black, 0.058, 0.004, 0.006, 0, 0.0 + i * 0.03, z + 0.08);
  swivel(g, 0.03, 0.02, z - 0.04);
}
// Free-float handguard with M-LOK slots and a top rail.
function handguard(g, mat, y, z0, z1, w = 0.074) {
  const len = z0 - z1, zc = (z0 + z1) / 2;
  rbox(g, mat, w, w, len, 0, y, zc);
  const n = Math.floor(len / 0.06);
  for (let i = 0; i < n; i++) {
    for (const s of [-1, 1]) box(g, M.black, 0.004, 0.011, 0.032, s * (w / 2 + 0.001), y - 0.008, z0 - 0.04 - i * 0.06);
    box(g, M.black, 0.011, 0.004, 0.032, 0, y - w / 2 - 0.001, z0 - 0.04 - i * 0.06);
  }
  box(g, M.black, w + 0.004, w + 0.004, 0.01, 0, y, z1 - 0.004); // end cap
  rail(g, y + w / 2 + 0.006, z0, z1 + 0.01, 0.024);
}

export const GUNS = {
  // ---------------- Primaries ----------------
  ar(g) {
    arReceiver(g);
    rail(g, 0.112, 0.1, -0.19);
    handguard(g, M.poly, 0.07, -0.2, -0.5);
    cyl(g, M.gunmetal, 0.012, 0.22, 0, 0.065, -0.61, 10, 0.013);
    box(g, M.black, 0.016, 0.028, 0.014, 0, 0.122, -0.46); // folded front sight
    flashHider(g, 0.014, 0.065, -0.735);
    const mag = grp(g, 'mag', 0, -0.02, -0.14);
    rifleMag(mag);
    grip(g, M.poly, 0, -0.05, 0.06);
    trigger(g, 0.0, 0.0);
    arStock(g);
    rbox(g, M.poly, 0.032, 0.07, 0.04, 0, -0.005, -0.36, 0.1); // vertical grip
    holo(g, 0.15, -0.04, 0.112);
    const bolt = grp(g, 'bolt', 0.045, 0.07, 0.0);
    box(bolt, M.steel, 0.02, 0.016, 0.045, 0, 0, 0);
    anchor(g, 'fore', 0, 0.0, -0.32);
    anchor(g, 'muzzle', 0, 0.065, -0.75);
    g.userData.sight = 0.15;
  },
  smg(g) {
    // MP5-style: slim receiver, integral suppressor, collapsing stock, drum-style rear sight.
    rbox(g, M.dark, 0.06, 0.08, 0.34, 0, 0.055, -0.08);
    box(g, M.black, 0.062, 0.016, 0.3, 0, 0.012, -0.08);
    box(g, M.black, 0.04, 0.012, 0.12, 0, 0.1, -0.12); // claw mount
    box(g, M.steel, 0.003, 0.02, 0.05, 0.031, 0.06, -0.03);
    cyl(g, M.black, 0.008, 0.16, -0.032, 0.085, -0.12, 8); // cocking tube
    rbox(g, M.poly, 0.066, 0.06, 0.15, 0, 0.03, -0.25); // handguard
    for (let i = 0; i < 4; i++) box(g, M.black, 0.068, 0.006, 0.01, 0, 0.012, -0.2 - i * 0.03);
    can(g, 0.024, 0.06, -0.39, 0.15);
    const mag = grp(g, 'mag', 0, 0.0, -0.1);
    box(mag, M.black, 0.04, 0.12, 0.05, 0, -0.06, 0, 0.12);
    box(mag, M.black, 0.04, 0.1, 0.05, 0, -0.16, 0.02, 0.3);
    box(mag, M.dark, 0.044, 0.012, 0.054, 0, -0.208, 0.034, 0.3);
    grip(g, M.poly, 0, -0.055, 0.06, 0.12, -0.25);
    trigger(g, 0.0, 0.01, 0.06);
    for (const s of [-1, 1]) box(g, M.mid, 0.01, 0.014, 0.2, s * 0.026, 0.07, 0.15);
    rbox(g, M.rubber, 0.06, 0.09, 0.026, 0, 0.045, 0.26);
    irons(g, 0.128, -0.22, 0.04, 0.1);
    const bolt = grp(g, 'bolt', -0.04, 0.085, -0.05);
    box(bolt, M.steel, 0.02, 0.014, 0.03, 0, 0, 0);
    box(bolt, M.black, 0.024, 0.01, 0.01, -0.014, 0, 0.012);
    anchor(g, 'fore', 0, -0.03, -0.24);
    anchor(g, 'muzzle', 0, 0.06, -0.47);
    g.userData.sight = 0.128;
  },
  burst(g) {
    // FAMAS-style bullpup with a carry handle that doubles as the sight rail.
    rbox(g, M.olive, 0.08, 0.11, 0.62, 0, 0.04, -0.06);
    box(g, M.black, 0.082, 0.02, 0.4, 0, -0.01, -0.1);
    rbox(g, M.poly, 0.082, 0.04, 0.2, 0, -0.005, -0.3);
    vents(g, 0.04, -0.25, 4, 0.04, 0.041);
    box(g, M.rubber, 0.084, 0.12, 0.03, 0, 0.035, 0.24);
    cyl(g, M.gunmetal, 0.014, 0.22, 0, 0.06, -0.47, 10, 0.016);
    brake(g, 0.016, 0.06, -0.6, 0.05);
    box(g, M.dark, 0.032, 0.04, 0.32, 0, 0.13, -0.08); // carry handle
    for (const z of [-0.22, 0.06]) box(g, M.dark, 0.032, 0.05, 0.03, 0, 0.1, z);
    for (const s of [-1, 1]) box(g, M.olive, 0.004, 0.035, 0.26, s * 0.017, 0.13, -0.08);
    rail(g, 0.162, 0.06, -0.22, 0.026);
    irons(g, 0.19, -0.2, 0.05, 0.162);
    grip(g, M.poly, 0, -0.07, -0.06, 0.12, -0.3);
    trigger(g, -0.12, -0.02);
    const mag = grp(g, 'mag', 0, -0.03, 0.12);
    rifleMag(mag, M.black, 0.046, 0.066);
    const bolt = grp(g, 'bolt', 0.05, 0.08, -0.15);
    box(bolt, M.steel, 0.02, 0.02, 0.05, 0, 0, 0);
    anchor(g, 'fore', 0, -0.03, -0.3);
    anchor(g, 'muzzle', 0, 0.06, -0.63);
    g.userData.sight = 0.19;
  },
  lmg(g) {
    // Belt-fed LMG: feed tray cover (lid), box mag, heat shield, bipod and carry handle.
    rbox(g, M.dark, 0.1, 0.12, 0.42, 0, 0.05, -0.05);
    box(g, M.steel, 0.003, 0.03, 0.08, 0.051, 0.055, -0.04);
    box(g, M.black, 0.102, 0.02, 0.38, 0, -0.005, -0.05);
    cyl(g, M.gunmetal, 0.018, 0.5, 0, 0.06, -0.5, 10, 0.021);
    cyl(g, M.mid, 0.034, 0.22, 0, 0.06, -0.34, 12);
    vents(g, 0.06, -0.26, 5, 0.04, 0.034, 0.012, 0.022);
    box(g, M.black, 0.02, 0.05, 0.02, 0, 0.105, -0.38); // carry handle
    box(g, M.black, 0.02, 0.02, 0.16, 0, 0.13, -0.38);
    flashHider(g, 0.02, 0.06, -0.78, 0.07);
    irons(g, 0.17, -0.7, 0.03, 0.08);
    grip(g, M.poly, 0, -0.06, 0.08);
    trigger(g, 0.02, 0.0);
    rbox(g, M.poly, 0.07, 0.1, 0.24, 0, 0.035, 0.28);
    box(g, M.poly, 0.05, 0.03, 0.12, 0, 0.09, 0.27);
    box(g, M.rubber, 0.072, 0.11, 0.02, 0, 0.035, 0.4);
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
    anchor(g, 'muzzle', 0, 0.06, -0.82);
    g.userData.sight = 0.17;
  },
  dmr(g) {
    // Marksman rifle with a low-power scope you look through when aiming.
    arReceiver(g, M.tan, M.tan, 0.36, -0.08);
    rail(g, 0.112, 0.1, -0.24);
    handguard(g, M.tan, 0.068, -0.26, -0.5, 0.076);
    cyl(g, M.gunmetal, 0.014, 0.24, 0, 0.065, -0.62, 10, 0.016);
    brake(g, 0.016, 0.065, -0.75, 0.06);
    const mag = grp(g, 'mag', 0, -0.02, -0.12);
    box(mag, M.black, 0.05, 0.12, 0.08, 0, -0.05, 0, 0.12);
    box(mag, M.dark, 0.054, 0.012, 0.084, 0, -0.112, 0.008, 0.12);
    grip(g, M.poly, 0, -0.05, 0.06);
    trigger(g, 0.0, 0.0);
    rbox(g, M.tan, 0.058, 0.11, 0.24, 0, 0.03, 0.24);
    box(g, M.tan, 0.05, 0.03, 0.16, 0, 0.096, 0.22);
    box(g, M.rubber, 0.062, 0.12, 0.02, 0, 0.03, 0.37);
    lpvo(g, 0.16, -0.06, 0.16, 0.028, 0.044, 0.112);
    const bolt = grp(g, 'bolt', 0.045, 0.07, -0.02);
    box(bolt, M.steel, 0.025, 0.02, 0.05, 0, 0, 0);
    anchor(g, 'fore', 0, -0.01, -0.36);
    anchor(g, 'muzzle', 0, 0.065, -0.78);
    g.userData.sight = 0.16;
    g.userData.adsZ = -0.13; // eye up to the scope
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
    box(mag, M.black, 0.02, 0.05, 0.12, 0.135, -0.05, 0); // handle
    for (let i = 0; i < 5; i++) cyl(g, M.brass, 0.008, 0.04, 0.09 - i * 0.012, -0.03 + i * 0.014, 0.02, 6).rotation.set(0, 0, Math.PI / 2);
    grip(g, M.poly, 0, -0.09, 0.08, 0.12, -0.2);
    trigger(g, 0.04, -0.04);
    box(g, M.dark, 0.03, 0.08, 0.15, 0, 0.11, -0.05);
    box(g, M.black, 0.034, 0.03, 0.12, 0, 0.16, -0.08);
    box(g, M.rubber, 0.04, 0.034, 0.08, 0, 0.162, -0.08);
    anchor(g, 'fore', -0.02, 0.12, -0.1);
    anchor(g, 'muzzle', 0, 0.0, -0.72);
    g.userData.sight = 0.17;
  },
  sniper(g) {
    // Bolt-action precision rifle: chassis stock, fluted barrel, big scope.
    rbox(g, M.gunmetal, 0.066, 0.075, 0.3, 0, 0.06, -0.04);
    cyl(g, M.gunmetal, 0.015, 0.62, 0, 0.065, -0.5, 10, 0.019);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      box(g, M.black, 0.004, 0.004, 0.3, Math.cos(a) * 0.017, 0.065 + Math.sin(a) * 0.017, -0.5);
    }
    brake(g, 0.017, 0.065, -0.83, 0.07);
    rbox(g, M.olive, 0.075, 0.075, 0.36, 0, 0.022, -0.33);
    vents(g, 0.022, -0.22, 5, 0.045, 0.038);
    rbox(g, M.olive, 0.07, 0.12, 0.32, 0, 0.004, 0.25);
    box(g, M.olive, 0.05, 0.035, 0.12, 0, 0.083, 0.24); // cheek riser
    box(g, M.rubber, 0.072, 0.13, 0.025, 0, 0.004, 0.41);
    box(g, M.dark, 0.02, 0.05, 0.03, 0, -0.07, 0.3); // monopod
    grip(g, M.olive, 0, -0.06, 0.06);
    trigger(g, 0.0, -0.005);
    rail(g, 0.105, 0.08, -0.2);
    scope(g, 0.155, -0.06, 0.38, 0.032, 0.105);
    const mag = grp(g, 'mag', 0, 0.0, -0.08);
    box(mag, M.black, 0.045, 0.08, 0.08, 0, -0.03, 0);
    box(mag, M.dark, 0.048, 0.01, 0.084, 0, -0.07, 0);
    const bolt = grp(g, 'bolt', 0.035, 0.08, 0.05);
    box(bolt, M.steel, 0.07, 0.014, 0.014, 0.035, 0, 0);
    sphere(bolt, M.black, 0.017, 0.07, 0, 0);
    for (const s of [-1, 1]) box(g, M.dark, 0.012, 0.012, 0.24, s * 0.028, -0.025, -0.54);
    swivel(g, 0.0, -0.025, -0.45);
    anchor(g, 'fore', 0, -0.02, -0.36);
    anchor(g, 'muzzle', 0, 0.065, -0.87);
    g.userData.sight = 0.155;
  },
  shotgun(g) {
    // Pump shotgun: wood furniture, tube mag, bead sight, shell saddle.
    rbox(g, M.dark, 0.075, 0.085, 0.4, 0, 0.05, -0.08);
    box(g, M.steel, 0.003, 0.035, 0.09, 0.039, 0.055, -0.06); // loading port
    box(g, M.black, 0.04, 0.008, 0.36, 0, 0.096, -0.1); // vent rib base
    cyl(g, M.gunmetal, 0.021, 0.5, 0, 0.075, -0.5, 12, 0.023);
    cyl(g, M.dark, 0.019, 0.42, 0, 0.03, -0.46);
    box(g, M.black, 0.026, 0.07, 0.026, 0, 0.052, -0.7); // barrel clamp
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
    box(g, M.steel, 0.012, 0.018, 0.012, 0, 0.11, -0.72);
    sphere(g, M.glow, 0.005, 0, 0.12, -0.72, 6, 4);
    for (let i = 0; i < 4; i++) cyl(g, M.red, 0.009, 0.05, 0.044, 0.02, -0.02 - i * 0.022, 8).rotation.set(0, 0, 0);
    box(g, M.black, 0.004, 0.03, 0.1, 0.04, 0.02, -0.053);
    anchor(g, 'port', 0.05, 0.03, -0.1);
    anchor(g, 'muzzle', 0, 0.075, -0.76);
    g.userData.sight = 0.12;
  },
  gl(g) {
    // Revolving grenade launcher: big drum, tube, folding ladder sight.
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
    box(g, M.dark, 0.04, 0.05, 0.08, 0, 0.14, -0.15);
    for (const s of [-1, 1]) box(g, M.black, 0.006, 0.05, 0.006, s * 0.016, 0.19, -0.15);
    box(g, M.black, 0.04, 0.006, 0.006, 0, 0.2, -0.15);
    box(g, M.black, 0.004, 0.012, 0.004, 0, 0.194, -0.15);
    rbox(g, M.poly, 0.05, 0.1, 0.06, 0, -0.03, -0.38);
    anchor(g, 'fore', 0, -0.07, -0.38);
    anchor(g, 'muzzle', 0, 0.07, -0.6);
    g.userData.sight = 0.2;
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
    rbox(g, M.dark, 0.06, 0.08, 0.12, 0.1, 0.14, -0.15); // side sight box (off the sight line)
    cyl(g, M.lens, 0.022, 0.004, 0.1, 0.15, -0.212, 12);
    box(g, M.black, 0.03, 0.03, 0.04, 0.07, 0.12, -0.15);
    box(g, M.orange, 0.02, 0.012, 0.06, 0, 0.17, -0.2);
    irons(g, 0.19, -0.42, -0.05, 0.165);
    anchor(g, 'fore', 0, -0.05, -0.3);
    anchor(g, 'muzzle', 0, 0.09, -0.75);
    g.userData.sight = 0.19;
  },

  // ---------------- Secondaries ----------------
  pistol(g) {
    // Polymer striker pistol with a serrated slide and glowing night sights.
    const slide = grp(g, 'slide', 0, 0, 0);
    rbox(slide, M.dark, 0.045, 0.052, 0.21, 0, 0.052, -0.06);
    for (let i = 0; i < 5; i++) for (const s of [-1, 1]) box(slide, M.black, 0.002, 0.038, 0.005, s * 0.0225, 0.052, 0.02 + i * 0.01);
    for (let i = 0; i < 3; i++) for (const s of [-1, 1]) box(slide, M.black, 0.002, 0.03, 0.004, s * 0.0225, 0.055, -0.13 - i * 0.009);
    box(slide, M.steel, 0.003, 0.016, 0.04, 0.023, 0.062, -0.05);
    box(slide, M.black, 0.01, 0.014, 0.012, 0, 0.084, -0.15);
    box(slide, M.black, 0.03, 0.012, 0.01, 0, 0.083, 0.035);
    for (const x of [-0.008, 0.008]) sphere(slide, M.glow, 0.0022, x, 0.09, 0.03, 5, 4);
    sphere(slide, M.glow, 0.0025, 0, 0.091, -0.15, 5, 4);
    cyl(g, M.black, 0.007, 0.004, 0, 0.052, -0.166, 8);
    rbox(g, M.poly, 0.04, 0.034, 0.18, 0, 0.016, -0.05);
    box(g, M.black, 0.03, 0.01, 0.06, 0, -0.006, -0.11);
    for (let i = 0; i < 3; i++) box(g, M.black, 0.032, 0.003, 0.006, 0, -0.012, -0.09 - i * 0.015);
    trigger(g, -0.02, 0.025, 0.055);
    grip(g, M.poly, 0, -0.04, 0.02);
    const mag = grp(g, 'mag', 0, -0.02, 0.02);
    box(mag, M.dark, 0.034, 0.06, 0.045, 0, -0.07, 0.01, -0.25);
    box(mag, M.black, 0.04, 0.012, 0.05, 0, -0.1, 0.02, -0.25);
    anchor(g, 'fore', -0.04, -0.05, 0.0);
    anchor(g, 'muzzle', 0, 0.052, -0.18);
    g.userData.sight = 0.092;
  },
  revolver(g) {
    rbox(g, M.steel, 0.04, 0.055, 0.12, 0, 0.042, -0.02);
    cyl(g, M.steel, 0.016, 0.2, 0, 0.058, -0.17, 12, 0.018);
    rbox(g, M.steel, 0.014, 0.03, 0.2, 0, 0.078, -0.17);
    for (const s of [-1, 1]) box(g, M.gunmetal, 0.002, 0.012, 0.18, s * 0.008, 0.082, -0.17); // vent rib
    box(g, M.steel, 0.024, 0.024, 0.18, 0, 0.034, -0.16); // ejector shroud
    box(g, M.black, 0.008, 0.02, 0.012, 0, 0.098, -0.26); // front blade
    cyl(g, M.black, 0.009, 0.004, 0, 0.058, -0.272, 8);
    const c = grp(g, 'cyl', 0, 0.035, -0.04);
    cyl(c, M.gunmetal, 0.033, 0.062, 0, 0, 0, 14);
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
  handcannon(g) {
    const slide = grp(g, 'slide', 0, 0, 0);
    rbox(slide, M.steel, 0.05, 0.065, 0.27, 0, 0.055, -0.08);
    for (let i = 0; i < 3; i++) box(slide, M.black, 0.052, 0.004, 0.14, 0, 0.06 - i * 0.012, -0.13); // lightening cuts
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) box(slide, M.gunmetal, 0.002, 0.04, 0.005, s * 0.025, 0.055, 0.0 + i * 0.012);
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
  mpistol(g) {
    const slide = grp(g, 'slide', 0, 0, 0);
    rbox(slide, M.dark, 0.048, 0.058, 0.24, 0, 0.05, -0.07);
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) box(slide, M.black, 0.002, 0.042, 0.006, s * 0.024, 0.05, 0.02 + i * 0.012);
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
    anchor(g, 'muzzle', 0, 0.05, -0.34);
    g.userData.sight = 0.09;
  },
};
