import { store, esc } from './util.js';

// Ranked: a skill rating (SR) from Free For All matches on ranked servers. Your SR moves by
// where you finish among the real players (Elo against each of them); bots don't count, and a
// match needs at least 2 players for it to count. The first PLACEMENTS matches move it faster.
// Everything is kept on this device and shown to others with your cosmetics (self-reported).

export const START_SR = 1000;
export const PLACEMENTS = 5;
export const DIVISIONS = [
  { id: 'rookie', name: 'Rookie', min: 0, color: '#9aa4b2', icon: '◇' },
  { id: 'contender', name: 'Contender', min: 1100, color: '#5fc46a', icon: '◆' },
  { id: 'veteran', name: 'Veteran', min: 1250, color: '#4aa8ff', icon: '⬢' },
  { id: 'elite', name: 'Elite', min: 1400, color: '#b36bff', icon: '✦' },
  { id: 'master', name: 'Master', min: 1550, color: '#ff8a3a', icon: '✷' },
  { id: 'legend', name: 'Legend', min: 1700, color: '#ff3a6a', icon: '♛' },
];
// Season numbers, matching seasons.js (6-week seasons from Monday 5 Oct 2026).
const seasonNow = (t = Date.now()) => Math.max(1, Math.floor((t - Date.UTC(2026, 9, 5)) / (42 * 864e5)) + 1);
// Season reward banners: one per division above Rookie.
export const RANKED_BANNERS = Object.fromEntries(DIVISIONS.slice(1).map((d) => ['rks_' + d.id, {
  bg: `radial-gradient(circle at 82% 50%, ${d.color}66 0 16%, transparent 42%), repeating-linear-gradient(115deg, transparent 0 18px, ${d.color}22 18px 20px), linear-gradient(100deg, #0b0e14, #1a1f2a 60%, ${d.color}55)`,
  accent: d.color, emblem: d.icon,
}]));
export const RANKED_BANNER_ITEMS = DIVISIONS.slice(1).map((d) => ({ id: 'rks_' + d.id, name: `Ranked ${d.name}`, reward: true, how: `Finish a ranked season at ${d.name} or higher` }));
export const divisionOf = (sr) => DIVISIONS.reduce((d, x) => (sr >= x.min ? x : d), DIVISIONS[0]);
export const RANKED_MATCH = { mode: 'ffa', max: 8, bots: 4 };

const load = () => ({ sr: START_SR, played: 0, best: START_SR, wins: 0, ...store.get('ranked', {}) });
export const myRanked = () => { const r = load(); return { ...r, placing: r.played < PLACEMENTS, div: divisionOf(r.sr) }; };

// Small badge: division icon + SR (or "placement 2/5").
export function srBadge(sr, placing = false) {
  if (!sr) return '';
  const d = divisionOf(sr);
  return `<span class="sr-badge" style="--dv:${d.color}" title="Ranked: ${esc(d.name)}${placing ? ' (placement matches)' : ''}">${d.icon} ${placing ? '?' : sr}</span>`;
}

// Your best division in the current season (index into DIVISIONS), and when the season ends.
export function seasonPeak() {
  const r = load(), n = seasonNow();
  return { div: DIVISIONS[(r.peaks || {})[n] || 0], ends: Date.UTC(2026, 9, 5) + n * 42 * 864e5 };
}
// Seasons that have ended: banners for your best division and every one below it (once).
// grant(slot, id) gives the item; returns the divisions newly rewarded.
export function claimSeasonRewards(grant) {
  const r = load(), now = seasonNow(), out = [];
  r.claimed = { ...(r.claimed || {}) };
  for (const [n, di] of Object.entries(r.peaks || {})) {
    if (Number(n) >= now || r.claimed[n]) continue;
    r.claimed[n] = true;
    for (let i = 1; i <= di; i++) grant('banner', 'rks_' + DIVISIONS[i].id);
    if (di > 0) out.push({ season: Number(n), div: DIVISIONS[di] });
  }
  store.set('ranked', r);
  return out;
}

// After a ranked match. scores: the end-of-match list (sorted, best first, with cos.sr and bot).
// Returns { delta, sr, counted, reason, div, newDiv } or null.
export function rateMatch(scores, myId) {
  const humans = (scores || []).filter((p) => !p.bot);
  const meIdx = humans.findIndex((p) => p.id === myId);
  if (meIdx < 0) return null;
  const r = load();
  if (humans.length < 2) return { counted: false, reason: 'Ranked needs 2 or more real players to count.', sr: r.sr, delta: 0, div: divisionOf(r.sr) };
  const K = r.played < PLACEMENTS ? 64 : 32;
  let sum = 0;
  humans.forEach((p, j) => {
    if (j === meIdx) return;
    const other = Number.isFinite(p.cos && p.cos.sr) ? p.cos.sr : START_SR;
    const expect = 1 / (1 + 10 ** ((other - r.sr) / 400));
    const result = meIdx < j ? 1 : 0; // finished above them
    sum += result - expect;
  });
  const delta = Math.round((K * sum) / (humans.length - 1));
  const before = divisionOf(r.sr);
  r.sr = Math.max(0, r.sr + delta);
  r.played++;
  if (meIdx === 0) r.wins++;
  r.best = Math.max(r.best, r.sr);
  // Best division this season (rewarded when the season ends).
  const n = seasonNow(), di = DIVISIONS.indexOf(divisionOf(r.sr));
  r.peaks = { ...(r.peaks || {}) };
  r.peaks[n] = Math.max(r.peaks[n] || 0, di);
  store.set('ranked', r);
  const div = divisionOf(r.sr);
  return { counted: true, delta, sr: r.sr, div, newDiv: div.id !== before.id ? div : null, placing: r.played < PLACEMENTS, played: r.played };
}
