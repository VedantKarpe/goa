// "Share your story": how a café, a homestay, a shop or anyone with a story about a place in Goa reaches us. Nothing is
// posted from the game: they send it to us, we read it, and the ones we add get a pin, a plaque and one day a quest.

/** Where people send their stories (an Instagram handle, without the @). Empty: the panel says to DM the page. */
export const SHARE_IG = 'goabuilder';

export function setupShare(button: HTMLElement) {
  const el = document.createElement('div'); el.id = 'share';
  el.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:min(92vw,440px);max-height:86vh;overflow:auto;z-index:45;display:none;background:rgba(14,20,36,.97);border:1px solid rgba(95,216,200,.5);border-radius:14px;padding:16px 18px;color:#ece4cf;font:15px/1.5 Mukta,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.55)';
  const ig = SHARE_IG ? `https://ig.me/m/${SHARE_IG}` : '';
  el.innerHTML = `<button data-x style="position:absolute;right:10px;top:8px;background:none;border:0;color:#ece4cf;font-size:20px;cursor:pointer" aria-label="Close">✕</button>
    <div style="color:#5fd8c8;font-weight:700;font-size:12px;letter-spacing:.05em;text-transform:uppercase">Share your story</div>
    <div style="font-size:21px;font-weight:700;line-height:1.25;margin:2px 24px 8px 0">Own a place in Goa, or know its story?</div>
    <div style="color:#cfc8b4">A café, a homestay, a shop, a chapel, a family recipe: send us its story and we'll build it into virtual Goa. A pin on the map, a plaque at the real spot, and one day a little quest that brings players to your door.</div>
    <div style="margin:12px 0 4px;font-weight:700">Please send us</div>
    <ul style="margin:0 0 10px;padding-left:20px;color:#cfc8b4">
      <li>The place: its name, or a Google Maps pin</li>
      <li>A title and a few lines: what makes it special</li>
      <li>Up to 3 photos you took yourself</li>
      <li>Your name (as you'd like it shown) and a link, if you have one</li>
    </ul>
    <div style="color:#9a9484;font-size:13px;margin-bottom:12px">We read every story ourselves before anything goes up. Ads and events are welcome too.</div>
    ${ig ? `<a href="${ig}" target="_blank" rel="noopener" style="display:inline-block;font:700 15px Mukta,sans-serif;color:#0a1020;background:#5fd8c8;border-radius:999px;padding:8px 18px;text-decoration:none">Message @goabuilder on Instagram ↗</a>`
         : `<div style="font-weight:700;color:#f2b441">Please DM us on Instagram.</div>`}`;
  document.body.appendChild(el);
  const close = () => { el.style.display = 'none'; };
  el.querySelector('[data-x]')!.addEventListener('click', close);
  button.addEventListener('click', e => { (e.currentTarget as HTMLElement).blur(); el.style.display = el.style.display === 'none' ? 'block' : 'none'; });
  addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
}
