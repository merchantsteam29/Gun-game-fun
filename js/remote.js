import * as THREE from 'three';
import { RoundedBoxGeometry as RoundedBox } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { buildGun, modelQuality } from './models.js';

// Plain boxes on phones (see modelQuality).
const RoundedBoxGeometry = function (sx, sy, sz, seg, r) {
  return modelQuality.rounded ? new RoundedBox(sx, sy, sz, seg, r) : new THREE.BoxGeometry(sx, sy, sz);
};
import { WEAPONS } from './weapons.js';
import { angLerp } from './util.js';
import { Limb, solveIK } from './rig.js';

const legMat = new THREE.MeshStandardMaterial({ color: '#2b2f36', roughness: 0.9 });
const skinMat = new THREE.MeshStandardMaterial({ color: '#d6a682', roughness: 0.8 });
const bootMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.9 });
const gloveMat = new THREE.MeshStandardMaterial({ color: '#1e1f22', roughness: 0.9 });
const vestMat = new THREE.MeshStandardMaterial({ color: '#3b4030', roughness: 0.85 });
const pouchMat = new THREE.MeshStandardMaterial({ color: '#4a5038', roughness: 0.9 });
const beltMat = new THREE.MeshStandardMaterial({ color: '#23262b', roughness: 0.8 });
const metalMat = new THREE.MeshStandardMaterial({ color: '#8d939a', roughness: 0.35, metalness: 0.6 });
const helmetRimMat = new THREE.MeshStandardMaterial({ color: '#2c3036', roughness: 0.7 });
const lensMat = new THREE.MeshStandardMaterial({ color: '#1a2a3a', roughness: 0.1, metalness: 0.5, emissive: '#0b2033' });

const THIGH = 0.46, SHIN = 0.46, UPPER = 0.3, FORE = 0.3;
const HIP_Y = 0.94;

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _m = new THREE.Vector3(), _e = new THREE.Vector3();
const _pole = new THREE.Vector3(), _q = new THREE.Quaternion(), _axis = new THREE.Vector3();
const YAXIS = new THREE.Vector3(0, 1, 0);

function mesh(geo, mat, x, y, z, parent) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}

function nameTag(name, color) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.font = '600 30px Chakra Petch, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 6;
  g.strokeStyle = 'rgba(0,0,0,0.8)';
  g.strokeText(name, 128, 32);
  g.fillStyle = color;
  g.fillText(name, 128, 32);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  s.scale.set(1.4, 0.35, 1);
  return s;
}

