import * as THREE from 'three';
import { MAPS, setMapData, buildMapScene, boxes, quality } from './maps.js';
import { moveBody, overlap, raycast, rayAABB, PLAYER_R, phys } from './physics.js';
import { MODES, TEAM_COLORS, ZOMBIE_COLOR, JUGG_COLOR, JUGG_TEAM, defaultSettings } from './host.js';
import { WEAPONS, DEFAULT_LOADOUT, GUNGAME_LADDER, SLOTS } from './weapons.js';
import { track, onMissionComplete } from './missions.js';
import { onProgress, myLevel } from './progress.js';
import { rateMatch } from './ranked.js';
import { statsFor, cleanModMap } from './mods.js';
import { Viewmodel } from './viewmodel.js';
import { RemotePlayer, netClock } from './remote.js';
import { Effects } from './effects.js';
import { Hud } from './hud.js';
import { sfx } from './audio.js';
import { medalsFor } from './medals.js';
import { binds, actionOf, mouseCode } from './binds.js';
import { buildProjectile, modelQuality } from './models.js';
import { clamp, esc, store } from './util.js';
import { opts, onOpts } from './settings.js';
import { setVolume } from './audio.js';

const JUMP = 8, WALK = 5.6, SPRINT = 1.35, CROUCH_SPD = 0.55, PAD_JUMP = 14;
// Jump forgiveness: jump shortly after walking off a ledge (coyote) or pressed just before landing (buffer).
const COYOTE = 0.11, JUMP_BUFFER = 0.14;
// Sprint + crouch = slide: a burst of speed that bleeds off, then you're crouched.
const SLIDE_TIME = 0.85, SLIDE_BOOST = 1.25, SLIDE_FRICTION = 1.1, SLIDE_COOLDOWN = 0.9;
const STAND_H = 1.8, CROUCH_H = 1.2, EYE_STAND = 1.62, EYE_CROUCH = 1.05;
const SEND_INTERVAL = 1 / 30;
const BASE_SENS = 0.0022;
const BOUNCE_GRAVITY = 18;
const THROW_RELEASE = 0.4;

const _f = new THREE.Vector3(), _r = new THREE.Vector3(), _u = new THREE.Vector3();
const _c = new THREE.Vector3(), _d = new THREE.Vector3(), _n = new THREE.Vector3();
const _q = new THREE.Quaternion(), _m4 = new THREE.Matrix4();
const UP = new THREE.Vector3(0, 1, 0);
const FWD = new THREE.Vector3(0, 0, -1);
const r2 = (v) => Math.round(v * 100) / 100;
const _aE = new THREE.Vector3(), _aT = new THREE.Vector3();
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const arr = (v) => [r2(v.x), r2(v.y), r2(v.z)];

