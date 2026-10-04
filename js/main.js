import { Game } from './game.js';
import { Net } from './net.js';
import { initAudio } from './audio.js';
import { WEAPONS, SLOTS, SLOT_NAMES, SHORT, validLoadout, weaponInfo } from './weapons.js';
import { MAPS, MAP_ORDER, quality } from './maps.js';
import { TouchControls } from './touch.js';
import { COLORS, randCode, store } from './util.js';
import { MODES, MODE_ORDER } from './host.js';
import { HostPanel } from './hostpanel.js';
import { modelQuality } from './models.js';
import { SettingsUI } from './settingsui.js';
import { getCos, MISSIONS, missionDone } from './missions.js';
import { opts } from './settings.js';
import { Chat } from './chat.js';

const $ = (id) => document.getElementById(id);

const settings = {
  name: store.get('name', 'Player' + Math.floor(Math.random() * 900 + 100)),
  color: store.get('color', COLORS[Math.floor(Math.random() * COLORS.length)]),
  loadout: validLoadout(store.get('loadout', null)),
  map: store.get('map', 'warehouse'),
  mode: store.get('mode', 'ffa'),
};
if (!MAPS[settings.map]) settings.map = 'warehouse';
if (!MODES[settings.mode]) settings.mode = 'ffa';

// Interface mode: phones and tablets get touch controls and lighter graphics; tablets also get
// a roomier layout, a weapon slot bar and portrait support. Settings → Mobile → Interface mode
// (or ?mobile / ?tablet / ?desktop) overrides the auto-detection.
const params = new URLSearchParams(location.search);
const touchDevice = matchMedia('(pointer: coarse)').matches || (navigator.maxTouchPoints > 0 && matchMedia('(hover: none)').matches);
const bigScreen = Math.min(screen.width, screen.height) >= 600;
const uiFromUrl = params.has('desktop') ? 'desktop' : params.has('tablet') ? 'tablet' : params.has('mobile') ? 'phone' : null;
let uiMode = uiFromUrl || opts.uiMode;
if (!['phone', 'tablet', 'desktop'].includes(uiMode)) uiMode = touchDevice ? (bigScreen ? 'tablet' : 'phone') : 'desktop';
const mobile = uiMode !== 'desktop';
const tablet = uiMode === 'tablet';
if (mobile) {
  quality.shadowSize = 1024;
  quality.pointLights = false; // each colored light makes every material's shader heavier
  modelQuality.rounded = false;
  document.body.classList.add('mobile');
  if (tablet) document.body.classList.add('tablet');
  document.querySelector('#death .small').innerHTML = 'Tap <kbd>II</kbd> to change your loadout';
}

const game = new Game($('game'), { mobile, tablet });
window.game = game; // handy for debugging from the console
let net = null;
let busy = false;
let settingsUI = null; // created further down; the Character / Missions sections reuse its views
const chat = new Chat({ send: (text) => { if (net) net.send({ t: 'chat', text }); }, mobile });

function renderCharacter() {
  if (!settingsUI) return;
  const el = $('menu-customize');
  el.replaceChildren(settingsUI.special('customize', { rerender: renderCharacter }));
}
function renderMissions() {
  if (!settingsUI) return;
  $('menu-missions').replaceChildren(settingsUI.special('missions', { goCustomize: () => showPane('character') }));
  updateMissionCount();
}
function updateMissionCount() {
  $('nav-missions-count').textContent = `${MISSIONS.filter(missionDone).length}/${MISSIONS.length}`;
}

// ---------- Menu widgets ----------

function renderColors() {
  $('colors').innerHTML = '';
  for (const c of COLORS) {
    const b = document.createElement('button');
    b.style.background = c;
    b.className = c === settings.color ? 'sel' : '';
    b.title = c;
    b.onclick = () => { settings.color = c; store.set('color', c); renderColors(); renderCharacter(); };
    $('colors').appendChild(b);
  }
  renderChip();
}

// Header chip: your name and color; tap to edit your character.
function renderChip() {
  $('chip-name').textContent = settings.name || 'Player';
  $('chip-dot').style.background = settings.color;
}

