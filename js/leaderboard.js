import { store } from './util.js';
import { onStats, addTokens, grantWrap, allStats } from './missions.js';
import { onProgress, myLevel } from './progress.js';
import { moderation } from './moderation.js';

// Weekly leaderboard: kills, wins, headshots and XP from Monday 00:00 UTC to the next Monday.
// Every player with a gamertag posts their own week's totals, signed, as a retained message at
// whffa/v1/lb/<week>/<tag>; everyone reads them all. Totals are self-reported (there's no game
// server to count them), so they're capped to believable numbers. Last week's #1 in each board
// gets a 🏆 by their name all week, plus the Weekly Champion wrap and tokens. Staff can hide
// players from the board (a staff-signed list at whffa/v1/lb/hide).
//
// All-time board: lifetime totals (kills / wins / headshots from your stats, XP from your level)
// at whffa/v1/lb/all/<tag>. Kills, wins and headshots are also kept per game mode, both weekly
// and all-time (per-mode all-time counts start from when this update came out).

const V = 'whffa/v1/lb/';
export const BOARDS = [
  { id: 'xp', name: 'XP', icon: '⭐' },
  { id: 'kills', name: 'Kills', icon: '💀' },
  { id: 'wins', name: 'Wins', icon: '🏆' },
  { id: 'heads', name: 'Headshots', icon: '🎯' },
];
const CAPS = { xp: 150000, kills: 3000, wins: 200, heads: 1500 }; // per week (a lot of playing)
const CAPS_ALL = { xp: 50000000, kills: 1000000, wins: 100000, heads: 500000 };
export const MODE_BOARDS = ['kills', 'wins', 'heads']; // what's counted per mode
const MODE_ID = /^[a-z]{2,16}$/;
// { mode: { kills, wins, heads } } from a signed post, capped
function cleanModes(m, caps) {
  const out = {};
  if (!m || typeof m !== 'object') return out;
  for (const [k, v] of Object.entries(m).slice(0, 40)) {
    if (!MODE_ID.test(k) || !v || typeof v !== 'object') continue;
    const e = {};
    for (const b of MODE_BOARDS) e[b] = Math.max(0, Math.min(caps[b], Math.round(Number(v[b]) || 0)));
    out[k] = e;
  }
  return out;
}
const HIDE = V + 'hide';
export const CHAMP_TOKENS = 500;

const DAY = 86400000;
// Monday 00:00 UTC of the week containing `t`, as 'YYYY-MM-DD'.
export function weekId(t = Date.now()) {
  const d = new Date(t), dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dow)).toISOString().slice(0, 10);
}
export const weekEnds = (id = weekId()) => Date.parse(id + 'T00:00:00Z') + 7 * DAY;
const prevWeek = (id = weekId()) => weekId(Date.parse(id + 'T00:00:00Z') - DAY);
const low = (s) => String(s || '').toLowerCase();

class Leaderboard {
  constructor() {
    this.week = weekId();
    this.mine = this.loadMine();
    this.entries = { cur: new Map(), prev: new Map(), all: new Map() }; // lower tag -> { tag, xp, kills, wins, heads, m: { mode: {...} } }
    this.modesAll = store.get('lbModesAll', {}); // your all-time per-mode counts
    this.champs = new Set(); // lower tags of last week's #1s
    this.hidden = new Set(); // lower tags staff took off the board
    this.hideRaw = null;
    this.onChange = null;
    onStats((u, mode) => this.add({ kills: u.kills || 0, wins: u.wins || 0, heads: u.headshots || 0 }, mode));
    onProgress((e) => { if (e.type === 'xp') this.add({ xp: e.amount }); });
  }

  loadMine() {
    const m = store.get('lbWeek', null);
    return m && m.week === this.week ? { m: {}, ...m } : { week: this.week, xp: 0, kills: 0, wins: 0, heads: 0, m: {} };
  }

  add(d, mode = null) {
    this.rollover();
    for (const k of Object.keys(d)) this.mine[k] = (this.mine[k] || 0) + d[k];
    if (mode && MODE_ID.test(mode) && (d.kills || d.wins || d.heads)) {
      for (const box of [this.mine.m, this.modesAll]) {
        const e = box[mode] || (box[mode] = { kills: 0, wins: 0, heads: 0 });
        for (const b of MODE_BOARDS) e[b] += d[b] || 0;
      }
      store.set('lbModesAll', this.modesAll);
    }
    store.set('lbWeek', this.mine);
    this.dirty = true;
  }

  // A new week started while the game was open.
  rollover() {
    const w = weekId();
    if (w === this.week) return;
    this.week = w;
    this.mine = this.loadMine();
    this.entries.prev = this.entries.cur;
    this.entries.cur = new Map();
    if (this.social) this.subscribe();
  }

  init(social) {
    this.social = social;
    social.relay.onMessage((t, payload) => {
      if (t === HIDE) this.receiveHide(payload.toString());
      else if (t.startsWith(V)) this.receive(t.slice(V.length), payload.toString());
    });
    social.relay.subscribe(HIDE);
    this.subscribe();
    this.dirty = true;
    // Post changes every minute, and re-post every 10 minutes anyway (in case it was cleared).
    let n = 0;
    setInterval(() => { this.rollover(); this.publish(++n % 10 === 0); }, 60000);
    setTimeout(() => this.publish(), 5000);
  }

