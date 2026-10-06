import { roles, rank, verifyWith } from './roles.js';
import { store } from './util.js';

// Moderation over the public relays (no server of our own):
//
//  modrec/<tag>   one retained, staff-signed record per gamertag: warnings, ban, chat mute, forced
//                 gamertag change, staff notes and an action log. Each action re-publishes the whole
//                 record signed by the staff member who made it; clients only accept it if that
//                 signer is the owner or a moderator ranked above the player.
//  announce       retained, staff-signed announcement every player sees (until it expires).
//  report/<id>    retained player reports (signed by the reporter's gamertag), read by staff.
//  pres/+         (staff only) everyone's signed online status, for the "Online now" list.
//
// Players watch their own record: new warnings pop up, a ban locks them out of matches, a mute
// blocks their chat, and a forced gamertag change releases their tag. Enforcement is done by the
// game itself — clearing site data or a new gamertag gets around it.

const V = 'whffa/v1/';
const P = V + 'modrec/', ANN = V + 'announce', REP = V + 'report/', PRES = V + 'pres/';
const LOG_MAX = 30;
const REPORT_MAX_AGE = 7 * 864e5;
const ONLINE_MS = 75000;
const low = (t) => String(t || '').toLowerCase();
const clip = (s, n) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, n);
const parse = (text) => { try { const env = JSON.parse(text); return { env, body: JSON.parse(env.b) }; } catch { return null; } };

export const REPORT_REASONS = ['Cheating / hacking', 'Abusive chat', 'Offensive name', 'Griefing / team killing', 'Spamming', 'Other'];

class Moderation {
  constructor() {
    this.raw = new Map(); // lower tag -> latest raw record text (re-checked when the staff list changes)
    this.records = new Map(); // lower tag -> verified record body
    this.announcement = null; // verified announcement body
    this.annRaw = null;
    this.reports = new Map(); // report id -> { id, from, target, lobby, reason, details, ts }
    this.online = new Map(); // lower tag -> { tag, mode, lobby, at }
    this.social = null;
    this.watching = new Set(); // relay topics
    this.onChange = null; // records / reports / online list changed (mod panel)
    this.onWarn = null; // (warning, count) a new warning for you
    this.onBan = null; // (ban | null) your ban started / ended
    this.onMute = null; // (mute | null) your chat mute started / ended
    this.onRename = null; // (rename) you must pick a new gamertag
    this.onAnnounce = null; // (announcement | null)
    this.lastBan = null;
    this.lastMute = null;
  }

  init(social) {
    this.social = social;
    social.relay.onMessage((t, payload, packet) => this.route(t, payload.toString(), packet));
    const prev = social.relay.onConnect;
    social.relay.onConnect = () => { if (prev) prev(); for (const w of this.watching) social.relay.subscribe(w); };
    this.sync();
  }

  route(t, text, packet) {
    if (t.startsWith(P)) this.receive(t.slice(P.length), text);
    else if (t === ANN) this.receiveAnnouncement(text);
    else if (t.startsWith(REP)) this.receiveReport(t.slice(REP.length), text);
    else if (t.startsWith(PRES) && roles.myRole()) this.receivePresence(t.slice(PRES.length), text, packet);
  }

  // Everyone: your own record and announcements. Staff also: all records, reports and presence.
  sync() {
    const s = this.social;
    if (!s) return;
    const want = new Set([ANN]);
    if (s.tag) want.add(P + low(s.tag));
    if (roles.myRole()) for (const t of [P + '+', REP + '+', PRES + '+']) want.add(t);
    for (const w of this.watching) if (!want.has(w)) s.relay.unsubscribe(w);
    for (const w of want) if (!this.watching.has(w)) s.relay.subscribe(w);
    this.watching = want;
    if (!roles.myRole()) { this.reports.clear(); this.online.clear(); }
    this.reverify();
  }

  // Signed by someone who is staff right now?
  async staffSigned(text) {
    const p = parse(text);
    if (!p || !p.body.from) return null;
    const pub = roles.pubOf(p.body.from);
    return pub && roles.roleOfTag(p.body.from) && (await verifyWith(pub, p.env)) ? p.body : null;
  }

