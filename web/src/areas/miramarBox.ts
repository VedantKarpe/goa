// Where Miramar's beach is, in map tiles: on the big real map, the OSM "Miramar Beach" stretch south-west of Campal;
// on the old Panjim map (which ended before it), the sand at the city's west shore.
import type { PanjimData } from '../world/data';

export function miramarBox(d: PanjimData): { x0: number; x1: number; y0: number; y1: number } {
  const dx = (d.ox ?? 90) - 90, dy = d.oy ?? 0;
  return d.ox ? { x0: 30 + dx, x1: 100 + dx, y0: 80 + dy, y1: 135 + dy } : { x0: 0, x1: 30, y0: 0, y1: Math.min(d.H, 120) };
}
