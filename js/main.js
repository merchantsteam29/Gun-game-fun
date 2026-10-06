import { Game } from './game.js';
import { Net } from './net.js';
import { initAudio } from './audio.js';
import { WEAPONS, SLOTS, SLOT_NAMES, SHORT, CLASSES, validLoadout, weaponInfo, killStats } from './weapons.js';
import { MAPS, MAP_ORDER, quality } from './maps.js';
import { TouchControls } from './touch.js';
import { COLORS, randCode, store } from './util.js';
import { MODES, MODE_ORDER } from './host.js';
import { HostPanel } from './hostpanel.js';
import { modelQuality } from './models.js';
import { SettingsUI } from './settingsui.js';
import { getCos, MISSIONS, missionDone, getTokens } from './missions.js';
import { opts, onOpts } from './settings.js';
import { ServerBrowser, ServerAnnouncer, REGIONS, guessRegion } from './servers.js';
import { Updater } from './updater.js';
import { esc } from './util.js';
import { Chat } from './chat.js';
import { GamepadInput } from './gamepad.js';
import { Social, TAG_RULES, validTag } from './social.js';
import { Voice } from './voice.js';
import { Showroom } from './showroom.js';
import { MODS, MOD_SLOTS, MOD_SLOT_NAMES, modOptions, hasMods, cleanMods, cleanModMap, statsFor } from './mods.js';

const $ = (id) => document.getElementById(id);

const settings = {
  name: store.get('name', 'Player' + Math.floor(Math.random() * 900 + 100)),
  color: store.get('color', COLORS[Math.floor(Math.random() * COLORS.length)]),
  loadout: validLoadout(store.get('loadout', null)),
  mods: cleanModMap(store.get('mods', {})), // weapon id -> attachments
  map: MAP_ORDER.includes(store.get('map')) ? store.get('map') : 'warehouse', // removed maps / modes fall back
  mode: MODE_ORDER.includes(store.get('mode')) ? store.get('mode') : 'ffa',
};
// Gamertag (one per player, unique), friends and party chat over the public relays.
const social = new Social();
if (social.tag) settings.name = social.tag;
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

// PC-only Ultra shadows (secret Showroom setting) take effect from the next map built.
onOpts((o) => { if (!mobile) quality.shadowSize = o.ultraShadows ? 4096 : 2048; });
const game = new Game($('game'), { mobile, tablet });
game.setMods(settings.mods);
window.game = game; // handy for debugging from the console
let net = null;
let busy = false;
let settingsUI = null; // created further down; the Character / Missions sections reuse its views
const chat = new Chat({
  send: (text) => {
    // "/p hello" goes to your party instead of the lobby.
    const m = text.match(/^\/p\s+(.+)/i);
    if (m) {
      if (!social.party) { chat.system('You\'re not in a party. Invite friends from the Friends menu.'); return; }
      social.sayParty(m[1]);
      chat.add(`[Party] ${social.tag}`, '#c9a2ff', m[1], true);
      return;
    }
    if (net) net.send({ t: 'chat', text });
  },
  mobile,
});

function renderCharacter() {
  if (!settingsUI) return;
  const el = $('menu-customize');
  el.replaceChildren(settingsUI.special('customize', { rerender: () => { renderCharacter(); renderChip(); } }));
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
  $('chip-name').innerHTML = esc(settings.name || 'Player') + (social.tag ? ' <span class="acct-badge" title="Your gamertag">✓</span>' : '');
  $('chip-dot').style.background = settings.color;
  $('chip-tokens').textContent = '🪙 ' + getTokens();
}

// Loadout picker: one tab per slot, a grid of weapons for the open slot, and a stat card
// for whichever weapon is hovered (or equipped).
const loadoutTab = new WeakMap();

