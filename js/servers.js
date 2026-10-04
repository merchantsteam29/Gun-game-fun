// Public server list over a free public MQTT relay (no backend of our own).
// Hosts of public servers publish a small retained "listing" message; everyone browsing
// subscribes to all listings. A last-will message clears the listing if the host's tab dies.
// Listings are public data: everything read back is validated and only ever shown as text.

const BROKERS = ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt'];
const PREFIX = 'whffa/v1/servers/';
const LIB = 'https://unpkg.com/mqtt@5.10.1/dist/mqtt.min.js';
const REFRESH_MS = 15000;
const STALE_MS = 2 * 60 * 1000;
const CODE_RE = /^[A-Z0-9]{5}$/;
export const REGIONS = ['NA', 'SA', 'EU', 'Asia', 'OCE', 'AF'];

let libPromise = null;
function loadLib() {
  if (window.mqtt) return Promise.resolve(window.mqtt);
  if (!libPromise) {
    libPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = LIB;
      s.onload = () => (window.mqtt ? resolve(window.mqtt) : reject(new Error('relay library missing')));
      s.onerror = () => { libPromise = null; reject(new Error('could not load relay library')); };
      document.head.appendChild(s);
    });
  }
  return libPromise;
}

// Rough region from the browser's time zone (P2P has no real regions; it's a hint for players).
export function guessRegion() {
  const tz = (Intl.DateTimeFormat().resolvedOptions().timeZone || '');
  if (/^America\/(Sao_Paulo|Argentina|Santiago|Bogota|Lima|Caracas|Montevideo|La_Paz|Asuncion|Guayaquil)/.test(tz)) return 'SA';
  if (tz.startsWith('America/') || tz.startsWith('US/') || tz.startsWith('Canada/')) return 'NA';
  if (tz.startsWith('Europe/')) return 'EU';
  if (tz.startsWith('Asia/')) return 'Asia';
  if (tz.startsWith('Australia/') || tz.startsWith('Pacific/')) return 'OCE';
  if (tz.startsWith('Africa/')) return 'AF';
  return 'NA';
}

const str = (v, n) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, n);
const int = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(v) || 0)));

// Validates one listing; returns a clean object or null.
function clean(code, raw) {
  if (!CODE_RE.test(code) || !raw || typeof raw !== 'object' || raw.v !== 1) return null;
  const max = int(raw.max, 2, 12);
  return {
    code,
    name: str(raw.name, 32) || 'Unnamed server',
    mode: str(raw.mode, 20),
    map: str(raw.map, 20),
    players: int(raw.players, 0, 12),
    bots: int(raw.bots, 0, 12),
    max,
    region: REGIONS.includes(raw.region) ? raw.region : '',
    ts: Number(raw.ts) || 0,
  };
}

async function connect(opts, onFail) {
  const mqtt = await loadLib();
  for (const url of BROKERS) {
    try {
      const client = await new Promise((resolve, reject) => {
        const c = mqtt.connect(url, { clean: true, connectTimeout: 6000, reconnectPeriod: 4000, keepalive: 30, ...opts });
        const fail = () => { c.end(true); reject(new Error('relay unreachable')); };
        const t = setTimeout(fail, 7000);
        c.once('connect', () => { clearTimeout(t); resolve(c); });
        c.once('error', () => { clearTimeout(t); fail(); });
      });
      return client;
    } catch { /* try the next relay */ }
  }
  if (onFail) onFail();
  throw new Error('server list unavailable');
}

// Browsing: keeps a live map of public servers.
export class ServerBrowser {
  constructor() {
    this.servers = new Map();
    this.status = 'idle'; // idle | connecting | online | offline
    this.onChange = () => {};
    this.client = null;
  }

  async start() {
    if (this.client || this.status === 'connecting') return;
    this.status = 'connecting';
    this.onChange();
    try {
      this.client = await connect({});
      this.client.on('message', (topic, payload, packet) => this.receive(topic, payload, packet));
      this.client.on('offline', () => { this.status = 'offline'; this.onChange(); });
      this.client.on('connect', () => { this.status = 'online'; this.client.subscribe(PREFIX + '+'); this.onChange(); });
      this.client.subscribe(PREFIX + '+');
      this.status = 'online';
    } catch {
      this.status = 'offline';
    }
    this.onChange();
    clearInterval(this.pruneT);
    this.pruneT = setInterval(() => this.onChange(), 10000); // re-render so stale entries drop off
  }

  receive(topic, payload, packet) {
    const code = topic.slice(PREFIX.length);
    const text = payload ? payload.toString() : '';
    if (!text) { this.servers.delete(code); this.onChange(); return; }
    let raw;
    try { raw = JSON.parse(text); } catch { return; }
    const s = clean(code, raw);
    if (!s) return;
    s.seen = Date.now();
    s.retained = !!(packet && packet.retain);
    this.servers.set(code, s);
    this.onChange();
  }

  // Fresh, joinable-looking servers, busiest first.
  list() {
    const now = Date.now();
    return [...this.servers.values()]
      .filter((s) => (s.retained ? now - s.ts < STALE_MS : now - s.seen < STALE_MS))
      .sort((a, b) => b.players - a.players || a.name.localeCompare(b.name));
  }
}

// Hosting a public server: publish its listing until stopped (or the tab goes away).
export class ServerAnnouncer {
  constructor() { this.client = null; this.code = null; }

  async start(code, getInfo) {
    this.stop();
    this.code = code;
    this.getInfo = getInfo;
    const topic = PREFIX + code;
    try {
      this.client = await connect({ will: { topic, payload: '', retain: true, qos: 0 } });
    } catch {
      return false;
    }
    if (this.code !== code) { this.client.end(true); return false; } // stopped while connecting
    this.client.on('connect', () => this.publish()); // re-announce after reconnects
    this.publish();
    this.timer = setInterval(() => this.publish(), REFRESH_MS);
    return true;
  }

  publish() {
    if (!this.client || !this.code) return;
    const info = { v: 1, ...this.getInfo(), ts: Date.now() };
    this.client.publish(PREFIX + this.code, JSON.stringify(info), { retain: true, qos: 0 });
  }

  stop() {
    clearInterval(this.timer);
    if (this.client) {
      const c = this.client;
      if (this.code) c.publish(PREFIX + this.code, '', { retain: true, qos: 0 }, () => c.end());
      else c.end();
      setTimeout(() => c.end(true), 1500);
    }
    this.client = null;
    this.code = null;
  }
}
