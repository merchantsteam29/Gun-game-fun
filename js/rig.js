import * as THREE from 'three';

const unit = new THREE.BoxGeometry(1, 1, 1);
const _d = new THREE.Vector3(), _p = new THREE.Vector3();

// A box stretched between two points. Its parent must have an identity transform
// relative to the space the points are given in.
export class Limb {
  constructor(parent, mat, thick, depth = thick) {
    this.mesh = new THREE.Mesh(unit, mat);
    this.mesh.castShadow = true;
    this.thick = thick;
    this.depth = depth;
    parent.add(this.mesh);
  }
  set(a, b) {
    const len = a.distanceTo(b);
    this.mesh.position.copy(a).lerp(b, 0.5);
    this.mesh.scale.set(this.thick, this.depth, Math.max(0.001, len));
    this.mesh.lookAt(b);
  }
  set visible(v) { this.mesh.visible = v; }
}

// Two-bone IK. Writes the elbow/knee into `outMid` and the (reach-clamped) end into `outEnd`.
export function solveIK(root, target, l1, l2, pole, outMid, outEnd) {
  _d.subVectors(target, root);
  const dist = Math.min(Math.max(_d.length(), 0.01), l1 + l2 - 1e-3);
  _d.normalize();
  outEnd.copy(root).addScaledVector(_d, dist);
  const x = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist);
  const h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
  _p.copy(pole).addScaledVector(_d, -pole.dot(_d));
  if (_p.lengthSq() < 1e-6) _p.set(0, -1, 0);
  _p.normalize();
  outMid.copy(root).addScaledVector(_d, x).addScaledVector(_p, h);
}

export const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
// 0 before a, ramps to 1 by b.
export const seg = (p, a, b) => smooth((p - a) / (b - a));
// 0 -> 1 -> 0 hump across [a, b].
export const bump = (p, a, b) => (p <= a || p >= b ? 0 : Math.sin(((p - a) / (b - a)) * Math.PI));

// Keyframed blend between named points: keys = [[time, name], ...] sorted by time.
export function keyBlend(p, keys, pts, out) {
  if (p <= keys[0][0]) return out.copy(pts[keys[0][1]]);
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, a] = keys[i], [t1, b] = keys[i + 1];
    if (p <= t1) return out.copy(pts[a]).lerp(pts[b], smooth((p - t0) / Math.max(1e-4, t1 - t0)));
  }
  return out.copy(pts[keys[keys.length - 1][1]]);
}
