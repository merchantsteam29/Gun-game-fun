import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Collision boxes {x0,y0,z0,x1,y1,z1,mat} and spawn points for the current map.
// These arrays are mutated in place when the map changes so importers keep valid references.
export const boxes = [];
export const spawns = [];
export const MAP_ORDER = ['warehouse', 'yard', 'town', 'pit'];

// ---------- Builder API ----------

function makeApi() {
  const add = (x0, y0, z0, x1, y1, z1, mat) => {
    boxes.push({
      x0: Math.min(x0, x1), y0: Math.min(y0, y1), z0: Math.min(z0, z1),
      x1: Math.max(x0, x1), y1: Math.max(y0, y1), z1: Math.max(z0, z1), mat,
    });
  };
  // 180° rotational twin -> fair two-sided maps.
  const add2 = (x0, y0, z0, x1, y1, z1, mat, mat2 = mat) => {
    add(x0, y0, z0, x1, y1, z1, mat);
    add(-x1, y0, -z1, -x0, y1, -z0, mat2);
  };
  // 90° rotational copies -> four-sided maps.
  const add4 = (x0, y0, z0, x1, y1, z1, mat) => {
    let a = [x0, z0, x1, z1];
    for (let i = 0; i < 4; i++) {
      add(a[0], y0, a[1], a[2], y1, a[3], mat);
      a = [-a[3], a[0], -a[1], a[2]];
    }
  };
  const spawn = (x, y, z) => spawns.push({ x, y, z, yaw: Math.atan2(x, z) });
  const spawn2 = (x, y, z) => { spawn(x, y, z); spawn(-x, y, -z); };
  const spawn4 = (x, y, z) => {
    let p = [x, z];
    for (let i = 0; i < 4; i++) { spawn(p[0], y, p[1]); p = [-p[1], p[0]]; }
  };
  const crate2 = (cx, cz, y = 0, s = 1.2) => add2(cx - s / 2, y, cz - s / 2, cx + s / 2, y + s, cz + s / 2, 'crate');
  // Stairs filling a rectangle, rising from y0 to y1 toward `dir` (+x, -x, +z, -z).
  const stairs = (x0, z0, x1, z1, y0, y1, dir, mat = 'stairs', fn = add2) => {
    const along = dir[1];
    const len = along === 'x' ? x1 - x0 : z1 - z0;
    const n = Math.ceil((y1 - y0) / 0.5);
    const d = len / n;
    for (let i = 0; i < n; i++) {
      const k = dir[0] === '+' ? i : n - 1 - i;
      const top = y0 + ((y1 - y0) * (i + 1)) / n;
      if (along === 'x') fn(x0 + k * d, y0, z0, x0 + (k + 1) * d, top, z1, mat);
      else fn(x0, y0, z0 + k * d, x1, top, z0 + (k + 1) * d, mat);
    }
  };
  // Hollow building with door/window openings and a flat roof.
  // openings: {side: 'n'|'s'|'e'|'w', at, w, y0 = 0, h = 2.3}
  const building = (x0, z0, x1, z1, h, openings = [], opts = {}, fn = add2) => {
    const t = 0.3, mat = opts.mat || 'adobe';
    const walls = {
      s: { a0: x0, a1: x1, fixed: [z0, z0 + t], ax: 'x' },
      n: { a0: x0, a1: x1, fixed: [z1 - t, z1], ax: 'x' },
      w: { a0: z0 + t, a1: z1 - t, fixed: [x0, x0 + t], ax: 'z' },
      e: { a0: z0 + t, a1: z1 - t, fixed: [x1 - t, x1], ax: 'z' },
    };
    const seg = (w, a0, a1, y0, y1) => {
      if (a1 - a0 < 0.01 || y1 - y0 < 0.01) return;
      if (w.ax === 'x') fn(a0, y0, w.fixed[0], a1, y1, w.fixed[1], mat);
      else fn(w.fixed[0], y0, a0, w.fixed[1], y1, a1, mat);
    };
    for (const [side, w] of Object.entries(walls)) {
      const ops = openings.filter((o) => o.side === side).map((o) => ({ ...o, y0: o.y0 || 0, h: o.h || 2.3 }))
        .sort((a, b) => a.at - b.at);
      let cur = w.a0;
      for (const o of ops) {
        const o0 = o.at - o.w / 2, o1 = o.at + o.w / 2;
        seg(w, cur, o0, 0, h);
        seg(w, o0, o1, 0, o.y0);
        seg(w, o0, o1, o.y0 + o.h, h);
        cur = o1;
      }
      seg(w, cur, w.a1, 0, h);
    }
    if (opts.roof !== false) fn(x0, h, z0, x1, h + 0.3, z1, opts.roofMat || 'roof');
    for (const side of opts.parapet || []) {
      const w = walls[side], r = h + 0.3;
      if (w.ax === 'x') fn(x0, r, w.fixed[0], x1, r + 0.8, w.fixed[1], mat);
      else fn(w.fixed[0], r, z0, w.fixed[1], r + 0.8, z1, mat);
    }
  };
  return { add, add2, add4, spawn, spawn2, spawn4, crate2, stairs, building };
}

