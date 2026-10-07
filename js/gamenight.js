import { store } from './util.js';
import { OWNER, verifyWith } from './roles.js';

// Game Night: a set time when everyone plays together in one server, with double XP there.
// The schedule is set by the owner (signed, retained on the relay at whffa/v1/gamenight) and
// defaults to every day at 7 PM New York time for 2 hours. Times are kept in the schedule's own
// time zone so daylight saving doesn't move it; everyone sees it in their local time.

const TOPIC = 'whffa/v1/gamenight';
export const DEFAULT_SCHEDULE = { tz: 'America/New_York', h: 19, m: 0, days: [0, 1, 2, 3, 4, 5, 6], dur: 120, on: true };
export const GN_NAME = '🌙 Game Night';
export const GN_XP = 2; // XP multiplier in Game Night servers while it's live
export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const validTz = (tz) => { try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; } };

// Cleans a schedule from the relay (or the owner's form).
export function cleanSchedule(s) {
  if (!s || typeof s !== 'object') return null;
  const int = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(v) || 0)));
  const days = Array.isArray(s.days) ? [...new Set(s.days.map((d) => int(d, 0, 6)))].sort() : [];
  return {
    tz: typeof s.tz === 'string' && validTz(s.tz) ? s.tz : DEFAULT_SCHEDULE.tz,
    h: int(s.h, 0, 23), m: int(s.m, 0, 59), days, dur: int(s.dur, 30, 360), on: s.on !== false && days.length > 0,
  };
}

// Wall-clock parts of `t` (ms) in time zone `tz`.
function partsIn(tz, t) {
  const p = {};
  for (const x of new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }).formatToParts(new Date(t))) p[x.type] = Number(x.value);
  return p;
}
const offsetMin = (tz, t) => { const p = partsIn(tz, t); return Math.round((Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second) - t) / 60000); };
// ms timestamp of wall-clock y-mo-d h:m in `tz` (mo is 0-based; day overflow is fine).
function zoned(tz, y, mo, d, h, m) {
  const guess = Date.UTC(y, mo, d, h, m);
  let t = guess - offsetMin(tz, guess) * 60000;
  const off2 = offsetMin(tz, t);
  if (guess - off2 * 60000 !== t) t = guess - off2 * 60000;
  return t;
}

// The current or next Game Night: { start, end, live } (null when it's switched off).
export function nextWindow(s, now = Date.now()) {
  if (!s || !s.on) return null;
  const p = partsIn(s.tz, now);
  for (let k = -1; k <= 8; k++) {
    const dow = new Date(Date.UTC(p.year, p.month - 1, p.day + k)).getUTCDay();
    if (!s.days.includes(dow)) continue;
    const start = zoned(s.tz, p.year, p.month - 1, p.day + k, s.h, s.m), end = start + s.dur * 60000;
    if (end > now) return { start, end, live: now >= start };
  }
  return null;
}

// "7:00 PM" in your local time, and which days.
export function describe(s) {
  if (!s || !s.on) return 'Off for now';
  const w = nextWindow(s);
  const time = w ? new Date(w.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
  const days = s.days.length === 7 ? 'Every day' : s.days.join() === '1,2,3,4,5' ? 'Weekdays' : s.days.join() === '0,6' ? 'Weekends' : s.days.map((d) => DAY_NAMES[d]).join(', ');
  return `${days} · ${time} your time · ${s.dur >= 60 ? `${+(s.dur / 60).toFixed(1)} h` : `${s.dur} min`}`;
}

class GameNight {
  constructor() {
    this.schedule = cleanSchedule(store.get('gnSchedule', null)) || { ...DEFAULT_SCHEDULE };
    this.listeners = [];
    this.wasLive = null;
    this.remind = store.get('gnRemind', false);
    this.reminded = 0;
  }

  init(social) {
    this.social = social;
    social.relay.onMessage((t, payload) => { if (t === TOPIC) this.receive(payload.toString()); });
    social.relay.subscribe(TOPIC);
    setInterval(() => this.tick(), 15000);
    this.tick();
  }

  window() { return nextWindow(this.schedule); }
  isLive() { const w = this.window(); return !!(w && w.live); }
  on(fn) { this.listeners.push(fn); }
  emit(e) { for (const fn of this.listeners) fn(e); }

  // Only the owner's signature counts.
  async receive(text) {
    if (!text) return;
    let env, body;
    try { env = JSON.parse(text); body = JSON.parse(env.b); } catch { return; }
    if (!body || String(body.from).toLowerCase() !== OWNER.tag.toLowerCase() || !(await verifyWith(OWNER.pub, env))) return;
    const s = cleanSchedule(body.schedule);
    if (!s) return;
    this.schedule = s;
    store.set('gnSchedule', s);
    this.wasLive = null;
    this.tick();
    this.emit({ type: 'schedule' });
  }

  // Owner: set the schedule for everyone.
  async publish(schedule) {
    const s = cleanSchedule(schedule);
    if (!s) throw new Error('Bad schedule.');
    const signed = await this.social.sign({ schedule: s });
    this.social.relay.publish(TOPIC, signed, { retain: true });
    await this.receive(signed);
  }

  // Start / soon / end events (for the announcement and the reminder).
  tick() {
    const w = this.window(), live = !!(w && w.live), now = Date.now();
    if (this.wasLive !== null && live !== this.wasLive) this.emit({ type: live ? 'start' : 'end', w });
    this.wasLive = live;
    if (w && !live && w.start - now <= 10 * 60000 && this.reminded !== w.start) {
      this.reminded = w.start;
      this.emit({ type: 'soon', w });
    }
    this.emit({ type: 'tick', w });
  }

  // Browser notification when Game Night starts (only while the game is open in a tab).
  async setRemind(on) {
    if (on && 'Notification' in window && Notification.permission !== 'granted') {
      try { if ((await Notification.requestPermission()) !== 'granted') on = false; } catch { on = false; }
    }
    this.remind = on;
    store.set('gnRemind', on);
    return on;
  }
  notify(text) {
    if (!this.remind || !('Notification' in window) || Notification.permission !== 'granted' || document.hasFocus()) return;
    try { new Notification('Gun Game 3D', { body: text, tag: 'gamenight', icon: 'icons/icon-192.png' }); } catch { /* ignore */ }
  }
}

export const gameNight = new GameNight();
