import { opts, setOpt } from './settings.js';

// Controller support (standard-mapping gamepads: Xbox, PlayStation, Switch Pro, most Bluetooth pads).
//
// In a match (defaults; every button but Menu can be changed in Settings → Controller):
//              left stick move · right stick look · RT fire · LT aim · A jump · B crouch/slide ·
//              X reload · Y switch weapon · RB grenade · LB melee · L3 sprint · R3 push-to-talk ·
//              D-pad ←/→ previous/next weapon, ↑ ping (team modes) or melee weapon, ↓ inspect ·
//              View scoreboard · Menu pause. Dead / spectating: LB / RB previous / next player.
//              Any button skips the kill cam.
// In menus:    D-pad / left stick move between buttons · A select · B back · LB/RB sections or tabs ·
//              LT/RT loadout slots · right stick scroll · ←/→ on a slider or dropdown changes it.

const B = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, VIEW: 8, MENU: 9, L3: 10, R3: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
// Remappable actions: [id, label, default button]. Menu always pauses.
export const PAD_ACTIONS = [
  ['fire', 'Fire', B.RT], ['aim', 'Aim', B.LT], ['jump', 'Jump', B.A], ['crouch', 'Crouch / slide', B.B],
  ['reload', 'Reload', B.X], ['swap', 'Switch weapon', B.Y], ['grenade', 'Grenade', B.RB], ['melee', 'Quick melee', B.LB],
  ['sprint', 'Sprint', B.L3], ['voice', 'Push to talk (voice chat)', B.R3], ['prev', 'Previous weapon', B.LEFT], ['next', 'Next weapon', B.RIGHT],
  ['ping', 'Ping (team modes) / melee weapon', B.UP], ['inspect', 'Inspect weapon', B.DOWN], ['scores', 'Scoreboard', B.VIEW],
];
const PAD_DEFAULT = Object.fromEntries(PAD_ACTIONS.map(([id, , b]) => [id, b]));
export const padButton = (id) => { const b = opts.padBinds && opts.padBinds[id]; return Number.isInteger(b) && b >= 0 && b < 16 && b !== B.MENU ? b : PAD_DEFAULT[id]; };
// Give an action a button; whatever had that button gets this action's old one (a swap).
export function setPadButton(id, button) {
  const binds = { ...(opts.padBinds || {}) };
  const old = padButton(id);
  for (const [other] of PAD_ACTIONS) if (other !== id && padButton(other) === button) binds[other] = old;
  binds[id] = button;
  setOpt('padBinds', binds);
}
export const resetPadButtons = () => setOpt('padBinds', {});
// Button names: Xbox style, or PlayStation's when that's what's plugged in.
const XBOX = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'View', 'Menu', 'L3', 'R3', 'D-pad ▲', 'D-pad ▼', 'D-pad ◀', 'D-pad ▶'];
const PS = ['✕', '○', '□', '△', 'L1', 'R1', 'L2', 'R2', 'Create', 'Options', 'L3', 'R3', 'D-pad ▲', 'D-pad ▼', 'D-pad ◀', 'D-pad ▶'];
export function padStyle() {
  const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
  return pads.some((p) => /playstation|dualsense|dualshock|054c/i.test(p.id)) ? 'ps' : 'xbox';
}
export const buttonName = (i, style = padStyle()) => (style === 'ps' ? PS : XBOX)[i] || 'Button ' + i;
export let padInput = null; // the running GamepadInput (Settings uses it to listen for a button)

const FOCUSABLE = 'button, input, select, summary, a[href], [tabindex]:not([tabindex="-1"])';
// Overlays in front-to-back order: the first visible one gets the controller.
const OVERLAYS = ['#sys-msg', '#update-pop', '#tag-pop', '#settings', '#host-panel', '#pause', '#menu'];

