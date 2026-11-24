// Every building from its real outline: walls extruded to its storeys on a level plot, a flat terrace or a hipped
// Mangalore-tile roof, all merged into one mesh (one draw call) with ink outlines, plus the lookup that makes them solid.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Ground, T, pts, inPoly, type PanjimData } from './data';
import { BAY, facadeTexture, facadeMaterial } from './facade';
import { NEW_LOOK } from './look';
const LIME = new THREE.Color(0xf2e8d2);

/** How lit the windows are (0 by day, 1 at night); the clock sets it. */
export const windowsLit = { value: 0 };

/** Texture coordinates: walls run along the wall in bays and up in storeys from `base`; roofs get a plain spot. */
function wallUV(geo: THREE.BufferGeometry, base: number) {
  const p = geo.attributes.position, n = geo.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const nx = n.getX(i), ny = n.getY(i), nz = n.getZ(i);
    if (Math.abs(ny) > 0.5) { uv[i * 2] = 0.01; uv[i * 2 + 1] = 0.6; continue; }
    uv[i * 2] = (p.getX(i) * -nz + p.getZ(i) * nx) / BAY; uv[i * 2 + 1] = (p.getY(i) - base) / BAY;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

// Goan house colours: ochre, indigo blue, pink, sea green, Goan red, lime yellow, sky blue, cream (a touch weathered)
const PALETTE = [0xd8332b, 0x7cc8ee, 0xf7cc2e, 0xe8483a, 0x52b0e0, 0xf2b42a, 0x48b878, 0xf08aa8, 0xf6edd2, 0xc8302a, 0x88dcc8, 0xf8dc48];
const STOREY = 3.4;           // metres a storey
export interface Building { p: [number, number][]; bb: [number, number, number, number]; base: number; top: number; quarter?: boolean; wall?: number }
// Fontainhas, the Latin quarter: deep, saturated colours, every house two storeys with a red-tiled roof
const QUARTER_COLS = [0xe8b028, 0x2a5fb0, 0xb8302a, 0x2f9a78, 0xe0789a, 0xf0c838, 0x3a7ac8, 0xc84a2a];

function colorGeo(geo: THREE.BufferGeometry, wall: THREE.Color, roof: THREE.Color) {
  const n = geo.attributes.normal, c = new Float32Array(n.count * 3), side = wall.clone().multiplyScalar(0.8);
  for (let i = 0; i < n.count; i++) {
    const ny = n.getY(i), cc = ny > 0.5 ? roof : Math.abs(n.getX(i)) > Math.abs(n.getZ(i)) ? side : wall;
    c[i * 3] = cc.r; c[i * 3 + 1] = cc.g; c[i * 3 + 2] = cc.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
}

/** A hipped roof over outline `p` (world XZ) at height y: its slopes rise to the outline drawn in toward the middle. */
function hipRoof(p: [number, number][], y: number, rise: number, color: THREE.Color): THREE.BufferGeometry {
  const n = p.length, cx = p.reduce((s, q) => s + q[0], 0) / n, cz = p.reduce((s, q) => s + q[1], 0) / n;
  const eave = p.map(([x, z]) => [cx + (x - cx) * 1.12, cz + (z - cz) * 1.12]);
  const ridge = p.map(([x, z]) => [cx + (x - cx) * 0.35, cz + (z - cz) * 0.35]);
  const P: number[] = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    P.push(eave[i][0], y, eave[i][1], eave[j][0], y, eave[j][1], ridge[j][0], y + rise, ridge[j][1]);
    P.push(eave[i][0], y, eave[i][1], ridge[j][0], y + rise, ridge[j][1], ridge[i][0], y + rise, ridge[i][1]);
  }
  const tri = THREE.ShapeUtils.triangulateShape(ridge.map(([x, z]) => new THREE.Vector2(x, z)), []);
  for (const [a, b, c] of tri) P.push(ridge[a][0], y + rise, ridge[a][1], ridge[c][0], y + rise, ridge[c][1], ridge[b][0], y + rise, ridge[b][1]);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  // keep every face pointing outward/up whichever way round the outline was drawn
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i += 3) {
    const ax = pos.getX(i), ay = pos.getY(i), az = pos.getZ(i), bx = pos.getX(i + 1) - ax, by = pos.getY(i + 1) - ay, bz = pos.getZ(i + 1) - az, cx2 = pos.getX(i + 2) - ax, cy = pos.getY(i + 2) - ay, cz2 = pos.getZ(i + 2) - az;
    if (bz * cx2 - bx * cz2 < 0) { const tx = pos.getX(i + 1), ty = pos.getY(i + 1), tz = pos.getZ(i + 1); pos.setXYZ(i + 1, pos.getX(i + 2), pos.getY(i + 2), pos.getZ(i + 2)); pos.setXYZ(i + 2, tx, ty, tz); }
    void by; void cy;
  }
  geo.computeVertexNormals();
  const c = new Float32Array(pos.count * 3), dark = color.clone().multiplyScalar(0.82);
  const nrm = geo.attributes.normal;
  for (let i = 0; i < pos.count; i++) { const cc = nrm.getX(i) + nrm.getZ(i) > 0 ? dark : color; c[i * 3] = cc.r; c[i * 3 + 1] = cc.g; c[i * 3 + 2] = cc.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return geo;
}

/** Is the outline convex? (a hip roof only suits a convex one) */
function convex(p: [number, number][]): boolean {
  let sign = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length], c = p[(i + 2) % p.length], cr = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (Math.abs(cr) < 1e-6) continue; const s2 = Math.sign(cr); if (sign && s2 !== sign) return false; sign = s2;
  }
  return true;
}

