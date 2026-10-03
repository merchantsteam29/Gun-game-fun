import * as THREE from 'three';
import { buildGun } from './models.js';
import { WEAPONS } from './weapons.js';

const HIP = new THREE.Vector3(0.17, -0.17, -0.42);
const ADS = { ar: [0, -0.105, -0.3], shotgun: [0, -0.085, -0.32], pistol: [0, -0.068, -0.32], gl: [0, -0.16, -0.34] };

// First-person weapon, rendered in its own scene on top of the world so it never clips walls.
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

    this.models = {};
    for (const id of Object.keys(WEAPONS)) {
      const holder = new THREE.Group();
      holder.scale.setScalar(0.8);
      const gun = buildGun(id);
      holder.add(gun);
      // Right arm: glove at grip + sleeve running back toward the camera.
      const glove = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.08, 0.09), this.gloveMat);
      glove.position.set(0, -0.05, id === 'knife' || id === 'frag' ? 0.03 : 0.07);
      const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.45), this.sleeveMat);
      sleeve.position.set(0.04, -0.1, 0.32);
      sleeve.rotation.x = 0.25;
      holder.add(glove, sleeve);
      holder.visible = false;
      this.root.add(holder);
      const muzzle = gun.getObjectByName('muzzle');
      this.models[id] = { holder, gun, muzzle };
    }

    // Muzzle flash
    const flashMat = new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    this.flash = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), flashMat);
    this.flash2 = this.flash.clone();
    this.flash2.rotation.z = Math.PI / 4;
    this.flashT = 0;

    this.cur = null;
    this.t = 0;
    this.kickT = 0;
    this.raiseT = 0;
    this.swingT = 0;
    this.throwT = 0;
    this.adsT = 0;
    this.sway = new THREE.Vector2();
    this.pos = new THREE.Vector3().copy(HIP);
  }

  setColor(c) { this.sleeveMat.color.set(c); }

  equip(id) {
    if (this.cur) this.models[this.cur].holder.visible = false;
    this.cur = id;
    const m = this.models[id];
    m.holder.visible = true;
    m.muzzle.add(this.flash, this.flash2);
    this.flash.visible = this.flash2.visible = false;
    this.raiseT = 1;
    this.swingT = 0;
    this.throwT = 0;
  }

  setVisible(v) { this.root.visible = v; }

  kick(amount) {
    this.kickT = Math.min(1, this.kickT + amount);
    if (WEAPONS[this.cur].type !== 'melee') {
      this.flashT = 0.05;
      this.flash.rotation.z = Math.random() * Math.PI;
    }
  }
  swing() { this.swingT = 1; }
  throwAnim() { this.throwT = 1; }

  look(dx, dy) {
    this.sway.x = THREE.MathUtils.clamp(this.sway.x - dx * 0.0004, -0.04, 0.04);
    this.sway.y = THREE.MathUtils.clamp(this.sway.y + dy * 0.0004, -0.04, 0.04);
  }

  // s: {speed, ads, reload (0..1 or -1), sprint, onGround}
  update(dt, s) {
    if (!this.cur) return;
    this.t += dt;
    this.adsT += ((s.ads ? 1 : 0) - this.adsT) * Math.min(1, dt * 14);
    this.kickT = Math.max(0, this.kickT - dt * 7);
    this.raiseT = Math.max(0, this.raiseT - dt * 4);
    this.swingT = Math.max(0, this.swingT - dt * 3.2);
    this.throwT = Math.max(0, this.throwT - dt * 2.5);
    this.flashT -= dt;
    this.flash.visible = this.flash2.visible = this.flashT > 0;
    this.sway.multiplyScalar(Math.exp(-dt * 8));

    const ads = ADS[this.cur];
    const target = ads
      ? new THREE.Vector3(...ads).lerp(HIP, 1 - this.adsT)
      : HIP.clone();
    const bobAmt = Math.min(1, s.speed / 6) * (s.onGround ? 1 : 0.2) * (1 - this.adsT * 0.85);
    const bobF = s.sprint ? 13 : 9;
    target.x += Math.sin(this.t * bobF * 0.5) * 0.012 * bobAmt + this.sway.x;
    target.y += -Math.abs(Math.cos(this.t * bobF * 0.5)) * 0.014 * bobAmt + this.sway.y;
    target.y -= this.raiseT * 0.3;
    target.z += this.kickT * 0.07;
    this.pos.lerp(target, Math.min(1, dt * 22));

    const h = this.models[this.cur].holder;
    h.position.copy(this.pos);
    let rx = this.kickT * 0.18 - this.raiseT * 0.6;
    let ry = 0, rz = 0;
    if (s.sprint) { ry = 0.55; rx -= 0.2; rz = 0.15; h.position.x -= 0.03; }
    if (s.reload >= 0) {
      const k = Math.sin(Math.min(1, s.reload) * Math.PI);
      rx -= k * 0.6; rz += k * 0.5; h.position.y -= k * 0.08;
    }
    if (this.swingT > 0) {
      const k = Math.sin((1 - this.swingT) * Math.PI);
      ry += k * 1.1; rx -= k * 0.4; h.position.x -= k * 0.15; h.position.z -= k * 0.15;
    }
    if (this.throwT > 0) {
      const p = 1 - this.throwT;
      const k = p < 0.35 ? -p / 0.35 : Math.sin(((p - 0.35) / 0.65) * Math.PI);
      rx += k * 0.9; h.position.z -= Math.max(0, k) * 0.25; h.position.y += k * 0.08;
      h.visible = p < 0.4 || p > 0.9;
    } else h.visible = true;
    h.rotation.set(rx, ry, rz);
  }

  // World-space muzzle position relative to the given world camera (for tracers).
  muzzleWorld(worldCam, out) {
    // Approximate: map viewmodel-camera space onto the world camera.
    const m = this.models[this.cur];
    m.muzzle.updateWorldMatrix(true, false);
    out.setFromMatrixPosition(m.muzzle.matrixWorld);
    out.z = Math.max(out.z, -0.9);
    return out.applyMatrix4(worldCam.matrixWorld);
  }

  render(renderer) {
    renderer.clearDepth();
    renderer.render(this.scene, this.camera);
  }
}