  subscribe() {
    const s = this.social;
    for (const t of this.subs || []) s.relay.unsubscribe(t);
    this.subs = [V + this.week + '/+', V + prevWeek(this.week) + '/+', V + 'all/+'];
    for (const t of this.subs) s.relay.subscribe(t);
  }

  async receive(path, text) {
    const [week, tag] = path.split('/');
    const which = week === 'all' ? 'all' : week === this.week ? 'cur' : week === prevWeek(this.week) ? 'prev' : null;
    if (!which || !tag) return;
    if (!text) { this.entries[which].delete(tag); this.changed(which); return; }
    const body = await this.social.verify(text);
    if (!body || low(body.from) !== tag || body.week !== week) return;
    const e = { tag: body.from };
    const caps = which === 'all' ? CAPS_ALL : CAPS;
    for (const b of BOARDS) e[b.id] = Math.max(0, Math.min(caps[b.id], Math.round(Number(body[b.id]) || 0)));
    e.m = cleanModes(body.m, caps);
    this.entries[which].set(tag, e);
    this.changed(which);
  }

  changed(which) {
    // Last week's results settle for a few seconds (entries verify one by one) before deciding #1s.
    if (which === 'prev') { clearTimeout(this.champT); this.champT = setTimeout(() => { this.updateChamps(); if (this.onChange) this.onChange(); }, 6000); }
    if (this.onChange) this.onChange();
  }

  // Your week's totals, posted (signed) at most once a minute while they change.
  async publish(force = false) {
    const s = this.social;
    if (!s || !s.tag || (!this.dirty && !force)) return;
    if (!this.mine.xp && !this.mine.kills) return; // nothing to show yet
    this.dirty = false;
    const body = { week: this.week, m: cleanModes(this.mine.m, CAPS) };
    for (const b of BOARDS) body[b.id] = Math.min(CAPS[b.id], this.mine[b.id] || 0);
    const signed = await s.sign(body);
    s.relay.publish(V + this.week + '/' + low(s.tag), signed, { retain: true });
    this.receive(this.week + '/' + low(s.tag), signed);
    // All-time totals
    const all = this.lifetime(), ab = { week: 'all', m: cleanModes(this.modesAll, CAPS_ALL) };
    for (const b of BOARDS) ab[b.id] = Math.min(CAPS_ALL[b.id], all[b.id] || 0);
    const sa = await s.sign(ab);
    s.relay.publish(V + 'all/' + low(s.tag), sa, { retain: true });
    this.receive('all/' + low(s.tag), sa);
  }

  // Your lifetime totals.
  lifetime() {
    const st = allStats();
    return { xp: myLevel().total || 0, kills: st.kills || 0, wins: st.wins || 0, heads: st.headshots || 0, m: this.modesAll };
  }

  // Sorted rows for a board: [{ tag, value, rank, me }]. which: 'cur' | 'prev' | 'all'; mode: one game mode, or all of them.
  rows(board, which = 'cur', mode = null) {
    const me = this.social && low(this.social.tag);
    const val = (e) => (mode ? (e.m && e.m[mode] && e.m[mode][board]) || 0 : e[board] || 0);
    const list = [...this.entries[which].values()].filter((e) => val(e) > 0 && !this.hidden.has(low(e.tag)) && !moderation.isGone(e.tag)).sort((a, b) => val(b) - val(a) || a.tag.localeCompare(b.tag));
    return list.map((e, i) => ({ tag: e.tag, value: val(e), rank: i + 1, me: low(e.tag) === me }));
  }

  // Last week's #1s get a trophy; if one of them is you, the Weekly Champion wrap + tokens (once).
  updateChamps() {
    this.champs = new Set();
    const won = [];
    for (const b of BOARDS) {
      const top = this.rows(b.id, 'prev')[0];
      if (!top) continue;
      this.champs.add(low(top.tag));
      if (top.me) won.push(b.name);
    }
    const prev = prevWeek(this.week);
    if (won.length && store.get('champClaimed', '') !== prev) {
      store.set('champClaimed', prev);
      addTokens(CHAMP_TOKENS);
      grantWrap('champion');
      if (this.onChampion) this.onChampion(won);
    }
  }

  isChamp(tag) { return !!tag && this.champs.has(low(tag)); }
  isHidden(tag) { return !!tag && this.hidden.has(low(tag)); }

  // ---------- Hide list (staff) ----------
  async receiveHide(text) {
    this.hideRaw = text || null;
    const body = text ? await moderation.staffSigned(text) : null;
    if (!body || !Array.isArray(body.tags)) return;
    if (this.hideTs && Number(body.ts) < this.hideTs) return;
    this.hideTs = Number(body.ts) || 0;
    this.hidden = new Set(body.tags.filter((x) => typeof x === 'string').map(low).slice(0, 500));
    this.updateChamps();
    if (this.onChange) this.onChange();
  }
  // Staff list may verify only once the moderator list has loaded.
  reverify() { if (this.hideRaw) this.receiveHide(this.hideRaw); }
  async setHidden(tag, hide) {
    const next = new Set(this.hidden);
    if (hide) next.add(low(tag)); else next.delete(low(tag));
    const signed = await this.social.sign({ tags: [...next] });
    this.social.relay.publish(HIDE, signed, { retain: true });
    await this.receiveHide(signed);
  }
}

export const leaderboard = new Leaderboard();
