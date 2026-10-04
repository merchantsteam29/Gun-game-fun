import * as THREE from 'three';
import { buildGun } from './models.js';
import { WEAPONS } from './weapons.js';
import { Limb, solveIK, seg, bump, keyBlend } from './rig.js';

const S = 0.8; // model scale in first person
const HIP = {
  ar: [0.17, -0.17, -0.42], smg: [0.16, -0.16, -0.38], burst: [0.17, -0.18, -0.4], lmg: [0.18, -0.19, -0.42],
  sniper: [0.17, -0.17, -0.42], shotgun: [0.17, -0.17, -0.42], gl: [0.18, -0.18, -0.4],
  pistol: [0.15, -0.15, -0.38], revolver: [0.15, -0.15, -0.38], mpistol: [0.15, -0.15, -0.38],
  knife: [0.2, -0.2, -0.36], axe: [0.2, -0.24, -0.34], claws: [0.2, -0.22, -0.36],
  frag: [0.17, -0.18, -0.34], sticky: [0.17, -0.18, -0.34], smoke: [0.17, -0.18, -0.34],
  dmr: [0.17, -0.17, -0.42], minigun: [0.2, -0.25, -0.45], doublebarrel: [0.17, -0.17, -0.42],
  rocket: [0.2, -0.21, -0.36], crossbow: [0.17, -0.18, -0.4], handcannon: [0.15, -0.15, -0.38],
  sawedoff: [0.15, -0.15, -0.36], katana: [0.2, -0.24, -0.36], bat: [0.2, -0.25, -0.34],
  flash: [0.17, -0.18, -0.34], tknife: [0.17, -0.18, -0.34],
  br: [0.17, -0.17, -0.42], pdw: [0.16, -0.16, -0.38], autoshot: [0.17, -0.18, -0.42], amr: [0.19, -0.2, -0.44],
  railgun: [0.18, -0.19, -0.42], bpistol: [0.15, -0.15, -0.38], flare: [0.15, -0.15, -0.38],
  machete: [0.2, -0.21, -0.36], sledge: [0.2, -0.26, -0.34], impact: [0.17, -0.18, -0.34],
  carbine: [0.17, -0.17, -0.41], vector: [0.16, -0.16, -0.38], slug: [0.17, -0.17, -0.42], laser: [0.17, -0.18, -0.42],
  harpoon: [0.18, -0.18, -0.42], microsmg: [0.15, -0.15, -0.37], autorev: [0.15, -0.15, -0.38],
  knuckles: [0.2, -0.2, -0.34], scythe: [0.22, -0.26, -0.34], vortex: [0.17, -0.18, -0.34],
};
const REST_ROT = {
  knife: [0.25, 0.15, -0.35], axe: [0.55, 0.1, -0.15], claws: [0.35, 0.1, -0.2], katana: [0.75, 0.15, -0.35], bat: [0.7, 0.1, -0.2],
  tknife: [0.25, 0.1, -0.3], machete: [0.45, 0.15, -0.3], sledge: [0.65, 0.1, -0.15],
  knuckles: [0.15, 0.1, -0.1], scythe: [0.8, 0.1, -0.2],
};
const SHOULDER_R = new THREE.Vector3(0.21, -0.4, 0.04);
const SHOULDER_L = new THREE.Vector3(-0.16, -0.42, -0.02);
const POLE_R = new THREE.Vector3(1, -1.2, 0.3);
const POLE_L = new THREE.Vector3(-1, -1.2, 0.3);
const OFF = new THREE.Vector3(-0.12, -0.6, -0.3);
const REST_L = new THREE.Vector3(-0.28, -0.62, -0.25);
const UPPER = 0.38, FORE = 0.45;

const _v = new THREE.Vector3(), _e = new THREE.Vector3(), _h = new THREE.Vector3();

