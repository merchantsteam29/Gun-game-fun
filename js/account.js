import { FIREBASE_CONFIG } from './firebase-config.js';
import { store } from './util.js';

// Gamertag + password accounts on Firebase. The gamertag doubles as the login (Firebase Auth
// needs an email, so "Tag" becomes tag@players.whffa.game behind the scenes) and as your
// in-game name. Your progress (tokens, cosmetics, missions, loadout, settings) is stored in
// Firestore at players/{uid} and synced to every device you sign in on.
//
// Sync model: localStorage stays the working copy. Saves are pushed a couple of seconds after
// a change; on sign-in (or when another device saved more recently) the cloud copy is written
// into localStorage and the page reloads so every module picks it up.

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
export const SYNC_KEYS = ['color', 'loadout', 'opts', 'cos', 'stats', 'modesPlayed', 'mapsPlayed', 'owned', 'claimed', 'tokens', 'econ'];
// Cleared when you sign out, so the next person on this device starts fresh.
const PROGRESS_KEYS = ['cos', 'stats', 'modesPlayed', 'mapsPlayed', 'owned', 'claimed', 'tokens', 'econ'];
export const TAG_RULES = '3–16 letters, numbers or _';
const TAG_RE = /^[A-Za-z0-9_]{3,16}$/;
const emailFor = (tag) => `${tag.toLowerCase()}@players.whffa.game`;

const ERRORS = {
  'auth/email-already-in-use': 'That gamertag is already taken.',
  'auth/invalid-credential': 'Wrong gamertag or password.',
  'auth/invalid-login-credentials': 'Wrong gamertag or password.',
  'auth/wrong-password': 'Wrong gamertag or password.',
  'auth/user-not-found': 'No account with that gamertag.',
  'auth/weak-password': 'Password must be at least 6 characters.',
  'auth/too-many-requests': 'Too many tries. Wait a minute and try again.',
  'auth/network-request-failed': 'Could not connect. Check your internet.',
  'auth/operation-not-allowed': 'Accounts are switched off on this server (enable Email/Password sign-in in Firebase).',
};

export class Account {
  constructor() {
    this.enabled = !!FIREBASE_CONFIG;
    this.user = null;
    this.tag = null;
    this.onChange = null;
    this.status = this.enabled ? 'loading' : 'off';
    this.ready = this.enabled ? this.init() : Promise.resolve();
  }

  get signedIn() { return !!this.user; }

  async init() {
    try {
      const [app, auth, fs] = await Promise.all([
        import(SDK + 'firebase-app.js'), import(SDK + 'firebase-auth.js'), import(SDK + 'firebase-firestore.js'),
      ]);
      this.fb = { ...auth, ...fs };
      const a = app.initializeApp(FIREBASE_CONFIG);
      this.auth = auth.getAuth(a);
      this.db = fs.getFirestore(a);
      await new Promise((resolve) => {
        auth.onAuthStateChanged(this.auth, async (u) => {
          await this.setUser(u);
          resolve();
        });
      });
      document.addEventListener('visibilitychange', () => { if (document.hidden) this.flush(); });
      window.addEventListener('pagehide', () => this.flush());
    } catch (e) {
      console.warn('Accounts unavailable:', e);
      this.status = 'error';
      this.changed();
    }
  }

  changed() { if (this.onChange) this.onChange(this); }

  async setUser(u) {
    this.user = u;
    this.status = 'ready';
    if (!u) {
      this.tag = null;
      store.onSet = null;
      this.changed();
      return;
    }
    this.tag = u.displayName || store.get('acctTag', null);
    store.set('acctTag', this.tag);
    store.onSet = (k) => { if (SYNC_KEYS.includes(k)) { store.set('acctDirty', true); this.scheduleSave(); } };
    // Another device may have saved since we last synced: take its copy.
    try {
      const snap = await this.fb.getDoc(this.ref());
      const data = snap.exists() ? snap.data() : null;
      if (data && data.tag) { this.tag = data.tag; store.set('acctTag', data.tag); }
      const synced = store.get('acctSyncedAt', 0), sameUser = store.get('acctUid', null) === u.uid;
      if (data && data.profile && (!sameUser || (data.updated || 0) > synced)) { this.pull(data); return; }
      if (!data || store.get('acctDirty', false)) await this.push();
    } catch (e) {
      console.warn('Account sync failed:', e);
    }
    this.changed();
  }

