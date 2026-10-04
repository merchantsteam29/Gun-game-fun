// Weapon definitions. Loadout slots: [primary, secondary, melee, utility].
// reloadStyle drives the first-person reload animation; cycle is a post-shot action (pump/bolt).
export const WEAPONS = {
  // ---------- Primaries ----------
  ar: {
    id: 'ar', name: 'Assault Rifle', type: 'gun', auto: true,
    rate: 0.095, dmg: 21, head: 1.7, pellets: 1, mag: 30, reload: 2.0,
    spread: 0.012, moveSpread: 0.035, adsMul: 0.3, range: 250,
    recoil: 0.014, speedMul: 1.0, switch: 0.35, reloadStyle: 'mag',
  },
  smg: {
    id: 'smg', name: 'SMG', type: 'gun', auto: true,
    rate: 0.065, dmg: 15, head: 1.5, pellets: 1, mag: 35, reload: 1.7,
    spread: 0.02, moveSpread: 0.02, adsMul: 0.45, range: 120, falloff: [15, 40, 0.6],
    recoil: 0.009, speedMul: 1.1, switch: 0.28, reloadStyle: 'mag',
  },
  burst: {
    id: 'burst', name: 'Burst Rifle', type: 'gun', auto: false, burst: 3, burstGap: 0.07,
    rate: 0.42, dmg: 27, head: 1.8, pellets: 1, mag: 24, reload: 2.1,
    spread: 0.008, moveSpread: 0.03, adsMul: 0.25, range: 250,
    recoil: 0.016, speedMul: 1.0, switch: 0.35, reloadStyle: 'mag',
  },
  lmg: {
    id: 'lmg', name: 'LMG', type: 'gun', auto: true,
    rate: 0.095, dmg: 20, head: 1.5, pellets: 1, mag: 100, reload: 4.2,
    spread: 0.022, moveSpread: 0.05, adsMul: 0.35, range: 250,
    recoil: 0.012, speedMul: 0.82, switch: 0.6, reloadStyle: 'box',
  },
  sniper: {
    id: 'sniper', name: 'Sniper Rifle', type: 'gun', auto: false,
    rate: 1.25, dmg: 85, head: 2.0, pellets: 1, mag: 5, reload: 3.0,
    spread: 0.09, moveSpread: 0.05, adsMul: 0, range: 400,
    recoil: 0.08, speedMul: 0.88, switch: 0.6, reloadStyle: 'mag',
    scope: true, zoom: 22, cycle: 'bolt',
  },
  shotgun: {
    id: 'shotgun', name: 'Shotgun', type: 'gun', auto: false,
    rate: 0.85, dmg: 13, head: 1.3, pellets: 10, mag: 6, reload: 2.5,
    spread: 0.075, moveSpread: 0.02, adsMul: 0.75, range: 60,
    falloff: [8, 30, 0.3], // full damage until 8m, down to 30% at 30m
    recoil: 0.05, speedMul: 0.95, switch: 0.4, reloadStyle: 'shells', cycle: 'pump',
  },
  gl: {
    id: 'gl', name: 'Grenade Launcher', type: 'proj', auto: false,
    rate: 1.0, mag: 4, reload: 3.0,
    projSpeed: 30, projGravity: 9,
    directDmg: 999, // one-shot on a direct hit
    splash: 80, radius: 4.5,
    spread: 0, moveSpread: 0, adsMul: 1,
    recoil: 0.06, speedMul: 0.68, // heavy: slows you down while equipped
    switch: 0.6, reloadStyle: 'drum',
  },

  dmr: {
    id: 'dmr', name: 'DMR', type: 'gun', auto: false,
    rate: 0.24, dmg: 40, head: 2.0, pellets: 1, mag: 15, reload: 2.2,
    spread: 0.015, moveSpread: 0.04, adsMul: 0.12, range: 300, adsFov: 42,
    recoil: 0.03, speedMul: 0.95, switch: 0.4, reloadStyle: 'mag',
  },
  minigun: {
    id: 'minigun', name: 'Minigun', type: 'gun', auto: true, spinup: 0.6,
    rate: 0.045, dmg: 13, head: 1.4, pellets: 1, mag: 200, reload: 5,
    spread: 0.035, moveSpread: 0.03, adsMul: 0.7, range: 150,
    recoil: 0.006, speedMul: 0.7, switch: 0.8, reloadStyle: 'box',
  },
  doublebarrel: {
    id: 'doublebarrel', name: 'Double Barrel', type: 'gun', auto: false,
    rate: 0.22, dmg: 12, head: 1.3, pellets: 12, mag: 2, reload: 2.0,
    spread: 0.09, moveSpread: 0.02, adsMul: 0.8, range: 45, falloff: [6, 22, 0.25],
    recoil: 0.07, speedMul: 1.0, switch: 0.35, reloadStyle: 'shells',
  },
  rocket: {
    id: 'rocket', name: 'Rocket Launcher', type: 'proj', auto: false,
    rate: 0.8, mag: 1, reload: 2.6,
    projSpeed: 42, projGravity: 0, trail: true,
    directDmg: 120, splash: 110, radius: 5,
    spread: 0, moveSpread: 0, adsMul: 1,
    recoil: 0.08, speedMul: 0.78, switch: 0.7, reloadStyle: 'drum',
  },
  crossbow: {
    id: 'crossbow', name: 'Crossbow', type: 'proj', auto: false, bolt: true,
    rate: 0.5, mag: 1, reload: 1.6,
    projSpeed: 65, projGravity: 5, directDmg: 95, head: 2,
    spread: 0, moveSpread: 0, adsMul: 1, adsFov: 45,
    recoil: 0.04, speedMul: 0.95, switch: 0.4, reloadStyle: 'mag',
  },

  br: {
    id: 'br', name: 'Battle Rifle', type: 'gun', auto: true,
    rate: 0.15, dmg: 30, head: 1.6, pellets: 1, mag: 20, reload: 2.3,
    spread: 0.01, moveSpread: 0.04, adsMul: 0.25, range: 280,
    recoil: 0.024, speedMul: 0.92, switch: 0.42, reloadStyle: 'mag',
  },
  pdw: {
    id: 'pdw', name: 'PDW', type: 'gun', auto: true,
    rate: 0.055, dmg: 12, head: 1.5, pellets: 1, mag: 50, reload: 2.0,
    spread: 0.022, moveSpread: 0.015, adsMul: 0.5, range: 100, falloff: [12, 35, 0.55],
    recoil: 0.007, speedMul: 1.12, switch: 0.26, reloadStyle: 'mag',
  },
  autoshot: {
    id: 'autoshot', name: 'Auto Shotgun', type: 'gun', auto: true,
    rate: 0.28, dmg: 9, head: 1.25, pellets: 8, mag: 10, reload: 2.6,
    spread: 0.085, moveSpread: 0.02, adsMul: 0.8, range: 45, falloff: [7, 24, 0.3],
    recoil: 0.04, speedMul: 0.93, switch: 0.45, reloadStyle: 'mag',
  },
  amr: {
    id: 'amr', name: 'Anti-Materiel Rifle', type: 'gun', auto: false,
    rate: 1.7, dmg: 130, head: 1.5, pellets: 1, mag: 4, reload: 3.6,
    spread: 0.12, moveSpread: 0.06, adsMul: 0, range: 450,
    recoil: 0.12, speedMul: 0.78, switch: 0.8, reloadStyle: 'mag',
    scope: true, zoom: 18, cycle: 'bolt',
  },
  railgun: {
    id: 'railgun', name: 'Railgun', type: 'gun', auto: false,
    rate: 1.3, dmg: 90, head: 1.6, pellets: 1, mag: 4, reload: 2.8,
    spread: 0.03, moveSpread: 0.02, adsMul: 0, range: 400, adsFov: 38,
    recoil: 0.07, speedMul: 0.9, switch: 0.55, reloadStyle: 'mag',
  },

  carbine: {
    id: 'carbine', name: 'Carbine', type: 'gun', auto: true,
    rate: 0.1, dmg: 24, head: 1.6, pellets: 1, mag: 25, reload: 1.9,
    spread: 0.011, moveSpread: 0.028, adsMul: 0.3, range: 220,
    recoil: 0.013, speedMul: 1.04, switch: 0.32, reloadStyle: 'mag',
  },
  vector: {
    id: 'vector', name: 'Vector', type: 'gun', auto: true,
    rate: 0.048, dmg: 11, head: 1.5, pellets: 1, mag: 33, reload: 1.8,
    spread: 0.019, moveSpread: 0.015, adsMul: 0.5, range: 90, falloff: [10, 32, 0.5],
    recoil: 0.006, speedMul: 1.12, switch: 0.26, reloadStyle: 'mag',
  },
  slug: {
    id: 'slug', name: 'Slug Shotgun', type: 'gun', auto: false,
    rate: 0.75, dmg: 78, head: 1.5, pellets: 1, mag: 5, reload: 2.6,
    spread: 0.006, moveSpread: 0.03, adsMul: 0.4, range: 120, falloff: [20, 60, 0.45],
    recoil: 0.06, speedMul: 0.95, switch: 0.4, reloadStyle: 'shells', cycle: 'pump',
  },
  laser: {
    id: 'laser', name: 'Laser Rifle', type: 'gun', auto: true, tracer: '#3fe8ff',
    rate: 0.08, dmg: 15, head: 1.4, pellets: 1, mag: 40, reload: 2.2,
    spread: 0.004, moveSpread: 0.012, adsMul: 0.5, range: 260,
    recoil: 0.003, speedMul: 1.0, switch: 0.35, reloadStyle: 'mag',
  },
  harpoon: {
    id: 'harpoon', name: 'Harpoon Gun', type: 'proj', auto: false, bolt: true,
    rate: 0.6, mag: 1, reload: 2.2,
    projSpeed: 52, projGravity: 7, directDmg: 110, head: 1.6,
    spread: 0, moveSpread: 0, adsMul: 1, adsFov: 48,
    recoil: 0.05, speedMul: 0.92, switch: 0.45, reloadStyle: 'mag',
  },

  // ---------- Secondaries ----------
  microsmg: {
    id: 'microsmg', name: 'Micro SMG', type: 'gun', auto: true,
    rate: 0.06, dmg: 12, head: 1.4, pellets: 1, mag: 25, reload: 1.5,
    spread: 0.026, moveSpread: 0.018, adsMul: 0.55, range: 70, falloff: [8, 26, 0.5],
    recoil: 0.007, speedMul: 1.08, switch: 0.22, reloadStyle: 'mag',
  },
  autorev: {
    id: 'autorev', name: 'Auto Revolver', type: 'gun', auto: false,
    rate: 0.24, dmg: 37, head: 1.9, pellets: 1, mag: 6, reload: 2.0,
    spread: 0.012, moveSpread: 0.03, adsMul: 0.3, range: 160,
    recoil: 0.04, speedMul: 1.05, switch: 0.3, reloadStyle: 'revolver',
  },
  bpistol: {
    id: 'bpistol', name: 'Burst Pistol', type: 'gun', auto: false, burst: 3, burstGap: 0.06,
    rate: 0.38, dmg: 19, head: 1.8, pellets: 1, mag: 18, reload: 1.5,
    spread: 0.012, moveSpread: 0.025, adsMul: 0.4, range: 140,
    recoil: 0.02, speedMul: 1.05, switch: 0.25, reloadStyle: 'mag',
  },
  flare: {
    id: 'flare', name: 'Flare Gun', type: 'proj', auto: false,
    rate: 0.6, mag: 1, reload: 1.4,
    projSpeed: 40, projGravity: 6, trail: true, glow: true,
    directDmg: 75, splash: 40, radius: 2.5,
    spread: 0, moveSpread: 0, adsMul: 1,
    recoil: 0.05, speedMul: 1.05, switch: 0.3, reloadStyle: 'mag',
  },
  pistol: {
    id: 'pistol', name: 'Pistol', type: 'gun', auto: false,
    rate: 0.15, dmg: 27, head: 2.0, pellets: 1, mag: 12, reload: 1.4,
    spread: 0.012, moveSpread: 0.025, adsMul: 0.35, range: 150,
    recoil: 0.025, speedMul: 1.05, switch: 0.25, reloadStyle: 'mag',
  },
  revolver: {
    id: 'revolver', name: 'Revolver', type: 'gun', auto: false,
    rate: 0.45, dmg: 50, head: 2.0, pellets: 1, mag: 6, reload: 2.2,
    spread: 0.01, moveSpread: 0.03, adsMul: 0.3, range: 180,
    recoil: 0.06, speedMul: 1.05, switch: 0.3, reloadStyle: 'revolver',
  },
  mpistol: {
    id: 'mpistol', name: 'Machine Pistol', type: 'gun', auto: true,
    rate: 0.07, dmg: 13, head: 1.5, pellets: 1, mag: 20, reload: 1.5,
    spread: 0.03, moveSpread: 0.02, adsMul: 0.6, range: 80, falloff: [10, 30, 0.5],
    recoil: 0.008, speedMul: 1.05, switch: 0.25, reloadStyle: 'mag',
  },

  handcannon: {
    id: 'handcannon', name: 'Hand Cannon', type: 'gun', auto: false,
    rate: 0.48, dmg: 58, head: 2.0, pellets: 1, mag: 7, reload: 1.9,
    spread: 0.012, moveSpread: 0.04, adsMul: 0.3, range: 160,
    recoil: 0.07, speedMul: 1.0, switch: 0.35, reloadStyle: 'mag',
  },
  sawedoff: {
    id: 'sawedoff', name: 'Sawed-Off', type: 'gun', auto: false,
    rate: 0.25, dmg: 12, head: 1.2, pellets: 9, mag: 2, reload: 1.8,
    spread: 0.11, moveSpread: 0.02, adsMul: 0.85, range: 30, falloff: [4, 15, 0.2],
    recoil: 0.06, speedMul: 1.05, switch: 0.25, reloadStyle: 'shells',
  },

  // ---------- Melee ----------
  knife: {
    id: 'knife', name: 'Combat Knife', type: 'melee', style: 'slash',
    rate: 0.5, dmg: 55, backstab: 150, range: 2.4, hitDelay: 0.08,
    spread: 0, moveSpread: 0, speedMul: 1.15, switch: 0.2,
  },
  axe: {
    id: 'axe', name: 'Fire Axe', type: 'melee', style: 'chop',
    rate: 0.9, dmg: 75, backstab: 150, range: 2.9, hitDelay: 0.3,
    spread: 0, moveSpread: 0, speedMul: 1.0, switch: 0.35,
  },

  katana: {
    id: 'katana', name: 'Katana', type: 'melee', style: 'slash',
    rate: 0.55, dmg: 70, backstab: 150, range: 3.0, hitDelay: 0.1,
    spread: 0, moveSpread: 0, speedMul: 1.1, switch: 0.3,
  },
  bat: {
    id: 'bat', name: 'Baseball Bat', type: 'melee', style: 'chop',
    rate: 0.7, dmg: 50, backstab: 100, range: 2.7, hitDelay: 0.28, knockback: 13,
    spread: 0, moveSpread: 0, speedMul: 1.05, switch: 0.3,
  },
  machete: {
    id: 'machete', name: 'Machete', type: 'melee', style: 'slash',
    rate: 0.48, dmg: 65, backstab: 150, range: 2.7, hitDelay: 0.1,
    spread: 0, moveSpread: 0, speedMul: 1.1, switch: 0.25,
  },
  sledge: {
    id: 'sledge', name: 'Sledgehammer', type: 'melee', style: 'chop',
    rate: 1.2, dmg: 100, backstab: 150, range: 3.0, hitDelay: 0.4, knockback: 17,
    spread: 0, moveSpread: 0, speedMul: 0.95, switch: 0.45,
  },
  knuckles: {
    id: 'knuckles', name: 'Brass Knuckles', type: 'melee', style: 'slash',
    rate: 0.32, dmg: 38, backstab: 120, range: 2.2, hitDelay: 0.06,
    spread: 0, moveSpread: 0, speedMul: 1.18, switch: 0.15,
  },
  scythe: {
    id: 'scythe', name: 'Scythe', type: 'melee', style: 'chop',
    rate: 1.0, dmg: 90, backstab: 150, range: 3.5, hitDelay: 0.34,
    spread: 0, moveSpread: 0, speedMul: 1.0, switch: 0.4,
  },
  claws: {
    id: 'claws', name: 'Zombie Claws', type: 'melee', style: 'slash',
    rate: 0.45, dmg: 50, backstab: 150, range: 2.5, hitDelay: 0.08,
    spread: 0, moveSpread: 0, speedMul: 1.25, switch: 0.1,
  },

  // ---------- Utility ----------
  frag: {
    id: 'frag', name: 'Frag Grenade', type: 'throw',
    rate: 0.9, count: 2, fuse: 2.3, throwSpeed: 17,
    splash: 110, radius: 5.5,
    spread: 0, moveSpread: 0, speedMul: 1.05, switch: 0.25,
  },
  sticky: {
    id: 'sticky', name: 'Sticky Grenade', type: 'throw', sticky: true,
    rate: 0.9, count: 2, fuse: 2.0, throwSpeed: 16,
    splash: 100, radius: 4.2,
    spread: 0, moveSpread: 0, speedMul: 1.05, switch: 0.25,
  },
  flash: {
    id: 'flash', name: 'Flashbang', type: 'throw', flash: true,
    rate: 0.9, count: 2, fuse: 1.4, throwSpeed: 17, radius: 18,
    spread: 0, moveSpread: 0, speedMul: 1.05, switch: 0.25,
  },
  tknife: {
    id: 'tknife', name: 'Throwing Knives', type: 'throw', bolt: true,
    rate: 0.45, count: 3, fuse: 8, throwSpeed: 30, projGravity: 9, directDmg: 70, head: 2,
    spread: 0, moveSpread: 0, speedMul: 1.05, switch: 0.2,
  },
  smoke: {
    id: 'smoke', name: 'Smoke Grenade', type: 'throw', smoke: true,
    rate: 0.9, count: 1, fuse: 1.2, throwSpeed: 15,
    smokeTime: 11, radius: 5.5,
    spread: 0, moveSpread: 0, speedMul: 1.05, switch: 0.25,
  },
  vortex: {
    id: 'vortex', name: 'Vortex Grenade', type: 'throw', pull: true,
    rate: 0.9, count: 2, fuse: 1.8, throwSpeed: 17,
    splash: 45, radius: 6.5,
    spread: 0, moveSpread: 0, speedMul: 1.05, switch: 0.25,
  },
  impact: {
    id: 'impact', name: 'Impact Grenade', type: 'throw', impact: true,
    rate: 0.9, count: 2, fuse: 5, throwSpeed: 20, projGravity: 14,
    directDmg: 60, splash: 90, radius: 4,
    spread: 0, moveSpread: 0, speedMul: 1.05, switch: 0.25,
  },
};

