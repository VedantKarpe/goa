// The list of areas: where each one is, and its code (loaded on demand). To add an area of Goa, write its module in this
// folder (a `build(ctx)` that returns its scenery and hooks) and add a line here.
import { T, type PanjimData } from '../world/data';
import type { AreaEntry } from './types';
import { DP } from './donapaulaLand';

/** Miramar's sand (world tile centres): the base game uses it for the place pin and the beach cows. */
export function beachSand(d: PanjimData): [number, number][] {
  const out: [number, number][] = [];
  for (let y = 0; y < d.H; y++) for (let x = 0; x < 30; x++) { const c = d.rows[y][x]; if (c === 'S' || c === 'B') out.push([(x + 0.5) * T, (y + 0.5) * T]); }
  return out;
}

export function areas(d: PanjimData): AreaEntry[] {
  const place = (n: string) => { const p = d.places.find(q => q[0] === n); return p ? { x: p[1] * T, z: p[2] * T } : null; };
  const out: AreaEntry[] = [];
  const fq = place('Fontainhas');
  if (fq) out.push({ name: 'Fontainhas', ...fq, r: 200, load: () => import('./fontainhas') });
  const sand = beachSand(d);
  if (sand.length) out.push({ name: 'Miramar', x: sand.reduce((a, q) => a + q[0], 0) / sand.length, z: sand.reduce((a, q) => a + q[1], 0) / sand.length, r: 220, load: () => import('./miramar') });
  out.push({ name: 'Dona Paula', x: DP.head.x - 60, z: DP.head.z - 40, r: 300, load: () => import('./donapaula') });
  return out;
}
