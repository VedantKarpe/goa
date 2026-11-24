// The game's music: an original, gentle Goan-style tune, played live in the browser (nothing downloaded). A slow
// waltz in 3/4 like a mando, on a plucked guitar (Karplus-Strong strings) with a soft bass: the bass on the first beat,
// the chord strummed on two and three, and a lilting melody over it, made fresh from the chord's notes each time round.
// Quiet, under everything else. The 🎵 button turns it on or off (remembered on this device).
import { audio } from './sfx';

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
// G major: I - V - IV - I - vi - IV - V - I (a sunny, swaying progression)
const PROG: number[][] = [[55, 59, 62], [50, 54, 57], [48, 52, 55], [55, 59, 62], [52, 55, 59], [48, 52, 55], [50, 54, 57], [55, 59, 62]];

export class Music {
  on = (() => { try { return localStorage.getItem('vg_music') !== 'off'; } catch { return true; } })();
  private out: GainNode | null = null;
  private next = 0;          // when the next bar starts (audio clock)
  private bar = 0;
  private strings = new Map<number, AudioBuffer>();
  private readonly beat = 0.5;   // 120 beats a minute: a bar of three is 1.5 s

  toggle() { this.on = !this.on; try { localStorage.setItem('vg_music', this.on ? 'on' : 'off'); } catch { /* private */ } const a = audio(); if (a && this.out) this.out.gain.setTargetAtTime(this.on ? 0.22 : 0, a.ctx.currentTime, 0.4); }

  /** A plucked string: a burst of noise ringing in a short delay line (Karplus-Strong), rendered once per note. */
  private pluck(ctx: AudioContext, note: number): AudioBuffer {
    const hit = this.strings.get(note); if (hit) return hit;
    const sr = ctx.sampleRate, n = Math.floor(sr * 1.6), b = ctx.createBuffer(1, n, sr), d = b.getChannelData(0), P = Math.max(2, Math.round(sr / midi(note)));
    const buf = new Float32Array(P); for (let i = 0; i < P; i++) buf[i] = Math.random() * 2 - 1;
    for (let i = 0, k = 0; i < n; i++, k = (k + 1) % P) { const nx = (k + 1) % P, v = (buf[k] + buf[nx]) * 0.5 * 0.996; d[i] = buf[k]; buf[k] = v; }
    this.strings.set(note, b); return b;
  }

  private play(ctx: AudioContext, note: number, at: number, vol: number) {
    const s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = this.pluck(ctx, note); g.gain.value = vol;
    s.connect(g).connect(this.out!); s.start(at);
  }

  /** Each frame: keep a couple of bars scheduled ahead on the audio clock. */
  update() {
    const a = audio(); if (!a) return;
    const { ctx } = a;
    if (!this.out) { this.out = ctx.createGain(); this.out.gain.value = this.on ? 0.22 : 0; this.out.connect(a.out); this.next = ctx.currentTime + 0.3; }
    if (!this.on) { this.next = Math.max(this.next, ctx.currentTime + 0.3); return; }
    while (this.next < ctx.currentTime + 3) {
      const ch = PROG[this.bar % PROG.length], t = this.next, B = this.beat;
      this.play(ctx, ch[0] - 12, t, 0.5);                                            // the bass on one
      for (const k of [1, 2]) ch.forEach((nt, i) => this.play(ctx, nt + 12, t + k * B + i * 0.018, 0.16));   // the chord strummed on two and three
      // the melody: a note on each beat from the chord (or a step from it), with a little run every other bar
      const scale = [67, 69, 71, 72, 74, 76, 78, 79], tone = (ch[(this.bar * 2) % 3] % 12) + 72;
      const pick = (o: number) => scale.reduce((p, q) => Math.abs(q - (tone + o)) < Math.abs(p - (tone + o)) ? q : p);
      this.play(ctx, pick(0), t, 0.3); this.play(ctx, pick(this.bar % 2 ? 2 : -1), t + B * 1.5, 0.22);
      if (this.bar % 2) this.play(ctx, pick(4), t + B * 2.5, 0.2);
      this.next += 3 * B; this.bar++;
    }
  }
}
