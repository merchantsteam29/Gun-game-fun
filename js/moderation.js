import { roles, rank, verifyWith } from './roles.js';
import { store } from './util.js';

// Moderation records: one retained, staff-signed record per gamertag (whffa/v1/modrec/<tag>)
// holding its warnings, ban and any forced gamertag change, plus a short action log.
// Each new action re-publishes the whole record signed by the staff member who made it; every
// client checks that signer is the owner or a moderator ranked above the player before using it.
//
// Players watch their own record: new warnings pop up, a ban locks them out of matches, and a
// forced gamertag change releases their tag so they must pick another. (There's no server, so a
// ban is enforced by the game itself — clearing site data or a new gamertag gets around it.)

const P = 'whffa/v1/modrec/';
const LOG_MAX = 30;
const low = (t) => String(t || '').toLowerCase();
const clip = (s, n) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, n);

class Moderation {
  constructor() {
    this.raw = new Map(); // lower tag -> latest raw text (re-checked when the staff list changes)
    this.records = new Map(); // lower tag -> verified record body
    this.social = null;
    this.watching = new Set();
    this.onChange = null; // any record changed (mod panel)
    this.onWarn = null; // (warning) a new warning for you
    this.onBan = null; // (ban | null) your ban started / ended
    this.onRename = null; // (rename) you must pick a new gamertag
    this.lastBan = null;
  }

  init(social) {
    this.social = social;
    social.relay.onMessage((t, payload) => { if (t.startsWith(P)) this.receive(t.slice(P.length), payload.toString()); });
    const prev = social.relay.onConnect;
    social.relay.onConnect = () => { if (prev) prev(); for (const w of this.watching) social.relay.subscribe(P + w); };
    this.sync();
  }

  // Subscribe to your own record, and to everyone's if you're staff (for the mod panel).
  sync() {
    const s = this.social;
    if (!s) return;
    const want = new Set();
    if (s.tag) want.add(low(s.tag));
    if (roles.myRole()) want.add('+');
    for (const w of this.watching) if (!want.has(w)) s.relay.unsubscribe(P + w);
    for (const w of want) if (!this.watching.has(w)) s.relay.subscribe(P + w);
    this.watching = want;
    this.reverify();
  }

  async receive(k, text) {
    if (!text) { this.raw.delete(k); this.records.delete(k); this.changed(k); return; }
    this.raw.set(k, text);
    const body = await this.verify(k, text);
    if (!body) return;
    const cur = this.records.get(k);
    if (cur && cur.ts > body.ts) return; // an older copy from the other relay
    this.records.set(k, body);
    this.changed(k);
  }

  // Valid if signed by staff who outrank the player the record is about.
  async verify(k, text) {
    let env, body;
    try { env = JSON.parse(text); body = JSON.parse(env.b); } catch { return null; }
    if (!body || low(body.target) !== k || !body.from) return null;
    const role = roles.roleOfTag(body.from), pub = roles.pubOf(body.from);
    if (!role || !pub || rank(role) <= rank(roles.roleOfTag(body.target))) return null;
    return (await verifyWith(pub, env)) ? body : null;
  }

  // The staff list loaded / changed: records signed by moderators may only be valid now.
  async reverify() {
    for (const [k, text] of this.raw) {
      const body = await this.verify(k, text);
      if (body) this.records.set(k, body); else this.records.delete(k);
      this.changed(k);
    }
  }

  changed(k) {
    if (this.onChange) this.onChange(k);
    if (this.social && k === low(this.social.tag)) this.applyMine();
  }

  // ---------- Your own record ----------

  activeBan(rec) {
    const b = rec && rec.ban;
    return b && (!b.until || b.until > Date.now()) ? b : null;
  }

  myBan() {
    const s = this.social;
    return s && s.tag ? this.activeBan(this.records.get(low(s.tag))) : null;
  }

  applyMine() {
    const s = this.social, rec = this.records.get(low(s.tag));
    // Warnings you haven't acknowledged yet (newest last).
    const seen = store.get('warnSeen', 0);
    const fresh = ((rec && rec.warns) || []).filter((w) => w.ts > seen);
    if (fresh.length && this.onWarn) this.onWarn(fresh[fresh.length - 1], fresh.length);
    // Ban start / end.
    const ban = this.activeBan(rec);
    const key = ban ? ban.ts : null;
    if (key !== this.lastBan) { this.lastBan = key; if (this.onBan) this.onBan(ban); }
    // Forced gamertag change.
    if (rec && rec.rename && rec.rename.ts > store.get('renameDone', 0) && this.onRename) {
      store.set('renameDone', rec.rename.ts);
      this.onRename(rec.rename);
    }
  }

  ackWarnings() {
    const rec = this.social && this.records.get(low(this.social.tag));
    const last = Math.max(0, ...((rec && rec.warns) || []).map((w) => w.ts));
    store.set('warnSeen', Math.max(store.get('warnSeen', 0), last));
  }

  // ---------- Staff actions ----------

  // act: 'warn' | 'ban' | 'unban' | 'rename' | 'clearwarns'. Returns the new record.
  async act(tag, act, { reason = '', hours = 0 } = {}) {
    const s = this.social, me = roles.myRole();
    if (!me) throw new Error('Only staff can do that.');
    const claim = await s.lookup(tag, true);
    if (!claim) throw new Error(`Nobody has the gamertag "${tag}".`);
    const target = claim.tag, k = low(target);
    if (k === low(s.tag)) throw new Error('You can\'t moderate yourself.');
    if (rank(me) <= rank(roles.roleOfTag(target))) throw new Error('You can only act on players ranked below you.');
    reason = clip(reason, 140);
    const now = Date.now();
    const old = this.records.get(k) || {};
    const rec = {
      target, warns: [...(old.warns || [])], ban: old.ban || null, rename: old.rename || null, log: [...(old.log || [])],
    };
    let note = '';
    if (act === 'warn') {
      if (!reason) throw new Error('Give a reason for the warning.');
      rec.warns.push({ by: s.tag, reason, ts: now });
      rec.warns = rec.warns.slice(-20);
      note = reason;
    } else if (act === 'ban') {
      rec.ban = { by: s.tag, reason: reason || 'Breaking the rules', until: hours > 0 ? now + hours * 3600e3 : 0, ts: now };
      note = `${hours > 0 ? fmtHours(hours) : 'permanent'}${reason ? ' · ' + reason : ''}`;
    } else if (act === 'unban') {
      rec.ban = null;
      note = reason;
    } else if (act === 'rename') {
      rec.rename = { by: s.tag, reason: reason || 'Inappropriate gamertag', ts: now };
      note = rec.rename.reason;
    } else if (act === 'clearwarns') {
      rec.warns = [];
    } else throw new Error('Unknown action.');
    rec.log.push({ by: s.tag, act, note, ts: now });
    rec.log = rec.log.slice(-LOG_MAX);
    const text = await s.sign(rec);
    s.relay.publish(P + k, text, { retain: true });
    await this.receive(k, text);
    return this.records.get(k);
  }
}

export function fmtHours(h) {
  return h >= 24 * 365 ? 'permanent' : h >= 24 ? `${Math.round(h / 24)} day${h >= 48 ? 's' : ''}` : `${h} hour${h === 1 ? '' : 's'}`;
}

export const moderation = new Moderation();
