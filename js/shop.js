import { esc, store } from './util.js';
import { COSMETICS, SLOT_LABELS, getTokens, buy, buyWrap, getCos, setCos } from './missions.js';
import { CAMOS, camoSwatch } from './camos.js';
import { bannerOf, bannerHtml } from './banners.js';
import { drawAvatar } from './settingsui.js';
import { gifts, giftable, ownsItem, GIFT_MIN, GIFT_MAX, GIFTS_PER_DAY } from './gifts.js';

// The Shop: everything you can buy with tokens, always the same (no rotating stock, no timers).
// Categories down the side, item cards in the middle, and the picked item big on the right
// with Buy / Wear / Gift to a friend. Also: send tokens to a friend, and gifts you've received.

const CATS = [
  ['all', 'Everything', '🛒'], ['hat', 'Hats', '🎩'], ['hair', 'Hair', '💇'], ['face', 'Face', '🕶'], ['back', 'Back', '🎒'],
  ['banner', 'Banners', '🏳'], ['wrap', 'Weapon wraps', '🎨'], ['gifts', 'Gifts', '🎁'],
];
const items = (cat) => {
  const wear = ['hat', 'hair', 'face', 'back', 'banner'];
  const list = [];
  for (const slot of cat === 'all' ? [...wear, 'wrap'] : [cat]) {
    if (slot === 'wrap') for (const c of CAMOS) { if (c.price > 0 || c.reward) list.push({ slot, c }); }
    else for (const c of COSMETICS[slot] || []) { if (c.price > 0 || c.reward) list.push({ slot, c }); }
  }
  return list;
};

export class Shop {
  // ctx: { el, social, getColor, getName, onCos(cos), toast(text) }
  constructor(ctx) {
    this.ctx = ctx;
    this.cat = store.get('shopCat', 'all');
    this.sel = null; // { slot, id }
    this.filter = store.get('shopFilter', 'all'); // all | buy (not owned)
    this.sort = store.get('shopSort', 'price');
  }

  render() {
    const { el } = this.ctx;
    if (!el) return;
    if (!CATS.some(([k]) => k === this.cat)) this.cat = 'all';
    el.innerHTML = `<div class="shop">
      <aside class="shop-cats">
        <div class="shop-wallet"><b>🪙 ${getTokens().toLocaleString()}</b><small>Earn tokens from missions, daily rewards, levels and events</small></div>
        ${CATS.map(([k, n, ic]) => `<button data-cat="${k}" class="${k === this.cat ? 'sel' : ''}"><span>${ic}</span>${n}${k === 'gifts' && gifts.received.length ? ` <em>${gifts.received.length}</em>` : ''}</button>`).join('')}
      </aside>
      <div class="shop-main"></div>
      <aside class="shop-detail"></aside>
    </div>`;
    el.querySelectorAll('[data-cat]').forEach((b) => { b.onclick = () => { this.cat = b.dataset.cat; store.set('shopCat', this.cat); this.sel = null; this.render(); }; });
    if (this.cat === 'gifts') this.renderGifts(el.querySelector('.shop-main'), el.querySelector('.shop-detail'));
    else this.renderItems(el.querySelector('.shop-main'), el.querySelector('.shop-detail'));
  }

  card({ slot, c }) {
    const own = ownsItem(slot, c.id), on = slot !== 'wrap' && getCos()[slot] === c.id;
    const sel = this.sel && this.sel.slot === slot && this.sel.id === c.id;
    const tag = on ? '<em class="cz-tag on">Wearing</em>' : own ? '<em class="cz-tag">Owned</em>' : c.reward ? '<em class="cz-tag lock">🔒 Earn</em>' : `<em class="cz-tag price">🪙 ${c.price}</em>`;
    let pic;
    if (slot === 'banner') { const b = bannerOf(c.id); pic = `<span class="cz-bnr-swatch" style="--bg:${b.bg}"><em>${b.emblem}</em></span>`; }
    else if (slot === 'wrap') pic = `<span class="shop-wrap" style="background:${camoSwatch(c)}"></span>`;
    else pic = '<canvas width="76" height="100"></canvas>';
    return `<button class="shop-card ${own ? 'owned' : ''} ${sel ? 'sel' : ''}" data-slot="${slot}" data-id="${esc(c.id)}">${pic}<b>${esc(c.name)}</b><small>${esc(slot === 'wrap' ? 'Weapon wrap' : SLOT_LABELS[slot])}</small>${tag}</button>`;
  }

