import { store, esc } from './util.js';
import { keysLabel } from './binds.js';

// First-time tutorial in the Practice Range: a short list of steps (move, look, jump, shoot,
// aim, reload, switch, melee, grenade), each checked from the game's state every frame.

const $ = (id) => document.getElementById(id);
export const TUTORIAL_TOKENS = 150;
export const tutorialDone = () => !!store.get('tutorialDone', false);

// how: [keyboard & mouse, controller, touch]
const STEPS = [
  { title: 'Look around', how: () => ['Move your mouse', 'Use the right stick', 'Drag on the right side of the screen'], check: (s) => s.turned > 2.2 },
  { title: 'Move', how: () => [`${keysLabel('forward')} · ${keysLabel('left')} · ${keysLabel('back')} · ${keysLabel('right')}`, 'Use the left stick', 'Use the stick on the left'], check: (s) => s.moved > 7 },
  { title: 'Sprint', how: () => [`Hold ${keysLabel('sprint')} while moving`, 'Click the left stick (L3) while moving', 'Push the stick all the way'], check: (s) => s.sprintT > 0.8 },
  { title: 'Jump', how: () => [keysLabel('jump'), 'Ⓐ', 'Tap the jump button'], check: (s) => s.jumps >= 1 },
  { title: 'Crouch', how: () => [`${keysLabel('crouch')} (sprint + crouch slides)`, 'Ⓑ', 'Tap the crouch button'], check: (s) => s.crouchT > 0.3 },
  { title: 'Shoot 3 targets', how: () => ['Left click on the targets downrange', 'RT', 'Tap the fire button (aim assist helps)'], check: (s) => s.hits >= 3 },
  { title: 'Aim down sights', how: () => ['Hold right click, then hit a target', 'Hold LT, then hit a target', 'Tap the aim button, then hit a target'], check: (s) => s.adsHits >= 1 },
  { title: 'Reload', how: () => [keysLabel('reload'), 'Ⓧ', 'Tap the reload button'], check: (s) => s.reloads >= 1 },
  { title: 'Switch weapons', how: () => [`${keysLabel('slot2')} for your secondary (or the scroll wheel)`, 'Ⓨ', 'Tap the weapon slots at the bottom right'], check: (s) => s.switched },
  { title: 'Quick melee', how: () => [keysLabel('melee'), 'RB / R3', 'Tap the melee button'], check: (s) => s.melees >= 1 },
  { title: 'Throw a grenade', how: () => [keysLabel('grenade'), 'LB', 'Tap the grenade button'], check: (s) => s.throws >= 1 },
];

export class Tutorial {
  constructor() { this.game = null; this.active = false; this.onDone = null; }

  start(game) {
    this.game = game;
    this.active = true;
    this.i = 0;
    this.s = { turned: 0, moved: 0, sprintT: 0, jumps: 0, crouchT: 0, hits: 0, adsHits: 0, reloads: 0, switched: false, melees: 0, throws: 0 };
    this.last = null;
    this.doneT = 0;
    // Watch the game's own actions.
    const g = game, s = this.s;
    this.wrap(g, 'showHit', () => { s.hits++; if (g.ads) s.adsHits++; });
    this.wrap(g, 'startReload', () => { if (g.reloadT > 0) s.reloads++; }, true);
    this.wrap(g, 'releaseThrow', () => { s.throws++; });
    this.wrap(g, 'quickMelee', () => { s.melees++; });
    $('tutorial').classList.remove('hidden');
    this.render();
  }

  // Calls `fn` after (or before) game[name] runs, until the tutorial stops.
  wrap(g, name, fn, after = false) {
    const orig = g[name];
    this.restore = this.restore || [];
    this.restore.push(() => { g[name] = orig; });
    g[name] = function (...a) {
      if (!after) fn();
      const r = orig.apply(this, a);
      if (after) fn();
      return r;
    };
  }

  stop() {
    this.active = false;
    for (const r of this.restore || []) r();
    this.restore = [];
    $('tutorial').classList.add('hidden');
  }

  // Every frame (from main.js).
  tick(dt) {
    if (!this.active) return;
    const g = this.game, me = g.me, s = this.s;
    if (!me.alive) return;
    if (this.last) {
      let dy = Math.abs(me.yaw - this.last.yaw);
      if (dy > Math.PI) dy = 2 * Math.PI - dy;
      s.turned += dy + Math.abs(me.pitch - this.last.pitch);
      s.moved += Math.hypot(me.pos.x - this.last.x, me.pos.z - this.last.z);
      if (!me.onGround && this.last.ground && me.vel.y > 1) s.jumps++;
    }
    if (g.sprinting) s.sprintT += dt;
    if (me.crouch) s.crouchT += dt;
    if (g.slot === 1) s.switched = true;
    this.last = { yaw: me.yaw, pitch: me.pitch, x: me.pos.x, z: me.pos.z, ground: me.onGround };
    if (this.i < STEPS.length && STEPS[this.i].check(s)) {
      this.i++;
      this.flash = 1;
      this.render();
      if (this.i >= STEPS.length) this.finish();
    }
  }

  device() { const g = this.game; return g.touch ? 2 : g.padMode ? 1 : 0; }

  render() {
    const el = $('tutorial');
    if (this.i >= STEPS.length) return;
    const st = STEPS[this.i];
    el.innerHTML = `<div class="tu-top"><small>TUTORIAL · ${this.i + 1} / ${STEPS.length}</small><button class="ghost" id="tu-skip">Skip</button></div>
      <b>${esc(st.title)}</b><span class="tu-how">${esc(st.how()[this.device()])}</span>
      <div class="tu-dots">${STEPS.map((_, k) => `<i class="${k < this.i ? 'done' : k === this.i ? 'now' : ''}"></i>`).join('')}</div>`;
    el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
    $('tu-skip').onclick = () => { if (confirm('Skip the tutorial?')) { store.set('tutorialDone', true); this.stop(); if (this.onSkip) this.onSkip(); } };
  }

  finish() {
    const first = !tutorialDone();
    store.set('tutorialDone', true);
    const el = $('tutorial');
    el.innerHTML = `<div class="tu-top"><small>TUTORIAL COMPLETE</small></div><b>You're ready! 🎉</b>
      <span class="tu-how">${first ? `🪙 ${TUTORIAL_TOKENS} tokens for finishing. ` : ''}Jump into a real match, or keep practicing with every weapon (pause menu).</span>
      <div class="tu-actions"><button class="primary" id="tu-play">Play a match</button><button id="tu-stay">Keep practicing</button></div>`;
    for (const r of this.restore || []) r();
    this.restore = [];
    this.active = false;
    $('tu-play').onclick = () => { $('tutorial').classList.add('hidden'); if (this.onPlay) this.onPlay(); };
    $('tu-stay').onclick = () => $('tutorial').classList.add('hidden');
    if (this.onDone) this.onDone(first);
  }
}

export const tutorial = new Tutorial();
