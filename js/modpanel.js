import { roles, badge, rank } from './roles.js';
import { moderation, fmtHours } from './moderation.js';
import { esc } from './util.js';
import { validTag, TAG_RULES } from './social.js';

// The Mod Panel menu section (staff only), in tabs:
//  Players   look up a gamertag: warnings, ban, chat mute, forced gamertag change, staff notes, history
//  Online    everyone online right now and where (menu / which match), with join + look-up buttons
//  Reports   player reports from matches
//  Announce  a message every player sees
//  Staff     (owner) appoint / remove moderators

const TIMES = [[1, '1 hour'], [24, '1 day'], [24 * 7, '7 days'], [24 * 30, '30 days'], [0, 'Permanent']];
const ACT_LABEL = {
  warn: 'warned', ban: 'banned', unban: 'unbanned', mute: 'muted', unmute: 'unmuted',
  rename: 'forced a new gamertag for', clearwarns: 'cleared warnings of', note: 'added a note on',
};
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
    const tabs = [['players', '👤 Players'], ['online', `🟢 Online <b>${online.length}</b>`], ['reports', `🚩 Reports ${reports.length ? `<b class="alert">${reports.length}</b>` : ''}`], ['announce', '📣 Announce']];
    if (owner) tabs.push(['staff', '🛡 Staff']);
    if (!tabs.some(([id]) => id === this.tab)) this.tab = 'players';
    this.el.innerHTML = `
      <div class="mp-stats">
        <div><b>${online.length}</b><small>online now</small></div>
        <div><b>${reports.length}</b><small>open reports</small></div>
        <div><b>${bans}</b><small>active bans</small></div>
        <div><b>${roles.mods.size}</b><small>moderators</small></div>
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
          ${on && on.lobby && this.joinLobby ? `<button data-join="${esc(on.lobby)}">▶ Join their match</button>` : ''}
        </div>` : `<div class="note">${role ? 'Staff can only be moderated by someone ranked above them.' : 'You can\'t moderate yourself.'}</div>`}
        ${log.length ? `<div class="mp-sub">History</div><div class="mp-list mp-log">${log.slice().reverse().map((l) =>
          `<div><b>${esc(l.by)}</b> ${ACT_LABEL[l.act] || l.act} them${l.note ? ': ' + esc(l.note) : ''} <small>${ago(l.ts)}</small></div>`).join('')}</div>` : ''}
      </div>`;
    box.querySelectorAll('input').forEach((i) => i.addEventListener('keydown', (e) => e.stopPropagation()));
    const join = box.querySelector('[data-join]');
    if (join) join.onclick = () => this.joinLobby(join.dataset.join);
    box.querySelectorAll('[data-act]').forEach((b) => {
      b.onclick = async () => {
        const act = b.dataset.act, reason = box.querySelector('#mp-reason').value.trim();
        const hours = Number(box.querySelector('#mp-time').value), span = hours ? fmtHours(hours) : 'permanently';
        const what = {
          warn: 'warn', note: 'add this note to', rename: 'force a new gamertag for', ban: `ban (${span})`, mute: `mute the chat of (${span})`,
          unban: 'unban', unmute: 'unmute', clearwarns: 'clear the warnings of',
        }[act];
        if ((act === 'warn' || act === 'note') && !reason) { this.say(act === 'warn' ? 'Type a reason for the warning first.' : 'Type the note first.'); return; }
        if (act !== 'note' && !confirm(`${what[0].toUpperCase() + what.slice(1)} ${t.tag}?`)) return;
        b.disabled = true;
        try {
          await moderation.act(t.tag, act, { reason, hours });
          this.say({
            warn: `Warned ${t.tag}.`, note: 'Note added.', rename: `${t.tag} will have to pick a new gamertag.`, ban: `Banned ${t.tag}.`,
            mute: `Muted ${t.tag}'s chat.`, unban: `Unbanned ${t.tag}.`, unmute: `Unmuted ${t.tag}.`, clearwarns: 'Warnings cleared.',
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
          ${o.mode === 'lobby' && o.lobby && this.joinLobby ? `<button data-join="${esc(o.lobby)}">▶ Join</button>` : ''}
          <button class="primary" data-look="${esc(o.tag)}">Look up</button></div>`;
      }).join('') : '<div class="sv-empty">Nobody else is online right now.</div>'}</div>
    </div>`;
    body.querySelectorAll('[data-look]').forEach((b) => { b.onclick = () => this.look(b.dataset.look); });
    body.querySelectorAll('[data-join]').forEach((b) => { b.onclick = () => this.joinLobby(b.dataset.join); });
  }

  // ---------- Reports ----------

  renderReports(body, reports) {
    reports.sort((a, b) => b.ts - a.ts);
    body.innerHTML = `<div class="card">
      <h3>Reports <span class="muted">(${reports.length})</span></h3>
      <div class="note">Players report each other from the pause menu in a match. Reports older than 7 days disappear on their own.</div>
      <div class="mp-reports">${reports.length ? reports.map((r) => `
        <div class="mp-report">
          <div class="mp-report-head"><b>${esc(r.target)}</b><em>${esc(r.reason)}</em><small>${ago(r.ts)}</small></div>
          ${r.details ? `<div class="mp-report-text">“${esc(r.details)}”</div>` : ''}
          <small class="muted">Reported by ${esc(r.from)}${r.lobby ? ` in match ${esc(r.lobby)}` : ''}</small>
          <div class="mp-actions">
            ${validTag(r.target) ? `<button class="primary" data-look="${esc(r.target)}">Look up ${esc(r.target)}</button>` : ''}
            ${r.lobby && this.joinLobby ? `<button data-join="${esc(r.lobby)}">▶ Join that match</button>` : ''}
            <button data-look="${esc(r.from)}">Look up reporter</button>
            <button class="ghost" data-dismiss="${esc(r.id)}">✓ Resolve</button>
          </div>
        </div>`).join('') : '<div class="sv-empty">No reports. 🎉</div>'}</div>
    </div>`;
    body.querySelectorAll('[data-look]').forEach((b) => { b.onclick = () => this.look(b.dataset.look); });
    body.querySelectorAll('[data-join]').forEach((b) => { b.onclick = () => this.joinLobby(b.dataset.join); });
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

  // ---------- Staff (owner) ----------

  renderStaff(body) {
    const mods = [...roles.mods.values()].sort((a, b) => a.tag.localeCompare(b.tag));
    body.innerHTML = `<div class="card">
      <h3>Moderators</h3>
      <div class="note">Moderators can warn, mute, ban and rename regular players, see reports and post announcements. Only you can manage them.</div>
      <div class="mp-staff">${mods.map((m) => {
        const on = moderation.online.get(m.tag.toLowerCase());
        return `<div class="fr-row"><i class="fr-dot ${on ? 'on' : ''}"></i><span class="fr-name">${esc(m.tag)}</span>${badge('mod', true)}<small>${on ? 'Online' : ''}</small>
          <button class="ghost fr-x" data-unmod="${esc(m.tag)}" title="Remove moderator">✕</button></div>`;
      }).join('') || '<div class="note">No moderators yet.</div>'}</div>
      <form id="mp-appoint" class="fr-add" autocomplete="off"><input id="mp-mod-tag" maxlength="16" placeholder="Gamertag to make a moderator" spellcheck="false" autocapitalize="off"><button class="primary" type="submit">Make moderator</button></form>
    </div>`;
    body.querySelector('#mp-appoint').onsubmit = async (e) => {
      e.preventDefault();
      const tag = body.querySelector('#mp-mod-tag').value.trim();
      if (!validTag(tag)) { this.say(`Gamertags are ${TAG_RULES}.`); return; }
      try { const t = await roles.appoint(tag); this.say(`${t} is now a moderator.`); this.render(); } catch (err) { this.say(err.message); }
    };
    body.querySelectorAll('[data-unmod]').forEach((b) => {
      b.onclick = async () => {
        if (!confirm(`Remove ${b.dataset.unmod} as a moderator?`)) return;
        try { await roles.remove(b.dataset.unmod); this.say(`${b.dataset.unmod} is no longer a moderator.`); this.render(); } catch (err) { this.say(err.message); }
      };
    });
  }
}
