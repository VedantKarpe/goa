// The game's look (soft, painterly, warm Goan light); ?look=old still shows the old cartoon one. The new look: filmic colour, a real sky the sun moves across, soft contact shadows in the
// corners (ambient occlusion), a gentle glow on bright lamps at night, and no hard cel bands or ink outlines.
import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

const q = location.search;
export const NEW_LOOK = !q.includes('look=old');   // the new look is the game's look; ?look=old shows the cartoon one
/** Phones and weak GPUs: the look without the costly occlusion pass. */
const LIGHT = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) || q.includes('lite');

export class Look {
  sky: Sky | null = null;
  private composer: EffectComposer | null = null;
  private ao: GTAOPass | null = null;
  private bloom: UnrealBloomPass | null = null;

  constructor(private renderer: THREE.WebGLRenderer, private scene: THREE.Scene, private camera: THREE.PerspectiveCamera) {
    if (!NEW_LOOK) return;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
    this.sky = new Sky(); this.sky.scale.setScalar(20000); this.sky.name = 'sky';
    const u = this.sky.material.uniforms;
    u.turbidity.value = 7; u.rayleigh.value = 1.4; u.mieCoefficient.value = 0.006; u.mieDirectionalG.value = 0.86;   // a humid, hazy tropical sky
    scene.add(this.sky);
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));
    if (!LIGHT) {
      this.ao = new GTAOPass(scene, camera, 1, 1);
      this.ao.updateGtaoMaterial({ radius: 2.2, distanceExponent: 1.4, thickness: 1.5, scale: 1.0, samples: 12 });
      this.ao.blendIntensity = 0.85;
      this.composer.addPass(this.ao);
    }
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.35, 0.6, 0.92);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
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
    if (this.bloom) { this.bloom.strength = 0.25 + dark * 0.6; this.bloom.threshold = 0.92 - dark * 0.25; }
  }

  setSize(w: number, h: number, pr: number) {
    if (!this.composer) return;
    this.composer.setPixelRatio(pr); this.composer.setSize(w, h);
  }

  render() {
    if (this.composer) this.composer.render(); else this.renderer.render(this.scene, this.camera);
  }
}
