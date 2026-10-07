import { store } from './util.js';
import { camoOf } from './camos.js';

// Cosmetics shown on your character to other players. `free` items are owned from the start;
// everything else is bought with tokens earned from missions (`price`).
export const COSMETICS = {
  hat: [
    { id: 'helmet', name: 'Combat Helmet', free: true },
    { id: 'none', name: 'No Hat', free: true },
    { id: 'cap', name: 'Baseball Cap', price: 100 },
    { id: 'beanie', name: 'Beanie', price: 100 },
    { id: 'headband', name: 'Headband', price: 150 },
    { id: 'chef', name: 'Chef Hat', price: 200 },
    { id: 'party', name: 'Party Hat', price: 200 },
    { id: 'bunny', name: 'Bunny Ears', price: 250 },
    { id: 'catears', name: 'Cat Ears', price: 250 },
    { id: 'cowboy', name: 'Cowboy Hat', price: 250 },
    { id: 'tophat', name: 'Top Hat', price: 300 },
    { id: 'pirate', name: 'Pirate Hat', price: 300 },
    { id: 'sombrero', name: 'Sombrero', price: 300 },
    { id: 'wizard', name: 'Wizard Hat', price: 350 },
    { id: 'viking', name: 'Viking Helmet', price: 400 },
    { id: 'halo', name: 'Halo', price: 500 },
    { id: 'crown', name: 'Crown', price: 600 },
    { id: 'beret', name: 'Beret', price: 150 },
    { id: 'propeller', name: 'Propeller Cap', price: 200 },
    { id: 'santa', name: 'Santa Hat', price: 250 },
    { id: 'antlers', name: 'Antlers', price: 300 },
    { id: 'samurai', name: 'Samurai Helmet', price: 450 },
    { id: 'astro', name: 'Space Helmet', price: 550 },
  ],
  hair: [
    { id: 'none', name: 'Buzz Cut', free: true },
    { id: 'short', name: 'Short', free: true },
    { id: 'mohawk', name: 'Mohawk', price: 150 },
    { id: 'long', name: 'Long', price: 150 },
    { id: 'ponytail', name: 'Ponytail', price: 150 },
    { id: 'spiky', name: 'Spiky', price: 200 },
    { id: 'afro', name: 'Afro', price: 200 },
    { id: 'bun', name: 'Top Bun', price: 150 },
    { id: 'mullet', name: 'Mullet', price: 200 },
  ],
  face: [
    { id: 'goggles', name: 'Goggles', free: true },
    { id: 'none', name: 'Nothing', free: true },
    { id: 'mustache', name: 'Mustache', price: 100 },
    { id: 'clown', name: 'Clown Nose', price: 100 },
    { id: 'shades', name: 'Shades', price: 150 },
    { id: 'bandana', name: 'Bandana', price: 150 },
    { id: 'eyepatch', name: 'Eyepatch', price: 150 },
    { id: 'gasmask', name: 'Gas Mask', price: 300 },
    { id: 'beard', name: 'Beard', price: 150 },
    { id: 'monocle', name: 'Monocle', price: 200 },
    { id: 'visor', name: 'Cyber Visor', price: 350 },
    { id: 'skull', name: 'Skull Mask', price: 400 },
  ],
  back: [
    { id: 'backpack', name: 'Backpack', free: true },
    { id: 'none', name: 'Nothing', free: true },
    { id: 'guitar', name: 'Guitar', price: 250 },
    { id: 'cape', name: 'Cape', price: 300 },
    { id: 'sword', name: 'Sword', price: 350 },
    { id: 'staff', name: 'Wizard Staff', price: 350 },
    { id: 'jetpack', name: 'Jetpack', price: 400 },
    { id: 'wings', name: 'Angel Wings', price: 600 },
    { id: 'quiver', name: 'Quiver', price: 250 },
    { id: 'surfboard', name: 'Surfboard', price: 300 },
    { id: 'shield', name: 'Shield', price: 350 },
    { id: 'demon', name: 'Demon Wings', price: 650 },
  ],
  // Shown behind your name on the death screen of everyone you kill (see banners.js).
  banner: [
    { id: 'standard', name: 'Standard', free: true },
    { id: 'carbon', name: 'Carbon', free: true },
    { id: 'tiger', name: 'Tiger', price: 150 },
    { id: 'camo', name: 'Woodland Camo', price: 150 },
    { id: 'arctic', name: 'Arctic Camo', price: 150 },
    { id: 'ocean', name: 'Ocean', price: 200 },
    { id: 'sunset', name: 'Sunset', price: 200 },
    { id: 'toxic', name: 'Hazard', price: 200 },
    { id: 'blood', name: 'Bloodbath', price: 250 },
    { id: 'neon', name: 'Neon Grid', price: 300 },
    { id: 'matrix', name: 'Code Rain', price: 300 },
    { id: 'flames', name: 'Inferno', price: 350 },
    { id: 'galaxy', name: 'Galaxy', price: 350 },
    { id: 'dragon', name: 'Dragon Scale', price: 400 },
    { id: 'rainbow', name: 'Rainbow', price: 450 },
    { id: 'gold', name: 'Solid Gold', price: 600 },
    { id: 'diamond', name: 'Diamond', price: 800 },
  ],
};
export const SLOT_LABELS = { hat: 'Hat', hair: 'Hair', face: 'Face', back: 'Back', banner: 'Banner' };
export const HAIR_COLORS = ['#3b2a1e', '#111111', '#e3c16f', '#b5462a', '#3d6fd8', '#e86fb6', '#e8e8e8'];
export const DEFAULT_COS = { hat: 'helmet', hair: 'none', hairColor: HAIR_COLORS[0], face: 'goggles', back: 'backpack', banner: 'standard' };

