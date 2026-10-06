import { roles, badge, rank } from './roles.js';
import { moderation, fmtHours, AUTO_FLAG } from './moderation.js';
import { esc } from './util.js';
import { validTag, TAG_RULES } from './social.js';

// The Mod Panel menu section (staff only), in tabs:
//  Players   look up a gamertag: warnings, ban, chat mute, forced gamertag change, staff notes, history
//  Online    everyone online right now and where (menu / which match), with join + look-up buttons
//  Reports   player reports from matches
//  Announce  a message every player sees
//  Appeals   banned players asking for the ban to be lifted
//  Filter    the chat word filter
//  Log       every staff action, newest first
//  Staff     (owner) appoint / remove moderators (optionally for a limited time)

const TIMES = [[1, '1 hour'], [24, '1 day'], [24 * 7, '7 days'], [24 * 30, '30 days'], [0, 'Permanent']];
const ACT_LABEL = {
  warn: 'warned', ban: 'banned', unban: 'unbanned', mute: 'muted', unmute: 'unmuted',
  rename: 'forced a new gamertag for', clearwarns: 'cleared warnings of', note: 'added a note on', denyappeal: 'denied the appeal of', kick: 'kicked',
};
const MOD_TIMES = [[0, 'Permanent'], [24, '1 day'], [24 * 7, '7 days'], [24 * 30, '30 days']];
const ANN_TIMES = [[1, '1 hour'], [6, '6 hours'], [24, '1 day'], [24 * 7, '7 days'], [0, 'Until cleared']];

const ago = (ts) => {
  const s = Math.max(0, (Date.now() - ts) / 1000);
  return s < 60 ? 'just now' : s < 3600 ? `${Math.floor(s / 60)}m ago` : s < 86400 ? `${Math.floor(s / 3600)}h ago` : `${Math.floor(s / 86400)}d ago`;
};
const when = (ts) => new Date(ts).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
const opts = (list, sel) => list.map(([v, n]) => `<option value="${v}" ${v === sel ? 'selected' : ''}>${n}</option>`).join('');

export class ModPanel {
  constructor(el, social, { joinLobby } = {}) {
    this.el = el;
    this.social = social;
    this.joinLobby = joinLobby;
    this.tab = 'players';
    this.target = null; // { tag, since } of the looked-up player
    this.msg = '';
  }

  say(t) { this.msg = t; const m = this.el.querySelector('#mp-msg'); if (m) m.textContent = t; }

  render() {
    const me = roles.myRole();
    if (!me) { this.el.innerHTML = '<div class="card"><div class="note">Only the owner and moderators can use the Mod Panel.</div></div>'; return; }
    const owner = me === 'owner';
    const online = moderation.onlineNow();
    const reports = [...moderation.reports.values()];
    const bans = [...moderation.records.values()].filter((r) => moderation.activeBan(r)).length;
    const appeals = moderation.openAppeals();
    const tabs = [['players', '👤 Players'], ['online', `🟢 Online <b>${online.length}</b>`], ['reports', `🚩 Reports ${reports.length ? `<b class="alert">${reports.length}</b>` : ''}`], ['appeals', `⚖ Appeals ${appeals.length ? `<b class="alert">${appeals.length}</b>` : ''}`], ['announce', '📣 Announce'], ['staffchat', `💬 Staff chat ${this.unread ? `<b class="alert">${this.unread}</b>` : ''}`], ['filter', '🤐 Chat filter'], ['log', '📜 Log']];
    if (owner) tabs.push(['staff', '🛡 Staff']);
    if (!tabs.some(([id]) => id === this.tab)) this.tab = 'players';
    this.el.innerHTML = `
      <div class="mp-stats">
        <div><b>${online.length}</b><small>online now</small></div>
        <div><b>${reports.length}</b><small>open reports</small></div>
        <div><b>${bans}</b><small>active bans</small></div>
        <div><b>${roles.activeMods().length}</b><small>moderators</small></div>
        <div class="mp-you">You: ${badge(me)}</div>
      </div>
      <div class="mp-tabs">${tabs.map(([id, n]) => `<button data-tab="${id}" class="${id === this.tab ? 'sel' : ''}">${n}</button>`).join('')}</div>
      <div id="mp-msg" class="note mp-msg">${esc(this.msg)}</div>
      <div id="mp-body"></div>`;
    this.el.querySelectorAll('[data-tab]').forEach((b) => { b.onclick = () => { this.tab = b.dataset.tab; this.msg = ''; this.render(); }; });
    const body = this.el.querySelector('#mp-body');
    if (this.tab === 'players') this.renderPlayers(body);
    else if (this.tab === 'online') this.renderOnline(body, online);
    else if (this.tab === 'reports') this.renderReports(body, reports);
    else if (this.tab === 'announce') this.renderAnnounce(body);
    else if (this.tab === 'appeals') this.renderAppeals(body, appeals);
    else if (this.tab === 'filter') this.renderFilter(body);
    else if (this.tab === 'log') this.renderLog(body);
    else if (this.tab === 'staffchat') this.renderStaffChat(body);
    else this.renderStaff(body);
    this.el.querySelectorAll('input, textarea').forEach((i) => i.addEventListener('keydown', (e) => e.stopPropagation()));
  }

