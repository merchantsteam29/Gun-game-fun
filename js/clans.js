import { store } from './util.js';
import { moderation } from './moderation.js';

// Clans: a name and a short [TAG] shown before members' names. All on the public relay:
//   clan/<tag>             retained, signed by the leader: { tag, name, color, leader, members, since }
//                          (the first clan to claim a tag keeps it; only its leader can update it)
//   clanreq/<tag>/<me>     retained, signed by a player asking to join (or '' to cancel)
//   clanleave/<tag>/<me>   retained, signed by a member who left (the leader's game drops them)
//   clanchat/<tag>/<id>    signed chat messages for members (not kept)
// A player's [TAG] is only shown when the clan's signed member list includes them.

const V = 'whffa/v1/';
const CLAN = V + 'clan/', REQ = V + 'clanreq/', LEAVE = V + 'clanleave/', CHAT = V + 'clanchat/';
export const CLAN_TAG_RE = /^[A-Z0-9]{2,5}$/;
export const MAX_MEMBERS = 30;
export const CLAN_COLORS = ['#ffb020', '#e74c3c', '#3498db', '#2ecc71', '#9b59b6', '#1abc9c', '#ff6fb5', '#ecf0f1'];
const low = (s) => String(s || '').toLowerCase();
const clip = (s, n) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, n);

class Clans {
  constructor() {
    this.records = new Map(); // lower tag -> clan
    this.waiting = new Map(); // lower tag -> [resolve] for lookups
    this.requests = new Map(); // lower player -> { tag, ts } (my clan, leader only)
    this.chat = [];
    this.memberOf = new Map(); // lower gamertag -> clan tag (verified, cached)
    this.onChange = null;
    this.onChat = null;
    this.mine = store.get('myClan', null); // { tag } I belong to (or asked to join: pending)
  }

  init(social) {
    this.social = social;
    social.relay.onMessage((t, payload) => this.route(t, payload.toString()));
    this.sync();
  }

  route(t, text) {
    if (t.startsWith(CLAN)) this.receiveClan(t.slice(CLAN.length), text);
    else if (t.startsWith(REQ)) this.receiveReq(t.slice(REQ.length), text);
    else if (t.startsWith(LEAVE)) this.receiveLeave(t.slice(LEAVE.length), text);
    else if (t.startsWith(CHAT)) this.receiveChat(text);
  }

  // Subscriptions for my clan (record, chat; requests and leaves when I lead it).
  sync() {
    const s = this.social;
    if (!s) return;
    const want = new Set();
    if (this.mine) {
      const k = low(this.mine.tag);
      want.add(CLAN + k);
      if (this.myClan() && this.isLeader()) { want.add(REQ + k + '/+'); want.add(LEAVE + k + '/+'); }
      if (this.myClan()) want.add(CHAT + k + '/+');
    }
    for (const w of this.subs || []) if (!want.has(w)) s.relay.unsubscribe(w);
    for (const w of want) if (!(this.subs || new Set()).has(w)) s.relay.subscribe(w);
    this.subs = want;
  }

  changed() { this.sync(); if (this.onChange) this.onChange(); }

  // ---------- Records ----------
  async receiveClan(k, text) {
    let clan = null;
    if (text) {
      const b = await this.social.verify(text);
      if (b && low(b.tag) === k && CLAN_TAG_RE.test(b.tag) && low(b.leader) === low(b.from)) {
        clan = {
          tag: b.tag, name: clip(b.name, 24), color: CLAN_COLORS.includes(b.color) ? b.color : CLAN_COLORS[0], leader: b.from,
          members: [...new Set((Array.isArray(b.members) ? b.members : []).map((m) => clip(m, 16)).filter(Boolean))].slice(0, MAX_MEMBERS),
          since: Number(b.since) || 0, ts: Number(b.ts) || 0, disbanded: !!b.disbanded,
        };
        if (!clan.members.some((m) => low(m) === low(clan.leader))) clan.members.unshift(clan.leader);
        const old = this.records.get(k);
        // The first leader of a tag keeps it; later updates must come from that leader.
        if (old && !old.disbanded && low(old.leader) !== low(clan.leader) && old.since <= clan.since) clan = old;
        else if (old && low(old.leader) === low(clan.leader) && old.ts > clan.ts) clan = old;
      }
    }
    const gone = !text || (clan && clan.disbanded); // cleared, or disbanded by its leader
    if (clan && clan.disbanded) clan = null;
    if (clan) this.records.set(k, clan); else if (gone) this.records.delete(k);
    // Who shows [TAG]: exactly the current member list.
    for (const [m, ct] of this.memberOf) if (low(ct) === k && !(clan && clan.members.some((x) => low(x) === m))) this.memberOf.delete(m);
    for (const m of (clan ? clan.members : [])) this.memberOf.set(low(m), clan.tag);
    for (const fn of this.waiting.get(k) || []) fn(clan);
    this.waiting.delete(k);
    // I was let in, or removed
    if (this.mine && low(this.mine.tag) === k) {
      const inIt = !!clan && clan.members.some((m) => low(m) === low(this.social.tag));
      if (inIt && this.mine.pending) { this.mine = { tag: clan.tag }; store.set('myClan', this.mine); }
      else if (!inIt && !this.mine.pending && clan) { this.mine = null; store.set('myClan', null); }
      else if (!clan && gone) { this.mine = null; store.set('myClan', null); }
    }
    this.changed();
  }

