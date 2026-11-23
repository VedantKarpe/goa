// Cars you can drive: hatchbacks and black-and-yellow Goan taxis parked along the real streets. Stand by one and Lift
// gets you in; W/S (or the stick pushed up/down) is the accelerator and the brake/reverse, A/D (left/right) steers, H honks.
// Walls and the river stop you; the camera swings round behind the car.
import * as THREE from 'three';
import { buildCar, type CarModel } from './cars';
import type { Network } from '../world/network';
import type { ParkedCar } from '../world/streetlife';

interface Car { obj: THREE.Group; wheels: THREE.Object3D[]; x: number; z: number; h: number; taxi: boolean }


/** Headlamps, tail lights and the pool of light the lamps throw on the road ahead (all unlit materials: no real lights,
 *  which would make every material in the town recompile). Shown after dusk. */
function headlights(car: THREE.Group): THREE.Group {
  const body = (car.children[0] as THREE.Mesh).geometry; body.computeBoundingBox();   // the body's own size (the car may be turned)
  const sz = body.boundingBox!.getSize(new THREE.Vector3()), s = car.scale.x || 1;
  const L = sz.x / 2, W = sz.z / 2, H = sz.y, g = new THREE.Group(); g.name = 'headlights';
  const lamp = new THREE.MeshBasicMaterial({ color: 0xfff4d0, toneMapped: false }), tail = new THREE.MeshBasicMaterial({ color: 0xff2a1a, toneMapped: false });
  for (const z of [-W * 0.62, W * 0.62]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.34), lamp); h.position.set(L + 0.02, H * 0.42, z); g.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.3), tail); t.position.set(-L - 0.02, H * 0.45, z); g.add(t);
  }
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const c = cv.getContext('2d')!;
  const gr = c.createRadialGradient(64, 110, 4, 64, 70, 70); gr.addColorStop(0, 'rgba(255,240,200,0.9)'); gr.addColorStop(1, 'rgba(255,240,200,0)'); c.fillStyle = gr; c.fillRect(0, 0, 128, 128);
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(9, 16).rotateX(-Math.PI / 2).rotateY(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  pool.position.set(L + 8 / s, 0.12, 0); pool.scale.setScalar(1 / s); pool.renderOrder = 2; g.add(pool);
  g.visible = false; car.add(g); return g;
}

function rng(seed: number) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

export class Drive {
  group = new THREE.Group();
  list: Car[] = [];
  riding: Car | null = null;
  /** Speed (m/s, + forward). */
  v = 0;

  /** Every car parked along the kerbs (the street scenery): any of them can be driven away. */
  private kerb: ParkedCar[];

  /** Auto drive: the route (street edges) being followed, how far along. */
  auto: { path: number[]; i: number; s: number; name: string } | null = null;