  // ---------- Players ----------

  renderPlayers(body) {
    const recs = [...moderation.records.values()].sort((a, b) => b.ts - a.ts).slice(0, 30);
    body.innerHTML = `
      <div class="mp-grid">
        <div class="card mp-look">
          <h3>Look up a player</h3>
          <form id="mp-form" class="fr-add" autocomplete="off">
            <input id="mp-tag" maxlength="16" placeholder="Gamertag" spellcheck="false" autocapitalize="off" value="${esc(this.target ? this.target.tag : '')}">
            <button class="primary" type="submit">Look up</button>
          </form>
          <div id="mp-player"></div>
        </div>
        <div class="card">
          <h3>Recent actions</h3>
          <div class="mp-recent">${recs.length ? recs.map((r) => {
            const l = (r.log || [])[r.log.length - 1] || {};
            const tags = [moderation.activeBan(r) ? '<em class="bad">BANNED</em>' : '', moderation.activeMute(r) ? '<em class="mute">MUTED</em>' : '',
              (r.warns || []).length ? `<em>${r.warns.length} warning${r.warns.length > 1 ? 's' : ''}</em>` : ''].join('');
            return `<button class="mp-rec" data-look="${esc(r.target)}"><b>${esc(r.target)}</b>${tags}
              <small>${esc(l.by || '')} ${ACT_LABEL[l.act] || ''} them · ${l.ts ? ago(l.ts) : ''}${l.note ? ' · ' + esc(l.note) : ''}</small></button>`;
          }).join('') : '<div class="note">Nothing yet.</div>'}</div>
        </div>
      </div>`;
    this.renderPlayer();
    body.querySelector('#mp-form').onsubmit = (e) => { e.preventDefault(); this.look(body.querySelector('#mp-tag').value.trim()); };
    body.querySelectorAll('[data-look]').forEach((b) => { b.onclick = () => this.look(b.dataset.look); });
  }

  async look(tag) {
    if (!validTag(tag)) { this.say(`Gamertags are ${TAG_RULES}.`); return; }
    if (this.tab !== 'players') { this.tab = 'players'; this.render(); }
    this.say('Looking up…');
    const claim = await this.social.lookup(tag, true);
    if (!claim) { this.target = null; this.say(`Nobody has the gamertag "${tag}".`); this.renderPlayer(); return; }
    this.target = { tag: claim.tag, since: Number(claim.since) || 0 };
    this.say('');
    const input = this.el.querySelector('#mp-tag');
    if (input) input.value = claim.tag;
    this.renderPlayer();
  }

