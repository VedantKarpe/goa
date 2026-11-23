// The loading screen: the game's name over a Goan sunset, a progress bar that fills as the map downloads and the town
// is built (roads, houses, trees, people), and a Goan line or two to read while it loads.
const TIPS = [
  'Feed a street dog three biscuits and it is your friend for the day.',
  'Stand by any parked car and press Drive. Watch out for the rental Thars!',
  'Tap the little map to see what is on in Goa.',
  'Talk to the people with a ! over their heads: they need a hand.',
  'Old Goa is far, baba. Take a car, or a pilot.',
  'Own a café or a homestay? Share its story with @goabuilder.',
];

let bar: HTMLElement | null = null, label: HTMLElement | null = null, tipT = 0;

export function showLoader() {
  const el = document.getElementById('loading'); if (!el) return;
  el.innerHTML = `<div style="text-align:center;width:min(86vw,420px)">
      <div style="font:700 clamp(34px,9vw,52px)/1.05 Georgia,serif;color:#fff4d8;letter-spacing:.01em;text-shadow:0 3px 18px rgba(0,0,0,.35)">Virtual Goa</div>
      <div style="margin:8px 0 26px;color:#f6d9a8;font-size:14px;letter-spacing:.06em">PANJIM · MIRAMAR · DONA PAULA · OLD GOA</div>
      <div style="height:10px;border-radius:999px;background:rgba(255,244,216,.18);overflow:hidden;box-shadow:inset 0 1px 3px rgba(0,0,0,.3)"><i id="ldBar" style="display:block;height:100%;width:2%;border-radius:999px;background:linear-gradient(90deg,#f2c230,#ff8a3d);transition:width .35s ease"></i></div>
      <div id="ldLabel" style="margin-top:12px;color:#fff4d8;font-size:15px">Fetching the map of Goa…</div>
      <div id="ldTip" style="margin-top:28px;color:#f6d9a8;font-size:13.5px;line-height:1.45;min-height:40px;opacity:.9"></div>
    </div>`;
  el.style.background = 'linear-gradient(180deg,#24305e 0%,#7a3b5e 48%,#e07a4a 78%,#f2b441 100%)';
  bar = document.getElementById('ldBar'); label = document.getElementById('ldLabel');
  const tip = document.getElementById('ldTip')!;
  let i = Math.floor(Math.random() * TIPS.length);
  const next = () => { tip.textContent = '💡 ' + TIPS[i++ % TIPS.length]; };
  next(); tipT = window.setInterval(next, 3500);
}

/** Move the bar (0 to 100) and say what is happening; gives the page a moment to draw it before the next heavy step. */
export async function loaderStep(pct: number, text?: string) {
  if (bar) bar.style.width = `${Math.max(2, Math.min(100, pct))}%`;
  if (text && label) label.textContent = text;
  // a frame to draw the bar; but never wait on it (a tab in the background draws no frames, and would never load)
  await new Promise<void>(r => { let done = false; const go = () => { if (!done) { done = true; r(); } }; requestAnimationFrame(() => setTimeout(go, 0)); setTimeout(go, 50); });
}

/** Just the bar (while downloading: no pause). */
export function loaderBar(pct: number) { if (bar) bar.style.width = `${Math.max(2, Math.min(100, pct))}%`; }

export function hideLoader() {
  clearInterval(tipT);
  const el = document.getElementById('loading'); if (!el) return;
  el.style.transition = 'opacity .5s'; el.style.opacity = '0'; el.style.pointerEvents = 'none';
  setTimeout(() => el.remove(), 550);
}
