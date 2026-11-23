// What's on in Goa: events, ads and stories, each a pin at its real place on the map. The lists are data
// (public/data/events.json and stories.json), so new ones go in without touching the game. Events show only while they are
// on or coming up in the next few weeks; stories stay.
import { T, type PanjimData } from '../world/data';

export interface GoaEvent {
  id: string; type: 'event' | 'ad' | 'story'; title: string; where: string; blurb: string; url?: string;
  /** A story: its full text (paragraphs split by blank lines), photos (paths under public/), and who shared it. */
  text?: string; photos?: string[]; by?: string;
  /** A name on the map (a place, a named building, a shop, a landmark), or lat/lon. */
  place?: string; lat?: number; lon?: number;
  from: string; to: string;                // dates, YYYY-MM-DD (inclusive)
  x: number; z: number;                    // world metres (filled in)
  on: boolean;                             // happening today
}

const DAY = 864e5, AHEAD = 35;             // days ahead to show upcoming events

function locate(d: PanjimData, e: Partial<GoaEvent>): { x: number; z: number } | null {
  if (e.place) {
    const n = e.place.toLowerCase(), eq = (s: string) => s.toLowerCase() === n;
    const p = d.places.find(q => eq(q[0])); if (p) return { x: p[1] * T, z: p[2] * T };
    const b = d.named?.find(q => eq(q[1])); if (b) return { x: b[2] * T, z: b[3] * T };
    const s = d.shops?.find(q => eq(q[0])); if (s) return { x: s[2] * T, z: s[3] * T };
    const l = d.lm.find(q => eq(q.name)); if (l) return { x: l.at[0][0] * T, z: l.at[0][1] * T };
  }
  if (e.lat !== undefined && e.lon !== undefined) {
    const [lat, lon] = d.centre, kx = 111320 * Math.cos(lat * Math.PI / 180) / T, ky = 110540 / T;
    const x = ((e.lon - lon) * kx + d.W / 2) * T, z = ((lat - e.lat) * ky + d.H / 2) * T;
    if (x > 0 && z > 0 && x < d.W * T && z < d.H * T) return { x, z };
  }
  return null;
}

export async function loadEvents(d: PanjimData, now = new Date()): Promise<GoaEvent[]> {
  let raw: Partial<GoaEvent>[] = [];
  try { const r = await fetch(`${import.meta.env.BASE_URL}data/events.json`, { cache: 'no-cache' }); if (r.ok) raw = await r.json(); } catch { /* no events today */ }
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const out: GoaEvent[] = [];
  for (const e of raw) {
    const from = Date.parse(e.from + 'T00:00:00'), to = Date.parse(e.to + 'T00:00:00');
    if (!(to >= today && from <= today + AHEAD * DAY)) continue;
    const at = locate(d, e); if (!at) continue;
    out.push({ ...(e as GoaEvent), ...at, on: from <= today });
  }
  out.sort((a, b) => Number(b.on) - Number(a.on) || a.from.localeCompare(b.from));
  // stories: no dates, they stay on the map
  let st: Partial<GoaEvent>[] = [];
  try { const r = await fetch(`${import.meta.env.BASE_URL}data/stories.json`, { cache: 'no-cache' }); if (r.ok) st = await r.json(); } catch { /* none yet */ }
  for (const e of st) { const at = locate(d, e); if (at) out.push({ ...(e as GoaEvent), from: e.from ?? '', to: e.to ?? '', type: 'story', ...at, on: true }); }
  return out;
}

