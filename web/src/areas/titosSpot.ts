// Where Tito's Lane is (from OpenStreetMap): kept apart so the list of areas can know without loading the lane.
import { T, type PanjimData } from '../world/data';

/** The lane's line (world metres): the longest stretch of road OSM calls Tito's Lane. */
export function titosLine(d: PanjimData): [number, number][] | null {
  const ni = d.names?.findIndex(n => /tito/i.test(n)) ?? -1; if (ni < 0) return null;
  let best: [number, number][] | null = null, bl = 0;
  for (const r of d.r) {
    if (r[4] !== ni) continue;
    const f = r[0] as unknown as number[], p: [number, number][] = [];
    for (let i = 0; i + 1 < f.length; i += 2) p.push([f[i] * T, f[i + 1] * T]);
    let l = 0; for (let i = 1; i < p.length; i++) l += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
    if (l > bl) { bl = l; best = p; }
  }
  return best;
}

export function titosAt(d: PanjimData): { x: number; z: number } | null {
  const p = titosLine(d); if (!p) return null;
  return { x: p.reduce((a, q) => a + q[0], 0) / p.length, z: p.reduce((a, q) => a + q[1], 0) / p.length };
}

