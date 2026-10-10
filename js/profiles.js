// Player profiles: everyone with a gamertag posts a signed public profile (level, rank, stats,
// favorite gun, banner, badges) as a retained message at whffa/v1/prof/<tag>. Click a gamertag
// (Friends, Leaderboard, your chip…) to read it. Numbers are reported by each player's game.

import { ACH } from './achievements.js';

const V = 'whffa/v1/prof/';
const low = (s) => String(s || '').toLowerCase();
const num = (v, hi) => Math.max(0, Math.min(hi, Math.round(Number(v) || 0)));
const str = (v, n) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, '').slice(0, n);

export function cleanProfile(b) {
  if (!b || typeof b !== 'object') return null;
  return {
    tag: str(b.from, 16), name: str(b.name, 16), color: /^#[0-9a-f]{6}$/i.test(b.color) ? b.color : '#ffffff',
    level: num(b.level, 100), kills: num(b.kills, 1e7), deaths: num(b.deaths, 1e7), wins: num(b.wins, 1e6), matches: num(b.matches, 1e6),
    heads: num(b.heads, 1e7), streak: num(b.streak, 1000), fav: str(b.fav, 20), favKills: num(b.favKills, 1e7),
    banner: str(b.banner, 20), wrap: str(b.wrap, 20), seasons: Array.isArray(b.seasons) ? b.seasons.map((x) => num(x, 999)).slice(0, 50) : [],
    since: Number(b.since) || 0, ts: Number(b.ts) || 0, sr: num(b.sr, 5000), srPlayed: num(b.srPlayed, 1e6),
    ach: Array.isArray(b.ach) ? b.ach.filter((x) => typeof x === 'string' && ACH[x]).slice(0, 3) : [], achN: num(b.achN, 100),
  };
}

class Profiles {
  init(social) { this.social = social; this.lastSent = ''; }

  // Posts your profile if it changed (at most once a minute).
  async publish(p) {
    const s = this.social;
    if (!s || !s.tag) return;
    const key = JSON.stringify(p);
    if (key === this.lastSent || Date.now() - (this.sentAt || 0) < 60000) return;
    this.lastSent = key;
    this.sentAt = Date.now();
    s.relay.publish(V + low(s.tag), await s.sign(p), { retain: true });
  }

  // Reads someone's profile (null if they have none yet).
  fetch(tag) {
    const s = this.social, topic = V + low(tag);
    return new Promise((resolve) => {
      let raw = null;
      const off = s.relay.onMessage((t, payload) => { if (t === topic && payload.length) raw = payload.toString(); });
      s.relay.subscribe(topic);
      setTimeout(async () => {
        off();
        s.relay.unsubscribe(topic);
        const body = raw ? await s.verify(raw) : null;
        resolve(body && low(body.from) === low(tag) ? cleanProfile(body) : null);
      }, 2200);
    });
  }
}

export const profiles = new Profiles();
