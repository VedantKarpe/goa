// The people of Panjim, each one someone (see cast.ts), living a day like real life: in the morning they walk from
// home to work along the real streets, they spend the day at work (the fish seller at the market, the priest at the
// church), and in the evening they walk home. At night most are indoors; only the night-shift people are out.
// Everyone is simulated all the time (cheaply), but only drawn when near the child.
import * as THREE from 'three';
import type { Network } from '../world/network';
import { T, type Ground, type PanjimData } from '../world/data';
import { CAST, type Cast } from './cast';

type Phase = 'home' | 'toWork' | 'work' | 'toHome' | 'stroll';
interface Person {
  c: Cast; said: number;
  home: number; work: number;                 // network nodes
  leave: number; back: number; night: boolean; // schedule (game minutes)
  phase: Phase; path: number[]; pi: number; s: number; v: number; side: number;
  x: number; z: number; hx: number; hz: number; t: number;
  obj: THREE.Group | null; legs: THREE.Object3D[];
  /** At work: a few spots of their own near the workplace, off the road, that they potter between. */
  spots: { x: number; z: number }[] | null; tx: number; tz: number; wait: number; strolling: boolean;
}

// where each kind of job is done: a named place or landmark (the rest work somewhere in the town centre)
const WORKPLACE: [RegExp, string][] = [
  [/fish seller|flower seller|vegetable seller/, 'Panjim Bazaar'], [/priest|nun|choir|policeman/, 'Church Square'],
  [/temple/, 'maruti'], [/tourist/, 'Miramar'], [/artist|gossip|retired, watching/, 'Fontainhas'], [/pilot|student/, 'kadamba'],
  [/teacher|school|kite|cricket/, 'donbosco'], [/professor/, 'imb'], [/fisherman|sailor/, 'Campal'], [/nurse|cyclist/, 'Altinho'],
];
const NIGHT_SHIFT = /nurse|fisherman|feni/;

export class People {
  readonly group = new THREE.Group();
  list: Person[] = [];
  private seed = 4242;
  private rnd = () => (this.seed = (this.seed * 16807) % 2147483647) / 2147483647;

  constructor(private net: Network, private g: Ground, d: PanjimData) {
    this.group.name = 'people';
    const spot = (name: string) => {
      const p = d.places.find(q => q[0] === name); if (p) return { x: p[1] * T, z: p[2] * T };
      const l = d.lm.find(q => q.name === name); if (l) return { x: l.at[0][0] * T, z: l.at[0][1] * T };
      return null;
    };
    this.centre = spot('Church Square') ?? { x: d.W * T / 2, z: d.H * T / 2 };
    this.spot = spot;
    this.add(CAST);
  }

  private centre = { x: 0, z: 0 };
  private spot: (name: string) => { x: number; z: number } | null = () => null;

  /** New people join the town (a newly opened area brings its residents). */
  add(cast: Cast[]) {
    const centre = this.centre, spot = this.spot;
    for (const c of cast) {
      if (this.list.some(p => p.c.name === c.name)) continue;
      const wp = WORKPLACE.find(([re]) => re.test(c.job)), at = c.workAt ?? (wp && spot(wp[1])) ?? { x: centre.x + (this.rnd() - 0.5) * 600, z: centre.z + (this.rnd() - 0.5) * 400 };
      const work = this.net.nearestNode(at.x + (this.rnd() - 0.5) * 80, at.z + (this.rnd() - 0.5) * 80);
      // home: somewhere 250-700 m from work
      let home = work;
      for (let k = 0; k < 30; k++) { const a = this.rnd() * 6.28, r = 250 + this.rnd() * 450, n = this.net.nearestNode(at.x + Math.cos(a) * r, at.z + Math.sin(a) * r); if (n !== work) { home = n; break; } }
      const night = c.shift === 'night' || NIGHT_SHIFT.test(c.job), evening = c.shift === 'evening';
      const leave = evening ? 900 + this.rnd() * 60 : night ? 1080 + this.rnd() * 60 : c.kid ? 440 + this.rnd() * 30 : 410 + this.rnd() * 130;   // 7-9 am (school 7:20); night shift from 6 pm
      const back = evening ? 1250 + this.rnd() * 70 : night ? 330 + this.rnd() * 60 : c.kid ? 780 + this.rnd() * 40 : 1010 + this.rnd() * 100;   // 5-6:40 pm (school 1 pm); night shift till dawn
      const n = this.net.nodes[home];
      this.list.push({ c, said: 0, home, work, leave, back, night, phase: 'home', path: [], pi: 0, s: 0, v: (c.old ? 2.6 : c.kid ? 4.5 : 3.6) + this.rnd() * 0.8, side: this.rnd() < 0.5 ? 1 : -1, x: n.x, z: n.z, hx: 1, hz: 0, t: this.rnd() * 6, obj: null, legs: [], spots: null, tx: n.x, tz: n.z, wait: 0, strolling: false });
    }
  }