  ref() { return this.fb.doc(this.db, 'players', this.user.uid); }

  validate(tag, pw) {
    if (!this.enabled) return 'Accounts are not set up yet.';
    if (!TAG_RE.test(tag || '')) return `Gamertag must be ${TAG_RULES}.`;
    if (!pw || pw.length < 6) return 'Password must be at least 6 characters.';
    return null;
  }

  async signUp(tag, pw) {
    const bad = this.validate(tag, pw);
    if (bad) throw new Error(bad);
    await this.ready;
    store.set('acctTag', tag); // the auth listener fires before displayName is set
    try {
      const cred = await this.fb.createUserWithEmailAndPassword(this.auth, emailFor(tag), pw);
      await this.fb.updateProfile(cred.user, { displayName: tag });
      this.user = cred.user;
      this.tag = tag;
      store.set('acctTag', tag);
      store.set('name', tag);
      await this.push(); // whatever you've earned as a guest becomes the account's progress
      this.changed();
    } catch (e) { throw this.friendly(e); }
  }

  async signIn(tag, pw) {
    const bad = this.validate(tag, pw);
    if (bad) throw new Error(bad);
    await this.ready;
    try {
      // The auth listener (setUser) loads the account's progress and reloads if needed.
      store.set('acctSyncedAt', 0);
      await this.fb.signInWithEmailAndPassword(this.auth, emailFor(tag), pw);
    } catch (e) { throw this.friendly(e); }
  }

  async signOut() {
    await this.flush();
    await this.fb.signOut(this.auth);
    for (const k of PROGRESS_KEYS) store.del(k);
    for (const k of ['acctUid', 'acctTag', 'acctSyncedAt', 'acctDirty']) store.del(k);
    location.reload();
  }

  friendly(e) {
    return new Error(ERRORS[e && e.code] || (e && e.message) || 'Something went wrong.');
  }

  // Cloud → this device, then reload so every module starts from the account's data.
  pull(data) {
    let profile = {};
    try { profile = JSON.parse(data.profile) || {}; } catch { /* corrupt: keep local */ return; }
    store.onSet = null;
    for (const k of SYNC_KEYS) {
      if (k in profile) store.set(k, profile[k]);
      else store.del(k);
    }
    store.set('name', data.tag || this.tag);
    store.set('acctUid', this.user.uid);
    store.set('acctSyncedAt', data.updated || Date.now());
    store.set('acctDirty', false);
    location.reload();
  }

  // This device → cloud.
  async push() {
    if (!this.user) return;
    const profile = {};
    for (const k of SYNC_KEYS) { const v = store.get(k, undefined); if (v !== undefined) profile[k] = v; }
    const updated = Date.now();
    await this.fb.setDoc(this.ref(), {
      tag: this.tag, tagLower: (this.tag || '').toLowerCase(), profile: JSON.stringify(profile), updated,
    }, { merge: true });
    store.set('acctUid', this.user.uid);
    store.set('acctSyncedAt', updated);
    store.set('acctDirty', false);
  }

  scheduleSave() {
    clearTimeout(this.saveT);
    this.saveT = setTimeout(() => this.push().catch((e) => console.warn('Account save failed:', e)), 2500);
  }

  async flush() {
    if (!this.user || !store.get('acctDirty', false)) return;
    clearTimeout(this.saveT);
    try { await this.push(); } catch { /* next time */ }
  }
}
