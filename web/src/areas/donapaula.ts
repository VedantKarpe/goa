// Dona Paula: the headland at the end of the coast road from Miramar. The road jams up with tourist buses, taxis,
// rent-a-cars and scooters all heading for the circle; the souvenir stalls line the way to the jetty; the jetty runs out
// into the sea to the viewpoint, with the statue of the couple at its start. On the little beach on the south side,
// Rocky runs his jet skis: Rs 500 a round.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { WATER_Y } from '../world/data';
import type { AreaContext, AreaInstance, Hold } from './types';
import type { Cast } from '../entities/cast';
import { buildCar, pick, ROAD_MIX } from '../entities/cars';
import { DP } from './donapaulaLand';

const RIDE_COST = 100;          // points: Rs 500 (a stuck car pushed out pays Rs 200, 40 points)
const RIDE_TIME = 34;           // seconds

function tint(geo: THREE.BufferGeometry, hex: number): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo, c = new THREE.Color(hex), a = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < a.length; i += 3) { a[i] = c.r; a[i + 1] = c.g; a[i + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); if (g.attributes.uv) g.deleteAttribute('uv'); if (g.attributes.normal === undefined) g.computeVertexNormals(); return g;
}
const vc = () => new THREE.MeshLambertMaterial({ vertexColors: true });
const merged = (parts: THREE.BufferGeometry[]) => { const m = new THREE.Mesh(mergeGeometries(parts)!, vc()); m.castShadow = true; m.receiveShadow = true; return m; };

interface Local { c: Cast; at: { x: number; z: number }; from: number; to: number; obj: THREE.Group | null; said: number; face: number }
interface Vehicle { obj: THREE.Object3D; s: number; v: number; len: number; bus: boolean }

