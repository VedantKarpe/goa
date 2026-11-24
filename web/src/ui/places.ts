// The Places guide: Panjim's neighbourhoods and landmarks with a line about each. Pick one and it becomes your guide
// target: a pin on the minimap, a glowing beam over it in the city, and an arrow at the screen's edge pointing the way.
// A place counts as discovered once the child has been near it.
import * as THREE from 'three';
import { T, type PanjimData, type Ground } from '../world/data';
import { when, type GoaEvent } from './events';

export interface Place { name: string; x: number; z: number; note: string; seen: boolean }

const NOTES: Record<string, string> = {
  'Miramar': 'The beach, men! Evening walk, bhel-puri, and the sun going into the sea.',
  'Mandovi': 'The big river, men. Casino boats at night, ferries to Betim in the day.',
  'Panaji': 'Our capital city. Small only, but everybody knows everybody.',
  'Church Square': 'The garden in front of the big white church. Everybody meets here.',
  'Fontainhas': 'The old Latin quarter. Red, yellow, blue houses, and Portuguese still spoken here.',
  'São Tomé': 'Next to Fontainhas, the old post office side. Narrow lanes, careful on the cycle.',
  'Mala': 'Up from the creek, by the Maruti temple steps.',
  'Altinho': 'The hill. Big old houses, the Bishop\'s palace, and a nice breeze, baba.',
  'Campal': 'Along the river, the gardens and the Kala Academy. Evening walks here.',
  'Santa Inez': 'Quiet side, the creek and the new buildings.',
  'Patto': 'Where the Kadamba buses come in. Rush rush always.',
  'Panjim Bazaar': 'The market! Fish, poee, vegetables. Go early or everything is finished.',
  'Neugi Nagar': 'Houses and houses, near the highway side.',
  'Ourém creek': 'The creek between Fontainhas and Patto. Mangroves, and crabs if you look.',
  'Atal Setu': 'The new cable bridge over the Mandovi. All lit up at night.',
  'Ponte de Linhares': 'The old long causeway, built by the Portuguese. Two hundred years old, men.',
  'church': 'Our Lady of the Immaculate Conception. Those zig-zag steps, every photo is here only.',
  'secretariat': 'The Old Secretariat, Adil Shah\'s palace once. Right on the riverfront.',
  'mahalaxmi': 'The Mahalaxmi temple. Go with your shoes off, no?',
  'atalsetu': 'Atal Setu pylons, tall and white.',
  'imb': 'Institute Menezes Braganza, the library and the azulejo tiles at the entrance.',
  'postoffice': 'The Head Post Office. Old red building, letters going since Portuguese time.',
  'maruti': 'The Maruti temple on Altinho, the saffron tower you can see from far.',
  'sebastian': 'St. Sebastian chapel in Fontainhas. The big crucifix inside has open eyes.',
  'donbosco': 'Don Bosco. The school and the shrine, boys playing football outside.',
  'kadamba': 'The Kadamba bus stand. Mapusa, Margao, Vasco, shouting conductors.',
};
const LM_NAMES: Record<string, string> = { church: 'Immaculate Conception Church', secretariat: 'Old Secretariat', mahalaxmi: 'Mahalaxmi Temple', atalsetu: 'Atal Setu', imb: 'Institute Menezes Braganza', postoffice: 'Head Post Office', maruti: 'Maruti Temple', sebastian: 'St. Sebastian Chapel', donbosco: 'Don Bosco', kadamba: 'Kadamba Bus Stand' };

export class Places {
  list: Place[];
  target: Place | null = null;
  private panel = document.getElementById('places')!;
  private arrow = document.getElementById('arrow')!;
  private beam: THREE.Mesh;
  /** Take a pilot to a place (set by the game). */
  onTravel: (p: Place) => void = () => {};
  /** What's on (events, stories, ads), listed above the places. */
  events: GoaEvent[] = [];
  /** Show one on the big map with its card. */
  onShow: (e: GoaEvent) => void = () => {};
  /** Where the child is (the list is sorted nearest first). */
  here: () => [number, number] = () => [0, 0];
  /** Glide the map to a place (the list sits under the map). */
  onFocus: (x: number, z: number) => void = () => {};
  /** The list was closed with its ✕. */
  onHide: () => void = () => {};
  get isOpen() { return this.panel.classList.contains('open'); }
  hide() { if (this.isOpen) { this.panel.classList.remove('open'); this.onHide(); } }
  show() { if (!this.isOpen) this.toggle(); }

