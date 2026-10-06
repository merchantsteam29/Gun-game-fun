// Synthesized sound effects (no audio files needed).
let ctx = null, master = null, noise = null, volume = 1;

// 0..1 master volume (settings).
export function setVolume(v) {
  volume = v;
  if (master) master.gain.value = 0.5 * volume;
}

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain();
  master.gain.value = 0.5 * volume;
  master.connect(ctx.destination);
  noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

function out(vol, pan) {
  const g = ctx.createGain();
  g.gain.value = vol;
  if (pan && ctx.createStereoPanner) {
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    g.connect(p).connect(master);
  } else g.connect(master);
  return g;
}

function nz(dest, { dur, f0, f1 = f0, type = 'lowpass', q = 1, gain = 1, attack = 0.002 }) {
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const f = ctx.createBiquadFilter();
  f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(dest);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.05);
}

function tone(dest, { dur, f0, f1 = f0, type = 'sine', gain = 1, delay = 0 }) {
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + dur + 0.05);
}

const play = (fn) => (vol = 1, pan = 0) => {
  if (!ctx || vol < 0.01) return;
  fn(out(vol, pan));
};

export const sfx = {
  ar: play((o) => { nz(o, { dur: 0.13, f0: 3200, f1: 500, gain: 0.9 }); tone(o, { dur: 0.08, f0: 160, f1: 50, gain: 0.6 }); }),
  pistol: play((o) => { nz(o, { dur: 0.11, f0: 4000, f1: 700, gain: 0.7 }); tone(o, { dur: 0.06, f0: 220, f1: 70, gain: 0.4 }); }),
  shotgun: play((o) => { nz(o, { dur: 0.3, f0: 2200, f1: 200, gain: 1.2 }); tone(o, { dur: 0.15, f0: 110, f1: 35, gain: 0.9 }); }),
  gl: play((o) => { tone(o, { dur: 0.18, f0: 240, f1: 60, type: 'square', gain: 0.25 }); nz(o, { dur: 0.15, f0: 900, f1: 150, gain: 0.6 }); }),
  explosion: play((o) => { nz(o, { dur: 1.2, f0: 1400, f1: 60, gain: 1.6, attack: 0.005 }); tone(o, { dur: 0.6, f0: 80, f1: 25, gain: 1.2 }); }),
  knife: play((o) => { nz(o, { dur: 0.18, f0: 1200, f1: 4000, type: 'bandpass', q: 2, gain: 0.5, attack: 0.04 }); }),
  stab: play((o) => { nz(o, { dur: 0.1, f0: 600, f1: 200, gain: 0.8 }); }),
  throw: play((o) => { nz(o, { dur: 0.25, f0: 500, f1: 2000, type: 'bandpass', q: 1.5, gain: 0.4, attack: 0.08 }); }),
  bounce: play((o) => { tone(o, { dur: 0.06, f0: 900, f1: 500, type: 'triangle', gain: 0.4 }); }),
  hit: play((o) => { tone(o, { dur: 0.05, f0: 1900, gain: 0.35, type: 'triangle' }); }),
  flamethrower: play((o) => { nz(o, { dur: 0.12, f0: 900, f1: 400, type: 'bandpass', q: 0.7, gain: 0.45, attack: 0.02 }); }),
  nailgun: play((o) => { tone(o, { dur: 0.04, f0: 1400, f1: 600, type: 'square', gain: 0.12 }); nz(o, { dur: 0.05, f0: 2500, f1: 900, gain: 0.35 }); }),
  pan: play((o) => { tone(o, { dur: 0.5, f0: 820, f1: 760, type: 'triangle', gain: 0.35 }); tone(o, { dur: 0.35, f0: 1630, f1: 1500, type: 'sine', gain: 0.2 }); nz(o, { dur: 0.08, f0: 3000, f1: 1200, gain: 0.3 }); }),
  medal: play((o) => { tone(o, { dur: 0.1, f0: 660, gain: 0.3, type: 'triangle' }); tone(o, { dur: 0.1, f0: 990, gain: 0.3, type: 'triangle', delay: 0.07 }); tone(o, { dur: 0.22, f0: 1320, gain: 0.3, type: 'triangle', delay: 0.14 }); }),
  kill: play((o) => { tone(o, { dur: 0.12, f0: 880, gain: 0.35, type: 'triangle' }); tone(o, { dur: 0.2, f0: 1320, gain: 0.35, type: 'triangle', delay: 0.08 }); }),
  hurt: play((o) => { nz(o, { dur: 0.15, f0: 400, f1: 120, gain: 0.7 }); }),
  empty: play((o) => { tone(o, { dur: 0.03, f0: 1500, gain: 0.3, type: 'square' }); }),
  reload: play((o) => { nz(o, { dur: 0.05, f0: 3000, type: 'highpass', gain: 0.5 }); tone(o, { dur: 0.04, f0: 700, gain: 0.25, type: 'square', delay: 0.25 }); }),
  equip: play((o) => { nz(o, { dur: 0.08, f0: 2500, type: 'highpass', gain: 0.3 }); }),
  jump: play((o) => { nz(o, { dur: 0.08, f0: 300, gain: 0.25 }); }),
  smg: play((o) => { nz(o, { dur: 0.09, f0: 3800, f1: 700, gain: 0.7 }); tone(o, { dur: 0.05, f0: 200, f1: 70, gain: 0.4 }); }),
  burst: play((o) => { nz(o, { dur: 0.12, f0: 3000, f1: 450, gain: 0.85 }); tone(o, { dur: 0.07, f0: 150, f1: 50, gain: 0.55 }); }),
  lmg: play((o) => { nz(o, { dur: 0.14, f0: 2600, f1: 380, gain: 1.0 }); tone(o, { dur: 0.09, f0: 130, f1: 40, gain: 0.7 }); }),
  sniper: play((o) => { nz(o, { dur: 0.45, f0: 3500, f1: 150, gain: 1.4 }); tone(o, { dur: 0.25, f0: 90, f1: 30, gain: 1.0 }); }),
  revolver: play((o) => { nz(o, { dur: 0.25, f0: 3000, f1: 250, gain: 1.1 }); tone(o, { dur: 0.12, f0: 120, f1: 40, gain: 0.8 }); }),
  mpistol: play((o) => { nz(o, { dur: 0.08, f0: 4200, f1: 800, gain: 0.6 }); tone(o, { dur: 0.04, f0: 240, f1: 80, gain: 0.3 }); }),
  axe: play((o) => { nz(o, { dur: 0.3, f0: 600, f1: 2500, type: 'bandpass', q: 2, gain: 0.6, attack: 0.1 }); }),
  beep: play((o) => { tone(o, { dur: 0.06, f0: 1800, type: 'square', gain: 0.15 }); }),
  hiss: play((o) => { nz(o, { dur: 2.5, f0: 5000, f1: 1500, type: 'highpass', gain: 0.35, attack: 0.2 }); }),
  step: play((o) => { nz(o, { dur: 0.07, f0: 500, f1: 150, gain: 0.35 }); }),
  land: play((o) => { nz(o, { dur: 0.12, f0: 400, f1: 80, gain: 0.6 }); tone(o, { dur: 0.08, f0: 90, f1: 40, gain: 0.4 }); }),
  pad: play((o) => { tone(o, { dur: 0.35, f0: 180, f1: 900, type: 'sawtooth', gain: 0.2 }); nz(o, { dur: 0.3, f0: 800, f1: 3000, type: 'bandpass', gain: 0.4 }); }),
  br: play((o) => { nz(o, { dur: 0.16, f0: 2800, f1: 380, gain: 1.0 }); tone(o, { dur: 0.1, f0: 140, f1: 45, gain: 0.7 }); }),
  pdw: play((o) => { nz(o, { dur: 0.07, f0: 4400, f1: 900, gain: 0.55 }); tone(o, { dur: 0.04, f0: 260, f1: 90, gain: 0.3 }); }),
  autoshot: play((o) => { nz(o, { dur: 0.24, f0: 2400, f1: 220, gain: 1.1 }); tone(o, { dur: 0.12, f0: 120, f1: 40, gain: 0.8 }); }),
  amr: play((o) => { nz(o, { dur: 0.6, f0: 3000, f1: 100, gain: 1.6 }); tone(o, { dur: 0.35, f0: 70, f1: 22, gain: 1.2 }); }),
  railgun: play((o) => { tone(o, { dur: 0.35, f0: 2200, f1: 180, type: 'sawtooth', gain: 0.35 }); nz(o, { dur: 0.2, f0: 6000, f1: 1500, type: 'highpass', gain: 0.6 }); }),
  bpistol: play((o) => { nz(o, { dur: 0.09, f0: 4100, f1: 750, gain: 0.6 }); tone(o, { dur: 0.05, f0: 230, f1: 75, gain: 0.35 }); }),
  flare: play((o) => { nz(o, { dur: 0.3, f0: 1200, f1: 3000, type: 'bandpass', q: 1.2, gain: 0.6 }); tone(o, { dur: 0.1, f0: 300, f1: 120, gain: 0.3 }); }),
  carbine: play((o) => { nz(o, { dur: 0.12, f0: 3400, f1: 520, gain: 0.85 }); tone(o, { dur: 0.07, f0: 170, f1: 55, gain: 0.55 }); }),
  vector: play((o) => { nz(o, { dur: 0.06, f0: 4600, f1: 1000, gain: 0.5 }); tone(o, { dur: 0.035, f0: 280, f1: 100, gain: 0.25 }); }),
  slug: play((o) => { nz(o, { dur: 0.32, f0: 2000, f1: 160, gain: 1.3 }); tone(o, { dur: 0.16, f0: 95, f1: 30, gain: 1.0 }); }),
  laser: play((o) => { tone(o, { dur: 0.09, f0: 1800, f1: 600, type: 'sawtooth', gain: 0.18 }); tone(o, { dur: 0.06, f0: 2600, f1: 1200, type: 'square', gain: 0.08 }); }),
  harpoon: play((o) => { nz(o, { dur: 0.2, f0: 900, f1: 2600, type: 'bandpass', q: 1.5, gain: 0.6, attack: 0.01 }); tone(o, { dur: 0.12, f0: 160, f1: 70, gain: 0.5 }); }),
  microsmg: play((o) => { nz(o, { dur: 0.07, f0: 4300, f1: 900, gain: 0.55 }); tone(o, { dur: 0.04, f0: 250, f1: 85, gain: 0.3 }); }),
  autorev: play((o) => { nz(o, { dur: 0.2, f0: 3200, f1: 300, gain: 1.0 }); tone(o, { dur: 0.1, f0: 130, f1: 45, gain: 0.7 }); }),
  vortex: play((o) => { tone(o, { dur: 0.6, f0: 900, f1: 60, type: 'sawtooth', gain: 0.3 }); nz(o, { dur: 0.5, f0: 3000, f1: 200, type: 'bandpass', q: 3, gain: 0.6 }); }),
  cycle: play((o) => { nz(o, { dur: 0.05, f0: 2500, type: 'highpass', gain: 0.4 }); nz(o, { dur: 0.05, f0: 1800, type: 'highpass', gain: 0.4 }); }),
};
sfx.slide = play((o) => { nz(o, { dur: 0.55, f0: 900, f1: 300, type: 'bandpass', q: 0.8, gain: 0.5, attack: 0.03 }); });
// Headshot: a bright metallic "tink" on top of the hit tick.
sfx.head = play((o) => {
  tone(o, { dur: 0.09, f0: 2900, f1: 2700, gain: 0.45, type: 'triangle' });
  tone(o, { dur: 0.22, f0: 4300, f1: 4100, gain: 0.18 });
  tone(o, { dur: 0.18, f0: 6100, gain: 0.08, delay: 0.01 });
});
// Headshot kill: the tink plus a low thump.
sfx.headKill = play((o) => {
  tone(o, { dur: 0.12, f0: 3000, f1: 2600, gain: 0.45, type: 'triangle' });
  tone(o, { dur: 0.3, f0: 4500, f1: 4200, gain: 0.2 });
  tone(o, { dur: 0.18, f0: 140, f1: 60, gain: 0.5, delay: 0.02 });
  nz(o, { dur: 0.12, f0: 2500, f1: 600, gain: 0.25 });
});
sfx.dmr = play((o) => { nz(o, { dur: 0.3, f0: 3200, f1: 250, gain: 1.15 }); tone(o, { dur: 0.15, f0: 110, f1: 40, gain: 0.8 }); });
sfx.minigun = play((o) => { nz(o, { dur: 0.06, f0: 3500, f1: 900, gain: 0.55 }); tone(o, { dur: 0.04, f0: 180, f1: 90, gain: 0.3 }); });
sfx.doublebarrel = play((o) => { nz(o, { dur: 0.4, f0: 2000, f1: 150, gain: 1.4 }); tone(o, { dur: 0.2, f0: 90, f1: 30, gain: 1.1 }); });
sfx.sawedoff = sfx.doublebarrel;
sfx.handcannon = play((o) => { nz(o, { dur: 0.32, f0: 2800, f1: 200, gain: 1.3 }); tone(o, { dur: 0.16, f0: 100, f1: 35, gain: 1.0 }); });
sfx.rocket = play((o) => { nz(o, { dur: 0.6, f0: 900, f1: 3000, type: 'bandpass', gain: 1.0, attack: 0.02 }); tone(o, { dur: 0.3, f0: 70, f1: 40, gain: 0.8 }); });
sfx.crossbow = play((o) => { tone(o, { dur: 0.12, f0: 220, f1: 110, type: 'triangle', gain: 0.6 }); nz(o, { dur: 0.1, f0: 1500, type: 'bandpass', gain: 0.4 }); });
sfx.katana = play((o) => { nz(o, { dur: 0.22, f0: 2000, f1: 6000, type: 'bandpass', q: 3, gain: 0.55, attack: 0.05 }); });
sfx.bat = sfx.axe;
sfx.flashbang = play((o) => { nz(o, { dur: 0.5, f0: 6000, f1: 800, gain: 1.4, attack: 0.002 }); tone(o, { dur: 2.5, f0: 3800, gain: 0.15 }); });
sfx.thunk = play((o) => { tone(o, { dur: 0.08, f0: 300, f1: 120, type: 'triangle', gain: 0.6 }); });
sfx.sticky = sfx.throw;
sfx.flash = sfx.throw;
sfx.tknife = sfx.knife;
sfx.smoke = sfx.throw;
