// Synthesized sound effects (no audio files needed).
let ctx = null, master = null, noise = null;

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain();
  master.gain.value = 0.5;
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
  head: play((o) => { tone(o, { dur: 0.07, f0: 2600, gain: 0.4, type: 'triangle' }); tone(o, { dur: 0.05, f0: 3400, gain: 0.25, delay: 0.03 }); }),
  kill: play((o) => { tone(o, { dur: 0.12, f0: 880, gain: 0.35, type: 'triangle' }); tone(o, { dur: 0.2, f0: 1320, gain: 0.35, type: 'triangle', delay: 0.08 }); }),
  hurt: play((o) => { nz(o, { dur: 0.15, f0: 400, f1: 120, gain: 0.7 }); }),
  empty: play((o) => { tone(o, { dur: 0.03, f0: 1500, gain: 0.3, type: 'square' }); }),
  reload: play((o) => { nz(o, { dur: 0.05, f0: 3000, type: 'highpass', gain: 0.5 }); tone(o, { dur: 0.04, f0: 700, gain: 0.25, type: 'square', delay: 0.25 }); }),
  equip: play((o) => { nz(o, { dur: 0.08, f0: 2500, type: 'highpass', gain: 0.3 }); }),
  jump: play((o) => { nz(o, { dur: 0.08, f0: 300, gain: 0.25 }); }),
};
