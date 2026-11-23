// Worn streets: Panjim's asphalt is never one smooth grey. Faded patches, darker squares where it was dug up and
// patched, thin cracks; road paint worn away in places; pavement slabs each a slightly different red, some broken.
import type * as THREE from 'three';
import { NEW_LOOK } from './look';

const NOISE = `
varying vec3 vWp;
float wH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float wN(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(wH(i), wH(i + vec2(1, 0)), f.x), mix(wH(i + vec2(0, 1)), wH(i + vec2(1, 1)), f.x), f.y); }
`;
const WORN: Record<'asphalt' | 'paint' | 'pavement', string> = {
  asphalt: `{ vec2 p = vWp.xz; float a = wN(p * 0.07), b = wN(p * 0.5), c = wN(p * 2.3);
    diffuseColor.rgb *= 0.8 + 0.32 * a + 0.12 * b + 0.06 * c;
    vec2 cell = floor(p / 3.2); if (wH(cell) > 0.94) diffuseColor.rgb *= 0.7;
    if (abs(wN(p * 0.32) - 0.5) < 0.011 || abs(wN(p * 0.9 + 17.0) - 0.5) < 0.006) diffuseColor.rgb *= 0.7; }`,
  paint: `{ float n = wN(vWp.xz * 0.45) * 0.7 + wN(vWp.xz * 3.0) * 0.3; if (n < 0.36) discard; diffuseColor.rgb *= 0.8 + 0.25 * n; }`,
  pavement: `{ vec2 cell = floor(vWp.xz / 1.1); float h = wH(cell); diffuseColor.rgb *= 0.85 + 0.25 * h;
    vec2 f = fract(vWp.xz / 1.1); if (min(f.x, f.y) < 0.06) diffuseColor.rgb *= 0.75; if (h > 0.96) diffuseColor.rgb = vec3(0.42, 0.4, 0.36); }`,
};

// the painted look: tidy and clean, like a hand-painted city-builder (a faint even grain only)
const CLEAN: Record<'asphalt' | 'paint' | 'pavement', string> = {
  asphalt: `{ vec2 p = vWp.xz; diffuseColor.rgb *= 0.95 + 0.07 * wN(p * 0.05) + 0.03 * wN(p * 0.6); }`,
  paint: `{ }`,
  pavement: `{ vec2 f = fract(vWp.xz / 1.4); diffuseColor.rgb *= 0.97 + 0.05 * wH(floor(vWp.xz / 1.4)); if (min(f.x, f.y) < 0.04) diffuseColor.rgb *= 0.9; }`,
};
const LOOK = NEW_LOOK ? CLEAN : WORN;

export function wear(m: THREE.Material, kind: keyof typeof LOOK) {
  m.onBeforeCompile = sh => {
    sh.vertexShader = 'varying vec3 vWp;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = NOISE + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n' + LOOK[kind]);
  };
  m.customProgramCacheKey = () => 'wear-' + kind;
}
