// Panjim's shops from OpenStreetMap: a coloured signboard over each named shop's door, turned to its street, and for
// the famous places to eat (Ritz Classic, Viva Panjim, Venite, Cafe Bhonsle...) a big name board you can read from
// down the street. Walk near a shop and its name shows.
import * as THREE from 'three';
import { T, type PanjimData, type Ground } from './data';
import type { Seg } from './roads';

const KIND: Record<string, number> = { clothes: 0x2f7fc1, jewelry: 0xd8a62a, supermarket: 0x2c9a52, general: 0x2c9a52, bakery: 0xc8642a, electronics: 0x5a4ab0, mobile_phone: 0x5a4ab0, wine: 0x8a2a4a, travel_agency: 0x18a0a0, nuts: 0xb07a3a };

export interface Shop { name: string; kind: string; x: number; z: number; famous: boolean }

export function buildShops(d: PanjimData, g: Ground, segs: Seg[]): { group: THREE.Group; list: Shop[] } {
  const group = new THREE.Group(); group.name = 'shops';
  const list: Shop[] = (d.shops ?? []).map(([name, kind, x, y, f]) => ({ name, kind, x: x * T, z: y * T, famous: !!f }));
  const boards: THREE.Matrix4[] = [], cols: THREE.Color[] = [];
  for (const s of list) {
    // face the nearest street, and hang the board on the frontage toward it
    let best = 1e9, fx = 0, fz = 1;
    for (const q of segs) {
      if (q.half < 2.5) continue;
      const vx = q.bx - q.ax, vz = q.bz - q.az, L2 = vx * vx + vz * vz || 1, t = Math.max(0, Math.min(1, ((s.x - q.ax) * vx + (s.z - q.az) * vz) / L2));
      const px = q.ax + vx * t, pz = q.az + vz * t, dd = Math.hypot(px - s.x, pz - s.z);
      if (dd < best) { best = dd; fx = (px - s.x) / (dd || 1); fz = (pz - s.z) / (dd || 1); }
    }
    const k = Math.max(0, Math.min(best - q0(best), 14)), x = s.x + fx * k, z = s.z + fz * k, y = g.heightAt(x, z), ang = Math.atan2(fx, fz);
    s.x = x; s.z = z;
    if (s.famous) { group.add(nameBoard(s.name, x, y, z, ang)); continue; }
    boards.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y + 3.6, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ang), new THREE.Vector3(1, 1, 1)));
    cols.push(new THREE.Color(KIND[s.kind] ?? [0xd0342c, 0x2f7fc1, 0x2c9a52, 0xd8a62a][s.name.length % 4]));
  }
  const im = new THREE.InstancedMesh(new THREE.BoxGeometry(2.8, 0.9, 0.15), new THREE.MeshLambertMaterial({ color: 0xffffff }), Math.max(1, boards.length));
  im.count = boards.length;
  boards.forEach((m, i) => { im.setMatrixAt(i, m); im.setColorAt(i, cols[i]); });
  im.castShadow = true; group.add(im);
  return { group, list };
}

// stop the board a few metres short of the street's centre line, at its frontage
const q0 = (best: number) => Math.min(best, 7);

// a big painted board with the name on both faces, up on two poles
function nameBoard(name: string, x: number, y: number, z: number, ang: number): THREE.Group {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128;
  const c = cv.getContext('2d')!;
  c.fillStyle = '#7a1e1e'; c.fillRect(0, 0, 512, 128); c.strokeStyle = '#f2c230'; c.lineWidth = 8; c.strokeRect(6, 6, 500, 116);
  c.fillStyle = '#fff4d8'; c.textAlign = 'center'; c.textBaseline = 'middle';
  let fs = 64; do { fs -= 4; c.font = `700 ${fs}px Georgia, serif`; } while (c.measureText(name).width > 470 && fs > 20);
  c.fillText(name, 256, 66);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const o = new THREE.Group();
  const face = new THREE.MeshLambertMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.35 }), edge = new THREE.MeshLambertMaterial({ color: 0x3a2a1a });
  const board = new THREE.Mesh(new THREE.BoxGeometry(7, 1.75, 0.2), [edge, edge, edge, edge, face, face]); board.position.y = 6; o.add(board);
  for (const px of [-3, 3]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6, 5), edge); p.position.set(px, 3, -0.1); o.add(p); }
  o.position.set(x, y, z); o.rotation.y = ang; o.traverse(m => { m.castShadow = true; });
  return o;
}

/** The big "I ❤ GOA" letters on a plinth, as people pose with by the river. */
export function buildLoveSign(x: number, y: number, z: number, ang: number): THREE.Group {
  const o = new THREE.Group(); o.name = 'love sign';
  const parts: [string, string, number][] = [['I', '#ffffff', -4.6], ['♥', '#e0252e', -2.2], ['G', '#f2a51a', 0.6], ['O', '#1aa05a', 2.8], ['A', '#1f6fd1', 5.0]];
  for (const [ch, col, px] of parts) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 256;
    const c = cv.getContext('2d')!; c.fillStyle = col; c.font = '900 230px Arial Black, Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(ch, 128, 140);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const side = new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, color: 0xc8c8c8 });
    const front = new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.25 });
    // block letters: the same cut-out stacked in thin layers, the outer faces lit brighter
    for (let k = 0; k <= 10; k++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), k === 0 || k === 10 ? front : side);
      m.position.set(px, 2.9, -0.4 + k * 0.08); m.castShadow = k === 5; o.add(m);
    }
  }
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(13, 1.1, 2.2), new THREE.MeshLambertMaterial({ color: 0x8a8076 })); plinth.position.y = 0.55; plinth.castShadow = plinth.receiveShadow = true; o.add(plinth);
  o.position.set(x, y, z); o.rotation.y = ang; o.scale.setScalar(1.6);
  return o;
}
