import { Game } from './game.js';
import { Net } from './net.js';
import { initAudio } from './audio.js';
import { WEAPONS, SLOTS, SLOT_NAMES, SHORT, CLASSES, validLoadout, weaponInfo, killStats } from './weapons.js';
import { MAPS, MAP_ORDER, MAP_BLURB, quality } from './maps.js';
import { TouchControls } from './touch.js';
import { COLORS, randCode, store } from './util.js';
import { MODES, MODE_ORDER, BR_MAPS } from './host.js';
import { HostPanel } from './hostpanel.js';
import { modelQuality } from './models.js';
import { SettingsUI } from './settingsui.js';
import { getCos, ownsWrap, MISSIONS, missionDone, getTokens } from './missions.js';
import { opts, onOpts } from './settings.js';
import { ServerBrowser, ServerAnnouncer, REGIONS, guessRegion } from './servers.js';
import { Updater } from './updater.js';
import { APP_VERSION } from './version.js';
import { esc } from './util.js';
import { Chat } from './chat.js';
import { GamepadInput } from './gamepad.js';
import { Social, TAG_RULES, validTag } from './social.js';
import { roles, OWNER, badge, ROLE_INFO } from './roles.js';
import { moderation, REPORT_REASONS } from './moderation.js';
import { ModPanel } from './modpanel.js';
import { Voice } from './voice.js';
import { Showroom } from './showroom.js';
import { isBound, keysLabel } from './binds.js';
import { CAMOS, camoSwatch, camoOf } from './camos.js';
import { myLevel, levelBadge, RANKS, loginState, claimLogin, LOGIN_REWARDS, STREAK_WRAP, dailyChallenges, ALL_DAILY_BONUS, fmtDuration, onProgress, setXpBoost, rankOf as rankOfLevel, featuredMode, featuredEnds, FEATURED_XP, FEATURED_TOKENS, claimFeatured, featuredClaimed } from './progress.js';
import { gameNight, GN_NAME, GN_XP, describe as describeGn } from './gamenight.js';
import { watchEvents, nextEvent, EVENT_NAMES } from './events.js';
import { grantWrap, COSMETICS, allStats } from './missions.js';
import { profiles } from './profiles.js';
import { clans, CLAN_COLORS, MAX_MEMBERS } from './clans.js';
import { seasons, TIERS, TIER_XP, tierTokens } from './seasons.js';
import { bannerOf, bannerHtml } from './banners.js';
import { invites, INVITE_TOKENS, MAX_INVITES } from './invites.js';
import { RULE_PRESETS, presetRules, savedPresets, WEAPON_RULES } from './rulesets.js';
import { myRanked, srBadge, RANKED_MATCH, PLACEMENTS, divisionOf } from './ranked.js';
import { tutorial, tutorialDone, TUTORIAL_TOKENS } from './tutorial.js';
import { highlights } from './highlights.js';
import { addTokens } from './missions.js';
import { addXp } from './progress.js';
import { leaderboard, BOARDS, MODE_BOARDS, weekEnds, CHAMP_TOKENS } from './leaderboard.js';
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
const browser = new ServerBrowser(); // public server list (Servers, Quick Play, Game Night)

// ---------- Install as an app ----------
// Chrome / Edge / Android offer an install prompt; iPhone and iPad need Share → Add to Home Screen.
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
const install = { prompt: null, ios: /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
  standalone: matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches || !!navigator.standalone };
const canInstall = () => !install.standalone && (!!install.prompt || install.ios);
function showInstall() { $('btn-install').classList.toggle('hidden', !canInstall()); if (!game.active) renderHome(); }
async function installApp() {
  if (install.prompt) {
    const p = install.prompt;
    install.prompt = null;
    p.prompt();
    const r = await p.userChoice.catch(() => null);
    if (r && r.outcome !== 'accepted') install.prompt = null;
  } else if (install.ios) toast('Tap the Share button (□↑) in Safari, then "Add to Home Screen".');
  else toast('Use your browser menu → "Install app" (or "Add to Home screen").');
  showInstall();
}
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); install.prompt = e; showInstall(); });
window.addEventListener('appinstalled', () => { install.standalone = true; showInstall(); toast('Installed! Open Gun Game 3D from your home screen or desktop.'); });
$('btn-install').onclick = installApp;
$('btn-install').classList.toggle('hidden', !canInstall());

let settingsUI = null; // created further down; the Character / Missions sections reuse its views
const chat = new Chat({
  send: (text) => {
    if (chatBlocked()) return;
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
  const side = document.querySelector('[data-pane="character"] .field.two') || document.querySelector('.cz-side .field.two');
  el.replaceChildren(settingsUI.special('customize', { side, rerender: () => { renderCharacter(); renderChip(); } }));
}
// Missions screen: three tabs (daily rewards + challenges, season pass + level, missions).
let msTab = null;
function renderMissions() {
  if (!settingsUI) return;
  const login = loginState(), done = MISSIONS.filter(missionDone).length;
  if (!msTab) msTab = login.claimed ? 'season' : 'daily';
  const bar = document.createElement('div');
  bar.className = 'seg-tabs';
  const tabs = [['daily', `Daily${login.claimed ? '' : ' 🎁'}`], ['season', 'Season & level'], ['missions', `Missions ${done}/${MISSIONS.length}`]];
  bar.innerHTML = tabs.map(([k, n]) => `<button data-mt="${k}" class="${k === msTab ? 'sel' : ''}">${n}</button>`).join('');
  bar.querySelectorAll('[data-mt]').forEach((b) => { b.onclick = () => { msTab = b.dataset.mt; renderMissions(); }; });
  let body;
  if (msTab === 'missions') body = settingsUI.special('missions', { goCustomize: () => showPane('character') });
  else {
    body = document.createElement('div');
    body.innerHTML = dailyHtml();
    const keep = msTab === 'daily' ? ['.dl-login', '.dl-chal'] : ['.sp', '.dl-level'];
    body.querySelectorAll('.daily > *').forEach((x) => { if (!keep.some((k) => x.matches(k))) x.remove(); });
    const c = body.querySelector('[data-claim]');
    if (c) c.onclick = doClaim;
  }
  $('menu-missions').replaceChildren(bar, body);
  updateMissionCount();
}
function updateMissionCount() {
  $('nav-missions-count').textContent = `${MISSIONS.filter(missionDone).length}/${MISSIONS.length}`;
  $('nav-missions-count').classList.toggle('alert', !loginState().claimed);
  if (!loginState().claimed) $('nav-missions-count').textContent = '🎁';
}

// Your cosmetics plus the level shown next to your name (sent to the host).
const myCos = () => { const c = clans.myClan(), r = myRanked(); return { ...getCos(), lvl: myLevel().level, sr: r.sr, v: APP_VERSION, ...(r.placing ? { srp: 1 } : {}), ...(c ? { clan: c.tag } : {}) }; };
// Versions look like 2026.10.08.42: compare them number by number.
const cmpVersion = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < 4; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); return 0; };

// ---------- Home strip (top of Servers) and Daily (Missions) ----------
// Level, the daily login reward and today's challenges at a glance.
function renderHome() {
  const el = $('home-strip');
  if (!el) return;
  const lv = myLevel(), login = loginState(), daily = dailyChallenges();
  const doneN = daily.list.filter((c) => c.done).length;
  const gn = gameNight.window(), gnLive = !!(gn && gn.live);
  const gnServers = browser.list().filter((s) => s.gn), gnPlayers = gnServers.reduce((n, s) => n + s.players, 0);
  const rk = myRanked(), open = browser.list().filter((x) => x.players < x.max), playing = browser.list().reduce((n, x) => n + x.players, 0);
  el.innerHTML = `
    <div class="play-hero">
      <button class="hero-quick hs-tile" data-quick title="Joins the busiest public server, or starts one with bots if there are none">
        <span class="hq-kicker">Quick Play</span>
        <span class="hq-title">Jump into a match</span>
        <span class="hq-sub">${playing ? `${playing} playing on ${open.length} server${open.length === 1 ? '' : 's'}` : 'Starts a match with bots if nobody is on'}</span>
        <span class="hq-go">Play now ▶</span>
      </button>
      <div class="hero-side">
        <button class="hero-mini hs-tile hs-ranked" data-ranked style="--dv:${rk.div.color}" title="Ranked Free For All: your rating moves with where you finish among real players">
          <span class="hs-ic">🏆</span><span class="hs-txt"><b>Ranked</b><small>${rk.placing ? `Placement ${rk.played}/${PLACEMENTS}` : `${rk.div.icon} ${rk.div.name} · ${rk.sr} SR`}</small></span><span class="hm-arrow">›</span>
        </button>
        <div class="hero-mini hs-tile hs-feat">
          <span class="hs-ic">⭐</span>
          <span class="hs-txt"><b>${esc(MODES[featuredMode()].name)}</b><small>Featured today · ${FEATURED_XP}x XP${featuredClaimed() ? '' : ` · 🪙 ${FEATURED_TOKENS}`}</small></span>
          <button class="primary sm" data-feat>Play</button>
        </div>
        <div class="hero-mini hs-tile hs-gn ${gnLive ? 'live' : ''}">
          <span class="hs-ic">🌙</span>
          <span class="hs-txt"><b>${gnLive ? `Game Night · LIVE` : 'Game Night'}</b><small>${!gn ? 'Off for now' : gnLive
            ? `${GN_XP}x XP · ${gnPlayers ? `${gnPlayers} playing · ` : ''}${nextEvent(gn) ? `${EVENT_NAMES[nextEvent(gn).kind]} in ${fmtDuration(nextEvent(gn).at - Date.now())}` : `ends in ${fmtDuration(gn.end - Date.now())}`}`
            : `in ${fmtDuration(gn.start - Date.now())} · ${new Date(gn.start).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}`}</small></span>
          ${gnLive ? '<button class="primary sm" data-gn>Join</button>' : gn ? `<button class="ghost sm hs-remind" data-remind title="${esc(describeGn(gameNight.schedule))}">${gameNight.remind ? '🔔' : '🔕'}</button>` : ''}
        </div>
      </div>
    </div>
    ${!tutorialDone() ? '<button class="hs-tile hs-tutorial banner-row" data-tutorial><span class="hs-ic">🎓</span><span class="hs-txt"><b>New here? Take the 1-minute tutorial</b><small>Learn the controls in the Practice Range · 🪙 ' + TUTORIAL_TOKENS + '</small></span><span class="hm-arrow">›</span></button>' : ''}
    ${canInstall() ? '<button class="hs-tile hs-install banner-row" data-install><span class="hs-ic">📲</span><span class="hs-txt"><b>Install the app</b><small>Gun Game 3D on your home screen, full screen</small></span><span class="hm-arrow">›</span></button>' : ''}
    <div class="today-row">
      <div class="hs-tile hs-daily ${login.claimed ? '' : 'ready'}">
        <span class="hs-ic">🎁</span>
        <span class="hs-txt"><b>${login.claimed ? `Day ${login.day} claimed` : `Day ${login.day} reward`}</b><small>${login.claimed ? `Back tomorrow · 🔥 ${login.streak}-day streak` : `🪙 ${login.reward}${login.wrap ? ' + Ember wrap' : ''}${login.streak > 1 ? ` · 🔥 ${login.streak}` : ''}`}</small></span>
        ${login.claimed ? '' : '<button class="primary sm" data-claim>Claim</button>'}
      </div>
      <button class="hs-tile hs-chal" data-go="missions">
        <span class="hs-ic">🎯</span>
        <span class="hs-txt"><b>Challenges ${doneN}/3</b><span class="hs-minis">${daily.list.map((c) => `<i class="${c.done ? 'done' : ''}"><u style="width:${(c.have / c.goal) * 100}%"></u></i>`).join('')}</span><small>New in ${fmtDuration(daily.resetsIn)}</small></span>
      </button>
      <button class="hs-tile hs-level" data-go="missions" title="Earn XP from kills, headshots, matches, wins and daily challenges">
        ${levelBadge(lv.level, false).replace('lvl-badge', 'lvl-badge big')}
        <span class="hs-txt"><b>${esc(lv.rank.name)} · Lv ${lv.level}</b><span class="hs-bar"><i style="width:${lv.pct * 100}%"></i></span><small>Season tier ${seasons.info().tier} · ${lv.need ? `${(lv.need - lv.into).toLocaleString()} XP to go` : 'Max level'}</small></span>
      </button>
    </div>`;
  el.querySelectorAll('[data-go]').forEach((b) => { b.onclick = () => showPane(b.dataset.go); });
  const c = el.querySelector('[data-claim]');
  if (c) c.onclick = doClaim;
  el.querySelector('[data-quick]').onclick = quickPlay;
  const tu = el.querySelector('[data-tutorial]');
  if (tu) tu.onclick = () => startPractice(true);
  el.querySelector('[data-ranked]').onclick = playRanked;
  el.querySelector('[data-feat]').onclick = playFeatured;
  const ins = el.querySelector('[data-install]');
  if (ins) ins.onclick = installApp;
  const g = el.querySelector('[data-gn]');
  if (g) g.onclick = joinGameNight;
  const r = el.querySelector('[data-remind]');
  if (r) r.onclick = async () => {
    const on = await gameNight.setRemind(!gameNight.remind);
    toast(on ? 'We\'ll ping you when Game Night starts (while the game is open in a tab).' : 'Game Night reminder off');
    renderHome();
  };
}
function quickLabel() {
  const best = browser.list().filter((s) => s.players < s.max)[0];
  return best && best.players ? `${best.players} playing in ${best.name}` : 'Jump into a match now';
}

