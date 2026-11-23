// Old Goa: the old Portuguese capital up the Mandovi. The Basilica of Bom Jesus in bare red laterite (St Francis
// Xavier rests inside), the great white Sé Cathedral with its one tower (the other fell in 1776), the Church of St Francis
// of Assisi beside it, and the Viceroy's Arch down by the river. Around the feast of St Francis Xavier (3 December, with
// the novena from 24 November) the lanes fill with fair stalls and candle sellers. Its own people: a candle seller, a
// nun with her pilgrims, a church guide, a kaju seller, a pilgrim who walked from Karnataka and a couple from Bangalore.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { AreaContext, AreaInstance } from './types';
import type { Cast } from '../entities/cast';
import { oldGoaAt } from './oldgoaSpot';

function tint(geo: THREE.BufferGeometry, hex: number): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo, c = new THREE.Color(hex), a = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < a.length; i += 3) { a[i] = c.r; a[i + 1] = c.g; a[i + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); if (g.attributes.uv) g.deleteAttribute('uv'); return g;
}

const LATERITE = 0x9c4a2e, LAT_LIGHT = 0xb4633e, LIME = 0xf3efe4, LIME_SHADE = 0xdcd6c6, ROOF = 0x9a3e28, DARK = 0x2a2220, GOLD = 0xe0b040;

/** The feast fair runs through the novena and the feast (24 Nov to 4 Dec). */
export function feastOn(now = new Date()): boolean {
  const m = now.getMonth(), d = now.getDate();
  return (m === 10 && d >= 24) || (m === 11 && d <= 4);
}

