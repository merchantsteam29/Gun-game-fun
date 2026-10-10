import { spawns, setMapData, MAP_ORDER, MAPS } from './maps.js';
import { phys, raycast } from './physics.js';
import { WEAPONS, GUNGAME_LADDER, SLOTS } from './weapons.js';
import { WEAPON_RULES, ruleLoadout, cleanRules } from './rulesets.js';
import { NavGrid } from './nav.js';
import { Bot, BOT_NAMES } from './bot.js';
import { COLORS } from './util.js';
import { sanitizeCos, randomCos } from './missions.js';
import { cleanModMap, randomMods } from './mods.js';
import { roles } from './roles.js';
import { APP_VERSION } from './version.js';
import { moderation } from './moderation.js';

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
  blades: { name: 'Blade Party', short: 'BLADES', teams: false, score: 20, time: 8, loadout: ['katana', 'axe', 'knife', 'tknife'], preset: { moveSpeed: 1.25, jump: 1.15 }, desc: 'Melee and throwing knives only. Everyone moves faster.' },
  boom: { name: 'Boom Town', short: 'BOOM', teams: false, score: 25, time: 8, loadout: ['rocket', 'gl', 'bat', 'sticky'], desc: 'Launchers, stickies and a bat. Mind the splash.' },
  roulette: { name: 'Roulette', short: 'ROULETTE', teams: false, score: 25, time: 10, desc: 'A random loadout every time you spawn.' },
  vampire: { name: 'Vampire', short: 'VAMPIRE', teams: false, score: 25, time: 10, desc: 'No health regen. Damage you deal heals you, and kills heal more.' },
  killconfirmed: { name: 'Kill Confirmed', short: 'KILL CONFIRMED', teams: true, redBlue: true, score: 40, time: 10, desc: 'Red vs Blue. Every kill drops a dog tag: grab enemy tags to score, grab your team’s to deny the point.' },
  oitc: { name: 'One in the Chamber', short: 'OITC', teams: false, score: 20, time: 10, loadout: ['revolver', 'knife'], instakill: true, noReload: true, ammoStart: 1, desc: 'One bullet that kills in one hit, and no reloading. Every kill gives you another bullet. Miss and it’s knife time.' },
  rotation: { name: 'Weapon Rotation', short: 'ROTATION', teams: false, score: 25, time: 10, desc: 'Everyone gets the same random weapon, and it changes every 40 seconds.' },
  ctf: { name: 'Capture the Flag', short: 'CTF', teams: true, redBlue: true, score: 3, time: 12, desc: 'Red vs Blue. Grab the enemy flag and bring it to your base while your own flag is home. Drop it if you die.' },
  bounty: { name: 'Bounty Hunter', short: 'BOUNTY', teams: false, score: 30, time: 10, desc: 'Free-for-all. Whoever is in the lead has a bounty (shown in gold): killing them is worth 3 points.' },
  zombies: { name: 'Zombie Survival', short: 'ZOMBIES', teams: true, coop: true, score: 0, time: 0, desc: 'Co-op. Hold out against waves of zombies that get bigger, tougher and faster. Downed players come back when the wave is cleared. Every 5th wave brings a Brute.' },
  dom: { name: 'Domination', short: 'DOMINATION', teams: true, redBlue: true, dom: true, score: 200, time: 10, desc: 'Red vs Blue over three zones (A, B, C). Stand in a zone with only your team to capture it; every zone you own scores a point per second.' },
};
// Game Night event only (never in the mode pickers): started by the Game Night server's host on schedule.
MODES.br = { name: 'Battle Royale', short: 'BATTLE ROYALE', teams: false, br: true, event: true, score: 0, time: 8, noRegen: true, loadout: ['pistol', 'knife'],
  desc: 'Game Night event. One life, everyone starts with a pistol. Loot guns, health and ammo, stay inside the circle as the storm closes in. Last one standing wins.' };
MODES.tourney = { name: 'Tournament', short: 'TOURNAMENT', teams: false, event: true, score: 15, time: 5,
  desc: 'Game Night event. Free-for-all rounds: the top half of each round go through, until two are left for a 1v1 final. Win it to be the Game Night champion.' };