// First-person weapon + arms, rendered in its own scene on top of the world so it never clips walls.
export class Viewmodel {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(65, 1, 0.01, 10);
    this.scene.add(new THREE.HemisphereLight('#e8eef5', '#5a5048', 2.4));
    const d = new THREE.DirectionalLight('#fff1da', 2.2);
    d.position.set(1, 2, 1);
    this.scene.add(d);

    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.sleeveMat = new THREE.MeshStandardMaterial({ color: '#3498db', roughness: 0.8 });
    this.gloveMat = new THREE.MeshStandardMaterial({ color: '#1e1f22', roughness: 0.9 });

    // Weapon models are built the first time they're equipped (building all ~40 up front
    // costs a lot of GPU memory, which phones can't spare).
    const built = {};
    this.models = new Proxy(built, {
      get: (t, id) => {
        if (typeof id !== 'string' || !WEAPONS[id]) return t[id];
        if (!t[id]) t[id] = this.buildModel(id);
        return t[id];
      },
    });
    this.builtModels = built;

    // Arms (IK) and gloves.
    this.arms = {
      rU: new Limb(this.root, this.sleeveMat, 0.085), rF: new Limb(this.root, this.sleeveMat, 0.075),
      lU: new Limb(this.root, this.sleeveMat, 0.085), lF: new Limb(this.root, this.sleeveMat, 0.075),
    };
    const gloveGeo = new THREE.BoxGeometry(0.07, 0.075, 0.1);
    this.gloveR = new THREE.Mesh(gloveGeo, this.gloveMat);
    this.gloveL = new THREE.Mesh(gloveGeo, this.gloveMat);
    this.root.add(this.gloveR, this.gloveL);

