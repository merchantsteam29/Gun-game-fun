import * as THREE from 'three';

const unitBox = new THREE.BoxGeometry(1, 1, 1);
const sphereGeo = new THREE.SphereGeometry(1, 16, 12);

// Pooled transient effects: tracers, particles, explosions, flash lights.
export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.tracers = [];
    this.particles = [];
    this.booms = [];

    this.tracerMat = new THREE.MeshBasicMaterial({ color: '#ffe9a8', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
    this.partMats = {};

    this.flashLight = new THREE.PointLight('#ffc070', 0, 9, 2);
    scene.add(this.flashLight);
    this.flashT = 0;
    this.boomLight = new THREE.PointLight('#ff9040', 0, 22, 2);
    scene.add(this.boomLight);
    this.boomLT = 0;
  }

  partMat(color) {
    return (this.partMats[color] ||= new THREE.MeshBasicMaterial({ color, transparent: true }));
  }

  tracer(from, to) {
    const len = from.distanceTo(to);
    if (len < 0.5) return;
    const m = new THREE.Mesh(unitBox, this.tracerMat.clone());
    m.scale.set(0.018, 0.018, len);
    m.position.copy(from).lerp(to, 0.5);
    m.lookAt(to);
    this.scene.add(m);
    this.tracers.push({ m, t: 0.07 });
  }

  muzzleFlash(pos) {
    this.flashLight.position.copy(pos);
    this.flashLight.intensity = 6;
    this.flashT = 0.05;
  }

  burst(pos, normal, color, n = 6, speed = 3, size = 0.05, life = 0.4) {
    if (this.particles.length > 300) return;
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(unitBox, this.partMat(color));
      m.scale.setScalar(size * (0.6 + Math.random() * 0.8));
      m.position.copy(pos);
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(speed);
      if (normal) v.addScaledVector(normal, speed * 0.8);
      this.scene.add(m);
      this.particles.push({ m, v, t: life * (0.6 + Math.random() * 0.6), g: 9 });
    }
  }

  impact(pos, normal) { this.burst(pos, normal, '#d8d0c0', 5, 2.5, 0.04, 0.35); }
  blood(pos) { this.burst(pos, null, '#b3121b', 8, 3, 0.06, 0.45); }

  explosion(pos, radius) {
    const fire = new THREE.Mesh(sphereGeo, new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    fire.position.copy(pos);
    this.scene.add(fire);
    const smoke = new THREE.Mesh(sphereGeo, new THREE.MeshStandardMaterial({ color: '#3a3836', transparent: true, opacity: 0.7, roughness: 1, depthWrite: false }));
    smoke.position.copy(pos);
    this.scene.add(smoke);
    this.booms.push({ fire, smoke, t: 0, r: radius });
    this.boomLight.position.copy(pos);
    this.boomLight.intensity = 60;
    this.boomLT = 0.25;
    this.burst(pos, new THREE.Vector3(0, 1, 0), '#ffcf6b', 14, 9, 0.07, 0.6);
    this.burst(pos, new THREE.Vector3(0, 1, 0), '#2a2725', 10, 5, 0.1, 0.9);
  }

  update(dt) {
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tr = this.tracers[i];
      tr.t -= dt;
      tr.m.material.opacity = Math.max(0, tr.t / 0.07) * 0.85;
      if (tr.t <= 0) { this.scene.remove(tr.m); tr.m.material.dispose(); this.tracers.splice(i, 1); }
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.t -= dt;
      p.v.y -= p.g * dt;
      p.m.position.addScaledVector(p.v, dt);
      p.m.scale.multiplyScalar(Math.exp(-dt * 2));
      if (p.t <= 0) { this.scene.remove(p.m); this.particles.splice(i, 1); }
    }
    for (let i = this.booms.length - 1; i >= 0; i--) {
      const b = this.booms[i];
      b.t += dt;
      const k = b.t / 0.35;
      b.fire.scale.setScalar(b.r * 0.75 * Math.min(1, k * 1.6));
      b.fire.material.opacity = Math.max(0, 1 - k);
      b.smoke.scale.setScalar(b.r * 0.55 * Math.min(1.4, 0.4 + b.t * 1.2));
      b.smoke.position.y += dt * 0.8;
      b.smoke.material.opacity = Math.max(0, 0.7 - b.t * 0.35);
      if (b.t > 2) {
        this.scene.remove(b.fire, b.smoke);
        b.fire.material.dispose(); b.smoke.material.dispose();
        this.booms.splice(i, 1);
      }
    }
    this.flashT -= dt;
    if (this.flashT <= 0) this.flashLight.intensity = 0;
    this.boomLT -= dt;
    this.boomLight.intensity = Math.max(0, this.boomLT / 0.25) * 60;
  }
}
