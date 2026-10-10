import { store } from './util.js';
import { getTokens, spendTokens, addTokens, grantItem, grantWrap, COSMETICS, isOwned, ownsWrap } from './missions.js';
import { camoOf } from './camos.js';

// Gifts: send tokens, or buy a shop item for a friend. The sender's game takes the tokens and
// posts a signed gift as a retained message at whffa/v1/gift/<friend>/<id>; the friend's game
// picks it up (now or the next time they play), checks the signature, adds it and clears it.
// Friends only, up to 5 gifts a day, 10 to 1,000 tokens each.

const V = 'whffa/v1/gift/';
const low = (s) => String(s || '').toLowerCase();
export const GIFT_MIN = 10, GIFT_MAX = 1000, GIFTS_PER_DAY = 5;
const today = () => new Date().toISOString().slice(0, 10);
const randId = () => Math.random().toString(36).slice(2, 10);

// A shop item that can be bought (and so gifted): { slot, id } with slot 'wrap' for weapon wraps.
export function giftable(slot, id) {
  if (slot === 'wrap') { const c = camoOf(id); return c.id === id && c.price > 0 && !c.reward ? c : null; }
  const c = (COSMETICS[slot] || []).find((x) => x.id === id);
  return c && c.price > 0 && !c.reward ? c : null;
}
export const ownsItem = (slot, id) => (slot === 'wrap' ? ownsWrap(id) : isOwned(slot, id));

class Gifts {
  constructor() {
    this.claimed = new Set(store.get('giftsClaimed', []));
    this.received = store.get('giftsReceived', []); // newest first: { from, tokens, item, note, ts }
    this.onGift = null;
    this.sub = null;
  }

  init(social) {
    this.social = social;
    social.relay.onMessage((t, payload) => { if (this.sub && t.startsWith(this.sub.slice(0, -1))) this.receive(t, payload.toString()); });
    const watch = () => {
      const want = social.tag ? V + low(social.tag) + '/+' : null;
      if (want === this.sub) return;
      if (this.sub) social.relay.unsubscribe(this.sub);
      this.sub = want;
      if (want) social.relay.subscribe(want);
    };
    social.ready.then(watch);
    setInterval(watch, 5000); // a gamertag picked later
  }

  sentToday() { const l = store.get('giftLog', { day: '', n: 0 }); return l.day === today() ? l.n : 0; }

  // gift: { tokens } or { item: { slot, id } }, plus an optional short note.
  async send(toTag, gift, note = '') {
    const s = this.social;
    if (!s || !s.tag) throw new Error('Pick a gamertag (Friends tab) to send gifts.');
    if (!s.friends.has(low(toTag))) throw new Error('You can only send gifts to friends.');
    if (low(toTag) === low(s.tag)) throw new Error("You can't send a gift to yourself.");
    if (this.sentToday() >= GIFTS_PER_DAY) throw new Error(`That's ${GIFTS_PER_DAY} gifts today. Try again tomorrow.`);
    let cost, body;
    if (gift.item) {
      const c = giftable(gift.item.slot, gift.item.id);
      if (!c) throw new Error("That item can't be gifted.");
      cost = c.price;
      body = { item: { slot: gift.item.slot, id: gift.item.id } };
    } else {
      cost = Math.round(Number(gift.tokens) || 0);
      if (cost < GIFT_MIN || cost > GIFT_MAX) throw new Error(`Send between ${GIFT_MIN} and ${GIFT_MAX} tokens.`);
      body = { tokens: cost };
    }
    if (getTokens() < cost) throw new Error(`You need ${cost - getTokens()} more tokens.`);
    const id = randId();
    const signed = await s.sign({ ...body, id, to: low(toTag), note: String(note || '').replace(/[\u0000-\u001f]/g, '').slice(0, 60) });
    if (!spendTokens(cost)) throw new Error('Not enough tokens.');
    s.relay.publish(V + low(toTag) + '/' + id, signed, { retain: true });
    store.set('giftLog', { day: today(), n: this.sentToday() + 1 });
    return cost;
  }

  async receive(topic, text) {
    if (!text) return;
    const id = topic.split('/').pop();
    const s = this.social;
    if (this.claimed.has(id)) { s.relay.publish(topic, '', { retain: true }); return; }
    const b = await s.verify(text);
    if (!b || b.id !== id || low(b.to) !== low(s.tag) || low(b.from) === low(s.tag)) return;
    this.claimed.add(id);
    store.set('giftsClaimed', [...this.claimed].slice(-300));
    let got = null;
    if (b.item && giftable(b.item.slot, b.item.id)) {
      const owned = ownsItem(b.item.slot, b.item.id);
      if (owned) addTokens(giftable(b.item.slot, b.item.id).price); // already had it: its price in tokens instead
      else if (b.item.slot === 'wrap') grantWrap(b.item.id); else grantItem(b.item.slot, b.item.id);
      got = { from: b.from, item: b.item, refunded: owned, note: b.note || '', ts: Date.now() };
    } else {
      const n = Math.max(0, Math.min(GIFT_MAX, Math.round(Number(b.tokens) || 0)));
      if (n) { addTokens(n); got = { from: b.from, tokens: n, note: b.note || '', ts: Date.now() }; }
    }
    s.relay.publish(topic, '', { retain: true }); // claimed: take it off the relay
    if (!got) return;
    this.received = [got, ...this.received].slice(0, 30);
    store.set('giftsReceived', this.received);
    if (this.onGift) this.onGift(got);
  }
}

export const gifts = new Gifts();
