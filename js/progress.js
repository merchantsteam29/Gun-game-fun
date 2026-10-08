import { store, esc } from './util.js';
import { onStats, addTokens, grantWrap, getStat } from './missions.js';

// Things that bring you back every day: XP and levels (with ranks), a daily login streak and
// three daily challenges. Everything is saved on this device.

// ---------- XP, levels and ranks ----------
export const XP = { kill: 100, headshot: 25, multi: 50, match: 250, win: 250 };
export const MAX_LEVEL = 100;
export const xpToNext = (lvl) => 400 + 60 * lvl; // XP from `lvl` to `lvl + 1`

// Rank by level. `wrap` is given when you reach it.
export const RANKS = [
  { id: 'bronze', name: 'Bronze', min: 1, color: '#d08a52' },
  { id: 'silver', name: 'Silver', min: 10, color: '#c3ccd6', wrap: 'rk_silver' },
  { id: 'gold', name: 'Gold', min: 20, color: '#f2c24a', wrap: 'rk_gold' },
  { id: 'platinum', name: 'Platinum', min: 35, color: '#6fe6dc', wrap: 'rk_plat' },
  { id: 'diamond', name: 'Diamond', min: 50, color: '#7ab8ff', wrap: 'rk_diamond' },
];
export const rankOf = (lvl) => RANKS.reduce((r, x) => (lvl >= x.min ? x : r), RANKS[0]);
// Tokens for reaching a level (more for a new rank).
export const levelTokens = (lvl) => Math.min(200, 20 + 5 * lvl) + (RANKS.some((r) => r.min === lvl && lvl > 1) ? 250 : 0);

// Total XP → { level, into (XP into this level), need (XP for the next), pct, rank }
export function levelFor(total) {
  let level = 1, left = total;
  while (level < MAX_LEVEL && left >= xpToNext(level)) { left -= xpToNext(level); level++; }
  const need = level >= MAX_LEVEL ? 0 : xpToNext(level);
  return { level, into: left, need, pct: need ? left / need : 1, rank: rankOf(level), total };
}

// Little badge with your level, colored by rank (scoreboard, chip, kill feed…).
export function levelBadge(lvl, title = true) {
  if (!lvl) return '';
  const r = rankOf(lvl);
  return `<span class="lvl-badge lvl-${r.id}" style="--rk:${r.color}"${title ? ` title="${esc(r.name)} · level ${lvl}"` : ''}>${lvl}</span>`;
}

let xp = store.get('xp', 0);
let boost = () => 1; // double XP during Game Night (gamenight.js)
export const setXpBoost = (fn) => { boost = fn; };
export const myLevel = () => levelFor(xp);

const listeners = [];
// Events: { type: 'xp', amount } · { type: 'level', level, rank, tokens, newRank, wrap }
//         { type: 'challenge', ch, tokens } · { type: 'allDaily', tokens }
export function onProgress(fn) { listeners.push(fn); }
const emit = (e) => { for (const fn of listeners) fn(e); };

export function addXp(amount) {
  amount = Math.round(amount * boost());
  if (amount <= 0) return;
  const before = levelFor(xp).level;
  xp += amount;
  store.set('xp', xp);
  emit({ type: 'xp', amount });
  const after = levelFor(xp).level;
  for (let l = before + 1; l <= after; l++) {
    const tokens = levelTokens(l), rank = rankOf(l), newRank = rank.min === l;
    addTokens(tokens);
    const wrap = newRank && rank.wrap && grantWrap(rank.wrap) ? rank.wrap : null;
    emit({ type: 'level', level: l, rank, tokens, newRank, wrap });
  }
}

// ---------- Daily login streak ----------
// Claim once a day; the reward grows for 7 days in a row, then repeats. Day 7 the first time
// also gives the Ember wrap. Missing a day starts over at day 1.
export const LOGIN_REWARDS = [25, 40, 50, 75, 100, 120, 150];
export const STREAK_WRAP = 'ember';

const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return dayKey(d); };

// { streak (counting today if claimed / if you claim now), claimed (today), day (1..7), reward }
export function loginState() {
  const s = store.get('login', { last: null, streak: 0 });
  const claimed = s.last === dayKey();
  const streak = claimed ? s.streak : s.last === yesterday() ? s.streak + 1 : 1;
  const day = ((streak - 1) % 7) + 1;
  return { streak, claimed, day, reward: LOGIN_REWARDS[day - 1], wrap: day === 7 && !store.get('streakWrap', false) };
}
export function claimLogin() {
  const st = loginState();
  if (st.claimed) return null;
  store.set('login', { last: dayKey(), streak: st.streak });
  addTokens(st.reward);
  if (st.wrap) { grantWrap(STREAK_WRAP); store.set('streakWrap', true); }
  addXp(100);
  return st;
}

