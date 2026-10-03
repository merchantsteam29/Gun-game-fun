import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Collision boxes: axis-aligned, {x0,y0,z0,x1,y1,z1,mat}. Interior is x -30..30, z -20..20.
export const boxes = [];
export const spawns = [];

function add(x0, y0, z0, x1, y1, z1, mat) {
  boxes.push({
    x0: Math.min(x0, x1), y0: Math.min(y0, y1), z0: Math.min(z0, z1),
    x1: Math.max(x0, x1), y1: Math.max(y0, y1), z1: Math.max(z0, z1), mat,
  });
}
// Adds a box plus its 180° rotated twin so the map is fair from both sides.
function add2(x0, y0, z0, x1, y1, z1, mat, mat2 = mat) {
  add(x0, y0, z0, x1, y1, z1, mat);
  add(-x1, y0, -z1, -x0, y1, -z0, mat2);
}
function crate2(cx, cz, y = 0, s = 1.2) {
  add2(cx - s / 2, y, cz - s / 2, cx + s / 2, y + s, cz + s / 2, 'crate');
}

// --- Shell ---
add(-31, -1, -21, 31, 0, 21, 'floor');
add(-31, 0, 20, 31, 10, 21, 'wall');
add(-31, 0, -21, 31, 10, -20, 'wall');
add(30, 0, -20, 31, 10, 20, 'wall');
add(-31, 0, -20, -30, 10, 20, 'wall');

// --- Mezzanines (north, mirrored south) ---
add2(-30, 3.6, 13, 10, 4, 20, 'grate');
for (const x of [-24, -12, 0, 7]) add2(x - 0.3, 0, 13.2, x + 0.3, 3.6, 13.8, 'pillar');
add2(-30, 4, 13, 10, 5, 13.15, 'rail');
add2(9.85, 4, 13, 10, 5, 14, 'rail');
add2(9.85, 4, 17, 10, 5, 20, 'rail');
for (let i = 0; i < 7; i++) add2(10 + i, 0, 14, 11 + i, 3.5 - 0.5 * i, 17, 'stairs');

// --- Containers ---
add2(-7, 0, 1, -1, 2.5, 3.5, 'containerRed', 'containerBlue');
add2(-22, 0, -8.5, -16, 2.5, -6, 'containerBlue', 'containerRed');
add2(-10.5, 0, 3, -8, 2.5, 9, 'containerGreen');

// --- Crates (some placed as steps onto containers) ---
add(-0.6, 0, -0.6, 0.6, 1.2, 0.6, 'crate');
crate2(-17, -5.3);
crate2(-25, 5); crate2(-25, 6.2); crate2(-25, 5, 1.2);
crate2(-4, 9); crate2(-4, 9, 1.2); crate2(-2.8, 9);
crate2(-20, 17); crate2(-6, 18); crate2(-6, 16.8);
crate2(-24, -17);
crate2(-11.5, 0);
crate2(4, 4);
crate2(-9.25, 2.3); // step to the green container

// --- Low concrete barriers ---
add2(-15, 0, 9, -12, 1, 9.6, 'barrier');
add2(-27, 0, -3, -26.4, 1, 0, 'barrier');
add2(-4, 0, -12, -1, 1, -11.4, 'barrier');

// --- Structural pillars ---
add2(-20.5, 0, -12.5, -19.5, 10, -11.5, 'pillar');
add2(13.5, 0, -2.5, 14.5, 10, -1.5, 'pillar');

// --- Spawn points (feet position); each mirrored ---
for (const [x, y, z] of [
  [-26, 0, -16], [-26, 0, 10], [-14, 0, -10], [0, 0, -7],
  [-22, 4, 17], [-3, 4, 16.5], [-27, 0, 2], [12, 0, 4],
]) {
  for (const s of [1, -1]) {
    const px = x * s, pz = z * s;
    spawns.push({ x: px, y, z: pz, yaw: Math.atan2(px, pz) });
  }
}

// ---------- Rendering ----------

