// The Goa passport: a stamp for every place visited and every good turn done (helping someone, befriending a dog,
// driving, the jet ski...). For this visit only (the game keeps no saved progress). New stamps pop up as they come.
export interface Stamp { id: string; name: string; icon: string; kind: 'place' | 'deed'; got: boolean }

const DEEDS: [string, string, string][] = [
  ['help1', 'Helped someone', '🤝'], ['help3', 'Helped three people', '🏅'], ['dog', 'Made a dog friend', '🐕'],
  ['drive', 'Drove a car', '🚗'], ['auto', 'Took an auto drive', '🗺️'], ['beach', 'Pushed a car out of the sand', '🏖️'],
  ['jetski', 'Rode a jet ski', '🛥️'], ['night', 'Out at night', '🌙'], ['assistant', 'Met a sales assistant', '₹'], ['story', 'Read a story', '✎'],
];

export class Passport {
  stamps: Stamp[] = [];
  private panel = document.createElement('div');
  private toastEl = document.createElement('div');
  onNew: (s: Stamp) => void = () => {};

  constructor(places: string[]) {
    for (const p of places) this.stamps.push({ id: 'p:' + p, name: p, icon: '📍', kind: 'place', got: false });
    for (const [id, name, icon] of DEEDS) this.stamps.push({ id, name, icon, kind: 'deed', got: false });
    this.panel.id = 'passport'; document.body.appendChild(this.panel);
    this.toastEl.id = 'stampToast'; document.body.appendChild(this.toastEl);
  }

  get count() { return this.stamps.filter(s => s.got).length; }

  /** Earn a stamp (once). */
  give(id: string) {
    const s = this.stamps.find(q => q.id === id); if (!s || s.got) return;
    s.got = true;
    this.toastEl.innerHTML = `<i>${s.icon}</i><span><b>New stamp!</b>${s.name}</span>`;
    this.toastEl.classList.remove('on'); void this.toastEl.offsetWidth; this.toastEl.classList.add('on');
    this.onNew(s);
    if (this.panel.classList.contains('open')) this.render();
  }

  toggle() { if (this.panel.classList.toggle('open')) this.render(); }
  close() { this.panel.classList.remove('open'); }

  private render() {
    const cell = (s: Stamp) => `<div class="st${s.got ? ' got' : ''}" title="${s.name}"><i>${s.got ? s.icon : '?'}</i><span>${s.name}</span></div>`;
    const deeds = this.stamps.filter(s => s.kind === 'deed'), places = this.stamps.filter(s => s.kind === 'place');
    this.panel.innerHTML = `<div class="ph"><h2>🛂 My Goa passport</h2><span>${this.count} of ${this.stamps.length} stamps · this visit</span><button class="x" aria-label="Close">✕</button></div>
      <div class="pl"><div class="sec">Good turns · ${deeds.filter(s => s.got).length}/${deeds.length}</div><div class="grid">${deeds.map(cell).join('')}</div>
      <div class="sec">Places visited · ${places.filter(s => s.got).length}/${places.length}</div><div class="grid">${places.map(cell).join('')}</div></div>`;
    this.panel.querySelector('.x')!.addEventListener('click', () => this.close());
  }
}
