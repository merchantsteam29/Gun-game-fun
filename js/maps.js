import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Collision boxes {x0,y0,z0,x1,y1,z1,mat} and spawn points for the current map.
// These arrays are mutated in place when the map changes so importers keep valid references.
export const boxes = [];
export const spawns = [];
export const MAP_ORDER = ['warehouse', 'yard', 'town', 'pit', 'outpost', 'office', 'ruins', 'docks', 'arena', 'compound', 'rooftops', 'station', 'canyon', 'construction', 'ship', 'trains', 'lake'];
// Render quality (lowered on mobile before any map is built).
export const quality = { shadowSize: 2048, pointLights: true };

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
  // Thin walls with door gaps: gaps = [[center, width], ...].
  const wallX = (z, x0, x1, gaps, y0, h, mat, fn = add2, t = 0.15) => {
    let cur = x0;
    for (const [c, w] of [...gaps].sort((a, b) => a[0] - b[0])) {
      if (c - w / 2 > cur) fn(cur, y0, z - t, c - w / 2, y0 + h, z, mat);
      cur = c + w / 2;
    }
    if (x1 > cur) fn(cur, y0, z - t, x1, y0 + h, z, mat);
  };
  const wallZ = (x, z0, z1, gaps, y0, h, mat, fn = add2, t = 0.15) => {
    let cur = z0;
    for (const [c, w] of [...gaps].sort((a, b) => a[0] - b[0])) {
      if (c - w / 2 > cur) fn(x - t, y0, cur, x, y0 + h, c - w / 2, mat);
      cur = c + w / 2;
    }
    if (z1 > cur) fn(x - t, y0, cur, x, y0 + h, z1, mat);
  };
  return { add, add2, add4, spawn, spawn2, spawn4, crate2, stairs, building, wallX, wallZ };
}

// ---------- Maps ----------