export const SLOTS = [
  ['ar', 'br', 'carbine', 'smg', 'pdw', 'vector', 'burst', 'lmg', 'dmr', 'laser', 'minigun', 'sniper', 'amr', 'railgun',
    'shotgun', 'autoshot', 'slug', 'doublebarrel', 'gl', 'rocket', 'crossbow', 'harpoon'],
  ['pistol', 'bpistol', 'revolver', 'autorev', 'mpistol', 'microsmg', 'handcannon', 'sawedoff', 'flare'],
  ['knife', 'knuckles', 'machete', 'axe', 'katana', 'bat', 'sledge', 'scythe'],
  ['frag', 'sticky', 'impact', 'vortex', 'smoke', 'flash', 'tknife'],
];
export const SLOT_NAMES = ['Primary', 'Secondary', 'Melee', 'Utility'];
export const DEFAULT_LOADOUT = ['ar', 'pistol', 'knife', 'frag'];

export function validLoadout(l) {
  return Array.isArray(l) && l.length === 4 && l.every((id, i) => SLOTS[i].includes(id)) ? l.slice() : DEFAULT_LOADOUT.slice();
}

export const SHORT = {
  ar: 'AR', smg: 'SMG', burst: 'Burst', lmg: 'LMG', sniper: 'Sniper', shotgun: 'Shotgun', gl: 'Launcher',
  pistol: 'Pistol', revolver: 'Revolver', mpistol: 'M-Pistol', knife: 'Knife', axe: 'Axe',
  frag: 'Frag', sticky: 'Sticky', smoke: 'Smoke', claws: 'Claws',
  dmr: 'DMR', minigun: 'Minigun', doublebarrel: 'Dbl Barrel', rocket: 'Rocket', crossbow: 'Crossbow',
  handcannon: 'H-Cannon', sawedoff: 'Sawed-Off', katana: 'Katana', bat: 'Bat', flash: 'Flash', tknife: 'T-Knives',
  br: 'Battle', pdw: 'PDW', autoshot: 'Auto-SG', amr: 'AMR', railgun: 'Railgun', bpistol: 'B-Pistol', flare: 'Flare',
  machete: 'Machete', sledge: 'Sledge', impact: 'Impact',
  carbine: 'Carbine', vector: 'Vector', slug: 'Slug SG', laser: 'Laser', harpoon: 'Harpoon', microsmg: 'Micro SMG',
  autorev: 'Auto-Rev', knuckles: 'Knuckles', scythe: 'Scythe', vortex: 'Vortex',
};