// ---------- Maps ----------

export const MAPS = {
  warehouse: {
    name: 'Warehouse',
    theme: { sky: '#9fb2c6', fog: [45, 120], hemi: ['#e4edf7', '#6a5d50', 2.0], sun: ['#fff1da', 2.4, [22, 40, 14]] },
    bounds: 32,
    build({ add, add2, crate2, spawn2, stairs }) {
      add(-31, -1, -21, 31, 0, 21, 'floor');
      add(-31, 0, 20, 31, 10, 21, 'wall');
      add(-31, 0, -21, 31, 10, -20, 'wall');
      add(30, 0, -20, 31, 10, 20, 'wall');
      add(-31, 0, -20, -30, 10, 20, 'wall');
      // Mezzanines (north, mirrored south)
      add2(-30, 3.6, 13, 10, 4, 20, 'grate');
      for (const x of [-24, -12, 0, 7]) add2(x - 0.3, 0, 13.2, x + 0.3, 3.6, 13.8, 'pillar');
      add2(-30, 4, 13, 10, 5, 13.15, 'rail');
      add2(9.85, 4, 13, 10, 5, 14, 'rail');
      add2(9.85, 4, 17, 10, 5, 20, 'rail');
      for (let i = 0; i < 7; i++) add2(10 + i, 0, 14, 11 + i, 3.5 - 0.5 * i, 17, 'stairs');
      // Containers
      add2(-7, 0, 1, -1, 2.5, 3.5, 'containerRed', 'containerBlue');
      add2(-22, 0, -8.5, -16, 2.5, -6, 'containerBlue', 'containerRed');
      add2(-10.5, 0, 3, -8, 2.5, 9, 'containerGreen');
      // Crates
      add(-0.6, 0, -0.6, 0.6, 1.2, 0.6, 'crate');
      crate2(-17, -5.3);
      crate2(-25, 5); crate2(-25, 6.2); crate2(-25, 5, 1.2);
      crate2(-4, 9); crate2(-4, 9, 1.2); crate2(-2.8, 9);
      crate2(-20, 17); crate2(-6, 18); crate2(-6, 16.8);
      crate2(-24, -17);
      crate2(-11.5, 0);
      crate2(4, 4);
      crate2(-9.25, 2.3);
      // Barriers and pillars
      add2(-15, 0, 9, -12, 1, 9.6, 'barrier');
      add2(-27, 0, -3, -26.4, 1, 0, 'barrier');
      add2(-4, 0, -12, -1, 1, -11.4, 'barrier');
      add2(-20.5, 0, -12.5, -19.5, 10, -11.5, 'pillar');
      add2(13.5, 0, -2.5, 14.5, 10, -1.5, 'pillar');
      for (const [x, y, z] of [[-26, 0, -16], [-26, 0, 10], [-14, 0, -10], [0, 0, -7], [-22, 4, 17], [-3, 4, 16.5], [-27, 0, 2], [12, 0, 4]]) spawn2(x, y, z);
      void stairs;
    },
    decor(g, M) {
      const truss = [], lamps = [];
      for (let x = -24; x <= 24; x += 8) {
        truss.push(new THREE.BoxGeometry(0.4, 0.6, 41).translate(x, 9.7, 0));
        for (const z of [-8, 8]) {
          truss.push(new THREE.BoxGeometry(0.05, 2.2, 0.05).translate(x, 8.3, z));
          lamps.push(new THREE.CylinderGeometry(0.35, 0.5, 0.25, 12).translate(x, 7.1, z));
        }
      }
      for (const z of [-12, 0, 12]) truss.push(new THREE.BoxGeometry(61, 0.4, 0.3).translate(0, 9.9, z));
      addMerged(g, truss, M.steel, true);
      addMerged(g, lamps, M.lamp);
    },
  },

  yard: {
    name: 'Container Yard',
    theme: { sky: '#8ec5f5', fog: [60, 160], hemi: ['#e6f1ff', '#6b6458', 1.9], sun: ['#fff6e6', 2.8, [-30, 45, 20]] },
    bounds: 37,
    build({ add, add2, crate2, spawn2, stairs }) {
      add(-37, -1, -27, 37, 0, 27, 'asphalt');
      add(-37, 0, 25, 37, 4, 27, 'concreteWall');
      add(-37, 0, -27, 37, 4, -25, 'concreteWall');
      add(35, 0, -25, 37, 4, 25, 'concreteWall');
      add(-37, 0, -25, -35, 4, 25, 'concreteWall');
      const H = 2.6;
      const C = (x0, z0, o, lvl, mat, mat2) => {
        const [sx, sz] = o === 'x' ? [6, 2.6] : [2.6, 6];
        add2(x0, lvl * H, z0, x0 + sx, lvl * H + H, z0 + sz, mat, mat2);
      };
      // Central twin towers joined by a bridge
      C(-12, -2.6, 'x', 0, 'containerRed', 'containerBlue');
      C(-12, -2.6, 'x', 1, 'containerOrange', 'containerGreen');
      add(-6, 4.9, -1.3, 6, 5.2, 1.3, 'grate');
      add2(-6, 5.2, -1.3, 6, 6.1, -1.2, 'rail');
      stairs(-20, -2.6, -12, 0, 0, 5.2, '+x');
      // Lanes
      C(-34, -24, 'z', 0, 'containerBlue', 'containerRed');
      crate2(-30.7, -21);
      C(-26, -14, 'x', 0, 'containerGreen', 'containerOrange');
      crate2(-22.5, -10.7);
      C(-30, -6, 'z', 0, 'containerOrange', 'containerBlue');
      C(-30, 4, 'z', 0, 'containerRed', 'containerGreen');
      C(-20, 6, 'x', 0, 'containerBlue', 'containerRed');
      C(-20, 6, 'x', 1, 'containerGreen', 'containerOrange');
      C(-20, 16, 'z', 0, 'containerOrange', 'containerBlue');
      crate2(-16.7, 18);
      C(-10, 12, 'x', 0, 'containerGreen', 'containerRed');
      C(-4, -22, 'z', 0, 'containerRed', 'containerGreen');
      C(-12, -16, 'x', 0, 'containerBlue', 'containerOrange');
      crate2(-9, -12.7);
      // Cover
      crate2(-14, -6); crate2(-14, -6, 1.2); crate2(-12.8, -6);
      crate2(-24, -1);
      crate2(-8, 20); crate2(-8, 21.2);
      add2(-20, 0, -20, -17, 1, -19.4, 'barrier');
      add2(-6, 0, -8, -3, 1, -7.4, 'barrier');
      add2(-6, 0, 6, -5.4, 1, 9, 'barrier');
      for (const [x, y, z] of [[-32, 0, -12], [-32, 0, 14], [-14, 0, -22], [-2, 0, -10], [-16, 0, 2], [-9, 5.2, -1.3], [-24, 0, 12], [-26, 0, 22]]) spawn2(x, y, z);
    },
    decor(g, M) {
      const poles = [], heads = [];
      for (const [x, z] of [[-33, -10], [-33, 10], [33, -10], [33, 10], [-12, 23.5], [12, -23.5]]) {
        poles.push(new THREE.CylinderGeometry(0.12, 0.16, 9, 8).translate(x, 4.5, z));
        heads.push(new THREE.BoxGeometry(1.2, 0.25, 0.5).translate(x, 9, z));
      }
      // Gantry crane (decorative) over the north side
      const crane = [
        new THREE.BoxGeometry(0.8, 14, 0.8).translate(-26, 7, 28.5),
        new THREE.BoxGeometry(0.8, 14, 0.8).translate(26, 7, 28.5),
        new THREE.BoxGeometry(53, 1.2, 1.2).translate(0, 14, 28.5),
        new THREE.BoxGeometry(3, 2, 2).translate(6, 12.6, 28.5),
      ];
      addMerged(g, poles, M.steel, true);
      addMerged(g, heads, M.lamp);
      addMerged(g, crane, M.craneYellow, true);
    },
  },

  town: {
    name: 'Desert Town',
    theme: { sky: '#e8cfa0', fog: [40, 120], hemi: ['#fff1d6', '#8a6a48', 1.8], sun: ['#ffd9a0', 3.0, [35, 28, -20]] },
    bounds: 33,
    build({ add, add2, crate2, spawn2, stairs, building }) {
      add(-33, -1, -25, 33, 0, 25, 'sand');
      add(-33, 0, 24, 33, 5, 25, 'adobeDark');
      add(-33, 0, -25, 33, 5, -24, 'adobeDark');
      add(32, 0, -24, 33, 5, 24, 'adobeDark');
      add(-33, 0, -24, -32, 5, 24, 'adobeDark');
      add(-1.5, 0, -1.5, 1.5, 0.9, 1.5, 'stone'); // well
      // B1: house with roof access
      building(-28, -20, -20, -12, 4,
        [{ side: 'n', at: -24, w: 1.8 }, { side: 'e', at: -16, w: 1.8 }, { side: 'n', at: -21.5, w: 1.2, y0: 1.1, h: 0.9 }],
        { parapet: ['n', 'e'] });
      stairs(-30, -20, -28.2, -12.2, 0, 4.3, '+z', 'wood');
      // B2
      building(-16, -22, -8, -14, 4,
        [{ side: 'n', at: -12, w: 1.8 }, { side: 'w', at: -18, w: 1.8 }, { side: 'e', at: -18, w: 1.2, y0: 1.1, h: 0.9 }]);
      // B3: tall block
      building(-6, -20, -1, -10, 7,
        [{ side: 'n', at: -3.5, w: 1.6 }, { side: 'w', at: -13, w: 1.2, y0: 1.1, h: 0.9 }, { side: 'e', at: -16, w: 1.2, y0: 1.1, h: 0.9 }], { mat: 'adobeDark' });
      // B4: market hall with wide front
      building(-28, 8, -18, 20, 4,
        [{ side: 's', at: -23, w: 3 }, { side: 'e', at: 14, w: 1.8 }, { side: 'n', at: -23, w: 1.2, y0: 1.1, h: 0.9 }],
        { parapet: ['s'] });
      stairs(-18, 16, -16.2, 20, 0, 4.3, '-x', 'wood');
      // B5
      building(-14, 8, -6, 14, 3.2,
        [{ side: 's', at: -10, w: 1.8 }, { side: 'e', at: 11, w: 1.6 }, { side: 'n', at: -10, w: 1.2, y0: 1.0, h: 0.9 }]);
      // Market stalls
      const stall = (cx, cz) => {
        for (const [dx, dz] of [[-1.2, -0.9], [1.2, -0.9], [-1.2, 0.9], [1.2, 0.9]]) add2(cx + dx - 0.07, 0, cz + dz - 0.07, cx + dx + 0.07, 2.4, cz + dz + 0.07, 'wood');
        add2(cx - 1.35, 2.4, cz - 1.05, cx + 1.35, 2.5, cz + 1.05, 'cloth', 'clothB');
        add2(cx - 1.2, 0, cz - 0.9, cx + 1.2, 0.9, cz - 0.5, 'wood');
      };
      stall(-14, -6); stall(-6, 5); stall(-24, 4);
      // Barrels / crates
      const barrel = (x, z) => add2(x - 0.35, 0, z - 0.35, x + 0.35, 1.0, z + 0.35, 'barrel');
      barrel(-18, -6); barrel(-17.2, -6.3); barrel(-30, 0); barrel(-12, 19.5); barrel(-3, 22);
      crate2(-20, -9); crate2(-20, -9, 1.2); crate2(-8.8, -9);
      crate2(-30.5, 18); crate2(-30.5, 16.8);
      add2(-1, 0, 6, 0, 3.5, 7, 'palm');
      add2(-26, 0, -2, -25.4, 3.5, -1.4, 'palm');
      for (const [x, y, z] of [[-30, 0, -2], [-24, 0, -16], [-12, 0, -10], [-24, 4.3, -16], [-22, 0, 4.5], [-10, 0, 18], [-2, 0, -6], [-23, 0, 14]]) spawn2(x, y, z);
    },
    decor(g, M) {
      const fronds = [];
      for (const [x, z] of [[-0.5, 6.5], [0.5, -6.5], [-25.7, -1.7], [25.7, 1.7]]) {
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          const leaf = new THREE.BoxGeometry(0.5, 0.06, 2.4).translate(0, 0, 1.1);
          leaf.rotateX(0.45);
          leaf.rotateY(a);
          leaf.translate(x, 3.6, z);
          fronds.push(leaf);
        }
      }
      addMerged(g, fronds, M.leaf, true);
    },
  },

  pit: {
    name: 'Neon Pit',
    theme: { sky: '#0b0f1e', fog: [25, 70], hemi: ['#6f7cff', '#2a1838', 1.6], sun: ['#b9c6ff', 1.1, [10, 30, 18]], night: true },
    bounds: 21,
    build({ add, add4, spawn, spawn4, stairs }) {
      add(-21, -1, -21, 21, 0, 21, 'neonFloor');
      add(-21, 0, 20, 21, 6, 21, 'neonWall');
      add(-21, 0, -21, 21, 6, -20, 'neonWall');
      add(20, 0, -20, 21, 6, 20, 'neonWall');
      add(-21, 0, -20, -20, 6, 20, 'neonWall');
      add(-4, 0, -4, 4, 2, 4, 'neonBlock');
      stairs(-1.5, -8, 1.5, -4, 0, 2, '+z', 'neonBlock', add4);
      add4(-19.5, 0, -19.5, -14, 3.5, -14, 'neonBlock');
      add4(-12.5, 0, -18.5, -10.5, 0.15, -16.5, 'pad');
      add4(-9, 0, -9, -7.8, 6, -7.8, 'neonPillar');
      add4(-15, 0, -6, -14.4, 1.1, 0, 'neonBlock');
      add4(-5, 0, -14, 0, 1.1, -13.4, 'neonBlock');
      add4(-19.5, 0, -2, -17.5, 1.6, 2, 'neonBlock');
      spawn4(-16, 0, -6);
      spawn4(-6, 0, -16);
      spawn4(-16.75, 3.5, -16.75);
      spawn(0, 2, 0);
    },
    decor(g, M) {
      const cyan = [], pink = [];
      for (const s of [-1, 1]) {
        cyan.push(new THREE.BoxGeometry(40, 0.08, 0.08).translate(0, 0.1, s * 19.95));
        pink.push(new THREE.BoxGeometry(0.08, 0.08, 40).translate(s * 19.95, 0.1, 0));
        cyan.push(new THREE.BoxGeometry(40, 0.08, 0.08).translate(0, 5.9, s * 19.95));
        pink.push(new THREE.BoxGeometry(0.08, 0.08, 40).translate(s * 19.95, 5.9, 0));
        pink.push(new THREE.BoxGeometry(8.1, 0.06, 0.06).translate(0, 2.02, s * 4.02));
        cyan.push(new THREE.BoxGeometry(0.06, 0.06, 8.1).translate(s * 4.02, 2.02, 0));
      }
      addMerged(g, cyan, M.neonCyan);
      addMerged(g, pink, M.neonPink);
      const lights = [['#36e0ff', 0, -12], ['#ff3ec8', 0, 12], ['#36e0ff', 12, 0], ['#ff3ec8', -12, 0]];
      for (const [c, x, z] of lights) {
        const l = new THREE.PointLight(c, 30, 22, 1.6);
        l.position.set(x, 4, z);
        g.add(l);
      }
    },
  },
};