// mods: attachments to show the stats with (defaults to what you've picked for that gun).
function statCard(id, mods) {
  const w = hasMods(id) ? statsFor(id, mods || settings.mods[id]) : WEAPONS[id];
  const info = weaponInfo(id, w);
  return `<div class="lo-name">${WEAPONS[id].name}</div><div class="lo-tag">${info.tag}</div>` +
    info.stats.map(([label, v]) => `<div class="lo-stat"><span>${label}</span><i><b style="width:${Math.round(v * 100)}%"></b></i></div>`).join('') +
    (info.facts.length ? `<dl class="lo-facts">${info.facts.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>` : '');
}

// The attachment picker for a gun (nothing for melee / throwables).
function modsPanel(id) {
  if (!hasMods(id)) return '';
  const opts = modOptions(id), m = cleanMods(id, settings.mods[id]);
  const rows = MOD_SLOTS.filter((s) => opts[s].length > 1).map((s) =>
    `<div class="lo-mod"><span>${MOD_SLOT_NAMES[s]}</span><div class="lo-mod-opts">${opts[s].map((o) =>
      `<button class="${m[s] === o ? 'sel' : ''}" data-mod="${s}:${o}">${MODS[s][o].name}</button>`).join('')}</div></div>`).join('');
  return `<div class="lo-mods"><h4>Attachments</h4>${rows}<p class="lo-mod-desc"></p></div>`;
}

// One-line summary under each weapon in the picker.
function weaponBlurb(id) {
  const w = WEAPONS[id], k = killStats(id);
  if (w.type === 'throw') return `×${w.count}${w.splash ? ` · ${w.splash} dmg` : ''}`;
  if (!k) return '';
  if (w.type === 'melee') return k.shots === 1 ? 'one hit' : `${k.shots} hits · ${k.ttk.toFixed(2)}s`;
  if (k.shots === 1) return w.type === 'proj' ? 'one-hit' : 'one shot';
  return `${k.shots} shots · ${k.ttk.toFixed(2)}s`;
}

function renderLoadout(el) {
  const open = loadoutTab.get(el) || 0;
  const tabs = SLOTS.map((_, slot) =>
    `<button class="lo-tab ${slot === open ? 'sel' : ''}" data-tab="${slot}"><small>${slot + 1} · ${SLOT_NAMES[slot]}</small>${WEAPONS[settings.loadout[slot]].name}</button>`).join('');
  // Group the slot's weapons by class (anything unlisted goes under "Other").
  const ids = SLOTS[open];
  const groups = CLASSES.map(([name, list]) => [name, list.filter((id) => ids.includes(id))]).filter(([, l]) => l.length);
  const rest = ids.filter((id) => !groups.some(([, l]) => l.includes(id)));
  if (rest.length) groups.push(['Other', rest]);
  const list = groups.map(([name, l]) => `<div class="lo-group"><h4>${name}</h4><div class="lo-grid">${l.map((id) =>
    `<button class="${settings.loadout[open] === id ? 'sel' : ''}" data-w="${id}"><b>${WEAPONS[id].name}</b><small>${weaponBlurb(id)}</small></button>`).join('')}</div></div>`).join('');
  const cur = settings.loadout[open];
  el.innerHTML = `<div class="lo-tabs">${tabs}</div><div class="lo-body"><div class="lo-list">${list}</div>
    <div class="lo-side"><div class="lo-card">${statCard(cur)}</div>${modsPanel(cur)}</div></div>`;
  const card = el.querySelector('.lo-card');
  // Attachments: click to fit; hovering previews the stats and explains the part.
  el.querySelectorAll('[data-mod]').forEach((b) => {
    const [slot, opt] = b.dataset.mod.split(':');
    const preview = { ...cleanMods(cur, settings.mods[cur]), [slot]: opt };
    const desc = el.querySelector('.lo-mod-desc');
    b.onmouseenter = () => { card.innerHTML = statCard(cur, preview); if (desc) desc.textContent = MODS[slot][opt].desc; };
    b.onmouseleave = () => { card.innerHTML = statCard(cur); if (desc) desc.textContent = ''; };
    b.onclick = () => {
      settings.mods[cur] = preview;
      store.set('mods', settings.mods);
      game.setMods(settings.mods);
      renderLoadout($('menu-loadout'));
      renderLoadout($('pause-loadout'));
    };
  });
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

// ---------- Gamertag, friends & party ----------
// Your gamertag is your name everywhere; until you pick one you play under a guest callsign.
function applyGamertag() {
  if (social.tag) {
    settings.name = social.tag;
    store.set('name', social.tag);
    $('name').value = social.tag;
  }
  $('name').disabled = !!social.tag;
  $('name').title = social.tag ? 'Your gamertag (you only get one)' : '';
  $('name-label').textContent = social.tag ? 'Gamertag' : 'Callsign (guest)';
  renderChip();
}

function toast(text) {
  if (game.active && !$('hud').classList.contains('hidden')) { game.hud.say(text); return; }
  const el = $('toast');
  el.textContent = text;
  el.classList.remove('hidden');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.add('hidden'), 3500);
}

