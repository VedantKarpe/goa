// Trees where the map has woods, and low dark mangroves on the creek banks: one instanced mesh each (one draw call for
// thousands of trees).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Ground, T, type PanjimData } from './data';
import type { BuildingIndex } from './buildings';
import type { StreetIndex } from './roads';
import { NEW_LOOK } from './look';

function tinted(geo: THREE.BufferGeometry, hex: number): THREE.BufferGeometry {
  const c = new THREE.Color(hex), n = geo.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3)); geo.deleteAttribute('uv'); return geo;
}

function treeGeo(trunkH: number, crownR: number, crown: number): THREE.BufferGeometry {
  const trunk = tinted(new THREE.CylinderGeometry(0.35, 0.5, trunkH, 6).translate(0, trunkH / 2, 0), 0x6b4a2e);
  const top = tinted(new THREE.IcosahedronGeometry(crownR, 0).translate(0, trunkH + crownR * 0.6, 0), crown);
  return mergeGeometries([trunk.toNonIndexed(), top.toNonIndexed()])!;
}

/** A coconut palm: a slender trunk leaning and curving up, a crown of long drooping fronds, a few coconuts. */
function palmGeo(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  let x = 0, y = 0;
  for (let i = 0; i < 6; i++) {          // the trunk in six pieces, each leaning a little more
    const lean = 0.05 + i * 0.045, h = 2.2;
    const seg = new THREE.CylinderGeometry(0.28 - i * 0.02, 0.32 - i * 0.02, h, 6).rotateZ(-lean).translate(x + Math.sin(lean) * h / 2, y + Math.cos(lean) * h / 2, 0);
    parts.push(tinted(seg, i % 2 ? 0x8a7458 : 0x7a6448).toNonIndexed());
    x += Math.sin(lean) * h; y += Math.cos(lean) * h;
  }
  for (let k = 0; k < 9; k++) {           // fronds: long thin leaves arching out and down
    const a = (k / 9) * Math.PI * 2, L = 4.6;
    const fr = new THREE.BoxGeometry(L, 0.06, 0.9).translate(L / 2, 0, 0).rotateZ(-0.35 - (k % 3) * 0.12).rotateY(a).translate(x, y, 0);
    parts.push(tinted(fr, k % 2 ? 0x4f8a3a : 0x3f7a30).toNonIndexed());
  }
  for (let k = 0; k < 3; k++) parts.push(tinted(new THREE.SphereGeometry(0.3, 5, 4).translate(x + Math.cos(k * 2.1) * 0.35, y - 0.4, Math.sin(k * 2.1) * 0.35), 0x6b5a2a).toNonIndexed());
  return mergeGeometries(parts)!;
}

/** The new look's broadleaf tree (mango, jackfruit, the woods on the Dona Paula hill): a forked trunk under a full,
 *  rounded crown of several soft clumps. */
/** A round crown clump, shaded light on top and darker underneath like a painted tree. */
function clump(r: number, x: number, y: number, z: number, hex: number): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(r, 2).scale(1.08, 0.94, 1.08).translate(x, y, z).toNonIndexed(), p = g.attributes.position, c = new THREE.Color(hex), a = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const k = 0.8 + 0.32 * Math.max(0, Math.min(1, (p.getY(i) - (y - r)) / (2 * r))); a[i * 3] = c.r * k; a[i * 3 + 1] = c.g * k; a[i * 3 + 2] = c.b * k; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); g.deleteAttribute('uv'); return g;
}

function leafyGeo(crown: number): THREE.BufferGeometry {
  const parts = [tinted(new THREE.CylinderGeometry(0.35, 0.6, 4.5, 7).translate(0, 2.25, 0), 0x5a4030).toNonIndexed()];
  for (const a of [0.4, 2.5, 4.4]) parts.push(tinted(new THREE.CylinderGeometry(0.18, 0.3, 3, 5).rotateZ(0.55).rotateY(a).translate(Math.cos(a) * 0.7, 5, -Math.sin(a) * 0.7), 0x5a4030).toNonIndexed());
  const c = new THREE.Color(crown), dark = c.clone().multiplyScalar(0.78).getHex(), light = c.clone().lerp(new THREE.Color(0x9ac060), 0.25).getHex();
  const blobs: [number, number, number, number, number][] = [[0, 7.8, 0, 3.3, crown], [2.4, 6.8, 0.9, 2.6, dark], [-2.2, 6.9, -1.0, 2.7, crown], [0.7, 6.6, -2.4, 2.5, dark], [-0.9, 9.2, 1.1, 2.4, light], [-1.6, 6.5, 2.0, 2.3, crown], [1.8, 8.8, -0.8, 2.2, light]];
  for (const [x, y, z, r, col] of blobs) parts.push(clump(r, x, y, z, col));
  return mergeGeometries(parts)!;
}

