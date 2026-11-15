// The story: seven nights to bring back the church bell.
//
// Someone has stolen the bell of the Immaculate Conception Church. Without its evening bell the spirits of Goan
// folklore walk loose in Panjim, and each night one of them holds a neighbourhood. Each night the child must find a
// piece of the bell where that spirit hides and carry it back to Church Square before dawn. On the seventh night every
// spirit is out, and the bell must be rung before midnight.
//
// A night is won (the piece is saved, the next night is harder), or lost: morning comes first, or the piece fades.
// A lost night is played again the next evening. Progress is kept in the browser.
import * as THREE from 'three';

export interface SpiritRules {
  want: number;        // how many demons at once
  speed: number;       // their creep (m/s), and lunge when close
  lunge: number;
  hurt: number;        // courage lost a second in their touch
  reach: number;       // how far the torch holds them off (m)
  hideBeyond: number;  // unseen until this close (0: always seen)
  freezeSeen: boolean; // they cannot move while you look at them (night 1)
  dodge: number;       // chance a banish misses
  tint: number;        // the smoke's colour
}

export interface Night {
  title: string; spirit: string; area: string;
  intro: string; hint: string;
  rules: Partial<SpiritRules>;
  drain: number;            // torch battery used a second
  fog?: boolean;            // the bhoot's fog (Altinho)
  moves?: boolean;          // the bhoot moves the piece once, when you come near
  dueBy?: number;           // the piece fades at this time (minutes past midnight of the evening, e.g. 23:00 = 1380)
  blackout?: boolean;       // the night begins dark; Uncle at the battery shop has the piece
  noTorch?: boolean;        // no torch: the glowing cows show the way
  final?: boolean;          // ring the bell at Church Square before midnight
}

export const BASE: SpiritRules = { want: 12, speed: 6, lunge: 10, hurt: 22, reach: 8, hideBeyond: 0, freezeSeen: false, dodge: 0, tint: 0x2a1830 };

export const NIGHTS: Night[] = [
  { title: 'Night 1 · Fontainhas', spirit: 'level 1 bhoots', area: 'Fontainhas',
    intro: 'Aay deva! The church bell is stolen, and the spirits are loose. In the lanes of Fontainhas the bhoots are out. They only move when you are not looking at them, baba. Keep your eyes on them! Find the first piece of the bell and bring it to Church Square before morning.',
    hint: 'Turn the view to face a bhoot and it freezes.',
    rules: { want: 6, speed: 7, lunge: 12, hurt: 16, freezeSeen: true, tint: 0xd8dcd8 }, drain: 0.3 },
  { title: 'Night 2 · Altinho', spirit: 'a level 2 trickster bhoot', area: 'Altinho',
    intro: 'Up on Altinho a trickster bhoot is playing games. He brings the fog down on the hill, and he moves things when you come close, men. The second piece of the bell is somewhere up there. Bring it to Church Square before morning.',
    hint: 'The bhoot moves the piece once. Follow the pin again.',
    rules: { want: 8, speed: 7, lunge: 11, hurt: 18, tint: 0x24301c }, drain: 0.35, fog: true, moves: true },
  { title: 'Night 3 · The Market', spirit: 'level 3 bhoots', area: 'Panjim Bazaar',
    intro: 'In the bazaar the bhoots hide among the crowds and the cows. You will not see them until they are right next to you. And hurry: the third piece fades at 11 o\'clock. Get it and bring it to Church Square.',
    hint: 'The piece fades at 11 pm.',
    rules: { want: 10, speed: 7, lunge: 12, hurt: 20, hideBeyond: 16, tint: 0x3a1010 }, drain: 0.4, dueBy: 23 * 60 },
  { title: 'Night 4 · The River', spirit: 'level 4 river bhoots', area: 'Campal',
    intro: 'The casino lights have called the river bhoots out of the Mandovi. They are fast, and some of them laugh at your torch. The fourth piece is far off at Campal. Catch a pilot or take a cycle, baba, it is a long way.',
    hint: 'Far off: ride a pilot (F near the road) or take a cycle.',
    rules: { want: 12, speed: 9, lunge: 13, hurt: 22, dodge: 0.25, tint: 0x0e2a3a }, drain: 0.45 },
  { title: 'Night 5 · Blackout', spirit: 'level 5 bhoots', area: '',
    intro: 'Tonight Panjim goes dark the moment the sun sets. Uncle at the battery shop has the fifth piece. Follow the one lit street to him. They know you are coming.',
    hint: 'Follow the only lit street to Uncle.',
    rules: { want: 12, speed: 8, lunge: 13, hurt: 24, dodge: 0.3, tint: 0x111122 }, drain: 0.5, blackout: true },
  { title: 'Night 6 · Ourém Creek', spirit: 'level 6 creek bhoots', area: 'Patto',
    intro: 'By Ourém creek even a torch will not work, men. But the cows know the way. Follow the glowing cows to the sixth piece at Patto: stay near them and the spirits keep back.',
    hint: 'No torch. Stay close to the glowing cows.',
    rules: { want: 12, speed: 8, lunge: 12, hurt: 24, dodge: 0.35, tint: 0x1c2a14 }, drain: 0, noTorch: true },
  { title: 'Night 7 · The Bell', spirit: 'level 7 bhoots, all of them', area: 'Altinho',
    intro: 'Six pieces, baba! But the thief has come back for them: the whole bell is up on Altinho, where he hid it. Every spirit in Panjim is out tonight. Bring it down to Church Square and ring it before midnight, and Panjim is free.',
    hint: 'Get the bell on Altinho, ring it at Church Square before 12.',
    rules: { want: 16, speed: 8, lunge: 14, hurt: 26, dodge: 0.35, hideBeyond: 0, tint: 0x2a0a2a }, drain: 0.5, final: true },
];