export function build(ctx: AreaContext): AreaInstance {
  const group = new THREE.Group(); group.name = 'oldgoa';
  const og = oldGoaAt(ctx.d); if (!og) return { group };
  const parts: THREE.BufferGeometry[] = [];
  const gy = (x: number, z: number) => Math.max(0.6, ctx.g.heightAt(x, z));
  // a building in its own frame: f along its length (towards its facade), s across; `ang` turns that frame in the world
  const frame = (cx: number, cz: number, ang: number) => {
    const fx = Math.cos(ang), fz = Math.sin(ang), sx = -fz, sz = fx, base = gy(cx, cz), rot = -ang;
    const put = (g: THREE.BufferGeometry, f: number, s: number, y: number, col: number) => parts.push(tint(g.rotateY(rot).translate(cx + fx * f + sx * s, base + y, cz + fz * f + sz * s), col));
    const box = (lf: number, h: number, ls: number, f: number, s: number, y: number, col: number) => put(new THREE.BoxGeometry(lf, h, ls), f, s, y + h / 2, col);
    // a gable roof along f: a triangular prism
    const gable = (lf: number, ls: number, rise: number, f: number, y: number, col: number) => put(new THREE.CylinderGeometry(ls / Math.sqrt(3), ls / Math.sqrt(3), lf, 3, 1).rotateZ(Math.PI / 2).rotateX(Math.PI / 6 * 3).scale(1, rise / (ls / Math.sqrt(3) * 1.5), 1), f, 0, y + rise / 3, col);
    return { put, box, gable, base };
  };
  const DEEP = 4;   // walls go down into the ground, so a slope never shows a gap

  // --- the Basilica of Bom Jesus: long laterite nave, the carved three-tier facade to the west, the bell tower behind
  {
    const { box, gable, put } = frame(og.bomJesus.x, og.bomJesus.z, Math.PI);   // facing west (-x)
    box(54, 15 + DEEP, 17, 0, 0, -DEEP, LATERITE); gable(55, 18, 6, 0, 15, ROOF);
    const F = 27.6;                                                     // the facade, a little proud of the nave
    box(1.6, 25 + DEEP, 19, F, 0, -DEEP, LAT_LIGHT);
    for (const y of [7.5, 14.5]) box(2.2, 0.7, 19.6, F + 0.3, 0, y, LATERITE);                      // the cornices between the tiers
    for (const s of [-8.6, -4.4, 0, 4.4, 8.6]) box(2.1, 21, 0.9, F + 0.3, s, 0, LATERITE);        // pilasters
    for (const s of [-6.5, 0, 6.5]) { box(0.3, 5.2, 2.6, F + 0.9, s, 0, DARK); put(new THREE.CylinderGeometry(1.3, 1.3, 0.3, 12, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2), F + 0.9, s, 5.2, DARK); }   // three arched doors
    for (const s of [-6.5, 0, 6.5]) for (const y of [9.5, 16.5]) box(0.3, 3, 1.6, F + 0.9, s, y, DARK);                                   // windows
    box(1.6, 5, 11, F, 0, 25, LAT_LIGHT); box(1.6, 3, 5, F, 0, 30, LAT_LIGHT);                     // the stepped gable
    put(new THREE.CylinderGeometry(1.9, 1.9, 0.4, 16).rotateZ(Math.PI / 2).rotateY(Math.PI / 2), F + 1.0, 0, 27.6, GOLD);   // the IHS medallion
    box(0.4, 2.4, 0.4, F, 0, 33, LIME); box(0.4, 0.4, 1.6, F, 0, 34.2, LIME);                   // the cross on top
    box(7, 27 + DEEP, 7, -24, 11, -DEEP, LATERITE); box(7.6, 0.8, 7.6, -24, 11, 27, LAT_LIGHT);   // the bell tower behind
    put(new THREE.ConeGeometry(4.6, 3.5, 4).rotateY(Math.PI / 4), -24, 11, 29.5, ROOF);
    box(30, 9 + DEEP, 26, -8, -21, -DEEP, LAT_LIGHT); gable(31, 27, 5, -8, 9, ROOF);             // the Professed House beside it
  }
  // --- the Sé Cathedral: the biggest church in Asia, lime-white, one square tower (its twin fell in 1776)
  {
    const { box, gable, put } = frame(og.se.x, og.se.z, 0);   // facing east (+x)
    box(76, 20 + DEEP, 34, 0, 0, -DEEP, LIME); gable(77, 35, 8, 0, 20, ROOF);
    const F = 38.6;
    box(1.6, 26 + DEEP, 36, F, 0, -DEEP, LIME);
    for (const y of [9, 18]) box(2, 0.8, 36.6, F + 0.2, 0, y, LIME_SHADE);
    for (const s of [-14, -7, 0, 7, 14]) box(1.8, 26, 1.2, F + 0.3, s, 0, LIME_SHADE);
    for (const s of [-10.5, 0, 10.5]) { box(0.3, 6.5, 3.2, F + 0.9, s, 0, DARK); put(new THREE.CylinderGeometry(1.6, 1.6, 0.3, 12, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2), F + 0.9, s, 6.5, DARK); }
    for (const s of [-10.5, 0, 10.5]) box(0.3, 3.4, 2, F + 0.9, s, 12, DARK);
    box(1.6, 6, 14, F, 0, 26, LIME); box(0.4, 3, 0.4, F, 0, 32, GOLD); box(0.4, 0.4, 1.8, F, 0, 33.4, GOLD);
    box(13, 36 + DEEP, 13, F - 6.5, -24, -DEEP, LIME); box(13.8, 1, 13.8, F - 6.5, -24, 36, LIME_SHADE);   // the one tower (the Golden Bell hangs here)
    for (const f of [-1, 1]) box(0.3, 4.4, 3, F - 6.5 + f * 6.6, -24, 29, DARK);
    put(new THREE.ConeGeometry(8.8, 5, 4).rotateY(Math.PI / 4), F - 6.5, -24, 39.5, ROOF);
  }
  // --- the Church of St Francis of Assisi, beside the Sé: white, its facade flanked by octagonal turrets
  {
    const { box, gable, put } = frame(og.assisi.x, og.assisi.z, Math.PI);   // facing west
    box(46, 15 + DEEP, 18, 0, 0, -DEEP, LIME); gable(47, 19, 6, 0, 15, ROOF);
    const F = 23.6;
    box(1.4, 19 + DEEP, 18, F, 0, -DEEP, LIME);
    for (const s of [-10, 10]) { put(new THREE.CylinderGeometry(2.2, 2.4, 24, 8), F - 0.5, s, 12, LIME); put(new THREE.ConeGeometry(2.6, 3.4, 8), F - 0.5, s, 25.7, ROOF); }
    box(0.3, 5.6, 3, F + 0.8, 0, 0, DARK); put(new THREE.CylinderGeometry(1.5, 1.5, 0.3, 12, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2), F + 0.8, 0, 5.6, DARK);
    box(1.4, 4, 8, F, 0, 19, LIME); box(0.4, 2.4, 0.4, F, 0, 24, LIME);
  }
  // --- the Viceroy's Arch: laterite, where every new viceroy came ashore and was handed the keys of the city
  {
    const a = og.arch, ang = 0, { box } = frame(a.x, a.z, ang);
    for (const s of [-4, 4]) box(6, 9 + DEEP, 3, 0, s, -DEEP, LATERITE);
    box(6, 4, 11, 0, 0, 9, LAT_LIGHT); box(6.6, 0.6, 11.6, 0, 0, 13, LATERITE); box(4, 3, 3, 0, 0, 13.6, LAT_LIGHT);
    box(6.2, 1.4, 5.2, 0, 0, 8.2, LAT_LIGHT);   // the lintel the gate swung from
  }

  // the lawns between the churches, with palms
  const palm = (): THREE.BufferGeometry => {
    const p: THREE.BufferGeometry[] = []; let x = 0, y = 0;
    for (let i = 0; i < 6; i++) { const lean = 0.03 + i * 0.025, h = 1.9; p.push(tint(new THREE.CylinderGeometry(0.22, 0.27, h, 6).rotateZ(-lean).translate(x + Math.sin(lean) * h / 2, y + Math.cos(lean) * h / 2, 0), 0x8a7458)); x += Math.sin(lean) * h; y += Math.cos(lean) * h; }
    for (let k = 0; k < 9; k++) { let fx = 0, fy = 0, ang = 0.2; for (let sg = 0; sg < 3; sg++) { p.push(tint(new THREE.BoxGeometry(1.5, 0.05, 1.1 - sg * 0.25).translate(0.75, 0, 0).rotateZ(-ang).translate(fx, fy, 0).rotateY(k / 9 * Math.PI * 2).translate(x, y, 0), 0x4f8a36)); fx += Math.cos(ang) * 1.5; fy -= Math.sin(ang) * 1.5; ang += 0.35; } }
    return mergeGeometries(p)!;
  };
  const palmGeo = palm(), C = og.centre;
  for (let k = 0; k < 18; k++) {
    const a = k * 2.399, r = 30 + (k * 37) % 70, x = C.x + Math.cos(a) * r, z = C.z + Math.sin(a) * r;
    if (!ctx.free(x, z)) continue;
    parts.push(palmGeo.clone().rotateY(k).translate(x, gy(x, z), z));
  }

  // the feast fair: striped stall canopies along the way between the basilica and the cathedral, and candle stands
  const fair = feastOn();
  const lights: THREE.BufferGeometry[] = [];
  if (fair) {
    const STRIPES = [0xd8443a, 0x2f7fc0, 0xe8b23a, 0x3a9a5a, 0xc2267a];
    const bx = og.bomJesus.x - 40, bz = og.bomJesus.z, ex = og.se.x + 46, ez = og.se.z;   // from the basilica's front to the cathedral's
    let n = 0;
    for (let t = 0; t <= 1 && n < 26; t += 0.045) {
      for (const side of [-1, 1]) {
        const x = bx + (ex - bx) * t + side * 7, z = bz + (ez - bz) * t + side * 7;
        if (!ctx.free(x, z)) continue;
        const y = gy(x, z), col = STRIPES[n % STRIPES.length];
        for (const [px, pz] of [[-1.5, -1.2], [1.5, -1.2], [-1.5, 1.2], [1.5, 1.2]]) parts.push(tint(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 4).translate(x + px, y + 1.3, z + pz), 0x5a4030));
        parts.push(tint(new THREE.ConeGeometry(2.4, 1.2, 4).rotateY(Math.PI / 4).translate(x, y + 3.2, z), col));
        parts.push(tint(new THREE.BoxGeometry(2.8, 0.9, 1.6).translate(x, y + 0.45, z), 0x8a6a48));                       // the counter
        for (let k = 0; k < 5; k++) parts.push(tint(new THREE.BoxGeometry(0.4, 0.3, 0.4).translate(x - 1 + k * 0.5, y + 1.05, z), STRIPES[(n + k + 1) % STRIPES.length]));   // sweets and toys
        n++;
      }
    }
    // candle stands in front of the basilica: rows of little flames
    const F = og.bomJesus.x - 36, Z = og.bomJesus.z;
    for (const s of [-8, 8]) {
      const y = gy(F, Z + s);
      parts.push(tint(new THREE.BoxGeometry(1.2, 1, 5).translate(F, y + 0.5, Z + s), 0x3a3030));
      for (let k = 0; k < 14; k++) { const cx = F - 0.3 + (k % 2) * 0.6, cz = Z + s - 2.2 + Math.floor(k / 2) * 0.7; parts.push(tint(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 5).translate(cx, y + 1.25, cz), 0xf6f0e0)); lights.push(tint(new THREE.SphereGeometry(0.09, 5, 4).scale(1, 1.6, 1).translate(cx, y + 1.6, cz), 0xffc860)); }
    }
  }

  const mesh = new THREE.Mesh(mergeGeometries(parts)!, new THREE.MeshLambertMaterial({ vertexColors: true }));
  mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh);
  const flame = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  if (lights.length) group.add(new THREE.Mesh(mergeGeometries(lights)!, flame));

  // Old Goa's people
  const at = (o: { x: number; z: number }, dx: number, dz: number) => ({ x: o.x + dx, z: o.z + dz });
  const cast: Cast[] = [
    { name: 'Aunty Lourdes', job: 'candle seller at Bom Jesus', outfit: 'frock', top: 0x7a3a8a, bottom: 0x7a3a8a, hair: 'grey', skin: 1, prop: 'basket', old: true, hint: 'chatty', workAt: at(og.bomJesus, -38, 12),
      lines: ['Candles, baba, candles! Light one for Goencho Saib, he listens to everybody.', 'Forty years I am sitting here. Every December the whole of Goa comes walking.', 'Wax ones for your family, small ones for your exams. Which you want?'] },
    { name: 'Sister Philomena', job: 'nun guiding pilgrims', outfit: 'cassock', top: 0xf6f4ee, bottom: 0xf6f4ee, hair: 'grey', skin: 1, prop: 'none', hint: 'kind', workAt: at(og.bomJesus, -30, -6),
      lines: ['Walk slowly, my child, and keep your voice soft inside the basilica.', 'St Francis Xavier came to Goa in 1542. His body rests here, in the silver casket.', 'The feast is on the third of December. Come early, the crowd is like a river.'] },
    { name: 'Mr. Caetano Pinto', job: 'church guide', outfit: 'shirt', top: 0xf6edd2, bottom: 0x4a4a52, hair: 'grey', skin: 1, prop: 'paper', old: true, hint: 'precise', workAt: at(og.se, 46, 8),
      lines: ['The Sé Cathedral: finished in 1619, the biggest church in Asia in its time. Look at the one tower.', 'It had two towers, you know. The second fell down in 1776 and nobody built it again.', 'The Golden Bell up there is the biggest in Goa. When it rings, they say you can hear it in Panjim.'] },
    { name: 'Babuso', job: 'kaju and sweets seller at the fair', outfit: 'shirt', top: 0xe07a30, bottom: 0x3a3a44, hair: 'black', skin: 2, prop: 'basket', hint: 'chatty', workAt: at(og.centre, 10, 4),
      lines: ['Kaju, kaju! Goa cashew, roasted fresh this morning. Taste, taste, no charge for tasting!', 'Khaje also there, the pink and orange ones. Feast without khaje is no feast, baba.', 'Aay deva, so much crowd today. Hold your mother\'s hand, no?'] },
    { name: 'Mallappa', job: 'pilgrim who walked from Karnataka', outfit: 'kurta', top: 0xf2f2e8, bottom: 0xf2f2e8, hair: 'black', skin: 2, prop: 'bag', hint: 'vague', workAt: at(og.bomJesus, -46, -2),
      lines: ['Eight days I walked from Belgaum, with my whole village. Every year we come.', 'My feet are paining, but my heart is happy, child.', 'Have you seen the saint? Go inside, go. It is a blessing.'] },
    { name: 'Arjun & Divya', job: 'tourists from Bangalore', outfit: 'tee', top: 0x3a6ac0, bottom: 0x2b2b33, hair: 'black', skin: 1, prop: 'camera', hint: 'precise', workAt: at(og.se, 50, -14),
      lines: ['Bro, can you take one photo of us? With the tower in the back. Okay, one more. One more!', 'We came for the beaches, but Old Goa is the best part, honestly.', 'Is there a good place for xacuti around here? Divya is hungry, I am hungry, everybody is hungry.'] },
  ];
  return {
    group, cast,
    update: (_dt, time) => { if (lights.length) flame.color.setScalar(0.85 + Math.sin(time * 9) * 0.1 + Math.sin(time * 23) * 0.05); },
  };
}
