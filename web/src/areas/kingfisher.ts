// Kingfisher Villa, Sinquerim: the sprawling sea-facing mansion on the slope by Fort Aguada. A white Portuguese-style
// house in three blocks under terracotta hip roofs, arched verandahs along the sea side, a lawn running down towards the
// water with a pool and coconut palms, all inside a white compound wall with a grand gate on the road. Ramesh keeps
// watch at the gate.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { AreaContext, AreaInstance } from './types';
import type { Cast } from '../entities/cast';
import { kingfisherAt, KF_R } from './kingfisherSpot';

function tint(geo: THREE.BufferGeometry, hex: number): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo, c = new THREE.Color(hex), a = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < a.length; i += 3) { a[i] = c.r; a[i + 1] = c.g; a[i + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); if (g.attributes.uv) g.deleteAttribute('uv'); return g;
}

export function build(ctx: AreaContext): AreaInstance {
  const group = new THREE.Group(); group.name = 'kingfisher';
  const at = kingfisherAt(ctx.d, ctx.segs); if (!at) return { group };
  const parts: THREE.BufferGeometry[] = [];
  const gy = (x: number, z: number) => Math.max(0.6, ctx.g.heightAt(x, z));
  let g0 = 0; for (let a = 0; a < 6.28; a += 0.5) for (const r of [0, 8, 16]) g0 = Math.max(g0, gy(at.x + Math.cos(a) * r, at.z + Math.sin(a) * r));   // the house's floor: the highest ground under it
  // which way is the sea: the direction from the villa where the ground first turns to water
  let sea = 0, best = 1e9;
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 16) for (let r = 20; r < 600; r += 10) if (ctx.g.isWet(at.x + Math.cos(a) * r, at.z + Math.sin(a) * r)) { if (r < best) { best = r; sea = a; } break; }
  const fx = Math.cos(sea), fz = Math.sin(sea), sx = -fz, sz = fx;          // forward (to the sea) and across
  const rot = -Math.atan2(fz, fx);
  const put = (geo: THREE.BufferGeometry, f: number, s: number, y: number, col: number) => parts.push(tint(geo.rotateY(rot).translate(at.x + fx * f + sx * s, g0 + y, at.z + fz * f + sz * s), col));
  const box = (lf: number, h: number, ls: number, f: number, s: number, y: number, col: number) => put(new THREE.BoxGeometry(lf, h, ls), f, s, y, col);
  const WHITE = 0xf7f3ea, TRIM = 0xe4ddcc, ROOF = 0xa8432a, DARK = 0x2c2a2a;
  const hip = (lf: number, ls: number, f: number, s: number, y: number, rise: number) => {
    const r = new THREE.ConeGeometry(1, 1, 4, 1).rotateY(Math.PI / 4).scale(lf * 0.75, rise, ls * 0.75);
    put(r, f, s, y + rise / 2, ROOF);
  };
  // the house: a long main block of two storeys facing the sea, a wing at each end stepping forward
  const H = 7.4;
  const DEEP = 8;   // the walls go this far down into the slope, so the house never floats
  box(12, H + DEEP, 28, 0, 0, (H - DEEP) / 2, WHITE); hip(13, 29.5, 0, 0, H, 3.8);
  for (const sd of [-1, 1]) { box(13, H + DEEP, 9, 5, sd * 16, (H - DEEP) / 2, WHITE); hip(14, 10.2, 5, sd * 16, H, 3.4); }
  box(12.4, 0.5, 28.4, 0, 0, H - 0.25, TRIM); box(12.4, 0.6, 28.4, 0, 0, 3.5, TRIM);   // cornice and the floor band
  // the sea-facing verandahs: a run of white arches on both floors
  for (const y of [0, 3.7]) {
    for (let k = -5; k <= 5; k++) {
      box(0.6, 3.4, 0.6, 7.6, k * 2.4, y + 1.7, WHITE);
      put(new THREE.CylinderGeometry(0.9, 0.9, 0.5, 10, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2), 7.6, k * 2.4 + 1.2, y + 3.0, WHITE);
    }
    box(2.8, y ? 0.3 : 0.3 + DEEP, 26, 7.4, 0, y ? y + 0.15 : 0.15 - DEEP / 2, 0xc8b8a0);   // the verandah floor (the lower one on a solid base)
    box(0.2, 0.9, 26, 8.7, 0, y + 0.6, WHITE);                                       // its balustrade
  }
  for (let k = -4; k <= 4; k++) for (const y of [1.6, 5.3]) box(0.1, 1.9, 1.1, 6.05, k * 2.4 + 1.2, y, DARK);   // windows behind
  // a porte-cochère on the landward side, over the drive
  box(6, 0.6, 9, -9, 0, 4.2, WHITE); for (const s of [-4, 4]) for (const f of [-11.5, -7]) box(0.7, 4 + DEEP, 0.7, f, s, 2 - DEEP / 2, WHITE);
  // the lawn down towards the sea, the pool with its deck, palms, a stone path
  { const pf = 19, ps = -7, px = at.x + fx * pf + sx * ps, pz = at.z + fz * pf + sz * ps, py = gy(px, pz) - g0;
    box(7, 0.6 + DEEP, 13, pf, ps, py + 0.3 - DEEP / 2, 0xd8cdb8); box(5, 0.2, 10.5, pf, ps, py + 0.62, 0x3fb0d0); }   // the pool on its deck
  // the compound wall with its grand gate on the landward side
  const R = KF_R;
  const wallAt = (f: number, s0: number, along: 'f' | 's', L: number) => {
    for (let t = -L / 2; t < L / 2; t += 4) {
      const ff = along === 'f' ? f + t + 2 : f, ss = along === 's' ? s0 + t + 2 : s0;
      if (f === -R && along === 's' && Math.abs(ss) < 6.5) continue;                    // the gap for the gate
      const x = at.x + fx * ff + sx * ss, z = at.z + fz * ff + sz * ss, y = gy(x, z) - g0;
      box(along === 'f' ? 4.05 : 0.5, 2.6 + 3, along === 's' ? 4.05 : 0.5, ff, ss, y + 1.3 - 1.5, WHITE);
    }
  };
  wallAt(-R, 0, 's', 2 * R); wallAt(R, 0, 's', 2 * R); wallAt(0, -R, 'f', 2 * R); wallAt(0, R, 'f', 2 * R);
  const gateY = (s0: number) => { const x = at.x + fx * -R + sx * s0, z = at.z + fz * -R + sz * s0; return gy(x, z) - g0; };
  for (const s0 of [-6.5, 6.5]) { box(1.6, 4.2 + 3, 1.6, -R, s0, gateY(s0) + 2.1 - 1.5, WHITE); box(2.0, 0.5, 2.0, -R, s0, gateY(s0) + 4.4, TRIM); }   // gate pillars
  box(0.3, 2.4, 12, -R, 0, gateY(0) + 1.3, 0x2c3a5a);                                                       // the gate
  // a sign on the pillar, as the visitors photograph it
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128; const c = cv.getContext('2d')!;
  c.fillStyle = '#f7f3ea'; c.fillRect(0, 0, 512, 128); c.fillStyle = '#7a1e1e'; c.font = '700 54px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('KINGFISHER VILLA', 256, 66);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.75), new THREE.MeshLambertMaterial({ map: tex }));
  sign.position.set(at.x + fx * (-R - 0.35), g0 + gateY(0) + 3.4, at.z + fz * (-R - 0.35)); sign.rotation.y = rot - Math.PI / 2; group.add(sign);
  // coconut palms round the lawn and along the wall
  const palm = (): THREE.BufferGeometry => {
    const p: THREE.BufferGeometry[] = []; let x = 0, y = 0;
    for (let i = 0; i < 7; i++) { const lean = 0.03 + i * 0.03, h = 1.8; p.push(tint(new THREE.CylinderGeometry(0.22, 0.27, h, 6).rotateZ(-lean).translate(x + Math.sin(lean) * h / 2, y + Math.cos(lean) * h / 2, 0), 0x8a7458)); x += Math.sin(lean) * h; y += Math.cos(lean) * h; }
    for (let k = 0; k < 10; k++) { let fx2 = 0, fy = 0, ang = 0.2; for (let sg = 0; sg < 3; sg++) { p.push(tint(new THREE.BoxGeometry(1.5, 0.05, 1.1 - sg * 0.25).translate(0.75, 0, 0).rotateZ(-ang).translate(fx2, fy, 0).rotateY(k / 10 * Math.PI * 2).translate(x, y, 0), 0x3f7a2e)); fx2 += Math.cos(ang) * 1.5; fy -= Math.sin(ang) * 1.5; ang += 0.35; } }
    return mergeGeometries(p)!;
  };
  const palmGeo = palm();
  for (let k = 0; k < 16; k++) {
    const f = k < 8 ? 12 + (k % 4) * 5 : -R + 4 + (k % 8) * 8, s = k < 8 ? (k < 4 ? -22 : 22) : (k % 2 ? -R + 3 : R - 3);
    const x = at.x + fx * f + sx * s, z = at.z + fz * f + sz * s;
    parts.push(palmGeo.clone().rotateY(k * 1.3).translate(x, Math.max(0.6, ctx.g.heightAt(x, z)), z));
  }
  const mesh = new THREE.Mesh(mergeGeometries(parts)!, new THREE.MeshLambertMaterial({ vertexColors: true }));
  mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh);

  // the watchman at the gate
  const gx = at.x + fx * (-R - 4) + sx * 7.5, gz = at.z + fz * (-R - 4) + sz * 7.5;
  const cast: Cast[] = [{ name: 'Ramesh', job: 'villa watchman', outfit: 'uniform', top: 0x4a5a7a, bottom: 0x2c2c34, hair: 'cap', skin: 2, prop: 'none', hint: 'grumpy',
    lines: ['No entry, baba. Private property. You can take photo from the gate only.',
      'Big parties they used to have here, men. Film stars, cricketers, everybody. Now it is quiet.',
      'New owners now, but everyone still calls it Kingfisher Villa. Tourists come daily just to see the gate.'] }];
  const guard = ctx.figure(cast[0]); guard.position.set(gx, Math.max(0.6, ctx.g.heightAt(gx, gz)) + 0.15, gz); group.add(guard);
  let said = 0;
  return {
    group,
    talk: (px, pz) => Math.hypot(px - gx, pz - gz) < 7 ? `Ramesh (villa watchman): "${cast[0].lines[said++ % 3]}"` : null,
    update: (_dt, time, px, pz) => { guard.rotation.y = Math.hypot(px - gx, pz - gz) < 9 ? -Math.atan2(pz - gz, px - gx) : rot + Math.PI + Math.sin(time * 0.3) * 0.6; },
  };
}
