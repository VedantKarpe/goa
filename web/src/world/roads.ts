// Streets and footpaths: ribbons laid on the ground (bridges held level above the water), each kind merged into one
// mesh. Also the lookup used to keep the streets walkable and to stand people and vehicles on bridges.
import { NEW_LOOK } from './look';
import * as THREE from 'three';
import { Ground, T, pts, bridgeProfiles, type PanjimData, RAW_GROUND } from './data';
import { wear } from './wear';

const ROAD_K = 1.5;                 // streets are drawn 1.5 x their mapped width, as in the canvas game
export interface Seg { ax: number; az: number; bx: number; bz: number; half: number; deck: number | null; deckAt?: (X: number, Z: number) => number }
type Deck = number | null | ((s: number) => number);

/** Points every `step` metres along a line of world points. */
function resample(line: [number, number][], step: number): [number, number][] {
  const out: [number, number][] = [line[0]];
  for (let i = 1; i < line.length; i++) {
    const [ax, az] = line[i - 1], [bx, bz] = line[i], L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L / step));
    for (let k = 1; k <= n; k++) out.push([ax + (bx - ax) * k / n, az + (bz - az) * k / n]);
  }
  return out;
}

/** A ribbon `width` metres wide along `line`, `lift` above the ground (or at `deck` height on a bridge). */
function ribbon(line: [number, number][], width: number, g: Ground, lift: number, deck: Deck, P: number[], I: number[], s0 = 0, U?: number[]) {
  const pl = resample(line, 6), base = P.length / 3, h = width / 2;
  let acc = s0;
  for (let i = 0; i < pl.length; i++) {
    if (i) acc += Math.hypot(pl[i][0] - pl[i - 1][0], pl[i][1] - pl[i - 1][1]);
    const dk = typeof deck === 'function' ? deck(acc) : deck;
    const a = pl[Math.max(0, i - 1)], b = pl[Math.min(pl.length - 1, i + 1)], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const nx = -(b[1] - a[1]) / L, nz = (b[0] - a[0]) / L, [x, z] = pl[i];
    for (const s of [-1, 1]) {
      const X = x + nx * h * s, Z = z + nz * h * s, y = dk !== null ? dk : Math.max(0.6, g.heightAt(RAW_GROUND ? X : x, RAW_GROUND ? Z : z)) + lift;   // level from side to side (the middle's height); never under the river at the bank
      P.push(X, y, Z); U?.push(acc);
    }
    if (i) { const k = base + (i - 1) * 2; I.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
  }
}

/** The painted kerb along the main roads: black and white stripes a metre long (drawn by the shader along the strip). */
function kerbMesh(P: number[], I: number[], U: number[], Tn: number[]): THREE.Mesh {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('along', new THREE.Float32BufferAttribute(U, 1)); geo.setAttribute('tone', new THREE.Float32BufferAttribute(Tn, 1)); geo.setIndex(I); geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 });
  mat.onBeforeCompile = sh => {
    sh.vertexShader = 'attribute float along; attribute float tone; varying float vAlong; varying float vTone;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvAlong = along; vTone = tone;');
    sh.fragmentShader = 'varying float vAlong; varying float vTone;\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= mod(vAlong, 2.0) < 1.0 ? mix(vec3(0.09, 0.09, 0.1), vec3(0.78, 0.16, 0.12), vTone) : vec3(0.96, 0.95, 0.92);');
  };
  mat.customProgramCacheKey = () => 'kerb';
  const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; m.renderOrder = 4; return m;
}

function meshOf(P: number[], I: number[], color: number, offset: number): THREE.Mesh {
  // the layers are drawn in a fixed order, pavement, then path, asphalt, markings, each over the one before, and do not
  // fight each other for depth: so one street's pavement can never show through another street's road surface
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setIndex(I); geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -offset, polygonOffsetUnits: -offset * 2 });
  mat.depthWrite = offset >= 3; const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; m.renderOrder = offset; return m;
}

/** The line `d` metres to the left of `line` (negative: to the right), following its bends. */
function offsetLine(line: [number, number][], d: number): [number, number][] {
  const pl = resample(line, 4);
  return pl.map((q, i) => {
    const a = pl[Math.max(0, i - 1)], b = pl[Math.min(pl.length - 1, i + 1)], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [q[0] - (b[1] - a[1]) / L * d, q[1] + (b[0] - a[0]) / L * d] as [number, number];
  });
}