export function setMapData(id) {
  const map = MAPS[id] || MAPS.warehouse;
  boxes.length = 0;
  spawns.length = 0;
  map.build(makeApi());
  // Drop any spawn that ended up inside geometry.
  for (let i = spawns.length - 1; i >= 0; i--) {
    const s = spawns[i];
    const blocked = boxes.some((b) => s.x + 0.4 > b.x0 && s.x - 0.4 < b.x1 && s.y + 0.01 + 1.8 > b.y0 && s.y + 0.01 < b.y1 && s.z + 0.4 > b.z0 && s.z - 0.4 < b.z1);
    if (blocked) { console.warn('spawn blocked', id, s); spawns.splice(i, 1); }
  }
  return map;
}

// ---------- Rendering ----------

function makeTex(draw, size = 256, emissive = false) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  draw(g, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  void emissive;
  return t;
}
function speckle(g, s, n, colors, maxSize = 3) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = colors[(Math.random() * colors.length) | 0];
    const w = 1 + Math.random() * maxSize;
    g.fillRect(Math.random() * s, Math.random() * s, w, w);
  }
}
function stains(g, s, n, rgba) {
  for (let i = 0; i < n; i++) {
    const x = Math.random() * s, y = Math.random() * s, r = 20 + Math.random() * 60;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, rgba); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

const TEX = {
  concrete: () => makeTex((g, s) => {
    g.fillStyle = '#77756f'; g.fillRect(0, 0, s, s);
    speckle(g, s, 4000, ['rgba(0,0,0,0.08)', 'rgba(255,255,255,0.06)', 'rgba(60,55,50,0.12)']);
    stains(g, s, 6, 'rgba(30,28,25,0.18)');
    g.strokeStyle = 'rgba(20,20,20,0.45)'; g.lineWidth = 2;
    g.strokeRect(1, 1, s - 2, s - 2);
    g.beginPath(); g.moveTo(s / 2, 0); g.lineTo(s / 2, s); g.moveTo(0, s / 2); g.lineTo(s, s / 2); g.stroke();
  }),
  asphalt: () => makeTex((g, s) => {
    g.fillStyle = '#3d3f42'; g.fillRect(0, 0, s, s);
    speckle(g, s, 6000, ['rgba(255,255,255,0.06)', 'rgba(0,0,0,0.15)', 'rgba(120,110,90,0.08)'], 2);
    stains(g, s, 5, 'rgba(10,10,10,0.25)');
    g.fillStyle = 'rgba(230,200,60,0.55)'; g.fillRect(0, s / 2 - 3, s * 0.45, 6);
  }),
  wall: () => makeTex((g, s) => {
    g.fillStyle = '#56606a'; g.fillRect(0, 0, s, s);
    for (let x = 0; x < s; x += 16) {
      g.fillStyle = 'rgba(255,255,255,0.09)'; g.fillRect(x, 0, 6, s);
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x + 12, 0, 3, s);
    }
    for (let i = 0; i < 8; i++) {
      const x = Math.random() * s;
      const grd = g.createLinearGradient(0, 0, 0, s);
      grd.addColorStop(0, 'rgba(120,60,20,0.35)'); grd.addColorStop(1, 'rgba(120,60,20,0)');
      g.fillStyle = grd; g.fillRect(x, 0, 3 + Math.random() * 6, s * (0.3 + Math.random() * 0.6));
    }
    speckle(g, s, 1500, ['rgba(0,0,0,0.08)', 'rgba(255,255,255,0.05)']);
  }),
  crate: () => makeTex((g, s) => {
    g.fillStyle = '#9c6f3c'; g.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 32) {
      g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(0, y, s, 2);
      g.fillStyle = `rgba(255,220,160,${0.04 + Math.random() * 0.06})`; g.fillRect(0, y + 2, s, 30);
    }
    speckle(g, s, 1200, ['rgba(60,30,10,0.15)', 'rgba(255,230,180,0.06)'], 2);
    g.fillStyle = '#6e4a24';
    const b = 22;
    g.fillRect(0, 0, s, b); g.fillRect(0, s - b, s, b); g.fillRect(0, 0, b, s); g.fillRect(s - b, 0, b, s);
    g.save(); g.translate(s / 2, s / 2); g.rotate(Math.PI / 4); g.fillRect(-s * 0.7, -b / 2, s * 1.4, b); g.restore();
    g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, s - 3, s - 3);
  }),
  wood: () => makeTex((g, s) => {
    g.fillStyle = '#8a6239'; g.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 32) {
      g.fillStyle = `rgba(${Math.random() > 0.5 ? '255,220,170' : '40,20,5'},${0.05 + Math.random() * 0.08})`; g.fillRect(0, y, s, 32);
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(0, y, s, 2);
    }
    speckle(g, s, 900, ['rgba(50,25,5,0.2)'], 2);
  }, 128),
  container: (base) => makeTex((g, s) => {
    g.fillStyle = base; g.fillRect(0, 0, s, s);
    for (let x = 0; x < s; x += 20) {
      g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(x, 0, 7, s);
      g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(x + 14, 0, 4, s);
    }
    stains(g, s, 5, 'rgba(60,40,20,0.25)');
    speckle(g, s, 1500, ['rgba(0,0,0,0.1)', 'rgba(255,255,255,0.05)']);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, 0, s, 6); g.fillRect(0, s - 6, s, 6);
  }),
  grate: () => makeTex((g, s) => {
    g.fillStyle = '#4b5056'; g.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 16) for (let x = (y / 16) % 2 ? 8 : 0; x < s; x += 16) {
      g.fillStyle = 'rgba(255,255,255,0.18)';
      g.save(); g.translate(x + 4, y + 8); g.rotate(0.6); g.fillRect(-5, -1.5, 10, 3); g.restore();
    }
    speckle(g, s, 800, ['rgba(0,0,0,0.12)']);
  }, 128),
  sand: () => makeTex((g, s) => {
    g.fillStyle = '#d2b07a'; g.fillRect(0, 0, s, s);
    speckle(g, s, 7000, ['rgba(255,240,200,0.12)', 'rgba(120,80,30,0.12)', 'rgba(90,60,20,0.08)'], 2);
    stains(g, s, 8, 'rgba(150,100,50,0.15)');
  }),
  adobe: (base) => makeTex((g, s) => {
    g.fillStyle = base; g.fillRect(0, 0, s, s);
    speckle(g, s, 5000, ['rgba(255,255,255,0.07)', 'rgba(90,50,20,0.08)'], 3);
    stains(g, s, 7, 'rgba(110,70,40,0.16)');
  }),
  stone: () => makeTex((g, s) => {
    g.fillStyle = '#9b9285'; g.fillRect(0, 0, s, s);
    g.strokeStyle = 'rgba(40,35,30,0.55)'; g.lineWidth = 3;
    for (let y = 0; y < s; y += 42) {
      g.beginPath(); g.moveTo(0, y); g.lineTo(s, y); g.stroke();
      for (let x = (y / 42) % 2 ? 0 : 32; x < s; x += 64) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 42); g.stroke(); }
    }
    speckle(g, s, 2000, ['rgba(255,255,255,0.07)', 'rgba(0,0,0,0.1)']);
  }),
  neonFloor: () => makeTex((g, s) => {
    g.fillStyle = '#12141f'; g.fillRect(0, 0, s, s);
    speckle(g, s, 1500, ['rgba(255,255,255,0.03)'], 2);
    g.strokeStyle = 'rgba(80,220,255,0.55)'; g.lineWidth = 3;
    g.strokeRect(1.5, 1.5, s - 3, s - 3);
    g.strokeStyle = 'rgba(80,220,255,0.15)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(s / 2, 0); g.lineTo(s / 2, s); g.moveTo(0, s / 2); g.lineTo(s, s / 2); g.stroke();
  }),
  neonWall: () => makeTex((g, s) => {
    g.fillStyle = '#1a1d2c'; g.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 64) { g.fillStyle = 'rgba(255,255,255,0.04)'; g.fillRect(0, y, s, 30); }
    g.fillStyle = 'rgba(255,62,200,0.35)'; g.fillRect(0, s / 2 - 2, s, 4);
  }),
  pad: () => makeTex((g, s) => {
    g.fillStyle = '#0d2a1a'; g.fillRect(0, 0, s, s);
    g.strokeStyle = '#4dff9a'; g.lineWidth = 10;
    for (let i = 0; i < 3; i++) {
      g.beginPath(); g.moveTo(s * 0.2, s * (0.75 - i * 0.22)); g.lineTo(s * 0.5, s * (0.5 - i * 0.22)); g.lineTo(s * 0.8, s * (0.75 - i * 0.22)); g.stroke();
    }
  }, 128),
};