  // Reads a clan by tag (null if none).
  lookup(tag) {
    const k = low(tag);
    if (this.records.has(k)) return Promise.resolve(this.records.get(k));
    return new Promise((resolve) => {
      if (!this.waiting.has(k)) this.waiting.set(k, []);
      this.waiting.get(k).push(resolve);
      this.social.relay.subscribe(CLAN + k);
      setTimeout(() => {
        const list = this.waiting.get(k);
        if (list) { this.waiting.delete(k); for (const fn of list) fn(this.records.get(k) || null); }
        if (!this.mine || low(this.mine.tag) !== k) this.social.relay.unsubscribe(CLAN + k);
      }, 2500);
    });
  }

  // Every clan (for the clan leaderboard).
  loadAll() { if (!this.all) { this.all = true; this.social.relay.subscribe(CLAN + '+'); } }
  list() { return [...this.records.values()]; }
  color(tag) { const c = this.records.get(low(tag)); return c ? c.color : '#ffb020'; }

  myClan() { return this.mine && !this.mine.pending ? this.records.get(low(this.mine.tag)) || null : null; }
  isLeader() { const c = this.myClan(); return !!c && low(c.leader) === low(this.social.tag); }
  // Verified clan tag of a gamertag (for [TAG] by names), or null. Looks it up in the background.
  tagOf(gamertag) { return gamertag ? this.memberOf.get(low(gamertag)) || null : null; }

  async publishClan(c) {
    const body = { tag: c.tag, name: c.name, color: c.color, leader: c.leader, members: c.members, since: c.since };
    if (c.disbanded) body.disbanded = true;
    const signed = await this.social.sign(body);
    this.social.relay.publish(CLAN + low(c.tag), signed, { retain: true });
    await this.receiveClan(low(c.tag), signed);
  }

  // ---------- Actions ----------
  async create(tag, name, color) {
    const s = this.social;
    if (!s.tag) throw new Error('Pick a gamertag first (Friends).');
    if (this.myClan()) throw new Error('Leave your clan first.');
    tag = String(tag || '').toUpperCase().trim();
    name = clip(name, 24);
    if (!CLAN_TAG_RE.test(tag)) throw new Error('Clan tags are 2 to 5 letters or numbers.');
    if (name.length < 3) throw new Error('Give your clan a name (3+ characters).');
    if (moderation.badName(tag) || moderation.badName(name)) throw new Error('Pick a different name or tag.');
    const taken = await this.lookup(tag);
    if (taken) throw new Error(`[${tag}] is already taken by ${taken.name}.`);
    this.mine = { tag };
    store.set('myClan', this.mine);
    this.sync();
    await this.publishClan({ tag, name, color: CLAN_COLORS.includes(color) ? color : CLAN_COLORS[0], leader: s.tag, members: [s.tag], since: Date.now() });
  }

  async requestJoin(tag) {
    const s = this.social;
    if (!s.tag) throw new Error('Pick a gamertag first (Friends).');
    if (this.myClan()) throw new Error('Leave your clan first.');
    const clan = await this.lookup(tag);
    if (!clan) throw new Error(`No clan has the tag [${String(tag).toUpperCase()}].`);
    if (clan.members.length >= MAX_MEMBERS) throw new Error('That clan is full.');
    this.cancelRequest();
    this.mine = { tag: clan.tag, pending: true };
    store.set('myClan', this.mine);
    s.relay.publish(REQ + low(clan.tag) + '/' + low(s.tag), await s.sign({ clan: clan.tag }), { retain: true });
    this.changed();
    return clan;
  }

