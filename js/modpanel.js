import { roles, badge, rank } from './roles.js';
import { moderation, fmtHours } from './moderation.js';
import { esc } from './util.js';
import { validTag, TAG_RULES } from './social.js';

// The Mod Panel menu section (staff only): look up any gamertag to warn, ban / unban or force a
// gamertag change, see recent actions, and (owner) manage the moderator list.

const BAN_TIMES = [[1, '1 hour'], [24, '1 day'], [24 * 7, '7 days'], [24 * 30, '30 days'], [0, 'Permanent']];
const ACT_LABEL = { warn: 'warned', ban: 'banned', unban: 'unbanned', rename: 'forced a new gamertag for', clearwarns: 'cleared warnings of' };

const ago = (ts) => {
  const s = Math.max(0, (Date.now() - ts) / 1000);
  return s < 60 ? 'just now' : s < 3600 ? `${Math.floor(s / 60)}m ago` : s < 86400 ? `${Math.floor(s / 3600)}h ago` : `${Math.floor(s / 86400)}d ago`;
};
const when = (ts) => new Date(ts).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

export class ModPanel {
  constructor(el, social) {
    this.el = el;
    this.social = social;
    this.target = null; // { tag, since } of the looked-up player
    this.msg = '';
  }

  render() {
    const me = roles.myRole();
    if (!me) { this.el.innerHTML = '<div class="card"><div class="note">Only the owner and moderators can use the Mod Panel.</div></div>'; return; }
    const owner = me === 'owner';
    const recs = [...moderation.records.values()].sort((a, b) => b.ts - a.ts).slice(0, 25);
    this.el.innerHTML = `
      <div class="mp-grid">
        <div>
          <div class="card mp-look">
            <h3>Look up a player ${badge(me, true)}</h3>
            <form id="mp-form" class="fr-add" autocomplete="off">
              <input id="mp-tag" maxlength="16" placeholder="Gamertag" spellcheck="false" autocapitalize="off" value="${esc(this.target ? this.target.tag : '')}">
              <button class="primary" type="submit">Look up</button>
            </form>
            <div id="mp-msg" class="note">${esc(this.msg)}</div>
            <div id="mp-player"></div>
          </div>
          <div class="card">
            <h3>In a match</h3>
            <div class="note">Open the pause menu during a match: the <b>Moderation</b> section lets you warn, rename, mute and
            kick anyone there (even players without a gamertag).</div>
          </div>
        </div>
        <div>
          <div class="card">
            <h3>Recent actions</h3>
            <div class="mp-recent">${recs.length ? recs.map((r) => {
              const l = (r.log || [])[r.log.length - 1] || {};
              const banned = moderation.activeBan(r);
              return `<button class="mp-rec" data-look="${esc(r.target)}"><b>${esc(r.target)}</b>${banned ? '<em class="bad">BANNED</em>' : ''}${(r.warns || []).length ? `<em>${r.warns.length} warning${r.warns.length > 1 ? 's' : ''}</em>` : ''}
                <small>${esc(l.by || '')} ${ACT_LABEL[l.act] || ''} · ${l.ts ? ago(l.ts) : ''}${l.note ? ' · ' + esc(l.note) : ''}</small></button>`;
            }).join('') : '<div class="note">Nothing yet.</div>'}</div>
          </div>
          ${owner ? `<div class="card">
            <h3>Moderators</h3>
            <div class="mp-staff">${[...roles.mods.values()].sort((a, b) => a.tag.localeCompare(b.tag)).map((m) =>
              `<div class="fr-row"><span class="fr-name">${esc(m.tag)}</span>${badge('mod', true)}<button class="ghost fr-x" data-unmod="${esc(m.tag)}" title="Remove moderator">✕</button></div>`).join('') || '<div class="note">No moderators yet.</div>'}</div>
            <form id="mp-appoint" class="fr-add" autocomplete="off"><input id="mp-mod-tag" maxlength="16" placeholder="Gamertag to make a moderator" spellcheck="false" autocapitalize="off"><button class="primary" type="submit">Make moderator</button></form>
          </div>` : ''}
        </div>
      </div>`;
    this.renderPlayer();
    const say = (t) => { this.msg = t; const m = this.el.querySelector('#mp-msg'); if (m) m.textContent = t; };
    this.say = say;
    this.el.querySelector('#mp-form').onsubmit = (e) => { e.preventDefault(); this.look(this.el.querySelector('#mp-tag').value.trim()); };
    this.el.querySelectorAll('[data-look]').forEach((b) => { b.onclick = () => this.look(b.dataset.look); });
    this.el.querySelectorAll('input').forEach((i) => i.addEventListener('keydown', (e) => e.stopPropagation()));
    if (owner) {
      this.el.querySelector('#mp-appoint').onsubmit = async (e) => {
        e.preventDefault();
        const tag = this.el.querySelector('#mp-mod-tag').value.trim();
        if (!validTag(tag)) { say(`Gamertags are ${TAG_RULES}.`); return; }
        try { const t = await roles.appoint(tag); say(`${t} is now a moderator.`); this.render(); } catch (err) { say(err.message); }
      };
      this.el.querySelectorAll('[data-unmod]').forEach((b) => {
        b.onclick = async () => {
          if (!confirm(`Remove ${b.dataset.unmod} as a moderator?`)) return;
          try { await roles.remove(b.dataset.unmod); say(`${b.dataset.unmod} is no longer a moderator.`); this.render(); } catch (err) { say(err.message); }
        };
      });
    }
  }

