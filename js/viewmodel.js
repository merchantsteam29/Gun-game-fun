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

// A damped spring on 3 axes (semi-implicit Euler). Kick it with impulses (v += …) or give it a
// target; it overshoots a little and settles, which is what makes motion feel weighty.
class Spring3 {
  constructor(k, d) { this.k = k; this.d = d; this.x = new THREE.Vector3(); this.v = new THREE.Vector3(); this.target = new THREE.Vector3(); }
  step(dt) {
    const n = dt > 1 / 120 ? Math.ceil(dt * 120) : 1, h = dt / n; // substeps keep stiff springs stable
    for (let i = 0; i < n; i++) {
      this.v.x += ((this.target.x - this.x.x) * this.k - this.v.x * this.d) * h;
      this.v.y += ((this.target.y - this.x.y) * this.k - this.v.y * this.d) * h;
      this.v.z += ((this.target.z - this.x.z) * this.k - this.v.z * this.d) * h;
      this.x.addScaledVector(this.v, h);
    }
    return this.x;
  }
}

// Recoil feel per weapon class: back (m/s impulse), climb (rad/s), roll / yaw scatter.
const RECOIL = {
  pistol: { back: 1.15, up: 0.3, climb: 3.1, roll: 1.5, yaw: 1.0 },
  smg: { back: 0.6, up: 0.15, climb: 1.0, roll: 1.0, yaw: 0.9 },
  rifle: { back: 0.85, up: 0.2, climb: 1.6, roll: 1.2, yaw: 0.8 },
  lmg: { back: 0.9, up: 0.22, climb: 1.4, roll: 1.6, yaw: 1.2 },
  shotgun: { back: 2.0, up: 0.5, climb: 5.2, roll: 2.4, yaw: 1.2 },
  sniper: { back: 2.3, up: 0.55, climb: 5.7, roll: 1.8, yaw: 0.8 },
  launcher: { back: 1.7, up: 0.45, climb: 3.9, roll: 1.8, yaw: 1.0 },
};
function recoilClass(w) {
  if (w.type === 'proj') return 'launcher';
  if (w.pellets > 1) return 'shotgun';
  if (['sniper', 'amr', 'railgun', 'dmr', 'crossbow', 'harpoon'].includes(w.id)) return 'sniper';
  if (['lmg', 'minigun'].includes(w.id)) return 'lmg';
  if (['smg', 'pdw', 'vector', 'microsmg', 'mpistol'].includes(w.id)) return 'smg';
  if (['pistol', 'bpistol', 'handcannon', 'revolver', 'autorev', 'flare', 'nailgun'].includes(w.id)) return 'pistol';
  return 'rifle';
}
const easeOutBack = (t) => { const c = 1.6; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; };

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
    // Springs: recoil position / rotation, look inertia, body motion (jump / land / impacts).
    this.rp = new Spring3(300, 20);
    this.rr = new Spring3(240, 16);
    this.sw = new Spring3(150, 15);
    this.mv = new Spring3(110, 12);
    this.lookAcc = new THREE.Vector2();
    this.wasGround = true;
    this.reloadJolt = false;
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

  // Attachments changed: rebuild the affected guns (the one in hand right away).
  setMods(mods) {
    this.mods = mods || {};
    for (const [id, m] of Object.entries(this.builtModels)) {
      const key = JSON.stringify(this.mods[id] || null);
      if (m.modsKey === key) continue;
      this.root.remove(m.holder);
      m.holder.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      delete this.builtModels[id];
      if (id === this.cur && !this.quick) this.swapTo(id, 0);
    }
  }

  buildModel(id) {
    const holder = new THREE.Group();
    holder.scale.setScalar(S);
    const gun = buildGun(id, this.mods ? this.mods[id] : null);
    holder.add(gun);
    holder.visible = false;
    this.root.add(holder);
    const sight = gun.userData.sight || 0.1;
    // Magnified optics sit closer to the eye so you look into the scope.
    return { id, holder, gun, parts: gun.userData.parts, ads: [0, -sight * S, gun.userData.adsZ ?? -0.3], modsKey: JSON.stringify(this.mods ? this.mods[id] || null : null) };
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
    const big = w.type === 'proj' || ['shotgun', 'sniper', 'revolver', 'sawedoff', 'handcannon', 'dmr', 'doublebarrel', 'railgun', 'amr', 'autoshot', 'slug', 'autorev'].includes(w.id);
    this.kick = Math.min(1.4, this.kick + (big ? 1 : 0.45));
    this.kickYaw = (Math.random() - 0.5) * (big ? 0.12 : 0.05);
    const R = RECOIL[recoilClass(w)], ads = 1 - this.adsT * 0.45, r = () => Math.random() - 0.5;
    this.rp.v.z += R.back * ads;
    this.rp.v.y += R.up * ads;
    this.rp.v.x += r() * R.back * 0.25;
    this.rr.v.x += R.climb * ads;
    this.rr.v.y += r() * R.yaw;
    this.rr.v.z += r() * R.roll;
    this.flashT = w.quiet ? 0 : 0.05; // suppressors hide the flash
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
  landed(k) {
    this.land = Math.max(this.land, k);
    this.mv.v.y -= 0.6 * k;
    this.rr.v.x -= 1.0 * k;
  }

  look(dx, dy) {
    this.lookAcc.x += dx; this.lookAcc.y += dy;
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

    this.adsT += ((s.ads ? 1 : 0) - this.adsT) * Math.min(1, dt * 14 * (s.adsSpeed || 1)); // optics change aim speed
    this.sprintT += ((s.sprint ? 1 : 0) - this.sprintT) * Math.min(1, dt * 9);
    if (!this.next) this.raiseT = Math.max(0, this.raiseT - dt / this.raiseDur);
    this.kick *= Math.exp(-dt * 12);
    this.land *= Math.exp(-dt * 7);
    this.flashT -= dt;
    this.flash.visible = this.flash2.visible = this.flashT > 0;
    this.sway.multiplyScalar(Math.exp(-dt * 8));
    this.cylAngle += (this.cylTarget - this.cylAngle) * Math.min(1, dt * 18);
    if (s.reload >= 0 || s.sprint) this.inspectT = -1;

    // ----- Inertia, jump / land -----
    // The gun lags behind where you look (and rolls into turns), lifts as you jump and drops
    // into a bounce when you land.
    const ld = Math.max(dt, 1 / 240);
    this.sw.target.set(THREE.MathUtils.clamp(this.lookAcc.y / ld * 0.00006, -0.12, 0.12), THREE.MathUtils.clamp(-this.lookAcc.x / ld * 0.00006, -0.14, 0.14), THREE.MathUtils.clamp(-this.lookAcc.x / ld * 0.00009, -0.18, 0.18));
    this.sw.target.multiplyScalar(1 - this.adsT * 0.7);
    this.lookAcc.set(0, 0);
    if (this.wasGround && !s.onGround && s.vy > 1) { this.mv.v.y += 0.3; this.rr.v.x += 0.6; }
    this.wasGround = s.onGround;
    this.mv.target.set(0, s.onGround ? 0 : THREE.MathUtils.clamp(-s.vy * 0.003, -0.025, 0.02), 0);
    this.rp.step(dt); this.rr.step(dt); this.sw.step(dt); this.mv.step(dt);

    // ----- Base pose -----
    const tp = this.tPos.fromArray(HIP[id] || HIP.ar);
    const tr = this.tRot.set(0, 0, 0);
    if (REST_ROT[id]) tr.fromArray(REST_ROT[id]);
    tp.lerp(_v.fromArray(m.ads), this.adsT);
    tr.multiplyScalar(1 - this.adsT);

    // Walk / run: a figure-8 (side to side once per stride, down on every step) with a little
    // roll; bigger and faster when sprinting. Idle: slow breathing.
    const amt = Math.min(1, s.speed / 6) * (s.onGround ? 1 : 0.15) * (1 - this.adsT * 0.85) * (s.bob ?? 1);
    this.bobT += dt * (3.6 + s.speed * 1.45) * (1 + this.sprintT * 0.15);
    const big = 1 + this.sprintT * 0.9;
    const breathe = (1 - amt) * (1 - this.adsT * 0.8);
    tp.x += Math.sin(this.bobT) * 0.013 * amt * big + this.sway.x;
    tp.y += (Math.cos(this.bobT * 2) - 1) * 0.008 * amt * big + this.sway.y + Math.sin(this.t * 1.6) * 0.0035 * breathe;
    tr.x += Math.sin(this.t * 1.6 + 0.6) * 0.008 * breathe + (Math.cos(this.bobT * 2) - 1) * 0.012 * amt;
    tr.z += Math.sin(this.bobT) * 0.025 * amt * big - s.strafe * 0.07 * (1 - this.adsT * 0.7);
    tr.y += Math.sin(this.bobT) * 0.012 * amt;
    // Crouch: lower and cant the gun a touch; slide: tilt it hard.
    const cr = (this.crouchT = (this.crouchT || 0) + ((s.crouch ? 1 : 0) - (this.crouchT || 0)) * Math.min(1, dt * 10));
    const sl = (this.slideTk = (this.slideTk || 0) + ((s.slide ? 1 : 0) - (this.slideTk || 0)) * Math.min(1, dt * 12));
    tp.y -= 0.012 * cr * (1 - this.adsT); tr.z += 0.07 * cr * (1 - this.adsT);
    tp.x -= 0.035 * sl; tp.y -= 0.02 * sl; tr.z += 0.32 * sl * (1 - this.adsT * 0.6); tr.y -= 0.08 * sl;
    tr.y += this.sway.x * 1.5;
    tp.y -= THREE.MathUtils.clamp(s.vy * 0.005, -0.04, 0.04) + this.land * 0.07;
    tr.x -= this.land * 0.08;

    const sp = this.sprintT * this.sprintT * (3 - 2 * this.sprintT); // eased into / out of the sprint pose
    tp.x -= sp * 0.06; tp.y -= sp * 0.045; tp.z += sp * 0.035;
    tr.x -= sp * 0.32; tr.y += sp * 0.68; tr.z += sp * 0.32;

    // Draw (raiseT 1 -> 0): guns swing up from below and settle with a small overshoot; melee
    // weapons sweep in from the side. Holster (lower 0 -> 1) tips the weapon away.
    const meleeW = w.type === 'melee';
    const up = easeOutBack(1 - this.raiseT), e = 1 - up;
    if (meleeW) { tp.x += 0.12 * e; tp.y -= 0.2 * e; tr.y -= 0.9 * e; tr.z -= 0.5 * e; }
    else { tp.y -= 0.32 * e; tr.x -= 0.9 * e; tr.z += 0.45 * e; tr.y += 0.15 * e; }
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
      const roll = bump(p, 0.04, 0.96);
      tr.z += 0.22 * roll; tp.y -= 0.02 * roll; tr.x += 0.05 * roll;
      if (p > 0.6 && !this.reloadJolt) { this.reloadJolt = true; this.rr.v.x -= 1.2; this.rp.v.y += 0.3; } // mag seated
    } else this.reloadJolt = false;
    if (s.reload >= 0 && s.reload < 0.05) this.reloadJolt = false;

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
      if (!a.hit && ((a.name === 'slash' && p > 0.4) || (a.name === 'chop' && p > 0.45))) { a.hit = true; this.rr.v.z -= 1.5 * (a.side || 1); this.rp.v.z -= 0.6; }
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
      // Turn it to show the side, flip to the top, then back to the hands with a settle.
      const a = seg(p, 0.04, 0.22) * (1 - seg(p, 0.4, 0.52));
      const b = seg(p, 0.45, 0.6) * (1 - seg(p, 0.76, 0.9));
      const c = seg(p, 0.86, 0.95) * (1 - seg(p, 0.95, 1));
      tr.y -= 1.0 * a; tr.z += 0.55 * a; tp.x -= 0.09 * a; tp.z += 0.06 * a; tp.y += 0.02 * a;
      tr.x += 0.7 * b; tr.z -= 0.5 * b; tp.y += 0.06 * b; tp.x -= 0.03 * b;
      tr.x -= 0.08 * c;
    }

    // ----- Smooth + recoil -----
    const k = Math.min(1, dt * 20);
    this.pos.lerp(tp, k);
    this.rot.lerp(tr, k);
    const h = m.holder;
    const kick = this.kick * (1 - this.adsT * 0.5);
    h.position.copy(this.pos).add(this.rp.x).add(this.mv.x);
    h.position.z += kick * 0.02;
    h.rotation.set(this.rot.x + this.rr.x.x + this.sw.x.x, this.rot.y + this.rr.x.y + this.sw.x.y, this.rot.z + this.rr.x.z + this.sw.x.z);

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