/** A tiled roof for any outline (L, U and courtyard shapes too): a band of tiles sloping up from the eaves all round,
 *  `depth` metres deep, over the flat roof inside. */
function skirtRoof(p: [number, number][], y: number, depth: number, rise: number, color: THREE.Color): THREE.BufferGeometry {
  let area = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; area += a[0] * b[1] - b[0] * a[1]; }
  const inw = area > 0 ? 1 : -1, P: number[] = [];
  for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const nx = -(b[1] - a[1]) / L * inw, nz = (b[0] - a[0]) / L * inw;   // pointing into the building
    const d0 = -0.8, d1 = Math.min(depth, L * 0.5);
    const A0 = [a[0] + nx * d0, y, a[1] + nz * d0], B0 = [b[0] + nx * d0, y, b[1] + nz * d0], A1 = [a[0] + nx * d1, y + rise, a[1] + nz * d1], B1 = [b[0] + nx * d1, y + rise, b[1] + nz * d1];
    P.push(...A0, ...B0, ...B1, ...A0, ...B1, ...A1);
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.computeVertexNormals();
  const n = P.length / 3, c = new Float32Array(n * 3), uv = new Float32Array(n * 2), dark = color.clone().multiplyScalar(0.85), nr = geo.attributes.normal;
  for (let i = 0; i < n; i++) { const cc = nr.getX(i) + nr.getZ(i) > 0 ? dark : color; c[i * 3] = cc.r; c[i * 3 + 1] = cc.g; c[i * 3 + 2] = cc.b; uv[i * 2] = 0.01; uv[i * 2 + 1] = 0.6; }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

/** A plain shape painted one colour, with texture coordinates on a blank spot so no facade shows on it. */
function solid(geo: THREE.BufferGeometry, hex: number): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo, n = g.attributes.position.count, c = new THREE.Color(hex), col = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; uv[i * 2] = 0.01; uv[i * 2 + 1] = 0.6; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  if (!g.attributes.normal) g.computeVertexNormals();
  return g;
}

// the named buildings' styles (from tools/export_named.py): Portuguese-era public buildings, churches, temples, modern blocks
// from photographs: Panjim's old public buildings are mostly ochre-yellow with white pilasters (the Old GMC, Maquinez
// Palace), a few cream, sky blue or Goan red
const PUB_COLS = [0xe8b83a, 0xeec04a, 0xe8b83a, 0xf3ead2, 0x8fc8e8, 0xe8b83a, 0xc4302b];
/** Buildings whose photographs show something particular. */
const OVERRIDE: Record<string, { style?: string; storeys?: number; color?: number }> = {
  'Junta House': { style: 'modern', storeys: 11, color: 0xd8b048 },                       // the ochre tower with the mural
  'Corporation of the city of panaji': { style: 'modern', storeys: 4, color: 0x2f6fc8 },  // bright blue, white fins
  'Maquinez Palace': { color: 0xe8b83a }, 'Old GMC Building': { color: 0xeec04a },
  'Mahalakshimi Temple': { style: 'temple' },
};
const MODERN_COLS = [0xdcdcd6, 0xc8ccd0, 0xe8e2d2, 0xb8c4cc, 0xd6d0c4];

