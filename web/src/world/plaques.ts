// A story's plaque: a small painted board on a post at the real spot a story is about, with its title, so you come
// across it as you walk around (the map pin says where; the plaque says "you are here").
import * as THREE from 'three';
import type { GoaEvent } from '../ui/events';

function boardTex(title: string, by?: string): THREE.CanvasTexture {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256; const c = cv.getContext('2d')!;
  c.fillStyle = '#123a3a'; c.fillRect(0, 0, 512, 256);
  c.strokeStyle = '#e8b23a'; c.lineWidth = 8; c.strokeRect(10, 10, 492, 236);
  c.fillStyle = '#5fd8c8'; c.font = '700 26px Mukta, sans-serif'; c.textAlign = 'center'; c.fillText('✎  A STORY FROM HERE', 256, 52);
  c.fillStyle = '#fff4d8'; c.font = '700 40px Georgia, serif';
  // the title, wrapped onto two lines
  const words = title.split(' '), lines: string[] = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (c.measureText(t).width > 460 && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur);
  lines.slice(0, 2).forEach((l, i) => c.fillText(i === 1 && lines.length > 2 ? l + '…' : l, 256, 112 + i * 48));
  if (by) { c.fillStyle = '#cfc8b4'; c.font = '500 22px Mukta, sans-serif'; c.fillText(`Shared by ${by} · open the map to read`, 256, 220); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

export function buildPlaques(stories: GoaEvent[], heightAt: (x: number, z: number) => number, free: (x: number, z: number) => boolean): THREE.Group {
  const group = new THREE.Group(); group.name = 'story plaques';
  const post = new THREE.MeshLambertMaterial({ color: 0x3a2a1e });
  for (const s of stories) {
    // the nearest open ground to the spot (not inside a house or on the road)
    let x = s.x, z = s.z;
    for (let r = 0; r < 60 && !free(x, z); r += 2) { x = s.x + Math.cos(r) * r; z = s.z + Math.sin(r) * r; }
    const y = Math.max(0.6, heightAt(x, z)), g = new THREE.Group();
    g.position.set(x, y, z); g.rotation.y = (s.id.length * 1.7) % (Math.PI * 2);
    for (const dx of [-1.1, 1.1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.6, 0.14), post); p.position.set(dx, 1.3, 0); p.castShadow = true; g.add(p); }
    const board = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.3, 0.08), new THREE.MeshLambertMaterial({ color: 0x123a3a }));
    board.position.y = 2.1; board.castShadow = true; g.add(board);
    const tex = boardTex(s.title, s.by);
    for (const f of [1, -1]) {
      const face = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 1.25), new THREE.MeshBasicMaterial({ map: tex }));
      face.position.set(0, 2.1, 0.045 * f); if (f < 0) face.rotation.y = Math.PI; g.add(face);
    }
    group.add(g);
  }
  return group;
}