  constructor(d: PanjimData, private g: Ground, scene: THREE.Scene, private onPick: (p: Place) => void) {
    this.list = [
      ...d.lm.map(l => ({ name: LM_NAMES[l.name] ?? l.name, x: l.at[0][0] * T, z: l.at[0][1] * T, note: NOTES[l.name] ?? '', seen: false })),
      ...d.places.map(([n, x, y]) => ({ name: n, x: x * T, z: y * T, note: NOTES[n] ?? '', seen: false })),
    ];
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 120, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0x9fe8d6, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide }));
    this.beam.visible = false; scene.add(this.beam);

  }

  toggle() {
    const open = this.panel.classList.toggle('open');
    if (!open) return;
    const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
    const [hx, hz] = this.here(), far = (x: number, z: number) => { const m = Math.hypot(x - hx, z - hz); return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`; };
    const ICON = { event: '★', ad: '₹', story: '✎', business: '🏪' }, COL = { event: '#ff5fa2', ad: '#f2c230', story: '#5fd8c8', business: '#ff9a3d' };
    const evRow = (e: GoaEvent, i: number) => `<div class="prow" style="display:flex;gap:6px;align-items:stretch"><button data-ev="${i}" style="flex:1 1 auto"><b><span style="color:${COL[e.type]}">${ICON[e.type]}</span> ${esc(e.title)}</b><em>${esc(when(e))} · ${esc(e.where)} · ${far(e.x, e.z)}</em><span>${esc(e.blurb)}</span></button><div style="display:flex;flex-direction:column;gap:4px;flex:0 0 64px"><button data-evg="${i}" style="font-weight:700;text-align:center;padding:4px">Guide</button><button data-evt="${i}" style="font-weight:700;text-align:center;padding:4px;color:var(--lamp)">Go ›</button></div></div>`;
    const row = (p: Place, i: number) => `<div class="prow" style="display:flex;gap:6px;align-items:stretch"><button data-i="${i}" class="${p === this.target ? 'on' : ''}" style="flex:1 1 auto"><b>${p.name}</b><em>${far(p.x, p.z)}${p.seen ? '' : ' · not yet visited'}</em><span>${p.note}</span></button><div style="display:flex;flex-direction:column;gap:4px;flex:0 0 64px"><button data-pg="${i}" style="font-weight:700;text-align:center;padding:4px">Guide</button><button data-go="${i}" title="Take a pilot there" style="font-weight:700;text-align:center;padding:4px;color:var(--lamp)">Go ›</button></div></div>`;
    const order = this.list.map((p, i) => [Math.hypot(p.x - hx, p.z - hz), i] as [number, number]).sort((a, b) => a[0] - b[0]).map(q => q[1]);   // nearest first
    this.panel.innerHTML = `<div class="ph"><h2>What's on in Goa</h2><span>Tap one to see it on the map · Guide: follow the green light · Go: take a pilot</span><button class="x" aria-label="Close">✕</button></div>`
      + `<div class="pl">${this.events.length ? `<div class="sec">On now &amp; coming up</div>${this.events.map(evRow).join('')}` : ''}`
      + `<div class="sec">Places · ${this.list.filter(p => p.seen).length} of ${this.list.length} visited</div>${order.map(i => row(this.list[i], i)).join('')}</div>`;
    const close = () => this.hide();
    this.panel.querySelectorAll<HTMLButtonElement>('button[data-ev]').forEach(b => b.addEventListener('click', () => { this.onShow(this.events[+b.dataset.ev!]); }));
    this.panel.querySelectorAll<HTMLButtonElement>('button[data-evg]').forEach(b => b.addEventListener('click', () => { const e = this.events[+b.dataset.evg!]; close(); this.target = { name: e.title, x: e.x, z: e.z, note: '', seen: false }; this.onPick(this.target); }));
    this.panel.querySelectorAll<HTMLButtonElement>('button[data-evt]').forEach(b => b.addEventListener('click', () => { const e = this.events[+b.dataset.evt!]; close(); this.onTravel({ name: e.where, x: e.x, z: e.z, note: '', seen: false }); }));
    this.panel.querySelector('.x')!.addEventListener('click', () => this.hide());
    this.panel.querySelectorAll<HTMLButtonElement>('.pl button[data-go]').forEach(b => b.addEventListener('click', () => {
      this.hide(); this.onTravel(this.list[+b.dataset.go!]);
    }));
    // a place: tap it to see it on the map above; Guide to be led there; Go to take a pilot
    this.panel.querySelectorAll<HTMLButtonElement>('.pl button[data-i]').forEach(b => b.addEventListener('click', () => { const p = this.list[+b.dataset.i!]; this.onFocus(p.x, p.z); this.panel.querySelectorAll('.pl button.on').forEach(x => x.classList.remove('on')); b.classList.add('on'); }));
    this.panel.querySelectorAll<HTMLButtonElement>('.pl button[data-pg]').forEach(b => b.addEventListener('click', () => { const p = this.list[+b.dataset.pg!]; this.target = p; this.hide(); this.onPick(p); }));
  }

  /** Mark places visited; move the beam and the edge arrow. Returns a newly visited place, if any. */
  update(cx: number, cz: number, camera: THREE.Camera, t: number): Place | null {
    let fresh: Place | null = null;
    for (const p of this.list) if (!p.seen && Math.hypot(p.x - cx, p.z - cz) < 60) { p.seen = true; fresh = p; }
    const tg = this.target;
    if (tg && Math.hypot(tg.x - cx, tg.z - cz) < 30) { this.target = null; fresh = fresh ?? tg; }
    this.beam.visible = !!this.target;
    if (!this.target) { this.arrow.style.display = 'none'; return fresh; }
    const p = this.target;
    this.beam.position.set(p.x, this.g.heightAt(p.x, p.z) + 60, p.z); (this.beam.material as THREE.MeshBasicMaterial).opacity = 0.22 + Math.sin(t * 3) * 0.08;
    // the arrow: where on screen the target is, pinned to the edge when it is off screen
    const wp = new THREE.Vector3(p.x, this.g.heightAt(p.x, p.z) + 4, p.z), v = wp.clone().project(camera);
    const on = v.z < 1 && Math.abs(v.x) < 0.9 && Math.abs(v.y) < 0.85;
    let sx = v.x, sy = -v.y;
    if (!on) {
      // off screen (or behind): point along the ground bearing from the view, ahead = up, behind = down. The projection
      // of a point behind the camera flips and stretches, which made the arrow point the wrong way.
      const c = wp.applyMatrix4(camera.matrixWorldInverse);   // x right, z towards the viewer
      const L = Math.hypot(c.x, c.z) || 1; sx = c.x / L; sy = c.z / L;
    }
    const k = on ? 1 : 0.85 / Math.max(Math.abs(sx), Math.abs(sy) / 0.8, 1e-3);
    const W = innerWidth, H = innerHeight, px = (sx * k * 0.5 + 0.5) * W, py = (sy * k * 0.5 + 0.5) * H;
    const d = Math.round(Math.hypot(p.x - cx, p.z - cz) / 10) * 10;
    this.arrow.style.display = 'block';
    this.arrow.style.transform = `translate(${px}px, ${py}px) translate(-50%, -50%)`;
    this.arrow.innerHTML = `<i style="transform: rotate(${Math.atan2(sy, sx)}rad); opacity:${on ? 0 : 1}">➤</i><span>${p.name} · ${d} m</span>`;
    return fresh;
  }
}