// Menu summary: a one-line description plus 0..1 stat bars.
export function weaponInfo(id) {
  const w = WEAPONS[id];
  const tags = [];
  let dmg = 0, rate = 0, range = 0;
  if (w.type === 'gun') {
    tags.push(w.cycle === 'bolt' ? 'Bolt-action' : w.cycle === 'pump' ? 'Pump-action' : w.burst ? `${w.burst}-round burst` : w.auto ? 'Full-auto' : 'Semi-auto');
    tags.push(`${w.mag} rounds`);
    if (w.pellets > 1) tags.push(`${w.pellets} pellets`);
    if (w.scope) tags.push('Scoped');
    if (w.spinup) tags.push('Spins up');
    dmg = (w.dmg * w.pellets * (w.burst || 1)) / 110;
    rate = 0.06 / w.rate;
    range = w.falloff ? w.falloff[1] / 120 : w.range / 300;
  } else if (w.type === 'proj') {
    tags.push(w.bolt ? 'Bolt projectile' : 'Explosive', `${w.mag} round${w.mag > 1 ? 's' : ''}`);
    if (w.directDmg >= 999) tags.push('One-shot direct hit');
    dmg = Math.max(w.directDmg, w.splash || 0) / 110;
    rate = 0.25 / w.rate;
    range = w.projSpeed / 70;
  } else if (w.type === 'melee') {
    tags.push(w.style === 'chop' ? 'Heavy swing' : 'Quick slash', 'Backstabs');
    if (w.knockback) tags.push('Knockback');
    dmg = w.dmg / 110;
    rate = 0.3 / w.rate;
    range = w.range / 3.2;
  } else {
    tags.push(w.smoke ? 'Blocks vision' : w.flash ? 'Blinds' : w.sticky ? 'Sticks to targets' : w.bolt ? 'Thrown blade' : w.impact ? 'Explodes on impact' : w.pull ? 'Pulls players in' : `${w.fuse}s fuse`, `×${w.count}`);
    dmg = (w.splash || w.directDmg || 0) / 110;
    rate = 0.3 / w.rate;
    range = w.throwSpeed / 30;
  }
  const c = (v) => Math.max(0.04, Math.min(1, v));
  return {
    tag: tags.join(' · '),
    stats: [['Damage', c(dmg)], ['Fire rate', c(rate)], ['Range', c(range)], ['Mobility', c((w.speedMul - 0.6) / 0.6)]],
  };
}

// Gun Game: one kill per level; a melee kill knocks the victim down a level.
export const GUNGAME_LADDER = ['revolver', 'mpistol', 'smg', 'doublebarrel', 'burst', 'dmr', 'ar', 'minigun', 'sniper', 'rocket', 'handcannon', 'pistol', 'knife'];
