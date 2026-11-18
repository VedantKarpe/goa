// The cars you see on Goa's roads, each built to its real proportions (metres; the game draws vehicles 1.6x life size):
// the Maruti Swift, Alto and Wagon R, the Hyundai i20 and Creta, the Toyota Innova, the Maruti Ertiga, and the
// Mahindra Thar (the rental every tourist wants). Plates: white for private cars; black with yellow letters for the
// self-drive rentals (Goa's commercial plates for hire cars).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type CarModel = 'swift' | 'alto' | 'wagonr' | 'i20' | 'creta' | 'innova' | 'ertiga' | 'thar';
interface Spec { L: number; W: number; H: number; clear: number; bonnet: number; boot: number; cabin: number; colours: number[]; boxy?: boolean; soft?: boolean; spare?: boolean; rails?: boolean; round?: boolean }

export const SPECS: Record<CarModel, Spec> = {
  swift: { L: 3.85, W: 1.73, H: 1.50, clear: 0.17, bonnet: 0.27, boot: 0.10, cabin: 0.62, colours: [0xc4232b, 0xf2f0ea, 0x2456a6, 0x8c8f94, 0x1d1d22] },
  alto: { L: 3.45, W: 1.50, H: 1.47, clear: 0.16, bonnet: 0.22, boot: 0.10, cabin: 0.66, colours: [0xf2f0ea, 0xb8bcc2, 0xc4232b, 0x3a6aa8] },
  wagonr: { L: 3.65, W: 1.62, H: 1.67, clear: 0.17, bonnet: 0.18, boot: 0.06, cabin: 0.74, boxy: true, colours: [0xf2f0ea, 0xb8bcc2, 0x2e7a5a, 0x7a2030] },
  i20: { L: 3.99, W: 1.77, H: 1.50, clear: 0.17, bonnet: 0.27, boot: 0.10, cabin: 0.60, colours: [0xf2f0ea, 0xd04a1a, 0x3a3e46, 0x2a5aa8] },
  creta: { L: 4.30, W: 1.79, H: 1.64, clear: 0.19, bonnet: 0.27, boot: 0.12, cabin: 0.60, rails: true, colours: [0xf2f0ea, 0x1d1d22, 0xb8bcc2, 0x7a1a20] },
  innova: { L: 4.74, W: 1.83, H: 1.80, clear: 0.18, bonnet: 0.22, boot: 0.06, cabin: 0.72, boxy: true, colours: [0xf2f0ea, 0xb8bcc2, 0xd8d4c8, 0x5a5e66] },
  ertiga: { L: 4.40, W: 1.73, H: 1.69, clear: 0.18, bonnet: 0.22, boot: 0.08, cabin: 0.70, colours: [0xb8bcc2, 0xf2f0ea, 0x6a3020, 0x2a4c8a] },
  thar: { L: 3.98, W: 1.82, H: 1.85, clear: 0.23, bonnet: 0.30, boot: 0.06, cabin: 0.62, boxy: true, soft: true, spare: true, round: true, colours: [0xb3191f, 0x1d1d22, 0xf2f0ea, 0x6a6e5a, 0x2e5a3a] },
};

/** How common each is on Goa's roads (rentals are mostly Thars and Swifts). */
export const ROAD_MIX: [CarModel, number][] = [['swift', 0.2], ['alto', 0.14], ['wagonr', 0.12], ['i20', 0.12], ['creta', 0.1], ['innova', 0.11], ['ertiga', 0.09], ['thar', 0.12]];
export const RENTAL_MIX: [CarModel, number][] = [['thar', 0.45], ['swift', 0.25], ['i20', 0.15], ['creta', 0.15]];
export function pick(mix: [CarModel, number][], r: number): CarModel { let a = 0; for (const [m, w] of mix) { a += w; if (r < a) return m; } return mix[0][0]; }

