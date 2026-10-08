// Match highlights: the game view is recorded in short rolling segments (two recorders, staggered),
// so when something big happens (multi-kill, longshot, streak…) the last ~5–10 seconds can be
// kept as a clip. The best moment of the match shows on the results screen to watch, download
// or share. Video only (the HUD isn't part of the 3D canvas).

const SEG = 10000;      // each recorder restarts every 10 s (the two are 5 s apart)
const AFTER = 1500;     // keep recording this long after the moment

function pickType() {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const t of ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4']) if (MediaRecorder.isTypeSupported(t)) return t;
  return null;
}

class Highlights {
  constructor() {
    this.type = pickType();
    this.recs = [];
    this.best = null; // { score, label, url, blob, ext }
    this.onChange = null;
  }

  get supported() { return !!this.type && typeof HTMLCanvasElement !== 'undefined' && !!HTMLCanvasElement.prototype.captureStream; }

  start(canvas) {
    if (!this.supported || this.recs.length) return;
    try { this.stream = canvas.captureStream(30); } catch { return; }
    this.recs = [this.make(), this.make()];
    this.recs[0].begin();
    this.stagger = setTimeout(() => this.recs[1] && this.recs[1].begin(), SEG / 2);
  }

  make() {
    const self = this;
    const r = {
      rec: null, chunks: [], startedAt: 0, timer: 0, capture: null,
      begin() {
        clearTimeout(r.timer);
        if (!self.stream) return;
        r.chunks = [];
        try { r.rec = new MediaRecorder(self.stream, { mimeType: self.type, videoBitsPerSecond: 2500000 }); } catch { return; }
        r.rec.ondataavailable = (e) => { if (e.data && e.data.size) r.chunks.push(e.data); };
        r.rec.onstop = () => {
          const cap = r.capture;
          r.capture = null;
          if (cap && self.pending === cap) self.pending = null; // even if nothing was recorded
          if (cap && r.chunks.length) self.keep(cap, new Blob(r.chunks, { type: self.type }));
          if (self.stream) r.begin();
        };
        r.rec.start(1000);
        r.startedAt = performance.now();
        r.timer = setTimeout(() => { if (!r.capture && r.rec && r.rec.state === 'recording') r.rec.stop(); }, SEG);
      },
    };
    return r;
  }

  stop() {
    clearTimeout(this.stagger);
    const recs = this.recs;
    this.recs = [];
    this.stream = null;
    for (const r of recs) { clearTimeout(r.timer); r.capture = null; try { if (r.rec && r.rec.state !== 'inactive') r.rec.stop(); } catch { /* ignore */ } }
  }

  // A new match: forget the last one's best moment.
  resetMatch() {
    if (this.best && this.best.url) URL.revokeObjectURL(this.best.url);
    this.best = null;
    if (this.onChange) this.onChange();
  }

  // Something worth keeping happened. score: how good (bigger = better); label: e.g. "TRIPLE KILL".
  moment(score, label) {
    if (!this.recs.length || (this.best && this.best.score >= score) || (this.pending && this.pending.score >= score)) return;
    // The recorder that has been running the longest has the most lead-up.
    const r = this.recs.filter((x) => x.rec && x.rec.state === 'recording').sort((a, b) => a.startedAt - b.startedAt)[0];
    if (!r) return;
    const cap = { score, label };
    this.pending = cap;
    r.capture = cap;
    clearTimeout(r.timer);
    r.timer = setTimeout(() => { if (r.rec && r.rec.state === 'recording') r.rec.stop(); }, AFTER);
  }

  keep(cap, blob) {
    if (this.pending === cap) this.pending = null;
    if (this.best && this.best.score >= cap.score) return;
    if (this.best && this.best.url) URL.revokeObjectURL(this.best.url);
    this.best = { ...cap, blob, url: URL.createObjectURL(blob), ext: this.type.includes('mp4') ? 'mp4' : 'webm' };
    if (this.onChange) this.onChange();
  }
}

export const highlights = new Highlights();

// How big a kill was, from its medals (medals.js tiers), plus a label for the clip.
export function momentOf(ids, MEDALS, dist) {
  let score = 1, top = null;
  for (const id of ids) {
    const m = MEDALS[id];
    if (!m) continue;
    score += m.tier * m.tier;
    if (!top || m.tier > MEDALS[top].tier) top = id;
  }
  const label = top ? MEDALS[top].title + (top === 'longshot' ? ` · ${Math.round(dist)} m` : '') : 'KILL';
  return { score, label };
}