const stick = (x, y, dz) => {
  const m = Math.hypot(x, y);
  if (m < dz) return [0, 0];
  const k = Math.min(1, (m - dz) / (1 - dz));
  return [(x / m) * k, (y / m) * k];
};

export class GamepadInput {
  // hooks: { pause(), back(), resume() } from main.js
  constructor(game, hooks) {
    this.game = game;
    this.hooks = hooks;
    this.capture = null; // Settings: waiting for a button to bind
    padInput = this;
    this.prev = [];
    this.active = false; // last input came from a controller
    this.sprintLatch = false;
    this.crouchOn = false;
    this.repeat = { dir: null, t: 0 };
    this.lastHp = 100;
    this.lastAmmo = null;
    this.name = '';
    window.addEventListener('gamepadconnected', (e) => { this.name = e.gamepad.id; this.status(); this.toast('🎮 Controller connected'); });
    window.addEventListener('gamepaddisconnected', () => {
      this.name = this.pad() ? this.pad().id : '';
      this.status();
      if (!this.pad()) { this.toast('Controller disconnected'); this.setActive(false); if (this.inGame) this.hooks.pause(); }
    });
    // Any mouse / keyboard / touch use hands control back.
    const off = () => this.setActive(false);
    window.addEventListener('mousedown', off);
    window.addEventListener('keydown', off);
    window.addEventListener('touchstart', off, { passive: true });
    window.addEventListener('mousemove', (e) => { if (Math.abs(e.movementX) + Math.abs(e.movementY) > 6) off(); });
    this.last = performance.now();
    const loop = (now) => { this.poll(Math.min(0.05, (now - this.last) / 1000)); this.last = now; requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    this.status();
  }

  pad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) if (p && p.connected && p.mapping === 'standard') return p;
    for (const p of pads) if (p && p.connected) return p;
    return null;
  }

  toast(text) {
    const el = document.getElementById('pad-toast');
    if (!el) return;
    el.textContent = text;
    el.classList.remove('hidden');
    clearTimeout(this.toastT);
    this.toastT = setTimeout(() => el.classList.add('hidden'), 2500);
  }

  status() {
    const el = document.getElementById('pad-status');
    if (el) el.innerHTML = this.name ? `🎮 <b>Controller connected</b><br>${this.name.replace(/\(.*?\)/g, '').trim().slice(0, 40)}` : '';
  }

  setActive(v) {
    if (this.active === v) return;
    this.active = v;
    this.game.padMode = v;
    document.body.classList.toggle('pad', v);
    if (this.onActive) this.onActive(v);
    if (!v) {
      document.querySelectorAll('.pad-focus').forEach((el) => el.classList.remove('pad-focus'));
      this.releaseGame();
    }
    this.hints();
  }

  // Stop everything the controller was holding down.
  releaseGame() {
    const g = this.game;
    for (const k of ['@jump', '@crouch', '@sprint']) g.keys.delete(k);
    g.joy.x = g.joy.y = 0;
    if (this.firing) g.mouse.left = false;
    if (this.aiming) g.mouse.right = false;
    this.firing = this.aiming = false;
    this.sprintLatch = false;
    this.crouchOn = false;
    if (this.scores) { g.showScores = false; this.scores = false; }
    if (this.talking) { this.talking = false; if (this.hooks.ptt) this.hooks.ptt(false); }
  }

  overlay() {
    for (const sel of OVERLAYS) {
      const el = document.querySelector(sel);
      if (el && !el.classList.contains('hidden')) return el;
    }
    return null;
  }

  poll(dt) {
    const p = this.pad();
    if (!p) { this.prev = []; return; }
    const btn = p.buttons.map((b) => (typeof b === 'object' ? b.value : b));
    const down = (i) => (btn[i] || 0) > 0.35;
    const pressed = (i) => down(i) && !((this.prev[i] || 0) > 0.35);
    const dz = opts.padDeadzone;
    const ls = stick(p.axes[0] || 0, p.axes[1] || 0, dz), rs = stick(p.axes[2] || 0, p.axes[3] || 0, dz);
    if (this.capture) { // Settings → Controller: the next button pressed (Menu cancels)
      const i = btn.findIndex((v, n) => n < 16 && v > 0.35 && !((this.prev[n] || 0) > 0.35));
      if (i >= 0) { const fn = this.capture; this.capture = null; fn(i === B.MENU ? null : i); }
      this.prev = btn;
      return;
    }
    const anyInput = btn.some((v) => v > 0.35) || ls[0] || ls[1] || rs[0] || rs[1];
    if (anyInput && !this.active) this.setActive(true);
    if (this.active) {
      const g = this.game;
      const ov = this.overlay();
      if (g.active && g.locked && !ov && !document.activeElement?.matches?.('#chat-input')) this.play(p, btn, down, pressed, ls, rs, dt);
      else {
        if (this.inGame) { this.releaseGame(); }
        if (ov) this.menu(ov, down, pressed, ls, rs, dt);
      }
      this.inGame = g.active && g.locked && !ov;
      this.feedback(p);
    }
    this.prev = btn;
    if (this.hintFor !== (this.active ? this.overlay() : null)) this.hints();
  }

  // ---------- In a match ----------
  play(p, btn, down, pressed, ls, rs, dt) {
    const g = this.game, k = g.keys, alive = g.me.alive && !g.matchOver;
    // Response curve on the look stick: fine control near the center, full speed at the edge.
    const curve = (v) => Math.sign(v) * Math.pow(Math.abs(v), 1.7);
    g.joy.x = ls[0];
    g.joy.y = ls[1];
    g.padLook(curve(rs[0]), curve(rs[1]), dt);

    // Sprint: click L3 (stays on until you stop pushing forward); crouching cancels it.
    const P = padButton;
    // Any button skips the kill cam.
    if (g.killcam && btn.some((v, n) => n < 16 && v > 0.35 && !((this.prev[n] || 0) > 0.35))) g.endKillcam();
    // Push-to-talk (voice chat)
    const talk = down(P('voice'));
    if (talk !== this.talking) { this.talking = talk; if (this.hooks.ptt) this.hooks.ptt(talk); }

    if (pressed(P('sprint'))) { this.sprintLatch = !this.sprintLatch; if (this.crouchOn) { this.crouchOn = false; k.delete('@crouch'); } }
    if (-ls[1] < 0.35) this.sprintLatch = false;
    if (this.sprintLatch) k.add('@sprint'); else k.delete('@sprint');

    // Jump (A) also stands you up from a toggled crouch.
    if (down(P('jump'))) k.add('@jump'); else k.delete('@jump');
    if (pressed(P('jump')) && this.crouchOn) { this.crouchOn = false; k.delete('@crouch'); }

    // Crouch / slide (B): toggle or hold.
    if (opts.padCrouchToggle) {
      if (pressed(P('crouch'))) { this.crouchOn = !this.crouchOn; this.sprintLatch = false; }
    } else this.crouchOn = down(P('crouch'));
    if (this.crouchOn) k.add('@crouch'); else k.delete('@crouch');

    // Triggers
    const fire = down(P('fire')), aim = down(P('aim'));
    if (fire && !this.firing) g.firedThisPress = false;
    g.mouse.left = fire;
    this.firing = fire;
    g.mouse.right = aim;
    this.aiming = aim;

    // Scoreboard while View is held
    this.scores = down(P('scores'));
    g.showScores = this.scores;

    if (pressed(B.MENU)) { this.releaseGame(); this.hooks.pause(); return; }
    // End-of-match map vote: X / Y / B pick the 1st / 2nd / 3rd map.
    if (g.matchOver) {
      if (pressed(B.X)) g.voteMap(0);
      else if (pressed(B.Y)) g.voteMap(1);
      else if (pressed(B.B)) g.voteMap(2);
    }
    if (!alive) {
      // Dead or spectating: LB / RB (or the previous / next weapon buttons) change who you watch.
      if (!g.killcam && (pressed(B.RB) || pressed(P('next')))) g.specIdx = (g.specIdx || 0) + 1;
      if (!g.killcam && (pressed(B.LB) || pressed(P('prev')))) g.specIdx = (g.specIdx || 0) - 1;
      return;
    }
    if (pressed(P('reload'))) g.startReload();
    if (pressed(P('swap'))) g.swapLast();
    if (pressed(P('grenade'))) g.quickThrow();
    if (pressed(P('melee'))) g.quickMelee();
    if (pressed(P('prev'))) g.cycleSlot(-1);
    if (pressed(P('next'))) g.cycleSlot(1);
    if (pressed(P('ping'))) { if (g.teams) g.ping(); else g.switchSlot(2); } // team modes: ping
    if (pressed(P('inspect')) && g.reloadT <= 0) g.vm.inspect();
  }

  // Rumble when you get hit and a little kick when you fire.
  feedback(p) {
    const g = this.game, act = p.vibrationActuator;
    const hp = g.me.hp, ammo = g.ammo ? g.ammo[g.curW] : null;
    if (opts.padVibration && act && act.playEffect && g.active && g.me.alive) {
      if (hp < this.lastHp - 0.5) {
        const k = Math.min(1, (this.lastHp - hp) / 60);
        act.playEffect('dual-rumble', { duration: 90 + k * 120, strongMagnitude: 0.35 + k * 0.6, weakMagnitude: 0.3 }).catch(() => {});
      } else if (this.lastAmmo != null && ammo != null && ammo < this.lastAmmo && this.firing) {
        act.playEffect('dual-rumble', { duration: 45, strongMagnitude: 0.12, weakMagnitude: 0.35 }).catch(() => {});
      }
    }
    this.lastHp = hp;
    this.lastAmmo = ammo;
  }

  // ---------- Menus ----------
  usable(el) {
    if (el.disabled || el.closest('.hidden') || el.closest('details:not([open]) > :not(summary)')) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
  }

  focusables(root) {
    return [...root.querySelectorAll(FOCUSABLE)].filter((el) => this.usable(el));
  }

  current(root) {
    const a = document.activeElement;
    if (a && a !== document.body && root.contains(a) && a.matches(FOCUSABLE)) return a;
    return null;
  }

  focus(el) {
    if (!el) return;
    const old = document.querySelector('.pad-focus');
    if (old && old !== el) { old.classList.remove('pad-focus'); old.dispatchEvent(new MouseEvent('mouseleave')); }
    el.classList.add('pad-focus');
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const r = el.getBoundingClientRect();
    this.lastPos = { x: r.left + r.width / 2, y: r.top + r.height / 2, pane: el.closest('.menu-pane') };
    el.dispatchEvent(new MouseEvent('mouseenter')); // e.g. the loadout stat card follows the focus
  }

  // A sensible first stop inside an overlay.
  initial(root, list) {
    const pick = { menu: '#menu-nav button.sel', settings: '#set-tabs button.sel', 'host-panel': '#hp-close', pause: '#btn-resume' }[root.id];
    const el = (pick && root.querySelector(pick)) || root.querySelector('button.primary:not(.hidden)');
    return el && list.includes(el) ? el : list[0];
  }

  move(root, dir) {
    const list = this.focusables(root);
    if (!list.length) return;
    const cur = this.current(root);
    if (!cur || !list.includes(cur)) { this.focus(this.initial(root, list) || list[0]); return; }
    // Main menu: right from the section list goes into the section (back to where you were in it).
    if (root.id === 'menu' && dir === 'right' && cur.closest('#menu-nav')) {
      const pane = root.querySelector('.menu-pane:not(.hidden)');
      const inPane = list.filter((el) => pane && pane.contains(el));
      if (inPane.length) { this.focus(inPane.includes(this.paneFocus) ? this.paneFocus : inPane[0]); return; }
    }
    if (root.id === 'menu' && cur.closest('.menu-pane')) this.paneFocus = cur;
    const a = cur.getBoundingClientRect();
    const ax = a.left + a.width / 2, ay = a.top + a.height / 2;
    const [dx, dy] = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[dir];
    // Up/down stays inside the current area (section list vs. section content, settings tabs vs. rows)
    // when there's anything there to go to.
    const ZONES = '#menu-nav, .menu-pane, #set-tabs, #set-body, .hp-grid > section';
    const zone = cur.closest(ZONES);
    const pickFrom = (cands) => this.nearest(cur, a, ax, ay, dx, dy, cands);
    const best = dy && zone ? pickFrom(list.filter((el) => el.closest(ZONES) === zone)) : pickFrom(list);
    if (best) this.focus(best);
  }

  nearest(cur, a, ax, ay, dx, dy, list) {
    let best = null, bestScore = Infinity;
    for (const el of list) {
      if (el === cur) continue;
      const r = el.getBoundingClientRect();
      // Nearest edge-to-edge gap along the direction, plus how far off-axis it is.
      const along = dx ? (dx > 0 ? r.left - a.right : a.left - r.right) : (dy > 0 ? r.top - a.bottom : a.top - r.bottom);
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const centerAlong = dx ? (cx - ax) * dx : (cy - ay) * dy;
      if (centerAlong <= 2 || along < -Math.min(a.width, a.height) * 0.5) continue;
      const overlap = dx ? Math.max(0, Math.min(a.bottom, r.bottom) - Math.max(a.top, r.top)) : Math.max(0, Math.min(a.right, r.right) - Math.max(a.left, r.left));
      const off = dx ? Math.abs(cy - ay) : Math.abs(cx - ax);
      const score = Math.max(0, along) + (overlap > 0 ? 0 : off * 2.2) + off * 0.3;
      if (score < bestScore) { bestScore = score; best = el; }
    }
    return best;
  }

  // Sliders take left/right as a value change.
  adjust(el, dir) {
    if (!el.matches('input[type=range]')) return false;
    if (dir > 0) el.stepUp(); else el.stepDown();
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  // A on a dropdown steps to the next option (wrapping), since a native list can't be opened.
  activate(el) {
    if (el.matches('select')) {
      el.selectedIndex = (el.selectedIndex + 1) % el.options.length;
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }
    el.click();
  }

  // Cycle a row of tab buttons (the selected one has .sel), then focus the new tab
  // (re-found after the click, since tabs often re-render).
  cycleTabs(root, selector, dir) {
    const list = [...root.querySelectorAll(selector)].filter((b) => !b.closest('.hidden'));
    if (!list.length) return false;
    const i = Math.max(0, list.findIndex((b) => b.classList.contains('sel')));
    list[(i + dir + list.length) % list.length].click();
    requestAnimationFrame(() => {
      const sel = [...root.querySelectorAll(selector)].find((b) => b.classList.contains('sel') && !b.closest('.hidden'));
      if (sel) this.focus(sel);
    });
    return true;
  }

  menu(root, down, pressed, ls, rs, dt) {
    // A newly opened overlay starts with its main button focused.
    const cur0 = this.current(root);
    const lost = root === this.focusRoot && !(cur0 && this.usable(cur0));
    if (root !== this.focusRoot || lost) {
      this.focusRoot = root;
      const list = this.focusables(root);
      // The focused button went away (e.g. it hid itself): jump to whatever is closest to it.
      let pick = null;
      if (lost && this.lastPos) {
        const pool = this.lastPos.pane && !this.lastPos.pane.classList.contains('hidden') ? list.filter((el) => this.lastPos.pane.contains(el)) : list;
        let bd = Infinity;
        for (const el of pool) {
          const r = el.getBoundingClientRect();
          const d = Math.hypot(r.left + r.width / 2 - this.lastPos.x, r.top + r.height / 2 - this.lastPos.y);
          if (d < bd) { bd = d; pick = el; }
        }
      }
      if (list.length) this.focus(pick || this.initial(root, list));
      // This input just picked the starting point; don't also move away from it.
      this.repeat.dir = down(B.UP) || ls[1] < -0.6 ? 'up' : down(B.DOWN) || ls[1] > 0.6 ? 'down' : down(B.LEFT) || ls[0] < -0.6 ? 'left' : down(B.RIGHT) || ls[0] > 0.6 ? 'right' : null;
      this.repeat.t = 0.38;
    }
    // Directional input with key-repeat.
    let dir = null;
    if (down(B.UP) || ls[1] < -0.6) dir = 'up';
    else if (down(B.DOWN) || ls[1] > 0.6) dir = 'down';
    else if (down(B.LEFT) || ls[0] < -0.6) dir = 'left';
    else if (down(B.RIGHT) || ls[0] > 0.6) dir = 'right';
    const r = this.repeat;
    let fire = false;
    if (dir !== r.dir) { r.dir = dir; r.t = 0.38; fire = !!dir; }
    else if (dir) { r.t -= dt; if (r.t <= 0) { r.t = 0.09; fire = true; } }
    if (fire) {
      const cur = this.current(root);
      if (cur && (dir === 'left' || dir === 'right') && this.adjust(cur, dir === 'right' ? 1 : -1)) { /* changed a value */ }
      else this.move(root, dir);
    }

    // Right stick scrolls whatever is scrollable around the focus.
    if (rs[1]) {
      const cur = this.current(root) || root;
      let el = cur;
      while (el && el !== document.body && !(el.scrollHeight > el.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(el).overflowY))) el = el.parentElement;
      if (el && el !== document.body) el.scrollTop += rs[1] * 900 * dt;
    }

    if (pressed(B.A)) {
      const cur = this.current(root);
      if (cur) this.activate(cur);
    }
    if (pressed(B.B)) this.hooks.back(root);
    if (pressed(B.MENU) && root.id === 'pause') this.hooks.resume();
    if (pressed(B.LB) || pressed(B.RB)) {
      const d = pressed(B.RB) ? 1 : -1;
      if (root.id === 'menu') this.cycleTabs(root, '#menu-nav [data-pane]', d);
      else if (root.id === 'settings') this.cycleTabs(root, '#set-tabs button', d);
    }
    if (pressed(B.LT) || pressed(B.RT)) {
      const sel = root.id === 'pause' ? '#pause-loadout .lo-tab' : '.menu-pane:not(.hidden) .lo-tab';
      if (root.id === 'pause') { const d = root.querySelector('#pause-lo'); if (d && !d.open) d.open = true; }
      this.cycleTabs(root, sel, pressed(B.RT) ? 1 : -1);
    }
  }

  // Button prompts along the bottom of the screen while a controller is driving a menu.
  hints() {
    const el = document.getElementById('pad-hints');
    if (!el) return;
    const ov = this.active ? this.overlay() : null;
    this.hintFor = ov;
    el.classList.toggle('hidden', !ov);
    if (!ov) return;
    const parts = [['A', 'Select'], ['B', ov.id === 'menu' ? '' : ov.id === 'pause' ? 'Resume' : 'Back']];
    if (ov.id === 'menu') parts.push(['LB RB', 'Section'], ['LT RT', 'Loadout slot']);
    if (ov.id === 'settings') parts.push(['LB RB', 'Tab'], ['◀ ▶', 'Adjust']);
    if (ov.id === 'pause') parts.push(['LT RT', 'Loadout slot']);
    parts.push(['R', 'Scroll']);
    el.innerHTML = parts.filter(([, t]) => t).map(([b, t]) => `<span><kbd class="pb">${b}</kbd>${t}</span>`).join('');
  }
}
