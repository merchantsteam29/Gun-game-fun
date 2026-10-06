import { WEAPONS, SLOT_NAMES, SHORT } from './weapons.js';
import { esc } from './util.js';
import { Radar } from './radar.js';
import { bannerHtml } from './banners.js';
import { badge, ROLE_INFO } from './roles.js';
import { MedalQueue } from './medals.js';
import { MAPS, MAP_BLURB } from './maps.js';
import { sfx } from './audio.js';

const roleIcon = (r) => (ROLE_INFO[r] ? `<b class="role-ico ${r}" title="${ROLE_INFO[r].label}">${ROLE_INFO[r].icon}</b>` : '');

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
    this.radarView = new Radar($('radar'));
    this.medalQ = new MedalQueue($('medals'), (d) => sfx.medal(0.2 + d.tier * 0.06));
  }

  show(v) { this.el.classList.toggle('hidden', !v); }

  applyOpts(o) {
    this.crosshair.style.setProperty('--cross', o.rgbCross ? '#ff3b3b' : o.crossColor);
    this.crosshair.classList.toggle('rgb', !!o.rgbCross);
    this.crosshair.style.setProperty('--cross-scale', o.crossSize);
    this.crosshair.classList.toggle('nodot', !o.crossDot);
    $('fps').classList.toggle('hidden', !o.showFps);
    this.el.style.setProperty('--hs', o.hudScale || 1);
    this.minimap(o.minimap);
  }

  minimap(on) {
    on = on !== false;
    if (on !== this.mapOn) { this.mapOn = on; this.el.classList.toggle('nomap', !on); }
  }

  radar(mapId, bounds, me, blips, objs) {
    this.radarView.layout(mapId, bounds);
    this.radarView.draw(me, blips, objs);
  }

  fps(n) { $('fps').textContent = n + ' FPS'; }

  // Banner when a mission completes and unlocks a cosmetic.
  mission(name, reward) {
    const el = $('mission-toast');
    el.innerHTML = `<small>MISSION COMPLETE</small><b>${esc(name)}</b>${reward ? `<span class="tok">🪙 ${esc(reward)}</span>` : ''}`;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout(this.timers.mission);
    this.timers.mission = setTimeout(() => el.classList.remove('show'), 4000);
  }

  lobby(code, count, mapName) {
    const html = `LOBBY <b>${esc(code)}</b> · ${count} player${count === 1 ? '' : 's'} · ${esc(mapName)}`;
    if (html !== this.lastLobby) { this.lastLobby = html; $('lobby-tag').innerHTML = html; }
  }

  health(hp, max = 100) {
    const shown = Math.max(0, Math.ceil(hp));
    const pct = Math.max(0, Math.min(100, (hp / max) * 100));
    const key = shown + '/' + max;
    if (key === this.lastHp) return;
    this.lastHp = key;
    $('hp-num').textContent = shown;
    $('health-fill').style.width = pct + '%';
    $('health-lag').style.width = pct + '%'; // trails behind via a delayed CSS transition
    $('health').classList.toggle('low', pct <= 35);
  }

  modeBar(html) {
    if (html !== this.lastMode) { this.lastMode = html; $('mode-bar').innerHTML = html; }
  }

  ammo(id, cur, mag, frags) {
    const key = `${id}|${cur}|${mag}|${frags}`;
    if (key === this.lastAmmo) return;
    this.lastAmmo = key;
    const w = WEAPONS[id];
    $('wname').textContent = w.name;
    const c = $('ammo-cur'), fill = $('ammo-fill');
    let low = false, pct = 100;
    if (w.type === 'melee') { c.textContent = '∞'; $('ammo-mag').textContent = ''; }
    else if (w.type === 'throw') { c.textContent = frags; $('ammo-mag').textContent = '/ ' + w.count; low = frags === 0; pct = (frags / w.count) * 100; }
    else { c.textContent = cur; $('ammo-mag').textContent = '/ ' + mag; low = cur <= Math.ceil(mag * 0.25); pct = (cur / mag) * 100; }
    c.classList.toggle('low', low);
    fill.style.width = Math.min(100, pct) + '%';
    fill.classList.toggle('low', low);
  }

  // Slot cards. They brighten for a moment after each weapon change, then fade back.
  slots(loadout, slot, frags, ammo = {}) {
    const key = loadout.join() + slot + frags + loadout.map((id) => ammo[id]).join();
    if (key === this.lastSlots) return;
    this.lastSlots = key;
    $('slots').innerHTML = loadout.map((id, i) => {
      const w = WEAPONS[id];
      const count = w.type === 'throw' ? '×' + frags : w.mag ? ammo[id] ?? w.mag : '';
      const off = (i === 3 && frags === 0) || (w.mag && ammo[id] === 0);
      return `<div class="${i === slot ? 'sel' : ''} ${off ? 'off' : ''}" title="${SLOT_NAMES[i]}"><b>${i + 1}</b><span>${W_LABEL[id]}</span><em>${count}</em></div>`;
    }).join('');
  }

  weaponChanged() {
    const el = $('weapon-info');
    el.classList.add('changed');
    clearTimeout(this.timers.wpn);
    this.timers.wpn = setTimeout(() => el.classList.remove('changed'), 1600);
  }

  // White-out that fades over up to ~4 seconds.
  flash(amount) {
    const el = $('flash');
    el.style.transition = 'none';
    el.style.opacity = Math.max(Number(el.style.opacity) || 0, amount);
    void el.offsetWidth;
    el.style.transition = `opacity ${1 + amount * 3}s ease-in ${amount * 0.8}s`;
    el.style.opacity = 0;
  }

  // Ring around the crosshair that fills as the reload completes.
  reloading(v, frac = 0) {
    const el = $('reload-hint');
    if (v !== this.reloadOn) { this.reloadOn = v; el.classList.toggle('show', v); }
    if (v) el.style.setProperty('--p', Math.max(0, Math.min(1, frac)).toFixed(3));
  }

  // s: { l: {label, score, pct, color}, r: {...} } or null (just the timer).
  strip(s) {
    const key = JSON.stringify(s);
    if (key === this.lastStrip) return;
    this.lastStrip = key;
    for (const side of ['l', 'r']) {
      const el = this.el.querySelector('#score-strip .ss.' + side), d = s && s[side];
      el.classList.toggle('hidden', !d);
      if (!d) continue;
      el.style.setProperty('--c', d.color);
      el.querySelector('.ss-name').textContent = d.label;
      el.querySelector('.ss-num').textContent = d.score;
      el.querySelector('.ss-bar i').style.width = Math.min(100, d.pct * 100) + '%';
    }
    $('match-info').classList.toggle('has-strip', !!s);
  }

  // Center-screen banner for each of your kills, with multi-kill and streak call-outs.
  // Small "ELIMINATED <name>" line under the crosshair for each of your kills. Call-outs like
  // DOUBLE KILL / RAMPAGE are medals now (see medals()).
  killBanner(name, color, head) {
    const el = $('kill-banner');
    el.innerHTML = `<div class="kb-main"><span class="kb-x">${head ? '⌖' : '✕'}</span>ELIMINATED <b style="color:${esc(color)}">${esc(name)}</b></div>`;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout(this.timers.kb);
    this.timers.kb = setTimeout(() => el.classList.remove('show'), 1800);
  }

  // Queue medals (ids from medals.js) — shown one at a time near the top of the screen.
  medals(ids, extra = {}) { if (ids.length) this.medalQ.add(ids, extra); }

  // Spectating staff: who you're watching, and the controls.
  spectate(name, free) {
    const key = free + '|' + name;
    if (key === this.lastSpec) return;
    this.lastSpec = key;
    $('spec-bar').innerHTML = `<b>👁 SPECTATING</b>${free ? ' · Free camera' : name ? ` · <span>${esc(name)}</span>` : ''}
      <small>${free ? 'WASD move · Space / C up / down · Shift fast · F follow players' : 'Q / E or click switch player · mouse orbit · F free camera'}</small>`;
  }

  scope(v) {
    if (v === this.scoped) return;
    this.scoped = v;
    $('scope').classList.toggle('on', v); // fades in (see #scope in style.css)
    this.crosshair.classList.toggle('hidden', v);
  }

  spread(px, ads) {
    this.crosshair.style.setProperty('--gap', Math.round(4 + px) + 'px');
    this.crosshair.classList.toggle('ads', ads);
  }

  // kind: null (body), 'head' or 'kill'; `head` marks a headshot kill too.
  hit(kind, head = kind === 'head') {
    const h = this.hitmarker;
    h.classList.remove('kill', 'head', 'show');
    void h.offsetWidth; // restart the pop animation
    if (kind) h.classList.add(kind);
    if (head) h.classList.add('head');
    h.classList.add('show');
    clearTimeout(this.timers.hit);
    this.timers.hit = setTimeout(() => h.classList.remove('show'), kind === 'kill' ? 260 : head ? 160 : 90);
  }

  // Big "HEADSHOT" pop under the crosshair on headshot kills (with a streak count).
  headshot(streak) {
    const el = $('headshot');
    el.innerHTML = `HEADSHOT${streak > 1 ? ` <b>×${streak}</b>` : ''}`;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout(this.timers.hs);
    this.timers.hs = setTimeout(() => el.classList.remove('show'), 1100);
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
      ? `${roleIcon(killer.role)}<span style="color:${esc(killer.color)}">${esc(killer.name)}</span><span class="w">${W_LABEL[weapon] || esc(weapon)}${head ? '<i class="hs" title="Headshot">⌖</i>' : ''}</span>`
      : `<span class="w">${W_LABEL[weapon] || esc(weapon)} · self</span>`;
    d.innerHTML = `${kname}${roleIcon(victim.role)}<span style="color:${esc(victim.color)}">${esc(victim.name)}</span>`;
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
    const scoreLabel = { gungame: 'Lvl', koth: 'Pts', infection: 'Inf', lms: 'Lives', juggernaut: 'Pts' }[mode] || 'Score';
    $('sb-head').innerHTML = `<th>#</th><th>Player</th><th>${scoreLabel}</th><th>K</th><th>D</th><th>K/D</th>`;
    const rows = [...players.values()].sort((a, b) => (a.team || 0) - (b.team || 0) || b.sc - a.sc || b.k - a.k || a.d - b.d);
    $('sb-sub').textContent = `${rows.length} player${rows.length === 1 ? '' : 's'}`;
    let rank = 0, team = null;
    $('sb-body').innerHTML = rows.map((p) => {
      if (p.team !== team) { team = p.team; rank = 0; }
      rank++;
      const c = colorFor ? colorFor(p) : p.color;
      const sc = mode === 'gungame' ? p.sc + 1 : p.sc;
      const kd = (p.k / Math.max(1, p.d)).toFixed(2);
      return `<tr class="${p.id === myId ? 'me' : ''}" style="--c:${esc(c)}"><td class="rk">${rank}</td><td><span class="dot" style="background:${esc(c)}"></span>${esc(p.name)}${badge(p.role, true)}</td><td class="sc">${sc}</td><td>${p.k}</td><td>${p.d}</td><td class="kd">${kd}</td></tr>`;
    }).join('');
  }

  // Death screen: the killer's banner with their name, the weapon and a headshot tag.
  death(show, killerName, weapon, secs, status = null, head = false, killerColor = '#fff', banner = 'standard', role = null) {
    $('death').classList.toggle('hidden', !show);
    if (!show) { this.lastDeath = ''; return; }
    const key = [killerName, weapon, head, killerColor, banner, role].join('|');
    if (key !== this.lastDeath) {
      this.lastDeath = key;
      const wl = W_LABEL[weapon] || weapon || '';
      $('death-by').innerHTML = killerName
        ? bannerHtml(banner, killerName, killerColor, 'KILLED YOU', `${badge(role)}<span class="chip">${esc(wl)}</span>${head ? '<span class="chip hs">⌖ HEADSHOT</span>' : ''}`)
        : `<div class="death-self">${weapon ? esc(wl) + ' · ' : ''}You took yourself out</div>`;
      // Replay the slide-in each time a new death screen opens.
      const card = $('death-by');
      card.classList.remove('in'); void card.offsetWidth; card.classList.add('in');
    }
    $('death-timer').textContent = status || (secs > 0 ? `Respawning in ${secs}` : 'Respawning…');
  }

  // End of match: the MVP card first, then (when maps rotate) a vote on the next map with live
  // counts and the podium, otherwise the podium and full results.
  // info: { scores, myId, mode, title, now, secs, nextMap, mvp, showMvp, vote, onVote }
  end(show, info = {}) {
    $('endscreen').classList.toggle('hidden', !show);
    if (!show) { this.lastEnd = this.lastVote = this.lastMvp = ''; return; }
    const { scores = [], myId, mode, title, now, secs, nextMap, mvp, showMvp, vote } = info;
    $('end-title').textContent = title || 'MATCH OVER';
    const label = { gungame: 'LVL', koth: 'PTS', infection: 'INF', lms: 'LIVES' }[mode] || 'PTS';
    const voting = !!vote && !showMvp;
    $('endscreen').classList.toggle('mvp-phase', !!showMvp);
    $('endscreen').classList.toggle('vote-phase', voting);
    // MVP
    const mkey = showMvp ? JSON.stringify(mvp) : '';
    if (mkey !== this.lastMvp) {
      this.lastMvp = mkey;
      $('mvp-card').innerHTML = showMvp && mvp ? this.mvpHtml(mvp, label, mvp.id === myId) : '';
    }
    // Podium + table
    const key = JSON.stringify(scores) + myId + label;
    if (key !== this.lastEnd) {
      this.lastEnd = key;
      const top = [scores[1], scores[0], scores[2]];
      $('podium').innerHTML = top.map((p, i) => !p ? '<div class="pd empty"></div>' :
        `<div class="pd p${[2, 1, 3][i]} ${p.id === myId ? 'me' : ''}" style="--c:${esc(p.color)}"><div class="pd-name">${esc(p.name)}</div><div class="pd-sc">${p.sc} ${label}</div><div class="pd-step">${[2, 1, 3][i]}</div></div>`).join('');
      $('end-body').innerHTML = scores.map((p, i) =>
        `<tr class="${p.id === myId ? 'me' : ''}"><td class="rk">${i + 1}</td><td><span class="dot" style="background:${esc(p.color)}"></span>${esc(p.name)}${badge(p.role, true)}</td><td class="sc">${p.sc} ${label}</td><td>${p.k} K</td><td>${p.d} D</td></tr>`
      ).join('');
    }
    // Map vote
    if (voting) {
      const open = now >= vote.opensAt && now < vote.endsAt && !vote.winner;
      const vkey = JSON.stringify([vote.maps, vote.counts, vote.mine, vote.winner, open]);
      if (vkey !== this.lastVote) {
        this.lastVote = vkey;
        const total = vote.counts.reduce((a, b) => a + b, 0);
        $('vote-box').innerHTML = `<div class="vote-head">${vote.winner ? 'NEXT MAP' : 'VOTE FOR THE NEXT MAP'}</div><div class="vote-cards">${vote.maps.map((id, i) => {
          const m = MAPS[id], n = vote.counts[i] || 0, pct = total ? (n / total) * 100 : 0;
          const cls = [vote.mine === i ? 'mine' : '', vote.winner === id ? 'win' : vote.winner ? 'lose' : ''].join(' ');
          return `<button class="vote-card ${cls}" data-vi="${i}" ${open && vote.mine === null ? '' : 'disabled'} style="--sky:${esc(m.theme ? m.theme.sky : '#456')}">
            <span class="vc-key">${i + 1}</span><b>${esc(m.name)}</b><small>${esc(MAP_BLURB[id] || '')}</small>
            <span class="vc-bar"><i style="width:${pct}%"></i></span><span class="vc-n">${n} vote${n === 1 ? '' : 's'}${vote.mine === i ? ' · yours' : ''}</span></button>`;
        }).join('')}</div>`;
        $('vote-box').querySelectorAll('[data-vi]').forEach((b) => { b.onclick = () => info.onVote && info.onVote(Number(b.dataset.vi)); });
      }
      const left = Math.max(0, Math.ceil((vote.endsAt - now) / 1000));
      $('end-timer').textContent = vote.winner ? `Next match on ${MAPS[vote.winner].name} in ${secs}s`
        : now < vote.opensAt ? '' : vote.mine === null ? `Pick a map: click, 1 / 2 / 3, or Ⓧ Ⓨ Ⓑ · ${left}s` : `Vote counted · results in ${left}s`;
    } else {
      $('vote-box').innerHTML = '';
      this.lastVote = '';
      $('end-timer').textContent = showMvp ? '' : `Next match${nextMap ? ' on ' + nextMap : ''} in ${secs}s`;
    }
  }

  mvpHtml(p, label, mine) {
    const kd = (p.k / Math.max(1, p.d)).toFixed(2);
    const stats = [['KILLS', p.k], ['DEATHS', p.d], ['K/D', kd], [label === 'PTS' ? 'SCORE' : label, p.sc]];
    if (p.hs) stats.push(['HEADSHOTS', p.hs]);
    if (p.streak >= 3) stats.push(['BEST STREAK', p.streak]);
    return `<div class="mvp-tag">★ MATCH MVP${mine ? ' · THAT\'S YOU!' : ''}</div>
      ${bannerHtml(p.banner || 'standard', p.name, p.color, 'MOST VALUABLE PLAYER', badge(p.role))}
      <div class="mvp-stats">${stats.map(([n, v]) => `<div><b>${v}</b><small>${n}</small></div>`).join('')}</div>`;
  }
}