// Each mission tracks one lifetime stat and pays tokens once when finished.
export const MISSIONS = [
  { id: 'first', name: 'First Blood', desc: 'Get your first kill', stat: 'kills', goal: 1, tokens: 50 },
  { id: 'warm', name: 'Warming Up', desc: 'Get 10 kills', stat: 'kills', goal: 10, tokens: 75 },
  { id: 'slayer', name: 'Slayer', desc: 'Get 50 kills', stat: 'kills', goal: 50, tokens: 150 },
  { id: 'centurion', name: 'Centurion', desc: 'Get 100 kills', stat: 'kills', goal: 100, tokens: 250 },
  { id: 'exec', name: 'Executioner', desc: 'Get 250 kills', stat: 'kills', goal: 250, tokens: 400 },
  { id: 'legend', name: 'Legend', desc: 'Get 500 kills', stat: 'kills', goal: 500, tokens: 700 },
  { id: 'sharp', name: 'Sharpshooter', desc: 'Get 10 headshot kills', stat: 'headshots', goal: 10, tokens: 100 },
  { id: 'deadeye', name: 'Deadeye', desc: 'Get 50 headshot kills', stat: 'headshots', goal: 50, tokens: 300 },
  { id: 'scoped', name: 'Scoped In', desc: 'Get 20 kills with snipers, the DMR or the Railgun', stat: 'sniperKills', goal: 20, tokens: 200 },
  { id: 'close', name: 'Close Encounters', desc: 'Get 30 shotgun kills', stat: 'shotgunKills', goal: 30, tokens: 200 },
  { id: 'blades', name: 'Blademaster', desc: 'Get 10 melee kills', stat: 'melee', goal: 10, tokens: 100 },
  { id: 'slice', name: 'Slice & Dice', desc: 'Get 30 melee kills', stat: 'melee', goal: 30, tokens: 250 },
  { id: 'sidearm', name: 'Sidearm Specialist', desc: 'Get 25 kills with secondaries', stat: 'secondary', goal: 25, tokens: 150 },
  { id: 'pistolpro', name: 'Quick Draw', desc: 'Get 75 kills with secondaries', stat: 'secondary', goal: 75, tokens: 300 },
  { id: 'boom', name: 'Demolition', desc: 'Get 10 explosive kills', stat: 'explosive', goal: 10, tokens: 150 },
  { id: 'bigboom', name: 'Demolition Expert', desc: 'Get 40 explosive kills', stat: 'explosive', goal: 40, tokens: 300 },
  { id: 'streak', name: 'On a Roll', desc: 'Get 5 kills in one life', stat: 'bestStreak', goal: 5, tokens: 100 },
  { id: 'unstoppable', name: 'Unstoppable', desc: 'Get 10 kills in one life', stat: 'bestStreak', goal: 10, tokens: 300 },
  { id: 'regular', name: 'Regular', desc: 'Play 3 matches to the end', stat: 'matches', goal: 3, tokens: 75 },
  { id: 'veteran', name: 'Veteran', desc: 'Play 10 matches to the end', stat: 'matches', goal: 10, tokens: 150 },
  { id: 'dedicated', name: 'Dedicated', desc: 'Play 25 matches to the end', stat: 'matches', goal: 25, tokens: 300 },
  { id: 'nolife', name: 'Can’t Stop', desc: 'Play 50 matches to the end', stat: 'matches', goal: 50, tokens: 500 },
  { id: 'champ', name: 'Champion', desc: 'Win a match', stat: 'wins', goal: 1, tokens: 150 },
  { id: 'winner', name: 'Serial Winner', desc: 'Win 3 matches', stat: 'wins', goal: 3, tokens: 200 },
  { id: 'dominator', name: 'Dominator', desc: 'Win 10 matches', stat: 'wins', goal: 10, tokens: 500 },
  { id: 'giant', name: 'Giant Slayer', desc: 'Kill the Juggernaut 3 times', stat: 'juggKills', goal: 3, tokens: 150 },
  { id: 'titan', name: 'Titan Slayer', desc: 'Kill the Juggernaut 10 times', stat: 'juggKills', goal: 10, tokens: 300 },
  { id: 'ladder', name: 'Ladder Climber', desc: 'Get 20 kills in Gun Game', stat: 'gungameKills', goal: 20, tokens: 150 },
  { id: 'survivor', name: 'Survivor', desc: 'Survive an Infection round', stat: 'survived', goal: 1, tokens: 150 },
  { id: 'hill', name: 'King Maker', desc: 'Score 120 King of the Hill points', stat: 'hillPoints', goal: 120, tokens: 150 },
  { id: 'emperor', name: 'Hill Emperor', desc: 'Score 400 King of the Hill points', stat: 'hillPoints', goal: 400, tokens: 300 },
  { id: 'tags', name: 'Tag Collector', desc: 'Collect 15 dog tags in Kill Confirmed', stat: 'tags', goal: 15, tokens: 200 },
  { id: 'oneshot', name: 'One Shot Wonder', desc: 'Get 15 kills in One in the Chamber', stat: 'oitcKills', goal: 15, tokens: 200 },
  { id: 'party', name: 'Party Animal', desc: 'Play 5 different game modes', stat: 'modesPlayed', goal: 5, tokens: 150 },
  { id: 'variety', name: 'Variety Gamer', desc: 'Play 12 different game modes', stat: 'modesPlayed', goal: 12, tokens: 300 },
  { id: 'tourist', name: 'Tourist', desc: 'Play matches on 8 different maps', stat: 'mapsPlayed', goal: 8, tokens: 150 },
  { id: 'traveler', name: 'World Traveler', desc: 'Play matches on 15 different maps', stat: 'mapsPlayed', goal: 15, tokens: 300 },
  { id: 'mythic', name: 'Mythic', desc: 'Get 1000 kills', stat: 'kills', goal: 1000, tokens: 1000 },
  { id: 'headhunter', name: 'Headhunter', desc: 'Get 150 headshot kills', stat: 'headshots', goal: 150, tokens: 600 },
  { id: 'godlike', name: 'Godlike', desc: 'Get 15 kills in one life', stat: 'bestStreak', goal: 15, tokens: 500 },
  { id: 'double', name: 'Double Trouble', desc: 'Get 5 multi-kills (2+ kills within 4 seconds)', stat: 'multiKills', goal: 5, tokens: 150 },
  { id: 'triple', name: 'Triple Threat', desc: 'Get 3 triple kills', stat: 'tripleKills', goal: 3, tokens: 300 },
  { id: 'longshot', name: 'Long Shot', desc: 'Get 10 kills from 40+ meters away', stat: 'longKills', goal: 10, tokens: 200 },
  { id: 'payback', name: 'Payback', desc: 'Get 10 revenge kills on whoever killed you last', stat: 'revenge', goal: 10, tokens: 150 },
  { id: 'skyfall', name: 'Sky Fall', desc: 'Get 10 kills while in the air', stat: 'airKills', goal: 10, tokens: 200 },
  { id: 'silent', name: 'Silent Assassin', desc: 'Get 25 kills with a suppressed gun', stat: 'silentKills', goal: 25, tokens: 200 },
  { id: 'clutch', name: 'Clutch', desc: 'Get 10 kills with 25 health or less', stat: 'clutchKills', goal: 10, tokens: 200 },
  { id: 'teamplayer', name: 'Team Player', desc: 'Win 5 team matches', stat: 'teamWins', goal: 5, tokens: 250 },
  { id: 'collector', name: 'Collector', desc: 'Buy 10 cosmetics or banners', stat: 'bought', goal: 10, tokens: 150 },
  { id: 'fashion', name: 'Fashionista', desc: 'Buy 25 cosmetics or banners', stat: 'bought', goal: 25, tokens: 400 },
];

