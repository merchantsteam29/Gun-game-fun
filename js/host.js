import { spawns, setMapData, MAP_ORDER, MAPS } from './maps.js';
import { phys } from './physics.js';
import { WEAPONS, GUNGAME_LADDER, SLOTS } from './weapons.js';
import { NavGrid } from './nav.js';
import { Bot, BOT_NAMES } from './bot.js';
import { COLORS } from './util.js';

// redBlue: two balanced teams. hill: uses the moving zone. loadout: forced for everyone.
// preset: physics/rule overrides applied when the mode is picked.
export const MODES = {
  ffa: { name: 'Free For All', short: 'FFA', teams: false, score: 25, time: 10, desc: 'Most kills wins.' },
  tdm: { name: 'Team Deathmatch', short: 'TDM', teams: true, redBlue: true, score: 50, time: 10, desc: 'Red vs Blue. First team to the score limit.' },
  gungame: { name: 'Gun Game', short: 'GUN GAME', teams: false, score: GUNGAME_LADDER.length, time: 12, desc: 'Each kill upgrades your weapon. Finish with a knife kill.' },
  koth: { name: 'King of the Hill', short: 'KOTH', teams: false, hill: true, score: 90, time: 10, desc: 'Hold the zone alone to score. It moves every minute.' },
  infection: { name: 'Infection', short: 'INFECTION', teams: true, score: 0, time: 4, desc: 'Zombies infect survivors. Survive until time runs out.' },
  hardpoint: { name: 'Hardpoint', short: 'HARDPOINT', teams: true, redBlue: true, hill: true, score: 150, time: 10, desc: 'Red vs Blue fight over a moving zone. Hold it with only your team inside to score.' },
  juggernaut: { name: 'Juggernaut', short: 'JUGGERNAUT', teams: false, score: 15, time: 10, desc: 'First kill makes you the Juggernaut: 4x health and a minigun. Kill the Juggernaut to take over. Only Juggernaut kills (and killing it) score.' },
  lms: { name: 'Last Man Standing', short: 'LMS', teams: false, score: 3, time: 8, desc: 'Everyone gets a few lives (the score limit). Last player with lives left wins.' },
  instagib: { name: 'Instagib', short: 'INSTAGIB', teams: false, score: 25, time: 8, instakill: true, desc: 'Every hit kills. Bring your own loadout.' },
  snipers: { name: 'Snipers Only', short: 'SNIPERS', teams: false, score: 20, time: 10, loadout: ['sniper', 'revolver', 'knife', 'smoke'], desc: 'Sniper rifles and revolvers. Find a perch.' },
  shotguns: { name: 'Shotgun Brawl', short: 'SHOTGUNS', teams: false, score: 25, time: 8, loadout: ['shotgun', 'sawedoff', 'knife', 'flash'], desc: 'Shotguns only. Get close and personal.' },
  blades: { name: 'Blade Party', short: 'BLADES', teams: false, score: 20, time: 8, loadout: ['katana', 'axe', 'knife', 'tknife'], preset: { moveSpeed: 1.25, jump: 1.15 }, desc: 'Melee and throwing knives only. Everyone moves faster.' },
  boom: { name: 'Boom Town', short: 'BOOM', teams: false, score: 25, time: 8, loadout: ['rocket', 'gl', 'bat', 'sticky'], desc: 'Launchers, stickies and a bat. Mind the splash.' },
  roulette: { name: 'Roulette', short: 'ROULETTE', teams: false, score: 25, time: 10, desc: 'A random loadout every time you spawn.' },
  vampire: { name: 'Vampire', short: 'VAMPIRE', teams: false, score: 25, time: 10, desc: 'No health regen. Damage you deal heals you, and kills heal more.' },
  moon: { name: 'Moon Gravity', short: 'MOON', teams: false, score: 25, time: 10, preset: { gravity: 0.35, jump: 1.3 }, desc: 'Low gravity and huge jumps. Most kills wins.' },
};
export const MODE_ORDER = ['ffa', 'tdm', 'gungame', 'koth', 'infection', 'hardpoint', 'juggernaut', 'lms', 'instagib', 'snipers', 'shotguns', 'blades', 'boom', 'roulette', 'vampire', 'moon'];
export const TEAM_COLORS = { 1: '#e5483b', 2: '#3d8fe0' };
export const ZOMBIE_COLOR = '#6fbf3a';
export const JUGG_COLOR = '#ffcc33';
export const JUGG_TEAM = 3;
const JUGG_LOADOUT = ['minigun', 'handcannon', 'bat', 'frag'];
const PHYS_DEFAULTS = { gameSpeed: 1, moveSpeed: 1, jump: 1, gravity: 1 };

