import { MODES, MODE_ORDER, TEAM_COLORS, ZOMBIE_COLOR } from './host.js';
import { MAPS, MAP_ORDER } from './maps.js';
import { esc } from './util.js';
import { WEAPON_RULES, RULE_PRESETS, presetRules, savedPresets, savePreset, deletePreset, shareCode, readCode, RULE_DEFAULTS } from './rulesets.js';

const $ = (id) => document.getElementById(id);

const RULES = [
  { key: 'scoreLimit', label: 'Score limit', type: 'num', min: 1, max: 500 },
  { key: 'timeLimit', label: 'Time limit (min)', type: 'num', min: 1, max: 60 },
  { key: 'health', label: 'Player health', type: 'num', min: 10, max: 1000 },
  { key: 'respawn', label: 'Respawn delay (s)', type: 'num', min: 0, max: 30 },
  { key: 'infiniteAmmo', label: 'Infinite ammo & grenades', type: 'check' },
  { key: 'headshotsOnly', label: 'Headshots only (guns)', type: 'check' },
  { key: 'friendlyFire', label: 'Friendly fire (TDM)', type: 'check' },
  { key: 'pickups', label: 'Map pickups (health, ammo, power weapon)', type: 'check' },
  { key: 'oneShot', label: 'One shot kills', type: 'check' },
  { key: 'weapons', label: 'Weapons', type: 'select', options: Object.entries(WEAPON_RULES).map(([k, v]) => [k, v.name]) },
];
const PHYSICS = [
  { key: 'gameSpeed', label: 'Game speed', min: 0.25, max: 2, step: 0.05 },
  { key: 'moveSpeed', label: 'Move speed', min: 0.5, max: 2.5, step: 0.05 },
  { key: 'jump', label: 'Jump height', min: 0.5, max: 3, step: 0.05 },
  { key: 'gravity', label: 'Gravity', min: 0.2, max: 2, step: 0.05 },
];

// Host-only controls. Talks to HostLogic directly (it runs in this browser).
export class HostPanel {
  constructor() {
    this.logic = null;
    this.onClose = null;
    $('hp-close').onclick = () => this.close();
    $('hp-restart').onclick = () => {
      this.logic.s.rotate = $('hp-rotate').checked;
      this.logic.startMatch($('hp-mode').value, $('hp-map').value);
      this.close();
    };
    $('hp-rotate').onchange = () => this.logic.applySettings({ rotate: $('hp-rotate').checked });
    $('hp-addbot').onclick = () => { this.logic.addBot($('hp-botdiff').value); this.renderPlayers(); };
    $('hp-fill').onclick = () => {
      while (this.logic.players.size < 8) this.logic.addBot($('hp-botdiff').value);
      this.renderPlayers();
    };
    $('hp-clearbots').onclick = () => {
      for (const p of [...this.logic.players.values()]) if (p.bot) this.logic.removePlayer(p.id);
      this.renderPlayers();
    };
  }

  open(logic) {
    this.logic = logic;
    const s = logic.s;
    $('hp-mode').innerHTML = MODE_ORDER.map((m) => `<option value="${m}">${MODES[m].name}</option>`).join('');
    $('hp-map').innerHTML = MAP_ORDER.map((m) => `<option value="${m}">${MAPS[m].name}</option>`).join('');
    $('hp-mode').value = s.mode;
    $('hp-map').value = s.map;
    $('hp-rotate').checked = s.rotate;
    this.renderRules();
    this.renderPhysics();
    this.renderPlayers();
    $('host-panel').classList.remove('hidden');
    clearInterval(this.timer);
    this.timer = setInterval(() => this.renderPlayers(), 1000);
  }

  close() {
    clearInterval(this.timer);
    $('host-panel').classList.add('hidden');
    if (this.onClose) this.onClose();
  }

  // Rule presets: built-in and saved ones, plus share codes.
  renderPresets(el) {
    const all = [...RULE_PRESETS, ...savedPresets()];
    const box = document.createElement('div');
    box.className = 'hp-presets';
    box.innerHTML = `<div class="hp-preset-row"><select id="hp-preset">${all.map((p) => `<option value="${esc(p.id)}" ${p.name === this.logic.s.rulesName ? 'selected' : ''}>${p.saved ? '★ ' : ''}${esc(p.name)}: ${esc(p.desc)}</option>`).join('')}</select><button class="primary" id="hp-preset-use">Use</button></div>
      <div class="hp-preset-row"><button id="hp-preset-save">Save current…</button><button id="hp-preset-share">Copy share code</button><button id="hp-preset-code">Use a code…</button><button id="hp-preset-del" class="ghost">Delete saved</button></div>`;
    el.appendChild(box);
    const apply = (name, rules) => {
      this.logic.applySettings({ ...rules, rulesName: name === 'Classic' ? '' : name });
      this.renderRules();
      this.renderPhysics();
      if (this.onRules) this.onRules();
    };
    box.querySelector('#hp-preset-use').onclick = () => { const p = all.find((x) => x.id === box.querySelector('#hp-preset').value); if (p) apply(p.name, presetRules(p)); };
    const current = () => { const r = {}; for (const k of Object.keys(RULE_DEFAULTS)) r[k] = this.logic.s[k]; return r; };
    box.querySelector('#hp-preset-save').onclick = () => {
      const name = prompt('Name these rules:', this.logic.s.rulesName || 'My rules');
      if (!name || !name.trim()) return;
      const p = savePreset(name.trim(), current());
      this.logic.applySettings({ rulesName: p.name });
      this.renderRules();
    };
    box.querySelector('#hp-preset-share').onclick = async () => {
      const code = shareCode(this.logic.s.rulesName || 'Custom', current());
      try { await navigator.clipboard.writeText(code); alert('Share code copied:\n' + code); } catch { prompt('Copy this share code:', code); }
    };
    box.querySelector('#hp-preset-code').onclick = () => {
      const code = prompt('Paste a rules code (R-…):');
      if (!code) return;
      const r = readCode(code);
      if (!r) { alert('That code didn\'t work.'); return; }
      if (confirm(`Use "${r.name}" and save it to your presets?`)) { savePreset(r.name, r.rules); apply(r.name, r.rules); }
    };
    box.querySelector('#hp-preset-del').onclick = () => {
      const p = savedPresets().find((x) => x.id === box.querySelector('#hp-preset').value);
      if (!p) { alert('Pick one of your saved presets (★) first.'); return; }
      if (confirm(`Delete "${p.name}"?`)) { deletePreset(p.id); this.renderRules(); }
    };
    box.querySelectorAll('select').forEach((x) => x.addEventListener('keydown', (e) => e.stopPropagation()));
  }

