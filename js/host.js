import { spawns, setMapData, MAP_ORDER, MAPS } from './maps.js';
import { phys } from './physics.js';
import { WEAPONS, GUNGAME_LADDER, SLOTS } from './weapons.js';
import { NavGrid } from './nav.js';
import { Bot, BOT_NAMES } from './bot.js';
import { COLORS } from './util.js';
import { sanitizeCos, randomCos } from './missions.js';

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
  killconfirmed: { name: 'Kill Confirmed', short: 'KILL CONFIRMED', teams: true, redBlue: true, score: 40, time: 10, desc: 'Red vs Blue. Every kill drops a dog tag: grab enemy tags to score, grab your team’s to deny the point.' },
  oitc: { name: 'One in the Chamber', short: 'OITC', teams: false, score: 20, time: 10, loadout: ['revolver', 'knife'], instakill: true, noReload: true, ammoStart: 1, desc: 'One bullet that kills in one hit, and no reloading. Every kill gives you another bullet. Miss and it’s knife time.' },
  rotation: { name: 'Weapon Rotation', short: 'ROTATION', teams: false, score: 25, time: 10, desc: 'Everyone gets the same random weapon, and it changes every 40 seconds.' },
  hardcore: { name: 'Hardcore', short: 'HARDCORE', teams: false, score: 25, time: 10, noRegen: true, preset: { health: 35 }, desc: '35 health and no regeneration. Every shot counts.' },
  sidearms: { name: 'Sidearms', short: 'SIDEARMS', teams: false, score: 25, time: 8, loadout: ['handcannon', 'revolver', 'knife', 'flash'], desc: 'Pistols only: Hand Cannon and Revolver.' },
  ctf: { name: 'Capture the Flag', short: 'CTF', teams: true, redBlue: true, score: 3, time: 12, desc: 'Red vs Blue. Grab the enemy flag and bring it to your base while your own flag is home. Drop it if you die.' },
  bounty: { name: 'Bounty Hunter', short: 'BOUNTY', teams: false, score: 30, time: 10, desc: 'Free-for-all. Whoever is in the lead has a bounty (shown in gold): killing them is worth 3 points.' },
  headshots: { name: 'Headshots Only', short: 'HEADSHOTS', teams: false, score: 20, time: 10, preset: { headshotsOnly: true }, desc: 'Guns only hurt on headshots. Melee and explosives still work.' },
  bighead: { name: 'Big Heads', short: 'BIG HEADS', teams: false, score: 25, time: 10, bigHead: true, desc: 'Everyone has a giant head, with a giant headshot hitbox to match.' },
  dom: { name: 'Domination', short: 'DOMINATION', teams: true, redBlue: true, dom: true, score: 200, time: 10, desc: 'Red vs Blue over three zones (A, B, C). Stand in a zone with only your team to capture it; every zone you own scores a point per second.' },
  tank: { name: 'Tank Battle', short: 'TANKS', teams: false, score: 20, time: 10, loadout: ['lmg', 'handcannon', 'sledge', 'frag'], preset: { health: 250, moveSpeed: 0.85 }, desc: '250 health, heavy weapons, slow and steady. Most kills wins.' },
  speed: { name: 'Speed Demons', short: 'SPEED', teams: false, score: 25, time: 8, preset: { moveSpeed: 1.45, jump: 1.25 }, desc: 'Everyone runs and jumps way faster. Bring your own loadout.' },
  railarena: { name: 'Railgun Arena', short: 'RAILGUNS', teams: false, score: 20, time: 8, loadout: ['railgun', 'handcannon', 'katana', 'vortex'], preset: { gravity: 0.6, jump: 1.2 }, desc: 'Railguns, katanas and vortex grenades in lighter gravity.' },
};
export const MODE_ORDER = ['ffa', 'tdm', 'gungame', 'koth', 'infection', 'ctf', 'dom', 'hardpoint', 'killconfirmed', 'juggernaut', 'bounty', 'lms', 'oitc',
  'instagib', 'headshots', 'hardcore', 'bighead', 'tank', 'speed', 'rotation', 'snipers', 'railarena', 'shotguns', 'sidearms', 'blades', 'boom', 'roulette', 'vampire', 'moon'];