// ---------- Quick Play & Game Night ----------
// Waits a moment for the public server list (it fills in within a couple of seconds).
async function freshServers() {
  browser.start();
  const t0 = Date.now();
  while (Date.now() - t0 < 3500 && (browser.status !== 'online' || Date.now() - t0 < 1500) && browser.status !== 'offline') await new Promise((r) => setTimeout(r, 250));
  return browser.list().filter((s) => s.players < s.max);
}
const randomMap = () => { const maps = MAP_ORDER.filter((m) => m !== 'range'); return maps[Math.floor(Math.random() * maps.length)]; };
async function joinCode(code) { $('join-code').value = code; await joinLobby(); }
async function quickPlay() {
  if (busy) return;
  status('Finding a match…');
  const open = await freshServers();
  const best = open.filter((s) => s.players > 0)[0] || open[0];
  if (best) return joinCode(best.code);
  status('');
  hostLobby({ name: `${settings.name || 'Player'}'s Quick Play`, mode: 'ffa', map: randomMap(), max: 12, bots: 6, rotate: true, vis: 'public' });
}
// Ranked: a ranked server near your rating (busiest first), or a new one.
async function playRanked() {
  if (busy) return;
  const me = myRanked();
  status('Finding a ranked match…');
  const open = (await freshServers()).filter((s) => s.ranked && Math.abs((s.sr || 1000) - me.sr) <= 350)
    .sort((a, b) => b.players - a.players || Math.abs(a.sr - me.sr) - Math.abs(b.sr - me.sr));
  if (open[0]) return joinCode(open[0].code);
  status('');
  hostLobby({ name: `🏆 Ranked · ${me.div.name}`, mode: RANKED_MATCH.mode, map: randomMap(), max: RANKED_MATCH.max, bots: RANKED_MATCH.bots, rotate: true, vis: 'public', ranked: true });
}
// Today's featured mode: a public server already playing it, or a new one with bots.
async function playFeatured() {
  if (busy) return;
  const mode = featuredMode();
  status(`Finding a ${MODES[mode].name} server…`);
  const s = (await freshServers()).filter((x) => x.mode === mode)[0];
  if (s) return joinCode(s.code);
  status('');
  hostLobby({ name: `⭐ ${MODES[mode].name}`, mode, map: randomMap(), max: 12, bots: 6, rotate: true, vis: 'public' });
}
// Everyone in one server: join the busiest Game Night server with room, or start it.
async function joinGameNight() {
  if (busy) return;
  status('Finding the Game Night server…');
  const gns = (await freshServers()).filter((s) => s.gn).sort((a, b) => b.players - a.players);
  if (gns[0]) return joinCode(gns[0].code);
  status('');
  hostLobby({ name: GN_NAME, mode: 'ffa', map: randomMap(), max: 12, bots: 6, rotate: true, vis: 'public', gn: true });
}
function doClaim() {
  const r = claimLogin();
  if (!r) return;
  toast(`Day ${r.day} reward: 🪙 ${r.reward} + 100 XP${r.wrap ? ' and the Ember wrap!' : ''}`);
  renderChip();
  if (menuPane === 'missions') renderMissions();
}
// Season pass track (top of Missions).
const seasonItemName = (it) => (it.kind === 'wrap' ? camoOf(it.id).name + ' wrap' : ((COSMETICS[it.kind] || []).find((c) => c.id === it.id) || {}).name + ' banner');
const seasonItemBg = (it) => (it.kind === 'wrap' ? camoSwatch(camoOf(it.id)) : bannerOf(it.id).bg);
function seasonHtml() {
  const s = seasons.info();
  const cells = Array.from({ length: TIERS }, (_, i) => {
    const tier = i + 1, it = s.items[tier], got = tier <= s.tier, next = tier === s.tier + 1;
    return `<div class="sp-cell ${got ? 'got' : ''} ${next ? 'next' : ''} ${it ? 'item' : ''}" title="Tier ${tier}: ${it ? esc(seasonItemName(it)) + ' + ' : ''}${tierTokens(tier)} tokens">
      <small>${tier}</small>${it ? `<i style="background:${seasonItemBg(it)}"></i>` : `<b>🪙${tierTokens(tier)}</b>`}</div>`;
  }).join('');
  const nextItem = Object.keys(s.items).map(Number).find((x) => x > s.tier);
  return `<div class="card sp" style="--sp:${s.color}">
    <div class="dl-head"><h3>Season ${s.n}: ${esc(s.name)}</h3><span>Tier ${s.tier} / ${TIERS}</span><small>Ends in ${fmtDuration(s.end - Date.now())}</small></div>
    <span class="hs-bar big sp-bar"><i style="width:${s.done ? 100 : (s.into / TIER_XP) * 100}%"></i></span>
    <small class="sp-sub">${s.done ? '✓ Season complete! You earned the season badge.' : `${(TIER_XP - s.into).toLocaleString()} XP to tier ${s.tier + 1}${nextItem ? ` · next item at tier ${nextItem}: ${esc(seasonItemName(s.items[nextItem]))}` : ''}`}</small>
    <div class="sp-track">${cells}</div>
    <p class="note">Free for everyone. All XP you earn this season fills it (${TIER_XP.toLocaleString()} XP a tier). Every tier pays tokens; season wraps and banners can't be bought and won't come back. Tier ${TIERS} earns the Season ${s.n} badge.</p>
  </div>`;
}
function dailyHtml() {
  const lv = myLevel(), login = loginState(), daily = dailyChallenges();
  const days = LOGIN_REWARDS.map((r, i) => {
    const d = i + 1, got = login.claimed ? d <= login.day : d < login.day, now = !login.claimed && d === login.day;
    return `<div class="dl-day ${got ? 'got' : ''} ${now ? 'now' : ''}"><small>Day ${d}</small><b>🪙 ${r}</b>${d === 7 ? `<em title="First time only">${ownsWrap(STREAK_WRAP) ? '★' : '+ Ember wrap'}</em>` : ''}</div>`;
  }).join('');
  const chal = daily.list.map((c) => `<div class="ms ${c.done ? 'done' : ''}">
      <div class="ms-info"><b>${c.done ? '✓ ' : ''}${esc(c.text)}</b><small>${['Easy', 'Medium', 'Hard'][c.tier]} · +${c.xp} XP</small></div>
      <div class="ms-bar"><i style="width:${(c.have / c.goal) * 100}%"></i></div>
      <div class="ms-prog">${c.have}/${c.goal}</div>
      <div class="ms-reward">🪙 ${c.tokens}</div></div>`).join('');
  const ladder = RANKS.map((r) => `<div class="dl-rank ${lv.rank.id === r.id ? 'cur' : lv.level >= r.min ? 'got' : ''}" style="--rk:${r.color}"><b>${esc(r.name)}</b><small>Level ${r.min}+</small>${r.wrap ? `<em>${esc(camoOf(r.wrap).name)} wrap</em>` : '<em>Start</em>'}</div>`).join('');
  return `<div class="daily">
    ${seasonHtml()}
    <div class="card dl-login"><div class="dl-head"><h3>Daily login</h3><span>🔥 ${login.claimed || login.streak > 1 ? login.streak : 0}-day streak</span>${login.claimed ? '<small>Claimed today · come back tomorrow</small>' : '<button class="primary" data-claim>Claim today\'s reward</button>'}</div>
      <div class="dl-days">${days}</div><p class="note">Log in every day to grow your streak. Miss a day and it starts over at day 1.</p></div>
    <div class="card dl-chal"><div class="dl-head"><h3>Daily challenges</h3><small>New ones in ${fmtDuration(daily.resetsIn)} · same for everyone today</small></div>
      <div class="missions">${chal}</div><p class="note">${daily.bonus ? `✓ All done: +${ALL_DAILY_BONUS} bonus tokens earned.` : `Finish all 3 for +${ALL_DAILY_BONUS} bonus tokens.`}</p></div>
    <div class="card dl-level"><div class="dl-head"><h3>${levelBadge(lv.level)} ${esc(lv.rank.name)} · Level ${lv.level}</h3><small>${lv.need ? `${(lv.need - lv.into).toLocaleString()} XP to level ${lv.level + 1}` : 'Max level'}</small></div>
      <span class="hs-bar big"><i style="width:${lv.pct * 100}%"></i></span>
      <div class="dl-ranks">${ladder}</div>
      <p class="note">XP: kill 100 · headshot +25 · multi-kill +50 · finish a match 250 · win +250 · daily login 100. Every level pays tokens; each new rank unlocks a wrap.</p></div>
  </div>`;
}