/** Panjim's old streets are terraces of narrow houses, each its own colour and height. A long plain box (most of them
 *  guessed, since the map lacks small houses) is split into such a terrace: units 6-10 m wide along its length,
 *  one to three storeys each. */
function terraces(b: PanjimData['b'], named: [string, string, number, number, number][], quarter: [number, number] = [-99, -99]): PanjimData['b'] {
  let seed = 4321; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const out: PanjimData['b'] = [];
  for (const e of b) {
    const [f, , kind, area] = e;
    if (kind || f.length !== 8 || area < 110 || area > 2500) { out.push(e); continue; }
    const q = pts(f), cx = (q[0][0] + q[2][0]) / 2, cy = (q[0][1] + q[2][1]) / 2;
    if (named.some(n => Math.hypot(n[2] - cx, n[3] - cy) < 1.5)) { out.push(e); continue; }
    // the long side (a-b) and the short side (b-c), in tiles
    const L01 = Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1]), L12 = Math.hypot(q[2][0] - q[1][0], q[2][1] - q[1][1]);
    const [a, bb, c, dd] = L01 >= L12 ? q : [q[1], q[2], q[3], q[0]], long = Math.max(L01, L12) * T;
    if (long < 14) { out.push(e); continue; }
    // separate houses with gaps between them (a Goan street is a line of detached houses and their compounds, not one
    // long block): each 7-11 m wide, set back by a different amount, a different depth, 1 or 2 storeys (now and then 3)
    // ...except in Fontainhas, the Latin quarter: there the houses stand wall to wall along the lane, all flush with it
    const packed = Math.hypot(cx - quarter[0], cy - quarter[1]) < 9;
    let s0 = packed ? 0 : rnd() * 3;
    while (s0 < long - 5) {
      let w = Math.min(long - s0, packed ? 5.5 + rnd() * 3 : 7 + rnd() * 4); if (packed && long - s0 - w < 4) w = long - s0;   // no sliver left at the end of a row
      const t0 = s0 / long, t1 = (s0 + w) / long;
      const P = (u: number, from: [number, number], to: [number, number]) => [from[0] + (to[0] - from[0]) * u, from[1] + (to[1] - from[1]) * u];
      const f0 = packed ? 0 : rnd() * 0.15, f1 = packed ? 0.8 + rnd() * 0.2 : 0.6 + rnd() * 0.4;   // how far back the front and the back walls sit, across the plot
      const a0 = P(t0, a, bb), a1 = P(t1, a, bb), d0 = P(t0, dd, c), d1 = P(t1, dd, c);
      const L = (p: number[], q: number[], u: number) => [p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u];
      const p0 = L(a0, d0, f0), p1 = L(a1, d1, f0), p2 = L(a1, d1, f1), p3 = L(a0, d0, f1);
      const r = rnd(), st = packed ? (r < 0.75 ? 2 : 3) : r < 0.45 ? 1 : r < 0.92 ? 2 : 3;
      out.push([[...p0, ...p1, ...p2, ...p3], st, 0, Math.max(150, area * w / long * (f1 - f0))]);
      s0 += w + (packed ? 0 : 3 + rnd() * 4);
    }
  }
  return out;
}

export const CHUNK = 300;

/** Hide the squares of a chunked group (children with userData.cx/cz) farther than `r` metres from (x, z). */
export function cullChunks(group: THREE.Object3D, x: number, z: number, r: number) {
  for (const c of group.children) if (c.userData.cx !== undefined) c.visible = Math.hypot(c.userData.cx - x, c.userData.cz - z) < r + CHUNK * 0.71;
}


/** The new look's Goan details on a plain building. Houses: white corner pilasters, a white cornice under the eaves,
 *  a darker plinth, and on the side facing the street a balcão: the raised front porch on white pillars with built-in
 *  seats and its own little tiled roof, steps down to the road (a balcony above on two-storey houses). Blocks of flats:
 *  a balcony with a railing at every bay of every floor on the long sides, a parapet round the flat roof, and the black
 *  water tank on top. Everything is pushed into `out` (one merged mesh per map square). */