// "Choose your gamertag" pop-up (first visit, or from Friends / Character).
function openTagPop() {
  if (social.tag) return;
  $('tag-pop').classList.remove('hidden');
  const input = $('tag-input');
  if (!input.value && validTag(settings.name)) input.value = settings.name;
  checkTag();
  setTimeout(() => input.focus(), 30);
}
let tagCheckT = null;
function checkTag() {
  clearTimeout(tagCheckT);
  const tag = $('tag-input').value.trim(), msg = $('tag-msg');
  msg.className = 'tag-msg';
  if (!tag) { msg.textContent = TAG_RULES; return; }
  if (!validTag(tag)) { msg.textContent = `Use ${TAG_RULES}.`; msg.classList.add('bad'); return; }
  msg.textContent = 'Checking…';
  tagCheckT = setTimeout(async () => {
    const r = await social.available(tag);
    if ($('tag-input').value.trim() !== tag) return;
    msg.textContent = r.ok ? `${tag} is available!` : r.error;
    msg.classList.add(r.ok ? 'good' : 'bad');
  }, 450);
}
$('tag-input').addEventListener('input', checkTag);
$('tag-form').onsubmit = async (e) => {
  e.preventDefault();
  const btn = $('tag-claim'), msg = $('tag-msg');
  btn.disabled = true;
  msg.className = 'tag-msg';
  msg.textContent = 'Claiming…';
  try {
    await social.claim($('tag-input').value.trim());
    $('tag-pop').classList.add('hidden');
    applyGamertag();
    toast(`Welcome, ${social.tag}!`);
  } catch (err) {
    msg.textContent = err.message;
    msg.classList.add('bad');
  }
  btn.disabled = false;
};
$('tag-later').onclick = () => { $('tag-pop').classList.add('hidden'); sessionStorage.setItem('tagLater', '1'); };