// Loadout picker: one tab per slot, a grid of weapons for the open slot, and a stat card
// for whichever weapon is hovered (or equipped).
const loadoutTab = new WeakMap();

function statCard(id) {
  const info = weaponInfo(id);
  return `<div class="lo-name">${WEAPONS[id].name}</div><div class="lo-tag">${info.tag}</div>` +
    info.stats.map(([label, v]) => `<div class="lo-stat"><span>${label}</span><i><b style="width:${Math.round(v * 100)}%"></b></i></div>`).join('');
}

function renderLoadout(el) {
  const open = loadoutTab.get(el) || 0;
  const tabs = SLOTS.map((_, slot) =>
    `<button class="lo-tab ${slot === open ? 'sel' : ''}" data-tab="${slot}"><small>${slot + 1} · ${SLOT_NAMES[slot]}</small>${WEAPONS[settings.loadout[slot]].name}</button>`).join('');
  const chips = SLOTS[open].map((id) =>
    `<button class="${settings.loadout[open] === id ? 'sel' : ''}" data-w="${id}" title="${WEAPONS[id].name}">${SHORT[id]}</button>`).join('');
  el.innerHTML = `<div class="lo-tabs">${tabs}</div><div class="lo-body"><div class="lo-grid">${chips}</div><div class="lo-card">${statCard(settings.loadout[open])}</div></div>`;
  const card = el.querySelector('.lo-card');
  el.querySelectorAll('[data-tab]').forEach((b) => {
    b.onclick = () => { loadoutTab.set(el, Number(b.dataset.tab)); renderLoadout(el); };
  });
  el.querySelectorAll('[data-w]').forEach((b) => {
    const id = b.dataset.w;
    b.onmouseenter = () => { card.innerHTML = statCard(id); };
    b.onmouseleave = () => { card.innerHTML = statCard(settings.loadout[open]); };
    b.onclick = () => {
      settings.loadout[open] = id;
      store.set('loadout', settings.loadout);
      game.nextLoadout = settings.loadout.slice();
      renderLoadout($('menu-loadout'));
      renderLoadout($('pause-loadout'));
    };
  });
  $('pause-lo-sum').textContent = settings.loadout.map((id) => SHORT[id]).join(' · ');
}

function status(msg, err = false) {
  $('menu-status').textContent = msg;
  $('menu-status').classList.toggle('err', err);
}

function setBusy(v) {
  busy = v;
  $('btn-host').disabled = $('btn-join').disabled = v;
}

$('name').value = settings.name;
$('name').addEventListener('input', () => { settings.name = $('name').value.trim(); store.set('name', settings.name); renderChip(); });

// Mode and map pickers are tap targets rather than dropdowns (much easier on touch screens).
const MAP_BLURB = {
  warehouse: 'Indoor · mezzanines', yard: 'Outdoor · containers', town: 'Rooftops · houses', pit: 'Small · jump pads',
  outpost: 'Snow · towers', office: 'Two floors', ruins: 'Temple · open', docks: 'Water · cranes',
  arena: 'Arena · stands', compound: 'Rooms · yard', rooftops: 'Night · bridges',
  station: 'Sci-fi · reactor', canyon: 'Mesas · bridge', construction: 'Floors · crane',
};
function renderModes() {
  $('mode-tiles').innerHTML = MODE_ORDER.map((id) =>
    `<button class="tile ${id === settings.mode ? 'sel' : ''}" data-mode="${id}">${MODES[id].name}${MODES[id].teams ? '<small>teams</small>' : ''}</button>`).join('');
  $('mode-tiles').querySelectorAll('[data-mode]').forEach((b) => {
    b.onclick = () => { settings.mode = b.dataset.mode; store.set('mode', settings.mode); renderModes(); };
  });
  $('mode-desc').textContent = MODES[settings.mode].desc;
}
function renderMaps() {
  $('map-tiles').innerHTML = MAP_ORDER.map((id) =>
    `<button class="tile ${id === settings.map ? 'sel' : ''}" data-map="${id}">${MAPS[id].name}<small>${MAP_BLURB[id] || ''}</small></button>`).join('');
  $('map-tiles').querySelectorAll('[data-map]').forEach((b) => {
    b.onclick = () => {
      settings.map = b.dataset.map;
      store.set('map', settings.map);
      game.loadMap(settings.map); // preview behind the menu
      renderMaps();
    };
  });
}

