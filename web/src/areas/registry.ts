// The list of areas: where each one is, and its code (loaded on demand). To add an area of Goa, write its module in this
// folder (a `build(ctx)` that returns its scenery and hooks) and add a line here.
import { T, type PanjimData } from '../world/data';
import type { AreaEntry } from './types';
import { DP } from './donapaulaLand';
import { miramarBox } from './miramarBox';
import { kingfisherAt } from './kingfisherSpot';
import { iffiAt } from './iffi';
import { oldGoaAt } from './oldgoaSpot';
import { beachesOn } from './beachSpot';

/** Miramar's sand (world tile centres): the base game uses it for the place pin and the beach cows. */
export function beachSand(d: PanjimData): [number, number][] {
  const out: [number, number][] = [];
  const m = miramarBox(d);   // Miramar's beach
  for (let y = m.y0; y < m.y1; y++) for (let x = m.x0; x < m.x1; x++) { const c = d.rows[y][x]; if (c === 'S' || c === 'B') out.push([(x + 0.5) * T, (y + 0.5) * T]); }
  return out;
}

export function areas(d: PanjimData): AreaEntry[] {
  const place = (n: string) => { const p = d.places.find(q => q[0] === n); return p ? { x: p[1] * T, z: p[2] * T } : null; };
  const out: AreaEntry[] = [];
  const fq = place('Fontainhas');
  if (fq) out.push({ name: 'Fontainhas', ...fq, r: 200, load: () => import('./fontainhas') });
  const sand = beachSand(d);
  if (sand.length) out.push({ name: 'Miramar', x: sand.reduce((a, q) => a + q[0], 0) / sand.length, z: sand.reduce((a, q) => a + q[1], 0) / sand.length, r: 220, load: () => import('./miramar') });
  const kf = kingfisherAt(d);
  if (kf) out.push({ name: 'Kingfisher Villa', ...kf, r: 90, load: () => import('./kingfisher') });
  const ff = iffiAt(d);   // IFFI: the film festival's decorations round INOX (Panjim, every November)
  if (ff) out.push({ name: 'IFFI', ...ff, r: 340, load: () => import('./iffi') });
  const og = oldGoaAt(d);   // Old Goa: only on a map that reaches it
  if (og) out.push({ name: 'Old Goa', ...og.centre, r: 450, load: () => import('./oldgoa') });
  // the North Goa beaches and their shacks (only on a map that reaches them)
  for (const b of beachesOn(d)) out.push({ name: b.name + ' beach', x: b.x, z: b.z, r: 800, load: () => import('./beach').then(m => ({ build: (ctx: Parameters<typeof m.build>[0]) => m.build(ctx, b.name) })) });
  out.push({ name: 'Dona Paula', x: (DP.circle.x + DP.beach.x) / 2, z: (DP.circle.z + DP.view.z) / 2, r: 550, load: () => import('./donapaula') });
  return out;
}
