import { Game } from './game.js';
import { Net } from './net.js';
import { initAudio } from './audio.js';
import { WEAPONS, PRIMARIES } from './weapons.js';
import { COLORS, randCode, store } from './util.js';

const $ = (id) => document.getElementById(id);

const settings = {
  name: store.get('name', 'Player' + Math.floor(Math.random() * 900 + 100)),
  color: store.get('color', COLORS[Math.floor(Math.random() * COLORS.length)]),
  primary: store.get('primary', 'ar'),
  sens: store.get('sens', 1),
};
if (!WEAPONS[settings.primary]) settings.primary = 'ar';

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

function renderPrimary(el) {
  const current = game.active ? game.nextPrimary : settings.primary;
  el.innerHTML = '';
  for (const id of PRIMARIES) {
    const b = document.createElement('button');
    b.textContent = WEAPONS[id].name;
    b.className = id === current ? 'sel' : '';
    b.onclick = () => {
      settings.primary = id;
      store.set('primary', id);
      game.nextPrimary = id;
      renderPrimary($('primary-pick'));
      renderPrimary($('pause-primary'));
    };
    el.appendChild(b);
  }
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
renderColors();
renderPrimary($('primary-pick'));

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
  game.attach(n, { primary: settings.primary, color: settings.color, sens: settings.sens });
  return n;
}

function enterGame() {
  $('menu').classList.add('hidden');
  $('pause-code').textContent = net.code;
  $('pause-title').textContent = net.isHost ? 'LOBBY CREATED' : 'JOINED LOBBY';
  history.replaceState(null, '', '?lobby=' + net.code);
  showPause();
}

function showPause() {
  renderPrimary($('pause-primary'));
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
      await net.host(code, settings.name || 'Player', settings.color);
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
  $('pause').classList.add('hidden');
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
