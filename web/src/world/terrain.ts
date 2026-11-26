// The land and the water: one mesh for the ground (a vertex at every tile corner, heights from the survey, coloured by
// what the map says grows there) and one flat sheet for the river and the sea.
import * as THREE from 'three';
import { LazyChunks } from './lazy';
import { Ground, T, WATER_Y, type PanjimData } from './data';
import { NEW_LOOK } from './look';

const TILE_COL: Record<string, [number, number, number]> = {
  G: [0.22, 0.38, 0.15], L: [0.22, 0.38, 0.15], R: [0.22, 0.38, 0.15], P: [0.44, 0.56, 0.28],
  F: [0.25, 0.42, 0.22], M: [0.22, 0.33, 0.21], S: [0.78, 0.68, 0.46], B: [0.78, 0.68, 0.46], W: [0.30, 0.40, 0.32],
};

const SUB = 4;

/** Soft, irregular patches of red laterite earth: smooth value noise (no repeating bands). */
function hash(x: number, y: number) { const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return h - Math.floor(h); }
function vnoise(x: number, y: number) {
  const i = Math.floor(x), j = Math.floor(y), u = x - i, v = y - j, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
  return (hash(i, j) * (1 - su) + hash(i + 1, j) * su) * (1 - sv) + (hash(i, j + 1) * (1 - su) + hash(i + 1, j + 1) * su) * sv;
}
function blotch(tx: number, ty: number) { const n = vnoise(tx / 6, ty / 6) * 0.65 + vnoise(tx / 2.2, ty / 2.2) * 0.35; return Math.max(0, n - 0.62) * 1.6; }   // ground vertices per tile edge: 5 m apart, so the shore can curve

/** How much land there is around each tile, blurred, so the shoreline comes out as smooth curves, not tile steps. */
function landField(g: Ground): Float32Array {
  const { W, H } = g; let f = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) f[i] = g.wet[i] ? 0 : 1;
  for (let pass = 0; pass < 0; pass++) {   // no blur: interpolating the raw tiles already rounds the corners, and keeps one-tile creeks open
    const o = new Float32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let sum = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; sum += f[yy * W + xx]; n++; }
      o[y * W + x] = sum / n;
    }
    f = o;
  }
  return f;
}

