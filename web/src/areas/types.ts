// Areas of Goa as modules: each area's code and scenery load only when the child comes near it, and are removed again
// when the child is far away, so the game stays light however much of Goa gets built.
import type * as THREE from 'three';
import type { PanjimData, Ground } from '../world/data';
import type { Building } from '../world/buildings';
import type { Seg } from '../world/roads';

/** What an area gets to build itself from: the map, the ground, the town around it. */
export interface AreaContext {
  d: PanjimData;
  g: Ground;
  houses: Building[];
  segs: Seg[];
  free: (x: number, z: number) => boolean;
}

/** A built area: its scenery, and the hooks the game calls while it is loaded. */
export interface AreaInstance {
  group: THREE.Group;
  /** Each frame (animations: waves, walkers). */
  update?(dt: number, time: number, px: number, pz: number): void;
  /** The child pressed Talk here: a line if someone in this area answers. */
  talk?(px: number, pz: number): string | null;
  /** Each frame: something happened (a task done, a find). */
  tick?(px: number, pz: number): { msg: string; pts: number } | null;
}

/** An entry in the list of areas: where it is, and how to load it. Loading its code happens only when needed. */
export interface AreaEntry {
  name: string;
  x: number; z: number;            // centre (world metres)
  r: number;                       // radius it covers
  load: () => Promise<{ build: (ctx: AreaContext) => AreaInstance }>;
}
