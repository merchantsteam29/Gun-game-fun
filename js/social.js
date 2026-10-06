import { Relay } from './relay.js';
import { store } from './util.js';

// Gamertags, friends and party chat — no server of our own, everything goes over the public
// relays (relay.js).
//
// Gamertag: one per player, unique (case-insensitive). Claiming one publishes a retained
// "claim" with this device's public key. Every friend request, chat line, invite and status
// update is signed with the matching private key and checked against the claim, so nobody
// can talk or send requests as you. (The relays have no access control, so this keeps honest
// players honest and stops impersonation; it can't stop someone determined from vandalising
// retained data.) A gamertag nobody has used for 120 days becomes free again.
//
// Topics (whffa/v1/…):  tag/<tag>            retained claim
//                       req/<to>/<from>      retained friend request
//                       acc/<to>/<from>      retained "request accepted"
//                       rm/<to>/<from>       retained "unfriended"
//                       pres/<tag>           retained online status (refreshed every 30 s)
//                       inbox/<tag>          party invites
//                       party/<id>/state     retained party roster (from the leader)
//                       party/<id>/{join,leave,chat}

const P = 'whffa/v1/';
const TAG_RE = /^[A-Za-z0-9_]{3,16}$/;
export const TAG_RULES = '3–16 letters, numbers or _';
const CLAIM_EXPIRE = 120 * 864e5;
const PRES_MS = 30000, ONLINE_MS = 75000;
const ALG = { name: 'ECDSA', namedCurve: 'P-256' }, SIG = { name: 'ECDSA', hash: 'SHA-256' };
const PARTY_TOPICS = ['state', 'join', 'leave', 'chat', 'voice'];

const low = (t) => String(t || '').toLowerCase();
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = (s) => Uint8Array.from(atob(String(s).replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const randId = (n = 8) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, '0')).join('');
const clip = (s, n) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, n);
const sameKey = (a, b) => !!a && !!b && a.x === b.x && a.y === b.y;
export const validTag = (t) => TAG_RE.test(t || '');

export class Social {
  constructor() {
    const g = store.get('gamertag', null);
    this.tag = g && validTag(g.tag) ? g.tag : null;
    this.since = g ? g.since : 0;
    this.friends = new Map(); // lower -> { tag, pres, presAt }
    for (const t of store.get('friends', [])) if (validTag(t)) this.friends.set(low(t), { tag: t, pres: null, presAt: 0 });
    this.outgoing = new Map(Object.entries(store.get('friendReqOut', {}))); // lower -> tag
    this.incoming = new Map(); // lower -> tag
    this.invites = new Map(); // partyId -> { from, leader }
    this.party = null; // { id, leader, members: [tags], lobby }
    this.partyLog = [];
    this.where = { mode: 'menu', lobby: null };
    this.keys = new Map(); // lower -> Promise<{ jwk, since } | null>
    this.seen = new Set(); // recently handled payloads (each relay delivers a copy)
    this.onChange = null;
    this.onPartyChat = null; // ({ from, text, mine })
    this.onNotice = null; // (text)
    this.relay = new Relay();
    this.relay.onMessage((t, p, k) => this.receive(t, p, k));
    this.relay.onStatus = () => this.changed();
    this.relay.onConnect = () => { if (this.tag) { this.publishClaim(); this.publishPresence(); if (this.party && this.isLeader) this.publishPartyState(); } };
    this.ready = this.init();
  }

  get status() { return this.relay.status; }
  get me() { return low(this.tag); }
  get isLeader() { return !!this.party && low(this.party.leader) === this.me; }
  get pendingCount() { return this.incoming.size + this.invites.size; }

  changed() { if (this.onChange) this.onChange(this); }
  notice(text) { if (this.onNotice) this.onNotice(text); }

  async init() {
    await this.loadKeys();
    await this.relay.start();
    if (this.tag) this.goOnline();
    // Tell friends you left (best effort); otherwise you show as offline after ~75 s.
    window.addEventListener('pagehide', () => { if (this.tag) this.publishPresence(false); });
  }

