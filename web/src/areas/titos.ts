// Tito's Lane, Baga: the party lane running from the Calangute-Baga road down to the sand, on its real line from
// OpenStreetMap. Neon club boards on both sides (made-up names for now), little bar counters under awnings, strings
// of coloured bulbs across the lane and a welcome arch at the top. Quiet and sleepy by day; after sunset the neon
// and the bulbs come alive. Its own people: the bouncer, the club promoter, the bhutta seller, the tattoo artist,
// the taxi driver at the corner and the henna aunty.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { titosLine } from './titosSpot';
import type { AreaContext, AreaInstance } from './types';
import type { Cast } from '../entities/cast';

function tint(geo: THREE.BufferGeometry, hex: number): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo, c = new THREE.Color(hex), a = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < a.length; i += 3) { a[i] = c.r; a[i + 1] = c.g; a[i + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); if (g.attributes.uv) g.deleteAttribute('uv'); return g;
}

// made-up clubs and bars (no real businesses yet)
const CLUBS: [string, string, string][] = [
  ['Club Kokum', 'DJ night · free entry before 10', '#ff3fa4'], ['The Salty Feni', 'Cocktails · live band', '#3fd8ff'],
  ['Bebinca Beats', 'Bollywood night', '#ffd23f'], ['Sol Kadi Social', 'Rooftop · happy hours', '#7dff6a'],
  ['Club Xacuti', 'Techno till late', '#b06aff'], ['Tipsy Toddy', 'Karaoke Wednesdays', '#ff7a3f'],
  ['Monsoon Disco', 'Retro night', '#3f8aff'], ['Coconut Neon', 'Beach party', '#ff3f5a'],
];