export function buildRoads(d: PanjimData, g: Ground): { group: THREE.Group; segs: Seg[] } {
  const group = new THREE.Group(); group.name = 'roads';
  const pave: number[] = [], paveI: number[] = [], asph: number[] = [], asphI: number[] = [], path: number[] = [], pathI: number[] = [], dash: number[] = [], dashI: number[] = [], yel: number[] = [], yelI: number[] = [], kerb: number[] = [], kerbI: number[] = [], green: number[] = [], greenI: number[] = [], kb: number[] = [], kbI: number[] = [], kbU: number[] = [], kbT: number[] = [], bollards: THREE.Matrix4[] = [];
  const segs: Seg[] = [];
  const profiles = bridgeProfiles(d, g);
  // where roads lie on top of each other (dual carriageways, slip roads, service roads at a big junction), only the
  // road actually underneath keeps its markings: otherwise every road's dashes are painted across the others
  const C = 25, grid = new Map<number, [number, number, number, number, number, number][]>();
  d.r.forEach(([f, w], ri) => {
    const q = pts(f).map(([x, y]) => [x * T, y * T]);
    for (let i = 1; i < q.length; i++) {
      const sg: [number, number, number, number, number, number] = [q[i - 1][0], q[i - 1][1], q[i][0], q[i][1], w * ROAD_K / 2, ri];
      for (let x = Math.floor((Math.min(sg[0], sg[2]) - 12) / C); x <= Math.floor((Math.max(sg[0], sg[2]) + 12) / C); x++)
        for (let z = Math.floor((Math.min(sg[1], sg[3]) - 12) / C); z <= Math.floor((Math.max(sg[1], sg[3]) + 12) / C); z++) { const k = x * 65536 + z; let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(sg); }
    }
  });
  const onOther = (x: number, z: number, self: number) => {
    for (const [ax, az, bx, bz, h, ri] of grid.get(Math.floor(x / C) * 65536 + Math.floor(z / C)) ?? []) {
      if (ri === self) continue;
      const vx = bx - ax, vz = bz - az, L2 = vx * vx + vz * vz || 1, t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / L2));
      if (Math.hypot(ax + vx * t - x, az + vz * t - z) < h - 0.3) return true;
    }
    return false;
  };
  // divided roads: OpenStreetMap draws each direction of a main road as its own one-way line. Pair each with the one
  // running the other way beside it (within 35 m) and note how far apart they are and on which side the other lies:
  // the two halves are sized to fit side by side, with a raised median between them.
  const pair = new Map<number, { D: number; side: number }>();
  d.r.forEach(([f, , fl, cl], i) => {
    if (!(fl & 4) || cl > 7 || cl % 2 === 1 || (fl & 3)) return;   // main roads only, not their slip roads
    const q = pts(f).map(([x, y]) => [x * T, y * T] as [number, number]); if (q.length < 2) return;
    const S = resample(q, 20), Ds: number[] = []; let side = 0;
    for (let k = 0; k < S.length; k++) {
      const [x, z] = S[k], a = S[Math.max(0, k - 1)], b = S[Math.min(S.length - 1, k + 1)], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, dx = (b[0] - a[0]) / L, dz = (b[1] - a[1]) / L;
      let best = 1e9, nx = 0, nz = 0;
      for (let gx = -1; gx <= 1; gx++) for (let gz = -1; gz <= 1; gz++) for (const [ax, az, cx, cz, , rj] of grid.get((Math.floor(x / C) + gx) * 65536 + Math.floor(z / C) + gz) ?? []) {
        if (rj === i) continue; const o = d.r[rj]; if (!(o[2] & 4) || o[3] > 7 || o[3] % 2 === 1) continue;
        const vx = cx - ax, vz = cz - az, sl = Math.hypot(vx, vz) || 1; if ((vx * dx + vz * dz) / sl > -0.7) continue;   // only one running the other way
        const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (sl * sl))), px = ax + vx * t, pz = az + vz * t, dd = Math.hypot(px - x, pz - z);
        if (dd < best) { best = dd; nx = px; nz = pz; }
      }
      if (best < 35) { Ds.push(best); side += Math.sign((nx - x) * -dz + (nz - z) * dx); }
    }
    if (Ds.length && Ds.length >= S.length * 0.5) { Ds.sort((p, q2) => p - q2); pair.set(i, { D: Ds[Ds.length >> 1], side: Math.sign(side) || 1 }); }
  });
  const otherHalf = (x: number, z: number, dx: number, dz: number, self: number) => {
    let best = 1e9;
    for (let gx = -1; gx <= 1; gx++) for (let gz = -1; gz <= 1; gz++) for (const [ax, az, cx, cz, , rj] of grid.get((Math.floor(x / C) + gx) * 65536 + Math.floor(z / C) + gz) ?? []) {
      if (rj === self || !pair.has(rj)) continue;
      const vx = cx - ax, vz = cz - az, sl = Math.hypot(vx, vz) || 1; if ((vx * dx + vz * dz) / sl > -0.7) continue;
      const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (sl * sl))); best = Math.min(best, Math.hypot(ax + vx * t - x, az + vz * t - z));
    }
    return best;
  };
  const MED = 1.8;   // the median: a raised kerb with a planted strip down the middle
  // the halves are narrower now: the check for 'is this spot on another road' uses their new widths
  for (const cell of grid.values()) for (const sg of cell) { const pr = pair.get(sg[5]); if (pr) sg[4] = Math.min(sg[4], Math.max(6.5, pr.D - MED) / 2); }
  const redKerb = (ni: number) => ni >= 0 && /Jack de Sequeira|Bandodkar/i.test(d.names[ni] ?? '');   // Miramar's red-and-white kerbs
  let ri = -1;
  for (const [f, w, flags, cls, nameI, lanes = 0] of d.r) {
    ri++;
    const line = pts(f).map(([x, y]) => [x * T, y * T] as [number, number]);
    if (line.length < 2) continue;
    const pq = pair.get(ri), bridge = (flags & 1) !== 0;
    const one = !!pq && pq.D < 13;            // the two halves of one ordinary road (OSM splits some): meet in the middle, a broken centre line
    const pr = one ? undefined : pq;          // a real dual carriageway: a median between the halves
    const width = one ? Math.max(5, pq!.D * 1.02) : pr ? Math.max(6.5, Math.min(w * ROAD_K, pr.D - MED)) : w * ROAD_K;   // a half of a divided road fits beside its other half
    // a bridge is held level: at the height of the higher of its two ends, and never lower than 5 m over the water
    const prof = bridge ? profiles.get(f) ?? null : null;
    const deck: Deck = prof, shift = (k: number): Deck => (prof ? (s: number) => prof(s) + k : null);
    if (!pr) ribbon(line, width + (width >= 12 ? 5 : 3), g, 0.12, shift(-0.05), pave, paveI);
    else {
      ribbon(offsetLine(line, -pr.side * (width / 2 + 1.4)), 2.8, g, 0.12, shift(-0.05), pave, paveI);   // the pavement on the outer side only
      if (!bridge) {   // the median on the inner side: this half's share of the kerb, and of the planted strip
        const ml = resample(line, 4), ko = offsetLine(line, pr.side * (width / 2 + MED / 4)), go = offsetLine(line, pr.side * (width / 2 + MED / 2 - 0.2));
        for (let i = 0; i + 1 < ml.length && i + 1 < ko.length && i + 1 < go.length; i++) {
          const a = ml[i], b = ml[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, oh = otherHalf((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (b[0] - a[0]) / L, (b[1] - a[1]) / L, ri);
          if (oh > pr.D * 1.35 || oh < width / 2) continue;   // the halves part here (a junction, a slip road): no median
          if (pr.D >= 20) { ribbon([ko[i], ko[i + 1]], MED / 2, g, 0.36, null, kerb, kerbI); ribbon([go[i], go[i + 1]], 0.4, g, 0.4, null, green, greenI); }
          else {   // a low striped kerb down the middle, orange bollards on it (as at Miramar)
            const n0 = kbU.length; ribbon([ko[i], ko[i + 1]], MED / 2, g, 0.3, null, kb, kbI, i * 4, kbU); for (let q = n0; q < kbU.length; q++) kbT.push(redKerb(nameI) ? 1 : 0);
            if (pr.side > 0) for (let t = 0; t < 1; t += 0.75) { const x = go[i][0] + (go[i + 1][0] - go[i][0]) * t, z = go[i][1] + (go[i + 1][1] - go[i][1]) * t; bollards.push(new THREE.Matrix4().makeTranslation(x, Math.max(0.6, g.heightAt(x, z)) + 0.3, z)); }
          }
        }
      }
    }
    ribbon(line, width, g, 0.2, deck, asph, asphI);
    // road markings as on the real road (OpenStreetMap's type, lanes and one-way), the Indian way:
    //  - the lanes and side streets (residential, service, unclassified): none, as in Goa
    //  - a two-lane two-way road: one broken white centre line
    //  - four lanes or more, two-way: a double solid yellow centre line, broken white lines between the lanes
    //  - a one-way carriageway (each half of a divided road like D. B. Marg): broken white lines between its lanes
    //  - trunk, primary and secondary roads: solid white edge lines as well
    const main = cls <= 7, oneway = (flags & 4) !== 0, round = (flags & 2) !== 0;
    if (main && !round && width >= 6) {
      const L = lanes > 0 ? lanes : oneway ? (cls <= 3 ? 2 : 1) : cls <= 1 ? 4 : 2, lw = width / L;
      const broken = (off: number) => { const pl = resample(offsetLine(line, off), 1.5); for (let i = 0; i + 2 < pl.length; i += 5) if (!onOther((pl[i][0] + pl[i + 2][0]) / 2, (pl[i][1] + pl[i + 2][1]) / 2, ri)) ribbon([pl[i], pl[i + 1], pl[i + 2]], 0.2, g, 0.28, shift(0.05), dash, dashI, i * 1.5); };   // 3 m of line, 4.5 m gap
      const solid = (off: number, P: number[], I: number[], w2 = 0.2) => { const el = resample(offsetLine(line, off), 3); for (let i = 0; i + 1 < el.length; i++) if (!onOther((el[i][0] + el[i + 1][0]) / 2, (el[i][1] + el[i + 1][1]) / 2, ri)) ribbon([el[i], el[i + 1]], w2, g, 0.28, shift(0.05), P, I, i * 3); };
      if (one) { for (let k = 1; k < L; k++) broken(-width / 2 + k * lw); broken(pq!.side * width / 2); }   // its lane lines, and its half of the centre line
      else if (oneway) for (let k = 1; k < L; k++) broken(-width / 2 + k * lw);                          // between the lanes of one direction
      else if (L <= 2) broken(0);                                                                   // the centre line
      else { solid(-0.22, yel, yelI, 0.16); solid(0.22, yel, yelI, 0.16); for (let k = 1; k < L / 2; k++) { broken(k * lw); broken(-k * lw); } }
      // the painted kerb (black and white) along the outer edges, left out across side-street mouths
      if (!bridge) for (const sd of [-1, 1]) {
        if ((pr || one) && sd === (pr ?? pq)!.side) continue;
        const kl = resample(offsetLine(line, sd * (width / 2 + 0.2)), 6);
        let along = 0;
        for (let i = 0; i + 1 < kl.length; i++) {
          const seg = Math.hypot(kl[i + 1][0] - kl[i][0], kl[i + 1][1] - kl[i][1]);
          if (!onOther((kl[i][0] + kl[i + 1][0]) / 2, (kl[i][1] + kl[i + 1][1]) / 2, ri)) { const n0 = kbU.length; ribbon([kl[i], kl[i + 1]], 0.4, g, 0.32, shift(0.1), kb, kbI, along, kbU); for (let q = n0; q < kbU.length; q++) kbT.push(redKerb(nameI) ? 1 : 0); }
          along += seg;
        }
      }
      if (cls <= 5 && width >= 9) for (const sd of [-1, 1]) solid(sd * (width / 2 - 0.55), pr && sd === pr.side ? yel : dash, pr && sd === pr.side ? yelI : dashI);   // edge lines on the main roads (yellow by the median)
      else if (pr) solid(pr.side * (width / 2 - 0.45), yel, yelI, 0.16);
    }
    let s0 = 0;
    for (let i = 1; i < line.length; i++) {
      const ax = line[i - 1][0], az = line[i - 1][1], bx = line[i][0], bz = line[i][1], len = Math.hypot(bx - ax, bz - az), from = s0;
      const deckAt = prof ? (X: number, Z: number) => prof(from + Math.max(0, Math.min(len, ((X - ax) * (bx - ax) + (Z - az) * (bz - az)) / (len || 1)))) : undefined;
      segs.push({ ax, az, bx, bz, half: width / 2 + 1, deck: prof ? Math.max(prof(from), prof(from + len)) : null, deckAt });
      s0 += len;
    }
  }
  for (const [f, flags] of d.p) {
    const line = pts(f).map(([x, y]) => [x * T, y * T] as [number, number]);
    if (line.length < 2) continue;
    ribbon(line, 2.2, g, 0.16, (flags & 2) ? Math.max(4, g.heightAt(...line[0]) + 0.3) : null, path, pathI);
    for (let i = 1; i < line.length; i++) segs.push({ ax: line[i - 1][0], az: line[i - 1][1], bx: line[i][0], bz: line[i][1], half: 1.6, deck: null });
  }
  const pv = meshOf(pave, paveI, NEW_LOOK ? 0xd6cbb6 : 0xa65a46, 1), as = meshOf(asph, asphI, NEW_LOOK ? 0x6a6c71 : 0x5c5e62, 2), mk = meshOf(dash, dashI, NEW_LOOK ? 0xfbf8f0 : 0xf2efe6, 3), yk = meshOf(yel, yelI, 0xf2c230, 3);
  wear(pv.material as THREE.Material, 'pavement'); wear(as.material as THREE.Material, 'asphalt'); wear(mk.material as THREE.Material, 'paint');   // worn, as Panjim's are
  wear(yk.material as THREE.Material, 'paint');
  group.add(pv, meshOf(path, pathI, 0xcdb98e, 1), as, mk, yk, meshOf(kerb, kerbI, 0xe2dccd, 4), meshOf(green, greenI, 0x5e9440, 5), kerbMesh(kb, kbI, kbU, kbT));
  // the orange bollards on the narrow medians (one instanced mesh)
  if (bollards.length) {
    const bg = new THREE.CylinderGeometry(0.07, 0.08, 0.9, 6).translate(0, 0.45, 0), bm = new THREE.MeshLambertMaterial({ color: 0xf07a22 });
    const im = new THREE.InstancedMesh(bg, bm, bollards.length); bollards.forEach((m, i) => im.setMatrixAt(i, m)); im.name = 'bollards'; im.castShadow = true; group.add(im);
  }
  return { group, segs };
}

/** A grid of street segments for quick "is this on a street?" lookups. */
export class StreetIndex {
  private cells = new Map<number, Seg[]>();
  private static C = 20;
  constructor(segs: Seg[]) {
    const C = StreetIndex.C;
    for (const s of segs) {
      const x0 = Math.floor((Math.min(s.ax, s.bx) - s.half) / C), x1 = Math.floor((Math.max(s.ax, s.bx) + s.half) / C);
      const z0 = Math.floor((Math.min(s.az, s.bz) - s.half) / C), z1 = Math.floor((Math.max(s.az, s.bz) + s.half) / C);
      for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) { const k = x * 65536 + z; let a = this.cells.get(k); if (!a) this.cells.set(k, a = []); a.push(s); }
    }
  }
  /** The street segment under (X, Z), if any. */
  at(X: number, Z: number): Seg | null {
    const a = this.cells.get(Math.floor(X / StreetIndex.C) * 65536 + Math.floor(Z / StreetIndex.C));
    if (!a) return null;
    for (const s of a) {
      const ex = s.bx - s.ax, ez = s.bz - s.az, L2 = ex * ex + ez * ez || 1e-9, t = Math.max(0, Math.min(1, ((X - s.ax) * ex + (Z - s.az) * ez) / L2));
      if (Math.hypot(X - s.ax - ex * t, Z - s.az - ez * t) < s.half) return s;
    }
    return null;
  }
}
