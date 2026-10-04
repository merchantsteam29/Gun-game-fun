import { store } from './util.js';

// Cosmetics shown on your character to other players. `free` items are unlocked from the start;
// the rest are mission rewards.
export const COSMETICS = {
  hat: [
    { id: 'helmet', name: 'Combat Helmet', free: true },
    { id: 'none', name: 'No Hat', free: true },
    { id: 'cap', name: 'Baseball Cap' },
    { id: 'beanie', name: 'Beanie' },
    { id: 'cowboy', name: 'Cowboy Hat' },
    { id: 'tophat', name: 'Top Hat' },
    { id: 'crown', name: 'Crown' },
    { id: 'viking', name: 'Viking Helmet' },
    { id: 'party', name: 'Party Hat' },
    { id: 'halo', name: 'Halo' },
    { id: 'headband', name: 'Headband' },
  ],
  hair: [
    { id: 'none', name: 'Buzz Cut', free: true },
    { id: 'short', name: 'Short', free: true },
    { id: 'mohawk', name: 'Mohawk' },
    { id: 'long', name: 'Long' },
    { id: 'spiky', name: 'Spiky' },
  ],
  face: [
    { id: 'goggles', name: 'Goggles', free: true },
    { id: 'none', name: 'Nothing', free: true },
    { id: 'shades', name: 'Shades' },
    { id: 'bandana', name: 'Bandana' },
    { id: 'mustache', name: 'Mustache' },
  ],
  back: [
    { id: 'backpack', name: 'Backpack', free: true },
    { id: 'none', name: 'Nothing', free: true },
    { id: 'jetpack', name: 'Jetpack' },
    { id: 'cape', name: 'Cape' },
  ],
};
export const SLOT_LABELS = { hat: 'Hat', hair: 'Hair', face: 'Face', back: 'Back' };
export const HAIR_COLORS = ['#3b2a1e', '#111111', '#e3c16f', '#b5462a', '#3d6fd8', '#e86fb6', '#e8e8e8'];
export const DEFAULT_COS = { hat: 'helmet', hair: 'none', hairColor: HAIR_COLORS[0], face: 'goggles', back: 'backpack' };

// Each mission tracks one lifetime stat and unlocks one item.
export const MISSIONS = [
  { id: 'first', name: 'First Blood', desc: 'Get your first kill', stat: 'kills', goal: 1, reward: ['hat', 'cap'] },
  { id: 'regular', name: 'Regular', desc: 'Play 3 matches to the end', stat: 'matches', goal: 3, reward: ['hat', 'beanie'] },
  { id: 'sharp', name: 'Sharpshooter', desc: 'Get 10 headshot kills', stat: 'headshots', goal: 10, reward: ['face', 'shades'] },
  { id: 'blades', name: 'Blademaster', desc: 'Get 10 melee kills', stat: 'melee', goal: 10, reward: ['face', 'bandana'] },
  { id: 'sidearm', name: 'Sidearm Specialist', desc: 'Get 25 kills with secondaries', stat: 'secondary', goal: 25, reward: ['face', 'mustache'] },
  { id: 'boom', name: 'Demolition', desc: 'Get 10 explosive kills', stat: 'explosive', goal: 10, reward: ['back', 'jetpack'] },
  { id: 'streak', name: 'On a Roll', desc: 'Get 5 kills in one life', stat: 'bestStreak', goal: 5, reward: ['hair', 'mohawk'] },
  { id: 'slayer', name: 'Slayer', desc: 'Get 50 kills', stat: 'kills', goal: 50, reward: ['hat', 'cowboy'] },
  { id: 'champ', name: 'Champion', desc: 'Win a match', stat: 'wins', goal: 1, reward: ['hat', 'crown'] },
  { id: 'giant', name: 'Giant Slayer', desc: 'Kill the Juggernaut 3 times', stat: 'juggKills', goal: 3, reward: ['hat', 'viking'] },
  { id: 'ladder', name: 'Ladder Climber', desc: 'Get 20 kills in Gun Game', stat: 'gungameKills', goal: 20, reward: ['hat', 'tophat'] },
  { id: 'survivor', name: 'Survivor', desc: 'Survive an Infection round', stat: 'survived', goal: 1, reward: ['hat', 'halo'] },
  { id: 'veteran', name: 'Veteran', desc: 'Play 10 matches to the end', stat: 'matches', goal: 10, reward: ['hair', 'long'] },
  { id: 'winner', name: 'Serial Winner', desc: 'Win 3 matches', stat: 'wins', goal: 3, reward: ['back', 'cape'] },
  { id: 'centurion', name: 'Centurion', desc: 'Get 100 kills', stat: 'kills', goal: 100, reward: ['hair', 'spiky'] },
  { id: 'hill', name: 'King Maker', desc: 'Score 120 objective points (King of the Hill)', stat: 'hillPoints', goal: 120, reward: ['hat', 'headband'] },
  { id: 'party', name: 'Party Animal', desc: 'Play 5 different game modes', stat: 'modesPlayed', goal: 5, reward: ['hat', 'party'] },
];