const PROTECT_MS = 1500;
const END_SCREEN_MS = 10000;
const TICK_MS = 50;
const HILL_SECONDS = 60;
const INFECT_DELAY_MS = 10000;

export function defaultSettings(mode = 'ffa', map = 'warehouse') {
  return {
    mode, map, rotate: true,
    scoreLimit: MODES[mode].score, timeLimit: MODES[mode].time,
    health: 100, respawn: 3, infiniteAmmo: false, headshotsOnly: false, friendlyFire: false,
    ...PHYS_DEFAULTS, ...MODES[mode].preset,
  };
}

// Authoritative game state that runs inside the lobby creator's browser.
// Movement and aiming are client-side; health, kills, spawns, modes and bots live here.
export class HostLogic {
  constructor(sendTo, broadcast, opts = {}) {
    this.rawSend = sendTo;
    this.broadcast = broadcast;
    this.onKick = null;
    this.players = new Map();
    this.s = defaultSettings(MODES[opts.mode] ? opts.mode : 'ffa', MAPS[opts.map] ? opts.map : MAP_ORDER[0]);
    this.botCount = 0;
    this.loadMap(this.s.map);
    this.beginMatchState();
    this.last = Date.now();
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  destroy() { clearInterval(this.timer); }

  get mode() { return MODES[this.s.mode]; }

  // Routes to bots in-process, otherwise to the network.
  sendTo(id, m) {
    const p = this.players.get(id);
    if (p && p.bot) p.bot.onMessage(m);
    else this.rawSend(id, m);
  }

  loadMap(id) {
    setMapData(id);
    this.nav = null;
  }

  ensureNav() {
    if (!this.nav && [...this.players.values()].some((p) => p.bot)) this.nav = new NavGrid(MAPS[this.s.map].bounds);
  }

  beginMatchState() {
    this.phase = 'playing';
    this.endsAt = Date.now() + this.s.timeLimit * 60000;
    this.restartAt = 0;
    this.endTitle = '';
    this.teamScore = [0, 0, 0];
    this.hillIdx = 0;
    this.hillUntil = Date.now() + HILL_SECONDS * 1000;
    this.hillState = 0; // 0 neutral, 1 held, 2 contested
    this.hillHolder = null;
    this.infectAt = this.s.mode === 'infection' ? Date.now() + INFECT_DELAY_MS : 0;
    this.infected = false;
    this.jugg = null;
  }

  // Lives left in Last Man Standing are stored as the player's score.
  outOfLives(p) { return this.s.mode === 'lms' && p.score <= 0; }

  // ---------- Players ----------

  record(id, name, color, bot = null) {
    return {
      id, name: String(name || 'Player').slice(0, 16), color, team: 0, kills: 0, deaths: 0, score: 0, level: 0,
      hp: 100, alive: false, st: [0, -50, 0, 0, 0, 'ar', 0, 0], lastDmg: 0, respawnAt: 0, protectUntil: 0, bot,
    };
  }

  info(p) {
    return { id: p.id, name: p.name, color: p.color, team: p.team, k: p.kills, d: p.deaths, sc: Math.floor(p.score), bot: !!p.bot };
  }

  addPlayer(id, name, color) {
    const p = this.record(id, name, color);
    p.team = this.autoTeam(p);
    this.players.set(id, p);
    this.sendTo(id, {
      t: 'welcome', id, settings: this.s,
      players: [...this.players.values()].map((q) => this.info(q)),
    });
    this.broadcast({ t: 'pjoin', ...this.info(p) }, id);
    if (this.phase !== 'playing') this.sendTo(id, this.endMsg());
    else if (this.s.mode === 'lms') this.sendTo(id, { t: 'notice', text: 'ROUND IN PROGRESS · SPECTATING' });
    else this.spawn(p);
  }

  addBot(difficulty = 'normal') {
    const id = 'b' + ++this.botCount;
    const used = new Set([...this.players.values()].map((p) => p.name));
    const base = BOT_NAMES.find((n) => !used.has('[BOT] ' + n)) || 'Bot' + this.botCount;
    const p = this.record(id, '[BOT] ' + base, COLORS[(Math.random() * COLORS.length) | 0]);
    p.bot = new Bot(this, p, difficulty);
    p.team = this.autoTeam(p);
    this.players.set(id, p);
    this.ensureNav();
    this.broadcast({ t: 'pjoin', ...this.info(p) });
    if (this.phase === 'playing' && this.s.mode !== 'lms') this.spawn(p);
    return id;
  }

  removePlayer(id) {
    const p = this.players.get(id);
    if (!p) return;
    this.players.delete(id);
    this.broadcast({ t: 'pleave', id, name: p.name });
    if (this.jugg === id) this.jugg = null;
    this.checkInfectionEnd();
    this.checkLmsEnd();
  }

  kick(id) {
    const p = this.players.get(id);
    if (!p || id === 'host') return;
    if (p.bot) { this.removePlayer(id); return; }
    this.rawSend(id, { t: 'kicked' });
    if (this.onKick) this.onKick(id);
  }

  setBotDifficulty(id, diff) {
    const p = this.players.get(id);
    if (p && p.bot) p.bot.difficulty = diff;
  }

  setTeam(id, team) {
    const p = this.players.get(id);
    if (!p || !this.mode.teams || p.team === team) return;
    p.team = team;
    if (p.alive) {
      p.alive = false;
      p.respawnAt = Date.now() + 500;
      this.sendTo(p.id, { t: 'notice', text: 'TEAM CHANGED' });
    }
  }

  autoTeam(p) {
    if (this.mode.redBlue) {
      let red = 0, blue = 0;
      for (const q of this.players.values()) if (q !== p) { if (q.team === 1) red++; else if (q.team === 2) blue++; }
      return red <= blue ? 1 : 2;
    }
    if (this.s.mode === 'infection') return this.infected ? 2 : 1;
    return 0;
  }

  hostile(a, b) {
    if (a === b) return false;
    if (!this.mode.teams) return true;
    return a.team !== b.team;
  }

  // Forced loadout for the current mode (null = player's own choice).
  loadoutFor(p) {
    if (this.s.mode === 'gungame') {
      const w = GUNGAME_LADDER[Math.min(p.level, GUNGAME_LADDER.length - 1)];
      return w === 'knife' ? ['knife'] : [w, 'knife'];
    }
    if (this.s.mode === 'infection' && p.team === 2) return ['claws'];
    if (this.s.mode === 'juggernaut' && p.id === this.jugg) return JUGG_LOADOUT;
    if (this.s.mode === 'roulette') return SLOTS.map((opts) => opts[(Math.random() * opts.length) | 0]);
    return this.mode.loadout || null;
  }

  pickSpawn(p) {
    const enemies = [...this.players.values()].filter((q) => q.alive && q !== p && this.hostile(p, q));
    const side = this.mode.redBlue ? (p.team === 1 ? -1 : 1) : 0;
    const scored = spawns.map((s) => {
      let min = 1e9;
      for (const o of enemies) min = Math.min(min, Math.hypot(o.st[0] - s.x, o.st[1] - s.y, o.st[2] - s.z));
      if (!enemies.length) min = Math.random() * 50;
      return { s, d: min + (side && Math.sign(s.x) === side ? 40 : 0) };
    }).sort((a, b) => b.d - a.d);
    return scored[Math.floor(Math.random() * Math.min(3, scored.length))].s;
  }

  maxHp(p) {
    let k = 1;
    if (this.s.mode === 'infection' && p.team === 2) k = 1.5;
    if (this.s.mode === 'juggernaut' && p.id === this.jugg) k = 4;
    return Math.round(this.s.health * k);
  }

  spawn(p) {
    const s = this.pickSpawn(p);
    p.alive = true;
    p.hp = this.maxHp(p);
    p.st[0] = s.x; p.st[1] = s.y; p.st[2] = s.z;
    p.protectUntil = Date.now() + PROTECT_MS;
    const l = this.loadoutFor(p);
    if (p.bot) p.bot.spawn(s, l);
    else this.sendTo(p.id, { t: 'spawn', p: [s.x, s.y, s.z], yaw: s.yaw, hp: p.hp, l, team: p.team });
  }

  // ---------- Messages ----------

  handle(id, m) {
    const p = this.players.get(id);
    if (!p) return;
    switch (m.t) {
      case 'st':
        if (p.alive && Array.isArray(m.p)) p.st = [m.p[0], m.p[1], m.p[2], m.y, m.pi, m.w, m.c ? 1 : 0, m.a | 0];
        break;
      case 'shot': case 'proj': case 'boom': case 'fx':
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
    const w = WEAPONS[m.w];
    const explosive = ['gl', 'frag', 'sticky', 'rocket', 'crossbow', 'tknife'].includes(m.w);
    if (!attacker.alive && !explosive) return;
    if (v !== attacker && !this.hostile(attacker, v) && !(this.s.friendlyFire && this.mode.redBlue)) return;
    if (this.s.headshotsOnly && w && w.type === 'gun' && !m.head && v !== attacker) return;
    const now = Date.now();
    if (now < v.protectUntil && v !== attacker) return;
    let dmg = Math.max(0, Math.min(999, Number(m.dmg) || 0));
    if (!dmg) return;
    if (this.mode.instakill && v !== attacker) dmg = 999;
    if (this.s.mode === 'vampire' && v !== attacker && attacker.alive) {
      attacker.hp = Math.min(this.maxHp(attacker), attacker.hp + Math.min(dmg, Math.max(0, v.hp)) * 0.5);
    }
    v.hp -= dmg;
    v.lastDmg = now;
    const dead = v.hp <= 0;
    this.sendTo(v.id, { t: 'dmg', hp: Math.max(0, Math.round(v.hp)), from: attacker.id, imp: m.imp || null });
    if (v !== attacker) this.sendTo(attacker.id, { t: 'hitc', kill: dead, head: !!m.head });
    if (dead) this.kill(attacker, v, m.w, !!m.head);
  }

  kill(attacker, v, w, head) {
    v.alive = false;
    v.hp = 0;
    v.deaths++;
    const enemyKill = v !== attacker && this.hostile(attacker, v);
    if (enemyKill) attacker.kills++;
    v.respawnAt = Date.now() + this.s.respawn * 1000;
    this.broadcast({ t: 'kill', k: attacker.id, v: v.id, w, head });

    switch (this.s.mode) {
      case 'tdm':
        if (enemyKill) this.teamScore[attacker.team]++;
        attacker.score = attacker.kills;
        if (this.teamScore[attacker.team] >= this.s.scoreLimit) this.endMatch();
        break;
      case 'hardpoint': // personal score is kills; the team score comes from the zone
        attacker.score = attacker.kills;
        break;
      case 'juggernaut':
        this.juggKill(attacker, v, enemyKill);
        break;
      case 'lms':
        v.score = Math.max(0, v.score - 1);
        if (v.score <= 0) {
          v.respawnAt = 0;
          this.sendTo(v.id, { t: 'notice', text: 'OUT OF LIVES' });
          this.broadcast({ t: 'notice', text: `${v.name} IS OUT` });
        }
        this.checkLmsEnd();
        break;
      case 'gungame': {
        const wdef = WEAPONS[w];
        if (wdef && wdef.type === 'melee' && enemyKill && v.level > 0) {
          v.level--;
          this.sendTo(v.id, { t: 'notice', text: 'DEMOTED!' });
        }
        v.score = v.level;
        if (enemyKill) {
          attacker.level++;
          attacker.score = attacker.level;
          if (attacker.level >= GUNGAME_LADDER.length) { this.endMatch(); break; }
          if (attacker.alive) this.sendTo(attacker.id, { t: 'loadout', l: this.loadoutFor(attacker) });
        }
        break;
      }
      case 'infection':
        if (v.team === 1 && this.infected) {
          v.team = 2;
          this.broadcast({ t: 'notice', text: `${v.name} WAS INFECTED` });
          if (enemyKill) attacker.score += 1;
        }
        this.checkInfectionEnd();
        break;
      default: // ffa and the kill-count variants
        if (this.s.mode === 'vampire' && enemyKill && attacker.alive) attacker.hp = Math.min(this.maxHp(attacker), attacker.hp + 30);
        attacker.score = attacker.kills;
        if (attacker.kills >= this.s.scoreLimit) this.endMatch();
    }
  }

  // Juggernaut: the first kill crowns a Juggernaut; killing it passes the crown on.
  juggKill(attacker, v, enemyKill) {
    const wasJugg = v.id === this.jugg;
    if (wasJugg) {
      v.team = 0;
      this.jugg = null;
    }
    if (!enemyKill) {
      if (wasJugg) this.broadcast({ t: 'notice', text: 'THE JUGGERNAUT IS DOWN' });
      return;
    }
    if (attacker.id === this.jugg || wasJugg) {
      attacker.score++;
      if (attacker.score >= this.s.scoreLimit) { this.endMatch(); return; }
    }
    if (!this.jugg && attacker.alive) this.makeJugg(attacker);
  }

  makeJugg(p) {
    this.jugg = p.id;
    p.team = JUGG_TEAM;
    p.hp = this.maxHp(p);
    this.broadcast({ t: 'notice', text: `${p.name} IS THE JUGGERNAUT` });
    this.sendTo(p.id, { t: 'loadout', l: JUGG_LOADOUT, hp: p.hp });
  }

  checkLmsEnd() {
    if (this.s.mode !== 'lms' || this.phase !== 'playing') return;
    const all = [...this.players.values()];
    if (all.length < 2) return;
    if (all.filter((p) => p.score > 0).length <= 1) this.endMatch();
  }

  // ---------- Modes ----------

  currentHill() {
    if (!this.mode.hill) return null;
    const hills = MAPS[this.s.map].hills;
    return hills[this.hillIdx % hills.length];
  }

  checkInfectionEnd() {
    if (this.s.mode !== 'infection' || this.phase !== 'playing' || !this.infected) return;
    const all = [...this.players.values()];
    if (all.length && !all.some((p) => p.team === 1)) this.endMatch(2);
  }

  startInfection() {
    const pool = [...this.players.values()].filter((p) => p.alive && p.team === 1);
    if (pool.length < 2) { this.infectAt = Date.now() + 3000; return; }
    const z = pool[(Math.random() * pool.length) | 0];
    this.infected = true;
    z.team = 2;
    z.hp = this.maxHp(z);
    this.broadcast({ t: 'notice', text: `${z.name} IS PATIENT ZERO` });
    if (z.bot) z.bot.setLoadout(['claws']);
    else this.sendTo(z.id, { t: 'loadout', l: ['claws'], hp: z.hp });
  }

  endMsg() {
    const scores = [...this.players.values()]
      .map((p) => this.info(p))
      .sort((a, b) => b.sc - a.sc || b.k - a.k || a.d - b.d);
    return {
      t: 'end', scores, title: this.endTitle, mode: this.s.mode,
      next: Math.max(0, Math.ceil((this.restartAt - Date.now()) / 1000)),
      nextMap: this.nextMap(),
    };
  }

  endMatch(winnerTeam) {
    if (this.phase !== 'playing') return;
    this.phase = 'ended';
    this.restartAt = Date.now() + END_SCREEN_MS;
    const sorted = [...this.players.values()].sort((a, b) => b.score - a.score || b.kills - a.kills);
    if (this.mode.redBlue) {
      const r = Math.floor(this.teamScore[1]), b = Math.floor(this.teamScore[2]);
      this.endTitle = r === b ? 'DRAW' : r > b ? 'RED TEAM WINS' : 'BLUE TEAM WINS';
    } else if (this.s.mode === 'infection') {
      this.endTitle = winnerTeam === 2 ? 'ZOMBIES WIN' : 'SURVIVORS WIN';
    } else {
      this.endTitle = sorted[0] ? `${sorted[0].name} WINS` : 'MATCH OVER';
    }
    for (const p of this.players.values()) p.alive = false;
    this.broadcast(this.endMsg());
  }

  nextMap() {
    if (!this.s.rotate) return this.s.map;
    return MAP_ORDER[(MAP_ORDER.indexOf(this.s.map) + 1) % MAP_ORDER.length];
  }

  // Starts a fresh match. With no arguments it rotates to the next map (end of match);
  // the host panel passes an explicit mode/map to restart immediately.
  startMatch(mode, map) {
    const manual = !!(mode || map);
    if (mode && MODES[mode] && mode !== this.s.mode) {
      this.s.mode = mode;
      this.s.scoreLimit = MODES[mode].score;
      this.s.timeLimit = MODES[mode].time;
      Object.assign(this.s, PHYS_DEFAULTS, MODES[mode].preset);
    }
    this.s.map = map && MAPS[map] ? map : manual ? this.s.map : this.nextMap();
    this.loadMap(this.s.map);
    this.ensureNav();
    this.beginMatchState();
    const list = [...this.players.values()].sort(() => Math.random() - 0.5);
    list.forEach((p, i) => {
      p.kills = 0; p.deaths = 0; p.level = 0;
      p.score = this.s.mode === 'lms' ? Math.max(1, this.s.scoreLimit) : 0;
      p.team = this.mode.redBlue ? (i % 2) + 1 : this.s.mode === 'infection' ? 1 : 0;
      p.alive = false;
      p.respawnAt = 0;
    });
    this.broadcast({ t: 'settings', s: this.s });
    this.broadcast({ t: 'start', map: this.s.map, mode: this.s.mode });
    for (const p of this.players.values()) this.spawn(p);
  }

  applySettings(partial) {
    Object.assign(this.s, partial);
    if ('timeLimit' in partial && this.phase === 'playing') this.endsAt = Date.now() + this.s.timeLimit * 60000;
    this.broadcast({ t: 'settings', s: this.s });
  }

  // ---------- Tick ----------

  tick() {
    const now = Date.now();
    const rdt = (now - this.last) / 1000;
    this.last = now;
    const dt = Math.min(0.1, rdt) * this.s.gameSpeed;
    phys.gravity = this.s.gravity;

    if (this.phase === 'playing') {
      if (now >= this.endsAt) this.endMatch(1);
      for (const p of this.players.values()) {
        if (!p.alive && p.respawnAt && now >= p.respawnAt) { p.respawnAt = 0; this.spawn(p); }
        const max = this.maxHp(p);
        if (p.alive && p.hp < max && now - p.lastDmg > 5000 && this.s.mode !== 'vampire') p.hp = Math.min(max, p.hp + max * 0.25 * rdt);
      }
      if (this.s.mode === 'infection' && !this.infected && this.infectAt && now >= this.infectAt) this.startInfection();
      if (this.mode.hill) this.tickHill(rdt, now);
      for (const p of this.players.values()) if (p.bot) p.bot.update(dt);
    } else if (now >= this.restartAt) {
      this.startMatch();
    }

    const s = {};
    for (const p of this.players.values()) {
      const st = p.st;
      s[p.id] = [r2(st[0]), r2(st[1]), r2(st[2]), r2(st[3]), r2(st[4]), st[5], st[6], p.alive ? 1 : 0,
        Math.ceil(p.hp), p.kills, p.deaths, st[7], p.team, Math.floor(p.score)];
    }
    const msg = { t: 'snap', s, tl: this.phase === 'playing' ? Math.max(0, Math.ceil((this.endsAt - now) / 1000)) : 0 };
    if (this.mode.redBlue) msg.ts = [Math.floor(this.teamScore[1]), Math.floor(this.teamScore[2])];
    if (this.s.mode === 'infection') msg.inf = this.infected ? 0 : Math.max(0, Math.ceil((this.infectAt - now) / 1000));
    const hill = this.currentHill();
    if (hill) msg.z = [...hill, this.hillState, this.hillHolder, Math.max(0, Math.ceil((this.hillUntil - now) / 1000))];
    this.broadcast(msg);
  }

  tickHill(dt, now) {
    if (now >= this.hillUntil) {
      this.hillIdx++;
      this.hillUntil = now + HILL_SECONDS * 1000;
      this.broadcast({ t: 'notice', text: 'THE HILL HAS MOVED' });
    }
    const [x, y, z, r] = this.currentHill();
    const inside = [...this.players.values()].filter((p) => p.alive &&
      Math.hypot(p.st[0] - x, p.st[2] - z) <= r && p.st[1] >= y - 0.6 && p.st[1] <= y + 2.5);
    if (this.s.mode === 'hardpoint') {
      // Team version: holder is the team number while only one team is inside.
      const teams = new Set(inside.map((p) => p.team));
      if (teams.size === 1) {
        const t = inside[0].team;
        this.teamScore[t] += dt;
        this.hillState = 1;
        this.hillHolder = t;
        if (this.teamScore[t] >= this.s.scoreLimit) this.endMatch();
      } else {
        this.hillState = teams.size ? 2 : 0;
        this.hillHolder = null;
      }
      return;
    }
    if (inside.length === 1) {
      const p = inside[0];
      p.score += dt;
      this.hillState = 1;
      this.hillHolder = p.id;
      if (p.score >= this.s.scoreLimit) this.endMatch();
    } else {
      this.hillState = inside.length ? 2 : 0;
      this.hillHolder = null;
    }
  }
}

const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
