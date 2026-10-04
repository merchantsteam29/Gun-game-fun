import { opts, setOpt, resetOpts } from './settings.js';
import { store, esc } from './util.js';
import { COSMETICS, SLOT_LABELS, HAIR_COLORS, MISSIONS, getStat, missionDone, isUnlocked, missionFor, getCos, setCos } from './missions.js';

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
    { key: 'aimAssist', label: 'Aim assist', hint: 'Slows your aim on enemies, tracks them while you shoot or aim, and snaps a little when you aim', type: 'check', only: 'mobile' },
    { key: 'aimAssistStrength', label: 'Aim assist strength', type: 'range', min: 0.1, max: 1, step: 0.05, fmt: pct, only: 'mobile' },
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
    { key: 'showChat', label: 'Show party chat', hint: 'Turn off to hide all chat messages', type: 'check' },
    { key: 'crossColor', label: 'Crosshair color', type: 'swatch', options: CROSS_COLORS },
    { key: 'crossSize', label: 'Crosshair size', type: 'range', min: 0.6, max: 2, step: 0.05, fmt: mul },
    { key: 'crossDot', label: 'Crosshair center dot', type: 'check' },
  ] },
  { name: 'Mobile', rows: [
    { special: 'uimode' },
    { special: 'layout' },
    { key: 'btnScale', label: 'Button size', type: 'range', min: 0.7, max: 1.5, step: 0.05, fmt: mul },
    { key: 'btnOpacity', label: 'Button opacity', type: 'range', min: 0.25, max: 1, step: 0.05, fmt: pct },
  ] },
  { name: 'Missions', rows: [{ special: 'missions' }] },
  { name: 'Customize', rows: [{ special: 'customize' }] },
];

export class SettingsUI {
  // game: for graphics changes; editLayout(done): opens the touch layout editor.
  // onCos(cos): called when the player equips a cosmetic (to tell the lobby).
  constructor({ game, mobile, uiMode, uiFromUrl, editLayout, getColor, onCos }) {
    this.game = game;
    this.mobile = mobile;
    this.uiMode = uiMode; // the mode actually in use right now
    this.uiFromUrl = uiFromUrl;
    this.editLayout = editLayout;
    this.getColor = getColor;
    this.onCos = onCos;
    this.tab = 0;
    this.onClose = null;
    $('set-close').onclick = () => this.close();
    $('set-reset').onclick = () => {
      if (!confirm('Reset every setting (including your button layout) to the defaults?')) return;
      resetOpts();
      this.render();
    };
  }

