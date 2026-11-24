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
  /** A finger or the mouse is moving the big map. */
  private dragging = false;
  /** The big map is moving: draw it every frame. */
  get busy() { return this.big && (this.dragging || (!!this.view && !!this.zoom && Math.abs(this.view.span - this.zoom.span) + Math.abs(this.view.x - this.zoom.x) + Math.abs(this.view.y - this.zoom.y) > 0.05)); }

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
    let lastTouch = 0, dragged = false;
    const ptrs = new Map<number, { x: number; y: number }>(); let pinch = 0;
    const here = () => { if (!this.view || !this.zoom) { const f = { x: this.d.W / 2, y: this.d.H / 2, span: this.full() }; this.view = { ...f }; this.zoom = { ...f }; } return this.zoom; };
    const setTo = (x: number, y: number, span: number) => { const s = Math.max(8, Math.min(this.full() * 1.2, span)); this.zoom = { x, y, span: s }; this.view = { x, y, span: s }; };
    this.cv.addEventListener('pointerdown', e => { if (!this.big) return; this.cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); dragged = false; this.dragging = true; if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); } });
    this.cv.addEventListener('pointermove', e => {
      if (!this.big || !ptrs.has(e.pointerId)) return;
      const prev = ptrs.get(e.pointerId)!, z = here(), k = (this.cv.clientWidth || 1) / z.span;
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size === 2) {   // pinch: zoom by how far the fingers moved apart
        const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch > 0 && d > 0) setTo(z.x, z.y, z.span * pinch / d); pinch = d; dragged = true; return;
      }
      const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
      if (Math.abs(dx) + Math.abs(dy) > 0.5) { setTo(z.x - dx / k, z.y - dy / k, z.span); if (Math.hypot(e.clientX - prev.x, e.clientY - prev.y) > 0) dragged = dragged || Math.abs(dx) + Math.abs(dy) > 3; }
    });
    const lift = (e: PointerEvent) => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = 0; if (!ptrs.size) this.dragging = false; };
    this.cv.addEventListener('pointercancel', lift);
    this.cv.addEventListener('wheel', e => { if (!this.big) return; e.preventDefault(); const z = here(); setTo(z.x, z.y, z.span * (e.deltaY > 0 ? 1.2 : 1 / 1.2)); }, { passive: false });
    this.cv.addEventListener('pointerup', e => {
      lift(e);
      if (dragged) { dragged = false; lastTouch = performance.now(); return; }   // that was a drag, not a tap
      if (e.pointerType === 'mouse') return; lastTouch = performance.now(); e.preventDefault(); this.cv.dispatchEvent(new MouseEvent('click', { clientX: e.clientX, clientY: e.clientY })); lastTouch = performance.now();
    });
    this.cv.addEventListener('click', e => {
      if (e.isTrusted && performance.now() - lastTouch < 600) return;   // the browser's own click after a touch (or a drag) we already handled
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
        if (this.stayOpen) return;                                      // in What's on, only its ✕ closes the map
      }
      this.big = !this.big; this.cv.classList.toggle('big', this.big); this.zoom = this.view = null; this.picked = null;
      if (this.big) this.onOpen(); else this.onClose();
      if (!this.big) this.onPick(null);
    });
  }

  private full() { const W = this.cv.clientWidth || 1, H = this.cv.clientHeight || 1; return Math.max(this.d.W, this.d.H * W / H); }
  private zoomTo(x: number, y: number, span: number) { if (!this.view) this.view = { x: this.d.W / 2, y: this.d.H / 2, span: this.full() }; this.zoom = { x, y, span }; }
  /** Back out to the whole map. */
  unzoom() { this.picked = null; if (this.view) this.zoom = { x: this.d.W / 2, y: this.d.H / 2, span: this.full() }; }
  /** Shut the big map. */
  close() { const was = this.big; this.big = false; this.cv.classList.remove('big'); this.zoom = this.view = null; this.picked = null; this.onPick(null); if (was) this.onClose(); }
  /** The big map opened (from a tap on the minimap) / closed. */
  onOpen: () => void = () => {};
  /** The town the child is in (drawn on the big map's corner), and how far around them the town is loaded (metres). */
  town = ''; loadedR = 0;
  /** Things to do, as icons on the big map (the jet ski, stuck cars on the beach, the churches...). */
  activities: { x: number; z: number; icon: string; name: string }[] = [];
  /** While What's on is open, a tap on empty map does not close it. */
  stayOpen = false;
  onClose: () => void = () => {};
  /** Open the big map (if shut) and glide to a spot in world metres. */
  focus(x: number, z: number, span = 30) { if (!this.big) { this.big = true; this.cv.classList.add('big'); } this.picked = null; this.zoomTo(x / T, z / T, span); }
  /** Open the big map showing everything (the whole map). */
  open() { if (!this.big) { this.big = true; this.cv.classList.add('big'); } this.zoom = this.view = null; this.picked = null; }
  get isBig() { return this.big; }
  /** Open the big map zoomed to fit everything that is on (the What's on button). */
  openEvents() {
    if (!this.events.length) return false;
    if (!this.big) { this.big = true; this.cv.classList.add('big'); }
    const xs = this.events.map(e => e.x / T), ys = this.events.map(e => e.z / T);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const W = this.cv.clientWidth || 1, H = this.cv.clientHeight || 1;
    this.picked = null; this.zoomTo((x0 + x1) / 2, (y0 + y1) / 2, Math.max(40, (x1 - x0) * 1.5, (y1 - y0) * 1.5 * W / H));
    return true;
  }
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
      if (Math.abs(v.span - span) < 0.5 && Math.abs(z.span - span) < 0.5 && Math.abs(z.x - fx) < 0.5 && Math.abs(z.y - fy) < 0.5 && Math.abs(v.x - fx) < 0.5 && Math.abs(v.y - fy) < 0.5) this.view = this.zoom = null; else { span = v.span; fx = v.x; fy = v.y; }
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
      const e = h.ev[0], ad = h.ev.every(q => q.type === 'ad'), story = h.ev.every(q => q.type === 'story'), biz = h.ev.every(q => q.type === 'business'), R = this.big ? 9 : 3.5, sel = h.ev.includes(this.picked!);
      if (this.big && e.on && !ad && !story && !biz) { c.fillStyle = 'rgba(255,95,162,.25)'; c.beginPath(); c.arc(h.x, h.y, R + 5 + Math.sin(performance.now() / 250) * 2, 0, Math.PI * 2); c.fill(); }
      c.fillStyle = biz ? '#ff9a3d' : ad ? '#f2c230' : story ? '#5fd8c8' : '#ff5fa2'; c.beginPath(); c.arc(h.x, h.y, sel ? R + 3 : R, 0, Math.PI * 2); c.fill();
      c.strokeStyle = sel ? '#fff' : '#0a1020'; c.lineWidth = 2; c.stroke();
      if (!this.big) continue;
      c.fillStyle = '#0a1020'; c.font = '700 11px Mukta, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(h.ev.length > 1 ? String(h.ev.length) : biz ? '🏪' : ad ? '₹' : story ? '✎' : '★', h.x, h.y + 0.5);
      c.textBaseline = 'alphabetic';
      if (k > 3 || h.ev.length === 1) {   // a label once zoomed in (or a lone pin)
        const t = h.ev.length > 1 ? `${h.ev.length} things on here` : e.title.length > 34 ? e.title.slice(0, 32) + '…' : e.title;
        c.font = '700 12px Mukta, sans-serif'; const w = c.measureText(t).width + 10;
        c.fillStyle = 'rgba(10,16,32,.85)'; c.fillRect(h.x - w / 2, h.y - R - 22, w, 17); c.fillStyle = biz ? '#ffc79a' : ad ? '#f2c230' : story ? '#a8f0e6' : '#ffb0d0'; c.fillText(t, h.x, h.y - R - 9);
      }
    }
    for (const p of pins) {
      const x = ox + (p.x / T) * k, y = oy + (p.z / T) * k;
      c.fillStyle = '#f2b441'; c.beginPath(); c.arc(x, y, 4, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#0a1020'; c.lineWidth = 1.5; c.stroke();
    }
    // the area loaded around the child (what is drawn in detail), and the town's name
    if (this.big && this.loadedR > 0) {
      c.save(); c.setLineDash([6, 5]); c.strokeStyle = 'rgba(159,232,214,.75)'; c.lineWidth = 2;
      c.beginPath(); c.arc(ox + (cx / T) * k, oy + (cz / T) * k, this.loadedR / T * k, 0, Math.PI * 2); c.stroke(); c.restore();
    }
    if (this.big) {
      c.textAlign = 'center'; c.textBaseline = 'middle';
      for (const a of this.activities) {
        const x = ox + (a.x / T) * k, y = oy + (a.z / T) * k; if (x < -20 || y < -20 || x > W + 20 || y > H + 20) continue;
        c.fillStyle = 'rgba(255,248,232,.92)'; c.beginPath(); c.arc(x, y, 13, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#0a1020'; c.lineWidth = 1.5; c.stroke();
        c.font = '15px sans-serif'; c.fillStyle = '#000'; c.fillText(a.icon, x, y + 1);
        if (k > 1.2) { c.font = '700 11px Mukta, sans-serif'; c.fillStyle = '#fff4d8'; c.strokeStyle = 'rgba(10,16,32,.85)'; c.lineWidth = 3; c.strokeText(a.name, x, y + 22); c.fillText(a.name, x, y + 22); }
      }
      c.textBaseline = 'alphabetic';
    }
    if (this.big && this.town) { c.font = '700 16px Mukta, sans-serif'; const w = c.measureText(this.town).width; c.fillStyle = 'rgba(10,16,32,.8)'; c.fillRect(10, 10, w + 18, 26); c.fillStyle = '#f2c230'; c.textAlign = 'left'; c.fillText(this.town, 19, 29); }
    // the child, and which way the view looks (the camera looks along -(cos yaw, sin yaw))
    const x = ox + (cx / T) * k, y = oy + (cz / T) * k, a = Math.atan2(-Math.sin(yaw), -Math.cos(yaw));
    c.fillStyle = 'rgba(242,180,65,.3)'; c.beginPath(); c.moveTo(x, y); c.arc(x, y, 22, a - 0.5, a + 0.5); c.fill();
    c.fillStyle = '#f2c230'; c.beginPath(); c.arc(x, y, 4, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#0a1020'; c.stroke();
  }
}
