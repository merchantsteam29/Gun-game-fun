import { store, randCode } from './util.js';
import { addTokens, getStat } from './missions.js';
import { validTag } from './social.js';

// Invite rewards: your invite link carries your gamertag (?ref=Tag). A new player who opens it
// and finishes their first match gets INVITE_TOKENS, and so do you (up to MAX_INVITES friends).
// The new player's game posts a retained note at whffa/v1/ref/<your tag>/<their install id>;
// yours pays out once for each. (There's no server, so it can be gamed with fresh browsers;
// the cap keeps that small.)

const V = 'whffa/v1/ref/';
export const INVITE_TOKENS = 200;
export const MAX_INVITES = 10;
const low = (s) => String(s || '').toLowerCase();

class Invites {
  constructor() {
    this.onReward = null; // ({ kind: 'invited' | 'joined', name, tokens })
    this.installId = store.get('installId', null) || randCode(10);
    store.set('installId', this.installId);
    // Arrived through someone's invite? Only counts on a device that hasn't played yet.
    const ref = new URLSearchParams(location.search).get('ref');
    if (ref && validTag(ref) && !store.get('refBy', null) && getStat('matches') === 0) store.set('refBy', { tag: ref, done: false });
  }

  init(social) {
    this.social = social;
    social.relay.onMessage((t, payload) => {
      if (this.topic && t.startsWith(this.topic)) this.receive(t.slice(this.topic.length), payload.toString());
    });
    this.watch();
  }

  // Listen for friends who joined through your link (needs your gamertag).
  watch() {
    const s = this.social;
    if (!s) return;
    const want = s.tag ? V + low(s.tag) + '/' : null;
    if (want === this.topic) return;
    if (this.topic) s.relay.unsubscribe(this.topic + '+');
    this.topic = want;
    if (want) s.relay.subscribe(want + '+');
  }

  receive(id, text) {
    let b;
    try { b = JSON.parse(text); } catch { return; }
    if (!b || !/^[A-Z0-9]{10}$/.test(id) || id === this.installId) return;
    const paid = store.get('invitesPaid', []);
    if (paid.includes(id) || paid.length >= MAX_INVITES) return;
    store.set('invitesPaid', [...paid, id]);
    addTokens(INVITE_TOKENS);
    if (this.onReward) this.onReward({ kind: 'invited', name: String(b.name || 'A friend').slice(0, 16), tokens: INVITE_TOKENS });
  }

  // Called after every finished match: the first one completes a pending invite.
  matchDone(name) {
    const r = store.get('refBy', null);
    if (!r || r.done || !this.social) return;
    if (this.social.tag && low(this.social.tag) === low(r.tag)) return; // your own link
    r.done = true;
    store.set('refBy', r);
    addTokens(INVITE_TOKENS);
    this.social.relay.publish(V + low(r.tag) + '/' + this.installId, JSON.stringify({ name: String(name || 'Player').slice(0, 16), ts: Date.now() }), { retain: true });
    if (this.onReward) this.onReward({ kind: 'joined', name: r.tag, tokens: INVITE_TOKENS });
  }

  pending() { const r = store.get('refBy', null); return r && !r.done ? r.tag : null; }
  count() { return store.get('invitesPaid', []).length; }
  link(base, lobby = null) {
    const p = new URLSearchParams();
    if (lobby) p.set('lobby', lobby);
    if (this.social && this.social.tag) p.set('ref', this.social.tag);
    const q = p.toString();
    return base + (q ? '?' + q : '');
  }
}

export const invites = new Invites();