function goanDetails(out: THREE.BufferGeometry[], p: [number, number][], base: number, h: number, storeys: number, flats: boolean,
  front: number, roof: THREE.Color, seed: number, clear = 99) {
  const n = p.length, cx = p.reduce((a, q) => a + q[0], 0) / n, cz = p.reduce((a, q) => a + q[1], 0) / n;
  const WHITE = 0xf6f2e8, ROOF = roof.getHex();
  const piece = (l: number, hh: number, w: number, x: number, y: number, z: number, ang: number, col: number) =>
    out.push(solid(new THREE.BoxGeometry(l, hh, w).rotateY(ang).translate(x, y, z), col));
  const edge = (i: number) => {
    const [ax, az] = p[i], [bx, bz] = p[(i + 1) % n], L = Math.hypot(bx - ax, bz - az), dx = (bx - ax) / (L || 1), dz = (bz - az) / (L || 1);
    let nx = -dz, nz = dx; const mx = (ax + bx) / 2, mz = (az + bz) / 2;
    if ((mx - cx) * nx + (mz - cz) * nz < 0) { nx = -nx; nz = -nz; }      // the normal pointing out of the building
    return { ax, az, bx, bz, L, dx, dz, nx, nz, mx, mz, ang: -Math.atan2(dz, dx) };
  };
  if (!flats) {
    for (const [x, z] of p) piece(0.55, h, 0.55, x + (x - cx) * 0.01, base + h / 2, z + (z - cz) * 0.01, 0, WHITE);      // pilasters
    for (let i = 0; i < n; i++) {
      const e = edge(i);
      piece(e.L + 0.5, 0.38, 0.45, e.mx + e.nx * 0.18, base + h - 0.22, e.mz + e.nz * 0.18, e.ang, WHITE);              // cornice
      piece(e.L + 0.2, 0.7, 0.3, e.mx + e.nx * 0.1, base + 0.35, e.mz + e.nz * 0.1, e.ang, 0x8c7a68);                  // plinth
    }
    const e = edge(front);
    if (e.L >= 6 && clear > 4.2) {   // a porch only where there is room before the road's edge
      const W = Math.min(e.L * 0.62, 9), D = 2.6, fx = e.mx + e.nx * (D / 2 + 0.1), fz = e.mz + e.nz * (D / 2 + 0.1), fl = base + 0.6;
      piece(W, 0.6, D, fx, base + 0.3, fz, e.ang, 0xa4573c);                                                         // the porch floor, laterite red
      for (let k = 0; k <= 3; k++) {                                                                                  // its white pillars
        const t = -W / 2 + 0.3 + k * (W - 0.6) / 3, px = fx + e.dx * t + e.nx * (D / 2 - 0.3), pz = fz + e.dz * t + e.nz * (D / 2 - 0.3);
        piece(0.42, 2.7, 0.42, px, fl + 1.35, pz, e.ang, WHITE);
      }
      for (const sd of [-1, 1]) piece(0.4, 0.75, D, fx + e.dx * sd * (W / 2 - 0.2), fl + 0.37, fz + e.dz * sd * (W / 2 - 0.2), e.ang, WHITE);   // the seats
      const r = new THREE.BoxGeometry(W + 0.8, 0.22, D + 0.9).rotateX(0.22).rotateY(e.ang).translate(fx + e.nx * 0.3, fl + 2.95, fz + e.nz * 0.3);   // its tiled roof
      out.push(solid(r, ROOF));
      for (let k = 0; k < 2; k++) piece(1.8, 0.3, 0.7, fx + e.nx * (D / 2 + 0.35 + k * 0.7), base + 0.45 - k * 0.3, fz + e.nz * (D / 2 + 0.35 + k * 0.7), e.ang, 0xc8bfb0);   // steps
      if (storeys >= 2) {                                                                                              // a balcony above
        const by = base + STOREY + 0.1;
        piece(W * 0.7, 0.25, 1.4, e.mx + e.nx * 0.75, by, e.mz + e.nz * 0.75, e.ang, WHITE);
        const bx0 = e.mx + e.nx * 1.4, bz0 = e.mz + e.nz * 1.4;
        piece(W * 0.7, 0.1, 0.12, bx0, by + 1.0, bz0, e.ang, WHITE);
        for (let t = -W * 0.35; t <= W * 0.35; t += 0.3) piece(0.06, 0.9, 0.06, bx0 + e.dx * t, by + 0.55, bz0 + e.dz * t, e.ang, 0x2c2a28);   // wrought-iron bars
      }
    }
  } else {
    // flats: balconies on the two longest sides, every bay, every floor above the ground
    const sides = [...Array(n).keys()].map(edge).sort((a, b) => b.L - a.L).slice(0, 2);
    for (const e of sides) for (let f = 1; f < storeys; f++) for (let t = BAY / 2; t < e.L - BAY / 2; t += BAY) {
      if (((seed + f * 7 + Math.round(t)) % 5) === 0) continue;                                                        // not every bay has one
      const x = e.ax + e.dx * t + e.nx * 0.6, z = e.az + e.dz * t + e.nz * 0.6, y = base + f * STOREY;
      piece(3.0, 0.22, 1.2, x, y, z, e.ang, 0xe8e4dc);
      const rail = (seed % 3) ? 0x4a4a4c : 0xf0ece4, rx = x + e.nx * 0.56, rz = z + e.nz * 0.56;
      piece(3.0, 0.08, 0.1, rx, y + 1.05, rz, e.ang, rail);                                                            // the hand rail
      for (let b = -1.4; b <= 1.41; b += 0.35) piece(0.05, 0.95, 0.05, rx + e.dx * b, y + 0.58, rz + e.dz * b, e.ang, rail);   // its bars
    }
    for (let i = 0; i < n; i++) { const e = edge(i); piece(e.L + 0.3, 1.0, 0.3, e.mx - e.nx * 0.1, base + h + 0.5, e.mz - e.nz * 0.1, e.ang, 0xdedad0); }   // parapet
    out.push(solid(new THREE.CylinderGeometry(0.9, 0.9, 1.6, 10).translate(cx + 2, base + h + 0.8, cz + 1), 0x1e1e20));   // the water tank
  }
}

