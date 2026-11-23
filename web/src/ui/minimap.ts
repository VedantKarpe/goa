// The minimap, always north-up: the map's tiles, the streets, fog over what the child has not yet seen, pins for the
// current task, and a cone showing which way the view faces. Tap it to open the full map of Panjim.
import { T, pts, type PanjimData } from '../world/data';
import type { Spot } from '../systems/quests';
import type { GoaEvent } from './events';

const COL: Record<string, string> = { G: '#5c7a40', F: '#3d6b38', M: '#2a4a30', W: '#2b6a8a', R: '#8a8478', L: '#9a9284', P: '#8aa050', S: '#d8c690', B: '#d8c690' };

export class Minimap {
  private base: HTMLCanvasElement;
  private fog: Uint8Array;
  private fogImg: ImageData;
  private fogCan: HTMLCanvasElement;
  private cv: HTMLCanvasElement;
  private big = false;
  private dirty = true;
  /** What's on: event and ad pins (shown on the big map, and as small marks on the minimap). */
  events: GoaEvent[] = [];
  /** A pin was picked on the big map (null: zoomed back out). */
  onPick: (e: GoaEvent | null) => void = () => {};
  // the big map's zoom: centre (tiles) and how many tiles across; `zoom` is where it is heading, `view` where it is now
  private zoom: { x: number; y: number; span: number } | null = null;
  private view: { x: number; y: number; span: number } | null = null;
  private hits: { x: number; y: number; ev: GoaEvent[] }[] = [];
  private picked: GoaEvent | null = null;
  /** The big map is moving: draw it every frame. */
  get busy() { return this.big && !!this.view && !!this.zoom && Math.abs(this.view.span - this.zoom.span) + Math.abs(this.view.x - this.zoom.x) + Math.abs(this.view.y - this.zoom.y) > 0.05; }

  constructor(private d: PanjimData) {
    const S = 4; // pixels a tile on the base image
    this.base = document.createElement('canvas'); this.base.width = d.W * S; this.base.height = d.H * S;
    const c = this.base.getContext('2d')!;
    for (let y = 0; y < d.H; y++) for (let x = 0; x < d.W; x++) { c.fillStyle = COL[d.rows[y][x]] ?? '#5c7a40'; c.fillRect(x * S, y * S, S, S); }
    c.fillStyle = '#2b6a8a'; for (const f of d.water) { c.beginPath(); pts(f).forEach(([x, y], i) => i ? c.lineTo(x * S, y * S) : c.moveTo(x * S, y * S)); c.fill(); }
    c.fillStyle = '#c9b89a'; for (const [f] of d.b) { c.beginPath(); pts(f).forEach(([x, y], i) => i ? c.lineTo(x * S, y * S) : c.moveTo(x * S, y * S)); c.fill(); }
    c.strokeStyle = '#ece4cf'; c.lineCap = 'round';
    for (const [f, w] of d.r) { c.lineWidth = Math.max(1, w * 1.5 / T * S); c.beginPath(); pts(f).forEach(([x, y], i) => i ? c.lineTo(x * S, y * S) : c.moveTo(x * S, y * S)); c.stroke(); }
    this.fog = new Uint8Array(d.W * d.H);
    this.fogCan = document.createElement('canvas'); this.fogCan.width = d.W; this.fogCan.height = d.H;
    this.fogImg = this.fogCan.getContext('2d')!.createImageData(d.W, d.H);
    this.cv = document.getElementById('map') as HTMLCanvasElement;
    this.cv.addEventListener('click', e => {
      if (this.big) {
        const r = this.cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
        let hit: typeof this.hits[0] | null = null, bd = 22;
        for (const h of this.hits) { const dd = Math.hypot(h.x - mx, h.y - my); if (dd < bd) { bd = dd; hit = h; } }
        if (hit) {   // a pin: zoom into it (a cluster: zoom in until it splits)
          const f = hit.ev[0], sp = this.zoom?.span ?? this.full();
          if (hit.ev.length > 1 && sp > 25) { this.zoomTo(f.x / T, f.z / T, Math.max(22, sp / 3)); return; }
          const pick = hit.ev.length > 1 ? hit.ev[(hit.ev.indexOf(this.picked!) + 1) % hit.ev.length] : f;
          this.picked = pick; this.zoomTo(pick.x / T, pick.z / T, 22); this.onPick(pick); return;
        }
        if (this.zoom) { this.unzoom(); this.onPick(null); return; }   // off the pins while zoomed: back out
      }
      this.big = !this.big; this.cv.classList.toggle('big', this.big); this.zoom = this.view = null; this.picked = null;
      if (!this.big) this.onPick(null);
    });
  }

