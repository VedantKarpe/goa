// The game's look (soft, painterly, warm Goan light); ?look=old still shows the old cartoon one. The new look: filmic colour, a real sky the sun moves across, soft contact shadows in the
// corners (ambient occlusion), a gentle glow on bright lamps at night, and no hard cel bands or ink outlines.
import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

/** The painted finish, after tone mapping: thin soft brown outlines where the colour changes sharply (roof edges, walls
 *  against the sky, people against the road), a warmer and gently muted palette, and shadows lifted a little, like a
 *  hand-painted city-builder. One full-screen pass, nine taps. */
const PaintShader = {
  uniforms: { tDiffuse: { value: null }, px: { value: new THREE.Vector2(1, 1) }, ink: { value: 0.7 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 px; uniform float ink; varying vec2 vUv;
    float L(vec2 o){ return dot(texture2D(tDiffuse, vUv + o * px).rgb, vec3(.299, .587, .114)); }
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float a = L(vec2(-1., -1.)), b = L(vec2(0., -1.)), d = L(vec2(1., -1.)), e = L(vec2(-1., 0.)), f = L(vec2(1., 0.)), g = L(vec2(-1., 1.)), h = L(vec2(0., 1.)), i = L(vec2(1., 1.));
      float gx = (d + 2. * f + i) - (a + 2. * e + g), gy = (g + 2. * h + i) - (a + 2. * b + d);
      float edge = smoothstep(0.14, 0.38, length(vec2(gx, gy)));
      float l = dot(c, vec3(.299, .587, .114));
      c = mix(vec3(l), c, 0.78);                                   // a touch less saturated
      c = c * vec3(0.95, 0.94, 0.86) + vec3(0.07, 0.065, 0.045);    // warm, with the darks lifted
      c = mix(c, c * vec3(0.42, 0.33, 0.27), edge * ink);          // the soft brown line
      gl_FragColor = vec4(c, 1.);
    }`,
};

const q = location.search;
export const NEW_LOOK = !q.includes('look=old');   // the new look is the game's look; ?look=old shows the cartoon one
/** Phones and weak GPUs: the look without the costly occlusion pass. */
export const LIGHT = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) || q.includes('lite');

export class Look {
  sky: Sky | null = null;
  private composer: EffectComposer | null = null;
  private ao: GTAOPass | null = null;
  private bloom: UnrealBloomPass | null = null;
  private paint: ShaderPass | null = null;
  private scale = 1;            // drawn at this share of the screen's pixels (lowered when frames run slow)
  private size: [number, number, number] = [1, 1, 1];

  constructor(private renderer: THREE.WebGLRenderer, private scene: THREE.Scene, private camera: THREE.PerspectiveCamera) {
    if (!NEW_LOOK) return;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
    this.sky = new Sky(); this.sky.scale.setScalar(20000); this.sky.name = 'sky';
    const u = this.sky.material.uniforms;
    u.turbidity.value = 7; u.rayleigh.value = 1.4; u.mieCoefficient.value = 0.006; u.mieDirectionalG.value = 0.86;   // a humid, hazy tropical sky
    scene.add(this.sky);
    // the effects draw into a multisampled target (smooth edges) at no more than 1x the screen's pixels: drawing them at
    // the 2x the plain game uses made a big screen four times the work
    this.composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
    this.composer.addPass(new RenderPass(scene, camera));
    if (!LIGHT && q.includes('ao')) {   // the soft corner shadows cost three quarters of a frame: only on request (?ao)
      this.ao = new GTAOPass(scene, camera, 1, 1);
      this.ao.updateGtaoMaterial({ radius: 2.2, distanceExponent: 1.4, thickness: 1.5, scale: 1.0, samples: 8 });
      this.ao.blendIntensity = 0.85;
      this.composer.addPass(this.ao);
    }
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.35, 0.6, 0.92);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    if (!q.includes('paint=off')) { this.paint = new ShaderPass(PaintShader); this.composer.addPass(this.paint); }
  }

  /** The sun's direction (towards the sun) and how dark it is (0 day, 1 night): the sky and the glow follow. */
  setSun(dir: THREE.Vector3, dark: number) {
    if (!this.sky) return;
    const u = this.sky.material.uniforms;
    u.sunPosition.value.copy(dir).multiplyScalar(1000);
    u.rayleigh.value = 1.4 + dark * 1.2;
    this.scene.background = null;
    // a light, slightly blue tropical haze by day, warm at dusk, deep blue at night
    if (this.scene.fog) (this.scene.fog as THREE.Fog).color.setRGB(0.68 - dark * 0.54, 0.78 - dark * 0.6, 0.88 - dark * 0.6);
    this.renderer.toneMappingExposure = 1.0 - dark * 0.4;
    if (this.bloom) { this.bloom.strength = 0.2 + dark * 0.25; this.bloom.threshold = 0.95 - dark * 0.08; }   // only the lamps themselves glow, not what they light
  }

  setSize(w: number, h: number, pr: number) {
    if (!this.composer) return;
    this.size = [w, h, pr];
    // phones have 2-3 pixels per point: drawing at 1 made them blurry. Phones (no occlusion pass) get up to 2, other
    // screens up to 1.25; frames running slow lower `scale`
    this.composer.setPixelRatio(Math.max(LIGHT ? 0 : Math.min(1, pr), Math.min(LIGHT ? 2 : 1.25, pr) * this.scale));   // a desktop never drops below its own pixels (blocky)
    this.composer.setSize(w, h);
    if (this.paint) { const r = Math.max(LIGHT ? 0 : Math.min(1, pr), Math.min(LIGHT ? 2 : 1.25, pr) * this.scale); this.paint.uniforms.px.value.set(1 / (w * r), 1 / (h * r)); }
  }

  /** Frames are running slow: give up the costliest effect still on (the occlusion first, then the glow). Returns false
   *  when there is nothing left to drop. */
  degrade(): boolean {
    if (this.ao?.enabled) { this.ao.enabled = false; return true; }
    if (this.bloom?.enabled) { this.bloom.enabled = false; return true; }
    if (this.composer && this.scale > 0.5) { this.scale -= 0.15; this.setSize(...this.size); return true; }
    return false;
  }

  render() {
    if (this.composer) this.composer.render(); else this.renderer.render(this.scene, this.camera);
  }
}