  renderPlayer() {
    const box = this.el.querySelector('#mp-player');
    if (!box) return;
    const t = this.target;
    if (!t) { box.innerHTML = ''; return; }
    const k = t.tag.toLowerCase();
    const rec = moderation.records.get(k) || {};
    const role = roles.roleOfTag(t.tag), ban = moderation.activeBan(rec), mute = moderation.activeMute(rec);
    const on = moderation.online.get(k);
    const can = rank(roles.myRole()) > rank(role) && k !== String(this.social.tag).toLowerCase();
    const warns = rec.warns || [], log = rec.log || [], notes = rec.notes || [];
    const until = (x) => (x.until ? `until ${when(x.until)}` : 'permanently');
    box.innerHTML = `
      <div class="mp-player">
        <div class="mp-head"><b>${esc(t.tag)}</b>${badge(role, true)}
          ${on ? `<span class="mp-on">● ${on.mode === 'lobby' ? `In match ${esc(on.lobby || '')}` : 'In the menu'}</span>` : ''}
          <span class="mp-state ${ban ? 'bad' : mute ? 'mute' : 'ok'}">${ban ? 'Banned' : mute ? 'Muted' : 'In good standing'}</span></div>
        <small class="muted">Gamertag since ${t.since ? when(t.since) : 'unknown'}${rec.rename ? ` · new gamertag requested ${ago(rec.rename.ts)}` : ''}</small>
        ${ban ? `<div class="mp-flag bad">🚫 Banned ${until(ban)} by ${esc(ban.by)}: ${esc(ban.reason)}</div>` : ''}
        ${mute ? `<div class="mp-flag mute">🔇 Chat muted ${until(mute)} by ${esc(mute.by)}: ${esc(mute.reason)}</div>` : ''}
        <div class="mp-sub">Warnings (${warns.length})</div>
        <div class="mp-list">${warns.length ? warns.slice().reverse().map((w) => `<div>⚠ ${esc(w.reason)} <small>— ${esc(w.by)}, ${ago(w.ts)}</small></div>`).join('') : '<small class="muted">None</small>'}</div>
        <div class="mp-sub">Staff notes <small>(the player isn't shown these)</small></div>
        <div class="mp-list">${notes.length ? notes.slice().reverse().map((n) => `<div>📝 ${esc(n.text)} <small>— ${esc(n.by)}, ${ago(n.ts)}</small></div>`).join('') : '<small class="muted">None</small>'}</div>
        ${can ? `
        <div class="mp-sub">Action</div>
        <input id="mp-reason" maxlength="140" placeholder="Reason / note text">
        <div class="mp-actions">
          <button data-act="warn" class="warn">⚠ Warn</button>
          <button data-act="note">📝 Add note</button>
          <button data-act="rename">✎ Force new gamertag</button>
          <span class="mp-timed"><select id="mp-time">${opts(TIMES, 24)}</select>
            <button data-act="mute">🔇 Mute chat</button><button data-act="ban" class="danger">🚫 Ban</button></span>
          ${ban ? '<button data-act="unban">Unban</button>' : ''}
          ${mute ? '<button data-act="unmute">Unmute</button>' : ''}
          ${warns.length ? '<button data-act="clearwarns" class="ghost">Clear warnings</button>' : ''}
          ${on && on.lobby && this.joinLobby ? `<button data-join="${esc(on.lobby)}">▶ Join their match</button><button data-spec="${esc(on.lobby)}">👁 Spectate</button>` : ''}
          ${on && on.mode === 'lobby' ? '<button data-act="kick" class="danger">⏏ Kick from match</button>' : ''}
        </div>` : `<div class="note">${role ? 'Staff can only be moderated by someone ranked above them.' : 'You can\'t moderate yourself.'}</div>`}
        ${log.length ? `<div class="mp-sub">History</div><div class="mp-list mp-log">${log.slice().reverse().map((l) =>
          `<div><b>${esc(l.by)}</b> ${ACT_LABEL[l.act] || l.act} them${l.note ? ': ' + esc(l.note) : ''} <small>${ago(l.ts)}</small></div>`).join('')}</div>` : ''}
      </div>`;
    box.querySelectorAll('input').forEach((i) => i.addEventListener('keydown', (e) => e.stopPropagation()));
    const join = box.querySelector('[data-join]');
    if (join) join.onclick = () => this.joinLobby(join.dataset.join);
    const spec = box.querySelector('[data-spec]');
    if (spec) spec.onclick = () => this.joinLobby(spec.dataset.spec, true);
    box.querySelectorAll('[data-act]').forEach((b) => {
      b.onclick = async () => {
        const act = b.dataset.act, reason = box.querySelector('#mp-reason').value.trim();
        const hours = Number(box.querySelector('#mp-time').value), span = hours ? fmtHours(hours) : 'permanently';
        const what = {
          warn: 'warn', note: 'add this note to', rename: 'force a new gamertag for', ban: `ban (${span})`, mute: `mute the chat of (${span})`,
          unban: 'unban', unmute: 'unmute', clearwarns: 'clear the warnings of', kick: 'kick from their match',
        }[act];
        if ((act === 'warn' || act === 'note') && !reason) { this.say(act === 'warn' ? 'Type a reason for the warning first.' : 'Type the note first.'); return; }
        if (act !== 'note' && !confirm(`${what[0].toUpperCase() + what.slice(1)} ${t.tag}?`)) return;
        b.disabled = true;
        try {
          await moderation.act(t.tag, act, { reason, hours });
          this.say({
            warn: `Warned ${t.tag}.`, note: 'Note added.', rename: `${t.tag} will have to pick a new gamertag.`, ban: `Banned ${t.tag}.`,
            mute: `Muted ${t.tag}'s chat.`, unban: `Unbanned ${t.tag}.`, unmute: `Unmuted ${t.tag}.`, clearwarns: 'Warnings cleared.', kick: `${t.tag} will be removed from their match.`,
          }[act]);
          this.render();
        } catch (err) { this.say(err.message); b.disabled = false; }
      };
    });
  }