  private full() { const W = this.cv.clientWidth || 1, H = this.cv.clientHeight || 1; return Math.max(this.d.W, this.d.H * W / H); }
  private zoomTo(x: number, y: number, span: number) { if (!this.view) this.view = { x: this.d.W / 2, y: this.d.H / 2, span: this.full() }; this.zoom = { x, y, span }; }
  /** Back out to the whole map. */
  unzoom() { this.picked = null; if (this.view) this.zoom = { x: this.d.W / 2, y: this.d.H / 2, span: this.full() }; }
  /** Shut the big map. */
  close() { this.big = false; this.cv.classList.remove('big'); this.zoom = this.view = null; this.picked = null; }
  /** Open the big map on a pin (from outside, e.g. a button). */
  openOn(e: GoaEvent) { if (!this.big) { this.big = true; this.cv.classList.add('big'); } this.picked = e; this.zoomTo(e.x / T, e.z / T, 22); }

  /** Clear the fog for `r` tiles around the child. */
  reveal(cx: number, cz: number, r: number) {
    const tx = Math.floor(cx / T), ty = Math.floor(cz / T);
    for (let y = ty - r; y <= ty + r; y++) for (let x = tx - r; x <= tx + r; x++) {
      if (x < 0 || y < 0 || x >= this.d.W || y >= this.d.H || (x - tx) ** 2 + (y - ty) ** 2 > r * r) continue;
      const i = y * this.d.W + x; if (!this.fog[i]) { this.fog[i] = 1; this.dirty = true; }
    }
  }