type Phase = 'waiting' | 'seek' | 'carry' | 'won' | 'lost';

export class Campaign {
  night = 0;                       // which night (0..6); 7 when the story is finished
  phase: Phase = 'waiting';
  piece = { x: 0, z: 0 };          // where the piece is (or the bell, on the last night)
  readonly group = new THREE.Group();
  private mark: THREE.Group;
  private moved = false;
  private square: { x: number; z: number };

  constructor(private places: Map<string, { x: number; z: number }>, private free: (x: number, z: number) => boolean, private heightAt: (x: number, z: number) => number) {
    this.group.name = 'campaign';
    try { this.night = Math.max(0, Math.min(7, Number(localStorage.getItem('goa.night') ?? 0) || 0)); } catch { /* no storage */ }
    this.square = places.get('Church Square') ?? { x: 0, z: 0 };
    // the piece: a golden bell shard in a column of warm light you can see across the town
    this.mark = new THREE.Group();
    const gold = new THREE.MeshLambertMaterial({ color: 0xe8b830, emissive: 0xe8a020, emissiveIntensity: 0.5 });
    const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1.1, 1.4, 10, 1, true), gold); bell.position.y = 1.6; this.mark.add(bell);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), gold); knob.position.y = 2.4; this.mark.add(knob);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 90, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd060, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }));
    beam.position.y = 45; this.mark.add(beam);
    this.mark.visible = false; this.group.add(this.mark);
  }

  get cur(): Night | null { return this.night < NIGHTS.length ? NIGHTS[this.night] : null; }
  get done(): boolean { return this.night >= NIGHTS.length; }
  get active(): boolean { return this.phase === 'seek' || this.phase === 'carry'; }
  /** The spirits' rules tonight. */
  get rules(): SpiritRules { return { ...BASE, ...(this.active ? this.cur?.rules : {}) }; }

  private save() { try { localStorage.setItem('goa.night', String(this.night)); } catch { /* no storage */ } }
  reset() { this.night = 0; this.phase = 'waiting'; this.mark.visible = false; this.save(); }

  // a walkable spot some way from a place's centre (the same each time the night is played)
  private spotNear(name: string, seed: number, r0 = 40, r1 = 110): { x: number; z: number } {
    const c = this.places.get(name) ?? this.square;
    for (let k = 0; k < 200; k++) {
      const a = seed * 2.39 + k * 1.7, r = r0 + ((seed * 37 + k * 13) % 100) / 100 * (r1 - r0);
      const x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r;
      if (this.free(x, z)) return { x, z };
    }
    return { ...c };
  }

  /** Dusk: tonight's story begins. Returns the intro (or null when the story is over). */
  startNight(shopAt: { x: number; z: number } | null): string | null {
    const n = this.cur; if (!n) return null;
    this.moved = false;
    this.phase = 'seek';
    this.piece = n.blackout && shopAt ? { ...shopAt } : this.spotNear(n.area, this.night + 1, n.final ? 150 : 40, n.final ? 260 : 110);
    this.place();
    return `${n.title}. ${n.intro}`;
  }

  private place() { this.mark.visible = true; this.mark.position.set(this.piece.x, this.heightAt(this.piece.x, this.piece.z), this.piece.z); }

  /** Each frame while a night is on. Returns a line to show, if something happened. */
  update(dt: number, cx: number, cz: number, min: number): { msg: string; big?: boolean; won?: boolean; lost?: boolean } | null {
    const n = this.cur; if (!n || !this.active) return null;
    this.mark.rotation.y += dt;
    const d = Math.hypot(this.piece.x - cx, this.piece.z - cz);
    // the trickster's trick: the first time you get close, the piece jumps away
    if (n.moves && !this.moved && this.phase === 'seek' && d < 25) {
      this.moved = true; this.piece = this.spotNear(n.area, this.night + 7, 120, 220); this.place();
      return { msg: 'Ha ha! The bhoot laughs in the fog. The piece is gone... there! Further up the hill. Follow the pin again.' };
    }
    // the market's piece fades at 11
    if (n.dueBy && this.phase === 'seek' && min >= n.dueBy && min < 24 * 60) return this.lose('Too late, baba. The piece faded away at 11. Tomorrow night, try again, and quicker.');
    // the last night: midnight is the end
    if (n.final && min < 6 * 60) return this.lose('Midnight struck, and the bell is still silent. The spirits win tonight. Come back tomorrow evening.');
    if (this.phase === 'seek' && d < (n.blackout ? 11 : 4.5)) {
      this.phase = 'carry'; this.piece = { ...this.square }; this.place();
      return { msg: n.final ? 'You have the bell! Down the hill to Church Square, quick, before midnight!' : `You have the piece! Now to Church Square, quick, before morning. ${this.night === 0 ? 'And keep looking at them!' : ''}`, big: true };
    }
    if (this.phase === 'carry' && d < 8) return this.win();
    return null;
  }

  private win() {
    const n = this.cur!;
    this.phase = 'won'; this.mark.visible = false; this.night++; this.save();
    if (n.final) return { msg: 'DONG... DONG... DONG! The bell rings out over Panjim. The spirits melt into the river mist, and the whole town comes out to see. Dev borem korum, baba! You saved Panjim.', big: true, won: true };
    return { msg: `Piece ${this.night} of 6 is back at the church! The bhoots slink off into the dark. Rest now, baba. Tomorrow night will be harder.`, big: true, won: true };
  }

  private lose(msg: string) { this.phase = 'lost'; this.mark.visible = false; return { msg, big: true, lost: true }; }

  /** Morning: an unfinished night is lost (and will be tried again). */
  endNight(): string | null {
    const was = this.active; if (this.phase !== 'waiting') this.phase = 'waiting';
    this.mark.visible = false;
    return was ? 'Morning came before you made it. Aay deva... Rest today. Tonight you try again.' : null;
  }

  get objective(): string {
    const n = this.cur;
    if (!n) return 'Panjim is safe. The bell rings every evening now.';
    if (this.phase === 'seek') return n.final ? 'Find the bell on Altinho' : n.blackout ? "Follow the lit street to Uncle's battery shop for the piece" : `Find the bell piece in ${n.area}: ${n.hint}`;
    if (this.phase === 'carry') return n.final ? 'Ring the bell at Church Square before midnight' : 'Carry the piece to Church Square before morning';
    if (this.phase === 'lost') return 'Lost tonight. Survive till morning, then try again';
    if (this.phase === 'won') return 'Night won! Wait for tomorrow night';
    return `${n.title} begins at dusk (press N to skip to night)`;
  }
}
