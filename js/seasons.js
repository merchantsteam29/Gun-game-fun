import { store } from './util.js';
import { addTokens, grantWrap, grantItem } from './missions.js';
import { onProgress } from './progress.js';

// Seasons: a free 30-tier pass every 6 weeks. All XP you earn during the season fills it
// (1,000 XP a tier). Every tier pays tokens; some give season-only wraps and banners that
// can't be bought. Reaching tier 30 earns that season's badge, kept forever.
// To add a season, add an entry to SEASONS (its wraps go in camos.js, banners in banners.js
// and missions.js COSMETICS.banner, all with `reward: true`). Seasons without an entry pay
// tokens only.

const DAY = 86400000;
export const SEASON_EPOCH = Date.UTC(2026, 9, 5); // Monday 5 Oct 2026: Season 1 starts
export const SEASON_LEN = 42 * DAY;
export const TIERS = 30;
export const TIER_XP = 1000;
export const tierTokens = (tier) => (tier % 5 === 0 ? 100 : 40);

export const SEASONS = {
  1: {
    name: 'Ignition', color: '#ff7a2a',
    items: {
      5: { kind: 'wrap', id: 's1_spark' },
      10: { kind: 'banner', id: 's1' },
      15: { kind: 'wrap', id: 's1_volt' },
      20: { kind: 'wrap', id: 's1_gold' },
      25: { kind: 'banner', id: 's1elite' },
      30: { kind: 'wrap', id: 's1_prism' },
    },
  },
  2: {
    name: 'Frostbite', color: '#6fd8ff',
    items: {
      5: { kind: 'wrap', id: 's2_frost' },
      10: { kind: 'banner', id: 's2' },
      15: { kind: 'wrap', id: 's2_aurora' },
      20: { kind: 'wrap', id: 's2_glacier' },
      25: { kind: 'banner', id: 's2elite' },
      30: { kind: 'wrap', id: 's2_prism' },
    },
  },
};

export function seasonAt(t = Date.now()) {
  const n = Math.max(1, Math.floor((t - SEASON_EPOCH) / SEASON_LEN) + 1);
  const start = SEASON_EPOCH + (n - 1) * SEASON_LEN;
  const def = SEASONS[n] || { name: `Season ${n}`, color: '#ffb020', items: {} };
  return { n, start, end: start + SEASON_LEN, ...def };
}

class Seasons {
  constructor() {
    this.onTier = null; // ({ tier, tokens, item }) for the toast
    this.load();
    onProgress((e) => { if (e.type === 'xp') this.add(e.amount); });
  }

  load() {
    const s = seasonAt(), saved = store.get('season', null);
    this.state = saved && saved.n === s.n ? saved : { n: s.n, xp: 0, tier: 0 };
  }

  info() {
    if (seasonAt().n !== this.state.n) this.load();
    const s = seasonAt(), tier = Math.min(TIERS, Math.floor(this.state.xp / TIER_XP));
    return { ...s, xp: this.state.xp, tier, into: tier >= TIERS ? TIER_XP : this.state.xp % TIER_XP, done: tier >= TIERS };
  }

  add(xp) {
    if (seasonAt().n !== this.state.n) this.load();
    this.state.xp += xp;
    const s = seasonAt(), tier = Math.min(TIERS, Math.floor(this.state.xp / TIER_XP));
    while (this.state.tier < tier) {
      const t = ++this.state.tier;
      const item = s.items[t] || null;
      addTokens(tierTokens(t));
      if (item) { if (item.kind === 'wrap') grantWrap(item.id); else grantItem(item.kind, item.id); }
      if (t === TIERS) {
        const badges = store.get('seasonBadges', []);
        if (!badges.includes(s.n)) store.set('seasonBadges', [...badges, s.n]);
      }
      if (this.onTier) this.onTier({ tier: t, tokens: tierTokens(t), item, season: s });
    }
    store.set('season', this.state);
  }

  badges() { return store.get('seasonBadges', []); }
}

export const seasons = new Seasons();
