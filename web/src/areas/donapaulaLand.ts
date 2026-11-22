// Where Dona Paula's pieces stand on the real map (world metres, from OpenStreetMap: the circle, the parking, the pier
// at the headland's southern tip, the bay on its east side). The jetty's walk and round viewpoint reach out over the
// water, so they are walkable land the map itself does not have.

export const DP = {
  circle: { x: 830, z: 5088 },
  parking: { x: 905, z: 5000 },
  /** the jetty: a short walk from the rocks at the tip out to the round viewpoint */
  jetty: { x: 821, z0: 5730, z1: 5810, w: 10 },
  view: { x: 820, z: 5850, r: 15 },
  statue: { x: 846, z: 5722 },
  /** the jet ski beach on the bay east of the headland, and where the skis wait in the water */
  beach: { x: 1440, z: 5410 },
  skis: { x: 1540, z: 5470 },
  jettyY: 3.2,
};

/** Put the jetty where the headland really ends: walking south from the statue, the first water. */
export function fitJetty(isWet: (x: number, z: number) => boolean) {
  let z = DP.statue.z; while (z < DP.statue.z + 600 && !isWet(DP.jetty.x, z)) z += 2;
  const L = DP.jetty.z1 - DP.jetty.z0;
  DP.jetty.z0 = z - 12; DP.jetty.z1 = z - 12 + L; DP.view.z = DP.jetty.z1 + DP.view.r - 2;
  DP.statue.z = z - 30;
}

const inJetty = (x: number, z: number) => Math.abs(x - DP.jetty.x) < DP.jetty.w / 2 - 0.8 && z > DP.jetty.z0 && z < DP.jetty.z1;
const inView = (x: number, z: number) => Math.hypot(x - DP.view.x, z - DP.view.z) < DP.view.r - 1;

/** The jetty and viewpoint, walkable over the water (for the game's movement). */
export const donaPaulaLand = {
  free: (x: number, z: number) => inJetty(x, z) || inView(x, z),
  y: () => DP.jettyY,
};
