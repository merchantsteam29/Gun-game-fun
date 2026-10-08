import { opts, setOpt, resetOpts } from './settings.js';
import { ACTIONS, binds, setBind, resetBinds, keyName, mouseCode } from './binds.js';
import { store, esc } from './util.js';
import { bannerOf, bannerHtml } from './banners.js';
import { COVERING } from './cosmetics.js';
import * as THREE from 'three';
import { CAMOS, camoOf, camoSwatch } from './camos.js';
import { buildGun } from './models.js';
import { WEAPONS } from './weapons.js';
import { hasMods, cleanMods } from './mods.js';
import { COSMETICS, SLOT_LABELS, HAIR_COLORS, MISSIONS, getStat, missionDone, isOwned, priceOf, buy, getTokens, getCos, setCos, ownsWrap, buyWrap } from './missions.js';

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
    { special: 'keybinds', only: 'desktop' },
  ] },
  { name: 'Controller', rows: [
    { special: 'padinfo' },
    { key: 'padSens', label: 'Look sensitivity', type: 'range', min: 0.2, max: 3, step: 0.05, fmt: mul },
    { key: 'adsSens', label: 'Aiming sensitivity', hint: 'Multiplier while aiming down sights (shared with mouse / touch)', type: 'range', min: 0.2, max: 1.5, step: 0.05, fmt: mul },
    { key: 'padInvertY', label: 'Invert look up / down', type: 'check' },
    { key: 'padDeadzone', label: 'Stick dead zone', hint: 'Raise it if your view drifts on its own', type: 'range', min: 0.04, max: 0.35, step: 0.01, fmt: pct },
    { key: 'aimAssist', label: 'Aim assist', hint: 'Slows your aim on enemies and helps track them while you shoot or aim (controller and touch)', type: 'check' },
    { key: 'aimAssistStrength', label: 'Aim assist strength', type: 'range', min: 0.1, max: 1, step: 0.05, fmt: pct },
    { key: 'padCrouchToggle', label: 'Crouch toggles', hint: 'Off: hold B to stay crouched', type: 'check' },
    { key: 'padAutoSprint', label: 'Auto-sprint', hint: 'Sprint whenever the left stick is pushed all the way forward', type: 'check' },
    { key: 'padVibration', label: 'Vibration', hint: 'When you get hit and when you fire (if your controller and browser support it)', type: 'check' },
    { special: 'padmap' },
  ] },
  { name: 'Video', rows: [
    { key: 'fov', label: 'Field of view', type: 'range', min: 60, max: 110, step: 1, fmt: deg },
    { key: 'vmFov', label: 'Weapon field of view', hint: 'How large your gun and arms look', type: 'range', min: 50, max: 90, step: 1, fmt: deg },
    { key: 'bobbing', label: 'View bobbing', type: 'range', min: 0, max: 1.5, step: 0.05, fmt: pct },
    { special: 'graphics' },
    { key: 'autoRes', label: 'Auto resolution', hint: 'Lowers the resolution a little when the game slows down, so it stays smooth', type: 'check' },
    { key: 'recordClips', label: 'Record highlight clips', hint: 'Off by default. Records the game screen (never your camera) to keep a clip of your best moment each match. Your browser may show a recording icon while it is on. Computers only', type: 'check' },
    { key: 'showFps', label: 'Show FPS counter', type: 'check' },
  ] },
  { name: 'HUD & Audio', rows: [
    { key: 'volume', label: 'Volume', type: 'range', min: 0, max: 1, step: 0.05, fmt: pct },
    { key: 'showChat', label: 'Show party chat', hint: 'Turn off to hide all chat messages', type: 'check' },
    { key: 'voiceVolume', label: 'Voice chat volume', type: 'range', min: 0, max: 1, step: 0.05, fmt: pct },
    { key: 'voicePtt', label: 'Push to talk', hint: 'Only send your voice while holding V (otherwise your mic is open while you\'re in voice)', type: 'check' },
    { key: 'minimap', label: 'Minimap', hint: 'Shows the map, teammates, objectives and enemies who fire unsuppressed', type: 'check' },
    { key: 'hudScale', label: 'HUD size', type: 'range', min: 0.75, max: 1.3, step: 0.05, fmt: mul },
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
  constructor({ game, mobile, uiMode, uiFromUrl, editLayout, getColor, getName, onCos, getMods, onMods }) {
    this.game = game;
    this.mobile = mobile;
    this.uiMode = uiMode; // the mode actually in use right now
    this.uiFromUrl = uiFromUrl;
    this.editLayout = editLayout;
    this.getColor = getColor;
    this.getName = getName || (() => 'Player');
    this.onCos = onCos;
    this.getMods = getMods || (() => ({}));
    this.onMods = onMods || (() => {});
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
    this.tryOn = null;
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

  // ---------- Weapon wraps (Customize) ----------
  // Pick a gun, preview any wrap on it in 3D, buy premium ones with tokens, and apply it to that
  // gun or to every gun. Wraps are looks only and are saved with the gun's attachments.
  wrapsView(rerender) {
    const guns = Object.keys(WEAPONS).filter(hasMods).sort((a, b) => WEAPONS[a].name.localeCompare(WEAPONS[b].name));
    if (!guns.includes(this.wrapGun)) this.wrapGun = guns.includes('ar') ? 'ar' : guns[0];
    const mods = this.getMods();
    const cur = (mods[this.wrapGun] && mods[this.wrapGun].camo) || 'default';
    if (!this.wrapTry || !CAMOS.some((c) => c.id === this.wrapTry)) this.wrapTry = cur;
    const pick = camoOf(this.wrapTry), have = ownsWrap(pick.id), tokens = getTokens();
    const box = document.createElement('div');
    box.className = 'cz-wraps';
    const gunOpts = guns.map((id) => {
      const w = mods[id] && mods[id].camo;
      return `<option value="${id}" ${id === this.wrapGun ? 'selected' : ''}>${esc(WEAPONS[id].name)}${w ? ' · ' + esc(camoOf(w).name) : ''}</option>`;
    }).join('');
    const grid = CAMOS.map((c) => {
      const own = ownsWrap(c.id);
      return `<button class="${c.id === this.wrapTry ? 'trying' : ''} ${c.id === cur ? 'sel' : ''} ${own ? '' : 'locked'}" data-wrap="${c.id}" title="${esc(c.name)}"><i style="background:${camoSwatch(c)}"></i><span>${esc(c.name)}</span>${own ? '' : c.reward ? '<small>🔒 Earn</small>' : `<small>🪙 ${c.price}</small>`}</button>`;
    }).join('');
    let actions;
    if (have) actions = `<button class="primary" data-act="one" ${pick.id === cur ? 'disabled' : ''}>Apply to ${esc(WEAPONS[this.wrapGun].name)}</button><button data-act="all">Apply to all guns</button>`;
    else if (pick.reward) actions = `<span class="wr-need">🔒 ${esc(pick.name)} can't be bought. Earn it: ${esc(pick.how)}.</span>`;
    else if (tokens >= pick.price) actions = `<button class="primary" data-act="buy">Buy ${esc(pick.name)} · 🪙 ${pick.price}</button>`;
    else actions = `<span class="wr-need">${esc(pick.name)} costs 🪙 ${pick.price}. You need ${pick.price - tokens} more: complete Missions to earn tokens.</span>`;
    box.innerHTML = `<div class="set-label">Weapon wraps<small>Looks only: wraps never change stats. Other players see them.</small></div>
      <div class="wr-body">
        <div class="wr-preview"><div class="wr-canvas"></div><select class="wr-gun">${gunOpts}</select></div>
        <div class="wr-side"><div class="wr-grid">${grid}</div><div class="wr-actions">${actions}</div></div>
      </div>`;
    box.querySelector('.wr-canvas').appendChild(this.wrapCanvas());
    this.showWrap(this.wrapGun, this.wrapTry);
    box.querySelector('.wr-gun').onchange = (e) => { this.wrapGun = e.target.value; this.wrapTry = null; rerender(); };
    box.querySelectorAll('[data-wrap]').forEach((b) => { b.onclick = () => { this.wrapTry = b.dataset.wrap; rerender(); }; });
    const save = (ids) => {
      const m = { ...this.getMods() };
      for (const id of ids) {
        const g = cleanMods(id, m[id]);
        if (pick.id === 'default') delete g.camo; else g.camo = pick.id;
        m[id] = g;
      }
      this.onMods(m);
      rerender();
    };
    box.querySelectorAll('[data-act]').forEach((b) => {
      b.onclick = () => {
        if (b.dataset.act === 'buy') { if (buyWrap(pick.id)) save([this.wrapGun]); }
        else if (b.dataset.act === 'one') save([this.wrapGun]);
        else if (confirm(`Put ${pick.name} on every gun?`)) save(guns);
      };
    });
    return box;
  }

  // One small 3D view, reused: a slowly turning gun.
  wrapCanvas() {
    if (!this.wr) {
      const canvas = document.createElement('canvas');
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(2, devicePixelRatio));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      const scene = new THREE.Scene();
      scene.add(new THREE.HemisphereLight('#ffffff', '#40434a', 2.2));
      const key = new THREE.DirectionalLight('#fff4e0', 2.2);
      key.position.set(2, 3, 2);
      const rim = new THREE.DirectionalLight('#9fd0ff', 1.4);
      rim.position.set(-3, 1, -2);
      scene.add(key, rim);
      const camera = new THREE.PerspectiveCamera(30, 2, 0.05, 20);
      camera.position.set(0, 0.25, 2.1);
      camera.lookAt(0, 0, 0);
      const pivot = new THREE.Group();
      scene.add(pivot);
      this.wr = { canvas, renderer, scene, camera, pivot, gun: null, key: '', raf: 0 };
      const loop = () => {
        if (!canvas.isConnected) { this.wr.raf = 0; return; }
        const w = canvas.clientWidth, h = canvas.clientHeight;
        if (w && canvas.width !== Math.round(w * renderer.getPixelRatio())) {
          renderer.setSize(w, h, false);
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
        }
        pivot.rotation.y += 0.008;
        renderer.render(scene, camera);
        this.wr.raf = requestAnimationFrame(loop);
      };
      this.wr.start = () => { if (!this.wr.raf) this.wr.raf = requestAnimationFrame(loop); };
    }
    setTimeout(() => this.wr.start(), 0);
    return this.wr.canvas;
  }

  showWrap(gunId, camo) {
    const wr = this.wr, key = gunId + ':' + camo;
    if (!wr || wr.key === key) return;
    wr.key = key;
    if (wr.gun) { wr.pivot.remove(wr.gun); wr.gun.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
    const g = buildGun(gunId, { ...(this.getMods()[gunId] || {}), camo });
    // Center it and scale it to fit the view.
    const bb = new THREE.Box3().setFromObject(g), size = bb.getSize(new THREE.Vector3()), mid = bb.getCenter(new THREE.Vector3());
    g.position.sub(mid);
    const holder = new THREE.Group();
    holder.add(g);
    holder.scale.setScalar(1.3 / Math.max(size.x, size.y, size.z, 0.01));
    holder.rotation.y = Math.PI / 2;
    wr.pivot.add(holder);
    wr.gun = holder;
  }

  // ctx lets the main menu host these views: rerender() after a change, goCustomize() for the link.
  special(kind, ctx = {}) {
    const rerender = ctx.rerender || (() => this.render());
    const goCustomize = ctx.goCustomize || (() => this.open('Customize'));
    const el = document.createElement('div');
    el.className = 'set-row';
    if (kind === 'graphics') {
      const g = this.game.gfx;
      const names = { potato: 'Low-end', low: 'Low', normal: 'Normal', high: 'High' };
      el.innerHTML = `<div class="set-label">Graphics<small>Low-end: for school laptops and old phones (low resolution, no shadows or decorations, shorter view). Low: no shadows. High: sharpest.</small></div>
        <div class="pick">${Object.entries(names).map(([k, n]) => `<button data-g="${k}" class="${g === k ? 'sel' : ''}">${n}</button>`).join('')}</div>`;
      el.querySelectorAll('[data-g]').forEach((b) => {
        b.onclick = () => {
          this.game.setGfx(b.dataset.g);
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
      const left = MISSIONS.filter((m) => !missionDone(m)).reduce((s, m) => s + m.tokens, 0);
      el.innerHTML = `<div class="ms-head"><span class="tok-pill">🪙 ${getTokens()}</span> <b>${done} / ${MISSIONS.length}</b> complete · ${left} tokens still to earn · spend them in <a href="#" data-go>Customize</a></div>` +
        MISSIONS.map((m) => ({ m, ok: missionDone(m), p: Math.min(getStat(m.stat), m.goal) / m.goal }))
          .sort((a, b) => a.ok - b.ok || b.p - a.p) // closest-to-done first, finished at the bottom
          .map(({ m, ok }) => {
            const v = Math.min(getStat(m.stat), m.goal);
            return `<div class="ms ${ok ? 'done' : ''}">
              <div class="ms-info"><b>${ok ? '✓ ' : ''}${esc(m.name)}</b><small>${esc(m.desc)}</small></div>
              <div class="ms-bar"><i style="width:${(v / m.goal) * 100}%"></i></div>
              <div class="ms-prog">${v}/${m.goal}</div>
              <div class="ms-reward">🪙 ${ok ? 'Earned' : 'Reward'}: ${m.tokens}</div>
            </div>`;
          }).join('');
      el.querySelector('[data-go]').onclick = (e) => { e.preventDefault(); goCustomize(); };
    } else if (kind === 'customize') {
      el.className = 'customize';
      const cos = getCos();
      // Tapping an item you don't own previews it ("try on") until you buy it or pick something else.
      const t = this.tryOn;
      const shown = t ? { ...cos, [t.slot]: t.id } : cos;
      el.innerHTML = `<div class="cz-preview"><canvas width="160" height="210"></canvas><div class="tok-pill big">🪙 ${getTokens()}</div></div>
        <div class="cz-slots"><div class="cz-buy hidden"></div></div>`;
      drawAvatar(el.querySelector('canvas'), shown, this.getColor());
      const slots = el.querySelector('.cz-slots');
      const equip = (next) => { this.tryOn = null; setCos(next); if (this.onCos) this.onCos(next); rerender(); };
      if (t) {
        const item = COSMETICS[t.slot].find((c) => c.id === t.id), price = priceOf(t.slot, t.id), have = getTokens();
        const bar = el.querySelector('.cz-buy');
        bar.classList.remove('hidden');
        bar.innerHTML = item.reward ? `<span>Previewing <b>${esc(item.name)}</b> · 🔒 can't be bought. Earn it: ${esc(item.how)}.</span><button data-cancel>OK</button>`
          : have >= price
          ? `<span>Previewing <b>${esc(item.name)}</b></span><button class="primary" data-buy>Buy & wear · 🪙 ${price}</button><button data-cancel>Cancel</button>`
          : `<span>Previewing <b>${esc(item.name)}</b> · 🪙 ${price}. You need <b>${price - have}</b> more tokens. Complete missions to earn them.</span><button data-cancel>OK</button>`;
        const b = bar.querySelector('[data-buy]');
        if (b) b.onclick = () => { if (buy(t.slot, t.id)) equip({ ...cos, [t.slot]: t.id }); };
        bar.querySelector('[data-cancel]').onclick = () => { this.tryOn = null; rerender(); };
      }
      for (const slot of Object.keys(COSMETICS)) {
        const row = document.createElement('div');
        row.className = 'cz-row';
        if (slot === 'banner') {
          // Banners are picked from real previews; the big one shows how your kills will see you.
          row.innerHTML = `<div class="set-label">Banner<small>Shown behind your name on the death screen of everyone you kill</small></div>
            <div class="cz-bnr-preview">${bannerHtml(shown.banner, this.getName(), this.getColor(), 'KILLED YOU', '<span class="chip">Assault Rifle</span>')}</div>
            <div class="cz-banners">${COSMETICS.banner.map((c) => {
              const have = isOwned(slot, c.id), trying = t && t.slot === slot && t.id === c.id, b = bannerOf(c.id);
              return `<button class="${cos.banner === c.id && !t ? 'sel' : ''} ${trying ? 'trying' : ''} ${have ? '' : 'locked'}" data-id="${c.id}" style="--bg:${b.bg}" title="${esc(c.name)}"><em>${b.emblem}</em><span>${esc(c.name)}</span>${have ? '' : c.reward ? '<small>🔒 Earn</small>' : `<small>🪙 ${c.price}</small>`}</button>`;
            }).join('')}</div>`;
        } else
        row.innerHTML = `<div class="set-label">${SLOT_LABELS[slot]}</div><div class="cz-items">${COSMETICS[slot].map((c) => {
          const have = isOwned(slot, c.id), trying = t && t.slot === slot && t.id === c.id;
          return `<button class="${cos[slot] === c.id && !t ? 'sel' : ''} ${trying ? 'trying' : ''} ${have ? '' : 'locked'}" data-id="${c.id}">${esc(c.name)}${have ? '' : `<small>🪙 ${c.price}</small>`}</button>`;
        }).join('')}</div>`;
        row.querySelectorAll('[data-id]').forEach((b) => {
          b.onclick = () => {
            const id = b.dataset.id;
            if (isOwned(slot, id)) equip({ ...cos, [slot]: id });
            else { this.tryOn = { slot, id }; rerender(); }
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
      note.textContent = 'Tap anything to preview it. Earn tokens from Missions and spend them on whatever you like. Other players see what you wear.';
      slots.appendChild(note);
      el.appendChild(this.wrapsView(rerender));
    } else if (kind === 'keybinds') {
      // Two keys per action. Click one, then press a key or a mouse button (middle / side
      // buttons); Esc cancels, Backspace clears. A key used elsewhere moves to this action.
      const b = binds();
      el.className = 'set-row keybinds';
      el.innerHTML = `<div class="set-label">Key bindings<small>Click a box, then press a key or mouse button (middle / side). Esc cancels, Backspace clears. Left / right mouse stay fire / aim.</small></div>
        <div class="kb-table">${ACTIONS.map(([id, name]) => `<div class="kb-row"><span>${name}</span>${[0, 1].map((i) =>
          `<button class="kb-key ${b[id][i] ? '' : 'empty'}" data-a="${id}" data-i="${i}">${esc(keyName(b[id][i]))}</button>`).join('')}</div>`).join('')}</div>
        <button class="kb-reset">Reset keys to default</button>`;
      el.querySelectorAll('.kb-key').forEach((btn) => {
        btn.onclick = (e) => {
          e.stopPropagation();
          el.querySelectorAll('.kb-key.listen').forEach((x) => x.classList.remove('listen'));
          btn.classList.add('listen');
          btn.textContent = 'Press a key…';
          this.capture = { action: btn.dataset.a, slot: Number(btn.dataset.i) };
        };
      });
      el.querySelector('.kb-reset').onclick = () => { resetBinds(); this.capture = null; rerender(); };
      if (!this.captureBound) {
        this.captureBound = true;
        const finish = (code) => {
          const c = this.capture;
          this.capture = null;
          if (code !== undefined) setBind(c.action, c.slot, code);
          rerender();
        };
        // Capture phase: runs before the game's and menus' own key handlers.
        window.addEventListener('keydown', (e) => {
          if (!this.capture) return;
          e.preventDefault();
          e.stopImmediatePropagation();
          if (e.code === 'Escape') finish();
          else if (e.code === 'Backspace' || e.code === 'Delete') finish(null);
          else finish(e.code);
        }, true);
        window.addEventListener('mousedown', (e) => {
          if (!this.capture) return;
          const mc = mouseCode(e.button);
          if (!mc) { if (!e.target.classList || !e.target.classList.contains('kb-key')) finish(); return; }
          e.preventDefault();
          e.stopImmediatePropagation();
          finish(mc);
        }, true);
      }
    } else if (kind === 'padinfo') {
      const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
      el.innerHTML = `<div class="set-label">Controller<small>${pads.length
        ? `Connected: ${esc(pads[0].id.replace(/\(.*?\)/g, '').trim().slice(0, 60))}`
        : 'No controller detected. Plug one in or pair it over Bluetooth, then press any button.'}</small></div>`;
    } else if (kind === 'padmap') {
      const map = [
        ['L stick', 'Move'], ['R stick', 'Look'], ['RT', 'Fire'], ['LT', 'Aim'], ['A', 'Jump'], ['B', 'Crouch / slide'],
        ['X', 'Reload'], ['Y', 'Switch weapon'], ['RB', 'Grenade'], ['LB / R3', 'Melee'], ['L3', 'Sprint'],
        ['D-pad ◀ ▶', 'Prev / next weapon'], ['D-pad ▲', 'Melee weapon'], ['D-pad ▼', 'Inspect'], ['View', 'Scoreboard'], ['Menu', 'Pause'],
      ];
      el.className = 'set-row pad-row';
      el.innerHTML = `<div class="set-label">Button layout<small>In menus: D-pad or left stick to move, A select, B back, LB / RB switch sections.</small>
        <div class="pad-map">${map.map(([b, a]) => `<span><kbd>${b}</kbd>${a}</span>`).join('')}</div></div>`;
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
  if (cos.back === 'wings') {
    g.fillStyle = '#f4f4f4';
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(cx + s * 30, 116); g.quadraticCurveTo(cx + s * 78, 92, cx + s * 74, 150); g.quadraticCurveTo(cx + s * 52, 136, cx + s * 30, 150); g.fill(); }
  }
  if (cos.back === 'sword') { R(30, 84, 6, 60, '#cfd5da'); R(24, 140, 18, 5, '#e8b923'); R(30, 145, 6, 18, '#141518'); }
  if (cos.back === 'staff') { R(38, 60, 5, 120, '#7a4f2a'); g.fillStyle = '#7dd3ff'; g.beginPath(); g.arc(cx + 40, 58, 8, 0, 7); g.fill(); }
  if (cos.back === 'guitar') { g.fillStyle = '#b5462a'; g.beginPath(); g.ellipse(cx - 38, 150, 16, 20, 0.2, 0, 7); g.fill(); R(-42, 96, 6, 46, '#53321a'); }
  if (cos.back === 'quiver') { R(30, 70, 12, 70, '#7a4f2a'); for (let i = 0; i < 3; i++) { R(31 + i * 4, 58, 2, 14, '#53321a'); R(30 + i * 4, 52, 4, 7, i % 2 ? '#c0262d' : '#f4f4f4'); } }
  if (cos.back === 'surfboard') { g.fillStyle = '#29c4b8'; g.beginPath(); g.ellipse(cx + 40, 118, 18, 76, 0.35, 0, 7); g.fill(); }
  if (cos.back === 'shield') { g.fillStyle = '#53321a'; g.beginPath(); g.arc(cx - 40, 140, 30, 0, 7); g.fill(); g.strokeStyle = '#9aa1a8'; g.lineWidth = 4; g.stroke(); g.fillStyle = '#e8b923'; g.beginPath(); g.arc(cx - 40, 140, 7, 0, 7); g.fill(); }
  if (cos.back === 'demon') {
    g.fillStyle = '#3a0a12';
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(cx + s * 30, 112); g.lineTo(cx + s * 80, 84); g.lineTo(cx + s * 72, 118); g.lineTo(cx + s * 62, 108); g.lineTo(cx + s * 58, 138); g.lineTo(cx + s * 46, 124); g.lineTo(cx + s * 30, 150); g.fill(); }
  }
  // Legs, body, vest, arms
  R(-26, 168, 22, 40, '#2b2f36'); R(4, 168, 22, 40, '#2b2f36');
  R(-36, 106, 72, 66, body);
  R(-30, 116, 60, 40, '#3b4030');
  for (let i = -1; i <= 1; i++) R(i * 18 - 7, 132, 14, 16, '#4a5038');
  R(-50, 108, 14, 54, body); R(36, 108, 14, 54, body);
  R(-50, 160, 14, 12, '#1e1f22'); R(36, 160, 14, 12, '#1e1f22');
  // Head
  const hx = -28, hy = 48, hs = 56;
  const covered = COVERING.includes(cos.hat);
  if (cos.hair === 'long') R(hx - 4, hy + 6, hs + 8, 58, hair);
  if (cos.hair === 'ponytail') R(hx + hs - 4, hy + 18, 10, 40, hair);
  if (cos.hair === 'mullet') R(hx - 2, hy + 30, hs + 4, 34, hair);
  if (cos.hair === 'afro' && !covered) { g.fillStyle = hair; g.beginPath(); g.arc(cx, hy + 10, 42, 0, 7); g.fill(); }
  R(hx, hy, hs, hs, skin);
  R(hx + 14, hy + 22, 8, 8, '#222'); R(hx + 34, hy + 22, 8, 8, '#222');
  if (cos.hair === 'bun' && !covered) { g.fillStyle = hair; g.beginPath(); g.arc(cx, hy - 14, 13, 0, 7); g.fill(); }
  if (['short', 'ponytail', 'bun', 'mullet'].includes(cos.hair) || (covered && ['mohawk', 'spiky', 'afro'].includes(cos.hair))) R(hx, hy - 6, hs, 12, hair);
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
  if (cos.face === 'eyepatch') { R(hx + 30, hy + 19, 16, 13, '#141518'); R(hx, hy + 14, hs, 3, '#141518'); }
  if (cos.face === 'clown') { g.fillStyle = '#e8262d'; g.beginPath(); g.arc(cx, hy + 33, 7, 0, 7); g.fill(); }
  if (cos.face === 'gasmask') { R(hx + 4, hy + 16, hs - 8, 36, '#3b4030'); R(hx + 9, hy + 20, 14, 10, '#1a3a5a'); R(hx + 33, hy + 20, 14, 10, '#1a3a5a'); g.fillStyle = '#2c3036'; g.beginPath(); g.arc(cx, hy + 44, 9, 0, 7); g.fill(); }
  if (cos.face === 'beard') { R(hx - 2, hy + 34, hs + 4, 26, '#4a3220'); R(hx - 2, hy + 18, 6, 18, '#4a3220'); R(hx + hs - 4, hy + 18, 6, 18, '#4a3220'); R(hx + 18, hy + 38, 20, 4, skin); }
  if (cos.face === 'monocle') { g.strokeStyle = '#e8b923'; g.lineWidth = 3; g.beginPath(); g.arc(cx + 10, hy + 26, 9, 0, 7); g.stroke(); R(18, hy + 34, 2, 22, '#e8b923'); }
  if (cos.face === 'visor') { R(hx - 2, hy + 18, hs + 4, 12, '#19d6ff'); R(hx - 2, hy + 22, hs + 4, 3, '#bff8ff'); }
  if (cos.face === 'skull') {
    R(hx + 2, hy + 4, hs - 4, hs - 4, '#ece6d6'); R(hx + 10, hy + 18, 14, 12, '#141518'); R(hx + 32, hy + 18, 14, 12, '#141518'); R(-3, hy + 33, 6, 7, '#141518');
    for (let i = 0; i < 5; i++) R(hx + 12 + i * 7, hy + 44, 4, 6, '#141518');
  }
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
    pirate: () => {
      g.fillStyle = '#141518'; g.beginPath(); g.moveTo(cx - 40, hy + 4); g.quadraticCurveTo(cx, hy - 40, cx + 40, hy + 4); g.fill();
      g.fillStyle = '#f4f4f4'; g.beginPath(); g.arc(cx, hy - 12, 5, 0, 7); g.fill();
    },
    chef: () => { R(hx + 2, hy - 8, hs - 4, 12, '#f4f4f4'); g.fillStyle = '#f4f4f4'; g.beginPath(); g.arc(cx - 12, hy - 18, 14, 0, 7); g.arc(cx + 12, hy - 18, 14, 0, 7); g.arc(cx, hy - 26, 15, 0, 7); g.fill(); },
    wizard: () => {
      g.fillStyle = '#3a2a8a'; g.beginPath(); g.moveTo(cx - 36, hy + 4); g.lineTo(cx + 6, hy - 58); g.lineTo(cx + 36, hy + 4); g.fill();
      R(hx - 10, hy, hs + 20, 6, '#3a2a8a'); g.fillStyle = '#ffd84a'; g.beginPath(); g.arc(cx - 4, hy - 20, 4, 0, 7); g.fill();
    },
    bunny: () => { for (const s of [-1, 1]) { R(s * 14 - 6, hy - 40, 12, 42, '#f4f4f4'); R(s * 14 - 3, hy - 34, 6, 30, '#ffb6c8'); } },
    catears: () => {
      for (const s of [-1, 1]) {
        g.fillStyle = body; g.beginPath(); g.moveTo(cx + s * 26, hy + 2); g.lineTo(cx + s * 22, hy - 20); g.lineTo(cx + s * 8, hy + 2); g.fill();
      }
    },
    sombrero: () => {
      g.fillStyle = '#d9a441'; g.beginPath(); g.ellipse(cx, hy + 2, 62, 10, 0, 0, 7); g.fill();
      R(hx + 8, hy - 26, hs - 16, 28, '#d9a441'); R(hx + 8, hy - 8, hs - 16, 6, '#c0262d');
    },
    beret: () => { g.fillStyle = '#8a1c24'; g.beginPath(); g.ellipse(cx + 6, hy - 2, 36, 12, -0.15, 0, 7); g.fill(); R(4, hy - 16, 5, 6, '#8a1c24'); },
    propeller: () => {
      R(hx, hy - 12, hs, 16, body); R(-2, hy - 26, 4, 14, '#2c3036');
      R(-28, hy - 30, 26, 5, '#c0262d'); R(2, hy - 30, 26, 5, '#2f6fd8'); g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(cx, hy - 28, 4, 0, 7); g.fill();
    },
    santa: () => {
      g.fillStyle = '#c0262d'; g.beginPath(); g.moveTo(cx - 30, hy); g.lineTo(cx + 34, hy - 40); g.lineTo(cx + 30, hy); g.fill();
      R(hx - 4, hy - 4, hs + 8, 12, '#f4f4f4'); g.fillStyle = '#f4f4f4'; g.beginPath(); g.arc(cx + 36, hy - 40, 8, 0, 7); g.fill();
    },
    antlers: () => {
      for (const s of [-1, 1]) {
        R(s * 18 - 2, hy - 30, 5, 32, '#8a6a44'); R(s > 0 ? 16 : -32, hy - 30, 16, 5, '#8a6a44'); R(s * 30 - 2, hy - 44, 5, 16, '#8a6a44'); R(s * 10 - 2, hy - 42, 5, 14, '#8a6a44');
      }
    },
    samurai: () => {
      g.fillStyle = '#1c1416'; g.beginPath(); g.moveTo(cx - 46, hy + 22); g.lineTo(cx - 32, hy - 4); g.lineTo(cx + 32, hy - 4); g.lineTo(cx + 46, hy + 22); g.fill();
      R(hx - 4, hy - 18, hs + 8, 22, '#1c1416');
      g.strokeStyle = '#e8b923'; g.lineWidth = 4; g.beginPath(); g.arc(cx, hy - 14, 24, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
    },
    astro: () => {
      g.fillStyle = 'rgba(191,230,255,0.28)'; g.strokeStyle = '#e8eef4'; g.lineWidth = 3; g.beginPath(); g.arc(cx, hy + 28, 46, 0, 7); g.fill(); g.stroke();
      R(-40, hy + 66, 80, 10, '#f4f4f4');
    },
  }[cos.hat];
  if (hat) hat();
}
