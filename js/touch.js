// On-screen controls for phones/tablets: floating joystick (left), drag-to-look (right),
// and action buttons. Drives the same Game inputs as keyboard/mouse.
import { opts, onOpts, setOpt } from './settings.js';
import { WEAPONS, SHORT } from './weapons.js';
const BUTTONS = [
  { a: 'fire', label: 'FIRE', hold: true },
  { a: 'aim', label: 'AIM', toggle: true },
  { a: 'jump', label: 'JUMP', hold: true },
  { a: 'crouch', label: 'CROUCH', toggle: true },
  { a: 'reload', label: 'R' },
  { a: 'swap', label: '⇄' },
  { a: 'nade', label: 'NADE' },
  { a: 'melee', label: 'MELEE' },
  { a: 'score', label: '≡', hold: true },
  { a: 'pause', label: 'II' },
];
const LOOK_GAIN = 1.5;

export class TouchControls {
  constructor(game, onPause) {
    this.game = game;
    this.onPause = onPause;
    this.el = document.createElement('div');
    this.el.id = 'touch';
    this.el.className = 'hidden';
    this.el.innerHTML = `<div class="joy hidden"><div class="knob"></div></div>` +
      BUTTONS.map((b) => `<div class="tbtn b-${b.a}" data-a="${b.a}">${b.label}</div>`).join('') +
      `<div class="slotbar">${[0, 1, 2, 3].map((i) => `<div class="sbtn" data-slot="${i}"><b>${i + 1}</b><span></span><em></em></div>`).join('')}</div>` +
      `<div class="touch-edit">
        <b>Drag buttons to move them</b>
        <label>Selected size <input type="range" min="0.6" max="1.8" step="0.05" class="te-size" disabled></label>
        <button class="te-reset">Reset layout</button>
        <button class="te-done primary">Done</button>
      </div>`;
    document.body.appendChild(this.el);
    this.joyEl = this.el.querySelector('.joy');
    this.knob = this.el.querySelector('.knob');
    this.joyId = null;
    this.joyOrigin = { x: 0, y: 0 };
    this.looks = new Map(); // touch id -> last {x, y}
    this.btnTouches = new Map(); // touch id -> action
    this.toggles = { aim: false, crouch: false };
    this.editing = false;

    const evOpts = { passive: false };
    this.el.addEventListener('touchstart', (e) => this.start(e), evOpts);
    this.el.addEventListener('touchmove', (e) => this.move(e), evOpts);
    this.el.addEventListener('touchend', (e) => this.end(e), evOpts);
    this.el.addEventListener('touchcancel', (e) => this.end(e), evOpts);
    this.bindEditor();
    onOpts(() => this.applyLayout());
    window.addEventListener('resize', () => this.applyLayout());
  }

  show(v) {
    this.el.classList.toggle('hidden', !v);
    if (!v) this.releaseAll();
    // Tablets get a tappable weapon slot bar; keep its labels in sync while playing.
    clearInterval(this.slotTimer);
    if (v && this.game.tablet) { this.updateSlots(); this.slotTimer = setInterval(() => this.updateSlots(), 150); }
  }

  updateSlots() {
    const g = this.game;
    this.el.querySelectorAll('.sbtn').forEach((b) => {
      const i = Number(b.dataset.slot), id = g.loadout[i], w = id && WEAPONS[id];
      b.classList.toggle('hidden', !w);
      if (!w) return;
      const count = w.type === 'throw' ? '×' + g.util : w.mag ? (g.ammo[id] ?? w.mag) : '';
      const key = id + count + (i === g.slot);
      if (b.dataset.key === key) return;
      b.dataset.key = key;
      b.querySelector('span').textContent = SHORT[id] || w.name;
      b.querySelector('em').textContent = count;
      b.classList.toggle('sel', i === g.slot);
      b.classList.toggle('off', (i === 3 && g.util === 0) || (!!w.mag && g.ammo[id] === 0));
    });
  }

  btn(a) { return this.el.querySelector(`.b-${a}`); }

