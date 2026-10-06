import { WEAPONS } from './weapons.js';
import { CAMO_IDS } from './camos.js';

// Weapon attachments ("mods"), picked per gun in the Loadout section.
// Four slots — optic, muzzle, magazine, underbarrel — each with a few choices that trade stats.
// Which choices a gun can take depends on its kind (see PROFILES / KIND). Models show every
// attachment (models.js / guns.js), and other players see your attachments too.

export const MOD_SLOTS = ['optic', 'muzzle', 'mag', 'under'];
export const MOD_SLOT_NAMES = { optic: 'Optic', muzzle: 'Muzzle', mag: 'Magazine', under: 'Underbarrel' };

// eff: how a mod changes the gun (applied in statsFor).
export const MODS = {
  optic: {
    irons: { name: 'Iron sights', desc: 'No optic: the fastest to aim with.', eff: { adsSpeed: 1.15 } },
    reddot: { name: 'Red dot', desc: 'Clear dot sight with a slight zoom.', eff: { adsFov: 52 } },
    holo: { name: 'Holographic', desc: 'Wide window and ring reticle: a little steadier.', eff: { adsFov: 49, adsMul: 0.9, adsSpeed: 0.95 } },
    lpvo: { name: '2.5× scope', desc: 'Magnified and steady, but slower to aim.', eff: { adsFov: 30, adsMul: 0.7, adsSpeed: 0.8 } },
    scope: { name: '6× sniper scope', desc: 'Full scope view, pinpoint accurate, slow to aim.', eff: { scope: true, zoom: 20, adsMul: 0, adsSpeed: 0.7 } },
  },
  muzzle: {
    none: { name: 'Standard', desc: 'The gun\'s own muzzle.', eff: {} },
    suppressor: { name: 'Suppressor', desc: 'Much quieter and no muzzle flash for others. Damage drops off a bit sooner.', eff: { quiet: true, falloffMul: 0.85, recoilMul: 0.95 } },
    comp: { name: 'Compensator', desc: '30% less recoil, slightly more spread while moving.', eff: { recoilMul: 0.7, moveSpreadMul: 1.1 } },
  },
  mag: {
    std: { name: 'Standard', desc: 'Normal capacity and reload.', eff: {} },
    ext: { name: 'Extended mag', desc: '+50% ammo, but slower reloads and a little slower movement.', eff: { magMul: 1.5, reloadMul: 1.15, speedAdd: -0.03 } },
    fast: { name: 'Fast mag', desc: 'Reloads 25% faster.', eff: { reloadMul: 0.75 } },
  },
  under: {
    none: { name: 'None', desc: 'Nothing under the barrel.', eff: {} },
    grip: { name: 'Vertical grip', desc: '20% less recoil and steadier while moving.', eff: { recoilMul: 0.8, moveSpreadMul: 0.85 } },
    laser: { name: 'Laser', desc: 'Tighter hip-fire (aiming down sights is unchanged).', eff: { hipMul: 0.72 } },
  },
};

// What each kind of gun can take (first optic listed = its usual sight if no default given).
const PROFILES = {
  rifle: { optic: ['irons', 'reddot', 'holo', 'lpvo'], muzzle: ['none', 'suppressor', 'comp'], mag: ['std', 'ext', 'fast'], under: ['none', 'grip', 'laser'] },
  smg: { optic: ['irons', 'reddot', 'holo'], muzzle: ['none', 'suppressor', 'comp'], mag: ['std', 'ext', 'fast'], under: ['none', 'grip', 'laser'] },
  lmg: { optic: ['irons', 'reddot', 'holo', 'lpvo'], muzzle: ['none', 'suppressor', 'comp'], mag: ['std', 'ext', 'fast'], under: ['none', 'grip', 'laser'] },
  marksman: { optic: ['irons', 'reddot', 'holo', 'lpvo', 'scope'], muzzle: ['none', 'suppressor', 'comp'], mag: ['std', 'ext', 'fast'], under: ['none', 'grip', 'laser'] },
  sniper: { optic: ['lpvo', 'scope'], muzzle: ['none', 'suppressor', 'comp'], mag: ['std', 'ext', 'fast'], under: ['none'] },
  energy: { optic: ['irons', 'reddot', 'holo', 'lpvo', 'scope'], muzzle: ['none'], mag: ['std', 'ext', 'fast'], under: ['none', 'grip', 'laser'] },
  shotgun: { optic: ['irons', 'reddot', 'holo'], muzzle: ['none', 'comp'], mag: ['std', 'ext', 'fast'], under: ['none', 'grip', 'laser'] },
  breakaction: { optic: ['irons', 'reddot'], muzzle: ['none'], mag: ['std', 'fast'], under: ['none', 'laser'] },
  pistol: { optic: ['irons', 'reddot'], muzzle: ['none', 'suppressor', 'comp'], mag: ['std', 'ext', 'fast'], under: ['none', 'laser'] },
  revolver: { optic: ['irons', 'reddot'], muzzle: ['none', 'comp'], mag: ['std', 'fast'], under: ['none', 'laser'] },
  launcher: { optic: ['irons', 'reddot'], muzzle: ['none'], mag: ['std', 'fast'], under: ['none', 'laser'] },
  bow: { optic: ['irons', 'reddot', 'lpvo'], muzzle: ['none'], mag: ['std', 'fast'], under: ['none', 'laser'] },
  heavy: { optic: ['irons'], muzzle: ['none'], mag: ['std', 'ext', 'fast'], under: ['none'] },
};