  // ---------- Records ----------

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
    const p = parse(text);
    if (!p || low(p.body.target) !== k || !p.body.from) return null;
    const role = roles.roleOfTag(p.body.from), pub = roles.pubOf(p.body.from);
    if (!role || !pub || rank(role) <= rank(roles.roleOfTag(p.body.target))) return null;
    return (await verifyWith(pub, p.env)) ? p.body : null;
  }

  // The staff list loaded / changed: things signed by moderators may only be valid now.
  async reverify() {
    for (const [k, text] of this.raw) {
      const body = await this.verify(k, text);
      if (body) this.records.set(k, body); else this.records.delete(k);
      this.changed(k);
    }
    if (this.annRaw) this.receiveAnnouncement(this.annRaw);
  }

  changed(k) {
    if (this.onChange) this.onChange(k);
    if (this.social && k === low(this.social.tag)) this.applyMine();
  }

  // ---------- Your own record ----------

  active(x) { return x && (!x.until || x.until > Date.now()) ? x : null; }
  activeBan(rec) { return this.active(rec && rec.ban); }
  activeMute(rec) { return this.active(rec && rec.mute); }
  mine() { const s = this.social; return s && s.tag ? this.records.get(low(s.tag)) : null; }
  myBan() { return this.activeBan(this.mine()); }
  myMute() { return this.activeMute(this.mine()); }

  applyMine() {
    const rec = this.mine();
    // Warnings you haven't acknowledged yet (newest last).
    const seen = store.get('warnSeen', 0);
    const fresh = ((rec && rec.warns) || []).filter((w) => w.ts > seen);
    if (fresh.length && this.onWarn) this.onWarn(fresh[fresh.length - 1], fresh.length);
    // Ban / mute start or end.
    const ban = this.activeBan(rec), mute = this.activeMute(rec);
    if ((ban ? ban.ts : null) !== this.lastBan) { this.lastBan = ban ? ban.ts : null; if (this.onBan) this.onBan(ban); }
    if ((mute ? mute.ts : null) !== this.lastMute) { this.lastMute = mute ? mute.ts : null; if (this.onMute) this.onMute(mute); }
    // Forced gamertag change.
    if (rec && rec.rename && rec.rename.ts > store.get('renameDone', 0) && this.onRename) {
      store.set('renameDone', rec.rename.ts);
      this.onRename(rec.rename);
    }
  }

  ackWarnings() {
    const rec = this.mine();
    const last = Math.max(0, ...((rec && rec.warns) || []).map((w) => w.ts));
    store.set('warnSeen', Math.max(store.get('warnSeen', 0), last));
  }

  // ---------- Staff actions on a gamertag ----------

  // act: 'warn' | 'ban' | 'unban' | 'mute' | 'unmute' | 'rename' | 'clearwarns' | 'note'.
  async act(tag, act, { reason = '', hours = 0 } = {}) {
    const s = this.social, me = roles.myRole();
    if (!me) throw new Error('Only staff can do that.');
    const claim = await s.lookup(tag, true);
    if (!claim) throw new Error(`Nobody has the gamertag "${tag}".`);
    const target = claim.tag, k = low(target);
    if (k === low(s.tag)) throw new Error('You can\'t moderate yourself.');
    if (rank(me) <= rank(roles.roleOfTag(target))) throw new Error('You can only act on players ranked below you.');
    reason = clip(reason, 140);
    const now = Date.now(), until = hours > 0 ? now + hours * 3600e3 : 0;
    const old = this.records.get(k) || {};
    const rec = {
      target, warns: [...(old.warns || [])], ban: old.ban || null, mute: old.mute || null, rename: old.rename || null,
      notes: [...(old.notes || [])], log: [...(old.log || [])],
    };
    let note = '';
    const span = hours > 0 ? fmtHours(hours) : 'permanent';
    if (act === 'warn') {
      if (!reason) throw new Error('Give a reason for the warning.');
      rec.warns = [...rec.warns, { by: s.tag, reason, ts: now }].slice(-20);
      note = reason;
    } else if (act === 'ban') {
      rec.ban = { by: s.tag, reason: reason || 'Breaking the rules', until, ts: now };
      note = `${span}${reason ? ' · ' + reason : ''}`;
    } else if (act === 'unban') {
      rec.ban = null;
      note = reason;
    } else if (act === 'mute') {
      rec.mute = { by: s.tag, reason: reason || 'Chat abuse', until, ts: now };
      note = `${span}${reason ? ' · ' + reason : ''}`;
    } else if (act === 'unmute') {
      rec.mute = null;
      note = reason;
    } else if (act === 'rename') {
      rec.rename = { by: s.tag, reason: reason || 'Inappropriate gamertag', ts: now };
      note = rec.rename.reason;
    } else if (act === 'clearwarns') {
      rec.warns = [];
    } else if (act === 'note') {
      if (!reason) throw new Error('Type the note first.');
      rec.notes = [...rec.notes, { by: s.tag, text: reason, ts: now }].slice(-20);
      note = reason;
    } else throw new Error('Unknown action.');
    rec.log = [...rec.log, { by: s.tag, act, note, ts: now }].slice(-LOG_MAX);
    const text = await s.sign(rec);
    s.relay.publish(P + k, text, { retain: true });
    await this.receive(k, text);
    return this.records.get(k);
  }

  // ---------- Announcements ----------

  async receiveAnnouncement(text) {
    this.annRaw = text || null;
    const body = text ? await this.staffSigned(text) : null;
    const a = body && body.text && (!body.until || body.until > Date.now()) ? body : null;
    if (a && this.announcement && this.announcement.ts > a.ts) return;
    this.announcement = a;
    if (this.onAnnounce) this.onAnnounce(a);
    if (this.onChange) this.onChange(null);
  }

  async announce(text, hours, level = 'info') {
    if (!roles.myRole()) throw new Error('Only staff can post announcements.');
    text = clip(text, 200);
    if (!text) throw new Error('Type the announcement first.');
    const body = { text, level: level === 'warn' ? 'warn' : 'info', until: hours > 0 ? Date.now() + hours * 3600e3 : 0, id: Date.now().toString(36) };
    const signed = await this.social.sign(body);
    this.social.relay.publish(ANN, signed, { retain: true });
    await this.receiveAnnouncement(signed);
  }

  async clearAnnouncement() {
    if (!roles.myRole()) throw new Error('Only staff can do that.');
    const signed = await this.social.sign({ text: '', until: 0, id: 'cleared' });
    this.social.relay.publish(ANN, signed, { retain: true });
    await this.receiveAnnouncement(signed);
  }

  // ---------- Reports ----------

  // Anyone with a gamertag can report a player (once a minute).
  async report({ target, lobby, reason, details }) {
    const s = this.social;
    if (!s.tag) throw new Error('Pick a gamertag first so staff know who sent the report.');
    if (Date.now() - (this.lastReport || 0) < 60000) throw new Error('You just sent a report. Wait a minute before sending another.');
    if (!REPORT_REASONS.includes(reason)) throw new Error('Pick a reason.');
    const id = `${low(s.tag)}-${Date.now().toString(36)}`;
    s.relay.publish(REP + id, await s.sign({ id, target: clip(target, 16), lobby: clip(lobby, 8), reason, details: clip(details, 200) }), { retain: true });
    this.lastReport = Date.now();
  }

  async receiveReport(id, text) {
    if (!text) { if (this.reports.delete(id) && this.onChange) this.onChange(null); return; }
    const b = await this.social.verify(text); // signed by the reporter's own gamertag
    if (!b || b.id !== id || Date.now() - (Number(b.ts) || 0) > REPORT_MAX_AGE) return;
    this.reports.set(id, { id, from: b.from, target: clip(b.target, 16), lobby: clip(b.lobby, 8), reason: clip(b.reason, 40), details: clip(b.details, 200), ts: Number(b.ts) });
    if (this.onChange) this.onChange(null);
  }

  // Staff: resolve a report (removes it for every staff member).
  dismissReport(id) {
    if (!roles.myRole()) return;
    this.social.relay.publish(REP + id, '', { retain: true });
    this.reports.delete(id);
    if (this.onChange) this.onChange(null);
  }

  // ---------- Online now (staff) ----------

  async receivePresence(k, text, packet) {
    if (!text) return;
    const b = await this.social.verify(text);
    if (!b || low(b.from) !== k) return;
    const fresh = !(packet && packet.retain) || Math.abs(Date.now() - (Number(b.ts) || 0)) < ONLINE_MS;
    if (b.on && fresh) this.online.set(k, { tag: b.from, mode: b.mode, lobby: b.lobby, at: Date.now() });
    else this.online.delete(k);
    if (this.onChange) this.onChange(null);
  }

  onlineNow() {
    const now = Date.now();
    for (const [k, o] of this.online) if (now - o.at > ONLINE_MS) this.online.delete(k);
    return [...this.online.values()].sort((a, b) => a.tag.localeCompare(b.tag));
  }
}

export function fmtHours(h) {
  return h >= 24 * 365 ? 'permanent' : h >= 24 ? `${Math.round(h / 24)} day${h >= 48 ? 's' : ''}` : `${h} hour${h === 1 ? '' : 's'}`;
}

export const moderation = new Moderation();