// ---------- Daily challenges ----------
// Three a day (easy, medium, hard), the same for everyone on the same date. Progress counts
// from the moment the day's challenges were first seen.
const POOLS = [
  [ // easy
    { stat: 'kills', goal: 15, text: 'Get 15 kills' },
    { stat: 'matches', goal: 2, text: 'Play 2 matches to the end' },
    { stat: 'headshots', goal: 5, text: 'Get 5 headshot kills' },
    { stat: 'secondary', goal: 5, text: 'Get 5 kills with secondaries' },
    { stat: 'melee', goal: 2, text: 'Get 2 melee kills' },
  ],
  [ // medium
    { stat: 'kills', goal: 35, text: 'Get 35 kills' },
    { stat: 'headshots', goal: 12, text: 'Get 12 headshot kills' },
    { stat: 'sniperKills', goal: 6, text: 'Get 6 sniper kills' },
    { stat: 'shotgunKills', goal: 8, text: 'Get 8 shotgun kills' },
    { stat: 'explosive', goal: 4, text: 'Get 4 explosive kills' },
    { stat: 'matches', goal: 4, text: 'Play 4 matches to the end' },
    { stat: 'revenge', goal: 3, text: 'Get 3 revenge kills' },
    { stat: 'airKills', goal: 3, text: 'Get 3 kills while in the air' },
  ],
  [ // hard
    { stat: 'wins', goal: 1, text: 'Win a match' },
    { stat: 'multiKills', goal: 3, text: 'Get 3 multi-kills' },
    { stat: 'longKills', goal: 5, text: 'Get 5 kills from 40+ meters' },
    { stat: 'kills', goal: 60, text: 'Get 60 kills' },
    { stat: 'clutchKills', goal: 3, text: 'Get 3 kills with 25 health or less' },
    { stat: 'melee', goal: 8, text: 'Get 8 melee kills' },
  ],
];
export const CHALLENGE_REWARD = [{ tokens: 50, xp: 200 }, { tokens: 75, xp: 350 }, { tokens: 125, xp: 500 }];
export const ALL_DAILY_BONUS = 100;

function seeded(str) {
  let h = 2166136261;
  for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909); return ((h >>>= 0) % 10000) / 10000; };
}
function todaysChallenges(day) {
  const rnd = seeded('daily:' + day);
  return POOLS.map((pool) => pool[Math.floor(rnd() * pool.length)]);
}

function dailyState() {
  const day = dayKey();
  let s = store.get('daily', null);
  if (!s || s.day !== day) {
    s = { day, base: {}, done: [], bonus: false };
    for (const c of todaysChallenges(day)) s.base[c.stat] = getStat(c.stat);
    store.set('daily', s);
  }
  return s;
}
// [{ stat, goal, text, have, done, tokens, xp, tier }] for today, plus { bonus, resetsIn (ms) }
export function dailyChallenges() {
  const s = dailyState();
  const list = todaysChallenges(s.day).map((c, i) => ({
    ...c, tier: i, ...CHALLENGE_REWARD[i],
    have: Math.min(c.goal, getStat(c.stat) - (s.base[c.stat] || 0)), done: s.done.includes(i),
  }));
  const end = new Date(); end.setHours(24, 0, 0, 0);
  return { list, bonus: s.bonus, resetsIn: end - Date.now() };
}
function checkDaily() {
  const s = dailyState();
  const list = todaysChallenges(s.day);
  let changed = false;
  list.forEach((c, i) => {
    if (s.done.includes(i) || getStat(c.stat) - (s.base[c.stat] || 0) < c.goal) return;
    s.done.push(i);
    changed = true;
    store.set('daily', s);
    addTokens(CHALLENGE_REWARD[i].tokens);
    emit({ type: 'challenge', ch: c, tokens: CHALLENGE_REWARD[i].tokens });
    addXp(CHALLENGE_REWARD[i].xp);
  });
  if (changed && !s.bonus && s.done.length === list.length) {
    s.bonus = true;
    store.set('daily', s);
    addTokens(ALL_DAILY_BONUS);
    emit({ type: 'allDaily', tokens: ALL_DAILY_BONUS });
  }
}

// XP and challenges follow the lifetime stats (missions.js).
onStats((u) => {
  addXp((u.kills || 0) * XP.kill + (u.headshots || 0) * XP.headshot + (u.multiKills || 0) * XP.multi
    + (u.matches || 0) * XP.match + (u.wins || 0) * XP.win);
  checkDaily();
});
dailyState();

export const fmtDuration = (ms) => {
  const m = Math.max(0, Math.round(ms / 60000)), h = Math.floor(m / 60), d = Math.floor(h / 24);
  return d >= 1 ? `${d}d ${h % 24}h` : h >= 1 ? `${h}h ${m % 60}m` : `${m}m`;
};

// ---------- Featured mode of the day ----------
// One mode a day (by UTC date, so everyone agrees) gives bonus XP, plus tokens for the first
// match you finish in it that day.
export const FEATURED_POOL = ['tdm', 'gungame', 'koth', 'infection', 'ctf', 'dom', 'hardpoint', 'killconfirmed', 'juggernaut', 'bounty', 'lms', 'oitc',
  'instagib', 'rotation', 'blades', 'boom', 'roulette', 'vampire'];
export const FEATURED_XP = 1.5;
export const FEATURED_TOKENS = 100;
export function featuredMode(t = Date.now()) {
  const day = new Date(t).toISOString().slice(0, 10);
  const rnd = seeded('featured:' + day);
  rnd(); // (first value is a bit lumpy)
  return FEATURED_POOL[Math.floor(rnd() * FEATURED_POOL.length)];
}
export const featuredEnds = (t = Date.now()) => { const d = new Date(t); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1); };
// First featured match today? Pays once per UTC day; returns the tokens paid (0 if already).
export function claimFeatured() {
  const day = new Date().toISOString().slice(0, 10);
  if (store.get('featDone', '') === day) return 0;
  store.set('featDone', day);
  addTokens(FEATURED_TOKENS);
  return FEATURED_TOKENS;
}
export const featuredClaimed = () => store.get('featDone', '') === new Date().toISOString().slice(0, 10);