export function buildTerrain(d: PanjimData, g: Ground, solidAt: (X: number, Z: number) => boolean = () => false): THREE.Group {
  const { W, H } = d, field = landField(g);
  const landAt = (tx: number, ty: number) => {   // bilinear, tx/ty in tiles, sampled at tile centres
    const x = Math.max(0, Math.min(W - 1.001, tx - 0.5)), y = Math.max(0, Math.min(H - 1.001, ty - 0.5)), i = x | 0, j = y | 0, u = x - i, v = y - j;
    const F = (a: number, b: number) => field[(j + b) * W + i + a];
    return (F(0, 0) * (1 - u) + F(1, 0) * u) * (1 - v) + (F(0, 1) * (1 - u) + F(1, 1) * u) * v;
  };
  const smooth = (e0: number, e1: number, x: number) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
  // the ground in squares of C tiles (300 m), one mesh each, so the camera skips the squares it cannot see
  const C = 15, group = new THREE.Group(); group.name = 'terrain';
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  if (NEW_LOOK) groundDetail(mat);
  const lazy = new LazyChunks();
  for (let j0 = 0; j0 < H; j0 += C) for (let i0 = 0; i0 < W; i0 += C) lazy.add(j0 * 4096 + i0, (i0 + C / 2) * T, (j0 + C / 2) * T, () => {
  const cw = Math.min(C, W - i0), chh = Math.min(C, H - j0);
  { let land = false; for (let j = Math.max(0, j0 - 1); j < Math.min(H, j0 + chh + 1) && !land; j++) for (let i = Math.max(0, i0 - 1); i < Math.min(W, i0 + cw + 1); i++) if (!g.wet[j * W + i]) { land = true; break; } if (!land) return; }   // all sea: no ground to draw
  const geo = new THREE.PlaneGeometry(cw * T, chh * T, cw * SUB, chh * SUB);
  geo.rotateX(-Math.PI / 2);                     // lie flat: the plane's rows run along +Z (south)
  geo.translate((i0 + cw / 2) * T, 0, (j0 + chh / 2) * T);
  const pos = geo.attributes.position as THREE.BufferAttribute, col = new Float32Array(pos.count * 3);
  const SAND: [number, number, number] = [0.80, 0.70, 0.48];
  for (let v = 0; v < pos.count; v++) {
    const X = pos.getX(v), Z = pos.getZ(v), tx = X / T, ty = Z / T;
    const land = solidAt(X, Z) ? 1 : landAt(tx, ty), k = smooth(0.42, 0.58, land);   // the bank is built up under riverside streets
    const hl = Math.max(0.6, g.heightAt(X, Z));
    // under a street the ground sits a little lower than the road surface, so grass never pokes through it
    pos.setY(v, -2.2 + (hl + 2.2) * k - (solidAt(X, Z) ? 0.35 : 0));
    const i = Math.min(W - 1, Math.floor(tx)), j = Math.min(H - 1, Math.floor(ty));
    const c = TILE_COL[d.rows[j][i]] || TILE_COL.G;
    const hk = 1 + Math.min(0.12, g.rawHeight(tx, ty) / 400);
    const jit = 0.94 + ((i * 73 + j * 37) % 11) / 90;
    const lat = c === TILE_COL.G || c === TILE_COL.L || c === TILE_COL.R ? blotch(tx, ty) : 0;
    // the colour blends between neighbouring tiles, the boundary wobbled by noise, so sand meets grass in an irregular
    // natural line rather than the 20 m squares of the map
    const wx = tx + (vnoise(tx / 1.7 + 11, ty / 1.7) - 0.5) * 1.3, wy = ty + (vnoise(tx / 1.7, ty / 1.7 + 7) - 0.5) * 1.3;
    const bx = Math.max(0, Math.min(W - 1.001, wx - 0.5)), by = Math.max(0, Math.min(H - 1.001, wy - 0.5)), bi = bx | 0, bj = by | 0, bu = bx - bi, bv = by - bj;
    const tc = (a: number, b2: number) => TILE_COL[d.rows[bj + b2][bi + a]] || TILE_COL.G;
    const c00 = tc(0, 0), c10 = tc(1, 0), c01 = tc(0, 1), c11 = tc(1, 1), sm2 = (t: number) => t * t * (3 - 2 * t), u2 = sm2(bu), v2 = sm2(bv);
    const mixc = (k2: number) => (c00[k2] * (1 - u2) + c10[k2] * u2) * (1 - v2) + (c01[k2] * (1 - u2) + c11[k2] * u2) * v2;
    let r0 = mixc(0) + (0.55 - mixc(0)) * lat, g0 = mixc(1) + (0.36 - mixc(1)) * lat, b0 = mixc(2) + (0.22 - mixc(2)) * lat;
    // a band of sand or mud along the water's edge
    const beach = (1 - smooth(0.58, 0.85, land)) * 0.85;
    // the new look: sand only where the map has a beach; elsewhere the shore is dark laterite rock
    let sandy = !NEW_LOOK;
    if (!sandy) for (let dj = -2; dj <= 2 && !sandy; dj++) for (let di = -2; di <= 2; di++) { const ch = d.rows[Math.max(0, Math.min(H - 1, j + dj))][Math.max(0, Math.min(W - 1, i + di))]; if (ch === 'B' || ch === 'S') { sandy = true; break; } }
    const SH = sandy ? SAND : [0.40, 0.29, 0.23];
    r0 += (SH[0] - r0) * beach; g0 += (SH[1] - g0) * beach; b0 += (SH[2] - b0) * beach;
    col[v * 3] = r0 * hk * jit; col[v * 3 + 1] = g0 * hk * jit; col[v * 3 + 2] = b0 * hk * jit;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.userData.cx = (i0 + cw / 2) * T; mesh.userData.cz = (j0 + chh / 2) * T;
  group.add(mesh);
  });
  group.userData.lazy = lazy;   // the ground's squares are made as the child comes near (main asks for them)
  return group;
}

/** The water's clock (seconds), advanced by the game each frame. */
export const waterTime = { value: 0 };

export function buildWater(d: PanjimData, g?: Ground): THREE.Mesh {
  const pad = 2000;
  const geo = new THREE.PlaneGeometry(d.W * T + pad * 2, d.H * T + pad * 2);
  geo.rotateX(-Math.PI / 2); geo.translate((d.W * T) / 2, WATER_Y, (d.H * T) / 2);
  if (NEW_LOOK && g) { const m = new THREE.Mesh(geo, newWater(d, g)); m.receiveShadow = true; m.name = 'water'; return m; }
  // moving waves: bands of lighter and darker water drifting with the current, and small sparkling crests
  const mat = new THREE.MeshLambertMaterial({ color: 0x2f7a9a });
  mat.onBeforeCompile = sh => {
    sh.uniforms.uTime = waterTime;
    sh.vertexShader = 'varying vec3 vW;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vW = (modelMatrix * vec4(position, 1.0)).xyz;');
    // smooth value noise drifting with the current: irregular ripples and thin, broken crest lines (no repeating pattern)
    sh.fragmentShader = `uniform float uTime;
varying vec3 vW;
float wh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float wn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(wh(i), wh(i + vec2(1, 0)), f.x), mix(wh(i + vec2(0, 1)), wh(i + vec2(1, 1)), f.x), f.y); }
` + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      vec2 q = vW.xz * vec2(0.025, 0.06) + vec2(uTime * 0.06, uTime * 0.015);
      float n = wn(q) * 0.6 + wn(q * 2.7 + vec2(-uTime * 0.09, uTime * 0.04)) * 0.4;
      float line = 1.0 - abs(n - 0.62) * 22.0;
      diffuseColor.rgb *= 0.9 + 0.18 * (n - 0.5);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.7, 0.86, 0.92), clamp(line, 0.0, 1.0) * 0.35);`);
  };
  mat.customProgramCacheKey = () => 'water-waves';
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'water';
  return mesh;
}

/** The new look's ground: grass that changes shade across the land (lush, dry, yellowed), small tufts and dapples up
 *  close, and bare laterite and dark rock where the ground is steep (cliffs, the Dona Paula headland). All in the shader. */
function groundDetail(mat: THREE.MeshLambertMaterial) {
  mat.onBeforeCompile = sh => {
    sh.vertexShader = 'varying vec3 vGW; varying vec3 vGN;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vGW = (modelMatrix * vec4(position, 1.0)).xyz; vGN = normalize(mat3(modelMatrix) * normal);');
    sh.fragmentShader = `varying vec3 vGW; varying vec3 vGN;
