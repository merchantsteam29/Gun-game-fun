import * as THREE from 'three';
import { RemotePlayer } from './remote.js';
import { WEAPONS, SLOT_NAMES } from './weapons.js';
import { getCos, COSMETICS, SLOT_LABELS, HAIR_COLORS, isOwned, ownsWrap, setCos } from './missions.js';
import { CAMOS, camoOf, camoSwatch } from './camos.js';
import { bannerOf } from './banners.js';
import { bannerHtml } from './banners.js';
import { opts, setOpt } from './settings.js';
import { esc } from './util.js';

// Secret PC-only Showroom: a full-screen 3D viewer of your character, cosmetics and guns with
// mouse orbit / pan / zoom, poses, backdrops and photo export, plus a few PC-only video settings.
// Opened from the menus with any of the secret codes below. Phones and tablets never see it.
// Arrows are written as arrow characters, everything else as the letter typed. The Konami code
// also works while a text box has focus (only the word codes are ignored there).

const KONAMI = '↑↑↓↓←→←→ba';
const CODES = [
  '↑↓←→chad', // arrows + codeword
  KONAMI,
  'drip',
];
const ARROWS = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' };

const BACKDROPS = {
  studio: { name: 'Studio', top: '#3a4250', bottom: '#14181e', floor: '#2a3038', grid: true },
  night: { name: 'Night', top: '#0b1530', bottom: '#020409', floor: '#10151f', grid: true },
  sunset: { name: 'Sunset', top: '#ff8a4a', bottom: '#3a1446', floor: '#3a2430', grid: false },
  neon: { name: 'Neon', top: '#2a0a4a', bottom: '#05010c', floor: '#120620', grid: true, neon: true },
  snow: { name: 'Snow', top: '#e8f0f8', bottom: '#9fb2c6', floor: '#dfe7ef', grid: false },
  sky: { name: 'Sky Islands', top: '#5aa8e8', bottom: '#cfe8ff', floor: '#4f7a3a', grid: false },
  arctic: { name: 'Arctic', top: '#b8d4ec', bottom: '#eef5fb', floor: '#e4edf5', grid: false },
  city: { name: 'Neon City', top: '#161b33', bottom: '#05060d', floor: '#1a1d2a', grid: true, neon: true },
  gold: { name: 'Champion', top: '#5a3a08', bottom: '#120a02', floor: '#2a1c08', grid: false, gold: true },
  green: { name: 'Green screen', top: '#00b140', bottom: '#00b140', floor: '#00b140', grid: false, flat: true },
};