// Another player's avatar, interpolated from host snapshots. Limbs are solved with IK
// every frame from foot targets (walk cycle) and gun hand anchors.
export class RemotePlayer {
  constructor(scene, id, name, color) {
    this.id = id;
    this.name = name;
    this.color = color;
    this.scene = scene;
    this.pos = new THREE.Vector3(0, -100, 0);
    this.tpos = new THREE.Vector3(0, -100, 0);
    this.prev = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0; this.tyaw = 0;
    this.pitch = 0; this.tpitch = 0;
    this.crouch = 0; this.tcrouch = 0;
    this.flags = 0;
    this.alive = false;
    this.hasState = false;
    this.weapon = null;
    this.phase = 0;
    this.stepped = false;
    this.air = 0;
    this.sprint = 0;
    this.reload = 0;
    this.recoil = 0;
    this.swingT = 0; this.swingStyle = 'slash';
    this.throwT = 0;
    this.swapT = 0;
    this.deathT = 0;
    this.fallDir = new THREE.Vector3(0, 0, 1);

    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.75 });
    this.bodyMat = bodyMat;
    this.root = new THREE.Group();
    this.hips = new THREE.Group();
    this.hips.position.y = HIP_Y;
    this.root.add(this.hips);
    mesh(new RoundedBoxGeometry(0.44, 0.2, 0.26, 2, 0.04), legMat, 0, 0, 0, this.hips);
    mesh(new THREE.BoxGeometry(0.46, 0.05, 0.28), beltMat, 0, 0.07, 0, this.hips); // belt
    mesh(new THREE.BoxGeometry(0.08, 0.06, 0.03), metalMat, 0, 0.07, -0.145, this.hips);

    this.spine = new THREE.Group();
    this.spine.position.y = 0.08;
    this.hips.add(this.spine);
    // Shirt in the player's color with a plate carrier over it
    mesh(new RoundedBoxGeometry(0.5, 0.56, 0.28, 2, 0.06), bodyMat, 0, 0.3, 0, this.spine);
    mesh(new RoundedBoxGeometry(0.46, 0.38, 0.33, 2, 0.04), vestMat, 0, 0.3, 0, this.spine);
    for (let i = -1; i <= 1; i++) mesh(new THREE.BoxGeometry(0.11, 0.12, 0.05), pouchMat, i * 0.13, 0.2, -0.18, this.spine);
    mesh(new THREE.BoxGeometry(0.3, 0.06, 0.03), pouchMat, 0, 0.42, -0.175, this.spine);
    for (const s of [-1, 1]) mesh(new RoundedBoxGeometry(0.16, 0.1, 0.24, 2, 0.03), bodyMat, s * 0.27, 0.53, 0, this.spine); // shoulders
    mesh(new RoundedBoxGeometry(0.38, 0.34, 0.12, 2, 0.03), legMat, 0, 0.32, 0.21, this.spine); // backpack
    mesh(new THREE.BoxGeometry(0.3, 0.06, 0.13), pouchMat, 0, 0.17, 0.22, this.spine);

    this.neck = new THREE.Group();
    this.neck.position.y = 0.56;
    this.spine.add(this.neck);
    mesh(new RoundedBoxGeometry(0.28, 0.3, 0.28, 2, 0.06), skinMat, 0, 0.15, 0, this.neck);
    // Helmet (team color), goggles and chin strap
    const helmet = mesh(new THREE.SphereGeometry(0.185, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), bodyMat, 0, 0.22, 0.01, this.neck);
    helmet.scale.set(1, 0.85, 1.05);
    mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.035, 16), helmetRimMat, 0, 0.22, 0.01, this.neck);
    mesh(new RoundedBoxGeometry(0.27, 0.075, 0.05, 2, 0.02), bootMat, 0, 0.19, -0.14, this.neck);
    for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(0.09, 0.05, 0.01), lensMat, s * 0.06, 0.19, -0.166, this.neck);
    mesh(new THREE.BoxGeometry(0.29, 0.02, 0.29), beltMat, 0, 0.19, 0, this.neck); // goggle strap

    // Aim pivot at shoulder height carries the gun; arms are solved to its anchors.
    this.aim = new THREE.Group();
    this.aim.position.y = 0.5;
    this.spine.add(this.aim);
    this.gunHolder = new THREE.Group();
    this.aim.add(this.gunHolder);
    this.guns = {};

    this.shoulderL = new THREE.Object3D(); this.shoulderL.position.set(-0.29, 0.52, 0); this.spine.add(this.shoulderL);
    this.shoulderR = new THREE.Object3D(); this.shoulderR.position.set(0.29, 0.52, 0); this.spine.add(this.shoulderR);
    this.hipL = new THREE.Object3D(); this.hipL.position.set(-0.13, -0.05, 0); this.hips.add(this.hipL);
    this.hipR = new THREE.Object3D(); this.hipR.position.set(0.13, -0.05, 0); this.hips.add(this.hipR);

    // World-space limbs (parent has identity transform).
    this.limbs = new THREE.Group();
    this.legs = [
      { hip: this.hipL, thigh: new Limb(this.limbs, legMat, 0.19, 0.21), shin: new Limb(this.limbs, legMat, 0.16, 0.18), foot: mesh(new THREE.BoxGeometry(0.17, 0.1, 0.3), bootMat, 0, 0, 0, this.limbs), side: -1 },
      { hip: this.hipR, thigh: new Limb(this.limbs, legMat, 0.19, 0.21), shin: new Limb(this.limbs, legMat, 0.16, 0.18), foot: mesh(new THREE.BoxGeometry(0.17, 0.1, 0.3), bootMat, 0, 0, 0, this.limbs), side: 1 },
    ];
    this.armsL = { sh: this.shoulderL, up: new Limb(this.limbs, bodyMat, 0.14), fo: new Limb(this.limbs, bodyMat, 0.12), hand: mesh(new THREE.BoxGeometry(0.09, 0.09, 0.1), gloveMat, 0, 0, 0, this.limbs) };
    this.armsR = { sh: this.shoulderR, up: new Limb(this.limbs, bodyMat, 0.14), fo: new Limb(this.limbs, bodyMat, 0.12), hand: mesh(new THREE.BoxGeometry(0.09, 0.09, 0.1), gloveMat, 0, 0, 0, this.limbs) };

    this.tag = nameTag(name, color);
    this.tag.position.set(0, 2.15, 0);
    this.root.add(this.tag);

    this.root.visible = this.limbs.visible = false;
    scene.add(this.root, this.limbs);
  }

  // Team/zombie color; ally name tags show through walls.
  setLook(color, ally) {
    if (color === this.lookColor && ally === this.ally) return;
    this.lookColor = color;
    this.ally = ally;
    this.bodyMat.color.set(color);
    const old = this.tag;
    this.tag = nameTag(this.name, color);
    this.tag.position.copy(old.position);
    this.tag.material.depthTest = !ally;
    this.tag.renderOrder = ally ? 10 : 0;
    this.root.remove(old);
    old.material.map.dispose();
    old.material.dispose();
    this.root.add(this.tag);
  }

  setWeapon(id) {
    if (id === this.weapon || !WEAPONS[id]) return;
    if (this.weapon && this.guns[this.weapon]) this.guns[this.weapon].visible = false;
    if (!this.guns[id]) {
      const g = buildGun(id);
      g.scale.setScalar(1.25);
      this.gunHolder.add(g);
      this.guns[id] = g;
    }
    this.guns[id].visible = true;
    if (this.weapon && this.alive) this.swapT = 1;
    this.weapon = id;
  }

  // a = [x, y, z, yaw, pitch, weapon, crouch, alive, hp, kills, deaths, flags]
  setState(a) {
    const alive = !!a[7];
    this.tpos.set(a[0], a[1], a[2]);
    this.tyaw = a[3];
    this.tpitch = a[4];
    this.tcrouch = a[6] ? 1 : 0;
    this.flags = a[11] || 0;
    this.setWeapon(a[5]);
    if (alive && (!this.alive || !this.hasState || this.pos.distanceTo(this.tpos) > 6)) {
      this.pos.copy(this.tpos);
      this.prev.copy(this.tpos);
      this.yaw = this.tyaw;
      this.deathT = 0;
      this.root.quaternion.identity();
    }
    if (!alive && this.alive && this.deathT === 0) this.die(null);
    this.alive = alive;
    this.hasState = true;
  }

  fire() { this.recoil = 1; }
  melee(style) { this.swingT = 1; this.swingStyle = style || 'slash'; }
  throwAnim() { this.throwT = 1; }

  // Fall away from `from` (a world position) if known.
  die(from) {
    if (this.deathT > 0) return;
    this.deathT = 0.001;
    if (from) this.fallDir.set(this.pos.x - from.x, 0, this.pos.z - from.z);
    else this.fallDir.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    if (this.fallDir.lengthSq() < 1e-4) this.fallDir.set(0, 0, 1);
    this.fallDir.normalize();
  }

  update(dt) {
    if (!this.hasState) return;
    this.stepped = false;
    this.prev.copy(this.pos);
    if (this.alive) {
      this.pos.lerp(this.tpos, 1 - Math.exp(-dt * 16));
      this.yaw = angLerp(this.yaw, this.tyaw, 1 - Math.exp(-dt * 20));
      this.pitch += (this.tpitch - this.pitch) * (1 - Math.exp(-dt * 20));
    }
    const k = Math.min(1, dt * 10);
    this.crouch += (this.tcrouch - this.crouch) * Math.min(1, dt * 12);
    this.air += ((this.flags & 4 ? 1 : 0) - this.air) * k;
    this.sprint += ((this.flags & 2 ? 1 : 0) - this.sprint) * k;
    this.reload += ((this.flags & 1 ? 1 : 0) - this.reload) * k;
    this.recoil *= Math.exp(-dt * 14);
    this.swingT = Math.max(0, this.swingT - dt * (this.swingStyle === 'chop' ? 1.4 : 2.6));
    this.throwT = Math.max(0, this.throwT - dt * 1.8);
    this.swapT = Math.max(0, this.swapT - dt * 3);

    this.vel.subVectors(this.pos, this.prev).divideScalar(Math.max(dt, 1e-4));
    const speed = Math.min(9, Math.hypot(this.vel.x, this.vel.z));
    const moving = Math.min(1, speed / 1.5) * (1 - this.air);
    const lastPhase = this.phase;
    this.phase += dt * (speed * 2.1 + 0.001);
    if (Math.floor(lastPhase / Math.PI) !== Math.floor(this.phase / Math.PI) && moving > 0.5 && this.alive) this.stepped = true;

    // Root
    this.root.position.copy(this.pos);
    if (this.deathT > 0) {
      this.deathT += dt;
      const f = Math.min(1, this.deathT / 0.55);
      _axis.crossVectors(YAXIS, this.fallDir).normalize();
      this.root.quaternion.setFromAxisAngle(YAXIS, this.yaw);
      _q.setFromAxisAngle(_axis, f * f * Math.PI / 2);
      this.root.quaternion.premultiply(_q);
      if (this.deathT > 3) this.root.position.y -= (this.deathT - 3) * 0.6;
    } else {
      this.root.quaternion.setFromAxisAngle(YAXIS, this.yaw);
    }

    // Hips: crouch lowers, walking bobs.
    const bob = Math.abs(Math.sin(this.phase)) * 0.04 * moving;
    const dying = this.deathT > 0 ? Math.min(1, this.deathT / 0.4) : 0;
    this.hips.position.y = HIP_Y - this.crouch * 0.32 - bob + this.air * 0.05 - dying * 0.25;
    this.spine.rotation.x = -this.sprint * 0.25 + this.pitch * 0.2 - this.crouch * 0.15;
    this.neck.rotation.x = this.pitch * 0.5 + this.sprint * 0.2;
    this.spine.rotation.y = Math.sin(this.phase) * 0.06 * moving;

    // Gun pose
    const w = WEAPONS[this.weapon] || WEAPONS.ar;
    const melee = w.type === 'melee', thrown = w.type === 'throw';
    const pistol = ['pistol', 'revolver', 'mpistol', 'handcannon', 'sawedoff', 'bpistol', 'flare'].includes(this.weapon);
    const gh = this.gunHolder;
    if (melee) gh.position.set(0.24, -0.32, -0.32);
    else if (thrown) gh.position.set(0.24, -0.2, -0.3);
    else if (pistol) gh.position.set(0.06, -0.05, -0.48);
    else gh.position.set(0.14, -0.06, -0.36);
    gh.rotation.set(melee ? 0.9 : 0, 0, 0);
    this.aim.rotation.set(this.pitch * (1 - this.sprint * 0.6) - this.sprint * 0.5, this.sprint * 0.5, 0);
    gh.position.z += this.recoil * 0.08;
    gh.rotation.x += this.recoil * 0.25;
    if (this.swapT > 0) { // newly drawn weapon comes up from the hip
      const e = this.swapT * this.swapT;
      gh.position.y -= 0.3 * e; gh.rotation.x -= 0.9 * e;
    }
    if (this.reload > 0.01) { gh.rotation.z += 0.5 * this.reload; gh.rotation.x -= 0.3 * this.reload; gh.position.y -= 0.06 * this.reload; }
    if (this.swingT > 0) {
      const p = 1 - this.swingT;
      if (this.swingStyle === 'chop') {
        const r = Math.sin(Math.min(1, p / 0.45) * Math.PI / 2) * (p < 0.45 ? 1 : 0);
        const c = p >= 0.45 ? Math.sin(Math.min(1, (p - 0.45) / 0.55) * Math.PI) : 0;
        gh.rotation.x += 1.6 * r - 1.2 * c;
        gh.position.y += 0.35 * r;
      } else {
        const s = Math.sin(p * Math.PI);
        gh.rotation.y += 1.4 * s - 0.7;
        gh.position.x -= 0.3 * s;
        gh.position.z -= 0.25 * s;
      }
    }
    if (this.throwT > 0) {
      const p = 1 - this.throwT;
      const wind = p < 0.4 ? Math.sin((p / 0.4) * Math.PI / 2) : Math.max(0, 1 - (p - 0.4) / 0.15);
      const th = p > 0.4 ? Math.sin(Math.min(1, (p - 0.4) / 0.6) * Math.PI) : 0;
      gh.position.y += 0.35 * wind;
      gh.position.z += 0.25 * wind - 0.4 * th;
      gh.rotation.x += 1.2 * wind - 0.8 * th;
    }

    this.root.updateMatrixWorld(true);

    // Legs: foot targets in root space -> world, knees solved with IK.
    const dirX = this.vel.x, dirZ = this.vel.z;
    // Movement direction in root-local space (root faces -Z).
    const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
    let lx = dirX * cy - dirZ * sy, lz = dirX * sy + dirZ * cy;
    const ll = Math.hypot(lx, lz) || 1;
    lx /= ll; lz /= ll;
    const stride = Math.min(0.42, speed * 0.07) * moving;
    const lift = Math.min(0.22, speed * 0.04) * moving;
    for (const leg of this.legs) {
      const ph = this.phase + (leg.side > 0 ? Math.PI : 0);
      const fx = leg.side * (0.13 + this.crouch * 0.08), fz = -this.crouch * 0.12;
      const sw = Math.sin(ph) * stride;
      let ty = Math.max(0, Math.cos(ph)) * lift + 0.06;
      let tx = fx + lx * sw, tz = fz + lz * sw;
      if (this.air > 0.01) { ty += this.air * (leg.side > 0 ? 0.35 : 0.2); tz += this.air * (leg.side > 0 ? -0.15 : 0.12); }
      if (this.deathT > 0) ty += dying * 0.2;
      this.root.localToWorld(_b.set(tx, ty, tz));
      leg.hip.getWorldPosition(_a);
      // Knee points forward (root -Z).
      _pole.set(0, 0, -1).applyQuaternion(this.root.quaternion);
      solveIK(_a, _b, THIGH, SHIN, _pole, _m, _e);
      leg.thigh.set(_a, _m);
      leg.shin.set(_m, _e);
      leg.foot.position.copy(_e);
      leg.foot.position.y -= 0.02;
      leg.foot.quaternion.copy(this.root.quaternion);
    }

    // Arms: right hand on the grip, left hand on the fore anchor (or relaxed at the side).
    const gun = this.guns[this.weapon];
    const parts = gun ? gun.userData.parts : {};
    if (gun) gun.localToWorld(_b.set(0, -0.02, 0.03)); else this.root.localToWorld(_b.set(0.3, 0.9, -0.2));
    this.placeArm(this.armsR, _b, 1);
    if (parts.fore && !this.reload) parts.fore.getWorldPosition(_b);
    else if (gun && this.reload > 0.01) gun.localToWorld(_b.set(0, -0.15 - Math.abs(Math.sin(this.phase * 2 + performance.now() / 300)) * 0.05, -0.1));
    else this.root.localToWorld(_b.set(-0.33, 0.78 - this.crouch * 0.3, -0.05 + Math.sin(this.phase) * 0.12 * moving));
    this.placeArm(this.armsL, _b, -1);

    const vis = this.deathT > 0 ? this.deathT < 4 : this.alive;
    this.root.visible = this.limbs.visible = vis;
    this.tag.visible = this.alive && this.deathT === 0;
  }

  placeArm(arm, hand, side) {
    arm.sh.getWorldPosition(_a);
    _pole.set(side * 0.6, -1, 0.4).applyQuaternion(this.root.quaternion);
    solveIK(_a, hand, UPPER, FORE, _pole, _m, _e);
    arm.up.set(_a, _m);
    arm.fo.set(_m, _e);
    arm.hand.position.copy(_e);
    arm.hand.quaternion.copy(this.root.quaternion);
  }

  // Head box is checked first so headshots win on overlap.
  hitboxes() {
    const p = this.pos, s = 1 - this.crouch * 0.2;
    const top = 1.42 * s;
    const hc = p.y + 1.63 * s;
    return [
      { head: true, x0: p.x - 0.21, y0: hc - 0.2, z0: p.z - 0.21, x1: p.x + 0.21, y1: hc + 0.24, z1: p.z + 0.21 },
      { head: false, x0: p.x - 0.36, y0: p.y, z0: p.z - 0.36, x1: p.x + 0.36, y1: p.y + top, z1: p.z + 0.36 },
    ];
  }

  center(out) { return out.set(this.pos.x, this.pos.y + 0.9 * (1 - this.crouch * 0.2), this.pos.z); }
  headPos(out) { return out.set(this.pos.x, this.pos.y + 1.63 * (1 - this.crouch * 0.2), this.pos.z); }

  dispose() {
    this.scene.remove(this.root, this.limbs);
  }
}