export const MAPS = {
  warehouse: {
    name: 'Warehouse',
    theme: { sky: '#9fb2c6', fog: [45, 120], hemi: ['#e4edf7', '#6a5d50', 2.0], sun: ['#fff1da', 2.4, [22, 40, 14]] },
    bounds: 32,
    hills: [[0, 0, -6, 4], [-14, 4, 16.5, 3.5], [22, 0, 0, 4], [14, 4, -16.5, 3.5], [-22, 0, 0, 4]],
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
    hills: [[0, 0, -9, 4], [-9, 5.2, -1.3, 2.5], [26, 0, 1, 4], [0, 0, 9, 4], [9, 5.2, 1.3, 2.5], [-26, 0, -1, 4]],
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
    hills: [[0, 0, 0, 5], [-23, 0, 14, 3.5], [24, 0, 16, 3], [23, 0, -14, 3.5], [-24, 0, -16, 3]],
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
    hills: [[0, 2, 0, 3.5], [-16.75, 3.5, -16.75, 2.5], [16.75, 3.5, 16.75, 2.5], [16.75, 3.5, -16.75, 2.5], [-16.75, 3.5, 16.75, 2.5]],
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
      if (quality.pointLights) for (const [c, x, z] of lights) {
        const l = new THREE.PointLight(c, 30, 22, 1.6);
        l.position.set(x, 4, z);
        g.add(l);
      }
    },
  },

  outpost: {
    name: 'Snow Outpost',
    theme: { sky: '#c9d6e3', fog: [30, 110], hemi: ['#eef4ff', '#9aa6b2', 2.0], sun: ['#ffffff', 2.2, [-20, 35, 25]] },
    bounds: 33,
    hills: [[0, 0, -6, 4], [-22, 0, -14, 3], [22, 0, 14, 3], [-4, 4.5, -18, 2], [4, 4.5, 18, 2], [0, 0, 6, 4]],
    build({ add, add2, crate2, spawn2, stairs, building }) {
      add(-33, -1, -25, 33, 0, 25, 'snow');
      add(-33, 0, 24, 33, 4, 25, 'palisade');
      add(-33, 0, -25, 33, 4, -24, 'palisade');
      add(32, 0, -24, 33, 4, 24, 'palisade');
      add(-33, 0, -24, -32, 4, 24, 'palisade');
      // Bunker with roof access
      building(-26, -18, -18, -10, 3,
        [{ side: 'e', at: -14, w: 2 }, { side: 'n', at: -22, w: 1.8 }, { side: 's', at: -22, w: 1.6, y0: 1.3, h: 0.5 }],
        { mat: 'concreteWall', roofMat: 'concreteWall', parapet: ['n', 'e'] });
      stairs(-28, -18, -26.2, -10.2, 0, 3.3, '+z', 'wood');
      // Watchtower
      add2(-6, 4.2, -20, -2, 4.5, -16, 'wood');
      for (const [x, z] of [[-6, -20], [-2.3, -20], [-6, -16.3], [-2.3, -16.3]]) add2(x, 0, z, x + 0.3, 4.2, z + 0.3, 'bark');
      add2(-6, 4.5, -20, -2, 5.3, -19.85, 'wood');
      add2(-6, 4.5, -19.85, -5.85, 5.3, -16, 'wood');
      add2(-2.15, 4.5, -19.85, -2, 5.3, -16, 'wood');
      stairs(-5.5, -16, -2.5, -11, 0, 4.5, '-z', 'wood');
      // Hut
      building(-16, 14, -8, 20, 3, [{ side: 's', at: -12, w: 1.8 }, { side: 'e', at: 17, w: 1.6 }], { mat: 'palisade', roofMat: 'wood' });
      // Cover
      add(-1.5, 0, -1.5, 1.5, 2.4, 1.5, 'tank');
      add2(-10, 0, -4, -7, 0.9, -3.4, 'snowBank');
      add2(-16, 0, 10, -12, 0.9, 10.6, 'snowBank');
      add2(-14, 0, 2, -10, 1, 2.8, 'sandbag');
      add2(-20, 0, 6, -19.2, 1, 10, 'sandbag');
      crate2(-12, -14); crate2(-12, -14, 1.2); crate2(-10.8, -14);
      crate2(-29, -21);
      add2(-28, 0, 14, -27.6, 4, 14.4, 'bark');
      add2(-22, 0, -2, -21.6, 4, -1.6, 'bark');
      add2(-6, 0, 20, -5.6, 4, 20.4, 'bark');
      for (const [x, y, z] of [[-22, 0, -14], [-22, 3.3, -14], [-4, 4.5, -18], [-28, 0, 0], [-14, 0, -20], [-8, 0, 10], [-24, 0, 18], [-2, 0, -8], [-12, 0, 17]]) spawn2(x, y, z);
    },
    decor(g, M) {
      const needles = [], caps = [];
      for (const [x, z] of [[-27.8, 14.2], [27.8, -14.2], [-21.8, -1.8], [21.8, 1.8], [-5.8, 20.2], [5.8, -20.2]]) {
        needles.push(new THREE.ConeGeometry(1.8, 3.2, 8).translate(x, 4.2, z));
        needles.push(new THREE.ConeGeometry(1.3, 2.6, 8).translate(x, 5.8, z));
        caps.push(new THREE.ConeGeometry(0.8, 1.2, 8).translate(x, 7.1, z));
      }
      addMerged(g, needles, M.pine, true);
      addMerged(g, caps, M.pineSnow, true);
      addMerged(g, [new THREE.CylinderGeometry(0.08, 0.12, 14, 6).translate(0, 9.4, 0), new THREE.BoxGeometry(1.4, 0.1, 0.1).translate(0, 15, 0)], M.steel, true);
    },
  },

  office: {
    name: 'Office Tower',
    theme: { sky: '#a8c4e0', fog: [40, 120], hemi: ['#f4f6fa', '#7d7468', 2.4], sun: ['#fff4e2', 2.4, [18, 40, 12]] },
    bounds: 25,
    hills: [[0, 0, 0, 3.5], [-18, 4, 13, 3], [18, 4, -13, 3], [-18, 0, -3, 3], [18, 0, 3, 3]],
    build({ add, add2, spawn2, stairs, wallX, wallZ }) {
      add(-25, -1, -17, 25, 0, 17, 'carpet');
      add(-25, 0, 16, 25, 8, 17, 'officeExt');
      add(-25, 0, -17, 25, 8, -16, 'officeExt');
      add(24, 0, -16, 25, 8, 16, 'officeExt');
      add(-25, 0, -16, -24, 8, 16, 'officeExt');
      // Second floor with a central atrium
      add2(-24, 3.7, -16, 24, 4, -5, 'carpet');
      add2(-24, 3.7, -5, -6, 4, 5, 'carpet');
      stairs(-6, -5, 2, -3, 0, 4, '-x', 'stairs');
      add2(-6, 4, -5.15, 6, 5, -5, 'rail');
      add2(-6.15, 4, -3, -6, 5, 5, 'rail');
      add2(-12.4, 0, -5.4, -11.6, 8, -4.6, 'officeExt');
      add2(-12.4, 0, 4.6, -11.6, 8, 5.4, 'officeExt');
      // Ground floor offices
      wallX(10, -24, 24, [[-18, 2], [-6, 2], [6, 2], [18, 2]], 0, 3.7, 'officeWall');
      for (const x of [-12, 0, 12]) wallZ(x, 10, 16, [], 0, 3.7, 'officeWall');
      add2(-22, 0, 13, -19, 0.8, 14.2, 'desk');
      add2(-10, 0, 14, -7, 0.8, 15.2, 'desk');
      add2(2, 0, 12.5, 4, 0.8, 15, 'desk');
      add2(16, 0, 13, 19, 0.8, 14.2, 'desk');
      // Ground floor cubicles
      add2(-22, 0, 6, -14, 1.4, 6.15, 'cubicle');
      add2(-22, 0, 1, -14, 1.4, 1.15, 'cubicle');
      for (const z of [6.15, 1.15]) for (const x of [-21, -17]) add2(x, 0, z, x + 2, 0.8, z + 0.85, 'desk');
      // Upper floor rooms
      wallX(10, -24, 24, [[-18, 2], [-6, 2], [6, 2], [18, 2]], 4, 3.7, 'officeWall');
      for (const x of [-12, 12]) wallZ(x, 10, 16, [], 4, 3.7, 'officeWall');
      add2(-22, 4, 13, -19, 4.8, 14.2, 'desk');
      add2(-4, 4, 12, 4, 4.8, 14, 'desk');
      add2(-22, 4, 2, -16, 5.4, 2.15, 'cubicle');
      add2(-21, 4, 2.15, -19, 4.8, 3, 'desk');
      for (const [x, y, z] of [[-20, 0, 12], [-6, 0, 13], [-20, 0, -3], [-9, 0, -7], [-2, 0, -1], [-20, 4, 12], [-18, 4, -1], [-14, 4, -8], [0, 4, 15]]) spawn2(x, y, z);
    },
    decor(g, M) {
      const lights = [];
      for (let x = -20; x <= 20; x += 8) for (const z of [-12, -7.5, 7.5, 12]) lights.push(new THREE.BoxGeometry(1.6, 0.04, 0.6).translate(x, 3.66, z));
      addMerged(g, lights, M.lightPanel);
      const glass = [];
      for (let x = -22; x <= 22; x += 4) {
        glass.push(new THREE.BoxGeometry(3, 2, 0.05).translate(x, 2, 16.95));
        glass.push(new THREE.BoxGeometry(3, 2, 0.05).translate(x, 2, -16.95));
        glass.push(new THREE.BoxGeometry(3, 2, 0.05).translate(x, 6, 16.95));
        glass.push(new THREE.BoxGeometry(3, 2, 0.05).translate(x, 6, -16.95));
      }
      addMerged(g, glass, M.glass);
    },
  },

  ruins: {
    name: 'Jungle Ruins',
    theme: { sky: '#a9c9b0', fog: [35, 110], hemi: ['#e8ffe8', '#4a5a3a', 1.9], sun: ['#fff0c8', 2.6, [25, 38, -18]] },
    bounds: 31,
    hills: [[0, 4.5, 0, 3], [-20, 0, -20, 4], [20, 0, 20, 4], [20, 0, -20, 4], [-20, 0, 20, 4]],
    build({ add, add4, spawn, spawn4, stairs }) {
      add(-31, -1, -31, 31, 0, 31, 'grass');
      add4(-31, 0, -31, 31, 5, -30, 'mossDark');
      // Stepped temple
      add(-8, 0, -8, 8, 1.5, 8, 'moss');
      add(-6, 1.5, -6, 6, 3, 6, 'moss');
      add(-4, 3, -4, 4, 4.5, 4, 'moss');
      stairs(-1.5, -12, 1.5, -8, 0, 1.5, '+z', 'moss', add4);
      stairs(-1.5, -8, 1.5, -6, 1.5, 3, '+z', 'moss', add4);
      stairs(-1.5, -6, 1.5, -4, 3, 4.5, '+z', 'moss', add4);
      // Columns, ruined walls, blocks
      add4(-16, 0, -16, -15, 5, -15, 'mossDark');
      add4(-16, 0, -6, -15, 3.5, -5, 'mossDark');
      add4(-6, 0, -16, -5, 2, -15, 'mossDark');
      add4(-24, 0, -24, -22.5, 6, -22.5, 'mossDark');
      add4(-24, 0, -12, -23.4, 3, -4, 'moss');
      add4(-12, 0, -20, -4, 1.2, -19.4, 'moss');
      add4(-20, 0, -14, -18, 1.2, -12, 'moss');
      add4(-26, 0, -16, -25.5, 5, -15.5, 'bark');
      add4(-12, 0, -26, -11.5, 5, -25.5, 'bark');
      spawn4(-26, 0, -6);
      spawn4(-20, 0, -24);
      spawn4(-10, 0, -24);
      spawn(0, 4.5, 0);
    },
    decor(g, M) {
      const leaves = [];
      const trunks = [[-25.75, -15.75], [-11.75, -25.75]];
      for (let i = 0; i < 4; i++) {
        for (const t of trunks) {
          leaves.push(new THREE.SphereGeometry(2.2, 8, 6).scale(1, 0.6, 1).translate(t[0], 5.6, t[1]));
          leaves.push(new THREE.SphereGeometry(1.4, 8, 6).scale(1, 0.6, 1).translate(t[0] + 0.8, 6.4, t[1] - 0.5));
          t.splice(0, 2, -t[1], t[0]);
        }
      }
      addMerged(g, leaves, M.jungle, true);
    },
  },

  docks: {
    name: 'Harbor Docks',
    theme: { sky: '#b9cbd8', fog: [45, 140], hemi: ['#eef4fa', '#5d6a72', 2.0], sun: ['#fff3e0', 2.6, [-25, 40, 18]] },
    bounds: 34,
    hills: [[0, 0, 0, 3], [-20, 0, 17, 3.5], [20, 0, -17, 3.5], [3, 0, 14, 3.5], [-3, 0, -14, 3.5]],
    build({ add, add2, crate2, spawn2, stairs, building }) {
      // Two quays split by a water channel you can wade through.
      add(-34, -1, 4, 34, 0, 24, 'dock');
      add(-34, -1, -24, 34, 0, -4, 'dock');
      add(-34, -1.5, -4, 34, -0.5, 4, 'water');
      add(-34, 0, 23, 34, 4, 24, 'concreteWall');
      add(-34, 0, -24, 34, 4, -23, 'concreteWall');
      add(33, -1.5, -23, 34, 4, 23, 'concreteWall');
      add(-34, -1.5, -23, -33, 4, 23, 'concreteWall');
      // Bridges
      add(-2, -0.4, -4, 2, 0, 4, 'wood');
      add2(-17, -0.4, -4, -13, 0, 4, 'wood');
      add2(-17, 0, -4, -16.85, 1, 4, 'rail');
      add(-2, 0, -4, -1.85, 1, 4, 'rail');
      add(1.85, 0, -4, 2, 1, 4, 'rail');
      // Moored boats as cover in the channel
      add2(-30, -0.5, 0.6, -22, 0.9, 3.4, 'hull');
      add2(-28, 0.9, 1.2, -25, 2.2, 2.8, 'cabin');
      add2(6, -0.5, -3.4, 11, 0.7, -1.2, 'hull');
      // Brick shed with roof access (mirrored)
      building(-26, 12, -14, 22, 4,
        [{ side: 's', at: -20, w: 3 }, { side: 'w', at: 17, w: 1.8 }, { side: 's', at: -24, w: 1.2, y0: 1.1, h: 0.9 }, { side: 'n', at: -18, w: 1.2, y0: 1.1, h: 0.9 }],
        { mat: 'brick', parapet: ['s'] });
      stairs(-13.9, 12.5, -12, 21.5, 0, 4.3, '-z', 'wood'); // long flight along the east wall, top lands at the roof edge
      // Containers and cargo
      add2(-6, 0, 8, 0, 2.6, 10.6, 'containerRed', 'containerBlue');
      add2(4, 0, 14, 6.6, 2.6, 20, 'containerGreen', 'containerOrange');
      add2(4, 2.6, 14.4, 6.6, 5.2, 19.6, 'containerBlue', 'containerRed');
      add2(-31, 0, 6, -28.4, 2.6, 12, 'containerOrange', 'containerGreen');
      crate2(-10, 6.5); crate2(-10, 6.5, 1.2); crate2(-8.8, 6.5);
      crate2(10, 9); crate2(11.2, 9);
      crate2(-27, 19); crate2(-3, 20);
      for (const [x, z] of [[-22, 6], [-10, 14.5], [12, 6]]) add2(x - 0.45, 0, z - 0.45, x + 0.45, 1.1, z + 0.45, 'barrel');
      for (const x of [-24, -8, 8, 24]) add2(x - 0.25, 0, 4.2, x + 0.25, 0.6, 4.7, 'bollard');
      for (const [x, y, z] of [[-30, 0, 18], [-26, 0, 9], [-20, 0, 15], [-8, 0, 20], [-20, 4.3, 17], [8, 0, 8], [-2, 0, 16], [14, 0, 20]]) spawn2(x, y, z);
    },
    decor(g, M) {
      const poles = [], heads = [];
      for (const [x, z] of [[-20, 5], [0, 5], [20, 5], [-20, -5], [0, -5], [20, -5]]) {
        poles.push(new THREE.CylinderGeometry(0.1, 0.14, 6, 8).translate(x, 3, z));
        heads.push(new THREE.BoxGeometry(0.9, 0.2, 0.4).translate(x, 6, z));
      }
      addMerged(g, poles, M.steel, true);
      addMerged(g, heads, M.lamp);
      const crane = [
        new THREE.BoxGeometry(0.8, 15, 0.8).translate(-8, 7.5, 26), new THREE.BoxGeometry(0.8, 15, 0.8).translate(8, 7.5, 26),
        new THREE.BoxGeometry(0.8, 1, 30).translate(0, 15, 14), new THREE.BoxGeometry(17, 1, 1).translate(0, 15, 26),
        new THREE.BoxGeometry(2.5, 2, 2.5).translate(0, 13.5, 6),
      ];
      addMerged(g, crane, M.craneYellow, true);
      addMerged(g, [new THREE.CylinderGeometry(0.03, 0.03, 8, 4).translate(0, 9.5, 6)], M.steel);
    },
  },

  arena: {
    name: 'Colosseum',
    theme: { sky: '#f0d9b0', fog: [40, 110], hemi: ['#fff4dc', '#8a6c4a', 1.9], sun: ['#ffe2b0', 3.0, [28, 34, -16]] },
    bounds: 26,
    hills: [[0, 1, 0, 3.5], [-15, 0, -15, 3], [15, 0, 15, 3], [15, 0, -15, 3], [-15, 0, 15, 3]],
    build({ add, add4, spawn, spawn4, stairs }) {
      add(-26, -1, -26, 26, 0, 26, 'sand');
      add4(-26, 0, -26, 26, 7, -25, 'sandstone');
      // Raised stands around the arena floor, reached by central stairs on each side
      add4(-25, 0, -25, 25, 2.5, -22, 'sandstone');
      stairs(-1.5, -22, 1.5, -17, 0, 2.5, '-z', 'sandstone', add4);
      for (const x of [-20, -10, 10, 20]) add4(x - 0.5, 2.5, -24.6, x + 0.5, 7, -23.6, 'sandstoneDark');
      add4(-25, 2.5, -22.15, -4, 3.3, -22, 'sandstoneDark');
      add4(4, 2.5, -22.15, 25, 3.3, -22, 'sandstoneDark');
      // Central dais
      add(-5, 0, -5, 5, 1, 5, 'stone');
      stairs(-1.5, -7, 1.5, -5, 0, 1, '+z', 'stone', add4);
      add4(-5, 1, -5, -4.4, 2.2, -2, 'stone');
      // Obelisks, broken walls, chariots of crates
      add4(-12, 0, -12, -10.8, 5, -10.8, 'sandstoneDark');
      add4(-14, 0, -4, -13.4, 1.6, 4, 'sandstone');
      add4(-8, 0, -17, -3, 1.2, -16.4, 'sandstone');
      add4(-19, 0, -9, -18, 3, -8, 'sandstoneDark');
      add4(-20, 0, -15.5, -18.8, 1.2, -14.3, 'crate');
      add4(-7.6, 0, -11, -6.4, 1.2, -9.8, 'crate');
      spawn4(-18, 0, -4);
      spawn4(-6, 0, -20);
      spawn4(-14, 2.5, -23.5);
      spawn(0, 1, 0);
    },
    decor(g, M) {
      const banners = [], poles = [];
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2;
        for (const off of [-15, 15]) {
          const x = Math.cos(a) * 25.4 - Math.sin(a) * off, z = Math.sin(a) * 25.4 + Math.cos(a) * off;
          poles.push(new THREE.CylinderGeometry(0.08, 0.08, 4, 6).translate(x, 9, z));
          banners.push(new THREE.BoxGeometry(i % 2 ? 0.05 : 1.6, 2.4, i % 2 ? 1.6 : 0.05).translate(x, 8.6, z));
        }
      }
      addMerged(g, poles, M.steel);
      addMerged(g, banners, M.banner);
    },
  },

  compound: {
    name: 'Military Compound',
    theme: { sky: '#aab5ad', fog: [35, 110], hemi: ['#eef2ec', '#5a5e52', 2.1], sun: ['#fff4e0', 2.3, [20, 42, 22]] },
    bounds: 26,
    hills: [[0, 0, 0, 3.5], [-17, 0, 12, 3], [17, 0, -12, 3], [-17, 0, -12, 3], [17, 0, 12, 3]],
    build({ add, add2, crate2, spawn2, stairs, wallX, wallZ }) {
      add(-26, -1, -18, 26, 0, 18, 'metalFloor');
      add(-26, 0, 17, 26, 5, 18, 'bunkerWall');
      add(-26, 0, -18, 26, 5, -17, 'bunkerWall');
      add(25, 0, -17, 26, 5, 17, 'bunkerWall');
      add(-26, 0, -17, -25, 5, 17, 'bunkerWall');
      // Wings on each side of a central yard, split into rooms with doorways
      wallZ(-8, -17, 17, [[-12, 2.5], [0, 3], [12, 2.5]], 0, 5, 'bunkerWall', add2, 0.4);
      wallX(6, -25, -8, [[-17, 2.5]], 0, 5, 'bunkerWall', add2, 0.4);
      wallX(-6, -25, -8, [[-20, 2.5], [-12, 2]], 0, 5, 'bunkerWall', add2, 0.4);
      // Catwalk in the middle room
      add2(-25, 2.6, -6, -22, 3, 6, 'grate');
      add2(-22, 3, -2.5, -21.9, 4, 6, 'rail'); // leaves the stair landing open
      stairs(-22, -6, -19.5, -3, 0, 3, '-x', 'stairs');
      // Yard cover
      add2(-4, 0, -4, -3, 5, -3, 'bunkerWall');
      add2(-4, 0, 3, -3, 5, 4, 'bunkerWall');
      add2(-6, 0, 9, -1, 2.6, 11.6, 'containerGreen', 'containerOrange');
      add2(2, 0, 13, 6, 1, 13.6, 'sandbag');
      add2(-6, 0, -1, -5.4, 1, 1, 'sandbag');
      crate2(1, 8); crate2(1, 8, 1.2); crate2(2.2, 8);
      // Room furniture
      crate2(-22, 14); crate2(-22, 12.8); crate2(-12, 9);
      crate2(-14, -14); crate2(-14, -14, 1.2); crate2(-20, -9);
      add2(-24, 0, -16.5, -20, 1, -15.5, 'desk');
      for (const [x, z] of [[-11, 15], [-23.5, -8.5], [-10, -9]]) add2(x - 0.45, 0, z - 0.45, x + 0.45, 1.1, z + 0.45, 'barrel');
      for (const [x, y, z] of [[-23, 0, 14], [-23, 0, -14], [-14, 0, 0], [-24, 3, 0], [-4, 0, 14], [-3, 0, -10], [-13, 0, 12], [-17, 0, -11]]) spawn2(x, y, z);
    },
    decor(g, M) {
      const lights = [];
      for (const [x, z] of [[-16, 12], [-16, 0], [-16, -12], [16, 12], [16, 0], [16, -12], [0, 12], [0, -12]]) lights.push(new THREE.BoxGeometry(1.2, 0.08, 0.4).translate(x, 4.95, z));
      addMerged(g, lights, M.lightPanel);
      const wire = [];
      for (let x = -24; x <= 24; x += 4) for (const z of [-17.5, 17.5]) wire.push(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 4).translate(x, 5.6, z));
      for (const z of [-17.5, 17.5]) wire.push(new THREE.BoxGeometry(50, 0.03, 0.03).translate(0, 6.0, z), new THREE.BoxGeometry(50, 0.03, 0.03).translate(0, 5.6, z));
      addMerged(g, wire, M.steel);
    },
  },

  station: {
    name: 'Space Station',
    theme: { sky: '#05070f', fog: [35, 120], hemi: ['#9fb4ff', '#202436', 1.9], sun: ['#dfe6ff', 1.6, [20, 40, -15]], night: true },
    bounds: 26,
    hills: [[0, 2, -6.5, 2.5], [-19.5, 0, -19.5, 3], [19.5, 0, 19.5, 3], [19.5, 0, -19.5, 3], [-19.5, 0, 19.5, 3]],
    build({ add, add4, spawn4, stairs, wallX, wallZ }) {
      add(-26, -1, -26, 26, 0, 26, 'metalFloor');
      add4(-26, 0, -26, 26, 6, -25, 'stationWall');
      // Reactor core with a raised ring walkway (crawlspace underneath) and four ramps
      add(-3, 0, -3, 3, 7, 3, 'reactor');
      add4(-8, 1.6, -8, 8, 2, -5, 'grate');
      add4(-8, 2, -8.1, -1.6, 2.9, -8, 'rail');
      add4(1.6, 2, -8.1, 8, 2.9, -8, 'rail');
      stairs(-1.5, -12, 1.5, -8, 0, 2, '+z', 'stairs', add4);
      // Corner rooms with doorways
      wallX(-14, -25, -14, [[-19.5, 2.5]], 0, 4, 'stationWall', add4, 0.3);
      wallZ(-14, -25, -14, [[-19.5, 2.5]], 0, 4, 'stationWall', add4, 0.3);
      add4(-24.5, 0, -24.5, -22, 1, -22.6, 'console');
      add4(-17, 0, -24, -15.8, 1.2, -22.8, 'crate');
      // Corridor cover
      add4(-11, 0, -19, -9.8, 1.2, -17.8, 'crate');
      add4(-19, 0, -9, -18.4, 1.1, -5, 'stationWall');
      add4(-12, 0, -12, -11, 4, -11, 'stationWall');
      add4(-5, 0, -19.5, -3, 0.9, -18.9, 'console');
      spawn4(-19.5, 0, -19.5);
      spawn4(-22, 0, -6);
      spawn4(-6, 0, -22);
      spawn4(0, 2, -6.5);
    },
    decor(g, M) {
      const strips = [];
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2, c = Math.cos(a), s = Math.sin(a);
        const geo = new THREE.BoxGeometry(50, 0.08, 0.08);
        geo.rotateY(-a);
        strips.push(geo.clone().translate(s * 24.9, 5.5, -c * 24.9), geo.clone().translate(s * 24.9, 0.15, -c * 24.9));
      }
      for (let y = 1; y < 7; y += 1.5) strips.push(new THREE.BoxGeometry(6.1, 0.1, 6.1).translate(0, y, 0));
      addMerged(g, strips, M.neonCyan);
      // A planet hanging outside the windows
      const planet = new THREE.Mesh(new THREE.SphereGeometry(30, 32, 20), new THREE.MeshBasicMaterial({ color: '#4a6bd8', fog: false }));
      planet.position.set(-60, 25, -95);
      g.add(planet);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(46, 2, 2, 64), new THREE.MeshBasicMaterial({ color: '#c9b48a', fog: false }));
      ring.position.copy(planet.position);
      ring.rotation.set(1.2, 0.3, 0);
      g.add(ring);
    },
  },

  canyon: {
    name: 'Canyon',
    theme: { sky: '#f2b47a', fog: [50, 150], hemi: ['#ffe6c8', '#8a5a3a', 1.9], sun: ['#ffc98a', 3.0, [-30, 30, 20]] },
    bounds: 34,
    hills: [[0, 5, 0, 1.8], [-24, 5, 17, 3.5], [24, 5, -17, 3.5], [-10, 0, 0, 3.5], [10, 0, 0, 3.5]],
    build({ add, add2, crate2, spawn2, stairs }) {
      add(-34, -1, -24, 34, 0, 24, 'sand');
      add(-34, 0, -24, -33, 8, 24, 'rock');
      add(33, 0, -24, 34, 8, 24, 'rock');
      add(-33, 0, 23, 33, 8, 24, 'rock');
      add(-33, 0, -24, 33, 8, -23, 'rock');
      // Two mesas facing each other across the canyon floor
      add2(-33, 0, 10, 33, 5, 23, 'rock');
      stairs(-30, 2, -26, 10, 0, 5, '+z', 'rockStep');
      stairs(18, 2, 22, 10, 0, 5, '+z', 'rockStep');
      // Rope bridge across the middle, on a rock pillar
      add(-2, 4.6, -10, 2, 5, 10, 'wood');
      add(-2, 5, -10, -1.9, 6, 10, 'rail');
      add(1.9, 5, -10, 2, 6, 10, 'rail');
      add(-2.5, 0, -0.6, 2.5, 4.6, 0.6, 'rockStep');
      // Canyon floor boulders and a broken wagon
      add2(-16, 0, -3, -13, 2, 0, 'rockStep');
      add2(-6, 0, 4, -4, 1.4, 7, 'rockStep');
      add2(10, 0, 2, 13, 2.4, 5, 'rockStep');
      add2(-24, 0, 4, -21, 1.1, 5.4, 'wood');
      crate2(-22, 7); crate2(-28, -6);
      // Mesa-top cover
      add2(-14, 5, 15, -11, 6.4, 16.2, 'rockStep');
      add2(-4, 5, 18, -1, 6.2, 19, 'wood');
      add2(8, 5, 13, 9.2, 6.2, 14.2, 'crate');
      add2(-26, 5, 13, -25, 7, 14, 'wood');
      for (const [x, y, z] of [[-30, 5, 20], [-12, 5, 20], [6, 5, 18], [-24, 0, -4], [-14, 0, 6], [8, 0, -6], [-28, 0, 0]]) spawn2(x, y, z);
    },
    decor(g, M) {
      const cactus = [];
      for (const [x, z] of [[-18, -7], [18, 7], [-8, -8], [8, 8], [-29, 6], [29, -6], [14, 20], [-14, -20]]) {
        const y = Math.abs(z) > 10 ? 5 : 0;
        cactus.push(new THREE.CylinderGeometry(0.22, 0.26, 2.4, 8).translate(x, y + 1.2, z));
        cactus.push(new THREE.CylinderGeometry(0.14, 0.14, 0.9, 8).translate(x + 0.45, y + 1.5, z));
        cactus.push(new THREE.CylinderGeometry(0.14, 0.14, 0.7, 8).translate(x - 0.42, y + 1.2, z));
      }
      addMerged(g, cactus, M.cactus, true);
      const rope = [];
      for (let z = -9; z <= 9; z += 1.5) for (const x of [-1.95, 1.95]) rope.push(new THREE.BoxGeometry(0.06, 1, 0.06).translate(x, 5.5, z));
      addMerged(g, rope, M.steel);
    },
  },

  construction: {
    name: 'Construction Site',
    theme: { sky: '#b7c9d8', fog: [45, 130], hemi: ['#f2f5f8', '#7a6a58', 2.0], sun: ['#fff2dc', 2.7, [25, 42, 18]] },
    bounds: 30,
    hills: [[0, 0.3, 0, 3], [0, 4, -5, 2.8], [-6, 7.6, -4, 2.5], [6, 7.6, 4, 2.5], [-22, 0, 0, 3.5], [22, 0, 0, 3.5]],
    build({ add, add2, crate2, spawn2, stairs }) {
      add(-30, -1, -22, 30, 0, 22, 'dirt');
      add(-30, 0, 21.7, 30, 3, 22, 'fence');
      add(-30, 0, -22, 30, 3, -21.7, 'fence');
      add(29.7, 0, -21.7, 30, 3, 21.7, 'fence');
      add(-30, 0, -21.7, -29.7, 3, 21.7, 'fence');
      // Unfinished three-storey frame: open atrium on floor 2, half-built floor 3
      add(-10, 0, -8, 10, 0.3, 8, 'slab');
      add2(-10, 3.6, -8, 10, 4, -1, 'slab');
      add2(-10, 7.2, -8, -2, 7.6, 0, 'slab');
      for (const x of [-9.5, -4.5, 4.5, 9.5]) add2(x - 0.3, 0.3, -7.8, x + 0.3, 7.2, -7.2, 'slab');
      stairs(10.2, -8, 12.2, -1, 0, 4, '+z', 'stairs'); // tops out by the atrium, clear of the corner column
      stairs(-2, -7.8, 3, -5.8, 4, 7.6, '-x', 'stairs');
      add2(-10, 4, -8, -9.85, 5, -1, 'rail');
      // Yard: containers, pipe stacks, sand piles, a cement mixer
      add2(-24, 0, -16, -18, 2.6, -13.4, 'containerOrange', 'containerBlue');
      add2(-26, 0, 4, -23.4, 2.6, 10, 'containerBlue', 'containerGreen');
      add2(-16, 0, 12, -10, 0.9, 13.6, 'pipe');
      add2(-16, 0.9, 12.3, -10, 1.7, 13.3, 'pipe');
      add2(-18, 0, -6, -15, 1, -3, 'sandpile');
      add2(-17.5, 1, -5.5, -15.5, 1.8, -3.5, 'sandpile');
      add2(-6, 0, 13, -3.5, 1.8, 15.5, 'mixer');
      crate2(-20, 16); crate2(-21.2, 16); crate2(-20, 16, 1.2);
      crate2(-13, -16); crate2(-4, -17);
      add2(-27, 0, -4, -26.4, 1, 0, 'barrier');
      for (const [x, y, z] of [[-26, 0, -18], [-15, 0, -2], [-6, 0.3, -4], [-6, 4, -4], [-6, 7.6, -4], [-20, 0, 8], [-12, 0, 18], [-26, 0, 14]]) spawn2(x, y, z);
    },
    decor(g, M) {
      // Tower crane over the site
      const crane = [
        new THREE.BoxGeometry(1.2, 22, 1.2).translate(18, 11, -16),
        new THREE.BoxGeometry(34, 1, 1).translate(8, 22, -16),
        new THREE.BoxGeometry(6, 1, 1).translate(27, 22, -16),
        new THREE.BoxGeometry(2.5, 2.5, 2.5).translate(28, 20.5, -16),
        new THREE.BoxGeometry(2.4, 1.6, 2.4).translate(18, 23.2, -16),
      ];
      addMerged(g, crane, M.craneYellow, true);
      addMerged(g, [new THREE.CylinderGeometry(0.04, 0.04, 12, 4).translate(-4, 16, -16), new THREE.BoxGeometry(1.4, 0.4, 1.4).translate(-4, 9.8, -16)], M.steel);
      // Rebar poking out of the top floor
      const rebar = [];
      for (let x = -9.5; x <= -2.5; x += 1) rebar.push(new THREE.CylinderGeometry(0.025, 0.025, 1.2, 4).translate(x, 8.2, -7.8), new THREE.CylinderGeometry(0.025, 0.025, 1.2, 4).translate(-x, 8.2, 7.8));
      addMerged(g, rebar, M.steel);
    },
  },

  ship: {
    name: 'Cargo Ship',
    theme: { sky: '#9ec9e8', fog: [50, 160], hemi: ['#eef6ff', '#4d6070', 2.0], sun: ['#fff4e0', 2.7, [-25, 40, 20]] },
    bounds: 34,
    hills: [[0, 0, -5, 3], [0, 0, 5, 3], [-23.5, 0, 0, 2.8], [23.5, 0, 0, 2.8], [-23.5, 4.3, 0, 2.5]],
    build({ add, add2, crate2, spawn2, stairs, building }) {
      add(-34, -3, -26, 34, -2, 26, 'water'); // the sea (out of reach)
      add(-28, -1, -8, 28, 0, 8, 'deck');
      // Bulwarks, plus invisible walls so nobody goes overboard
      add(-28, 0, 7.6, 28, 1.1, 8, 'hull');
      add(-28, 0, -8, 28, 1.1, -7.6, 'hull');
      add(27.6, 0, -7.6, 28, 1.1, 7.6, 'hull');
      add(-28, 0, -7.6, -27.6, 1.1, 7.6, 'hull');
      add(-28, 1.1, 7.6, 28, 9, 8, 'invisible');
      add(-28, 1.1, -8, 28, 9, -7.6, 'invisible');
      add(27.6, 1.1, -7.6, 28, 9, 7.6, 'invisible');
      add(-28, 1.1, -7.6, -27.6, 9, 7.6, 'invisible');
      // Bridge houses at both ends, with an outside stair to the roof
      building(20, -5, 27, 5, 4,
        [{ side: 'w', at: -2, w: 1.8 }, { side: 'w', at: 2.5, w: 1.2, y0: 1.1, h: 0.9 }, { side: 's', at: 23.5, w: 1.4, y0: 1.1, h: 0.9 }],
        { mat: 'shipWhite', parapet: ['e'] });
      stairs(20.2, 5.05, 27, 6.9, 0, 4.3, '+x', 'stairs');
      // Cargo on deck
      add2(-6, 0, -7, 0, 2.6, -4.4, 'containerRed', 'containerBlue');
      add2(4, 0, 2, 10, 2.6, 4.6, 'containerGreen', 'containerOrange');
      add2(4, 2.6, 2.3, 10, 5.2, 4.3, 'containerBlue', 'containerRed');
      add2(-14, 0, 3, -8, 2.6, 5.6, 'containerOrange', 'containerGreen');
      add2(-18, 0, -3, -15, 0.7, 3, 'hatch');
      add(-0.4, 0, -0.4, 0.4, 9, 0.4, 'mast');
      crate2(-10, -5); crate2(-10, -5, 1.2); crate2(-8.8, -5);
      crate2(14, -6); crate2(-3, 6.3);
      for (const x of [-22, -6, 12]) add2(x - 0.3, 0, -7.4, x + 0.3, 0.6, -6.8, 'bollard');
      for (const [x, y, z] of [[-23.5, 0, 0], [-23.5, 4.3, 0], [-12, 0, -5.5], [-4, 0, 1.5], [6, 0, -5], [-16, 0, 6.5], [14, 0, 0]]) spawn2(x, y, z);
    },
    decor(g, M) {
      const funnel = [];
      for (const s of [-1, 1]) funnel.push(new THREE.CylinderGeometry(1.1, 1.3, 4, 16).translate(s * 23.5, 6.6, 0));
      addMerged(g, funnel, M.funnel, true);
      addMerged(g, [new THREE.CylinderGeometry(1.12, 1.12, 0.6, 16).translate(-23.5, 8.2, 0), new THREE.CylinderGeometry(1.12, 1.12, 0.6, 16).translate(23.5, 8.2, 0)], M.funnelBand);
      addMerged(g, [new THREE.BoxGeometry(0.15, 0.15, 14).translate(0, 8.7, 0), new THREE.BoxGeometry(14, 0.12, 0.12).translate(0, 6, 0)], M.steel, true);
      const boats = [];
      for (const s of [-1, 1]) boats.push(new THREE.BoxGeometry(5, 1, 1.6).translate(s * 14, 2.6, s * 8.6));
      addMerged(g, boats, M.lifeboat, true);
    },
  },

  trains: {
    name: 'Train Yard',
    theme: { sky: '#c2ccd6', fog: [45, 140], hemi: ['#f0f3f6', '#6a6258', 2.0], sun: ['#fff0d8', 2.5, [30, 38, -15]] },
    bounds: 32,
    hills: [[0, 4, 0, 1.8], [-20, 0, 0, 3], [20, 0, 0, 3], [-16, 0.5, 14.5, 2.5], [16, 0.5, -14.5, 2.5]],
    build({ add, add2, crate2, spawn2, stairs }) {
      add(-32, -1, -20, 32, 0, 20, 'gravel');
      add(-32, 0, 19.7, 32, 4, 20, 'brickDark');
      add(-32, 0, -20, 32, 4, -19.7, 'brickDark');
      add(31.7, 0, -19.7, 32, 4, 19.7, 'brickDark');
      add(-32, 0, -19.7, -31.7, 4, 19.7, 'brickDark');
      for (const z of [-9, -3, 3, 9]) for (const s of [-0.7, 0.7]) add(-31.7, 0, z + s - 0.06, 31.7, 0.12, z + s + 0.06, 'track');
      add2(-31.7, 0, 13, 31.7, 0.5, 16, 'platform');
      // Parked train cars (mirrored across the yard)
      add2(-24, 0, -10.4, -12, 3, -7.6, 'carRed', 'carBlue');
      add2(-8, 0, -10.4, 4, 3, -7.6, 'carBlue', 'carGreen');
      add2(-28, 0, -4.4, -18, 3, -1.6, 'carGreen', 'carRed');
      add2(-10, 0, -4.4, -4, 2.6, -1.6, 'carTank');
      // Footbridge over every track
      add(-2, 3.6, -14, 2, 4, 14, 'grate');
      add(-2, 4, -14, -1.85, 5, 14, 'rail');
      add(1.85, 4, -14, 2, 5, 14, 'rail');
      stairs(-2, -19, 2, -14, 0, 4, '+z', 'stairs'); // a gap from the back wall so bots can step on
      // Crates to climb onto the cars, platform luggage
      crate2(-11.4, -6.4); crate2(-11.4, -6.4, 1.2); crate2(-10.2, -6.4);
      crate2(-20, 14.5, 0.5); crate2(10, 14.5, 0.5); crate2(11.2, 14.5, 0.5);
      add2(-29, 0.5, 13.4, -27.8, 1.6, 15.6, 'bench');
      for (const [x, y, z] of [[-26, 0.5, 14.5], [-10, 0.5, 14.5], [6, 0.5, 14.5], [-20, 0, 0], [0, 4, -8], [-14, 0, -6], [-28, 0, -12]]) spawn2(x, y, z);
    },
    decor(g, M) {
      const poles = [], wires = [];
      for (let x = -28; x <= 28; x += 14) {
        for (const s of [-1, 1]) poles.push(new THREE.BoxGeometry(0.2, 7, 0.2).translate(x, 3.5, s * 12));
        poles.push(new THREE.BoxGeometry(0.15, 0.15, 24).translate(x, 7, 0));
      }
      for (const z of [-9, -3, 3, 9]) wires.push(new THREE.BoxGeometry(60, 0.03, 0.03).translate(0, 6.4, z));
      addMerged(g, poles, M.steel, true);
      addMerged(g, wires, M.steel);
      const lamps = [];
      for (const x of [-20, -6, 8, 22]) for (const s of [-1, 1]) lamps.push(new THREE.BoxGeometry(0.8, 0.2, 0.4).translate(x, 3.6, s * 14.5));
      addMerged(g, lamps, M.lamp);
    },
  },

  lake: {
    name: 'Frozen Lake',
    theme: { sky: '#b8c7da', fog: [35, 120], hemi: ['#eef4ff', '#8a9ab0', 2.0], sun: ['#fff6ea', 2.2, [-25, 32, 18]] },
    bounds: 32,
    hills: [[0, 0, 0, 4], [-10, 0, -2, 1.6], [10, 0, 2, 1.6], [-24, 2, 16, 3], [24, 2, -16, 3]],
    build({ add, add2, crate2, spawn2, stairs, building }) {
      add(-32, -1, -22, 32, 0, 22, 'ice');
      add(-32, 0, 21.7, 32, 5, 22, 'rockGray');
      add(-32, 0, -22, 32, 5, -21.7, 'rockGray');
      add(31.7, 0, -21.7, 32, 5, 21.7, 'rockGray');
      add(-32, 0, -21.7, -31.7, 5, 21.7, 'rockGray');
      // Snowy shore banks along both long sides, with ramps down to the ice
      add2(-31.7, 0, 12, 31.7, 2, 21.7, 'snow');
      stairs(-20, 8, -15, 12, 0, 2, '+z', 'snowBank');
      stairs(10, 8, 15, 12, 0, 2, '+z', 'snowBank');
      // Ice-fishing huts
      building(-12, -4, -8, 0, 2.6, [{ side: 'e', at: -2.5, w: 1.6 }, { side: 'n', at: -10, w: 1, y0: 1, h: 0.7 }], { mat: 'palisade', roofMat: 'wood' });
      building(-22, -10, -17, -5, 2.6, [{ side: 'n', at: -19.5, w: 1.4 }], { mat: 'palisade', roofMat: 'wood' });
      // Ice blocks, drifts, rocks, a frozen rowboat
      add2(-4, 0, 5, -1, 1.2, 6.2, 'iceBlock');
      add2(-26, 0, -2, -24, 1.6, 2, 'rockGray');
      add2(-16, 0, 4, -14.8, 1, 8, 'snowBank');
      add2(-6, 0, -12, -2, 0.9, -11.2, 'snowBank');
      add2(-30, 0, -16, -26, 0.8, -14.2, 'wood');
      crate2(-8, 16, 2); crate2(6, 18, 2); crate2(-28, 14, 2);
      for (const [x, y, z] of [[-26, 2, 17], [-6, 2, 16], [8, 2, 18], [-10, 0, -2], [-19.5, 0, -7.5], [-28, 0, 6], [-8, 0, 8], [0, 0, -6]]) spawn2(x, y, z);
    },
    decor(g, M) {
      const needles = [], caps = [], trunks = [];
      for (const [x, z] of [[-29, 19], [-18, 20], [-4, 20.5], [12, 19.5], [26, 20], [29, -19], [18, -20], [4, -20.5], [-12, -19.5], [-26, -20]]) {
        trunks.push(new THREE.CylinderGeometry(0.15, 0.2, 1.2, 6).translate(x, 2.6, z));
        needles.push(new THREE.ConeGeometry(1.4, 2.8, 8).translate(x, 4.4, z), new THREE.ConeGeometry(1, 2.2, 8).translate(x, 5.8, z));
        caps.push(new THREE.ConeGeometry(0.6, 1, 8).translate(x, 6.9, z));
      }
      addMerged(g, trunks, M.steel);
      addMerged(g, needles, M.pine, true);
      addMerged(g, caps, M.pineSnow, true);
      const holes = [];
      for (const [x, z] of [[-6, -2], [6, 2], [-2, -8], [2, 8], [-14, 0], [14, 0]]) holes.push(new THREE.CylinderGeometry(0.5, 0.5, 0.02, 16).translate(x, 0.011, z));
      addMerged(g, holes, M.iceHole);
    },
  },

  rooftops: {
    name: 'Rooftops',
    theme: { sky: '#141a2e', fog: [30, 95], hemi: ['#8090c8', '#2a2430', 1.7], sun: ['#c8d2ff', 1.2, [-18, 40, 14]], night: true },
    bounds: 30,
    hills: [[0, 8, 0, 3], [-22, 6, -14, 3], [22, 6, 14, 3], [-10, 0, 7, 3], [10, 0, -7, 3]],
    build({ add, add2, spawn, spawn2, stairs, crate2 }) {
      add(-30, -1, -22, 30, 0, 22, 'asphalt');
      add(-30, 0, 21, 30, 10, 22, 'brickDark');
      add(-30, 0, -22, 30, 10, -21, 'brickDark');
      add(29, 0, -21, 30, 10, 21, 'brickDark');
      add(-30, 0, -21, -29, 10, 21, 'brickDark');
      // Solid blocks with playable roofs
      add2(-28, 0, -20, -16, 6, -8, 'brick');
      add2(-12, 0, -20, -2, 7.5, -10, 'brickDark');
      add2(-28, 0, -4, -18, 5, 6, 'brick');
      add2(-28, 0, 10, -14, 6.5, 20, 'brickDark');
      add(-4, 0, -4, 4, 8, 4, 'brick');
      // Parapets and rooftop clutter (cover)
      add2(-21, 6, -8.3, -16, 6.8, -8, 'brickDark');
      add2(-12, 7.5, -10.3, -6, 8.3, -10, 'brick');
      add2(-26, 6, -18, -23, 7.4, -15, 'ac');
      add2(-9, 7.5, -18, -7, 8.7, -16, 'ac');
      add2(-25, 5, 1, -23, 6, 4, 'ac');
      add2(-22, 6.5, 12, -19, 7.5, 13, 'ac');
      add2(-2.5, 8, -2.5, -1.5, 9.2, -1.5, 'ac');
      // Plank bridges between roofs
      stairs(-24, -8, -22, -4, 5, 6, '-z', 'wood');
      stairs(-16, -16, -12, -14, 6, 7.5, '+x', 'wood');
      stairs(-3.8, -10, -2.3, -4, 7.5, 8, '+z', 'wood');
      stairs(-26, 6, -24, 10, 5, 6.5, '+z', 'wood');
      // Fire escapes up from the street
      stairs(-17.8, -4, -16, 6, 0, 5, '+z', 'wood');
      stairs(-16, -7.8, -6, -6, 0, 6, '-x', 'wood');
      // Street cover
      add2(-12, 0, 5, -9.6, 1.4, 6.4, 'containerGreen');
      add2(-6, 0, 14, -4.8, 1.2, 15.2, 'crate');
      crate2(-14, -3); crate2(-14, -1.8);
      add2(-10, 0, -4.6, -9, 1, -4, 'barrier');
      spawn(0, 8, 0);
      for (const [x, y, z] of [[-22, 6, -14], [-24, 5, -1], [-20, 6.5, 15], [-6, 7.5, -15], [-10, 0, 9], [-14, 0, 2], [-8, 0, 18]]) spawn2(x, y, z);
    },
    decor(g, M) {
      // Lit windows on the block faces, street lamps and neon signs
      const lit = [], dark = [];
      const blocks = [[-28, -20, -16, -8, 6], [-12, -20, -2, -10, 7.5], [-28, -4, -18, 6, 5], [-28, 10, -14, 20, 6.5]];
      for (const s of [1, -1]) {
        for (const [x0, z0, x1, z1, h] of blocks) {
          const X0 = s > 0 ? x0 : -x1, X1 = s > 0 ? x1 : -x0, Z0 = s > 0 ? z0 : -z1, Z1 = s > 0 ? z1 : -z0;
          for (let y = 1.6; y < h - 0.8; y += 2) {
            for (let x = X0 + 1.2; x < X1 - 0.6; x += 2) for (const z of [Z0 - 0.02, Z1 + 0.02]) (Math.random() < 0.45 ? lit : dark).push(new THREE.BoxGeometry(0.9, 1.1, 0.05).translate(x, y, z));
            for (let z = Z0 + 1.2; z < Z1 - 0.6; z += 2) for (const x of [X0 - 0.02, X1 + 0.02]) (Math.random() < 0.45 ? lit : dark).push(new THREE.BoxGeometry(0.05, 1.1, 0.9).translate(x, y, z));
          }
        }
      }
      for (let y = 1.6; y < 7.5; y += 2) for (const [x, z] of [[-4.02, 0], [4.02, 0]]) lit.push(new THREE.BoxGeometry(0.05, 1.1, 6).translate(x, y, z));
      addMerged(g, lit, M.windowLit);
      addMerged(g, dark, M.windowDark);
      addMerged(g, [new THREE.BoxGeometry(4, 0.6, 0.08).translate(-22, 4, -7.95), new THREE.BoxGeometry(4, 0.6, 0.08).translate(22, 4, 7.95)], M.neonPink);
      addMerged(g, [new THREE.BoxGeometry(0.08, 0.6, 4).translate(-17.95, 3.6, 1), new THREE.BoxGeometry(0.08, 0.6, 4).translate(17.95, 3.6, -1)], M.neonCyan);
      const lights = [['#ff3ec8', -12, 0], ['#36e0ff', 12, 0], ['#ffb347', 0, 12], ['#ffb347', 0, -12]];
      if (quality.pointLights) for (const [c, x, z] of lights) {
        const l = new THREE.PointLight(c, 22, 20, 1.6);
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
  snow: () => makeTex((g, s) => {
    g.fillStyle = '#e9eef4'; g.fillRect(0, 0, s, s);
    speckle(g, s, 5000, ['rgba(150,170,200,0.12)', 'rgba(255,255,255,0.5)', 'rgba(120,140,170,0.08)'], 3);
    stains(g, s, 6, 'rgba(170,190,215,0.18)');
  }),
  carpet: () => makeTex((g, s) => {
    g.fillStyle = '#4a566a'; g.fillRect(0, 0, s, s);
    speckle(g, s, 9000, ['rgba(255,255,255,0.05)', 'rgba(0,0,0,0.12)'], 1.5);
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2; g.strokeRect(1, 1, s - 2, s - 2);
  }),
  panel: () => makeTex((g, s) => {
    g.fillStyle = '#d9d4c7'; g.fillRect(0, 0, s, s);
    speckle(g, s, 1500, ['rgba(0,0,0,0.04)', 'rgba(255,255,255,0.08)']);
    g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, 0, 3, s); g.fillRect(0, s - 26, s, 26);
  }),
  grass: () => makeTex((g, s) => {
    g.fillStyle = '#5b7a3a'; g.fillRect(0, 0, s, s);
    speckle(g, s, 9000, ['rgba(140,180,80,0.25)', 'rgba(30,50,20,0.25)', 'rgba(120,100,60,0.15)'], 2);
    stains(g, s, 8, 'rgba(90,70,40,0.25)');
  }),
  moss: () => makeTex((g, s) => {
    g.fillStyle = '#8a8a78'; g.fillRect(0, 0, s, s);
    g.strokeStyle = 'rgba(40,40,30,0.5)'; g.lineWidth = 3;
    for (let y = 0; y < s; y += 48) {
      g.beginPath(); g.moveTo(0, y); g.lineTo(s, y); g.stroke();
      for (let x = (y / 48) % 2 ? 0 : 40; x < s; x += 80) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 48); g.stroke(); }
    }
    stains(g, s, 10, 'rgba(70,110,40,0.4)');
    speckle(g, s, 2500, ['rgba(90,140,50,0.2)', 'rgba(0,0,0,0.1)']);
  }),
  brick: (base) => makeTex((g, s) => {
    g.fillStyle = '#5a5550'; g.fillRect(0, 0, s, s);
    const bh = 16, bw = 42;
    for (let y = 0; y < s; y += bh) {
      for (let x = (y / bh) % 2 ? -bw / 2 : 0; x < s; x += bw) {
        g.fillStyle = base;
        g.globalAlpha = 0.8 + Math.random() * 0.2;
        g.fillRect(x + 1.5, y + 1.5, bw - 3, bh - 3);
      }
    }
    g.globalAlpha = 1;
    speckle(g, s, 2500, ['rgba(0,0,0,0.12)', 'rgba(255,255,255,0.05)'], 2);
    stains(g, s, 5, 'rgba(20,15,10,0.2)');
  }),
  water: () => makeTex((g, s) => {
    g.fillStyle = '#1f4a5e'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 70; i++) {
      g.strokeStyle = `rgba(180,230,255,${0.08 + Math.random() * 0.12})`; g.lineWidth = 1 + Math.random() * 2;
      const x = Math.random() * s, y = Math.random() * s, w = 10 + Math.random() * 30;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + w / 2, y - 4, x + w, y); g.stroke();
    }
  }),
  plank: () => makeTex((g, s) => {
    g.fillStyle = '#7a6045'; g.fillRect(0, 0, s, s);
    for (let x = 0; x < s; x += 32) {
      g.fillStyle = `rgba(${Math.random() > 0.5 ? '255,230,190' : '30,15,5'},${0.05 + Math.random() * 0.1})`; g.fillRect(x, 0, 32, s);
      g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(x, 0, 2, s);
    }
    speckle(g, s, 1200, ['rgba(40,20,5,0.2)', 'rgba(255,255,255,0.04)'], 2);
    stains(g, s, 4, 'rgba(30,40,40,0.25)');
  }),
  metal: () => makeTex((g, s) => {
    g.fillStyle = '#5c6268'; g.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 12) for (let x = (y / 12) % 2 ? 6 : 0; x < s; x += 12) {
      g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(x, y, 6, 2);
    }
    stains(g, s, 6, 'rgba(20,20,20,0.25)');
    g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 2; g.strokeRect(1, 1, s - 2, s - 2);
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
    snow: { map: TEX.snow(), tile: 5, roughness: 0.95 },
    snowBank: { map: TEX.snow(), tile: 2, roughness: 1, color: '#f4f8fc' },
    sandbag: { map: concrete, tile: 0.8, roughness: 1, color: '#b9a27a' },
    palisade: { map: wood, tile: 2, roughness: 0.9, color: '#8c7a66' },
    bark: { color: '#5a4030', roughness: 1 },
    tank: { color: '#7f8c5a', roughness: 0.6, metalness: 0.2 },
    carpet: { map: TEX.carpet(), tile: 3, roughness: 1 },
    officeWall: { map: TEX.panel(), tile: 3, roughness: 0.8 },
    officeExt: { map: concrete, tile: 3, roughness: 0.8, color: '#9aa3ad' },
    ceiling: { color: '#e8e8e4', roughness: 0.9 },
    desk: { map: wood, tile: 1, roughness: 0.6, color: '#c9a27a' },
    cubicle: { color: '#7d8794', roughness: 1 },
    grass: { map: TEX.grass(), tile: 4, roughness: 1 },
    moss: { map: TEX.moss(), tile: 2, roughness: 0.95 },
    mossDark: { map: TEX.moss(), tile: 2, roughness: 0.95, color: '#9a9a8a' },
    pad: { map: TEX.pad(), fit: true, roughness: 0.4, emissive: '#2dff7a', emissiveIntensity: 0.8, emissiveMap: true },
    dock: { map: TEX.plank(), tile: 3, roughness: 0.9 },
    water: { map: TEX.water(), tile: 4, roughness: 0.1, metalness: 0.4, emissive: '#0a2230', emissiveIntensity: 0.6 },
    hull: { color: '#e8ecef', roughness: 0.5 },
    cabin: { color: '#2f6fa0', roughness: 0.5 },
    bollard: { color: '#2a2d31', roughness: 0.5, metalness: 0.4 },
    brick: { map: TEX.brick('#8a4a36'), tile: 2.5, roughness: 0.95 },
    brickDark: { map: TEX.brick('#5c3b30'), tile: 2.5, roughness: 0.95 },
    sandstone: { map: TEX.stone(), tile: 2, roughness: 0.95, color: '#e8cc98' },
    sandstoneDark: { map: TEX.stone(), tile: 2, roughness: 0.95, color: '#c7a272' },
    metalFloor: { map: TEX.metal(), tile: 2, roughness: 0.6, metalness: 0.3 },
    bunkerWall: { map: concrete, tile: 3, roughness: 0.9, color: '#9ba38f' },
    ac: { map: TEX.metal(), tile: 1, roughness: 0.5, metalness: 0.4, color: '#c9ced3' },
    stationWall: { map: TEX.metal(), tile: 2, roughness: 0.4, metalness: 0.5, color: '#b8c4d8' },
    reactor: { color: '#1b2a4a', roughness: 0.3, metalness: 0.6, emissive: '#1e7bff', emissiveIntensity: 0.9 },
    console: { color: '#2a2f3a', roughness: 0.4, metalness: 0.4, emissive: '#0f5f6a', emissiveIntensity: 0.8 },
    rock: { map: TEX.stone(), tile: 3, roughness: 1, color: '#c07a4a' },
    rockStep: { map: TEX.stone(), tile: 2, roughness: 1, color: '#a8653c' },
    dirt: { map: TEX.sand(), tile: 4, roughness: 1, color: '#9c8466' },
    slab: { map: concrete, tile: 3, roughness: 0.9, color: '#c9c6bf' },
    fence: { map: TEX.metal(), tile: 1.5, roughness: 0.6, metalness: 0.3, color: '#7f8a6a' },
    pipe: { color: '#5d6a78', roughness: 0.4, metalness: 0.5 },
    sandpile: { map: TEX.sand(), tile: 2, roughness: 1, color: '#d9c28f' },
    mixer: { color: '#e07b24', roughness: 0.5, metalness: 0.3 },
    deck: { map: TEX.plank(), tile: 2.5, roughness: 0.85, color: '#c9a77a' },
    hull: { map: TEX.metal(), tile: 2, roughness: 0.5, metalness: 0.4, color: '#b33a2e' },
    shipWhite: { map: concrete, tile: 3, roughness: 0.6, color: '#eef1f4' },
    hatch: { map: TEX.metal(), tile: 1.5, roughness: 0.5, metalness: 0.4, color: '#4a6b7a' },
    mast: { color: '#d8dde2', roughness: 0.4, metalness: 0.5 },
    gravel: { map: TEX.asphalt(), tile: 3, roughness: 1, color: '#9a948a' },
    track: { color: '#6d6a66', roughness: 0.4, metalness: 0.6 },
    platform: { map: concrete, tile: 2, roughness: 0.9, color: '#d4d0c8' },
    carRed: { map: TEX.container('#7a2a22'), tile: 2.6, roughness: 0.6, metalness: 0.2 },
    carBlue: { map: TEX.container('#2a3f66'), tile: 2.6, roughness: 0.6, metalness: 0.2 },
    carGreen: { map: TEX.container('#2f5a3a'), tile: 2.6, roughness: 0.6, metalness: 0.2 },
    carTank: { color: '#2c2f33', roughness: 0.4, metalness: 0.6 },
    bench: { map: wood, tile: 1, roughness: 0.8, color: '#a0703c' },
    ice: { map: TEX.snow(), tile: 6, roughness: 0.15, metalness: 0.2, color: '#b9d4ea' },
    iceBlock: { color: '#a9d6f2', roughness: 0.1, metalness: 0.2, emissive: '#0a2a44', emissiveIntensity: 0.4 },
    rockGray: { map: TEX.stone(), tile: 2, roughness: 1, color: '#8a9098' },
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
  pine: new THREE.MeshStandardMaterial({ color: '#2f5a3a', roughness: 0.9 }),
  pineSnow: new THREE.MeshStandardMaterial({ color: '#e9f0f6', roughness: 0.9 }),
  jungle: new THREE.MeshStandardMaterial({ color: '#3f7a2a', roughness: 0.9 }),
  lightPanel: new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#fff6e0', emissiveIntensity: 1.2 }),
  glass: new THREE.MeshStandardMaterial({ color: '#9cc4e4', transparent: true, opacity: 0.35, roughness: 0.1, metalness: 0.3 }),
  banner: new THREE.MeshStandardMaterial({ color: '#a8261e', roughness: 1 }),
  windowLit: new THREE.MeshStandardMaterial({ color: '#ffe2a0', emissive: '#ffcf70', emissiveIntensity: 1.4 }),
  windowDark: new THREE.MeshStandardMaterial({ color: '#1c2232', roughness: 0.2, metalness: 0.5 }),
  cactus: new THREE.MeshStandardMaterial({ color: '#4f7a3a', roughness: 0.9 }),
  funnel: new THREE.MeshStandardMaterial({ color: '#1f2a3a', roughness: 0.6 }),
  funnelBand: new THREE.MeshStandardMaterial({ color: '#d9a21b', roughness: 0.5 }),
  lifeboat: new THREE.MeshStandardMaterial({ color: '#e8742b', roughness: 0.6 }),
  iceHole: new THREE.MeshBasicMaterial({ color: '#1b3a55' }),
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
    if (name === 'invisible') continue; // collision only (e.g. walls that stop you falling overboard)
    const def = M[name] || { color: '#ff00ff' };
    const mat = new THREE.MeshStandardMaterial({
      map: def.map || null, color: def.color || '#ffffff',
      roughness: def.roughness ?? 0.8, metalness: def.metalness ?? 0,
      emissive: def.emissive || '#000000', emissiveIntensity: def.emissiveIntensity ?? 1,
      emissiveMap: def.emissiveMap ? def.map : null,
    });
    const mesh = new THREE.Mesh(mergeGeometries(list.map((b) => boxGeo(b, def))), mat);
    mesh.castShadow = !['floor', 'asphalt', 'sand', 'neonFloor', 'water', 'metalFloor', 'dirt'].includes(name);
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  if (map.decor) map.decor(group, DECOR_MATS);

  group.add(new THREE.HemisphereLight(t.hemi[0], t.hemi[1], t.hemi[2]));
  const sun = new THREE.DirectionalLight(t.sun[0], t.sun[1]);
  sun.position.set(...t.sun[2]);
  sun.castShadow = true;
  sun.shadow.mapSize.set(quality.shadowSize, quality.shadowSize);
  const r = map.bounds * 1.35;
  Object.assign(sun.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 1, far: 140 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  group.add(sun);
  scene.add(group);
  return group;
}
