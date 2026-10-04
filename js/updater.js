import { APP_VERSION } from './version.js';
import { store } from './util.js';

// Notices new releases: polls version.json (never cached) and compares it with the version
// baked into this build. Updating re-downloads every file listed in version.json into the
// browser cache ("hard refresh"), then reloads, so nobody needs Ctrl+Shift+R.
const CHECK_MS = 60 * 1000;
const MENU_COUNTDOWN = 5;
const $ = (id) => document.getElementById(id);

export class Updater {
  // inLobby(): true while playing in a server (we never auto-reload then).
  constructor({ inLobby }) {
    this.inLobby = inLobby;
    this.pending = null;
    this.deferred = false;
    this.showUpdatedNote();
  }

  start() {
    this.check();
    setInterval(() => this.check(), CHECK_MS);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.check(); });
  }

  async check() {
    if (this.busy) return;
    let data;
    try {
      const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' });
      if (!r.ok) return;
      data = await r.json();
    } catch { return; }
    if (!data || typeof data.version !== 'string' || data.version === APP_VERSION) return;
    if (this.pending && this.pending.version === data.version) return;
    this.pending = data;
    this.deferred = false;
    this.show();
  }

  show() {
    const d = this.pending;
    const notes = Array.isArray(d.notes) ? d.notes.slice(0, 6) : [];
    const ul = $('upd-notes');
    ul.replaceChildren(...notes.map((n) => { const li = document.createElement('li'); li.textContent = String(n).slice(0, 140); return li; }));
    $('upd-later').classList.toggle('hidden', !this.inLobby());
    $('update-pop').classList.remove('hidden');
    $('upd-now').onclick = () => this.apply();
    $('upd-later').onclick = () => { this.deferred = true; $('update-pop').classList.add('hidden'); clearInterval(this.countT); };
    clearInterval(this.countT);
    if (this.inLobby()) { $('upd-count').textContent = 'Update now, or after you leave this server.'; return; }
    let n = MENU_COUNTDOWN;
    const tick = () => {
      $('upd-count').textContent = `Refreshing in ${n}…`;
      if (n-- <= 0) { clearInterval(this.countT); this.apply(); }
    };
    tick();
    this.countT = setInterval(tick, 1000);
  }

  // Called when the player leaves a server: run a postponed update.
  leftLobby() {
    if (this.pending && this.deferred) { this.deferred = false; this.show(); }
  }

  async apply() {
    if (this.busy || !this.pending) return;
    this.busy = true;
    clearInterval(this.countT);
    const d = this.pending;
    $('upd-count').textContent = 'Downloading the update…';
    $('upd-now').disabled = true;
    // Avoid a reload loop if the browser refuses to refresh its cache: the second time round,
    // ask for a manual hard refresh instead.
    const tries = store.get('updTries', {});
    tries[d.version] = (tries[d.version] || 0) + 1;
    store.set('updTries', tries);
    if (tries[d.version] > 2) {
      $('upd-count').textContent = 'Your browser kept the old files. Please press Ctrl+Shift+R (or clear this site\'s data on mobile).';
      $('upd-now').disabled = false;
      this.busy = false;
      return;
    }
    const files = Array.isArray(d.files) ? d.files.filter((f) => typeof f === 'string' && !/^[a-z]+:/i.test(f)) : [];
    await Promise.all(files.map((f) => fetch(f, { cache: 'reload' }).catch(() => null)));
    store.set('updatedTo', { version: d.version, notes: Array.isArray(d.notes) ? d.notes.slice(0, 6) : [] });
    location.reload();
  }

  // After a successful update, say so once.
  showUpdatedNote() {
    const u = store.get('updatedTo', null);
    if (!u) return;
    store.set('updatedTo', null);
    if (u.version !== APP_VERSION) return; // still the old build: the check will offer it again
    store.set('updTries', {});
    const el = $('updated-toast');
    el.querySelector('b').textContent = 'Updated!';
    el.querySelector('span').textContent = (u.notes || []).join(' · ');
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 7000);
    el.onclick = () => el.classList.add('hidden');
  }
}
