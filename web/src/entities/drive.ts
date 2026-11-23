// Cars you can drive: hatchbacks and black-and-yellow Goan taxis parked along the real streets. Stand by one and Lift
// gets you in; W/S (or the stick pushed up/down) is the accelerator and the brake/reverse, A/D (left/right) steers, H honks.
// Walls and the river stop you; the camera swings round behind the car.
import * as THREE from 'three';
import { buildCar, type CarModel } from './cars';
import type { Network } from '../world/network';

interface Car { obj: THREE.Group; wheels: THREE.Object3D[]; x: number; z: number; h: number; taxi: boolean }

const MODELS: CarModel[] = ['swift', 'alto', 'wagonr', 'i20', 'creta'];
const COLS = [0xf2f2ee, 0xb8bcc4, 0x8a2a2a, 0x2a4a8a, 0x3a3a3e, 0xd8c8a0];

function rng(seed: number) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

export class Drive {
  group = new THREE.Group();
  list: Car[] = [];
  riding: Car | null = null;
  /** Speed (m/s, + forward). */
  v = 0;

  constructor(net: Network, ground: (x: number, z: number) => number, free: (x: number, z: number) => boolean) {
    this.group.name = 'parked cars';
    const rnd = rng(77);
    const E = net.edges;
    for (let i = 0; i < E.length && this.list.length < 90; i += 1 + Math.floor(rnd() * 9)) {
      const e = E[i]; if (e.width < 7 || e.len < 40) continue;
      const p = net.at(i, e.len * (0.3 + rnd() * 0.4)), side = rnd() < 0.5 ? -1 : 1, off = e.width / 2 - 1.3;
      const x = p.x + p.dz * off * side, z = p.z - p.dx * off * side;
      if (!free(x, z)) continue;
      const taxi = rnd() < 0.35, model = taxi ? 'innova' as CarModel : MODELS[Math.floor(rnd() * MODELS.length)];
      const c = buildCar(model, taxi ? 0x161616 : COLS[Math.floor(rnd() * COLS.length)], 'private', { spinWheels: true });
      if (taxi) {   // a Goan tourist taxi: black with a yellow top, and the TAXI board
        const top = new THREE.Mesh(new THREE.BoxGeometry(c.len * 0.5, 0.06, 1.5), new THREE.MeshLambertMaterial({ color: 0xf2c230 }));
        top.position.y = 1.86; c.obj.add(top);
        const sign = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.28, 0.9), new THREE.MeshBasicMaterial({ color: 0xffe066 }));
        sign.position.y = 2.05; c.obj.add(sign);
      }
      const h = Math.atan2(p.dz, p.dx) + (rnd() < 0.5 ? 0 : Math.PI);
      c.obj.position.set(x, ground(x, z), z); c.obj.rotation.y = -h;
      this.group.add(c.obj); this.list.push({ obj: c.obj, wheels: c.wheels, x, z, h, taxi });
    }
  }

  near(px: number, pz: number): Car | null {
    let best: Car | null = null, bd = 6;
    for (const c of this.list) { const d = Math.hypot(c.x - px, c.z - pz); if (d < bd) { bd = d; best = c; } }
    return best;
  }

  enter(c: Car) { this.riding = c; this.v = 0; }

  /** Get out: the spot beside the driver's door. */
  park(): { x: number; z: number } | null {
    const c = this.riding; if (!c) return null;
    this.riding = null; this.v = 0;
    return { x: c.x - Math.sin(c.h) * 2.4, z: c.z + Math.cos(c.h) * 2.4 };
  }

  /** One frame of driving. throttle: +1 forward / -1 brake & reverse; steer: -1 left / +1 right. `step` moves with
   *  collisions (as walking does); `standY` is the ground or the bridge deck under the car. */
  update(dt: number, throttle: number, steer: number, step: (x: number, z: number, dx: number, dz: number) => [number, number], standY: (x: number, z: number) => number) {
    const c = this.riding; if (!c) return;
    const MAX = 24, REV = -7;                                   // about 85 km/h forward
    if (throttle > 0) this.v += (this.v < 0 ? 18 : 7.5) * throttle * dt;
    else if (throttle < 0) this.v += (this.v > 0 ? -16 : -5) * -throttle * dt;
    else this.v -= Math.sign(this.v) * Math.min(Math.abs(this.v), 3.5 * dt);   // rolling to a stop
    this.v = Math.max(REV, Math.min(MAX, this.v));
    // steering bites harder at low speed, gentler when fast (a car, not a bicycle)
    const grip = Math.min(1, Math.abs(this.v) / 5) * (1 - Math.min(0.55, Math.abs(this.v) / 50));
    c.h += steer * 1.9 * grip * Math.sign(this.v || 1) * dt;
    const dx = Math.cos(c.h) * this.v * dt, dz = Math.sin(c.h) * this.v * dt;
    const [nx, nz] = step(c.x, c.z, dx, dz);
    const moved = Math.hypot(nx - c.x, nz - c.z), want = Math.hypot(dx, dz);
    if (want > 0.05 && moved < want * 0.4) this.v *= -0.25;    // hit a wall: bump back
    c.x = nx; c.z = nz;
    c.obj.position.set(c.x, standY(c.x, c.z), c.z); c.obj.rotation.y = -c.h;
    for (const w of c.wheels) w.rotation.z -= this.v * dt / 0.32;
  }
}
