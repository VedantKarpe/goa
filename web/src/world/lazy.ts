// Building the world in pieces, as it is needed: each map square's houses, ground or parked cars are made only when the
// child comes near it, nearest first, a few milliseconds' worth each frame. The game starts as soon as the squares
// around the child are ready, instead of building all of Goa up front.
export class LazyChunks {
  private jobs = new Map<number, { cx: number; cz: number; make: () => void }>();

  /** A square waiting to be built: its middle (world metres) and how to make it. */
  add(key: number, cx: number, cz: number, make: () => void) { if (!this.jobs.has(key)) this.jobs.set(key, { cx, cz, make }); }

  get pending() { return this.jobs.size; }

  /** Build the waiting squares within r metres of (x, z), nearest first, for at most `budget` ms. Returns how many are
   *  still waiting within r. */
  ensure(x: number, z: number, r: number, budget = Infinity): number {
    const near = [...this.jobs.entries()].map(([k, j]) => [k, Math.hypot(j.cx - x, j.cz - z)] as [number, number]).filter(([, dd]) => dd < r).sort((a, b) => a[1] - b[1]);
    const t0 = performance.now();
    let left = near.length;
    for (const [k] of near) {
      if (performance.now() - t0 > budget) break;
      const j = this.jobs.get(k)!; this.jobs.delete(k); j.make(); left--;
    }
    return left;
  }
}