float gh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float gn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(gh(i), gh(i + vec2(1, 0)), f.x), mix(gh(i + vec2(0, 1)), gh(i + vec2(1, 1)), f.x), f.y); }
float gfbm(vec2 p) { return gn(p) * 0.5 + gn(p * 2.03) * 0.25 + gn(p * 4.01) * 0.125 + gn(p * 8.0) * 0.0625; }
` + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      vec3 base = diffuseColor.rgb;
      float green = clamp((base.g - max(base.r, base.b)) * 6.0, 0.0, 1.0);          // how grassy this ground is (not sand, not road)
      float big = gfbm(vGW.xz * 0.012), mid = gfbm(vGW.xz * 0.06), fine = gn(vGW.xz * 0.9);
      vec3 lush = vec3(0.20, 0.40, 0.13), dry = vec3(0.47, 0.50, 0.22), yellowed = vec3(0.58, 0.52, 0.26);
      vec3 grass = mix(lush, dry, smoothstep(0.35, 0.75, big));
      grass = mix(grass, yellowed, smoothstep(0.62, 0.85, mid) * 0.5);
      grass *= 0.86 + 0.24 * fine;                                                    // tufts and dapples up close
      vec3 col = mix(base * (0.92 + 0.16 * fine), grass, green * 0.85);
      // red laterite earth where the grass wears thin, and rock on steep ground
      float earth = smoothstep(0.68, 0.82, gfbm(vGW.xz * 0.03 + 7.0)) * green;
      col = mix(col, vec3(0.55, 0.28, 0.17) * (0.85 + 0.3 * mid), earth * 0.7);
      float steep = smoothstep(0.86, 0.62, vGN.y);
      vec3 rock = mix(vec3(0.42, 0.30, 0.24), vec3(0.30, 0.27, 0.26), gn(vGW.xz * 0.25 + vGW.y * 0.3)) * (0.8 + 0.4 * fine);
      col = mix(col, rock, steep);
      diffuseColor.rgb = col;`);
  };
  mat.customProgramCacheKey = () => 'ground-new';
}

