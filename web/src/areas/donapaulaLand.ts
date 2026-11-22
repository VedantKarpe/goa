// The land of Dona Paula, which lies south of the mapped part of Panjim: the coast road down from Miramar past
// Caranzalem, the headland with the circle at the end of the road, the jetty out into the sea with the viewpoint at its
// tip, and the little beach on the south side where the jet skis go out. Pure shapes (world metres), so the game can
// walk on it, and drop you here by pilot, even before the scenery has loaded. Distances are shortened from real life.

export const DP = {
  /** the coast strip down from the map's edge */
  strip: { x0: -40, x1: 230, z0: 2350, z1: 2770 },
  /** the headland */
  head: { x: 40, z: 2870, r: 125 },
  /** the jetty, out west from the headland, and its round viewpoint */
  jetty: { x0: -262, x1: -70, z: 2870, w: 14 },
  view: { x: -268, z: 2870, r: 18 },
  /** the jet ski beach on the headland's south side */
  beach: { x: 40, z: 2985 },
  /** land and jetty heights */
  landY: 1.5, jettyY: 2.4,
  /** the road down from the map's last bit of road to the circle */
  road: [[100, 2372], [82, 2460], [52, 2560], [28, 2660], [30, 2740], [40, 2800]] as [number, number][],
  circle: { x: 40, z: 2812, r: 16 },
  /** where a pilot drops you */
  drop: { x: 10, z: 2840 },
};

const inStrip = (x: number, z: number) => x > DP.strip.x0 && x < DP.strip.x1 && z > DP.strip.z0 && z < DP.strip.z1;
const inHead = (x: number, z: number) => Math.hypot(x - DP.head.x, z - DP.head.z) < DP.head.r;
const inJetty = (x: number, z: number) => x > DP.jetty.x0 && x < DP.jetty.x1 && Math.abs(z - DP.jetty.z) < DP.jetty.w / 2 - 1;
const inView = (x: number, z: number) => Math.hypot(x - DP.view.x, z - DP.view.z) < DP.view.r - 1;

/** Walkable land the map does not cover (for the game's movement). */
export const donaPaulaLand = {
  free: (x: number, z: number) => inStrip(x, z) || inHead(x, z) || inJetty(x, z) || inView(x, z),
  y: (x: number, z: number) => (inStrip(x, z) || inHead(x, z) ? DP.landY : DP.jettyY),
};
