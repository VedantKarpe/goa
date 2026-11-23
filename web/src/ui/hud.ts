// The on-screen readouts: points, the time, the current task, what people say (the whisper box),
// the nearest named place, and a small performance line.
import type * as THREE from 'three';

export class Hud {
  private stats = document.getElementById('stats')!;
  private place = document.getElementById('place')!;
  private obj = document.getElementById('objective')!;
  private say = document.getElementById('say')!;
  private perf = document.getElementById('perf')!;
  private frames = 0; private acc = 0; private fps = 0; private worst = 0;
  private sayT = 0;

  /** Show a line of speech or story for a few seconds. */
  whisper(text: string, secs = 5, keep = false) {
    if (this.lockT > 0 && !keep) return;   // a story line stays up until it has been read
    this.say.textContent = text; this.say.style.opacity = '1'; this.sayT = secs; if (keep) this.lockT = Math.min(secs, 8);
  }
  private lockT = 0;

  update(dt: number, renderer: THREE.WebGLRenderer, s: { points: number; time: string; placeName: string; objective: string; riding: boolean; hint: string }) {
    this.frames++; this.acc += dt; this.worst = Math.max(this.worst, dt);
    if (this.acc >= 0.5) {
      this.fps = Math.round(this.frames / this.acc);
      const i = renderer.info.render;
      this.perf.textContent = `${this.fps} fps · worst ${Math.round(this.worst * 1000)} ms · ${i.calls} draws`;
      this.frames = 0; this.acc = 0; this.worst = 0;
    }
    const html = `<div><b>${s.points}</b> points · ${s.time}${s.riding ? ' · <em>riding</em>' : ''}</div>`;
    if (this.stats.innerHTML !== html) this.stats.innerHTML = html;
    if (this.place.textContent !== s.placeName) { this.place.textContent = s.placeName; this.place.style.display = s.placeName ? '' : 'none'; }
    const o = s.objective + (s.hint ? ` — ${s.hint}` : '');
    if (this.obj.textContent !== o) this.obj.textContent = o;
    this.lockT -= dt;
    if (this.sayT > 0) { this.sayT -= dt; if (this.sayT <= 0) this.say.style.opacity = '0'; }
  }
}