/** The new look's sea and river: turquoise over the shallows by the shore, deep blue further out, a band of foam where
 *  the waves meet the land, small waves catching the sun, and the far water paling into the haze. */
function newWater(d: PanjimData, g: Ground): THREE.MeshPhongMaterial {
  // how near the land is, from each tile (blurred out a few tiles): drives the shallows and the foam
  const { W, H } = g; let f = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) f[i] = g.wet[i] ? 0 : 1;
  for (let pass = 0; pass < 4; pass++) {
    const o = new Float32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let sum = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; sum += f[yy * W + xx]; n++; }
      o[y * W + x] = Math.max(f[y * W + x] * (g.wet[y * W + x] ? 0 : 1), sum / n);
    }
    f = o;
  }
  const data = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) data[i] = Math.round(Math.min(1, f[i]) * 255);
  const tex = new THREE.DataTexture(data, W, H, THREE.RedFormat); tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
  const mat = new THREE.MeshPhongMaterial({ color: 0x1f6a86, specular: 0x4a5c66, shininess: 140 });
  mat.onBeforeCompile = sh => {
    sh.uniforms.uTime = waterTime; sh.uniforms.uLand = { value: tex }; sh.uniforms.uSize = { value: new THREE.Vector2(d.W * T, d.H * T) };
    sh.vertexShader = 'varying vec3 vW;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vW = (modelMatrix * vec4(position, 1.0)).xyz;');
    sh.fragmentShader = `uniform float uTime; uniform sampler2D uLand; uniform vec2 uSize;
varying vec3 vW;
float wh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float wn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(wh(i), wh(i + vec2(1, 0)), f.x), mix(wh(i + vec2(0, 1)), wh(i + vec2(1, 1)), f.x), f.y); }
float waves(vec2 p) { return wn(p * 0.09 + vec2(uTime * 0.05, uTime * 0.02)) * 0.55 + wn(p * 0.23 + vec2(-uTime * 0.08, uTime * 0.06)) * 0.3 + wn(p * 0.7 + vec2(uTime * 0.2, -uTime * 0.1)) * 0.15; }
` + sh.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
      vec2 uv = vW.xz / uSize;
      float near = (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) ? 0.0 : texture2D(uLand, uv).r;
      vec3 deep = vec3(0.07, 0.30, 0.42), mid = vec3(0.10, 0.45, 0.52), shallow = vec3(0.28, 0.66, 0.62);
      vec3 col = mix(deep, mid, smoothstep(0.0, 0.25, near));
      col = mix(col, shallow, smoothstep(0.25, 0.55, near));
      float wv = waves(vW.xz);
      col *= 0.9 + 0.2 * wv;
      // foam: broken white lines rolling in along the shore
      float band = smoothstep(0.52, 0.64, near) * (1.0 - smoothstep(0.8, 0.95, near));
      float roll = sin(near * 40.0 - uTime * 1.6 + wn(vW.xz * 0.15) * 6.0) * 0.5 + 0.5;
      float foam = band * smoothstep(0.55, 0.95, roll * (0.6 + 0.6 * wn(vW.xz * 0.4 + uTime * 0.3)));
      col = mix(col, vec3(0.90, 0.95, 0.94), clamp(foam * 0.75 + smoothstep(0.68, 0.8, near) * 0.5, 0.0, 0.85));
      diffuseColor.rgb = col;`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      { float e = 0.6; float h0 = waves(vW.xz), hx = waves(vW.xz + vec2(e, 0.0)), hz = waves(vW.xz + vec2(0.0, e));
        vec3 wn3 = normalize(vec3(-(hx - h0) * 1.6, 1.0, -(hz - h0) * 1.6));
        normal = normalize((viewMatrix * vec4(wn3, 0.0)).xyz); }`);
  };
  mat.customProgramCacheKey = () => 'water-new';
  return mat;
}
