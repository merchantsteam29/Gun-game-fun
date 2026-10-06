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
const P = V + 'modrec/', ANN = V + 'announce', REP = V + 'report/', PRES = V + 'pres/', FILTER = V + 'chatfilter', APPEAL = V + 'appeal/', STAFFCHAT = V + 'staffchat/';
const STAFFCHAT_KEEP = 3 * 864e5; // staff chat history: 3 days
const LOG_MAX = 30;
const REPORT_MAX_AGE = 7 * 864e5;
const ONLINE_MS = 75000;
const low = (t) => String(t || '').toLowerCase();
const clip = (s, n) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, n);
const parse = (text) => { try { const env = JSON.parse(text); return { env, body: JSON.parse(env.b) }; } catch { return null; } };

export const REPORT_REASONS = ['Cheating / hacking', 'Abusive chat', 'Offensive name', 'Griefing / team killing', 'Spamming', 'Other'];
export const AUTO_FLAG = 'Auto-flag: suspicious stats'; // filed by the host's game, not offered to players

// Starred out in chat for everyone (staff can turn this list off and add their own words).
const DEFAULT_WORDS = ['fuck', 'fucking', 'shit', 'bitch', 'cunt', 'dick', 'pussy', 'asshole', 'bastard', 'slut', 'whore',
  'fag', 'faggot', 'nigger', 'nigga', 'retard', 'kys', 'rape'];

class Moderation {
  constructor() {
    this.raw = new Map(); // lower tag -> latest raw record text (re-checked when the staff list changes)
    this.records = new Map(); // lower tag -> verified record body
    this.announcement = null; // verified announcement body
    this.annRaw = null;
    this.reports = new Map(); // report id -> { id, from, target, lobby, reason, details, ts }
    this.online = new Map(); // lower tag -> { tag, mode, lobby, at }
    this.appeals = new Map(); // lower tag -> { tag, banTs, text, ts }
    this.filter = { defaults: true, words: [] }; // staff-signed chat filter settings
    this.buildFilter();
    this.social = null;
    this.watching = new Set(); // relay topics
    this.onChange = null; // records / reports / online list changed (mod panel)
    this.onWarn = null; // (warning, count) a new warning for you
    this.onBan = null; // (ban | null) your ban started / ended
    this.onMute = null; // (mute | null) your chat mute started / ended
    this.onRename = null; // (rename) you must pick a new gamertag
    this.onKick = null; // (kick) staff removed you from your match
    this.onStaffChat = null; // (message) a new staff chat message
    this.staffChat = new Map(); // id -> { id, from, text, ts }
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
    else if (t === FILTER) this.receiveFilter(text);
    else if (t.startsWith(APPEAL)) this.receiveAppeal(t.slice(APPEAL.length), text);
    else if (t.startsWith(STAFFCHAT) && roles.myRole()) this.receiveStaffChat(t.slice(STAFFCHAT.length), text);
  }

  // Everyone: your own record and announcements. Staff also: all records, reports and presence.
  sync() {
    const s = this.social;
    if (!s) return;
    const want = new Set([ANN, FILTER]);
    if (s.tag) { want.add(P + low(s.tag)); want.add(APPEAL + low(s.tag)); }
    if (roles.myRole()) for (const t of [P + '+', REP + '+', PRES + '+', APPEAL + '+', STAFFCHAT + '+']) want.add(t);
    for (const w of this.watching) if (!want.has(w)) s.relay.unsubscribe(w);
    for (const w of want) if (!this.watching.has(w)) s.relay.subscribe(w);
    this.watching = want;
    if (!roles.myRole()) { this.reports.clear(); this.online.clear(); }
    this.reverify();
    if (this.filterRaw) this.receiveFilter(this.filterRaw);
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
    const banKey = ban ? ban.ts + (ban.appealDenied ? 'd' : '') : null; // a denied appeal updates the ban screen
    if (banKey !== this.lastBan) { this.lastBan = banKey; if (this.onBan) this.onBan(ban); }
    if ((mute ? mute.ts : null) !== this.lastMute) { this.lastMute = mute ? mute.ts : null; if (this.onMute) this.onMute(mute); }
    // Kicked from your match by staff (once per kick).
    if (rec && rec.kick && rec.kick.ts > store.get('kickDone', 0) && Date.now() - rec.kick.ts < 10 * 60000 && this.onKick) {
      store.set('kickDone', rec.kick.ts);
      this.onKick(rec.kick);
    }
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
    } else if (act === 'kick') {
      rec.kick = { by: s.tag, reason: reason || 'Removed by staff', ts: now };
      note = rec.kick.reason;
    } else if (act === 'denyappeal') {
      if (!rec.ban) throw new Error('They aren\'t banned.');
      rec.ban = { ...rec.ban, appealDenied: true };
      note = reason;
    } else if (act === 'note') {
      if (!reason) throw new Error('Type the note first.');
      rec.notes = [...rec.notes, { by: s.tag, text: reason, ts: now }].slice(-20);
      note = reason;
    } else throw new Error('Unknown action.');
    rec.log = [...rec.log, { by: s.tag, act, note, ts: now }].slice(-LOG_MAX);
    const text = await s.sign(rec);
    s.relay.publish(P + k, text, { retain: true });
    if (act === 'unban' || act === 'denyappeal') this.clearAppeal(k); // the appeal is answered
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

