// On-screen controls for phones/tablets: floating joystick (left), drag-to-look (right),
// and action buttons. Drives the same Game inputs as keyboard/mouse.
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
      BUTTONS.map((b) => `<div class="tbtn b-${b.a}" data-a="${b.a}">${b.label}</div>`).join('');
    document.body.appendChild(this.el);
    this.joyEl = this.el.querySelector('.joy');
    this.knob = this.el.querySelector('.knob');
    this.joyId = null;
    this.joyOrigin = { x: 0, y: 0 };
    this.looks = new Map(); // touch id -> last {x, y}
    this.btnTouches = new Map(); // touch id -> action
    this.toggles = { aim: false, crouch: false };

    const opts = { passive: false };
    this.el.addEventListener('touchstart', (e) => this.start(e), opts);
    this.el.addEventListener('touchmove', (e) => this.move(e), opts);
    this.el.addEventListener('touchend', (e) => this.end(e), opts);
    this.el.addEventListener('touchcancel', (e) => this.end(e), opts);
  }

  show(v) {
    this.el.classList.toggle('hidden', !v);
    if (!v) this.releaseAll();
  }

  btn(a) { return this.el.querySelector(`.b-${a}`); }

  start(e) {
    e.preventDefault();
    const g = this.game;
    for (const t of e.changedTouches) {
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
        this.game.look((t.clientX - last.x) * LOOK_GAIN, (t.clientY - last.y) * LOOK_GAIN);
        last.x = t.clientX;
        last.y = t.clientY;
      }
    }
  }

  end(e) {
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