  // ---------- Online ----------

  renderOnline(body, online) {
    body.innerHTML = `<div class="card">
      <h3>Online now <span class="muted">(${online.length})</span></h3>
      <div class="note">Players with a gamertag who have the game open. Updates every 30 seconds.</div>
      <div class="mp-online">${online.length ? online.map((o) => {
        const rec = moderation.records.get(o.tag.toLowerCase());
        const flags = [moderation.activeBan(rec) ? '<em class="bad">BANNED</em>' : '', moderation.activeMute(rec) ? '<em class="mute">MUTED</em>' : '',
          rec && (rec.warns || []).length ? `<em>${rec.warns.length}⚠</em>` : ''].join('');
        return `<div class="fr-row"><i class="fr-dot on"></i><span class="fr-name">${esc(o.tag)}${badge(roles.roleOfTag(o.tag), true)}${flags}</span>
          <small>${o.mode === 'lobby' ? `In match <b>${esc(o.lobby || '')}</b>` : 'In the menu'}</small>
          ${o.mode === 'lobby' && o.lobby && this.joinLobby ? `<button data-spec="${esc(o.lobby)}" title="Watch invisibly">👁 Spectate</button><button data-join="${esc(o.lobby)}">▶ Join</button>` : ''}
          <button class="primary" data-look="${esc(o.tag)}">Look up</button></div>`;
      }).join('') : '<div class="sv-empty">Nobody else is online right now.</div>'}</div>
    </div>`;
    body.querySelectorAll('[data-look]').forEach((b) => { b.onclick = () => this.look(b.dataset.look); });
    body.querySelectorAll('[data-join]').forEach((b) => { b.onclick = () => this.joinLobby(b.dataset.join); });
    body.querySelectorAll('[data-spec]').forEach((b) => { b.onclick = () => this.joinLobby(b.dataset.spec, true); });
  }

  // ---------- Reports ----------