  draw(cx: number, cz: number, yaw: number, pins: Spot[], night: boolean) {
    if (this.dirty) {
      const a = this.fogImg.data;
      for (let i = 0; i < this.fog.length; i++) { a[i * 4] = 8; a[i * 4 + 1] = 12; a[i * 4 + 2] = 24; a[i * 4 + 3] = this.fog[i] ? 0 : 235; }
      this.fogCan.getContext('2d')!.putImageData(this.fogImg, 0, 0); this.dirty = false;
    }
    const cv = this.cv, W = cv.clientWidth, H = cv.clientHeight;
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const c = cv.getContext('2d')!;
    // small: 30 tiles across around the child; big: the whole of Panjim
    let span = this.big ? Math.max(this.d.W, this.d.H * W / H) : 30, fx = this.d.W / 2, fy = this.d.H / 2;
    if (this.big && this.view && this.zoom) {   // ease towards the zoom
      const v = this.view, z = this.zoom, a = 0.18; v.x += (z.x - v.x) * a; v.y += (z.y - v.y) * a; v.span += (z.span - v.span) * a;
      if (Math.abs(v.span - span) < 0.5 && Math.abs(z.span - span) < 0.5) this.view = this.zoom = null; else { span = v.span; fx = v.x; fy = v.y; }
    }
    const k = W / span;
    const ox = this.big ? W / 2 - fx * k : W / 2 - (cx / T) * k, oy = this.big ? H / 2 - fy * k : H / 2 - (cz / T) * k;
    c.fillStyle = '#0a1020'; c.fillRect(0, 0, W, H);
    c.imageSmoothingEnabled = !this.big || k < 6;
    c.drawImage(this.base, ox, oy, this.d.W * k, this.d.H * k);
    if (night) { c.fillStyle = 'rgba(10,16,40,.45)'; c.fillRect(0, 0, W, H); }
    c.imageSmoothingEnabled = true;
    c.drawImage(this.fogCan, ox, oy, this.d.W * k, this.d.H * k);
    // shops, once that part of the city is seen: small dots, and the famous places to eat as gold ones
    for (const [, , x, y, f] of this.d.shops ?? []) {
      if (!this.fog[Math.floor(y) * this.d.W + Math.floor(x)]) continue;
      c.fillStyle = f ? '#f2c230' : '#e8d8c0'; c.beginPath(); c.arc(ox + x * k, oy + y * k, f ? 3 : 1.6, 0, Math.PI * 2); c.fill();
    }
    if (this.big) {
      c.font = '600 11px Mukta, sans-serif'; c.fillStyle = '#ece4cf'; c.textAlign = 'center';
      for (const [n, x, y] of this.d.places) if (this.fog[Math.floor(y) * this.d.W + Math.floor(x)]) c.fillText(n, ox + x * k, oy + y * k);
    }
    // what's on: pins grouped when they sit close together on screen
    this.hits = [];
    for (const e of this.events) {
      const x = ox + (e.x / T) * k, y = oy + (e.z / T) * k, h = this.hits.find(q => Math.hypot(q.x - x, q.y - y) < (this.big ? 18 : 6));
      if (h) h.ev.push(e); else this.hits.push({ x, y, ev: [e] });
    }
    for (const h of this.hits) {
      const e = h.ev[0], ad = h.ev.every(q => q.type === 'ad'), R = this.big ? 9 : 3.5, sel = h.ev.includes(this.picked!);
      if (this.big && e.on && !ad) { c.fillStyle = 'rgba(255,95,162,.25)'; c.beginPath(); c.arc(h.x, h.y, R + 5 + Math.sin(performance.now() / 250) * 2, 0, Math.PI * 2); c.fill(); }
      c.fillStyle = ad ? '#f2c230' : '#ff5fa2'; c.beginPath(); c.arc(h.x, h.y, sel ? R + 3 : R, 0, Math.PI * 2); c.fill();
      c.strokeStyle = sel ? '#fff' : '#0a1020'; c.lineWidth = 2; c.stroke();
      if (!this.big) continue;
      c.fillStyle = '#0a1020'; c.font = '700 11px Mukta, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(h.ev.length > 1 ? String(h.ev.length) : ad ? '₹' : '★', h.x, h.y + 0.5);
      c.textBaseline = 'alphabetic';
      if (k > 3 || h.ev.length === 1) {   // a label once zoomed in (or a lone pin)
        const t = h.ev.length > 1 ? `${h.ev.length} things on here` : e.title.length > 34 ? e.title.slice(0, 32) + '…' : e.title;
        c.font = '700 12px Mukta, sans-serif'; const w = c.measureText(t).width + 10;
        c.fillStyle = 'rgba(10,16,32,.85)'; c.fillRect(h.x - w / 2, h.y - R - 22, w, 17); c.fillStyle = ad ? '#f2c230' : '#ffb0d0'; c.fillText(t, h.x, h.y - R - 9);
      }
    }
    for (const p of pins) {
      const x = ox + (p.x / T) * k, y = oy + (p.z / T) * k;
      c.fillStyle = '#f2b441'; c.beginPath(); c.arc(x, y, 4, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#0a1020'; c.lineWidth = 1.5; c.stroke();
    }
    // the child, and which way the view looks (the camera looks along -(cos yaw, sin yaw))
    const x = ox + (cx / T) * k, y = oy + (cz / T) * k, a = Math.atan2(-Math.sin(yaw), -Math.cos(yaw));
    c.fillStyle = 'rgba(242,180,65,.3)'; c.beginPath(); c.moveTo(x, y); c.arc(x, y, 22, a - 0.5, a + 0.5); c.fill();
    c.fillStyle = '#f2c230'; c.beginPath(); c.arc(x, y, 4, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#0a1020'; c.stroke();
  }
}
