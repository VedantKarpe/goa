// Fontainhas, Panjim's Latin quarter: every house gets a balcão (the raised front porch with built-in seats, two white
// pillars and a little tiled roof) on its street side, a white band under the eaves, and here and there a blue-and-
// white azulejo name plate. By St. Sebastian Chapel stands a white wayside cross. Uncle Agnelo sits out on his balcão:
// talk to him and he sends you looking for one particular azulejo.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Building } from '../world/buildings';
import type { Seg } from '../world/roads';
import { T, type Ground } from '../world/data';
import type { AreaContext, AreaInstance } from './types';
import type { Cast } from '../entities/cast';

const NAMES = ['Casa Rosa', 'Casa Lourdes', 'Vila Fernandes', 'Casa Azul', 'Casa de Sousa', 'Vila Maria', 'Casa Menezes', 'Casa Pinto', 'Vila Gracia', 'Casa Dias'];
const TARGET = 'Casa Lourdes';

export class Fontainhas {
  readonly group = new THREE.Group();
  private uncle = { x: 0, z: 0 };
  private plates: { name: string; x: number; z: number; wall: string }[] = [];
  task: 'none' | 'seek' | 'done' = 'none';
  private target: { x: number; z: number; wall: string } | null = null;

  constructor(houses: Building[], segs: Seg[], g: Ground, chapel: { x: number; z: number } | null) {
    this.group.name = 'fontainhas';
    const quarter = houses.filter(h => h.quarter);
    const white: THREE.BufferGeometry[] = [], tile: THREE.BufferGeometry[] = [], seat: THREE.BufferGeometry[] = [];
    const tileTex = (name: string) => {
      const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128; const c = cv.getContext('2d')!;
      c.fillStyle = '#f6f4ee'; c.fillRect(0, 0, 256, 128);
      c.strokeStyle = '#1f4fa0'; c.lineWidth = 8; c.strokeRect(6, 6, 244, 116);
      c.strokeStyle = '#1f4fa0'; c.lineWidth = 2; for (let x = 32; x < 256; x += 32) { c.beginPath(); c.moveTo(x, 6); c.lineTo(x, 122); c.stroke(); }   // the tile joins
      c.fillStyle = '#1f4fa0'; c.font = 'italic 700 34px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(name, 128, 66);
      const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
    };
    const colourName = (hex: number) => { const c = new THREE.Color(hex), hsl = { h: 0, s: 0, l: 0 }; c.getHSL(hsl); const h = hsl.h * 360; return h < 20 || h > 330 ? (hsl.s > 0.5 && hsl.l > 0.55 ? 'pink' : 'red') : h < 65 ? 'yellow' : h < 170 ? 'green' : 'blue'; };
    let k = 0;
    for (const h of quarter) {
      const p = h.p;
      // the wall that faces the nearest street
      let best = -1, bd = 1e9, sx = 0, sz = 0;
      for (let i = 0; i < p.length; i++) {
        const a = p[i], b = p[(i + 1) % p.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 3) continue;
        const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
        for (const s of segs) {
          if (s.half < 2.5) continue;
          const vx = s.bx - s.ax, vz = s.bz - s.az, L2 = vx * vx + vz * vz || 1, t = Math.max(0, Math.min(1, ((mx - s.ax) * vx + (mz - s.az) * vz) / L2));
          const dd = Math.hypot(s.ax + vx * t - mx, s.az + vz * t - mz) - s.half;
          if (dd < bd) { bd = dd; best = i; sx = s.ax + vx * t; sz = s.az + vz * t; }
        }
      }
      if (best < 0 || bd > 14) continue;
      const a = p[best], b = p[(best + 1) % p.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L;
      let nx = -uz, nz = ux; const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
      if ((sx - mx) * nx + (sz - mz) * nz < 0) { nx = -nx; nz = -nz; }   // outward, toward the street
      const ang = Math.atan2(-uz, ux), y = h.base;   // turns a box's x along the wall
      const depth = Math.min(2.2, Math.max(0.8, bd - 0.5)), w = Math.min(L * 0.6, 5.5);
      const at = (along: number, out: number, up: number) => new THREE.Vector3(mx + ux * along + nx * out, y + up, mz + uz * along + nz * out);
      const box = (sx2: number, sy: number, sz2: number, along: number, out: number, up: number, list: THREE.BufferGeometry[]) => {
        const geo = new THREE.BoxGeometry(sx2, sy, sz2); const m = new THREE.Matrix4().compose(at(along, out, up), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ang), new THREE.Vector3(1, 1, 1));
        geo.applyMatrix4(m); list.push(geo.toNonIndexed());
      };
      // the balcão: a raised floor, low side walls with seats on them, two pillars and a tiled hood, steps in front
      box(w, 0.7, depth, 0, depth / 2, 0.35, white);
      for (const s of [-1, 1]) { box(0.35, 0.6, depth, s * (w / 2 - 0.18), depth / 2, 1.0, white); box(0.5, 0.12, depth * 0.9, s * (w / 2 - 0.5), depth / 2, 0.95, seat); }
      for (const s of [-1, 1]) box(0.3, 2.2, 0.3, s * (w / 2 - 0.2), depth - 0.2, 2.2, white);
      box(w + 0.6, 0.18, depth + 0.4, 0, depth / 2, 3.35, tile);
      box(1.4, 0.35, 0.6, 0, depth + 0.3, 0.17, white);
      // the white band under the eaves, along the street wall
      box(L, 0.4, 0.12, 0, 0.06, h.top - h.base - 0.3, white);
      // every third house: an azulejo name plate beside the door
      if (k % 3 === 0) {
        const name = NAMES[(k / 3) % NAMES.length], wall = h.wall ?? 0xffffff;
        const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.7), new THREE.MeshBasicMaterial({ map: tileTex(name) }));
        const pos = at(w / 2 + 0.9, 0.07, 2.2); plate.position.copy(pos); plate.rotation.y = Math.atan2(nx, nz); this.group.add(plate);
        this.plates.push({ name, x: pos.x, z: pos.z, wall: colourName(wall) });
      }
      // Uncle Agnelo sits on the balcão nearest the chapel
      if (chapel && (this.uncle.x === 0 || Math.hypot(mx - chapel.x, mz - chapel.z) < Math.hypot(this.uncle.x - chapel.x, this.uncle.z - chapel.z))) { const u = at(-w / 2 + 0.6, depth / 2, 0.7); this.uncle = { x: u.x, z: u.z }; }
      k++;
    }
    const mat = (c: number) => new THREE.MeshLambertMaterial({ color: c });
    for (const [list, c] of [[white, 0xf6f2e8], [tile, 0xa8432a], [seat, 0xd8cfbe]] as [THREE.BufferGeometry[], number][]) if (list.length) {
      const m = new THREE.Mesh(mergeGeometries(list)!, mat(c)); m.castShadow = m.receiveShadow = true; this.group.add(m);
    }
    // the uncle: white shirt, grey trousers, a hat, sitting
    if (this.uncle.x) {
      const o = new THREE.Group(), y = g.heightAt(this.uncle.x, this.uncle.z) + 0.7;
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.45, 1.0, 8), mat(0xf4f4f0)); body.position.y = 0.9; o.add(body);
      const legs = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.3, 0.6), mat(0x6a6a72)); legs.position.set(0, 0.4, 0.3); o.add(legs);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), mat(0xa06a48)); head.position.y = 1.65; o.add(head);
      const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.06, 12), mat(0xd8c890)); hat.position.y = 1.9; o.add(hat);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.22, 10), mat(0xd8c890)); top.position.y = 2.0; o.add(top);
      o.position.set(this.uncle.x, y, this.uncle.z); o.traverse(m => { m.castShadow = true; }); this.group.add(o);
    }
    // the wayside cross by the chapel: a white cross on a stepped pedestal
    if (chapel) {
      const x = chapel.x + 14, z = chapel.z + 6;
      const o = new THREE.Group(), w2 = mat(0xfaf8f2);
      for (const [s, hh, y0] of [[3, 0.5, 0.25], [2.2, 0.5, 0.75], [1.2, 1.6, 1.8]] as [number, number, number][]) { const m = new THREE.Mesh(new THREE.BoxGeometry(s, hh, s), w2); m.position.y = y0; o.add(m); }
      const up = new THREE.Mesh(new THREE.BoxGeometry(0.35, 3.4, 0.35), w2); up.position.y = 4.2; o.add(up);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.35, 0.35), w2); bar.position.y = 4.9; o.add(bar);
      o.position.set(x, g.heightAt(x, z), z); o.traverse(m => { m.castShadow = true; }); this.group.add(o);
    }
    const tgt = this.plates.find(q => q.name === TARGET) ?? this.plates[0];
    this.target = tgt ? { x: tgt.x, z: tgt.z, wall: tgt.wall } : null;
  }

  /** Is the child by Uncle Agnelo? */
  nearUncle(x: number, z: number) { return this.uncle.x !== 0 && Math.hypot(this.uncle.x - x, this.uncle.z - z) < 6; }

  /** Talk to the uncle: he sets the azulejo task, or asks how it is going. */
  talk(): string {
    if (this.task === 'none' && this.target) {
      this.task = 'seek';
      return `Uncle Agnelo, on his balcão: "Bom dia, bhurgea! You know, my sister lived in ${TARGET}. A ${this.target.wall} house, blue azulejo by the door, not far from here only. Go find it and tell me it is still standing, no?"`;
    }
    if (this.task === 'seek') return `Uncle Agnelo: "${TARGET}, baba. A ${this.target!.wall} house with the name in blue tiles. Look at every door, slowly, slowly."`;
    return 'Uncle Agnelo: "Obrigado, baba! You made an old man happy. Sit, sit, take some bebinca."';
  }

  /** While looking: has the child found the plate? Returns the line to show. */
  update(x: number, z: number): string | null {
    if (this.task !== 'seek' || !this.target) return null;
    if (Math.hypot(this.target.x - x, this.target.z - z) < 5) { this.task = 'done'; return `${TARGET}! The blue tiles are a bit faded, but there it is. Go and tell Uncle Agnelo.`; }
    return null;
  }

  /** For the minimap: the uncle's spot. */
  get uncleAt() { return this.uncle; }
}

