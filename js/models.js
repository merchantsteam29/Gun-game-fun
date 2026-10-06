import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { M, box, rbox, cyl, grp, anchor, modelQuality } from './modelkit.js';
import { GUNS, finishGun } from './guns.js';
import { camoOf } from './camos.js';

export { modelQuality };

const _inv = new THREE.Matrix4(), _rel = new THREE.Matrix4();
const KEEP_ATTRS = ['position', 'normal', 'uv'];

// Merges every mesh under each non-mesh node (the root and each named/animated group) into
// one mesh per material. A detailed model goes from dozens of draw calls to a handful, which
// matters a lot on phones; animated groups keep their own merged meshes so they still move.
export function mergeStatic(root) {
  root.updateMatrixWorld(true);
  const containers = [];
  root.traverse((o) => { if (!o.isMesh && !o.isSprite) containers.push(o); });
  for (const c of containers) {
    const byMat = new Map();
    const collect = (o) => {
      for (const ch of o.children) {
        if (!ch.isMesh) continue; // other containers handle their own meshes
        if (!byMat.has(ch.material)) byMat.set(ch.material, []);
        byMat.get(ch.material).push(ch);
        collect(ch); // meshes parented to meshes (e.g. grip grooves)
      }
    };
    collect(c);
    _inv.copy(c.matrixWorld).invert();
    for (const [mat, meshes] of byMat) {
      if (meshes.length < 2) continue;
      const geos = meshes.map((m) => {
        const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
        for (const k of Object.keys(g.attributes)) if (!KEEP_ATTRS.includes(k)) g.deleteAttribute(k);
        g.clearGroups();
        return g.applyMatrix4(_rel.multiplyMatrices(_inv, m.matrixWorld));
      });
      const merged = mergeGeometries(geos);
      geos.forEach((g) => g.dispose());
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = meshes.some((m) => m.castShadow);
      mesh.receiveShadow = meshes.some((m) => m.receiveShadow);
      for (const m of meshes) {
        if (m.parent) m.parent.remove(m);
        m.geometry.dispose();
      }
      c.add(mesh);
    }
  }
  return root;
}

