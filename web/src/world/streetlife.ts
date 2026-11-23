// The things that make a street look lived in: cars and scooters parked along the kerb, zebra crossings at the
// junctions, and compound walls of red laterite along the plots. All instanced or merged, so they cost a few draws.
import * as THREE from 'three';
import { buildCar, pick, ROAD_MIX } from '../entities/cars';
import { CHUNK } from './buildings';
import type { CarModel } from '../entities/cars';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Network } from './network';
import type { Ground } from './data';

const CAR_COLS = [0xd8d4c8, 0xb02a2a, 0x2a4c8a, 0x1d1d22, 0x8c8c90, 0xe8e2d0, 0x3b6b45, 0xf2efe6, 0x6a2a2a];

function painted(geo: THREE.BufferGeometry, hex: number): THREE.BufferGeometry {
  const g = geo.toNonIndexed(), c = new THREE.Color(hex), a = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < a.length; i += 3) { a[i] = c.r; a[i + 1] = c.g; a[i + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); g.deleteAttribute('uv'); return g;
}

/** A parked car on the kerb: where it is, what it is, and where its triangles are in its chunk's mesh (so it can be
 *  taken out when someone drives it away). */
export interface ParkedCar { x: number; z: number; h: number; model: CarModel; col: number | null; mesh: THREE.Mesh | null; start: number; count: number }

export function buildStreetLife(net: Network, g: Ground, free: (x: number, z: number) => boolean): { group: THREE.Group; parked: ParkedCar[] } {
  const group = new THREE.Group(); group.name = 'street life';
  // merged by map squares (CHUNK metres), so far-off squares are hidden like the buildings' (it was one mesh for the whole map)
  const cb = new Map<number, { geos: THREE.BufferGeometry[]; cars: ParkedCar[] }>(), zb = new Map<number, THREE.BufferGeometry[]>();
  const key = (x: number, z: number) => Math.floor(x / CHUNK) * 4096 + Math.floor(z / CHUNK);
  const parked: ParkedCar[] = [];
  let seed = 77; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const at = (x: number, z: number) => g.heightAt(x, z);
  for (let e = 0; e < net.edges.length; e++) {
    const E = net.edges[e];
    if (E.deck !== null) continue;
    // parked cars along the kerb, on whichever side, leaving the junctions clear
    if (E.width >= 7) for (let s = 14; s < E.len - 14; s += 9 + rnd() * 30) {
      if (rnd() < 0.45) continue;
      const p = net.at(e, s), sd = E.oneWay ? 1 : rnd() < 0.5 ? 1 : -1, off = E.width / 2 - 1.4;   // one-way halves: only the outer (left) kerb, never the middle of the road;   // just inside the kerb (E.width is already the drawn width)
      const x = p.x + p.dz * off * sd, z = p.z - p.dx * off * sd;
      // never on the river side: that kerb is the promenade (or the bank)
      let wet = false; for (let k = 2; k <= 30 && !wet; k += 4) if (g.landAt(x + p.dz * sd * k, z - p.dx * sd * k) < 0.5) wet = true;
      if (wet || !free(x, z)) continue;   // and never somewhere taken (a building, a flyover ramp over the kerb)
      const c = CAR_COLS[Math.floor(rnd() * CAR_COLS.length)], ang = -Math.atan2(p.dz, p.dx), y = Math.max(0.6, at(x, z)) + 0.2;
      // a real Goan car (Swift, Alto, Innova, Thar...), parked
      const model = pick(ROAD_MIX, rnd()), col = Math.random() < 0.5 ? c : null;
      const built = buildCar(model, col, 'private'), car = ((built.obj.children[0] as THREE.Mesh).geometry as THREE.BufferGeometry).clone();
      car.scale(1.6, 1.6, 1.6); car.rotateY(ang); car.translate(x, y, z);
      const k = key(x, z); let b = cb.get(k); if (!b) cb.set(k, b = { geos: [], cars: [] });
      const pc: ParkedCar = { x, z, h: -ang, model, col, mesh: null, start: 0, count: car.attributes.position.count }; b.geos.push(car); b.cars.push(pc); parked.push(pc);
    }
  }
  // zebra crossings where three or more streets meet, a few metres into each street
  for (const n of net.nodes) {
    if (n.out.length < 3) continue;
    for (const e of n.out) {
      const E = net.edge(e); if (E.deck !== null || E.len < 20 || E.width < 7) continue;
      const p = net.at(e, 9), w = E.width - 1, ang = -Math.atan2(p.dz, p.dx), y = Math.max(0.6, at(p.x, p.z)) + 0.26;
      for (let k = -w / 2 + 0.6; k < w / 2; k += 1.4) {
        const st = new THREE.BoxGeometry(2.6, 0.04, 0.7).translate(0, 0, k);
        st.rotateY(ang); st.translate(p.x, y, p.z); const kk = key(p.x, p.z); let b = zb.get(kk); if (!b) zb.set(kk, b = []); b.push(painted(st, 0xf2efe6));
      }
    }
  }
  const lam = (vc: boolean, color = 0xffffff, extra: THREE.MeshLambertMaterialParameters = {}) => new THREE.MeshLambertMaterial({ vertexColors: vc, color, ...extra });
  const carMat = lam(true), zebraMat = lam(true, 0xffffff, { polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 });
  const place = (m: THREE.Mesh, k: number) => { m.userData.cx = (Math.floor(k / 4096) + 0.5) * CHUNK; m.userData.cz = ((k % 4096 + 4096) % 4096 + 0.5) * CHUNK; group.add(m); };
  for (const [k, b] of cb) {
    const m = new THREE.Mesh(mergeGeometries(b.geos)!, carMat); m.castShadow = true; m.receiveShadow = true; place(m, k);
    let at0 = 0; for (const pc of b.cars) { pc.mesh = m; pc.start = at0; at0 += pc.count; }
  }
  for (const [k, z] of zb) { const m = new THREE.Mesh(mergeGeometries(z)!, zebraMat); m.receiveShadow = true; place(m, k); }
  void free;
  return { group, parked };
}
