// Match highlights: a small copy of the game view (640×360, 20 fps) is recorded in short segments
// by ONE recorder, so when something big happens (multi-kill, longshot, streak…) the current
// segment, ending a moment later, becomes the clip. The best moment of the match shows on the
// results screen to watch, download or share. Video only (the HUD isn't part of the 3D canvas).
// Kept cheap on purpose: full-size recording with two encoders made matches lag.

const SEG = 9000;       // the recorder restarts every 9 s while nothing is happening
const AFTER = 1500;     // keep recording this long after the moment
const W = 640, H = 360, FPS = 20;

function pickType() {
  if (typeof MediaRecorder === 'undefined') return null;
  // VP8 first: much lighter to encode than VP9.
  for (const t of ['video/webm;codecs=vp8', 'video/webm', 'video/mp4']) if (MediaRecorder.isTypeSupported(t)) return t;
  return null;
}

class Highlights {
  constructor() {
    this.type = pickType();
    this.best = null; // { score, label, url, blob, ext }
    this.onChange = null;
    this.rec = null;
    this.on = false;
  }

  get supported() { return !!this.type && typeof HTMLCanvasElement !== 'undefined' && !!HTMLCanvasElement.prototype.captureStream; }

  start(source) {
    if (!this.supported || this.on) return;
    this.source = source;
    this.copy = document.createElement('canvas');
    this.copy.width = W; this.copy.height = H;
    this.ctx = this.copy.getContext('2d', { alpha: false });
    try { this.stream = this.copy.captureStream(0); } catch { return; }
    this.track = this.stream.getVideoTracks()[0];
    this.on = true;
    this.lastCopy = 0;
    this.begin();
    this.onVis = () => { if (document.hidden) this.pauseRec(); else if (this.on && !this.rec) this.begin(); };
    document.addEventListener('visibilitychange', this.onVis);
  }

  // Called by the game right after it renders a frame: copies the view into the small canvas.
  frame(now) {
    if (!this.on || !this.rec || now - this.lastCopy < 1000 / FPS) return;
    this.lastCopy = now;
    const s = this.source, sw = s.width, sh = s.height;
    // Center crop to 16:9 so the clip isn't squashed.
    const want = sw / sh > W / H ? [sh * (W / H), sh] : [sw, sw * (H / W)];
    try {
      this.ctx.drawImage(s, (sw - want[0]) / 2, (sh - want[1]) / 2, want[0], want[1], 0, 0, W, H);
      if (this.track && this.track.requestFrame) this.track.requestFrame();
    } catch { /* ignore */ }
  }

  begin() {
    clearTimeout(this.timer);
    if (!this.on || document.hidden) return;
    const chunks = [];
    let rec;
    try { rec = new MediaRecorder(this.stream, { mimeType: this.type, videoBitsPerSecond: 1200000 }); } catch { this.on = false; return; }
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = () => {
      const cap = rec.capture;
      if (cap && this.pending === cap) this.pending = null; // even if nothing was recorded
      if (cap && chunks.length) this.keep(cap, new Blob(chunks, { type: this.type }));
      if (this.rec === rec) this.rec = null;
      if (this.on && !document.hidden) this.begin();
    };
    rec.start(1000);
    rec.startedAt = performance.now();
    this.rec = rec;
    this.timer = setTimeout(() => { if (!rec.capture && rec.state === 'recording') rec.stop(); }, SEG);
  }

  pauseRec() {
    clearTimeout(this.timer);
    const r = this.rec;
    this.rec = null;
    if (r && r.state !== 'inactive') { r.capture = null; try { r.stop(); } catch { /* ignore */ } }
  }

  stop() {
    this.on = false;
    this.pauseRec();
    if (this.onVis) document.removeEventListener('visibilitychange', this.onVis);
    this.stream = null; this.track = null; this.copy = null; this.ctx = null;
  }

  // A new match: forget the last one's best moment.
  resetMatch() {
    if (this.best && this.best.url) URL.revokeObjectURL(this.best.url);
    this.best = null;
    if (this.onChange) this.onChange();
  }

  // Something worth keeping happened. score: how good (bigger = better); label: e.g. "TRIPLE KILL".
  moment(score, label) {
    const r = this.rec;
    if (!r || r.state !== 'recording' || (this.best && this.best.score >= score) || (this.pending && this.pending.score >= score)) return;
    const cap = { score, label };
    this.pending = cap;
    r.capture = cap;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => { if (r.state === 'recording') r.stop(); }, AFTER);
  }

  keep(cap, blob) {
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