const FLAG_RETURN_MS = 20000;

// Runs fn every ms. Browsers slow main-thread timers to once a second in background tabs, which
// made everyone in a lobby freeze and teleport whenever the host switched tabs or apps; a worker's
// timer keeps the 20 Hz game tick going.
function startTicker(fn, ms) {
  try {
    const src = `let t; onmessage = (e) => { clearInterval(t); if (e.data > 0) t = setInterval(() => postMessage(0), e.data); };`;
    const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
    const w = new Worker(url);
    URL.revokeObjectURL(url);
    w.onmessage = () => fn();
    w.postMessage(ms);
    return () => { w.postMessage(0); w.terminate(); };
  } catch {
    const t = setInterval(fn, ms);
    return () => clearInterval(t);
  }
}

// Largest damage a single hit message can carry for a weapon (all pellets on the head, backstabs, direct hits).
function maxHitDmg(w) {
  if (!w) return 999;
  const head = Math.max(1, w.head || 1);
  if (w.type === 'gun') return Math.ceil(w.dmg * head * (w.pellets || 1)) + 1;
  if (w.type === 'melee') return Math.max(w.dmg, w.backstab || 0) + 1;
  return Math.ceil(Math.max((w.directDmg || 0) * head, w.splash || 0)) + 1;
}
const ROTATION_SECONDS = 40;
// Weapon Rotation picks from every primary/secondary gun and launcher.
const ROTATION_POOL = [...SLOTS[0], ...SLOTS[1]];
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
    this.botFill = Math.max(0, Math.min(12, opts.botFill || 0)); // keep humans + bots at this many
    this.loadMap(this.s.map);
    this.beginMatchState();
    this.last = Date.now();
    this.stopTicker = startTicker(() => this.tick(), TICK_MS);
  }

  destroy() { this.stopTicker(); }

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
    this.tags = []; // Kill Confirmed dog tags
    this.tagId = 0;
    this.bountyId = null;
    this.flags = this.s.mode === 'ctf' ? this.makeFlags() : null;
    this.dom = this.mode.dom ? this.makeDomZones() : null;
    this.domAcc = 0;
    if (this.s.mode === 'rotation') { this.rotW = this.pickRotation(); this.rotUntil = Date.now() + ROTATION_SECONDS * 1000; }
  }

  // CTF bases: the ground-level spawns furthest toward each team's side (red = -x, blue = +x,
  // matching pickSpawn), so every mirrored map gets fair, symmetric bases.
  makeFlags() {
    const ground = spawns.filter((s) => s.y < 1);
    const pool = ground.length >= 2 ? ground : spawns;
    const red = pool.reduce((a, b) => (b.x < a.x ? b : a));
    const blue = pool.reduce((a, b) => (b.x > a.x ? b : a));
    const flag = (s) => ({ home: { x: s.x, y: s.y, z: s.z }, pos: { x: s.x, y: s.y, z: s.z }, carrier: null, dropped: false, returnAt: 0 });
    return { 1: flag(red), 2: flag(blue) };
  }

  resetFlag(t) {
    const f = this.flags[t];
    Object.assign(f, { pos: { ...f.home }, carrier: null, dropped: false, returnAt: 0 });
  }

  dropFlagsOf(p) {
    if (!this.flags) return;
    for (const t of [1, 2]) {
      const f = this.flags[t];
      if (f.carrier !== p.id) continue;
      Object.assign(f, { carrier: null, dropped: true, returnAt: Date.now() + FLAG_RETURN_MS, pos: { x: p.st[0], y: p.st[1], z: p.st[2] } });
      this.broadcast({ t: 'notice', text: `${t === 1 ? 'RED' : 'BLUE'} FLAG DROPPED` });
    }
  }

  tickFlags(now) {
    const teamName = (t) => (t === 1 ? 'RED' : 'BLUE');
    for (const t of [1, 2]) {
      const f = this.flags[t];
      if (f.carrier) {
        const c = this.players.get(f.carrier);
        if (!c || !c.alive) { if (c) this.dropFlagsOf(c); else this.resetFlag(t); continue; }
        f.pos = { x: c.st[0], y: c.st[1], z: c.st[2] };
        // Capture: carrier reaches their own base while their own flag is at home.
        const own = this.flags[c.team], base = own.home;
        if (!own.carrier && !own.dropped && Math.hypot(c.st[0] - base.x, c.st[2] - base.z) < 2.5 && Math.abs(c.st[1] - base.y) < 2.5) {
          this.teamScore[c.team]++;
          c.score += 5;
          this.resetFlag(t);
          this.broadcast({ t: 'notice', text: `${c.name.toUpperCase()} CAPTURED THE ${teamName(t)} FLAG!` });
          if (this.teamScore[c.team] >= this.s.scoreLimit) { this.endMatch(); return; }
        }
        continue;
      }
      if (f.dropped && now >= f.returnAt) { this.resetFlag(t); this.broadcast({ t: 'notice', text: `${teamName(t)} FLAG RETURNED` }); continue; }
      for (const p of this.players.values()) {
        if (!p.alive || Math.hypot(p.st[0] - f.pos.x, p.st[2] - f.pos.z) > 1.6 || Math.abs(p.st[1] - f.pos.y) > 2.2) continue;
        if (p.team !== t) {
          f.carrier = p.id;
          f.dropped = false;
          this.broadcast({ t: 'notice', text: `${p.name.toUpperCase()} HAS THE ${teamName(t)} FLAG` });
          break;
        } else if (f.dropped) {
          this.resetFlag(t);
          p.score += 1;
          this.broadcast({ t: 'notice', text: `${teamName(t)} FLAG RETURNED` });
          break;
        }
      }
    }
  }

  // Bounty Hunter: the leader (score > 0) carries the bounty.
  updateBounty() {
    let top = null;
    for (const p of this.players.values()) if (p.score > 0 && (!top || p.score > top.score)) top = p;
    const id = top ? top.id : null;
    if (id === this.bountyId) return;
    for (const p of this.players.values()) p.team = p.id === id ? JUGG_TEAM : 0;
    this.bountyId = id;
    if (top) this.broadcast({ t: 'notice', text: `BOUNTY ON ${top.name.toUpperCase()}` });
  }

  pickRotation() {
    const pool = ROTATION_POOL.filter((w) => w !== this.rotW);
    return pool[(Math.random() * pool.length) | 0];
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
    return { id: p.id, name: p.name, color: p.color, team: p.team, k: p.kills, d: p.deaths, sc: Math.floor(p.score), bot: !!p.bot, cos: p.cos };
  }

  addPlayer(id, name, color, cos) {
    const p = this.record(id, name, color);
    p.cos = sanitizeCos(cos);
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
    this.balanceBots();
  }

  // "Fill with bots": add bots up to the fill size, and drop one each time a real player joins.
  balanceBots() {
    if (!this.botFill) return;
    const all = [...this.players.values()];
    const humans = all.filter((p) => !p.bot).length;
    const bots = all.filter((p) => p.bot);
    const want = Math.max(0, this.botFill - humans);
    for (let i = bots.length; i < want; i++) this.addBot('normal');
    for (let i = want; i < bots.length; i++) this.removePlayer(bots[bots.length - 1 - (i - want)].id);
  }

  addBot(difficulty = 'normal') {
    const id = 'b' + ++this.botCount;
    const used = new Set([...this.players.values()].map((p) => p.name));
    const base = BOT_NAMES.find((n) => !used.has('[BOT] ' + n)) || 'Bot' + this.botCount;
    const p = this.record(id, '[BOT] ' + base, COLORS[(Math.random() * COLORS.length) | 0]);
    p.bot = new Bot(this, p, difficulty);
    p.cos = randomCos();
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
    this.dropFlagsOf(p);
    this.players.delete(id);
    this.broadcast({ t: 'pleave', id, name: p.name });
    if (this.jugg === id) this.jugg = null;
    if (this.bountyId === id) { this.bountyId = null; this.updateBounty(); }
    this.checkInfectionEnd();
    this.checkLmsEnd();
    if (!p.bot) this.balanceBots(); // a real player left: a bot takes the slot
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
    if (this.s.mode === 'rotation') return [this.rotW, 'knife'];
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
    const start = this.mode.ammoStart; // One in the Chamber: a single bullet per life
    if (p.bot) { p.bot.spawn(s, l); if (start) p.bot.ammo = start; }
    else this.sendTo(p.id, { t: 'spawn', p: [s.x, s.y, s.z], yaw: s.yaw, hp: p.hp, l, team: p.team, ammo: start && l ? { [l[0]]: start } : null });
  }

  // ---------- Messages ----------

  handle(id, m) {
    const p = this.players.get(id);
    if (!p) return;
    switch (m.t) {
      case 'st':
        // q is a counter: the position channel is unordered, so ignore anything older than we have.
        if (typeof m.q === 'number') { if (m.q <= (p.lastQ || 0)) break; p.lastQ = m.q; }
        if (p.alive && Array.isArray(m.p)) p.st = [m.p[0], m.p[1], m.p[2], m.y, m.pi, m.w, m.c ? 1 : 0, m.a | 0];
        break;
      case 'shot': case 'proj': case 'boom': case 'fx':
        this.broadcast({ ...m, id }, id);
        break;
      case 'hit':
        this.hit(p, m);
        break;
      case 'chat': { // party chat: plain text, max 100 chars, at most ~2 messages a second each
        const now = Date.now();
        if (now - (p.lastChat || 0) < 450) break;
        const text = String(m.text || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 100);
        if (!text) break;
        p.lastChat = now;
        this.broadcast({ t: 'chat', id, name: p.name, color: p.color, text });
        break;
      }
      case 'cos': // changed cosmetics mid-lobby
        p.cos = sanitizeCos(m.c);
        this.broadcast({ t: 'pcos', id, c: p.cos });
        break;
    }
  }

  hit(attacker, m) {
    if (this.phase !== 'playing') return;
    const v = this.players.get(m.v);
    if (!v || !v.alive) return;
    const w = WEAPONS[m.w];
    const explosive = ['gl', 'frag', 'sticky', 'rocket', 'tknife', 'vortex'].includes(m.w);
    if (!attacker.alive && !explosive) return;
    if (v !== attacker && !this.hostile(attacker, v) && !(this.s.friendlyFire && this.mode.redBlue)) return;
    if (this.s.headshotsOnly && w && w.type === 'gun' && !m.head && v !== attacker) return;
    const now = Date.now();
    if (now < v.protectUntil && v !== attacker) return;
    // Never accept more than the weapon can deal in one hit (keeps modded clients in line).
    let dmg = Math.max(0, Math.min(maxHitDmg(w), Number(m.dmg) || 0));
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
      case 'dom':
      case 'hardpoint': // personal score is kills; the team score comes from the zone(s)
        attacker.score = attacker.kills;
        break;
      case 'ctf': // captures win; kills still count for personal score
        this.dropFlagsOf(v);
        if (enemyKill) attacker.score += 1;
        break;
      case 'bounty': {
        if (enemyKill) {
          const worth = v.id === this.bountyId ? 3 : 1;
          attacker.score += worth;
          if (worth > 1) this.broadcast({ t: 'notice', text: `${attacker.name.toUpperCase()} CLAIMED THE BOUNTY (+3)` });
          if (attacker.score >= this.s.scoreLimit) { this.endMatch(); break; }
        }
        this.updateBounty();
        break;
      }
      case 'killconfirmed': // the point comes from picking up the tag (see tickTags)
        if (enemyKill) this.tags.push({ id: ++this.tagId, x: v.st[0], y: v.st[1], z: v.st[2], team: v.team, until: Date.now() + 30000 });
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
    if (this.mode.noReload && enemyKill && attacker.alive && this.phase === 'playing') this.giveAmmo(attacker, 1);
  }

  // One in the Chamber: a kill earns a bullet.
  giveAmmo(p, n) {
    if (p.bot) p.bot.addAmmo(n);
    else this.sendTo(p.id, { t: 'ammo', add: n });
  }

  // Kill Confirmed: walking over a tag scores it (enemy tag) or denies it (your team's).
  tickTags(now) {
    this.tags = this.tags.filter((t) => t.until > now);
    for (const p of this.players.values()) {
      if (!p.alive || this.phase !== 'playing') continue;
      for (const t of this.tags) {
        if (t.taken || Math.hypot(p.st[0] - t.x, p.st[2] - t.z) > 1.4 || Math.abs(p.st[1] - t.y) > 2) continue;
        t.taken = true;
        this.sendTo(p.id, { t: 'tagc' });
        if (p.team !== t.team) {
          this.teamScore[p.team]++;
          p.score++;
          this.sendTo(p.id, { t: 'notice', text: 'KILL CONFIRMED' });
          if (this.teamScore[p.team] >= this.s.scoreLimit) this.endMatch();
        } else {
          this.sendTo(p.id, { t: 'notice', text: 'KILL DENIED' });
        }
      }
    }
    this.tags = this.tags.filter((t) => !t.taken);
  }

  tickRotation(now) {
    if (now < this.rotUntil) return;
    this.rotW = this.pickRotation();
    this.rotUntil = now + ROTATION_SECONDS * 1000;
    this.broadcast({ t: 'notice', text: `NEW WEAPON: ${WEAPONS[this.rotW].name.toUpperCase()}` });
    for (const p of this.players.values()) if (p.alive) this.sendTo(p.id, { t: 'loadout', l: this.loadoutFor(p) });
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

  // Domination: the map's main hill plus the two hills furthest apart, lettered from the red
  // side (-x) to the blue side (+x).
  makeDomZones() {
    const hills = MAPS[this.s.map].hills;
    let pick = hills.slice(0, 3);
    if (hills.length > 3) {
      let best = null, bestD = -1;
      for (let i = 1; i < hills.length; i++) for (let j = i + 1; j < hills.length; j++) {
        const d = Math.hypot(hills[i][0] - hills[j][0], hills[i][2] - hills[j][2]);
        if (d > bestD) { bestD = d; best = [hills[i], hills[j]]; }
      }
      pick = [hills[0], ...best];
    }
    pick.sort((a, b) => a[0] - b[0] || a[2] - b[2]);
    return pick.map(([x, y, z, r], i) => ({ name: 'ABC'[i], x, y, z, r: Math.max(2.6, Math.min(4, r)), owner: 0, prog: 0 }));
  }

  tickDom(dt) {
    const CAPTURE_S = 5; // seconds for one player to flip a zone from neutral
    for (const zn of this.dom) {
      const inside = [...this.players.values()].filter((p) => p.alive && (p.team === 1 || p.team === 2) &&
        Math.hypot(p.st[0] - zn.x, p.st[2] - zn.z) <= zn.r && p.st[1] >= zn.y - 0.6 && p.st[1] <= zn.y + 2.5);
      const teams = new Set(inside.map((p) => p.team));
      zn.contested = teams.size > 1;
      if (teams.size !== 1) continue;
      const t = inside[0].team, dir = t === 1 ? -1 : 1;
      const speed = Math.min(2, 1 + 0.5 * (inside.length - 1)) * dt / CAPTURE_S;
      zn.prog = Math.max(-1, Math.min(1, zn.prog + dir * speed));
      if (zn.owner && zn.owner !== t && zn.prog * (zn.owner === 1 ? -1 : 1) <= 0) zn.owner = 0; // neutralised
      if (!zn.owner && Math.abs(zn.prog) >= 1) {
        zn.owner = t;
        for (const p of inside) p.score += 5;
        this.broadcast({ t: 'notice', text: `${t === 1 ? 'RED' : 'BLUE'} CAPTURED ${zn.name}` });
      }
    }
    // Every owned zone scores one point per second.
    this.domAcc += dt;
    while (this.domAcc >= 1) {
      this.domAcc -= 1;
      for (const zn of this.dom) if (zn.owner) this.teamScore[zn.owner] += 1;
    }
    if (this.teamScore[1] >= this.s.scoreLimit || this.teamScore[2] >= this.s.scoreLimit) this.endMatch();
  }

  // Domination goal for a bot: the nearest zone its team doesn't own yet (or a random one).
  domGoal(p) {
    if (!this.dom) return null;
    const want = this.dom.filter((z) => z.owner !== p.team || z.contested);
    const pool = want.length ? want : this.dom;
    let best = null, bestD = Infinity;
    for (const z of pool) { const d = Math.hypot(z.x - p.st[0], z.z - p.st[2]); if (d < bestD) { bestD = d; best = z; } }
    return best;
  }

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
      Object.assign(this.s, PHYS_DEFAULTS, { health: 100, headshotsOnly: false }, MODES[mode].preset);
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
        if (p.alive && p.hp < max && now - p.lastDmg > 5000 && this.s.mode !== 'vampire' && !this.mode.noRegen) p.hp = Math.min(max, p.hp + max * 0.25 * rdt);
      }
      if (this.s.mode === 'infection' && !this.infected && this.infectAt && now >= this.infectAt) this.startInfection();
      if (this.mode.hill) this.tickHill(rdt, now);
      if (this.s.mode === 'killconfirmed') this.tickTags(now);
      if (this.s.mode === 'rotation') this.tickRotation(now);
      if (this.flags) this.tickFlags(now);
      if (this.dom && this.phase === 'playing') this.tickDom(rdt);
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
    const msg = { t: 'snap', tm: now, s, tl:this.phase === 'playing' ? Math.max(0, Math.ceil((this.endsAt - now) / 1000)) : 0 };
    if (this.mode.redBlue) msg.ts = [Math.floor(this.teamScore[1]), Math.floor(this.teamScore[2])];
    if (this.s.mode === 'infection') msg.inf = this.infected ? 0 : Math.max(0, Math.ceil((this.infectAt - now) / 1000));
    if (this.s.mode === 'killconfirmed') msg.tg = this.tags.map((t) => [t.id, r2(t.x), r2(t.y), r2(t.z), t.team]);
    if (this.s.mode === 'rotation') msg.rot = [this.rotW, Math.max(0, Math.ceil((this.rotUntil - now) / 1000))];
    // CTF: [team, x, y, z, carrierId, state (0 home / 1 carried / 2 dropped), homeX, homeY, homeZ]
    if (this.flags) msg.fl = [1, 2].map((t) => { const f = this.flags[t]; return [t, r2(f.pos.x), r2(f.pos.y), r2(f.pos.z), f.carrier, f.carrier ? 1 : f.dropped ? 2 : 0, r2(f.home.x), r2(f.home.y), r2(f.home.z)]; });
    // Domination: [name, x, y, z, r, owner (0 none / 1 red / 2 blue), progress -100 (red)..100 (blue), contested]
    if (this.dom) msg.dom = this.dom.map((z) => [z.name, r2(z.x), r2(z.y), r2(z.z), z.r, z.owner, Math.round(z.prog * 100), z.contested ? 1 : 0]);
    const hill = this.currentHill();
    if (hill) msg.z =[...hill, this.hillState, this.hillHolder, Math.max(0, Math.ceil((this.hillUntil - now) / 1000))];
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
