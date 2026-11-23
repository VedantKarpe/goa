// The first minute, for someone new: a short guided start (walk, say hello, feed a dog, drive), one step at a time in a
// card at the top, with a Skip. And the joystick shown on phones until the player has got the hang of walking.
// Remembered on this device only (whether the guide was done, whether the joystick is known): a preference, not
// saved progress.
const KEY_DONE = 'vg_guide_done', KEY_STICK = 'vg_stick_known';
const get = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const put = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };

export type Step = 'walk' | 'talk' | 'feed' | 'drive' | 'done';
const TOUCH = matchMedia('(pointer: coarse)').matches;

const TEXT: Record<Exclude<Step, 'done'>, string> = {
  walk: TOUCH ? 'Drag the joystick to walk around' : 'Walk around with W A S D (or the arrow keys)',
  talk: 'Tap the 💬 over someone to say hello',
  feed: 'Find a street dog and tap 🍪 to feed it a biscuit',
  drive: 'Tap 🚗 by a parked car to drive it. Then pick a place in What\'s on and press Auto drive!',
};

export class Guide {
  step: Step = get(KEY_DONE) ? 'done' : 'walk';
  private card = document.createElement('div');
  private ghost = document.createElement('div');
  private walked = 0;
  private stickKnown = !!get(KEY_STICK);
  onDone: () => void = () => {};

  constructor() {
    this.card.id = 'guide';
    document.body.appendChild(this.card);
    // the joystick, shown where the thumb goes, until the player knows it
    this.ghost.id = 'stickGhost'; this.ghost.innerHTML = '<i></i><span>drag to walk</span>';
    document.body.appendChild(this.ghost);
    this.render();
  }

  private render() {
    this.ghost.style.display = TOUCH && !this.stickKnown ? 'block' : 'none';
    if (this.step === 'done') { this.card.style.display = 'none'; return; }
    const n = ['walk', 'talk', 'feed', 'drive'].indexOf(this.step) + 1;
    this.card.style.display = 'flex';
    this.card.innerHTML = `<b>${n}/4</b><span>${TEXT[this.step]}</span><button aria-label="Skip the guide">Skip</button>`;
    this.card.querySelector('button')!.addEventListener('click', () => this.finish());
  }

  /** Something happened: move the guide on if it was the step's goal. */
  did(what: Step) {
    const order: Step[] = ['walk', 'talk', 'feed', 'drive', 'done'];
    if (this.step === 'done' || order.indexOf(what) < order.indexOf(this.step)) return;
    this.step = order[order.indexOf(what) + 1];   // doing a later step first moves the guide on past it
    if (this.step === 'done') this.finish(); else this.render();
  }

  /** Each frame while walking: after a few seconds the walk step is done; after longer, the joystick is known. */
  walking(dt: number) {
    this.walked += dt;
    if (this.walked > 2.5) this.did('walk');
    if (!this.stickKnown && this.walked > 12) { this.stickKnown = true; put(KEY_STICK, '1'); this.render(); }
  }

  private finish() {
    this.step = 'done'; put(KEY_DONE, '1'); this.render(); this.onDone();
  }
}