export function buildBuildings(d: PanjimData, g: Ground, segs: { ax: number; az: number; bx: number; bz: number; half: number }[] = []): { group: THREE.Group; list: Building[] } {
  // which side of a house faces the street: the edge whose middle is nearest a street (a coarse grid over the streets)
  const SG = new Map<number, { ax: number; az: number; bx: number; bz: number; half: number }[]>();
  for (const sg of segs) for (let t = 0; t <= 1; t += 0.25) { const x = sg.ax + (sg.bx - sg.ax) * t, z = sg.az + (sg.bz - sg.az) * t, k = Math.floor(x / 40) * 4096 + Math.floor(z / 40); let a = SG.get(k); if (!a) SG.set(k, a = []); if (!a.includes(sg)) a.push(sg); }
  const streetDist = (x: number, z: number) => { let best = 1e9; for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const sg of SG.get((Math.floor(x / 40) + i) * 4096 + Math.floor(z / 40) + j) ?? []) {
    const vx = sg.bx - sg.ax, vz = sg.bz - sg.az, L2 = vx * vx + vz * vz || 1, t = Math.max(0, Math.min(1, ((x - sg.ax) * vx + (z - sg.az) * vz) / L2)); best = Math.min(best, Math.hypot(sg.ax + vx * t - x, sg.az + vz * t - z) - sg.half); } return best; };   // metres clear of the road's edge (negative: on the road)
  const named = d.named ?? [];
  // buildings are merged by map squares (CHUNK metres across), one mesh each: squares off-screen are skipped by the
  // camera's frustum test, and far ones are hidden (cullChunks), so a big map costs little more than a small one
  const buckets = new Map<number, THREE.BufferGeometry[]>(), list: Building[] = [];
  let geos: THREE.BufferGeometry[] = [];
  const fq = d.places.find(q => q[0] === 'Fontainhas'), QX = (fq?.[1] ?? -99) * T, QZ = (fq?.[2] ?? -99) * T, QR = 180;
  const roofFlat = new THREE.Color(0xb8b2a4), roofTile = new THREE.Color(0xa8432a), white = new THREE.Color(0xfaf8f2), ochre = new THREE.Color(0xecd6a0);
  (location.search.includes('plain') ? d.b : terraces(d.b, d.named ?? [], fq ? [fq[1], fq[2]] : undefined)).forEach(   // ?plain: the old boxes, for comparisons
    ([f, lv, kind, area], idx) => {
    const p = pts(f).map(([x, y]) => [x * T, y * T] as [number, number]);
    if (p.length < 3) return;
    // is this one of the named buildings? (its recorded middle falls inside this outline)
    const mx = p.reduce((a, q) => a + q[0], 0) / p.length, mz = p.reduce((a, q) => a + q[1], 0) / p.length;
    { const k = Math.floor(mx / CHUNK) * 4096 + Math.floor(mz / CHUNK); let b = buckets.get(k); if (!b) buckets.set(k, b = []); geos = b; }
    // a building the road runs through (the map's footprint and the drawn road disagree): leave it out, not over the road
    if (segs.length && !kind && streetDist(mx, mz) < 0.5) return;
    const nm = named.find(n => inPoly(p, n[2] * T, n[3] * T) || Math.hypot(n[2] * T - mx, n[3] * T - mz) < 6);
    const ov = nm ? OVERRIDE[nm[1]] : undefined;
    const style = ov?.style ?? nm?.[0] ?? '';
    const small = !kind && !style && area < 260;
    const quarter = !kind && !style && area < 900 && Math.hypot(mx - QX, mz - QZ) < QR;
    let storeys = !kind && area < 150 && !style ? 1 : lv;
    if (quarter) storeys = Math.max(2, Math.min(3, storeys));
    if (style === 'pub') storeys = Math.max(2, nm![4] || lv);
    if (style === 'modern') storeys = ov?.storeys ?? Math.max(3, nm![4] || lv);
    if (style === 'temple') storeys = Math.max(1, Math.min(2, lv));
    const h = storeys * STOREY * (kind === 1 || style === 'church' ? 1.6 : kind === 2 ? 1.2 : small ? 0.9 : 1);
    const base = Math.min(...p.map(([x, z]) => g.heightAt(x, z)));
    const shape = new THREE.Shape(p.map(([x, z]) => new THREE.Vector2(x, -z)));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: h + 1.5, bevelEnabled: false });   // 1.5 m below the plot so slopes never show a gap
    geo.rotateX(-Math.PI / 2); geo.translate(0, base - 1.5, 0);
    wallUV(geo, base);
    const wall = ov?.color !== undefined ? new THREE.Color(ov.color) : style === 'pub' ? new THREE.Color(PUB_COLS[idx % PUB_COLS.length]) : style === 'modern' ? new THREE.Color(MODERN_COLS[idx % MODERN_COLS.length])
      : kind === 1 || style === 'church' ? white : kind === 2 || style === 'temple' ? ochre : quarter ? new THREE.Color(QUARTER_COLS[(idx * 5 + p.length) % QUARTER_COLS.length]) : new THREE.Color(PALETTE[(idx * 7 + p.length) % PALETTE.length]);
    // tiled hip roofs on houses, the old public buildings and the churches; flat on modern blocks and temples
    if (NEW_LOOK) wall.lerp(LIME, kind || style ? 0.1 : 0.24);   // the new look: lime-washed, sun-faded Goan colours rather than toy primaries
    const tiled = quarter || style === 'pub' || style === 'church' || (!kind && !style && area < 1400);
    colorGeo(geo, wall, tiled ? (NEW_LOOK ? roofTile.clone().offsetHSL(((idx * 37) % 11 - 5) * 0.004, 0, ((idx * 53) % 9 - 4) * 0.02) : roofTile) : style === 'modern' ? new THREE.Color(0x9a9c9e) : kind === 1 ? white : roofFlat);
    geos.push(geo);
    if (tiled) {
      // a hip roof over simple shapes; a band of tiles all round the eaves over L, U and courtyard shapes
      const rise = style === 'church' ? Math.max(4, Math.sqrt(area) * 0.3) : Math.min(style === 'pub' ? 6 : 3.2, Math.sqrt(area) * 0.22);
      const r = convex(p) && p.length <= 8 ? hipRoof(p, base + h, rise, roofTile) : skirtRoof(p, base + h, 7, Math.min(rise, 3.5), roofTile);
      wallUV(r, 0); if (!convex(p) || p.length > 8) { const uv = r.attributes.uv as THREE.BufferAttribute; for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.01, 0.6); }
      geos.push(r);
    }
    const cx = p.reduce((a, q) => a + q[0], 0) / p.length, cz = p.reduce((a, q) => a + q[1], 0) / p.length;
    if (NEW_LOOK && !kind && style !== 'church' && style !== 'temple' && convex(p) && p.length <= 8) {
      const flats = style === 'modern' || storeys >= 3 && area > 250;
      let front = 0, fd = 1e9; for (let i = 0; i < p.length; i++) { const a = p[i], b2 = p[(i + 1) % p.length]; const dd = streetDist((a[0] + b2[0]) / 2, (a[1] + b2[1]) / 2); if (dd < fd) { fd = dd; front = i; } }
      if (flats || area < 700) goanDetails(geos, p, base, h, storeys, flats, front, tiled ? roofTile : roofFlat, idx, fd);
    }
    if (style === 'church') {
      // as St. Inez and the Panjim chapels: a white baroque front at the end of the nave, a scrolled gable with a cross
      // in the middle and a small bell tower either side
      const far = p.reduce((a, q) => (Math.hypot(q[0] - cx, q[1] - cz) > Math.hypot(a[0] - cx, a[1] - cz) ? q : a));
      const fx = far[0] + (cx - far[0]) * 0.15, fz = far[1] + (cz - far[1]) * 0.15;     // the front, a little in from the end
      const ax = cx - fx, az = cz - fz, al = Math.hypot(ax, az) || 1, sx = -az / al, sz = ax / al;   // across the front
      const half = Math.min(9, Math.sqrt(area) * 0.35), ang = Math.atan2(sx, sz);
      const piece = (geo: THREE.BufferGeometry, x: number, y: number, z: number, col: number) => { geo.rotateY(ang); geo.translate(x, y, z); geos.push(solid(geo, col)); };
      piece(new THREE.BoxGeometry(half * 1.2, 4.5, 1.2), fx, base + h + 2.25, fz, 0xfaf8f2);                       // the gable
      piece(new THREE.CylinderGeometry(half * 0.55, half * 0.55, 1.2, 12, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2), fx, base + h + 4.5, fz, 0xfaf8f2);
      piece(new THREE.BoxGeometry(0.4, 3, 0.4), fx, base + h + 6.5 + half * 0.4, fz, 0xf2efe6);                   // the cross
      piece(new THREE.BoxGeometry(1.6, 0.4, 0.4), fx, base + h + 7 + half * 0.4, fz, 0xf2efe6);
      for (const side of [-1, 1]) {
        const tx = fx + sx * half * side, tz = fz + sz * half * side, th = Math.min(h + 5, 18);
        piece(new THREE.BoxGeometry(3.2, th, 3.2), tx, base + th / 2, tz, 0xfaf8f2);
        piece(new THREE.BoxGeometry(3.6, 0.5, 3.6), tx, base + th, tz, 0xe8e2d4);
        piece(new THREE.SphereGeometry(1.5, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), tx, base + th + 0.2, tz, 0xfaf8f2);
      }
    }
    if (style === 'temple') {
      // as the Mahalaxmi and Maruti temples: a tower of saffron-and-white tiers, each ringed with small domes, a dome on top
      // and a golden kalash; a smaller tower over the hall as well
      const tower = (tx: number, tz: number, w0: number, tiers: number) => {
        let y = base + h, w = w0;
        for (let k = 0; k < tiers; k++) {
          const th = 2.6;
          geos.push(solid(new THREE.BoxGeometry(w, th, w).translate(tx, y + th / 2, tz), k % 2 ? 0xf2efe6 : 0xe8742a));
          for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) geos.push(solid(new THREE.SphereGeometry(w * 0.13, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2).translate(tx + dx * w * 0.42, y + th, tz + dz * w * 0.42), 0xd8502a));
          y += th; w *= 0.78;
        }
        geos.push(solid(new THREE.SphereGeometry(w * 0.62, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(tx, y, tz), 0xd8502a));
        geos.push(solid(new THREE.ConeGeometry(0.5, 2.4, 8).translate(tx, y + w * 0.62 + 1.2, tz), 0xf2c230));
      };
      const w0 = Math.min(11, Math.sqrt(area) * 0.45);
      const far = p.reduce((a, q) => (Math.hypot(q[0] - cx, q[1] - cz) > Math.hypot(a[0] - cx, a[1] - cz) ? q : a));
      tower(cx + (far[0] - cx) * 0.35, cz + (far[1] - cz) * 0.35, w0, 5);
      tower(cx - (far[0] - cx) * 0.25, cz - (far[1] - cz) * 0.25, w0 * 0.6, 2);
    }
    if (style === 'modern') {
      // a water tank / lift room on the flat roof, and white vertical fins up the walls (as on the Municipal building)
      geos.push(solid(new THREE.BoxGeometry(5, 3, 4).translate(cx, base + h + 1.5, cz), 0xb8b8b4));
      for (let i = 0; i < p.length; i++) {
        const a = p[i], b2 = p[(i + 1) % p.length], L = Math.hypot(b2[0] - a[0], b2[1] - a[1]);
        for (let s2 = 4; s2 < L - 2; s2 += 8) {
          const fx = a[0] + (b2[0] - a[0]) * s2 / L, fz = a[1] + (b2[1] - a[1]) * s2 / L;
          geos.push(solid(new THREE.BoxGeometry(0.8, h, 0.8).translate(fx, base + h / 2, fz), 0xf2efe6));
        }
      }
    }
    let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
    for (const [x, z] of p) { x0 = Math.min(x0, x); z0 = Math.min(z0, z); x1 = Math.max(x1, x); z1 = Math.max(z1, z); }
    list.push({ p, bb: [x0, z0, x1, z1], base, top: base + h, quarter, wall: wall.getHex() });
  });
  const group = new THREE.Group(); group.name = 'buildings';
  const mat = facadeMaterial(facadeTexture(), windowsLit), ink = new THREE.LineBasicMaterial({ color: 0x1a120c, transparent: true, opacity: 0.8 });
  for (const [k, all] of buckets) {
    const bucket = all.filter(gg => gg && gg.attributes?.position && gg.attributes.position.count > 0);   // an odd footprint can give no geometry: leave it out
    if (!bucket.length) continue;
    const merged = mergeGeometries(bucket, false);
    if (!merged) { console.warn("buildings: a chunk could not be merged", k, bucket.length); continue; }
    for (const gg of bucket) gg.dispose();
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = true; mesh.receiveShadow = true;
    const chunk = new THREE.Group(); chunk.add(mesh);
    if (!NEW_LOOK) chunk.add(new THREE.LineSegments(new THREE.EdgesGeometry(merged, 35), ink));
    chunk.userData.cx = (Math.floor(k / 4096) + 0.5) * CHUNK; chunk.userData.cz = ((k % 4096 + 4096) % 4096 + 0.5) * CHUNK;
    group.add(chunk);
  }
  return { group, list };
}