    // Muzzle flash
    const flashMat = new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    this.flash = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), flashMat);
    this.flash2 = this.flash.clone();
    this.flash2.rotation.z = Math.PI / 4;
    this.flashT = 0;

    // Ejected casings
    this.casingGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.025, 6);
    this.casingMat = new THREE.MeshStandardMaterial({ color: '#c8a24a', roughness: 0.4, metalness: 0.5 });
    this.casings = [];

    this.cur = null;
    this.quick = null; // temporary throwable shown during a quick throw
    this.t = 0;
    this.adsT = 0;
    this.sprintT = 0;
    this.raiseT = 0;
    this.raiseDur = 0.3;
    this.next = null; // model waiting to be drawn once the current one is holstered
    this.dropT = 0;
    this.dropDur = 1;
    this.kick = 0;
    this.kickYaw = 0;
    this.land = 0;
    this.anim = null; // {name, t, dur, side}
    this.cycleAnim = null;
    this.inspectT = -1;
    this.slashSide = 1;
    this.cylAngle = 0;
    this.cylTarget = 0;
    this.bobT = 0;
    this.sway = new THREE.Vector2();
    this.pos = new THREE.Vector3(...HIP.ar);
    this.spinAngle = 0;
    this.rot = new THREE.Vector3();
    this.tPos = new THREE.Vector3();
    this.tRot = new THREE.Vector3();
    this.pts = {
      fore: new THREE.Vector3(), mag: new THREE.Vector3(), bolt: new THREE.Vector3(), port: new THREE.Vector3(),
      cyl: new THREE.Vector3(), lid: new THREE.Vector3(), pin: new THREE.Vector3(), grip: new THREE.Vector3(),
      knob: new THREE.Vector3(), off: OFF, restL: REST_L,
    };
  }

  buildModel(id) {
    const holder = new THREE.Group();
    holder.scale.setScalar(S);
    const gun = buildGun(id);
    holder.add(gun);
    holder.visible = false;
    this.root.add(holder);
    const sight = gun.userData.sight || 0.1;
    return { id, holder, gun, parts: gun.userData.parts, ads: [0, -sight * S, -0.3] };
  }

  get model() { return this.models[this.quick || this.cur]; }

  setColor(c) { this.sleeveMat.color.set(c); }
  setVisible(v) { this.root.visible = v; }

  // Lower the current model for `drop` seconds, then raise `id` over `raise` seconds.
  equip(id, { drop = 0, raise = 0.3 } = {}) {
    this.anim = null;
    this.cycleAnim = null;
    this.inspectT = -1;
    this.raiseDur = Math.max(0.05, raise);
    if (drop > 0 && this.cur && this.cur !== id && !this.quick) {
      // Continue lowering from wherever the current model is.
      const lowered = this.next ? 1 - this.dropT / this.dropDur : this.raiseT;
      this.next = id;
      this.dropDur = drop;
      this.dropT = drop * (1 - Math.min(1, lowered));
      return;
    }
    this.next = null;
    this.swapTo(id, raise > 0 ? 1 : 0);
  }

  swapTo(id, raiseT) {
    for (const m of Object.values(this.builtModels)) m.holder.visible = false;
    this.cur = id;
    this.quick = null;
    this.cylAngle = this.cylTarget = 0;
    const m = this.models[id];
    m.holder.visible = true;
    if (m.parts.muzzle) m.parts.muzzle.add(this.flash, this.flash2);
    this.flash.visible = this.flash2.visible = false;
    this.raiseT = raiseT;
  }

  fire(w) {
    this.inspectT = -1;
    const big = w.type === 'proj' || ['shotgun', 'sniper', 'revolver', 'doublebarrel', 'sawedoff', 'handcannon', 'dmr', 'amr', 'railgun', 'autoshot', 'slug', 'autorev'].includes(w.id);
    this.kick = Math.min(1.4, this.kick + (big ? 1 : 0.45));
    this.kickYaw = (Math.random() - 0.5) * (big ? 0.12 : 0.05);
    this.flashT = 0.05;
    this.flash.rotation.z = Math.random() * Math.PI;
    if (w.id === 'revolver') this.cylTarget += Math.PI / 3;
    if (w.id === 'gl') this.cylTarget += Math.PI / 2;
    if (w.cycle) this.cycleAnim = { name: w.cycle, t: -0.12, dur: w.cycle === 'bolt' ? 0.8 : 0.45 };
    else if (w.type === 'gun' && !['revolver', 'doublebarrel', 'sawedoff'].includes(w.id)) this.eject();
  }

  eject() {
    const m = this.model;
    const src = m.parts.bolt || m.parts.slide || m.gun;
    const p = src.localToWorld(new THREE.Vector3(0.02, 0.06, 0));
    const c = new THREE.Mesh(this.casingGeo, this.casingMat);
    c.position.copy(p);
    this.root.add(c);
    this.casings.push({ m: c, v: new THREE.Vector3(1.2 + Math.random() * 0.6, 1.4 + Math.random() * 0.6, 0.3 * Math.random()), t: 0.7 });
  }

  swing(style) {
    this.inspectT = -1;
    this.slashSide = -this.slashSide;
    this.anim = { name: style, t: 0, dur: style === 'chop' ? 0.8 : 0.4, side: this.slashSide };
  }

  // Throw anim; with `quickId` the throwable is shown temporarily over the current weapon.
  throwAnim(quickId) {
    this.inspectT = -1;
    if (quickId && quickId !== this.cur) {
      this.models[this.cur].holder.visible = false;
      this.quick = quickId;
      this.models[quickId].holder.visible = true;
    }
    this.anim = { name: 'throw', t: 0, dur: 0.8 };
  }

  inspect() { if (!this.anim && !this.next && this.raiseT <= 0) this.inspectT = 0; }
  cancelInspect() { this.inspectT = -1; }
  landed(k) { this.land = Math.max(this.land, k); }

  look(dx, dy) {
    this.sway.x = THREE.MathUtils.clamp(this.sway.x - dx * 0.0004, -0.05, 0.05);
    this.sway.y = THREE.MathUtils.clamp(this.sway.y + dy * 0.0004, -0.05, 0.05);
  }

  // s: {speed, strafe, vy, ads, reload (0..1 or -1), sprint, onGround, hasUtil}
  update(dt, s) {
    if (!this.cur) return;
    this.t += dt;
    let lower = 0;
    if (this.next) {
      this.dropT -= dt;
      if (this.dropT <= 0) {
        this.swapTo(this.next, 1);
        this.next = null;
      } else lower = 1 - this.dropT / this.dropDur;
    }
    const m = this.model;
    const id = m.id;
    const w = WEAPONS[id];
    const P = m.parts;

    this.adsT += ((s.ads ? 1 : 0) - this.adsT) * Math.min(1, dt * 14);
    this.sprintT += ((s.sprint ? 1 : 0) - this.sprintT) * Math.min(1, dt * 9);
    if (!this.next) this.raiseT = Math.max(0, this.raiseT - dt / this.raiseDur);
    this.kick *= Math.exp(-dt * 12);
    this.land *= Math.exp(-dt * 7);
    this.flashT -= dt;
    this.flash.visible = this.flash2.visible = this.flashT > 0;
    this.sway.multiplyScalar(Math.exp(-dt * 8));
    this.cylAngle += (this.cylTarget - this.cylAngle) * Math.min(1, dt * 18);
    if (s.reload >= 0 || s.sprint) this.inspectT = -1;

    // ----- Base pose -----
    const tp = this.tPos.fromArray(HIP[id] || HIP.ar);
    const tr = this.tRot.set(0, 0, 0);
    if (REST_ROT[id]) tr.fromArray(REST_ROT[id]);
    tp.lerp(_v.fromArray(m.ads), this.adsT);
    tr.multiplyScalar(1 - this.adsT);

    const amt = Math.min(1, s.speed / 6) * (s.onGround ? 1 : 0.15) * (1 - this.adsT * 0.85) * (s.bob ?? 1);
    this.bobT += dt * (4 + s.speed * 1.6);
    const big = 1 + this.sprintT * 0.8;
    tp.x += Math.sin(this.bobT) * 0.012 * amt * big + this.sway.x;
    tp.y += -Math.abs(Math.cos(this.bobT)) * 0.016 * amt * big + this.sway.y + Math.sin(this.t * 1.7) * 0.003 * (1 - this.adsT);
    tr.z += Math.sin(this.bobT) * 0.02 * amt - s.strafe * 0.07 * (1 - this.adsT * 0.7);
    tr.y += this.sway.x * 1.5;
    tp.y -= THREE.MathUtils.clamp(s.vy * 0.005, -0.04, 0.04) + this.land * 0.07;
    tr.x -= this.land * 0.08;

    tp.x -= this.sprintT * 0.06; tp.y -= this.sprintT * 0.04; tp.z += this.sprintT * 0.03;
    tr.x -= this.sprintT * 0.3; tr.y += this.sprintT * 0.65; tr.z += this.sprintT * 0.3;

    // Draw (raiseT 1 -> 0) eases up from below; holster (lower 0 -> 1) tips the weapon away.
    const e = this.raiseT * this.raiseT * (3 - 2 * this.raiseT);
    tp.y -= 0.32 * e; tr.x -= 0.9 * e; tr.z += 0.4 * e;
    if (lower > 0) {
      const l = lower * lower;
      tp.y -= 0.34 * l; tp.x += 0.05 * l; tr.x -= 0.8 * l; tr.z -= 0.5 * l;
    }

    // Reset animated parts
    for (const p of Object.values(P)) {
      if (p.userData.base && p.name !== 'fore' && p.name !== 'muzzle' && p.name !== 'port') p.position.copy(p.userData.base);
      p.visible = true;
    }
    if (P.lid) P.lid.rotation.x = 0;
    if (P.bolt) P.bolt.rotation.z = 0;
    if (P.cyl) P.cyl.rotation.z = this.cylAngle;

    let leftKeys = null, rightKeys = null, leftP = 0, rightP = 0;
    let leftMode = P.fore ? 'fore' : 'restL';
    if (P.spin) P.spin.rotation.z += dt * 45 * (s.spin || 0);

    // ----- Reload -----
    if (s.reload >= 0 && !this.quick) {
      const p = s.reload;
      leftP = p;
      leftKeys = reloadPose(w.reloadStyle, p, P, tp, tr);
    }

    // ----- Post-shot cycle (bolt / pump) -----
    if (this.cycleAnim) {
      const c = this.cycleAnim;
      c.t += dt;
      const p = c.t / c.dur;
      if (p >= 1) this.cycleAnim = null;
      else if (p > 0) {
        if (c.name === 'pump' && P.pump) {
          const k = bump(p, 0.05, 0.95);
          P.pump.position.z = P.pump.userData.base.z + 0.1 * k;
          tr.x += 0.06 * k; tp.z += 0.015 * k;
          if (p > 0.45 && !c.ejected) { c.ejected = true; this.eject(); }
        } else if (c.name === 'bolt' && P.bolt) {
          const up = seg(p, 0.1, 0.25) * (1 - seg(p, 0.68, 0.84));
          P.bolt.rotation.z = 1.2 * up;
          P.bolt.position.z = P.bolt.userData.base.z + 0.11 * (seg(p, 0.27, 0.43) - seg(p, 0.5, 0.66));
          tr.z += 0.18 * bump(p, 0, 1); tr.x += 0.05 * bump(p, 0, 1);
          if (p > 0.45 && !c.ejected) { c.ejected = true; this.eject(); }
          rightKeys = [[0, 'grip'], [0.1, 'knob'], [0.84, 'knob'], [0.97, 'grip']];
          rightP = p;
        }
      }
    }

    // ----- Melee / throw -----
    if (this.anim) {
      const a = this.anim;
      a.t += dt;
      const p = Math.min(1, a.t / a.dur);
      if (a.name === 'slash') {
        const wind = seg(p, 0, 0.22) * (1 - seg(p, 0.22, 0.4));
        const sl = seg(p, 0.22, 0.48) * (1 - seg(p, 0.6, 1));
        tp.x += 0.08 * a.side * wind - 0.24 * a.side * sl;
        tp.z -= 0.18 * bump(p, 0.18, 0.7);
        tp.y += 0.04 * wind;
        tr.y += 0.45 * a.side * wind - 1.1 * a.side * sl;
        tr.z += 0.35 * a.side * wind - 0.7 * a.side * sl;
        tr.x -= 0.3 * sl;
      } else if (a.name === 'chop') {
        const r = seg(p, 0, 0.35) * (1 - seg(p, 0.35, 0.48));
        const c = seg(p, 0.35, 0.48) * (1 - seg(p, 0.62, 1));
        tr.x += 1.15 * r - 1.1 * c;
        tp.y += 0.14 * r - 0.12 * c;
        tp.z += 0.06 * r - 0.22 * c;
        tp.x -= 0.06 * r;
      } else if (a.name === 'throw') {
        const wind = seg(p, 0.25, 0.45) * (1 - seg(p, 0.45, 0.55));
        const th = seg(p, 0.45, 0.58) * (1 - seg(p, 0.62, 0.9));
        tp.z += 0.12 * wind - 0.3 * th;
        tp.y += 0.1 * wind - 0.05 * th - 0.35 * seg(p, 0.6, 0.75) * (1 - seg(p, 0.85, 1));
        tp.x += 0.05 * wind;
        tr.x += 0.8 * wind - 0.9 * th;
        if (P.pin) P.pin.visible = p < 0.24;
        m.gun.visible = p < 0.55 || (p > 0.85 && s.hasUtil);
        leftKeys = [[0, 'restL'], [0.12, 'pin'], [0.24, 'pin'], [0.42, 'restL']];
        leftP = p;
      }
      if (p >= 1) {
        this.anim = null;
        m.gun.visible = true;
        if (this.quick) {
          this.models[this.quick].holder.visible = false;
          this.quick = null;
          this.models[this.cur].holder.visible = true;
          this.raiseT = 0.6;
        }
      }
    } else if (this.inspectT >= 0) {
      this.inspectT += dt;
      const p = this.inspectT / 2.4;
      if (p >= 1) this.inspectT = -1;
      const a = seg(p, 0.05, 0.25) * (1 - seg(p, 0.45, 0.6));
      const b = seg(p, 0.5, 0.65) * (1 - seg(p, 0.85, 1));
      tr.y -= 0.9 * a; tr.z += 0.5 * a; tp.x -= 0.08 * a; tp.z += 0.05 * a;
      tr.x += 0.6 * b; tr.z -= 0.4 * b; tp.y += 0.05 * b;
    }

    // ----- Smooth + recoil -----
    const k = Math.min(1, dt * 20);
    this.pos.lerp(tp, k);
    this.rot.lerp(tr, k);
    const h = m.holder;
    const kick = this.kick * (1 - this.adsT * 0.5);
    h.position.copy(this.pos);
    h.position.z += kick * 0.055;
    h.position.y += kick * 0.01;
    h.rotation.set(this.rot.x + kick * 0.14, this.rot.y + this.kickYaw * this.kick, this.rot.z);

    if (P.slide) P.slide.position.z = P.slide.userData.base.z + Math.min(1, this.kick) * 0.035;
    if (P.bolt && !this.cycleAnim && s.reload < 0) P.bolt.position.z = P.bolt.userData.base.z + Math.min(1, this.kick) * 0.03;

    this.root.updateMatrixWorld(true);

    // ----- Hands / arms -----
    const pts = this.pts;
    m.gun.localToWorld(pts.grip.set(0, -0.02, 0.03));
    if (P.fore) P.fore.getWorldPosition(pts.fore); else pts.fore.copy(REST_L);
    if (P.mag) P.mag.localToWorld(pts.mag.set(0, -0.08, 0));
    if (P.bolt) P.bolt.getWorldPosition(pts.bolt);
    else if (P.slide) P.slide.localToWorld(pts.bolt.set(0, 0.06, 0.03));
    else pts.bolt.copy(pts.fore);
    if (P.bolt) P.bolt.localToWorld(pts.knob.set(0.07, 0, 0)); else pts.knob.copy(pts.grip);
    if (P.port) P.port.getWorldPosition(pts.port); else pts.port.copy(pts.fore);
    if (P.cyl) P.cyl.getWorldPosition(pts.cyl); else pts.cyl.copy(pts.fore);
    if (P.lid) P.lid.localToWorld(pts.lid.set(0, 0.03, -0.12)); else pts.lid.copy(pts.fore);
    if (P.pin) P.pin.getWorldPosition(pts.pin); else pts.pin.copy(REST_L);

    const handR = rightKeys ? keyBlend(rightP, rightKeys, pts, _h) : _h.copy(pts.grip);
    this.placeArm(SHOULDER_R, handR, POLE_R, this.arms.rU, this.arms.rF, this.gloveR, h.quaternion);
    const handL = leftKeys ? keyBlend(leftP, leftKeys, pts, _v) : _v.copy(pts[leftMode]);
    this.placeArm(SHOULDER_L, handL, POLE_L, this.arms.lU, this.arms.lF, this.gloveL, h.quaternion);

    // Casings
    for (let i = this.casings.length - 1; i >= 0; i--) {
      const c = this.casings[i];
      c.t -= dt;
      c.v.y -= 9 * dt;
      c.m.position.addScaledVector(c.v, dt);
      c.m.rotation.x += dt * 20; c.m.rotation.z += dt * 14;
      if (c.t <= 0) { this.root.remove(c.m); this.casings.splice(i, 1); }
    }
  }

  placeArm(shoulder, hand, pole, upper, fore, glove, quat) {
    solveIK(shoulder, hand, UPPER, FORE, pole, _e, _v);
    upper.set(shoulder, _e);
    fore.set(_e, _v);
    glove.position.copy(_v);
    glove.quaternion.copy(quat);
  }

  // World-space muzzle position relative to the given world camera (for tracers).
  muzzleWorld(worldCam, out) {
    const m = this.model;
    const mz = m.parts.muzzle || m.gun;
    mz.updateWorldMatrix(true, false);
    out.setFromMatrixPosition(mz.matrixWorld);
    out.z = Math.max(out.z, -0.9);
    return out.applyMatrix4(worldCam.matrixWorld);
  }

  render(renderer) {
    renderer.clearDepth();
    renderer.render(this.scene, this.camera);
  }
}