// Before tokens, these missions unlocked these items. Players who finished them keep the item.
const LEGACY_REWARDS = {
  first: ['hat', 'cap'], regular: ['hat', 'beanie'], sharp: ['face', 'shades'], blades: ['face', 'bandana'],
  sidearm: ['face', 'mustache'], boom: ['back', 'jetpack'], streak: ['hair', 'mohawk'], slayer: ['hat', 'cowboy'],
  champ: ['hat', 'crown'], giant: ['hat', 'viking'], ladder: ['hat', 'tophat'], survivor: ['hat', 'halo'],
  veteran: ['hair', 'long'], winner: ['back', 'cape'], centurion: ['hair', 'spiky'], hill: ['hat', 'headband'],
  party: ['hat', 'party'],
};

const SNIPERS = ['sniper', 'dmr', 'amr', 'railgun'];
const SHOTGUNS = ['shotgun', 'autoshot', 'slug', 'doublebarrel', 'sawedoff'];

const stats = { ...store.get('stats', {}) };
const modes = new Set(store.get('modesPlayed', []));
const maps = new Set(store.get('mapsPlayed', []));
const owned = new Set(store.get('owned', []));
const claimed = new Set(store.get('claimed', []));
let tokens = store.get('tokens', 0);
let streak = 0;