// Each gun's kind and the sight it comes with.
const KIND = {
  ar: ['rifle', 'holo'], carbine: ['rifle', 'reddot'], br: ['rifle', 'irons'], burst: ['rifle', 'irons'],
  smg: ['smg', 'irons'], pdw: ['smg', 'reddot'], vector: ['smg', 'irons'],
  lmg: ['lmg', 'irons'], minigun: ['heavy', 'irons'],
  dmr: ['marksman', 'lpvo'], sniper: ['sniper', 'scope'], amr: ['sniper', 'scope'],
  laser: ['energy', 'reddot'], railgun: ['energy', 'reddot'],
  shotgun: ['shotgun', 'irons'], autoshot: ['shotgun', 'irons'], slug: ['shotgun', 'irons'],
  doublebarrel: ['breakaction', 'irons'], sawedoff: ['breakaction', 'irons'],
  pistol: ['pistol', 'irons'], bpistol: ['pistol', 'irons'], handcannon: ['pistol', 'irons'], mpistol: ['pistol', 'irons'], microsmg: ['pistol', 'irons'],
  revolver: ['revolver', 'irons'], autorev: ['revolver', 'irons'],
  gl: ['launcher', 'irons'], rocket: ['launcher', 'irons'], flare: ['launcher', 'irons'],
  crossbow: ['bow', 'irons'], harpoon: ['bow', 'irons'],
  flamethrower: ['heavy', 'irons'], nailgun: ['launcher', 'irons'],
};

export const modOptions = (id) => (KIND[id] ? PROFILES[KIND[id][0]] : null);
export const hasMods = (id) => !!KIND[id];

export function defaultMods(id) {
  if (!KIND[id]) return null;
  return { optic: KIND[id][1], muzzle: 'none', mag: 'std', under: 'none' };
}

// Keeps only valid choices for this gun (anything else falls back to the default).
export function cleanMods(id, m) {
  const d = defaultMods(id);
  if (!d) return null;
  const opts = modOptions(id), out = { ...d };
  if (m && typeof m === 'object') for (const s of MOD_SLOTS) if (opts[s].includes(m[s])) out[s] = m[s];
  if (m && m.camo !== 'default' && CAMO_IDS.includes(m.camo)) out.camo = m.camo; // looks only (camos.js)
  return out;
}

// All of a player's mods (weapon id -> mods), cleaned; only guns that take mods.
export function cleanModMap(map) {
  const out = {};
  if (!map || typeof map !== 'object') return out;
  for (const id of Object.keys(map).slice(0, 60)) if (hasMods(id)) out[id] = cleanMods(id, map[id]);
  return out;
}

export function randomMods(id) {
  const opts = modOptions(id);
  if (!opts) return null;
  const pick = (a) => a[(Math.random() * a.length) | 0];
  const m = defaultMods(id);
  for (const s of MOD_SLOTS) if (Math.random() < 0.5) m[s] = pick(opts[s]);
  if (Math.random() < 0.4) m.camo = pick(CAMO_IDS.slice(1)); // bots show off camos too
  return m;
}

// A gun's stats with its mods applied (a copy; WEAPONS itself is never changed).
export function statsFor(id, mods) {
  const base = WEAPONS[id];
  if (!base || !hasMods(id)) return base;
  const m = cleanMods(id, mods);
  const w = { ...base, mods: m };
  w.adsSpeed = 1;
  const fx = [MODS.optic[m.optic], MODS.muzzle[m.muzzle], MODS.mag[m.mag], MODS.under[m.under]].map((x) => x.eff || {});
  // Optic: zoom and steadiness. Guns that come with a big scope lose it with a smaller optic.
  const o = fx[0];
  if (o.scope) { w.scope = true; w.zoom = base.scope ? base.zoom : o.zoom; }
  else { w.scope = false; delete w.zoom; }
  if (o.adsFov) w.adsFov = o.adsFov;
  else if (m.optic === 'irons') delete w.adsFov; // standard aim zoom
  if (o.adsMul !== undefined) w.adsMul = o.adsMul === 0 ? 0 : (base.adsMul || 0) * o.adsMul;
  if (base.scope && !o.scope) w.adsMul = Math.max(w.adsMul, 0.12); // a sniper without its scope isn't pinpoint
  for (const e of fx) {
    if (e.adsSpeed) w.adsSpeed *= e.adsSpeed;
    if (e.recoilMul) w.recoil = (w.recoil || 0) * e.recoilMul;
    if (e.moveSpreadMul) w.moveSpread = (w.moveSpread || 0) * e.moveSpreadMul;
    if (e.falloffMul && w.falloff) w.falloff = [w.falloff[0] * e.falloffMul, w.falloff[1] * e.falloffMul, w.falloff[2]];
    if (e.magMul && w.mag) w.mag = Math.max(w.mag + 1, Math.round(w.mag * e.magMul));
    if (e.reloadMul && w.reload) w.reload = Math.round(w.reload * e.reloadMul * 100) / 100;
    if (e.speedAdd) w.speedMul = (w.speedMul || 1) + e.speedAdd;
    if (e.hipMul) { w.spread = (w.spread || 0) * e.hipMul; if (w.adsMul) w.adsMul /= e.hipMul; } // hip only
    if (e.quiet) w.quiet = true;
  }
  return w;
}
