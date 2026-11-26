// A North Goa beach (Candolim, Calangute or Baga): a row of beach shacks along the back of the sand, each a bamboo-and-
// thatch shack on a deck with fairy lights and its name board (placeholders for now: "Your shack here"), sunbeds and
// umbrellas out front towards the sea, and the beach's own people: a shack waiter, a lifeguard on his tower, a
// pineapple seller, a boat-trip guide and the massage aunty.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { AreaContext, AreaInstance } from './types';
import type { Cast } from '../entities/cast';
import { beachesOn, shacksOf } from './beachSpot';

function tint(geo: THREE.BufferGeometry, hex: number): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo, c = new THREE.Color(hex), a = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < a.length; i += 3) { a[i] = c.r; a[i + 1] = c.g; a[i + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); if (g.attributes.uv) g.deleteAttribute('uv'); return g;
}

const BAMBOO = 0xc8a060, THATCH = 0x8a6a3a, DECK = 0xa07a50, CLOTH = [0xd8443a, 0x2f7fc0, 0xf2c230, 0x3a9a5a, 0xe07a30, 0xc2267a];

function board(text: string, sub: string): THREE.CanvasTexture {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 160; const c = cv.getContext('2d')!;
  c.fillStyle = '#2a6a8a'; c.fillRect(0, 0, 512, 160); c.strokeStyle = '#f2c230'; c.lineWidth = 8; c.strokeRect(6, 6, 500, 148);
  c.fillStyle = '#fff4d8'; c.textAlign = 'center'; c.font = '800 54px Georgia, serif'; c.fillText(text, 256, 78);
  c.fillStyle = '#f2c230'; c.font = '600 26px Mukta, sans-serif'; c.fillText(sub, 256, 124);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function build(ctx: AreaContext, which = 'Calangute'): AreaInstance {
  const group = new THREE.Group(); group.name = 'beach';
  const parts: THREE.BufferGeometry[] = [], lights: THREE.BufferGeometry[] = [];
  const gy = (x: number, z: number) => Math.max(0.6, ctx.g.heightAt(x, z));
  // which beach this is: the nearest to where the area was asked for (the registry makes one area per beach)
  const beaches = beachesOn(ctx.d); if (!beaches.length) return { group };
  const b = beaches.find(q => q.name === which) ?? beaches[0];
  const shacks = shacksOf(ctx.d, b);
  let n = 0;
  const signs = new Map<number, THREE.Mesh>();
  for (const s of shacks) {
    const fx = Math.cos(s.face), fz = Math.sin(s.face), sx = -fz, sz = fx, rot = -s.face, base = gy(s.x, s.z);
    const put = (g: THREE.BufferGeometry, f: number, side: number, y: number, col: number, into = parts) => into.push(tint(g.rotateY(rot).translate(s.x + fx * f + sx * side, base + y, s.z + fz * f + sz * side), col));
    // the deck and the shack: bamboo posts, a sloping thatched roof, a bar counter at the back
    put(new THREE.BoxGeometry(12, 0.5, 14), 0, 0, 0.25, DECK);
    for (const f of [-5.5, 0, 5.5]) for (const side of [-6.5, 0, 6.5]) put(new THREE.CylinderGeometry(0.14, 0.16, 3.6, 6).translate(0, 1.8, 0), f, side, 0.5, BAMBOO);
    put(new THREE.BoxGeometry(13.5, 0.35, 15.5).rotateZ(-0.12), 0, 0, 4.15, THATCH);                                    // the roof, sloping down to the sea
    put(new THREE.BoxGeometry(13.6, 0.25, 15.6).rotateZ(-0.12), 0, 0, 3.95, 0x6a4e2a);
    put(new THREE.BoxGeometry(1.2, 1.2, 9), -5, 0, 1.1, 0x7a5a3a); put(new THREE.BoxGeometry(1.4, 0.12, 9.4), -5, 0, 1.75, 0xe8d8b0);   // the bar
    for (const f of [-1.5, 2.5]) for (const side of [-4, 0, 4]) { put(new THREE.CylinderGeometry(0.5, 0.5, 0.06, 10).translate(0, 0.78, 0), f, side, 0.5, 0xf6f2e8); put(new THREE.CylinderGeometry(0.05, 0.05, 0.75, 5).translate(0, 0.38, 0), f, side, 0.5, 0xd8d2c4); }   // tables
    // fairy lights along the front of the roof
    for (let k = -7; k <= 7; k++) put(new THREE.SphereGeometry(0.22, 6, 5), 6.6, k, 3.4 - Math.abs(Math.sin(k * 0.6)) * 0.25, [0xffd34a, 0xff5a8a, 0x5ad0ff, 0xffffff][(k + 7) % 4], lights);
    // sunbeds and umbrellas out front, towards the sea
    for (let r = 0; r < 2; r++) for (let c = -2; c <= 2; c++) {
      const f = 11 + r * 6, side = c * 3.2, col = CLOTH[(n + c + r) % CLOTH.length];
      put(new THREE.BoxGeometry(2, 0.12, 0.8).rotateZ(-0.1), f, side, 0.45, 0xf6f2e8); put(new THREE.BoxGeometry(0.7, 0.12, 0.8).rotateZ(0.7), f - 1.1, side, 0.75, 0xf6f2e8);
      if (c % 2 === 0) { put(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 5).translate(0, 1.3, 0), f - 0.4, side + 1.6, 0, 0xe8e2d0); put(new THREE.ConeGeometry(1.6, 0.6, 8).translate(0, 2.7, 0), f - 0.4, side + 1.6, 0, col); }
    }
    // the name board on two poles at the back, facing the beach path
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.9), new THREE.MeshBasicMaterial({ map: board(`Shack ${s.n}`, 'Your shack here · DM @goabuilder'), side: THREE.DoubleSide }));
    signs.set(s.n, sign);
    sign.position.set(s.x - fx * 7.6, base + 4.6, s.z - fz * 7.6); sign.rotation.y = rot - Math.PI / 2; group.add(sign);
    put(new THREE.CylinderGeometry(0.1, 0.1, 4, 5).translate(0, 2, 0), -7.6, -2.6, 0, BAMBOO); put(new THREE.CylinderGeometry(0.1, 0.1, 4, 5).translate(0, 2, 0), -7.6, 2.6, 0, BAMBOO);
    n++;
  }
  // a lifeguard tower in the middle of the beach, at the water's edge
  if (shacks.length) {
    const m = shacks[Math.floor(shacks.length / 2)], fx = Math.cos(m.face), fz = Math.sin(m.face), x = m.x + fx * 40, z = m.z + fz * 40, y = gy(x, z);
    for (const [a, c] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) parts.push(tint(new THREE.CylinderGeometry(0.1, 0.12, 4, 5).translate(x + a, y + 2, z + c), 0xe8e2d0));
    parts.push(tint(new THREE.BoxGeometry(2.6, 1.1, 2.6).translate(x, y + 4.4, z), 0xd8302a), tint(new THREE.ConeGeometry(2.2, 1, 4).rotateY(Math.PI / 4).translate(x, y + 5.5, z), 0xf2c230));
  }
  if (parts.length) { const mesh = new THREE.Mesh(mergeGeometries(parts)!, new THREE.MeshLambertMaterial({ vertexColors: true })); mesh.castShadow = mesh.receiveShadow = true; group.add(mesh); }
  const bulb = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  if (lights.length) group.add(new THREE.Mesh(mergeGeometries(lights)!, bulb));

  // the beach's people
  const s0 = shacks[0] ?? { x: b.x, z: b.z, face: 0 }, m = shacks[Math.floor(shacks.length / 2)] ?? s0;
  const at = (s: { x: number; z: number; face: number }, f: number, side = 0) => ({ x: s.x + Math.cos(s.face) * f - Math.sin(s.face) * side, z: s.z + Math.sin(s.face) * f + Math.cos(s.face) * side });
  const B = b.name;
  // each beach has its own people (the town knows everyone by name)
  const NAMES: Record<string, string[]> = { Candolim: ['Joaquim', 'Ravi', 'Saraswati', 'Agnelo', 'Aunty Mary'], Calangute: ['Francis', 'Deepak', 'Lakshmi', 'Savio', 'Aunty Rita'], Baga: ['Anthony', 'Suresh', 'Kamla', 'Pedro', 'Aunty Fatima'] };
  const N = NAMES[B] ?? NAMES.Calangute;
  const cast: Cast[] = [
    { name: N[0], job: `waiter at a ${B} shack`, outfit: 'shirt', top: 0xf6f2e8, bottom: 0x2b2b33, hair: 'black', skin: 2, prop: 'none', hint: 'chatty', workAt: at(s0, 4, 2),
      lines: ['Sir, madam, sunbeds free if you order! Cold beer, fresh lime soda, anything.', 'Today\'s catch: kingfish, red snapper, tiger prawns. Choose and we fry it in front of you.', 'Sunset is at six, sit here only, best view on the whole beach.'] },
    { name: N[1], job: `lifeguard at ${B}`, outfit: 'tee', top: 0xd8302a, bottom: 0xf2c230, hair: 'cap', skin: 2, prop: 'none', hint: 'precise', workAt: at(m, 38),
      lines: ['Swim between the flags only! Red flag means no swimming, no matter what your friend says.', 'Every season we pull out drunk tourists who think they are fish.', 'Current is strong after four o\'clock. Paddle, enjoy, but don\'t go deep.'] },
    { name: N[2], job: 'pineapple and coconut seller', outfit: 'sari', top: 0xe07a30, bottom: 0xe07a30, hair: 'bun', skin: 2, prop: 'basket', hint: 'chatty', workAt: at(m, 22, -12),
      lines: ['Pineapple, sweet sweet! Cut with masala, fifty rupees only.', 'Tender coconut, very good for the heat. You are red like a lobster, drink, drink!', 'From Karnataka I come every season. Goa people are good to me.'] },
    { name: N[3], job: 'boat trip guide', outfit: 'shirt', top: 0x2f7fc0, bottom: 0xf6f2e8, hair: 'black', skin: 1, prop: 'phone', hint: 'chatty', workAt: at(m, 30, 14),
      lines: ['Dolphin trip, sir! Morning boat, ninety percent you see dolphins, else money back. Almost.', 'Grande Island trip, snorkelling, lunch on the boat. Full day masti!', 'My father was a fisherman. Now the fish don\'t pay, the tourists pay.'] },
    { name: N[4], job: 'beach massage', outfit: 'frock', top: 0x7a3a8a, bottom: 0x7a3a8a, hair: 'grey', skin: 1, prop: 'bag', old: true, hint: 'kind', workAt: at(s0, 16, -6),
      lines: ['Massage, madam? Back, legs, head, everything. Your shoulders are like stone, I can see from here.', 'Twenty years on this beach. I have seen the shacks come and go every season.', 'Don\'t sleep in the sun after lunch, baba. Nap in the shade like a sensible Goan.'] },
  ];
  // shacks with a listing: their name on the board, and the waiter pitches its speciality
  fetch(`${import.meta.env.BASE_URL}data/businesses.json`, { cache: 'no-cache' }).then(r => r.ok ? r.json() : []).then((bz: { title: string; beach?: string; shack?: number; speciality?: string; pitch?: string }[]) => {
    for (const z of bz) {
      if (z.beach !== B || !z.shack) continue;
      const sign = signs.get(z.shack); if (!sign) continue;
      const mt = sign.material as THREE.MeshBasicMaterial; mt.map?.dispose(); mt.map = board(z.title.replace(' (sample)', ''), z.speciality?.split(',')[0] ?? 'Tap the 🏪 to see more'); mt.needsUpdate = true;
      if (z.shack === 1 && z.pitch) cast[0].lines.unshift(z.pitch);
    }
  }).catch(() => { /* no listings */ });
  return { group, cast, update: (_dt, time) => { const t = ctx.clock(), dark = t < 300 || t > 1150 ? 1 : t > 1050 ? (t - 1050) / 100 : t < 400 ? (400 - t) / 100 : 0; bulb.color.setScalar((0.8 + dark * 1.6) * (0.85 + Math.sin(time * 2.3) * 0.15)); } };
}