  renderReports(body, reports) {
    reports.sort((a, b) => b.ts - a.ts);
    body.innerHTML = `<div class="card">
      <h3>Reports <span class="muted">(${reports.length})</span></h3>
      <div class="note">Players report each other from the pause menu in a match. Reports older than 7 days disappear on their own.</div>
      <div class="mp-reports">${reports.length ? reports.map((r) => `
        <div class="mp-report ${r.reason === AUTO_FLAG ? 'auto' : ''}">
          <div class="mp-report-head"><b>${esc(r.target)}</b><em>${esc(r.reason)}</em><small>${ago(r.ts)}</small></div>
          ${r.details ? `<div class="mp-report-text">“${esc(r.details)}”</div>` : ''}
          <small class="muted">${r.reason === AUTO_FLAG ? `Flagged automatically by ${esc(r.from)}'s game (the host)` : `Reported by ${esc(r.from)}`}${r.lobby ? ` in match ${esc(r.lobby)}` : ''}</small>
          <div class="mp-actions">
            ${validTag(r.target) ? `<button class="primary" data-look="${esc(r.target)}">Look up ${esc(r.target)}</button>` : ''}
            ${r.lobby && this.joinLobby ? `<button data-spec="${esc(r.lobby)}">👁 Spectate that match</button><button data-join="${esc(r.lobby)}">▶ Join</button>` : ''}
            <button data-look="${esc(r.from)}">Look up reporter</button>
            <button class="ghost" data-dismiss="${esc(r.id)}">✓ Resolve</button>
          </div>
        </div>`).join('') : '<div class="sv-empty">No reports. 🎉</div>'}</div>
    </div>`;
    body.querySelectorAll('[data-look]').forEach((b) => { b.onclick = () => this.look(b.dataset.look); });
    body.querySelectorAll('[data-join]').forEach((b) => { b.onclick = () => this.joinLobby(b.dataset.join); });
    body.querySelectorAll('[data-spec]').forEach((b) => { b.onclick = () => this.joinLobby(b.dataset.spec, true); });
    body.querySelectorAll('[data-dismiss]').forEach((b) => { b.onclick = () => { moderation.dismissReport(b.dataset.dismiss); this.say('Report resolved.'); this.render(); }; });
  }

  // ---------- Announce ----------

  renderAnnounce(body) {
    const a = moderation.announcement;
    body.innerHTML = `<div class="card">
      <h3>Announcement</h3>
      <div class="note">Shown to every player at the top of the menu, and as a pop-up in matches when it's posted.</div>
      ${a ? `<div class="mp-ann ${a.level}"><b>${a.level === 'warn' ? '⚠' : '📣'} ${esc(a.text)}</b>
        <small>Posted by ${esc(a.from)} ${ago(a.ts)} · ${a.until ? `ends ${when(a.until)}` : 'until cleared'}</small>
        <button class="danger" id="mp-ann-clear">Clear it</button></div>` : '<div class="note">No announcement right now.</div>'}
      <div class="mp-sub">New announcement</div>
      <textarea id="mp-ann-text" maxlength="200" rows="3" placeholder="e.g. Double tokens weekend! Or: server maintenance tonight at 8pm."></textarea>
      <div class="mp-actions">
        <select id="mp-ann-level"><option value="info">📣 Info</option><option value="warn">⚠ Important</option></select>
        <select id="mp-ann-time">${opts(ANN_TIMES, 24)}</select>
        <button class="primary" id="mp-ann-post">Post to everyone</button>
      </div>
    </div>`;
    body.querySelector('#mp-ann-post').onclick = async () => {
      const text = body.querySelector('#mp-ann-text').value.trim();
      if (!text) { this.say('Type the announcement first.'); return; }
      if (!confirm('Post this announcement to every player?')) return;
      try {
        await moderation.announce(text, Number(body.querySelector('#mp-ann-time').value), body.querySelector('#mp-ann-level').value);
        this.say('Announcement posted.');
        this.render();
      } catch (err) { this.say(err.message); }
    };
    const clear = body.querySelector('#mp-ann-clear');
    if (clear) clear.onclick = async () => { try { await moderation.clearAnnouncement(); this.say('Announcement cleared.'); this.render(); } catch (err) { this.say(err.message); } };
  }

  // ---------- Appeals ----------