  open(tab = null) {
    if (tab != null) this.tab = TABS.findIndex((t) => t.name === tab);
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

  // ctx lets the main menu host these views: rerender() after a change, goCustomize() for the link.
  special(kind, ctx = {}) {
    const rerender = ctx.rerender || (() => this.render());
    const goCustomize = ctx.goCustomize || (() => this.open('Customize'));
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
    } else if (kind === 'uimode') {
      const names = { auto: 'Auto', phone: 'Phone', tablet: 'Tablet', desktop: 'Desktop' };
      el.innerHTML = `<div class="set-label">Interface mode<small>Now using: ${names[this.uiMode]}${this.uiFromUrl ? ' (set by the link)' : opts.uiMode === 'auto' ? ' (auto-detected)' : ''}. Tablet = bigger HUD, weapon slot bar, portrait allowed. Desktop = keyboard & mouse.</small></div>
        <div class="pick">${Object.keys(names).map((m) => `<button data-m="${m}" class="${opts.uiMode === m ? 'sel' : ''}">${names[m]}</button>`).join('')}</div>`;
      el.querySelectorAll('[data-m]').forEach((b) => {
        b.onclick = () => {
          if (opts.uiMode === b.dataset.m) return;
          setOpt('uiMode', b.dataset.m);
          this.render();
          if (confirm('Reload now to switch the interface? (You will leave any lobby you are in.)')) {
            const url = new URL(location.href);
            for (const k of ['mobile', 'tablet', 'desktop', 'lobby']) url.searchParams.delete(k);
            location.href = url.toString();
          }
        };
      });
    } else if (kind === 'missions') {
      el.className = 'missions';
      const done = MISSIONS.filter(missionDone).length;
      el.innerHTML = `<div class="ms-head"><b>${done} / ${MISSIONS.length}</b> missions complete · each one unlocks a cosmetic for <a href="#" data-go>Customize</a></div>` +
        MISSIONS.map((m) => {
          const v = Math.min(getStat(m.stat), m.goal), ok = v >= m.goal;
          const item = COSMETICS[m.reward[0]].find((c) => c.id === m.reward[1]);
          return `<div class="ms ${ok ? 'done' : ''}">
            <div class="ms-info"><b>${ok ? '✓ ' : ''}${esc(m.name)}</b><small>${esc(m.desc)}</small></div>
            <div class="ms-bar"><i style="width:${(v / m.goal) * 100}%"></i></div>
            <div class="ms-prog">${v}/${m.goal}</div>
            <div class="ms-reward">${SLOT_LABELS[m.reward[0]]}: ${esc(item.name)}</div>
          </div>`;
        }).join('');
      el.querySelector('[data-go]').onclick = (e) => { e.preventDefault(); goCustomize(); };
    } else if (kind === 'customize') {
      el.className = 'customize';
      const cos = getCos();
      el.innerHTML = `<div class="cz-preview"><canvas width="160" height="210"></canvas></div><div class="cz-slots"><div class="cz-flash"></div></div>`;
      drawAvatar(el.querySelector('canvas'), cos, this.getColor());
      const slots = el.querySelector('.cz-slots');
      const equip = (next) => { setCos(next); if (this.onCos) this.onCos(next); rerender(); };
      for (const slot of Object.keys(COSMETICS)) {
        const row = document.createElement('div');
        row.className = 'cz-row';
        row.innerHTML = `<div class="set-label">${SLOT_LABELS[slot]}</div><div class="cz-items">${COSMETICS[slot].map((c) => {
          const open = isUnlocked(slot, c.id), m = missionFor(slot, c.id);
          return `<button class="${cos[slot] === c.id ? 'sel' : ''} ${open ? '' : 'locked'}" data-id="${c.id}" ${open ? '' : `title="Unlock: ${esc(m.name)} (${esc(m.desc)})"`}>${open ? '' : '🔒 '}${esc(c.name)}</button>`;
        }).join('')}</div>`;
        row.querySelectorAll('[data-id]').forEach((b) => {
          b.onclick = () => {
            if (!isUnlocked(slot, b.dataset.id)) {
              const m = missionFor(slot, b.dataset.id);
              const f = el.querySelector('.cz-flash');
              f.textContent = `🔒 Complete “${m.name}”: ${m.desc}`;
              f.classList.add('show');
              clearTimeout(this.flashT);
              this.flashT = setTimeout(() => f.classList.remove('show'), 2600);
              return;
            }
            equip({ ...cos, [slot]: b.dataset.id });
          };
        });
        slots.appendChild(row);
        if (slot === 'hair') {
          const hc = document.createElement('div');
          hc.className = 'cz-row';
          hc.innerHTML = `<div class="set-label">Hair color</div><div class="swatches">${HAIR_COLORS.map((c) => `<button style="background:${c}" class="${cos.hairColor === c ? 'sel' : ''}" data-c="${c}"></button>`).join('')}</div>`;
          hc.querySelectorAll('[data-c]').forEach((b) => { b.onclick = () => equip({ ...cos, hairColor: b.dataset.c }); });
          slots.appendChild(hc);
        }
      }
      const note = document.createElement('div');
      note.className = 'cz-note';
      note.textContent = 'Other players see these on your character. Locked items unlock from Missions.';
      slots.appendChild(note);
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

// Front-view sketch of the character with its cosmetics, for the Customize tab.
function drawAvatar(canvas, cos, body) {
  const g = canvas.getContext('2d');
  const W = canvas.width;
  g.clearRect(0, 0, W, canvas.height);
  const cx = W / 2, R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(cx + x, y, w, h); };
  const hair = cos.hairColor, skin = '#d6a682', dark = '#2c3036';
  // Back items peeking out behind the body
  if (cos.back === 'cape') R(-40, 112, 80, 88, body);
  if (cos.back === 'jetpack') { R(-46, 108, 14, 52, '#9aa1a8'); R(32, 108, 14, 52, '#9aa1a8'); R(-44, 160, 10, 14, '#ffb347'); R(34, 160, 10, 14, '#ffb347'); }
  if (cos.back === 'backpack') { R(-44, 112, 10, 44, dark); R(34, 112, 10, 44, dark); }
  // Legs, body, vest, arms
  R(-26, 168, 22, 40, '#2b2f36'); R(4, 168, 22, 40, '#2b2f36');
  R(-36, 106, 72, 66, body);
  R(-30, 116, 60, 40, '#3b4030');
  for (let i = -1; i <= 1; i++) R(i * 18 - 7, 132, 14, 16, '#4a5038');
  R(-50, 108, 14, 54, body); R(36, 108, 14, 54, body);
  R(-50, 160, 14, 12, '#1e1f22'); R(36, 160, 14, 12, '#1e1f22');
  // Head
  const hx = -28, hy = 48, hs = 56;
  const covered = ['helmet', 'cap', 'beanie', 'cowboy', 'tophat', 'viking'].includes(cos.hat);
  if (cos.hair === 'long') R(hx - 4, hy + 6, hs + 8, 58, hair);
  R(hx, hy, hs, hs, skin);
  R(hx + 14, hy + 22, 8, 8, '#222'); R(hx + 34, hy + 22, 8, 8, '#222');
  if (cos.hair === 'short' || (covered && ['mohawk', 'spiky'].includes(cos.hair))) R(hx, hy - 6, hs, 12, hair);
  if (cos.hair === 'long' && !covered) R(hx - 2, hy - 6, hs + 4, 12, hair);
  if (cos.hair === 'mohawk' && !covered) R(-6, hy - 24, 12, 26, hair);
  if (cos.hair === 'spiky' && !covered) {
    g.fillStyle = hair;
    for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(cx + hx + i * 11 + 1, hy + 2); g.lineTo(cx + hx + i * 11 + 6, hy - 18); g.lineTo(cx + hx + i * 11 + 12, hy + 2); g.fill(); }
  }
  // Face
  if (cos.face === 'goggles') { R(hx - 2, hy + 18, hs + 4, 14, '#141518'); R(hx + 8, hy + 20, 16, 10, '#1a3a5a'); R(hx + 32, hy + 20, 16, 10, '#1a3a5a'); }
  if (cos.face === 'shades') { R(hx + 6, hy + 20, 44, 3, '#141518'); R(hx + 8, hy + 20, 18, 10, '#141518'); R(hx + 30, hy + 20, 18, 10, '#141518'); }
  if (cos.face === 'bandana') R(hx - 2, hy + 34, hs + 4, 22, '#c0262d');
  if (cos.face === 'mustache') { R(hx + 16, hy + 38, 24, 5, '#3b2a1e'); R(hx + 12, hy + 41, 6, 4, '#3b2a1e'); R(hx + 38, hy + 41, 6, 4, '#3b2a1e'); }
  // Hat
  const hat = {
    helmet: () => { R(hx - 4, hy - 16, hs + 8, 24, body); R(hx - 6, hy + 4, hs + 12, 6, dark); },
    cap: () => { R(hx, hy - 12, hs, 16, body); R(hx - 10, hy + 2, hs / 2 + 10, 6, body); },
    beanie: () => { R(hx - 2, hy - 18, hs + 4, 24, body); R(hx - 2, hy + 2, hs + 4, 8, dark); g.fillStyle = '#f4f4f4'; g.beginPath(); g.arc(cx, hy - 22, 7, 0, 7); g.fill(); },
    cowboy: () => { R(hx - 22, hy + 2, hs + 44, 6, '#7a4f2a'); R(hx + 6, hy - 22, hs - 12, 26, '#7a4f2a'); R(hx + 6, hy - 4, hs - 12, 5, dark); },
    tophat: () => { R(hx - 10, hy + 2, hs + 20, 5, '#141518'); R(hx + 8, hy - 40, hs - 16, 44, '#141518'); R(hx + 8, hy - 8, hs - 16, 7, '#c0262d'); },
    crown: () => {
      R(hx + 4, hy - 12, hs - 8, 14, '#e8b923'); g.fillStyle = '#e8b923';
      for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(cx + hx + 4 + i * 12, hy - 12); g.lineTo(cx + hx + 10 + i * 12, hy - 26); g.lineTo(cx + hx + 16 + i * 12, hy - 12); g.fill(); }
      R(-4, hy - 8, 8, 6, '#d0213a');
    },
    viking: () => {
      R(hx - 4, hy - 16, hs + 8, 24, '#9aa1a8'); R(hx - 6, hy + 4, hs + 12, 6, '#7a4f2a');
      g.fillStyle = '#efe6cf';
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(cx + s * 30, hy - 4); g.lineTo(cx + s * 52, hy - 34); g.lineTo(cx + s * 34, hy - 12); g.fill(); }
    },
    party: () => { g.fillStyle = '#ff5fb4'; g.beginPath(); g.moveTo(cx - 16, hy + 2); g.lineTo(cx + 4, hy - 44); g.lineTo(cx + 18, hy + 2); g.fill(); g.fillStyle = '#f4f4f4'; g.beginPath(); g.arc(cx + 4, hy - 46, 6, 0, 7); g.fill(); },
    halo: () => { g.strokeStyle = '#ffd84a'; g.lineWidth = 5; g.beginPath(); g.ellipse(cx, hy - 20, 26, 7, 0, 0, 7); g.stroke(); },
    headband: () => { R(hx - 2, hy + 8, hs + 4, 9, '#c0262d'); R(hx + hs, hy + 10, 12, 5, '#c0262d'); },
  }[cos.hat];
  if (hat) hat();
}