// ---------- Weekly leaderboard ----------
let lbBoard = store.get('lbBoard', 'xp'), lbWhich = 'cur', lbMode = '', lbT = 0;
function updateLbNav() {
  const r = leaderboard.rows('xp').find((x) => x.me);
  $('nav-lb-rank').textContent = r ? '#' + r.rank : '';
}
// Clans ranked by their members' XP this week.
function clanRows(which) {
  const xp = new Map(leaderboard.rows('xp', which).map((r) => [r.tag.toLowerCase(), r.value]));
  const mine = clans.myClan();
  return clans.list().map((c) => ({ tag: `[${c.tag}] ${c.name}`, clan: c.tag, value: c.members.reduce((n, m) => n + (xp.get(m.toLowerCase()) || 0), 0), me: !!mine && mine.tag === c.tag }))
    .filter((r) => r.value > 0).sort((a, b2) => b2.value - a.value).map((r, i) => ({ ...r, rank: i + 1 }));
}
function renderLeaderboard() {
  const el = $('menu-lb');
  if (!el) return;
  // XP and clans aren't split by mode; clans are weekly only.
  if (lbMode && (lbBoard === 'xp' || lbBoard === 'clans')) lbBoard = 'kills';
  if (lbWhich === 'all' && lbBoard === 'clans') lbBoard = 'xp';
  if (lbBoard === 'clans') clans.loadAll();
  const rows = lbBoard === 'clans' ? clanRows(lbWhich) : leaderboard.rows(lbBoard, lbWhich, lbMode || null), b = lbBoard === 'clans' ? { name: 'XP' } : BOARDS.find((x) => x.id === lbBoard) || BOARDS[0];
  const me = rows.find((r) => r.me), top = rows.slice(0, 50);
  const all = lbWhich === 'all', life = leaderboard.lifetime();
  const mineSrc = all ? life : leaderboard.mine;
  const mine = lbMode ? { ...((mineSrc.m || {})[lbMode] || {}) } : mineSrc;
  const shownBoards = lbMode ? BOARDS.filter((x) => MODE_BOARDS.includes(x.id)) : BOARDS;
  const modeName = lbMode && MODES[lbMode] ? MODES[lbMode].name : '';
  const champs = BOARDS.map((x) => ({ b: x, top: leaderboard.rows(x.id, 'prev')[0] })).filter((c) => c.top);
  const fmt = (n) => Number(n).toLocaleString();
  el.innerHTML = `<div class="lb">
    <div class="card lb-main">
      <div class="lb-head">
        <div class="seg lb-week"><button data-which="cur" class="${lbWhich === 'cur' ? 'sel' : ''}">This week</button><button data-which="prev" class="${lbWhich === 'prev' ? 'sel' : ''}">Last week</button><button data-which="all" class="${all ? 'sel' : ''}">All time</button></div>
        <select id="lb-mode" class="lb-mode" title="Show one game mode"><option value="">All modes</option>${MODE_ORDER.filter((id) => MODES[id] && id !== 'practice').map((id) => `<option value="${id}" ${id === lbMode ? 'selected' : ''}>${esc(MODES[id].name)}</option>`).join('')}</select>
        <small>${all ? 'Lifetime totals' : lbWhich === 'cur' ? `Resets in ${fmtDuration(weekEnds() - Date.now())} (Monday, ${new Date(weekEnds()).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} your time)` : 'Final results'}</small>
      </div>
      <div class="lb-tabs">${shownBoards.map((x) => `<button data-board="${x.id}" class="${x.id === lbBoard ? 'sel' : ''}">${x.icon} ${x.name}</button>`).join('')}${lbMode || all ? '' : `<button data-board="clans" class="${lbBoard === 'clans' ? 'sel' : ''}">🛡 Clans</button>`}</div>
      <table class="lb-table"><tbody>${top.length ? top.map((r) => `<tr class="${r.me ? 'me' : ''} ${r.rank <= 3 ? 'top' + r.rank : ''}"><td class="rk">${r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : r.rank}</td><td ${r.clan ? '' : `class="pf-link" data-profile="${esc(r.tag)}"`}>${esc(r.tag)}${leaderboard.isChamp(r.tag) ? ' <span class="trophy" title="#1 last week">🏆</span>' : ''}</td><td class="sc">${fmt(r.value)} <small>${esc(b.name)}</small></td></tr>`).join('')
        : `<tr><td class="lb-empty">${lbMode ? `Nobody on the ${esc(modeName)} board yet. Play some ${esc(modeName)} to be first!` : all ? 'Nobody on the all-time board yet.' : lbWhich === 'cur' ? 'Nobody on the board yet this week. Play a match to be first!' : 'No results from last week.'}</td></tr>`}</tbody></table>
      ${me && me.rank > 50 ? `<div class="lb-you">You: #${me.rank} · ${fmt(me.value)} ${esc(b.name)}</div>` : ''}
    </div>
    <div class="lb-side">
      <div class="card"><h3>${all ? 'All time' : lbWhich === 'prev' ? 'Your week' : 'Your week'}${modeName ? ` · ${esc(modeName)}` : ''}</h3>${social.tag ? '' : '<p class="note">Get a gamertag (Friends) to show up on the leaderboard. Your stats still count.</p>'}
        <div class="lb-mine">${shownBoards.map((x) => `<div><b>${fmt(mine[x.id] || 0)}</b><small>${x.icon} ${x.name}</small></div>`).join('')}</div>${all && lbMode ? '<p class="note">Per-mode all-time counts started with this update.</p>' : ''}</div>
      <div class="card"><h3>Last week's champions</h3>${champs.length ? champs.map((c) => `<div class="lb-champ"><span>${c.b.icon} ${c.b.name}</span><b>🏆 ${esc(c.top.tag)}</b><small>${fmt(c.top.value)}</small></div>`).join('') : '<p class="note">No champions yet.</p>'}
        <p class="note">Finish #1 on any board to get a 🏆 by your name all next week, ${CHAMP_TOKENS} tokens and the Weekly Champion wrap.</p></div>
      <p class="note">Only players with a gamertag are listed. Each player's game reports its own totals, so numbers are capped to what's possible in a week.</p>
    </div>
  </div>`;
  el.querySelectorAll('[data-board]').forEach((x) => { x.onclick = () => { lbBoard = x.dataset.board; store.set('lbBoard', lbBoard); renderLeaderboard(); }; });
  el.querySelectorAll('[data-which]').forEach((x) => { x.onclick = () => { lbWhich = x.dataset.which; renderLeaderboard(); }; });
  $('lb-mode').onchange = (e) => { lbMode = e.target.value; renderLeaderboard(); };
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
  $('chip-name').innerHTML += badge(roles.myRole(), true);
  $('chip-dot').style.background = settings.color;
  $('chip-tokens').textContent = '🪙 ' + getTokens();
  $('chip-name').insertAdjacentHTML('afterbegin', levelBadge(myLevel().level));
  renderHome();
  updateMissionCount();
  if (profiles.social) profiles.publish(myProfile());
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
  // Camo: looks only (camos.js), saved with the gun's attachments.
  const camo = m.camo || 'default';
  const camos = `<div class="lo-mod lo-camo"><span>Camo</span><div class="lo-camos">${CAMOS.filter((c) => ownsWrap(c.id)).map((c) =>
    `<button class="${camo === c.id ? 'sel' : ''}" data-camo="${c.id}" title="${c.name}"><i style="background:${camoSwatch(c)}"></i>${c.name}</button>`).join('')}<button class="lo-more-wraps" data-morewraps>More wraps →</button></div></div>`;
  return `<div class="lo-mods"><h4>Attachments</h4>${rows}${camos}<p class="lo-mod-desc"></p></div>`;
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

// ---------- Preset loadouts ----------
// Ready-made ones, plus 3 slots of your own (weapons + each gun's attachments / wrap), saved locally.
const PRESETS = [
  { name: 'Rifleman', icon: '🎯', l: ['ar', 'pistol', 'knife', 'frag'] },
  { name: 'Rusher', icon: '⚡', l: ['smg', 'mpistol', 'knife', 'flash'] },
  { name: 'Sniper', icon: '🔭', l: ['sniper', 'revolver', 'katana', 'smoke'] },
  { name: 'Heavy', icon: '🛡', l: ['lmg', 'handcannon', 'sledge', 'frag'] },
  { name: 'Shotgunner', icon: '💥', l: ['shotgun', 'sawedoff', 'axe', 'flash'] },
  { name: 'Fun', icon: '🍳', l: ['flamethrower', 'nailgun', 'pan', 'vortex'] },
];
const customPresets = () => {
  const saved = store.get('presets', []);
  return [0, 1, 2].map((i) => (saved[i] && Array.isArray(saved[i].l) ? { ...saved[i], l: validLoadout(saved[i].l) } : null));
};
function useLoadout(l, mods = null) {
  settings.loadout = validLoadout(l);
  store.set('loadout', settings.loadout);
  game.nextLoadout = settings.loadout.slice();
  if (mods) {
    settings.mods = cleanModMap({ ...settings.mods, ...mods });
    store.set('mods', settings.mods);
    game.setMods(settings.mods);
  }
  if (net && net.practice && game.me.alive) game.setLoadout(settings.loadout); // practice: right away
  renderLoadout($('menu-loadout'));
  renderLoadout($('pause-loadout'));
  if (net && net.practice) renderPractice();
}
function presetsBar() {
  const same = (l) => l.every((id, i) => settings.loadout[i] === id);
  const custom = customPresets();
  return `<div class="lo-presets"><span class="lo-presets-label">Presets</span>${PRESETS.map((p, i) =>
    `<button class="lo-preset ${same(p.l) ? 'sel' : ''}" data-preset="${i}" title="${p.l.map((id) => WEAPONS[id].name).join(' · ')}">${p.icon} ${p.name}</button>`).join('')}
    <span class="lo-presets-sep"></span>${custom.map((p, i) => p
      ? `<span class="lo-custom ${same(p.l) ? 'sel' : ''}"><button data-custom="${i}" title="${p.l.map((id) => WEAPONS[id].name).join(' · ')}">★ ${esc(p.name)}</button><button class="ghost" data-csave="${i}" title="Save current loadout here">💾</button><button class="ghost" data-cname="${i}" title="Rename">✎</button></span>`
      : `<button class="lo-custom-empty" data-csave="${i}" title="Save your current loadout here">+ Save as custom ${i + 1}</button>`).join('')}</div>`;
}
function bindPresets(el) {
  el.querySelectorAll('[data-preset]').forEach((b) => { b.onclick = () => useLoadout(PRESETS[Number(b.dataset.preset)].l); });
  el.querySelectorAll('[data-custom]').forEach((b) => { b.onclick = () => { const p = customPresets()[Number(b.dataset.custom)]; if (p) useLoadout(p.l, p.mods); }; });
  el.querySelectorAll('[data-csave]').forEach((b) => {
    b.onclick = () => {
      const i = Number(b.dataset.csave), all = store.get('presets', []), old = customPresets()[i];
      if (old && !confirm(`Replace "${old.name}" with your current loadout?`)) return;
      const mods = {};
      for (const id of settings.loadout) if (settings.mods[id]) mods[id] = settings.mods[id];
      all[i] = { name: old ? old.name : `Custom ${i + 1}`, l: settings.loadout.slice(), mods };
      store.set('presets', all);
      renderLoadout($('menu-loadout'));
      renderLoadout($('pause-loadout'));
      toast(`Saved as "${all[i].name}"`);
    };
  });
  el.querySelectorAll('[data-cname]').forEach((b) => {
    b.onclick = () => {
      const i = Number(b.dataset.cname), all = store.get('presets', []);
      const name = all[i] && prompt('Name this loadout:', all[i].name);
      if (!name || !name.trim()) return;
      all[i].name = name.trim().slice(0, 16);
      store.set('presets', all);
      renderLoadout($('menu-loadout'));
      renderLoadout($('pause-loadout'));
    };
  });
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
  const wr = el.id === 'pause-loadout' && net && game.rules.weapons && WEAPON_RULES[game.rules.weapons] && game.rules.weapons !== 'any' ? WEAPON_RULES[game.rules.weapons] : null;
  el.innerHTML = `${wr ? `<div class="lo-rule">🎯 This server: <b>${esc(wr.name)}</b>. The server picks your weapons; your loadout is used when it's back to Any.</div>` : ''}${presetsBar()}<div class="lo-tabs">${tabs}</div><div class="lo-body"><div class="lo-list">${list}</div>
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
  bindPresets(el);
  el.querySelectorAll('[data-morewraps]').forEach((b) => { b.onclick = () => { if (net) { $('pause').classList.add('hidden'); settingsUI.onClose = () => $('pause').classList.remove('hidden'); settingsUI.open('Customize'); } else showPane('character'); }; });
  el.querySelectorAll('[data-camo]').forEach((b) => {
    b.onclick = () => {
      const m = cleanMods(cur, settings.mods[cur]);
      if (b.dataset.camo === 'default') delete m.camo; else m.camo = b.dataset.camo;
      settings.mods[cur] = m;
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
  if (moderation.badName(tag)) { msg.textContent = 'That gamertag isn\'t allowed.'; msg.classList.add('bad'); return; }
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
    const want = $('tag-input').value.trim();
    if (moderation.badName(want)) throw new Error('That gamertag isn\'t allowed.');
    await social.claim(want);
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

// ---------- Player profiles ----------
if (!store.get('firstPlayed', 0)) store.set('firstPlayed', Date.now());
function myProfile() {
  const st = allStats();
  let fav = '', favKills = 0;
  for (const [k, v] of Object.entries(st)) if (k.startsWith('w_') && WEAPONS[k.slice(2)] && v > favKills) { fav = k.slice(2); favKills = v; }
  const m = fav && settings.mods[fav];
  return {
    name: settings.name || 'Player', color: settings.color, level: myLevel().level, kills: st.kills || 0, deaths: st.deaths || 0,
    wins: st.wins || 0, matches: st.matches || 0, heads: st.headshots || 0, streak: st.bestStreak || 0, fav, favKills,
    banner: getCos().banner, wrap: (m && m.camo) || '', seasons: seasons.badges(), since: store.get('firstPlayed', 0),
    sr: myRanked().sr, srPlayed: myRanked().played,
  };
}
async function openProfile(tag) {
  if (!tag) return;
  const pop = $('profile-pop'), body = $('pf-body');
  pop.classList.remove('hidden');
  const mine = social.tag && tag.toLowerCase() === social.tag.toLowerCase();
  body.innerHTML = '<div class="pf-loading">Loading profile…</div>';
  if (!mine && moderation.isGone(tag)) { body.innerHTML = `<div class="pf-loading"><b>${esc(tag)}</b><br>This player was permanently banned.</div>`; return; }
  const p = mine ? { ...myProfile(), tag: social.tag } : await profiles.fetch(tag);
  if (pop.classList.contains('hidden')) return;
  if (!p) { body.innerHTML = `<div class="pf-loading"><b>${esc(tag)}</b><br>No profile yet. It shows up after they play with a recent version of the game.</div>`; return; }
  const lv = { level: p.level || 1, rank: rankOfLevel(p.level || 1) };
  const kd = (p.kills / Math.max(1, p.deaths)).toFixed(2), wr = p.matches ? Math.round((p.wins / p.matches) * 100) + '%' : '–';
  const role = roles.roleOfTag(p.tag), champ = leaderboard.isChamp(p.tag);
  const W = WEAPONS[p.fav], camo = p.wrap && camoOf(p.wrap);
  const isFriend = [...social.friends.values()].some((f) => f.tag.toLowerCase() === p.tag.toLowerCase());
  body.innerHTML = `
    ${bannerHtml(p.banner || 'standard', p.name || p.tag, p.color, `${esc(lv.rank.name.toUpperCase())} · LEVEL ${lv.level}`, `${badge(role)}${champ ? '<span class="chip">🏆 Weekly champion</span>' : ''}<span class="chip">@${esc(p.tag)}</span>`)}
    <div class="pf-stats">
      ${[['Kills', p.kills.toLocaleString()], ['K/D', kd], ['Wins', p.wins.toLocaleString()], ['Win rate', wr], ['Matches', p.matches.toLocaleString()], ['Headshots', p.heads.toLocaleString()], ['Best streak', p.streak]].map(([n, v]) => `<div><b>${v}</b><small>${n}</small></div>`).join('')}
    </div>
    ${p.srPlayed ? `<div class="pf-fav pf-sr"><i style="background:${divisionOf(p.sr).color}"></i><span><small>Ranked</small><b>${divisionOf(p.sr).icon} ${esc(divisionOf(p.sr).name)}</b></span><em>${p.srPlayed >= PLACEMENTS ? p.sr + ' SR' : 'Placements'}</em></div>` : ''}
    ${W ? `<div class="pf-fav">${camo && camo.id !== 'default' ? `<i style="background:${camoSwatch(camo)}" title="${esc(camo.name)} wrap"></i>` : '<i></i>'}<span><small>Favorite gun</small><b>${esc(W.name)}</b></span><em>${p.favKills.toLocaleString()} kills</em></div>` : ''}
    ${p.seasons.length ? `<div class="pf-badges"><small>Season badges</small>${p.seasons.map((n) => `<span class="pf-sb">S${n}</span>`).join('')}</div>` : ''}
    <div class="pf-foot"><small>${p.since ? 'Playing since ' + new Date(p.since).toLocaleDateString([], { month: 'short', year: 'numeric' }) : ''}</small>
      ${!mine && social.tag && !isFriend ? '<button class="primary" id="pf-add">Add friend</button>' : ''}</div>`;
  const add = $('pf-add');
  if (add) add.onclick = async () => { try { const r = await social.addFriend(p.tag); add.textContent = r === 'accepted' ? 'Friends!' : 'Request sent'; add.disabled = true; } catch (e) { toast(e.message || 'Could not send the request'); } };
}
$('pf-close').onclick = () => $('profile-pop').classList.add('hidden');
$('profile-pop').addEventListener('click', (e) => { if (e.target.id === 'profile-pop') $('profile-pop').classList.add('hidden'); });
// Any gamertag marked data-profile opens its profile.
document.addEventListener('click', (e) => {
  const el = e.target.closest && e.target.closest('[data-profile]');
  if (el && el.dataset.profile) { e.preventDefault(); openProfile(el.dataset.profile); }
});

function renderInvite() {
  const el = $('invite-card');
  el.classList.toggle('hidden', !social.tag); // needs a gamertag; the gamertag card below says so
  const n = invites.count(), base = location.origin + location.pathname;
  el.innerHTML = `<div class="inv-head"><span class="inv-ic">🎁</span><div><h3>Invite friends</h3>
      <p class="note">Send your link. When a new player opens it and finishes their first match, you <b>both</b> get 🪙 ${INVITE_TOKENS}. (${n} / ${MAX_INVITES} friends so far)</p></div></div>
    ${social.tag ? `<div class="inv-row"><input id="inv-link" readonly value="${esc(invites.link(base))}"><button class="primary" id="inv-copy">Copy link</button>${navigator.share ? '<button id="inv-share">Share</button>' : ''}</div>`
      : '<p class="note">Get a gamertag first (below) so your friends\' joins count for you.</p>'}`;
  const copy = $('inv-copy');
  if (copy) copy.onclick = async () => {
    try { await navigator.clipboard.writeText($('inv-link').value); copy.textContent = 'Copied!'; } catch { $('inv-link').select(); }
    setTimeout(() => { copy.textContent = 'Copy link'; }, 1500);
  };
  const share = $('inv-share');
  if (share) share.onclick = () => navigator.share({ title: 'Gun Game 3D', text: `Play Gun Game 3D with me! We both get ${INVITE_TOKENS} tokens.`, url: $('inv-link').value }).catch(() => {});
}
// ---------- Clans ----------
let clanForm = 'create';
function renderClan() {
  const el = $('clan-card');
  el.classList.toggle('hidden', !social.tag);
  const c = clans.myClan(), pend = clans.mine && clans.mine.pending ? clans.mine.tag : null;
  const keep = (sel) => { const i = el.querySelector(sel); return i ? i.value : ''; };
  const draft = { tag: keep('#cl-tag'), name: keep('#cl-name'), join: keep('#cl-join'), say: keep('#cl-say') };
  if (!social.tag) { el.innerHTML = '<h3>🛡 Clan</h3><p class="note">Get a gamertag first to create or join a clan.</p>'; return; }
  if (pend) {
    el.innerHTML = `<h3>🛡 Clan</h3><p class="note">Request sent to <b>[${esc(pend)}]</b>. Waiting for their leader to let you in.</p><button id="cl-cancel">Cancel request</button>`;
    $('cl-cancel').onclick = () => clans.cancelRequest();
    return;
  }
  if (!c) {
    el.innerHTML = `<h3>🛡 Clan</h3><p class="note">Team up under a tag like <b>[GIGA]</b>, shown before your name in matches, with clan chat and a clan leaderboard.</p>
      <div class="seg cl-seg"><button data-cf="create" class="${clanForm === 'create' ? 'sel' : ''}">Create a clan</button><button data-cf="join" class="${clanForm === 'join' ? 'sel' : ''}">Join a clan</button></div>
      ${clanForm === 'create' ? `<div class="cl-form"><input id="cl-tag" maxlength="5" placeholder="TAG" value="${esc(draft.tag)}" autocapitalize="characters" spellcheck="false"><input id="cl-name" maxlength="24" placeholder="Clan name" value="${esc(draft.name)}" spellcheck="false">
        <div class="cl-colors">${CLAN_COLORS.map((x, i) => `<button data-cc="${x}" class="${i === 0 ? 'sel' : ''}" style="background:${x}"></button>`).join('')}</div>
        <button class="primary" id="cl-create">Create</button></div>`
      : `<div class="cl-form"><input id="cl-join" maxlength="5" placeholder="Clan TAG" value="${esc(draft.join)}" autocapitalize="characters" spellcheck="false"><button class="primary" id="cl-req">Ask to join</button></div>`}
      <p class="note" id="cl-msg"></p>`;
    el.querySelectorAll('[data-cf]').forEach((b) => { b.onclick = () => { clanForm = b.dataset.cf; renderClan(); }; });
    let color = CLAN_COLORS[0];
    el.querySelectorAll('[data-cc]').forEach((b) => { b.onclick = () => { color = b.dataset.cc; el.querySelectorAll('[data-cc]').forEach((x) => x.classList.toggle('sel', x === b)); }; });
    const msg = (t) => { $('cl-msg').textContent = t; };
    if ($('cl-create')) $('cl-create').onclick = async () => { msg('Checking the tag…'); try { await clans.create($('cl-tag').value, $('cl-name').value, color); toast('Clan created!'); } catch (e) { msg(e.message); } };
    if ($('cl-req')) $('cl-req').onclick = async () => { msg('Looking it up…'); try { const k = await clans.requestJoin($('cl-join').value); toast(`Request sent to [${k.tag}] ${k.name}`); } catch (e) { msg(e.message); } };
    el.querySelectorAll('input').forEach((i) => i.addEventListener('keydown', (e) => e.stopPropagation()));
    return;
  }
  const lead = clans.isLeader();
  const reqs = [...clans.requests.values()];
  el.innerHTML = `<div class="cl-head"><b class="cl-name" style="color:${c.color}">[${esc(c.tag)}] ${esc(c.name)}</b><small>${c.members.length}/${MAX_MEMBERS} members</small>
      ${lead ? '<button class="danger" id="cl-disband">Disband</button>' : '<button id="cl-leave">Leave</button>'}</div>
    ${lead && reqs.length ? `<div class="cl-reqs">${reqs.map((r) => `<div class="fr-row"><span class="fr-name pf-link" data-profile="${esc(r.tag)}">${esc(r.tag)}</span><small>wants to join</small><button class="primary" data-cacc="${esc(r.tag)}">Accept</button><button data-cdeny="${esc(r.tag)}">Deny</button></div>`).join('')}</div>` : ''}
    <div class="cl-members">${c.members.map((m) => `<span class="cl-m"><span class="pf-link" data-profile="${esc(m)}">${m.toLowerCase() === c.leader.toLowerCase() ? '👑 ' : ''}${esc(m)}</span>${lead && m.toLowerCase() !== c.leader.toLowerCase() ? `<button class="ghost" data-ckick="${esc(m)}" title="Remove from clan">✕</button>` : ''}</span>`).join('')}</div>
    <div class="cl-chat" id="cl-chat">${clans.chat.length ? clans.chat.map((x) => `<div><b>${esc(x.from)}</b> ${esc(x.text)}</div>`).join('') : '<small class="muted">Clan chat: messages show for members who are online.</small>'}</div>
    <form id="cl-chat-form" class="fr-add" autocomplete="off"><input id="cl-say" maxlength="200" placeholder="Message your clan" value="${esc(draft.say)}"><button class="primary" type="submit">Send</button></form>`;
  const log = $('cl-chat'); log.scrollTop = log.scrollHeight;
  $('cl-say').addEventListener('keydown', (e) => e.stopPropagation());
  $('cl-chat-form').onsubmit = async (e) => { e.preventDefault(); const v = $('cl-say').value.trim(); if (!v) return; $('cl-say').value = ''; try { await clans.say(v); } catch (err) { toast(err.message); } };
  if ($('cl-leave')) $('cl-leave').onclick = async () => { if (confirm(`Leave [${c.tag}]?`)) try { await clans.leave(); } catch (e) { toast(e.message); } };
  if ($('cl-disband')) $('cl-disband').onclick = async () => { if (confirm(`Disband [${c.tag}] for everyone? The tag becomes free.`)) await clans.disband(); };
  el.querySelectorAll('[data-cacc]').forEach((b) => { b.onclick = async () => { try { await clans.accept(b.dataset.cacc); } catch (e) { toast(e.message); } }; });
  el.querySelectorAll('[data-cdeny]').forEach((b) => { b.onclick = () => clans.deny(b.dataset.cdeny); });
  el.querySelectorAll('[data-ckick]').forEach((b) => { b.onclick = async () => { if (confirm(`Remove ${b.dataset.ckick} from the clan?`)) await clans.kick(b.dataset.ckick); }; });
}

function renderFriends() {
  renderInvite();
  renderClan();
  const n = social.pendingCount;
  $('nav-friends-count').textContent = n ? String(n) : '';
  $('fr-me').innerHTML = social.tag
    ? `Your gamertag: <b class="pf-link" data-profile="${esc(social.tag)}" title="View your profile">${esc(social.tag)}</b>${badge(roles.myRole(), true)} <span class="sv-status ${social.status}">${social.status === 'online' ? '● Online' : social.status === 'connecting' ? 'Connecting…' : 'Offline'}</span>`
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
  const friends = [...social.friends.entries()].filter(([, f]) => !moderation.isGone(f.tag)).sort(([, a], [, b]) => social.isOnline(b) - social.isOnline(a) || a.tag.localeCompare(b.tag));
  const inParty = (t) => social.party && social.party.members.some((m) => m.toLowerCase() === t.toLowerCase());
  $('fr-count').textContent = friends.length ? `(${friends.filter(([, f]) => social.isOnline(f)).length} online)` : '';
  $('fr-list').innerHTML = friends.length ? friends.map(([k, f]) => {
    const on = social.isOnline(f), p = f.pres || {};
    const where = !on ? 'Offline' : p.mode === 'lobby' ? 'In a match' : 'In the menu';
    const canInvite = on && !inParty(f.tag) && (!social.party || social.isLeader);
    const canJoin = on && p.lobby && !net;
    return `<div class="fr-row"><i class="fr-dot ${on ? 'on' : ''}"></i><span class="fr-name pf-link" data-profile="${esc(f.tag)}">${esc(f.tag)}${badge(roles.roleOfTag(f.tag), true)}${inParty(f.tag) ? ' <em>party</em>' : ''}</span><small>${where}</small>
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
        : voice.muted ? 'Muted' : opts.voicePtt ? `Hold ${keysLabel('voice')} to talk` : 'Mic on';
    }
    const canFollow = !social.isLeader && p.lobby && !net;
    $('pt-follow').classList.toggle('hidden', !canFollow);
    $('pt-follow').dataset.code = p.lobby || '';
    $('pt-log').innerHTML = social.partyLog.map((l) => (l.from
      ? `<div class="cl"><b style="color:${l.mine ? 'var(--accent)' : '#c9a2ff'}">${esc(l.from)}:</b> ${esc(moderation.clean(l.text))}</div>`
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
  if (text && !chatBlocked()) social.sayParty(text);
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
  const mine = voice.muted ? '🔇 Voice muted' : opts.voicePtt ? (voice.pttDown ? '🎤 Talking' : `🎤 Hold ${keysLabel('voice')} to talk`) : '🎤 Mic on';
  el.innerHTML = `<div class="me">${mine}</div>` + voice.talkers().filter((t) => t !== social.tag).map((t) => `<div class="t">🔊 ${esc(t)}</div>`).join('');
}
voice.onChange = () => { renderFriends(); renderVoiceHud(); };
window.addEventListener('keydown', (e) => { if (isBound('voice', e.code)) setTimeout(renderVoiceHud, 0); });
window.addEventListener('keyup', (e) => { if (isBound('voice', e.code)) setTimeout(renderVoiceHud, 0); });
window.voice = voice; // debugging
$('pt-follow').onclick = () => { if ($('pt-follow').dataset.code) { $('join-code').value = $('pt-follow').dataset.code; joinLobby(); } };

social.onChange = () => {
  invites.watch();
  clans.sync();
  renderFriends();
  applyGamertag();
  // Gamertag claimed / released, or this device's key just loaded: the staff role may have changed.
  const role = roles.myRole();
  if (social.tag !== lastTag || role !== lastRole) { lastTag = social.tag; lastRole = role; roles.changed(); }
};
let lastTag = social.tag, lastRole = null;
social.onNotice = (text) => toast(text);
// Party chat also shows up in the match chat; "/p message" in match chat talks to your party.
social.onPartyChat = ({ from, text, mine }) => { if (from && net && !mine) chat.add(`[Party] ${from}`, '#c9a2ff', moderation.clean(text)); };
applyGamertag();
renderFriends();
window.social = social; // debugging
// First visit: ask for a gamertag (only on the menu, never on top of a match).
social.ready.then(() => { if (!social.tag && !sessionStorage.getItem('tagLater') && !net) openTagPop(); });

// Mode and map pickers are tap targets rather than dropdowns (much easier on touch screens).
function renderModes() {
  $('mode-tiles').innerHTML = MODE_ORDER.map((id) =>
    `<button class="tile ${id === settings.mode ? 'sel' : ''} ${id === featuredMode() ? 'feat' : ''}" data-mode="${id}">${id === featuredMode() ? '⭐ ' : ''}${MODES[id].name}${id === featuredMode() ? `<small>featured today · ${FEATURED_XP}x XP</small>` : MODES[id].teams ? '<small>teams</small>' : ''}</button>`).join('');
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
const announcer = new ServerAnnouncer();
let hosting = null; // { public, name, max, region } while hosting

function renderRulesPick() {
  const all = [...RULE_PRESETS, ...savedPresets()];
  if (!all.some((p) => p.id === serverCfg.rules)) serverCfg.rules = 'classic';
  $('sv-rules').innerHTML = all.map((p) => `<option value="${esc(p.id)}" ${p.id === serverCfg.rules ? 'selected' : ''}>${p.saved ? '★ ' : ''}${esc(p.name)}</option>`).join('');
}
function renderCreateForm() {
  renderRulesPick();
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
$('sv-rules').onchange = () => { serverCfg.rules = $('sv-rules').value; saveCfg(); };
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
      <div class="sv-main"><b>${s.gn ? '🌙 ' : ''}${esc(s.name)}${s.ranked ? ` ${srBadge(s.sr || 1000)}` : ''}</b><small>${s.mode === featuredMode() ? '⭐ ' : ''}${esc(mode)} · ${esc(map)}${s.rules ? ` · <em class="sv-rules">${esc(s.rules)}</em>` : ''}</small></div>
      ${s.region ? `<span class="sv-region">${esc(s.region)}</span>` : '<span></span>'}
      <div class="sv-players ${full ? 'full' : ''}">${s.players}/${s.max}${s.bots ? `<small>+${s.bots} bots</small>` : ''}</div>
      <button class="primary" data-join="${esc(s.code)}" ${full ? 'disabled' : ''}>${full ? 'Full' : 'Join'}</button>
    </div>`;
  }).join('');
  el.querySelectorAll('[data-join]').forEach((b) => { b.onclick = () => { $('join-code').value = b.dataset.join; joinLobby(); }; });
}
browser.onChange = () => { renderServers(); if (!game.active && menuPane === 'play') renderHome(); };

// What a public server tells the list.
function listingInfo() {
  const L = net && net.logic;
  const all = L ? [...L.players.values()] : [];
  return {
    name: hosting.name, max: hosting.max, region: hosting.region, gn: hosting.gn ? 1 : 0, ranked: L && L.s.ranked ? 1 : 0, sr: myRanked().sr, rules: L ? L.s.rulesName || '' : '',
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
  play: ['Play', 'Quick Play, ranked, the featured mode of the day, or pick a server.'],
  loadout: ['Loadout', 'One weapon per slot. Changes apply the next time you spawn.'],
  character: ['Character', 'Your callsign, color and cosmetics. Earn tokens from missions to unlock more.'],
  missions: ['Missions', 'The season pass, daily rewards and challenges, your level and missions. All of them pay tokens.'],
  leaderboard: ['Leaderboard', 'Top players by XP, kills, wins and headshots: this week, last week or all time, in every mode or just one.'],
  friends: ['Friends', 'Add friends by gamertag, see who\'s online, party up and chat.'],
  mod: ['Mod Panel', 'Staff only: warn, ban or force a new gamertag. Every action is signed with your key.'],
};
let menuPane = store.get('menuPane', 'play');
function showPane(name) {
  if (!PANE_INFO[name] || (name === 'mod' && !roles.myRole())) name = 'play';
  menuPane = name;
  store.set('menuPane', name);
  $('pane-title').textContent = PANE_INFO[name][0];
  $('pane-sub').textContent = PANE_INFO[name][1];
  document.querySelectorAll('#menu-nav [data-pane]').forEach((b) => b.classList.toggle('sel', b.dataset.pane === name));
  document.querySelectorAll('.menu-pane').forEach((p) => p.classList.toggle('hidden', p.dataset.pane !== name));
  // Entrance animation (ui.css) only when a screen opens, not on every refresh.
  const opened = document.querySelector(`.menu-pane[data-pane="${name}"]`);
  if (opened) { opened.classList.remove('enter'); void opened.offsetWidth; opened.classList.add('enter'); clearTimeout(showPane.t); showPane.t = setTimeout(() => opened.classList.remove('enter'), 700); }
  if (name === 'character') { if (settingsUI) settingsUI.tryOn = null; renderCharacter(); }
  renderChip();
  if (name === 'missions') renderMissions();
  if (name === 'play') { browser.start(); renderServers(); }
  if (name === 'friends') renderFriends();
  if (name === 'leaderboard') renderLeaderboard();
  if (name === 'mod' && modPanel) modPanel.render();
  document.querySelector('.menu-body').scrollTop = 0;
}
document.querySelectorAll('#menu-nav [data-pane]').forEach((b) => { b.onclick = () => showPane(b.dataset.pane); });
$('player-chip').onclick = () => showPane('character');

game.onLevel = () => { if (net) net.send({ t: 'cos', c: myCos() }); };
onProgress((e) => { if (e.type !== 'xp' && !game.active) renderChip(); });
setInterval(() => { if (!game.active && menuPane === 'play') renderHome(); }, 60000);

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
  if (m.t === 'welcome') { chat.setLobby(true); chat.system(net && net.practice ? 'Practice Range: pick any weapon from the pause menu (Esc).' : `Joined lobby ${net ? net.code : ''}. Say hi!`); }
  else if (m.t === 'chat') chat.add((ROLE_INFO[m.role] ? ROLE_INFO[m.role].icon + ' ' : '') + m.name, colorOf(m.id, m.color), moderation.clean(m.text), m.id === game.myId);
  if (net && !net.practice && (m.t === 'pjoin' || m.t === 'pident') && !m.bot) {
    const p = game.players.get(m.id);
    if (p && m.id !== game.myId) moderation.notePlayer(p.name, p.gt, net.code);
  }
  if (net && !net.practice && m.t === 'welcome') for (const p of m.players) if (!p.bot && p.id !== m.id) moderation.notePlayer(p.name, p.gt, net.code);
  if (m.t === 'pjoin' && m.cos && m.cos.clan) clans.lookup(m.cos.clan);
  if (m.t === 'pcos' && m.c && m.c.clan) clans.lookup(m.c.clan);
  if (m.t === 'welcome') for (const p of m.players) if (p.cos && p.cos.clan) clans.lookup(p.cos.clan);
  // Different game versions in one match cause lag, missed shots and odd bugs: say so right away.
  if (m.t === 'welcome' && !game.spectating && net && !net.practice && !net.isHost) {
    if (!m.v || cmpVersion(m.v, APP_VERSION) < 0) chat.system(`⚠ The host's game is out of date${m.v ? ` (${m.v})` : ''}. Things may act up until they refresh.`);
    else if (cmpVersion(m.v, APP_VERSION) > 0) { chat.system(`⚠ Your game is out of date (host has ${m.v}). Update to avoid lag and missed shots.`); updater.check(); }
  }
  if (m.t === 'pjoin' && !m.bot && net && net.isHost && (!m.cos || !m.cos.v || cmpVersion(m.cos.v, APP_VERSION) < 0)) chat.system(`⚠ ${m.name}'s game is out of date. Tell them to refresh the page.`);
  // Game Night voice room: who's in it comes through the match.
  if (m.t === 'vc' && m.gt) voice.onAnnounce(m.gt, m.in, 'gn');
  if (m.t === 'pleave' && voice.inRoom) { const gt = gnvcTags.get(m.id); if (gt) voice.onAnnounce(gt, false, 'gn'); }
  if (m.t === 'pident' && m.gt) gnvcTags.set(m.id, m.gt);
  if (m.t === 'welcome') { gnvcTags.clear(); for (const p of m.players || []) if (p.gt) gnvcTags.set(p.id, p.gt); }
  if (m.t === 'pjoin' && !m.bot) chat.system(`${m.name} joined`);
  else if (m.t === 'pleave' && !m.quiet && !String(m.name).startsWith('[BOT]') && !/^zd+$/.test(m.id)) chat.system(`${m.name} left`);
  // Pause-menu player lists follow joins, leaves and staff actions.
  if (['chatmode', 'pident', 'prole', 'pmute', 'pfrozen', 'pname', 'pjoin', 'pleave'].includes(m.t)) { renderModList(); renderReportList(); }
  // Keep a public listing's player count / mode / map current.
  if (hosting && hosting.public && ['pjoin', 'pleave', 'start'].includes(m.t)) announcer.publish();
}

function newNet() {
  const n = new Net();
  n.onMessage = (m) => { game.onNet(m); chatOnNet(m); };
  n.onClose = (reason) => leave(reason);
  game.attach(n, { loadout: settings.loadout, color: settings.color });
  game.myBanner = getCos().banner; // for the MVP card
  return n;
}

// Highlight clips: on computers (not Low-end graphics), in real matches.
function startHighlights() {
  highlights.resetMatch();
  if (opts.recordClips && !mobile && game.gfx !== 'potato' && net && !net.practice && !game.spectating) highlights.start(game.renderer.domElement);
}
game.onMoment = (m) => highlights.moment(m.score, m.label);
game.onRendered = (now) => highlights.frame(now);
game.onMatchStart = () => highlights.resetMatch();
highlights.onChange = () => { game.highlight = highlights.best; };

function enterGame() {
  setTimeout(startHighlights, 0);
  $('menu').classList.add('hidden');
  if (!game.spectating && !net.practice) social.setWhere('lobby', net.code); // friends see you're in a match and can join
  $('pause-code').textContent = net.code;
  $('pause-title').textContent = net.practice ? 'PRACTICE RANGE' : game.spectating ? 'SPECTATING' : net.isHost ? 'SERVER CREATED' : 'JOINED SERVER';
  $('pause-vis').textContent = 'Code';
  $('btn-resume').textContent = game.padMode ? 'Press Ⓐ to play' : 'Click to play';
  if (!net.practice) history.replaceState(null, '', '?lobby=' + net.code);
  showPause();
}

function showPause() {
  chat.setPaused(true);
  renderLoadout($('pause-loadout'));
  $('btn-hostpanel').classList.toggle('hidden', !(net && net.isHost) || !!(net && net.practice));
  $('pause-code').parentElement.classList.toggle('hidden', !!(net && net.practice));
  renderPractice();
  renderModList();
  renderReportList();
  renderLoadout($('pause-loadout')); // shows the server's weapon rule, if any
  renderPauseTabs();
  $('pause').classList.remove('hidden');
}

// Pause menu sections (loadout, practice weapons, moderation, report) as tabs: one at a time.
let pauseTab = null;
function renderPauseTabs() {
  const secs = [['pause-lo', 'Loadout'], ['pause-practice', '🎯 Weapons'], ['pause-mod', '🛡 Moderation'], ['pause-report', '🚩 Report']]
    .filter(([id]) => !$(id).classList.contains('hidden'));
  if (!secs.some(([id]) => id === pauseTab)) pauseTab = secs.some(([id]) => id === 'pause-practice') ? 'pause-practice' : 'pause-lo';
  $('pause-tabs').innerHTML = secs.length > 1 ? secs.map(([id, n]) => `<button data-pt="${id}" class="${id === pauseTab ? 'sel' : ''}">${n}</button>`).join('') : '';
  $('pause-tabs').classList.toggle('hidden', secs.length < 2);
  for (const [id] of secs) { $(id).classList.toggle('pt-off', id !== pauseTab); $(id).open = true; }
  $('pause-tabs').querySelectorAll('[data-pt]').forEach((b) => { b.onclick = () => { pauseTab = b.dataset.pt; renderPauseTabs(); }; });
}

// ---------- Staff ----------

// Staff prove who they are to the host when they join (it checks the signature, then everyone
// sees the badge).
game.onWelcome = async () => {
  if (game.spectating || !net || net.practice) return;
  if (social.tag) net.send({ t: 'ident', proof: await social.sign({ ident: 1, lobby: net.code, id: game.myId }) });
  const proof = await roles.proof(net && net.code, game.myId);
  if (proof && net) net.send({ t: 'staff', proof });
};

// Pause-menu moderation: shown once the host has verified you as staff.
function renderModList() {
  if (net && net.practice) { $('pause-mod').classList.add('hidden'); return; }
  const me = game.players.get(game.myId);
  const mine = (me && me.role) || (game.spectating && roles.myRole());
  $('pause-mod').classList.toggle('hidden', !net || !mine);
  if (!net || !mine) return;
  const rank = (r) => (r === 'owner' ? 2 : r === 'mod' ? 1 : 0);
  const rows = [...game.players.values()].filter((p) => p.id !== game.myId && !p.bot);
  $('mod-list').innerHTML = rows.length ? rows.map((p) => {
    const can = rank(mine) > rank(p.role);
    return `<div class="mod-row"><span class="mod-name">${esc(p.name)}${badge(p.role, true)}${p.gt && p.gt !== p.name ? ` <small class="gt">@${esc(p.gt)}</small>` : p.gt ? ' <small class="gt">✓</small>' : ' <small class="gt guest">guest</small>'}${p.muted ? ' <em>muted</em>' : ''}</span>
      ${can ? `<button data-mwarn="${p.id}" title="Pop up a warning on their screen">⚠ Warn</button><button data-mren="${p.id}" title="Change their name in this match">✎ Rename</button><button data-mfreeze="${p.id}">${p.frozen ? '🔥 Unfreeze' : '🧊 Freeze'}</button><button data-mute="${p.id}">${p.muted ? 'Unmute' : 'Mute'}</button>${p.id !== 'host' ? `<button class="danger" data-mkick="${p.id}">Kick</button>` : '<small>host</small>'}` : '<small>staff</small>'}</div>`;
  }).join('') : '<div class="note">No other players here yet.</div>';
  $('mod-list').querySelectorAll('[data-mute]').forEach((b) => { b.onclick = () => net.send({ t: 'modmute', id: b.dataset.mute }); });
  $('mod-list').querySelectorAll('[data-mfreeze]').forEach((b) => { b.onclick = () => net.send({ t: 'modfreeze', id: b.dataset.mfreeze }); });
  // Match tools work for any staff member, even when someone else is hosting.
  const sel = $('mm-map');
  if (!sel.options.length) sel.innerHTML = MAP_ORDER.map((id) => `<option value="${id}">${esc(MAPS[id].name)}</option>`).join('');
  const cm = game.chatMode || {};
  $('mm-lock').textContent = cm.lock ? '🔓 Unlock chat' : '🔒 Lock chat';
  $('mm-slow').textContent = cm.slow ? '🐢 Slow mode: on' : '🐢 Slow mode';
  $('mm-lock').onclick = () => net.send({ t: 'modchat', op: 'lock' });
  $('mm-slow').onclick = () => net.send({ t: 'modchat', op: 'slow' });
  $('mod-match').querySelectorAll('[data-mm]').forEach((b) => {
    b.onclick = () => {
      const op = b.dataset.mm;
      const what = { end: 'End this match for everyone?', restart: 'Restart this match for everyone?', map: `Change the map to ${MAPS[sel.value].name} for everyone?` }[op];
      if (confirm(what)) net.send({ t: 'modmatch', op, map: sel.value });
    };
  });
  $('mod-list').querySelectorAll('[data-mwarn]').forEach((b) => {
    b.onclick = () => {
      const p = game.players.get(b.dataset.mwarn);
      const reason = p && prompt(`Warning for ${p.name} (they'll see this):`, '');
      if (reason && reason.trim()) net.send({ t: 'modwarn', id: p.id, reason: reason.trim().slice(0, 140) });
    };
  });
  $('mod-list').querySelectorAll('[data-mren]').forEach((b) => {
    b.onclick = () => {
      const p = game.players.get(b.dataset.mren);
      const name = p && prompt(`New name for ${p.name} in this match:`, 'Player' + ((Math.random() * 900 + 100) | 0));
      if (name && name.trim()) net.send({ t: 'modrename', id: p.id, name: name.trim().slice(0, 16) });
    };
  });
  $('mod-list').querySelectorAll('[data-mkick]').forEach((b) => {
    b.onclick = () => {
      const p = game.players.get(b.dataset.mkick);
      if (p && confirm(`Kick ${p.name} from this match?`)) net.send({ t: 'modkick', id: p.id });
    };
  });
}

// Friends tab: the staff list for everyone; the owner can appoint and remove moderators.
function renderStaff() {
  const owner = roles.isOwner();
  const mods = [...roles.mods.values()].sort((a, b) => a.tag.localeCompare(b.tag));
  $('staff-list').innerHTML = `<div class="fr-row"><span class="fr-name">${esc(OWNER.tag)}</span>${badge('owner')}</div>` +
    mods.map((m) => `<div class="fr-row"><span class="fr-name">${esc(m.tag)}</span>${badge('mod')}${owner ? `<button class="ghost fr-x" data-unmod="${esc(m.tag)}" title="Remove moderator">✕</button>` : ''}</div>`).join('') +
    (mods.length ? '' : '<div class="note">No moderators yet.</div>');
  $('staff-add').classList.toggle('hidden', !owner);
  // Signed in with a staff gamertag on a device that doesn't hold its key (another browser).
  const wrongDevice = social.tag && roles.roleOfTag(social.tag) && !roles.myRole() && social.pub;
  $('staff-msg').textContent = wrongDevice ? `You're ${social.tag}, but this browser doesn't have the key that gamertag was claimed with, so staff tools are off here. Use the browser you claimed it on.` : $('staff-msg').textContent;
  $('staff-list').querySelectorAll('[data-unmod]').forEach((b) => {
    b.onclick = async () => {
      if (!confirm(`Remove ${b.dataset.unmod} as a moderator?`)) return;
      try { await roles.remove(b.dataset.unmod); $('staff-msg').textContent = `${b.dataset.unmod} is no longer a moderator.`; } catch (e) { $('staff-msg').textContent = e.message; }
    };
  });
}
$('staff-add').addEventListener('submit', async (e) => {
  e.preventDefault();
  const tag = $('staff-tag').value.trim();
  if (!validTag(tag)) { $('staff-msg').textContent = `Gamertags are ${TAG_RULES}.`; return; }
  $('staff-msg').textContent = 'Looking up…';
  try {
    const t = await roles.appoint(tag);
    $('staff-tag').value = '';
    $('staff-msg').textContent = `${t} is now a moderator.`;
  } catch (err) { $('staff-msg').textContent = err.message; }
});
$('staff-tag').addEventListener('keydown', (e) => e.stopPropagation());
roles.init(social);
roles.onChange = () => { renderStaff(); renderFriends(); renderChip(); moderation.sync(); renderModNav(); leaderboard.reverify(); };
renderStaff();

// ---------- Mod panel, warnings, bans, forced gamertag changes ----------

// var: showPane() may run before this line
var modPanel = new ModPanel($('mod-pane'), social, {
  joinLobby: (code, spectate = false) => { $('join-code').value = code; showPane('play'); joinLobby(spectate); },
  servers: { list: () => browser.list(), start: () => browser.start() },
});
function renderModNav() {
  const staff = !!roles.myRole();
  $('nav-mod').classList.toggle('hidden', !staff);
  if (!staff && menuPane === 'mod') showPane('play');
}
moderation.init(social);
seasons.onTier = (e) => {
  const what = e.item ? ` + ${seasonItemName(e.item)}` : '';
  if (game.active) game.hud.mission(`Season tier ${e.tier}`, `+${e.tokens} tokens${e.item ? ' · new ' + (e.item.kind === 'wrap' ? 'wrap' : 'banner') + '!' : ''}`, `SEASON ${e.season.n}`);
  else toast(`Season tier ${e.tier}: 🪙 ${e.tokens}${what}`);
};
profiles.init(social);
clans.init(social);
clans.onChange = () => {
  if (!game.active && menuPane === 'friends' && !(document.activeElement && document.activeElement.closest && document.activeElement.closest('#clan-card input'))) renderClan();
  if (!game.active && menuPane === 'leaderboard') renderLeaderboard();
};
clans.onChat = (x) => {
  if (game.active && social.tag && x.from.toLowerCase() !== social.tag.toLowerCase()) chat.system(`[${clans.myClan().tag}] ${x.from}: ${x.text}`);
  else if (menuPane === 'friends' && $('cl-chat')) { const log = $('cl-chat'); if (!log.querySelector('b')) log.innerHTML = ''; log.insertAdjacentHTML('beforeend', `<div><b>${esc(x.from)}</b> ${esc(x.text)}</div>`); log.scrollTop = log.scrollHeight; }
};
invites.init(social);
invites.onReward = (e) => {
  const msg = e.kind === 'joined' ? `Thanks for joining through ${e.name}'s invite! 🪙 ${e.tokens} for you both.` : `${e.name} joined through your invite: 🪙 ${e.tokens}!`;
  if (game.active) game.hud.mission(e.kind === 'joined' ? 'Welcome bonus' : `${e.name} joined!`, `+${e.tokens} tokens`, 'INVITE');
  else toast(msg);
  renderChip();
};
if (invites.pending()) setTimeout(() => toast(`${invites.pending()} invited you: finish your first match and you both get 🪙 ${INVITE_TOKENS}!`), 1500);
game.onRanked = (r) => { if (r.newDiv) game.hud.mission(r.delta >= 0 ? `Promoted to ${r.newDiv.name}` : `Dropped to ${r.newDiv.name}`, `${r.sr} SR`, 'RANKED'); };
gameNight.init(social);
leaderboard.init(social);
moderation.onPerma = () => { leaderboard.updateChamps(); if (leaderboard.onChange) leaderboard.onChange(); if (clans.onChange) clans.onChange(); if (!game.active) renderFriends(); };
leaderboard.onChange = () => {
  clearTimeout(lbT);
  lbT = setTimeout(() => { if (!game.active && menuPane === 'leaderboard') renderLeaderboard(); updateLbNav(); }, 300);
};
leaderboard.onChampion = (boards) => {
  const msg = `🏆 You were #1 last week (${boards.join(', ')})! +${CHAMP_TOKENS} tokens and the Weekly Champion wrap.`;
  if (game.active) game.hud.mission('Weekly Champion', `+${CHAMP_TOKENS} tokens · new wrap!`, '#1 LAST WEEK');
  else toast(msg);
  renderChip();
};
// Double XP in Game Night servers while it's live.
setXpBoost(() => !game.active ? 1 : (game.rules.gn && gameNight.isLive() ? GN_XP : 1) * (game.rules.mode === featuredMode() ? FEATURED_XP : 1));
// Finishing a match in a Game Night server earns the Midnight wrap (once).
game.onMatchTracked = () => {
  invites.matchDone(settings.name);
  if (game.rules.mode === featuredMode()) {
    const paid = claimFeatured();
    if (paid) game.hud.mission(`Featured mode: ${MODES[game.rules.mode].name}`, `+${paid} tokens`, 'DAILY FEATURED');
  }
  if (game.rules.gn && gameNight.isLive() && grantWrap('midnight')) game.hud.mission('Midnight wrap unlocked', 'Played Game Night', 'GAME NIGHT');
};
gameNight.on((e) => {
  if (e.type === 'start') {
    const msg = `🌙 Game Night is live! ${GN_XP}x XP in the Game Night server.`;
    if (net && !net.practice) {
      chat.system(game.rules.gn ? `🌙 Game Night is live: ${GN_XP}x XP in this server!` : `${msg} Join it from the menu (Servers → Join game night).`);
      game.hud.say('🌙 GAME NIGHT IS LIVE');
    } else toast(msg);
    gameNight.notify('Game Night is live! Hop on: everyone plays in one server, double XP.');
  } else if (e.type === 'soon') {
    const mins = Math.max(1, Math.round((e.w.start - Date.now()) / 60000));
    if (!net) toast(`🌙 Game Night starts in ${mins} min`);
    gameNight.notify(`Game Night starts in ${mins} minutes.`);
  } else if (e.type === 'end' && net && game.rules.gn) chat.system('🌙 Game Night is over. Thanks for playing! Same time next time.');
  if (!game.active && menuPane === 'play') renderHome();
});
// Game Night events (events.js): everyone gets the warnings; the Game Night server's host starts them.
watchEvents(() => gameNight.window(), (e) => {
  const name = EVENT_NAMES[e.kind] || e.kind;
  const inGn = !!(net && !net.practice && game.active && game.rules.gn);
  if (e.step === 'warn' || e.step === 'soon') {
    const mins = e.step === 'warn' ? e.warn : 1;
    const text = `${name} starts in ${mins} minute${mins === 1 ? '' : 's'} in the Game Night server!`;
    if (inGn) { chat.system(text); game.hud.say(`${name.toUpperCase()} IN ${mins} MIN`); }
    else if (net && !net.practice) chat.system(`${text} Join it from the menu.`);
    else toast(text);
    if (e.step === 'warn') gameNight.notify(text);
  } else if (e.step === 'go' && inGn && net.isHost && net.logic) {
    if (e.kind === 'br') net.logic.startEvent('br', BR_MAPS[(Math.random() * BR_MAPS.length) | 0]);
  }
});

// Presence and reports can arrive in bursts: redraw at most a few times a second, and never
// while something in the panel is being typed or picked (just the looked-up player then).
let modRenderT = null;
moderation.onChange = () => {
  if (menuPane !== 'mod' || $('menu').classList.contains('hidden') || modRenderT) return;
  modRenderT = setTimeout(() => {
    modRenderT = null;
    const a = document.activeElement;
    if (a && a.closest && a.closest('#mod-pane') && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) modPanel.renderPlayer();
    else modPanel.render();
  }, 300);
};
renderModNav();

// Announcements from staff: a bar at the top of the menu, plus a chat line / pop-up in a match.
const annShown = new Set();
moderation.onAnnounce = (a) => {
  const bar = $('announce-bar');
  const hidden = !a || store.get('annHidden', '') === a.id;
  bar.classList.toggle('hidden', hidden);
  if (!a) return;
  bar.className = `announce-bar ${a.level}${hidden ? ' hidden' : ''}`;
  bar.querySelector('.ab-icon').textContent = a.level === 'warn' ? '⚠' : '📣';
  bar.querySelector('.ab-text').textContent = a.text;
  bar.querySelector('.ab-by').textContent = `— ${a.from}`;
  bar.querySelector('.ab-x').onclick = () => { store.set('annHidden', a.id); bar.classList.add('hidden'); };
  if (!annShown.has(a.id)) {
    annShown.add(a.id);
    if (net) { chat.system(`📣 ${a.from}: ${a.text}`); game.hud.say(`📣 ${a.text}`.slice(0, 60)); }
  }
};

// Staff kicked you from your match from the Mod Panel.
moderation.onKick = (k) => { if (net && !net.practice) leave(`You were removed from the match by ${k.by}: ${k.reason}`); };

// Watchlist: a pop-up when a watched player comes online.
moderation.onWatched = (tag, pres) => toast(`★ ${tag} is online${pres && pres.mode === 'lobby' ? ' (in a match)' : ''}`);

// Staff chat: a ping for new messages from other staff while you're not looking at it.
moderation.onStaffChat = (m) => {
  if (m.from.toLowerCase() === String(social.tag).toLowerCase()) return;
  if (menuPane === 'mod' && !$('menu').classList.contains('hidden') && modPanel.tab === 'staffchat') return;
  modPanel.unread = (modPanel.unread || 0) + 1;
  toast(`🛡 ${m.from}: ${m.text}`.slice(0, 120));
};

// Chat mute: your lobby and party messages aren't sent until it ends.
moderation.onMute = (m) => {
  if (m) toast(`You've been muted from chat${m.until ? ' until ' + new Date(m.until).toLocaleString() : ''}: ${m.reason}`);
  else toast('Your chat mute has ended.');
};
function chatBlocked() {
  const m = moderation.myMute();
  if (!m) return false;
  const msg = `You're muted${m.until ? ' until ' + new Date(m.until).toLocaleString() : ''} (${m.reason}).`;
  if (net) chat.system(msg); else toast(msg);
  return true;
}

// Reporting: any player can report someone they're in a match with (needs a gamertag).
function renderReportList() {
  const rows = net ? [...game.players.values()].filter((p) => p.id !== game.myId && !p.bot) : [];
  $('pause-report').classList.toggle('hidden', !rows.length);
  $('report-list').innerHTML = rows.map((p) => `<div class="mod-row"><span class="mod-name">${esc(p.name)}${badge(p.role, true)}</span>
    ${p.role ? '<small>staff</small>' : `<button data-report="${p.id}">🚩 Report</button>`}</div>`).join('');
  $('report-list').querySelectorAll('[data-report]').forEach((b) => { b.onclick = () => openReport(game.players.get(b.dataset.report)); });
}
let reportReason = null;
// A small JPEG of the current view, attached to reports as evidence.
let reportShot = null;
function grabShot() {
  try {
    game.renderer.render(game.scene, game.camera);
    const src = game.renderer.domElement, w = 400, h = Math.round((400 * src.height) / Math.max(1, src.width));
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d').drawImage(src, 0, 0, w, h);
    return c.toDataURL('image/jpeg', 0.55);
  } catch { return null; }
}
function openReport(p) {
  if (!p) return;
  reportShot = grabShot();
  if (!social.tag) { toast('Pick a gamertag (Friends tab) to send reports.'); return; }
  reportReason = null;
  $('rp-name').textContent = p.name;
  $('rp-details').value = '';
  $('rp-msg').textContent = '';
  $('rp-reasons').innerHTML = REPORT_REASONS.map((r) => `<button data-r="${esc(r)}">${esc(r)}</button>`).join('');
  $('rp-reasons').querySelectorAll('[data-r]').forEach((b) => {
    b.onclick = () => { reportReason = b.dataset.r; $('rp-reasons').querySelectorAll('[data-r]').forEach((x) => x.classList.toggle('sel', x === b)); };
  });
  $('rp-send').onclick = async () => {
    if (!reportReason) { $('rp-msg').textContent = 'Pick a reason.'; return; }
    try {
      await moderation.report({ target: p.gt || p.name, lobby: net ? net.code : '', reason: reportReason, details: $('rp-details').value, img: reportShot });
      $('report-pop').classList.add('hidden');
      toast(`Report sent. Thanks, the staff will look into ${p.name}.`);
    } catch (err) { $('rp-msg').textContent = err.message; }
  };
  $('rp-cancel').onclick = () => $('report-pop').classList.add('hidden');
  $('report-pop').classList.remove('hidden');
}
$('rp-details').addEventListener('keydown', (e) => e.stopPropagation());
$('appeal-text').addEventListener('keydown', (e) => e.stopPropagation());

// A warning, from a match (instant) or from your record (persistent, until you acknowledge it).
function showWarning(by, reason, persistent) {
  $('warn-by').textContent = `From ${by}`;
  $('warn-reason').textContent = reason;
  $('warn-pop').classList.remove('hidden');
  if (game.locked) game.setLocked(false);
  $('warn-ok').onclick = () => {
    $('warn-pop').classList.add('hidden');
    if (persistent) moderation.ackWarnings();
  };
}
moderation.onWarn = (w, count) => showWarning(`${w.by}${count > 1 ? ` · ${count} new warnings` : ''}`, w.reason, true);
game.onWarned = (m) => showWarning(`${m.role === 'owner' ? 'the owner' : 'a moderator'} (${m.by})`, m.reason, false);

// Banned: out of any match, and a screen that can't be closed until the ban ends.
let banTimer = null;
moderation.onBan = (ban) => {
  clearInterval(banTimer);
  $('ban-pop').classList.toggle('hidden', !ban);
  if (!ban) return;
  if (net) leave('You were banned.');
  $('ban-by').textContent = `Banned by ${ban.by}`;
  $('ban-reason').textContent = ban.reason;
  // One appeal per ban; the answer shows here (denied, or the ban just ends if accepted).
  const sent = moderation.appealSent();
  $('appeal-status').textContent = ban.appealDenied ? 'Your appeal was denied.' : sent ? 'Appeal sent. The staff will review it.' : '';
  $('appeal-text').classList.toggle('hidden', sent || !!ban.appealDenied);
  $('appeal-send').classList.toggle('hidden', sent || !!ban.appealDenied);
  $('appeal-send').onclick = async () => {
    try {
      await moderation.appeal($('appeal-text').value);
      moderation.lastBan = null;
      moderation.applyMine();
    } catch (err) { $('appeal-status').textContent = err.message; }
  };
  const tick = () => {
    if (ban.until && Date.now() >= ban.until) { clearInterval(banTimer); $('ban-pop').classList.add('hidden'); moderation.lastBan = null; return; }
    if (!ban.until) { $('ban-until').textContent = 'This ban is permanent.'; return; }
    const s = Math.ceil((ban.until - Date.now()) / 1000), d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), mnt = Math.floor((s % 3600) / 60);
    $('ban-until').textContent = `Ends in ${d ? d + 'd ' : ''}${h ? h + 'h ' : ''}${mnt}m (${new Date(ban.until).toLocaleString()})`;
  };
  tick();
  banTimer = setInterval(tick, 30000);
};

// A moderator made you change your gamertag: it's released and you must pick a new one.
moderation.onRename = (r) => {
  const old = social.tag;
  social.releaseTag();
  applyGamertag();
  sessionStorage.removeItem('tagLater');
  openTagPop();
  $('tag-input').value = '';
  const msg = $('tag-msg');
  msg.className = 'tag-msg bad';
  msg.textContent = `${r.by} asked you to change your gamertag "${old}": ${r.reason}`;
};

// ---------- Practice Range (single player, offline) ----------

// Targets: [name, x, z (you stand at z 24), side-to-side sway in meters, speed]
const PRACTICE_TARGETS = [
  ['4 m', 3, 20], ['10 m', -6, 12], ['20 m', -2, 2], ['30 m', 2, -8], ['50 m', 6, -28], ['75 m', -4, -53],
  ['Mover · 25 m', 0, -3, 7, 1.1], ['Mover · 40 m', 0, -18, 9, 0.8], ['Fast · 15 m', 0, 7, 5, 2.2],
];

// tut: start the first-time tutorial in the range.
async function startPractice(tut = false) {
  if (busy || net) return;
  if (moderation.myBan()) { moderation.lastBan = null; moderation.applyMine(); return; }
  initAudio();
  net = newNet();
  await net.offline(settings.name || 'Player', settings.color, { mode: 'practice', map: 'range' }, myCos());
  net.logic.applySettings({ infiniteAmmo: tut ? false : store.get('practiceInf', true), respawn: 1 });
  net.logic.addDummies(PRACTICE_TARGETS);
  enterGame();
  if (tut) tutorial.start(game);
}
$('btn-practice').onclick = () => startPractice();
// A slow device gets one suggestion to switch to Low-end graphics.
game.onSlow = (fps) => {
  const tip = document.createElement('div');
  tip.className = 'slow-tip';
  tip.innerHTML = `<span>Running slow (${fps} FPS)? <b>Low-end graphics</b> makes it much smoother.</span><button class="primary">Switch</button><button class="ghost">No thanks</button>`;
  document.body.appendChild(tip);
  const [yes, no] = tip.querySelectorAll('button');
  yes.onclick = () => { game.setGfx('potato'); tip.remove(); toast('Low-end graphics on. Change it any time in Settings → Video.'); };
  no.onclick = () => tip.remove();
  setTimeout(() => tip.remove(), 15000);
};
$('tu-replay').onclick = (e) => { e.preventDefault(); startPractice(true); };
game.onTick = (dt) => tutorial.tick(dt);
tutorial.onDone = (first) => {
  if (first) { addTokens(TUTORIAL_TOKENS); addXp(300); }
  if (document.pointerLockElement) document.exitPointerLock();
};
tutorial.onPlay = () => { leave(); quickPlay(); };

// Pause menu in practice: every weapon, equipped (and refilled) as soon as you pick it.
function renderPractice() {
  const on = !!(net && net.practice);
  $('pause-practice').classList.toggle('hidden', !on);
  if (!on) return;
  $('pr-inf').checked = !!net.logic.s.infiniteAmmo;
  $('pr-inf').onchange = () => { store.set('practiceInf', $('pr-inf').checked); net.logic.applySettings({ infiniteAmmo: $('pr-inf').checked }); };
  $('pr-weapons').innerHTML = SLOTS.map((ids, slot) => `<div class="pr-slot"><h4>${slot + 1} · ${SLOT_NAMES[slot]}</h4><div class="pr-grid">${ids.map((id) =>
    `<button class="${settings.loadout[slot] === id ? 'sel' : ''}" data-pw="${slot}:${id}">${esc(WEAPONS[id].name)}</button>`).join('')}</div></div>`).join('');
  $('pr-weapons').querySelectorAll('[data-pw]').forEach((b) => {
    b.onclick = () => {
      const [slot, id] = b.dataset.pw.split(':');
      settings.loadout[Number(slot)] = id;
      store.set('loadout', settings.loadout);
      game.nextLoadout = settings.loadout.slice();
      if (game.me.alive) { game.setLoadout(settings.loadout); game.switchSlot(Number(slot), true); }
      renderPractice();
      renderLoadout($('pause-loadout'));
    };
  });
}

// preset: { name, mode, map, max, bots, rotate, vis, gn } instead of the Create form.
async function hostLobby(preset = null) {
  if (!preset || preset instanceof Event) preset = null;
  if (busy) return;
  if (moderation.myBan()) { moderation.lastBan = null; moderation.applyMine(); return; }
  initAudio();
  setBusy(true);
  // Rules preset from the Create form (applied before anyone spawns).
  const rp = !preset && [...RULE_PRESETS, ...savedPresets()].find((p) => p.id === serverCfg.rules);
  const rules = rp && rp.id !== 'classic' ? { ...presetRules(rp), rulesName: rp.name } : null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = randCode();
    status(`Creating server ${code}…`);
    net = newNet();
    try {
      await net.host(code, settings.name || 'Player', settings.color,
        preset ? { map: preset.map, mode: preset.mode, maxPlayers: preset.max, botFill: Math.min(preset.bots, preset.max), gn: !!preset.gn, ranked: !!preset.ranked }
          : { map: settings.map, mode: settings.mode, maxPlayers: serverCfg.max, botFill: Math.min(serverCfg.bots, serverCfg.max), rules }, myCos());
      net.logic.s.rotate = preset ? preset.rotate : serverCfg.rotate;
      net.logic.onFlag = (p, details) => moderation.autoFlag({ target: p.name, lobby: net.code, details });
      hosting = preset
        ? { public: false, name: preset.name, max: preset.max, region: serverCfg.region, gn: !!preset.gn }
        : { public: false, name: $('sv-name').value.trim() || `${settings.name || 'Player'}'s server`, max: serverCfg.max, region: serverCfg.region };
      setBusy(false);
      status('');
      enterGame();
      setPublic((preset ? preset.vis : serverCfg.vis) === 'public');
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

// spectate: staff only; joins invisibly with a signed proof instead of a player.
async function joinLobby(spectateArg = false) {
  const spectate = spectateArg === true; // only an explicit true (never a click event)
  if (busy) return;
  if (moderation.myBan()) { moderation.lastBan = null; moderation.applyMine(); return; }
  const code = $('join-code').value.trim().toUpperCase();
  if (code.length !== 5) { status('Enter the 5-character lobby code.', true); return; }
  initAudio();
  setBusy(true);
  status(`Joining ${code}…`);
  net = newNet();
  try {
    const spec = spectate ? await roles.proof(code, 'spec') : null;
    if (spectate && !spec) throw new Error('Only staff can spectate.');
    await net.join(code, settings.name || 'Player', settings.color, myCos(), spec);
    game.spectating = spectate; // set before the welcome arrives so enterGame() knows
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
  if (voice.inRoom) voice.leave(); // Game Night voice is for that server only
  highlights.stop();
  highlights.resetMatch();
  if (tutorial.active || !$('tutorial').classList.contains('hidden')) tutorial.stop();
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

$('btn-host').onclick = () => hostLobby();
$('btn-join').onclick = () => joinLobby();
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
// ---------- Game Night voice ----------
// Everyone in a Game Night server with a gamertag can talk (push-to-talk and volume follow the
// voice settings). Leaving the server leaves voice.
const gnvcTags = new Map(); // player id -> verified gamertag in this match
const GNVC_MAX = 12;
function gnRoom() {
  const code = net && net.code;
  return {
    id: 'gn' + String(code || '').toLowerCase(),
    isMember: (k) => [...game.players.values()].some((p) => p.gt && p.gt.toLowerCase() === k) && voice.calls.size < GNVC_MAX - 1 || voice.calls.has(k),
    announce: (on) => { if (net) net.send({ t: 'vc', in: on }); },
  };
}
function renderGnVc() {
  const b = $('btn-gnvc');
  const show = !!(net && !net.practice && game.active && game.rules.gn);
  b.classList.toggle('hidden', !show);
  if (show) b.innerHTML = voice.inRoom ? `<span class="ic">🔇</span>Leave voice${voice.calls.size ? ` (${voice.calls.size + 1} in)` : ''}` : '<span class="ic">🎤</span>Join Game Night voice';
}
$('btn-gnvc').onclick = async () => {
  if (voice.inRoom) { voice.leave(); renderGnVc(); return; }
  try {
    await voice.join(gnRoom());
    chat.system(`🎤 You joined Game Night voice. ${opts.voicePtt ? `Hold ${keysLabel('voice')} to talk.` : 'Your mic is on.'}`);
  } catch (err) { chat.system('🎤 ' + err.message); }
  renderGnVc();
};
setInterval(renderGnVc, 1000);

// Settings: from the main menu or the pause menu; returns to whichever opened it.
// "Keyboard & mouse" help in the menu, from the current key bindings.
function renderKeyHelp() {
  const k = (a) => `<kbd>${esc(keysLabel(a))}</kbd>`;
  const move = ['forward', 'left', 'back', 'right'].map((a) => keysLabel(a).split(' / ')[0]).join('');
  $('kb-help').innerHTML = [
    [`<kbd>${esc(move)}</kbd>`, 'move'], ['<kbd>Mouse</kbd>', 'aim'], ['<kbd>LMB</kbd>', 'fire'], ['<kbd>RMB</kbd>', 'aim down sights'],
    [k('jump'), 'jump'], [k('sprint'), 'sprint'], [k('crouch'), 'crouch · slide'], [k('reload'), 'reload'],
    [`<kbd>${esc([1, 2, 3, 4].map((n) => keysLabel('slot' + n)).join(' '))}</kbd> / wheel`, 'switch'], [k('swap'), 'last weapon'],
    [k('grenade'), 'quick throw'], [k('melee'), 'quick melee'], [k('inspect'), 'inspect'], [k('scores'), 'scoreboard'],
    ['<kbd>Esc</kbd>', 'pause'], [k('chat'), 'chat'],
  ].map(([key, what]) => `<span>${key} ${what}</span>`).join('');
}
onOpts((o, key) => { if (!key || key === 'binds') renderKeyHelp(); });
$('kb-change').onclick = (e) => {
  e.preventDefault();
  $('menu').classList.add('hidden');
  settingsUI.onClose = () => { $('menu').classList.remove('hidden'); showPane(menuPane); };
  settingsUI.open('Controls');
};

// Secret PC-only Showroom (Konami code on the menus).
new Showroom({
  game, mobile,
  getColor: () => settings.color,
  getName: () => settings.name || 'Player',
  getLoadout: () => settings.loadout,
  getMods: () => settings.mods,
  // Level, rank, ranked division, clan, weekly trophy and season badges for the banner card.
  getExtras: () => {
    const lv = myLevel(), rk = myRanked(), c = clans.myClan();
    return { level: lv.level, rankName: lv.rank.name, division: rk.played ? rk.div.name : null, divColor: rk.div.color, sr: rk.placing ? 0 : rk.sr,
      clan: c ? c.tag : null, champ: social.tag ? leaderboard.isChamp(social.tag) : false, seasons: seasons.badges() };
  },
}).onCos = (c) => { game.myBanner = c.banner; if (net) net.send({ t: 'cos', c: { ...myCos(), ...c } }); renderChip(); };
settingsUI = new SettingsUI({
  game, mobile, uiMode, uiFromUrl: !!uiFromUrl,
  editLayout: (done) => touch.edit(done),
  getColor: () => settings.color,
  getName: () => settings.name || 'Player',
  onCos: (c) => { game.myBanner = c.banner; if (net) net.send({ t: 'cos', c: { ...myCos(), ...c } }); },
  // Weapon wraps from Customize: saved with the attachments (looks only).
  getMods: () => settings.mods,
  onMods: (m) => {
    settings.mods = cleanModMap(m);
    store.set('mods', settings.mods);
    game.setMods(settings.mods);
    renderLoadout($('menu-loadout'));
    renderLoadout($('pause-loadout'));
    renderChip();
  },
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
  if (!isBound('chat', e.code) || mobile || chat.typing || !game.active || !game.locked) return;
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
game.onKicked = () => leave('You were kicked from the match.');
$('btn-copy').onclick = async () => {
  const link = invites.link(location.origin + location.pathname, net ? net.code : '');
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
