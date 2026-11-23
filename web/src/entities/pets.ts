// Goa's street dogs and cats. The dogs (tan pariah dogs mostly, a few black and patchy ones) nap in the shade, trot
// along the pavements and sniff about; the cats sit about and slink between the houses. Feed a dog three times (Talk,
// standing by it) and it is yours for the day: it gets a name, follows you about, rides along in the car and barks at
// the rental Thars. Cats take your biscuits and give you nothing. No saved progress: each day, a new friend.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Network } from '../world/network';

type Kind = 'dog' | 'cat';
interface Pet { kind: Kind; obj: THREE.Group; body: THREE.Mesh; x: number; z: number; h: number; hx: number; hz: number;
  tx: number; tz: number; state: 'nap' | 'sit' | 'walk'; t: number; fed: number; name: string }

const DOG_COLS: [number, number][] = [[0xc89a5e, 0xe8d0a8], [0xb07a42, 0xe0c090], [0x2a2420, 0x4a3a30], [0xe8e0d0, 0x9a6a3a], [0xd0a060, 0xf2e6cc]];
const CAT_COLS: [number, number][] = [[0x8a8a8e, 0xc8c8cc], [0xe08a3a, 0xf2d0a0], [0x1e1c1c, 0x3a3434], [0xf0ece4, 0xd88a3a]];
const NAMES = ['Bruno', 'Tiger', 'Rocky', 'Julie', 'Kalu', 'Moti', 'Lucky', 'Sheru', 'Brownie', 'Rani', 'Tommy', 'Kaju'];

function tinted(g: THREE.BufferGeometry, hex: number) {
  const n = g.index ? g.toNonIndexed() : g, c = new THREE.Color(hex), a = new Float32Array(n.attributes.position.count * 3);
  for (let i = 0; i < a.length; i += 3) { a[i] = c.r; a[i + 1] = c.g; a[i + 2] = c.b; }
  n.setAttribute('color', new THREE.BufferAttribute(a, 3)); if (n.attributes.uv) n.deleteAttribute('uv'); return n;
}

/** One animal as a single merged mesh (one draw call), facing +x. */
function animalGeo(kind: Kind, col: number, belly: number, lying: boolean): THREE.BufferGeometry {
  const p: THREE.BufferGeometry[] = [], s = kind === 'dog' ? 1.4 : 0.8, legH = lying ? 0.06 : 0.42 * s, by = legH + 0.2 * s;
  p.push(tinted(new THREE.BoxGeometry(0.85 * s, 0.34 * s, 0.32 * s).translate(0, by, 0), col));                               // body
  p.push(tinted(new THREE.BoxGeometry(0.6 * s, 0.1 * s, 0.26 * s).translate(0, by - 0.16 * s, 0), belly));                     // pale belly
  p.push(tinted(new THREE.BoxGeometry(0.3 * s, 0.28 * s, 0.26 * s).translate(0.5 * s, by + 0.18 * s, 0), col));                // head
  p.push(tinted(new THREE.BoxGeometry(0.18 * s, 0.13 * s, 0.16 * s).translate(0.7 * s, by + 0.12 * s, 0), kind === 'dog' ? belly : col));   // muzzle
  p.push(tinted(new THREE.BoxGeometry(0.05 * s, 0.05 * s, 0.07 * s).translate(0.8 * s, by + 0.16 * s, 0), 0x161212));          // nose
  for (const z of [-0.09, 0.09]) {
    p.push(tinted(new THREE.ConeGeometry(0.07 * s, kind === 'dog' ? 0.18 * s : 0.14 * s, 4).translate(0.46 * s, by + 0.38 * s, z * s), col));   // ears up
    p.push(tinted(new THREE.BoxGeometry(0.03 * s, 0.05 * s, 0.05 * s).translate(0.64 * s, by + 0.24 * s, z * 0.9 * s), 0x161212));             // eyes
  }
  if (!lying) for (const x of [-0.3, 0.3]) for (const z of [-0.11, 0.11]) p.push(tinted(new THREE.BoxGeometry(0.09 * s, legH, 0.09 * s).translate(x * s, legH / 2, z * s), col));
  // the tail: a dog's curls up over its back, a cat's stands up
  p.push(tinted(new THREE.CylinderGeometry(0.035 * s, 0.05 * s, 0.4 * s, 5).rotateZ(kind === 'dog' ? 0.9 : 0.25).translate(-0.52 * s, by + 0.22 * s, 0), col));
  return mergeGeometries(p)!;
}