  renderItems(main, detail) {
    let list = items(this.cat);
    if (this.filter === 'buy') list = list.filter(({ slot, c }) => !ownsItem(slot, c.id) && !c.reward);
    list.sort((a, b) => (this.sort === 'name' ? a.c.name.localeCompare(b.c.name) : (a.c.reward ? 1e9 : a.c.price) - (b.c.reward ? 1e9 : b.c.price)));
    const total = items(this.cat).filter(({ c }) => !c.reward), owned = total.filter(({ slot, c }) => ownsItem(slot, c.id)).length;
    main.innerHTML = `<div class="shop-bar">
        <div class="seg"><button data-f="all" class="${this.filter === 'all' ? 'sel' : ''}">All</button><button data-f="buy" class="${this.filter === 'buy' ? 'sel' : ''}">Not owned</button></div>
        <div class="seg"><button data-s="price" class="${this.sort === 'price' ? 'sel' : ''}">Price</button><button data-s="name" class="${this.sort === 'name' ? 'sel' : ''}">A–Z</button></div>
        <small>You own ${owned} of ${total.length}</small>
      </div>
      <div class="shop-grid">${list.map((x) => this.card(x)).join('') || '<div class="sv-empty">You own everything here. 🎉</div>'}</div>`;
    main.querySelectorAll('[data-f]').forEach((b) => { b.onclick = () => { this.filter = b.dataset.f; store.set('shopFilter', this.filter); this.render(); }; });
    main.querySelectorAll('[data-s]').forEach((b) => { b.onclick = () => { this.sort = b.dataset.s; store.set('shopSort', this.sort); this.render(); }; });
    const cos = getCos();
    main.querySelectorAll('.shop-card').forEach((b) => {
      const cv = b.querySelector('canvas');
      if (cv) drawAvatar(cv, { ...cos, [b.dataset.slot]: b.dataset.id }, this.ctx.getColor());
      b.onclick = () => { this.sel = { slot: b.dataset.slot, id: b.dataset.id }; this.render(); };
    });
    if (!this.sel && list.length) this.sel = { slot: list[0].slot, id: list[0].c.id };
    this.renderDetail(detail);
  }