/** Load Fontainhas: balcões, azulejos, the wayside cross, and Uncle Agnelo with his task. */
export function build(ctx: AreaContext): AreaInstance {
  const seb = ctx.d.lm.find(l => l.name === 'sebastian');
  const chapel = seb ? { x: seb.at[0][0] * T, z: seb.at[0][1] * T } : null;
  const f = new Fontainhas(ctx.houses, ctx.segs, ctx.g, chapel);
  const here = chapel ?? f.uncleAt, at = (dx: number, dz: number) => ({ x: here.x + dx, z: here.z + dz });
  // the people of Fontainhas
  const cast: Cast[] = [
    { name: 'Dona Filomena Sequeira', job: 'azulejo painter', outfit: 'frock', top: 0x2a5fb0, bottom: 0x2a5fb0, hair: 'grey', skin: 0, prop: 'bag', old: true, hint: 'precise', workAt: at(40, -30),
      lines: ['Every tile by hand, filho. Cobalt blue, the way my mother taught me.', 'Bring me your house name, I will paint it. Six weeks only.', 'The machine tiles from Bombay have no soul, I tell you.'] },
    { name: 'Ramesh', job: 'waiter at a Fontainhas café', outfit: 'shirt', top: 0xf6f4ee, bottom: 0x2b2b33, hair: 'black', skin: 2, prop: 'none', hint: 'chatty', workAt: at(-50, 20),
      lines: ['Table for one, sir? Ha ha, just joking, bhurgea.', 'Our prawn curry rice is famous, all the tourists come for it.', 'You know the lane with the blue door? My cousin lives there.'] },
    { name: 'Senhor Mascarenhas', job: 'retired, speaks Portuguese', outfit: 'shirt', top: 0xf6edd2, bottom: 0x6a6a72, hair: 'straw', skin: 0, prop: 'cane', old: true, hint: 'vague', workAt: at(10, 40),
      lines: ['Bom dia! Como está? ...Ah, you do not speak Portuguese. Pity, pity.', 'In 1961 I was twenty-two. Everything changed overnight.', 'This street had gas lamps once. Beautiful.'] },
    { name: 'Tanya', job: 'photographer', outfit: 'tee', top: 0xf2c230, bottom: 0x2b2b33, hair: 'long', skin: 1, prop: 'camera', hint: 'precise', workAt: at(-20, -50),
      lines: ['Stand still, the light on this wall is perfect!', 'Fontainhas at 5 pm is the best. Golden, everything golden.', 'I have ten thousand photos of these houses and I am still not done.'] },
  ];
  return {
    group: f.group, cast,
    talk: (px, pz) => (f.nearUncle(px, pz) ? f.talk() : null),
    tick: (px, pz) => { const m = f.update(px, pz); return m ? { msg: m, pts: 40 } : null; },
  };
}
