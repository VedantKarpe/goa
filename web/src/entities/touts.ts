// Shop touts: outside some of the shops (not all: about one in four, and any shop that has its own ad) someone stands
// at the door calling people in. "Patrão, patrão! Come, come!" Walk past and they call out to you; Talk and they make
// their pitch. Later each business can have its own tout with its own lines (an ad in events.json with `tout` lines).
import type * as THREE from 'three';
import type { Cast } from './cast';
import type { Shop } from '../world/shops';

interface Tout { shop: Shop; x: number; z: number; cast: Cast; obj: THREE.Group | null; said: number; lines: string[] }

const OUTFITS: Pick<Cast, 'outfit' | 'top' | 'bottom' | 'hair' | 'skin'>[] = [
  { outfit: 'shirt', top: 0xe07a30, bottom: 0x2b2b33, hair: 'black', skin: 2 }, { outfit: 'tee', top: 0x2f7fc0, bottom: 0x3a3a44, hair: 'black', skin: 1 },
  { outfit: 'kurta', top: 0xf2c230, bottom: 0xf5f0e0, hair: 'long', skin: 1 }, { outfit: 'shirt', top: 0xc2267a, bottom: 0x2b2b33, hair: 'cap', skin: 2 },
  { outfit: 'sari', top: 0x3a9a5a, bottom: 0x3a9a5a, hair: 'bun', skin: 2 }, { outfit: 'tee', top: 0xd8443a, bottom: 0x2b2b33, hair: 'black', skin: 1 },
];

function pitch(s: Shop): string[] {
  const n = s.name, k = s.kind.toLowerCase();
  if (/restaurant|fast_food|food/.test(k)) return [`Patrão, patrão! Come, come, fish thali ready at ${n}! Fresh rawa fry, today only!`, `Hungry, baba? ${n}, best xacuti in Panjim, ask anybody!`, `Patrão! Prawn curry rice, sol kadi free! Come inside ${n}, AC also there.`];
  if (/hair|beauty|salon|barber/.test(k + ' ' + n.toLowerCase())) return [`Haircut, patrão? Two minutes only! New Bombay style at ${n}!`, `Shave, massage, hair colour, everything at ${n}, patrão!`, `Patrão, look at your hair, men! Come, come, ${n}!`];
  if (/sweet|mithai|pastry/.test(k + ' ' + n.toLowerCase())) return [`Patrão, fresh jalebi, hot hot! ${n}!`, `Kaju barfi, pedha, laddoo, take for the family! ${n}!`, `Sweets for the feast, patrão? ${n}, best in town!`];
  if (/cafe|bakery|confectionery/.test(k)) return [`Patrão, hot poee, hot hot! ${n}, just out of the oven!`, `Bebinca, dodol, patties! Come, come, ${n}, taste and see!`, `Chai and a bun, only twenty rupees, patrão! ${n}!`];
  if (/bar|pub|liquor|wine/.test(k)) return [`Patrão! Cold beer, cold cold! ${n}, happy hours now!`, `Feni, patrão, the real one from the village! ${n}!`, `Come, sit, patrão, cricket on the big TV at ${n}!`];
  if (/cloth|fashion|boutique|shoes|jewel/.test(k)) return [`Patrão, patrão, come inside! Today fifty percent off at ${n}!`, `Beach shirts, kaftans, everything! ${n}, best price for you, baba.`, `Only looking, patrão? Looking is free! ${n}!`];
  if (/mobile|electronic|phone/.test(k)) return [`Patrão! Phone cover, charger, earphones, all at ${n}!`, `Screen guard fitting, two minutes only! ${n}!`, `Patrão, recharge also we do! ${n}!`];
  return [`Patrão, patrão! Come here, we have deals! ${n}!`, `Come inside ${n}, patrão, today special discount!`, `Best price in Goa, patrão, ${n}! Just come and see!`];
}

export class Touts {
  list: Tout[] = [];
  private cool = 0;

  constructor(shops: Shop[], private build: (c: Cast) => { obj: THREE.Group }, private group: THREE.Group,
    private offRoad: (x: number, z: number) => boolean, private ground: (x: number, z: number) => number, ads: { place?: string; tout?: string[] }[] = []) {
    const hash = (s: string) => [...s].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
    for (const s of shops) {
      const ad = ads.find(a => a.tout?.length && a.place?.toLowerCase() === s.name.toLowerCase());
      if (!ad && hash(s.name) % 4 !== 0) continue;   // most shops just get on with business
      // stand at the shop's front, on open ground off the road
      let spot: { x: number; z: number } | null = null;
      for (let r = 3; r < 16 && !spot; r += 1.5) for (let a = 0; a < 6.28 && !spot; a += 0.6) { const x = s.x + Math.cos(a) * r, z = s.z + Math.sin(a) * r; if (this.offRoad(x, z)) spot = { x, z }; }
      if (!spot) continue;
      const h = hash(s.name), o = OUTFITS[h % OUTFITS.length];
      const cast: Cast = { name: `Tout at ${s.name}`, job: `calls people into ${s.name}`, ...o, prop: 'none', hint: 'chatty', lines: [] };
      this.list.push({ shop: s, ...spot, cast, obj: null, said: -99, lines: ad?.tout ?? pitch(s) });
    }
  }

  /** Each frame: show the touts near the child; the one you walk past calls out (returns the line to show, if any). */
  update(dt: number, px: number, pz: number, now: number): string | null {
    this.cool -= dt;
    let call: string | null = null;
    for (const t of this.list) {
      const d = Math.hypot(t.x - px, t.z - pz);
      if (d > 160) { if (t.obj) t.obj.visible = false; continue; }
      if (!t.obj) { t.obj = this.build(t.cast).obj; this.group.add(t.obj); }
      t.obj.visible = true;
      // beckoning: a little bounce, turned to you when you are close, else looking up and down the street
      const bob = d < 14 ? Math.abs(Math.sin(now * 7)) * 0.12 : 0;
      t.obj.position.set(t.x, this.ground(t.x, t.z) + 0.15 + bob, t.z);
      t.obj.rotation.y = d < 20 ? -Math.atan2(pz - t.z, px - t.x) : Math.sin(now * 0.4 + t.x) * 1.5;
      if (d < 9 && this.cool <= 0 && now - t.said > 45) { t.said = now; this.cool = 8; call = `${t.lines[Math.floor(Math.random() * t.lines.length)]}`; }
    }
    return call;
  }

  /** Talk, standing by a tout: their pitch. */
  near(px: number, pz: number): Tout | null { let b: Tout | null = null, bd = 4; for (const t of this.list) { const d = Math.hypot(t.x - px, t.z - pz); if (d < bd) { bd = d; b = t; } } return b; }
  talk(t: Tout): string { return `${t.lines[Math.floor(Math.random() * t.lines.length)]}`; }
}
