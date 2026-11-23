// Things you can do, shown where they are: a small round bubble floats over each person, dog, car or shop tout near
// the child (💬 talk, ! needs help, 🍪 feed, 🚗 drive, ₹ a shop calling you in). Tap one and the child walks over and does
// it. When someone answers, their words show in a speech bubble over their head instead of in a box at the bottom.
// Also the little "+15 ⭐" that floats up when you earn points.
import * as THREE from 'three';

export interface Thing { key: string; x: number; z: number; y: number; icon: string; label: string; act: () => void }

export class Bubbles {
  private root = document.createElement('div');
  private pool = new Map<string, HTMLButtonElement>();
  private things: Thing[] = [];
  private speech: { el: HTMLDivElement; x: number; y: number; z: number; until: number }[] = [];
  private v = new THREE.Vector3();
  enabled = true;
  /** A bubble was tapped (for the first-minute guide). */
  onTap: (t: Thing) => void = () => {};

  constructor() {
    this.root.id = 'bubbles';
    this.root.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:4';
    document.body.appendChild(this.root);
  }

  /** The things near the child right now (refreshed a few times a second). */
  set(list: Thing[]) { this.things = list; }

  /** Someone says something: a speech bubble over (x, y, z) for `secs`. */
  speak(x: number, y: number, z: number, text: string, secs = 6) {
    for (const s of this.speech) s.el.remove();
    const el = document.createElement('div');
    el.className = 'speech'; el.innerHTML = '<b aria-label="Close">✕</b>'; el.append(text);
    el.addEventListener('click', e => { e.stopPropagation(); el.remove(); this.speech = this.speech.filter(s => s.el !== el); });
    this.root.appendChild(el);
    this.speech = [{ el, x, y, z, until: performance.now() + secs * 1000 }];
  }

  /** "+15 ⭐" floating up from a point on the screen. */
  pop(text: string, sx: number, sy: number) {
    const el = document.createElement('div'); el.className = 'pop'; el.textContent = text;
    el.style.left = `${sx}px`; el.style.top = `${sy}px`; this.root.appendChild(el);
    setTimeout(() => el.remove(), 1400);
  }

  /** Each frame: place the bubbles over their things. */
  update(camera: THREE.Camera) {
    const W = innerWidth, H = innerHeight, seen = new Set<string>();
    if (this.enabled) for (const t of this.things) {
      this.v.set(t.x, t.y, t.z).project(camera);
      if (this.v.z > 1 || Math.abs(this.v.x) > 1.05 || Math.abs(this.v.y) > 1.05) continue;
      let b = this.pool.get(t.key);
      if (!b) {
        b = document.createElement('button'); b.className = 'bub';
        b.addEventListener('click', e => { e.stopPropagation(); const th = this.things.find(q => q.key === b!.dataset.k); if (th) { this.onTap(th); th.act(); } });
        this.root.appendChild(b); this.pool.set(t.key, b);
      }
      b.dataset.k = t.key;
      if (b.dataset.i !== t.icon) { b.dataset.i = t.icon; b.innerHTML = `<i>${t.icon}</i><span>${t.label}</span>`; b.classList.toggle('help', t.icon === '!'); }
      b.style.transform = `translate(${(this.v.x * 0.5 + 0.5) * W}px, ${(-this.v.y * 0.5 + 0.5) * H}px) translate(-50%, -100%)`;
      b.style.display = ''; seen.add(t.key);
    }
    for (const [k, b] of this.pool) if (!seen.has(k)) b.style.display = 'none';
    const now = performance.now();
    this.speech = this.speech.filter(s => { if (now > s.until) { s.el.remove(); return false; } return true; });
    for (const s of this.speech) {
      this.v.set(s.x, s.y, s.z).project(camera);
      const off = this.v.z > 1;
      s.el.style.display = off ? 'none' : '';
      s.el.style.transform = `translate(${(this.v.x * 0.5 + 0.5) * W}px, ${(-this.v.y * 0.5 + 0.5) * H}px) translate(-50%, -100%)`;
    }
  }
}