let MATS = null;
function mats() {
  if (MATS) return MATS;
  const concrete = TEX.concrete(), grate = TEX.grate(), wood = TEX.wood(), adobe = TEX.adobe('#d8b88a');
  MATS = {
    floor: { map: concrete, tile: 4, roughness: 0.92 },
    wall: { map: TEX.wall(), tile: 3, roughness: 0.75, metalness: 0.1 },
    concreteWall: { map: concrete, tile: 3, roughness: 0.9, color: '#c4c0b8' },
    asphalt: { map: TEX.asphalt(), tile: 6, roughness: 0.95 },
    crate: { map: TEX.crate(), fit: true, roughness: 0.85 },
    containerRed: { map: TEX.container('#8c2f25'), tile: 2.6, roughness: 0.6, metalness: 0.1 },
    containerBlue: { map: TEX.container('#2b4f7a'), tile: 2.6, roughness: 0.6, metalness: 0.1 },
    containerGreen: { map: TEX.container('#3f6a37'), tile: 2.6, roughness: 0.6, metalness: 0.1 },
    containerOrange: { map: TEX.container('#b8641f'), tile: 2.6, roughness: 0.6, metalness: 0.1 },
    grate: { map: grate, tile: 1, roughness: 0.6, metalness: 0.2 },
    stairs: { map: grate, tile: 1, roughness: 0.6, metalness: 0.2, color: '#c8c8c8' },
    pillar: { map: concrete, tile: 2, roughness: 0.9, color: '#b8b5ad' },
    barrier: { map: concrete, tile: 1.5, roughness: 0.9, color: '#d6d2c8' },
    rail: { color: '#d9a21b', roughness: 0.5, metalness: 0.3 },
    sand: { map: TEX.sand(), tile: 5, roughness: 1 },
    adobe: { map: adobe, tile: 3, roughness: 0.95 },
    adobeDark: { map: TEX.adobe('#b58f62'), tile: 3, roughness: 0.95 },
    roof: { map: wood, tile: 2, roughness: 0.9, color: '#a88a6a' },
    wood: { map: wood, tile: 1.5, roughness: 0.85 },
    stone: { map: TEX.stone(), tile: 1.5, roughness: 0.9 },
    cloth: { color: '#b8322a', roughness: 1 },
    clothB: { color: '#2a5fb8', roughness: 1 },
    barrel: { color: '#3f5f7a', roughness: 0.6, metalness: 0.2 },
    palm: { color: '#7a5a3a', roughness: 1 },
    neonFloor: { map: TEX.neonFloor(), tile: 4, roughness: 0.4, metalness: 0.3 },
    neonWall: { map: TEX.neonWall(), tile: 3, roughness: 0.5, metalness: 0.2 },
    neonBlock: { map: TEX.neonWall(), tile: 2, roughness: 0.5, metalness: 0.1, color: '#c3c9ff', emissive: '#2a2f5a', emissiveIntensity: 1 },
    neonPillar: { color: '#22263a', roughness: 0.4, emissive: '#5b2b7a', emissiveIntensity: 0.6 },
    pad: { map: TEX.pad(), fit: true, roughness: 0.4, emissive: '#2dff7a', emissiveIntensity: 0.8, emissiveMap: true },
  };
  return MATS;
}