/** The new look's coconut palm: a curving ringed trunk and a crown of arching fronds, each a strip of leaflets that
 *  droops towards its tip. */
function palm2Geo(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  let x = 0, y = 0;
  for (let i = 0; i < 8; i++) {
    const lean = 0.04 + i * 0.035, h = 1.7;
    parts.push(tinted(new THREE.CylinderGeometry(0.24 - i * 0.012, 0.28 - i * 0.012, h, 7).rotateZ(-lean).translate(x + Math.sin(lean) * h / 2, y + Math.cos(lean) * h / 2, 0), i % 2 ? 0x8f7a5c : 0x7d6a4e).toNonIndexed());
    x += Math.sin(lean) * h; y += Math.cos(lean) * h;
  }
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2 + (k % 2) * 0.2, up = k < 4 ? 0.5 : 0;   // a few young fronds stand up
    let fx = 0, fy = 0, ang = 0.25 - up;
    for (let sgm = 0; sgm < 4; sgm++) {                  // the frond in four pieces, bending further down each piece
      const L = 1.4, w = 1.25 - sgm * 0.22;
      const piece = new THREE.BoxGeometry(L, 0.04, w).translate(L / 2, 0, 0).rotateZ(-ang).translate(fx, fy, 0).rotateY(a).translate(x, y, 0);
      parts.push(tinted(piece, sgm % 2 ? 0x4c8a36 : 0x3d7a2c).toNonIndexed());
      fx += Math.cos(ang) * L; fy -= Math.sin(ang) * L; ang += 0.32;
    }
  }
  for (let k = 0; k < 4; k++) parts.push(tinted(new THREE.SphereGeometry(0.28, 6, 5).translate(x + Math.cos(k * 1.6) * 0.32, y - 0.35, Math.sin(k * 1.6) * 0.32), 0x7a6a2a).toNonIndexed());
  return mergeGeometries(parts)!;
}

/** A flowering bush: bougainvillea pink or hibiscus red over green. */
function bushGeo(): THREE.BufferGeometry {
  const g1 = tinted(new THREE.IcosahedronGeometry(1.3, 0).scale(1.2, 0.8, 1.2).translate(0, 0.9, 0), 0x3f7030).toNonIndexed();
  const g2 = tinted(new THREE.IcosahedronGeometry(0.8, 0).translate(0.5, 1.4, 0.3), 0xd8407a).toNonIndexed();
  return mergeGeometries([g1, g2])!;
}

/** A rain tree, as on Panjim's avenues: a thick dark trunk forking into a broad, spreading, flat-topped canopy. */
function rainTreeGeo(crown: number, bloom: number): THREE.BufferGeometry {
  const parts = [tinted(new THREE.CylinderGeometry(0.7, 1.1, 7, 7).translate(0, 3.5, 0), 0x4a3a2c).toNonIndexed()];
  for (const a of [0.6, 2.7, 4.6]) parts.push(tinted(new THREE.CylinderGeometry(0.35, 0.55, 5, 6).rotateZ(0.7).rotateY(a).translate(Math.cos(a) * 1.4, 8, -Math.sin(a) * 1.4), 0x4a3a2c).toNonIndexed());
  const blobs: [number, number, number, number][] = [[0, 11, 0, 5.5], [4, 10.2, 1, 4.2], [-3.5, 10.4, -1.8, 4.4], [1, 10, -4, 4], [-1.5, 10.2, 3.8, 4.2]];
  blobs.forEach(([x, y, z, r], i) => parts.push(tinted(new THREE.IcosahedronGeometry(r, 1).scale(1.25, 0.6, 1.25).translate(x, y, z), i === 0 && bloom !== crown ? bloom : i % 2 ? crown : bloom).toNonIndexed()));
  return mergeGeometries(parts)!;
}

