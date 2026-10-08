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
  store.set('ranked', r);
  const div = divisionOf(r.sr);
  return { counted: true, delta, sr: r.sr, div, newDiv: div.id !== before.id ? div : null, placing: r.played < PLACEMENTS, played: r.played };
}
