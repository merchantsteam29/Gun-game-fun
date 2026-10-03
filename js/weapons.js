// Weapon definitions. Slot layout: [primary, secondary, melee, utility].
export const WEAPONS = {
  ar: {
    id: 'ar', name: 'Assault Rifle', type: 'gun', auto: true,
    rate: 0.095, dmg: 21, head: 1.7, pellets: 1, mag: 30, reload: 2.0,
    spread: 0.012, moveSpread: 0.035, adsMul: 0.3, range: 250,
    recoil: 0.014, speedMul: 1.0, switch: 0.35,
  },
  shotgun: {
    id: 'shotgun', name: 'Shotgun', type: 'gun', auto: false,
    rate: 0.85, dmg: 13, head: 1.3, pellets: 10, mag: 6, reload: 2.5,
    spread: 0.075, moveSpread: 0.02, adsMul: 0.75, range: 60,
    falloff: [8, 30, 0.3], // full damage until 8m, down to 30% at 30m
    recoil: 0.05, speedMul: 0.95, switch: 0.4,
  },
  gl: {
    id: 'gl', name: 'Grenade Launcher', type: 'proj', auto: false,
    rate: 1.0, mag: 4, reload: 3.0,
    projSpeed: 30, projGravity: 9,
    directDmg: 999, // one-shot on a direct hit
    splash: 80, radius: 4.5,
    spread: 0, moveSpread: 0, adsMul: 1,
    recoil: 0.06, speedMul: 0.68, // heavy: slows you down while equipped
    switch: 0.6,
  },
  pistol: {
    id: 'pistol', name: 'Pistol', type: 'gun', auto: false,
    rate: 0.15, dmg: 27, head: 2.0, pellets: 1, mag: 12, reload: 1.4,
    spread: 0.012, moveSpread: 0.025, adsMul: 0.35, range: 150,
    recoil: 0.025, speedMul: 1.05, switch: 0.25,
  },
  knife: {
    id: 'knife', name: 'Combat Knife', type: 'melee',
    rate: 0.5, dmg: 55, backstab: 150, range: 2.4,
    spread: 0, moveSpread: 0, speedMul: 1.15, switch: 0.2,
  },
  frag: {
    id: 'frag', name: 'Frag Grenade', type: 'throw',
    rate: 0.9, count: 2, fuse: 2.3, throwSpeed: 17,
    splash: 110, radius: 5.5,
    spread: 0, moveSpread: 0, speedMul: 1.05, switch: 0.25,
  },
};

export const PRIMARIES = ['ar', 'shotgun', 'gl'];
export const SLOT_NAMES = ['Primary', 'Secondary', 'Melee', 'Utility'];
export const loadoutFor = (primary) => [primary, 'pistol', 'knife', 'frag'];
