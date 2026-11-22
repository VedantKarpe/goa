// IFFI, the International Film Festival of India: every November Panjim dresses up round its venues, INOX and the Old
// GMC building on the riverfront. A gateway arch over the road, poles with festival banners and strings of bulbs along
// the streets round the venue, the giant peacock (the festival's emblem) and a film reel big enough to stand in, where
// everybody takes their selfie. The festival's own people hang about: a delegate, a volunteer, a film buff.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { AreaContext, AreaInstance } from './types';
import type { Cast } from '../entities/cast';
import { T, type PanjimData } from '../world/data';

/** Where the festival is centred (INOX, from the map's named buildings), in world metres. */
export function iffiAt(d: PanjimData): { x: number; z: number } | null {
  const n = d.named?.find(q => q[1] === 'Inox') ?? d.named?.find(q => q[1] === 'Old GMC Building');
  return n ? { x: n[2] * T, z: n[3] * T } : null;
}

function tint(geo: THREE.BufferGeometry, hex: number, keepUv = false): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo, c = new THREE.Color(hex), a = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < a.length; i += 3) { a[i] = c.r; a[i + 1] = c.g; a[i + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); if (!keepUv && g.attributes.uv) g.deleteAttribute('uv'); if (g.attributes.normal && !g.attributes.uv && keepUv) g.deleteAttribute('normal'); return g;
}

