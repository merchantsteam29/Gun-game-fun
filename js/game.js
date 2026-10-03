import * as THREE from 'three';
import { buildMap } from './map.js';
import { moveBody, overlap, raycast, rayAABB, PLAYER_R } from './physics.js';
import { WEAPONS, PRIMARIES, loadoutFor } from './weapons.js';
import { Viewmodel } from './viewmodel.js';
import { RemotePlayer } from './remote.js';
import { Effects } from './effects.js';
import { Hud } from './hud.js';
import { sfx } from './audio.js';
import { buildProjectile } from './models.js';
import { clamp } from './util.js';

const JUMP = 7.6, WALK = 5.6, SPRINT = 1.35, CROUCH_SPD = 0.55;
const STAND_H = 1.8, CROUCH_H = 1.2, EYE_STAND = 1.62, EYE_CROUCH = 1.05;
const SEND_INTERVAL = 1 / 30;
const BASE_SENS = 0.0022;
const FRAG_GRAVITY = 18;

const _f = new THREE.Vector3(), _r = new THREE.Vector3(), _u = new THREE.Vector3();
const _c = new THREE.Vector3(), _d = new THREE.Vector3(), _n = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const r2 = (v) => Math.round(v * 100) / 100;
const arr = (v) => [r2(v.x), r2(v.y), r2(v.z)];

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.autoClear = false;
    this.renderer = renderer;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, 1, 0.05, 300);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);
    buildMap(this.scene);

    this.vm = new Viewmodel();
    this.fx = new Effects(this.scene);
    this.hud = new Hud();

    this.remotes = new Map(); // id -> RemotePlayer
    this.players = new Map(); // id -> {id, name, color, k, d}
    this.projectiles = [];
    this.net = null;
    this.myId = null;
    this.active = false;
    this.sens = 1;
    this.nextPrimary = 'ar';
    this.onUnlock = null;

    this.me = {
      pos: new THREE.Vector3(), vel: new THREE.Vector3(), onGround: false,
      yaw: 0, pitch: 0, crouch: false, h: STAND_H, eye: EYE_STAND, alive: false, hp: 100,
    };
    this.loadout = loadoutFor('ar');
    this.slot = 0;
    this.ammo = {};
    this.frags = 2;
    this.fireCd = 0; this.switchT = 0; this.reloadT = 0; this.autoSwitchT = 0;
    this.recoil = 0; this.shake = 0;
    this.spread = 0; this.ads = false; this.sprinting = false;
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

  get curW() { return this.loadout[this.slot]; }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = this.vm.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.vm.camera.updateProjectionMatrix();
  }

  // ---------- Input ----------

  bindInput() {
    document.addEventListener('keydown', (e) => {
      if (!this.active) return;
      if (e.code === 'Tab') { e.preventDefault(); this.showScores = true; }
      if (!this.locked) return;
      if (e.code === 'Space' || e.code.startsWith('Control')) e.preventDefault();
      this.keys.add(e.code);
      const n = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3 }[e.code];
      if (!this.me.alive) {
        if (n !== undefined && n < 3) this.nextPrimary = PRIMARIES[n];
        return;
      }
      if (n !== undefined) this.switchSlot(n);
      else if (e.code === 'KeyR') this.startReload();
      else if (e.code === 'KeyG') this.quickFrag();
      else if (e.code === 'KeyF') this.quickMelee();
    });
    document.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      if (e.code === 'Tab') this.showScores = false;
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked || !this.me.alive) return;
      const dx = clamp(e.movementX, -250, 250), dy = clamp(e.movementY, -250, 250);
      const s = BASE_SENS * this.sens * (this.ads ? 0.65 : 1);
      this.me.yaw -= dx * s;
      this.me.pitch = clamp(this.me.pitch - dy * s, -1.5, 1.5);
      this.vm.look(dx, dy);
    });
    this.canvas.addEventListener('mousedown', (e) => {
      if (!this.locked) return;
      if (e.button === 0) { this.mouse.left = true; this.firedThisPress = false; }
      if (e.button === 2) this.mouse.right = true;
    });
    document.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.left = false;
      if (e.button === 2) this.mouse.right = false;
    });
    this.canvas.addEventListener('wheel', (e) => {
      if (!this.locked || !this.me.alive) return;
      const dir = Math.sign(e.deltaY);
      for (let i = 1; i <= 4; i++) {
        const s = (this.slot + dir * i + 8) % 4;
        if (s !== 3 || this.frags > 0) { this.switchSlot(s); break; }
      }
    }, { passive: true });
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
      if (!this.locked) {
        this.keys.clear();
        this.mouse.left = this.mouse.right = false;
        if (this.active && this.onUnlock) this.onUnlock();
      }
    });
    window.addEventListener('blur', () => this.keys.clear());
  }

  lock() {
    try {
      const p = this.canvas.requestPointerLock({ unadjustedMovement: true });
      if (p && p.catch) p.catch(() => this.canvas.requestPointerLock());
    } catch {
      this.canvas.requestPointerLock();
    }
  }

  // ---------- Lobby lifecycle ----------

  attach(net, { primary, color, sens }) {
    this.net = net;
    this.nextPrimary = primary;
    this.sens = sens;
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
    this.me.alive = false;
    this.matchOver = false;
    this.deathInfo = null;
    this.hud.show(false);
    this.hud.death(false);
    this.hud.end(false);
    this.hud.scoreboard(false);
    this.net = null;
    if (document.pointerLockElement) document.exitPointerLock();
    this.camera.fov = 75;
    this.camera.updateProjectionMatrix();
  }

  addRemote(p) {
    if (p.id === this.myId || this.remotes.has(p.id)) return;
    this.remotes.set(p.id, new RemotePlayer(this.scene, p.id, p.name, p.color));
  }

  onNet(m) {
    switch (m.t) {
      case 'welcome':
        this.myId = m.id;
        this.active = true;
        this.players.clear();
        for (const p of m.players) {
          this.players.set(p.id, { id: p.id, name: p.name, color: p.color, k: p.k, d: p.d });
          this.addRemote(p);
        }
        this.hud.show(true);
        break;
      case 'pjoin':
        this.players.set(m.id, { id: m.id, name: m.name, color: m.color, k: 0, d: 0 });
        this.addRemote(m);
        this.hud.say(`${m.name} joined`);
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
        for (const id in m.s) {
          const a = m.s[id];
          const pl = this.players.get(id);
          if (pl) { pl.k = a[9]; pl.d = a[10]; }
          if (id === this.myId) { if (this.me.alive) this.me.hp = a[8]; }
          else { const r = this.remotes.get(id); if (r) r.setState(a); }
        }
        break;
      case 'spawn': this.respawn(m); break;
      case 'dmg': this.onDamaged(m); break;
      case 'hitc':
        this.hud.hit(m.kill ? 'kill' : m.head ? 'head' : null);
        break;
      case 'kill': this.onKill(m); break;
      case 'shot': this.remoteShot(m); break;
      case 'proj': {
        const p = new THREE.Vector3(...m.p);
        this.spawnProjectile(m.k, p, new THREE.Vector3(...m.v), false, m.id, m.pid);
        this.posSound(m.k === 'gl' ? sfx.gl : sfx.throw, p, 0.9);
        break;
      }
      case 'boom': this.remoteBoom(m); break;
      case 'end':
        this.matchOver = true;
        this.endInfo = { scores: m.scores, until: performance.now() + m.next * 1000 };
        this.me.alive = false;
        this.deathInfo = null;
        this.hud.death(false);
        this.hud.reloading(false);
        break;
      case 'start':
        this.matchOver = false;
        this.endInfo = null;
        this.hud.end(false);
        for (const p of this.players.values()) { p.k = 0; p.d = 0; }
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
    this.loadout = loadoutFor(this.nextPrimary);
    this.ammo = {};
    for (const id of this.loadout) this.ammo[id] = WEAPONS[id].mag || 0;
    this.frags = WEAPONS.frag.count;
    this.slot = -1;
    this.switchSlot(0, true);
    this.reloadT = 0;
    this.fireCd = 0;
    this.recoil = 0;
    this.deathInfo = null;
    this.hud.death(false);
    this.vm.setVisible(true);
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
    this.hud.damage(angle);
    sfx.hurt(0.7);
  }

  onKill(m) {
    const k = this.players.get(m.k), v = this.players.get(m.v);
    if (v) this.hud.feed(k, v, m.w, m.head, m.k === this.myId || m.v === this.myId);
    if (m.k === this.myId && m.v !== this.myId && v) {
      this.hud.say(`ELIMINATED ${v.name}`);
      this.hud.hit('kill');
      sfx.kill(0.8);
    }
    if (m.v === this.myId) {
      this.me.alive = false;
      this.deathInfo = { killer: m.k !== this.myId ? m.k : null, w: m.w, at: performance.now(), pos: this.me.pos.clone() };
      this.vm.setVisible(false);
      this.mouse.left = false;
      this.reloadT = 0;
      this.hud.reloading(false);
    } else {
      const r = this.remotes.get(m.v);
      if (r) this.fx.blood(r.center(_c));
    }
  }

  // ---------- Main loop ----------

  frame() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (this.active) this.update(dt, now);
    else this.menuCam(now);
    this.fx.update(dt);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    if (this.active && this.me.alive) this.vm.render(this.renderer);
  }

  menuCam(now) {
    const t = now * 0.00006;
    this.camera.position.set(Math.sin(t) * 24, 9, Math.cos(t) * 15);
    this.camera.lookAt(0, 1.5, 0);
  }

  update(dt, now) {
    const me = this.me;
    const cam = this.camera;

    if (me.alive && !this.matchOver) this.updateMovement(dt);

    // Camera
    this.recoil *= Math.exp(-dt * 9);
    this.shake *= Math.exp(-dt * 6);
    if (me.alive) {
      cam.position.set(me.pos.x, me.pos.y + me.eye, me.pos.z);
      cam.rotation.set(
        me.pitch + this.recoil + (Math.random() - 0.5) * this.shake * 0.1,
        me.yaw + (Math.random() - 0.5) * this.shake * 0.1, 0);
    } else if (this.deathInfo) {
      const di = this.deathInfo;
      const t = (now - di.at) / 1000;
      cam.position.set(di.pos.x, di.pos.y + 1.6 + Math.min(2.5, t * 1.5), di.pos.z);
      const killer = di.killer && this.remotes.get(di.killer);
      if (killer && killer.alive) cam.lookAt(killer.pos.x, killer.pos.y + 1.2, killer.pos.z);
      else cam.rotation.set(-0.9, me.yaw, 0);
    }
    cam.updateMatrixWorld();

    const w = WEAPONS[this.curW];
    const fovTarget = this.ads ? (w.type === 'proj' ? 62 : 55) : 75;
    if (Math.abs(cam.fov - fovTarget) > 0.05) {
      cam.fov += (fovTarget - cam.fov) * Math.min(1, dt * 14);
      cam.updateProjectionMatrix();
    }

    if (me.alive && !this.matchOver) this.updateWeapon(dt);
    else this.ads = false;

    this.sendAcc += dt;
    if (this.sendAcc >= SEND_INTERVAL && me.alive) {
      this.sendAcc = 0;
      this.net.send({ t: 'st', p: arr(me.pos), y: r2(me.yaw), pi: r2(me.pitch), w: this.curW, c: me.crouch ? 1 : 0 });
    }

    for (const r of this.remotes.values()) r.update(dt);
    this.updateProjectiles(dt);

    const hs = Math.hypot(me.vel.x, me.vel.z);
    this.vm.update(dt, {
      speed: hs, ads: this.ads, sprint: this.sprinting, onGround: me.onGround,
      reload: this.reloadT > 0 ? 1 - this.reloadT / w.reload : -1,
    });
    this.updateHud(dt, now);
  }

  updateMovement(dt) {
    const me = this.me, k = this.keys, w = WEAPONS[this.curW];
    const f = (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0);
    const s = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);

    const wantCrouch = k.has('ControlLeft') || k.has('KeyC');
    if (wantCrouch && !me.crouch) { me.crouch = true; me.h = CROUCH_H; }
    else if (!wantCrouch && me.crouch && !overlap(me.pos.x, me.pos.y, me.pos.z, PLAYER_R, STAND_H)) { me.crouch = false; me.h = STAND_H; }
    me.eye += ((me.crouch ? EYE_CROUCH : EYE_STAND) - me.eye) * Math.min(1, dt * 14);

    this.sprinting = k.has('ShiftLeft') && f > 0 && !me.crouch && !this.ads && !this.mouse.left && this.reloadT <= 0;
    const speed = WALK * w.speedMul * (this.sprinting ? SPRINT : 1) * (me.crouch ? CROUCH_SPD : 1) * (this.ads ? 0.7 : 1);
    const sy = Math.sin(me.yaw), cy = Math.cos(me.yaw);
    let wx = -sy * f + cy * s, wz = -cy * f - sy * s;
    const len = Math.hypot(wx, wz);
    if (len > 0) { wx /= len; wz /= len; }
    const a = me.onGround ? 1 - Math.exp(-dt * 14) : 1 - Math.exp(-dt * (len > 0 ? 2.5 : 0.4));
    me.vel.x += (wx * speed - me.vel.x) * a;
    me.vel.z += (wz * speed - me.vel.z) * a;

    if (k.has('Space') && me.onGround) {
      me.vel.y = JUMP;
      me.onGround = false;
      sfx.jump(0.4);
    }
    moveBody(me, dt, me.h);
    if (me.pos.y < -20) me.pos.set(0, 1, -7);
  }

  // ---------- Weapons ----------

  switchSlot(i, instant = false) {
    if (i === this.slot) return;
    if (i === 3 && this.frags <= 0) return;
    this.slot = i;
    this.reloadT = 0;
    const id = this.curW;
    this.switchT = instant ? 0 : WEAPONS[id].switch;
    this.vm.equip(id);
    if (!instant) sfx.equip(0.5);
  }

  startReload() {
    const id = this.curW, w = WEAPONS[id];
    if ((w.type !== 'gun' && w.type !== 'proj') || this.reloadT > 0 || this.switchT > 0) return;
    if (this.ammo[id] >= w.mag) return;
    this.reloadT = w.reload;
    sfx.reload(0.6);
  }

  quickFrag() {
    if (this.frags <= 0 || this.fireCd > 0 || this.switchT > 0) return;
    this.reloadT = 0;
    this.throwFrag();
  }

  quickMelee() {
    if (this.fireCd > 0 && this.curW === 'knife') return;
    this.switchSlot(2, true);
    this.fireCd = 0;
    this.melee();
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
      if (this.autoSwitchT <= 0 && this.curW === 'frag' && this.frags === 0) this.switchSlot(0);
    }

    this.ads = this.mouse.right && (w.type === 'gun' || w.type === 'proj') && this.reloadT <= 0 && this.switchT <= 0;
    const hs = Math.hypot(me.vel.x, me.vel.z);
    this.spread = (w.spread + w.moveSpread * Math.min(1, hs / WALK) + (me.onGround ? 0 : 0.04))
      * (this.ads ? w.adsMul : 1) * (me.crouch ? 0.8 : 1);

    if (this.mouse.left) this.tryFire();

    if ((w.type === 'gun' || w.type === 'proj') && this.ammo[id] === 0 && this.reloadT <= 0 && this.fireCd <= 0 && this.switchT <= 0) {
      this.startReload();
    }
  }

  tryFire() {
    const id = this.curW, w = WEAPONS[id];
    if (this.fireCd > 0 || this.switchT > 0 || this.reloadT > 0) return;
    if (!w.auto && this.firedThisPress) return;
    this.firedThisPress = true;
    if (w.type === 'melee') return this.melee();
    if (w.type === 'throw') return this.throwFrag();
    if (this.ammo[id] <= 0) { sfx.empty(0.6); this.fireCd = 0.25; return; }

    this.ammo[id]--;
    this.fireCd = w.rate;
    this.recoil += w.recoil * (this.ads ? 0.6 : 1);
    this.me.yaw += (Math.random() - 0.5) * w.recoil * 0.4;
    this.vm.kick(w.type === 'proj' ? 0.9 : id === 'shotgun' ? 0.8 : 0.4);
    sfx[id](0.75);
    const muzzle = this.vm.muzzleWorld(this.camera, new THREE.Vector3());
    this.fx.muzzleFlash(muzzle);
    if (w.type === 'proj') this.launchGrenade();
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
        if (!rp.alive) continue;
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
      this.fx.tracer(muzzle, end);
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

  melee() {
    const w = WEAPONS.knife, me = this.me;
    this.fireCd = w.rate;
    this.vm.swing();
    sfx.knife(0.7);
    const o = this.camera.position;
    this.camBasis();
    let best = null, bestD = w.range;
    for (const rp of this.remotes.values()) {
      if (!rp.alive) continue;
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
    this.net.send({ t: 'hit', v: best.id, dmg: back ? w.backstab : w.dmg, w: 'knife', head: back });
    this.fx.blood(best.center(_c));
    this.hud.hit(back ? 'head' : null);
    sfx.stab(0.8);
  }

  // Start position for thrown/launched things, pulled back if it would be inside a wall.
  launchPoint(dist) {
    const o = this.camera.position;
    this.camBasis();
    const wh = raycast(o.x, o.y, o.z, _f.x, _f.y, _f.z, dist + 0.2);
    return o.clone().addScaledVector(_f, wh ? Math.max(0, wh.t - 0.2) : dist);
  }

  launchGrenade() {
    const w = WEAPONS.gl;
    const p = this.launchPoint(0.5);
    const v = _f.clone().multiplyScalar(w.projSpeed);
    const pid = ++this.pid;
    this.spawnProjectile('gl', p, v, true, this.myId, pid);
    this.net.send({ t: 'proj', pid, k: 'gl', p: arr(p), v: arr(v) });
  }

  throwFrag() {
    const w = WEAPONS.frag;
    if (this.frags <= 0) { sfx.empty(0.6); return; }
    this.frags--;
    this.fireCd = w.rate;
    this.vm.throwAnim();
    sfx.throw(0.7);
    const p = this.launchPoint(0.5);
    p.y -= 0.1;
    const v = _f.clone().multiplyScalar(w.throwSpeed);
    v.y += 3;
    v.addScaledVector(this.me.vel, 0.5);
    const pid = ++this.pid;
    this.spawnProjectile('frag', p, v, true, this.myId, pid);
    this.net.send({ t: 'proj', pid, k: 'frag', p: arr(p), v: arr(v) });
    if (this.frags === 0 && this.curW === 'frag') this.autoSwitchT = 0.6;
  }

  // ---------- Projectiles ----------

  spawnProjectile(kind, pos, vel, local, owner, pid) {
    const mesh = buildProjectile(kind);
    mesh.position.copy(pos);
    this.scene.add(mesh);
    this.projectiles.push({ kind, pos: pos.clone(), vel: vel.clone(), local, owner, pid, age: 0, mesh, rest: false, dead: false });
  }

  updateProjectiles(dt) {
    for (const p of this.projectiles) {
      p.age += dt;
      const W = WEAPONS[p.kind];
      if (!p.rest) {
        p.vel.y -= (p.kind === 'gl' ? W.projGravity : FRAG_GRAVITY) * dt;
        const step = p.vel.length() * dt;
        const dir = _d.copy(p.vel).normalize();
        const wh = step > 0 ? raycast(p.pos.x, p.pos.y, p.pos.z, dir.x, dir.y, dir.z, step) : null;
        let travel = wh ? wh.t : step;

        if (p.kind === 'gl') {
          let victim = null;
          if (p.local) {
            for (const rp of this.remotes.values()) {
              if (!rp.alive) continue;
              for (const hb of rp.hitboxes()) {
                const t = rayAABB(p.pos.x, p.pos.y, p.pos.z, dir.x, dir.y, dir.z,
                  hb.x0 - 0.1, hb.y0 - 0.1, hb.z0 - 0.1, hb.x1 + 0.1, hb.y1 + 0.1, hb.z1 + 0.1, travel);
                if (t >= 0 && t < travel) { travel = t; victim = rp; }
              }
            }
          }
          p.pos.addScaledVector(dir, travel);
          if (victim) {
            this.net.send({ t: 'hit', v: victim.id, dmg: W.directDmg, w: 'gl', head: false });
            this.hud.hit('head');
            this.explode(p, victim.id);
            continue;
          }
          if (wh) {
            p.pos.addScaledVector(_n.set(wh.nx, wh.ny, wh.nz), 0.15);
            if (p.local) { this.explode(p, null); continue; }
            p.rest = true;
            p.vel.set(0, 0, 0);
          }
          if (p.vel.lengthSq() > 0) p.mesh.quaternion.setFromUnitVectors(UP, dir);
        } else {
          p.pos.addScaledVector(dir, travel);
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

      if (p.local) {
        if ((p.kind === 'frag' && p.age >= W.fuse) || (p.kind === 'gl' && p.age > 5)) this.explode(p, null);
      } else if (p.age > (p.kind === 'frag' ? W.fuse + 1.5 : 6)) {
        this.removeProjectile(p);
      }
    }
    if (this.projectiles.some((p) => p.dead)) this.projectiles = this.projectiles.filter((p) => !p.dead);
  }

  removeProjectile(p) {
    p.dead = true;
    this.scene.remove(p.mesh);
  }

  boomFx(pos, radius) {
    this.fx.explosion(pos, radius);
    this.posSound(sfx.explosion, pos, 1.2);
    const d = this.camera.position.distanceTo(pos);
    this.shake = Math.max(this.shake, clamp(1 - d / 16, 0, 1) * 0.8);
  }

  // Only the thrower computes splash damage, then reports it to the host.
  explode(p, directId) {
    if (p.dead) return;
    this.removeProjectile(p);
    const W = WEAPONS[p.kind], R = W.radius;
    this.net.send({ t: 'boom', pid: p.pid, p: arr(p.pos) });
    this.boomFx(p.pos, R);

    let any = false;
    for (const rp of this.remotes.values()) {
      if (!rp.alive || rp.id === directId) continue;
      const c = rp.center(new THREE.Vector3());
      const d = c.distanceTo(p.pos);
      if (d >= R || !this.los(p.pos, c)) continue;
      const k = 1 - d / R;
      const dir = c.clone().sub(p.pos).normalize();
      const imp = [r2(dir.x * 9 * k), r2(dir.y * 9 * k + 3 * k), r2(dir.z * 9 * k)];
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
        me.vel.addScaledVector(dir, 11 * k);
        me.vel.y += 4 * k;
        me.onGround = false;
        this.net.send({ t: 'hit', v: this.myId, dmg: Math.round(W.splash * k * 0.5), w: p.kind });
      }
    }
  }

  remoteBoom(m) {
    const p = this.projectiles.find((q) => q.owner === m.id && q.pid === m.pid);
    if (p) this.removeProjectile(p);
    const pos = new THREE.Vector3(...m.p);
    this.boomFx(pos, WEAPONS[p ? p.kind : 'gl'].radius);
  }

  remoteShot(m) {
    const o = new THREE.Vector3(...m.o);
    for (const e of m.e || []) {
      const end = new THREE.Vector3(...e);
      this.fx.tracer(o, end);
      this.fx.impact(end, null);
    }
    this.fx.muzzleFlash(o);
    if (sfx[m.w]) this.posSound(sfx[m.w], o, 0.9);
  }

  posSound(fn, pos, base = 1) {
    const cam = this.camera;
    const d = cam.position.distanceTo(pos);
    const vol = base / (1 + d * 0.09);
    _c.subVectors(pos, cam.position).normalize();
    _r.set(1, 0, 0).applyQuaternion(cam.quaternion);
    fn(vol, d < 1 ? 0 : _c.dot(_r) * 0.8);
  }

  // ---------- HUD ----------

  updateHud(dt, now) {
    const me = this.me, hud = this.hud;
    const id = this.curW, w = WEAPONS[id];
    hud.health(me.alive ? me.hp : 0);
    hud.ammo(id, this.ammo[id] ?? 0, w.mag || 0, this.frags);
    hud.slots(this.loadout, this.slot, this.frags);
    hud.reloading(this.reloadT > 0 && me.alive);
    const px = (this.spread / Math.tan((this.camera.fov * Math.PI) / 360)) * (innerHeight / 2);
    hud.spread(Math.min(80, px), this.ads && w.type === 'gun');

    this.hudAcc -= dt;
    if (this.hudAcc > 0) return;
    this.hudAcc = 0.1;
    let leader = null;
    for (const p of this.players.values()) if (!leader || p.k > leader.k) leader = p;
    hud.timer(this.timeLeft, leader && leader.k > 0 ? leader : null);
    hud.lobby(this.net.code, this.players.size);
    hud.scoreboard(this.showScores && !this.matchOver, this.players, this.myId);
    if (!me.alive && this.deathInfo && !this.matchOver) {
      const secs = Math.ceil(3 - (now - this.deathInfo.at) / 1000);
      const killer = this.deathInfo.killer && this.players.get(this.deathInfo.killer);
      hud.death(true, killer ? killer.name : null, this.deathInfo.w, secs, this.nextPrimary);
    }
    if (this.matchOver && this.endInfo) {
      hud.end(true, this.endInfo.scores, this.myId, Math.max(0, Math.ceil((this.endInfo.until - now) / 1000)));
    }
  }
}