function renderFriends() {
  const n = social.pendingCount;
  $('nav-friends-count').textContent = n ? String(n) : '';
  $('fr-me').innerHTML = social.tag
    ? `Your gamertag: <b>${esc(social.tag)}</b> <span class="sv-status ${social.status}">${social.status === 'online' ? '● Online' : social.status === 'connecting' ? 'Connecting…' : 'Offline'}</span>`
    : 'Pick a gamertag so friends can find you. <button id="fr-pick" class="primary">Choose gamertag</button>';
  if ($('fr-pick')) $('fr-pick').onclick = openTagPop;
  $('fr-add').classList.toggle('hidden', !social.tag);

  // Requests and invites
  const rows = [];
  for (const [k, tag] of social.incoming) rows.push(`<div class="fr-row"><span class="fr-name">${esc(tag)}</span><small>wants to be friends</small><button class="primary" data-acc="${k}">Accept</button><button data-dec="${k}">Decline</button></div>`);
  for (const [id, inv] of social.invites) rows.push(`<div class="fr-row"><span class="fr-name">${esc(inv.from)}</span><small>invited you to their party</small><button class="primary" data-pjoin="${id}">Join party</button><button data-pno="${id}">No thanks</button></div>`);
  for (const [k, tag] of social.outgoing) rows.push(`<div class="fr-row out"><span class="fr-name">${esc(tag)}</span><small>request sent</small><button data-cancel="${k}">Cancel</button></div>`);
  $('fr-requests').innerHTML = rows.join('');
  $('fr-requests-card').classList.toggle('hidden', !rows.length);

  // Friends list: online first
  const friends = [...social.friends.entries()].sort(([, a], [, b]) => social.isOnline(b) - social.isOnline(a) || a.tag.localeCompare(b.tag));
  const inParty = (t) => social.party && social.party.members.some((m) => m.toLowerCase() === t.toLowerCase());
  $('fr-count').textContent = friends.length ? `(${friends.filter(([, f]) => social.isOnline(f)).length} online)` : '';
  $('fr-list').innerHTML = friends.length ? friends.map(([k, f]) => {
    const on = social.isOnline(f), p = f.pres || {};
    const where = !on ? 'Offline' : p.mode === 'lobby' ? 'In a match' : 'In the menu';
    const canInvite = on && !inParty(f.tag) && (!social.party || social.isLeader);
    const canJoin = on && p.lobby && !net;
    return `<div class="fr-row"><i class="fr-dot ${on ? 'on' : ''}"></i><span class="fr-name">${esc(f.tag)}${inParty(f.tag) ? ' <em>party</em>' : ''}</span><small>${where}</small>
      ${canJoin ? `<button class="primary" data-joingame="${p.lobby}">Join game</button>` : ''}
      ${canInvite ? `<button data-inv="${k}">Invite to party</button>` : ''}
      <button class="ghost fr-x" data-rm="${k}" title="Remove friend">✕</button></div>`;
  }).join('') : `<div class="sv-empty">${social.tag ? 'No friends yet. Add someone by their gamertag above.' : 'Choose a gamertag to add friends.'}</div>`;

  // Party
  const p = social.party;
  $('pt-empty').classList.toggle('hidden', !!p);
  $('pt-box').classList.toggle('hidden', !p);
  if (p) {
    const inVc = (k) => (k === social.me ? voice.active : voice.inVoice.has(k));
    $('pt-members').innerHTML = p.members.map((m) => {
      const k = m.toLowerCase();
      return `<span class="pt-chip ${inVc(k) ? 'vc' : ''} ${voice.speaking.has(k) ? 'talk' : ''}">${k === p.leader.toLowerCase() ? '♛ ' : ''}${esc(m)}</span>`;
    }).join('');
    $('vc-join').classList.toggle('hidden', voice.active);
    $('vc-mute').classList.toggle('hidden', !voice.active);
    $('vc-leave').classList.toggle('hidden', !voice.active);
    $('vc-mute').textContent = voice.muted ? 'Unmute' : 'Mute';
    if (!$('vc-status').classList.contains('err')) {
      $('vc-status').textContent = !voice.active ? (voice.inVoice.size ? `${voice.inVoice.size} in voice` : '')
        : voice.muted ? 'Muted' : opts.voicePtt ? 'Hold V to talk' : 'Mic on';
    }
    const canFollow = !social.isLeader && p.lobby && !net;
    $('pt-follow').classList.toggle('hidden', !canFollow);
    $('pt-follow').dataset.code = p.lobby || '';
    $('pt-log').innerHTML = social.partyLog.map((l) => (l.from
      ? `<div class="cl"><b style="color:${l.mine ? 'var(--accent)' : '#c9a2ff'}">${esc(l.from)}:</b> ${esc(l.text)}</div>`
      : `<div class="cl sys">${esc(l.text)}</div>`)).join('') || '<div class="cl sys">Say hi to your party!</div>';
    $('pt-log').scrollTop = $('pt-log').scrollHeight;
  }
}