const fmt = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
export function when(e: GoaEvent): string {
  if (e.type === 'ad') return 'Sponsored';
  if (e.type === 'story') return e.by ? `Shared by ${e.by}` : 'A story';
  const span = e.from === e.to ? fmt(e.from) : `${fmt(e.from)} – ${fmt(e.to)}`;
  return e.on ? `On now · ${span}` : span;
}
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/** The card for one pin: what, where, when, and the ways to get there. */
export class EventCard {
  private el: HTMLDivElement;
  constructor(private guide: (e: GoaEvent) => void, private travel: (e: GoaEvent) => void, private onClose: () => void) {
    this.el = document.createElement('div'); this.el.id = 'evcard';
    this.el.style.cssText = 'position:fixed;left:50%;bottom:14px;transform:translateX(-50%);width:min(92vw,420px);z-index:40;display:none;background:rgba(14,20,36,.96);border:1px solid rgba(236,228,207,.3);border-radius:12px;padding:12px 14px;color:#ece4cf;font:14px Mukta,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.5)';
    document.body.appendChild(this.el);
  }
  get open() { return this.el.style.display !== 'none'; }
  show(e: GoaEvent) {
    const col = e.type === 'ad' ? '#f2c230' : e.type === 'story' ? '#5fd8c8' : '#ff5fa2';
    this.el.innerHTML = `<button data-x style="position:absolute;right:8px;top:6px;background:none;border:0;color:#ece4cf;font-size:18px;cursor:pointer" aria-label="Close">✕</button>
      <div style="color:${col};font-weight:700;font-size:12px;letter-spacing:.04em;text-transform:uppercase">${e.type === 'ad' ? 'Ad' : e.type === 'story' ? 'Story' : 'Event'} · ${esc(when(e))}</div>
      <div style="font-size:18px;font-weight:700;line-height:1.25;margin:2px 24px 2px 0">${esc(e.title)}</div>
      <div style="color:#9a9484;font-size:13px">📍 ${esc(e.where)}</div>
      <div style="margin:6px 0 10px;color:#cfc8b4">${esc(e.blurb)}</div>
      ${e.type === 'story' && (e.text || e.photos?.length) ? `<div data-full style="display:none;max-height:42vh;overflow:auto;margin:0 0 10px;color:#ece4cf;line-height:1.5">${(e.photos ?? []).map(p => `<img src="${esc(import.meta.env.BASE_URL + p)}" alt="" style="width:100%;border-radius:8px;margin:4px 0">`).join('')}${(e.text ?? '').split(/\n\s*\n/).map(t => `<p style="margin:6px 0">${esc(t)}</p>`).join('')}</div>` : ''}
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${e.type === 'story' && (e.text || e.photos?.length) ? `<button data-r style="font:600 13px Mukta,sans-serif;color:#0a1020;background:#5fd8c8;border:0;border-radius:999px;padding:6px 14px;cursor:pointer">Read the story</button>` : ''}
        <button data-g style="font:600 13px Mukta,sans-serif;color:#0a1020;background:#9fe8d6;border:0;border-radius:999px;padding:6px 14px;cursor:pointer">Guide me</button>
        <button data-t style="font:600 13px Mukta,sans-serif;color:#ece4cf;background:none;border:1px solid rgba(236,228,207,.4);border-radius:999px;padding:6px 14px;cursor:pointer">Take a pilot ›</button>
        ${e.url ? `<a href="${esc(e.url)}" target="_blank" rel="noopener" style="color:#f2b441;align-self:center;font-size:13px">More info ↗</a>` : ''}
      </div>`;
    this.el.style.display = 'block';
    this.el.querySelector('[data-x]')!.addEventListener('click', () => this.hide());
    this.el.querySelector('[data-r]')?.addEventListener('click', ev => { const f = this.el.querySelector<HTMLElement>('[data-full]')!; const open = f.style.display === 'none'; f.style.display = open ? 'block' : 'none'; (ev.currentTarget as HTMLElement).textContent = open ? 'Hide the story' : 'Read the story'; });
    this.el.querySelector('[data-g]')!.addEventListener('click', () => { this.hide(); this.guide(e); });
    this.el.querySelector('[data-t]')!.addEventListener('click', () => { this.hide(); this.travel(e); });
  }
  hide() { if (!this.open) return; this.el.style.display = 'none'; this.onClose(); }
}