// Menu sections. Phones show the section buttons as a bottom bar.
let menuPane = store.get('menuPane', 'play');
function showPane(name) {
  menuPane = name;
  store.set('menuPane', name);
  document.querySelectorAll('#menu-nav [data-pane]').forEach((b) => b.classList.toggle('sel', b.dataset.pane === name));
  document.querySelectorAll('.menu-pane').forEach((p) => p.classList.toggle('hidden', p.dataset.pane !== name));
  if (name === 'character') renderCharacter();
  if (name === 'missions') renderMissions();
  document.querySelector('.menu-body').scrollTop = 0;
}
document.querySelectorAll('#menu-nav [data-pane]').forEach((b) => { b.onclick = () => showPane(b.dataset.pane); });
$('player-chip').onclick = () => showPane('character');

game.loadMap(settings.map);
renderModes();
renderMaps();
renderColors();
renderLoadout($('menu-loadout'));

const urlCode = new URLSearchParams(location.search).get('lobby');
if (urlCode) $('join-code').value = urlCode.toUpperCase().slice(0, 5);
$('join-code').addEventListener('input', () => { $('join-code').value = $('join-code').value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
$('join-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btn-join').click(); });

if (typeof Peer === 'undefined') status('Networking library failed to load. Check your internet connection and refresh.', true);

// ---------- Lobby flow ----------

// Chat lines for lobby events and messages (team / zombie colors match the scoreboard).
function chatOnNet(m) {
  const colorOf = (id, fallback) => { const p = game.players.get(id); return p ? game.colorFor(p) : fallback; };
  if (m.t === 'welcome') { chat.setLobby(true); chat.system(`Joined lobby ${net ? net.code : ''}. Say hi!`); }
  else if (m.t === 'chat') chat.add(m.name, colorOf(m.id, m.color), m.text, m.id === game.myId);
  else if (m.t === 'pjoin' && !m.bot) chat.system(`${m.name} joined`);
  else if (m.t === 'pleave' && !String(m.name).startsWith('[BOT]')) chat.system(`${m.name} left`);
}

function newNet() {
  const n = new Net();
  n.onMessage = (m) => { game.onNet(m); chatOnNet(m); };
  n.onClose = (reason) => leave(reason);
  game.attach(n, { loadout: settings.loadout, color: settings.color });
  return n;
}

function enterGame() {
  $('menu').classList.add('hidden');
  $('pause-code').textContent = net.code;
  $('pause-title').textContent = net.isHost ? 'LOBBY CREATED' : 'JOINED LOBBY';
  $('btn-resume').textContent = 'Click to play';
  history.replaceState(null, '', '?lobby=' + net.code);
  showPause();
}

function showPause() {
  chat.setPaused(true);
  renderLoadout($('pause-loadout'));
  $('btn-hostpanel').classList.toggle('hidden', !(net && net.isHost));
  $('pause').classList.remove('hidden');
}

async function hostLobby() {
  if (busy) return;
  initAudio();
  setBusy(true);
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = randCode();
    status(`Creating lobby ${code}…`);
    net = newNet();
    try {
      await net.host(code, settings.name || 'Player', settings.color, { map: settings.map, mode: settings.mode }, getCos());
      setBusy(false);
      status('');
      enterGame();
      return;
    } catch (e) {
      net.destroy();
      net = null;
      if (!/taken/.test(e.message) || attempt === 2) { status(e.message, true); break; }
    }
  }
  game.reset();
  setBusy(false);
}

async function joinLobby() {
  if (busy) return;
  const code = $('join-code').value.trim().toUpperCase();
  if (code.length !== 5) { status('Enter the 5-character lobby code.', true); return; }
  initAudio();
  setBusy(true);
  status(`Joining ${code}…`);
  net = newNet();
  try {
    await net.join(code, settings.name || 'Player', settings.color, getCos());
    status('');
    enterGame();
  } catch (e) {
    net.destroy();
    net = null;
    game.reset();
    status(e.message, true);
  }
  setBusy(false);
}