/** A grid over the buildings, so walking into one is a quick check. */
export class BuildingIndex {
  private cells = new Map<number, Building[]>();
  private static C = 30;
  constructor(list: Building[]) {
    const C = BuildingIndex.C;
    for (const b of list)
      for (let x = Math.floor(b.bb[0] / C); x <= Math.floor(b.bb[2] / C); x++)
        for (let z = Math.floor(b.bb[1] / C); z <= Math.floor(b.bb[3] / C); z++) { const k = x * 65536 + z; let a = this.cells.get(k); if (!a) this.cells.set(k, a = []); a.push(b); }
  }
  /** Is (X, Z) inside a building, or within r metres of its wall? */
  solid(X: number, Z: number, r: number): boolean {
    const a = this.cells.get(Math.floor(X / BuildingIndex.C) * 65536 + Math.floor(Z / BuildingIndex.C));
    if (!a) return false;
    for (const b of a) {
      if (X < b.bb[0] - r || X > b.bb[2] + r || Z < b.bb[1] - r || Z > b.bb[3] + r) continue;
      if (inPoly(b.p, X, Z)) return true;
      const p = b.p;
      for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
        const ex = p[i][0] - p[j][0], ez = p[i][1] - p[j][1], L2 = ex * ex + ez * ez || 1e-9, t = Math.max(0, Math.min(1, ((X - p[j][0]) * ex + (Z - p[j][1]) * ez) / L2));
        if (Math.hypot(X - p[j][0] - ex * t, Z - p[j][1] - ez * t) < r) return true;
      }
    }
    return false;
  }
}
