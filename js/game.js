import * as THREE from 'three';
import { MAPS, setMapData, buildMapScene } from './maps.js';
import { moveBody, overlap, raycast, rayAABB, PLAYER_R, phys } from './physics.js';
import { MODES, TEAM_COLORS, ZOMBIE_COLOR, JUGG_COLOR, JUGG_TEAM, defaultSettings } from './host.js';
import { WEAPONS, DEFAULT_LOADOUT, GUNGAME_LADDER, SLOTS } from './weapons.js';
import { track, onMissionComplete, COSMETICS } from './missions.js';
import { Viewmodel } from './viewmodel.js';
import { RemotePlayer } from './remote.js';
import { Effects } from './effects.js';
import { Hud } from './hud.js';
import { sfx } from './audio.js';
import { buildProjectile, modelQuality } from './models.js';
import { clamp, esc, store } from './util.js';
import { opts, onOpts } from './settings.js';
import { setVolume } from './audio.js';

const JUMP = 8, WALK = 5.6, SPRINT = 1.35, CROUCH_SPD = 0.55, PAD_JUMP = 14;
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
    this.mobile = mobile;
    // Low graphics: no shadows, lower resolution. Turned on automatically (and remembered)
    // if the device ever loses its graphics context; ?lowgfx / ?highgfx force it.
    const params = new URLSearchParams(location.search);
    if (params.has('highgfx')) store.set('lowgfx', false);
    this.lowGfx = params.has('lowgfx') || store.get('lowgfx', false);
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
      store.set('lowgfx', true);
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
    this.fx = new Effects(this.scene);
    this.hud = new Hud();
    this.loadMap('warehouse');
    this.fps = { frames: 0, acc: 0 };
    this.playedThisMatch = false;
    onMissionComplete((ms) => {
      const [slot, id] = ms.reward;
      const item = COSMETICS[slot].find((c) => c.id === id);
      this.hud.mission(ms.name, item ? item.name : '');
      sfx.kill(0.9);
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

  applyGfx() {
    const r = this.renderer, low = this.lowGfx;
    r.setPixelRatio(Math.min(devicePixelRatio, low ? 1 : this.tablet ? 1.5 : this.mobile ? 1.25 : 2));
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
    if (this.rules.mode === 'juggernaut') return p.team === JUGG_TEAM ? JUGG_COLOR : p.color;
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
    for (const r of this.remotes.values()) {
      const p = this.players.get(r.id);
      if (p) r.setLook(this.colorFor(p), this.teams && p.team === this.myTeam && this.rules.mode !== 'infection');
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
    for (const p of this.projectiles || []) this.scene.remove(p.mesh);
    this.projectiles = [];
    this.fx.clear();
  }

  // ---------- Input ----------

  bindInput() {
    document.addEventListener('keydown', (e) => {
      if (!this.active) return;
      if (e.code === 'Tab') { e.preventDefault(); this.showScores = true; }
      if (!this.locked) return;
      if (e.code === 'Space' || e.code.startsWith('Control')) e.preventDefault();
      this.keys.add(e.code);
      if (!this.me.alive || this.matchOver) return;
      const n = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3 }[e.code];
      if (n !== undefined) this.switchSlot(n);
      else if (e.code === 'KeyQ') this.swapLast();
      else if (e.code === 'KeyR') this.startReload();
      else if (e.code === 'KeyG') this.quickThrow();
      else if (e.code === 'KeyF') this.quickMelee();
      else if (e.code === 'KeyT' && this.reloadT <= 0) this.vm.inspect();
    });
    document.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      if (e.code === 'Tab') this.showScores = false;
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked || this.touch) return;
      this.look(clamp(e.movementX, -250, 250), clamp(e.movementY, -250, 250));
    });
    this.canvas.addEventListener('mousedown', (e) => {
      if (!this.locked) return;
      if (e.button === 0) { this.mouse.left = true; this.firedThisPress = false; }
      if (e.button === 2) this.mouse.right = opts.aimToggle ? !this.mouse.right : true;
    });
    document.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.left = false;
      if (e.button === 2 && !opts.aimToggle) this.mouse.right = false;
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
        if (this.active && this.onUnlock) this.onUnlock();
      }
    });
    window.addEventListener('blur', () => this.keys.clear());
  }

  // touch: drag-to-look from the touch controls (uses its own sensitivity).
  look(dx, dy, touch = false) {
    if (!this.me.alive) return;
    if (opts.invertY) dy = -dy;
    let s = BASE_SENS * (touch ? opts.touchSens : opts.sens) * (this.camera.fov / (opts.fov * this.fovK)) * (this.ads ? opts.adsSens : 1);
    // Aim assist "friction": aim slows down while the crosshair is on an enemy.
    const a = this.assist;
    if (touch && a && a.ang < a.limit) s *= 1 - 0.5 * opts.aimAssistStrength;
    this.me.yaw -= dx * s;
    this.me.pitch = clamp(this.me.pitch - dy * s, -1.5, 1.5);
    this.vm.look(dx, dy);
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
    if (this.touch) { this.setLocked(true); return; }
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
    for (const p of this.projectiles) this.scene.remove(p.mesh);
    this.projectiles = [];
    this.fx.clear();
    this.me.alive = false;
    this.matchOver = false;
    this.deathInfo = null;
    this.rules = defaultSettings();
    phys.gravity = 1;
    this.zone = null;
    this.teamScore = null;
    this.zoneMesh.visible = false;
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
    this.remotes.set(p.id, new RemotePlayer(this.scene, p.id, p.name, p.color, p.cos));
  }

  onNet(m) {
    switch (m.t) {
      case 'welcome':
        this.myId = m.id;
        this.active = true;
        this.applySettings(m.settings);
        this.loadMap(m.settings.map);
        this.players.clear();
        for (const p of m.players) {
          this.players.set(p.id, { id: p.id, name: p.name, color: p.color, k: p.k, d: p.d, team: p.team, sc: p.sc, bot: p.bot });
          this.addRemote(p);
        }
        this.refreshColors();
        this.hud.show(true);
        break;
      case 'pjoin':
        this.players.set(m.id, { id: m.id, name: m.name, color: m.color, k: 0, d: 0, team: m.team, sc: 0, bot: m.bot });
        this.addRemote(m);
        this.refreshColors();
        this.hud.say(`${m.name} joined`);
        break;
      case 'settings':
        this.applySettings(m.s);
        break;
      case 'notice':
        this.hud.say(m.text);
        break;
      case 'pcos': {
        const r = this.remotes.get(m.id);
        if (r) r.setCosmetics(m.c);
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
        this.timeLeft = m.tl;
        this.teamScore = m.ts || null;
        this.zone = m.z || null;
        this.infection = m.inf ?? 0;
        let teamsChanged = false;
        for (const id in m.s) {
          const a = m.s[id];
          const pl = this.players.get(id);
          if (pl) {
            pl.k = a[9]; pl.d = a[10]; pl.sc = a[13];
            if (pl.team !== a[12]) { pl.team = a[12]; teamsChanged = true; }
          }
          if (id === this.myId) { if (this.me.alive) this.me.hp = a[8]; }
          else { const r = this.remotes.get(id); if (r) r.setState(a); }
        }
        if (teamsChanged) this.refreshColors();
        break;
      case 'spawn': this.respawn(m); break;
      case 'dmg': this.onDamaged(m); break;
      case 'hitc':
        this.hud.hit(m.kill ? 'kill' : m.head ? 'head' : null);
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
        this.endInfo = { scores: m.scores, until: performance.now() + m.next * 1000, nextMap: m.nextMap, title: m.title };
        this.me.alive = false;
        this.deathInfo = null;
        this.hud.death(false);
        this.hud.reloading(false);
        this.hud.scope(false);
        break;
      case 'start':
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
    me.pos.set(m.p[0], m.p[1], m.p[2]);
    me.vel.set(0, 0, 0);
    me.yaw = m.yaw;
    me.pitch = 0;
    me.alive = true;
    me.hp = 100;
    me.crouch = false;
    me.h = STAND_H;
    me.eye = EYE_STAND;
    me.hp = this.maxHp = m.hp || 100;
    const pl = this.players.get(this.myId);
    if (pl && m.team !== undefined) pl.team = m.team;
    this.refreshColors();
    this.playedThisMatch = true;
    this.setLoadout(m.l || this.nextLoadout);
    this.recoil = 0;
    this.deathInfo = null;
    this.hud.death(false);
    this.vm.setVisible(true);
  }

  setLoadout(l) {
    this.loadout = l.slice();
    this.ammo = {};
    for (const id of this.loadout) this.ammo[id] = WEAPONS[id].mag || 0;
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
    this.hud.damage(angle);
    sfx.hurt(0.7);
  }

  onKill(m) {
    const pk = this.players.get(m.k), pv = this.players.get(m.v);
    const k = pk && { ...pk, color: this.colorFor(pk) }, v = pv && { ...pv, color: this.colorFor(pv) };
    if (v) this.hud.feed(k, v, m.w, m.head, m.k === this.myId || m.v === this.myId);
    if (m.k === this.myId && m.v !== this.myId && v) {
      this.hud.say(`ELIMINATED ${v.name}`);
      this.hud.hit('kill');
      sfx.kill(0.8);
      if (!this.teams || (pk && pv && pk.team !== pv.team)) {
        const W = WEAPONS[m.w];
        track.kill({
          weaponType: W && W.type, head: !!m.head, mode: this.rules.mode,
          secondary: SLOTS[1].includes(m.w),
          explosive: ['gl', 'rocket', 'frag', 'sticky', 'impact', 'flare', 'vortex'].includes(m.w),
          juggernaut: this.rules.mode === 'juggernaut' && pv && pv.team === JUGG_TEAM,
        });
      }
    }
    if (m.v === this.myId) track.died();
    const killerPos = m.k === this.myId ? this.me.pos : this.remotes.get(m.k)?.pos;
    if (m.v === this.myId) {
      this.me.alive = false;
      this.deathInfo = {
        killer: m.k !== this.myId ? m.k : null, w: m.w, at: performance.now(),
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
        this.fx.blood(r.center(_c));
        r.die(killerPos && killerPos !== r.pos ? killerPos : null);
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
  trackMatchEnd(m) {
    const mode = this.rules.mode, me = this.players.get(this.myId), team = me ? me.team : 0;
    let won;
    if (MODES[mode].redBlue) won = (team === 1 && m.title === 'RED TEAM WINS') || (team === 2 && m.title === 'BLUE TEAM WINS');
    else if (mode === 'infection') won = (team === 2 && m.title === 'ZOMBIES WIN') || (team === 1 && m.title === 'SURVIVORS WIN');
    else won = !!m.scores && m.scores[0] && m.scores[0].id === this.myId;
    const mine = (m.scores || []).find((s) => s.id === this.myId);
    track.matchEnd({
      mode, won,
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
    this.fx.update(gdt);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    if (this.active && this.me.alive && !this.scoped) this.vm.render(this.renderer);
  }

  menuCam(now) {
    const t = now * 0.00006;
    const b = MAPS[this.mapId].bounds;
    this.camera.position.set(Math.sin(t) * b * 0.8, b * 0.32, Math.cos(t) * b * 0.55);
    this.camera.lookAt(0, 1.5, 0);
  }

  update(dt, now) {
    const me = this.me;
    const cam = this.camera;
    const w = WEAPONS[this.curW];

    if (me.alive && !this.matchOver) this.updateMovement(dt);
    this.assist = null;
    if (this.touch && opts.aimAssist && me.alive && !this.matchOver) this.aimAssist(dt);

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
      this.roll += (-strafe * 0.018 * adsK - this.roll) * Math.min(1, dt * 8);
      cam.position.set(me.pos.x, me.pos.y + me.eye - this.landDip + Math.sin(this.bobPhase * 2) * 0.022 * bob, me.pos.z);
      cam.rotation.set(
        me.pitch + this.recoil + this.flinch * 0.035 + (Math.random() - 0.5) * this.shake * 0.1,
        me.yaw + (Math.random() - 0.5) * this.shake * 0.1,
        this.roll + Math.sin(this.bobPhase) * 0.004 * bob + this.flinch * 0.02);
    } else if (this.deathInfo) {
      this.deathCam(dt, now);
    } else {
      this.menuCam(now); // waiting to spawn (e.g. joined mid-round in Last Man Standing)
    }
    cam.updateMatrixWorld();

    if (me.alive && !this.matchOver) this.updateWeapon(dt);
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
      this.net.send({ t: 'st', p: arr(me.pos), y: r2(me.yaw), pi: r2(me.pitch), w: this.curW, c: me.crouch ? 1 : 0, a });
    }

    for (const r of this.remotes.values()) {
      r.update(dt);
      if (r.stepped && r.pos.distanceTo(cam.position) < 30) this.posSound(sfx.step, r.pos, r.sprint > 0.5 ? 0.5 : 0.35);
      if (r.tag.visible && this.fx.smokes.length && this.fx.blocked(cam.position, r.headPos(_c))) r.tag.visible = false;
    }
    this.updateProjectiles(dt);
    this.updateZone(now);

    this.vm.update(dt, {
      speed: hs, strafe, vy: me.vel.y, ads: this.ads, sprint: this.sprinting, onGround: me.onGround,
      reload: this.reloadT > 0 && w.reload ? 1 - this.reloadT / w.reload : -1,
      hasUtil: this.util > 0,
      spin: w.spinup ? this.spin / w.spinup : 0,
      bob: opts.bobbing,
    });
    this.updateHud(dt, now);
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
    const me = this.me, k = this.keys, w = WEAPONS[this.curW];
    let f = (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0);
    let s = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
    let analog = 1;
    if (this.touch && (this.joy.x || this.joy.y)) {
      f = -this.joy.y; s = this.joy.x;
      analog = Math.min(1, Math.hypot(f, s));
    }

    const wantCrouch = k.has('ControlLeft') || k.has('KeyC');
    if (wantCrouch && !me.crouch) { me.crouch = true; me.h = CROUCH_H; }
    else if (!wantCrouch && me.crouch && !overlap(me.pos.x, me.pos.y, me.pos.z, PLAYER_R, STAND_H)) { me.crouch = false; me.h = STAND_H; }
    me.eye += ((me.crouch ? EYE_CROUCH : EYE_STAND) - me.eye) * Math.min(1, dt * 14);

    const touchSprint = this.touch && f > 0.9 && Math.abs(s) < 0.45;
    this.sprinting = (k.has('ShiftLeft') || touchSprint) && f > 0 && !me.crouch && !this.ads && !this.mouse.left && this.reloadT <= 0;
    const speed = WALK * this.rules.moveSpeed * w.speedMul * (this.sprinting ? SPRINT : 1) * (me.crouch ? CROUCH_SPD : 1) * (this.ads ? 0.7 : 1);
    const sy = Math.sin(me.yaw), cy = Math.cos(me.yaw);
    let wx = -sy * f + cy * s, wz = -cy * f - sy * s;
    const len = Math.hypot(wx, wz);
    if (len > 0) { wx /= len; wz /= len; }
    const a = me.onGround ? 1 - Math.exp(-dt * 14) : 1 - Math.exp(-dt * (len > 0 ? 2.5 : 0.4));
    me.vel.x += (wx * speed * analog - me.vel.x) * a;
    me.vel.z += (wz * speed * analog - me.vel.z) * a;

    if (k.has('Space') && me.onGround) {
      me.vel.y = JUMP * this.rules.jump;
      me.onGround = false;
      sfx.jump(0.4);
    }
    const wasGround = me.onGround, vyBefore = me.vel.y;
    moveBody(me, dt, me.h);
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
      if (this.stepAcc >= 1) { this.stepAcc = 0; sfx.step(this.sprinting ? 0.22 : 0.14); }
    }
    if (me.pos.y < -20) me.pos.set(0, 3, 0);
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
    const id = this.curW, w = WEAPONS[id];
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
    const id = this.curW, w = WEAPONS[id];
    if ((w.type !== 'gun' && w.type !== 'proj') || this.reloadT > 0 || this.switchT > 0) return;
    if (this.ammo[id] >= w.mag) return;
    this.reloadT = w.reload;
    this.burstLeft = 0;
    this.vm.cancelInspect();
    sfx.reload(0.6);
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
    const id = this.curW, w = WEAPONS[id];

    if (this.reloadT > 0) {
      this.reloadT -= dt;
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
      this.startReload();
    }
  }

  tryFire() {
    const id = this.curW, w = WEAPONS[id];
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
    sfx[id](0.75);
    const muzzle = this.scoped ? this.camera.position.clone().addScaledVector(this.camera.getWorldDirection(_d), 0.4).addScaledVector(UP, -0.1)
      : this.vm.muzzleWorld(this.camera, new THREE.Vector3());
    this.fx.muzzleFlash(muzzle);
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
      } else if (wh) {
        this.fx.impact(end, _n.set(wh.nx, wh.ny, wh.nz));
      }
      this.fx.tracer(muzzle, end, w.tracer);
      ends.push(arr(end));
    }
    for (const [vid, h] of hits) {
      this.net.send({ t: 'hit', v: vid, dmg: Math.round(h.dmg), w: id, head: h.head });
      this.hud.hit(h.head ? 'head' : null);
      (h.head ? sfx.head : sfx.hit)(0.8);
    }
    this.net.send({ t: 'shot', w: id, o: arr(muzzle), e: ends });
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
    const cur = WEAPONS[this.curW];
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
    const v = _f.clone().multiplyScalar(w.projSpeed);
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
      this.fx.tracer(o, end, W && W.tracer);
      this.fx.impact(end, null);
    }
    this.fx.muzzleFlash(o);
    const r = this.remotes.get(m.id);
    if (r) r.fire();
    if (sfx[m.w]) this.posSound(sfx[m.w], o, 0.9);
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

  posSound(fn, pos, base = 1) {
    const cam = this.camera;
    const d = cam.position.distanceTo(pos);
    const vol = base / (1 + d * 0.09);
    _c.subVectors(pos, cam.position).normalize();
    _r.set(1, 0, 0).applyQuaternion(cam.quaternion);
    fn(vol, d < 1 ? 0 : _c.dot(_r) * 0.8);
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

  modeBar() {
    const mode = this.rules.mode, me = this.players.get(this.myId);
    if (MODES[mode].redBlue && this.teamScore) {
      const [r, b] = this.teamScore;
      const mine = me && me.team === 1 ? 'red' : 'blue';
      let bar = `<span class="team red ${mine === 'red' ? 'mine' : ''}">RED ${r}</span><span class="lim">/ ${this.rules.scoreLimit}</span><span class="team blue ${mine === 'blue' ? 'mine' : ''}">BLUE ${b}</span>`;
      if (mode === 'hardpoint' && this.zone) {
        const [, , , , state, holder, secs] = this.zone;
        const st = state === 2 ? 'CONTESTED' : state === 1 ? `<span class="${holder === 1 ? 'red' : 'blue'}">${holder === 1 ? 'RED' : 'BLUE'} HOLDS</span>` : 'NEUTRAL';
        bar += `<span class="lim"> · ZONE ${st} · MOVES IN ${secs}s</span>`;
      }
      return bar;
    }
    if (mode === 'juggernaut') {
      let j = null;
      for (const p of this.players.values()) if (p.team === JUGG_TEAM) j = p;
      const who = !j ? 'FIRST KILL BECOMES THE JUGGERNAUT' : j.id === this.myId ? '<span class="jugg">YOU ARE THE JUGGERNAUT</span>' : `JUGGERNAUT: <span class="jugg">${esc(j.name)}</span>`;
      return `${who} · FIRST TO ${this.rules.scoreLimit}`;
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

  updateHud(dt, now) {
    const me = this.me, hud = this.hud;
    const id = this.curW, w = WEAPONS[id];
    hud.health(me.alive ? me.hp : 0, this.maxHp);
    hud.ammo(id, this.ammo[id] ?? 0, w.mag || 0, this.util);
    hud.slots(this.loadout, this.slot, this.util, this.ammo);
    hud.reloading(this.reloadT > 0 && me.alive);
    const px = (this.spread / Math.tan((this.camera.fov * Math.PI) / 360)) * (innerHeight / 2);
    hud.spread(Math.min(80, px), this.ads && w.type === 'gun');

    this.hudAcc -= dt;
    if (this.hudAcc > 0) return;
    this.hudAcc = 0.1;
    let leader = null;
    for (const p of this.players.values()) if (!leader || p.sc > leader.sc) leader = p;
    hud.timer(this.timeLeft, !this.teams && leader && leader.sc > 0 ? leader : null);
    hud.modeBar(this.modeBar());
    hud.lobby(this.net.code, this.players.size, `${MODES[this.rules.mode].short} · ${MAPS[this.mapId].name}`);
    hud.scoreboard(this.showScores && !this.matchOver, this.players, this.myId, this.rules.mode, (p) => this.colorFor(p));
    if (!me.alive && this.deathInfo && !this.matchOver) {
      const secs = Math.ceil(this.rules.respawn - (now - this.deathInfo.at) / 1000);
      const killer = this.deathInfo.killer && this.players.get(this.deathInfo.killer);
      const mine = this.players.get(this.myId);
      const out = this.rules.mode === 'lms' && mine && mine.sc <= 0;
      hud.death(true, killer ? killer.name : null, this.deathInfo.w, secs, out ? 'Out of lives · spectating until the next round' : null);
    }
    if (this.matchOver && this.endInfo) {
      const next = MAPS[this.endInfo.nextMap];
      hud.end(true, this.endInfo.scores, this.myId, Math.max(0, Math.ceil((this.endInfo.until - now) / 1000)), next ? next.name : '', this.endInfo.title, this.rules.mode);
    }
  }
}