$('fr-add').onsubmit = async (e) => {
  e.preventDefault();
  const tag = $('fr-tag').value.trim(), msg = $('fr-msg');
  if (!tag) return;
  msg.className = 'note';
  msg.textContent = 'Sending…';
  try {
    const r = await social.addFriend(tag);
    msg.textContent = r === 'accepted' ? 'You\'re now friends!' : `Friend request sent to ${tag}. They need to accept it.`;
    $('fr-tag').value = '';
  } catch (err) {
    msg.textContent = err.message;
    msg.classList.add('err');
  }
};
$('menu-friends').addEventListener('click', async (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  const d = b.dataset;
  try {
    if (d.acc) await social.accept(d.acc);
    else if (d.dec) social.decline(d.dec);
    else if (d.cancel) social.cancel(d.cancel);
    else if (d.pjoin) await social.acceptInvite(d.pjoin);
    else if (d.pno) social.declineInvite(d.pno);
    else if (d.inv) await social.invite(d.inv);
    else if (d.rm) { const f = social.friends.get(d.rm); if (f && confirm(`Remove ${f.tag} from your friends?`)) await social.removeFriend(d.rm); }
    else if (d.joingame) { $('join-code').value = d.joingame; joinLobby(); }
  } catch (err) { toast(err.message); }
});
$('pt-form').onsubmit = (e) => {
  e.preventDefault();
  const text = $('pt-input').value.trim();
  if (text) social.sayParty(text);
  $('pt-input').value = '';
};
$('pt-input').addEventListener('keydown', (e) => e.stopPropagation());
$('pt-leave').onclick = () => social.leaveParty();

// ---------- Party voice chat ----------
const voice = new Voice(social);
$('vc-join').onclick = async () => {
  const st = $('vc-status');
  st.className = 'vc-status';
  st.textContent = 'Starting voice…';
  initAudio();
  try { await voice.join(); } catch (err) { st.className = 'vc-status err'; st.textContent = err.message; setTimeout(() => st.classList.remove('err'), 6000); }
  renderFriends();
};
$('vc-mute').onclick = () => voice.setMuted(!voice.muted);
$('vc-leave').onclick = () => voice.leave();
// Who's talking, shown in matches.
function renderVoiceHud() {
  const el = $('voice-hud');
  el.classList.toggle('hidden', !voice.active);
  if (!voice.active) return;
  const mine = voice.muted ? '🔇 Voice muted' : opts.voicePtt ? (voice.pttDown ? '🎤 Talking' : '🎤 Hold V to talk') : '🎤 Mic on';
  el.innerHTML = `<div class="me">${mine}</div>` + voice.talkers().filter((t) => t !== social.tag).map((t) => `<div class="t">🔊 ${esc(t)}</div>`).join('');
}
voice.onChange = () => { renderFriends(); renderVoiceHud(); };
window.addEventListener('keydown', (e) => { if (e.code === 'KeyV') setTimeout(renderVoiceHud, 0); });
window.addEventListener('keyup', (e) => { if (e.code === 'KeyV') setTimeout(renderVoiceHud, 0); });
window.voice = voice; // debugging
$('pt-follow').onclick = () => { if ($('pt-follow').dataset.code) { $('join-code').value = $('pt-follow').dataset.code; joinLobby(); } };

social.onChange = () => { renderFriends(); applyGamertag(); };
social.onNotice = (text) => toast(text);
// Party chat also shows up in the match chat; "/p message" in match chat talks to your party.
social.onPartyChat = ({ from, text, mine }) => { if (from && net && !mine) chat.add(`[Party] ${from}`, '#c9a2ff', text); };
applyGamertag();
renderFriends();
window.social = social; // debugging
// First visit: ask for a gamertag (only on the menu, never on top of a match).
social.ready.then(() => { if (!social.tag && !sessionStorage.getItem('tagLater') && !net) openTagPop(); });