  // Custom positions are stored as the button's center in % of the screen, so they
  // survive rotation and different phone sizes. Unset buttons keep their CSS spot.
  applyLayout() {
    for (const b of BUTTONS) {
      const el = this.btn(b.a), l = opts.layout[b.a];
      const s = (l && l.s ? l.s : 1) * opts.btnScale * (this.game.tablet ? 1.15 : 1); // a touch bigger on tablets
      if (l) {
        Object.assign(el.style, { left: l.x + '%', top: l.y + '%', right: 'auto', bottom: 'auto', transform: `translate(-50%, -50%) scale(${s})` });
      } else {
        Object.assign(el.style, { left: '', top: '', right: '', bottom: '', transform: `scale(${s})` });
      }
      el.style.opacity = opts.btnOpacity;
    }
  }

  // ---------- Layout editor ----------

  edit(onDone) {
    this.onEditDone = onDone;
    this.editing = true;
    this.releaseAll();
    this.el.classList.remove('hidden');
    this.el.classList.add('editing');
    this.select(null);
  }

  select(a) {
    this.sel = a;
    this.el.querySelectorAll('.tbtn').forEach((b) => b.classList.toggle('picked', b.dataset.a === a));
    const size = this.el.querySelector('.te-size');
    size.disabled = !a;
    size.value = a && opts.layout[a] ? opts.layout[a].s || 1 : 1;
  }

  bindEditor() {
    const bar = this.el.querySelector('.touch-edit');
    // Pointer events so the editor also works with a mouse (handy for testing with ?mobile).
    this.el.addEventListener('pointerdown', (e) => {
      if (!this.editing || bar.contains(e.target)) return;
      const b = e.target.closest('[data-a]');
      if (!b) { this.select(null); return; }
      e.preventDefault();
      this.select(b.dataset.a);
      const r = b.getBoundingClientRect();
      this.drag = { a: b.dataset.a, id: e.pointerId, dx: e.clientX - (r.left + r.width / 2), dy: e.clientY - (r.top + r.height / 2) };
      b.setPointerCapture(e.pointerId);
    });
    this.el.addEventListener('pointermove', (e) => {
      const d = this.drag;
      if (!d || d.id !== e.pointerId) return;
      const x = Math.min(97, Math.max(3, ((e.clientX - d.dx) / innerWidth) * 100));
      const y = Math.min(96, Math.max(4, ((e.clientY - d.dy) / innerHeight) * 100));
      const cur = opts.layout[d.a] || {};
      opts.layout[d.a] = { ...cur, x: +x.toFixed(2), y: +y.toFixed(2) };
      this.applyLayout();
    });
    const up = (e) => {
      if (!this.drag || this.drag.id !== e.pointerId) return;
      this.drag = null;
      setOpt('layout', { ...opts.layout });
    };
    this.el.addEventListener('pointerup', up);
    this.el.addEventListener('pointercancel', up);
    bar.querySelector('.te-size').addEventListener('input', (e) => {
      if (!this.sel) return;
      const el = this.btn(this.sel), r = el.getBoundingClientRect();
      // Pin the button where it is now so resizing doesn't make it jump.
      const cur = opts.layout[this.sel] || { x: ((r.left + r.width / 2) / innerWidth) * 100, y: ((r.top + r.height / 2) / innerHeight) * 100 };
      setOpt('layout', { ...opts.layout, [this.sel]: { ...cur, s: Number(e.target.value) } });
    });
    bar.querySelector('.te-reset').addEventListener('click', () => { setOpt('layout', {}); this.select(null); });
    bar.querySelector('.te-done').addEventListener('click', () => {
      this.editing = false;
      this.select(null);
      this.el.classList.remove('editing');
      this.el.classList.add('hidden');
      if (this.onEditDone) this.onEditDone();
    });
  }