const stats = { ...store.get('stats', {}) };
const modes = new Set(store.get('modesPlayed', []));
let streak = 0;

export const getStat = (k) => (k === 'modesPlayed' ? modes.size : stats[k] || 0);
export const missionDone = (m) => getStat(m.stat) >= m.goal;

export function isUnlocked(slot, id) {
  const item = COSMETICS[slot].find((c) => c.id === id);
  if (!item) return false;
  if (item.free) return true;
  const m = MISSIONS.find((x) => x.reward[0] === slot && x.reward[1] === id);
  return !m || missionDone(m);
}
export const missionFor = (slot, id) => MISSIONS.find((x) => x.reward[0] === slot && x.reward[1] === id);

// Equipped cosmetics; anything that isn't unlocked (or no longer exists) falls back to default.
export function getCos() {
  const c = { ...DEFAULT_COS, ...store.get('cos', {}) };
  for (const slot of Object.keys(COSMETICS)) if (!isUnlocked(slot, c[slot])) c[slot] = DEFAULT_COS[slot];
  if (!HAIR_COLORS.includes(c.hairColor)) c.hairColor = DEFAULT_COS.hairColor;
  return c;
}
export function setCos(c) { store.set('cos', c); }

// Host-side check of cosmetics sent by players (unknown ids are dropped).
export function sanitizeCos(c) {
  const out = { ...DEFAULT_COS };
  if (!c || typeof c !== 'object') return out;
  for (const slot of Object.keys(COSMETICS)) if (COSMETICS[slot].some((x) => x.id === c[slot])) out[slot] = c[slot];
  if (HAIR_COLORS.includes(c.hairColor)) out.hairColor = c.hairColor;
  return out;
}
export function randomCos() {
  const pick = (a) => a[(Math.random() * a.length) | 0];
  const c = { hairColor: pick(HAIR_COLORS) };
  for (const slot of Object.keys(COSMETICS)) c[slot] = pick(COSMETICS[slot]).id;
  return c;
}

// Records game events; returns the missions this event completed.
let onComplete = () => {};
export function onMissionComplete(fn) { onComplete = fn; }

function bump(updates, pre = null) {
  const before = MISSIONS.filter(missionDone).map((m) => m.id);
  if (pre) pre();
  for (const [k, v] of Object.entries(updates)) {
    if (k === 'bestStreak') stats[k] = Math.max(stats[k] || 0, v);
    else stats[k] = (stats[k] || 0) + v;
  }
  store.set('stats', stats);
  const done = MISSIONS.filter((m) => missionDone(m) && !before.includes(m.id));
  for (const m of done) onComplete(m);
  return done;
}

export const track = {
  kill({ weaponType, head, secondary, explosive, juggernaut, mode }) {
    streak++;
    const u = { kills: 1, bestStreak: streak };
    if (head) u.headshots = 1;
    if (weaponType === 'melee') u.melee = 1;
    if (secondary) u.secondary = 1;
    if (explosive) u.explosive = 1;
    if (juggernaut) u.juggKills = 1;
    if (mode === 'gungame') u.gungameKills = 1;
    bump(u);
  },
  died() { streak = 0; },
  matchEnd({ mode, won, survived, hillPoints }) {
    streak = 0;
    const u = { matches: 1 };
    if (won) u.wins = 1;
    if (survived) u.survived = 1;
    if (hillPoints) u.hillPoints = hillPoints;
    bump(u, () => { modes.add(mode); store.set('modesPlayed', [...modes]); });
  },
};