// Mode and map pickers are tap targets rather than dropdowns (much easier on touch screens).
const MAP_BLURB = {
  warehouse: 'Indoor · mezzanines', yard: 'Outdoor · containers', town: 'Rooftops · houses', pit: 'Small · jump pads',
  outpost: 'Snow · towers', docks: 'Water · cranes',
  arena: 'Arena · stands', compound: 'Rooms · yard', rooftops: 'Night · bridges',
  station: 'Sci-fi · reactor', canyon: 'Mesas · bridge', construction: 'Floors · crane',
  castle: 'Keep · ramparts', hangar: 'Plane · catwalks', mall: 'Shops · 2 floors',
  temple: 'Pyramid · jungle', oilrig: 'Decks · derrick', subway: 'Tracks · platforms',
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

// ---------- Servers: browse public servers, create your own ----------
const serverCfg = {
  name: '', vis: 'public', max: 12, bots: 0, region: guessRegion(), rotate: true,
  ...store.get('serverCfg', {}),
};
const saveCfg = () => store.set('serverCfg', serverCfg);
const browser = new ServerBrowser();
const announcer = new ServerAnnouncer();
let hosting = null; // { public, name, max, region } while hosting

function renderCreateForm() {
  $('sv-name').value = serverCfg.name || `${settings.name || 'Player'}'s server`;
  $('sv-max').innerHTML = Array.from({ length: 11 }, (_, i) => i + 2).map((n) => `<option value="${n}" ${n === serverCfg.max ? 'selected' : ''}>${n} players</option>`).join('');
  $('sv-bots').value = String(serverCfg.bots);
  $('sv-regionpick').innerHTML = REGIONS.map((r) => `<option ${r === serverCfg.region ? 'selected' : ''}>${r}</option>`).join('');
  $('sv-rotate').checked = serverCfg.rotate;
  document.querySelectorAll('#sv-vis button').forEach((b) => b.classList.toggle('sel', b.dataset.v === serverCfg.vis));
  $('sv-vis-hint').textContent = serverCfg.vis === 'public'
    ? 'Anyone can find it in Find Servers.'
    : 'Hidden from the list. Friends join with the code or invite link.';
}
$('sv-name').addEventListener('input', () => { serverCfg.name = $('sv-name').value.trim(); saveCfg(); });
$('sv-max').onchange = () => { serverCfg.max = Number($('sv-max').value); saveCfg(); };
$('sv-bots').onchange = () => { serverCfg.bots = Number($('sv-bots').value); saveCfg(); };
$('sv-regionpick').onchange = () => { serverCfg.region = $('sv-regionpick').value; saveCfg(); };
$('sv-rotate').onchange = () => { serverCfg.rotate = $('sv-rotate').checked; saveCfg(); };
document.querySelectorAll('#sv-vis button').forEach((b) => { b.onclick = () => { serverCfg.vis = b.dataset.v; saveCfg(); renderCreateForm(); }; });
const showCreate = (v) => {
  $('create-card').classList.toggle('hidden', !v);
  $('sv-create-toggle').classList.toggle('hidden', v);
  if (v) { renderCreateForm(); $('create-card').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
};
$('sv-create-toggle').onclick = () => showCreate(true);
$('sv-create-close').onclick = () => showCreate(false);
$('sv-region').innerHTML = '<option value="">All regions</option>' + REGIONS.map((r) => `<option>${r}</option>`).join('');
$('sv-region').onchange = () => renderServers();

function renderServers() {
  const st = browser.status;
  $('sv-status').textContent = st === 'online' ? '● Live' : st === 'connecting' ? 'Connecting…' : st === 'offline' ? 'List unavailable' : '';
  $('sv-status').className = 'sv-status ' + st;
  const region = $('sv-region').value;
  const list = browser.list().filter((s) => !region || s.region === region);
  const el = $('sv-list');
  if (st === 'offline') {
    el.innerHTML = '<div class="sv-empty">Couldn\'t reach the server list right now. You can still join with a code or create a server. <button id="sv-retry">Retry</button></div>';
    $('sv-retry').onclick = () => browser.retry();
    return;
  }
  if (!list.length) {
    el.innerHTML = `<div class="sv-empty">${st === 'connecting' ? 'Looking for servers…' : 'No public servers right now. Create one and your friends (or anyone) can join!'}</div>`;
    return;
  }
  el.innerHTML = list.map((s) => {
    const full = s.players >= s.max;
    const mode = MODES[s.mode] ? MODES[s.mode].name : s.mode;
    const map = MAPS[s.map] ? MAPS[s.map].name : s.map;
    return `<div class="sv-row">
      <div class="sv-main"><b>${esc(s.name)}</b><small>${esc(mode)} · ${esc(map)}</small></div>
      ${s.region ? `<span class="sv-region">${esc(s.region)}</span>` : '<span></span>'}
      <div class="sv-players ${full ? 'full' : ''}">${s.players}/${s.max}${s.bots ? `<small>+${s.bots} bots</small>` : ''}</div>
      <button class="primary" data-join="${esc(s.code)}" ${full ? 'disabled' : ''}>${full ? 'Full' : 'Join'}</button>
    </div>`;
  }).join('');
  el.querySelectorAll('[data-join]').forEach((b) => { b.onclick = () => { $('join-code').value = b.dataset.join; joinLobby(); }; });
}
browser.onChange = renderServers;

// What a public server tells the list.
function listingInfo() {
  const L = net && net.logic;
  const all = L ? [...L.players.values()] : [];
  return {
    name: hosting.name, max: hosting.max, region: hosting.region,
    mode: L ? L.s.mode : settings.mode, map: L ? L.s.map : settings.map,
    players: all.filter((p) => !p.bot).length, bots: all.filter((p) => p.bot).length,
  };
}
function setPublic(v) {
  if (!hosting || !net) return;
  hosting.public = v;
  if (v) announcer.start(net.code, listingInfo).then((ok) => { if (!ok && hosting) chat.system('Could not reach the server list. Friends can still join with the code.'); });
  else announcer.stop();
  $('pause-vis').textContent = v ? '🌐 Public' : '🔒 Private';
}

// Menu sections. Phones show the section buttons as a bottom bar.
const PANE_INFO = {
  play: ['Servers', 'Join friends with a code, browse public servers, or start your own.'],
  loadout: ['Loadout', 'One weapon per slot. Changes apply the next time you spawn.'],
  character: ['Character', 'Your callsign, color and cosmetics. Earn tokens from missions to unlock more.'],
  missions: ['Missions', 'Complete missions in any match to earn tokens.'],
  friends: ['Friends', 'Add friends by gamertag, see who\'s online, party up and chat.'],
};
let menuPane = store.get('menuPane', 'play');
function showPane(name) {
  if (!PANE_INFO[name]) name = 'play';
  menuPane = name;
  store.set('menuPane', name);
  $('pane-title').textContent = PANE_INFO[name][0];
  $('pane-sub').textContent = PANE_INFO[name][1];
  document.querySelectorAll('#menu-nav [data-pane]').forEach((b) => b.classList.toggle('sel', b.dataset.pane === name));
  document.querySelectorAll('.menu-pane').forEach((p) => p.classList.toggle('hidden', p.dataset.pane !== name));
  if (name === 'character') { if (settingsUI) settingsUI.tryOn = null; renderCharacter(); }
  renderChip();
  if (name === 'missions') renderMissions();
  if (name === 'play') { browser.start(); renderServers(); }
  if (name === 'friends') renderFriends();
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
  // Keep a public listing's player count / mode / map current.
  if (hosting && hosting.public && ['pjoin', 'pleave', 'start'].includes(m.t)) announcer.publish();
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
  social.setWhere('lobby', net.code); // friends see you're in a match and can join
  $('pause-code').textContent = net.code;
  $('pause-title').textContent = net.isHost ? 'SERVER CREATED' : 'JOINED SERVER';
  $('pause-vis').textContent = 'Code';
  $('btn-resume').textContent = game.padMode ? 'Press Ⓐ to play' : 'Click to play';
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
    status(`Creating server ${code}…`);
    net = newNet();
    try {
      await net.host(code, settings.name || 'Player', settings.color,
        { map: settings.map, mode: settings.mode, maxPlayers: serverCfg.max, botFill: Math.min(serverCfg.bots, serverCfg.max) }, getCos());
      net.logic.s.rotate = serverCfg.rotate;
      hosting = { public: false, name: $('sv-name').value.trim() || `${settings.name || 'Player'}'s server`, max: serverCfg.max, region: serverCfg.region };
      setBusy(false);
      status('');
      enterGame();
      setPublic(serverCfg.vis === 'public');
      showCreate(false);
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
  if (hosting) { announcer.stop(); hosting = null; }
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
  social.setWhere('menu');
  showPane(reason ? 'play' : menuPane); // refreshes missions / unlocks earned in that match
  updateMissionCount();
  status(reason || '', !!reason);
  updater.leftLobby(); // an update postponed until "after this server"
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
  if (mobile && !game.padMode) {
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
// Secret PC-only Showroom (Konami code on the menus).
new Showroom({
  game, mobile,
  getColor: () => settings.color,
  getName: () => settings.name || 'Player',
  getLoadout: () => settings.loadout,
  getMods: () => settings.mods,
});
settingsUI = new SettingsUI({
  game, mobile, uiMode, uiFromUrl: !!uiFromUrl,
  editLayout: (done) => touch.edit(done),
  getColor: () => settings.color,
  getName: () => settings.name || 'Player',
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
  $('hp-public').checked = !!(hosting && hosting.public);
};
$('hp-public').onchange = () => setPublic($('hp-public').checked);
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
  // Also grabs the mouse when switching from a controller back to mouse mid-match.
  if (!mobile && game.active && $('pause').classList.contains('hidden') && (!game.locked || !document.pointerLockElement)) game.lock();
});

game.onUnlock = () => {
  $('pause-title').textContent = 'PAUSED';
  $('btn-resume').textContent = 'Resume';
  showPause();
};

window.addEventListener('beforeunload', () => { if (hosting) announcer.stop(); if (net) net.destroy(); });

// New releases: pop-up + self-refresh (never mid-match without asking).
const updater = new Updater({ inLobby: () => !!net });
updater.start();

// Controllers: play and navigate every menu with a gamepad.
const gamepad = new GamepadInput(game, {
  pause: () => {
    touch.show(false);
    if (document.pointerLockElement) document.exitPointerLock(); // pointerlockchange shows the pause menu
    else { game.setLocked(false); game.onUnlock(); }
  },
  resume: () => $('btn-resume').click(),
  back: (root) => {
    if (root.id === 'settings') settingsUI.close();
    else if (root.id === 'host-panel') hostPanel.close();
    else if (root.id === 'pause') $('btn-resume').click();
    else if (root.id === 'tag-pop') $('tag-later').click();
    else if (root.id === 'update-pop') { if (!$('upd-later').classList.contains('hidden')) $('upd-later').click(); }
    else if (root.id === 'menu' && !$('create-card').classList.contains('hidden')) showCreate(false);
  },
});
window.gamepad = gamepad; // debugging
gamepad.onActive = (v) => {
  const b = $('btn-resume');
  if (/to play/i.test(b.textContent)) b.textContent = v ? 'Press Ⓐ to play' : 'Click to play';
};