  start(e) {
    if (this.editing) return;
    e.preventDefault();
    const g = this.game;
    for (const t of e.changedTouches) {
      const slotBtn = t.target.closest && t.target.closest('[data-slot]');
      if (slotBtn) {
        if (g.me.alive && !g.matchOver) g.switchSlot(Number(slotBtn.dataset.slot));
        this.updateSlots();
        continue;
      }
      const b = t.target.closest && t.target.closest('[data-a]');
      if (b) {
        const a = b.dataset.a;
        this.btnTouches.set(t.identifier, a);
        b.classList.add('on');
        this.press(a, true);
        // Fire doubles as a look pad so you can aim while shooting.
        if (a === 'fire') this.looks.set(t.identifier, { x: t.clientX, y: t.clientY });
      } else if (t.clientX < innerWidth * 0.42 && this.joyId === null) {
        this.joyId = t.identifier;
        this.joyOrigin = { x: t.clientX, y: t.clientY };
        this.joyEl.style.left = t.clientX + 'px';
        this.joyEl.style.top = t.clientY + 'px';
        this.joyEl.classList.remove('hidden');
        this.knob.style.transform = 'translate(-50%, -50%)';
      } else {
        this.looks.set(t.identifier, { x: t.clientX, y: t.clientY });
      }
    }
    void g;
  }

  move(e) {
    if (this.editing) return;
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === this.joyId) {
        const R = 55;
        let dx = t.clientX - this.joyOrigin.x, dy = t.clientY - this.joyOrigin.y;
        const len = Math.hypot(dx, dy);
        if (len > R) { dx = (dx / len) * R; dy = (dy / len) * R; }
        this.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        this.game.joy.x = dx / R;
        this.game.joy.y = dy / R;
      }
      const last = this.looks.get(t.identifier);
      if (last) {
        this.game.look((t.clientX - last.x) * LOOK_GAIN, (t.clientY - last.y) * LOOK_GAIN, true);
        last.x = t.clientX;
        last.y = t.clientY;
      }
    }
  }

  end(e) {
    if (this.editing) return;
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === this.joyId) {
        this.joyId = null;
        this.game.joy.x = this.game.joy.y = 0;
        this.joyEl.classList.add('hidden');
      }
      this.looks.delete(t.identifier);
      const a = this.btnTouches.get(t.identifier);
      if (a) {
        this.btnTouches.delete(t.identifier);
        const def = BUTTONS.find((b) => b.a === a);
        if (!def.toggle) this.btn(a).classList.remove('on');
        this.press(a, false);
      }
    }
  }

  press(a, down) {
    const g = this.game;
    const def = BUTTONS.find((b) => b.a === a);
    if (def.toggle) {
      if (!down) return;
      this.toggles[a] = !this.toggles[a];
      this.btn(a).classList.toggle('on', this.toggles[a]);
      if (a === 'aim') g.mouse.right = this.toggles.aim;
      if (a === 'crouch') { if (this.toggles.crouch) g.keys.add('KeyC'); else g.keys.delete('KeyC'); }
      return;
    }
    switch (a) {
      case 'fire':
        g.mouse.left = down;
        if (down) g.firedThisPress = false;
        break;
      case 'jump':
        if (down) g.keys.add('Space'); else g.keys.delete('Space');
        break;
      case 'score':
        g.showScores = down;
        break;
      default:
        if (!down) return;
        if (a === 'pause') { this.onPause(); return; }
        if (!g.me.alive || g.matchOver) return;
        if (a === 'reload') g.startReload();
        else if (a === 'swap') g.swapGuns();
        else if (a === 'nade') g.quickThrow();
        else if (a === 'melee') g.quickMelee();
    }
  }

  releaseAll() {
    const g = this.game;
    g.mouse.left = g.mouse.right = false;
    g.keys.delete('Space');
    g.keys.delete('KeyC');
    g.joy.x = g.joy.y = 0;
    g.showScores = false;
    this.toggles = { aim: false, crouch: false };
    this.el.querySelectorAll('.tbtn.on').forEach((b) => b.classList.remove('on'));
    this.joyId = null;
    this.joyEl.classList.add('hidden');
    this.looks.clear();
    this.btnTouches.clear();
  }
}