export function buildTrees(d: PanjimData, g: Ground, bi: BuildingIndex, si: StreetIndex): THREE.Group {
  const group = new THREE.Group(); group.name = 'trees';
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const spots = (letter: string, per: number) => {
    const out: [number, number][] = [];
    for (let y = 0; y < d.H; y++) for (let x = 0; x < d.W; x++) {
      if (d.rows[y][x] !== letter) continue;
      for (let k = 0; k < Math.floor(per + rnd()); k++) {
        const X = (x + rnd()) * T, Z = (y + rnd()) * T;
        if (!bi.solid(X, Z, 3) && !si.at(X, Z)) out.push([X, Z]);
      }
    }
    return out;
  };
  // trees are grouped into map squares 240 m across, one instanced mesh each, so the squares off-screen or far away are
  // skipped entirely (a single mesh for the whole town meant every tree was drawn every frame)
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: !NEW_LOOK });   // the new look: soft rounded shading
  const place = (geo: THREE.BufferGeometry, list: [number, number][], scale: [number, number]) => {
    const C = 240, cells = new Map<number, [number, number][]>();
    for (const q of list) { const k = Math.floor(q[0] / C) * 4096 + Math.floor(q[1] / C); let a = cells.get(k); if (!a) cells.set(k, a = []); a.push(q); }
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    for (const [k, items] of cells) {
      const mesh = new THREE.InstancedMesh(geo, mat, items.length);
      items.forEach(([X, Z], i) => {
        const sc = scale[0] + rnd() * (scale[1] - scale[0]);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * Math.PI * 2);
        m.compose(p.set(X, g.heightAt(X, Z), Z), q, s.set(sc, sc, sc)); mesh.setMatrixAt(i, m);
        if (NEW_LOOK) mesh.setColorAt(i, new THREE.Color().setScalar(0.82 + rnd() * 0.32));   // no two trees quite the same shade
      });
      mesh.computeBoundingSphere();
      mesh.userData.cell = [(Math.floor(k / 4096) + 0.5) * C, ((k % 4096) + 0.5) * C];   // for hiding far squares
      mesh.castShadow = true; mesh.receiveShadow = true;
      group.add(mesh);
    }
  };
  if (NEW_LOOK) {
    // woods: dense mixed canopy (the Raj Bhavan hill at Dona Paula, Altinho's slopes), with coconut palms through it
    place(leafyGeo(0x5e963c), spots('F', 2.6), [0.8, 1.35]); place(leafyGeo(0x76aa45), spots('F', 1.2), [0.7, 1.2]); place(palm2Geo(), spots('F', 0.5), [0.95, 1.3]);
  } else place(treeGeo(3.5, 3.4, 0x467a3a), spots('F', 2), [0.8, 1.4]);
  place(treeGeo(1.2, 2.4, 0x2a4a30), spots('M', 1), [0.7, 1.1]);
  // coconut palms over the open ground and along the sand, flowering bushes in the gardens
  place(NEW_LOOK ? palm2Geo() : palmGeo(), [...spots('G', 0.35), ...spots('S', 0.06), ...spots('B', 0.06)], [0.9, 1.25]);   // a few palms on the sand: Miramar is open beach, casuarinas behind it
  place(bushGeo(), spots('G', 0.9), [0.8, 1.2]);
  // shade trees in the gardens and open plots, and tufts of tall grass everywhere green
  place(NEW_LOOK ? leafyGeo(0x6ea442) : treeGeo(3.2, 3.0, 0x4f8a3c), spots('G', 0.35), [0.6, 1.0]);
  const tuft = mergeGeometries([0, 1, 2].map(k => tinted(new THREE.ConeGeometry(0.35, 1.4, 4).rotateZ((k - 1) * 0.35).translate((k - 1) * 0.3, 0.6, 0), k === 1 ? 0x5f9a3e : 0x4a8434).toNonIndexed()))!;
  // grass: no outline and no shadow (there are tens of thousands), in its own group
  const grass = new THREE.Group(); grass.name = 'grass'; group.add(grass);
  const gl: [number, number][] = [];   // grass tufts read as little pyramids: left out for now
  const gm = new THREE.InstancedMesh(tuft, new THREE.MeshLambertMaterial({ vertexColors: true }), gl.length);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3();
  gl.forEach(([X, Z], i) => { const k = 0.8 + rnd() * 0.7; Q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * 6.28); M.compose(P.set(X, g.heightAt(X, Z), Z), Q, S.set(k, k, k)); gm.setMatrixAt(i, M); });
  grass.add(gm);
  // avenues: rain trees lining both sides of the main streets (every fourth one a gulmohar in flame-red bloom)
  const ave: [number, number][] = [], ave2: [number, number][] = [];
  for (const [f, w, flags] of d.r) {
    if (w < 9 || (flags & 1)) continue;
    const L = f.length / 2;
    for (let i = 1; i < L; i++) {
      const ax = f[i * 2 - 2] * T, az = f[i * 2 - 1] * T, bx = f[i * 2] * T, bz = f[i * 2 + 1] * T, len = Math.hypot(bx - ax, bz - az);
      if (len < 1) continue;
      const nx = -(bz - az) / len, nz = (bx - ax) / len, off = w * 0.75 + 5;
      for (let s = 10; s < len; s += 24) for (const sd of [-1, 1]) {
        const X = ax + (bx - ax) * s / len + nx * off * sd, Z = az + (bz - az) * s / len + nz * off * sd;
        if (bi.solid(X, Z, 3) || si.at(X, Z) || g.isWet(X, Z)) continue;
        (rnd() < 0.22 ? ave2 : ave).push([X, Z]);
      }
    }
  }
  place(rainTreeGeo(0x3c6a2e, 0x4c7a34), ave, [0.75, 1.05]);
  place(rainTreeGeo(0x3c6a2e, 0xe0482a), ave2, [0.7, 0.95]);
  return group;
}
