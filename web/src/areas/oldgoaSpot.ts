// Where Old Goa's churches stand, in world metres for whatever map frame is loaded: from their OpenStreetMap buildings
// when the map has them by name, else from their coordinates. Off the map (a map that does not reach Old Goa): null.
import { T, type PanjimData } from '../world/data';

export interface OldGoaSpot { x: number; z: number; r: number }
export interface OldGoa { bomJesus: OldGoaSpot; se: OldGoaSpot; assisi: OldGoaSpot; arch: OldGoaSpot; centre: { x: number; z: number } }

const LL: Record<keyof Omit<OldGoa, 'centre'>, [number, number, number, string[]]> = {
  bomJesus: [15.50091, 73.91165, 45, ['Basilica of Bom Jesus', 'Bom Jesus Basilica']],
  se: [15.50385, 73.91243, 52, ['Se Cathedral', 'Sé Cathedral', 'Se Cathedral of Santa Catarina', 'Sé Catedral de Santa Catarina']],
  assisi: [15.50395, 73.91120, 30, ['Church of St. Francis of Assisi', 'Church of St Francis of Assisi', 'Church and Convent of St. Francis of Assisi']],
  arch: [15.50700, 73.91310, 10, ["Viceroy's Arch", 'Arch of the Viceroys', 'Viceroys Arch']],
};

let cache: OldGoa | null | undefined;
export function oldGoaAt(d: PanjimData): OldGoa | null {
  if (cache !== undefined) return cache;
  const [lat, lon] = d.centre, kx = 111320 * Math.cos(lat * Math.PI / 180) / T, ky = 110540 / T;
  const out: Partial<OldGoa> = {};
  for (const [k, [la, lo, r, names]] of Object.entries(LL) as [keyof typeof LL, typeof LL[keyof typeof LL]][]) {
    const n = d.named?.find(q => names.some(m => m.toLowerCase() === q[1].toLowerCase()));
    const x = n ? n[2] * T : ((lo - lon) * kx + d.W / 2) * T, z = n ? n[3] * T : ((lat - la) * ky + d.H / 2) * T;
    if (!(x > 0 && z > 0 && x < d.W * T && z < d.H * T)) return (cache = null);
    out[k] = { x, z, r };
  }
  const o = out as OldGoa;
  o.centre = { x: (o.bomJesus.x + o.se.x) / 2, z: (o.bomJesus.z + o.se.z) / 2 };
  return (cache = o);
}
