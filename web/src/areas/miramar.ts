// Miramar: Panjim's beach, where the Mandovi meets the sea. A long strip of sand with casuarina trees behind it, foam
// along the water's edge, bhel-puri and corn carts under umbrellas, people out for the evening walk, and the arch at
// the entrance. The sun sets into the sea here.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { T, WATER_Y, type PanjimData, type Ground } from '../world/data';
import type { AreaContext, AreaInstance } from './types';

interface Walker { obj: THREE.Group; a: [number, number]; b: [number, number]; t: number; sp: number }

export class Miramar {
  readonly group = new THREE.Group();
  centre: { x: number; z: number } = { x: 0, z: 0 };
  sand: [number, number][] = [];              // world centres of the sand tiles
  private foam: THREE.InstancedMesh | null = null;
  private foamBase: THREE.Matrix4[] = [];
  private walkers: Walker[] = [];
  private seed = 909;
  private rnd = () => (this.seed = (this.seed * 16807) % 2147483647) / 2147483647;

  constructor(d: PanjimData, private g: Ground, free: (x: number, z: number) => boolean) {
    this.group.name = 'miramar';
    const at = (x: number, y: number) => (x >= 0 && y >= 0 && x < d.W && y < d.H ? d.rows[y][x] : 'W');
    const sandy = (c: string) => c === 'S' || c === 'B';
    // the beach: the sand tiles on the city's west shore (Miramar), not any sand elsewhere
    const shore: [number, number, number, number][] = [];   // world x, z, and the direction to the water
    let sx = 0, sz = 0;
    for (let y = 0; y < d.H; y++) for (let x = 0; x < 30; x++) {
      if (!sandy(at(x, y))) continue;
      const X = (x + 0.5) * T, Z = (y + 0.5) * T; this.sand.push([X, Z]); sx += X; sz += Z;
      for (const [dx, dy] of [[-1, 0], [0, -1], [1, 0], [0, 1]]) if (at(x + dx, y + dy) === 'W') shore.push([X + dx * T * 0.5, Z + dy * T * 0.5, dx, dy]);
    }
    if (!this.sand.length) return;
    this.centre = { x: sx / this.sand.length, z: sz / this.sand.length };
    const M = (x: number, y: number, z: number, ang = 0, s = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ang), new THREE.Vector3(s, s, s));
    const isSand = (X: number, Z: number) => sandy(at(Math.floor(X / T), Math.floor(Z / T)));

    // foam: short white bars along every bit of the water's edge, rolling in and out
    const bars: THREE.Matrix4[] = [];
    for (const [X, Z, dx, dy] of shore) for (let k = -2; k <= 2; k++) {
      const along = k * 4 + (this.rnd() - 0.5) * 2, x = X + (dy !== 0 ? along : 0), z = Z + (dx !== 0 ? along : 0);
      bars.push(M(x, WATER_Y + 0.08, z, dx !== 0 ? Math.PI / 2 : 0));
    }
    this.foamBase = bars;
    this.foam = new THREE.InstancedMesh(new THREE.BoxGeometry(4.2, 0.06, 0.7), new THREE.MeshBasicMaterial({ color: 0xf6f8f4, transparent: true, opacity: 0.85 }), bars.length);
    bars.forEach((m, i) => this.foam!.setMatrixAt(i, m)); this.group.add(this.foam);

    // casuarinas: tall, thin, dark-green trees in rows along the inland edge of the sand
    const cas: THREE.Matrix4[] = [];
    for (const [X, Z] of this.sand) for (let k = 0; k < 3; k++) {
      const x = X + (this.rnd() - 0.5) * T, z = Z + (this.rnd() - 0.5) * T;
      const inland = !isSand(x + 9, z) || !isSand(x, z + 9);       // the land side of the beach (east and south)
      if (!inland || !free(x, z) || this.g.isWet(x, z)) continue;
      cas.push(M(x, this.g.heightAt(x, z), z, this.rnd() * 6, 0.8 + this.rnd() * 0.5));
    }
    const casGeo = mergeGeometries([
      tint(new THREE.CylinderGeometry(0.18, 0.3, 6, 5).translate(0, 3, 0), 0x5a4030),
      tint(new THREE.ConeGeometry(1.9, 9, 7).translate(0, 9.5, 0), 0x2f4a2a),
      tint(new THREE.ConeGeometry(1.4, 5, 7).translate(0, 13, 0), 0x35552e),
    ])!;
    this.inst(casGeo, new THREE.MeshLambertMaterial({ vertexColors: true }), cas);

