import { spawns } from './map.js';

export const KILL_LIMIT = 25;
export const MATCH_SECONDS = 600;
const RESPAWN_MS = 3000;
const PROTECT_MS = 1500;
const END_SCREEN_MS = 10000;
const TICK_MS = 50;

// Authoritative game state that runs inside the lobby creator's browser.
// Movement and aiming are client-side; health, kills, spawns and the match clock live here.
export class HostLogic {
  constructor(sendTo, broadcast) {
    this.sendTo = sendTo;
    this.broadcast = broadcast;
    this.players = new Map();
    this.phase = 'playing';
    this.endsAt = Date.now() + MATCH_SECONDS * 1000;
    this.restartAt = 0;
    this.last = Date.now();
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  destroy() { clearInterval(this.timer); }

  addPlayer(id, name, color) {
    name = String(name || 'Player').slice(0, 16);
    const p = {
      id, name, color, kills: 0, deaths: 0, hp: 100, alive: false,
      st: [0, -50, 0, 0, 0, 'ar', 0], lastDmg: 0, respawnAt: 0, protectUntil: 0,
    };
    this.players.set(id, p);
    this.sendTo(id, {
      t: 'welcome', id,
      players: [...this.players.values()].map((q) => ({ id: q.id, name: q.name, color: q.color, k: q.kills, d: q.deaths })),
      killLimit: KILL_LIMIT,
    });
    this.broadcast({ t: 'pjoin', id, name, color }, id);
    if (this.phase === 'playing') this.spawn(p);
    else this.sendTo(id, this.endMsg());
  }

  removePlayer(id) {
    const p = this.players.get(id);
    if (!p) return;
    this.players.delete(id);
    this.broadcast({ t: 'pleave', id, name: p.name });
  }

  pickSpawn() {
    const others = [...this.players.values()].filter((p) => p.alive);
    const scored = spawns.map((s) => {
      let min = 1e9;
      for (const o of others) min = Math.min(min, Math.hypot(o.st[0] - s.x, o.st[1] - s.y, o.st[2] - s.z));
      return { s, d: min };
    }).sort((a, b) => b.d - a.d);
    return scored[Math.floor(Math.random() * Math.min(3, scored.length))].s;
  }

  spawn(p) {
    const s = this.pickSpawn();
    p.alive = true;
    p.hp = 100;
    p.st[0] = s.x; p.st[1] = s.y; p.st[2] = s.z;
    p.protectUntil = Date.now() + PROTECT_MS;
    this.sendTo(p.id, { t: 'spawn', p: [s.x, s.y, s.z], yaw: s.yaw });
  }

  handle(id, m) {
    const p = this.players.get(id);
    if (!p) return;
    switch (m.t) {
      case 'st':
        if (p.alive && Array.isArray(m.p)) p.st = [m.p[0], m.p[1], m.p[2], m.y, m.pi, m.w, m.c ? 1 : 0];
        break;
      case 'shot': case 'proj': case 'boom':
        this.broadcast({ ...m, id }, id);
        break;
      case 'hit':
        this.hit(p, m);
        break;
    }
  }

  hit(attacker, m) {
    if (this.phase !== 'playing') return;
    const v = this.players.get(m.v);
    if (!v || !v.alive) return;
    const explosive = m.w === 'gl' || m.w === 'frag';
    if (!attacker.alive && !explosive) return;
    const now = Date.now();
    if (now < v.protectUntil && v !== attacker) return;
    const dmg = Math.max(0, Math.min(999, Number(m.dmg) || 0));
    if (!dmg) return;
    v.hp -= dmg;
    v.lastDmg = now;
    const dead = v.hp <= 0;
    this.sendTo(v.id, { t: 'dmg', hp: Math.max(0, Math.round(v.hp)), from: attacker.id, imp: m.imp || null });
    if (v !== attacker) this.sendTo(attacker.id, { t: 'hitc', kill: dead, head: !!m.head });
    if (!dead) return;
    v.alive = false;
    v.hp = 0;
    v.deaths++;
    if (v !== attacker) attacker.kills++;
    v.respawnAt = now + RESPAWN_MS;
    this.broadcast({ t: 'kill', k: attacker.id, v: v.id, w: m.w, head: !!m.head });
    if (attacker.kills >= KILL_LIMIT) this.endMatch();
  }

  endMsg() {
    const scores = [...this.players.values()]
      .map((p) => ({ id: p.id, name: p.name, color: p.color, k: p.kills, d: p.deaths }))
      .sort((a, b) => b.k - a.k || a.d - b.d);
    return { t: 'end', scores, next: Math.max(0, Math.ceil((this.restartAt - Date.now()) / 1000)) };
  }

  endMatch() {
    this.phase = 'ended';
    this.restartAt = Date.now() + END_SCREEN_MS;
    for (const p of this.players.values()) p.alive = false;
    this.broadcast(this.endMsg());
  }

  startMatch() {
    this.phase = 'playing';
    this.endsAt = Date.now() + MATCH_SECONDS * 1000;
    for (const p of this.players.values()) { p.kills = 0; p.deaths = 0; }
    this.broadcast({ t: 'start' });
    for (const p of this.players.values()) this.spawn(p);
  }

  tick() {
    const now = Date.now();
    const dt = (now - this.last) / 1000;
    this.last = now;

    if (this.phase === 'playing') {
      if (now >= this.endsAt) this.endMatch();
      for (const p of this.players.values()) {
        if (!p.alive && p.respawnAt && now >= p.respawnAt) { p.respawnAt = 0; this.spawn(p); }
        if (p.alive && p.hp < 100 && now - p.lastDmg > 5000) p.hp = Math.min(100, p.hp + 25 * dt);
      }
    } else if (now >= this.restartAt) {
      this.startMatch();
    }

    const s = {};
    for (const p of this.players.values()) {
      const st = p.st;
      s[p.id] = [r2(st[0]), r2(st[1]), r2(st[2]), r2(st[3]), r2(st[4]), st[5], st[6], p.alive ? 1 : 0, Math.ceil(p.hp), p.kills, p.deaths];
    }
    const tl = this.phase === 'playing' ? Math.max(0, Math.ceil((this.endsAt - now) / 1000)) : 0;
    this.broadcast({ t: 'snap', s, tl });
  }
}

const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
