// Panjim's cows: they wander the streets slowly, stand in the middle of the road as they please, and lie down by the
// market and Church Square. Cars wait for them (and honk).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Network } from '../world/network';
import type { Ground } from '../world/data';

interface Cow { obj: THREE.Group; x: number; z: number; h: number; t: number; state: 'stand' | 'walk' | 'lie'; legs: THREE.Object3D[] }

export class Cows {
  readonly group = new THREE.Group();
  list: Cow[] = [];
  private seed = 4242;
  private rnd = () => (this.seed = (this.seed * 16807) % 2147483647) / 2147483647;

  constructor(net: Network, private g: Ground, private free: (x: number, z: number) => boolean, rest: [number, number][]) {
    this.group.name = 'cows';
    const coats = [0xf2ede2, 0xe8dcc4, 0xc89a6a, 0x8a6a4e, 0xf2ede2];
    const horn = new THREE.MeshLambertMaterial({ color: 0x3a3028 }), hoof = new THREE.MeshLambertMaterial({ color: 0x2a2420 });
    const spots: [number, number, boolean][] = [];
    for (const [x, z] of rest) for (let i = 0; i < 3; i++) spots.push([x + (this.rnd() - 0.5) * 30, z + (this.rnd() - 0.5) * 30, true]);
    for (let i = 0; spots.length < 34 && i < 400; i++) {
      const e = Math.floor(this.rnd() * net.edges.length), E = net.edges[e];
      if (E.deck !== null && E.deck !== undefined) continue;
      const p = net.at(e, this.rnd() * E.len), s = (this.rnd() - 0.5) * E.width * 0.8;
      spots.push([p.x + p.dz * s, p.z - p.dx * s, false]);
    }
    for (const [x, z, lie] of spots) {
      if (!this.free(x, z)) continue;
      const coat = new THREE.MeshLambertMaterial({ color: coats[Math.floor(this.rnd() * coats.length)] });
      const o = new THREE.Group();
      const body = new THREE.Mesh(mergeGeometries([new THREE.BoxGeometry(2.1, 0.95, 0.85).translate(0, 1.35, 0), new THREE.BoxGeometry(0.45, 0.4, 0.5).translate(0.55, 1.95, 0)])!, coat);   // body and the hump
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.45).translate(1.35, 1.6, 0), coat);
      const horns = new THREE.Mesh(mergeGeometries([new THREE.ConeGeometry(0.06, 0.4, 4).rotateZ(-0.5).translate(1.35, 2.0, 0.18), new THREE.ConeGeometry(0.06, 0.4, 4).rotateZ(-0.5).translate(1.35, 2.0, -0.18)])!, horn);
      const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 4).translate(-1.1, 1.3, 0).rotateZ(0.15), hoof);
      o.add(body, head, horns, tail);
      const legs: THREE.Object3D[] = [];
      for (const [lx, lz] of [[0.75, 0.28], [0.75, -0.28], [-0.75, 0.28], [-0.75, -0.28]]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.9, 0.2).translate(0, -0.45, 0), coat);
        leg.position.set(lx, 0.9, lz); o.add(leg); legs.push(leg);
      }
      o.traverse(m => { m.castShadow = true; }); o.scale.setScalar(1.25);
      const cow: Cow = { obj: o, x, z, h: this.rnd() * Math.PI * 2, t: this.rnd() * 8, state: lie ? 'lie' : 'stand', legs };
      this.list.push(cow); this.group.add(o);
    }
  }

  update(dt: number) {
    for (const c of this.list) {
      c.t -= dt;
      if (c.t <= 0) {
        // a cow decides slowly: stand and chew, amble a few metres, or (rarely) lie down; the market cows mostly lie
        const r = this.rnd();
        c.state = c.state === 'lie' ? (r < 0.75 ? 'lie' : 'stand') : r < 0.45 ? 'walk' : r < 0.9 ? 'stand' : 'lie';
        if (c.state === 'walk') c.h += (this.rnd() - 0.5) * 1.6;
        c.t = 4 + this.rnd() * 10;
      }
      if (c.state === 'walk') {
        const nx = c.x + Math.cos(c.h) * 0.9 * dt, nz = c.z + Math.sin(c.h) * 0.9 * dt;
        if (this.free(nx, nz)) { c.x = nx; c.z = nz; } else { c.h += Math.PI * 0.6; }
      }
      const lying = c.state === 'lie', sw = c.state === 'walk' ? Math.sin(performance.now() / 260) * 0.35 : 0;
      c.legs.forEach((l, i) => { l.visible = !lying; l.rotation.z = i % 2 ? sw : -sw; });   // lying: legs tucked under
      c.obj.position.set(c.x, this.g.heightAt(c.x, c.z) - (lying ? 1.05 : 0), c.z);
      c.obj.rotation.y = -c.h;
    }
  }

  /** A cow within r metres of (x, z), if any. */
  near(x: number, z: number, r: number): Cow | null { for (const c of this.list) if (Math.hypot(c.x - x, c.z - z) < r) return c; return null; }
}
