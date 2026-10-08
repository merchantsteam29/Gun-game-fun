import { WEAPONS } from './weapons.js';
import { store } from './util.js';

// Custom game rules: weapon restrictions, one-shot kills, and presets of rules + physics that
// hosts can pick, save and share as a short code.

// Weapon restrictions: each slot list is a pick-one-at-random pool (a new pick every life).
export const WEAPON_RULES = {
  any: { name: 'Any weapons (players pick)' },
  snipers: { name: 'Snipers only', slots: [['sniper', 'dmr', 'amr', 'railgun'], ['revolver', 'handcannon'], ['knife'], ['smoke']] },
  shotguns: { name: 'Shotguns only', slots: [['shotgun', 'autoshot', 'slug', 'doublebarrel'], ['sawedoff'], ['bat'], ['flash']] },
  rifles: { name: 'Rifles only', slots: [['ar', 'carbine', 'br', 'burst'], ['pistol'], ['knife'], ['frag']] },
  pistols: { name: 'Pistols only', slots: [['pistol', 'bpistol', 'handcannon', 'revolver', 'autorev', 'mpistol'], ['knife'], ['tknife']] },
  melee: { name: 'Melee only', slots: [['katana', 'axe', 'sledge', 'bat', 'pan'], ['knife'], ['tknife']] },
  explosives: { name: 'Explosives only', slots: [['rocket', 'gl'], ['flare'], ['bat'], ['frag', 'sticky']] },
  random: { name: 'Random loadout every life', random: true },
};

// Rules a preset can set, with their allowed values.
const RULE_SPEC = {
  health: { min: 10, max: 1000 }, respawn: { min: 0, max: 30 },
  infiniteAmmo: 'bool', headshotsOnly: 'bool', friendlyFire: 'bool', pickups: 'bool', oneShot: 'bool',
  weapons: Object.keys(WEAPON_RULES),
  gameSpeed: { min: 0.25, max: 2 }, moveSpeed: { min: 0.5, max: 2.5 }, jump: { min: 0.5, max: 3 }, gravity: { min: 0.2, max: 2 },
};
export const RULE_DEFAULTS = {
  health: 100, respawn: 3, infiniteAmmo: false, headshotsOnly: false, friendlyFire: false, pickups: true, oneShot: false,
  weapons: 'any', gameSpeed: 1, moveSpeed: 1, jump: 1, gravity: 1,
};

// Only known rules with sane values.
export function cleanRules(r) {
  const out = {};
  if (!r || typeof r !== 'object') return out;
  for (const [k, spec] of Object.entries(RULE_SPEC)) {
    if (!(k in r)) continue;
    const v = r[k];
    if (spec === 'bool') out[k] = !!v;
    else if (Array.isArray(spec)) { if (spec.includes(v)) out[k] = v; }
    else if (Number.isFinite(Number(v))) out[k] = Math.max(spec.min, Math.min(spec.max, Math.round(Number(v) * 100) / 100));
  }
  return out;
}

export const RULE_PRESETS = [
  { id: 'classic', name: 'Classic', desc: 'Normal rules', rules: {} },
  { id: 'snipers', name: 'Snipers only', desc: 'Snipers and revolvers, no pickups', rules: { weapons: 'snipers', pickups: false } },
  { id: 'oneshot', name: 'One shot, one kill', desc: 'Every hit kills', rules: { oneShot: true } },
  { id: 'knives', name: 'Moon knife fight', desc: 'Melee only, low gravity, big jumps', rules: { weapons: 'melee', gravity: 0.4, jump: 1.6, moveSpeed: 1.2 } },
  { id: 'shotguns', name: 'Shotgun madness', desc: 'Shotguns only, a bit faster', rules: { weapons: 'shotguns', moveSpeed: 1.15 } },
  { id: 'pistols', name: 'Pistol duel', desc: 'Pistols only, 60 health', rules: { weapons: 'pistols', health: 60 } },
  { id: 'boom', name: 'Boom boom', desc: 'Explosives only, infinite ammo', rules: { weapons: 'explosives', infiniteAmmo: true } },
  { id: 'moon', name: 'Moon gravity', desc: 'Low gravity, high jumps', rules: { gravity: 0.3, jump: 1.5 } },
  { id: 'speed', name: 'Speed demons', desc: 'Everything faster', rules: { gameSpeed: 1.3, moveSpeed: 1.5 } },
  { id: 'tanks', name: 'Tanks', desc: '300 health, 5 s respawn', rules: { health: 300, respawn: 5 } },
  { id: 'headhunt', name: 'Headhunters', desc: 'Only headshots count, rifles only', rules: { headshotsOnly: true, weapons: 'rifles' } },
  { id: 'chaos', name: 'Chaos', desc: 'Random loadout every life, infinite ammo, fast', rules: { weapons: 'random', infiniteAmmo: true, gameSpeed: 1.15 } },
];
// A preset's full rule set (defaults for anything it doesn't set).
export const presetRules = (p) => ({ ...RULE_DEFAULTS, ...cleanRules(p.rules) });

// Your saved presets (this device).
export const savedPresets = () => (store.get('rulePresets', []) || []).filter((p) => p && p.name).map((p) => ({ ...p, rules: cleanRules(p.rules), saved: true }));
export function savePreset(name, rules) {
  const list = savedPresets().filter((p) => p.name !== name).slice(0, 19);
  list.unshift({ id: 'my' + Date.now().toString(36), name: String(name).slice(0, 24), desc: 'Saved', rules: cleanRules(rules) });
  store.set('rulePresets', list);
  return list[0];
}
export function deletePreset(id) { store.set('rulePresets', savedPresets().filter((p) => p.id !== id)); }

// Share codes: the rules that differ from the defaults, packed into "R-…".
export function shareCode(name, rules) {
  const diff = {};
  for (const [k, v] of Object.entries(cleanRules(rules))) if (v !== RULE_DEFAULTS[k]) diff[k] = v;
  const json = JSON.stringify({ n: String(name || 'Custom').slice(0, 24), r: diff });
  return 'R-' + btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function readCode(code) {
  try {
    const s = String(code).trim().replace(/^R-/i, '').replace(/-/g, '+').replace(/_/g, '/');
    const o = JSON.parse(decodeURIComponent(escape(atob(s))));
    return { name: String(o.n || 'Shared rules').slice(0, 24), rules: { ...RULE_DEFAULTS, ...cleanRules(o.r) } };
  } catch { return null; }
}

// A loadout for a weapon rule (null = players use their own).
export function ruleLoadout(id) {
  const r = WEAPON_RULES[id];
  if (!r || id === 'any') return null;
  const pick = (a) => a[(Math.random() * a.length) | 0];
  if (r.random) return null; // handled by the host like Roulette
  return r.slots.map(pick).filter((w) => WEAPONS[w]);
}