// Per-style reload choreography. Mutates pose/parts and returns left-hand keyframes.
function reloadPose(style, p, P, tp, tr) {
  const tilt = seg(p, 0, 0.15) * (1 - seg(p, 0.85, 1));
  const magY = (out, inn) => {
    if (!P.mag) return;
    const b = P.mag.userData.base;
    if (p < out[0]) return;
    if (p < out[1]) P.mag.position.y = b.y - 0.35 * seg(p, out[0], out[1]);
    else if (p < inn[0]) P.mag.visible = false;
    else P.mag.position.y = b.y - 0.35 * (1 - seg(p, inn[0], inn[1]));
  };
  switch (style) {
    case 'shells': {
      tr.z += 0.6 * tilt; tr.x += 0.1 * tilt; tp.x -= 0.03 * tilt;
      const keys = [[0, 'fore'], [0.1, 'off']];
      for (let i = 0; i < 4; i++) {
        const t0 = 0.12 + i * 0.17;
        keys.push([t0 + 0.08, 'port'], [t0 + 0.11, 'port'], [t0 + 0.17, 'off']);
        if (bump(p, t0 + 0.07, t0 + 0.13) > 0) tr.x += 0.03 * bump(p, t0 + 0.07, t0 + 0.13);
      }
      keys.push([0.84, 'fore'], [1, 'fore']);
      if (P.pump) P.pump.position.z = P.pump.userData.base.z + 0.1 * bump(p, 0.86, 0.98);
      return keys;
    }
    case 'drum': {
      tr.x -= 0.35 * tilt; tr.z += 0.35 * tilt; tp.y += 0.03 * tilt;
      if (P.cyl) P.cyl.rotation.z += seg(p, 0.15, 0.8) * Math.PI * 2;
      return [[0, 'fore'], [0.12, 'cyl'], [0.28, 'off'], [0.4, 'cyl'], [0.55, 'off'], [0.68, 'cyl'], [0.9, 'fore']];
    }
    case 'revolver': {
      tr.z += 0.9 * tilt; tr.x += 0.25 * tilt; tp.x -= 0.03 * tilt;
      if (P.cyl) {
        P.cyl.position.x = P.cyl.userData.base.x - 0.05 * seg(p, 0.1, 0.2) * (1 - seg(p, 0.78, 0.86));
        P.cyl.rotation.z += seg(p, 0.2, 0.32) * Math.PI + seg(p, 0.6, 0.76) * Math.PI * 2;
      }
      return [[0, 'fore'], [0.1, 'cyl'], [0.25, 'cyl'], [0.38, 'off'], [0.55, 'cyl'], [0.82, 'cyl'], [0.94, 'fore']];
    }
    case 'box': {
      tr.z += 0.3 * tilt; tr.x += 0.1 * tilt;
      if (P.lid) P.lid.rotation.x = -1.3 * seg(p, 0.08, 0.18) * (1 - seg(p, 0.74, 0.82));
      magY([0.2, 0.35], [0.5, 0.66]);
      const rack = bump(p, 0.85, 0.95);
      if (P.bolt) P.bolt.position.z = P.bolt.userData.base.z + 0.07 * rack;
      return [[0, 'fore'], [0.07, 'lid'], [0.16, 'lid'], [0.22, 'mag'], [0.35, 'mag'], [0.44, 'off'], [0.52, 'mag'],
        [0.66, 'mag'], [0.72, 'lid'], [0.8, 'lid'], [0.85, 'bolt'], [0.95, 'bolt'], [1, 'fore']];
    }
    default: { // 'mag'
      tr.z += 0.5 * tilt; tr.x += 0.12 * tilt; tp.x -= 0.03 * tilt; tp.y += 0.02 * tilt;
      magY([0.12, 0.3], [0.45, 0.62]);
      const rack = bump(p, 0.72, 0.86);
      if (P.bolt) P.bolt.position.z = P.bolt.userData.base.z + 0.06 * rack;
      if (P.slide) P.slide.position.z = P.slide.userData.base.z + 0.04 * rack;
      tr.x += 0.06 * rack;
      return [[0, 'fore'], [0.1, 'mag'], [0.3, 'mag'], [0.4, 'off'], [0.47, 'mag'], [0.64, 'mag'], [0.72, 'bolt'], [0.86, 'bolt'], [0.96, 'fore']];
    }
  }
}
