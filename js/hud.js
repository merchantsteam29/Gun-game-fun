import { WEAPONS, SLOT_NAMES, SHORT } from './weapons.js';
import { esc } from './util.js';

const $ = (id) => document.getElementById(id);
const W_LABEL = SHORT;

export class Hud {
  constructor() {
    this.el = $('hud');
    this.crosshair = $('crosshair');
    this.hitmarker = $('hitmarker');
    this.vignette = $('vignette');
    this.dmgDir = $('dmg-dir');
    this.notice = $('notice');
    this.killfeed = $('killfeed');
    this.timers = {};
    this.lastSlots = '';
  }

  show(v) { this.el.classList.toggle('hidden', !v); }

  lobby(code, count, mapName) {
    const html = `LOBBY <b>${esc(code)}</b> · ${count} player${count === 1 ? '' : 's'} · ${esc(mapName)}`;
    if (html !== this.lastLobby) { this.lastLobby = html; $('lobby-tag').innerHTML = html; }
  }

  health(hp, max = 100) {
    $('hp-num').textContent = Math.max(0, Math.ceil(hp));
    const f = $('hp-fill');
    const pct = Math.max(0, Math.min(100, (hp / max) * 100));
    f.style.width = pct + '%';
    f.classList.toggle('low', pct <= 35);
  }

  modeBar(html) {
    if (html !== this.lastMode) { this.lastMode = html; $('mode-bar').innerHTML = html; }
  }

  ammo(id, cur, mag, frags) {
    const w = WEAPONS[id];
    $('wname').textContent = w.name;
    const c = $('ammo-cur');
    if (w.type === 'melee') { c.textContent = '∞'; $('ammo-mag').textContent = ''; c.classList.remove('low'); return; }
    if (w.type === 'throw') { c.textContent = frags; $('ammo-mag').textContent = '/ ' + w.count; c.classList.toggle('low', frags === 0); return; }
    c.textContent = cur;
    $('ammo-mag').textContent = '/ ' + mag;
    c.classList.toggle('low', cur <= Math.ceil(mag * 0.25));
  }

  slots(loadout, slot, frags) {
    const key = loadout.join() + slot + frags;
    if (key === this.lastSlots) return;
    this.lastSlots = key;
    $('slots').innerHTML = loadout.map((id, i) =>
      `<div class="${i === slot ? 'sel' : ''} ${i === 3 && frags === 0 ? 'off' : ''}" title="${SLOT_NAMES[i]}"><b>${i + 1}</b>${W_LABEL[id]}${i === 3 ? ' ×' + frags : ''}</div>`
    ).join('');
  }

  reloading(v) { $('reload-hint').classList.toggle('show', v); }

  scope(v) {
    $('scope').classList.toggle('hidden', !v);
    this.crosshair.classList.toggle('hidden', v);
  }

  spread(px, ads) {
    this.crosshair.style.setProperty('--gap', Math.round(4 + px) + 'px');
    this.crosshair.classList.toggle('ads', ads);
  }

  hit(kind) {
    const h = this.hitmarker;
    h.classList.remove('kill', 'head');
    if (kind) h.classList.add(kind);
    h.classList.add('show');
    clearTimeout(this.timers.hit);
    this.timers.hit = setTimeout(() => h.classList.remove('show'), kind === 'kill' ? 220 : 90);
  }

  damage(angle) {
    this.vignette.style.opacity = 1;
    clearTimeout(this.timers.vig);
    this.timers.vig = setTimeout(() => { this.vignette.style.opacity = 0; }, 150);
    if (angle != null) {
      this.dmgDir.style.transform = `rotate(${angle}rad)`;
      this.dmgDir.classList.add('show');
      clearTimeout(this.timers.dir);
      this.timers.dir = setTimeout(() => this.dmgDir.classList.remove('show'), 120);
    }
  }

  lowHealth(hp) { if (hp > 0 && hp < 35) this.vignette.style.opacity = 0.5; }

  say(text) {
    this.notice.textContent = text;
    this.notice.classList.add('show');
    clearTimeout(this.timers.notice);
    this.timers.notice = setTimeout(() => this.notice.classList.remove('show'), 1400);
  }

  feed(killer, victim, weapon, head, mine) {
    const d = document.createElement('div');
    if (mine) d.className = 'me';
    const kname = killer && killer !== victim
      ? `<span style="color:${esc(killer.color)}">${esc(killer.name)}</span><span class="w">${W_LABEL[weapon] || weapon}${head ? ' ⌖' : ''}</span>`
      : `<span class="w">${W_LABEL[weapon] || weapon} (self)</span>`;
    d.innerHTML = `${kname}<span style="color:${esc(victim.color)}">${esc(victim.name)}</span>`;
    this.killfeed.prepend(d);
    while (this.killfeed.children.length > 6) this.killfeed.lastChild.remove();
    setTimeout(() => d.remove(), 6000);
  }

  timer(sec, leader) {
    const m = Math.floor(sec / 60), s = sec % 60;
    $('timer').textContent = `${m}:${String(s).padStart(2, '0')}`;
    $('leader').innerHTML = leader ? `Leader: <span style="color:${esc(leader.color)}">${esc(leader.name)}</span> · ${leader.sc}` : '';
  }

  scoreboard(show, players, myId, mode, colorFor) {
    $('scoreboard').classList.toggle('hidden', !show);
    if (!show) return;
    const scoreLabel = { gungame: 'Lvl', koth: 'Pts', infection: 'Inf' }[mode] || 'Score';
    $('sb-head').innerHTML = `<th></th><th>Player</th><th>${scoreLabel}</th><th>K</th><th>D</th>`;
    const rows = [...players.values()].sort((a, b) => (a.team || 0) - (b.team || 0) || b.sc - a.sc || b.k - a.k || a.d - b.d);
    $('sb-body').innerHTML = rows.map((p) => {
      const c = colorFor ? colorFor(p) : p.color;
      const sc = mode === 'gungame' ? p.sc + 1 : p.sc;
      return `<tr class="${p.id === myId ? 'me' : ''}"><td><span class="dot" style="background:${esc(c)}"></span></td><td>${esc(p.name)}</td><td>${sc}</td><td>${p.k}</td><td>${p.d}</td></tr>`;
    }).join('');
  }

  death(show, killerName, weapon, secs) {
    $('death').classList.toggle('hidden', !show);
    if (!show) return;
    $('death-by').innerHTML = killerName ? `by <b>${esc(killerName)}</b> · ${W_LABEL[weapon] || ''}` : '';
    $('death-timer').textContent = secs > 0 ? `Respawning in ${secs}` : 'Respawning…';
  }

  end(show, scores, myId, secs, nextMap, title, mode) {
    $('endscreen').classList.toggle('hidden', !show);
    if (!show) return;
    $('end-title').textContent = title || 'MATCH OVER';
    const label = { gungame: 'LVL', koth: 'PTS', infection: 'INF' }[mode] || 'PTS';
    $('end-body').innerHTML = scores.map((p, i) =>
      `<tr class="${p.id === myId ? 'me' : ''}"><td>#${i + 1}</td><td><span class="dot" style="background:${esc(p.color)}"></span> ${esc(p.name)}</td><td>${p.sc} ${label}</td><td>${p.k} K</td><td>${p.d} D</td></tr>`
    ).join('');
    $('end-timer').textContent = `Next match${nextMap ? ' on ' + nextMap : ''} in ${secs}s`;
  }
}
