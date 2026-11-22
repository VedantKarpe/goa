// Where Miramar's beach is, in map tiles: on the big real map, the OSM "Miramar Beach" stretch south-west of Campal;
// on the old Panjim map (which ended before it), the sand at the city's west shore.
import type { PanjimData } from '../world/data';

export function miramarBox(d: PanjimData): { x0: number; x1: number; y0: number; y1: number } {
  return d.ox ? { x0: 30, x1: 100, y0: 80, y1: 135 } : { x0: 0, x1: 30, y0: 0, y1: Math.min(d.H, 120) };
}