// Weapon models: guns are in guns.js, melee weapons and throwables below, shared parts in modelkit.js.
// Barrel / blade points down -Z; origin is the right-hand grip. Named children drive animation:
// mag, bolt, pump, slide, cyl, lid, pin, spin (groups) and fore, muzzle, port (anchor points).
const builders = {
  ...GUNS,
  katana(g) {
    rbox(g, M.black, 0.035, 0.04, 0.22, 0, 0, 0.04);
    for (let i = 0; i < 6; i++) box(g, M.bone, 0.037, 0.03, 0.006, 0, 0, -0.04 + i * 0.03, 0, 0, i % 2 ? 0.5 : -0.5);
    cyl(g, M.brass, 0.022, 0.01, 0, 0, 0.155, 8);
    const tsuba = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.012, 16), M.brass);
    tsuba.rotation.x = Math.PI / 2;
    tsuba.scale.set(1, 1, 0.75);
    tsuba.position.z = -0.08;
    g.add(tsuba);
    box(g, M.brass, 0.014, 0.034, 0.03, 0, 0.004, -0.1);
    box(g, M.steel, 0.008, 0.038, 0.66, 0, 0.005, -0.44);
    box(g, M.gunmetal, 0.009, 0.006, 0.66, 0, 0.022, -0.44); // spine
    box(g, M.steel, 0.008, 0.038, 0.06, 0, 0.0, -0.785, 0.35);
    anchor(g, 'muzzle', 0, 0, -0.8);
  },
  pan(g) {
    cyl(g, M.woodDark, 0.018, 0.22, 0, 0, -0.03, 10); // handle
    cyl(g, M.steel, 0.012, 0.08, 0, 0, -0.17, 8);
    const pan = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.13, 0.04, 24), M.black);
    pan.rotation.x = Math.PI / 2;
    pan.rotation.z = Math.PI / 2;
    pan.position.set(0, 0, -0.34);
    g.add(pan);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.005, 24), M.gunmetal);
    base.rotation.x = Math.PI / 2;
    base.rotation.z = Math.PI / 2;
    base.position.set(-0.022, 0, -0.34);
    g.add(base);
    anchor(g, 'fore', 0, 0, -0.1);
    anchor(g, 'muzzle', 0, 0, -0.48);
  },
  bat(g) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.019, 0.75, 14), M.wood);
    m.rotation.x = Math.PI / 2;
    m.position.z = -0.3;
    g.add(m);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.046, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.wood);
    cap.rotation.x = -Math.PI / 2;
    cap.position.z = -0.675;
    g.add(cap);
    cyl(g, M.tape, 0.021, 0.16, 0, 0, 0.03, 10);
    cyl(g, M.black, 0.03, 0.02, 0, 0, 0.12, 10);
    for (let i = 0; i < 3; i++) box(g, M.red, 0.002, 0.04, 0.012, 0.042, 0, -0.48 - i * 0.04); // decal stripes
    anchor(g, 'fore', 0, 0, -0.1);
    anchor(g, 'muzzle', 0, 0, -0.65);
  },
  flash(g) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.14, 14), M.steel);
    g.add(c);
    for (const y of [-0.04, 0.04]) {
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.015, 14), M.dark);
      band.position.y = y;
      g.add(band);
    }
    for (let i = 0; i < 4; i++) box(g, M.black, 0.012, 0.03, 0.012, Math.cos(i * 1.57) * 0.038, 0.0, Math.sin(i * 1.57) * 0.038);
    box(g, M.mid, 0.015, 0.1, 0.015, 0.04, 0.02, 0);
    const pin = grp(g, 'pin', -0.03, 0.085, 0);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.004, 6, 12), M.steel);
    ring.rotation.y = Math.PI / 2;
    pin.add(ring);
    anchor(g, 'muzzle', 0, 0, 0);
  },
  tknife(g) {
    rbox(g, M.black, 0.022, 0.028, 0.08, 0, 0, 0.02);
    cyl(g, M.steel, 0.008, 0.004, 0, 0, 0.062, 8);
    box(g, M.steel, 0.005, 0.03, 0.13, 0, 0, -0.09);
    box(g, M.steel, 0.005, 0.021, 0.021, 0, 0.0, -0.155, Math.PI / 4);
    anchor(g, 'muzzle', 0, 0, -0.18);
  },
  knife(g) {
    rbox(g, M.poly, 0.034, 0.036, 0.13, 0, 0, 0.02);
    for (let i = 0; i < 4; i++) box(g, M.black, 0.036, 0.038, 0.005, 0, 0, -0.02 + i * 0.025);
    box(g, M.gunmetal, 0.07, 0.016, 0.018, 0, 0, -0.05);
    cyl(g, M.gunmetal, 0.018, 0.012, 0, 0, 0.09, 8);
    box(g, M.steel, 0.007, 0.034, 0.18, 0, 0.004, -0.15);
    box(g, M.gunmetal, 0.008, 0.008, 0.12, 0, 0.022, -0.12); // spine
    for (let i = 0; i < 4; i++) box(g, M.gunmetal, 0.008, 0.006, 0.006, 0, 0.027, -0.08 - i * 0.018, 0.7);
    box(g, M.steel, 0.007, 0.025, 0.04, 0, 0.0, -0.245, 0.45);
    anchor(g, 'muzzle', 0, 0, -0.26);
  },
  claws(g) {
    rbox(g, M.zombie, 0.08, 0.08, 0.1, 0, 0, 0);
    for (let i = -1; i <= 1; i++) {
      box(g, M.zombie, 0.02, 0.02, 0.05, i * 0.025, 0.02, -0.07, 0.15, i * 0.12, 0);
      box(g, M.bone, 0.008, 0.018, 0.16, i * 0.025, 0.025, -0.16, 0.2, i * 0.12, 0);
    }
    anchor(g, 'muzzle', 0, 0, -0.24);
  },
  axe(g) {
    rbox(g, M.wood, 0.035, 0.042, 0.7, 0, 0, -0.24);
    cyl(g, M.tape, 0.024, 0.16, 0, 0, 0.02, 8);
    box(g, M.red, 0.046, 0.15, 0.1, 0, 0.065, -0.56);
    box(g, M.steel, 0.012, 0.19, 0.05, 0, 0.075, -0.62);
    box(g, M.steel, 0.006, 0.2, 0.012, 0, 0.075, -0.65); // edge
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.1, 6), M.red);
    spike.position.set(0, -0.07, -0.56);
    spike.rotation.x = Math.PI;
    g.add(spike);
    anchor(g, 'fore', 0, 0, -0.22);
    anchor(g, 'muzzle', 0, 0.08, -0.6);
  },
  frag(g) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.055, 14, 12), M.olive);
    s.scale.y = 1.2;
    g.add(s);
    for (let i = 0; i < 3; i++) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.054 - Math.abs(i - 1) * 0.012, 0.0035, 4, 16), M.olive);
      band.rotation.x = Math.PI / 2;
      band.position.y = (i - 1) * 0.035;
      g.add(band);
    }
    cyl(g, M.mid, 0.016, 0.03, 0, 0.07, 0, 10).rotation.x = 0;
    box(g, M.mid, 0.015, 0.09, 0.015, 0.03, 0.03, 0, 0, 0, -0.12);
    const pin = grp(g, 'pin', -0.02, 0.08, 0);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.004, 6, 12), M.steel);
    ring.rotation.y = Math.PI / 2;
    pin.add(ring);
    anchor(g, 'muzzle', 0, 0, 0);
  },
  sticky(g) {
    cyl(g, M.dark, 0.045, 0.12, 0, 0, 0, 14).rotation.x = 0;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.047, 0.047, 0.02, 14), M.orange);
    band.position.y = 0.035;
    g.add(band);
    const blob = new THREE.Mesh(new THREE.SphereGeometry(0.052, 12, 8), M.olive);
    blob.position.y = -0.06;
    blob.scale.y = 0.5;
    g.add(blob);
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), M.led);
    led.position.y = 0.065;
    g.add(led);
    const pin = grp(g, 'pin', -0.03, 0.06, 0);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.004, 6, 12), M.steel);
    ring.rotation.y = Math.PI / 2;
    pin.add(ring);
    anchor(g, 'muzzle', 0, 0, 0);
  },
  smoke(g) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.15, 14), M.gray);
    g.add(c);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.047, 0.047, 0.03, 14), M.dark);
    band.position.y = 0.03;
    g.add(band);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.015, 14), M.mid);
    top.position.y = 0.082;
    g.add(top);
    for (let i = 0; i < 4; i++) box(g, M.black, 0.01, 0.01, 0.01, Math.cos(i * 1.57) * 0.025, 0.09, Math.sin(i * 1.57) * 0.025);
    box(g, M.mid, 0.015, 0.1, 0.015, 0.045, 0.02, 0);
    const pin = grp(g, 'pin', -0.03, 0.09, 0);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.004, 6, 12), M.steel);
    ring.rotation.y = Math.PI / 2;
    pin.add(ring);
    anchor(g, 'muzzle', 0, 0, 0);
  },
  sledge(g) {
    rbox(g, M.wood, 0.034, 0.04, 0.75, 0, 0, -0.26);
    cyl(g, M.tape, 0.023, 0.18, 0, 0, 0.02, 8);
    rbox(g, M.gunmetal, 0.09, 0.09, 0.2, 0, 0.0, -0.64, 0, Math.PI / 2, 0);
    for (const s of [-1, 1]) box(g, M.steel, 0.095, 0.095, 0.012, s * 0.1, 0.0, -0.64, 0, Math.PI / 2, 0);
    anchor(g, 'fore', 0, 0, -0.25);
    anchor(g, 'muzzle', 0, 0, -0.64);
  },
  vortex(g) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.05, 14, 12), M.dark);
    g.add(s);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.008, 6, 20), M.purple);
    ring.rotation.x = Math.PI / 2;
    g.add(ring);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), M.purple);
    core.position.y = 0.05;
    g.add(core);
    box(g, M.mid, 0.015, 0.09, 0.015, 0.035, 0.02, 0);
    const pin = grp(g, 'pin', -0.025, 0.075, 0);
    const pr = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.004, 6, 12), M.steel);
    pr.rotation.y = Math.PI / 2;
    pin.add(pr);
    anchor(g, 'muzzle', 0, 0, 0);
  },
};