  /** Should this person be at work, at home, or between, at this time of day? */
  private wants(p: Person, min: number): 'home' | 'work' {
    const inShift = p.night ? (min >= p.leave || min < p.back) : (min >= p.leave && min < p.back);
    return inShift ? 'work' : 'home';
  }

  /** Is (x, z) somewhere a person can stand that is not the road? (set by the game; until then, anywhere) */
  offRoad: (x: number, z: number) => boolean = () => true;

  /** Three spots of a person's own near their workplace: open ground or pavement, never the road. */
  private workSpots(p: Person): { x: number; z: number }[] {
    // the first open spot near the workplace, then two more close beside it (on the same side: no strolling across the road)
    const n = this.net.nodes[p.work], seed = [...p.c.name].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7) >>> 0;
    let first: { x: number; z: number } | null = null;
    for (let r = 7; r < 60 && !first; r += 2.5) for (let k = 0; k < 12 && !first; k++) {
      const a = ((seed % 628) / 100) + k * 0.53, x = n.x + Math.cos(a) * r, z = n.z + Math.sin(a) * r;
      if (this.offRoad(x, z)) first = { x, z };
    }
    if (!first) return [{ x: n.x + 8, z: n.z + 8 }];
    const out = [first], clear = (ax: number, az: number, bx: number, bz: number) => { for (let t = 0.25; t < 1; t += 0.25) if (!this.offRoad(ax + (bx - ax) * t, az + (bz - az) * t)) return false; return true; };
    for (let k = 0; k < 24 && out.length < 3; k++) {
      const a = k * 0.9 + seed, r = 3 + (k % 4) * 2, x = first.x + Math.cos(a) * r, z = first.z + Math.sin(a) * r;
      if (this.offRoad(x, z) && clear(first.x, first.z, x, z) && out.every(o => Math.hypot(o.x - x, o.z - z) > 2.5)) out.push({ x, z });
    }
    return out;
  }

  private go(p: Person, from: number, to: number, phase: Phase) {
    p.spots = null; p.strolling = false;
    p.path = from === to ? [] : this.net.route(from, to); p.pi = 0; p.s = 0; p.phase = phase;
  }

  private started = false;
  update(dt: number, min: number, cx: number, cz: number) {
    // the first time: whoever should be at work already is (the game starts mid-afternoon)
    if (!this.started) { this.started = true; for (const p of this.list) if (this.wants(p, min) === 'work') { p.phase = 'work'; p.spots = this.workSpots(p); const s = p.spots[Math.floor(this.rnd() * p.spots.length)]; p.x = s.x; p.z = s.z; p.wait = this.rnd() * 6; } }
    for (const p of this.list) {
      const want = this.wants(p, min);
      // start the walk to work or home when it is time (and pick up from wherever they are)
      if (want === 'work' && (p.phase === 'home' || p.phase === 'toHome')) this.go(p, p.phase === 'home' ? p.home : this.net.nearestNode(p.x, p.z), p.work, 'toWork');
      if (want === 'home' && (p.phase === 'work' || p.phase === 'toWork')) this.go(p, p.phase === 'work' ? p.work : this.net.nearestNode(p.x, p.z), p.home, 'toHome');
      if (p.phase === 'toWork' || p.phase === 'toHome') {
        // walk along the pavement of each street in turn
        // out of sight they hurry (the game's clock runs fast; at a real walking pace no one would get to work by noon)
        const seen = Math.hypot(p.x - cx, p.z - cz) < 380;
        p.s += p.v * dt * (seen ? 1 : 12); p.t += dt * 7;
        while (p.pi < p.path.length && p.s > this.net.edge(p.path[p.pi]).len) { p.s -= this.net.edge(p.path[p.pi]).len; p.pi++; }
        if (p.pi >= p.path.length) {
          p.phase = p.phase === 'toWork' ? 'work' : 'home';
          if (p.phase === 'home') { const n = this.net.nodes[p.home]; p.x = n.x; p.z = n.z; }
          else { p.spots = p.spots ?? this.workSpots(p); const s = p.spots[0]; p.tx = s.x; p.tz = s.z; p.strolling = true; }   // on from the pavement to their spot
        }
        else {
          const e = p.path[p.pi], a = this.net.at(e, p.s), E = this.net.edge(e), off = (E.width / 2 + 2.2) * p.side;
          p.x = a.x + a.dz * off; p.z = a.z - a.dx * off; p.hx = a.dx; p.hz = a.dz;
        }
      } else if (p.phase === 'work') {
        // at work: off the road, at a few spots of their own near the workplace, pottering between them in their own way
        if (!p.spots) p.spots = this.workSpots(p);
        const c = p.c, kid = !!c.kid, old = !!c.old, seller = /seller|vendor|stall|shop|poder|baker/i.test(c.job);
        if (p.strolling) {
          const d = Math.hypot(p.tx - p.x, p.tz - p.z), sp = (kid ? 3.2 : old ? 0.9 : 1.4) * dt;
          if (d < 0.25) { p.strolling = false; p.wait = (seller ? 14 : old ? 12 : kid ? 2 : c.hint === 'chatty' ? 4 : 7) * (0.6 + this.rnd() * 0.8); }
          else { p.hx = (p.tx - p.x) / d; p.hz = (p.tz - p.z) / d; const k = Math.min(1, sp / d); p.x += (p.tx - p.x) * k; p.z += (p.tz - p.z) * k; p.t += dt * (kid ? 11 : 6); }
        } else {
          p.wait -= dt;
          const a = Math.sin(performance.now() / 3000 + c.name.length) * 1.2; p.hx = Math.cos(a); p.hz = Math.sin(a);   // looking about
          if (p.wait <= 0) { const s = Math.hypot(p.x - p.spots[0].x, p.z - p.spots[0].z) > 0.5 ? p.spots[0] : p.spots[Math.floor(this.rnd() * p.spots.length)]; p.tx = s.x; p.tz = s.z; p.strolling = true; }
        }
      }
      this.show(p, cx, cz);
    }
  }

  // draw a person only when near the child (and not when they are indoors at home)
  private show(p: Person, cx: number, cz: number) {
    const visible = p.phase !== 'home' && Math.hypot(p.x - cx, p.z - cz) < 360;
    if (!visible) { if (p.obj) p.obj.visible = false; return; }
    if (!p.obj) { const m = this.build(p.c); p.obj = m.obj; p.legs = m.legs; this.group.add(p.obj); }
    p.obj.visible = true;
    p.obj.position.set(p.x, this.g.heightAt(p.x, p.z) + 0.15, p.z);
    const near = Math.hypot(p.x - cx, p.z - cz) < 7;
    p.obj.rotation.y = near ? -Math.atan2(cz - p.z, cx - p.x) : -Math.atan2(p.hz, p.hx);
    const walking = (p.phase === 'toWork' || p.phase === 'toHome' || (p.phase === 'work' && p.strolling)) && !near;
    const sw = walking ? Math.sin(p.t) * 0.5 : 0; if (p.legs.length) { p.legs[0].rotation.z = sw; p.legs[1].rotation.z = -sw; }
  }

  // how someone looks: their clothes, hair, and what they carry
  build(c: Cast): { obj: THREE.Group; legs: THREE.Object3D[] } {
    const obj = new THREE.Group(), mat = (col: number) => new THREE.MeshLambertMaterial({ color: col });
    const part = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z = 0, p: THREE.Object3D = obj) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; p.add(o); return o; };
    const skin = mat([0xd8a880, 0xb8794a, 0x7a4e30][c.skin]), top = mat(c.top), bottom = mat(c.bottom);
    const legs: THREE.Object3D[] = [];
    const robe = c.outfit === 'sari' || c.outfit === 'frock' || c.outfit === 'cassock';
    if (robe) part(new THREE.CylinderGeometry(0.22, c.outfit === 'frock' ? 0.36 : 0.3, c.outfit === 'frock' ? 0.6 : 0.9, 10), bottom, 0, c.outfit === 'frock' ? 0.75 : 0.45);   // skirt to the ground (or a frock to the knee)
    if (!robe || c.outfit === 'frock') for (const z of [-0.11, 0.11]) {
      const p = new THREE.Group(); p.position.set(0, 0.85, z); obj.add(p);
      part(new THREE.CylinderGeometry(0.08, 0.08, 0.85, 6), c.outfit === 'frock' ? skin : bottom, 0, -0.42, 0, p); legs.push(p);
    }
    part(new THREE.CylinderGeometry(0.2, 0.25, 0.72, 8), top, 0, 1.2);
    if (c.outfit === 'sari') { const d = part(new THREE.BoxGeometry(0.08, 0.9, 0.5), top, 0.05, 1.15); d.rotation.x = 0.5; }   // the pallu over the shoulder
    if (c.outfit === 'kurta') part(new THREE.CylinderGeometry(0.25, 0.28, 0.35, 8), top, 0, 0.75);
    if (c.outfit === 'uniform') part(new THREE.BoxGeometry(0.06, 0.3, 0.06), mat(0x2a4a8a), 0.2, 1.3);   // the tie
    part(new THREE.SphereGeometry(0.2, 10, 8), skin, 0, 1.8);
    // hair and hats
    const hairCol = c.hair === 'grey' ? 0xc8c8c8 : 0x1a1410;
    if (c.hair !== 'bald' && c.hair !== 'cap' && c.hair !== 'straw' && c.hair !== 'topi') part(new THREE.SphereGeometry(0.21, 10, 8, 0, Math.PI * 2, 0, 1.3), mat(hairCol), 0, 1.86);
    if (c.hair === 'bun') part(new THREE.SphereGeometry(0.1, 8, 6), mat(hairCol), -0.18, 1.88);
    if (c.hair === 'long') part(new THREE.BoxGeometry(0.08, 0.4, 0.3), mat(hairCol), -0.18, 1.62);
    if (c.hair === 'cap') { part(new THREE.SphereGeometry(0.21, 10, 8, 0, Math.PI * 2, 0, 1.4), mat(c.job.includes('police') ? 0xd8c08a : c.job.includes('nun') ? 0xf6f4ee : 0x2f7fc1), 0, 1.88); part(new THREE.BoxGeometry(0.22, 0.03, 0.2), mat(0x222222), 0.2, 1.9); }
    if (c.hair === 'straw') { part(new THREE.CylinderGeometry(0.4, 0.4, 0.03, 12), mat(0xe8d8a0), 0, 1.98); part(new THREE.CylinderGeometry(0.18, 0.2, 0.15, 10), mat(0xe8d8a0), 0, 2.05); }
    if (c.hair === 'topi') part(new THREE.CylinderGeometry(0.18, 0.19, 0.12, 10), mat(0xffffff), 0, 1.98);
    // what they carry
    if (c.prop === 'umbrella') { part(new THREE.CylinderGeometry(0.015, 0.015, 1.1, 4), mat(0x333333), 0.25, 2.0); part(new THREE.ConeGeometry(0.75, 0.3, 8), mat([0x2c2c2c, 0xd0342c, 0x2f7fc1][c.name.length % 3]), 0.25, 2.6); }
    if (c.prop === 'basket') part(new THREE.CylinderGeometry(0.32, 0.22, 0.2, 10), mat(0x9a6a3a), 0, 2.08);
    if (c.prop === 'bag') part(new THREE.BoxGeometry(0.1, 0.3, 0.3), mat(0x5a3a2a), 0.05, 1.0, 0.3);
    if (c.prop === 'schoolbag') part(new THREE.BoxGeometry(0.2, 0.35, 0.32), mat(0xd0342c), -0.25, 1.25);
    if (c.prop === 'paper') part(new THREE.BoxGeometry(0.25, 0.3, 0.02), mat(0xf2f0e8), 0.3, 1.25, 0.15);
    if (c.prop === 'camera') part(new THREE.BoxGeometry(0.12, 0.1, 0.16), mat(0x222222), 0.25, 1.35);
    if (c.prop === 'phone') part(new THREE.BoxGeometry(0.03, 0.12, 0.07), mat(0x222222), 0.05, 1.8, 0.2);
    if (c.prop === 'cane') part(new THREE.CylinderGeometry(0.02, 0.02, 1.0, 4), mat(0x5a3a2a), 0.25, 0.5, 0.2);
    obj.scale.setScalar(c.kid ? 1.7 : 2.4);
    return { obj, legs };
  }

  /** The person in talking reach of (x, z), if any (only someone out and about). */
  near(x: number, z: number): Person | null {
    let best: Person | null = null, bd = 7;
    for (const p of this.list) { if (p.phase === 'home') continue; const d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; best = p; } }
    return best;
  }

  /** What someone says: who they are, a line of theirs (a new one each time), and the way to the current target. */
  talk(cx: number, cz: number, target: { x: number; z: number; name: string } | null): string {
    const p = this.near(cx, cz); if (!p) return '';
    const c = p.c, busy = p.phase === 'toWork' ? 'Late for work, men, can\'t stop long! ' : p.phase === 'toHome' ? (p.night ? 'Night shift done, going to sleep. ' : 'Finally, home time! ') : '';
    let s = `${c.name}, ${c.job}: "${busy}${c.lines[p.said % c.lines.length]}"`; p.said++;
    if (target) {
      const dx = target.x - cx, dz = target.z - cz, d = Math.hypot(dx, dz), m = Math.round(d / 10) * 10;
      const dir = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'][((Math.round(Math.atan2(dz, dx) / (Math.PI / 4)) % 8) + 8) % 8];
      s += d < 40 ? ` ${target.name}? Here only, baba!`
        : c.hint === 'grumpy' ? ` ${target.name}? ${dir[0].toUpperCase() + dir.slice(1)}. Go, go.`
        : c.hint === 'vague' ? ` ${target.name}? Somewhere ${dir}, I think...`
        : c.hint === 'chatty' ? ` ${target.name}? Oh, go ${dir}, about ${m} metres, past the house with the blue door, you can't miss it!`
        : ` ${target.name}? ${dir[0].toUpperCase() + dir.slice(1)}, about ${m} metres.`;
    }
    return s;
  }

  /** How many people are out right now (for the rush hours). */
  get outCount(): number { return this.list.filter(p => p.phase !== 'home').length; }
}