function rng(seed: number) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

export class Pets {
  group = new THREE.Group();
  list: Pet[] = [];
  /** The child's own dog today. */
  mine: Pet | null = null;
  private barkT = 0;
  private mat = new THREE.MeshLambertMaterial({ vertexColors: true });

  constructor(net: Network, private ground: (x: number, z: number) => number, private free: (x: number, z: number) => boolean) {
    this.group.name = 'pets';
    const rnd = rng(311), E = net.edges, geos = new Map<string, THREE.BufferGeometry>();
    const geo = (kind: Kind, c: [number, number], lying: boolean) => { const k = `${kind}${c[0]}${lying}`; let g = geos.get(k); if (!g) geos.set(k, g = animalGeo(kind, c[0], c[1], lying)); return g; };
    let dogs = 0, cats = 0;
    for (let i = 0; i < E.length && (dogs < 80 || cats < 45); i += 1 + Math.floor(rnd() * 12)) {
      const e = E[i]; if (e.len < 25) continue;
      const kind: Kind = dogs < 80 && (cats >= 45 || rnd() < 0.62) ? 'dog' : 'cat';
      const p = net.at(i, e.len * rnd()), side = rnd() < 0.5 ? -1 : 1, off = e.width / 2 + (kind === 'dog' ? 1.5 : 3.5) + rnd() * 2;
      const x = p.x + p.dz * off * side, z = p.z - p.dx * off * side;
      if (!free(x, z)) continue;
      const cols = kind === 'dog' ? DOG_COLS : CAT_COLS, c = cols[Math.floor(rnd() * cols.length)];
      const obj = new THREE.Group(), body = new THREE.Mesh(geo(kind, c, false), this.mat);
      body.castShadow = true; obj.add(body);
      obj.userData.stand = body.geometry; obj.userData.lie = geo(kind, c, true);
      const h = rnd() * Math.PI * 2;
      obj.position.set(x, ground(x, z), z); obj.rotation.y = -h;
      this.group.add(obj);
      this.list.push({ kind, obj, body, x, z, h, hx: x, hz: z, tx: x, tz: z, state: rnd() < 0.5 ? 'nap' : 'sit', t: rnd() * 8, fed: 0, name: NAMES[Math.floor(rnd() * NAMES.length)] });
      if (kind === 'dog') dogs++; else cats++;
    }
  }

  near(px: number, pz: number, r = 3.2): Pet | null {
    let best: Pet | null = null, bd = r;
    for (const p of this.list) { if (p === this.mine) continue; const d = Math.hypot(p.x - px, p.z - pz); if (d < bd) { bd = d; best = p; } }
    return best;
  }

  /** Talk, standing by an animal: feed it a biscuit. Three biscuits and a dog is your friend for the day. */
  feed(p: Pet): string {
    p.fed++; p.state = 'sit'; p.t = 4;
    if (p.kind === 'cat') return ['The cat sniffs the biscuit, eats it, and looks at you like you owe it money.', 'Meow. The cat takes the biscuit and walks off without a thank you. Typical.', 'The cat accepts your offering. You are now its servant, not its owner.'][Math.min(2, p.fed - 1)];
    if (p.fed === 1) return 'You give the dog a Marie biscuit. Its tail starts going. Give it one more?';
    if (p.fed === 2) return 'Another biscuit! The dog sits close and leans on your leg. One more and it is yours, baba.';
    if (this.mine) { this.mine.state = 'nap'; }   // the old friend goes back to its nap spot
    this.mine = p;
    return `The dog follows you now! You call it ${p.name}. "${p.name}! ${p.name}!" Woof. (It will ride in the car with you, and bark at the rental cars.)`;
  }