// mods: the gun's attachments (see mods.js); guns get their defaults if left out.
export function buildGun(id, mods = null) {
  const g = new THREE.Group();
  const key = builders[id] ? id : 'ar';
  const spec = builders[key](g);
  if (spec) finishGun(g, key, spec, mods);
  if (mods && mods.camo) applyCamo(g, mods.camo);
  g.traverse((o) => { if (o.isMesh) o.castShadow = o.material !== M.glass; });
  mergeStatic(g);
  const parts = {};
  g.traverse((o) => { if (o.name) parts[o.name] = o; });
  for (const p of Object.values(parts)) p.userData.base = p.position.clone();
  g.userData.parts = parts;
  return g;
}

// Projectiles point down -Z (userData.aligned = should face its velocity).
export function buildProjectile(kind) {
  const g = new THREE.Group();
  g.userData.aligned = true;
  if (kind === 'gl') {
    cyl(g, M.tan, 0.05, 0.12, 0, 0, 0.02, 12);
    cyl(g, M.brass, 0.052, 0.04, 0, 0, 0.08, 12);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.olive);
    nose.rotation.x = -Math.PI / 2;
    nose.position.z = -0.04;
    g.add(nose);
  } else if (kind === 'nailgun') {
    cyl(g, M.steel, 0.004, 0.07, 0, 0, 0, 6);
    cyl(g, M.steel, 0.009, 0.004, 0, 0, 0.035, 8);
  } else if (kind === 'rocket') {
    cyl(g, M.olive, 0.05, 0.4, 0, 0, 0, 12);
    cyl(g, M.tape, 0.052, 0.03, 0, 0, -0.1, 12);
    const war = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 12), M.olive);
    war.rotation.x = -Math.PI / 2;
    war.position.z = -0.27;
    g.add(war);
    box(g, M.dark, 0.18, 0.01, 0.08, 0, 0, 0.17);
    box(g, M.dark, 0.01, 0.18, 0.08, 0, 0, 0.17);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.25, 8),
      new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending }));
    flame.rotation.x = -Math.PI / 2;
    flame.position.z = 0.33;
    g.add(flame);
  } else {
    const gun = buildGun(kind);
    gun.scale.setScalar(1.3);
    g.add(gun);
    g.userData.aligned = kind === 'tknife';
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// ---------- Camos (looks only, see camos.js) ----------
// The gun's main body materials get the camo; black accents, metal, lenses and sights don't.
const CAMO_BODY = () => [M.dark, M.mid, M.poly, M.gunmetal, M.olive, M.tan, M.fde, M.wood, M.woodDark];
const camoTex = new Map(), camoMats = new Map();

function camoTexture(c) {
  if (camoTex.has(c.id)) return camoTex.get(c.id);
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  const col = c.colors;
  g.fillStyle = col[0];
  g.fillRect(0, 0, 64, 64);
  let seed = c.id.length * 97;
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  if (c.pattern === 'digital') {
    for (let i = 0; i < 90; i++) {
      g.fillStyle = col[1 + ((rnd() * (col.length - 1)) | 0)];
      const x = (rnd() * 16 | 0) * 4, y = (rnd() * 16 | 0) * 4;
      g.fillRect(x, y, 4 * (1 + (rnd() * 3 | 0)), 4 * (1 + (rnd() * 2 | 0)));
    }
  } else if (c.pattern === 'stripes') {
    g.fillStyle = col[1];
    for (let i = -64; i < 128; i += 14) {
      g.beginPath();
      g.moveTo(i, 0); g.lineTo(i + 6 + rnd() * 4, 0); g.lineTo(i + 30, 64); g.lineTo(i + 24, 64);
      g.fill();
    }
  } else {
    for (let i = 0; i < 26; i++) {
      g.fillStyle = col[1 + ((rnd() * (col.length - 1)) | 0)];
      g.beginPath();
      g.ellipse(rnd() * 64, rnd() * 64, 4 + rnd() * 9, 3 + rnd() * 6, rnd() * 3, 0, Math.PI * 2);
      g.fill();
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.NearestFilter;
  camoTex.set(c.id, tex);
  return tex;
}

function camoMaterial(c, base) {
  const key = c.id + ':' + base.uuid;
  if (!camoMats.has(key)) {
    camoMats.set(key, new THREE.MeshStandardMaterial({
      color: c.pattern ? '#ffffff' : c.color,
      map: c.pattern ? camoTexture(c) : null,
      roughness: c.rough ?? base.roughness,
      metalness: c.metal ?? base.metalness,
      emissive: c.glow || '#000000',
    }));
  }
  return camoMats.get(key);
}

export function applyCamo(g, id) {
  const c = camoOf(id);
  if (c.id === 'default') return;
  const body = new Set(CAMO_BODY());
  g.traverse((o) => { if (o.isMesh && body.has(o.material)) o.material = camoMaterial(c, o.material); });
}