  // ---------- Keys & signing ----------
  async loadKeys() {
    const saved = store.get('idKeys', null);
    if (saved && saved.priv && saved.pub) {
      try {
        this.priv = await crypto.subtle.importKey('jwk', saved.priv, ALG, false, ['sign']);
        this.pub = { kty: 'EC', crv: 'P-256', x: saved.pub.x, y: saved.pub.y };
        return;
      } catch { /* make new keys */ }
    }
    const kp = await crypto.subtle.generateKey(ALG, true, ['sign', 'verify']);
    const priv = await crypto.subtle.exportKey('jwk', kp.privateKey);
    const pub = await crypto.subtle.exportKey('jwk', kp.publicKey);
    store.set('idKeys', { priv, pub: { x: pub.x, y: pub.y } });
    this.priv = kp.privateKey;
    this.pub = { kty: 'EC', crv: 'P-256', x: pub.x, y: pub.y };
  }

  async sign(body) {
    const b = JSON.stringify({ ...body, from: this.tag, ts: Date.now() });
    const s = b64(await crypto.subtle.sign(SIG, this.priv, new TextEncoder().encode(b)));
    return JSON.stringify({ b, s });
  }

  async send(topic, body, retain = false) {
    if (!this.tag) return;
    this.relay.publish(topic, await this.sign(body), { retain });
  }

  clear(topic) { this.relay.publish(topic, '', { retain: true }); }

