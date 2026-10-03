import { boxes } from './maps.js';
import { overlap } from './physics.js';

const CELL = 1;
const STEP_UP = 0.55;
const MAX_DROP = 4.5;

// Walkable-surface grid for bots, built from the current map's boxes. Nodes sit on every
// box top a player can stand on; edges connect neighbors within step height (or a drop).
export class NavGrid {
  constructor(bounds) {
    this.nodes = [];
    this.cells = new Map();
    const n = Math.ceil(bounds / CELL);
    for (let ix = -n; ix < n; ix++) {
      for (let iz = -n; iz < n; iz++) {
        const x = (ix + 0.5) * CELL, z = (iz + 0.5) * CELL;
        const tops = [];
        for (const b of boxes) {
          if (x < b.x0 || x > b.x1 || z < b.z0 || z > b.z1 || b.y1 > 12) continue;
          if (tops.some((t) => Math.abs(t.y - b.y1) < 0.05)) continue;
          tops.push({ y: b.y1, mat: b.mat });
        }
        for (const { y, mat } of tops) {
          // Checked from knee height: anything lower can be stepped over.
          if (overlap(x, y + 0.5, z, 0.3, 1.3)) continue;
          const node = { id: this.nodes.length, x, y, z, ix, iz, mat, edges: [] };
          this.nodes.push(node);
          const key = ix + ',' + iz;
          if (!this.cells.has(key)) this.cells.set(key, []);
          this.cells.get(key).push(node);
        }
      }
    }
    for (const a of this.nodes) {
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          if (!dx && !dz) continue;
          for (const b of this.cells.get(a.ix + dx + ',' + (a.iz + dz)) || []) {
            const dy = b.y - a.y;
            if (dy < -MAX_DROP) continue;
            // Steep stairs climb ~1m per cell; allow it if there's a step in between.
            if (dy > STEP_UP) {
              if (dy > STEP_UP * 2) continue;
              const mid = surfaceAt((a.x + b.x) / 2, (a.z + b.z) / 2, b.y);
              if (mid - a.y > STEP_UP || b.y - mid > STEP_UP) continue;
            }
            if (dx && dz && (!this.near(a.ix + dx, a.iz, a.y, b.y) || !this.near(a.ix, a.iz + dz, a.y, b.y))) continue;
            const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
            if (overlap(mx, Math.max(a.y, b.y) + 0.5, mz, 0.3, 1.25)) continue;
            a.edges.push({ to: b.id, cost: Math.hypot(b.x - a.x, b.z - a.z) + Math.abs(dy) + (dy < -0.6 ? 1.5 : 0) });
          }
        }
      }
    }
    this.linkPads();
  }

  // Jump pads launch you up onto nearby high ground.
  linkPads() {
    for (const a of this.nodes) {
      if (a.mat !== 'pad') continue;
      for (const b of this.nodes) {
        const dy = b.y - a.y, d = Math.hypot(b.x - a.x, b.z - a.z);
        if (dy > 1 && dy < 5 && d < 4.5) a.edges.push({ to: b.id, cost: d + 2 });
      }
    }
  }

  near(ix, iz, y0, y1) {
    const lo = Math.min(y0, y1) - 0.6, hi = Math.max(y0, y1) + 0.6;
    return (this.cells.get(ix + ',' + iz) || []).some((n) => n.y >= lo && n.y <= hi);
  }

  nearest(p) {
    const ix = Math.floor(p.x / CELL), iz = Math.floor(p.z / CELL);
    let best = null, bestD = Infinity;
    for (let r = 0; r <= 3 && !best; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          for (const n of this.cells.get(ix + dx + ',' + (iz + dz)) || []) {
            const d = Math.hypot(n.x - p.x, n.z - p.z) + Math.abs(n.y - p.y) * 2;
            if (d < bestD) { bestD = d; best = n; }
          }
        }
      }
    }
    return best;
  }

  random() {
    return this.nodes[(Math.random() * this.nodes.length) | 0];
  }

  // A* from world position to world position. Returns [{x,y,z}...] or null.
  find(from, to) {
    const s = this.nearest(from), t = this.nearest(to);
    if (!s || !t) return null;
    if (s === t) return [t];
    const g = new Map([[s.id, 0]]);
    const came = new Map();
    const heap = [[0, s.id]];
    const closed = new Set();
    const h = (n) => Math.hypot(n.x - t.x, n.z - t.z) + Math.abs(n.y - t.y);
    let iter = 0;
    while (heap.length && iter++ < 8000) {
      const [, id] = pop(heap);
      if (id === t.id) {
        const path = [];
        for (let c = id; c !== undefined; c = came.get(c)) path.push(this.nodes[c]);
        return path.reverse();
      }
      if (closed.has(id)) continue;
      closed.add(id);
      const gn = g.get(id);
      for (const e of this.nodes[id].edges) {
        const ng = gn + e.cost;
        if (ng < (g.get(e.to) ?? Infinity)) {
          g.set(e.to, ng);
          came.set(e.to, id);
          push(heap, [ng + h(this.nodes[e.to]), e.to]);
        }
      }
    }
    return null;
  }
}

// Highest walkable top at (x, z) not above maxY.
function surfaceAt(x, z, maxY) {
  let best = -Infinity;
  for (const b of boxes) {
    if (x < b.x0 || x > b.x1 || z < b.z0 || z > b.z1 || b.y1 > maxY + 0.05) continue;
    if (b.y1 > best) best = b.y1;
  }
  return best;
}

function push(h, item) {
  h.push(item);
  let i = h.length - 1;
  while (i > 0) {
    const p = (i - 1) >> 1;
    if (h[p][0] <= h[i][0]) break;
    [h[p], h[i]] = [h[i], h[p]];
    i = p;
  }
}
function pop(h) {
  const top = h[0], last = h.pop();
  if (h.length) {
    h[0] = last;
    let i = 0;
    for (;;) {
      const l = i * 2 + 1, r = l + 1;
      let m = i;
      if (l < h.length && h[l][0] < h[m][0]) m = l;
      if (r < h.length && h[r][0] < h[m][0]) m = r;
      if (m === i) break;
      [h[m], h[i]] = [h[i], h[m]];
      i = m;
    }
  }
  return top;
}
