// Where Dona Paula's pieces stand on the real map (world metres, from OpenStreetMap and aerial photos): the circle and
// parking up on the plateau, and at the southern tip the jetty: a wide paved walk from the sandy spit out to a small
// rocky islet with the white viewpoint, and a long T-shaped pier off it to the east. The walks over the water are
// walkable land the map itself does not have.

export const DP = {
  circle: { x: 830, z: 5088 },
  parking: { x: 905, z: 5000 },
  /** the walk from the spit to the islet */
  jetty: { x: 812, z0: 5698, z1: 5812, w: 11 },
  /** the islet at the end, with the viewpoint on it */
  view: { x: 790, z: 5824, r: 22 },
  /** the T-pier: an arm east from the walk's end, and a crosspiece at its far end */
  arm: { x0: 812, x1: 896, z: 5806, w: 9 },
  head: { x: 896, z0: 5782, z1: 5838, w: 12 },
  statue: { x: 752, z: 5688 },
  /** the jet ski beach on the bay east of the headland, and where the skis wait in the water */
  beach: { x: 1440, z: 5410 },
  skis: { x: 1540, z: 5470 },
  jettyY: 2.4,
  /** the islet is a knoll of laterite this high in the middle */
  isletH: 9,
};

/** The knoll's height at (x, z): a rounded hill falling to the water at its edge. */
export function isletY(x: number, z: number): number {
  const V = DP.view, k = Math.min(1, Math.hypot(x - V.x, z - V.z) / V.r);
  return 1.2 + (DP.isletH - 1.2) * (1 - k * k) * (1 - k * 0.3);
}

const rect = (x: number, z: number, x0: number, x1: number, z0: number, z1: number) => x > x0 && x < x1 && z > z0 && z < z1;
const onJetty = (x: number, z: number) => {
  const J = DP.jetty, A = DP.arm, H = DP.head;
  return rect(x, z, J.x - J.w / 2 + 0.8, J.x + J.w / 2 - 0.8, J.z0, J.z1)
    || rect(x, z, A.x0, A.x1, A.z - A.w / 2 + 0.8, A.z + A.w / 2 - 0.8)
    || rect(x, z, H.x - H.w / 2 + 0.8, H.x + H.w / 2 - 0.8, H.z0, H.z1);
};

const onIslet = (x: number, z: number) => Math.hypot(x - DP.view.x, z - DP.view.z) < DP.view.r - 3;
/** The walk rises from the spit to the deck over its first stretch. */
const RAMP = 14, SPIT = 0.8;

/** The jetty, the T-pier and the islet's knoll (for the game's movement). */
export const donaPaulaLand = {
  free: (x: number, z: number) => onJetty(x, z) || onIslet(x, z),
  y: (x: number, z: number) => onIslet(x, z) && !onJetty(x, z) ? isletY(x, z) : z < DP.jetty.z0 + RAMP && Math.abs(x - DP.jetty.x) < DP.jetty.w ? SPIT + (DP.jettyY - SPIT) * Math.max(0, (z - DP.jetty.z0) / RAMP) : DP.jettyY,
};
