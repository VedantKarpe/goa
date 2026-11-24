// The sound of the place, all synthesised (no files to download): the sea rolling in near the water, birds by day (the
// koel's rising call, sparrows, the crows in town), the hum of traffic near the roads, crickets and frogs at night, and
// the church bells on the hour when there is a church nearby. Each layer fades with where the child is and the time.
import { audio } from './sfx';

export interface Where { sea: number; road: number; trees: number; church: number; night: number; minute: number }

export class Ambience {
  private on = false;
  private sea: GainNode | null = null;
  private seaLfo = 0;
  private hum: GainNode | null = null;
  private crick: GainNode | null = null;
  private birdT = 2; private crowT = 6; private frogT = 3;
  private lastHour = -1;
  private out: GainNode | null = null;

  /** Start the beds once the audio is unlocked (the first tap or key). */
  private start(): boolean {
    const a = audio(); if (!a) return false;
    if (this.on) return true;
    const { ctx } = a;
    this.out = ctx.createGain(); this.out.gain.value = 0.9; this.out.connect(a.out);
    const loopNoise = (secs: number, brown: boolean) => {
      const n = Math.floor(ctx.sampleRate * secs), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0); let last = 0;
      for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; d[i] = brown ? (last = (last + 0.02 * w) / 1.02) * 3.5 : w; }
      const s = ctx.createBufferSource(); s.buffer = b; s.loop = true; s.start(); return s;
    };
    // the sea: brown noise through a low-pass, swelling in and out like waves breaking
    const sf = ctx.createBiquadFilter(); sf.type = 'lowpass'; sf.frequency.value = 520;
    this.sea = ctx.createGain(); this.sea.gain.value = 0; loopNoise(6, true).connect(sf).connect(this.sea).connect(this.out);
    // the town's hum: very low rumble near the roads
    const hf = ctx.createBiquadFilter(); hf.type = 'lowpass'; hf.frequency.value = 180;
    this.hum = ctx.createGain(); this.hum.gain.value = 0; loopNoise(5, true).connect(hf).connect(this.hum).connect(this.out);
    // crickets: a high, pulsing chirr (amplitude-modulated tone)
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 4400;
    const am = ctx.createGain(); am.gain.value = 0; const lfo = ctx.createOscillator(); lfo.frequency.value = 28; const lg = ctx.createGain(); lg.gain.value = 0.5;
    lfo.connect(lg).connect(am.gain); o.connect(am); this.crick = ctx.createGain(); this.crick.gain.value = 0; am.connect(this.crick).connect(this.out); o.start(); lfo.start();
    this.on = true; return true;
  }

  private chirp(f0: number, f1: number, dur: number, vol: number, delay = 0, type: OscillatorType = 'sine') {
    const a = audio(); if (!a || !this.out) return;
    const { ctx } = a, t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.2); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.out); o.start(t); o.stop(t + dur + 0.05);
  }

  /** A church bell: a struck bell's partials, ringing out. */
  private bell(delay: number, vol: number) {
    const a = audio(); if (!a || !this.out) return;
    const { ctx } = a, t = ctx.currentTime + delay;
    for (const [m, v] of [[1, 1], [2.0, 0.5], [2.4, 0.35], [3.0, 0.25], [4.2, 0.15]] as [number, number][]) {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = 220 * m;
      g.gain.setValueAtTime(vol * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2 / Math.sqrt(m));
      o.connect(g).connect(this.out); o.start(t); o.stop(t + 3.5);
    }
  }

  /** Each frame: what is around the child (0 to 1 each) and the time of day. */
  update(dt: number, w: Where) {
    if (!this.start()) return;
    const a = audio()!, t = a.ctx.currentTime;
    this.seaLfo += dt;
    const swell = 0.55 + 0.45 * Math.sin(this.seaLfo * 0.9) * Math.sin(this.seaLfo * 0.37 + 1);
    this.sea!.gain.setTargetAtTime(w.sea * (0.08 + 0.1 * swell), t, 0.3);
    this.hum!.gain.setTargetAtTime(w.road * (1 - w.night * 0.6) * 0.05, t, 0.8);
    this.crick!.gain.setTargetAtTime(w.night * (0.3 + w.trees * 0.7) * 0.006, t, 1.5);
    // birds by day, near trees: the koel's rising "ku-oo", and quick sparrow chirps
    this.birdT -= dt;
    if (this.birdT <= 0) {
      this.birdT = 2.5 + Math.random() * 6;
      const day = 1 - w.night;
      if (day > 0.5 && w.trees > 0.15) {
        if (Math.random() < 0.35) { const f = 620 + Math.random() * 60; for (let k = 0; k < 3; k++) { this.chirp(f * (1 + k * 0.08), f * 1.45 * (1 + k * 0.08), 0.32, 0.035, k * 0.55); } }
        else for (let k = 0; k < 3 + Math.floor(Math.random() * 4); k++) this.chirp(3200 + Math.random() * 900, 4200 + Math.random() * 900, 0.07, 0.012, k * 0.12);
      }
    }
    // crows in town by day
    this.crowT -= dt;
    if (this.crowT <= 0) { this.crowT = 6 + Math.random() * 12; if (w.night < 0.5 && w.road > 0.3) for (let k = 0; k < 2; k++) this.chirp(520, 360, 0.28, 0.02, k * 0.4, 'sawtooth'); }
    // frogs at night near water
    this.frogT -= dt;
    if (this.frogT <= 0) { this.frogT = 1 + Math.random() * 3; if (w.night > 0.5 && w.sea > 0.1) for (let k = 0; k < 3; k++) this.chirp(180, 140, 0.12, 0.025, k * 0.18, 'square'); }
    // the church bells on the hour, from a church nearby
    const hour = Math.floor(w.minute / 60);
    if (hour !== this.lastHour) {
      if (this.lastHour >= 0 && w.church > 0.05 && hour >= 6 && hour <= 21) for (let k = 0; k < Math.min(6, hour % 12 || 12); k++) this.bell(k * 1.6, 0.05 * w.church);
      this.lastHour = hour;
    }
  }
}