    // carts: bhel-puri and corn, each with a striped umbrella, on the sand a little back from the water
    const carts: THREE.Matrix4[] = [];
    const spots = this.sand.filter(([X, Z]) => isSand(X - T, Z) && free(X, Z));
    for (let i = 0; i < spots.length && carts.length < 7; i += Math.max(1, Math.floor(spots.length / 7))) {
      const [X, Z] = spots[i]; carts.push(M(X + 4, this.g.heightAt(X, Z), Z - 3, this.rnd() * 6));
    }
    const cartGeo = mergeGeometries([
      tint(new THREE.BoxGeometry(2.2, 1.0, 1.2).translate(0, 1.0, 0), 0x2f7fc1),
      tint(new THREE.BoxGeometry(2.3, 0.15, 1.3).translate(0, 1.55, 0), 0xe8e2d4),
      tint(new THREE.CylinderGeometry(0.35, 0.35, 0.12, 8).rotateX(Math.PI / 2).translate(-0.8, 0.35, 0.65), 0x222222),
      tint(new THREE.CylinderGeometry(0.35, 0.35, 0.12, 8).rotateX(Math.PI / 2).translate(0.8, 0.35, 0.65), 0x222222),
      tint(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 4).translate(0, 2.7, 0), 0x777777),
      tint(new THREE.ConeGeometry(2, 0.8, 8).translate(0, 4.0, 0), 0xe0482a),
      tint(new THREE.ConeGeometry(2.02, 0.4, 8).translate(0, 3.8, 0), 0xf2c230),
    ])!;
    this.inst(cartGeo, new THREE.MeshLambertMaterial({ vertexColors: true }), carts);
    // and a lamp on each cart that glows at night
    for (const m of carts) { const p = new THREE.Vector3().setFromMatrixPosition(m); const l = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffd27a })); l.position.set(p.x, p.y + 2.1, p.z); this.group.add(l); }

    // people strolling along the sand
    const coats = [0xd0342c, 0x2f7fc1, 0xf2c230, 0xffffff, 0x2c9a52, 0xe07ab0];
    for (let i = 0; i < 16 && spots.length > 1; i++) {
      const a = spots[Math.floor(this.rnd() * spots.length)], b = spots[Math.floor(this.rnd() * spots.length)];
      if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 30) continue;
      const o = new THREE.Group(), c = coats[i % coats.length];
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 1.3, 6), new THREE.MeshLambertMaterial({ color: c })); body.position.y = 1.15; o.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), new THREE.MeshLambertMaterial({ color: 0x8a5a3a })); head.position.y = 2.05; o.add(head);
      const legs = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.6, 0.3), new THREE.MeshLambertMaterial({ color: 0x2a2a3a })); legs.position.y = 0.3; o.add(legs);
      o.traverse(m => { m.castShadow = true; }); this.group.add(o);
      this.walkers.push({ obj: o, a: [a[0], a[1]], b: [b[0], b[1]], t: this.rnd(), sp: 0.012 + this.rnd() * 0.01 });
    }

    // the arch at the entrance: two white pillars and a blue board, MIRAMAR
    let gate: [number, number] | null = null, gd = 1e9;
    for (const [X, Z] of this.sand) for (const [ox, oz] of [[T, 0], [0, T], [T, T]]) {
      const x = X + ox, z = Z + oz; if (isSand(x, z) || !free(x, z)) continue;
      const dd = Math.hypot(x - this.centre.x - 20, z - this.centre.z); if (dd < gd) { gd = dd; gate = [x, z]; }
    }
    if (gate) {
      const o = new THREE.Group(), white = new THREE.MeshLambertMaterial({ color: 0xf2efe6 });
      for (const px of [-5, 5]) { const p = new THREE.Mesh(new THREE.BoxGeometry(1, 6, 1), white); p.position.set(px, 3, 0); o.add(p); }
      const cv = document.createElement('canvas'); cv.width = 512; cv.height = 96; const c = cv.getContext('2d')!;
      c.fillStyle = '#1f5fa8'; c.fillRect(0, 0, 512, 96); c.fillStyle = '#ffffff'; c.font = '700 64px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('MIRAMAR', 256, 52);
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
      const face = new THREE.MeshLambertMaterial({ map: tex });
      const board = new THREE.Mesh(new THREE.BoxGeometry(11, 2, 0.3), [white, white, white, white, face, face]); board.position.y = 6.6; o.add(board);
      o.position.set(gate[0], this.g.heightAt(gate[0], gate[1]), gate[1]);
      o.rotation.y = Math.atan2(this.centre.x - gate[0], this.centre.z - gate[1]);   // facing the beach
      o.traverse(m => { m.castShadow = true; }); this.group.add(o);
    }
  }

  private inst(geo: THREE.BufferGeometry, m: THREE.Material, list: THREE.Matrix4[]) {
    if (!list.length) return;
    const im = new THREE.InstancedMesh(geo, m, list.length); list.forEach((x, i) => im.setMatrixAt(i, x)); im.castShadow = true; im.receiveShadow = true; this.group.add(im);
  }

  update(dt: number, time: number) {
    // the foam rolls in and out with the waves
    if (this.foam) {
      const m = new THREE.Matrix4(), off = new THREE.Matrix4();
      this.foamBase.forEach((b, i) => {
        const w = Math.sin(time * 0.9 + i * 0.7);
        off.makeTranslation(0, 0, w * 0.8); m.multiplyMatrices(b, off); m.scale(new THREE.Vector3(0.7 + 0.3 * Math.abs(w), 1, 1));
        this.foam!.setMatrixAt(i, m);
      });
      this.foam.instanceMatrix.needsUpdate = true;
    }
    for (const w of this.walkers) {
      w.t += dt * w.sp; const k = 0.5 - 0.5 * Math.cos(w.t * Math.PI);   // there and back
      const x = w.a[0] + (w.b[0] - w.a[0]) * k, z = w.a[1] + (w.b[1] - w.a[1]) * k;
      const dir = Math.sin(w.t * Math.PI) >= 0 ? 1 : -1;
      w.obj.position.set(x, this.g.heightAt(x, z) + Math.abs(Math.sin(time * 6 + w.sp * 99)) * 0.08, z);
      w.obj.rotation.y = Math.atan2((w.b[0] - w.a[0]) * dir, (w.b[1] - w.a[1]) * dir);
    }
  }
}

function tint(geo: THREE.BufferGeometry, hex: number): THREE.BufferGeometry {
  const g = geo.toNonIndexed(), c = new THREE.Color(hex), a = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < a.length; i += 3) { a[i] = c.r; a[i + 1] = c.g; a[i + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); g.deleteAttribute('uv'); return g;
}

/** Load Miramar: the beach scenery, with its waves and walkers moving while it is loaded. */
export function build(ctx: AreaContext): AreaInstance {
  const m = new Miramar(ctx.d, ctx.g, ctx.free);
  return { group: m.group, update: (dt, time) => m.update(dt, time) };
}
