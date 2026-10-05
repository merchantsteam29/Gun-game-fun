// Connection to the free public MQTT relays (no backend of our own). Used for the public server
// list and for gamertags / friends / party chat.
//
// It connects to EVERY relay at once and publishes to all of them: before, each player used
// whichever relay answered first, so a host on one relay and a player on another never saw
// each other's servers. Everything received is public data and is validated by the caller.
// Messages usually arrive once per relay, so callers must tolerate (or dedupe) duplicates.

const BROKERS = ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt'];
const LIB = 'https://unpkg.com/mqtt@5.10.1/dist/mqtt.min.js';

let libPromise = null;
export function loadMqtt() {
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

export class Relay {
  // opts: extra mqtt.connect options (e.g. a last-will message)
  constructor(opts = {}) {
    this.opts = opts;
    this.clients = [];
    this.subs = new Set();
    this.handlers = new Set();
    this.status = 'idle'; // idle | connecting | online | offline
    this.onStatus = null;
    this.onConnect = null; // (client) after every (re)connect: re-publish state
    this.starting = null;
  }

  start() {
    if (this.starting) return this.starting;
    this.setStatus('connecting');
    this.starting = (async () => {
      let mqtt;
      try { mqtt = await loadMqtt(); } catch { this.setStatus('offline'); this.starting = null; return false; }
      await Promise.all(BROKERS.map((url) => new Promise((resolve) => {
        const c = mqtt.connect(url, { clean: true, connectTimeout: 6000, reconnectPeriod: 5000, keepalive: 30, ...this.opts });
        this.clients.push(c);
        const t = setTimeout(resolve, 7000); // stop waiting; it keeps retrying in the background
        c.on('connect', () => {
          clearTimeout(t);
          for (const topic of this.subs) c.subscribe(topic);
          this.update();
          if (this.onConnect) this.onConnect(c);
          resolve();
        });
        c.on('message', (topic, payload, packet) => { for (const h of this.handlers) h(topic, payload, packet); });
        c.on('offline', () => this.update());
        c.on('close', () => this.update());
        c.on('error', () => { clearTimeout(t); this.update(); resolve(); });
      })));
      this.update();
      return this.online;
    })();
    return this.starting;
  }

  get online() { return this.clients.some((c) => c.connected); }

  update() { this.setStatus(this.online ? 'online' : this.clients.length ? 'offline' : 'connecting'); }

  setStatus(s) {
    if (s === this.status) return;
    this.status = s;
    if (this.onStatus) this.onStatus(s);
  }

  onMessage(fn) { this.handlers.add(fn); return () => this.handlers.delete(fn); }

  subscribe(topic) {
    this.subs.add(topic);
    for (const c of this.clients) if (c.connected) c.subscribe(topic);
  }

  unsubscribe(topic) {
    this.subs.delete(topic);
    for (const c of this.clients) if (c.connected) c.unsubscribe(topic);
  }

  publish(topic, payload, opts = {}) {
    for (const c of this.clients) if (c.connected) c.publish(topic, payload, { qos: 0, ...opts });
  }

  // Publish, then disconnect once it's sent (or after a moment).
  end(finalTopic = null, finalPayload = '', retain = true) {
    for (const c of this.clients) {
      if (finalTopic && c.connected) c.publish(finalTopic, finalPayload, { retain, qos: 0 }, () => c.end());
      else c.end();
      setTimeout(() => c.end(true), 1500);
    }
    this.clients = [];
    this.starting = null;
    this.status = 'idle';
  }
}
