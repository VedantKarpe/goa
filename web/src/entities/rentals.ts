// Drunk tourists in self-drive rentals: black number plates with yellow letters (Goa's plates for hire cars), mostly
// Thars and Swifts. They weave all over the road, ignore the signals, and when the child comes near one may lock on and
// swerve straight at them, horn blaring. Get hit and you lose: avoid them at all times.
import * as THREE from 'three';
import type { Network } from '../world/network';
import type { Ground } from '../world/data';
import { buildCar, pick, RENTAL_MIX } from './cars';

interface Rental { obj: THREE.Group; e: number; s: number; v: number; x: number; z: number; hx: number; hz: number; t: number; lunge: number; cool: number; off: number }

export class Rentals {
  readonly group = new THREE.Group();
  list: Rental[] = [];
  private seed = 777;
  private rnd = () => (this.seed = (this.seed * 16807) % 2147483647) / 2147483647;
  /** A line to show when one starts coming for you. */
  onWarn: (msg: string) => void = () => {};

  constructor(private net: Network, private g: Ground, private canDrive: (x: number, z: number) => boolean) { this.group.name = 'rentals'; }

  private spawn(cx: number, cz: number) {
    for (let k = 0; k < 20; k++) {
      const e = Math.floor(this.rnd() * this.net.edges.length), E = this.net.edges[e];
      if (E.width < 9 || E.len < 40) continue;
      const p = this.net.at(e, E.len / 2), d = Math.hypot(p.x - cx, p.z - cz);
      if (d < 160 || d > 320) continue;
      const { obj } = buildCar(pick(RENTAL_MIX, this.rnd()), null, 'rental'); this.group.add(obj);
      this.list.push({ obj, e: this.rnd() < 0.5 ? e : ~e, s: E.len / 2, v: 12, x: p.x, z: p.z, hx: p.dx, hz: p.dz, t: this.rnd() * 9, lunge: 0, cool: 3 + this.rnd() * 5, off: 0 });
      return;
    }
  }

  /** Drive them; returns true if one hit the child at (cx, cz). */
  update(dt: number, cx: number, cz: number, night: boolean, hidden: boolean): boolean {
    const want = night ? 5 : 3;
    if (this.list.length < want && this.rnd() < dt * 0.8) this.spawn(cx, cz);
    let hit = false;
    for (const r of [...this.list]) {
      r.t += dt; r.cool -= dt;
      const dx = cx - r.x, dz = cz - r.z, d = Math.hypot(dx, dz) || 1;
      if (d > 420) { this.group.remove(r.obj); this.list.splice(this.list.indexOf(r), 1); continue; }
      // locking on: near the child, now and then, one swerves straight at them for a few seconds
      if (r.lunge <= 0 && r.cool <= 0 && d < 60 && !hidden && this.rnd() < dt * 0.9) {
        r.lunge = 2.5 + this.rnd() * 1.5; r.cool = 8 + this.rnd() * 6;
        this.onWarn(['Aay deva! A rental Thar is swerving straight at you! Move, baba!', 'Watch out! Black plate, yellow letters: a drunk tourist, coming your way!', 'Honk honk! "Wooo, Goa!" A rental car lurches towards you. Run!'][Math.floor(this.rnd() * 3)]);
      }
      if (r.lunge > 0) {
        r.lunge -= dt;
        const tx = dx / d, tz = dz / d;
        r.hx += (tx - r.hx) * Math.min(1, dt * 2.2); r.hz += (tz - r.hz) * Math.min(1, dt * 2.2);
        const L = Math.hypot(r.hx, r.hz) || 1; r.hx /= L; r.hz /= L;
        r.v += (22 - r.v) * Math.min(1, dt * 1.5);
        const nx = r.x + r.hx * r.v * dt, nz = r.z + r.hz * r.v * dt;
        if (this.canDrive(nx, nz)) { r.x = nx; r.z = nz; } else { r.lunge = 0; }   // hits a wall: gives up
        if (r.lunge <= 0) { r.e = this.net.nearest(r.x, r.z).e; r.s = this.net.nearest(r.x, r.z).s; }   // back to the road
      } else {
        // driving the streets, badly: weaving lane to lane, speeding up and slowing for no reason
        r.v += ((14 + Math.sin(r.t * 0.7) * 6) - r.v) * Math.min(1, dt);
        r.s += r.v * dt;
        for (let k = 0; k < 6 && r.s > this.net.edge(r.e).len; k++) {
          r.s -= this.net.edge(r.e).len;
          // at a junction they usually turn your way (they are lost, and somehow always end up where you are)
          const node = this.net.nodes[this.net.end(r.e)], opts = node.out.filter(o => o !== ~r.e);
          if (opts.length && this.rnd() < 0.7) {
            let best = opts[0], bd = 1e18;
            for (const o of opts) { const n = this.net.nodes[this.net.end(o)], dd = (n.x - cx) ** 2 + (n.z - cz) ** 2; if (dd < bd) { bd = dd; best = o; } }
            r.e = best;
          } else r.e = this.net.next(r.e, this.rnd);
        }
        const p = this.net.at(r.e, r.s), w = this.net.edge(r.e).width;
        r.off = Math.sin(r.t * 1.3) * w * 0.32 + Math.sin(r.t * 3.1) * 0.8;   // all over the road
        r.x += ((p.x + p.dz * r.off) - r.x) * Math.min(1, dt * 4); r.z += ((p.z - p.dx * r.off) - r.z) * Math.min(1, dt * 4);
        r.hx += (p.dx - r.hx) * Math.min(1, dt * 5); r.hz += (p.dz - r.hz) * Math.min(1, dt * 5);
      }
      const deck = r.lunge > 0 ? null : this.net.deckY(r.e, r.s);
      r.obj.position.set(r.x, (deck ?? this.g.heightAt(r.x, r.z)) + 0.25, r.z);
      r.obj.rotation.y = -Math.atan2(r.hz, r.hx) + Math.sin(r.t * 2.3) * 0.06;   // the drunk wobble
      if (!hidden && d < 4.2 && r.v > 4) hit = true;
    }
    return hit;
  }

  /** Clear the ones near (x, z) (after a hit, so the child is not hit again at once). */
  clearNear(x: number, z: number, r = 120) { for (const c of [...this.list]) if (Math.hypot(c.x - x, c.z - z) < r) { this.group.remove(c.obj); this.list.splice(this.list.indexOf(c), 1); } }
}
