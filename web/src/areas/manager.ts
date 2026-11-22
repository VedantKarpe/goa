// Loads areas when the child comes near and unloads them when far away. Each area's code is a separate file the
// browser downloads the first time it is needed (later loads come from the cache).
import * as THREE from 'three';
import type { AreaContext, AreaEntry, AreaInstance } from './types';

const LOAD_AT = 350;     // start loading this far outside an area's edge
const DROP_AT = 700;     // remove it again past this

interface Slot { entry: AreaEntry; inst: AreaInstance | null; loading: Promise<void> | null }

export class AreaManager {
  private slots: Slot[];
  /** Called when an area has been built and added (e.g. to give it the cartoon look). */
  onLoaded: (name: string, group: THREE.Group, inst: AreaInstance, first: boolean) => void = () => {};
  private seen = new Set<string>();

  constructor(entries: AreaEntry[], private ctx: AreaContext, private scene: THREE.Scene) {
    this.slots = entries.map(entry => ({ entry, inst: null, loading: null }));
  }

  private load(s: Slot): Promise<void> {
    if (s.inst) return Promise.resolve();
    if (!s.loading) s.loading = s.entry.load().then(mod => {
      if (s.inst) return;
      s.inst = mod.build(this.ctx); s.inst.group.name = s.entry.name; this.scene.add(s.inst.group);
      const first = !this.seen.has(s.entry.name); this.seen.add(s.entry.name);
      this.onLoaded(s.entry.name, s.inst.group, s.inst, first);
    }).finally(() => { s.loading = null; });
    return s.loading;
  }

  private unload(s: Slot) {
    if (!s.inst) return;
    const g = s.inst.group; this.scene.remove(g);
    g.traverse(o => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
      for (const mt of mats) { for (const v of Object.values(mt)) if (v instanceof THREE.Texture) v.dispose(); mt.dispose(); }
    });
    s.inst = null;
  }

  /** Keep the areas around (x, z) loaded and drop far ones. Cheap: call it a few times a second. */
  refresh(x: number, z: number) {
    for (const s of this.slots) {
      const d = Math.hypot(s.entry.x - x, s.entry.z - z) - s.entry.r;
      if (d < LOAD_AT) void this.load(s); else if (d > DROP_AT) this.unload(s);
    }
  }

  /** Make sure every area covering (x, z) is built (before a pilot drops the child there). */
  async ready(x: number, z: number) {
    await Promise.all(this.slots.filter(s => Math.hypot(s.entry.x - x, s.entry.z - z) - s.entry.r < LOAD_AT).map(s => this.load(s)));
  }

  private get live(): AreaInstance[] { return this.slots.flatMap(s => (s.inst ? [s.inst] : [])); }
  update(dt: number, time: number, px: number, pz: number) { for (const a of this.live) a.update?.(dt, time, px, pz); }
  talk(px: number, pz: number): string | null { for (const a of this.live) { const t = a.talk?.(px, pz); if (t) return t; } return null; }
  tick(px: number, pz: number) { for (const a of this.live) { const t = a.tick?.(px, pz); if (t) return t; } return null; }
  hold() { for (const a of this.live) { const h = a.hold?.(); if (h) return h; } return null; }
  /** Which areas are loaded (for testing). */
  get loaded(): string[] { return this.slots.filter(s => s.inst).map(s => s.entry.name); }
}