  renderDetail(detail) {
    const s = this.sel;
    const all = s && (s.slot === 'wrap' ? CAMOS.find((c) => c.id === s.id) : (COSMETICS[s.slot] || []).find((c) => c.id === s.id));
    if (!all) { detail.innerHTML = '<div class="sv-empty">Pick something to see it here.</div>'; return; }
    const c = all, own = ownsItem(s.slot, c.id), cos = getCos(), wearing = s.slot !== 'wrap' && cos[s.slot] === c.id;
    let big;
    if (s.slot === 'banner') big = `<div class="shop-bnr">${bannerHtml(c.id, this.ctx.getName(), this.ctx.getColor(), 'KILLED YOU', '<span class="chip">Assault Rifle</span>')}</div>`;
    else if (s.slot === 'wrap') big = `<div class="shop-wrap big" style="background:${camoSwatch(c)}"></div>`;
    else big = '<canvas class="shop-avatar" width="200" height="262"></canvas>';
    const friends = this.ctx.social ? [...this.ctx.social.friends.values()].map((f) => f.tag) : [];
    const canGift = !c.reward && c.price > 0 && friends.length;
    detail.innerHTML = `${big}
      <h3>${esc(c.name)}</h3>
      <small class="muted">${esc(s.slot === 'wrap' ? 'Weapon wrap · put it on any gun in Settings → Customize' : SLOT_LABELS[s.slot])}</small>
      ${c.reward ? `<p class="note">🔒 Can't be bought. ${esc(c.how || 'Earned in the game.')}</p>` : ''}
      <div class="shop-actions">
        ${own ? (s.slot === 'wrap' ? '<span class="cz-tag">Owned</span>' : wearing ? '<span class="cz-tag on">Wearing</span>' : '<button class="primary" data-wear>Wear</button>')
          : c.reward ? '' : `<button class="primary" data-buy ${getTokens() < c.price ? 'disabled' : ''}>Buy · 🪙 ${c.price}</button>${getTokens() < c.price ? `<small class="muted">You need ${c.price - getTokens()} more tokens</small>` : ''}`}
      </div>
      ${canGift ? `<div class="shop-gift"><b>🎁 Gift it to a friend</b><div class="shop-gift-row"><select data-gto>${friends.map((t) => `<option>${esc(t)}</option>`).join('')}</select><button data-gift ${getTokens() < c.price ? 'disabled' : ''}>Send · 🪙 ${c.price}</button></div><small class="muted">If they already have it, they get the tokens instead.</small></div>` : ''}
      <p class="shop-msg note"></p>`;
    const cv = detail.querySelector('.shop-avatar');
    if (cv) drawAvatar(cv, { ...cos, [s.slot]: c.id }, this.ctx.getColor());
    const msg = (t) => { detail.querySelector('.shop-msg').textContent = t; };
    const b = detail.querySelector('[data-buy]');
    if (b) b.onclick = () => {
      const ok = s.slot === 'wrap' ? buyWrap(c.id) : buy(s.slot, c.id);
      if (!ok) { msg('Not enough tokens.'); return; }
      if (s.slot !== 'wrap') { const next = { ...getCos(), [s.slot]: c.id }; setCos(next); if (this.ctx.onCos) this.ctx.onCos(next); }
      this.ctx.toast(`Bought ${c.name}${s.slot === 'wrap' ? '. Put it on a gun in Settings → Customize' : ' and put it on'}!`);
      this.render();
    };
    const w = detail.querySelector('[data-wear]');
    if (w) w.onclick = () => { const next = { ...getCos(), [s.slot]: c.id }; setCos(next); if (this.ctx.onCos) this.ctx.onCos(next); this.render(); };
    const g = detail.querySelector('[data-gift]');
    if (g) g.onclick = async () => {
      const to = detail.querySelector('[data-gto]').value;
      try { await gifts.send(to, { item: { slot: s.slot, id: c.id } }); this.ctx.toast(`🎁 ${c.name} sent to ${to}!`); this.render(); } catch (e) { msg(e.message); }
    };
  }

  renderGifts(main, detail) {
    const friends = this.ctx.social ? [...this.ctx.social.friends.values()].map((f) => f.tag) : [];
    const left = GIFTS_PER_DAY - gifts.sentToday();
    main.innerHTML = `<div class="card shop-send">
        <h3>🎁 Send tokens to a friend</h3>
        ${!this.ctx.social || !this.ctx.social.tag ? '<p class="note">Pick a gamertag (Friends tab) to send and receive gifts.</p>'
          : !friends.length ? '<p class="note">Add a friend first (Friends tab). Gifts go to friends only.</p>'
          : `<div class="shop-gift-row"><select data-gto>${friends.map((t) => `<option>${esc(t)}</option>`).join('')}</select>
            <input type="number" data-amt min="${GIFT_MIN}" max="${GIFT_MAX}" step="10" value="100"><input type="text" data-note maxlength="60" placeholder="Note (optional)">
            <button class="primary" data-send>Send</button></div>
            <small class="muted">${GIFT_MIN}–${GIFT_MAX} tokens per gift · ${left} of ${GIFTS_PER_DAY} gifts left today · you have 🪙 ${getTokens().toLocaleString()}. You can also gift any item from its page.</small>`}
        <p class="shop-msg note"></p>
      </div>
      <div class="card"><h3>Gifts you got</h3>${gifts.received.length ? `<div class="shop-recv">${gifts.received.map((r) => `<div><b>${esc(r.from)}</b> sent you ${r.tokens ? `🪙 ${r.tokens}` : esc(this.itemName(r.item)) + (r.refunded ? ' (you had it, so you got its price in tokens)' : '')}${r.note ? ` · “${esc(r.note)}”` : ''}<small>${new Date(r.ts).toLocaleDateString()}</small></div>`).join('')}</div>` : '<p class="note">Nothing yet.</p>'}</div>`;
    detail.innerHTML = '<div class="note">Gifts arrive the next time your friend plays, even if they\'re offline now.</div>';
    const send = main.querySelector('[data-send]');
    if (send) send.onclick = async () => {
      const to = main.querySelector('[data-gto]').value, n = Number(main.querySelector('[data-amt]').value), note = main.querySelector('[data-note]').value;
      try { await gifts.send(to, { tokens: n }, note); this.ctx.toast(`🎁 Sent 🪙 ${n} to ${to}!`); this.render(); } catch (e) { main.querySelector('.shop-msg').textContent = e.message; }
    };
    main.querySelectorAll('input').forEach((i) => i.addEventListener('keydown', (e) => e.stopPropagation()));
  }

  itemName(item) {
    if (!item) return 'a gift';
    const c = item.slot === 'wrap' ? CAMOS.find((x) => x.id === item.id) : (COSMETICS[item.slot] || []).find((x) => x.id === item.id);
    return c ? c.name : 'an item';
  }
}