function leave(reason) {
  if (net) { net.destroy(); net = null; }
  chat.setLobby(false);
  chat.setPaused(false);
  touch.show(false);
  game.setLocked(false);
  game.reset();
  game.loadMap(settings.map);
  $('pause').classList.add('hidden');
  $('host-panel').classList.add('hidden');
  $('menu').classList.remove('hidden');
  history.replaceState(null, '', location.pathname);
  showPane(reason ? 'play' : menuPane); // refreshes missions / unlocks earned in that match
  updateMissionCount();
  status(reason || '', !!reason);
}

$('btn-host').onclick = hostLobby;
$('btn-join').onclick = joinLobby;
const touch = new TouchControls(game, () => {
  game.setLocked(false);
  touch.show(false);
  game.onUnlock();
});
$('btn-resume').onclick = () => {
  initAudio();
  $('pause').classList.add('hidden');
  chat.setPaused(false);
  game.lock();
  if (mobile) {
    touch.show(true);
    const el = document.documentElement;
    // Phones are locked to landscape; tablets can play either way.
    if (!document.fullscreenElement && el.requestFullscreen) {
      el.requestFullscreen().then(() => !tablet && screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {})).catch(() => {});
    }
  }
};
$('btn-leave').onclick = () => leave();

// Settings: from the main menu or the pause menu; returns to whichever opened it.
settingsUI = new SettingsUI({
  game, mobile, uiMode, uiFromUrl: !!uiFromUrl,
  editLayout: (done) => touch.edit(done),
  getColor: () => settings.color,
  onCos: (c) => { if (net) net.send({ t: 'cos', c }); },
});
$('btn-settings-menu').onclick = () => {
  $('menu').classList.add('hidden');
  settingsUI.onClose = () => { $('menu').classList.remove('hidden'); showPane(menuPane); };
  settingsUI.open(null);
};
// An invite link always lands on Play with the code filled in.
showPane(urlCode ? 'play' : menuPane);
updateMissionCount();
// Loadout starts open where there's room; on phones it's one tap away so the buttons stay on screen.
$('pause-lo').open = !mobile || tablet;

// Enter opens chat while playing (keeps your view; stops you walking while you type).
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || mobile || chat.typing || !game.active || !game.locked) return;
  e.preventDefault();
  game.keys.clear();
  game.mouse.left = false;
  chat.open();
});
touch.onChat = () => { game.keys.clear(); game.mouse.left = false; chat.open(); };

// Esc backs out of Settings and the Host panel.
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!$('settings').classList.contains('hidden')) { e.preventDefault(); settingsUI.close(); }
  else if (!$('host-panel').classList.contains('hidden')) { e.preventDefault(); hostPanel.close(); }
});
$('btn-settings-pause').onclick = () => {
  $('pause').classList.add('hidden');
  settingsUI.onClose = () => $('pause').classList.remove('hidden');
  settingsUI.open();
};
const hostPanel = new HostPanel();
hostPanel.onClose = () => $('pause').classList.remove('hidden');
$('btn-hostpanel').onclick = () => {
  if (!net || !net.isHost) return;
  $('pause').classList.add('hidden');
  hostPanel.open(net.logic);
};
game.onKicked = () => leave('You were kicked by the host.');
$('btn-copy').onclick = async () => {
  const link = `${location.origin}${location.pathname}?lobby=${net ? net.code : ''}`;
  try {
    await navigator.clipboard.writeText(link);
    $('btn-copy').textContent = 'Copied!';
  } catch {
    $('btn-copy').textContent = link;
  }
  setTimeout(() => { $('btn-copy').textContent = 'Copy invite'; }, 1500);
};
$('game').addEventListener('click', () => {
  if (!mobile && game.active && !game.locked && $('pause').classList.contains('hidden')) game.lock();
});

game.onUnlock = () => {
  $('pause-title').textContent = 'PAUSED';
  $('btn-resume').textContent = 'Resume';
  showPause();
};

window.addEventListener('beforeunload', () => { if (net) net.destroy(); });