/** Build a car. The body is one merged mesh (one draw call); wheels are separate when they need to spin. */
export function buildCar(model: CarModel, colour: number | null, plateKind: 'private' | 'rental', opts: { spinWheels?: boolean } = {}): { obj: THREE.Group; wheels: THREE.Object3D[]; len: number } {
  const S = SPECS[model], col = colour ?? S.colours[Math.floor(Math.random() * S.colours.length)];
  const parts: THREE.BufferGeometry[] = [];
  const box = (l: number, h: number, w: number, x: number, y: number, c: number, z = 0) => {
    const g = new THREE.BoxGeometry(l, h, w).translate(x, y, z).toNonIndexed(), cc = new THREE.Color(c), a = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < a.length; i += 3) { a[i] = cc.r; a[i + 1] = cc.g; a[i + 2] = cc.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3)); g.deleteAttribute('uv'); parts.push(g);
  };
  const { L, W, H, clear } = S, wheelR = model === 'thar' ? 0.38 : model === 'innova' || model === 'creta' ? 0.33 : 0.29;
  const bodyY = clear + wheelR * 0.6, bodyH = (H - clear) * (S.boxy ? 0.48 : 0.45), glass = 0x1b2430, dark = 0x1d1d22;
  // the lower body
  box(L, bodyH, W, 0, bodyY + bodyH / 2, col);
  // the cabin: from behind the bonnet to before the boot, a little narrower; its windows dark
  const cabL = L * S.cabin, cabX = (S.boot - S.bonnet) * L / 2 + (S.boxy ? 0.05 : 0), cabY = bodyY + bodyH, cabH = H - cabY;
  box(cabL, cabH * 0.12, W * 0.94, cabX, cabY + cabH * 0.06, col);                       // the waist
  box(cabL * 0.96, cabH * 0.62, W * 0.9, cabX, cabY + cabH * 0.12 + cabH * 0.31, glass);   // the windows
  if (S.soft) box(cabL * 0.98, cabH * 0.26, W * 0.92, cabX, H - cabH * 0.13, dark);       // the Thar's soft top
  else box(cabL * 0.9, cabH * 0.26, W * 0.88, cabX, H - cabH * 0.13, col);               // the roof
  for (const s of [-1, 1]) box(0.08, cabH * 0.62, 0.06, cabX + s * cabL * 0.18, cabY + cabH * 0.43, col, W * 0.45);   // pillars
  if (S.rails) for (const z of [-1, 1]) box(cabL * 0.8, 0.06, 0.06, cabX, H + 0.03, 0x2a2a2e, z * W * 0.38);
  // bumpers, grille, lights
  box(0.12, bodyH * 0.45, W * 0.98, L / 2, bodyY + bodyH * 0.2, S.boxy && model === 'thar' ? dark : 0x2a2a2e);
  box(0.12, bodyH * 0.45, W * 0.98, -L / 2, bodyY + bodyH * 0.2, S.boxy && model === 'thar' ? dark : 0x2a2a2e);
  box(0.04, bodyH * 0.3, W * 0.4, L / 2 + 0.02, bodyY + bodyH * 0.62, dark);
  for (const z of [-1, 1]) {
    box(0.05, model === 'thar' ? 0.26 : 0.16, model === 'thar' ? 0.26 : 0.34, L / 2 + 0.03, bodyY + bodyH * 0.7, 0xfff6d0, z * W * 0.36);
    box(0.05, 0.16, 0.26, -L / 2 - 0.03, bodyY + bodyH * 0.7, 0xc0202a, z * W * 0.38);
  }
  if (S.spare) { box(0.25, 0.7, 0.7, -L / 2 - 0.2, bodyY + bodyH * 0.8, dark); }       // the spare wheel on the Thar's back
  if (model === 'thar') for (const x of [-1, 1]) box(0.8, 0.12, W * 1.06, x * L * 0.33, bodyY + 0.35, dark);   // flared arches
  // wheels (in the body unless they need to spin)
  const wheels: THREE.Object3D[] = [], wheelGeo = new THREE.CylinderGeometry(wheelR, wheelR, 0.24, 10).rotateX(Math.PI / 2);
  const wheelAt: [number, number][] = [[L * 0.33, W / 2 - 0.05], [L * 0.33, -W / 2 + 0.05], [-L * 0.33, W / 2 - 0.05], [-L * 0.33, -W / 2 + 0.05]];
  if (!opts.spinWheels) for (const [x, z] of wheelAt) { const g = wheelGeo.clone().translate(x, wheelR, z).toNonIndexed(), a = new Float32Array(g.attributes.position.count * 3).fill(0.07); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); g.deleteAttribute('uv'); parts.push(g); }
  const obj = new THREE.Group();
  const body = new THREE.Mesh(mergeGeometries(parts)!, new THREE.MeshLambertMaterial({ vertexColors: true })); body.castShadow = true; obj.add(body);
  if (opts.spinWheels) for (const [x, z] of wheelAt) { const w = new THREE.Mesh(wheelGeo, new THREE.MeshLambertMaterial({ color: 0x151515 })); w.position.set(x, wheelR, z); obj.add(w); wheels.push(w); }
  void plateKind;
  obj.scale.setScalar(1.6);
  return { obj, wheels, len: L * 1.6 };
}