function makeTex(draw, size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  draw(g, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
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

const tex = {
  concrete: () => makeTex((g, s) => {
    g.fillStyle = '#77756f'; g.fillRect(0, 0, s, s);
    speckle(g, s, 4000, ['rgba(0,0,0,0.08)', 'rgba(255,255,255,0.06)', 'rgba(60,55,50,0.12)']);
    stains(g, s, 6, 'rgba(30,28,25,0.18)');
    g.strokeStyle = 'rgba(20,20,20,0.45)'; g.lineWidth = 2;
    g.strokeRect(1, 1, s - 2, s - 2);
    g.beginPath(); g.moveTo(s / 2, 0); g.lineTo(s / 2, s); g.moveTo(0, s / 2); g.lineTo(s, s / 2); g.stroke();
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
};

const MATS = {
  floor: { map: tex.concrete(), tile: 4, roughness: 0.92 },
  wall: { map: tex.wall(), tile: 3, roughness: 0.75, metalness: 0.1 },
  crate: { map: tex.crate(), fit: true, roughness: 0.85 },
  containerRed: { map: tex.container('#8c2f25'), tile: 2.5, roughness: 0.6, metalness: 0.1 },
  containerBlue: { map: tex.container('#2b4f7a'), tile: 2.5, roughness: 0.6, metalness: 0.1 },
  containerGreen: { map: tex.container('#3f6a37'), tile: 2.5, roughness: 0.6, metalness: 0.1 },
  grate: { map: tex.grate(), tile: 1, roughness: 0.6, metalness: 0.2 },
  stairs: { map: tex.grate(), tile: 1, roughness: 0.6, metalness: 0.2, color: '#c8c8c8' },
  pillar: { map: tex.concrete(), tile: 2, roughness: 0.9, color: '#b8b5ad' },
  barrier: { map: tex.concrete(), tile: 1.5, roughness: 0.9, color: '#d6d2c8' },
  rail: { color: '#d9a21b', roughness: 0.5, metalness: 0.3 },
};

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

export function buildMap(scene) {
  scene.background = new THREE.Color('#9fb2c6');
  scene.fog = new THREE.Fog('#9fb2c6', 45, 120);

  const groups = {};
  for (const b of boxes) (groups[b.mat] ||= []).push(b);
  for (const [name, list] of Object.entries(groups)) {
    const def = MATS[name];
    const mat = new THREE.MeshStandardMaterial({
      map: def.map || null, color: def.color || '#ffffff',
      roughness: def.roughness ?? 0.8, metalness: def.metalness ?? 0,
    });
    const mesh = new THREE.Mesh(mergeGeometries(list.map((b) => boxGeo(b, def))), mat);
    mesh.castShadow = name !== 'floor';
    mesh.receiveShadow = true;
    scene.add(mesh);
  }

  // Decorative roof trusses + hanging lamps (no collision).
  const steel = new THREE.MeshStandardMaterial({ color: '#4a5058', roughness: 0.6, metalness: 0.2 });
  const lampMat = new THREE.MeshStandardMaterial({ color: '#222', emissive: '#ffe6b0', emissiveIntensity: 2 });
  const trussGeo = [];
  const lampGeo = [];
  for (let x = -24; x <= 24; x += 8) {
    trussGeo.push(new THREE.BoxGeometry(0.4, 0.6, 41).translate(x, 9.7, 0));
    for (const z of [-8, 8]) {
      trussGeo.push(new THREE.BoxGeometry(0.05, 2.2, 0.05).translate(x, 8.3, z));
      lampGeo.push(new THREE.CylinderGeometry(0.35, 0.5, 0.25, 12).translate(x, 7.1, z));
    }
  }
  for (const z of [-12, 0, 12]) trussGeo.push(new THREE.BoxGeometry(61, 0.4, 0.3).translate(0, 9.9, z));
  const trusses = new THREE.Mesh(mergeGeometries(trussGeo), steel);
  trusses.castShadow = true;
  scene.add(trusses);
  scene.add(new THREE.Mesh(mergeGeometries(lampGeo), lampMat));

  // Lighting
  scene.add(new THREE.HemisphereLight('#e4edf7', '#6a5d50', 2.0));
  const sun = new THREE.DirectionalLight('#fff1da', 2.4);
  sun.position.set(22, 40, 14);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -38, right: 38, top: 30, bottom: -30, near: 5, far: 90 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);
}