  renderAppeals(body, appeals) {
    body.innerHTML = `<div class="card">
      <h3>Ban appeals <span class="muted">(${appeals.length})</span></h3>
      <div class="note">Banned players can send one appeal per ban from their ban screen. Unban them, or deny it (they'll see it was denied).</div>
      <div class="mp-reports">${appeals.length ? appeals.map((a) => {
        const ban = moderation.activeBan(moderation.records.get(a.tag.toLowerCase())) || {};
        return `<div class="mp-report appeal">
          <div class="mp-report-head"><b>${esc(a.tag)}</b><em>Banned by ${esc(ban.by || '?')}: ${esc(ban.reason || '')}</em><small>${ago(a.ts)}</small></div>
          <div class="mp-report-text">“${esc(a.text)}”</div>
          <div class="mp-actions">
            <button class="primary" data-unban="${esc(a.tag)}">✓ Unban</button>
            <button class="danger" data-deny="${esc(a.tag)}">✕ Deny</button>
            <button data-look="${esc(a.tag)}">Look up</button>
          </div></div>`;
      }).join('') : '<div class="sv-empty">No appeals waiting.</div>'}</div>
    </div>`;
    body.querySelectorAll('[data-look]').forEach((b) => { b.onclick = () => this.look(b.dataset.look); });
    const answer = (tag, act) => async () => {
      if (!confirm(`${act === 'unban' ? 'Unban' : 'Deny the appeal of'} ${tag}?`)) return;
      try { await moderation.act(tag, act, { reason: act === 'unban' ? 'Appeal accepted' : 'Appeal denied' }); this.say(act === 'unban' ? `Unbanned ${tag}.` : 'Appeal denied.'); this.render(); } catch (err) { this.say(err.message); }
    };
    body.querySelectorAll('[data-unban]').forEach((b) => { b.onclick = answer(b.dataset.unban, 'unban'); });
    body.querySelectorAll('[data-deny]').forEach((b) => { b.onclick = answer(b.dataset.deny, 'denyappeal'); });
  }

  // ---------- Chat filter ----------

  renderFilter(body) {
    const f = moderation.filter;
    body.innerHTML = `<div class="card">
      <h3>Chat filter</h3>
      <div class="note">Filtered words are starred out in lobby and party chat for every player (also catches "sh1t" and "fuuuck" style spellings).</div>
      <label class="check"><input type="checkbox" id="mp-f-def" ${f.defaults ? 'checked' : ''}> Use the built-in list (${moderation.defaultWords().length} common swear words and slurs)</label>
      <div class="mp-sub">Extra words <small>(one per line or comma-separated, letters and numbers only)</small></div>
      <textarea id="mp-f-words" rows="6" placeholder="word1, word2">${esc(f.words.join('\n'))}</textarea>
      <div class="mp-sub">Test it</div>
      <input id="mp-f-test" placeholder="Type a message to see how it shows">
      <div id="mp-f-out" class="note"></div>
      <div class="mp-actions"><button class="primary" id="mp-f-save">Save for everyone</button></div>
    </div>`;
    const test = body.querySelector('#mp-f-test');
    test.oninput = () => { body.querySelector('#mp-f-out').textContent = moderation.clean(test.value); };
    body.querySelector('#mp-f-save').onclick = async () => {
      const words = body.querySelector('#mp-f-words').value.split(/[\s,]+/);
      try { const n = await moderation.saveFilter(words, body.querySelector('#mp-f-def').checked); this.say(`Chat filter saved (${n} extra word${n === 1 ? '' : 's'}).`); this.render(); } catch (err) { this.say(err.message); }
    };
  }

  // ---------- Staff chat ----------

  renderStaffChat(body) {
    this.unread = 0;
    const log = moderation.staffChatLog();
    const me = String(this.social.tag).toLowerCase();
    const when2 = (ts) => new Date(ts).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    body.innerHTML = `<div class="card">
      <h3>Staff chat</h3>
      <div class="note">Only you and the moderators can read this. Messages are kept for 3 days.</div>
      <div class="sc-log">${log.length ? log.map((m) => `<div class="sc-msg ${m.from.toLowerCase() === me ? 'mine' : ''}"><b>${esc(m.from)}</b>${badge(roles.roleOfTag(m.from), true)}<small>${when2(m.ts)}</small><p>${esc(m.text)}</p></div>`).join('') : '<div class="sv-empty">No messages yet.</div>'}</div>
      <form class="fr-add sc-form" autocomplete="off"><input maxlength="300" placeholder="Message the staff…"><button class="primary" type="submit">Send</button></form>
    </div>`;
    const logEl = body.querySelector('.sc-log');
    logEl.scrollTop = logEl.scrollHeight;
    const input = body.querySelector('.sc-form input');
    body.querySelector('.sc-form').onsubmit = async (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      try { await moderation.sayStaff(text); this.render(); this.el.querySelector('.sc-form input').focus(); } catch (err) { this.say(err.message); }
    };
  }