const earnedWrap = (k) => k.startsWith('wrap:') && camoOf(k.slice(5)).reward;
export const getStat = (k) => (k === 'modesPlayed' ? modes.size : k === 'mapsPlayed' ? maps.size : k === 'bought' ? [...owned].filter((x) => !earnedWrap(x)).length : stats[k] || 0);
export const missionDone = (m) => getStat(m.stat) >= m.goal;
export const getTokens = () => tokens;

function save() {
  store.set('tokens', tokens);
  store.set('owned', [...owned]);
  store.set('claimed', [...claimed]);
}

// One-time switch from mission unlocks to tokens: keep everything already unlocked, and don't
// pay tokens again for those missions.
if (store.get('econ', 0) < 2) {
  for (const [id, [slot, item]] of Object.entries(LEGACY_REWARDS)) {
    const m = MISSIONS.find((x) => x.id === id);
    if (m && missionDone(m)) { owned.add(slot + ':' + item); claimed.add(id); }
  }
  store.set('econ', 2);
  save();
}

// Pays out any finished-but-unpaid missions (e.g. new missions you'd already met). Returns them.
export function claimMissions() {
  const paid = [];
  for (const m of MISSIONS) {
    if (!claimed.has(m.id) && missionDone(m)) { claimed.add(m.id); tokens += m.tokens; paid.push(m); }
  }
  if (paid.length) save();
  return paid;
}
claimMissions();

const findItem = (slot, id) => COSMETICS[slot] && COSMETICS[slot].find((c) => c.id === id);
export function isOwned(slot, id) {
  const item = findItem(slot, id);
  return !!item && (item.free || owned.has(slot + ':' + id));
}
export const priceOf = (slot, id) => { const it = findItem(slot, id); return it ? it.price || 0 : 0; };

// Spends tokens on an item. Returns true if it's now owned.
export function buy(slot, id) {
  if (isOwned(slot, id)) return true;
  const price = priceOf(slot, id);
  if (!findItem(slot, id) || tokens < price) return false;
  tokens -= price;
  owned.add(slot + ':' + id);
  save();
  for (const m of claimMissions()) onComplete(m); // Collector missions
  return true;
}