  async look(tag) {
    if (!validTag(tag)) { this.say(`Gamertags are ${TAG_RULES}.`); return; }
    this.say('Looking up…');
    const claim = await this.social.lookup(tag, true);
    if (!claim) { this.target = null; this.say(`Nobody has the gamertag "${tag}".`); this.renderPlayer(); return; }
    this.target = { tag: claim.tag, since: Number(claim.since) || 0 };
    this.say('');
    this.renderPlayer();
  }

  renderPlayer() {
    const box = this.el.querySelector('#mp-player');
    if (!box) return;
    const t = this.target;
    if (!t) { box.innerHTML = ''; return; }
    const rec = moderation.records.get(t.tag.toLowerCase()) || {};
    const role = roles.roleOfTag(t.tag), ban = moderation.activeBan(rec);
    const can = rank(roles.myRole()) > rank(role) && t.tag.toLowerCase() !== String(this.social.tag).toLowerCase();
    const warns = rec.warns || [], log = rec.log || [];
    box.innerHTML = `
      <div class="mp-player">
        <div class="mp-head"><b>${esc(t.tag)}</b>${badge(role, true)}
          <span class="mp-state ${ban ? 'bad' : 'ok'}">${ban ? `Banned ${ban.until ? 'until ' + when(ban.until) : 'permanently'}` : 'In good standing'}</span></div>
        <small class="muted">Gamertag since ${t.since ? when(t.since) : 'unknown'}${rec.rename ? ` · new gamertag requested ${ago(rec.rename.ts)}` : ''}</small>
        ${ban ? `<div class="mp-ban">🚫 Banned by ${esc(ban.by)}: ${esc(ban.reason)}</div>` : ''}
        <div class="mp-sub">Warnings (${warns.length})</div>
        <div class="mp-list">${warns.length ? warns.slice().reverse().map((w) => `<div>⚠ ${esc(w.reason)} <small>— ${esc(w.by)}, ${ago(w.ts)}</small></div>`).join('') : '<small class="muted">None</small>'}</div>
        ${can ? `
        <div class="mp-sub">Action</div>
        <input id="mp-reason" maxlength="140" placeholder="Reason (shown to the player)">
        <div class="mp-actions">
          <button data-act="warn" class="warn">⚠ Warn</button>
          <button data-act="rename">✎ Force new gamertag</button>
          <span class="mp-banrow"><select id="mp-bantime">${BAN_TIMES.map(([h, n]) => `<option value="${h}">${n}</option>`).join('')}</select><button data-act="ban" class="danger">🚫 Ban</button></span>
          ${ban ? '<button data-act="unban">Unban</button>' : ''}
          ${warns.length ? '<button data-act="clearwarns" class="ghost">Clear warnings</button>' : ''}
        </div>` : `<div class="note">${role ? 'Staff can only be moderated by someone ranked above them.' : 'You can\'t moderate yourself.'}</div>`}
        ${log.length ? `<div class="mp-sub">History</div><div class="mp-list mp-log">${log.slice().reverse().map((l) =>
          `<div><b>${esc(l.by)}</b> ${ACT_LABEL[l.act] || l.act} them${l.note ? ': ' + esc(l.note) : ''} <small>${ago(l.ts)}</small></div>`).join('')}</div>` : ''}
      </div>`;
    box.querySelectorAll('input').forEach((i) => i.addEventListener('keydown', (e) => e.stopPropagation()));
    box.querySelectorAll('[data-act]').forEach((b) => {
      b.onclick = async () => {
        const act = b.dataset.act, reason = box.querySelector('#mp-reason').value.trim();
        const hours = Number(box.querySelector('#mp-bantime').value);
        const what = { warn: 'warn', rename: 'force a new gamertag for', ban: `ban (${hours ? fmtHours(hours) : 'permanently'})`, unban: 'unban', clearwarns: 'clear the warnings of' }[act];
        if (act === 'warn' && !reason) { this.say('Type a reason for the warning first.'); return; }
        if (!confirm(`${what[0].toUpperCase() + what.slice(1)} ${t.tag}?`)) return;
        b.disabled = true;
        try {
          await moderation.act(t.tag, act, { reason, hours });
          this.say({ warn: `Warned ${t.tag}.`, rename: `${t.tag} will have to pick a new gamertag.`, ban: `Banned ${t.tag}.`, unban: `Unbanned ${t.tag}.`, clearwarns: 'Warnings cleared.' }[act]);
          this.render();
        } catch (err) { this.say(err.message); b.disabled = false; }
      };
    });
  }
}