  // ---------- Log ----------

  renderLog(body) {
    const log = moderation.actionLog();
    const who = [...new Set(log.map((l) => l.by))].sort();
    const sel = this.logBy && who.includes(this.logBy) ? this.logBy : '';
    const rows = log.filter((l) => !sel || l.by === sel).slice(0, 150);
    body.innerHTML = `<div class="card">
      <h3>Staff action log</h3>
      <div class="mp-actions"><select id="mp-log-by"><option value="">Everyone (${log.length})</option>${who.map((w) => `<option value="${esc(w)}" ${w === sel ? 'selected' : ''}>${esc(w)}</option>`).join('')}</select></div>
      <div class="mp-list mp-log mp-biglog">${rows.length ? rows.map((l) =>
        `<div><small>${when(l.ts)}</small> <b>${esc(l.by)}</b> ${ACT_LABEL[l.act] || l.act} <a href="#" data-look="${esc(l.target)}">${esc(l.target)}</a>${l.note ? ': ' + esc(l.note) : ''}</div>`).join('') : '<small class="muted">No actions yet.</small>'}</div>
    </div>`;
    body.querySelector('#mp-log-by').onchange = (e) => { this.logBy = e.target.value; this.render(); };
    body.querySelectorAll('[data-look]').forEach((a) => { a.onclick = (e) => { e.preventDefault(); this.look(a.dataset.look); }; });
  }

  // ---------- Staff (owner) ----------

  renderStaff(body) {
    const mods = [...roles.mods.values()].sort((a, b) => a.tag.localeCompare(b.tag));
    body.innerHTML = `<div class="card">
      <h3>Moderators</h3>
      <div class="note">Moderators can warn, mute, ban and rename regular players, see reports and post announcements. Only you can manage them.</div>
      <div class="mp-staff">${mods.map((m) => {
        const on = moderation.online.get(m.tag.toLowerCase());
        const left = m.until ? (m.until > Date.now() ? `ends ${when(m.until)}` : 'expired') : 'permanent';
        return `<div class="fr-row ${m.until && m.until <= Date.now() ? 'expired' : ''}"><i class="fr-dot ${on ? 'on' : ''}"></i><span class="fr-name">${esc(m.tag)}</span>${badge('mod', true)}<small>${on ? 'Online · ' : ''}${left}</small>
          <button class="ghost fr-x" data-unmod="${esc(m.tag)}" title="Remove moderator">✕</button></div>`;
      }).join('') || '<div class="note">No moderators yet.</div>'}</div>
      <form id="mp-appoint" class="fr-add" autocomplete="off"><input id="mp-mod-tag" maxlength="16" placeholder="Gamertag to make a moderator" spellcheck="false" autocapitalize="off"><select id="mp-mod-time" title="How long they stay a moderator">${opts(MOD_TIMES, 0)}</select><button class="primary" type="submit">Make moderator</button></form>
    </div>`;
    body.querySelector('#mp-appoint').onsubmit = async (e) => {
      e.preventDefault();
      const tag = body.querySelector('#mp-mod-tag').value.trim();
      if (!validTag(tag)) { this.say(`Gamertags are ${TAG_RULES}.`); return; }
      const hours = Number(body.querySelector('#mp-mod-time').value);
      try { const t = await roles.appoint(tag, hours); this.say(`${t} is now a moderator.`); this.render(); } catch (err) { this.say(err.message); }
    };
    body.querySelectorAll('[data-unmod]').forEach((b) => {
      b.onclick = async () => {
        if (!confirm(`Remove ${b.dataset.unmod} as a moderator?`)) return;
        try { await roles.remove(b.dataset.unmod); this.say(`${b.dataset.unmod} is no longer a moderator.`); this.render(); } catch (err) { this.say(err.message); }
      };
    });
  }
}