  renderRules() {
    const s = this.logic.s, el = $('hp-rules');
    el.innerHTML = '';
    if (s.ranked) { el.innerHTML = '<div class="note">🏆 Ranked server: standard rules, so ratings are fair. They can\'t be changed.</div>'; return; }
    this.renderPresets(el);
    for (const r of RULES) {
      const row = document.createElement('label');
      if (r.type === 'select') {
        row.className = 'num';
        row.innerHTML = `<span>${r.label}</span><select>${r.options.map(([v, l]) => `<option value="${v}" ${s[r.key] === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
        row.querySelector('select').onchange = (e) => this.logic.applySettings({ [r.key]: e.target.value });
      } else if (r.type === 'check') {
        row.className = 'check';
        row.innerHTML = `<input type="checkbox" ${s[r.key] ? 'checked' : ''}> ${r.label}`;
        row.querySelector('input').onchange = (e) => this.logic.applySettings({ [r.key]: e.target.checked });
      } else {
        row.className = 'num';
        row.innerHTML = `<span>${r.label}</span><input type="number" min="${r.min}" max="${r.max}" value="${s[r.key]}">`;
        row.querySelector('input').onchange = (e) => {
          const v = Math.max(r.min, Math.min(r.max, Number(e.target.value) || r.min));
          e.target.value = v;
          this.logic.applySettings({ [r.key]: v });
        };
      }
      el.appendChild(row);
    }
  }

  renderPhysics() {
    const s = this.logic.s, el = $('hp-physics');
    el.innerHTML = '';
    for (const p of PHYSICS) {
      const row = document.createElement('label');
      row.className = 'slider';
      row.innerHTML = `<span>${p.label}</span><input type="range" min="${p.min}" max="${p.max}" step="${p.step}" value="${s[p.key]}"><span>${Number(s[p.key]).toFixed(2)}×</span>`;
      const input = row.querySelector('input'), out = row.querySelectorAll('span')[1];
      input.oninput = () => {
        out.textContent = Number(input.value).toFixed(2) + '×';
        this.logic.applySettings({ [p.key]: Number(input.value) });
      };
      el.appendChild(row);
    }
    const reset = document.createElement('button');
    reset.textContent = 'Reset physics';
    reset.onclick = () => {
      this.logic.applySettings({ gameSpeed: 1, moveSpeed: 1, jump: 1, gravity: 1 });
      this.renderPhysics();
    };
    el.appendChild(reset);
  }

  renderPlayers() {
    const L = this.logic, el = $('hp-players');
    if (!L) return;
    const teams = MODES[L.s.mode].teams;
    const rows = [...L.players.values()];
    // Don't rebuild while the host is using a dropdown.
    if (el.contains(document.activeElement) && document.activeElement.tagName === 'SELECT') return;
    el.innerHTML = '';
    for (const p of rows) {
      const row = document.createElement('div');
      row.className = 'prow';
      const color = MODES[L.s.mode].infect && p.team === 2 ? ZOMBIE_COLOR : teams && TEAM_COLORS[p.team] ? TEAM_COLORS[p.team] : p.color;
      row.innerHTML = `<span class="dot" style="background:${esc(color)}"></span><span class="nm">${esc(p.name)}${p.id === 'host' ? ' (you)' : ''}${p.acStrikes ? ` <em class="ac-flag" title="Anti-cheat: ${esc(p.acWhy || '')} (${p.acStrikes}×)">⚠ ${p.acStrikes}</em>` : ''}</span>`;
      if (p.bot) {
        const sel = document.createElement('select');
        sel.innerHTML = ['auto', 'easy', 'normal', 'hard'].map((d) => `<option value="${d}" ${p.bot.difficulty === d ? 'selected' : ''}>${d}</option>`).join('');
        sel.onchange = () => L.setBotDifficulty(p.id, sel.value);
        row.appendChild(sel);
      }
      if (MODES[L.s.mode].redBlue) {
        const b = document.createElement('button');
        b.textContent = p.team === 1 ? '→ Blue' : '→ Red';
        b.onclick = () => { L.setTeam(p.id, p.team === 1 ? 2 : 1); this.renderPlayers(); };
        row.appendChild(b);
      }
      if (p.id !== 'host') {
        const k = document.createElement('button');
        k.className = 'danger';
        k.textContent = p.bot ? 'Remove' : 'Kick';
        k.onclick = () => { L.kick(p.id); setTimeout(() => this.renderPlayers(), 400); };
        row.appendChild(k);
      }
      el.appendChild(row);
    }
  }
}