  // Checks a signed message against its sender's gamertag claim. Returns the body or null.
  async verify(text) {
    let env, body;
    try { env = JSON.parse(text); body = JSON.parse(env.b); } catch { return null; }
    if (!body || !validTag(body.from) || typeof env.s !== 'string') return null;
    const claim = await this.lookup(body.from);
    if (!claim) return null;
    try {
      const key = await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: claim.pub.x, y: claim.pub.y }, ALG, false, ['verify']);
      const ok = await crypto.subtle.verify(SIG, key, unb64(env.s), new TextEncoder().encode(env.b));
      return ok ? body : null;
    } catch { return null; }
  }

  // ---------- Gamertag claims ----------
  // Reads the claim for a gamertag (null if nobody has it). Cached for a few minutes.
  lookup(tag, fresh = false) {
    const k = low(tag);
    const hit = this.keys.get(k);
    if (hit && !fresh && Date.now() - hit.at < 5 * 60 * 1000) return hit.p;
    const p = new Promise((resolve) => {
      const topic = P + 'tag/' + k;
      let best = null;
      const off = this.relay.onMessage((t, payload) => {
        if (t !== topic) return;
        try {
          const c = JSON.parse(payload.toString());
          if (!c || low(c.tag) !== k || !c.pub || !c.pub.x || !c.pub.y) return;
          if (Date.now() - (Number(c.seen) || 0) > CLAIM_EXPIRE) return; // abandoned
          if (!best || (Number(c.since) || 0) < (Number(best.since) || 0)) best = c; // first claim wins
        } catch { /* ignore */ }
      });
      this.relay.subscribe(topic);
      setTimeout(() => { off(); this.relay.unsubscribe(topic); resolve(best); }, 2200);
    });
    this.keys.set(k, { p, at: Date.now() });
    return p;
  }

  publishClaim() {
    if (!this.tag) return;
    const claim = { tag: this.tag, pub: { x: this.pub.x, y: this.pub.y }, since: this.since, seen: Date.now() };
    this.relay.publish(P + 'tag/' + this.me, JSON.stringify(claim), { retain: true });
  }

  async available(tag) {
    if (!validTag(tag)) return { ok: false, error: `Gamertag must be ${TAG_RULES}.` };
    if (!this.relay.online) await this.relay.start();
    if (!this.relay.online) return { ok: false, error: 'Can\'t reach the gamertag service right now. Check your internet.' };
    const c = await this.lookup(tag, true);
    if (c && !sameKey(c.pub, this.pub)) return { ok: false, error: 'That gamertag is taken.' };
    return { ok: true };
  }

  // Claims your one gamertag. Throws with a friendly message if it's taken.
  async claim(tag) {
    tag = clip(tag, 16);
    if (this.tag) throw new Error('You already have a gamertag.');
    const a = await this.available(tag);
    if (!a.ok) throw new Error(a.error);
    this.tag = tag;
    this.since = Date.now();
    this.publishClaim();
    // If two people grab the same tag at once, the earlier claim wins: check after a moment.
    await new Promise((r) => setTimeout(r, 1500));
    const c = await this.lookup(tag, true);
    if (c && !sameKey(c.pub, this.pub)) { this.tag = null; throw new Error('Someone just took that gamertag. Try another.'); }
    store.set('gamertag', { tag: this.tag, since: this.since });
    this.keys.set(this.me, { p: Promise.resolve({ tag, pub: this.pub, since: this.since }), at: Date.now() });
    this.goOnline();
    this.changed();
  }

  // Gives up your gamertag (a moderator made you change it): the claim is cleared so it's free
  // again, and you pick a new one. Friends stay saved on this device.
  releaseTag() {
    if (!this.tag) return;
    const me = this.me;
    this.publishPresence(false);
    clearInterval(this.presT);
    this.clear(P + 'tag/' + me);
    for (const t of [`req/${me}/+`, `acc/${me}/+`, `rm/${me}/+`, `inbox/${me}`]) this.relay.unsubscribe(P + t);
    this.keys.delete(me);
    this.tag = null;
    this.since = 0;
    store.set('gamertag', null);
    this.changed();
  }

  goOnline() {
    const me = this.me;
    for (const t of [`req/${me}/+`, `acc/${me}/+`, `rm/${me}/+`, `inbox/${me}`]) this.relay.subscribe(P + t);
    for (const f of this.friends.keys()) this.relay.subscribe(P + 'pres/' + f);
    this.publishClaim();
    this.publishPresence();
    clearInterval(this.presT);
    this.presT = setInterval(() => { this.publishPresence(); this.changed(); }, PRES_MS);
  }

  // ---------- Presence ----------
  setWhere(mode, lobby = null) {
    this.where = { mode, lobby };
    this.publishPresence();
    if (this.isLeader) this.publishPartyState();
  }

  publishPresence(online = true) {
    if (!this.tag) return;
    this.send(P + 'pres/' + this.me, { on: online, mode: this.where.mode, lobby: this.where.lobby, party: this.party ? this.party.id : null }, true);
  }

  isOnline(f) { return !!f.pres && f.pres.on && Date.now() - f.presAt < ONLINE_MS; }

  // ---------- Friends ----------
  saveFriends() {
    store.set('friends', [...this.friends.values()].map((f) => f.tag));
    store.set('friendReqOut', Object.fromEntries(this.outgoing));
  }

  async addFriend(tag) {
    tag = clip(tag, 16);
    if (!this.tag) throw new Error('Pick your gamertag first.');
    if (!validTag(tag)) throw new Error(`Gamertags are ${TAG_RULES}.`);
    const k = low(tag);
    if (k === this.me) throw new Error('That\'s you!');
    if (this.friends.has(k)) throw new Error(`${this.friends.get(k).tag} is already your friend.`);
    if (this.incoming.has(k)) { await this.accept(k); return 'accepted'; }
    const claim = await this.lookup(tag, true);
    if (!claim) throw new Error(`No player has the gamertag "${tag}".`);
    await this.send(P + `req/${k}/${this.me}`, { to: claim.tag }, true);
    this.outgoing.set(k, claim.tag);
    this.saveFriends();
    this.changed();
    return 'sent';
  }

  async accept(k) {
    const tag = this.incoming.get(k);
    if (!tag) return;
    this.incoming.delete(k);
    this.clear(P + `req/${this.me}/${k}`);
    await this.send(P + `acc/${k}/${this.me}`, { to: tag }, true);
    this.addFriendLocal(tag);
  }

  decline(k) {
    this.incoming.delete(k);
    this.clear(P + `req/${this.me}/${k}`);
    this.changed();
  }

  cancel(k) {
    this.outgoing.delete(k);
    this.clear(P + `req/${k}/${this.me}`);
    this.saveFriends();
    this.changed();
  }

  async removeFriend(k) {
    const f = this.friends.get(k);
    if (!f) return;
    this.friends.delete(k);
    this.relay.unsubscribe(P + 'pres/' + k);
    this.saveFriends();
    await this.send(P + `rm/${k}/${this.me}`, { to: f.tag }, true);
    this.changed();
  }

  addFriendLocal(tag) {
    const k = low(tag);
    this.outgoing.delete(k);
    if (!this.friends.has(k)) {
      this.friends.set(k, { tag, pres: null, presAt: 0 });
      this.relay.subscribe(P + 'pres/' + k);
      this.notice(`${tag} is now your friend`);
    }
    this.saveFriends();
    this.changed();
  }

  // ---------- Party ----------
  async invite(k) {
    const f = this.friends.get(k);
    if (!f || !this.tag) return;
    if (!this.party) this.startParty();
    else if (!this.isLeader) throw new Error('Only the party leader can invite.');
    this.party.invited.add(k);
    await this.send(P + 'inbox/' + k, { type: 'invite', party: this.party.id, to: f.tag });
    this.notice(`Invited ${f.tag} to your party`);
  }

  startParty() {
    const id = randId(6);
    this.party = { id, leader: this.tag, members: [this.tag], lobby: this.where.lobby, invited: new Set() };
    this.partyLog = [];
    this.subscribeParty(id);
    this.publishPartyState();
    this.publishPresence();
    this.changed();
  }

  subscribeParty(id) {
    for (const t of PARTY_TOPICS) this.relay.subscribe(P + `party/${id}/${t}`);
  }

  unsubscribeParty(id) {
    for (const t of PARTY_TOPICS) this.relay.unsubscribe(P + `party/${id}/${t}`);
    if (this.onPartyGone) this.onPartyGone(id);
  }

  // Voice: "I'm in voice / I left voice" to the party (voice.js listens via onVoice).
  sendVoice(inVoice) {
    if (this.party) this.send(P + `party/${this.party.id}/voice`, { in: !!inVoice, n: randId(3) });
  }

  publishPartyState(disband = false) {
    if (!this.isLeader) return;
    this.send(P + `party/${this.party.id}/state`, disband ? { disband: true } : { members: this.party.members, lobby: this.where.lobby }, true);
  }

  async acceptInvite(id) {
    const inv = this.invites.get(id);
    if (!inv) return;
    this.invites.delete(id);
    if (this.party) await this.leaveParty();
    this.party = { id, leader: inv.from, members: [inv.from, this.tag], lobby: null, invited: new Set() };
    this.partyLog = [];
    this.subscribeParty(id);
    await this.send(P + `party/${id}/join`, {});
    // Ask again a few times until the leader's roster lists us (in case a message got lost).
    let tries = 0;
    const retry = setInterval(() => {
      const p = this.party;
      if (!p || p.id !== id || p.confirmed || ++tries > 6) { clearInterval(retry); return; }
      this.send(P + `party/${id}/join`, {});
    }, 4000);
    this.publishPresence();
    this.changed();
  }

  declineInvite(id) { this.invites.delete(id); this.changed(); }

  async leaveParty() {
    const p = this.party;
    if (!p) return;
    if (this.isLeader) { this.publishPartyState(true); this.clear(P + `party/${p.id}/state`); }
    else await this.send(P + `party/${p.id}/leave`, {});
    this.unsubscribeParty(p.id);
    this.party = null;
    this.partyLog = [];
    this.publishPresence();
    this.changed();
  }

  async sayParty(text) {
    text = clip(text, 160);
    if (!text || !this.party) return;
    const id = randId(6);
    this.seenChat(id);
    this.logParty(this.tag, text, true);
    await this.send(P + `party/${this.party.id}/chat`, { text, id });
  }

  logParty(from, text, mine = false) {
    this.partyLog.push({ from, text, mine });
    if (this.partyLog.length > 80) this.partyLog.shift();
    if (this.onPartyChat) this.onPartyChat({ from, text, mine });
    this.changed();
  }

  seenChat(id) {
    this.chatIds = this.chatIds || new Set();
    if (this.chatIds.has(id)) return true;
    this.chatIds.add(id);
    if (this.chatIds.size > 300) this.chatIds.delete(this.chatIds.values().next().value);
    return false;
  }

  // ---------- Incoming ----------
  async receive(topic, payload, packet) {
    if (!topic.startsWith(P) || !this.tag) return;
    const text = payload ? payload.toString() : '';
    const key = topic + '|' + text;
    if (this.seen.has(key)) return; // the same message from the other relay
    this.seen.add(key);
    if (this.seen.size > 600) this.seen.delete(this.seen.values().next().value);
    setTimeout(() => this.seen.delete(key), 60000);
    const parts = topic.slice(P.length).split('/');
    const kind = parts[0], me = this.me;

    if ((kind === 'req' || kind === 'acc' || kind === 'rm') && parts[1] === me) {
      const fromK = parts[2];
      if (!text) { if (kind === 'req') { this.incoming.delete(fromK); this.changed(); } return; }
      const b = await this.verify(text);
      if (!b || low(b.from) !== fromK || low(b.to) !== me) return;
      if (kind === 'req') {
        if (this.friends.has(fromK)) { this.incoming.set(fromK, b.from); await this.accept(fromK); return; } // they re-sent: just confirm
        if (this.outgoing.has(fromK)) { this.incoming.set(fromK, b.from); await this.accept(fromK); return; } // both asked
        if (!this.incoming.has(fromK)) this.notice(`Friend request from ${b.from}`);
        this.incoming.set(fromK, b.from);
      } else if (kind === 'acc') {
        this.clear(topic);
        this.addFriendLocal(b.from);
      } else {
        this.clear(topic);
        if (this.friends.delete(fromK)) { this.relay.unsubscribe(P + 'pres/' + fromK); this.saveFriends(); }
      }
      this.changed();
      return;
    }

    if (kind === 'pres') {
      const f = this.friends.get(parts[1]);
      if (!f || !text) return;
      const b = await this.verify(text);
      if (!b || low(b.from) !== parts[1]) return;
      // Retained (stored) status may be old: trust it only if recent; live updates always count.
      const fresh = !(packet && packet.retain) || Math.abs(Date.now() - (Number(b.ts) || 0)) < ONLINE_MS;
      if (!fresh) return;
      f.pres = { on: b.on !== false, mode: b.mode === 'lobby' ? 'lobby' : 'menu', lobby: /^[A-Z0-9]{5}$/.test(b.lobby || '') ? b.lobby : null, party: b.party || null };
      f.presAt = Date.now();
      this.changed();
      return;
    }

    if (kind === 'inbox' && parts[1] === me) {
      const b = await this.verify(text);
      if (!b || b.type !== 'invite' || !this.friends.has(low(b.from)) || !/^[0-9a-f]{12}$/.test(b.party || '')) return;
      if (this.party && this.party.id === b.party) return;
      this.invites.set(b.party, { from: b.from });
      this.notice(`${b.from} invited you to their party`);
      this.changed();
      return;
    }

    if (kind === 'party' && this.party && parts[1] === this.party.id) {
      const p = this.party, sub = parts[2];
      if (!text) return;
      const b = await this.verify(text);
      if (!b) return;
      const from = low(b.from);
      if (sub === 'state') {
        if (from !== low(p.leader)) return;
        if (b.disband) {
          if (!this.isLeader) { this.unsubscribeParty(p.id); this.party = null; this.notice('The party was disbanded'); this.changed(); }
          return;
        }
        const members = Array.isArray(b.members) ? b.members.filter(validTag).slice(0, 8) : [];
        if (!members.some((m) => low(m) === this.me)) {
          // The stored roster from before we joined doesn't list us yet: ignore it. Once we've
          // been listed, dropping off the roster means we were removed.
          if (p.confirmed && !this.isLeader) { this.unsubscribeParty(p.id); this.party = null; this.notice('You left the party'); this.changed(); }
          return;
        }
        p.confirmed = true;
        const lobby = /^[A-Z0-9]{5}$/.test(b.lobby || '') ? b.lobby : null;
        if (lobby && lobby !== p.lobby && !this.isLeader) this.notice(`${p.leader} is in a match — join from Friends`);
        p.members = members;
        p.lobby = lobby;
        this.changed();
      } else if (sub === 'join' && this.isLeader) {
        if (!p.invited.has(from) && !this.friends.has(from)) return;
        if (!p.members.some((m) => low(m) === from)) {
          if (p.members.length >= 8) return;
          p.members.push(b.from);
          this.logParty(null, `${b.from} joined the party`);
        }
        this.publishPartyState();
      } else if (sub === 'leave' && this.isLeader) {
        const before = p.members.length;
        p.members = p.members.filter((m) => low(m) !== from);
        if (p.members.length !== before) { this.logParty(null, `${b.from} left the party`); this.publishPartyState(); }
      } else if (sub === 'voice') {
        if (from === this.me || !p.members.some((m) => low(m) === from)) return;
        if (this.onVoice) this.onVoice(b.from, b.in !== false);
      } else if (sub === 'chat') {
        if (!p.members.some((m) => low(m) === from) || from === this.me) return;
        if (this.seenChat(String(b.id || ''))) return;
        this.logParty(b.from, clip(b.text, 160));
      }
    }
  }
}
