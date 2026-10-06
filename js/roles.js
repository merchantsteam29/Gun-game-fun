// Staff roles: the owner and moderators, shown with badges everywhere names appear.
//
// The owner is fixed to one gamertag AND the public key of its claim, so nobody can become
// owner by naming themselves the same. Moderators are appointed by the owner: each appointment
// is a retained message on the relay (whffa/v1/role/<tag>) signed with the owner's key and
// naming the moderator's own key; everyone checks that signature before showing a badge.
//
// In a match, staff prove who they are to the host by signing the lobby code and their player
// id (see main.js / host.js `staff`), so the badge can't be copied by someone using the name.

const P = 'whffa/v1/role/';
const ALG = { name: 'ECDSA', namedCurve: 'P-256' }, SIG = { name: 'ECDSA', hash: 'SHA-256' };
const PROOF_MAX_AGE = 10 * 60 * 1000;

export const OWNER = {
  tag: 'GIGACHAD',
  pub: { x: 'IWWl4ck5Iz33UVZCRJio-_vHHEf24hURjfik4-HpxSU', y: '6IboQ0SuyXXUDK6rIcgdDtq4JyngvnJWhL8PV3AEij0' },
};

export const ROLE_INFO = {
  owner: { label: 'OWNER', icon: '♛', color: '#ffd23f' },
  mod: { label: 'MOD', icon: '🛡', color: '#4fc3ff' },
};

const low = (t) => String(t || '').toLowerCase();
const unb64 = (s) => Uint8Array.from(atob(String(s).replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const sameKey = (a, b) => !!a && !!b && a.x === b.x && a.y === b.y;

export async function verifyWith(pub, env) {
  try {
    const key = await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: pub.x, y: pub.y }, ALG, false, ['verify']);
    return await crypto.subtle.verify(SIG, key, unb64(env.s), new TextEncoder().encode(env.b));
  } catch { return false; }
}

// owner > mod > everyone else. Staff can only act on players ranked below them.
export const rank = (role) => (role === 'owner' ? 2 : role === 'mod' ? 1 : 0);

// Small HTML badge for a role ('' for none).
export function badge(role, small = false) {
  const r = ROLE_INFO[role];
  return r ? `<span class="role-badge ${role} ${small ? 'sm' : ''}" title="${r.label === 'OWNER' ? 'Game owner' : 'Moderator'}">${r.icon} ${r.label}</span>` : '';
}

class Roles {
  constructor() {
    this.mods = new Map(); // lower tag -> { tag, pub, ts }
    this.social = null;
    this.onChange = null;
  }

  // Starts listening for moderator appointments (call once the relay is up).
  init(social) {
    if (this.social) return;
    this.social = social;
    social.relay.onMessage((t, payload) => { if (t.startsWith(P)) this.receive(t.slice(P.length), payload.toString()); });
    social.relay.subscribe(P + '+');
    const resub = social.relay.onConnect;
    social.relay.onConnect = () => { if (resub) resub(); social.relay.subscribe(P + '+'); };
  }

  async receive(k, text) {
    let env, body;
    if (!text) { if (this.mods.delete(k)) this.changed(); return; } // cleared
    try { env = JSON.parse(text); body = JSON.parse(env.b); } catch { return; }
    if (!body || low(body.from) !== low(OWNER.tag) || low(body.tag) !== k) return;
    if (!(await verifyWith(OWNER.pub, env))) return; // only the owner can appoint
    const prev = this.mods.get(k);
    if (prev && prev.ts > body.ts) return; // the relays may deliver an older copy late
    if (body.role === 'mod' && body.pub && body.pub.x && body.pub.y) this.mods.set(k, { tag: body.tag, pub: body.pub, ts: body.ts });
    else this.mods.delete(k);
    this.changed();
  }

  changed() { if (this.onChange) this.onChange(); }

  // Role of a gamertag (by name only — fine for gamertags already verified by social.js, like
  // friends lists). For players in a match, use the role the host verified instead.
  roleOfTag(tag) {
    if (low(tag) === low(OWNER.tag)) return 'owner';
    return this.mods.has(low(tag)) ? 'mod' : null;
  }

  pubOf(tag) {
    if (low(tag) === low(OWNER.tag)) return OWNER.pub;
    const m = this.mods.get(low(tag));
    return m ? m.pub : null;
  }

  // Your own role on this device (your gamertag and this device's key must match).
  myRole() {
    const s = this.social;
    if (!s || !s.tag) return null;
    const pub = this.pubOf(s.tag);
    return pub && sameKey(pub, s.pub) ? this.roleOfTag(s.tag) : null;
  }

  isOwner() { return this.myRole() === 'owner'; }

  // Is this name one only staff may use?
  reserved(name) { return !!this.roleOfTag(String(name || '').trim()); }

  // ---------- Match proofs ----------

  // Signed "I am <tag>, player <id> in lobby <code>" for the host.
  async proof(code, id) {
    return this.myRole() ? this.social.sign({ staff: 1, lobby: code, id }) : null;
  }

  // Host side: checks a proof. Returns { tag, role } or null.
  async check(text, code, id) {
    let env, body;
    try { env = JSON.parse(text); body = JSON.parse(env.b); } catch { return null; }
    if (!body || !body.staff || body.lobby !== code || body.id !== id) return null;
    if (Math.abs(Date.now() - Number(body.ts)) > PROOF_MAX_AGE) return null;
    const role = this.roleOfTag(body.from), pub = this.pubOf(body.from);
    if (!role || !pub || !(await verifyWith(pub, env))) return null;
    return { tag: role === 'owner' ? OWNER.tag : this.mods.get(low(body.from)).tag, role };
  }

  // ---------- Owner tools ----------

  async appoint(tag) {
    if (!this.isOwner()) throw new Error('Only the owner can appoint moderators.');
    const s = this.social;
    if (low(tag) === low(OWNER.tag)) throw new Error('You are already the owner.');
    const claim = await s.lookup(tag, true);
    if (!claim) throw new Error(`Nobody has the gamertag "${tag}".`);
    const body = { role: 'mod', tag: claim.tag, pub: { x: claim.pub.x, y: claim.pub.y } };
    s.relay.publish(P + low(claim.tag), await s.sign(body), { retain: true });
    this.mods.set(low(claim.tag), { tag: claim.tag, pub: body.pub, ts: Date.now() });
    this.changed();
    return claim.tag;
  }

  async remove(tag) {
    if (!this.isOwner()) throw new Error('Only the owner can remove moderators.');
    const s = this.social;
    // A signed "no role" replaces the appointment (an empty message could be faked by anyone,
    // but it's harmless: the owner can just appoint again).
    s.relay.publish(P + low(tag), await s.sign({ role: 'none', tag }), { retain: true });
    this.mods.delete(low(tag));
    this.changed();
  }
}

export const roles = new Roles();