export const TOURNEY_MIN = 4; // bots fill in up to this many players
export const BR_MAPS = ['town', 'arctic', 'neonstreets', 'castle', 'yard'];
// Storm: [seconds holding, seconds shrinking, radius as a share of the map's size afterwards, damage per second outside]
const BR_STAGES = [[50, 40, 0.62, 4], [30, 35, 0.36, 7], [25, 30, 0.18, 11], [20, 30, 0.06, 16], [15, 25, 0, 24]];
const BR_LOOT = ['ar', 'carbine', 'br', 'burst', 'smg', 'pdw', 'vector', 'lmg', 'dmr', 'sniper', 'shotgun', 'autoshot', 'slug', 'doublebarrel', 'crossbow', 'flamethrower', 'handcannon', 'autorev'];
const BR_RARE = ['railgun', 'minigun', 'rocket', 'amr', 'gl'];
// Single-player only (main menu → Practice Range): no timer, no score limit, target dummies.
MODES.practice = { name: 'Practice Range', short: 'PRACTICE', teams: false, practice: true, score: 0, time: 0, desc: 'Solo target practice with every weapon.' };
export const MODE_ORDER = ['ffa', 'tdm', 'gungame', 'koth', 'infection', 'ctf', 'dom', 'hardpoint', 'killconfirmed', 'juggernaut', 'bounty', 'lms', 'oitc',
  'instagib', 'rotation', 'blades', 'boom', 'roulette', 'vampire', 'zombies'];
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
// ---------- Anti-cheat (host side) ----------
// Movement and aim are client-side, so the host can't stop every cheat, but it can refuse what's
// clearly impossible and tell staff. Generous limits (lag bunches messages up) so nobody normal
// gets caught: shooting faster than the gun can, moving faster than the fastest slide, melee
// from across the room, and a pattern of hits through solid walls.
const AC = {
  rateSlack: 0.55,     // allow shots this much closer together than the gun's fire rate (lag, attachments)
  speedMax: 24,        // m/s horizontal over a second (times move speed and game speed rules)
  teleport: 16,        // m in a single position update
  meleeExtra: 2.5,     // m beyond a melee weapon's reach
  strikes: 3,          // strikes before staff get a report
};
function rayBlocked(ax, ay, az, bx, by, bz) {
  const dx = bx - ax, dy = by - ay, dz = bz - az, len = Math.hypot(dx, dy, dz);
  if (len < 0.5) return false;
  const hit = raycast(ax, ay, az, dx / len, dy / len, dz / len, len - 0.4);
  return !!hit && hit.mat !== 'invisible'; // invisible walls (stop you falling off docks) don't block shots
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
// End of match: MVP card first, then a vote on the next map (3 random maps), then the winner.
const MVP_MS = 4500, VOTE_MS = 12000, RESULT_MS = 2500;
const TICK_MS = 50;
const HILL_SECONDS = 60;
const INFECT_DELAY_MS = 10000;
// Zombie Survival
const Z_FIRST_MS = 10000;   // before wave 1
const Z_BREAK_MS = 15000;   // between waves
const Z_POOL = 24;          // zombie records are reused, never more than this
const Z_NAMES = ['Walker', 'Shambler', 'Biter', 'Lurker', 'Crawler', 'Rotter', 'Ghoul', 'Husk', 'Stray', 'Gnasher'];

export function defaultSettings(mode = 'ffa', map = 'warehouse') {
  return {
    mode, map, rotate: true,
    scoreLimit: MODES[mode].score, timeLimit: MODES[mode].time,
    health: 100, respawn: 3, infiniteAmmo: false, headshotsOnly: false, friendlyFire: false, pickups: true, oneShot: false, weapons: 'any', rulesName: '',
    ...PHYS_DEFAULTS, ...MODES[mode].preset,
  };
}

// Map pickups (on in the standard modes; the host can turn them off). Placed on the map's hills:
// the power weapon on the main one, health and ammo on the others.
// Explosive barrels and breakable crates, scattered on open ground each match (not in practice).
const PROP_HP = { barrel: 35, crate: 25 };
const BARREL_R = 5, BARREL_DMG = 110;
const PICKUP_MODES = ['br', 'zombies', 'ffa', 'tdm', 'koth', 'ctf', 'dom', 'hardpoint', 'killconfirmed', 'bounty', 'lms'];
export const POWER_WEAPONS = ['railgun', 'minigun', 'rocket', 'amr'];
const PICKUP = {
  hp: { respawn: 20000, first: 0 },
  ammo: { respawn: 25000, first: 0 },
  power: { respawn: 90000, first: 30000 },
};
const PICKUP_HEAL = 50;

// Authoritative game state that runs inside the lobby creator's browser.
// Movement and aiming are client-side; health, kills, spawns, modes and bots live here.
export class HostLogic {
  constructor(sendTo, broadcast, opts = {}) {
    this.rawSend = sendTo;
    this.broadcast = broadcast;
    this.onKick = null;
    this.onFlag = null; // (player, details) suspicious stats: main.js files an auto-report
    this.players = new Map();
    this.specs = new Map(); // staff spectating: get every update but aren't players
    this.s = defaultSettings(MODES[opts.mode] ? opts.mode : 'ffa', MAPS[opts.map] ? opts.map : MAP_ORDER[0]);
    if (opts.gn) this.s.gn = true; // Game Night server (double XP for players while it's live)
    if (opts.war && opts.war.a && opts.war.b) this.s.war = { a: String(opts.war.a).slice(0, 5), b: String(opts.war.b).slice(0, 5) }; // clan war: [a] red vs [b] blue, members only
    if (opts.ranked) this.s.ranked = true; // ranked server: standard rules, SR on (ranked.js)
    if (opts.rules) Object.assign(this.s, cleanRules(opts.rules), { rulesName: String(opts.rules.rulesName || '').slice(0, 24) }); // custom rules preset
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
    this.firstBlood = false;
    this.vote = null; // end-of-match map vote (see endMatch)
    this.mvp = null;
    this.endsAt = this.s.timeLimit > 0 ? Date.now() + this.s.timeLimit * 60000 : Infinity; // 0 = no timer (practice)
    this.restartAt = 0;
    this.endTitle = '';
    this.teamScore = [0, 0, 0];
    this.hillIdx = 0;
    this.hillUntil = Date.now() + HILL_SECONDS * 1000;
    this.hillState = 0; // 0 neutral, 1 held, 2 contested
    this.setupPickups();
    this.setupProps();
    this.hillHolder = null;
    this.infectAt = this.s.mode === 'infection' ? Date.now() + INFECT_DELAY_MS : 0;
    this.infected = false;
    // Zombie Survival: wave number, zombies still to spawn this wave, and the break before the next one.
    this.zw = this.s.mode === 'zombies' ? { wave: 0, toSpawn: 0, breakUntil: Date.now() + Z_FIRST_MS, spawnT: 0 } : null;
    this.brZone = this.mode.br ? this.makeStorm() : null;
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
      hp: 100, alive: false, st: [0, -50, 0, 0, 0, 'ar', 0, 0], lastDmg: 0, respawnAt: 0, protectUntil: 0, bot, joinedAt: Date.now(),
    };
  }

  info(p) {
    return { id: p.id, name: p.name, color: p.color, team: p.team, k: p.kills, d: p.deaths, sc: Math.floor(p.score), bot: !!p.bot || !!p.dummy, z: p.zombie ? 1 : 0, cos: p.cos, mods: p.mods || {}, role: p.role || null, gt: p.tag || null };
  }

  addPlayer(id, name, color, cos) {
    const p = this.record(id, name, color);
    p.cos = sanitizeCos(cos);
    if (this.s.war && !this.warTeam(p) && id !== 'host') { // clan wars: only the two clans
      this.rawSend(id, { t: 'kicked', reason: `This is a clan war: only [${this.s.war.a}] and [${this.s.war.b}] members can join.` });
      if (this.onKick) this.onKick(id);
      return;
    }
    p.team = this.autoTeam(p);
    this.players.set(id, p);
    // Names of the owner and moderators are only for them: whoever uses one has a few seconds to
    // prove it (the 'staff' message) before being renamed.
    if (roles.reserved(p.name)) {
      setTimeout(() => {
        if (this.players.get(id) !== p || p.role) return;
        p.name = 'Imposter' + ((Math.random() * 900 + 100) | 0);
        this.broadcast({ t: 'pname', id, name: p.name });
      }, 6000);
    }
    this.sendTo(id, {
      t: 'welcome', id, settings: this.s, v: APP_VERSION,
      players: [...this.players.values()].map((q) => this.info(q)),
    });
    this.broadcast({ t: 'pjoin', ...this.info(p) }, id);
    if (this.phase !== 'playing') this.sendTo(id, this.endMsg());
    else if (this.s.mode === 'lms' || this.mode.br || this.tour) this.sendTo(id, { t: 'notice', text: this.tour ? 'TOURNAMENT IN PROGRESS · SPECTATING' : 'ROUND IN PROGRESS · SPECTATING' });
    else this.spawn(p);
    this.balanceBots();
  }

  // "Fill with bots": add bots up to the fill size, and drop one each time a real player joins.
  balanceBots() {
    if (!this.botFill || this.tour) return; // the tournament's line-up is set when it starts
    const all = [...this.players.values()];
    const humans = all.filter((p) => !p.bot).length;
    const bots = all.filter((p) => p.bot && !p.zombie);
    const want = Math.max(0, this.botFill - humans);
    for (let i = bots.length; i < want; i++) this.addBot('auto'); // fill bots follow how the players are doing
    for (let i = want; i < bots.length; i++) this.removePlayer(bots[bots.length - 1 - (i - want)].id);
  }

  addBot(difficulty = 'normal') {
    const id = 'b' + ++this.botCount;
    const used = new Set([...this.players.values()].map((p) => p.name));
    const base = BOT_NAMES.find((n) => !used.has('[BOT] ' + n)) || 'Bot' + this.botCount;
    const p = this.record(id, '[BOT] ' + base, COLORS[(Math.random() * COLORS.length) | 0]);
    p.bot = new Bot(this, p, difficulty);
    p.cos = randomCos();
    p.mods = {}; // bots get random attachments (looks only)
    for (const w of SLOTS[0].concat(SLOTS[1])) { const m = randomMods(w); if (m) p.mods[w] = m; }
    p.team = this.autoTeam(p);
    this.players.set(id, p);
    this.ensureNav();
    this.broadcast({ t: 'pjoin', ...this.info(p) });
    if (this.phase === 'playing' && this.s.mode !== 'lms' && !this.mode.br && !this.tour) this.spawn(p);
    return id;
  }

  // Staff can watch a match invisibly. They prove who they are when connecting (signed lobby code);
  // anyone else asking to spectate is turned away.
  async addSpectator(id, proof) {
    const r = typeof proof === 'string' ? await roles.check(proof, this.code, 'spec') : null;
    if (!r) { this.rawSend(id, { t: 'kicked' }); if (this.onKick) this.onKick(id); return; }
    this.specs.set(id, { id, name: r.tag, role: r.role, spec: true });
    this.sendTo(id, { t: 'welcome', id, spec: true, settings: this.s, players: [...this.players.values()].map((q) => this.info(q)) });
    if (this.phase !== 'playing') this.sendTo(id, this.endMsg());
  }
  removePlayer(id) {
    if (this.specs.delete(id)) return;
    const p = this.players.get(id);
    if (!p) return;
    this.dropFlagsOf(p);
    this.players.delete(id);
    this.broadcast({ t: 'pleave', id, name: p.name });
    if (this.jugg === id) this.jugg = null;
    if (this.bountyId === id) { this.bountyId = null; this.updateBounty(); }
    this.checkInfectionEnd();
    this.checkLmsEnd();
    this.checkZombiesEnd();
    this.checkBrEnd();
    if (this.tour && this.tour.ids.delete(id) && this.tour.ids.size <= 1 && this.phase === 'playing') this.endMatch(); // last one left wins
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

  // Clan war side: 1 for clan a, 2 for clan b, 0 for anyone else.
  warTeam(p) {
    const w = this.s.war, c = p.cos && p.cos.clan;
    return !w || !c ? 0 : c === w.a ? 1 : c === w.b ? 2 : 0;
  }

  autoTeam(p) {
    if (this.s.war && this.warTeam(p)) return this.warTeam(p);
    if (this.mode.redBlue) {
      let red = 0, blue = 0;
      for (const q of this.players.values()) if (q !== p) { if (q.team === 1) red++; else if (q.team === 2) blue++; }
      return red <= blue ? 1 : 2;
    }
    if (this.s.mode === 'infection') return this.infected ? 2 : 1;
    if (this.s.mode === 'zombies') return 1;
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
    if (p.zombie) return ['claws'];
    if (this.s.mode === 'juggernaut' && p.id === this.jugg) return JUGG_LOADOUT;
    if (this.s.mode === 'roulette') return SLOTS.map((opts) => opts[(Math.random() * opts.length) | 0]);
    if (this.s.mode === 'rotation') return [this.rotW, 'knife'];
    // Custom weapon rule (rulesets.js), in modes where players normally pick their own loadout.
    if (!this.mode.loadout && this.s.weapons && this.s.weapons !== 'any') {
      if (this.s.weapons === 'random') return SLOTS.map((opts) => opts[(Math.random() * opts.length) | 0]);
      const l = ruleLoadout(this.s.weapons);
      if (l) return l;
    }
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
    if (p.zombie) return Math.round(100 * (0.6 + 0.12 * ((this.zw && this.zw.wave) || 1)) * (p.brute ? 7 : 1)); // tougher every wave
    return Math.round(this.s.health * k);
  }

  spawn(p) {
    if (p.dummy) { // practice target: back at its own spot, full health
      p.alive = true;
      p.hp = this.maxHp(p);
      p.st = [p.home.x, p.home.y, p.home.z, p.home.yaw, 0, 'pan', 0, 0];
      return;
    }
    const s = this.pickSpawn(p);
    p.alive = true;
    p.hp = this.maxHp(p);
    p.st[0] = s.x; p.st[1] = s.y; p.st[2] = s.z;
    p.protectUntil = Date.now() + PROTECT_MS;
    p.spawnedAt = Date.now(); // anti-cheat: the jump to the spawn point isn't a teleport
    p.acPos = null;
    const l = this.loadoutFor(p);
    const start = this.mode.ammoStart; // One in the Chamber: a single bullet per life
    if (p.bot) { p.bot.spawn(s, l); if (start) p.bot.ammo = start; }
    else this.sendTo(p.id, { t: 'spawn', p: [s.x, s.y, s.z], yaw: s.yaw, hp: p.hp, l, team: p.team, ammo: start && l ? { [l[0]]: start } : null });
  }

  // ---------- Messages ----------

  handle(id, m) {
    let p = this.players.get(id);
    if (!p) {
      const sp = this.specs.get(id); // spectating staff: moderation tools only
      if (!sp || !/^mod/.test(m.t)) return;
      p = sp;
    }
    if (p.frozen && ['st', 'shot', 'proj', 'boom', 'fx', 'hit'].includes(m.t)) return; // frozen by staff
    switch (m.t) {
      case 'st':
        // q is a counter: the position channel is unordered, so ignore anything older than we have.
        if (typeof m.q === 'number') { if (m.q <= (p.lastQ || 0)) break; p.lastQ = m.q; }
        if (p.alive && Array.isArray(m.p)) { this.checkMove(p, m.p); p.st = [m.p[0], m.p[1], m.p[2], m.y, m.pi, m.w, m.c ? 1 : 0, m.a | 0]; }
        break;
      case 'shot':
        if (!this.checkRate(p, m.w)) break; // faster than the gun can fire: dropped
        this.broadcast({ ...m, id }, id);
        break;
      case 'proj': case 'boom': case 'fx':
        this.broadcast({ ...m, id }, id);
        // Explosions also hit barrels and crates.
        if (m.t === 'boom' && Array.isArray(m.p) && this.props && this.props.length) {
          const W = WEAPONS[m.k];
          if (W && W.radius && W.splash && !W.smoke && !W.flash) {
            for (const o of [...this.props]) {
              const d = Math.hypot(o.x - m.p[0], o.y + 0.5 - m.p[1], o.z - m.p[2]);
              if (d < W.radius) this.damageProp(o, W.splash * (1 - d / W.radius) + 10, p);
            }
          }
        }
        break;
      case 'prop': { // shot a barrel / crate
        const pr = this.props && this.props.find((o) => o.id === m.id);
        if (!pr || !p.alive || Math.hypot(p.st[0] - pr.x, p.st[2] - pr.z) > 200) break;
        const now = Date.now();
        if (now - (p.lastProp || 0) < 40) break; // a few per shot at most
        p.lastProp = now;
        this.damageProp(pr, Math.min(150, Number(m.dmg) || 0), p);
        break;
      }
      case 'hit':
        this.hit(p, m);
        break;
      case 'vote': // next-map vote at the end of a match
        this.castVote(id, Number(m.i));
        break;
      case 'vc': { // Game Night voice: "I'm in voice" (verified gamertags only, not muted players)
        const now = Date.now();
        if (!this.s.gn || !p.tag || p.muted || now - (p.lastVc || 0) < 1500) break;
        p.lastVc = now;
        this.broadcast({ t: 'vc', id, gt: p.tag, in: !!m.in });
        break;
      }
      case 'chat': { // party chat: plain text, max 100 chars, at most ~2 messages a second each
        const now = Date.now();
        if (p.muted || now - (p.lastChat || 0) < 450) break;
        if (!p.role && (this.chatLock || (this.chatSlow && now - (p.lastChat || 0) < 5000))) {
          this.sendTo(id, { t: 'notice', text: this.chatLock ? 'Chat is locked by staff' : 'Slow mode: wait a few seconds' });
          break;
        }
        const text = String(m.text || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 100);
        if (!text) break;
        p.lastChat = now;
        // Spam: 6 messages in 8 seconds, or the same message 3 times in a row → muted for the match.
        if (!p.role) {
          p.chatTimes = (p.chatTimes || []).filter((x) => now - x < 8000).concat(now);
          p.repeat = text === p.lastText ? (p.repeat || 1) + 1 : 1;
          p.lastText = text;
          if (p.chatTimes.length >= 6 || p.repeat >= 3) {
            p.muted = true;
            this.broadcast({ t: 'pmute', id, muted: true });
            this.broadcast({ t: 'notice', text: `${p.name} was auto-muted for spam` });
            if (this.onFlag) this.onFlag(p, `Chat spam: ${p.repeat >= 3 ? 'same message 3 times' : '6 messages in 8 s'} · "${text.slice(0, 60)}"`);
            break;
          }
        }
        this.broadcast({ t: 'chat', id, name: p.name, color: p.color, text, role: p.role || null });
        break;
      }
      case 'ident': // signed proof of this player's gamertag: lets the host enforce bans and mutes
        if (typeof m.proof !== 'string' || p.tag || p.bot) break;
        this.checkIdent(p, m.proof);
        break;
      case 'modchat': { // staff: lock lobby chat, or slow mode (one message per 5 s)
        if (!p.role) break;
        if (m.op === 'lock') this.chatLock = !this.chatLock;
        else if (m.op === 'slow') this.chatSlow = !this.chatSlow;
        else break;
        this.broadcast({ t: 'chatmode', lock: !!this.chatLock, slow: !!this.chatSlow });
        this.broadcast({ t: 'notice', text: m.op === 'lock' ? (this.chatLock ? 'Chat locked by staff' : 'Chat unlocked') : (this.chatSlow ? 'Slow mode on: 1 message per 5 s' : 'Slow mode off') });
        break;
      }
      case 'staff': // signed proof that this player is the owner / a moderator (see roles.js)
        if (typeof m.proof !== 'string' || p.role) break;
        roles.check(m.proof, this.code, id).then((r) => {
          if (!r || this.players.get(id) !== p) return;
          p.role = r.role;
          p.name = r.tag;
          this.broadcast({ t: 'prole', id, role: p.role, name: p.name });
        });
        break;
      case 'modwarn': case 'modrename': { // pop-up warning / rename in this match
        const v = this.players.get(m.id);
        const rank = (q) => (q.role === 'owner' ? 2 : q.role === 'mod' ? 1 : 0);
        if (!v || v === p || !p.role || rank(p) <= rank(v) || v.bot) break;
        if (m.t === 'modwarn') {
          const reason = String(m.reason || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 140);
          if (reason) this.sendTo(v.id, { t: 'warned', by: p.name, role: p.role, reason });
        } else {
          const name = String(m.name || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 16);
          if (!name || roles.reserved(name)) break;
          const old = v.name;
          v.name = name;
          this.broadcast({ t: 'pname', id: v.id, name });
          this.broadcast({ t: 'notice', text: `${old} was renamed to ${name}` });
        }
        break;
      }
      case 'modfreeze': { // stop a player moving / shooting until unfrozen
        const v = this.players.get(m.id);
        const rank = (q) => (q.role === 'owner' ? 2 : q.role === 'mod' ? 1 : 0);
        if (!v || v === p || !p.role || rank(p) <= rank(v)) break;
        v.frozen = !v.frozen;
        const by = p.role === 'owner' ? 'the owner' : 'a moderator';
        this.sendTo(v.id, { t: 'frozen', on: v.frozen, by });
        this.broadcast({ t: 'pfrozen', id: v.id, on: v.frozen });
        this.broadcast({ t: 'notice', text: `${v.name} was ${v.frozen ? 'frozen' : 'unfrozen'} by ${by}` });
        break;
      }
      case 'modmatch': { // any staff member, even when not the host
        if (!p.role) break;
        const by = p.role === 'owner' ? 'The owner' : 'A moderator';
        if (m.op === 'end' && this.phase === 'playing') { this.broadcast({ t: 'notice', text: `${by} ended the match` }); this.endMatch(); }
        else if (m.op === 'restart') { this.startMatch(this.s.mode, this.s.map); this.broadcast({ t: 'notice', text: `${by} restarted the match` }); }
        else if (m.op === 'map' && MAPS[m.map]) { this.startMatch(this.s.mode, m.map); this.broadcast({ t: 'notice', text: `${by} changed the map to ${MAPS[m.map].name}` }); }
        break;
      }      case 'modkick': case 'modmute': { // moderator tools: staff only, and only on lower ranks
        const v = this.players.get(m.id);
        const rank = (q) => (q.role === 'owner' ? 2 : q.role === 'mod' ? 1 : 0);
        if (!v || v === p || !p.role || rank(p) <= rank(v)) break;
        const by = p.role === 'owner' ? 'the owner' : 'a moderator';
        if (m.t === 'modkick') {
          if (v.id === 'host') break; // the host's browser runs the match
          this.broadcast({ t: 'notice', text: `${v.name} was kicked by ${by}` });
          this.kick(v.id);
        } else {
          v.muted = !v.muted;
          this.broadcast({ t: 'pmute', id: v.id, muted: v.muted });
          this.sendTo(v.id, { t: 'notice', text: v.muted ? `You were muted by ${by}` : 'You can chat again' });
        }
        break;
      }
      case 'spray': { // clan spray on a wall: clan members only, one every 8 s
        const now = Date.now();
        if (!p.alive || !p.cos || !p.cos.clan || now - (p.lastSpray || 0) < 8000) break;
        if (typeof m.img !== 'string' || !/^[0-9a-f]{256}$/.test(m.img) || !Array.isArray(m.p) || !Array.isArray(m.n) || ![...m.p, ...m.n].every(Number.isFinite)) break;
        if (Math.hypot(m.p[0] - p.st[0], m.p[1] - p.st[1], m.p[2] - p.st[2]) > 8) break;
        p.lastSpray = now;
        this.broadcast({ t: 'spray', id, p: m.p.map(r2), n: m.n.map(r2), img: m.img, c: String(p.cos.clan).slice(0, 5) });
        break;
      }
      case 'ping': { // team modes only; one ping per 2.5 s, at most 4 in 15 s
        if (!this.mode.teams || !p.alive || !Array.isArray(m.p) || m.p.length !== 3 || !m.p.every(Number.isFinite)) break;
        const now = Date.now();
        p.pings = (p.pings || []).filter((t) => now - t < 15000);
        if (p.pings.length >= 4 || now - (p.pings[p.pings.length - 1] || 0) < 2500) break;
        p.pings.push(now);
        const e = typeof m.e === 'string' && this.players.get(m.e) && this.players.get(m.e).team !== p.team ? m.e : null;
        const msg = { t: 'ping', id, p: m.p.map((v) => Math.round(v * 10) / 10), e };
        for (const q of this.players.values()) if (q.team === p.team && !q.bot) this.sendTo(q.id, msg);
        break;
      }
      case 'mods': // weapon attachments (looks for everyone else; stats are applied on their side)
        p.mods = cleanModMap(m.m);
        this.broadcast({ t: 'pmods', id, m: p.mods }, id);
        break;
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
    const explosive = ['gl', 'frag', 'sticky', 'rocket', 'crossbow', 'harpoon', 'flare', 'tknife', 'vortex'].includes(m.w);
    if (!attacker.alive && !explosive) return;
    if (v !== attacker && !this.hostile(attacker, v) && !(this.s.friendlyFire && this.mode.redBlue)) return;
    if (this.s.headshotsOnly && w && w.type === 'gun' && !m.head && v !== attacker) return;
    const now = Date.now();
    if (now < v.protectUntil && v !== attacker) return;
    if (!this.checkHit(attacker, v, w, m, explosive, now)) return;
    // Never accept more than the weapon can deal in one hit (keeps modded clients in line).
    let dmg = Math.max(0, Math.min(maxHitDmg(w), Number(m.dmg) || 0));
    if (!dmg) return;
    if ((this.mode.instakill || this.s.oneShot) && v !== attacker) dmg = 999;
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

  // ---------- Gamertag checks ----------

  // A player proved their gamertag: remember it (shown to staff), then turn them away if they're
  // banned and mute them if they're muted — even if their own game ignores it.
  async checkIdent(p, proof) {
    const s = roles.social;
    if (!s) return;
    const b = await s.verify(proof);
    if (!b || !b.ident || b.lobby !== this.code || b.id !== p.id || Math.abs(Date.now() - Number(b.ts)) > 10 * 60000) return;
    if (this.players.get(p.id) !== p) return;
    p.tag = b.from;
    this.broadcast({ t: 'pident', id: p.id, gt: p.tag });
    const rec = await moderation.fetchRecord(p.tag);
    if (!rec || this.players.get(p.id) !== p) return;
    const ban = moderation.activeBan(rec), mute = moderation.activeMute(rec);
    if (ban && !p.role) {
      this.broadcast({ t: 'notice', text: `${p.name} is banned and was removed` });
      if (p.id === 'host') return; // can't remove the host from their own match (their game shows the ban screen)
      this.kick(p.id);
    } else if (mute && !p.muted) {
      p.muted = true;
      this.broadcast({ t: 'pmute', id: p.id, muted: true });
    }
  }

  // ---------- Practice range ----------

  // Target dummies: [name, x, z, moving side to side by this many meters (0 = still), speed]
  addDummies(list) {
    for (const [name, x, z, sway = 0, speed = 1] of list) {
      const id = 'd' + ++this.botCount;
      const p = this.record(id, name, sway ? '#ff8a1a' : '#e8edf3');
      p.dummy = true;
      p.home = { x, y: 0, z, yaw: Math.PI }; // facing the firing line (+z)
      p.sway = sway;
      p.speed = speed;
      p.phase = Math.random() * 6;
      p.cos = { hat: 'none', hair: 'none', face: 'none', back: 'none', banner: 'standard', hairColor: '#111111' };
      p.mods = {};
      this.players.set(id, p);
      this.broadcast({ t: 'pjoin', ...this.info(p) });
      this.spawn(p);
    }
  }

  tickDummies(now) {
    for (const p of this.players.values()) {
      if (!p.dummy || !p.alive || !p.sway) continue;
      const x = p.home.x + Math.sin(now / 1000 * p.speed + p.phase) * p.sway;
      p.st = [x, p.home.y, p.home.z, p.home.yaw, 0, 'pan', 0, 2]; // flag 2: running pose
    }
  }

  // ---------- Anti-cheat ----------
  strike(p, why) {
    if (p.bot || p.dummy || this.s.mode === 'practice') return;
    p.acStrikes = (p.acStrikes || 0) + 1;
    p.acWhy = why;
    if (p.acStrikes >= AC.strikes && !p.acFlagged) {
      p.acFlagged = true;
      if (this.onFlag) this.onFlag(p, `Anti-cheat: ${why} (${p.acStrikes} times) · ${MODES[this.s.mode].name} on ${MAPS[this.s.map].name}`);
    }
  }

  // Position updates: teleports and impossible speed (checked over about a second).
  checkMove(p, pos) {
    if (p.bot) return;
    const now = Date.now();
    const last = p.acPos;
    p.acPos = { x: pos[0], z: pos[2], t: now };
    if (!last || now - (p.spawnedAt || 0) < 1500) { p.acWin = null; return; }
    const step = Math.hypot(pos[0] - last.x, pos[2] - last.z);
    if (step > AC.teleport) { this.strike(p, `teleported ${Math.round(step)} m`); p.acBlockUntil = now + 2000; return; }
    const win = p.acWin || (p.acWin = { x: last.x, z: last.z, t: last.t });
    const dt = (now - win.t) / 1000;
    if (dt < 1) return;
    const speed = Math.hypot(pos[0] - win.x, pos[2] - win.z) / dt;
    const max = AC.speedMax * Math.max(1, this.s.moveSpeed || 1) * Math.max(1, this.s.gameSpeed || 1);
    if (speed > max) { this.strike(p, `moving ${Math.round(speed)} m/s`); p.acBlockUntil = now + 1500; }
    p.acWin = { x: pos[0], z: pos[2], t: now };
  }

  // Shots: no faster than the gun's fire rate (burst guns: their burst gap), with slack.
  checkRate(p, wid) {
    const w = WEAPONS[wid];
    if (p.bot || !w || w.type !== 'gun' || !w.rate) return true;
    const now = Date.now();
    const gap = Math.min(w.rate, w.burstGap || w.rate) * AC.rateSlack;
    p.acShots = (p.acShots || []).filter((t) => now - t < 2000);
    p.acShots.push(now);
    if (p.acShots.length > 2000 / (gap * 1000) + 3) {
      if (!p.acRateT || now - p.acRateT > 2000) { p.acRateT = now; this.strike(p, `firing the ${w.name} too fast`); }
      p.acBlockUntil = now + 1000;
      return false;
    }
    return true;
  }

  // Hits: refused while blocked (just teleported / over the fire rate) and for melee from too far.
  // Gun hits through solid walls are only counted (lag makes corners messy) and reported in bulk.
  checkHit(a, v, w, m, explosive, now) {
    if (a.bot || a === v || this.s.mode === 'practice') return true;
    if (now < (a.acBlockUntil || 0)) return false;
    if (!w) return true;
    const d = Math.hypot(a.st[0] - v.st[0], a.st[1] - v.st[1], a.st[2] - v.st[2]);
    if (w.type === 'melee' && d > (w.range || 2.5) + AC.meleeExtra) { this.strike(a, `melee hit from ${d.toFixed(1)} m`); return false; }
    if (w.type === 'gun' && !explosive) {
      a.acGunHits = (a.acGunHits || 0) + 1;
      const ey = a.st[1] + (a.st[6] ? 1.1 : 1.55);
      const walls = rayBlocked(a.st[0], ey, a.st[2], v.st[0], v.st[1] + 1.1, v.st[2]) && rayBlocked(a.st[0], ey, a.st[2], v.st[0], v.st[1] + 1.6, v.st[2]);
      if (walls) {
        a.acWallHits = (a.acWallHits || 0) + 1;
        if (a.acWallHits >= 10 && a.acWallHits / a.acGunHits > 0.3 && !a.acWallFlagged) {
          a.acWallFlagged = true;
          if (this.onFlag) this.onFlag(a, `Anti-cheat: ${a.acWallHits} of ${a.acGunHits} hits went through walls · ${MODES[this.s.mode].name} on ${MAPS[this.s.map].name}`);
        }
      }
    }
    return true;
  }

  // Suspicious stats → an automatic report for staff (once per player per lobby). Only gun kills on
  // REAL players count (bots are easy, so racking up kills on them is normal), it needs a decent
  // sample, and modes where headshots / one-hit kills / fast kills are normal are skipped. Staff
  // and the host's own player aren't checked.
  checkFlags(p, w, head, victim) {
    const W = WEAPONS[w];
    if (!W || W.type !== 'gun' || p.flagged || p.role || p.id === 'host') return;
    if (!victim || victim.bot || victim.dummy) return;
    p.realKills = (p.realKills || 0) + 1;
    if (head) p.realHeads = (p.realHeads || 0) + 1;
    if (this.mode.instakill || this.s.oneShot || this.s.headshotsOnly || this.mode.bigHead || this.s.mode === 'gungame') return;
    if (!p.firstRealKill) p.firstRealKill = Date.now();
    const mins = Math.max(1, (Date.now() - p.joinedAt) / 60000);
    const hsRate = (p.realHeads || 0) / p.realKills, kpm = p.realKills / mins;
    const why = [];
    if (p.realKills >= 25 && hsRate >= 0.85) why.push(`${Math.round(hsRate * 100)}% headshot kills on players (${p.realHeads}/${p.realKills})`);
    if (p.realKills >= 25 && kpm >= 8) why.push(`${kpm.toFixed(1)} player kills a minute (${p.realKills} in ${mins.toFixed(1)} min)`);
    if (!why.length) return;
    p.flagged = true;
    if (this.onFlag) this.onFlag(p, `${why.join(' · ')} · ${MODES[this.s.mode].name} on ${MAPS[this.s.map].name}`);
  }
  kill(attacker, v, w, head) {
    // Auto bot difficulty: remember fights between bots and real players.
    if (attacker !== v && !attacker.zombie && !v.zombie && !v.dummy && !!attacker.bot !== !!v.bot) {
      this.botFights = (this.botFights || []).filter((f) => Date.now() - f.t < 180000);
      this.botFights.push({ t: Date.now(), human: !attacker.bot });
    }
    v.alive = false;
    v.hp = 0;
    v.deaths++;
    const enemyKill = v !== attacker && this.hostile(attacker, v);
    if (enemyKill) {
      attacker.kills++;
      attacker.streak = (attacker.streak || 0) + 1; // for the MVP card
      attacker.bestStreak = Math.max(attacker.bestStreak || 0, attacker.streak);
      if (head) attacker.heads = (attacker.heads || 0) + 1;
    }
    v.streak = 0;
    if (enemyKill && !attacker.bot) this.checkFlags(attacker, w, head, v);
    v.respawnAt = Date.now() + (v.dummy ? 1200 : this.s.respawn * 1000);
    const fb = enemyKill && !this.firstBlood; // first kill of the match (medal)
    if (fb) this.firstBlood = true;
    this.broadcast(fb ? { t: 'kill', k: attacker.id, v: v.id, w, head, fb: 1 } : { t: 'kill', k: attacker.id, v: v.id, w, head });

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
      case 'br': {
        v.respawnAt = 0; // one life
        if (enemyKill) attacker.score = attacker.kills;
        const left = this.brAlive().length;
        if (!v.dummy) this.sendTo(v.id, { t: 'notice', text: `ELIMINATED · #${left + 1}` });
        v.place = left + 1;
        this.checkBrEnd();
        break;
      }
      case 'zombies':
        v.respawnAt = 0; // zombies go back in the pool; survivors wait for the end of the wave
        if (v.zombie) { if (enemyKill) attacker.score += v.brute ? 10 : 1; }
        else if (!v.dummy) {
          this.sendTo(v.id, { t: 'notice', text: 'DOWN · BACK WHEN THE WAVE IS CLEARED' });
          this.checkZombiesEnd();
        }
        break;
      case 'practice':
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

  // ---------- Map pickups ----------
  pickupsOn() { return this.s.pickups !== false && PICKUP_MODES.includes(this.s.mode) && this.s.map !== 'range'; }

  setupPickups() {
    this.pickups = [];
    if (this.mode.br) { this.setupLoot(); return; }
    const hills = (MAPS[this.s.map] && MAPS[this.s.map].hills) || [];
    const now = Date.now();
    hills.slice(0, 5).forEach(([x, y, z], i) => {
      const kind = i === 0 ? 'power' : i % 2 ? 'hp' : 'ammo';
      // Off-center pickups sit a little to the side of the hill so they don't block it.
      this.pickups.push({ id: i, kind, x: i ? x + 1.5 : x, y, z, readyAt: now + PICKUP[kind].first, w: null });
    });
  }

  tickPickups(now) {
    if (this.phase !== 'playing' || !this.pickupsOn()) return;
    for (const k of this.pickups) {
      if (now < k.readyAt) continue;
      if (k.kind === 'power' && !k.w && !k.loot) {
        k.w = POWER_WEAPONS[(Math.random() * POWER_WEAPONS.length) | 0];
        this.broadcast({ t: 'notice', text: `POWER WEAPON: ${(WEAPONS[k.w] || {}).name || k.w} at the center` });
      }
      for (const p of this.players.values()) {
        if (!p.alive || Math.hypot(p.st[0] - k.x, p.st[2] - k.z) > 1.3 || Math.abs(p.st[1] - k.y) > 2) continue;
        if (k.kind === 'hp') {
          const max = this.maxHp(p);
          if (p.hp >= max) continue; // full health: leave it for someone who needs it
          p.hp = Math.min(max, p.hp + PICKUP_HEAL);
        }
        if (k.kind === 'power' && p.bot) p.bot.setLoadout(k.loot ? [k.w, ...(p.bot.loadout || [])].slice(0, 3) : [k.w, ...((p.bot.loadout || []).slice(1))]);
        if (!p.bot) this.sendTo(p.id, { t: 'pickup', k: k.kind, w: k.w });
        if (k.kind === 'power' && !k.loot) this.broadcast({ t: 'notice', text: `${p.name} has the ${(WEAPONS[k.w] || {}).name || k.w}` }, p.id);
        if (k.loot) { k.readyAt = Infinity; break; } // Battle Royale loot is one of a kind
        k.readyAt = now + PICKUP[k.kind].respawn;
        k.w = null;
        break;
      }
    }
  }

  // ---------- Barrels and crates ----------
  setupProps() {
    this.props = [];
    this.propId = 0;
    if (this.mode.practice || this.s.props === false || this.s.map === 'range' || !MAPS[this.s.map]) return;
    if (!this.nav) this.nav = new NavGrid(MAPS[this.s.map].bounds);
    const open = this.nav.nodes.filter((n) => n.edges.length >= 7 && n.y < 9 && n.mat !== 'invisible' && n.mat !== 'pad' && !spawns.some((s) => Math.hypot(s.x - n.x, s.z - n.z) < 4) && !(this.pickups || []).some((k) => Math.hypot(k.x - n.x, k.z - n.z) < 3));
    open.sort(() => Math.random() - 0.5);
    const picked = [];
    for (const n of open) {
      if (picked.length >= 10) break;
      if (picked.some((q) => Math.hypot(q.x - n.x, q.z - n.z) < 7)) continue;
      picked.push(n);
    }
    picked.forEach((n, i) => { const kind = i % 2 ? 'crate' : 'barrel'; this.props.push({ id: ++this.propId, kind, x: n.x, y: n.y, z: n.z, hp: PROP_HP[kind] }); });
  }
  // A prop takes damage; at zero a crate breaks and a barrel blows up (hurting anyone close, and
  // setting off other props nearby a moment later). Whoever broke it gets the credit.
  damageProp(pr, dmg, by) {
    if (!pr || pr.hp <= 0 || this.phase !== 'playing' || !(dmg > 0)) return;
    pr.hp -= dmg;
    if (pr.hp > 0) return;
    this.props = this.props.filter((x) => x !== pr);
    this.broadcast({ t: 'propbreak', id: pr.id, kind: pr.kind, p: [r2(pr.x), r2(pr.y + 0.5), r2(pr.z)] });
    if (pr.kind !== 'barrel') return;
    const cx = pr.x, cy = pr.y + 0.6, cz = pr.z, now = Date.now();
    for (const v of [...this.players.values()]) {
      if (!v.alive || v.dummy || now < v.protectUntil) continue;
      const atk = by && this.players.get(by.id) === by ? by : v;
      if (v !== atk && !this.hostile(atk, v) && !(this.s.friendlyFire && this.mode.redBlue)) continue; // teammates are safe
      const vx = v.st[0], vy = v.st[1] + 0.9, vz = v.st[2];
      const d = Math.hypot(vx - cx, vy - cy, vz - cz);
      if (d >= BARREL_R || rayBlocked(cx, cy, cz, vx, vy, vz)) continue;
      const k = 1 - d / BARREL_R;
      let hurt = Math.round(BARREL_DMG * k * (v === atk ? 0.5 : 1));
      if (!hurt) continue;
      v.hp -= hurt;
      v.lastDmg = now;
      const dl = d || 1, push = 10 * k;
      const imp = [r2(((vx - cx) / dl) * push), r2(3 + 4 * k), r2(((vz - cz) / dl) * push)];
      const dead = v.hp <= 0;
      this.sendTo(v.id, { t: 'dmg', hp: Math.max(0, Math.round(v.hp)), from: atk.id, imp }); // bots get it too
      if (v !== atk && !atk.bot) this.sendTo(atk.id, { t: 'hitc', kill: dead, head: false });
      if (dead) this.kill(atk, v, 'barrel', false);
    }
    // Chain reaction
    for (const o of [...this.props]) {
      const d = Math.hypot(o.x - cx, o.z - cz);
      if (d < BARREL_R) setTimeout(() => this.damageProp(o, 80 * (1 - d / BARREL_R) + 10, by), 140);
    }
  }

  // ---------- Battle Royale ----------
  // Loot on nav points all over the map: guns (a few rare power weapons), health and ammo.
  setupLoot() {
    if (!this.nav) this.nav = new NavGrid(MAPS[this.s.map].bounds); // bots or not, loot goes on walkable spots
    const nodes = this.nav.nodes.filter((n) => n.edges.length >= 4 && n.y < 9 && n.mat !== 'invisible');
    nodes.sort(() => Math.random() - 0.5);
    const picked = [];
    for (const n of nodes) {
      if (picked.length >= 34) break;
      if (picked.some((q) => Math.hypot(q.x - n.x, q.z - n.z) < 6)) continue; // spread out
      picked.push(n);
    }
    picked.forEach((n, i) => {
      const kind = i % 6 === 4 ? 'hp' : i % 6 === 5 ? 'ammo' : 'power';
      const w = kind === 'power' ? (Math.random() < 0.08 ? BR_RARE : BR_LOOT)[(Math.random() * (Math.random() < 0.08 ? BR_RARE : BR_LOOT).length) | 0] : null;
      this.pickups.push({ id: i, kind, x: n.x, y: n.y, z: n.z, readyAt: 0, w: kind === 'power' ? w || 'ar' : null, loot: true });
    });
  }
  makeStorm() {
    const m = MAPS[this.s.map], size = (m && m.bounds) || 30;
    const a = Math.random() * Math.PI * 2, d = Math.random() * size * 0.25;
    return { cx: Math.cos(a) * d, cz: Math.sin(a) * d, size, r: size * 1.5, from: size * 1.5, stage: -1, holdUntil: Date.now() + BR_STAGES[0][0] * 1000, shrinkUntil: 0, dps: 0 };
  }
  tickStorm(now, dt) {
    const z = this.brZone;
    if (!z.shrinkUntil && now >= z.holdUntil && z.stage < BR_STAGES.length - 1) {
      z.stage++;
      z.from = z.r;
      z.shrinkFrom = now;
      z.shrinkUntil = now + BR_STAGES[z.stage][1] * 1000;
      z.dps = BR_STAGES[z.stage][3];
      this.broadcast({ t: 'notice', text: 'THE STORM IS CLOSING IN' });
    }
    if (z.shrinkUntil) {
      const to = z.size * BR_STAGES[z.stage][2], k = Math.min(1, (now - z.shrinkFrom) / (z.shrinkUntil - z.shrinkFrom));
      z.r = z.from + (to - z.from) * k;
      if (k >= 1) { z.shrinkUntil = 0; z.holdUntil = now + ((BR_STAGES[z.stage + 1] || [99999])[0]) * 1000; }
    }
    // Outside the circle hurts (a little before the first close, more every stage).
    const dps = Math.max(2, z.dps);
    for (const p of this.players.values()) {
      if (!p.alive || p.dummy) continue;
      if (Math.hypot(p.st[0] - z.cx, p.st[2] - z.cz) <= z.r) continue;
      p.hp -= dps * dt;
      p.lastDmg = now;
      if (p.hp <= 0) this.kill(p, p, 'storm', false);
    }
    // Bots "find" a gun after a while (they don't go looking).
    for (const p of this.players.values()) {
      if (!p.bot || !p.alive || p.zombie) continue;
      if (!p.brLootAt) p.brLootAt = now + 15000 + Math.random() * 30000;
      else if (now >= p.brLootAt && p.brLootAt > 0) { p.brLootAt = -1; p.bot.setLoadout([BR_LOOT[(Math.random() * BR_LOOT.length) | 0], 'pistol', 'knife']); }
    }
  }
  brAlive() { return [...this.players.values()].filter((p) => p.alive && !p.dummy); }
  checkBrEnd() {
    if (!this.mode.br || this.phase !== 'playing') return;
    const alive = this.brAlive();
    if (alive.length <= 1 && this.players.size > 1) this.endMatch();
    else if (alive.length > 1 && alive.length <= 3) this.broadcast({ t: 'notice', text: `${alive.length} PLAYERS LEFT` });
  }
  // Game Night: switch this server to a Battle Royale round now; afterwards it goes back to what it was playing.
  startEvent(mode, map) {
    if (!MODES[mode] || !MODES[mode].event) return;
    if (!MODES[this.s.mode].event) this.eventReturn = { mode: this.s.mode, map: this.s.map, scoreLimit: this.s.scoreLimit, timeLimit: this.s.timeLimit };
    this.tour = null;
    if (mode === 'tourney') {
      // Everyone still here is in. Bots only when there aren't enough people (and only up to TOURNEY_MIN).
      const humans = [...this.players.values()].filter((p) => !p.bot);
      const bots = [...this.players.values()].filter((p) => p.bot && !p.zombie);
      const ids = new Set(humans.map((p) => p.id));
      for (const b of bots) { if (ids.size < TOURNEY_MIN) ids.add(b.id); else this.removePlayer(b.id); }
      this.tour = { ids, round: 0, done: false };
    }
    this.startMatch(mode, map);
  }
  // Game Night ended mid-tournament: whoever leads the current round wins it.
  endTourney() {
    if (!this.tour || this.tour.done) return;
    this.tour.force = true;
    if (this.phase === 'playing') this.endMatch();
  }
  tourneyIn(p) { return !!this.tour && this.tour.ids.has(p.id); }
  // Ranking of a round: score (kills), then fewer deaths.
  tourneyRank() {
    return [...this.tour.ids].map((id) => this.players.get(id)).filter(Boolean)
      .sort((a, b) => b.score - a.score || b.kills - a.kills || a.deaths - b.deaths);
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

  // ---------- Zombie Survival ----------
  survivors() { return [...this.players.values()].filter((p) => !p.zombie); }
  checkZombiesEnd() {
    if (this.s.mode !== 'zombies' || this.phase !== 'playing' || !this.zw || this.zw.wave === 0) return;
    const s = this.survivors();
    if (s.length && !s.some((p) => p.alive)) this.endMatch();
  }
  // A zombie record that's free to use (dead, from the pool), or a new one.
  zombieRecord() {
    for (const p of this.players.values()) if (p.zombie && !p.alive && !p.zPending) return p;
    if ([...this.players.values()].filter((p) => p.zombie).length >= Z_POOL) return null;
    const id = 'z' + ++this.botCount;
    const p = this.record(id, Z_NAMES[this.botCount % Z_NAMES.length], ZOMBIE_COLOR);
    p.bot = new Bot(this, p, 'normal');
    p.zombie = true;
    p.team = 2;
    p.cos = randomCos();
    p.mods = {};
    this.players.set(id, p);
    this.ensureNav();
    this.broadcast({ t: 'pjoin', ...this.info(p) });
    return p;
  }
  spawnZombie(brute) {
    const p = this.zombieRecord();
    if (!p) return false;
    const w = this.zw.wave;
    p.brute = !!brute;
    // Faster every wave; from wave 3 some are runners. Brutes are slow and huge.
    // (claws already move 1.25x, so wave 1 shamble along a bit slower than you walk)
    p.speedK = brute ? 0.6 : Math.min(0.95, 0.62 + 0.03 * w) * (w >= 3 && Math.random() < 0.2 ? 1.3 : 1);
    p.dmgK = brute ? 1.4 : Math.min(0.8, 0.3 + 0.04 * w); // claws hit for 50: 15 on wave 1, 40 by wave 13
    const name = brute ? 'Brute' : Z_NAMES[(Math.random() * Z_NAMES.length) | 0];
    if (p.name !== name) { p.name = name; this.broadcast({ t: 'pname', id: p.id, name }); }
    this.spawn(p);
    p.protectUntil = 0;
    return true;
  }
  tickZombies(now) {
    const z = this.zw;
    if (z.breakUntil) {
      if (now < z.breakUntil) return;
      z.breakUntil = 0;
      z.wave++;
      const n = this.survivors().length;
      z.toSpawn = Math.round((4 + 3 * z.wave) * (1 + 0.35 * Math.min(4, Math.max(0, n - 1))));
      z.brutes = z.wave % 5 === 0 ? Math.floor(z.wave / 5) : 0;
      this.broadcast({ t: 'notice', text: z.brutes ? `WAVE ${z.wave} · BRUTE INCOMING` : `WAVE ${z.wave}` });
      return;
    }
    // A zombie that hasn't got anywhere for 8 s is stuck: it comes back in somewhere else.
    for (const p of this.players.values()) {
      if (!p.zombie || !p.alive) continue;
      if (!p.zLast || Math.hypot(p.st[0] - p.zLast[0], p.st[2] - p.zLast[2]) > 2) { p.zLast = [p.st[0], p.st[2]]; p.zMovedAt = now; }
      else if (now - p.zMovedAt > 8000) { p.zLast = null; this.spawn(p); p.protectUntil = 0; }
    }
    const alive = [...this.players.values()].filter((p) => p.zombie && p.alive).length;
    const cap = Math.min(16, 4 + 2 * this.survivors().length + Math.floor(z.wave / 3));
    if (z.toSpawn > 0 && alive < cap && now >= z.spawnT) {
      const brute = z.brutes > 0 && z.toSpawn <= z.brutes * 4; // brutes come near the end of the wave
      if (this.spawnZombie(brute)) { z.toSpawn--; if (brute) z.brutes--; }
      z.spawnT = now + Math.max(400, 1400 - z.wave * 60);
    }
    if (z.toSpawn <= 0 && alive === 0) {
      // Wave cleared: everyone downed comes back, everyone is healed.
      this.broadcast({ t: 'notice', text: `WAVE ${z.wave} CLEARED · NEXT IN ${Z_BREAK_MS / 1000}s` });
      for (const p of this.survivors()) {
        if (!p.alive) this.spawn(p);
        else p.hp = this.maxHp(p); // the snapshot carries it to the player
      }
      z.breakUntil = now + Z_BREAK_MS;
    }
  }
  zombiesLeft() { return this.zw.toSpawn + [...this.players.values()].filter((p) => p.zombie && p.alive).length; }

  endMsg() {
    const scores = [...this.players.values()]
      .filter((p) => !p.zombie)
      .map((p) => this.info(p))
      .sort((a, b) => b.sc - a.sc || b.k - a.k || a.d - b.d);
    return {
      t: 'end', scores, title: this.endTitle, mode: this.s.mode, wave: this.zw ? this.zw.wave : undefined,
      next: Math.max(0, Math.ceil((this.restartAt - Date.now()) / 1000)),
      nextMap: this.vote ? this.vote.winner : this.nextMap(),
      mvp: this.mvp || null,
      vote: this.vote ? { maps: this.vote.maps, counts: this.vote.counts, opens: Math.max(0, this.vote.opensAt - Date.now()), ends: Math.max(0, this.vote.endsAt - Date.now()), winner: this.vote.winner } : null,
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
      if (this.s.war) { // clan war result
        const win = r === b ? null : r > b ? this.s.war.a : this.s.war.b;
        this.endTitle = win ? `[${win}] WINS THE CLAN WAR` : 'CLAN WAR: DRAW';
        this.broadcast({ t: 'warend', a: this.s.war.a, b: this.s.war.b, winner: win, score: [r, b] });
      }
    } else if (this.s.mode === 'infection') {
      this.endTitle = winnerTeam === 2 ? 'ZOMBIES WIN' : 'SURVIVORS WIN';
    } else if (this.tour) {
      const t = this.tour, rank = this.tourneyRank();
      if (rank.length <= 2 || t.force) {
        const champ = rank[0], second = rank[1];
        t.done = true;
        this.endTitle = champ ? `${champ.name} IS THE TOURNAMENT CHAMPION` : 'TOURNAMENT OVER';
        if (champ) champ.score += 100;
        this.broadcast({ t: 'tourney', champ: champ ? champ.id : null, name: champ ? champ.name : '', second: second ? second.id : null });
      } else {
        const keep = rank.slice(0, Math.max(2, Math.ceil(rank.length / 2)));
        for (const p of rank.slice(keep.length)) { t.ids.delete(p.id); this.sendTo(p.id, { t: 'notice', text: 'ELIMINATED FROM THE TOURNAMENT' }); }
        this.endTitle = keep.length === 2 ? `FINAL: ${keep[0].name} VS ${keep[1].name}` : `ROUND ${t.round}: ${keep.length} GO THROUGH`;
      }
    } else if (this.mode.br) {
      const w = this.brAlive()[0];
      this.endTitle = w ? `${w.name} WINS THE BATTLE ROYALE` : 'NOBODY SURVIVED THE STORM';
      if (w) w.score += 100; // the winner tops the scoreboard
    } else if (this.s.mode === 'zombies') {
      const w = Math.max(0, this.zw.wave - 1);
      this.endTitle = `SURVIVED ${w} WAVE${w === 1 ? '' : 'S'}`;
    } else {
      this.endTitle = sorted[0] ? `${sorted[0].name} WINS` : 'MATCH OVER';
    }
    for (const p of this.players.values()) p.alive = false;
    this.mvp = this.pickMvp();
    // Map vote when maps rotate; otherwise the same map comes back.
    const now = Date.now();
    this.vote = this.s.rotate && !this.tour ? { maps: this.voteChoices(), counts: [0, 0, 0], ballots: new Map(), opensAt: now + MVP_MS, endsAt: now + MVP_MS + VOTE_MS, winner: null } : null;
    this.restartAt = this.vote ? this.vote.endsAt + RESULT_MS : now + END_SCREEN_MS;
    this.broadcast(this.endMsg());
  }

  // Best player of the match: highest score, then kills, then fewest deaths.
  pickMvp() {
    const p = [...this.players.values()].filter((q) => !q.zombie).sort((a, b) => b.score - a.score || b.kills - a.kills || a.deaths - b.deaths)[0];
    return p ? { id: p.id, name: p.name, color: p.color, team: p.team, k: p.kills, d: p.deaths, sc: Math.floor(p.score), hs: p.heads || 0, streak: p.bestStreak || 0, role: p.role || null } : null;
  }

  // Three different maps, never the one just played.
  voteChoices() {
    const pool = MAP_ORDER.filter((m) => m !== this.s.map).sort(() => Math.random() - 0.5);
    return pool.slice(0, 3);
  }

  castVote(id, i) {
    const v = this.vote;
    const now = Date.now();
    if (!v || v.winner || now < v.opensAt || now >= v.endsAt || !(i >= 0 && i < v.maps.length) || v.ballots.has(id)) return;
    v.ballots.set(id, i); // one vote per player, final
    v.counts[i]++;
    this.broadcast({ t: 'votes', counts: v.counts });
  }

  // Most votes wins; ties (or no votes at all) are settled at random among the leaders.
  closeVote() {
    const v = this.vote;
    const top = Math.max(...v.counts);
    const leaders = v.maps.filter((m, i) => v.counts[i] === top);
    v.winner = leaders[(Math.random() * leaders.length) | 0];
    this.broadcast({ t: 'voted', map: v.winner, counts: v.counts });
  }

  nextMap() {
    if (!this.s.rotate) return this.s.map;
    return MAP_ORDER[(MAP_ORDER.indexOf(this.s.map) + 1) % MAP_ORDER.length];
  }

  // Starts a fresh match. With no arguments it rotates to the next map (end of match);
  // the host panel passes an explicit mode/map to restart immediately.
  startMatch(mode, map) {
    if (!mode && this.tour && !this.tour.done && this.s.mode === 'tourney') map = MAP_ORDER[(Math.random() * MAP_ORDER.length) | 0]; // next round, new map
    else if (this.tour && this.tour.done && !mode) this.tour = null;
    if (!mode && !this.tour && MODES[this.s.mode].event && this.eventReturn) { // the event is over: back to normal (on the voted map, if there was a vote)
      const r = this.eventReturn;
      this.eventReturn = null;
      mode = r.mode; map = map || r.map;
      this.startMatch(mode, map);
      Object.assign(this.s, { scoreLimit: r.scoreLimit, timeLimit: r.timeLimit });
      this.endsAt = this.s.timeLimit > 0 ? Date.now() + this.s.timeLimit * 60000 : Infinity;
      this.broadcast({ t: 'settings', s: this.s });
      this.balanceBots(); // bots that sat out the event come back
      return;
    }
    const manual = !!(mode || map);
    if (mode && mode !== 'tourney') this.tour = null;
    if (mode && MODES[mode] && mode !== this.s.mode) {
      this.s.mode = mode;
      this.s.scoreLimit = MODES[mode].score;
      this.s.timeLimit = MODES[mode].time;
      Object.assign(this.s, PHYS_DEFAULTS, { health: 100, headshotsOnly: false }, MODES[mode].preset);
    }
    this.s.map = map && MAPS[map] ? map : manual ? this.s.map : this.nextMap();
    this.loadMap(this.s.map);
    this.ensureNav();
    for (const p of [...this.players.values()]) if (p.zombie) { this.players.delete(p.id); this.broadcast({ t: 'pleave', id: p.id, name: p.name, quiet: 1 }); }
    if (this.tour && this.s.mode === 'tourney') { // round settings: the final is a 1v1, first to 7
      this.tour.round++;
      const final = this.tour.ids.size <= 2;
      this.s.scoreLimit = final ? 7 : 15;
      this.s.timeLimit = final ? 6 : 5;
    }
    this.beginMatchState();
    const list = [...this.players.values()].sort(() => Math.random() - 0.5);
    list.forEach((p, i) => {
      p.kills = 0; p.deaths = 0; p.level = 0;
      p.heads = 0; p.streak = 0; p.bestStreak = 0;
      p.score = this.s.mode === 'lms' ? Math.max(1, this.s.scoreLimit) : 0;
      p.team = this.s.war && this.warTeam(p) ? this.warTeam(p) : this.mode.redBlue ? (i % 2) + 1 : this.s.mode === 'infection' || this.s.mode === 'zombies' ? 1 : 0;
      p.alive = false;
      p.respawnAt = 0;
    });
    this.broadcast({ t: 'settings', s: this.s });
    this.broadcast({ t: 'start', map: this.s.map, mode: this.s.mode });
    if (this.tour && this.s.mode === 'tourney') {
      const n = this.tour.ids.size;
      this.broadcast({ t: 'notice', text: n <= 2 ? 'TOURNAMENT FINAL · FIRST TO 7' : `TOURNAMENT ROUND ${this.tour.round} · ${n} PLAYERS · TOP ${Math.max(2, Math.ceil(n / 2))} GO THROUGH` });
    }
    for (const p of this.players.values()) if (!this.tour || this.s.mode !== 'tourney' || this.tour.ids.has(p.id)) this.spawn(p);
  }

  applySettings(partial) {
    // Ranked servers keep the standard rules (only map rotation can change).
    if (this.s.ranked) partial = 'rotate' in partial ? { rotate: partial.rotate } : {};
    const weaponsBefore = this.s.weapons;
    Object.assign(this.s, partial);
    if ('weapons' in partial && partial.weapons !== weaponsBefore) {
      this.broadcast({ t: 'notice', text: `Weapons: ${(WEAPON_RULES[this.s.weapons] || WEAPON_RULES.any).name} (from your next life)` });
    }
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
      if (this.zw) this.tickZombies(now);
      // Auto bots: every 15 s, nudge their skill toward an even fight with the real players.
      if (now - (this.botSkillT || 0) > 15000) {
        this.botSkillT = now;
        if (this.botSkill === undefined) this.botSkill = 0.45;
        const f = (this.botFights || []).filter((x) => now - x.t < 180000);
        if (f.length >= 4) {
          const hk = f.filter((x) => x.human).length, bk = f.length - hk, r = (hk + 1) / (bk + 1);
          const step = r > 2.2 ? 0.07 : r > 1.4 ? 0.035 : r < 0.55 ? -0.07 : r < 0.85 ? -0.035 : 0;
          this.botSkill = Math.max(0.1, Math.min(1.3, this.botSkill + step));
        }
      }
      if (this.brZone && this.phase === 'playing') this.tickStorm(now, rdt);
      if (this.mode.hill) this.tickHill(rdt, now);
      if (this.s.mode === 'killconfirmed') this.tickTags(now);
      this.tickPickups(now);
      // Maps with no floor under the edges (Sky Islands): falling off kills you.
      const voidY = MAPS[this.s.map] && MAPS[this.s.map].voidY;
      if (voidY !== undefined) for (const p of this.players.values()) if (p.alive && !p.dummy && p.st[1] < voidY) this.kill(p, p, 'fall', false);
      if (this.s.mode === 'rotation') this.tickRotation(now);
      if (this.flags) this.tickFlags(now);
      if (this.dom && this.phase === 'playing') this.tickDom(rdt);
      for (const p of this.players.values()) if (p.bot && !p.frozen) p.bot.update(dt);
      if (this.mode.practice) this.tickDummies(now);
    } else {
      if (this.vote && !this.vote.winner && now >= this.vote.endsAt) this.closeVote();
      if (now >= this.restartAt) this.startMatch(undefined, this.vote && this.vote.winner ? this.vote.winner : undefined);
    }

    const s = {};
    for (const p of this.players.values()) {
      const st = p.st;
      s[p.id] = [r2(st[0]), r2(st[1]), r2(st[2]), r2(st[3]), r2(st[4]), st[5], st[6], p.alive ? 1 : 0,
        Math.ceil(p.hp), p.kills, p.deaths, st[7], p.team, Math.floor(p.score)];
    }
    const msg = { t: 'snap', tm: now, s, tl: this.endsAt === Infinity ? -1 : this.phase === 'playing' ? Math.max(0, Math.ceil((this.endsAt - now) / 1000)) : 0 };
    if (this.mode.redBlue) msg.ts = [Math.floor(this.teamScore[1]), Math.floor(this.teamScore[2])];
    // Zombie Survival: [wave, zombies left, seconds until the next wave (0 = wave on)]
    // Battle Royale storm: [center x, center z, radius, next radius, seconds until it moves (0 = moving now), damage per second]
    if (this.brZone) { const z = this.brZone, nx = BR_STAGES[z.shrinkUntil ? z.stage : z.stage + 1]; msg.br = [r2(z.cx), r2(z.cz), r2(z.r), r2(nx ? z.size * nx[2] : z.r), z.shrinkUntil ? 0 : Math.max(0, Math.ceil((z.holdUntil - now) / 1000)), Math.max(2, z.dps)]; }
    // Tournament: [round, final (1/0), ids still in]
    if (this.tour && this.s.mode === 'tourney') msg.tr = [this.tour.round, this.tour.ids.size <= 2 ? 1 : 0, [...this.tour.ids]];
    // Barrels and crates still standing: [id, 1 barrel / 2 crate, x, y, z]
    if (this.props && this.props.length) msg.pr = this.props.map((o) => [o.id, o.kind === 'barrel' ? 1 : 2, r2(o.x), r2(o.y), r2(o.z)]);
    if (this.zw) msg.zw = [this.zw.wave, this.zombiesLeft(), this.zw.breakUntil ? Math.max(0, Math.ceil((this.zw.breakUntil - now) / 1000)) : 0];
    if (this.s.mode === 'infection') msg.inf = this.infected ? 0 : Math.max(0, Math.ceil((this.infectAt - now) / 1000));
    if (this.s.mode === 'killconfirmed') msg.tg = this.tags.map((t) => [t.id, r2(t.x), r2(t.y), r2(t.z), t.team]);
    // Pickups that are ready: [id, kind, x, y, z, power weapon]
    if (this.pickupsOn()) msg.pk = this.pickups.filter((k) => now >= k.readyAt && (k.kind !== 'power' || k.w)).map((k) => [k.id, k.kind, r2(k.x), r2(k.y), r2(k.z), k.w || 0]);
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
