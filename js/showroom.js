import * as THREE from 'three';
import { RemotePlayer } from './remote.js';
import { WEAPONS, SLOT_NAMES } from './weapons.js';
import { getCos } from './missions.js';
import { bannerHtml } from './banners.js';
import { opts, setOpt } from './settings.js';
import { esc } from './util.js';

// Secret PC-only Showroom: a full-screen 3D viewer of your character, cosmetics and guns with
// mouse orbit / pan / zoom, poses, backdrops and photo export, plus a few PC-only video settings.
// Opened with the Konami code (↑ ↑ ↓ ↓ ← → ← → B A) on the menus. Phones, tablets and
// controllers never see it.

const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];

const BACKDROPS = {
  studio: { name: 'Studio', top: '#3a4250', bottom: '#14181e', floor: '#2a3038', grid: true },
  night: { name: 'Night', top: '#0b1530', bottom: '#020409', floor: '#10151f', grid: true },
  sunset: { name: 'Sunset', top: '#ff8a4a', bottom: '#3a1446', floor: '#3a2430', grid: false },
  neon: { name: 'Neon', top: '#2a0a4a', bottom: '#05010c', floor: '#120620', grid: true, neon: true },
  snow: { name: 'Snow', top: '#e8f0f8', bottom: '#9fb2c6', floor: '#dfe7ef', grid: false },
  green: { name: 'Green screen', top: '#00b140', bottom: '#00b140', floor: '#00b140', grid: false, flat: true },
};

const POSES = [
  ['idle', 'Idle'], ['walk', 'Walk'], ['sprint', 'Sprint'], ['crouch', 'Crouch'], ['reload', 'Reload'], ['jump', 'Jump'],
];
const ACTIONS = [['fire', 'Fire'], ['swing', 'Melee swing'], ['throw', 'Throw'], ['headshot', 'Headshot!']];

const $ = (id) => document.getElementById(id);