function signTex(draw: (c: CanvasRenderingContext2D, w: number, h: number) => void, w: number, h: number): THREE.CanvasTexture {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d')!, w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

const GOLD = 0xe8b23a, PEA = 0x1f5fb0, TEAL = 0x1a9a8a, MAG = 0xc2267a;

export function build(ctx: AreaContext): AreaInstance {
  const group = new THREE.Group(); group.name = 'iffi';
  const at = iffiAt(ctx.d); if (!at) return { group };
  const gy = (x: number, z: number) => Math.max(0.6, ctx.g.heightAt(x, z));
  const solid: THREE.BufferGeometry[] = [], bulbs: THREE.BufferGeometry[] = [], flags: THREE.BufferGeometry[] = [], wire: number[] = [];

  // the streets round the venue (within reach), nearest first
  const near = ctx.segs.map(s => {
    const vx = s.bx - s.ax, vz = s.bz - s.az, L2 = vx * vx + vz * vz || 1, t = Math.max(0, Math.min(1, ((at.x - s.ax) * vx + (at.z - s.az) * vz) / L2));
    return { s, dist: Math.hypot(s.ax + vx * t - at.x, s.az + vz * t - at.z), t };
  }).filter(q => q.dist < 260).sort((a, b) => a.dist - b.dist);

  // poles with banners and strings of bulbs, along both sides of every street near the venue
  const bulbGeo = new THREE.IcosahedronGeometry(0.11, 0);
  const COLS = [0xffd34a, 0xff5a8a, 0x5ad0ff, 0xffffff, 0x8aff7a];
  let poles = 0;
  for (const { s } of near) {
    if (poles > 160) break;
    const vx = s.bx - s.ax, vz = s.bz - s.az, L = Math.hypot(vx, vz); if (L < 12) continue;
    const ux = vx / L, uz = vz / L, nx = -uz, nz = ux, n = Math.max(1, Math.round(L / 20));
    for (const side of [-1, 1]) {
      let prev: THREE.Vector3 | null = null;
      for (let i = 0; i <= n; i++) {
        const t = i / n, off = s.half + 1.3, x = s.ax + vx * t + nx * off * side, z = s.az + vz * t + nz * off * side;
        if (Math.hypot(x - at.x, z - at.z) > 270 || ctx.g.isWet(x, z)) { prev = null; continue; }
        const y = gy(x, z); poles++;
        solid.push(tint(new THREE.CylinderGeometry(0.08, 0.1, 6, 6).translate(x, y + 3, z), 0x2a2a30));
        // the banner: hung off the pole on a little arm, facing the road
        const rot = -Math.atan2(uz, ux);
        flags.push(new THREE.PlaneGeometry(0.9, 2.4).translate(0.55, 0, 0).rotateY(rot).translate(x, y + 4.3, z));
        const top = new THREE.Vector3(x, y + 6, z);
        if (prev) {   // a string of bulbs drooping between this pole and the last
          for (let k = 1; k < 10; k++) {
            const f = k / 10, p = prev.clone().lerp(top, f); p.y -= Math.sin(f * Math.PI) * 0.9;
            bulbs.push(tint(bulbGeo.clone().translate(p.x, p.y, p.z), COLS[(k + i) % COLS.length]));
          }
          for (let k = 0; k < 10; k++) for (const f of [k / 10, (k + 1) / 10]) { const p = prev.clone().lerp(top, f); wire.push(p.x, p.y - Math.sin(f * Math.PI) * 0.9 + 0.1, p.z); }
        }
        prev = top;
      }
    }
  }

  // the gateway arch over the street in front of the venue: the widest street close by
  const main = near.filter(q => q.dist < 90).sort((a, b) => b.s.half - a.s.half)[0] ?? near[0];
  if (main) {
    const s = main.s, vx = s.bx - s.ax, vz = s.bz - s.az, L = Math.hypot(vx, vz) || 1, ux = vx / L, uz = vz / L, nx = -uz, nz = ux;
    const cx = s.ax + vx * main.t, cz = s.az + vz * main.t, span = s.half + 2.2, rot = -Math.atan2(nz, nx);
    for (const side of [-1, 1]) {
      const x = cx + nx * span * side, z = cz + nz * span * side, y = gy(x, z);
      solid.push(tint(new THREE.BoxGeometry(1.4, 9, 1.4).translate(x, y + 4.5 - 1, z), 0xf3efe4));
      solid.push(tint(new THREE.BoxGeometry(1.8, 0.4, 1.8).translate(x, y + 8.2, z), GOLD));
      for (let k = 0; k < 6; k++) bulbs.push(tint(new THREE.IcosahedronGeometry(0.16, 0).translate(x + ux * 0.75, y + 1.2 + k * 1.2, z + uz * 0.75), COLS[k % 5]));
    }
    const y0 = gy(cx, cz);
    solid.push(tint(new THREE.BoxGeometry(span * 2 + 2.2, 2.6, 0.7).rotateY(rot).translate(cx, y0 + 8.6, cz), PEA));
    solid.push(tint(new THREE.BoxGeometry(span * 2 + 2.6, 0.3, 0.9).rotateY(rot).translate(cx, y0 + 10.05, cz), GOLD));
    solid.push(tint(new THREE.BoxGeometry(span * 2 + 2.6, 0.3, 0.9).rotateY(rot).translate(cx, y0 + 7.15, cz), GOLD));
    const tex = signTex((c, w, h) => {
      c.fillStyle = '#1f3f8a'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#e8b23a'; for (let x = 8; x < w; x += 40) { c.fillRect(x, 8, 22, 14); c.fillRect(x, h - 22, 22, 14); }   // film-strip holes
      c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = '800 88px Georgia, serif'; c.fillText('IFFI 2026 · GOA', w / 2, h / 2 - 12);
      c.font = '600 30px Mukta, sans-serif'; c.fillText('International Film Festival of India', w / 2, h / 2 + 52);
    }, 1024, 200);
    const sw = span * 2 + 1.8;
    for (const f of [1, -1]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(sw, sw * 200 / 1024), new THREE.MeshBasicMaterial({ map: tex }));
      m.position.set(cx + ux * 0.37 * f, y0 + 8.6, cz + uz * 0.37 * f); m.lookAt(cx + ux * 5 * f, y0 + 8.6, cz + uz * 5 * f); group.add(m);
    }
  }

  // a clear spot near the venue for the installations (off the roads, on dry ground)
  const taken: { x: number; z: number }[] = [];
  const spot = (r0: number, a0: number) => {
    for (let r = r0; r < r0 + 120; r += 6) for (let a = a0; a < a0 + 6.28; a += 0.4) {
      const x = at.x + Math.cos(a) * r, z = at.z + Math.sin(a) * r;
      if (!ctx.g.isWet(x, z) && taken.every(q => Math.hypot(q.x - x, q.z - z) > 18) && ctx.free(x, z) && ctx.free(x + 4, z) && ctx.free(x - 4, z) && ctx.free(x, z + 4) && ctx.free(x, z - 4)) { taken.push({ x, z }); return { x, z }; }
    }
    return { x: at.x + r0, z: at.z };
  };

  // the peacock, the festival's emblem: four metres of blue, its tail fanned out in a circle of green and gold eyes
  const pk = spot(25, 0);
  {
    const y = gy(pk.x, pk.z), P = (g: THREE.BufferGeometry, c: number) => solid.push(tint(g.translate(pk.x, y, pk.z), c));
    P(new THREE.CylinderGeometry(1.6, 1.9, 0.6, 16).translate(0, 0.3, 0), 0xf3efe4);                         // plinth
    P(new THREE.SphereGeometry(0.75, 12, 10).scale(1, 1.3, 0.9).translate(0, 1.6, 0.4), PEA);                // body
    P(new THREE.CylinderGeometry(0.18, 0.35, 1.6, 8).rotateX(0.25).translate(0, 2.9, 0.75), PEA);            // neck
    P(new THREE.SphereGeometry(0.28, 10, 8).translate(0, 3.75, 0.95), PEA);                                  // head
    P(new THREE.ConeGeometry(0.08, 0.35, 5).rotateX(Math.PI / 2).translate(0, 3.7, 1.3), GOLD);              // beak
    for (let k = -2; k <= 2; k++) P(new THREE.CylinderGeometry(0.015, 0.015, 0.45, 3).translate(k * 0.07, 4.2, 0.9), PEA), P(new THREE.SphereGeometry(0.06, 5, 4).translate(k * 0.07, 4.43, 0.9), GOLD);
    for (let k = 0; k < 31; k++) {                                                                           // the fan
      const a = -Math.PI * 0.45 + k / 30 * Math.PI * 0.9, len = 3.6;
      const feather = (g: THREE.BufferGeometry) => g.rotateZ(-a).translate(Math.sin(a) * 0.3, 1.5 + Math.cos(a) * 0.3, -0.25 - k % 2 * 0.06);
      P(feather(new THREE.BoxGeometry(0.22, len, 0.05).translate(0, len / 2, 0)), k % 2 ? TEAL : 0x2f8a3a);
      P(feather(new THREE.CylinderGeometry(0.28, 0.28, 0.08, 10).rotateX(Math.PI / 2).translate(0, len - 0.2, 0.05)), GOLD);
      P(feather(new THREE.CylinderGeometry(0.14, 0.14, 0.1, 8).rotateX(Math.PI / 2).translate(0, len - 0.2, 0.07)), PEA);
    }
  }
  // the film reel to stand in for a selfie, with its strip of film curling down to the ground
  const fr = spot(25, Math.PI);
  {
    const y = gy(fr.x, fr.z), R = 2.6, P = (g: THREE.BufferGeometry, c: number) => solid.push(tint(g.translate(fr.x, y, fr.z), c));
    P(new THREE.TorusGeometry(R, 0.22, 8, 32).translate(0, R + 0.6, 0), 0x303038);
    P(new THREE.CylinderGeometry(0.5, 0.5, 0.4, 16).rotateX(Math.PI / 2).translate(0, R + 0.6, 0), GOLD);
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; P(new THREE.BoxGeometry(0.25, R, 0.18).translate(0, R / 2, 0).rotateZ(a).translate(0, R + 0.6, 0), 0x303038); }
    for (let k = 0; k < 6; k++) { const a = (k + 0.5) / 6 * Math.PI * 2; P(new THREE.CylinderGeometry(0.55, 0.55, 0.12, 12).rotateX(Math.PI / 2).translate(Math.cos(a) * R * 0.62, R + 0.6 + Math.sin(a) * R * 0.62, 0), MAG); }
    P(new THREE.BoxGeometry(3.2, 0.6, 1.2).translate(0, 0.3, 0), 0x303038);                                  // its stand
    for (let k = 0; k < 14; k++) { const t = k / 13; P(new THREE.BoxGeometry(0.9, 0.06, 0.75).rotateZ(-0.4 - t * 0.9).translate(R + 0.4 + t * 3.2, R + 0.6 - t * (R + 0.4) + Math.sin(t * 6) * 0.2, 0.1), k % 2 ? 0x1a1a1e : GOLD); }
    // its sign
    const tex = signTex((c, w, h) => { c.fillStyle = '#c2267a'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = '800 54px Mukta, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('#IFFIGoa', w / 2, h / 2); }, 512, 112);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.65), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
    m.position.set(fr.x, y + 0.9, fr.z + 0.62); group.add(m);
  }

  const lam = new THREE.MeshLambertMaterial({ vertexColors: true });
  if (solid.length) { const m = new THREE.Mesh(mergeGeometries(solid)!, lam); m.castShadow = m.receiveShadow = true; group.add(m); }
  const bulbMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  if (wire.length) { const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wire, 3)); group.add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: 0x222222 }))); }
  if (bulbs.length) group.add(new THREE.Mesh(mergeGeometries(bulbs)!, bulbMat));
  if (flags.length) {
    const tex = signTex((c, w, h) => {
      const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#1f3f8a'); g.addColorStop(1, '#c2267a'); c.fillStyle = g; c.fillRect(0, 0, w, h);
      c.fillStyle = '#e8b23a'; c.fillRect(0, 0, w, 10); c.fillRect(0, h - 10, w, 10);
      c.fillStyle = '#fff'; c.textAlign = 'center'; c.font = '800 46px Georgia, serif'; c.fillText('IFFI', w / 2, 70);
      c.font = '700 22px Mukta, sans-serif'; c.fillText('2026', w / 2, 102);
      c.font = '600 18px Mukta, sans-serif'; c.save(); c.translate(w / 2, 300); c.rotate(-Math.PI / 2); c.fillText('FILM FESTIVAL · GOA', 0, 6); c.restore();
    }, 128, 340);
    const m = new THREE.Mesh(mergeGeometries(flags)!, new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide }));
    m.castShadow = true; group.add(m);
  }

  // the festival's people
  const near0 = (dx: number, dz: number) => ({ x: at.x + dx, z: at.z + dz });
  const cast: Cast[] = [
    { name: 'Anjali Menon', job: 'IFFI delegate', outfit: 'kurta', top: 0xc2267a, bottom: 0xf5f0e0, hair: 'long', skin: 1, prop: 'bag', hint: 'chatty', workAt: near0(pk.x - at.x + 4, pk.z - at.z + 4), shift: 'evening',
      lines: ['Four films today, back to back! My delegate badge has paid for itself already.', 'The queue for the Korean film went right round INOX, men. Two hours I stood.', 'Every November I come for IFFI. Goa in festival lights, nothing like it.'] },
    { name: 'Siddhesh', job: 'IFFI volunteer', outfit: 'tee', top: 0xe8b23a, bottom: 0x2b2b33, hair: 'black', skin: 2, prop: 'phone', hint: 'precise', workAt: near0(18, -12),
      lines: ['Screening tickets at the INOX counter, delegates through the side gate. Badges out, please!', 'Aay deva, since six in the morning I am on my feet. Free festival T-shirt, that is all I got.', 'Selfie with the peacock? Everybody wants. Stand on the left side, the light is better.'] },
    { name: 'Mr. Agnelo Rebello', job: 'film buff, never misses IFFI', outfit: 'shirt', top: 0xf6edd2, bottom: 0x5a4a3a, hair: 'grey', skin: 1, prop: 'paper', old: true, hint: 'vague', workAt: near0(fr.x - at.x - 5, fr.z - at.z + 3),
      lines: ['Since 2004, when IFFI first came to Goa, I have not missed one year.', 'In the old days we watched in the Kala Academy. Now everything is INOX, INOX.', 'This year\'s opening film? Too long, baba. But the music, beautiful.'] },
  ];

  return {
    group, cast,
    // the bulbs glow brighter as it gets dark
    update: () => { const t = ctx.clock(), dark = t < 300 ? 1 : t < 420 ? 1 - (t - 300) / 120 : t < 1050 ? 0 : t < 1170 ? (t - 1050) / 120 : 1; bulbMat.color.setScalar(0.75 + dark * 1.8); },
  };
}