  constructor(private net: Network, private ground: (x: number, z: number) => number, free: (x: number, z: number) => boolean, kerb: ParkedCar[] = []) {
    this.kerb = kerb;
    this.group.name = 'parked cars';
    const rnd = rng(77);
    const E = net.edges;
    for (let i = 0; i < E.length && this.list.length < 40; i += 1 + Math.floor(rnd() * 14)) {
      const e = E[i]; if (e.width < 7 || e.len < 40) continue;
      const p = net.at(i, e.len * (0.3 + rnd() * 0.4)), side = rnd() < 0.5 ? -1 : 1, off = e.width / 2 - 1.3;
      const x = p.x + p.dz * off * side, z = p.z - p.dx * off * side;
      if (!free(x, z)) continue;
      const taxi = true, model = 'innova' as CarModel;   // the kerbs already hold the ordinary cars: these are the taxi ranks
      const c = buildCar(model, 0x161616, 'private', { spinWheels: true }); c.obj.scale.setScalar(1.6);
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

  /** The nearest car you could get into: a taxi, a car you left somewhere, or any car parked on the kerb. */
  near(px: number, pz: number): Car | ParkedCar | null {
    let best: Car | ParkedCar | null = null, bd = 7;
    for (const c of this.list) { const d = Math.hypot(c.x - px, c.z - pz); if (d < bd) { bd = d; best = c; } }
    for (const c of this.kerb) { if (!c.mesh) continue; const d = Math.hypot(c.x - px, c.z - pz); if (d < bd) { bd = d; best = c; } }
    return best;
  }

  /** Take a kerbside car: it leaves the street scenery and becomes a car of its own you can drive. */
  private take(pc: ParkedCar): Car {
    const pos = pc.mesh!.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = pc.start; i < pc.start + pc.count; i++) pos.setXYZ(i, pc.x, -60, pc.z);   // fold it away out of sight
    pos.needsUpdate = true; pc.mesh = null;
    const c = buildCar(pc.model, pc.col, 'private', { spinWheels: true }); c.obj.scale.setScalar(1.6);
    c.obj.position.set(pc.x, this.ground(pc.x, pc.z), pc.z); c.obj.rotation.y = -pc.h; this.group.add(c.obj);
    const car: Car = { obj: c.obj, wheels: c.wheels, x: pc.x, z: pc.z, h: pc.h, taxi: false }; this.list.push(car); return car;
  }

  enter(c: Car | ParkedCar): Car { const car = 'obj' in c ? c : this.take(c); this.riding = car; this.v = 0; if (!car.obj.getObjectByName('headlights')) headlights(car.obj); return car; }
  /** Auto drive to (x, z) along the streets. Returns false when there is no way there by road. */
  startAuto(x: number, z: number, name: string): boolean {
    const c = this.riding; if (!c) return false;
    const a = this.net.nearestNode(c.x, c.z), b = this.net.nearestNode(x, z), path = a === b ? [] : this.net.route(a, b);
    if (!path.length) return false;
    this.auto = { path, i: 0, s: 0, name }; return true;
  }

  /** One frame of auto drive: along each street on the left side (Goa drives on the left), easing round the corners.
   *  Returns true on arrival. */
  stepAuto(dt: number, standY: (x: number, z: number) => number): boolean {
    const c = this.riding, A = this.auto; if (!c || !A) return false;
    const E = this.net.edge(A.path[A.i]), turnSoon = A.s > E.len - 25 && A.i < A.path.length - 1;
    const want = turnSoon ? 14 : 26;                                        // about 95 km/h on the straight, slower into turns
    this.v += Math.sign(want - this.v) * Math.min(Math.abs(want - this.v), 10 * dt);
    A.s += this.v * dt;
    while (A.i < A.path.length && A.s > this.net.edge(A.path[A.i]).len) { A.s -= this.net.edge(A.path[A.i]).len; A.i++; }
    if (A.i >= A.path.length) { this.auto = null; this.v = 0; return true; }
    const p = this.net.at(A.path[A.i], A.s), w = this.net.edge(A.path[A.i]).width, off = Math.max(1.6, w * 0.27);
    const x = p.x + p.dz * off, z = p.z - p.dx * off, h = Math.atan2(p.dz, p.dx);
    c.h += Math.atan2(Math.sin(h - c.h), Math.cos(h - c.h)) * Math.min(1, dt * 8);   // ease the heading round bends
    c.x = x; c.z = z; c.obj.position.set(x, standY(x, z), z); c.obj.rotation.y = -c.h;
    for (const wh of c.wheels) wh.rotation.z -= this.v * dt / 0.32;
    return false;
  }

  /** Lights on after dusk (`dark`: 0 day, 1 night), on the car being driven. */
  lights(dark: number) { for (const c of this.list) { const h = c.obj.getObjectByName('headlights'); if (h) h.visible = c === this.riding && dark > 0.3; } }

  /** Get out: the spot beside the driver's door. */
  park(): { x: number; z: number } | null {
    const c = this.riding; if (!c) return null;
    this.auto = null;
    this.riding = null; this.v = 0;
    return { x: c.x - Math.sin(c.h) * 2.4, z: c.z + Math.cos(c.h) * 2.4 };
  }

  /** One frame of driving. throttle: +1 forward / -1 brake & reverse; steer: -1 left / +1 right. `step` moves with
   *  collisions (as walking does); `standY` is the ground or the bridge deck under the car. */
  update(dt: number, throttle: number, steer: number, step: (x: number, z: number, dx: number, dz: number) => [number, number], standY: (x: number, z: number) => number) {
    const c = this.riding; if (!c) return;
    const MAX = 34, REV = -8;                                   // about 120 km/h forward
    if (throttle > 0) this.v += (this.v < 0 ? 22 : 13) * throttle * dt;
    else if (throttle < 0) this.v += (this.v > 0 ? -16 : -5) * -throttle * dt;
    else this.v -= Math.sign(this.v) * Math.min(Math.abs(this.v), 3.5 * dt);   // rolling to a stop
    this.v = Math.max(REV, Math.min(MAX, this.v));
    // steering bites harder at low speed, gentler when fast (a car, not a bicycle)
    const grip = Math.min(1, Math.abs(this.v) / 3) * (1 - Math.min(0.35, Math.abs(this.v) / 90));
    c.h += steer * 2.6 * grip * Math.sign(this.v || 1) * dt;
    const dx = Math.cos(c.h) * this.v * dt, dz = Math.sin(c.h) * this.v * dt;
    const [nx, nz] = step(c.x, c.z, dx, dz);
    const moved = Math.hypot(nx - c.x, nz - c.z), want = Math.hypot(dx, dz);
    if (want > 0.05 && moved < want * 0.4) this.v *= -0.25;    // hit a wall: bump back
    c.x = nx; c.z = nz;
    c.obj.position.set(c.x, standY(c.x, c.z), c.z); c.obj.rotation.y = -c.h;
    for (const w of c.wheels) w.rotation.z -= this.v * dt / 0.32;
  }
}
