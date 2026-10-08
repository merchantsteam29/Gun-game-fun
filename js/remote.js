import * as THREE from 'three';
import { overlap } from './physics.js';
import { RoundedBoxGeometry as RoundedBox } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { buildGun, modelQuality, mergeStatic } from './models.js';
import { buildCosmetics } from './cosmetics.js';
import { DEFAULT_COS } from './missions.js';

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

const THIGH = 0.46, SHIN = 0.46, UPPER = 0.3, FORE = 0.3;
const HIP_Y = 0.94;

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _m = new THREE.Vector3(), _e = new THREE.Vector3();
const _pole = new THREE.Vector3(), _q = new THREE.Quaternion(), _axis = new THREE.Vector3(), _hb = new THREE.Vector3();

// Other players are drawn slightly in the past so there are always two snapshots to blend between.
const INTERP_MS = 110, EXTRAP_MS = 120;
// Estimated (local clock − host clock), kept up to date by Game from snapshot timestamps.
export const netClock = { off: 0 };
const YAXIS = new THREE.Vector3(0, 1, 0);

function mesh(geo, mat, x, y, z, parent) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}

// Staff get a colored role line above their name (see roles.js).
const TAG_ROLES = { owner: ['♛ OWNER', '#ffd23f'], mod: ['🛡 MOD', '#4fc3ff'] };
function nameTag(name, color, role = null) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 96;
  const g = c.getContext('2d');
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 6;
  g.strokeStyle = 'rgba(0,0,0,0.8)';
  const r = TAG_ROLES[role];
  if (r) {
    g.font = '800 22px Chakra Petch, sans-serif';
    g.strokeText(r[0], 128, 30);
    g.fillStyle = r[1];
    g.fillText(r[0], 128, 30);
  }
  g.font = '600 30px Chakra Petch, sans-serif';
  g.strokeText(name, 128, 64);
  g.fillStyle = r ? r[1] : color;
  g.fillText(name, 128, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  s.scale.set(1.4, 0.525, 1);
  return s;
}

// Another player's avatar, interpolated from host snapshots. Limbs are solved with IK
// every frame from foot targets (walk cycle) and gun hand anchors.
export class RemotePlayer {
  constructor(scene, id, name, color, cos, mods = null) {
    this.id = id;
    this.mods = mods || {}; // their attachments, so their guns look like what they picked
    this.name = name;
    this.color = color;
    this.scene = scene;
    this.pos = new THREE.Vector3(0, -100, 0);
    this.tpos = new THREE.Vector3(0, -100, 0);
    this.prev = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.buf = []; // recent snapshots { t (host ms), p, yaw, pitch }
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
    this.deathVel = new THREE.Vector3();
    this.deathTwist = 0;
    this.deathFloor = 0;

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

    this.neck = new THREE.Group();
    this.neck.position.y = 0.56;
    this.spine.add(this.neck);
    mesh(new RoundedBoxGeometry(0.28, 0.3, 0.28, 2, 0.06), skinMat, 0, 0.15, 0, this.neck);
    // Hat, hair, face and back items come from cosmetics (see setCosmetics).

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

    mergeStatic(this.root); // body parts per bone -> one mesh per material
    this.cos = null;
    this.setCosmetics(cos);

    this.tag = nameTag(name, color);
    this.tag.position.set(0, 2.15, 0);
    this.root.add(this.tag);

    this.root.visible = this.limbs.visible = false;
    if (!modelQuality.remoteShadows) for (const g of [this.root, this.limbs]) g.traverse((o) => { o.castShadow = false; });
    scene.add(this.root, this.limbs);
  }

  // Team/zombie color; ally name tags show through walls.
  setLook(color, ally) {
    if (color === this.lookColor && ally === this.ally) return;
    this.lookColor = color;
    this.ally = ally;
    this.bodyMat.color.set(color);
    this.rebuildTag();
  }

  // New name and/or staff role (proved to the host mid-lobby, or an impostor renamed).
  setIdentity(name, role) {
    if (name === this.name && role === this.role) return;
    this.name = name;
    this.role = role;
    this.rebuildTag();
  }

  rebuildTag() {
    const ally = this.ally, color = this.lookColor || this.color;
    const old = this.tag;
    this.tag = nameTag(this.name, color, this.role);
    this.tag.position.copy(old.position); // keeps Big Heads height
    this.tag.material.depthTest = !ally;
    this.tag.renderOrder = ally ? 10 : 0;
    this.root.remove(old);
    old.material.map.dispose();
    old.material.dispose();
    this.root.add(this.tag);
  }