function gradientTex(top, bottom) {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, top); grd.addColorStop(1, bottom);
  g.fillStyle = grd; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Showroom {
  constructor({ game, mobile, getColor, getName, getLoadout, getMods }) {
    this.game = game;
    this.mobile = mobile;
    this.getColor = getColor;
    this.getName = getName;
    this.getLoadout = getLoadout;
    this.getMods = getMods;
    this.state = { pose: 'idle', bg: opts.srBg || 'studio', spin: true, grid: true, tag: false, pitch: 0, weapon: null, tab: 'view' };
    this.cam = { theta: Math.PI * 0.85, phi: 1.36, dist: 5.2, pan: new THREE.Vector3() };
    if (mobile) return;
    let k = 0;
    // Capture phase on window: runs before the game's and menus' key handlers.
    window.addEventListener('keydown', (e) => {
      const typing = e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName);
      if (this.open) {
        this.key(e, typing);
        if (!typing || e.key === 'Escape') e.stopPropagation(); // nothing leaks into the game underneath
        return;
      }
      if (typing) return;
      if (game.locked) { k = 0; return; }
      k = e.code === KONAMI[k] ? k + 1 : e.code === KONAMI[0] ? 1 : 0;
      if (k === KONAMI.length) { k = 0; e.preventDefault(); this.show(); }
    }, true);
  }

  // ---------- Setup ----------

  build() {
    const el = document.createElement('div');
    el.id = 'showroom';
    el.className = 'hidden';
    el.innerHTML = `
      <canvas id="sr-canvas"></canvas>
      <div class="sr-ui">
        <div class="sr-top">
          <div class="sr-title"><small>🔒 SECRET · PC ONLY</small><b>SHOWROOM</b></div>
          <div class="sr-top-btns"><button id="sr-photo" title="Save a PNG (P)">📷 Photo</button><button id="sr-close" class="primary">✕ Close <kbd>Esc</kbd></button></div>
        </div>
        <div class="sr-panel">
          <div class="sr-tabs"><button data-tab="view">Model</button><button data-tab="scene">Scene</button><button data-tab="pc">PC settings</button></div>
          <div class="sr-body"></div>
        </div>
        <div class="sr-banner"></div>
        <div class="sr-help">Left-drag rotate · Right-drag pan · Scroll zoom · Double-click reset · <kbd>Space</kbd> spin · <kbd>1</kbd>–<kbd>4</kbd> weapons · <kbd>H</kbd> hide UI · <kbd>P</kbd> photo</div>
      </div>`;
    document.body.appendChild(el);
    this.el = el;
    const canvas = $('sr-canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;

    const scene = this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.05, 200);
    this.hemi = new THREE.HemisphereLight('#e8f0ff', '#3a3430', 1.6);
    const key = this.keyLight = new THREE.DirectionalLight('#fff4e0', 2.6);
    key.position.set(-3, 6, -4);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 0.5, far: 20 });
    key.shadow.bias = -0.0004;
    const rim = this.rim = new THREE.DirectionalLight('#9fd0ff', 1.6);
    rim.position.set(3, 3, 5);
    scene.add(this.hemi, key, key.target, rim);

    this.floor = new THREE.Mesh(new THREE.CircleGeometry(60, 64), new THREE.MeshStandardMaterial({ color: '#2a3038', roughness: 0.9 }));
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.receiveShadow = true;
    this.grid = new THREE.GridHelper(120, 120, '#ffffff', '#ffffff');
    this.grid.material.transparent = true;
    this.grid.material.opacity = 0.08;
    this.grid.position.y = 0.002;
    // A soft glowing ring under the player.
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.82, 64), new THREE.MeshBasicMaterial({ color: '#ffb020', transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.004;
    scene.add(this.floor, this.grid, this.ring);

    this.bindUi();
    this.bindMouse(canvas);
    window.addEventListener('resize', () => this.open && this.resize());
  }

  // (Re)builds the avatar with your current color, cosmetics and attachments.
  makePlayer() {
    if (this.player) this.player.dispose();
    const r = new RemotePlayer(this.scene, 'showroom', this.getName(), this.getColor(), getCos(), this.getMods());
    r.hasState = true;
    r.alive = true;
    r.pos.set(0, 0, 0); r.tpos.set(0, 0, 0); r.prev.set(0, 0, 0);
    r.root.visible = r.limbs.visible = true;
    for (const g of [r.root, r.limbs]) g.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
    this.player = r;
    this.showTag();
    const lo = this.getLoadout();
    r.setWeapon(this.state.weapon && WEAPONS[this.state.weapon] ? this.state.weapon : lo[0]);
    r.swapT = 0;
  }

  // ---------- Open / close ----------

  show() {
    if (this.mobile || this.open) return;
    if (!this.el) this.build();
    if (document.pointerLockElement) document.exitPointerLock();
    this.open = true;
    this.el.classList.remove('hidden');
    this.makePlayer();
    this.applyBackdrop();
    this.renderPanel();
    this.renderBanner();
    this.resize();
    this.last = performance.now();
    const loop = () => {
      if (!this.open) return;
      this.frame();
      this.raf = requestAnimationFrame(loop);
    };
    loop();
  }

  hide() {
    this.open = false;
    cancelAnimationFrame(this.raf);
    this.el.classList.add('hidden');
    this.el.classList.remove('bare');
    if (this.player) { this.player.dispose(); this.player = null; }
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setPixelRatio(Math.min(2, devicePixelRatio) * (opts.renderScale || 1));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  key(e, typing) {
    if (e.key === 'Escape') { e.preventDefault(); this.hide(); return; }
    if (typing) return;
    if (e.code === 'KeyH') this.el.classList.toggle('bare');
    else if (e.code === 'KeyP') this.photo();
    else if (e.code === 'Space') { e.preventDefault(); this.state.spin = !this.state.spin; this.renderPanel(); }
    else if (/^Digit[1-4]$/.test(e.code)) {
      const id = this.getLoadout()[+e.code.slice(5) - 1];
      if (id) { this.setWeapon(id); this.renderPanel(); }
    }
  }

  // ---------- Panel ----------

  bindUi() {
    $('sr-close').onclick = () => this.hide();
    $('sr-photo').onclick = () => this.photo();
    this.el.querySelectorAll('.sr-tabs [data-tab]').forEach((b) => {
      b.onclick = () => { this.state.tab = b.dataset.tab; this.renderPanel(); };
    });
  }

  renderPanel() {
    const s = this.state, body = this.el.querySelector('.sr-body');
    this.el.querySelectorAll('.sr-tabs [data-tab]').forEach((b) => b.classList.toggle('sel', b.dataset.tab === s.tab));
    const chip = (attr, id, label, on) => `<button data-${attr}="${id}" class="${on ? 'sel' : ''}">${label}</button>`;
    if (s.tab === 'view') {
      const lo = this.getLoadout(), cur = this.player ? this.player.weapon : lo[0];
      const all = Object.keys(WEAPONS).sort((a, b) => WEAPONS[a].name.localeCompare(WEAPONS[b].name));
      body.innerHTML = `
        <div class="sr-label">Your loadout</div>
        <div class="sr-chips">${lo.map((id, i) => chip('w', id, `<small>${i + 1}</small>${esc(WEAPONS[id].name)}`, id === cur)).join('')}</div>
        <div class="sr-label">Any weapon <small>(with your attachments for it)</small></div>
        <select id="sr-any">${all.map((id) => `<option value="${id}" ${id === cur ? 'selected' : ''}>${esc(WEAPONS[id].name)}</option>`).join('')}</select>
        <div class="sr-label">Pose</div>
        <div class="sr-chips">${POSES.map(([id, n]) => chip('pose', id, n, s.pose === id)).join('')}</div>
        <div class="sr-label">Action</div>
        <div class="sr-chips">${ACTIONS.map(([id, n]) => chip('act', id, n, false)).join('')}</div>
        <div class="sr-label">Look up / down</div>
        <input type="range" id="sr-pitch" min="-0.9" max="0.9" step="0.01" value="${s.pitch}">`;
      body.querySelectorAll('[data-w]').forEach((b) => { b.onclick = () => { this.setWeapon(b.dataset.w); this.renderPanel(); }; });
      $('sr-any').onchange = (e) => { this.setWeapon(e.target.value); this.renderPanel(); };
      body.querySelectorAll('[data-pose]').forEach((b) => { b.onclick = () => { this.setPose(b.dataset.pose); this.renderPanel(); }; });
      body.querySelectorAll('[data-act]').forEach((b) => { b.onclick = () => this.action(b.dataset.act); });
      $('sr-pitch').oninput = (e) => { s.pitch = +e.target.value; };
    } else if (s.tab === 'scene') {
      body.innerHTML = `
        <div class="sr-label">Backdrop</div>
        <div class="sr-chips">${Object.entries(BACKDROPS).map(([id, b]) => chip('bg', id, `<i style="background:linear-gradient(${b.top},${b.bottom})"></i>${b.name}`, s.bg === id)).join('')}</div>
        <div class="sr-label">Light angle</div>
        <input type="range" id="sr-light" min="0" max="6.28" step="0.01" value="${s.light ?? 3.8}">
        <div class="sr-label">Show</div>
        <div class="sr-chips">
          ${chip('tog', 'spin', '⟳ Auto-spin', s.spin)}${chip('tog', 'grid', '▦ Floor grid', s.grid)}${chip('tog', 'tag', '🏷 Name tag', s.tag)}
        </div>
        <button id="sr-reset" class="sr-wide">Reset camera</button>`;
      body.querySelectorAll('[data-bg]').forEach((b) => {
        b.onclick = () => { s.bg = b.dataset.bg; setOpt('srBg', s.bg); this.applyBackdrop(); this.renderPanel(); };
      });
      $('sr-light').oninput = (e) => { s.light = +e.target.value; };
      body.querySelectorAll('[data-tog]').forEach((b) => {
        b.onclick = () => { const k = b.dataset.tog; s[k] = !s[k]; this.applyBackdrop(); this.renderPanel(); };
      });
      $('sr-reset').onclick = () => this.resetCam();
    } else {
      const pct = (v) => Math.round(v * 100) + '%';
      body.innerHTML = `
        <p class="sr-note">Extra options only computers get. They apply to the game too.</p>
        <div class="sr-label">Render scale <b id="sr-rs-v">${pct(opts.renderScale || 1)}</b><small>Above 100% supersamples for sharper edges; below runs faster</small></div>
        <input type="range" id="sr-rs" min="0.5" max="2" step="0.05" value="${opts.renderScale || 1}">
        <div class="sr-label">Field of view (unlocked) <b id="sr-fov-v">${opts.fov}°</b><small>Normal settings stop at 110°</small></div>
        <input type="range" id="sr-fov" min="60" max="130" step="1" value="${opts.fov}">
        <div class="sr-chips sr-col">
          ${chip('opt', 'ultraShadows', '☀ Ultra shadows <small>(4K shadow maps, from the next map)</small>', opts.ultraShadows)}
          ${chip('opt', 'rgbCross', '🌈 Rainbow crosshair', opts.rgbCross)}
          ${chip('opt', 'showFps', '⏱ FPS counter', opts.showFps)}
        </div>`;
      $('sr-rs').oninput = (e) => {
        setOpt('renderScale', +e.target.value);
        $('sr-rs-v').textContent = pct(+e.target.value);
        this.game.applyGfx();
        this.resize();
      };
      $('sr-fov').oninput = (e) => { setOpt('fov', +e.target.value); $('sr-fov-v').textContent = e.target.value + '°'; };
      body.querySelectorAll('[data-opt]').forEach((b) => {
        b.onclick = () => { setOpt(b.dataset.opt, !opts[b.dataset.opt]); this.renderPanel(); };
      });
    }
  }

  renderBanner() {
    const cos = getCos();
    const lo = this.getLoadout();
    this.el.querySelector('.sr-banner').innerHTML = bannerHtml(cos.banner, this.getName(), this.getColor(), 'YOUR BANNER',
      lo.map((id, i) => `<span class="chip" title="${SLOT_NAMES[i]}">${esc(WEAPONS[id].name)}</span>`).slice(0, 2).join(''));
  }

  // ---------- Model control ----------

  setWeapon(id) {
    if (!this.player || !WEAPONS[id]) return;
    this.state.weapon = id;
    this.player.setWeapon(id);
  }

  setPose(p) {
    const r = this.player;
    this.state.pose = p;
    r.tcrouch = p === 'crouch' ? 1 : 0;
    r.flags = (p === 'sprint' ? 2 : 0) | (p === 'reload' ? 1 : 0) | (p === 'jump' ? 4 : 0);
    if (p !== 'walk' && p !== 'sprint') { r.tpos.set(0, 0, 0); }
  }

  action(a) {
    const r = this.player;
    if (!r) return;
    if (a === 'fire') r.fire();
    else if (a === 'swing') r.melee(Math.random() < 0.5 ? 'slash' : 'chop');
    else if (a === 'throw') r.throwAnim();
    else if (a === 'headshot') {
      r.die(null, true); // knocks the hat off too
      clearTimeout(this.reviveT);
      this.reviveT = setTimeout(() => {
        if (!this.player) return;
        r.deathT = 0;
        r.root.quaternion.identity();
        r.restoreHat();
      }, 2600);
    }
  }

  applyBackdrop() {
    const b = BACKDROPS[this.state.bg] || BACKDROPS.studio;
    if (this.bgTex) this.bgTex.dispose();
    this.bgTex = gradientTex(b.top, b.bottom);
    this.scene.background = b.flat ? new THREE.Color(b.top) : this.bgTex;
    this.floor.material.color.set(b.floor);
    this.grid.visible = this.state.grid && b.grid;
    this.ring.visible = !b.flat;
    this.ring.material.color.set(b.neon ? '#ff2fd8' : '#ffb020');
    this.rim.color.set(b.neon ? '#2fe6ff' : this.state.bg === 'sunset' ? '#ffb070' : '#9fd0ff');
    this.scene.fog = b.flat ? null : new THREE.Fog(b.bottom, 18, 60);
    this.showTag();
  }

  // The name tag sprite is shown by the avatar itself, so it's toggled by detaching it.
  showTag() {
    const r = this.player;
    if (!r) return;
    if (this.state.tag) r.root.add(r.tag);
    else r.root.remove(r.tag);
  }

  // ---------- Camera ----------

  resetCam() { Object.assign(this.cam, { theta: Math.PI * 0.85, phi: 1.36, dist: 5.2 }); this.cam.pan.set(0, 0, 0); }

  bindMouse(canvas) {
    let drag = null;
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('pointerdown', (e) => {
      drag = { x: e.clientX, y: e.clientY, pan: e.button === 2 || e.shiftKey };
      canvas.setPointerCapture(e.pointerId);
      this.state.spinPaused = true;
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag.x = e.clientX; drag.y = e.clientY;
      const c = this.cam;
      if (drag.pan) {
        const s = c.dist * 0.0018;
        const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
        c.pan.addScaledVector(right, -dx * s);
        c.pan.y = Math.max(-1, Math.min(1.5, c.pan.y + dy * s));
      } else {
        c.theta -= dx * 0.008;
        c.phi = Math.max(0.15, Math.min(Math.PI / 2 + 0.25, c.phi - dy * 0.006));
      }
    });
    const up = () => { drag = null; this.state.spinPaused = false; };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.cam.dist = Math.max(0.9, Math.min(12, this.cam.dist * Math.exp(e.deltaY * 0.0012)));
    }, { passive: false });
    canvas.addEventListener('dblclick', () => this.resetCam());
  }

  // ---------- Frame ----------

  frame() {
    const now = performance.now(), dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const r = this.player, s = this.state;
    if (!r) return;
    // Walk / sprint on the spot: the avatar moves forward and is pulled back every few meters,
    // so the real walk cycle plays.
    if (s.pose === 'walk' || s.pose === 'sprint') {
      r.tpos.z -= (s.pose === 'sprint' ? 6.5 : 3) * dt;
      if (r.pos.z < -6) for (const v of [r.pos, r.tpos, r.prev]) v.z += 6;
    }
    if (s.pose === 'reload') r.flags |= 1;
    r.tyaw = 0;
    r.tpitch = s.pitch;
    r.update(dt);
    if (s.pose === 'jump') r.hips.position.y += Math.abs(Math.sin(now * 0.004)) * 0.25;

    const c = this.cam;
    if (s.spin && !s.spinPaused) c.theta += dt * 0.35;
    const target = new THREE.Vector3(r.pos.x, (s.pose === 'crouch' ? 0.8 : 1.1), r.pos.z).add(c.pan);
    this.camera.position.set(
      target.x + Math.sin(c.theta) * Math.sin(c.phi) * c.dist,
      target.y + Math.cos(c.phi) * c.dist,
      target.z + Math.cos(c.theta) * Math.sin(c.phi) * c.dist,
    );
    this.camera.lookAt(target);
    const la = s.light ?? 3.8;
    this.keyLight.position.set(r.pos.x + Math.cos(la) * 5, 6, r.pos.z + Math.sin(la) * 5);
    this.keyLight.target.position.set(r.pos.x, 0.8, r.pos.z);
    this.floor.position.set(r.pos.x, 0, r.pos.z);
    this.ring.position.set(r.pos.x, 0.004, r.pos.z);
    this.grid.position.z = r.pos.z % 1;
    this.ring.material.opacity = 0.35 + Math.sin(now * 0.003) * 0.15;
    this.renderer.render(this.scene, this.camera);
  }

  // Saves the current view (without the UI) as a PNG.
  photo() {
    this.renderer.render(this.scene, this.camera);
    const a = document.createElement('a');
    a.download = `gun-game-3d-${this.getName().replace(/[^\w-]+/g, '_')}.png`;
    a.href = this.renderer.domElement.toDataURL('image/png');
    a.click();
    this.el.classList.add('snap');
    setTimeout(() => this.el.classList.remove('snap'), 250);
  }
}