// Weapon wraps (camos.js): free ones are always yours; premium ones are bought with tokens.
export const ownsWrap = (id) => { const c = camoOf(id); return c.id === id && ((!c.price && !c.reward) || owned.has('wrap:' + id)); };
export function buyWrap(id) {
  if (ownsWrap(id)) return true;
  const c = camoOf(id);
  if (c.id !== id || c.reward || tokens < c.price) return false;
  tokens -= c.price;
  owned.add('wrap:' + id);
  save();
  for (const m of claimMissions()) onComplete(m); // Collector missions
  return true;
}

// Rewards from progress.js (levels, daily login, challenges, game night, leaderboard).
export function addTokens(n) { if (n > 0) { tokens += Math.round(n); save(); } }
// Gives an earned wrap. Returns true if it's new.
export function grantWrap(id) {
  if (owned.has('wrap:' + id) || camoOf(id).id !== id) return false;
  owned.add('wrap:' + id);
  save();
  return true;
}

// Equipped cosmetics; anything not owned (or no longer existing) falls back to the default.
export function getCos() {
  const c = { ...DEFAULT_COS, ...store.get('cos', {}) };
  for (const slot of Object.keys(COSMETICS)) if (!isOwned(slot, c[slot])) c[slot] = DEFAULT_COS[slot];
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
  // Level shown by your name (progress.js).
  if (Number.isInteger(c.lvl) && c.lvl >= 1 && c.lvl <= 100) out.lvl = c.lvl;
  return out;
}
export function randomCos() {
  const pick = (a) => a[(Math.random() * a.length) | 0];
  const c = { hairColor: pick(HAIR_COLORS) };
  for (const slot of Object.keys(COSMETICS)) c[slot] = pick(COSMETICS[slot]).id;
  c.lvl = 1 + Math.floor(Math.random() ** 2 * 40); // bots show a level too
  return c;
}

// ---------- Progress tracking ----------
let onComplete = () => {};
export function onMissionComplete(fn) { onComplete = fn; }
// Every stat change ({ kills: 1, headshots: 1, … }), for XP and daily challenges (progress.js).
const statListeners = [];
export function onStats(fn) { statListeners.push(fn); }

function bump(updates, pre = null) {
  if (pre) pre();
  for (const [k, v] of Object.entries(updates)) {
    if (k === 'bestStreak') stats[k] = Math.max(stats[k] || 0, v);
    else stats[k] = (stats[k] || 0) + v;
  }
  store.set('stats', stats);
  for (const m of claimMissions()) onComplete(m);
  for (const fn of statListeners) fn(updates);
}

export const track = {
  kill({ weapon, weaponType, head, secondary, explosive, juggernaut, mode, multi = 1, dist = 0, revenge, air, silent, lowHp }) {
    streak++;
    const u = { kills: 1, bestStreak: streak };
    if (head) u.headshots = 1;
    if (weaponType === 'melee') u.melee = 1;
    if (secondary) u.secondary = 1;
    if (explosive) u.explosive = 1;
    if (juggernaut) u.juggKills = 1;
    if (SNIPERS.includes(weapon)) u.sniperKills = 1;
    if (SHOTGUNS.includes(weapon)) u.shotgunKills = 1;
    if (mode === 'gungame') u.gungameKills = 1;
    if (mode === 'oitc') u.oitcKills = 1;
    if (multi >= 2) u.multiKills = 1;
    if (multi === 3) u.tripleKills = 1;
    if (dist >= 40) u.longKills = 1;
    if (revenge) u.revenge = 1;
    if (air) u.airKills = 1;
    if (silent) u.silentKills = 1;
    if (lowHp) u.clutchKills = 1;
    bump(u);
  },
  died() { streak = 0; },
  tag() { bump({ tags: 1 }); },
  matchEnd({ mode, map, won, survived, hillPoints, teams }) {
    streak = 0;
    const u = { matches: 1 };
    if (won) u.wins = 1;
    if (won && teams) u.teamWins = 1;
    if (survived) u.survived = 1;
    if (hillPoints) u.hillPoints = hillPoints;
    bump(u, () => {
      modes.add(mode);
      if (map) maps.add(map);
      store.set('modesPlayed', [...modes]);
      store.set('mapsPlayed', [...maps]);
    });
  },
};