  setCosmetics(c) {
    const cos = c || DEFAULT_COS;
    if (this.cos && JSON.stringify(this.cos) === JSON.stringify(cos)) return;
    this.cos = cos;
    for (const g of [this.cosHead, this.cosBack, this.hatFly && this.hat]) {
      if (!g) continue;
      if (g.parent) g.parent.remove(g);
      g.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    }
    this.hatFly = null;
    const { head, back, hat } = buildCosmetics(cos, this.bodyMat);
    this.hat = hat;
    mergeStatic(head);
    mergeStatic(back);
    if (!modelQuality.remoteShadows) for (const g of [head, back]) g.traverse((o) => { o.castShadow = false; });
    this.neck.add(head);
    this.spine.add(back);
    this.cosHead = head;
    this.cosBack = back;
  }

  setWeapon(id) {
    if (id === this.weapon || !WEAPONS[id]) return;
    if (this.weapon && this.guns[this.weapon]) this.guns[this.weapon].visible = false;
    if (!this.guns[id]) {
      const g = buildGun(id, this.mods[id]);
      g.scale.setScalar(1.25);
      if (!modelQuality.remoteShadows) g.traverse((o) => { o.castShadow = false; });
      this.gunHolder.add(g);
      this.guns[id] = g;
    }
    this.guns[id].visible = true;
    if (this.weapon && this.alive) this.swapT = 1;
    this.weapon = id;
  }

  // They changed attachments: rebuild their guns (the one in hand straight away).
  setMods(mods) {
    this.mods = mods || {};
    for (const g of Object.values(this.guns)) {
      this.gunHolder.remove(g);
      g.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    }
    this.guns = {};
    const cur = this.weapon;
    this.weapon = null;
    if (cur) { this.setWeapon(cur); this.swapT = 0; }
  }

  // a = [x, y, z, yaw, pitch, weapon, crouch, alive, hp, kills, deaths, flags]
  // tm = the host's clock when it sent this snapshot (for smooth interpolation).
  setState(a, tm = 0) {
    const alive = !!a[7];
    this.tpos.set(a[0], a[1], a[2]);
    this.tyaw = a[3];
    this.tpitch = a[4];
    this.tcrouch = a[6] ? 1 : 0;
    this.flags = a[11] || 0;
    this.setWeapon(a[5]);
    const jump = !this.alive || !this.hasState || this.tpos.distanceTo(this.buf.length ? this.buf[this.buf.length - 1].p : this.pos) > 6;
    if (alive && jump) { // spawned / respawned / teleported: no sliding across the map
      this.pos.copy(this.tpos);
      this.prev.copy(this.tpos);
      this.yaw = this.tyaw;
      this.deathT = 0;
      this.root.quaternion.identity();
      this.restoreHat();
      this.buf.length = 0;
    }
    if (tm) {
      const last = this.buf[this.buf.length - 1];
      if (!last || tm > last.t) {
        this.buf.push({ t: tm, p: this.tpos.clone(), yaw: this.tyaw, pitch: this.tpitch });
        if (this.buf.length > 40) this.buf.shift();
      }
    }
    if (!alive && this.alive && this.deathT === 0) this.die(null);
    this.alive = alive;
    this.hasState = true;
  }

  // Shows where the player was INTERP_MS ago (in host time), blending between the two snapshots
  // around that moment. Late, bunched-up or missing packets then don't make anyone jump around.
  interpolate() {
    const b = this.buf;
    const rt = Date.now() - netClock.off - INTERP_MS;
    while (b.length > 2 && b[1].t <= rt) b.shift(); // keep one snapshot before the render time
    const a = b[0], c = b[1];
    if (!c || rt <= a.t) { // only one snapshot, or not caught up to the oldest: hold it
      this.pos.copy(a.p); this.yaw = a.yaw; this.pitch = a.pitch;
      return;
    }
    if (rt <= c.t) {
      const k = (rt - a.t) / (c.t - a.t);
      this.pos.lerpVectors(a.p, c.p, k);
      this.yaw = angLerp(a.yaw, c.yaw, k);
      this.pitch = a.pitch + (c.pitch - a.pitch) * k;
      return;
    }
    // Ran past the newest snapshot (packets late): keep moving a little, then hold.
    const over = Math.min(rt - c.t, EXTRAP_MS) / Math.max(1, c.t - a.t);
    this.pos.lerpVectors(a.p, c.p, 1 + over);
    this.yaw = c.yaw;
    this.pitch = c.pitch;
  }

