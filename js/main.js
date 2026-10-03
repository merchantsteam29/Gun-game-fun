import { Game } from './game.js';
import { Net } from './net.js';
import { initAudio } from './audio.js';
import { WEAPONS, SLOTS, SLOT_NAMES, SHORT, validLoadout } from './weapons.js';
import { MAPS, MAP_ORDER } from './maps.js';
import { COLORS, randCode, store } from './util.js';
import { MODES, MODE_ORDER } from './host.js';
import { HostPanel } from './hostpanel.js';

const $ = (id) => document.getElementById(id);

const settings = {
  name: store.get('name', 'Player' + Math.floor(Math.random() * 900 + 100)),
  color: store.get('color', COLORS[Math.floor(Math.random() * COLORS.length)]),
  loadout: validLoadout(store.get('loadout', null)),
  map: store.get('map', 'warehouse'),
  mode: store.get('mode', 'ffa'),
  sens: store.get('sens', 1),
};
if (!MAPS[settings.map]) settings.map = 'warehouse';
if (!MODES[settings.mode]) settings.mode = 'ffa';

const game = new Game($('game'));
window.game = game; // handy for debugging from the console
let net = null;
let busy = false;

// ---------- Menu widgets ----------

function renderColors() {
  $('colors').innerHTML = '';
  for (const c of COLORS) {
    const b = document.createElement('button');
    b.style.background = c;
    b.className = c === settings.color ? 'sel' : '';
    b.title = c;
    b.onclick = () => { settings.color = c; store.set('color', c); renderColors(); };
    $('colors').appendChild(b);
  }
}

function renderLoadout(el) {
  el.innerHTML = '';
  SLOTS.forEach((options, slot) => {
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `<span>${SLOT_NAMES[slot]}</span>`;
    const pick = document.createElement('div');
    pick.className = 'pick';
    for (const id of options) {
      const b = document.createElement('button');
      b.textContent = SHORT[id];
      b.title = WEAPONS[id].name;
      b.className = settings.loadout[slot] === id ? 'sel' : '';
      b.onclick = () => {
        settings.loadout[slot] = id;
        store.set('loadout', settings.loadout);
        game.nextLoadout = settings.loadout.slice();
        renderLoadout($('menu-loadout'));
        renderLoadout($('pause-loadout'));
      };
      pick.appendChild(b);
    }
    row.appendChild(pick);
    el.appendChild(row);
  });
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
$('name').addEventListener('input', () => { settings.name = $('name').value.trim(); store.set('name', settings.name); });
$('sens').value = settings.sens;
$('sens-val').textContent = Number(settings.sens).toFixed(2);
$('sens').addEventListener('input', () => {
  settings.sens = Number($('sens').value);
  $('sens-val').textContent = settings.sens.toFixed(2);
  game.sens = settings.sens;
  store.set('sens', settings.sens);
});
for (const id of MAP_ORDER) {
  const o = document.createElement('option');
  o.value = id;
  o.textContent = MAPS[id].name;
  $('map-pick').appendChild(o);
}
$('map-pick').value = settings.map;
for (const id of MODE_ORDER) {
  const o = document.createElement('option');
  o.value = id;
  o.textContent = MODES[id].name;
  $('mode-pick').appendChild(o);
}
$('mode-pick').value = settings.mode;
const showModeDesc = () => { $('mode-desc').textContent = MODES[settings.mode].desc; };
showModeDesc();
$('mode-pick').addEventListener('change', () => {
  settings.mode = $('mode-pick').value;
  store.set('mode', settings.mode);
  showModeDesc();
});
$('map-pick').addEventListener('change', () => {
  settings.map = $('map-pick').value;
  store.set('map', settings.map);
  game.loadMap(settings.map); // preview behind the menu
});
game.loadMap(settings.map);
renderColors();
renderLoadout($('menu-loadout'));

const urlCode = new URLSearchParams(location.search).get('lobby');
if (urlCode) $('join-code').value = urlCode.toUpperCase().slice(0, 5);
$('join-code').addEventListener('input', () => { $('join-code').value = $('join-code').value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
$('join-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btn-join').click(); });

if (typeof Peer === 'undefined') status('Networking library failed to load. Check your internet connection and refresh.', true);

// ---------- Lobby flow ----------

function newNet() {
  const n = new Net();
  n.onMessage = (m) => game.onNet(m);
  n.onClose = (reason) => leave(reason);
  game.attach(n, { loadout: settings.loadout, color: settings.color, sens: settings.sens });
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
      await net.host(code, settings.name || 'Player', settings.color, { map: settings.map, mode: settings.mode });
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
    await net.join(code, settings.name || 'Player', settings.color);
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
  game.reset();
  game.loadMap(settings.map);
  $('pause').classList.add('hidden');
  $('host-panel').classList.add('hidden');
  $('menu').classList.remove('hidden');
  history.replaceState(null, '', location.pathname);
  status(reason || '', !!reason);
}

$('btn-host').onclick = hostLobby;
$('btn-join').onclick = joinLobby;
$('btn-resume').onclick = () => {
  initAudio();
  $('pause').classList.add('hidden');
  game.lock();
};
$('btn-leave').onclick = () => leave();
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
  setTimeout(() => { $('btn-copy').textContent = 'Copy invite link'; }, 1500);
};
$('game').addEventListener('click', () => {
  if (game.active && !game.locked && $('pause').classList.contains('hidden')) game.lock();
});

game.onUnlock = () => {
  $('pause-title').textContent = 'PAUSED';
  $('btn-resume').textContent = 'Resume';
  showPause();
};

window.addEventListener('beforeunload', () => { if (net) net.destroy(); });