  cancelRequest() {
    if (this.mine && this.mine.pending) {
      this.social.relay.publish(REQ + low(this.mine.tag) + '/' + low(this.social.tag), '', { retain: true });
      this.mine = null;
      store.set('myClan', null);
      this.changed();
    }
  }

  async receiveReq(path, text) {
    const [k, who] = path.split('/');
    const c = this.myClan();
    if (!c || !this.isLeader() || low(c.tag) !== k) return;
    if (!text) { this.requests.delete(who); this.changed(); return; }
    const b = await this.social.verify(text);
    if (!b || low(b.from) !== who || low(b.clan) !== k) return;
    if (c.members.some((m) => low(m) === who)) { this.clearReq(k, who); return; }
    this.requests.set(who, { tag: b.from, ts: Number(b.ts) || 0 });
    this.changed();
  }
  clearReq(k, who) { this.requests.delete(who); this.social.relay.publish(REQ + k + '/' + who, '', { retain: true }); }

  async accept(who) {
    const c = this.myClan(), r = this.requests.get(low(who));
    if (!c || !this.isLeader() || !r) return;
    if (c.members.length >= MAX_MEMBERS) throw new Error('Your clan is full.');
    this.clearReq(low(c.tag), low(who));
    await this.publishClan({ ...c, members: [...c.members, r.tag] });
  }
  deny(who) { const c = this.myClan(); if (c) this.clearReq(low(c.tag), low(who)); this.changed(); }

  async kick(who) {
    const c = this.myClan();
    if (!c || !this.isLeader() || low(who) === low(c.leader)) return;
    await this.publishClan({ ...c, members: c.members.filter((m) => low(m) !== low(who)) });
  }

  async leave() {
    const c = this.myClan(), s = this.social;
    if (!c) { this.cancelRequest(); return; }
    if (this.isLeader()) {
      const rest = c.members.filter((m) => low(m) !== low(s.tag));
      if (rest.length) throw new Error('You lead this clan: hand it over or remove everyone first, or disband it.');
      return this.disband();
    }
    s.relay.publish(LEAVE + low(c.tag) + '/' + low(s.tag), await s.sign({ clan: c.tag }), { retain: true });
    this.mine = null;
    store.set('myClan', null);
    this.memberOf.delete(low(s.tag));
    this.changed();
  }

  async disband() {
    const c = this.myClan();
    if (!c || !this.isLeader()) return;
    await this.publishClan({ ...c, members: [], disbanded: true });
    this.mine = null;
    store.set('myClan', null);
    this.changed();
  }

  async receiveLeave(path, text) {
    const [k, who] = path.split('/');
    const c = this.myClan();
    if (!text || !c || !this.isLeader() || low(c.tag) !== k) return;
    const b = await this.social.verify(text);
    if (!b || low(b.from) !== who) return;
    this.social.relay.publish(LEAVE + k + '/' + who, '', { retain: true });
    if (c.members.some((m) => low(m) === who)) await this.publishClan({ ...c, members: c.members.filter((m) => low(m) !== who) });
  }

  // ---------- Chat ----------
  async say(text) {
    const c = this.myClan(), s = this.social;
    text = clip(text, 200);
    if (!c || !text) return;
    if (moderation.myMute && moderation.myMute()) throw new Error('You are muted.');
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    s.relay.publish(CHAT + low(c.tag) + '/' + id, await s.sign({ text: moderation.clean ? moderation.clean(text) : text, id }));
  }
  async receiveChat(text) {
    const c = this.myClan();
    if (!c || !text) return;
    const b = await this.social.verify(text);
    if (!b || !c.members.some((m) => low(m) === low(b.from)) || this.chat.some((x) => x.id === b.id)) return;
    this.chat.push({ id: String(b.id), from: b.from, text: clip(b.text, 200), ts: Number(b.ts) || Date.now() });
    this.chat = this.chat.slice(-60);
    if (this.onChat) this.onChat(this.chat[this.chat.length - 1]);
    if (this.onChange) this.onChange();
  }
}

export const clans = new Clans();