const DECOR_MATS = {
  steel: new THREE.MeshStandardMaterial({ color: '#4a5058', roughness: 0.6, metalness: 0.2 }),
  lamp: new THREE.MeshStandardMaterial({ color: '#222', emissive: '#ffe6b0', emissiveIntensity: 2 }),
  craneYellow: new THREE.MeshStandardMaterial({ color: '#e0a21b', roughness: 0.6 }),
  leaf: new THREE.MeshStandardMaterial({ color: '#4f7a2a', roughness: 0.9, side: THREE.DoubleSide }),
  neonCyan: new THREE.MeshBasicMaterial({ color: '#36e0ff' }),
  neonPink: new THREE.MeshBasicMaterial({ color: '#ff3ec8' }),
};

function addMerged(g, geos, mat, shadow = false) {
  const m = new THREE.Mesh(mergeGeometries(geos), mat);
  m.castShadow = shadow;
  m.receiveShadow = shadow;
  g.add(m);
}

function boxGeo(b, def) {
  const sx = b.x1 - b.x0, sy = b.y1 - b.y0, sz = b.z1 - b.z0;
  const g = new THREE.BoxGeometry(sx, sy, sz);
  if (!def.fit && def.tile) {
    // Scale UVs per face so textures tile at a fixed world size.
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      const f = Math.floor(i / 4);
      const [su, sv] = f < 2 ? [sz, sy] : f < 4 ? [sx, sz] : [sx, sy];
      uv.setXY(i, uv.getX(i) * su / def.tile, uv.getY(i) * sv / def.tile);
    }
  }
  g.translate((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2);
  return g;
}

