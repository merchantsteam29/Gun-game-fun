import { boxes } from './maps.js';

export const PLAYER_R = 0.38;
export const GRAVITY = 20;
// Runtime-tunable physics (host panel).
export const phys = { gravity: 1 };
const STEP = 0.55;
const AIR_STEP = 0.32; // ledge forgiveness: mid-air bodies hop onto edges this close below their feet
const SNAP = 0.6; // grounded bodies stick to floors up to this far below (walking down stairs)
const EPS = 1e-4;

export function overlap(px, py, pz, r, h) {
  for (const b of boxes) {
    if (px + r > b.x0 && px - r < b.x1 && py + h > b.y0 && py < b.y1 && pz + r > b.z0 && pz - r < b.z1) return b;
  }
  return null;
}

// Moves a body {pos, vel, onGround} with AABB collision, auto step-up, ground snapping and gravity.
export function moveBody(body, dt, h) {
  const wasGrounded = body.onGround;
  const speed = Math.hypot(body.vel.x, body.vel.y, body.vel.z);
  const n = Math.max(1, Math.ceil((speed * dt) / 0.25));
  const sdt = dt / n;
  for (let i = 0; i < n; i++) step(body, sdt, h);
  if (wasGrounded && !body.onGround && body.vel.y <= 0) snapDown(body, h);
}

// Keeps a walking body on the floor when it steps down (stairs, curbs) instead of
// briefly going airborne every step.
function snapDown(body, h) {
  const p = body.pos, r = PLAYER_R;
  let best = null;
  for (const b of boxes) {
    if (p.x + r <= b.x0 || p.x - r >= b.x1 || p.z + r <= b.z0 || p.z - r >= b.z1) continue;
    if (b.y1 > p.y + EPS || b.y1 < p.y - SNAP) continue;
    if (!best || b.y1 > best.y1) best = b;
  }
  if (!best || overlap(p.x, best.y1, p.z, r, h)) return;
  p.y = best.y1;
  body.vel.y = 0;
  body.onGround = true;
  body.ground = best;
}

function step(body, dt, h) {
  const p = body.pos, v = body.vel, r = PLAYER_R;
  const grounded = body.onGround;

  for (const ax of ['x', 'z']) {
    const d = v[ax] * dt;
    if (!d) continue;
    const old = p[ax];
    p[ax] += d;
    const b = overlap(p.x, p.y, p.z, r, h);
    if (!b) continue;
    const rise = b.y1 - p.y;
    if (rise <= (grounded ? STEP : AIR_STEP) && !overlap(p.x, b.y1 + EPS, p.z, r, h)) {
      p.y = b.y1 + EPS;
      continue;
    }
    p[ax] = d > 0 ? b[ax + '0'] - r - EPS : b[ax + '1'] + r + EPS;
    if (overlap(p.x, p.y, p.z, r, h)) p[ax] = old;
    v[ax] = 0;
  }

  v.y -= GRAVITY * phys.gravity * dt;
  const dy = v.y * dt;
  const oldY = p.y;
  p.y += dy;
  body.onGround = false;
  body.ground = null;
  const b = overlap(p.x, p.y, p.z, r, h);
  if (b) {
    if (dy < 0) { p.y = b.y1; body.onGround = true; body.ground = b; }
    else p.y = b.y0 - h - EPS;
    if (overlap(p.x, p.y, p.z, r, h)) p.y = oldY;
    v.y = 0;
  }
}

// Ray vs AABB (slab test). Returns distance or -1.
export function rayAABB(ox, oy, oz, dx, dy, dz, x0, y0, z0, x1, y1, z1, maxT) {
  let tmin = 0, tmax = maxT;
  const o = [ox, oy, oz], d = [dx, dy, dz], lo = [x0, y0, z0], hi = [x1, y1, z1];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-9) {
      if (o[i] < lo[i] || o[i] > hi[i]) return -1;
    } else {
      let t1 = (lo[i] - o[i]) / d[i], t2 = (hi[i] - o[i]) / d[i];
      if (t1 > t2) [t1, t2] = [t2, t1];
      if (t1 > tmin) tmin = t1;
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return -1;
    }
  }
  return tmin;
}

// Ray vs world. dir must be normalized. Returns {t, x,y,z, nx,ny,nz} or null.
export function raycast(ox, oy, oz, dx, dy, dz, maxT) {
  let best = maxT, hit = null;
  for (const b of boxes) {
    const t = rayAABB(ox, oy, oz, dx, dy, dz, b.x0, b.y0, b.z0, b.x1, b.y1, b.z1, best);
    if (t >= 0 && t < best) { best = t; hit = b; }
  }
  if (!hit) return null;
  const x = ox + dx * best, y = oy + dy * best, z = oz + dz * best;
  // Normal = the face we hit (closest face of the box to the hit point).
  const faces = [
    [Math.abs(x - hit.x0), -1, 0, 0], [Math.abs(x - hit.x1), 1, 0, 0],
    [Math.abs(y - hit.y0), 0, -1, 0], [Math.abs(y - hit.y1), 0, 1, 0],
    [Math.abs(z - hit.z0), 0, 0, -1], [Math.abs(z - hit.z1), 0, 0, 1],
  ];
  faces.sort((a, b) => a[0] - b[0]);
  const [, nx, ny, nz] = faces[0];
  return { t: best, x, y, z, nx, ny, nz };
}