export function build(ctx: AreaContext): AreaInstance {
  const group = new THREE.Group(); group.name = 'donapaula';
  const Y = DP.landY, JY = DP.jettyY;
  let seed = 4242; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const box = (l: number, h: number, w: number, x: number, y: number, z: number, c: number, ry = 0) => tint(new THREE.BoxGeometry(l, h, w).rotateY(ry).translate(x, y, z), c);

  // ---- the land: the coast strip, the headland (grass on top, dark laterite rock down to the sea), sand ----
  const land: THREE.BufferGeometry[] = [];
  const S = DP.strip, H = DP.head;
  land.push(box(S.x1 - S.x0, Y + 4, S.z1 - S.z0, (S.x0 + S.x1) / 2, (Y - 4) / 2, (S.z0 + S.z1) / 2, 0x7aa65a));
  land.push(box(32, 0.06, S.z1 - S.z0 - 20, S.x0 + 16, Y + 0.02, (S.z0 + S.z1) / 2, 0xe2cf9c));                  // Caranzalem beach
  const headTop = new THREE.CylinderGeometry(H.r, H.r + 6, Y + 4, 40).translate(H.x, (Y - 4) / 2, H.z);
  land.push(tint(headTop, 0x6e5a4a));
  land.push(tint(new THREE.CircleGeometry(H.r - 0.2, 40).rotateX(-Math.PI / 2).translate(H.x, Y + 0.01, H.z), 0x7aa65a));
  land.push(tint(new THREE.RingGeometry(H.r - 24, H.r - 0.3, 30, 1, Math.PI + 0.9, Math.PI - 1.8).rotateX(-Math.PI / 2).translate(H.x, Y + 0.03, H.z), 0xe2cf9c));   // the jet ski beach
  // rocks along the water's edge
  for (let i = 0; i < 70; i++) {
    const a = rnd() * Math.PI * 2, r = H.r + 2 + rnd() * 8, s = 1.5 + rnd() * 3.5;
    if (Math.sin(a) > 0.55 && Math.abs(Math.cos(a)) < 0.6) continue;   // keep the beach front clear for the jet skis
    const rx = H.x + Math.cos(a) * r, rz = H.z + Math.sin(a) * r;
    if (rx > S.x0 && rx < S.x1 && rz < S.z1 + 4) continue;              // not on the coast strip's grass
    land.push(tint(new THREE.DodecahedronGeometry(s, 0).translate(H.x + Math.cos(a) * r, s * 0.3, H.z + Math.sin(a) * r), [0x5a4c42, 0x6e6458, 0x4a4038][i % 3]));
  }
  group.add(merged(land));

  // ---- trees: palms and the thick green of the Raj Bhavan hill on the headland's east side ----
  const trees: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 46; i++) {
    const a = rnd() * Math.PI * 2, r = 30 + rnd() * 85, x = H.x + 20 + Math.cos(a) * r * 0.7, z = H.z + Math.sin(a) * r * 0.8;
    if (Math.hypot(x - H.x, z - H.z) > H.r - 8 || x < H.x - 10 || z > H.z + 70 || Math.hypot(x - DP.circle.x, z - DP.circle.z) < 30) continue;
    if (i % 3) { trees.push(tint(new THREE.CylinderGeometry(0.25, 0.35, 9, 5).translate(x, Y + 4.5, z), 0x7a5a3a)); for (let k = 0; k < 5; k++) trees.push(tint(new THREE.BoxGeometry(5, 0.2, 1.2).translate(2.3, 0, 0).rotateZ(-0.35).rotateY(k * 1.26).translate(x, Y + 9, z), 0x3f8a3a)); }
    else trees.push(tint(new THREE.CylinderGeometry(0.3, 0.4, 4, 5).translate(x, Y + 2, z), 0x6a4a2a), tint(new THREE.DodecahedronGeometry(3.6, 0).translate(x, Y + 6, z), 0x3a6a32));
  }
  for (let z = S.z0 + 30; z < S.z1; z += 26) {   // palms along the coast road
    const x = S.x0 + 36 + rnd() * 6; trees.push(tint(new THREE.CylinderGeometry(0.25, 0.35, 9, 5).translate(x, Y + 4.5, z), 0x7a5a3a));
    for (let k = 0; k < 5; k++) trees.push(tint(new THREE.BoxGeometry(5, 0.2, 1.2).translate(2.3, 0, 0).rotateZ(-0.35).rotateY(k * 1.26).translate(x, Y + 9, z), 0x3f8a3a));
  }
  group.add(merged(trees));

  // ---- the road and the circle ----
  const road: THREE.BufferGeometry[] = [];
  const R = DP.road;
  for (let i = 1; i < R.length; i++) {
    const [ax, az] = R[i - 1], [bx, bz] = R[i], L = Math.hypot(bx - ax, bz - az), ang = -Math.atan2(bz - az, bx - ax);
    road.push(box(L + 6, 0.1, 11, (ax + bx) / 2, Y + 0.04, (az + bz) / 2, 0x3c3c40, ang));
    for (let s = 4; s < L - 2; s += 9) { const t = s / L; road.push(box(4, 0.04, 0.3, ax + (bx - ax) * t, Y + 0.11, az + (bz - az) * t, 0xf2f0ea, ang)); }
  }
  const C = DP.circle;
  road.push(tint(new THREE.RingGeometry(C.r - 6, C.r + 6, 32).rotateX(-Math.PI / 2).translate(C.x, Y + 0.05, C.z), 0x3c3c40));
  road.push(tint(new THREE.CylinderGeometry(C.r - 6, C.r - 6, 0.5, 32).translate(C.x, Y + 0.25, C.z), 0x5a9a4a));
  road.push(tint(new THREE.CylinderGeometry(1.2, 1.6, 4, 8).translate(C.x, Y + 2.5, C.z), 0xf2efe6), tint(new THREE.SphereGeometry(1.3, 10, 8).translate(C.x, Y + 5.2, C.z), 0xf2c230));
  // the parking by the jetty
  road.push(box(70, 0.1, 40, -30, Y + 0.04, 2808, 0x4a4a4e));
  for (let x = -60; x < 4; x += 6) road.push(box(0.25, 0.04, 6, x, Y + 0.11, 2820, 0xf2f0ea));
  group.add(merged(road));

  // ---- the souvenir stalls on the way to the jetty: shells, caps, sunglasses, coconut-shell monkeys ----
  const stalls: THREE.BufferGeometry[] = [], awn = [0xd0342c, 0x2f7fc1, 0xf2c230, 0x2c9a52, 0xe07ab0, 0xe8732a];
  for (let i = 0; i < 6; i++) {
    const x = -66 + i * 9, z = 2848;
    stalls.push(box(6, 2.2, 3.5, x, Y + 1.1, z, 0xc8a878), box(7, 0.25, 4.6, x, Y + 3.3, z + 0.4, awn[i]));
    for (const dx of [-3, 3]) stalls.push(box(0.15, 3.2, 0.15, x + dx, Y + 1.6, z + 2.4, 0x6a5040));
    for (let k = 0; k < 6; k++) stalls.push(box(0.6, 0.5, 0.6, x - 2.2 + k * 0.9, Y + 2.45, z + 1.4, awn[(i + k + 1) % 6]));
  }
  group.add(merged(stalls));
  // parked: two tourist buses and a row of taxis (black and yellow) and cars
  const parked: THREE.BufferGeometry[] = [];
  for (const [x, z] of [[-48, 2800], [-20, 2800]]) { parked.push(box(4, 4, 15, x, Y + 2.4, z, 0xf2efe6), box(4.05, 1.2, 15.05, x, Y + 2.8, z, 0x1a1e26), box(4.06, 0.5, 15.06, x, Y + 1.2, z, 0x2f7fc1)); for (const dz of [-5, 5]) for (const dx of [-2, 2]) parked.push(tint(new THREE.CylinderGeometry(0.6, 0.6, 0.4, 10).rotateZ(Math.PI / 2).translate(x + dx, Y + 0.6, z + dz), 0x151515)); }
  group.add(merged(parked));
  for (let i = 0; i < 6; i++) { const c = buildCar(pick(ROAD_MIX, rnd()), i % 2 ? 0x1d1d22 : null, 'private'); c.obj.position.set(-2 + i * 0 + (i % 3) * 8, Y + 0.05, 2786 + Math.floor(i / 3) * 0); c.obj.position.set(2 - 64 + i * 10, Y + 0.05, 2824); c.obj.rotation.y = Math.PI / 2; group.add(c.obj); }

  // ---- the jetty: a walkway on pillars out to the round viewpoint with its gazebo ----
  const J = DP.jetty, V = DP.view, jet: THREE.BufferGeometry[] = [];
  jet.push(box(J.x1 - J.x0 + 4, 0.6, J.w, (J.x0 + J.x1) / 2, JY - 0.3, J.z, 0xd8d0c0));
  for (let x = J.x0 + 4; x < J.x1; x += 12) for (const s of [-1, 1]) jet.push(box(1, JY + 3, 1, x, (JY - 3) / 2, J.z + s * (J.w / 2 - 1), 0x9a9286));
  for (const s of [-1, 1]) { jet.push(box(J.x1 - J.x0 - 12, 0.2, 0.25, (J.x0 + J.x1) / 2 + 6, JY + 1.0, J.z + s * (J.w / 2 - 0.2), 0xf6f4ee)); for (let x = J.x0 + 14; x < J.x1; x += 3) jet.push(box(0.2, 1.0, 0.2, x, JY + 0.5, J.z + s * (J.w / 2 - 0.2), 0xf6f4ee)); }
  jet.push(tint(new THREE.CylinderGeometry(V.r, V.r, 0.6, 28).translate(V.x, JY - 0.3, V.z), 0xd8d0c0), tint(new THREE.CylinderGeometry(V.r - 2, V.r - 1, JY + 3, 20).translate(V.x, (JY - 3) / 2 - 0.3, V.z), 0x9a9286));
  for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; jet.push(box(0.5, 4.2, 0.5, V.x + Math.cos(a) * 7, JY + 2.1, V.z + Math.sin(a) * 7, 0xf6f4ee)); }
  jet.push(tint(new THREE.ConeGeometry(9.5, 3.5, 6).translate(V.x, JY + 5.9, V.z), 0xb0403a));
  for (let k = 0; k < 24; k++) { const a = k * Math.PI / 12; if (Math.abs(Math.cos(a) - 1) < 0.08) continue; jet.push(box(0.2, 1.0, 0.2, V.x + Math.cos(a) * (V.r - 0.3), JY + 0.5, V.z + Math.sin(a) * (V.r - 0.3), 0xf6f4ee)); }
  // the statue of the couple on its pedestal, where the jetty starts
  const st = { x: -60, z: 2896 };
  jet.push(box(5, 2.4, 5, st.x, Y + 1.2, st.z, 0xe8e2d4), box(0.9, 3.4, 0.9, st.x - 0.7, Y + 4.1, st.z, 0xc8c4bc), box(0.9, 3.0, 0.9, st.x + 0.7, Y + 3.9, st.z, 0xc8c4bc));
  jet.push(tint(new THREE.SphereGeometry(0.55, 10, 8).translate(st.x - 0.7, Y + 6.2, st.z), 0xc8c4bc), tint(new THREE.SphereGeometry(0.5, 10, 8).translate(st.x + 0.7, Y + 5.8, st.z), 0xc8c4bc));
  jet.push(box(2.4, 0.4, 0.4, st.x + 1.6, Y + 5.2, st.z, 0xc8c4bc, -0.5));   // her arm, pointing out to sea
  group.add(merged(jet));
  // lamps along the jetty, lit at night
  const glow = new THREE.MeshBasicMaterial({ color: 0xffd98a });
  for (let x = J.x0 + 20; x < J.x1; x += 24) for (const s of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 4.5, 5), new THREE.MeshLambertMaterial({ color: 0x2a2a2e })); p.position.set(x, JY + 2.25, J.z + s * (J.w / 2 - 0.6)); group.add(p);
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), glow); l.position.set(x, JY + 4.6, J.z + s * (J.w / 2 - 0.6)); group.add(l);
  }

  // ---- the jet skis, bobbing at the beach ----
  const ski = (col: number) => {
    const o = new THREE.Group(), p: THREE.BufferGeometry[] = [];
    p.push(box(3.2, 0.7, 1.2, 0, 0.35, 0, col), box(1.2, 0.5, 0.9, 1.9, 0.3, 0, col), box(1.4, 0.35, 0.7, -0.3, 0.85, 0, 0x1d1d22), box(0.5, 0.6, 0.9, 0.7, 0.95, 0, 0xf2f0ea), box(0.1, 0.1, 1.1, 0.8, 1.35, 0, 0x222222));
    o.add(merged(p)); o.scale.setScalar(1.4); return o;
  };
  const skis = [0xe8302a, 0xf2c230, 0x2f7fc1].map((c, i) => { const o = ski(c); o.position.set(DP.beach.x - 22 + i * 16, WATER_Y, DP.beach.z + 16); o.rotation.y = Math.PI / 2 + (i - 1) * 0.3; group.add(o); return o; });
  // a little buoy line marking the ride area, and the hut with the sign
  for (let k = 0; k < 9; k++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 6), new THREE.MeshLambertMaterial({ color: 0xf26a1a })); b.position.set(DP.beach.x - 60 + k * 15, WATER_Y + 0.2, DP.beach.z + 45); group.add(b); }
  {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256; const c = cv.getContext('2d')!;
    c.fillStyle = '#1f5fa8'; c.fillRect(0, 0, 512, 256); c.fillStyle = '#f2c230'; c.font = '900 64px Arial, sans-serif'; c.textAlign = 'center'; c.fillText('JET SKI', 256, 90);
    c.fillStyle = '#ffffff'; c.font = '700 54px Arial, sans-serif'; c.fillText('Rs 500 / round', 256, 160); c.font = '32px Arial, sans-serif'; c.fillText("Rocky's Water Sports", 256, 220);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const hut: THREE.BufferGeometry[] = [box(5, 2.6, 4, DP.beach.x + 28, Y + 1.3, DP.beach.z - 22, 0xc8a878), box(6.4, 0.4, 5.4, DP.beach.x + 28, Y + 2.9, DP.beach.z - 22, 0x2f7fc1)];
    group.add(merged(hut));
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(5, 2.5), new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide })); sign.position.set(DP.beach.x + 28, Y + 4.6, DP.beach.z - 19.9); group.add(sign);
  }

  // ---- traffic: down the coast road, round the circle, back up; it jams near the circle ----
  const lane: THREE.Vector3[] = [];
  const pts = [...R.map(([x, z]) => new THREE.Vector3(x, 0, z))];
  for (let k = 0; k <= 12; k++) { const a = -Math.PI / 2 - 0.4 + k * (Math.PI * 2 - 0.8) / 12; pts.push(new THREE.Vector3(C.x + Math.cos(a) * C.r, 0, C.z - Math.sin(a) * C.r * -1)); }
  for (const [x, z] of [...R].reverse()) pts.push(new THREE.Vector3(x, 0, z));
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal'); const L = curve.getLength();
  for (let i = 0; i <= 400; i++) lane.push(curve.getPointAt(i / 400));
  const at = (s: number) => { const u = ((s % L) + L) % L / L, p = curve.getPointAt(u), t = curve.getTangentAt(u); return { x: p.x - t.z * 2.8, z: p.z + t.x * 2.8, hx: t.x, hz: t.z }; };
  const cars: Vehicle[] = [];
  const kinds = ['car', 'car', 'bus', 'car', 'scooter', 'car', 'car', 'scooter', 'car', 'bus', 'car', 'scooter', 'car', 'car', 'scooter', 'car', 'bus', 'car'];
  kinds.forEach((k, i) => {
    let obj: THREE.Object3D, len = 7;
    if (k === 'car') { const c = buildCar(pick(ROAD_MIX, rnd()), i % 4 === 0 ? 0x1d1d22 : null, 'private'); obj = c.obj; len = c.len + 2; }
    else if (k === 'bus') { obj = merged([box(15, 4, 4, 0, 2.4, 0, 0xf2efe6), box(15.05, 1.2, 4.05, 0, 2.8, 0, 0x1a1e26), box(15.06, 0.5, 4.06, 0, 1.2, 0, 0xd0342c)]); len = 17; }
    else { obj = merged([box(1.8, 0.7, 0.5, 0, 0.7, 0, [0xd0342c, 0x2f7fc1, 0xf2f0ea][i % 3]), box(0.5, 1.2, 0.4, 0.2, 1.4, 0, 0x2a2a3a), tint(new THREE.SphereGeometry(0.28, 8, 6).translate(0.2, 2.2, 0), 0xf2c230)]); len = 4; }
    group.add(obj); cars.push({ obj, s: i * L / kinds.length, v: 8, len, bus: k === 'bus' });
  });

  // ---- the people of Dona Paula, each at their spot during their working hours ----
  const locals: Local[] = [
    { c: { name: 'Rocky', job: 'jet ski operator', outfit: 'tee', top: 0xf2c230, bottom: 0x2f7fc1, hair: 'cap', skin: 2, prop: 'none', hint: 'chatty',
      lines: [] }, at: { x: DP.beach.x + 22, z: DP.beach.z - 14 }, from: 540, to: 1080, obj: null, said: 0, face: 0 },
    { c: { name: 'Fatima', job: 'souvenir seller', outfit: 'sari', top: 0x2c9a52, bottom: 0x2c9a52, hair: 'bun', skin: 1, prop: 'none', hint: 'kind',
      lines: ['Shell necklace, baba? For your mother. Fifty only, last price!', 'Caps, goggles, coconut monkeys! All the tourists take the monkey.', 'Since morning not one sale, men. Then one bus comes and everybody wants everything at once.'] },
      at: { x: -48, z: 2856 }, from: 600, to: 1260, obj: null, said: 0, face: 0 },
    { c: { name: 'Babu', job: 'photographer', outfit: 'shirt', top: 0xe07ab0, bottom: 0x2a2a3a, hair: 'black', skin: 2, prop: 'camera', hint: 'chatty',
      lines: ['One photo, fifty rupees! Printed in five minutes, with the statue behind.', 'Stand there, there... little left... smile! Aay, you blinked.', 'Honeymoon couples, every day forty, fifty. All want the same photo, same pose.'] },
      at: { x: -110, z: 2876 }, from: 600, to: 1140, obj: null, said: 0, face: 0 },
    { c: { name: 'Peter', job: 'coconut seller', outfit: 'kurta', top: 0xf6f4ee, bottom: 0x6a5a40, hair: 'straw', skin: 2, prop: 'none', hint: 'kind',
      lines: ['Tender coconut, cold cold! I keep them in the shade only.', 'After, I cut it open, you eat the malai with this spoon. Free.', 'Thirty years I am here. Before, there were no buses, only the fishermen and me.'] },
      at: { x: 4, z: 2836 }, from: 540, to: 1080, obj: null, said: 0, face: 0 },
    { c: { name: 'Havaldar Naik', job: 'traffic constable', outfit: 'uniform', top: 0xc8a878, bottom: 0xc8a878, hair: 'cap', skin: 1, prop: 'none', hint: 'grumpy',
      lines: ['Phreeeet! Move, move! No parking at the circle!', 'Every Sunday the same: twenty buses, two hundred cars, and one road. Aay deva.', 'Those rent-a-car fellows. They stop in the middle of the road to take a selfie!'] },
      at: { x: C.x + 26, z: C.z - 6 }, from: 480, to: 1200, obj: null, said: 0, face: 0 },
    { c: { name: 'Mr. Gaonkar', job: 'old fisherman', outfit: 'shirt', top: 0x8aa8c8, bottom: 0xf5f0e0, hair: 'grey', skin: 2, prop: 'cane', old: true, hint: 'vague',
      lines: ['You know why it is called Dona Paula? A viceroy\'s daughter, Paula, they say she jumped from these rocks for love.', 'Some nights, they say, she rises from the sea with a pearl necklace. I have never seen. ...Not sure also.', 'Before all this jetty and photo-photo, we used to dry fish right here on the rocks.'] },
      at: { x: V.x + 6, z: V.z + 5 }, from: 960, to: 1230, obj: null, said: 0, face: 0 },
  ];
  const onShift = (p: Local) => { const m = ctx.clock(); return m >= p.from && m < p.to; };

  // ---- the jet ski ride: out from the beach, round the jetty's tip, and back ----
  const loop = new THREE.CatmullRomCurve3([
    [DP.beach.x - 6, DP.beach.z + 18], [-60, 3075], [-230, 3040], [-330, 2945], [-345, 2840], [-280, 2770], [-200, 2790],
    [-300, 2830], [-375, 2890], [-310, 3040], [-120, 3110], [DP.beach.x + 30, 3060], [DP.beach.x + 4, DP.beach.z + 20],
  ].map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
  const spray = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(new Array(90 * 3).fill(0), 3)), new THREE.PointsMaterial({ color: 0xf4fbff, size: 0.5 }));
  spray.visible = false; group.add(spray);
  let ride = -1, rideSki: THREE.Group | null = null, pending: { msg: string; pts: number } | null = null, held: Hold | null = null, whistleT = 0, landing = false;

  return {
    group,
    talk: (px, pz) => {
      let best: Local | null = null, bd = 7;
      for (const p of locals) { if (!onShift(p)) continue; const d = Math.hypot(p.at.x - px, p.at.z - pz); if (d < bd) { bd = d; best = p; } }
      if (!best) return null;
      if (best.c.name === 'Rocky') {
        if (ride >= 0) return 'Rocky: "Hold tight, baba! Don\'t let go of the handle!"';
        const pts = ctx.points();
        if (pts < RIDE_COST) return `Rocky: "Jet ski, jet ski! One round, Rs 500 only. Round the jetty and back!" ...You need ${RIDE_COST} points (Rs 500). You have ${pts}. Help some tourists and come back, no?`;
        ride = 0; rideSki = skis[best.said++ % skis.length]; pending = { msg: '', pts: -RIDE_COST };
        return 'Rocky: "Rs 500, done! Life jacket on. Hold here, and here. I drive, you scream. Chalo!" (-100 points)';
      }
      const line = best.c.lines[best.said++ % best.c.lines.length];
      return `${best.c.name} (${best.c.job}): "${line}"`;
    },
    tick: (px, pz) => {
      if (pending) { const p = pending; pending = null; return p; }
      if (landing) { landing = false; return { msg: 'Rocky: "Wah, you didn\'t even fall off! Come again tomorrow, baba." Your legs are still shaking.', pts: 0 }; }
      // the constable does not like children on the road at the circle
      whistleT -= 1 / 60;
      const naik = locals[4];
      if (onShift(naik) && whistleT <= 0 && Math.hypot(px - C.x, pz - C.z) < C.r + 7 && Math.hypot(px - C.x, pz - C.z) > C.r - 7) { whistleT = 15; return { msg: 'Phreeeet! Havaldar Naik: "Oye! Off the road, baba! You want to get flattened by a tourist bus?"', pts: 0 }; }
      return null;
    },
    hold: () => held,
    update: (dt, time, px, pz) => {
      // people: there in their hours, turning to you when you come near
      for (const p of locals) {
        const show = onShift(p) && Math.hypot(p.at.x - px, p.at.z - pz) < 360;
        if (show && !p.obj) { p.obj = ctx.figure(p.c); group.add(p.obj); }
        if (!p.obj) continue;
        p.obj.visible = show; if (!show) continue;
        const onJetty = p.at.x < DP.jetty.x1 - 15;
        p.obj.position.set(p.at.x, (onJetty ? JY : Y) + 0.15, p.at.z);
        const near = Math.hypot(p.at.x - px, p.at.z - pz) < 8;
        p.obj.rotation.y = near ? -Math.atan2(pz - p.at.z, px - p.at.x) : Math.sin(time * 0.3 + p.c.name.length) * 1.5;
      }
      // traffic: each keeps its distance to the one in front; near the circle it is bumper to bumper
      const order = [...cars].sort((a, b) => a.s - b.s);
      order.forEach((c, i) => {
        const next = order[(i + 1) % order.length]; let gap = next.s - c.s; if (gap <= 0) gap += L;
        const p = at(c.s), nearCircle = Math.hypot(p.x - C.x, p.z - C.z) < 95;
        let want = nearCircle ? 3 : 11;
        if (gap < next.len + 6) want = 0; else if (gap < next.len + 14) want = Math.min(want, 2.5);
        const ahead = (px - p.x) * p.hx + (pz - p.z) * p.hz, side = Math.abs((px - p.x) * p.hz - (pz - p.z) * p.hx);
        if (ahead > 0 && ahead < c.len / 2 + 6 && side < 3.5 && ride < 0) want = 0;   // the child in the way: they stop (and honk)
        c.v += (want - c.v) * Math.min(1, dt * 2.5); c.s = (c.s + c.v * dt) % L;
        const q = at(c.s), y = q.z < 2385 ? Math.max(0.6, ctx.g.heightAt(q.x, q.z)) : Y;
        c.obj.position.set(q.x, y + 0.08, q.z); c.obj.rotation.y = -Math.atan2(q.hz, q.hx);
      });
      // jet skis bob; the ride
      skis.forEach((s, i) => { if (s !== rideSki || ride < 0) { s.position.y = WATER_Y + Math.sin(time * 1.8 + i) * 0.12 - 0.1; s.rotation.z = Math.sin(time * 1.3 + i) * 0.06; } });
      held = null;
      if (ride >= 0 && rideSki) {
        ride += dt;
        const u = Math.min(1, ride / RIDE_TIME), p = loop.getPointAt(u), t = loop.getTangentAt(u), t2 = loop.getTangentAt(Math.min(1, u + 0.01));
        const turn = t.x * t2.z - t.z * t2.x, bob = Math.abs(Math.sin(time * 5)) * 0.35;
        rideSki.position.set(p.x, WATER_Y + bob, p.z); rideSki.rotation.set(0, 0, 0); rideSki.rotation.y = -Math.atan2(t.z, t.x); rideSki.rotation.x = Math.max(-0.35, Math.min(0.35, -turn * 12));   // leans into the turns rideSki.rotation.z = 0.08 + Math.sin(time * 5) * 0.05;
        held = { x: p.x, z: p.z, y: WATER_Y + bob + 1.1, heading: Math.atan2(t.z, t.x) };
        // the spray behind
        spray.visible = true; spray.position.copy(rideSki.position); spray.rotation.y = rideSki.rotation.y;
        const a = spray.geometry.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < a.count; i++) { const k = (time * 2.4 + i / a.count) % 1; a.setXYZ(i, -2.5 - k * 9, k * 2.6 - k * k * 2.4, Math.sin(i * 2.3) * (0.4 + k * 2)); }
        a.needsUpdate = true;
        if (u >= 1) { ride = -1; spray.visible = false; held = { x: DP.beach.x + 10, z: DP.beach.z - 18, y: Y, heading: -Math.PI / 2 }; landing = true; rideSki.position.set(DP.beach.x - 22 + skis.indexOf(rideSki) * 16, WATER_Y, DP.beach.z + 16); rideSki.rotation.set(0, Math.PI / 2, 0); }
      }
    },
  };
}
