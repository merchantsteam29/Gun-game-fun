import * as THREE from 'three';

const unitBox = new THREE.BoxGeometry(1, 1, 1);
const sphereGeo = new THREE.SphereGeometry(1, 16, 12);
const _c = new THREE.Vector3(), _ab = new THREE.Vector3(), _ac = new THREE.Vector3();
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _col = new THREE.Color();
const MAX_PARTICLES = 400, MAX_TRACERS = 96;
const TRACER_COLOR = new THREE.Color('#ffe9a8');
const Z = new THREE.Vector3(0, 0, 1);

// Transient effects: tracers, particles, explosions, flash lights.
// Particles and tracers are each one InstancedMesh, so a firefight costs two draw calls
// instead of one per spark (hundreds), which phones can't afford.
export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.tracers = [];
    this.particles = [];
    this.scale = 1; // fewer particles on lower graphics (game.js setGfx)
    this.booms = [];
    this.smokes = [];

    this.partMesh = new THREE.InstancedMesh(unitBox, new THREE.MeshBasicMaterial(), MAX_PARTICLES);
    this.partMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_PARTICLES * 3), 3);
    this.partMesh.count = 0;
    this.partMesh.frustumCulled = false;
    scene.add(this.partMesh);
    // Additive blending: fading a tracer = darkening its instance color.
    this.tracerMesh = new THREE.InstancedMesh(unitBox, new THREE.MeshBasicMaterial({ blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }), MAX_TRACERS);
    this.tracerMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_TRACERS * 3), 3);
    this.tracerMesh.count = 0;
    this.tracerMesh.frustumCulled = false;
    scene.add(this.tracerMesh);

    this.flashLight = new THREE.PointLight('#ffc070', 0, 9, 2);
    scene.add(this.flashLight);
    this.flashT = 0;
    this.boomLight = new THREE.PointLight('#ff9040', 0, 22, 2);
    scene.add(this.boomLight);
    this.boomLT = 0;
  }

  // color: optional (e.g. laser beams); beams also linger a little longer and look thicker.
  tracer(from, to, color = null) {
    const len = from.distanceTo(to);
    if (len < 0.5) return;
    if (this.tracers.length >= MAX_TRACERS) this.tracers.shift();
    _ab.subVectors(to, from).normalize();
    this.tracers.push({
      pos: from.clone().lerp(to, 0.5), quat: new THREE.Quaternion().setFromUnitVectors(Z, _ab), len,
      t: color ? 0.12 : 0.07, life: color ? 0.12 : 0.07, w: color ? 0.035 : 0.018, col: color ? new THREE.Color(color) : TRACER_COLOR,
    });
  }

  muzzleFlash(pos) {
    this.flashLight.position.copy(pos);
    this.flashLight.intensity = 6;
    this.flashT = 0.05;
  }

  burst(pos, normal, color, n = 6, speed = 3, size = 0.05, life = 0.4) {
    const col = new THREE.Color(color);
    n = Math.max(1, Math.round(n * this.scale));
    for (let i = 0; i < n && this.particles.length < MAX_PARTICLES; i++) {
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(speed);
      if (normal) v.addScaledVector(normal, speed * 0.8);
      this.particles.push({
        pos: pos.clone(), v, size: size * (0.6 + Math.random() * 0.8), col,
        rot: new THREE.Euler(Math.random() * 3, Math.random() * 3, 0), t: life * (0.6 + Math.random() * 0.6), g: 9,
      });
    }
  }

  // Flamethrower: a short stream of fire puffs along the shot.
  flame(from, to) {
    const n = 5;
    for (let i = 0; i < n; i++) {
      const p = from.clone().lerp(to, (i + Math.random()) / n);
      this.burst(p, null, i < 2 ? '#ffe28a' : Math.random() < 0.5 ? '#ff8a1a' : '#ff4a12', 2, 1.2, 0.09 + i * 0.03, 0.22);
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

  smoke(pos, radius, duration) {
    if (!this.smokeTex) {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const g = c.getContext('2d');
      const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grd.addColorStop(0, 'rgba(255,255,255,1)');
      grd.addColorStop(0.5, 'rgba(255,255,255,0.6)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, 64, 64);
      this.smokeTex = new THREE.CanvasTexture(c);
    }
    const puffs = [];
    for (let i = 0; i < 26; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.smokeTex, color: '#c9cbcf', transparent: true, opacity: 0, depthWrite: false, fog: true }));
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * radius * 0.75;
      s.userData.off = new THREE.Vector3(Math.cos(a) * r, 0.6 + Math.random() * radius * 0.55, Math.sin(a) * r);
      s.userData.size = radius * (0.7 + Math.random() * 0.5);
      s.userData.spin = (Math.random() - 0.5) * 0.3;
      s.position.copy(pos);
      this.scene.add(s);
      puffs.push(s);
    }
    this.smokes.push({ pos: pos.clone(), radius, duration, t: 0, puffs });
  }

  // True if the segment a->b passes through an active smoke cloud.
  blocked(a, b) {
    for (const s of this.smokes) {
      if (s.t < 0.6 || s.t > s.duration - 1) continue;
      const c = _c.copy(s.pos); c.y += s.radius * 0.35;
      const ab = _ab.subVectors(b, a);
      const t = Math.max(0, Math.min(1, _ac.subVectors(c, a).dot(ab) / Math.max(1e-6, ab.lengthSq())));
      if (_ac.copy(a).addScaledVector(ab, t).distanceTo(c) < s.radius * 0.8) return true;
    }
    return false;
  }

  clear() {
    this.partMesh.count = this.tracerMesh.count = 0;
    for (const b of this.booms) this.scene.remove(b.fire, b.smoke);
    for (const s of this.smokes) this.scene.remove(...s.puffs);
    this.tracers = []; this.particles = []; this.booms = []; this.smokes = [];
  }

  update(dt) {
    for (let i = this.smokes.length - 1; i >= 0; i--) {
      const s = this.smokes[i];
      s.t += dt;
      const grow = Math.min(1, s.t / 1.2);
      const fade = Math.min(1, (s.duration - s.t) / 2.5);
      for (const p of s.puffs) {
        p.position.copy(s.pos).addScaledVector(p.userData.off, 0.4 + 0.6 * grow);
        p.position.y += s.t * 0.05;
        p.scale.setScalar(p.userData.size * (0.4 + 0.6 * grow));
        p.material.opacity = Math.max(0, 0.85 * grow * fade);
        p.material.rotation += p.userData.spin * dt;
      }
      if (s.t >= s.duration) {
        for (const p of s.puffs) { this.scene.remove(p); p.material.dispose(); }
        this.smokes.splice(i, 1);
      }
    }
    this.tracers = this.tracers.filter((tr) => (tr.t -= dt) > 0);
    const tm = this.tracerMesh;
    this.tracers.forEach((tr, i) => {
      tm.setMatrixAt(i, _m.compose(tr.pos, tr.quat, _s.set(tr.w, tr.w, tr.len)));
      tm.setColorAt(i, _col.copy(tr.col).multiplyScalar(Math.max(0, tr.t / tr.life) * 0.9));
    });
    tm.count = this.tracers.length;
    tm.instanceMatrix.needsUpdate = true;
    tm.instanceColor.needsUpdate = true;

    this.particles = this.particles.filter((p) => (p.t -= dt) > 0);
    const pm = this.partMesh;
    this.particles.forEach((p, i) => {
      p.v.y -= p.g * dt;
      p.pos.addScaledVector(p.v, dt);
      p.size *= Math.exp(-dt * 2);
      pm.setMatrixAt(i, _m.compose(p.pos, _q.setFromEuler(p.rot), _s.setScalar(p.size)));
      pm.setColorAt(i, p.col);
    });
    pm.count = this.particles.length;
    pm.instanceMatrix.needsUpdate = true;
    pm.instanceColor.needsUpdate = true;
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