  fire() { this.recoil = 1; }
  melee(style) { this.swingT = 1; this.swingStyle = style || 'slash'; }
  throwAnim() { this.throwT = 1; }

  // Fall away from `from` (a world position) if known, thrown harder by big hits (force: ~2 normal,
  // 4–5 shotguns / snipers, 7+ explosives). A headshot also knocks the hat off.
  die(from, head = false, force = 2) {
    if (this.deathT > 0) return;
    this.deathT = 0.001;
    if (from) this.fallDir.set(this.pos.x - from.x, 0, this.pos.z - from.z);
    else this.fallDir.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    if (this.fallDir.lengthSq() < 1e-4) this.fallDir.set(0, 0, 1);
    this.fallDir.normalize();
    // Knocked back (and up, for explosions), with a random twist so no two deaths look the same.
    this.deathVel.set(this.fallDir.x * force, force >= 6 ? force * 0.75 : force * 0.25, this.fallDir.z * force);
    this.deathTwist = (Math.random() - 0.5) * (force >= 6 ? 3 : 1.2);
    this.deathFloor = this.pos.y;
    this.deathSplay = 0.6 + Math.random() * 0.4;
    if (head) this.popHat();
  }

  popHat() {
    const hat = this.hat;
    if (!hat || this.hatFly || !hat.children.length || !hat.parent) return;
    this.scene.attach(hat); // keeps its world transform
    this.hatFly = {
      vel: new THREE.Vector3(this.fallDir.x * 3.2 + (Math.random() - 0.5), 4.2 + Math.random() * 1.5, this.fallDir.z * 3.2 + (Math.random() - 0.5)),
      spin: new THREE.Vector3((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 14),
      floor: this.pos.y - 0.2, // the hat's origin sits at the base of the head
      t: 0,
    };
  }

  restoreHat() {
    if (!this.hatFly || !this.hat || !this.cosHead) return;
    this.hatFly = null;
    this.cosHead.add(this.hat);
    this.hat.position.set(0, 0, 0);
    this.hat.rotation.set(0, 0, 0);
    this.hat.scale.set(1, 1, 1);
    this.hat.visible = true;
  }

  updateHat(dt) {
    const f = this.hatFly;
    if (!f || f.t < 0) return;
    f.t += dt;
    const h = this.hat;
    if (h.position.y > f.floor || f.vel.y > 0) {
      f.vel.y -= 16 * dt;
      h.position.addScaledVector(f.vel, dt);
      h.rotation.x += f.spin.x * dt; h.rotation.y += f.spin.y * dt; h.rotation.z += f.spin.z * dt;
      if (h.position.y < f.floor) { h.position.y = f.floor; f.vel.set(0, 0, 0); }
    }
    if (f.t > 4) h.visible = false; // gone with the body
    else h.visible = true;
  }

  update(dt) {
    if (!this.hasState) return;
    this.stepped = false;
    this.prev.copy(this.pos);
    if (this.alive) {
      if (this.buf.length) this.interpolate();
      else {
        this.pos.lerp(this.tpos, 1 - Math.exp(-dt * 16));
        this.yaw = angLerp(this.yaw, this.tyaw, 1 - Math.exp(-dt * 20));
        this.pitch += (this.tpitch - this.pitch) * (1 - Math.exp(-dt * 20));
      }
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

    // Root (dead bodies fly back, bounce and slide to a stop)
    if (this.deathT > 0 && this.deathT < 3) {
      const v = this.deathVel;
      v.y -= 18 * dt;
      const ox = this.pos.x, oz = this.pos.z;
      this.pos.addScaledVector(v, dt);
      if (overlap(this.pos.x, this.pos.y + 0.6, this.pos.z, 0.25, 0.5)) { this.pos.x = ox; this.pos.z = oz; v.x = 0; v.z = 0; } // hit a wall
      if (this.pos.y < this.deathFloor) {
        this.pos.y = this.deathFloor;
        v.y = v.y < -2 ? -v.y * 0.3 : 0;
        v.x *= 0.55; v.z *= 0.55;
      }
      v.x *= Math.exp(-dt * 1.5); v.z *= Math.exp(-dt * 1.5);
    }
    this.root.position.copy(this.pos);
    if (this.deathT > 0) {
      this.deathT += dt;
      const f = Math.min(1, this.deathT / 0.5);
      _axis.crossVectors(YAXIS, this.fallDir).normalize();
      this.root.quaternion.setFromAxisAngle(YAXIS, this.yaw + this.deathTwist * f);
      _q.setFromAxisAngle(_axis, (f * f * (3 - 2 * f)) * Math.PI / 2 * (1 + Math.max(0, Math.sin(Math.min(1, this.deathT / 0.7) * Math.PI)) * 0.08));
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
    const pistol = ['pistol', 'bpistol', 'revolver', 'autorev', 'mpistol', 'microsmg', 'handcannon', 'sawedoff', 'flare'].includes(this.weapon);
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
      if (this.deathT > 0) { ty += dying * 0.2; tx += leg.side * dying * 0.22 * (this.deathSplay || 1); tz += dying * (leg.side > 0 ? 0.15 : -0.1); }
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
    const flop = this.deathT > 0 ? Math.min(1, this.deathT / 0.45) : 0;
    if (flop) this.root.localToWorld(_b.set(0.62 * (this.deathSplay || 1), 1.05 - flop * 0.15, 0.1));
    else if (gun) gun.localToWorld(_b.set(0, -0.02, 0.03)); else this.root.localToWorld(_b.set(0.3, 0.9, -0.2));
    this.placeArm(this.armsR, _b, 1);
    if (flop) this.root.localToWorld(_b.set(-0.6 * (this.deathSplay || 1), 1.15 - flop * 0.2, -0.05));
    else if (parts.fore && !this.reload) parts.fore.getWorldPosition(_b);
    else if (gun && this.reload > 0.01) gun.localToWorld(_b.set(0, -0.15 - Math.abs(Math.sin(this.phase * 2 + performance.now() / 300)) * 0.05, -0.1));
    else this.root.localToWorld(_b.set(-0.33, 0.78 - this.crouch * 0.3, -0.05 + Math.sin(this.phase) * 0.12 * moving));
    this.placeArm(this.armsL, _b, -1);

    const vis = this.deathT > 0 ? this.deathT < 4 : this.alive;
    this.root.visible = this.limbs.visible = vis;
    this.tag.visible = this.alive && this.deathT === 0;
    this.posed = this.alive && this.deathT === 0;
    this.updateHat(dt);
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

  // Big Heads mode: a giant head (and matching hitbox), name tag lifted above it.
  setBigHead(v) {
    if (this.bigHead === v) return;
    this.bigHead = v;
    this.neck.scale.setScalar(v ? 2.2 : 1);
    this.tag.position.y = v ? 2.75 : 2.15;
  }

  // Head box follows the model's actual head (crouching, leaning while sprinting, looking up or
  // down), so what you see is what you hit. It's checked first so headshots win on overlap.
  hitboxes() {
    const p = this.pos, c = this.headPos(_hb);
    const big = this.bigHead;
    const hw = big ? 0.42 : 0.19, lo = big ? 0.36 : 0.17, hi = big ? 0.44 : 0.21;
    return [
      { head: true, x0: c.x - hw, y0: c.y - lo, z0: c.z - hw, x1: c.x + hw, y1: c.y + hi, z1: c.z + hw },
      { head: false, x0: p.x - 0.36, y0: p.y, z0: p.z - 0.36, x1: p.x + 0.36, y1: Math.max(p.y + 0.6, c.y - lo), z1: p.z + 0.36 },
    ];
  }

  center(out) { return out.set(this.pos.x, this.pos.y + 0.9 * (1 - this.crouch * 0.2), this.pos.z); }
  // Center of the head: from the posed skeleton when we have one (head mesh sits 0.15 above the neck joint).
  headPos(out) {
    if (this.posed) return this.neck.localToWorld(out.set(0, 0.15, 0));
    return out.set(this.pos.x, this.pos.y + (this.bigHead ? 1.91 : 1.73) - this.crouch * 0.32, this.pos.z);
  }

  dispose() {
    this.scene.remove(this.root, this.limbs);
    if (this.hatFly && this.hat) this.scene.remove(this.hat);
  }
}
