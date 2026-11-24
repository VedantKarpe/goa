// The North Goa beaches (Candolim, Calangute, Baga): where each is, and where its shacks stand. The shacks go along the
// back of the real sand from OpenStreetMap (the sand tiles next to land), spaced out along the beach, each facing the sea.
import { T, type PanjimData } from '../world/data';

export interface Beach { name: string; x: number; z: number }
export interface ShackSpot { x: number; z: number; face: number; beach: string; n: number }

const BEACHES: [string, number, number][] = [['Candolim', 15.5175, 73.7618], ['Calangute', 15.5440, 73.7553], ['Baga', 15.5565, 73.7512]];

export function beachesOn(d: PanjimData): Beach[] {
  const [lat, lon] = d.centre, kx = 111320 * Math.cos(lat * Math.PI / 180) / T, ky = 110540 / T;
  return BEACHES.map(([name, la, lo]) => ({ name, x: ((lo - lon) * kx + d.W / 2) * T, z: ((lat - la) * ky + d.H / 2) * T }))
    .filter(b => b.x > 0 && b.z > 0 && b.x < d.W * T && b.z < d.H * T);
}

const cache = new Map<string, ShackSpot[]>();
/** The shacks of one beach: along the back of its sand within 900 m of its centre, at least 45 m apart. */
export function shacksOf(d: PanjimData, b: Beach): ShackSpot[] {
  const hit = cache.get(b.name); if (hit) return hit;
  const sand = (x: number, y: number) => { const c = d.rows[y]?.[x]; return c === 'S' || c === 'B'; };
  const water = (x: number, y: number) => d.rows[y]?.[x] === 'W';
  const land = (x: number, y: number) => { const c = d.rows[y]?.[x]; return !!c && c !== 'W' && c !== 'S' && c !== 'B'; };
  const cx = Math.round(b.x / T), cy = Math.round(b.z / T), R = 45, out: ShackSpot[] = [];
  const cand: [number, number, number][] = [];
  for (let y = cy - R; y <= cy + R; y++) for (let x = cx - R; x <= cx + R; x++) {
    if (!sand(x, y)) continue;
    let nearLand = false; for (const [a, c] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (land(x + a, y + c)) nearLand = true;
    if (!nearLand) continue;
    // which way is the sea: the nearest water tile
    let best = 1e9, face = 0;
    for (let r = 1; r < 12; r++) for (let a = 0; a < 6.28; a += 0.4) { const wx = Math.round(x + Math.cos(a) * r), wy = Math.round(y + Math.sin(a) * r); if (water(wx, wy) && r < best) { best = r; face = a; } }
    if (best < 1e9) cand.push([x, y, face]);
  }
  cand.sort((p, q) => Math.hypot(p[0] - cx, p[1] - cy) - Math.hypot(q[0] - cx, q[1] - cy));
  for (const [x, y, face] of cand) {
    const px = (x + 0.5) * T + Math.cos(face) * 6, pz = (y + 0.5) * T + Math.sin(face) * 6;
    if (out.every(o => Math.hypot(o.x - px, o.z - pz) > 45)) out.push({ x: px, z: pz, face, beach: b.name, n: out.length + 1 });
    if (out.length >= 9) break;
  }
  cache.set(b.name, out);
  return out;
}