const POSES = [
  ['idle', 'Idle'], ['walk', 'Walk'], ['sprint', 'Sprint'], ['strafe', 'Strafe'], ['crouch', 'Crouch'], ['crouchwalk', 'Crouch walk'], ['reload', 'Reload'], ['jump', 'Jump & land'],
];
const ACTIONS = [['fire', 'Fire'], ['burst', 'Full auto'], ['swing', 'Melee swing'], ['throw', 'Throw'], ['headshot', 'Headshot!'], ['boom', 'Explosion ragdoll']];

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
  constructor({ game, mobile, getColor, getName, getLoadout, getMods, getExtras }) {
    this.getExtras = getExtras || (() => ({}));
    this.tryCos = null; // Wardrobe: an outfit being tried on (not saved)
    this.tryWrap = null;
    this.game = game;
    this.mobile = mobile;
    this.getColor = getColor;
    this.getName = getName;
    this.getLoadout = getLoadout;
    this.getMods = getMods;
    this.state = { pose: 'idle', bg: opts.srBg || 'studio', spin: true, grid: true, tag: false, pitch: 0, weapon: null, tab: 'view' };
    this.cam = { theta: Math.PI * 0.85, phi: 1.36, dist: 5.2, pan: new THREE.Vector3() };
    if (mobile) return;
    let typed = ''; // the last few keys, as code characters

    // Capture phase on window: runs before the game's and menus' key handlers.
    window.addEventListener('keydown', (e) => {
      const typing = e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName);
      if (this.open) {
        this.key(e, typing);
        if (!typing || e.key === 'Escape') e.stopPropagation(); // nothing leaks into the game underneath
        return;
      }
      if (game.locked || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT' || e.target.id === 'chat-input') { typed = ''; return; }
      const ch = ARROWS[e.code] || (e.key.length === 1 ? e.key.toLowerCase() : '');
      if (!ch) return;
      typed = (typed + ch).slice(-20);
      const hit = typing ? (typed.endsWith(KONAMI) ? KONAMI : null) : CODES.find((c) => typed.endsWith(c));
      if (!hit) return;
      typed = '';
      e.preventDefault(); // the final "a" never reaches the box
      if (typing && e.target.value && e.target.value.toLowerCase().endsWith('b')) e.target.value = e.target.value.slice(0, -1); // nor the "b"
      this.show();
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
          <div class="sr-tabs"><button data-tab="view">Model</button><button data-tab="fit">Wardrobe</button><button data-tab="scene">Scene</button><button data-tab="pc" title="PC-only settings">PC</button></div>
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
    const r = new RemotePlayer(this.scene, 'showroom', this.getName(), this.getColor(), this.outfit(), this.previewMods());
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

  // The outfit shown: what you're trying on in the Wardrobe, or what you wear.
  outfit() { return this.tryCos ? { ...getCos(), ...this.tryCos } : getCos(); }
  previewMods() {
    const m = { ...this.getMods() };
    const id = this.state.weapon || this.getLoadout()[0];
    if (this.tryWrap && id) m[id] = { ...(m[id] || {}), camo: this.tryWrap === 'default' ? undefined : this.tryWrap };
    return m;
  }
  refreshLook() {
    if (!this.player) return;
    this.player.setCosmetics(this.outfit());
    this.player.setMods(this.previewMods());
    this.renderBanner();
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
    this.tryCos = null; this.tryWrap = null; // trying on never sticks
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
    } else if (s.tab === 'fit') {
      // Try anything on, owned or not (it's only a preview). Owned items can be worn for real.
      const cur = this.outfit(), wid = this.state.weapon || this.getLoadout()[0];
      const curWrap = this.tryWrap || (this.getMods()[wid] && this.getMods()[wid].camo) || 'default';
      const mark = (slot, c) => (isOwned(slot, c.id) ? '✓ ' : c.reward ? '🔒 ' : '🪙 ');
      const slots = Object.keys(COSMETICS).map((slot) => `<div class="sr-label">${SLOT_LABELS[slot]}</div>
        <select data-slot="${slot}">${COSMETICS[slot].map((c) => `<option value="${c.id}" ${cur[slot] === c.id ? 'selected' : ''}>${mark(slot, c)}${esc(c.name)}${!isOwned(slot, c.id) && !c.reward ? ` (${c.price})` : ''}</option>`).join('')}</select>`).join('');
      const unowned = Object.keys(COSMETICS).filter((slot) => !isOwned(slot, cur[slot]));
      body.innerHTML = `<p class="sr-note">Try on anything, even items you don't own yet (✓ owned · 🪙 price · 🔒 earned). Nothing is saved until you press Wear.</p>
        ${slots}
        <div class="sr-label">Hair color</div>
        <div class="sr-swatches">${HAIR_COLORS.map((c) => `<button data-hc="${c}" style="background:${c}" class="${cur.hairColor === c ? 'sel' : ''}"></button>`).join('')}</div>
        <div class="sr-label">Wrap on the ${esc(WEAPONS[wid] ? WEAPONS[wid].name : 'gun')}</div>
        <div class="sr-wraps">${CAMOS.map((c) => `<button data-wrap="${c.id}" class="${curWrap === c.id ? 'sel' : ''} ${ownsWrap(c.id) ? '' : 'locked'}" title="${esc(c.name)}${ownsWrap(c.id) ? '' : c.reward ? ' (earned)' : ` (🪙 ${c.price})`}" style="background:${camoSwatch(c)}"></button>`).join('')}</div>
        <div class="sr-chips sr-fit-btns">
          <button id="sr-wear" class="primary" ${this.tryCos && !unowned.length ? '' : 'disabled'}>Wear this outfit</button>
          <button id="sr-mine" ${this.tryCos || this.tryWrap ? '' : 'disabled'}>Back to my outfit</button>
        </div>
        ${this.tryCos && unowned.length ? `<p class="sr-note">You don't own: ${unowned.map((x) => esc(COSMETICS[x].find((c) => c.id === cur[x]).name)).join(', ')}. Get them in Character.</p>` : ''}`;
      body.querySelectorAll('[data-slot]').forEach((sel) => {
        sel.onchange = () => { this.tryCos = { ...(this.tryCos || {}), [sel.dataset.slot]: sel.value }; this.refreshLook(); this.renderPanel(); };
        sel.addEventListener('keydown', (e) => e.stopPropagation());
      });
      body.querySelectorAll('[data-hc]').forEach((b) => { b.onclick = () => { this.tryCos = { ...(this.tryCos || {}), hairColor: b.dataset.hc }; this.refreshLook(); this.renderPanel(); }; });
      body.querySelectorAll('[data-wrap]').forEach((b) => { b.onclick = () => { this.tryWrap = b.dataset.wrap; this.refreshLook(); this.renderPanel(); }; });
      $('sr-wear').onclick = () => { const next = this.outfit(); setCos(next); if (this.onCos) this.onCos(next); this.tryCos = null; this.refreshLook(); this.renderPanel(); };
      $('sr-mine').onclick = () => { this.tryCos = null; this.tryWrap = null; this.refreshLook(); this.renderPanel(); };
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
    const cos = this.outfit(), x = this.getExtras();
    const lo = this.getLoadout();
    const name = (x.clan ? `[${x.clan}] ` : '') + this.getName();
    const top = x.level ? `${esc(x.rankName || '').toUpperCase()} · LEVEL ${x.level}` : 'YOUR BANNER';
    const chips = [
      x.champ ? '<span class="chip">🏆 Weekly champion</span>' : '',
      x.division ? `<span class="chip" style="color:${x.divColor}">${esc(x.division)}${x.sr ? ' · ' + x.sr + ' SR' : ''}</span>` : '',
      ...(x.seasons || []).map((n) => `<span class="chip">S${n}</span>`),
      ...lo.map((id, i) => `<span class="chip" title="${SLOT_NAMES[i]}">${esc(WEAPONS[id].name)}</span>`).slice(0, 2),
    ].filter(Boolean).slice(0, 5).join('');
    this.el.querySelector('.sr-banner').innerHTML = bannerHtml(cos.banner, name, this.getColor(), top, chips);
  }

  // ---------- Model control ----------

  setWeapon(id) {
    if (!this.player || !WEAPONS[id]) return;
    this.state.weapon = id;
    this.player.setWeapon(id);
    if (this.tryWrap) this.player.setMods(this.previewMods());
  }

  setPose(p) {
    const r = this.player;
    this.state.pose = p;
    r.tcrouch = p === 'crouch' || p === 'crouchwalk' ? 1 : 0;
    r.flags = (p === 'sprint' ? 2 : 0) | (p === 'reload' ? 1 : 0);
    this.jumpT = 0;
    if (!['walk', 'sprint', 'strafe', 'crouchwalk'].includes(p)) { for (const v of [r.pos, r.tpos, r.prev]) v.set(0, 0, 0); }
  }

  action(a) {
    const r = this.player;
    if (!r) return;
    if (a === 'fire') r.fire();
    else if (a === 'burst') { let n = 0; clearInterval(this.burstI); this.burstI = setInterval(() => { if (!this.player || ++n > 10) { clearInterval(this.burstI); return; } this.player.fire(); }, 90); }
    else if (a === 'swing') r.melee(Math.random() < 0.5 ? 'slash' : 'chop');
    else if (a === 'throw') r.throwAnim();
    else if (a === 'headshot' || a === 'boom') {
      // Shot from in front of the camera: the body falls away from you (explosions throw it).
      const from = this.camera.position.clone();
      r.die(from, a === 'headshot', a === 'boom' ? 8 : 3); // a headshot knocks the hat off too
      clearTimeout(this.reviveT);
      this.reviveT = setTimeout(() => {
        if (!this.player) return;
        r.deathT = 0;
        r.deathVel.set(0, 0, 0);
        for (const v of [r.pos, r.tpos, r.prev]) v.set(0, 0, 0); // back on the spot (the ragdoll moved it)
        r.root.quaternion.identity();
        r.restoreHat();
        this.setPose(this.state.pose);
      }, 2800);
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
    this.ring.material.color.set(b.neon ? '#ff2fd8' : b.gold ? '#ffe08a' : '#ffb020');
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
    if (r.deathT === 0 && ['walk', 'sprint', 'crouchwalk'].includes(s.pose)) {
      r.tpos.z -= (s.pose === 'sprint' ? 6.5 : s.pose === 'crouchwalk' ? 1.8 : 3) * dt;
      if (r.pos.z < -6) for (const v of [r.pos, r.tpos, r.prev]) v.z += 6;
    }
    if (r.deathT === 0 && s.pose === 'strafe') {
      r.tpos.x += 3 * dt;
      if (r.pos.x > 6) for (const v of [r.pos, r.tpos, r.prev]) v.x -= 6;
    }
    // Jump & land: 0.6 s in the air (rising then falling), then a landing squash, then again.
    if (s.pose === 'jump' && r.deathT === 0) {
      this.jumpT = ((this.jumpT || 0) + dt) % 1.5;
      const air = this.jumpT < 0.6;
      r.flags = air ? 4 : 0;
      const h = air ? Math.sin((this.jumpT / 0.6) * Math.PI) * 0.7 : 0;
      for (const v of [r.pos, r.tpos]) v.y = h;
    }
    if (s.pose === 'reload') r.flags |= 1;
    r.tyaw = 0;
    r.tpitch = s.pitch;
    r.update(dt);

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