  // ---------- Action log (staff) ----------

  // Every staff action on every gamertag, newest first.
  actionLog() {
    const out = [];
    for (const r of this.records.values()) for (const l of r.log || []) out.push({ ...l, target: r.target });
    return out.sort((a, b) => b.ts - a.ts);
  }

  // ---------- Chat filter ----------

  buildFilter() {
    const words = [...new Set([...(this.filter.defaults ? DEFAULT_WORDS : []), ...this.filter.words].map(low).filter(Boolean))];
    // Whole words, also with repeated letters ("fuuuck") and simple symbol swaps ("sh1t").
    const sub = { a: '[a@4]', e: '[e3]', i: '[i1!l]', o: '[o0]', s: '[s$5]', t: '[t7]' };
    const pat = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, '').split('').map((c) => `${sub[c] || c}+`).join('');
    this.filterRe = words.length ? new RegExp(`(^|[^a-z0-9])(${words.map(pat).join('|')})(?=$|[^a-z0-9])`, 'gi') : null;
  }

  // Replaces filtered words with stars.
  clean(text) {
    return this.filterRe ? String(text).replace(this.filterRe, (m, pre, word) => pre + '*'.repeat(word.length)) : String(text);
  }

  async receiveFilter(text) {
    this.filterRaw = text || null;
    const body = text ? await this.staffSigned(text) : null;
    if (!body) return;
    if (this.filterTs && this.filterTs > body.ts) return;
    this.filterTs = body.ts;
    this.filter = { defaults: body.defaults !== false, words: (Array.isArray(body.words) ? body.words : []).map((w) => clip(w, 30).toLowerCase()).filter(Boolean).slice(0, 300) };
    this.buildFilter();
    if (this.onChange) this.onChange(null);
  }

  async saveFilter(words, defaults) {
    if (!roles.myRole()) throw new Error('Only staff can change the chat filter.');
    const list = [...new Set(words.map((w) => clip(w, 30).toLowerCase()).filter((w) => /^[a-z0-9]{2,30}$/.test(w)))].slice(0, 300);
    const signed = await this.social.sign({ defaults: !!defaults, words: list });
    this.social.relay.publish(FILTER, signed, { retain: true });
    await this.receiveFilter(signed);
    return list.length;
  }

  defaultWords() { return DEFAULT_WORDS.slice(); }

  // Gamertags run words together ("xXshitXx"), so names are checked inside the name too
  // (with simple symbol swaps); very short words only count on their own.
  badName(name) {
    const n = String(name).toLowerCase().replace(/[4@]/g, 'a').replace(/3/g, 'e').replace(/[1!]/g, 'i').replace(/0/g, 'o').replace(/[5$]/g, 's').replace(/7/g, 't').replace(/_/g, '');
    const words = [...(this.filter.defaults ? DEFAULT_WORDS : []), ...this.filter.words];
    return words.some((w) => (w.length >= 4 ? n.includes(w) : n === w));
  }

  // ---------- Ban appeals ----------

  // A banned player asks for the ban to be lifted (one message per ban).
  async appeal(text) {
    const s = this.social, ban = this.myBan();
    if (!ban) throw new Error('You aren\'t banned.');
    text = clip(text, 400);
    if (text.length < 10) throw new Error('Explain a bit more (at least 10 characters).');
    s.relay.publish(APPEAL + low(s.tag), await s.sign({ banTs: ban.ts, text }), { retain: true });
    store.set('appealFor', ban.ts);
  }

  appealSent() { const b = this.myBan(); return !!b && store.get('appealFor', 0) === b.ts; }

  async receiveAppeal(k, text) {
    if (!text) { if (this.appeals.delete(k) && this.onChange) this.onChange(null); return; }
    const b = await this.social.verify(text); // signed by the banned player's own gamertag
    if (!b || low(b.from) !== k) return;
    this.appeals.set(k, { tag: b.from, banTs: Number(b.banTs) || 0, text: clip(b.text, 400), ts: Number(b.ts) || 0 });
    if (this.onChange) this.onChange(null);
  }

  // Open appeals: only for bans that are still active and not already denied.
  openAppeals() {
    return [...this.appeals.values()].filter((a) => {
      const ban = this.activeBan(this.records.get(low(a.tag)));
      return ban && ban.ts === a.banTs && !ban.appealDenied;
    }).sort((a, b) => b.ts - a.ts);
  }

  clearAppeal(k) {
    this.social.relay.publish(APPEAL + k, '', { retain: true });
    this.appeals.delete(k);
  }

  // ---------- Auto-flags ----------

  // Filed by the host's game when a player's stats look impossible (see host.js `checkFlags`).
  async autoFlag({ target, lobby, details }) {
    const s = this.social;
    if (!s.tag) return; // reports are signed with a gamertag
    const id = `${low(s.tag)}-${Date.now().toString(36)}`;
    s.relay.publish(REP + id, await s.sign({ id, target: clip(target, 16), lobby: clip(lobby, 8), reason: AUTO_FLAG, details: clip(details, 200) }), { retain: true });
  }

  // ---------- Staff chat ----------
  // Retained, staff-signed messages (staffchat/<id>); only staff subscribe. Messages older than
  // a few days are ignored and cleaned up by whichever staff member sees them.

  async receiveStaffChat(id, text) {
    if (!text) { if (this.staffChat.delete(id) && this.onChange) this.onChange(null); return; }
    const b = await this.staffSigned(text);
    if (!b || !b.text) return;
    if (Date.now() - (Number(b.ts) || 0) > STAFFCHAT_KEEP) { this.social.relay.publish(STAFFCHAT + id, '', { retain: true }); return; }
    if (this.staffChat.has(id)) return;
    const m = { id, from: b.from, text: clip(b.text, 300), ts: Number(b.ts) };
    this.staffChat.set(id, m);
    if (this.onStaffChat && Date.now() - m.ts < 60000) this.onStaffChat(m);
    if (this.onChange) this.onChange(null);
  }

  async sayStaff(text) {
    if (!roles.myRole()) throw new Error('Only staff can use staff chat.');
    text = clip(text, 300);
    if (!text) return;
    const id = `${low(this.social.tag)}-${Date.now().toString(36)}`;
    const signed = await this.social.sign({ text });
    this.social.relay.publish(STAFFCHAT + id, signed, { retain: true });
    await this.receiveStaffChat(id, signed);
  }

  staffChatLog() { return [...this.staffChat.values()].sort((a, b) => a.ts - b.ts).slice(-100); }

  // ---------- Host checks ----------

  // Fetches someone's moderation record (verified) — used by hosts to turn away banned players.
  fetchRecord(tag) {
    const k = low(tag);
    if (this.records.has(k)) return Promise.resolve(this.records.get(k));
    return new Promise((resolve) => {
      const topic = P + k;
      let done = false;
      const off = this.social.relay.onMessage(async (t, payload) => {
        if (t !== topic || done) return;
        const body = await this.verify(k, payload.toString());
        if (body) { done = true; off(); this.social.relay.unsubscribe(topic); resolve(body); }
      });
      this.social.relay.subscribe(topic);
      setTimeout(() => { if (!done) { done = true; off(); if (!this.watching.has(topic) && !this.watching.has(P + '+')) this.social.relay.unsubscribe(topic); resolve(null); } }, 2500);
    });
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
