// Dona Paula, on the real headland at the end of the road from Panjim (from OpenStreetMap): the road jams up with
// tourist buses, taxis, rent-a-cars and scooters heading for the circle; souvenir stalls stand by the parking; the
// jetty runs out from the southern tip to the round viewpoint, with the statue of the couple at its start. In the bay
// on the east side, Rocky runs his jet skis: Rs 500 a round.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { WATER_Y } from '../world/data';
import type { AreaContext, AreaInstance, Hold } from './types';
import type { Cast } from '../entities/cast';
import { buildCar, pick, ROAD_MIX } from '../entities/cars';
import { DP, donaPaulaLand, isletY } from './donapaulaLand';

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
  let seed = 4242; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const box = (l: number, h: number, w: number, x: number, y: number, z: number, c: number, ry = 0) => tint(new THREE.BoxGeometry(l, h, w).rotateY(ry).translate(x, y, z), c);

  const boats: THREE.Object3D[] = [];
  const C = DP.circle, gy = (x: number, z: number) => Math.max(0.6, ctx.g.heightAt(x, z));

  // ---- the souvenir stalls by the parking: shells, caps, sunglasses, coconut-shell monkeys ----
  const stalls: THREE.BufferGeometry[] = [], awn = [0xd0342c, 0x2f7fc1, 0xf2c230, 0x2c9a52, 0xe07ab0, 0xe8732a];
  const stallAt: [number, number][] = [];
  for (let k = 0; k < 40 && stallAt.length < 6; k++) {
    const x = DP.parking.x - 40 + (k % 8) * 10, z = DP.parking.z + 34 + Math.floor(k / 8) * 9;
    if (ctx.free(x, z) && ctx.free(x - 3, z) && ctx.free(x + 3, z)) stallAt.push([x, z]);
  }
  stallAt.forEach(([x, z], i) => {
    const y = gy(x, z);
    stalls.push(box(6, 2.2, 3.5, x, y + 1.1, z, 0xc8a878), box(7, 0.25, 4.6, x, y + 3.3, z + 0.4, awn[i]));
    for (const dx of [-3, 3]) stalls.push(box(0.15, 3.2, 0.15, x + dx, y + 1.6, z + 2.4, 0x6a5040));
    for (let k = 0; k < 6; k++) stalls.push(box(0.6, 0.5, 0.6, x - 2.2 + k * 0.9, y + 2.45, z + 1.4, awn[(i + k + 1) % 6]));
  });
  if (stalls.length) group.add(merged(stalls));
  // parked in the Dona Paula parking: two tourist buses
  const parked: THREE.BufferGeometry[] = [];
  for (const [x, z] of [[DP.parking.x - 8, DP.parking.z], [DP.parking.x + 8, DP.parking.z]]) {
    const y = gy(x, z);
    parked.push(box(4, 4, 15, x, y + 2.4, z, 0xf2efe6), box(4.05, 1.2, 15.05, x, y + 2.8, z, 0x1a1e26), box(4.06, 0.5, 15.06, x, y + 1.2, z, 0x2f7fc1));
    for (const dz of [-5, 5]) for (const dx of [-2, 2]) parked.push(tint(new THREE.CylinderGeometry(0.6, 0.6, 0.4, 10).rotateZ(Math.PI / 2).translate(x + dx, y + 0.6, z + dz), 0x151515));
  }
  group.add(merged(parked));

  // ---- the jetty, as in the aerial photos: a wide walk paved in terracotta tiles from the spit out to the rocky islet
  // with the white viewpoint, a long T-pier off it to the east, low white parapets, blue-tarp stalls along the walk ----
  const J = DP.jetty, V = DP.view, A = DP.arm, HD = DP.head, JY = DP.jettyY, jet: THREE.BufferGeometry[] = [];
  const pave = 0xc8805a, paveDark = 0xb06e4c, parapet = 0xf2ede2, pillar = 0x8a7e70;
  const deck = (cx: number, cz: number, lx: number, lz: number) => {
    jet.push(box(lx, 0.7, lz, cx, JY - 0.35, cz, pave));
    for (let k = 0; k < Math.max(lx, lz) / 3; k++) {                       // the tile courses across the walk
      if (lx > lz) jet.push(box(0.12, 0.02, lz - 0.6, cx - lx / 2 + 1.5 + k * 3, JY + 0.01, cz, paveDark));
      else jet.push(box(lx - 0.6, 0.02, 0.12, cx, JY + 0.01, cz - lz / 2 + 1.5 + k * 3, paveDark));
    }
    // the deck stands on stone piers down into the sea
    for (let k = 0; k < Math.max(lx, lz); k += 10) for (const s of [-1, 1]) {
      const px = lx > lz ? cx - lx / 2 + 3 + k : cx + s * (lx / 2 - 1.2), pz = lx > lz ? cz + s * (lz / 2 - 1.2) : cz - lz / 2 + 3 + k;
      jet.push(box(1.4, JY + 3, 1.4, px, (JY - 3) / 2 - 0.4, pz, pillar));
    }
  };
  const wall = (x0: number, z0: number, x1: number, z1: number) => {     // a low white parapet with a coping
    const L = Math.hypot(x1 - x0, z1 - z0), a = -Math.atan2(z1 - z0, x1 - x0);
    jet.push(box(L, 0.7, 0.35, (x0 + x1) / 2, JY + 0.35, (z0 + z1) / 2, parapet, a), box(L, 0.08, 0.5, (x0 + x1) / 2, JY + 0.74, (z0 + z1) / 2, 0xdcd6ca, a));
  };
  const RAMP = 14, SPIT = 0.8, rise = Math.atan2(JY - SPIT, RAMP);
  deck(J.x, (J.z0 + RAMP + J.z1) / 2, J.w, J.z1 - J.z0 - RAMP);
  jet.push(tint(new THREE.BoxGeometry(J.w, 0.7, Math.hypot(RAMP, JY - SPIT) + 0.4).rotateX(rise).translate(J.x, (SPIT + JY) / 2 - 0.35, J.z0 + RAMP / 2), pave));   // the ramp up from the spit
  deck((A.x0 + A.x1) / 2, A.z, A.x1 - A.x0, A.w);
  deck(HD.x, (HD.z0 + HD.z1) / 2, HD.w, HD.z1 - HD.z0);
  wall(J.x + J.w / 2, J.z0, J.x + J.w / 2, A.z - A.w / 2);                // the walk's east side, up to the arm
  wall(A.x0 + J.w / 2, A.z + A.w / 2, HD.x - HD.w / 2, A.z + A.w / 2);    // the arm's south side
  wall(A.x0 + J.w / 2, A.z - A.w / 2, HD.x - HD.w / 2, A.z - A.w / 2);    // its north side
  wall(HD.x + HD.w / 2, HD.z0, HD.x + HD.w / 2, HD.z1);                   // round the far end
  wall(HD.x - HD.w / 2, HD.z0, HD.x + HD.w / 2, HD.z0); wall(HD.x - HD.w / 2, HD.z1, HD.x + HD.w / 2, HD.z1);
  // the blue-tarp stalls down the walk's west side: caps, goggles, shell necklaces, cold drinks
  const tarp = [0x2a6fd0, 0x3a82e0, 0x1f5fb8];
  for (let z = J.z0 + 18, i = 0; z < J.z1 - 14; z += 5.2, i++) {
    const x = J.x - J.w / 2 + 1.6;
    jet.push(box(2.6, 1.0, 4.4, x, JY + 0.5, z, 0xd8c8a8), box(3.0, 0.12, 4.9, x + 0.2, JY + 2.4, z, tarp[i % 3], 0), box(0.1, 2.4, 0.1, x + 1.5, JY + 1.2, z - 2.2, 0x888888));
    for (let k = 0; k < 4; k++) jet.push(box(0.45, 0.35, 0.45, x - 0.6 + (k % 2) * 0.9, JY + 1.2, z - 1.2 + k * 0.8, awn[(i + k) % 6]));
  }
  // the islet: red laterite rocks round it, scrub and a few palms on top, and the white viewpoint with its steps
  {
    // the knoll: rings of points round the middle, each lifted to the hill's height with a little roughness
    const R = 9, SEG = 30, pos: number[] = [], idx: number[] = [];
    for (let i = 0; i <= R; i++) for (let k = 0; k < SEG; k++) {
      const a = k / SEG * Math.PI * 2, r = V.r * 1.08 * i / R, x = V.x + Math.cos(a) * r, z = V.z + Math.sin(a) * r;
      const y = i === R ? -1.5 : isletY(x, z) + (i > 0 ? (rnd() - 0.5) * 0.9 : 0);
      pos.push(x, y, z);
    }
    for (let i = 0; i < R; i++) for (let k = 0; k < SEG; k++) {
      const a0 = i * SEG + k, a1 = i * SEG + (k + 1) % SEG, b0 = a0 + SEG, b1 = a1 + SEG;
      idx.push(a0, a1, b0, a1, b1, b0);
    }
    const knoll = new THREE.BufferGeometry(); knoll.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); knoll.setIndex(idx);
    const kn = knoll.toNonIndexed(); kn.computeVertexNormals(); jet.push(tint(kn, 0x8e4a32));
    for (let k = 0; k < 40; k++) {                                                         // boulders round its foot
      const a = (k / 40) * Math.PI * 2 + rnd() * 0.15, r = V.r * (0.85 + rnd() * 0.3), s2 = 1.6 + rnd() * 2.4, x = V.x + Math.cos(a) * r, z = V.z + Math.sin(a) * r;
      jet.push(tint(new THREE.DodecahedronGeometry(s2, 0).scale(1.2, 0.7, 1).rotateY(rnd() * 6).translate(x, Math.max(0, isletY(x, z) - s2 * 0.4), z), [0x8a3a26, 0x9c4630, 0x7a3220][k % 3]));
    }
    for (let k = 0; k < 14; k++) {                                                          // scrub on the slopes
      const a = rnd() * 6.28, r = V.r * (0.2 + rnd() * 0.55), x = V.x + Math.cos(a) * r, z = V.z + Math.sin(a) * r;
      jet.push(tint(new THREE.IcosahedronGeometry(1.4 + rnd(), 1).scale(1.2, 0.8, 1.2).translate(x, isletY(x, z) + 0.6, z), k % 2 ? 0x3f7a34 : 0x55893c));
    }
    // the white viewpoint on the top
    const vx = V.x - 2, vz = V.z, iy = isletY(vx, vz) - 0.3;
    jet.push(box(10, 1.0, 10, vx, iy + 0.2, vz, 0xeeeae0), box(8, 3.2, 8, vx, iy + 2.2, vz, 0xf6f3ea), box(9.2, 0.5, 9.2, vx, iy + 4.0, vz, 0xe2ddd0));
    jet.push(tint(new THREE.SphereGeometry(2.8, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(vx, iy + 4.2, vz), 0xf6f3ea));
    for (const [dx, dz] of [[-4, 0], [4, 0], [0, -4], [0, 4]]) jet.push(box(dx ? 0.2 : 2.6, 2.0, dx ? 2.6 : 0.2, vx + dx * 1.01, iy + 1.6, vz + dz * 1.01, 0x3a3a3e));   // arched openings
    // white steps from the end of the walk up the knoll to the viewpoint
    const sx = J.x - J.w / 2, sz = J.z1 - 4;
    for (let k = 0; k <= 12; k++) {
      const t = k / 12, x = sx + (vx + 5 - sx) * t, z = sz + (vz - sz) * t, y = JY + (isletY(vx + 5, vz) - JY) * t;
      jet.push(box(1.4, 0.35, 3, x, y - 0.1, z, 0xe2ddd0, -Math.atan2(vz - sz, vx + 5 - sx)));
    }
  }
  // the statue of the couple on its pedestal, on the rocks where the walk starts
  {
    const st = DP.statue, y = gy(st.x, st.z);
    jet.push(box(5, 2.4, 5, st.x, y + 1.2, st.z, 0xe8e2d4), box(0.9, 3.4, 0.9, st.x - 0.7, y + 4.1, st.z, 0xc8c4bc), box(0.9, 3.0, 0.9, st.x + 0.7, y + 3.9, st.z, 0xc8c4bc));
    jet.push(tint(new THREE.SphereGeometry(0.55, 10, 8).translate(st.x - 0.7, y + 6.2, st.z), 0xc8c4bc), tint(new THREE.SphereGeometry(0.5, 10, 8).translate(st.x + 0.7, y + 5.8, st.z), 0xc8c4bc));
    jet.push(box(2.4, 0.4, 0.4, st.x + 1.6, y + 5.2, st.z, 0xc8c4bc, -0.5));   // her arm, pointing out to sea
  }
  // red laterite boulders all along the tip's shore, where the land meets the sea
  for (let x = 640; x < 960; x += 7) for (let z = 5560; z < 5860; z += 7) {
    const w0 = ctx.g.isWet(x, z); if (w0) continue;
    if (!(ctx.g.isWet(x + 9, z) || ctx.g.isWet(x - 9, z) || ctx.g.isWet(x, z + 9) || ctx.g.isWet(x, z - 9))) continue;
    if (Math.abs(x - J.x) < J.w && z > J.z0 - 8) continue;
    const s = 1.4 + rnd() * 2.6, ox = (rnd() - 0.5) * 6, oz = (rnd() - 0.5) * 6;
    jet.push(tint(new THREE.DodecahedronGeometry(s, 0).scale(1.3, 0.65, 1).rotateY(rnd() * 6).translate(x + ox, Math.max(0.2, gy(x + ox, z + oz) - s * 0.3), z + oz), [0x8a3a26, 0x9c4630, 0x7a3220, 0x6e3a2a][Math.floor(rnd() * 4)]));
  }
  group.add(merged(jet));
  // lamps along the walk, lit at night
  const glow = new THREE.MeshBasicMaterial({ color: 0xffd98a });
  for (let z = J.z0 + 10; z < J.z1 - 6; z += 20) {
    const x = J.x + J.w / 2 - 0.5;
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 4.5, 5), new THREE.MeshLambertMaterial({ color: 0x2a2a2e })); p.position.set(x, JY + 2.25, z); group.add(p);
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), glow); l.position.set(x, JY + 4.6, z); group.add(l);
  }
  // fishing boats and canoes moored in the bay east of the jetty, as in the photo
  {
    const hulls = [0x2a8ad0, 0x2fa0b8, 0xf2f0ea, 0xd8402a, 0x3a9a6a];
    for (let k = 0, n = 0; k < 400 && n < 22; k++) {
      const x = 850 + rnd() * 300, z = 5560 + rnd() * 230;
      if (!ctx.g.isWet(x, z) || !ctx.g.isWet(x + 6, z) || !ctx.g.isWet(x - 6, z) || (x > 820 && x < 915 && z > 5770 && z < 5850) || Math.abs(z - DP.arm.z) < 9) continue;
      const col = hulls[n % hulls.length], b = new THREE.Group();
      b.add(merged([box(6, 0.9, 1.7, 0, 0.35, 0, col), box(1.6, 0.7, 1.2, 3.3, 0.45, 0, col, 0), box(5.4, 0.1, 1.4, 0, 0.82, 0, 0x6a4a30), box(1.4, 0.8, 1.2, -1.2, 1.2, 0, 0xf2f0ea)]));
      b.position.set(x, WATER_Y - 0.15, z); b.rotation.y = rnd() * 6.28; b.userData.bob = rnd() * 6; group.add(b); boats.push(b); n++;
    }
  }

  // ---- the jet skis, bobbing in the bay ----
  const ski = (col: number) => {
    const o = new THREE.Group(), p: THREE.BufferGeometry[] = [];
    p.push(box(3.2, 0.7, 1.2, 0, 0.35, 0, col), box(1.2, 0.5, 0.9, 1.9, 0.3, 0, col), box(1.4, 0.35, 0.7, -0.3, 0.85, 0, 0x1d1d22), box(0.5, 0.6, 0.9, 0.7, 0.95, 0, 0xf2f0ea), box(0.1, 0.1, 1.1, 0.8, 1.35, 0, 0x222222));
    o.add(merged(p)); o.scale.setScalar(1.4); return o;
  };
  const skiHome = (i: number): [number, number] => [DP.skis.x + (i - 1) * 14, DP.skis.z + (i - 1) * 6];
  const skis = [0xe8302a, 0xf2c230, 0x2f7fc1].map((c, i) => { const o = ski(c); const [x, z] = skiHome(i); o.position.set(x, WATER_Y, z); o.rotation.y = Math.PI / 4; group.add(o); return o; });
  for (let k = 0; k < 9; k++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 6), new THREE.MeshLambertMaterial({ color: 0xf26a1a })); b.position.set(DP.skis.x + 40 - k * 6, WATER_Y + 0.2, DP.skis.z + 30 + k * 6); group.add(b); }
  {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256; const c = cv.getContext('2d')!;
    c.fillStyle = '#1f5fa8'; c.fillRect(0, 0, 512, 256); c.fillStyle = '#f2c230'; c.font = '900 64px Arial, sans-serif'; c.textAlign = 'center'; c.fillText('JET SKI', 256, 90);
    c.fillStyle = '#ffffff'; c.font = '700 54px Arial, sans-serif'; c.fillText('Rs 500 / round', 256, 160); c.font = '32px Arial, sans-serif'; c.fillText("Rocky's Water Sports", 256, 220);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const hx = DP.beach.x - 6, hz = DP.beach.z - 8, y = gy(hx, hz);
    group.add(merged([box(5, 2.6, 4, hx, y + 1.3, hz, 0xc8a878), box(6.4, 0.4, 5.4, hx, y + 2.9, hz, 0x2f7fc1)]));
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(5, 2.5), new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide })); sign.position.set(hx + 2.1, y + 4.6, hz + 2.1); sign.rotation.y = Math.PI / 4; group.add(sign);
  }

  // ---- traffic: up and down the real Dona Paula road to the circle and back; it jams near the circle ----
  const net = ctx.net, na = net.nearestNode(C.x + 60, C.z - 700), nb = net.nearestNode(C.x, C.z);
  const pts: THREE.Vector3[] = [];
  for (const e of net.route(na, nb)) { const L0 = net.edge(e).len; for (let s2 = 0; s2 < L0; s2 += 6) { const q = net.at(e, s2); pts.push(new THREE.Vector3(q.x, 0, q.z)); } }
  for (const p of [...pts].reverse()) pts.push(p.clone());
  const ok = pts.length > 4, curve = ok ? new THREE.CatmullRomCurve3(pts, false, 'centripetal') : null, L = curve ? curve.getLength() : 1;
  const at = (s: number) => { const u = ((s % L) + L) % L / L, p = curve!.getPointAt(u), t = curve!.getTangentAt(u); return { x: p.x - t.z * 2.6, z: p.z + t.x * 2.6, hx: t.x, hz: t.z }; };
  const cars: Vehicle[] = [];
  const kinds = ok ? ['car', 'car', 'bus', 'car', 'scooter', 'car', 'car', 'scooter', 'car', 'bus', 'car', 'scooter', 'car', 'car', 'scooter', 'car'] : [];
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
      lines: [] }, at: { x: DP.beach.x, z: DP.beach.z }, from: 540, to: 1080, obj: null, said: 0, face: 0 },
    { c: { name: 'Fatima', job: 'souvenir seller', outfit: 'sari', top: 0x2c9a52, bottom: 0x2c9a52, hair: 'bun', skin: 1, prop: 'none', hint: 'kind',
      lines: ['Shell necklace, baba? For your mother. Fifty only, last price!', 'Caps, goggles, coconut monkeys! All the tourists take the monkey.', 'Since morning not one sale, men. Then one bus comes and everybody wants everything at once.'] },
      at: { x: (stallAt[0]?.[0] ?? DP.parking.x) + 2, z: (stallAt[0]?.[1] ?? DP.parking.z + 30) + 5 }, from: 600, to: 1260, obj: null, said: 0, face: 0 },
    { c: { name: 'Babu', job: 'photographer', outfit: 'shirt', top: 0xe07ab0, bottom: 0x2a2a3a, hair: 'black', skin: 2, prop: 'camera', hint: 'chatty',
      lines: ['One photo, fifty rupees! Printed in five minutes, with the statue behind.', 'Stand there, there... little left... smile! Aay, you blinked.', 'Honeymoon couples, every day forty, fifty. All want the same photo, same pose.'] },
      at: { x: DP.jetty.x + 2, z: DP.jetty.z0 + 40 }, from: 600, to: 1140, obj: null, said: 0, face: 0 },
    { c: { name: 'Peter', job: 'coconut seller', outfit: 'kurta', top: 0xf6f4ee, bottom: 0x6a5a40, hair: 'straw', skin: 2, prop: 'none', hint: 'kind',
      lines: ['Tender coconut, cold cold! I keep them in the shade only.', 'After, I cut it open, you eat the malai with this spoon. Free.', 'Thirty years I am here. Before, there were no buses, only the fishermen and me.'] },
      at: { x: DP.statue.x + 8, z: DP.statue.z - 10 }, from: 540, to: 1080, obj: null, said: 0, face: 0 },
    { c: { name: 'Havaldar Naik', job: 'traffic constable', outfit: 'uniform', top: 0xc8a878, bottom: 0xc8a878, hair: 'cap', skin: 1, prop: 'none', hint: 'grumpy',
      lines: ['Phreeeet! Move, move! No parking at the circle!', 'Every Sunday the same: twenty buses, two hundred cars, and one road. Aay deva.', 'Those rent-a-car fellows. They stop in the middle of the road to take a selfie!'] },
      at: { x: C.x + 16, z: C.z + 4 }, from: 480, to: 1200, obj: null, said: 0, face: 0 },
    { c: { name: 'Mr. Gaonkar', job: 'old fisherman', outfit: 'shirt', top: 0x8aa8c8, bottom: 0xf5f0e0, hair: 'grey', skin: 2, prop: 'cane', old: true, hint: 'vague',
      lines: ['You know why it is called Dona Paula? A viceroy\'s daughter, Paula, they say she jumped from these rocks for love.', 'Some nights, they say, she rises from the sea with a pearl necklace. I have never seen. ...Not sure also.', 'Before all this jetty and photo-photo, we used to dry fish right here on the rocks.'] },
      at: { x: DP.head.x, z: DP.head.z0 + 10 }, from: 960, to: 1230, obj: null, said: 0, face: 0 },
  ];
  const onShift = (p: Local) => { const m = ctx.clock(); return m >= p.from && m < p.to; };

  // ---- the jet ski ride: out from the beach, round the jetty's tip, and back ----
  const S0 = DP.skis, VV = DP.view;
  const loop = new THREE.CatmullRomCurve3([
    [S0.x, S0.z], [S0.x + 60, S0.z + 120], [S0.x - 40, S0.z + 330], [VV.x + 260, VV.z + 120], [VV.x + 60, VV.z + 110], [VV.x - 60, VV.z + 40],
    [VV.x - 70, VV.z - 10], [VV.x + 50, VV.z + 70], [VV.x + 300, VV.z + 60], [S0.x + 40, S0.z + 200], [S0.x + 20, S0.z + 10],
  ].map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
  const spray = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(new Array(90 * 3).fill(0), 3)), new THREE.PointsMaterial({ color: 0xf4fbff, size: 0.5 }));
  spray.visible = false; group.add(spray);
  let ride = -1, rideSki: THREE.Group | null = null, pending: { msg: string; pts: number } | null = null, landed = 0, whistleT = 0, landing = false;

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
      if (onShift(naik) && whistleT <= 0 && Math.hypot(px - C.x, pz - C.z) < 20 && Math.hypot(px - C.x, pz - C.z) > 6) { whistleT = 15; return { msg: 'Phreeeet! Havaldar Naik: "Oye! Off the road, baba! You want to get flattened by a tourist bus?"', pts: 0 }; }
      return null;
    },
    hold: () => {
      if (landed) { landed = 0; return { x: DP.beach.x - 4, z: DP.beach.z - 4, y: gy(DP.beach.x - 4, DP.beach.z - 4), heading: -Math.PI / 2 }; }   // back on the sand
      if (ride < 0 || !rideSki) return null;
      const time = performance.now() / 1000;
      const u = Math.min(1, ride / RIDE_TIME), p = loop.getPointAt(u), t = loop.getTangentAt(u), t2 = loop.getTangentAt(Math.min(1, u + 0.01));
      const turn = t.x * t2.z - t.z * t2.x, bob = Math.abs(Math.sin(time * 5)) * 0.35;
      rideSki.position.set(p.x, WATER_Y + bob, p.z); rideSki.rotation.set(Math.max(-0.35, Math.min(0.35, -turn * 12)), -Math.atan2(t.z, t.x), 0.08 + Math.sin(time * 5) * 0.05, 'YXZ');   // leans into the turns
      // the spray behind
      spray.visible = true; spray.position.copy(rideSki.position); spray.rotation.y = rideSki.rotation.y;
      const a = spray.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < a.count; i++) { const k = (time * 2.4 + i / a.count) % 1; a.setXYZ(i, -2.5 - k * 9, k * 2.6 - k * k * 2.4, Math.sin(i * 2.3) * (0.4 + k * 2)); }
      a.needsUpdate = true;
      return { x: p.x, z: p.z, y: WATER_Y + bob + 1.1, heading: Math.atan2(t.z, t.x) } as Hold;
    },
    update: (dt, time, px, pz) => {
      // people: there in their hours, turning to you when you come near
      for (const p of locals) {
        const show = onShift(p) && Math.hypot(p.at.x - px, p.at.z - pz) < 360;
        if (show && !p.obj) { p.obj = ctx.figure(p.c); group.add(p.obj); }
        if (!p.obj) continue;
        p.obj.visible = show; if (!show) continue;
        const onJetty = donaPaulaLand.free(p.at.x, p.at.z);
        p.obj.position.set(p.at.x, (onJetty ? DP.jettyY : gy(p.at.x, p.at.z)) + 0.15, p.at.z);
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
        const q = at(c.s), y = gy(q.x, q.z);
        c.obj.position.set(q.x, y + 0.08, q.z); c.obj.rotation.y = -Math.atan2(q.hz, q.hx);
      });
      for (const bt of boats) { bt.position.y = WATER_Y - 0.15 + Math.sin(time * 1.4 + bt.userData.bob) * 0.12; bt.rotation.z = Math.sin(time * 1.1 + bt.userData.bob) * 0.05; }
      // jet skis bob; the ride
      skis.forEach((s, i) => { if (s !== rideSki || ride < 0) { s.position.y = WATER_Y + Math.sin(time * 1.8 + i) * 0.12 - 0.1; s.rotation.z = Math.sin(time * 1.3 + i) * 0.06; } });
      // the ride moves on; the ski and the child are placed together when the game asks where the child is (hold)
      if (ride >= 0 && rideSki) {
        ride += dt;
        if (ride >= RIDE_TIME) { ride = -1; spray.visible = false; landed = 1; landing = true; const [hx, hz] = skiHome(skis.indexOf(rideSki)); rideSki.position.set(hx, WATER_Y, hz); rideSki.rotation.set(0, Math.PI / 4, 0); }
      }
    },
  };
}
