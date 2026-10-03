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
    rate: 0.085, dmg: 20, head: 1.5, pellets: 1, mag: 100, reload: 4.2,
    spread: 0.02, moveSpread: 0.05, adsMul: 0.35, range: 250,
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

  // ---------- Secondaries ----------
  pistol: {
    id: 'pistol', name: 'Pistol', type: 'gun', auto: false,
    rate: 0.15, dmg: 27, head: 2.0, pellets: 1, mag: 12, reload: 1.4,
    spread: 0.012, moveSpread: 0.025, adsMul: 0.35, range: 150,
    recoil: 0.025, speedMul: 1.05, switch: 0.25, reloadStyle: 'mag',
  },
  revolver: {
    id: 'revolver', name: 'Revolver', type: 'gun', auto: false,
    rate: 0.5, dmg: 50, head: 2.0, pellets: 1, mag: 6, reload: 2.2,
    spread: 0.01, moveSpread: 0.03, adsMul: 0.3, range: 180,
    recoil: 0.06, speedMul: 1.05, switch: 0.3, reloadStyle: 'revolver',
  },
  mpistol: {
    id: 'mpistol', name: 'Machine Pistol', type: 'gun', auto: true,
    rate: 0.07, dmg: 13, head: 1.5, pellets: 1, mag: 20, reload: 1.5,
    spread: 0.03, moveSpread: 0.02, adsMul: 0.6, range: 80, falloff: [10, 30, 0.5],
    recoil: 0.008, speedMul: 1.05, switch: 0.25, reloadStyle: 'mag',
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
  smoke: {
    id: 'smoke', name: 'Smoke Grenade', type: 'throw', smoke: true,
    rate: 0.9, count: 1, fuse: 1.2, throwSpeed: 15,
    smokeTime: 11, radius: 5.5,
    spread: 0, moveSpread: 0, speedMul: 1.05, switch: 0.25,
  },
};

export const SLOTS = [
  ['ar', 'smg', 'burst', 'lmg', 'sniper', 'shotgun', 'gl'],
  ['pistol', 'revolver', 'mpistol'],
  ['knife', 'axe'],
  ['frag', 'sticky', 'smoke'],
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
};

// Gun Game: one kill per level; a melee kill knocks the victim down a level.
export const GUNGAME_LADDER = ['revolver', 'mpistol', 'smg', 'shotgun', 'burst', 'ar', 'lmg', 'sniper', 'gl', 'pistol', 'knife'];
