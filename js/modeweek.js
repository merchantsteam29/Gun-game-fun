// Mode of the week: one goofy mix of a mode and special rules, the same for everyone, changing
// every Monday (00:00 UTC). Finishing 3 matches of it in a week pays tokens (no XP).

export const MOTW_TOKENS = 150;
export const MOTW_MATCHES = 3;
const WEEK = 7 * 864e5, EPOCH = Date.UTC(2026, 9, 5); // a Monday

export const MOTW_LIST = [
  { id: 'moonsnipers', icon: '🌕', name: 'Moon Snipers', desc: 'Snipers only, in low gravity. Float and flick.', mode: 'ffa', rules: { weapons: 'snipers', gravity: 0.3, jump: 1.5, pickups: false } },
  { id: 'knifefrenzy', icon: '🔪', name: 'Knife Frenzy', desc: 'Melee only, and everything is way faster.', mode: 'ffa', rules: { weapons: 'melee', gameSpeed: 1.3, moveSpeed: 1.5 } },
  { id: 'tankrockets', icon: '🚀', name: 'Tank Rockets', desc: 'Team Deathmatch with explosives only, 300 health, endless ammo.', mode: 'tdm', rules: { weapons: 'explosives', health: 300, infiniteAmmo: true } },
  { id: 'pistolpanic', icon: '🧟', name: 'Pistol Panic', desc: 'Infection, but survivors only get pistols.', mode: 'infection', rules: { weapons: 'pistols' } },
  { id: 'oneshotgg', icon: '🎯', name: 'One-Shot Gun Game', desc: 'Gun Game where every hit kills.', mode: 'gungame', rules: { oneShot: true } },
  { id: 'chaosctf', icon: '🌀', name: 'Chaos CTF', desc: 'Capture the Flag with random loadouts every life and endless ammo.', mode: 'ctf', rules: { weapons: 'random', infiniteAmmo: true, gameSpeed: 1.15 } },
  { id: 'headhill', icon: '🧠', name: 'Headshot Hill', desc: 'King of the Hill where only headshots count.', mode: 'koth', rules: { headshotsOnly: true, weapons: 'rifles' } },
  { id: 'moonzombies', icon: '🪐', name: 'Moon Zombies', desc: 'Zombie Survival in low gravity. Zombies jump too.', mode: 'zombies', rules: { gravity: 0.4, jump: 1.6 } },
];

export const motwWeek = (t = Date.now()) => Math.floor((t - EPOCH) / WEEK);
export const motwNow = (t = Date.now()) => MOTW_LIST[((motwWeek(t) % MOTW_LIST.length) + MOTW_LIST.length) % MOTW_LIST.length];
export const motwEnds = (t = Date.now()) => EPOCH + (motwWeek(t) + 1) * WEEK;
