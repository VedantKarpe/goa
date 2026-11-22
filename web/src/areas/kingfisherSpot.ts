// Where Kingfisher Villa stands (OpenStreetMap: 15.50367 N, 73.77069 E, on the Sinquerim slope above the sea by Fort
// Aguada), in world metres for whatever map frame is loaded. The grounds are placed on the clear land nearest that
// point, off the roads (the game draws roads wider than life). Off the map (the old Panjim-only map): null.
import { T, type PanjimData } from '../world/data';

export const KF_LAT = 15.50367, KF_LON = 73.77069;
/** The villa's walled grounds (metres, half the side): the map's plain boxes inside are left out for the villa. */
export const KF_R = 32;

type Seg = { ax: number; az: number; bx: number; bz: number; half: number };
let cache: { x: number; z: number } | null | undefined;

export function kingfisherAt(d: PanjimData, segs: Seg[] = []): { x: number; z: number } | null {
  if (cache !== undefined) return cache;   // placed once (the game places it with the roads, before anything else asks)
  const [lat, lon] = d.centre, kx = 111320 * Math.cos(lat * Math.PI / 180) / T, ky = 110540 / T;
  const x0 = ((KF_LON - lon) * kx + d.W / 2) * T, z0 = ((lat - KF_LAT) * ky + d.H / 2) * T;
  if (!(x0 > 0 && z0 > 0 && x0 < d.W * T && z0 < d.H * T)) return (cache = null);
  if (!segs.length) return { x: x0, z: z0 };
  // how far (x, z) is from the nearest road's edge
  const clear = (x: number, z: number) => {
    let best = 1e9;
    for (const s of segs) {
      if (Math.abs(s.ax - x) > 200 && Math.abs(s.bx - x) > 200) continue;
      const vx = s.bx - s.ax, vz = s.bz - s.az, L2 = vx * vx + vz * vz || 1, t = Math.max(0, Math.min(1, ((x - s.ax) * vx + (z - s.az) * vz) / L2));
      best = Math.min(best, Math.hypot(s.ax + vx * t - x, s.az + vz * t - z) - s.half);
    }
    return best;
  };
  // the nearest spot (in a spiral out from the mapped point) where the walled square fits between the roads
  for (let r = 0; r <= 160; r += 4) for (let a = 0; a < Math.PI * 2; a += r ? 4 / r : 7) {
    const x = x0 + Math.cos(a) * r, z = z0 + Math.sin(a) * r;
    if (clear(x, z) > KF_R * 1.15 + 1) return (cache = { x, z });
  }
  return (cache = { x: x0, z: z0 });
}
