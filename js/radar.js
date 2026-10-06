import { boxes } from './maps.js';

// Rotating minimap. The map's walls are drawn once per map into an offscreen canvas (top-down),
// then each frame that image is rotated around the player so "forward" always points up.
const PX = 6; // offscreen pixels per meter

export class Radar {
  constructor(canvas) {
    this.c = canvas;
    this.x = canvas.getContext('2d');
    this.key = '';
    this.range = 26; // meters from the center to the edge
  }

  // Rebuild the wall layer when the map (or its box list) changes.
  layout(mapId, bounds) {
    const key = mapId + ':' + boxes.length;
    if (key === this.key) return;
    this.key = key;
    this.bounds = bounds;
    const size = Math.ceil(bounds * 2 * PX);
    const bg = this.bg || (this.bg = document.createElement('canvas'));
    bg.width = bg.height = size;
    const g = bg.getContext('2d');
    g.clearRect(0, 0, size, size);
    const tx = (v) => (v + bounds) * PX;
    // Floors and raised platforms first (faint), then walls and cover at body height (bright).
    const sorted = [...boxes].sort((a, b) => a.y1 - b.y1);
    for (const b of sorted) {
      const w = (b.x1 - b.x0) * PX, h = (b.z1 - b.z0) * PX;
      if (w <= 0 || h <= 0) continue;
      const solid = b.y1 > 0.9 && b.y0 < 2;
      if (b.y1 <= 0.05) g.fillStyle = 'rgba(255,255,255,0.05)';
      else if (b.y0 >= 2.5) continue; // roofs and overhead beams would hide the interiors
      else if (solid) g.fillStyle = 'rgba(214,224,236,0.62)';
      else g.fillStyle = `rgba(255,255,255,${Math.min(0.28, 0.1 + b.y1 * 0.06)})`;
      g.fillRect(tx(b.x0), tx(b.z0), w, h);
    }
  }

  // me: {x, z, yaw}; blips: [{x, z, color, a, kind}] (kind: 'ally' | 'enemy');
  // objs: [{x, z, r, color, label}]
  draw(me, blips, objs) {
    const c = this.c, x = this.x;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const css = c.clientWidth || 160;
    if (c.width !== Math.round(css * dpr)) c.width = c.height = Math.round(css * dpr);
    const S = c.width, R = S / 2, k = R / this.range; // screen px per meter
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.clearRect(0, 0, S, S);
    x.save();
    x.beginPath(); x.arc(R, R, R - 1, 0, Math.PI * 2); x.clip();
    x.fillStyle = 'rgba(8,11,16,0.72)';
    x.fillRect(0, 0, S, S);
    // Range rings.
    x.strokeStyle = 'rgba(255,255,255,0.07)'; x.lineWidth = 1;
    for (const f of [0.33, 0.66]) { x.beginPath(); x.arc(R, R, R * f, 0, Math.PI * 2); x.stroke(); }

    // World layer, rotated so the player's view direction points up.
    x.translate(R, R);
    x.rotate(me.yaw);
    if (this.bg) {
      const s = k / PX;
      x.drawImage(this.bg, (-this.bounds - me.x) * k, (-this.bounds - me.z) * k, this.bg.width * s, this.bg.height * s);
    }
    for (const o of objs) {
      const ox = (o.x - me.x) * k, oz = (o.z - me.z) * k;
      x.fillStyle = o.color + '33'; x.strokeStyle = o.color; x.lineWidth = 1.5 * (S / 160);
      x.beginPath(); x.arc(ox, oz, Math.max(4, o.r * k), 0, Math.PI * 2); x.fill(); x.stroke();
      if (o.label) {
        x.save(); x.translate(ox, oz); x.rotate(-me.yaw);
        x.fillStyle = '#fff'; x.font = `700 ${Math.round(S / 14)}px Chakra Petch, sans-serif`;
        x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(o.label, 0, 1);
        x.restore();
      }
    }
    const rr = Math.max(2.5, S / 50);
    for (const b of blips) {
      let bx = (b.x - me.x) * k, bz = (b.z - me.z) * k;
      const d = Math.hypot(bx, bz), edge = R - rr - 2;
      if (d > edge) { bx *= edge / d; bz *= edge / d; } // pin far blips to the rim
      x.globalAlpha = b.a ?? 1;
      x.fillStyle = b.color;
      x.beginPath();
      if (b.kind === 'enemy') { x.save(); x.translate(bx, bz); x.rotate(-me.yaw); x.rect(-rr, -rr, rr * 2, rr * 2); x.restore(); }
      else x.arc(bx, bz, rr, 0, Math.PI * 2);
      x.fill();
      x.lineWidth = 1; x.strokeStyle = 'rgba(0,0,0,0.7)'; x.stroke();
    }
    x.globalAlpha = 1;
    x.restore();

    // Player arrow + view cone (always pointing up).
    x.save();
    x.translate(R, R);
    const g = x.createRadialGradient(0, 0, 0, 0, 0, R * 0.55);
    g.addColorStop(0, 'rgba(255,176,32,0.28)'); g.addColorStop(1, 'rgba(255,176,32,0)');
    x.fillStyle = g;
    x.beginPath(); x.moveTo(0, 0); x.arc(0, 0, R * 0.55, -Math.PI / 2 - 0.55, -Math.PI / 2 + 0.55); x.closePath(); x.fill();
    const a = S / 26;
    x.fillStyle = '#ffb020'; x.strokeStyle = 'rgba(0,0,0,0.8)'; x.lineWidth = 1.5;
    x.beginPath(); x.moveTo(0, -a); x.lineTo(a * 0.75, a * 0.8); x.lineTo(0, a * 0.35); x.lineTo(-a * 0.75, a * 0.8); x.closePath();
    x.fill(); x.stroke();
    x.restore();

    // North marker on the rim (world -z).
    const n = -Math.PI / 2 + me.yaw;
    x.fillStyle = 'rgba(255,255,255,0.75)'; x.font = `700 ${Math.round(S / 13)}px Chakra Petch, sans-serif`;
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('N', R + Math.cos(n) * (R - S / 14), R + Math.sin(n) * (R - S / 14));
  }
}
