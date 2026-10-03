import * as THREE from 'three';
import { buildGun } from './models.js';
import { angLerp } from './util.js';

const legMat = new THREE.MeshStandardMaterial({ color: '#2b2f36', roughness: 0.9 });
const skinMat = new THREE.MeshStandardMaterial({ color: '#d6a682', roughness: 0.8 });
const bootMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.9 });

function part(geo, mat, x, y, z, parent) {
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

// Another player's avatar, interpolated from host snapshots.
export class RemotePlayer {
  constructor(scene, id, name, color) {
    this.id = id;
    this.name = name;
    this.color = color;
    this.scene = scene;
    this.pos = new THREE.Vector3(0, -100, 0);
    this.tpos = new THREE.Vector3(0, -100, 0);
    this.prev = new THREE.Vector3();
    this.yaw = 0; this.tyaw = 0;
    this.pitch = 0; this.tpitch = 0;
    this.crouch = 0; this.tcrouch = 0;
    this.alive = false;
    this.hasState = false;
    this.weapon = null;
    this.walk = 0;
    this.deathT = 0;

    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.75 });
    this.root = new THREE.Group();
    this.body = new THREE.Group(); // scaled for crouch
    this.root.add(this.body);

    const legGeo = new THREE.BoxGeometry(0.2, 0.8, 0.22).translate(0, -0.4, 0);
    this.legL = part(legGeo, legMat, -0.13, 0.8, 0, this.body);
    this.legR = part(legGeo, legMat, 0.13, 0.8, 0, this.body);
    part(new THREE.BoxGeometry(0.22, 0.1, 0.3).translate(0, -0.75, -0.04), bootMat, 0, 0, 0, this.legL);
    part(new THREE.BoxGeometry(0.22, 0.1, 0.3).translate(0, -0.75, -0.04), bootMat, 0, 0, 0, this.legR);
    part(new THREE.BoxGeometry(0.56, 0.62, 0.32), bodyMat, 0, 1.11, 0, this.body);
    part(new THREE.BoxGeometry(0.58, 0.12, 0.34), legMat, 0, 0.85, 0, this.body);

    this.headPivot = new THREE.Group();
    this.headPivot.position.set(0, 1.45, 0);
    this.body.add(this.headPivot);
    part(new THREE.BoxGeometry(0.34, 0.36, 0.34), skinMat, 0, 0.18, 0, this.headPivot);
    part(new THREE.BoxGeometry(0.38, 0.14, 0.38), bodyMat, 0, 0.35, 0, this.headPivot);
    part(new THREE.BoxGeometry(0.3, 0.08, 0.02), bootMat, 0, 0.22, -0.175, this.headPivot);

    // Arms + gun pivot at shoulder height so pitch aims the weapon.
    this.armPivot = new THREE.Group();
    this.armPivot.position.set(0, 1.3, 0);
    this.body.add(this.armPivot);
    const armGeo = new THREE.BoxGeometry(0.14, 0.14, 0.5).translate(0, 0, -0.22);
    const aR = part(armGeo, bodyMat, 0.24, 0, 0, this.armPivot);
    aR.rotation.y = 0.15;
    const aL = part(armGeo, bodyMat, -0.2, -0.02, -0.08, this.armPivot);
    aL.rotation.y = -0.45;
    this.gunHolder = new THREE.Group();
    this.gunHolder.position.set(0.12, -0.02, -0.42);
    this.armPivot.add(this.gunHolder);
    this.guns = {};

    this.tag = nameTag(name, color);
    this.tag.position.set(0, 2.15, 0);
    this.root.add(this.tag);

    this.root.visible = false;
    scene.add(this.root);
  }

  setWeapon(id) {
    if (id === this.weapon || !id) return;
    if (this.weapon && this.guns[this.weapon]) this.guns[this.weapon].visible = false;
    if (!this.guns[id]) {
      const g = buildGun(id);
      g.scale.setScalar(1.25);
      this.gunHolder.add(g);
      this.guns[id] = g;
    }
    this.guns[id].visible = true;
    this.weapon = id;
  }

  // a = [x, y, z, yaw, pitch, weapon, crouch, alive, hp, kills, deaths]
  setState(a) {
    const alive = !!a[7];
    this.tpos.set(a[0], a[1], a[2]);
    this.tyaw = a[3];
    this.tpitch = a[4];
    this.tcrouch = a[6] ? 1 : 0;
    this.setWeapon(a[5]);
    if (alive && (!this.alive || !this.hasState || this.pos.distanceTo(this.tpos) > 6)) {
      this.pos.copy(this.tpos);
      this.yaw = this.tyaw;
    }
    if (!alive && this.alive) this.deathT = 0.001;
    if (alive) this.deathT = 0;
    this.alive = alive;
    this.hasState = true;
  }

  update(dt) {
    if (!this.hasState) return;
    this.prev.copy(this.pos);
    if (this.alive) {
      this.pos.lerp(this.tpos, 1 - Math.exp(-dt * 16));
      this.yaw = angLerp(this.yaw, this.tyaw, 1 - Math.exp(-dt * 20));
      this.pitch += (this.tpitch - this.pitch) * (1 - Math.exp(-dt * 20));
    }
    this.crouch += (this.tcrouch - this.crouch) * Math.min(1, dt * 12);

    const vx = (this.pos.x - this.prev.x) / Math.max(dt, 1e-4);
    const vz = (this.pos.z - this.prev.z) / Math.max(dt, 1e-4);
    const speed = Math.min(8, Math.hypot(vx, vz));
    this.walk += dt * speed * 1.8;
    const swing = Math.sin(this.walk) * Math.min(1, speed / 4) * 0.7;
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;

    this.root.position.copy(this.pos);
    this.root.rotation.y = this.yaw;
    this.body.scale.y = 1 - this.crouch * 0.33;
    this.armPivot.rotation.x = this.pitch;
    this.headPivot.rotation.x = this.pitch * 0.6;

    if (this.deathT > 0) {
      this.deathT += dt;
      const k = Math.min(1, this.deathT / 0.45);
      this.root.rotation.x = -k * k * Math.PI / 2;
      this.tag.visible = false;
      this.root.visible = this.deathT < 3;
    } else {
      this.root.rotation.x = 0;
      this.tag.visible = true;
      this.root.visible = this.alive;
    }
  }

  // Head box is checked first so headshots win on overlap.
  hitboxes() {
    const p = this.pos, s = 1 - this.crouch * 0.33;
    const top = 1.42 * s;
    const hc = p.y + 1.63 * s;
    return [
      { head: true, x0: p.x - 0.21, y0: hc - 0.2, z0: p.z - 0.21, x1: p.x + 0.21, y1: hc + 0.24, z1: p.z + 0.21 },
      { head: false, x0: p.x - 0.36, y0: p.y, z0: p.z - 0.36, x1: p.x + 0.36, y1: p.y + top, z1: p.z + 0.36 },
    ];
  }

  center(out) { return out.set(this.pos.x, this.pos.y + 0.9 * (1 - this.crouch * 0.33), this.pos.z); }

  dispose() {
    this.scene.remove(this.root);
  }
}
