// Medals: FPS-style pop-ups for real kill events (see game.js `onKill`). Add a medal by adding
// an entry here and awarding its id; the queue shows one at a time near the top of the screen,
// well away from the crosshair.
//
// tier picks the color: 1 common, 2 good, 3 great, 4 legendary.

export const MEDALS = {
  firstblood: { title: 'FIRST BLOOD', icon: '🩸', tier: 3, sub: 'First kill of the match' },
  headshot: { title: 'HEADSHOT', icon: '⌖', tier: 1 },
  melee: { title: 'MELEE KILL', icon: '🔪', tier: 1 },
  longshot: { title: 'LONGSHOT', icon: '🎯', tier: 2 },
  revenge: { title: 'REVENGE', icon: '↩', tier: 2, sub: 'Got back at your killer' },
  explosive: { title: 'BOOM', icon: '💥', tier: 1 },
  double: { title: 'DOUBLE KILL', icon: '✕✕', tier: 2 },
  triple: { title: 'TRIPLE KILL', icon: '✕✕✕', tier: 3 },
  multi: { title: 'MULTI KILL', icon: '✸', tier: 4 },
  spree: { title: 'KILLING SPREE', icon: '🔥', tier: 2, sub: '3 kills without dying' },
  rampage: { title: 'RAMPAGE', icon: '⚡', tier: 3, sub: '5 kills without dying' },
  unstoppable: { title: 'UNSTOPPABLE', icon: '☄', tier: 3, sub: '7 kills without dying' },
  legendary: { title: 'LEGENDARY', icon: '★', tier: 4, sub: '10 kills without dying' },
  godlike: { title: 'GODLIKE', icon: '♛', tier: 4, sub: '15 kills without dying' },
  shutdown: { title: 'SHUTDOWN', icon: '⛔', tier: 2, sub: 'Ended a killing spree' },
};

const STREAKS = { 3: 'spree', 5: 'rampage', 7: 'unstoppable', 10: 'legendary', 15: 'godlike' };
export const LONGSHOT_M = 40;

// Which medals one kill earns. ctx: { head, melee, explosive, dist, revenge, multi, streak,
// firstBlood, victimStreak }
export function medalsFor(ctx) {
  const out = [];
  if (ctx.firstBlood) out.push('firstblood');
  if (ctx.multi >= 4) out.push('multi');
  else if (ctx.multi === 3) out.push('triple');
  else if (ctx.multi === 2) out.push('double');
  if (STREAKS[ctx.streak]) out.push(STREAKS[ctx.streak]);
  if (ctx.victimStreak >= 3) out.push('shutdown');
  if (ctx.revenge) out.push('revenge');
  if (ctx.head) out.push('headshot');
  if (ctx.melee) out.push('melee');
  else if (ctx.explosive) out.push('explosive');
  if (ctx.dist >= LONGSHOT_M && !ctx.melee) out.push('longshot');
  return out;
}

// One medal at a time, newest queued behind; the queue speeds up when it gets long.
export class MedalQueue {
  constructor(el, onShow = null) {
    this.el = el;
    this.queue = [];
    this.busy = false;
    this.onShow = onShow;
  }

  add(ids, extra = {}) {
    for (const id of ids) if (MEDALS[id]) this.queue.push({ id, sub: extra[id] });
    this.queue = this.queue.slice(-8);
    if (!this.busy) this.next();
  }

  clear() { this.queue = []; this.el.innerHTML = ''; this.busy = false; clearTimeout(this.t); }

  next() {
    const m = this.queue.shift();
    if (!m) { this.busy = false; return; }
    this.busy = true;
    const d = MEDALS[m.id];
    const card = document.createElement('div');
    card.className = `medal t${d.tier}`;
    card.innerHTML = `<div class="medal-ico">${d.icon}</div><div class="medal-txt"><b>${d.title}</b>${m.sub || d.sub ? `<small>${m.sub || d.sub}</small>` : ''}</div>`;
    this.el.appendChild(card);
    if (this.onShow) this.onShow(d);
    const hold = this.queue.length > 2 ? 650 : 1100;
    setTimeout(() => card.classList.add('out'), hold);
    setTimeout(() => card.remove(), hold + 450);
    this.t = setTimeout(() => this.next(), hold + 120);
  }
}