function neon(text: string, sub: string, col: string): THREE.CanvasTexture {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 176; const c = cv.getContext('2d')!;
  c.fillStyle = '#120a1c'; c.fillRect(0, 0, 512, 176);
  c.shadowColor = col; c.shadowBlur = 22; c.strokeStyle = col; c.lineWidth = 6; c.strokeRect(10, 10, 492, 156);
  c.fillStyle = '#fff'; c.textAlign = 'center'; c.font = '800 58px "Trebuchet MS", sans-serif'; c.fillText(text, 256, 86);
  c.shadowBlur = 10; c.fillStyle = col; c.font = '600 26px Mukta, sans-serif'; c.fillText(sub, 256, 136);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function build(ctx: AreaContext): AreaInstance {
  const group = new THREE.Group(); group.name = 'titos';
  const line = titosLine(ctx.d); if (!line) return { group };
  const gy = (x: number, z: number) => ctx.g.heightAt(x, z);
  const parts: THREE.BufferGeometry[] = [], bulbs: THREE.BufferGeometry[] = [], glow: THREE.MeshBasicMaterial[] = [];
  // walk the lane at even steps: where we are, and which way it runs
  const steps: { x: number; z: number; dx: number; dz: number }[] = [];
  for (let i = 1; i < line.length; i++) {
    const [ax, az] = line[i - 1], [bx, bz] = line[i], L = Math.hypot(bx - ax, bz - az); if (L < 0.01) continue;
    for (let t = steps.length ? 0 : 0; t < L; t += 2) steps.push({ x: ax + (bx - ax) * t / L, z: az + (bz - az) * t / L, dx: (bx - ax) / L, dz: (bz - az) / L });
  }
  if (steps.length < 4) return { group };
  const HALF = 5;   // half the lane, metres
  // the welcome arch at the top of the lane (the road end, east)
  const top = steps[0], nx = -top.dz, nz = top.dx, ty = gy(top.x, top.z);
  for (const s of [-1, 1]) parts.push(tint(new THREE.BoxGeometry(0.6, 6, 0.6).translate(top.x + nx * (HALF + 1) * s, ty + 3, top.z + nz * (HALF + 1) * s), 0x2a2030));
  const arch = new THREE.MeshBasicMaterial({ map: neon("Tito's Lane", 'Baga · since forever', '#ff3fa4'), side: THREE.DoubleSide, toneMapped: false });
  const am = new THREE.Mesh(new THREE.PlaneGeometry(2 * HALF + 2, 3.6), arch); am.position.set(top.x, ty + 6.6, top.z); am.lookAt(top.x + top.dx, ty + 6.6, top.z + top.dz); group.add(am); glow.push(arch);
  // the clubs: a neon board on posts and a little bar counter under an awning, alternating sides
  let k = 0;
  const pools: THREE.MeshBasicMaterial[] = [];
  for (let i = 6; i < steps.length - 4 && k < CLUBS.length; i += 10) {
    const s = steps[i], side = k % 2 ? 1 : -1, px = -s.dz * side, pz = s.dx * side;
    const bx = s.x + px * (HALF + 2.5), bz = s.z + pz * (HALF + 2.5);
    if (!ctx.free(bx, bz)) continue;
    const [name, sub, col] = CLUBS[k], y = gy(bx, bz), face = Math.atan2(-px, -pz);
    const mat = new THREE.MeshBasicMaterial({ map: neon(name, sub, col), side: THREE.DoubleSide, toneMapped: false }); glow.push(mat);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(7, 2.4), mat); sign.position.set(bx, y + 5, bz); sign.rotation.y = face; group.add(sign);
    const put = (g: THREE.BufferGeometry, f: number, l: number, h: number, c: number) => parts.push(tint(g.rotateY(face).translate(bx - px * f + -pz * l * 0 + s.dx * l, y + h, bz - pz * f + s.dz * l), c));
    put(new THREE.CylinderGeometry(0.1, 0.1, 4, 5), 0, -3.2, 2, 0x2a2030); put(new THREE.CylinderGeometry(0.1, 0.1, 4, 5), 0, 3.2, 2, 0x2a2030);
    put(new THREE.BoxGeometry(3.4, 1.1, 0.8), -1.2, 0, 0.55, 0x3a2a40);                                   // the bar counter
    put(new THREE.BoxGeometry(4.2, 0.12, 2.2).rotateX(0.15), -1.4, 0, 2.6, new THREE.Color(col).getHex());   // the awning
    for (const l of [-1.2, 0, 1.2]) put(new THREE.CylinderGeometry(0.22, 0.22, 0.08, 8), -2.3, l, 0.75, 0xe8e0d0);   // stools
    // the club's neon spilling onto the lane at night
    const pool = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }); pools.push(pool);
    const pm = new THREE.Mesh(new THREE.CircleGeometry(6, 24).rotateX(-Math.PI / 2), pool); pm.position.set(bx - px * 3, y + 0.08, bz - pz * 3); group.add(pm);
    k++;
  }
  // strings of coloured bulbs across the lane
  const BC = [0xff3fa4, 0x3fd8ff, 0xffd23f, 0x7dff6a, 0xb06aff];
  for (let i = 3; i < steps.length; i += 15) {
    const s = steps[i], nx2 = -s.dz, nz2 = s.dx, y = gy(s.x, s.z);
    for (const sd of [-1, 1]) parts.push(tint(new THREE.CylinderGeometry(0.07, 0.07, 6, 5).translate(s.x + nx2 * HALF * sd, y + 3, s.z + nz2 * HALF * sd), 0x3a3038));
    for (let j = 0; j <= 12; j++) { const t = j / 12 * 2 - 1, sag = (1 - t * t) * 0.8; bulbs.push(tint(new THREE.SphereGeometry(0.24, 6, 5).translate(s.x + nx2 * HALF * t, y + 5.9 - sag, s.z + nz2 * HALF * t), BC[(i + j) % BC.length])); }
  }
  if (parts.length) { const m = new THREE.Mesh(mergeGeometries(parts)!, new THREE.MeshLambertMaterial({ vertexColors: true })); m.castShadow = m.receiveShadow = true; group.add(m); }
  const bulbMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }); glow.push(bulbMat);
  if (bulbs.length) group.add(new THREE.Mesh(mergeGeometries(bulbs)!, bulbMat));

  // the lane's people
  const at = (f: number, side: number) => { const s = steps[Math.min(steps.length - 1, Math.floor(f * (steps.length - 1)))]; return { x: s.x - s.dz * side * (HALF - 1), z: s.z + s.dx * side * (HALF - 1) }; };
  const cast: Cast[] = [
    { name: 'Big Bosco', job: 'bouncer at Club Kokum', outfit: 'tee', top: 0x111114, bottom: 0x111114, hair: 'bald', skin: 2, prop: 'none', hint: 'grumpy', shift: 'night', workAt: at(0.15, -1),
      lines: ['Entry only for eighteen plus, baba. Come back in ten years. With your father.', 'I have seen everything on this lane. Everything. Don\'t ask.', 'Shoes, not chappals, after eleven. Rules are rules.'] },
    { name: 'Rahul', job: 'club promoter (sales assistant)', outfit: 'shirt', top: 0xff3fa4, bottom: 0x2b2b33, hair: 'black', skin: 1, prop: 'phone', hint: 'chatty', shift: 'evening', workAt: at(0.3, 1),
      lines: ['Patrao, patrao! Club Xacuti tonight, techno till late, first drink free! (for the grown-ups, sorry baby)', 'Ladies night at Bebinca Beats, Wednesday! Tell your aunty.', 'Every club on this lane, I know the owner. You want discount? I am your man.'] },
    { name: 'Shantabai', job: 'bhutta seller', outfit: 'sari', top: 0x2a8a4a, bottom: 0x2a8a4a, hair: 'bun', skin: 2, prop: 'basket', hint: 'kind', shift: 'evening', workAt: at(0.5, -1),
      lines: ['Bhutta, hot hot! Lime and chilli, thirty rupees only.', 'The clubs make noise all night, I sell corn all night. Everybody happy.', 'Eat, baba, eat. Party people forget to eat, then they fall down.'] },
    { name: 'Inky Dsouza', job: 'tattoo artist', outfit: 'tee', top: 0x3a3a5a, bottom: 0x1a1a22, hair: 'black', skin: 1, prop: 'none', hint: 'chatty', workAt: at(0.65, 1),
      lines: ['Tattoo? Henna one for you, real one when you are big. Your mother will kill me otherwise.', 'Half the tourists want a dolphin. The other half want their ex\'s name. Then they come back to cover it.', 'Best art in Baga is on people, not on walls.'] },
    { name: 'Raju', job: 'taxi driver at the lane corner', outfit: 'shirt', top: 0xf2f2e8, bottom: 0x3a3a44, hair: 'black', skin: 2, prop: 'phone', hint: 'precise', workAt: at(0.03, 1),
      lines: ['Taxi? Calangute, Candolim, Panjim, airport. Fixed rate, no meter, no tension.', 'Two o\'clock the clubs close, then my real work starts.', 'Tito\'s Lane was just one bar and fishing boats once. My father told me.'] },
    { name: 'Aunty Philomena', job: 'henna and bead bracelets', outfit: 'frock', top: 0x8a3a6a, bottom: 0x8a3a6a, hair: 'grey', skin: 1, prop: 'bag', old: true, hint: 'kind', workAt: at(0.85, -1),
      lines: ['Henna, darling? A little flower on your hand, it stays two weeks.', 'Bracelets with your name, one hundred rupees. For your sister also?', 'In my time this lane went quiet at nine. Now it wakes up at nine!'] },
  ];
  return {
    group, cast,
    update: (_dt, time) => { const t = ctx.clock(), dark = t < 300 || t > 1150 ? 1 : t > 1050 ? (t - 1050) / 100 : t < 400 ? (400 - t) / 100 : 0;
      for (const p of pools) p.opacity = dark * 0.35;
      for (const [i, m] of glow.entries()) m.color.setScalar((0.75 + dark * 2.2) * (m === bulbMat ? 0.85 + Math.sin(time * 3 + i) * 0.15 : 0.9 + Math.sin(time * 6 + i * 1.7) * 0.1 * dark)); },
  };
}
