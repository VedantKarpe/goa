// Where Kingfisher Villa stands (OpenStreetMap: 15.50367 N, 73.77069 E, on the Sinquerim slope above the sea by Fort
// Aguada), in world metres for whatever map frame is loaded. Off the map (the old Panjim-only map): null.
import { T, type PanjimData } from '../world/data';

export const KF_LAT = 15.50367, KF_LON = 73.77069;

export function kingfisherAt(d: PanjimData): { x: number; z: number } | null {
  const [lat, lon] = d.centre, kx = 111320 * Math.cos(lat * Math.PI / 180) / T, ky = 110540 / T;
  const x = ((KF_LON - lon) * kx + d.W / 2) * T, z = ((lat - KF_LAT) * ky + d.H / 2) * T;
  return x > 0 && z > 0 && x < d.W * T && z < d.H * T ? { x, z } : null;
}

/** The villa's walled grounds (metres): the map's own plain boxes inside are left out for the villa itself. */
export const KF_R = 55;