export class Game {
  constructor(canvas, { mobile = false, tablet = false } = {}) {
    this.canvas = canvas;
    this.touch = mobile;
    this.tablet = tablet;
    this.joy = { x: 0, y: 0 };
    this.padMode = false; // a controller is driving the game (set by GamepadInput)
    this.mobile = mobile;
    // Low graphics: no shadows, lower resolution. Turned on automatically (and remembered)
    // if the device ever loses its graphics context; ?lowgfx / ?highgfx force it.
    const params = new URLSearchParams(location.search);
    if (params.has('highgfx')) store.set('lowgfx', false);
    this.lowGfx = params.has('lowgfx') || store.get('lowgfx', false);
    // Graphics level: 'potato' (Low-end: tiny resolution, no shadows/decorations, short view),
    // 'low', 'normal' or 'high'. Auto resolution (opts.autoRes) scales the resolution with the frame rate.
    this.gfx = params.has('lowgfx') ? 'low' : store.get('gfx', null) || (this.lowGfx ? 'low' : 'normal');
    this.lowGfx = this.gfx === 'low' || this.gfx === 'potato';
    quality.decor = this.gfx !== 'potato';
    this.dynScale = 1;
    this.perf = { frames: 0, acc: 0, slow: 0 };
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, powerPreference: 'high-performance' });
    renderer.shadowMap.type = mobile ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.autoClear = false;
    this.renderer = renderer;
    this.applyGfx();
    // Phones can drop the GPU context under load; let three.js restore it, drop to low
    // graphics so it doesn't happen again, and tell the player what's happening.
    const sys = (show) => {
      const el = document.getElementById('sys-msg');
      if (!el) return;
      document.getElementById('sys-title').textContent = 'Graphics were reset';
      document.getElementById('sys-text').textContent = 'Your device ran out of graphics power, so the game is switching to low graphics. If the screen stays blank, tap Reload.';
      el.classList.toggle('hidden', !show);
    };
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      sys(true);
      this.lowGfx = true;
      if (this.gfx !== 'potato') this.gfx = 'low';
      store.set('lowgfx', true);
      store.set('gfx', this.gfx);
    });
    canvas.addEventListener('webglcontextrestored', () => {
      this.applyGfx();
      sys(false);
    });

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, 1, 0.05, 300);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);
    this.mapId = null;
    this.mapGroup = null;

    this.vm = new Viewmodel();
    this.mods = {}; // weapon id -> attachments (set from the loadout screen)
    this.wCache = new Map();
    this.fx = new Effects(this.scene);
    this.hud = new Hud();
    this.loadMap('warehouse');
    this.fps = { frames: 0, acc: 0 };
    this.playedThisMatch = false;
    this.tagMeshes = new Map();
    this.tagData = null;
    onMissionComplete((ms) => {
      this.hud.mission(ms.name, `+${ms.tokens} tokens`);
      sfx.kill(0.9);
    });
    // XP this match (end screen), level-ups and daily challenges (progress.js)
    this.matchXp = 0;
    onProgress((e) => {
      if (e.type === 'xp') this.matchXp += e.amount;
      else if (e.type === 'level') {
        this.hud.mission(e.newRank ? `${e.rank.name.toUpperCase()} RANK · LEVEL ${e.level}` : `LEVEL ${e.level}`, `+${e.tokens} tokens${e.wrap ? ' · new wrap!' : ''}`, e.newRank ? 'RANK UP' : 'LEVEL UP');
        sfx.kill(0.9);
        if (this.onLevel) this.onLevel(e.level);
      } else if (e.type === 'challenge') this.hud.mission(e.ch.text, `+${e.tokens} tokens`, 'DAILY CHALLENGE');
      else if (e.type === 'allDaily') this.hud.mission('All 3 daily challenges', `+${e.tokens} bonus tokens`, 'DAILY COMPLETE');
    });
    this.fovK = 1; // widens the view on portrait screens (see resize)
    onOpts((o) => {
      this.vm.camera.fov = o.vmFov * this.fovK;
      this.vm.camera.updateProjectionMatrix();
      if (!this.active || !this.ads) { this.camera.fov = o.fov * this.fovK; this.camera.updateProjectionMatrix(); }
      setVolume(o.volume);
      this.hud.applyOpts(o);
    });

    this.remotes = new Map(); // id -> RemotePlayer
    this.streaks = new Map(); // id -> kills since their last death (SHUTDOWN medals)
    this.players = new Map(); // id -> {id, name, color, k, d}
    this.projectiles = [];
    this.net = null;
    this.myId = null;
    this.active = false;
    this.nextLoadout = DEFAULT_LOADOUT.slice();
    this.onUnlock = null;
    this.onKicked = null;
    this.rules = defaultSettings();
    this.maxHp = 100;
    this.myColor = '#3498db';
    this.teamScore = null;
    this.zone = null;
    this.infection = 0;
    this.zoneMesh = new THREE.Group();
    const zoneMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false });
    this.zoneWall = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 40, 1, true), zoneMat);
    this.zoneRing = new THREE.Mesh(new THREE.RingGeometry(0.94, 1, 48), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
    this.zoneRing.rotation.x = -Math.PI / 2;
    this.zoneMesh.add(this.zoneWall, this.zoneRing);
    this.zoneMesh.visible = false;
    this.scene.add(this.zoneMesh);

    this.me = {
      pos: new THREE.Vector3(), vel: new THREE.Vector3(), onGround: false, ground: null,
      yaw: 0, pitch: 0, crouch: false, h: STAND_H, eye: EYE_STAND, alive: false, hp: 100,
    };
    this.loadout = DEFAULT_LOADOUT.slice();
    this.slot = 0;
    this.ammo = {};
    this.util = 0;
    this.fireCd = 0; this.switchT = 0; this.reloadT = 0; this.autoSwitchT = 0;
    this.lastSlot = 1; this.returnSlot = -1; this.returnT = 0; this.wheelCd = 0;
    this.burstLeft = 0; this.burstT = 0; this.spin = 0;
    this.pendingMelee = null; this.pendingThrow = null; this.cycleSfxT = 0;
    this.recoil = 0; this.shake = 0; this.flinch = 0; this.landDip = 0;
    this.bobPhase = 0; this.stepAcc = 0; this.roll = 0;
    this.coyote = 0; this.jumpBuf = 0; this.jumpHeld = false; this.stepSmooth = 0;
    this.slideT = 0; this.slideCd = 0; this.crouchHeld = false;
    this.spread = 0; this.ads = false; this.scoped = false; this.sprinting = false;
    this.keys = new Set();
    this.mouse = { left: false, right: false };
    this.firedThisPress = false;
    this.locked = false;
    this.matchOver = false;
    this.endInfo = null;
    this.deathInfo = null;
    this.showScores = false;
    this.timeLeft = 600;
    this.pid = 0;
    this.sendAcc = 0;
    this.hudAcc = 0;

    this.bindInput();
    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.last = performance.now();
    renderer.setAnimationLoop(() => this.frame());
  }

  // Change the graphics level (Settings → Video).
  setGfx(level) {
    const decorBefore = quality.decor;
    this.gfx = level;
    this.lowGfx = level === 'low' || level === 'potato';
    quality.decor = level !== 'potato';
    store.set('gfx', level);
    store.set('lowgfx', this.lowGfx);
    this.dynScale = 1;
    if (decorBefore !== quality.decor && this.mapGroup) { // rebuild the map's scene with / without decorations
      this.scene.remove(this.mapGroup);
      this.mapGroup.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.isMesh && o.material && !o.material.userData.shared) o.material.dispose(); });
      this.mapGroup = buildMapScene(this.scene, this.mapId);
      this.fogFar0 = this.scene.fog ? this.scene.fog.far : 300;
    }
    this.applyGfx();
  }

  applyGfx() {
    const r = this.renderer, low = this.lowGfx, potato = this.gfx === 'potato', high = this.gfx === 'high';
    const base = potato ? 0.6 : Math.min(devicePixelRatio, low ? 1 : high ? 2 : this.tablet ? 1.5 : this.mobile ? 1.25 : 2);
    r.setPixelRatio(Math.max(0.45, Math.min(3, base * (this.mobile || potato ? 1 : opts.renderScale || 1) * (this.dynScale || 1)))); // render scale: PC-only Showroom setting
    if (this.fx) this.fx.scale = potato ? 0.35 : low ? 0.7 : 1;
    // Low-end: shorter view distance (fog closes in so the cut-off isn't visible)
    if (this.scene && this.scene.fog) this.scene.fog.far = potato ? Math.min(this.fogFar0 || 300, 65) : this.fogFar0 || this.scene.fog.far;
    if (this.camera) { this.camera.far = potato ? 70 : 300; this.camera.updateProjectionMatrix(); }
    modelQuality.remoteShadows = !low && !this.mobile; // other players' shadows are the priciest part on phones
    if (r.shadowMap.enabled === !low) return;
    r.shadowMap.enabled = !low;
    // Shadow on/off changes shaders, so every material needs recompiling.
    for (const s of [this.scene, this.vm && this.vm.scene]) {
      if (s) s.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
    }
    if (this.mapGroup) this.mapGroup.traverse((o) => { if (o.isDirectionalLight) o.castShadow = !low; });
  }

  get curW() { return this.loadout[this.slot] || this.loadout[0]; }
  get teams() { return MODES[this.rules.mode].teams; }
  get myTeam() { const p = this.players.get(this.myId); return p ? p.team : 0; }
  get utilId() { return this.loadout[3]; }

  // Teammates can't be damaged (unless friendly fire is on in TDM).
  isAlly(r) {
    if (!this.teams || (this.rules.friendlyFire && MODES[this.rules.mode].redBlue)) return false;
    const p = this.players.get(r.id);
    return !!p && p.team === this.myTeam;
  }

  colorFor(p) {
    if (this.rules.mode === 'infection') return p.team === 2 ? ZOMBIE_COLOR : p.color;
    if (this.rules.mode === 'juggernaut' || this.rules.mode === 'bounty') return p.team === JUGG_TEAM ? JUGG_COLOR : p.color;
    if (this.teams && TEAM_COLORS[p.team]) return TEAM_COLORS[p.team];
    return p.color;
  }

  applySettings(s) {
    const modeChanged = s.mode !== this.rules.mode;
    this.rules = { ...this.rules, ...s };
    phys.gravity = this.rules.gravity;
    if (modeChanged) this.refreshColors();
  }

  refreshColors() {
    const big = !!MODES[this.rules.mode].bigHead;
    for (const r of this.remotes.values()) {
      const p = this.players.get(r.id);
      if (p) r.setLook(this.colorFor(p), this.teams && p.team === this.myTeam && this.rules.mode !== 'infection');
      r.setBigHead(big);
    }
    const me = this.players.get(this.myId);
    if (me) this.vm.setColor(this.colorFor(me));
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = this.vm.camera.aspect = w / h;
    // FOV is vertical, so a portrait screen (tablets) would see a narrow slice with the gun pushed
    // off the side. Widen it there, gently.
    this.fovK = w < h ? Math.min(1.5, Math.pow(h / w, 0.6)) : 1;
    this.vm.camera.fov = opts.vmFov * this.fovK;
    if (!this.active) this.camera.fov = opts.fov * this.fovK;
    this.camera.updateProjectionMatrix();
    this.vm.camera.updateProjectionMatrix();
  }

  loadMap(id) {
    if (!MAPS[id]) id = 'warehouse';
    if (this.mapId === id && this.mapGroup) return;
    setMapData(id);
    if (this.mapGroup) {
      this.scene.remove(this.mapGroup);
      this.mapGroup.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.isMesh && o.material && !o.material.userData.shared) o.material.dispose();
      });
    }
    this.mapGroup = buildMapScene(this.scene, id);
    this.mapId = id;
    this.fogFar0 = this.scene.fog ? this.scene.fog.far : 300;
    if (this.gfx === 'potato' && this.scene.fog) this.scene.fog.far = Math.min(this.fogFar0, 65);
    for (const p of this.projectiles || []) this.scene.remove(p.mesh);
    this.projectiles = [];
    this.fx.clear();
  }

  // ---------- Input ----------

  bindInput() {
    // Keys go through the bindings (binds.js); this.keys holds raw codes plus '@action' entries
    // pressed by the controller / touch buttons.
    document.addEventListener('keydown', (e) => {
      if (!this.active) return;
      const act = actionOf(e.code);
      if (act === 'scores') { e.preventDefault(); this.showScores = true; }
      const vk = { Digit1: 0, Digit2: 1, Digit3: 2 }[e.code];
      if (this.matchOver && vk !== undefined && !(e.target && /INPUT|TEXTAREA/.test(e.target.tagName))) { this.voteMap(vk); return; }
      if (!this.locked) return;
      if (act && act !== 'chat') e.preventDefault(); // no page scrolling / browser shortcuts mid-game
      this.keys.add(e.code);
      if (!e.repeat) this.onAction(act);
    });
    document.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      if (actionOf(e.code) === 'scores') this.showScores = false;
    });
    document.addEventListener('mousemove', (e) => {
      // Without pointer lock (e.g. a controller resumed the game) stray mouse moves don't turn you.
      if (!this.locked || this.touch || document.pointerLockElement !== this.canvas) return;
      this.look(clamp(e.movementX, -250, 250), clamp(e.movementY, -250, 250));
    });
    this.canvas.addEventListener('mousedown', (e) => {
      if (!this.locked) return;
      if (e.button === 0) { this.mouse.left = true; this.firedThisPress = false; }
      if (e.button === 2) this.mouse.right = opts.aimToggle ? !this.mouse.right : true;
      const mc = mouseCode(e.button); // middle / side buttons can be bound to actions
      if (mc) { e.preventDefault(); this.keys.add(mc); this.onAction(actionOf(mc)); if (actionOf(mc) === 'scores') this.showScores = true; }
    });
    document.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.left = false;
      if (e.button === 2 && !opts.aimToggle) this.mouse.right = false;
      const mc = mouseCode(e.button);
      if (mc) { this.keys.delete(mc); if (actionOf(mc) === 'scores') this.showScores = false; }
    });
    this.canvas.addEventListener('wheel', (e) => {
      // Trackpads fire a stream of wheel events; one switch per notch.
      if (!this.locked || !this.me.alive || this.matchOver || this.wheelCd > 0 || !e.deltaY) return;
      this.wheelCd = 0.14;
      this.cycleSlot(Math.sign(e.deltaY));
    }, { passive: true });
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      if (this.touch) return;
      this.locked = document.pointerLockElement === this.canvas;
      if (!this.locked) {
        this.keys.clear();
        this.mouse.left = this.mouse.right = false;
        if (this.active && this.onUnlock && !this.matchOver) this.onUnlock(); // match over: it was freed for the vote
      }
    });
    window.addEventListener('blur', () => this.keys.clear());
  }

  // Is an action held? (a bound key / mouse button, or a controller / touch press)
  down(a) {
    if (this.keys.has('@' + a)) return true;
    for (const c of binds()[a]) if (this.keys.has(c)) return true;
    return false;
  }

  // One-press actions from a key or mouse button.
  onAction(act) {
    if (!act || !this.me.alive || this.matchOver) return;
    const n = { slot1: 0, slot2: 1, slot3: 2, slot4: 3 }[act];
    if (n !== undefined) this.switchSlot(n);
    else if (act === 'swap') this.swapLast();
    else if (act === 'reload') this.startReload();
    else if (act === 'grenade') this.quickThrow();
    else if (act === 'melee') this.quickMelee();
    else if (act === 'inspect' && this.reloadT <= 0) this.vm.inspect();
  }

  // The local player's weapon stats, with their attachments applied (cached).
  W(id) {
    let w = this.wCache.get(id);
    if (!w) { w = statsFor(id, this.mods[id]) || WEAPONS[id]; this.wCache.set(id, w); }
    return w;
  }

  // New attachments from the loadout screen (models rebuild; stats apply right away, ammo on next spawn).
  setMods(mods) {
    this.mods = cleanModMap(mods);
    this.wCache.clear();
    this.vm.setMods(this.mods);
    if (this.net) this.net.send({ t: 'mods', m: this.mods });
  }

  // touch: drag-to-look from the touch controls (uses its own sensitivity).
  look(dx, dy, touch = false) {
    if (!this.me.alive && !this.spectating && !this.deathSpecOn) return;
    if (opts.invertY) dy = -dy;
    let s = BASE_SENS * (touch ? opts.touchSens : opts.sens) * (this.camera.fov / (opts.fov * this.fovK)) * (this.ads ? opts.adsSens : 1);
    // Aim assist "friction": aim slows down while the crosshair is on an enemy.
    const a = this.assist;
    if (touch && a && a.ang < a.limit) s *= 1 - 0.5 * opts.aimAssistStrength;
    this.me.yaw -= dx * s;
    this.me.pitch = clamp(this.me.pitch - dy * s, -1.5, 1.5);
    this.vm.look(dx, dy);
  }

  // Controller right stick: x/y are -1..1 after the dead zone and response curve; turns at a
  // rate (radians per second) instead of by distance like a mouse.
  padLook(x, y, dt) {
    if (!this.me.alive || (!x && !y)) return;
    if (opts.padInvertY) y = -y;
    let rate = 3.6 * opts.padSens * (this.camera.fov / (opts.fov * this.fovK)) * (this.ads ? opts.adsSens : 1);
    const a = this.assist;
    if (opts.aimAssist && a && a.ang < a.limit) rate *= 1 - 0.45 * opts.aimAssistStrength; // friction on target
    const dx = x * rate * dt, dy = y * rate * 0.72 * dt;
    this.me.yaw -= dx;
    this.me.pitch = clamp(this.me.pitch - dy, -1.5, 1.5);
    this.vm.look(dx / BASE_SENS, dy / BASE_SENS);
  }

  cycleSlot(dir) {
    const n = this.loadout.length;
    for (let i = 1; i <= n; i++) {
      const s = (this.slot + dir * i + n * 2) % n;
      if (s !== this.slot && (s !== 3 || this.util > 0)) { this.switchSlot(s); break; }
    }
  }

  setLocked(v) {
    this.locked = v;
    if (!v) { this.keys.clear(); this.mouse.left = this.mouse.right = false; }
  }

  lock() {
    // Touch and controllers don't need the mouse captured (and a gamepad press can't request it).
    if (this.touch || this.padMode) { this.setLocked(true); return; }
    try {
      const p = this.canvas.requestPointerLock({ unadjustedMovement: true });
      if (p && p.catch) {
        p.catch(() => {
          const q = this.canvas.requestPointerLock();
          if (q && q.catch) q.catch(() => {});
        });
      }
    } catch {
      this.canvas.requestPointerLock();
    }
  }

  // ---------- Lobby lifecycle ----------

  attach(net, { loadout, color }) {
    this.net = net;
    this.nextLoadout = loadout.slice();
    this.vm.setColor(color);
  }

  reset() {
    this.active = false;
    this.myId = null;
    for (const r of this.remotes.values()) r.dispose();
    this.remotes.clear();
    this.players.clear();
    this.streaks.clear();
    for (const p of this.projectiles) this.scene.remove(p.mesh);
    this.projectiles = [];
    this.fx.clear();
    this.me.alive = false;
    this.matchOver = false;
    this.deathInfo = null;
    this.endDeathSpectate();
    this.spectating = this.frozen = false;
    this.specPos = null;
    this.hud.el.classList.remove('spec', 'frozen');
    this.rules = defaultSettings();
    phys.gravity = 1;
    this.zone = null;
    this.teamScore = null;
    this.zoneMesh.visible = false;
    this.tagData = null;
    this.rot = null;
    this.flagData = null;
    this.lastSnapTm = 0; // a new host has a different clock
    this.clockInit = false;
    this.updateTags(0); // removes any dog tags left in the scene
    this.pickupData = null;
    this.updatePickups(0);
    this.updateFlags(0); // and CTF flags
    this.domData = null;
    this.updateDom(0); // and Domination zones
    this.hud.show(false);
    this.hud.death(false);
    this.hud.end(false);
    this.hud.scope(false);
    this.hud.scoreboard(false);
    this.net = null;
    if (document.pointerLockElement) document.exitPointerLock();
    this.camera.fov = opts.fov * this.fovK;
    this.camera.updateProjectionMatrix();
  }

  addRemote(p) {
    if (p.id === this.myId || this.remotes.has(p.id)) return;
    const r = new RemotePlayer(this.scene, p.id, p.name, p.color, p.cos, cleanModMap(p.mods));
    if (p.role) r.setIdentity(p.name, p.role);
    this.remotes.set(p.id, r);
  }

  onNet(m) {
    switch (m.t) {
      case 'welcome':
        this.myId = m.id;
        this.active = true;
        this.spectating = !!m.spec; // staff watching invisibly (no player of our own)
        this.frozen = false;
        this.hud.el.classList.toggle('spec', this.spectating);
        this.applySettings(m.settings);
        this.loadMap(m.settings.map);
        this.players.clear();
        for (const p of m.players) {
          this.players.set(p.id, { id: p.id, name: p.name, color: p.color, k: p.k, d: p.d, team: p.team, sc: p.sc, bot: p.bot, role: p.role || null, gt: p.gt || null, lvl: (p.cos && p.cos.lvl) || 0 });
          this.addRemote(p);
        }
        this.refreshColors();
        this.hud.show(true);
        this.net.send({ t: 'mods', m: this.mods }); // so everyone sees our attachments
        if (this.onWelcome) this.onWelcome(); // staff send their proof (main.js)
        break;
      case 'pjoin':
        this.players.set(m.id, { id: m.id, name: m.name, color: m.color, k: 0, d: 0, team: m.team, sc: 0, bot: m.bot, role: m.role || null, gt: m.gt || null, lvl: (m.cos && m.cos.lvl) || 0 });
        this.addRemote(m);
        this.refreshColors();
        this.hud.say(`${m.name} joined`);
        break;
      case 'settings':
        this.applySettings(m.s);
        break;
      case 'pmods': { // someone changed attachments
        const r = this.remotes.get(m.id);
        if (r) r.setMods(cleanModMap(m.m));
        break;
      }
      case 'notice':
        this.hud.say(m.text);
        break;
      case 'ammo': { // One in the Chamber: a kill earned a bullet
        const gun = this.loadout[0], W = WEAPONS[gun];
        if (!W || !W.mag || !this.me.alive) break;
        this.ammo[gun] = Math.min(W.mag, (this.ammo[gun] || 0) + (m.add || 1));
        this.hud.say(`+${m.add || 1} BULLET`);
        if (this.slot !== 0) this.switchSlot(0);
        break;
      }
      case 'pickup': // walked over a map pickup (host.js tickPickups)
        if (!this.me.alive) break;
        if (m.k === 'hp') { this.hud.say('+50 HEALTH'); sfx.pad(0.5); }
        else if (m.k === 'ammo') {
          for (const id of this.loadout) this.ammo[id] = this.W(id).mag || 0;
          if (this.utilId) this.util = WEAPONS[this.utilId].count;
          this.hud.say('AMMO REFILLED');
          sfx.equip(0.8);
        } else if (m.k === 'power' && WEAPONS[m.w]) {
          this.loadout[0] = m.w;
          this.ammo[m.w] = this.W(m.w).mag || 0;
          this.switchSlot(0, true);
          this.hud.say(`POWER WEAPON: ${WEAPONS[m.w].name.toUpperCase()}`);
          sfx.equip(1);
        }
        break;
      case 'tagc':
        track.tag();
        sfx.pad(0.4);
        break;
      case 'pcos': {
        const r = this.remotes.get(m.id), pl = this.players.get(m.id);
        if (r) r.setCosmetics(m.c);
        if (pl && m.c) pl.lvl = m.c.lvl || 0;
        break;
      }
      case 'prole': case 'pname': { // a player proved they're staff / an impostor was renamed
        const p = this.players.get(m.id);
        if (p) { p.name = m.name; if (m.t === 'prole') p.role = m.role; }
        const r = this.remotes.get(m.id);
        if (r) r.setIdentity(m.name, p ? p.role : null);
        if (m.t === 'prole' && m.id !== this.myId) this.hud.say(`${m.role === 'owner' ? '♛ THE OWNER' : '🛡 A MODERATOR'} IS HERE: ${m.name}`);
        break;
      }
      case 'frozen': // staff froze / unfroze you
        this.frozen = !!m.on;
        this.hud.el.classList.toggle('frozen', this.frozen);
        this.hud.say(this.frozen ? `FROZEN BY ${m.by.toUpperCase()}` : 'YOU CAN MOVE AGAIN');
        if (this.frozen) { this.keys.clear(); this.mouse.left = false; this.me.vel.set(0, this.me.vel.y, 0); }
        break;
      case 'pfrozen': {
        const p = this.players.get(m.id);
        if (p) p.frozen = !!m.on;
        break;
      }
      case 'warned': // a moderator warned you in this match
        if (this.onWarned) this.onWarned(m);
        break;
      case 'pident': { // a player proved their gamertag to the host
        const p = this.players.get(m.id);
        if (p) p.gt = m.gt;
        break;
      }
      case 'chatmode':
        this.chatMode = { lock: !!m.lock, slow: !!m.slow };
        break;
      case 'pmute': {
        const p = this.players.get(m.id);
        if (p) p.muted = m.muted;
        break;
      }
      case 'kicked':
        if (this.onKicked) this.onKicked();
        break;
      case 'loadout':
        if (this.me.alive) {
          this.setLoadout(m.l);
          if (m.hp) { this.me.hp = m.hp; this.maxHp = m.hp; }
          sfx.equip(0.8);
        }
        break;
      case 'pleave': {
        this.players.delete(m.id);
        const r = this.remotes.get(m.id);
        if (r) { r.dispose(); this.remotes.delete(m.id); }
        this.hud.say(`${m.name} left`);
        break;
      }
      case 'snap':
        if (m.tm) {
          if (this.lastSnapTm && m.tm <= this.lastSnapTm) break; // arrived out of order: older news
          this.lastSnapTm = m.tm;
          // Clock offset = the smallest (arrival − send) seen, i.e. the least-delayed packet;
          // creeps upward slowly in case the connection got permanently slower.
          const off = Date.now() - m.tm;
          netClock.off = this.clockInit ? (off < netClock.off ? off : netClock.off + (off - netClock.off) * 0.01) : off;
          this.clockInit = true;
        }
        this.timeLeft = m.tl;
        this.teamScore = m.ts || null;
        this.zone = m.z || null;
        this.infection = m.inf ?? 0;
        this.tagData = m.tg || null;
        this.pickupData = m.pk || null;
        this.rot = m.rot || null;
        this.flagData = m.fl || null;
        this.domData = m.dom || null;
        let teamsChanged = false;
        for (const id in m.s) {
          const a = m.s[id];
          const pl = this.players.get(id);
          if (pl) {
            pl.k = a[9]; pl.d = a[10]; pl.sc = a[13];
            if (pl.team !== a[12]) { pl.team = a[12]; teamsChanged = true; }
          }
          if (id === this.myId) { if (this.me.alive) this.me.hp = a[8]; }
          else { const r = this.remotes.get(id); if (r) r.setState(a, m.tm || 0); }
        }
        if (teamsChanged) this.refreshColors();
        break;
      case 'spawn': this.respawn(m); break;
      case 'dmg': this.onDamaged(m); break;
      case 'hitc':
        this.hud.hit(m.kill ? 'kill' : m.head ? 'head' : null, !!m.head);
        break;
      case 'kill': this.onKill(m); break;
      case 'shot': this.remoteShot(m); break;
      case 'fx': this.remoteFx(m); break;
      case 'proj': {
        const p = new THREE.Vector3(...m.p);
        this.spawnProjectile(m.k, p, new THREE.Vector3(...m.v), false, m.id, m.pid);
        const W = WEAPONS[m.k];
        this.posSound(W && W.type === 'proj' ? sfx[m.k] || sfx.gl : sfx.throw, p, 0.9);
        const r = this.remotes.get(m.id);
        if (r && W) { if (W.type === 'proj') r.fire(); else r.throwAnim(); }
        break;
      }
      case 'boom': this.remoteBoom(m); break;
      case 'end':
        if (!this.matchOver && this.playedThisMatch) this.trackMatchEnd(m);
        this.playedThisMatch = false;
        this.matchOver = true;
        {
          const now = performance.now();
          this.endInfo = {
            scores: m.scores, until: now + m.next * 1000, nextMap: m.nextMap, title: m.title, at: now, mvp: m.mvp || null,
            vote: m.vote ? { maps: m.vote.maps, counts: m.vote.counts, opensAt: now + m.vote.opens, endsAt: now + m.vote.ends, winner: m.vote.winner, mine: null } : null,
          };
          // Free the mouse so the vote can be clicked (without opening the pause menu).
          if (this.endInfo.vote && document.pointerLockElement === this.canvas) document.exitPointerLock();
        }
        this.me.alive = false;
        this.deathInfo = null;
        this.endDeathSpectate();
        this.hud.death(false);
        this.hud.reloading(false);
        this.hud.scope(false);
        break;
      case 'votes': // live vote counts
        if (this.endInfo && this.endInfo.vote) this.endInfo.vote.counts = m.counts;
        break;
      case 'voted': // the vote closed: winning map
        if (this.endInfo && this.endInfo.vote) { this.endInfo.vote.winner = m.map; this.endInfo.vote.counts = m.counts; this.endInfo.nextMap = m.map; }
        break;
      case 'start':
        this.streaks.clear();
        this.matchXp = 0;
        this.rankRes = null;
        // The mouse was freed for the map vote: offer "Resume" to get back in.
        if (!this.locked && !this.touch && !this.padMode && this.onUnlock && this.endInfo) setTimeout(() => this.onUnlock && !this.locked && this.onUnlock(), 0);
        this.loadMap(m.map);
        this.matchOver = false;
        this.endInfo = null;
        this.hud.end(false);
        for (const p of this.players.values()) { p.k = 0; p.d = 0; p.sc = 0; }
        this.hud.say(`${MODES[m.mode] ? MODES[m.mode].name.toUpperCase() : ''} · ${MAPS[m.map] ? MAPS[m.map].name.toUpperCase() : ''}`);
        break;
    }
  }

  respawn(m) {
    const me = this.me;
    this.endDeathSpectate(); // back to your own view
    me.pos.set(m.p[0], m.p[1], m.p[2]);
    me.vel.set(0, 0, 0);
    me.yaw = m.yaw;
    me.pitch = 0;
    me.alive = true;
    me.hp = 100;
    me.crouch = false;
    me.h = STAND_H;
    me.eye = EYE_STAND;
    this.slideT = 0; this.stepSmooth = 0; this.coyote = 0; this.jumpBuf = 0;
    me.hp = this.maxHp = m.hp || 100;
    const pl = this.players.get(this.myId);
    if (pl && m.team !== undefined) pl.team = m.team;
    this.refreshColors();
    this.playedThisMatch = true;
    this.setLoadout(m.l || this.nextLoadout);
    if (m.ammo) Object.assign(this.ammo, m.ammo); // e.g. One in the Chamber's single bullet
    this.recoil = 0;
    this.deathInfo = null;
    this.hud.death(false);
    this.vm.setVisible(true);
  }

  setLoadout(l) {
    this.loadout = l.slice();
    this.ammo = {};
    for (const id of this.loadout) this.ammo[id] = this.W(id).mag || 0;
    this.util = this.utilId ? WEAPONS[this.utilId].count : 0;
    this.slot = -1;
    this.reloadT = 0;
    this.fireCd = 0;
    this.burstLeft = 0;
    this.pendingMelee = this.pendingThrow = null;
    this.lastSlot = 1;
    this.returnSlot = -1;
    this.switchSlot(0, true);
  }

  onDamaged(m) {
    const me = this.me;
    if (!me.alive) return;
    me.hp = m.hp;
    if (m.imp) {
      me.vel.x += m.imp[0]; me.vel.y += m.imp[1]; me.vel.z += m.imp[2];
      if (m.imp[1] > 0) me.onGround = false;
    }
    let angle = null;
    const src = this.remotes.get(m.from);
    if (src) {
      const ang = Math.atan2(-(src.pos.x - me.pos.x), -(src.pos.z - me.pos.z));
      angle = -(ang - me.yaw);
    }
    this.flinch = Math.min(1, this.flinch + 0.6);
    // Damage arcs remember where the hit came from and follow your view as you turn.
    const taken = Math.max(0, (this.lastHp ?? 100) - m.hp);
    this.lastHp = m.hp;
    if (src) {
      this.dmgArcs = (this.dmgArcs || []).filter((a) => a.id !== m.from);
      this.dmgArcs.push({ id: m.from, x: src.pos.x, z: src.pos.z, t: performance.now(), k: Math.min(1, 0.35 + taken / 60) });
      if (this.dmgArcs.length > 4) this.dmgArcs.shift();
    }
    this.hud.damage(angle, taken);
    sfx.hurt(0.7);
  }

  onKill(m) {
    const pk = this.players.get(m.k), pv = this.players.get(m.v);
    const k = pk && { ...pk, color: this.colorFor(pk) }, v = pv && { ...pv, color: this.colorFor(pv) };
    if (v) this.hud.feed(k, v, m.w, m.head, m.k === this.myId || m.v === this.myId);
    // Everyone's current kill streak (for SHUTDOWN medals), from the kills we've seen.
    const victimStreak = this.streaks.get(m.v) || 0;
    if (m.k !== m.v) this.streaks.set(m.k, (this.streaks.get(m.k) || 0) + 1);
    this.streaks.set(m.v, 0);
    if (m.k === this.myId && m.v !== this.myId && v) {
      const t = performance.now();
      this.lifeKills = (this.lifeKills || 0) + 1;
      this.multi = t - (this.lastKillAt || 0) < 4000 ? (this.multi || 1) + 1 : 1;
      this.lastKillAt = t;
      this.hud.killBanner(v.name, v.color, !!m.head);
      this.hud.hit('kill', !!m.head);
      if (m.head) sfx.headKill(0.9); else sfx.kill(0.8);
      if (!this.teams || (pk && pv && pk.team !== pv.team)) {
        const practice = this.rules.mode === 'practice'; // targets don't count for missions
        const W = WEAPONS[m.w];
        const revenge = m.v === this.lastKiller;
        const dist = this.remotes.get(m.v) ? this.remotes.get(m.v).pos.distanceTo(this.me.pos) : 0;
        const explosive = ['gl', 'rocket', 'flare', 'frag', 'sticky', 'vortex'].includes(m.w);
        this.hud.medals(medalsFor({
          head: !!m.head, melee: !!W && W.type === 'melee', explosive, dist, revenge,
          multi: this.multi, streak: this.lifeKills, firstBlood: !!m.fb, victimStreak,
        }), { longshot: `${Math.round(dist)} m` });
        if (revenge) this.lastKiller = null; // one REVENGE per death
        if (!practice) track.kill({
          weapon: m.w, weaponType: W && W.type, head: !!m.head, mode: this.rules.mode,
          secondary: SLOTS[1].includes(m.w),
          multi: this.multi, revenge, air: !this.me.onGround, lowHp: this.me.hp <= 25,
          silent: !!(W && W.type === 'gun' && this.W(m.w).quiet),
          dist, explosive,
          juggernaut: this.rules.mode === 'juggernaut' && pv && pv.team === JUGG_TEAM,
        });
      }
    }
    if (m.v === this.myId) track.died();
    const killerPos = m.k === this.myId ? this.me.pos : this.remotes.get(m.k)?.pos;
    if (m.v === this.myId) {
      this.me.alive = false;
      this.headStreak = 0;
      this.lifeKills = 0;
      if (m.k !== this.myId) this.lastKiller = m.k; // for revenge kills
      this.deathInfo = {
        killer: m.k !== this.myId ? m.k : null, w: m.w, at: performance.now(), head: !!m.head && m.k !== this.myId,
        pos: this.me.pos.clone(), eye: this.me.eye, roll: Math.random() > 0.5 ? 1 : -1,
      };
      this.vm.setVisible(false);
      this.hud.scope(false);
      this.mouse.left = false;
      this.reloadT = 0;
      this.pendingMelee = this.pendingThrow = null;
      this.hud.reloading(false);
    } else {
      const r = this.remotes.get(m.v);
      if (r) {
        if (m.head) { r.headPos(_c); this.fx.blood(_c); this.fx.blood(_c); } else this.fx.blood(r.center(_c));
        const DW = WEAPONS[m.w] || {};
        const force = ['gl', 'rocket', 'flare', 'frag', 'sticky', 'vortex'].includes(m.w) ? 8 : DW.pellets > 1 ? 4.5 : ['sniper', 'amr', 'railgun', 'dmr', 'handcannon', 'revolver'].includes(m.w) ? 4 : DW.type === 'melee' ? 2.6 : 2;
        r.die(killerPos && killerPos !== r.pos ? killerPos : null, !!m.head, force);
        if (m.head) r.popHat(); // in case a snapshot already started the death
      }
    }
  }

  // Touch aim assist: pick the visible enemy nearest the crosshair, then (scaled by strength)
  // pull toward them while firing / aiming and snap a little when aiming starts.
  aimAssist(dt) {
    const me = this.me, k = opts.aimAssistStrength;
    const cp = Math.cos(me.pitch);
    const fx = -Math.sin(me.yaw) * cp, fy = Math.sin(me.pitch), fz = -Math.cos(me.yaw) * cp;
    const eye = _aE.set(me.pos.x, me.pos.y + me.eye, me.pos.z);
    let best = null;
    for (const r of this.remotes.values()) {
      if (!r.alive || this.isAlly(r)) continue;
      const t = _aT.set(r.pos.x, r.pos.y + 1.15 * (1 - r.crouch * 0.2), r.pos.z);
      const dx = t.x - eye.x, dy = t.y - eye.y, dz = t.z - eye.z;
      const dist = Math.hypot(dx, dy, dz);
      if (dist < 0.5 || dist > 70) continue;
      const ang = Math.acos(clamp((dx * fx + dy * fy + dz * fz) / dist, -1, 1));
      const limit = Math.atan(0.55 / dist) + 0.035; // roughly the target's half-width plus a bit
      if (ang > limit * 2.6 || (best && ang / limit >= best.ang / best.limit)) continue;
      if (!this.los(eye, t) || (this.fx.smokes.length && this.fx.blocked(eye, t))) continue;
      best = { r, ang, limit, yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) };
    }
    this.assist = best;
    const aimingNow = this.mouse.right;
    if (best) {
      const dYaw = wrapAngle(best.yaw - me.yaw), dPitch = best.pitch - me.pitch;
      if (aimingNow && !this.wasAiming) {
        me.yaw += dYaw * 0.55 * k; // snap on aim-down-sights
        me.pitch += dPitch * 0.55 * k;
      } else if (this.mouse.left || aimingNow) {
        const f = Math.min(1, dt * 7 * k); // track while shooting / aiming
        me.yaw += dYaw * f;
        me.pitch += dPitch * f;
      }
      me.pitch = clamp(me.pitch, -1.5, 1.5);
    }
    this.wasAiming = aimingNow;
  }

  // Mission progress from the end-of-match result.
  // Practice Range: show the damage we just dealt over the target.
  showHit(vid, dmg, head) {
    if (this.rules.mode !== 'practice' || !dmg) return;
    const r = this.remotes.get(vid);
    if (!r) return;
    if (head) r.headPos(_c); else r.center(_c);
    this.hud.dmgNum(_c, Math.round(dmg), !!head);
  }

  // End-of-match map vote (one vote, final). i: 0..2
  voteMap(i) {
    const v = this.endInfo && this.endInfo.vote, now = performance.now();
    if (!v || v.winner || v.mine !== null || now < v.opensAt || now >= v.endsAt || !v.maps[i]) return;
    v.mine = i;
    this.net.send({ t: 'vote', i });
    sfx.beep(0.4);
  }

  trackMatchEnd(m) {
    const mode = this.rules.mode, me = this.players.get(this.myId), team = me ? me.team : 0;
    let won;
    if (MODES[mode].redBlue) won = (team === 1 && m.title === 'RED TEAM WINS') || (team === 2 && m.title === 'BLUE TEAM WINS');
    else if (mode === 'infection') won = (team === 2 && m.title === 'ZOMBIES WIN') || (team === 1 && m.title === 'SURVIVORS WIN');
    else won = !!m.scores && m.scores[0] && m.scores[0].id === this.myId;
    const mine = (m.scores || []).find((s) => s.id === this.myId);
    if (this.onMatchTracked) this.onMatchTracked();
    this.rankRes = this.rules.ranked && !this.spectating ? rateMatch(m.scores, this.myId) : null;
    if (this.rankRes && this.rankRes.counted && this.onRanked) this.onRanked(this.rankRes);
    track.matchEnd({
      mode, won, map: this.mapId, teams: !!MODES[mode].redBlue,
      survived: mode === 'infection' && team === 1 && m.title === 'SURVIVORS WIN',
      hillPoints: mode === 'koth' && mine ? mine.sc : 0,
    });
  }

  // ---------- Main loop ----------

  frame() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const gdt = this.active ? dt * this.rules.gameSpeed : dt;
    if (opts.showFps) {
      this.fps.frames++;
      this.fps.acc += (now - this.fps.last || 0) / 1000;
      this.fps.last = now;
      if (this.fps.acc >= 0.5) { this.hud.fps(Math.round(this.fps.frames / this.fps.acc)); this.fps.frames = 0; this.fps.acc = 0; }
    }
    if (this.active) this.update(gdt, now);
    else this.menuCam(now);
    this.watchPerf(dt);
    this.fx.update(gdt);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    if (this.active && this.me.alive && !this.scoped) this.vm.render(this.renderer);
  }

  // Frame-rate watch (in matches): auto resolution steps the resolution down when it's slow and
  // back up when there's room; a slow device also gets one suggestion to try Low-end graphics.
  watchPerf(dt) {
    const p = this.perf;
    if (!this.active || document.hidden) { p.frames = 0; p.acc = 0; return; }
    p.frames++;
    p.acc += dt;
    if (p.acc < 2) return;
    const fps = p.frames / p.acc;
    p.frames = 0; p.acc = 0;
    if (opts.autoRes) {
      const before = this.dynScale;
      if (fps < 42) this.dynScale = Math.max(0.6, this.dynScale - 0.1);
      else if (fps > 57) this.dynScale = Math.min(1, this.dynScale + 0.05);
      if (before !== this.dynScale) this.applyGfx();
    } else if (this.dynScale !== 1) { this.dynScale = 1; this.applyGfx(); }
    p.slow = fps < 28 ? p.slow + 1 : 0;
    if (p.slow >= 3 && this.gfx !== 'potato' && !store.get('slowTipShown', false) && this.onSlow) {
      store.set('slowTipShown', true);
      this.onSlow(Math.round(fps));
    }
  }

  menuCam(now) {
    const t = now * 0.00006;
    const b = MAPS[this.mapId].bounds;
    this.camera.position.set(Math.sin(t) * b * 0.8, b * 0.32, Math.cos(t) * b * 0.55);
    this.camera.lookAt(0, 1.5, 0);
  }

  update(dt, now) {
    if (this.onTick) this.onTick(dt);
    const me = this.me;
    const cam = this.camera;
    const w = this.W(this.curW);

    if (me.alive && !this.matchOver && !this.frozen) this.updateMovement(dt);
    this.assist = null;
    if ((this.touch || this.padMode) && opts.aimAssist && me.alive && !this.matchOver) this.aimAssist(dt);

    // Camera
    this.recoil *= Math.exp(-dt * 9);
    this.shake *= Math.exp(-dt * 6);
    this.flinch *= Math.exp(-dt * 8);
    this.landDip *= Math.exp(-dt * 7);
    const hs = Math.hypot(me.vel.x, me.vel.z);
    _r.set(Math.cos(me.yaw), 0, -Math.sin(me.yaw));
    const strafe = clamp((me.vel.x * _r.x + me.vel.z * _r.z) / WALK, -1.3, 1.3);
    if (me.alive) {
      const adsK = this.ads ? 0.3 : 1;
      if (me.onGround) this.bobPhase += dt * hs * 1.9;
      const bob = me.onGround ? Math.min(1, hs / 6) * adsK * opts.bobbing : 0;
      const slideRoll = this.slideT > 0 ? 0.045 : 0;
      this.roll += (-strafe * 0.018 * adsK + slideRoll - this.roll) * Math.min(1, dt * 8);
      cam.position.set(me.pos.x, me.pos.y + this.stepSmooth + me.eye - this.landDip + Math.sin(this.bobPhase * 2) * 0.022 * bob, me.pos.z);
      cam.rotation.set(
        me.pitch + this.recoil + this.flinch * 0.035 + (Math.random() - 0.5) * this.shake * 0.1,
        me.yaw + (Math.random() - 0.5) * this.shake * 0.1,
        this.roll + Math.sin(this.bobPhase) * 0.004 * bob + this.flinch * 0.02);
    } else if (this.spectating) {
      this.specCam(dt);
    } else if (this.deathInfo) {
      if (!this.deathSpectate(dt, now)) { this.endDeathSpectate(); this.deathCam(dt, now); }
    } else {
      this.menuCam(now); // waiting to spawn (e.g. joined mid-round in Last Man Standing)
    }
    cam.updateMatrixWorld();

    if (me.alive && !this.matchOver && !this.frozen) this.updateWeapon(dt);
    else { this.ads = false; this.scoped = false; }

    // ADS zoom keeps the same ratio to the chosen FOV; sniper scopes use their own fixed zoom.
    let fovTarget = opts.fov;
    if (this.ads) fovTarget = w.scope ? (this.vm.adsT > 0.85 ? w.zoom : 50) : (w.adsFov || (w.type === 'proj' ? 62 : 55)) * (opts.fov / 75);
    fovTarget *= this.fovK;
    if (Math.abs(cam.fov - fovTarget) > 0.05) {
      cam.fov += (fovTarget - cam.fov) * Math.min(1, dt * (w.scope ? 20 : 14));
      cam.updateProjectionMatrix();
    }
    this.scoped = me.alive && this.ads && !!w.scope && this.vm.adsT > 0.85;
    this.hud.scope(this.scoped);

    this.sendAcc += dt;
    if (this.sendAcc >= SEND_INTERVAL && me.alive) {
      this.sendAcc = 0;
      const a = (this.reloadT > 0 ? 1 : 0) | (this.sprinting ? 2 : 0) | (me.onGround ? 0 : 4);
      this.stSeq = (this.stSeq || 0) + 1;
      this.net.send({ t: 'st', q: this.stSeq, p: arr(me.pos), y: r2(me.yaw), pi: r2(me.pitch), w: this.curW, c: me.crouch ? 1 : 0, a });
    }

    for (const r of this.remotes.values()) {
      r.update(dt);
      if (r.stepped && r.crouch < 0.5 && r.pos.distanceTo(cam.position) < 32) this.posSound(this.stepSound(r.pos.x, r.pos.y, r.pos.z), r.pos, r.sprint > 0.5 ? 0.6 : 0.42);
      // Enemies reloading nearby can be heard.
      const rl = !!(r.flags & 1);
      if (rl && !r.wasReloading && r.alive && r.pos.distanceTo(cam.position) < 18) this.posSound(sfx.magOut, r.pos, 0.5);
      r.wasReloading = rl;
      if (r.tag.visible && this.fx.smokes.length && this.fx.blocked(cam.position, r.headPos(_c))) r.tag.visible = false;
    }
    this.updateProjectiles(dt);
    this.updateZone(now);
    this.updateTags(now);
    this.updatePickups(now);
    this.updateFlags(now);
    this.updateDom(now);

    this.vm.update(dt, {
      speed: hs, strafe, vy: me.vel.y, ads: this.ads, sprint: this.sprinting, onGround: me.onGround,
      reload: this.reloadT > 0 && w.reload ? 1 - this.reloadT / w.reload : -1,
      hasUtil: this.util > 0,
      spin: w.spinup ? this.spin / w.spinup : 0,
      bob: opts.bobbing,
      adsSpeed: w.adsSpeed || 1,
    });
    this.updateHud(dt, now);
    this.hud.updateDmgNums(this.camera, dt);
  }

  // Spectating staff: follow a player from behind (mouse orbits, Q / E or click to switch), or
  // F for a free camera (WASD, Space up, Ctrl / C down, Shift faster).
  // list: who can be watched (default: everyone alive); free: allow the F free camera.
  specCam(dt, list = null, free = true) {
    const me = this.me, cam = this.camera, k = this.keys;
    const edge = (code) => { const on = k.has(code), was = this.specKeys.has(code); if (on) this.specKeys.add(code); else this.specKeys.delete(code); return on && !was; };
    if (!this.specKeys) this.specKeys = new Set();
    if (!list) list = [...this.remotes.values()].filter((r) => r.alive).sort((a, b) => a.id.localeCompare(b.id));
    if (!free) this.specFree = false;
    else if (edge('KeyF')) { this.specFree = !this.specFree; this.specPos = cam.position.clone(); }
    const click = this.mouse.left && !this.specClick;
    this.specClick = this.mouse.left;
    if (edge('KeyE') || click) this.specIdx = (this.specIdx || 0) + 1;
    if (edge('KeyQ')) this.specIdx = (this.specIdx || 0) - 1;
    const cp = Math.cos(me.pitch);
    if (this.specFree || !list.length) {
      if (!this.specPos) this.specPos = cam.position.clone();
      const sp = (this.down('sprint') ? 22 : 9) * dt;
      const f = (this.down('forward') ? 1 : 0) - (this.down('back') ? 1 : 0), s = (this.down('right') ? 1 : 0) - (this.down('left') ? 1 : 0);
      const u = (this.down('jump') ? 1 : 0) - (this.down('crouch') ? 1 : 0);
      this.specPos.x += (-Math.sin(me.yaw) * cp * f + Math.cos(me.yaw) * s) * sp;
      this.specPos.y += (Math.sin(me.pitch) * f + u) * sp;
      this.specPos.z += (-Math.cos(me.yaw) * cp * f - Math.sin(me.yaw) * s) * sp;
      cam.position.copy(this.specPos);
      cam.rotation.set(me.pitch, me.yaw, 0);
      this.specTarget = null;
    } else {
      const i = ((this.specIdx || 0) % list.length + list.length) % list.length;
      const r = list[i], d = 3.4;
      _c.set(r.pos.x, r.pos.y + 1.5, r.pos.z);
      cam.position.set(_c.x + Math.sin(me.yaw) * cp * d, _c.y - Math.sin(me.pitch) * d + 0.4, _c.z + Math.cos(me.yaw) * cp * d);
      cam.lookAt(_c);
      this.specTarget = r;
    }
    // The minimap and sounds follow the camera.
    me.pos.set(cam.position.x, cam.position.y - 1.6, cam.position.z);
    const p = this.specTarget && this.players.get(this.specTarget.id);
    this.hud.spectate(p ? p.name : null, this.specFree || !list.length, !free);
  }

  // After dying: watch the killer, then other living players (teammates only in team modes)
  // until you respawn. Only when there's time for it — quick respawns keep the normal death cam.
  deathSpectate(dt, now) {
    const di = this.deathInfo;
    const mine = this.players.get(this.myId);
    const out = this.rules.mode === 'lms' && mine && mine.sc <= 0;
    const left = this.rules.respawn - (now - di.at) / 1000;
    if ((now - di.at) < 2600 || (!out && left < 1.2)) return false;
    const myTeam = this.myTeam;
    const list = [...this.remotes.values()].filter((r) => {
      if (!r.alive) return false;
      const p = this.players.get(r.id);
      return !this.teams || !p || p.team === myTeam;
    }).sort((a, b) => a.id.localeCompare(b.id));
    if (!list.length) return false;
    if (!this.deathSpecOn) {
      this.deathSpecOn = true;
      this.hud.el.classList.add('dspec');
      const ki = list.findIndex((r) => r.id === di.killer); // start on the killer when we may watch them
      this.specIdx = ki >= 0 ? ki : 0;
      this.me.pitch = -0.25;
    }
    const keep = this.me.pos.clone();
    this.specCam(dt, list, false);
    this.me.pos.copy(keep); // stay where we died (radar, sounds)
    return true;
  }

  endDeathSpectate() {
    if (!this.deathSpecOn) return;
    this.deathSpecOn = false;
    this.hud.el.classList.remove('dspec');
  }
  deathCam(dt, now) {
    const di = this.deathInfo, cam = this.camera;
    const t = (now - di.at) / 1000;
    const fall = Math.min(1, t / 0.45);
    const ease = fall * fall;
    cam.position.set(di.pos.x, di.pos.y + di.eye - (di.eye - 0.35) * ease, di.pos.z);
    const killer = di.killer && this.remotes.get(di.killer);
    if (killer && t > 0.9) {
      _m4.lookAt(cam.position, _c.set(killer.pos.x, killer.pos.y + 1.2, killer.pos.z), UP);
      _q.setFromRotationMatrix(_m4);
      cam.quaternion.slerp(_q, Math.min(1, dt * 3));
    } else {
      cam.rotation.set(this.me.pitch * (1 - ease) - 0.2 * ease, this.me.yaw, di.roll * 0.9 * ease);
    }
  }

  updateMovement(dt) {
    const me = this.me, k = this.keys, w = this.W(this.curW);
    let f = (this.down('forward') ? 1 : 0) - (this.down('back') ? 1 : 0);
    let s = (this.down('right') ? 1 : 0) - (this.down('left') ? 1 : 0);
    let analog = 1;
    if (this.joy.x || this.joy.y) { // touch joystick or controller left stick
      f = -this.joy.y; s = this.joy.x;
      analog = Math.min(1, Math.hypot(f, s));
    }

    const wantCrouch = this.down('crouch');
    const crouchPressed = wantCrouch && !this.crouchHeld;
    this.crouchHeld = wantCrouch;
    this.slideCd = Math.max(0, this.slideCd - dt);
    const hs0 = Math.hypot(me.vel.x, me.vel.z);
    // Slide: tap crouch while sprinting on the ground.
    if (crouchPressed && this.sprinting && me.onGround && this.slideCd <= 0 && hs0 > WALK * 1.05) {
      this.slideT = SLIDE_TIME;
      this.slideCd = SLIDE_TIME + SLIDE_COOLDOWN;
      const boost = Math.max(hs0, WALK * this.rules.moveSpeed * w.speedMul * SPRINT * SLIDE_BOOST) / hs0;
      me.vel.x *= boost; me.vel.z *= boost;
      sfx.slide(0.5);
    }
    if (this.slideT > 0) {
      this.slideT -= dt;
      // Ends early when you stand up, slow down or jump out of it (jumping keeps the momentum).
      if (!wantCrouch || hs0 < WALK * 0.75) this.slideT = 0;
    }
    const sliding = this.slideT > 0;
    if ((wantCrouch || sliding) && !me.crouch) { me.crouch = true; me.h = CROUCH_H; }
    else if (!wantCrouch && !sliding && me.crouch && !overlap(me.pos.x, me.pos.y, me.pos.z, PLAYER_R, STAND_H)) { me.crouch = false; me.h = STAND_H; }
    me.eye += ((me.crouch ? (sliding ? EYE_CROUCH - 0.12 : EYE_CROUCH) : EYE_STAND) - me.eye) * Math.min(1, dt * 14);

    const touchSprint = (this.touch || (this.padMode && opts.padAutoSprint)) && f > 0.9 && Math.abs(s) < 0.45;
    this.sprinting = (this.down('sprint') || touchSprint) && f > 0 && !me.crouch && !this.ads && !this.mouse.left && this.reloadT <= 0;
    const speed = WALK * this.rules.moveSpeed * w.speedMul * (this.sprinting ? SPRINT : 1) * (me.crouch ? CROUCH_SPD : 1) * (this.ads ? 0.7 : 1);
    const sy = Math.sin(me.yaw), cy = Math.cos(me.yaw);
    let wx = -sy * f + cy * s, wz = -cy * f - sy * s;
    const len = Math.hypot(wx, wz);
    if (len > 0) { wx /= len; wz /= len; }
    if (sliding && me.onGround) {
      // Momentum bleeds off; input only steers a little.
      const fr = Math.exp(-dt * SLIDE_FRICTION);
      me.vel.x *= fr; me.vel.z *= fr;
      const steer = 1 - Math.exp(-dt * 2);
      const hs = Math.hypot(me.vel.x, me.vel.z);
      if (len > 0) { me.vel.x += (wx * hs - me.vel.x) * steer * 0.5; me.vel.z += (wz * hs - me.vel.z) * steer * 0.5; }
    } else {
      // Snappier when stopping or turning than when speeding up.
      const along = len > 0 ? (me.vel.x * wx + me.vel.z * wz) : 0;
      const groundK = len > 0 && along > -0.5 ? 13 : 18;
      const a = me.onGround ? 1 - Math.exp(-dt * groundK) : 1 - Math.exp(-dt * (len > 0 ? 2.5 : 0.4));
      me.vel.x += (wx * speed * analog - me.vel.x) * a;
      me.vel.z += (wz * speed * analog - me.vel.z) * a;
    }

    // Jumping: held Space keeps hopping; a tap just before landing or just after leaving a
    // ledge still counts.
    const jumpDown = this.down('jump');
    if (jumpDown && !this.jumpHeld) this.jumpBuf = JUMP_BUFFER;
    this.jumpHeld = jumpDown;
    this.coyote = me.onGround ? COYOTE : Math.max(0, this.coyote - dt);
    this.jumpBuf = Math.max(0, this.jumpBuf - dt);
    if ((this.jumpBuf > 0 || jumpDown) && this.coyote > 0 && me.vel.y <= 0.5) {
      me.vel.y = JUMP * this.rules.jump;
      me.onGround = false;
      this.coyote = 0;
      this.jumpBuf = 0;
      this.slideT = 0;
      sfx.jump(0.4);
    }
    const wasGround = me.onGround, vyBefore = me.vel.y, yBefore = me.pos.y;
    moveBody(me, dt, me.h);
    // Stairs: the body steps instantly, the camera glides.
    const dy = me.pos.y - yBefore;
    if (wasGround && me.onGround && vyBefore <= 0.01 && Math.abs(dy) > 0.02 && Math.abs(dy) < 0.65) {
      this.stepSmooth = clamp(this.stepSmooth - dy, -0.6, 0.6);
    }
    this.stepSmooth *= Math.exp(-dt * 13);
    if (!wasGround && me.onGround && vyBefore < -3) {
      const kk = clamp((-vyBefore - 3) / 12, 0, 1);
      this.landDip = Math.max(this.landDip, 0.06 + kk * 0.16);
      this.vm.landed(0.4 + kk * 0.6);
      sfx.land(0.3 + kk * 0.4);
    }
    if (me.onGround && me.ground && me.ground.mat === 'pad') {
      me.vel.y = PAD_JUMP * this.rules.jump;
      me.onGround = false;
      sfx.pad(0.7);
    }
    const hs = Math.hypot(me.vel.x, me.vel.z);
    if (me.onGround && hs > 1.5 && !me.crouch) {
      this.stepAcc += dt * hs * 0.36;
      if (this.stepAcc >= 1) { this.stepAcc = 0; this.stepSound(me.pos.x, me.pos.y, me.pos.z)(this.sprinting ? 0.22 : 0.14); }
    }
    if (me.pos.y < (MAPS[this.mapId].voidY !== undefined ? -60 : -20)) me.pos.set(0, 3, 0); // void maps: the host kills you first
  }

  // ---------- Weapons ----------

  // Holster the current weapon, then draw the new one. Switching again mid-way retargets
  // without restarting the whole sequence. `instant` skips both (spawns, quick melee).
  switchSlot(i, instant = false) {
    if (i === this.slot || i < 0 || i >= this.loadout.length) return;
    if (i === 3 && this.util <= 0) return;
    const prevId = this.slot >= 0 ? this.curW : null;
    if (this.slot >= 0 && this.slot !== 3) this.lastSlot = this.slot;
    this.slot = i;
    this.reloadT = 0;
    this.burstLeft = 0;
    this.spin = 0;
    this.returnSlot = -1;
    const id = this.curW, w = this.W(id);
    if (instant || !prevId) {
      this.switchT = 0;
      this.vm.equip(id, { drop: 0, raise: prevId ? 0 : 0.3 });
    } else {
      // Still in the middle of drawing something: the holster is quicker.
      const drop = this.switchT > 0 ? 0.08 : Math.min(0.22, WEAPONS[prevId].switch * 0.45);
      this.switchT = drop + w.switch;
      this.vm.equip(id, { drop, raise: w.switch });
      sfx.equip(0.35);
    }
    this.hud.weaponChanged();
  }

  // Q: back to the previous weapon.
  swapLast() {
    let s = this.lastSlot;
    if (s === this.slot || s < 0 || s >= this.loadout.length) s = this.slot === 0 ? 1 : 0;
    this.switchSlot(s);
  }

  // Mobile swap button: toggle between the two guns (melee/utility have their own buttons).
  swapGuns() {
    this.switchSlot(this.slot === 0 ? 1 : 0);
  }

  startReload() {
    const id = this.curW, w = this.W(id);
    if ((w.type !== 'gun' && w.type !== 'proj') || this.reloadT > 0 || this.switchT > 0) return;
    if (MODES[this.rules.mode].noReload) return;
    if (this.ammo[id] >= w.mag) return;
    this.reloadT = w.reload;
    this.burstLeft = 0;
    this.vm.cancelInspect();
    this.reloadStage = 0;
    sfx.magOut(0.55);
  }

  quickThrow() {
    if (!this.utilId || this.util <= 0 || this.fireCd > 0 || this.switchT > 0 || this.pendingThrow) return;
    this.reloadT = 0;
    this.throwUtil(this.slot !== 3);
  }

  // F: swing straight away, then put the previous weapon back in hand.
  quickMelee() {
    const ms = this.meleeSlot();
    if (ms < 0 || (this.fireCd > 0 && this.slot === ms) || this.pendingThrow) return;
    const from = this.slot;
    this.switchSlot(ms, true);
    this.fireCd = 0;
    this.melee();
    if (from !== ms && from >= 0) {
      this.returnSlot = from;
      this.returnT = WEAPONS[this.loadout[ms]].rate * 0.9;
    }
  }

  updateWeapon(dt) {
    const me = this.me;
    this.fireCd -= dt;
    this.switchT -= dt;
    const id = this.curW, w = this.W(id);

    if (this.reloadT > 0) {
      this.reloadT -= dt;
      // Reload sounds in stages: mag out (on start), mag in, then the charging handle / bolt.
      // Shotguns and break-actions load shell by shell instead.
      const p = 1 - this.reloadT / (w.reload || 1), shells = (w.pellets > 1 || id === 'gl') && w.mag > 2;
      if (shells) {
        const n = Math.min(w.mag, 6), k = Math.floor(p * (n + 1));
        if (k > (this.reloadStage || 0) && k <= n) { this.reloadStage = k; sfx.shell(0.5); }
      } else if (p > 0.55 && (this.reloadStage || 0) < 1) { this.reloadStage = 1; sfx.magIn(0.6); }
      else if (p > 0.82 && this.reloadStage < 2) { this.reloadStage = 2; sfx.rack(0.55); }
      if (this.reloadT <= 0) { this.reloadT = 0; this.ammo[id] = w.mag; }
    }
    if (this.autoSwitchT > 0) {
      this.autoSwitchT -= dt;
      if (this.autoSwitchT <= 0 && this.slot === 3 && this.util === 0) this.switchSlot(this.lastSlot >= 0 ? this.lastSlot : 0);
    }
    if (this.returnSlot >= 0) {
      this.returnT -= dt;
      // Swinging again (melee()) extends the window; otherwise go back to the weapon we came from.
      if (this.returnT <= 0 && !this.pendingMelee) {
        const s = this.returnSlot;
        this.returnSlot = -1;
        this.switchSlot(s);
      }
    }
    this.wheelCd -= dt;
    if (this.cycleSfxT > 0) {
      this.cycleSfxT -= dt;
      if (this.cycleSfxT <= 0) sfx.cycle(0.5);
    }
    if (this.pendingMelee) {
      this.pendingMelee.t -= dt;
      if (this.pendingMelee.t <= 0) { this.resolveMelee(this.pendingMelee.w); this.pendingMelee = null; }
    }
    if (this.pendingThrow) {
      this.pendingThrow.t -= dt;
      if (this.pendingThrow.t <= 0) { this.releaseThrow(this.pendingThrow.id); this.pendingThrow = null; }
    }

    this.ads = this.mouse.right && (w.type === 'gun' || w.type === 'proj') && this.reloadT <= 0 && this.switchT <= 0;
    const hs = Math.hypot(me.vel.x, me.vel.z);
    const base = w.spread + w.moveSpread * Math.min(1, hs / WALK) + (me.onGround ? 0 : 0.04);
    const adsMul = w.scope ? (this.scoped ? 0 : 1) : this.ads ? w.adsMul : 1;
    this.spread = base * adsMul * (me.crouch ? 0.8 : 1);

    if (this.burstLeft > 0) {
      this.burstT -= dt;
      if (this.burstT <= 0) {
        if (this.ammo[id] > 0 && this.reloadT <= 0) { this.fireRound(id, w); this.burstLeft--; this.burstT = w.burstGap; }
        else this.burstLeft = 0;
      }
    }

    // Minigun: barrels spin up while the trigger is held.
    if (w.spinup) {
      const want = this.mouse.left && this.reloadT <= 0 && this.switchT <= 0;
      const before = this.spin;
      this.spin = want ? Math.min(w.spinup, this.spin + dt) : Math.max(0, this.spin - dt * 0.8);
      if (want && before === 0) sfx.cycle(0.4);
    } else this.spin = 0;

    if (this.mouse.left && (!w.spinup || this.spin >= w.spinup)) this.tryFire();

    if ((w.type === 'gun' || w.type === 'proj') && this.ammo[id] === 0 && this.reloadT <= 0 && this.fireCd <= 0 && this.switchT <= 0 && this.burstLeft === 0) {
      // No reloading in One in the Chamber: out of bullets means knife.
      if (MODES[this.rules.mode].noReload) { const ms = this.meleeSlot(); if (ms >= 0) this.switchSlot(ms); }
      else this.startReload();
    }
  }

  tryFire() {
    const id = this.curW, w = this.W(id);
    if (this.fireCd > 0 || this.switchT > 0 || this.reloadT > 0 || this.burstLeft > 0 || this.pendingThrow) return;
    if (!w.auto && this.firedThisPress) return;
    this.firedThisPress = true;
    if (w.type === 'melee') return this.melee();
    if (w.type === 'throw') return this.throwUtil(false);
    if (this.ammo[id] <= 0) { sfx.empty(0.6); this.fireCd = 0.25; return; }
    this.fireCd = w.rate;
    this.fireRound(id, w);
    if (w.burst) { this.burstLeft = w.burst - 1; this.burstT = w.burstGap; }
    if (w.cycle) this.cycleSfxT = w.cycle === 'bolt' ? 0.35 : 0.2;
  }

  fireRound(id, w) {
    if (!this.rules.infiniteAmmo) this.ammo[id]--;
    this.recoil += w.recoil * (this.ads ? 0.6 : 1);
    this.me.yaw += (Math.random() - 0.5) * w.recoil * 0.4;
    this.vm.fire(w);
    sfx[id](w.quiet ? 0.3 : 0.75); // suppressed: much quieter, no flash
    const muzzle = this.scoped ? this.camera.position.clone().addScaledVector(this.camera.getWorldDirection(_d), 0.4).addScaledVector(UP, -0.1)
      : this.vm.muzzleWorld(this.camera, new THREE.Vector3());
    if (!w.quiet) this.fx.muzzleFlash(muzzle);
    if (w.type === 'proj') this.launchProjectile(id);
    else this.hitscan(id, w, muzzle);
  }

  camBasis() {
    const cam = this.camera;
    cam.getWorldDirection(_f);
    _r.set(1, 0, 0).applyQuaternion(cam.quaternion);
    _u.set(0, 1, 0).applyQuaternion(cam.quaternion);
  }

  hitscan(id, w, muzzle) {
    const o = this.camera.position;
    this.camBasis();
    const hits = new Map();
    const ends = [];
    for (let i = 0; i < w.pellets; i++) {
      const a = Math.random() * Math.PI * 2, r = this.spread * Math.sqrt(Math.random());
      const dir = _d.copy(_f).addScaledVector(_r, Math.cos(a) * r).addScaledVector(_u, Math.sin(a) * r).normalize();
      const wh = raycast(o.x, o.y, o.z, dir.x, dir.y, dir.z, w.range);
      let maxT = wh ? wh.t : w.range;
      let best = null;
      for (const rp of this.remotes.values()) {
        if (!rp.alive || this.isAlly(rp)) continue;
        for (const hb of rp.hitboxes()) {
          const t = rayAABB(o.x, o.y, o.z, dir.x, dir.y, dir.z, hb.x0, hb.y0, hb.z0, hb.x1, hb.y1, hb.z1, maxT);
          if (t >= 0 && t < maxT) { maxT = t; best = { rp, head: hb.head }; }
        }
      }
      const end = o.clone().addScaledVector(dir, maxT);
      if (best) {
        let dmg = w.dmg * (best.head ? w.head : 1);
        if (w.falloff) {
          const [near, far, min] = w.falloff;
          dmg *= 1 - clamp((maxT - near) / (far - near), 0, 1) * (1 - min);
        }
        const h = hits.get(best.rp.id) || { dmg: 0, head: false };
        h.dmg += dmg;
        h.head = h.head || best.head;
        hits.set(best.rp.id, h);
        this.fx.blood(end);
      } else if (wh && !w.flame) {
        this.fx.impact(end, _n.set(wh.nx, wh.ny, wh.nz));
      }
      if (w.flame) this.fx.flame(muzzle, end); else this.fx.tracer(muzzle, end, w.tracer);
      ends.push(arr(end));
    }
    for (const [vid, h] of hits) {
      this.net.send({ t: 'hit', v: vid, dmg: Math.round(h.dmg), w: id, head: h.head });
      this.showHit(vid, Math.round(h.dmg), h.head);
      this.hud.hit(h.head ? 'head' : null, !!h.head, h.dmg);
      (h.head ? sfx.head : sfx.hit)(0.8);
    }
    this.net.send({ t: 'shot', w: id, o: arr(muzzle), e: ends, q: w.quiet ? 1 : 0 });
  }

  los(a, b) {
    _d.subVectors(b, a);
    const len = _d.length();
    if (len < 1e-3) return true;
    _d.divideScalar(len);
    return !raycast(a.x, a.y, a.z, _d.x, _d.y, _d.z, len - 0.05);
  }

  meleeSlot() { return this.loadout.findIndex((id) => WEAPONS[id].type === 'melee'); }

  melee() {
    // Swing what's in hand if it's a blade (some modes give two), else the melee slot.
    const cur = this.W(this.curW);
    const w = cur.type === 'melee' ? cur : WEAPONS[this.loadout[this.meleeSlot()]] || WEAPONS.knife;
    this.fireCd = w.rate;
    if (this.returnSlot >= 0) this.returnT = w.rate * 0.9;
    this.vm.swing(w.style);
    (sfx[w.id] || sfx.knife)(0.7);
    this.net.send({ t: 'fx', k: 'melee', s: w.style });
    this.pendingMelee = { w, t: w.hitDelay };
  }

  resolveMelee(w) {
    const me = this.me;
    const o = this.camera.position;
    this.camBasis();
    let best = null, bestD = w.range;
    for (const rp of this.remotes.values()) {
      if (!rp.alive || this.isAlly(rp)) continue;
      const hb = rp.hitboxes()[1];
      const cp = _c.set(clamp(o.x, hb.x0, hb.x1), clamp(o.y, hb.y0, hb.y1 + 0.45), clamp(o.z, hb.z0, hb.z1));
      const d = cp.distanceTo(o);
      if (d >= bestD) continue;
      const toward = rp.center(new THREE.Vector3()).sub(o).normalize();
      if (d > 0.6 && toward.dot(_f) < 0.55) continue;
      if (!this.los(o, rp.center(new THREE.Vector3()))) continue;
      best = rp; bestD = d;
    }
    if (!best) return;
    const theirFwdX = -Math.sin(best.yaw), theirFwdZ = -Math.cos(best.yaw);
    const back = theirFwdX * -Math.sin(me.yaw) + theirFwdZ * -Math.cos(me.yaw) > 0.55;
    let imp = null;
    if (w.knockback) {
      const k = w.knockback;
      imp = [r2(_f.x * k), r2(Math.max(0.3, _f.y) * k * 0.4 + 4), r2(_f.z * k)];
    }
    this.net.send({ t: 'hit', v: best.id, dmg: back ? w.backstab : w.dmg, w: w.id, head: back, imp });
    this.showHit(best.id, back ? w.backstab : w.dmg, false);
    this.fx.blood(best.center(_c));
    this.hud.hit(back ? 'head' : null);
    this.shake = Math.max(this.shake, 0.15);
    sfx.stab(0.8);
  }

  // Start position for thrown/launched things, pulled back if it would be inside a wall.
  launchPoint(dist) {
    const o = this.camera.position;
    this.camBasis();
    const wh = raycast(o.x, o.y, o.z, _f.x, _f.y, _f.z, dist + 0.2);
    return o.clone().addScaledVector(_f, wh ? Math.max(0, wh.t - 0.2) : dist);
  }

  launchProjectile(id) {
    const w = WEAPONS[id];
    const p = this.launchPoint(0.5);
    const v = _f.clone();
    if (w.nailSpread) v.x += (Math.random() - 0.5) * w.nailSpread * 2, v.y += (Math.random() - 0.5) * w.nailSpread * 2, v.z += (Math.random() - 0.5) * w.nailSpread * 2;
    v.normalize().multiplyScalar(w.projSpeed);
    const pid = ++this.pid;
    this.spawnProjectile(id, p, v, true, this.myId, pid);
    this.net.send({ t: 'proj', pid, k: id, p: arr(p), v: arr(v) });
  }

  throwUtil(quick) {
    const id = this.utilId, w = WEAPONS[id];
    if (!w) return;
    if (this.util <= 0) { sfx.empty(0.6); return; }
    if (!this.rules.infiniteAmmo) this.util--;
    this.fireCd = w.rate;
    this.vm.throwAnim(quick ? id : null);
    this.pendingThrow = { id, t: THROW_RELEASE };
    if (this.util === 0 && this.slot === 3) this.autoSwitchT = 0.9;
  }

  releaseThrow(id) {
    const w = WEAPONS[id];
    sfx.throw(0.7);
    const p = this.launchPoint(0.5);
    p.y -= 0.1;
    const v = _f.clone().multiplyScalar(w.throwSpeed);
    v.y += w.bolt ? 1 : 3;
    v.addScaledVector(this.me.vel, 0.5);
    const pid = ++this.pid;
    this.spawnProjectile(id, p, v, true, this.myId, pid);
    this.net.send({ t: 'proj', pid, k: id, p: arr(p), v: arr(v) });
  }

  // ---------- Projectiles ----------

  spawnProjectile(kind, pos, vel, local, owner, pid) {
    if (!WEAPONS[kind]) return;
    const mesh = buildProjectile(kind);
    mesh.position.copy(pos);
    this.scene.add(mesh);
    this.projectiles.push({ kind, pos: pos.clone(), vel: vel.clone(), local, owner, pid, age: 0, mesh, rest: false, dead: false, attach: null, beep: 0 });
  }

  // Returns the remote (or local player) a projectile is attached to.
  attachTarget(p) {
    if (!p.attach) return null;
    if (p.attach.id === this.myId) return this.me.alive ? this.me : null;
    const r = this.remotes.get(p.attach.id);
    return r && r.alive ? r : null;
  }

  updateProjectiles(dt) {
    for (const p of this.projectiles) {
      if (p.dead) continue;
      p.age += dt;
      const W = WEAPONS[p.kind];
      if (p.attach) {
        const t = this.attachTarget(p);
        if (t) p.pos.copy(t.pos).add(p.attach.off);
        else { p.attach = null; p.rest = false; p.vel.set(0, 0, 0); }
      }
      if (!p.rest && !p.attach) {
        // impact: explodes or embeds on contact (launchers, bolts, knives); otherwise it bounces.
        const impact = W.type === 'proj' || W.bolt || W.impact;
        p.vel.y -= (W.projGravity ?? BOUNCE_GRAVITY) * dt;
        const step = p.vel.length() * dt;
        const dir = _d.copy(p.vel).normalize();
        const wh = step > 0 ? raycast(p.pos.x, p.pos.y, p.pos.z, dir.x, dir.y, dir.z, step) : null;
        let travel = wh ? wh.t : step;

        let victim = null, head = false;
        if (p.local && (impact || p.kind === 'sticky')) {
          const pad = W.bolt ? 0.04 : 0.1;
          for (const rp of this.remotes.values()) {
            if (!rp.alive || this.isAlly(rp)) continue;
            for (const hb of rp.hitboxes()) {
              const t = rayAABB(p.pos.x, p.pos.y, p.pos.z, dir.x, dir.y, dir.z,
                hb.x0 - pad, hb.y0 - pad, hb.z0 - pad, hb.x1 + pad, hb.y1 + pad, hb.z1 + pad, travel);
              if (t >= 0 && t < travel) { travel = t; victim = rp; head = hb.head; }
            }
          }
        }
        p.pos.addScaledVector(dir, travel);
        if (W.trail && Math.random() < 0.7) this.fx.burst(p.pos, null, '#9a9692', 1, 0.6, 0.12, 0.6);

        if (impact) {
          if (victim) {
            const dmg = Math.round(W.directDmg * (head && W.head ? W.head : 1));
            this.net.send({ t: 'hit', v: victim.id, dmg, w: p.kind, head });
            this.showHit(victim.id, dmg, head);
            this.hud.hit(head || dmg >= 100 ? 'head' : null);
            (head ? sfx.head : sfx.hit)(0.8);
            if (W.bolt) { this.fx.blood(p.pos); this.net.send({ t: 'boom', pid: p.pid, p: arr(p.pos), k: p.kind }); this.removeProjectile(p); }
            else this.explode(p, victim.id);
            continue;
          }
          if (wh) {
            if (W.bolt) {
              // Embed in the surface and stay there for a while.
              p.pos.addScaledVector(dir, 0.08);
              p.rest = true;
              p.vel.set(0, 0, 0);
              this.posSound(sfx.thunk, p.pos, 0.7);
            } else {
              p.pos.addScaledVector(_n.set(wh.nx, wh.ny, wh.nz), 0.15);
              if (p.local) { this.explode(p, null); continue; }
              p.rest = true;
              p.vel.set(0, 0, 0);
            }
          }
          if (p.vel.lengthSq() > 0 && p.mesh.userData.aligned) p.mesh.quaternion.setFromUnitVectors(FWD, dir);
        } else if (p.kind === 'sticky') {
          if (victim) {
            const off = p.pos.clone().sub(victim.pos);
            p.attach = { id: victim.id, off };
            p.rest = true;
            this.net.send({ t: 'fx', k: 'stick', pid: p.pid, v: victim.id, off: arr(off) });
            this.hud.say('STUCK!');
            this.posSound(sfx.bounce, p.pos, 0.8);
          } else if (wh) {
            p.pos.addScaledVector(_n.set(wh.nx, wh.ny, wh.nz), 0.03);
            p.rest = true;
            p.vel.set(0, 0, 0);
            this.posSound(sfx.bounce, p.pos, 0.6);
          }
        } else {
          if (wh) {
            const n = _n.set(wh.nx, wh.ny, wh.nz);
            p.pos.addScaledVector(n, 0.02);
            const vn = p.vel.dot(n);
            p.vel.addScaledVector(n, -1.45 * vn).multiplyScalar(0.65);
            if (Math.abs(vn) > 2) this.posSound(sfx.bounce, p.pos, 0.6);
            if (n.y > 0.7 && p.vel.length() < 1.2) { p.rest = true; p.vel.set(0, 0, 0); }
          }
          p.mesh.rotation.x += dt * p.vel.length() * 2;
        }
      }
      p.mesh.position.copy(p.pos);

      if (p.kind === 'sticky') {
        p.beep -= dt;
        if (p.beep <= 0) { p.beep = Math.max(0.12, 0.45 - p.age * 0.15); this.posSound(sfx.beep, p.pos, 0.5); }
      }
      const life = W.bolt ? 8 : W.type === 'proj' ? 5 : W.fuse;
      if (W.bolt) {
        if (p.age >= life) this.removeProjectile(p);
      } else if (p.local) {
        if (p.age >= life) this.explode(p, null);
      } else if (p.age > life + 1.5) {
        this.removeProjectile(p);
      }
    }
    if (this.projectiles.some((p) => p.dead)) this.projectiles = this.projectiles.filter((p) => !p.dead);
  }

  removeProjectile(p) {
    p.dead = true;
    this.scene.remove(p.mesh);
  }

  boomFx(pos, radius, W = null) {
    if (W && W.pull) {
      // Vortex: a purple implosion rather than a fireball.
      this.fx.burst(pos, null, '#b06bff', 26, 8, 0.09, 0.55);
      this.fx.burst(pos, null, '#e6ccff', 10, 3, 0.06, 0.8);
      this.fx.muzzleFlash(pos);
      this.posSound(sfx.vortex, pos, 1.1);
      return;
    }
    this.fx.explosion(pos, radius);
    this.posSound(sfx.explosion, pos, 1.2);
    const d = this.camera.position.distanceTo(pos);
    this.shake = Math.max(this.shake, clamp(1 - d / 16, 0, 1) * 0.8);
  }

  // Blinds the local player based on distance, line of sight and whether they were facing it.
  flashFx(pos) {
    this.fx.burst(pos, null, '#ffffff', 10, 6, 0.06, 0.3);
    this.fx.muzzleFlash(pos);
    this.posSound(sfx.flashbang, pos, 1.1);
    if (!this.me.alive) return;
    const cam = this.camera.position;
    const d = cam.distanceTo(pos);
    const R = WEAPONS.flash.radius;
    if (d > R || !this.los(pos, cam)) return;
    const facing = this.camera.getWorldDirection(_c).dot(_n.subVectors(pos, cam).normalize());
    const amount = (1 - d / R) * (facing > 0 ? 0.65 + 0.35 * facing : 0.3) + (d < 4 ? 0.3 : 0);
    this.hud.flash(Math.min(1, amount));
  }

  smokeFx(pos) {
    const W = WEAPONS.smoke;
    this.fx.smoke(pos, W.radius, W.smokeTime);
    this.posSound(sfx.hiss, pos, 0.8);
  }

  // Only the thrower computes splash damage, then reports it to the host.
  explode(p, directId) {
    if (p.dead) return;
    this.removeProjectile(p);
    const W = WEAPONS[p.kind], R = W.radius;
    this.net.send({ t: 'boom', pid: p.pid, p: arr(p.pos), k: p.kind });
    if (W.smoke) { this.smokeFx(p.pos); return; }
    if (W.flash) { this.flashFx(p.pos); return; }
    this.boomFx(p.pos, R, W);

    let any = false;
    for (const rp of this.remotes.values()) {
      if (!rp.alive || rp.id === directId || this.isAlly(rp)) continue;
      const c = rp.center(new THREE.Vector3());
      const d = c.distanceTo(p.pos);
      const stuck = p.attach && p.attach.id === rp.id;
      if (d >= R || (!stuck && !this.los(p.pos, c))) continue;
      const k = stuck ? 1 : 1 - d / R;
      const dir = c.clone().sub(p.pos).normalize();
      // Vortex grenades yank players toward the blast instead of throwing them away.
      const push = W.pull ? -11 * (0.4 + k) : 9 * k;
      const imp = [r2(dir.x * push), r2(dir.y * push * 0.3 + 3 * k), r2(dir.z * push)];
      this.net.send({ t: 'hit', v: rp.id, dmg: Math.round(W.splash * k), w: p.kind, imp });
      this.showHit(rp.id, Math.round(W.splash * k), false);
      any = true;
    }
    if (any && !directId) { this.hud.hit(null); sfx.hit(0.8); }

    const me = this.me;
    if (me.alive) {
      const c = new THREE.Vector3(me.pos.x, me.pos.y + 0.9, me.pos.z);
      const d = c.distanceTo(p.pos);
      if (d < R && this.los(p.pos, c)) {
        const k = 1 - d / R;
        const dir = c.sub(p.pos).normalize();
        me.vel.addScaledVector(dir, W.pull ? -11 * (0.4 + k) : 11 * k);
        me.vel.y += 4 * k;
        me.onGround = false;
        this.net.send({ t: 'hit', v: this.myId, dmg: Math.round(W.splash * k * 0.5), w: p.kind });
      }
    }
  }

  remoteBoom(m) {
    const p = this.projectiles.find((q) => q.owner === m.id && q.pid === m.pid);
    if (p) this.removeProjectile(p);
    const kind = m.k || (p ? p.kind : 'gl');
    const W = WEAPONS[kind] || WEAPONS.gl;
    const pos = new THREE.Vector3(...m.p);
    if (W.smoke) this.smokeFx(pos);
    else if (W.flash) this.flashFx(pos);
    else if (W.bolt) this.fx.blood(pos);
    else this.boomFx(pos, W.radius, W);
  }

  remoteShot(m) {
    const o = new THREE.Vector3(...m.o);
    const W = WEAPONS[m.w];
    for (const e of m.e || []) {
      const end = new THREE.Vector3(...e);
      if (W && W.flame) { this.fx.flame(o, end); continue; }
      this.fx.tracer(o, end, W && W.tracer);
      this.fx.impact(end, null);
    }
    if (!m.q) this.fx.muzzleFlash(o); // suppressed guns: no flash, much quieter
    const r = this.remotes.get(m.id);
    if (r) { r.fire(); if (!m.q) r.pingAt = performance.now(); } // loud shots show on the minimap
    if (sfx[m.w]) this.posSound(sfx[m.w], o, m.q ? 0.3 : 0.9);
  }

  remoteFx(m) {
    const r = this.remotes.get(m.id);
    if (m.k === 'melee' && r) {
      r.melee(m.s);
      this.posSound(m.s === 'chop' ? sfx.axe : sfx.knife, r.pos, 0.6);
    } else if (m.k === 'stick') {
      const p = this.projectiles.find((q) => q.owner === m.id && q.pid === m.pid);
      if (p && Array.isArray(m.off)) {
        p.attach = { id: m.v, off: new THREE.Vector3(...m.off) };
        p.rest = true;
        if (m.v === this.myId) this.hud.say('YOU\'RE STUCK!');
      }
    }
  }

  // Sounds in the world: quieter and duller with distance, duller still behind you (so you can tell
  // front from back), and loud ones far away get a short echo.
  posSound(fn, pos, base = 1) {
    const cam = this.camera;
    const d = cam.position.distanceTo(pos);
    let vol = base / (1 + d * 0.09);
    _c.subVectors(pos, cam.position).normalize();
    _r.set(1, 0, 0).applyQuaternion(cam.quaternion);
    const side = _r.x * _c.x + _r.y * _c.y + _r.z * _c.z;
    _r.set(0, 0, -1).applyQuaternion(cam.quaternion);
    const front = _r.x * _c.x + _r.y * _c.y + _r.z * _c.z;
    let lp = 16000 / (1 + d * 0.05);
    if (d > 2 && front < -0.25) { lp *= 0.45; vol *= 0.85; }
    fn(vol, d < 1 ? 0 : side * 0.8, { lp: Math.max(700, lp), echo: base >= 0.9 && d > 22 ? 0.07 + d * 0.0025 : 0 });
  }

  // Footstep sound for whatever is underfoot at (x, y, z).
  stepSound(x, y, z) {
    let mat = null, top = -Infinity;
    for (const b of boxes) {
      if (x < b.x0 || x > b.x1 || z < b.z0 || z > b.z1 || b.y1 > y + 0.15 || b.y1 < y - 0.6 || b.y1 <= top) continue;
      top = b.y1; mat = b.mat;
    }
    if (!mat) return sfx.step;
    if (/grate|stairs|metal|steel|rail|ac|escalator|container|car|hull|hatch|pipe|tank|mast|planeBody/.test(mat)) return sfx.stepMetal;
    if (/wood|deck|dock|roof|palisade|crate|plank|bench|desk|counter|bark|hay/.test(mat)) return sfx.stepWood;
    if (/snow|ice/.test(mat)) return sfx.stepSnow;
    if (/grass|moss|hedge|sand|dirt|jungle|leaf/.test(mat)) return sfx.stepGrass;
    return sfx.step;
  }

  updateZone(now) {
    const z = this.zone;
    this.zoneMesh.visible = !!z && !this.matchOver;
    if (!z) return;
    const [x, y, zz, r, state, holder] = z;
    this.zoneMesh.position.set(x, y + 0.02, zz);
    this.zoneWall.scale.set(r, 3, r);
    this.zoneWall.position.y = 1.5;
    this.zoneRing.scale.set(r, r, 1);
    let color = '#ffffff';
    if (state === 2) color = this.rules.mode === 'hardpoint' ? '#ffb020' : '#ff4040';
    else if (state === 1 && this.rules.mode === 'hardpoint') color = TEAM_COLORS[holder] || '#ffffff';
    else if (state === 1) color = holder === this.myId ? '#4dff9a' : '#ffb020';
    this.zoneWall.material.color.set(color);
    this.zoneRing.material.color.set(color);
    this.zoneWall.material.opacity = 0.12 + Math.sin(now * 0.004) * 0.05;
  }

  // Domination: three zones, each a ring + light wall in its owner's color, a letter above it
  // and an arc showing capture progress.
  updateDom(now) {
    const data = this.domData;
    if (!data) {
      if (this.domObjs) { for (const o of this.domObjs) this.scene.remove(o.g); this.domObjs = null; }
      return;
    }
    if (!this.domObjs) {
      this.domObjs = data.map(([name]) => {
        const g = new THREE.Group();
        const wall = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 40, 1, true),
          new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }));
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.93, 1, 48), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
        ring.rotation.x = -Math.PI / 2;
        const arc = new THREE.Mesh(new THREE.RingGeometry(0.78, 0.9, 48, 1), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
        arc.rotation.x = -Math.PI / 2;
        arc.position.y = 0.01;
        const c = document.createElement('canvas');
        c.width = c.height = 128;
        const x = c.getContext('2d');
        x.fillStyle = 'rgba(8,10,14,0.65)'; x.beginPath(); x.arc(64, 64, 58, 0, 7); x.fill();
        x.fillStyle = '#ffffff'; x.font = 'bold 76px Chakra Petch, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(name, 64, 70);
        const tex = new THREE.CanvasTexture(c);
        const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
        label.scale.set(1.1, 1.1, 1);
        label.renderOrder = 5;
        g.add(wall, ring, arc, label);
        this.scene.add(g);
        return { g, wall, ring, arc, label };
      });
    }
    data.forEach(([, x, y, z, r, owner, prog, contested], i) => {
      const o = this.domObjs[i];
      if (!o) return;
      o.g.position.set(x, y + 0.02, z);
      o.wall.scale.set(r, 2.5, r);
      o.wall.position.y = 1.25;
      o.ring.scale.set(r, r, 1);
      o.arc.scale.set(r, r, 1);
      const color = contested ? (Math.sin(now * 0.012) > 0 ? '#ffb020' : '#ffffff') : owner ? TEAM_COLORS[owner] : '#d8dde2';
      o.wall.material.color.set(color);
      o.ring.material.color.set(color);
      o.label.material.color.set(owner ? TEAM_COLORS[owner] : '#ffffff');
      o.wall.material.opacity = 0.1 + Math.sin(now * 0.004 + i) * 0.04;
      // Progress arc: red fills one way, blue the other.
      const p = Math.abs(prog) / 100;
      o.arc.visible = p > 0.01 && p < 0.999;
      o.arc.material.color.set(prog < 0 ? TEAM_COLORS[1] : TEAM_COLORS[2]);
      o.arc.geometry.setDrawRange(0, Math.round(48 * p) * 6);
      o.label.position.y = 2.9 + Math.sin(now * 0.003 + i) * 0.08;
    });
  }

  // Map pickups: health pack (white box, red cross), ammo crate, power weapon (glowing gold orb).
  updatePickups(now) {
    this.pickupMeshes = this.pickupMeshes || new Map();
    const want = new Set();
    for (const [id, kind, x, y, z] of this.pickupData || []) {
      const key = id + kind;
      want.add(key);
      let m = this.pickupMeshes.get(key);
      if (!m) {
        m = new THREE.Group();
        if (kind === 'hp') {
          m.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.36, 0.36), new THREE.MeshStandardMaterial({ color: '#f2f2f2', roughness: 0.5 })));
          const red = new THREE.MeshStandardMaterial({ color: '#e02424', emissive: '#e02424', emissiveIntensity: 0.6 });
          const a = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.09, 0.38), red), b = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.3, 0.38), red);
          m.add(a, b);
        } else if (kind === 'ammo') {
          m.add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.34, 0.38), new THREE.MeshStandardMaterial({ color: '#4d5a32', roughness: 0.8 })));
          const band = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.08, 0.4), new THREE.MeshStandardMaterial({ color: '#ffb020', emissive: '#ffb020', emissiveIntensity: 0.5 }));
          m.add(band);
        } else {
          const gold = new THREE.MeshStandardMaterial({ color: '#ffd23a', emissive: '#ffb020', emissiveIntensity: 1, metalness: 0.6, roughness: 0.25 });
          m.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.3), gold));
          const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.03, 6, 32), gold);
          ring.rotation.x = Math.PI / 2;
          ring.name = 'ring';
          m.add(ring);
        }
        this.scene.add(m);
        this.pickupMeshes.set(key, m);
      }
      m.position.set(x, y + 0.6 + Math.sin(now * 0.003 + id) * 0.1, z);
      m.rotation.y = now * 0.0015 + id;
      const ring = m.getObjectByName('ring');
      if (ring) ring.scale.setScalar(1 + Math.sin(now * 0.005) * 0.15);
    }
    for (const [key, m] of this.pickupMeshes) {
      if (want.has(key)) continue;
      this.scene.remove(m);
      m.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
      this.pickupMeshes.delete(key);
    }
  }

  // Kill Confirmed dog tags: spinning, bobbing tags in the dropping team's color.
  updateTags(now) {
    const want = new Set();
    for (const [id, x, y, z, team] of this.tagData || []) {
      want.add(id);
      let m = this.tagMeshes.get(id);
      if (!m) {
        m = new THREE.Group();
        const mat = new THREE.MeshStandardMaterial({ color: TEAM_COLORS[team] || '#ffcc33', emissive: TEAM_COLORS[team] || '#ffcc33', emissiveIntensity: 0.6, metalness: 0.5, roughness: 0.3 });
        const plate = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.32, 0.03), mat);
        const chain = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.008, 4, 12), mat);
        chain.position.y = 0.22;
        m.add(plate, chain);
        this.scene.add(m);
        this.tagMeshes.set(id, m);
      }
      m.position.set(x, y + 0.7 + Math.sin(now * 0.004 + id) * 0.08, z);
      m.rotation.y = now * 0.003 + id;
    }
    for (const [id, m] of this.tagMeshes) {
      if (want.has(id)) continue;
      this.scene.remove(m);
      m.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
      this.tagMeshes.delete(id);
    }
  }

  // Capture the Flag: a flag per team (on its stand, dropped, or above the carrier's head)
  // plus a glowing ring at each base.
  updateFlags(now) {
    const data = this.flagData;
    if (!data) {
      if (this.flagObjs) { for (const o of Object.values(this.flagObjs)) { this.scene.remove(o.flag, o.base); } this.flagObjs = null; }
      return;
    }
    if (!this.flagObjs) {
      this.flagObjs = {};
      for (const t of [1, 2]) {
        const color = TEAM_COLORS[t];
        const flag = new THREE.Group();
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2, 6), new THREE.MeshStandardMaterial({ color: '#d0d4d8', metalness: 0.6, roughness: 0.3 }));
        pole.position.y = 1;
        const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 0.03), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.5 }));
        cloth.position.set(0.37, 1.7, 0);
        flag.add(pole, cloth);
        flag.userData.cloth = cloth;
        const base = new THREE.Mesh(new THREE.RingGeometry(2.1, 2.5, 40),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
        base.rotation.x = -Math.PI / 2;
        this.scene.add(flag, base);
        this.flagObjs[t] = { flag, base };
      }
    }
    for (const [t, x, y, z, carrier, state, hx, hy, hz] of data) {
      const o = this.flagObjs[t];
      if (!o) continue;
      o.base.position.set(hx, hy + 0.03, hz);
      let px = x, py = y, pz = z, scale = 1;
      if (state === 1) {
        // Carried: small flag floating over the carrier (us or a remote player).
        const holder = carrier === this.myId ? this.me.pos : this.remotes.get(carrier)?.pos;
        if (holder) { px = holder.x; py = holder.y + 1.7; pz = holder.z; }
        scale = 0.55;
        o.flag.visible = carrier !== this.myId; // don't block our own view
      } else o.flag.visible = true;
      o.flag.position.set(px, py, pz);
      o.flag.scale.setScalar(scale);
      o.flag.rotation.y = now * 0.0015;
      o.flag.userData.cloth.rotation.y = Math.sin(now * 0.006 + t) * 0.3;
    }
  }

  modeBar() {
    const mode = this.rules.mode, me = this.players.get(this.myId);
    if (mode === 'practice') return `PRACTICE RANGE<span class="lim"> · Esc to pick any weapon · targets respawn</span>`;
    if (MODES[mode].redBlue && this.teamScore) {
      // The team scores themselves are in the score strip above; this line only adds objective info.
      let bar = `<span class="lim">${MODES[mode].short} · FIRST TO ${this.rules.scoreLimit}</span>`;
      if (mode === 'ctf' && this.flagData) {
        const st = (t) => { const f = this.flagData.find((d) => d[0] === t); return !f ? '' : f[5] === 1 ? (f[4] === this.myId ? 'YOU HAVE IT' : 'TAKEN') : f[5] === 2 ? 'DROPPED' : 'HOME'; };
        bar = `<span class="red">RED FLAG ${st(1)}</span><span class="lim"> · </span><span class="blue">BLUE FLAG ${st(2)}</span>`;
      }
      if (mode === 'dom' && this.domData) {
        bar = this.domData.map(([n, , , , , owner, , contested]) =>
          `<span class="dom-pip ${owner === 1 ? 'red' : owner === 2 ? 'blue' : ''} ${contested ? 'contested' : ''}">${n}</span>`).join('');
      }
      if (mode === 'hardpoint' && this.zone) {
        const [, , , , state, holder, secs] = this.zone;
        const st = state === 2 ? 'CONTESTED' : state === 1 ? `<span class="${holder === 1 ? 'red' : 'blue'}">${holder === 1 ? 'RED' : 'BLUE'} HOLDS</span>` : 'NEUTRAL';
        bar = `ZONE ${st}<span class="lim"> · MOVES IN ${secs}s</span>`;
      }
      return bar;
    }
    if (mode === 'juggernaut') {
      let j = null;
      for (const p of this.players.values()) if (p.team === JUGG_TEAM) j = p;
      const who = !j ? 'FIRST KILL BECOMES THE JUGGERNAUT' : j.id === this.myId ? '<span class="jugg">YOU ARE THE JUGGERNAUT</span>' : `JUGGERNAUT: <span class="jugg">${esc(j.name)}</span>`;
      return `${who} · FIRST TO ${this.rules.scoreLimit}`;
    }
    if (mode === 'bounty') {
      let b = null;
      for (const p of this.players.values()) if (p.team === JUGG_TEAM) b = p;
      const who = !b ? 'NO BOUNTY YET' : b.id === this.myId ? '<span class="jugg">YOU HAVE THE BOUNTY</span>' : `BOUNTY: <span class="jugg">${esc(b.name)}</span> (+3)`;
      return `${who} · FIRST TO ${this.rules.scoreLimit}`;
    }
    if (mode === 'rotation' && this.rot) {
      const W = WEAPONS[this.rot[0]];
      return `WEAPON: <span class="jugg">${W ? W.name.toUpperCase() : '?'}</span> · CHANGES IN ${this.rot[1]}s · FIRST TO ${this.rules.scoreLimit}`;
    }
    if (mode === 'oitc') {
      const gun = this.loadout[0];
      return `ONE IN THE CHAMBER · BULLETS ${this.ammo[gun] ?? 0} · FIRST TO ${this.rules.scoreLimit}`;
    }
    if (mode === 'lms' && me) {
      let left = 0;
      for (const p of this.players.values()) if (p.sc > 0) left++;
      return `LIVES ${me.sc} · ${left} PLAYER${left === 1 ? '' : 'S'} LEFT`;
    }
    if (mode === 'gungame' && me) {
      const lvl = Math.min(me.sc + 1, GUNGAME_LADDER.length);
      return `LEVEL ${lvl}/${GUNGAME_LADDER.length} · ${WEAPONS[GUNGAME_LADDER[lvl - 1]].name.toUpperCase()}`;
    }
    if (mode === 'koth' && this.zone) {
      const [, , , , state, holder, secs] = this.zone;
      const h = holder && this.players.get(holder);
      const st = state === 2 ? 'CONTESTED' : state === 1 ? `HELD BY ${h ? h.name : '?'}` : 'NEUTRAL';
      return `HILL: ${st} · MOVES IN ${secs}s · YOU ${me ? me.sc : 0}/${this.rules.scoreLimit}`;
    }
    if (mode === 'infection') {
      let s = 0, z = 0;
      for (const p of this.players.values()) if (p.team === 2) z++; else s++;
      if (this.infection > 0) return `INFECTION IN ${this.infection}s`;
      return `<span class="team blue">SURVIVORS ${s}</span><span class="team zombie">ZOMBIES ${z}</span>${me && me.team === 2 ? ' · YOU ARE INFECTED' : ''}`;
    }
    return `${MODES[mode].short} · FIRST TO ${this.rules.scoreLimit}`;
  }

  // ---------- HUD ----------

  // Two-sided score strip around the timer: your team vs theirs, or you vs the best other player.
  scoreStrip() {
    const mode = this.rules.mode, me = this.players.get(this.myId), lim = this.rules.scoreLimit;
    if (!me || mode === 'practice') return null;
    if (MODES[mode].redBlue && this.teamScore) {
      const mineT = me.team === 2 ? 2 : 1, other = 3 - mineT;
      const side = (t, label) => ({ label, score: this.teamScore[t - 1], pct: this.teamScore[t - 1] / lim, color: TEAM_COLORS[t] });
      return { l: side(mineT, mineT === 1 ? 'RED · YOU' : 'BLUE · YOU'), r: side(other, other === 1 ? 'RED' : 'BLUE') };
    }
    if (this.teams || mode === 'infection' || mode === 'lms') return null;
    const total = mode === 'gungame' ? GUNGAME_LADDER.length : lim;
    const val = (p) => (mode === 'gungame' ? Math.min(p.sc + 1, total) : p.sc);
    let best = null;
    for (const p of this.players.values()) if (p.id !== this.myId && (!best || p.sc > best.sc)) best = p;
    const r = best
      ? { label: (best.sc > me.sc ? '1ST · ' : '') + best.name, score: val(best), pct: val(best) / total, color: this.colorFor(best) }
      : { label: '—', score: 0, pct: 0, color: '#8a94a3' };
    return { l: { label: (me.sc >= (best ? best.sc : 0) ? '1ST · ' : '') + 'YOU', score: val(me), pct: val(me) / total, color: '#ffb020' }, r };
  }

  drawRadar() {
    const me = this.me, now = performance.now();
    const blips = [], objs = [];
    for (const r of this.remotes.values()) {
      if (!r.alive) continue;
      const p = this.players.get(r.id);
      if (!p) continue;
      const ally = !!p.team && p.team === this.myTeam && (this.teams || this.rules.mode === 'infection');
      if (ally) { blips.push({ x: r.pos.x, z: r.pos.z, color: '#4fc3ff', kind: 'ally' }); continue; }
      const age = now - (r.pingAt || -1e9);
      if (age < 2500) blips.push({ x: r.pos.x, z: r.pos.z, color: '#ff4a3a', kind: 'enemy', a: age < 1500 ? 1 : 1 - (age - 1500) / 1000 });
    }
    if (this.zone) {
      const [x, , z, r, state, holder] = this.zone;
      const hp = this.rules.mode === 'hardpoint';
      const color = state === 2 ? '#ffb020' : state === 1 ? (hp ? TEAM_COLORS[holder] || '#ffffff' : holder === this.myId ? '#4dff9a' : '#ffb020') : '#ffffff';
      objs.push({ x, z, r, color });
    }
    for (const [n, x, , z, r, owner] of this.domData || []) objs.push({ x, z, r, color: owner ? TEAM_COLORS[owner] : '#d8dde2', label: n });
    for (const [t, x, , z, carrier, state, hx, , hz] of this.flagData || []) {
      objs.push({ x: hx, z: hz, r: 2.3, color: TEAM_COLORS[t] });
      if (state !== 0) {
        const h = state === 1 ? (carrier === this.myId ? me.pos : this.remotes.get(carrier)?.pos) : null;
        objs.push({ x: h ? h.x : x, z: h ? h.z : z, r: 0.9, color: TEAM_COLORS[t], label: '⚑' });
      }
    }
    this.hud.radar(this.mapId, MAPS[this.mapId].bounds, { x: me.pos.x, z: me.pos.z, yaw: me.yaw }, blips, objs);
  }

  updateHud(dt, now) {
    const me = this.me, hud = this.hud;
    const id = this.curW, w = this.W(id);
    hud.health(me.alive ? me.hp : 0, this.maxHp);
    if (!me.alive) this.lastHp = this.maxHp;
    // Damage direction arcs (fade over 1.5 s), angles relative to where you're looking now.
    const arcs = (this.dmgArcs || []).filter((a) => now - a.t < 1500 && me.alive);
    this.dmgArcs = arcs;
    hud.arcs(arcs.map((a) => {
      const ang = Math.atan2(-(a.x - me.pos.x), -(a.z - me.pos.z));
      return { angle: -(ang - me.yaw), alpha: a.k * (1 - (now - a.t) / 1500) };
    }));
    hud.lowPulse(me.alive && me.hp > 0 && me.hp <= this.maxHp * 0.3);
    hud.ammo(id, this.ammo[id] ?? 0, w.mag || 0, this.util);
    hud.slots(this.loadout, this.slot, this.util, this.ammo);
    hud.reloading(this.reloadT > 0 && me.alive, w.reload ? 1 - this.reloadT / w.reload : 0);
    const px = (this.spread / Math.tan((this.camera.fov * Math.PI) / 360)) * (innerHeight / 2);
    hud.spread(Math.min(80, px), this.ads && w.type === 'gun');
    if (opts.minimap && !this.matchOver) this.drawRadar();

    this.hudAcc -= dt;
    if (this.hudAcc > 0) return;
    this.hudAcc = 0.1;
    hud.minimap(opts.minimap);
    hud.timer(this.timeLeft, null);
    hud.strip(this.scoreStrip());
    hud.modeBar(this.modeBar());
    if (this.rules.mode === 'practice') hud.lobby(null, 0, 'Solo · offline');
    else hud.lobby(this.net.code, this.players.size, `${MODES[this.rules.mode].short} · ${MAPS[this.mapId].name}`);
    hud.scoreboard(this.showScores && !this.matchOver, this.players, this.myId, this.rules.mode, (p) => this.colorFor(p));
    if (!me.alive && this.deathInfo && !this.matchOver) {
      const secs = Math.ceil(this.rules.respawn - (now - this.deathInfo.at) / 1000);
      const killer = this.deathInfo.killer && this.players.get(this.deathInfo.killer);
      const mine = this.players.get(this.myId);
      const out = this.rules.mode === 'lms' && mine && mine.sc <= 0;
      const kr = killer && this.remotes.get(killer.id);
      hud.death(true, killer ? killer.name : null, this.deathInfo.w, secs, out ? 'Out of lives · spectating until the next round' : null, this.deathInfo.head,
        killer ? this.colorFor(killer) : '#fff', (kr && kr.cos && kr.cos.banner) || 'standard', killer ? killer.role : null);
    }
    if (this.matchOver && this.endInfo) {
      const next = MAPS[this.endInfo.nextMap];
      const e = this.endInfo, mvp = e.mvp;
      const r = mvp && this.remotes.get(mvp.id);
      hud.end(true, {
        scores: e.scores, myId: this.myId, mode: this.rules.mode, title: e.title, now,
        secs: Math.max(0, Math.ceil((e.until - now) / 1000)), nextMap: next ? next.name : '',
        mvp: mvp && { ...mvp, color: this.players.get(mvp.id) ? this.colorFor(this.players.get(mvp.id)) : mvp.color,
          banner: mvp.id === this.myId ? this.myBanner : r && r.cos && r.cos.banner },
        showMvp: !!mvp && now - e.at < 4500,
        vote: e.vote, onVote: (i) => this.voteMap(i),
        xp: this.spectating ? null : { gained: this.matchXp, lv: myLevel() },
        ranked: this.rankRes,
      });
    }
  }
}