// Builds the visible scene for the map whose data is currently loaded. Returns a group to remove later.
export function buildMapScene(scene, id) {
  const map = MAPS[id] || MAPS.warehouse;
  const M = mats();
  const t = map.theme;
  scene.background = new THREE.Color(t.sky);
  scene.fog = new THREE.Fog(t.sky, t.fog[0], t.fog[1]);

  const group = new THREE.Group();
  const byMat = {};
  for (const b of boxes) (byMat[b.mat] ||= []).push(b);
  for (const [name, list] of Object.entries(byMat)) {
    const def = M[name] || { color: '#ff00ff' };
    const mat = new THREE.MeshStandardMaterial({
      map: def.map || null, color: def.color || '#ffffff',
      roughness: def.roughness ?? 0.8, metalness: def.metalness ?? 0,
      emissive: def.emissive || '#000000', emissiveIntensity: def.emissiveIntensity ?? 1,
      emissiveMap: def.emissiveMap ? def.map : null,
    });
    const mesh = new THREE.Mesh(mergeGeometries(list.map((b) => boxGeo(b, def))), mat);
    mesh.castShadow = !['floor', 'asphalt', 'sand', 'neonFloor'].includes(name);
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  if (map.decor) map.decor(group, DECOR_MATS);

  group.add(new THREE.HemisphereLight(t.hemi[0], t.hemi[1], t.hemi[2]));
  const sun = new THREE.DirectionalLight(t.sun[0], t.sun[1]);
  sun.position.set(...t.sun[2]);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const r = map.bounds * 1.35;
  Object.assign(sun.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 1, far: 140 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  group.add(sun);
  scene.add(group);
  return group;
}
