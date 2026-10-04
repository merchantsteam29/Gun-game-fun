import { opts, setOpt, resetOpts } from './settings.js';
import { store } from './util.js';

const $ = (id) => document.getElementById(id);
const pct = (v) => Math.round(v * 100) + '%';
const mul = (v) => Number(v).toFixed(2) + '×';
const deg = (v) => v + '°';

const CROSS_COLORS = ['#ffffff', '#4dff9a', '#36e0ff', '#ffe14d', '#ff4d4d', '#ff4dff'];

// Tabs of controls. `only` hides a row on the other kind of device.
const TABS = [
  { name: 'Controls', rows: [
    { key: 'sens', label: 'Mouse sensitivity', type: 'range', min: 0.1, max: 4, step: 0.05, fmt: mul, only: 'desktop' },
    { key: 'touchSens', label: 'Look sensitivity', type: 'range', min: 0.3, max: 3, step: 0.05, fmt: mul, only: 'mobile' },
    { key: 'adsSens', label: 'Aiming sensitivity', hint: 'Multiplier while aiming down sights', type: 'range', min: 0.2, max: 1.5, step: 0.05, fmt: mul },
    { key: 'invertY', label: 'Invert look up / down', type: 'check' },
    { key: 'aimToggle', label: 'Toggle aim with right mouse', hint: 'Click once to aim, again to stop (instead of holding)', type: 'check', only: 'desktop' },
  ] },
  { name: 'Video', rows: [
    { key: 'fov', label: 'Field of view', type: 'range', min: 60, max: 110, step: 1, fmt: deg },
    { key: 'vmFov', label: 'Weapon field of view', hint: 'How large your gun and arms look', type: 'range', min: 50, max: 90, step: 1, fmt: deg },
    { key: 'bobbing', label: 'View bobbing', type: 'range', min: 0, max: 1.5, step: 0.05, fmt: pct },
    { special: 'graphics' },
    { key: 'showFps', label: 'Show FPS counter', type: 'check' },
  ] },
  { name: 'HUD & Audio', rows: [
    { key: 'volume', label: 'Volume', type: 'range', min: 0, max: 1, step: 0.05, fmt: pct },
    { key: 'crossColor', label: 'Crosshair color', type: 'swatch', options: CROSS_COLORS },
    { key: 'crossSize', label: 'Crosshair size', type: 'range', min: 0.6, max: 2, step: 0.05, fmt: mul },
    { key: 'crossDot', label: 'Crosshair center dot', type: 'check' },
  ] },
  { name: 'Mobile', rows: [
    { special: 'layout' },
    { key: 'btnScale', label: 'Button size', type: 'range', min: 0.7, max: 1.5, step: 0.05, fmt: mul },
    { key: 'btnOpacity', label: 'Button opacity', type: 'range', min: 0.25, max: 1, step: 0.05, fmt: pct },
  ] },
];

export class SettingsUI {
  // game: for graphics changes; editLayout(done): opens the touch layout editor.
  constructor({ game, mobile, editLayout }) {
    this.game = game;
    this.mobile = mobile;
    this.editLayout = editLayout;
    this.tab = mobile ? 3 : 0;
    this.onClose = null;
    $('set-close').onclick = () => this.close();
    $('set-reset').onclick = () => {
      if (!confirm('Reset every setting (including your button layout) to the defaults?')) return;
      resetOpts();
      this.render();
    };
  }

  open() {
    $('settings').classList.remove('hidden');
    this.render();
  }

  close() {
    $('settings').classList.add('hidden');
    if (this.onClose) this.onClose();
  }

  render() {
    $('set-tabs').innerHTML = TABS.map((t, i) => `<button class="${i === this.tab ? 'sel' : ''}" data-i="${i}">${t.name}</button>`).join('');
    $('set-tabs').querySelectorAll('button').forEach((b) => { b.onclick = () => { this.tab = Number(b.dataset.i); this.render(); }; });
    const body = $('set-body');
    body.innerHTML = '';
    for (const r of TABS[this.tab].rows) {
      if (r.only && (r.only === 'mobile') !== this.mobile) continue;
      body.appendChild(r.special ? this.special(r.special) : this.row(r));
    }
  }

  row(r) {
    const el = document.createElement('div');
    el.className = 'set-row';
    const hint = r.hint ? `<small>${r.hint}</small>` : '';
    if (r.type === 'check') {
      el.innerHTML = `<label class="check"><input type="checkbox" ${opts[r.key] ? 'checked' : ''}> <span>${r.label}${hint}</span></label>`;
      el.querySelector('input').onchange = (e) => setOpt(r.key, e.target.checked);
    } else if (r.type === 'range') {
      el.innerHTML = `<div class="set-label">${r.label}${hint}</div><input type="range" min="${r.min}" max="${r.max}" step="${r.step}" value="${opts[r.key]}"><output>${r.fmt(opts[r.key])}</output>`;
      const input = el.querySelector('input'), out = el.querySelector('output');
      input.oninput = () => { const v = Number(input.value); out.textContent = r.fmt(v); setOpt(r.key, v); };
    } else if (r.type === 'swatch') {
      el.innerHTML = `<div class="set-label">${r.label}</div><div class="swatches">${r.options.map((c) => `<button style="background:${c}" class="${opts[r.key] === c ? 'sel' : ''}" data-c="${c}" title="${c}"></button>`).join('')}</div>`;
      el.querySelectorAll('[data-c]').forEach((b) => { b.onclick = () => { setOpt(r.key, b.dataset.c); this.render(); }; });
    }
    return el;
  }

  special(kind) {
    const el = document.createElement('div');
    el.className = 'set-row';
    if (kind === 'graphics') {
      const low = this.game.lowGfx;
      el.innerHTML = `<div class="set-label">Graphics<small>Low turns off shadows and lowers resolution (smoother on weak devices)</small></div>
        <div class="pick"><button data-g="high" class="${low ? '' : 'sel'}">High</button><button data-g="low" class="${low ? 'sel' : ''}">Low</button></div>`;
      el.querySelectorAll('[data-g]').forEach((b) => {
        b.onclick = () => {
          this.game.lowGfx = b.dataset.g === 'low';
          store.set('lowgfx', this.game.lowGfx);
          this.game.applyGfx();
          this.render();
        };
      });
    } else if (kind === 'layout') {
      if (this.mobile) {
        el.innerHTML = `<div class="set-label">Button layout<small>Drag your touch buttons wherever you like and resize them one by one</small></div>
          <div class="pick"><button class="primary" data-l="edit">Edit layout</button><button data-l="reset">Reset</button></div>`;
        el.querySelector('[data-l=edit]').onclick = () => {
          $('settings').classList.add('hidden');
          this.editLayout(() => $('settings').classList.remove('hidden'));
        };
        el.querySelector('[data-l=reset]').onclick = () => setOpt('layout', {});
      } else {
        el.innerHTML = `<div class="set-label">Button layout<small>Touch controls appear on phones and tablets. Open the game there (or add ?mobile to the link) to customize them.</small></div>`;
      }
    }
    return el;
  }
}