  /** Each frame. `ride`: the child is in a vehicle (the pet waits in the car). `danger`: a rental car within this many metres. */
  update(dt: number, px: number, pz: number, run: boolean, ride: boolean, danger: number, bark: () => void) {
    this.barkT -= dt;
    for (const p of this.list) {
      let moving = false;
      if (p === this.mine) {
        p.obj.visible = !ride;
        if (ride) { p.x = px; p.z = pz; continue; }
        const d = Math.hypot(px - p.x, pz - p.z);
        if (d > 60) { p.x = px - 2; p.z = pz - 2; }                                     // left far behind: it finds you
        if (d > 2.6) {
          const sp = Math.min(d * 2.2, run ? 70 : 40) * dt, nx = p.x + (px - p.x) / d * sp, nz = p.z + (pz - p.z) / d * sp;
          p.h = Math.atan2(pz - p.z, px - p.x); p.x = nx; p.z = nz; moving = true;
        } else p.h = Math.atan2(pz - p.z, px - p.x);
        if (danger < 40 && this.barkT <= 0) { this.barkT = 1.2; bark(); }
      } else {
        p.t -= dt;
        if (p.t <= 0) {   // choose what to do next: nap, sit, or a little stroll near home
          const r = Math.random();
          if (r < 0.35) { p.state = 'nap'; p.t = 8 + Math.random() * 14; }
          else if (r < 0.6) { p.state = 'sit'; p.t = 4 + Math.random() * 6; }
          else {
            const a = Math.random() * Math.PI * 2, rr = 3 + Math.random() * (p.kind === 'dog' ? 12 : 6), tx = p.hx + Math.cos(a) * rr, tz = p.hz + Math.sin(a) * rr;
            if (this.free(tx, tz)) { p.state = 'walk'; p.tx = tx; p.tz = tz; p.t = 12; } else { p.state = 'sit'; p.t = 3; }
          }
        }
        if (p.state === 'walk') {
          const d = Math.hypot(p.tx - p.x, p.tz - p.z);
          if (d < 0.3) { p.state = 'sit'; p.t = 3 + Math.random() * 4; }
          else { const sp = (p.kind === 'dog' ? 1.6 : 1.1) * dt; p.h = Math.atan2(p.tz - p.z, p.tx - p.x); p.x += (p.tx - p.x) / d * sp; p.z += (p.tz - p.z) / d * sp; moving = true; }
        }
        // a dog close by looks at you (and wags)
        if (p.kind === 'dog' && Math.hypot(px - p.x, pz - p.z) < 6 && p.state !== 'walk') p.h = Math.atan2(pz - p.z, px - p.x);
      }
      const lying = !moving && p.state === 'nap' && p !== this.mine;
      const want = lying ? p.obj.userData.lie : p.obj.userData.stand;
      if (p.body.geometry !== want) p.body.geometry = want;
      const bob = moving ? Math.abs(Math.sin(performance.now() / 90 + p.hx)) * 0.06 : 0;
      p.obj.position.set(p.x, this.ground(p.x, p.z) + bob, p.z); p.obj.rotation.y = -p.h;
      p.body.rotation.x = !moving && !lying && p.kind === 'dog' && p === this.mine ? Math.sin(performance.now() / 70) * 0.04 : 0;   // a wag of the whole dog
    }
  }

  /** Out of the car: the pet hops out beside you. */
  hopOut(px: number, pz: number) { if (this.mine) { this.mine.x = px + 1.5; this.mine.z = pz + 1; } }
}
