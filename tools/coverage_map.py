"""Builds coverage/index.html: the real map of Goa next to the game's map, to see how much of Goa is built so far.
Usage: python tools/coverage_map.py          (writes ../coverage/index.html next to the repo; open it in a browser)
Edit AREAS below as new parts of Goa are built."""
import json, math, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
d = json.load(open(ROOT / 'web/public/data/panjim.json', encoding='utf-8'))
lat0, lon0 = d['centre']; t = d['tile']; W, H = d['W'], d['H']
kx = 111320 * math.cos(math.radians(lat0)) / t; ky = 110540 / t
ll = lambda x, y: [round(lat0 - (y - H / 2) / ky, 5), round(lon0 + (x - W / 2) / kx, 5)]

# what is in the game: named places, landmarks, the famous places to eat, and Miramar (built at run time from the sand)
LM = {'church': 'Immaculate Conception Church', 'secretariat': 'Old Secretariat', 'mahalaxmi': 'Mahalaxmi Temple', 'atalsetu': 'Atal Setu', 'imb': 'Institute Menezes Braganza', 'postoffice': 'Head Post Office', 'maruti': 'Maruti Temple', 'sebastian': 'St. Sebastian Chapel', 'donbosco': 'Don Bosco', 'kadamba': 'Kadamba Bus Stand'}
pins = [{'n': n, 'k': 'place', 'x': x, 'y': y} for n, x, y in d['places']]
pins += [{'n': LM.get(l['name'], l['name']), 'k': 'landmark', 'x': l['at'][0][0], 'y': l['at'][0][1]} for l in d['lm']]
pins += [{'n': s[0], 'k': 'food', 'x': s[2], 'y': s[3]} for s in d.get('shops', []) if s[4]]
sand = [(x, y) for y in range(H) for x in range(30) if d['rows'][y][x] in 'SB']
if sand: pins.append({'n': 'Miramar', 'k': 'place', 'x': sum(p[0] for p in sand) / len(sand) + 0.5, 'y': sum(p[1] for p in sand) / len(sand) + 0.5})
for p in pins: p['ll'] = ll(p['x'], p['y'])

# Goa, area by area: done, in progress, or still to build (rough centres)
AREAS = [
    ('Panjim (city centre)', 15.4960, 73.8290, 'progress', 'Day 1'), ('Miramar', 15.4810, 73.8070, 'done', 'Day 2'),
    ('Fontainhas', 15.4985, 73.8335, 'progress', 'streets in, details to do'), ('Panjim Market', 15.4975, 73.8270, 'progress', ''),
    ('Altinho', 15.4930, 73.8300, 'progress', ''), ('Campal', 15.4950, 73.8150, 'progress', ''),
    ('Dona Paula', 15.4570, 73.8040, 'todo', ''), ('Old Goa', 15.5030, 73.9120, 'todo', ''), ('Porvorim', 15.5310, 73.8280, 'todo', ''),
    ('Mapusa', 15.5910, 73.8100, 'todo', ''), ('Calangute & Baga', 15.5440, 73.7550, 'todo', ''), ('Anjuna', 15.5740, 73.7400, 'todo', ''),
    ('Vasco', 15.3980, 73.8150, 'todo', ''), ('Margao', 15.2730, 73.9580, 'todo', ''), ('Colva', 15.2790, 73.9220, 'todo', ''),
    ('Palolem', 15.0100, 74.0230, 'todo', ''), ('Ponda', 15.4030, 74.0150, 'todo', ''),
]
data = {'W': W, 'H': H, 'rows': d['rows'], 'nw': ll(0, 0), 'se': ll(W, H), 'pins': pins,
        'areas': [{'n': a, 'll': [la, lo], 's': s, 'note': nt} for a, la, lo, s, nt in AREAS]}
roads = [[round(v, 1) for v in f] for f, w, *_ in d['r'] if w >= 5]

HTML = r"""<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Goa Build Map</title>
<style>
:root{--bg:#141019;--panel:#1e1824;--ink:#f3e6c4;--muted:#b9ab90;--gold:#f2c230;--maroon:#7a1e1e;--done:#3fbf6a;--prog:#f2c230;--todo:#8a7f99}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.4 Georgia,serif;height:100vh;display:flex;flex-direction:column}
header{padding:12px 16px;display:flex;flex-wrap:wrap;gap:8px 20px;align-items:baseline;border-bottom:1px solid #332a3a}
h1{margin:0;font-size:22px;color:var(--gold)}header span{color:var(--muted)}
.lg{display:flex;gap:14px;font-size:13px}.lg i{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:5px}
main{flex:1;display:grid;grid-template-columns:1fr 1fr;min-height:0}
section{position:relative;min-height:0;border-right:1px solid #332a3a;display:flex;flex-direction:column}
section h2{margin:0;padding:8px 14px;font-size:15px;color:var(--muted);font-weight:400;background:var(--panel)}
#realwrap{flex:1;position:relative;overflow:hidden}#real{position:absolute;inset:0;width:100%;height:100%}#gamewrap{flex:1;position:relative;overflow:hidden}#game{position:absolute;inset:0;width:100%;height:100%}
#tip{position:absolute;pointer-events:none;background:#000c;padding:3px 8px;border-radius:6px;font-size:13px;display:none}
@media (max-width:800px){main{grid-template-columns:1fr;grid-template-rows:1fr 1fr}}
</style></head><body>
<header><h1>Virtual Goa: what's built</h1><span id="stat"></span>
<div class="lg"><span><i style="background:var(--done)"></i>done</span><span><i style="background:var(--prog)"></i>in progress</span><span><i style="background:var(--todo)"></i>to build</span><span><i style="background:#4fc3f7"></i>in the game</span></div></header>
<main>
<section><h2>Goa · the gold box is the game's area (Panjim)</h2><div id="realwrap"><canvas id="real"></canvas><div id="tip2" style="position:absolute;pointer-events:none;background:#000c;padding:3px 8px;border-radius:6px;font-size:13px;display:none"></div></div></section>
<section><h2>The game's map (Panjim) · hover a pin</h2><div id="gamewrap"><canvas id="game"></canvas><div id="tip"></div></div></section>
</main>
<script>
const D = __DATA__, ROADS = __ROADS__, OUTLINE = __OUTLINE__;
const col = {done:'#3fbf6a', progress:'#f2c230', todo:'#8a7f99'};
document.getElementById('stat').textContent = `${D.areas.filter(a=>a.s==='done').length} done · ${D.areas.filter(a=>a.s==='progress').length} in progress · ${D.areas.filter(a=>a.s==='todo').length} to build · ${D.pins.length} places in the game`;
// Goa, drawn from its outline (OpenStreetMap boundary, saved with the tool): no map tiles needed
const rv=document.getElementById('real'), rw=document.getElementById('realwrap'), tip2=document.getElementById('tip2');
const LON0=73.66, LON1=74.35, LAT0=14.88, LAT1=15.82, KX=Math.cos(15.4*Math.PI/180);
let rk2=1, rox=0, roy=0, rhot=null;
const P=(lat,lon)=>[rox+(lon-LON0)*KX*rk2, roy+(LAT1-lat)*rk2];
function drawReal(){
  const w=rw.clientWidth,h=rw.clientHeight,dpr=devicePixelRatio||1; rv.width=w*dpr; rv.height=h*dpr; const c=rv.getContext('2d'); c.setTransform(dpr,0,0,dpr,0,0);
  rk2=Math.min(w/((LON1-LON0)*KX), h/(LAT1-LAT0)); rox=(w-(LON1-LON0)*KX*rk2)/2; roy=(h-(LAT1-LAT0)*rk2)/2;
  c.fillStyle='#1d4f6e'; c.fillRect(0,0,w,h);   // the Arabian Sea
  c.fillStyle='#3b5a34'; c.strokeStyle='#d9c28c'; c.lineWidth=1.5;
  for(const ring of OUTLINE){ c.beginPath(); ring.forEach(([lon,lat],i)=>{const [x,y]=P(lat,lon); i?c.lineTo(x,y):c.moveTo(x,y);}); c.closePath(); c.fill(); c.stroke(); }
  c.fillStyle='#9fb3c8'; c.font='italic 16px Georgia'; c.textAlign='center'; const [sx,sy]=P(15.2,73.78); c.fillText('Arabian Sea',sx,sy);
  // the game's area
  const [x0,y0]=P(D.nw[0],D.nw[1]), [x1,y1]=P(D.se[0],D.se[1]);
  c.fillStyle='rgba(242,194,48,.35)'; c.strokeStyle='#f2c230'; c.lineWidth=2; c.fillRect(x0,y0,Math.max(3,x1-x0),Math.max(3,y1-y0)); c.strokeRect(x0-4,y0-4,Math.max(3,x1-x0)+8,Math.max(3,y1-y0)+8);
  for(const a of D.areas){ const [x,y]=P(a.ll[0],a.ll[1]); c.fillStyle=col[a.s]; c.beginPath(); c.arc(x,y,a===rhot?8:6,0,7); c.fill(); c.strokeStyle='#000'; c.lineWidth=1.2; c.stroke(); }
  c.font='600 13px Georgia'; c.textAlign='left';
  const shown=new Set(); for(const a of D.areas){ if(a.s!=='todo' && !['Panjim (city centre)','Miramar'].includes(a.n)) continue; const [x,y]=P(a.ll[0],a.ll[1]); const ly=Math.round(y/14); if(shown.has(ly)) continue; shown.add(ly); c.strokeStyle='#000'; c.lineWidth=3; c.strokeText(a.n,x+9,y+4); c.fillStyle='#fff'; c.fillText(a.n,x+9,y+4); }
}
rv.addEventListener('mousemove', e=>{ const r=rv.getBoundingClientRect(), mx=e.clientX-r.left, my=e.clientY-r.top; let best=null, bd=150;
  for(const a of D.areas){ const [x,y]=P(a.ll[0],a.ll[1]); const dd=(x-mx)**2+(y-my)**2; if(dd<bd){bd=dd;best=a;} }
  if(best!==rhot){ rhot=best; drawReal(); }
  if(best){ tip2.style.display='block'; tip2.style.left=(mx+12)+'px'; tip2.style.top=(my+12)+'px'; tip2.innerHTML=`<b>${best.n}</b> · ${best.s==='done'?'done':best.s==='progress'?'in progress':'to build'}${best.note?' · '+best.note:''}`; } else tip2.style.display='none'; });
addEventListener('resize', drawReal); drawReal();
// the game's map, drawn from its tiles and streets
const cv = document.getElementById('game'), wrap = document.getElementById('gamewrap'), tip = document.getElementById('tip');
const TC = {W:'#2a6f97',G:'#6f9a52',F:'#3f6b3a',M:'#3c5a3a',S:'#d9c28c',B:'#d9c28c',L:'#86a663',R:'#9a8f80'};
let k=1, ox=0, oy=0, hot=null;
function draw(){
  const w=wrap.clientWidth, h=wrap.clientHeight, dpr=devicePixelRatio||1; cv.width=w*dpr; cv.height=h*dpr;
  const c=cv.getContext('2d'); c.setTransform(dpr,0,0,dpr,0,0);
  k=Math.min(w/D.W, h/D.H); ox=(w-D.W*k)/2; oy=(h-D.H*k)/2;
  c.fillStyle='#0d0a12'; c.fillRect(0,0,w,h);
  for(let y=0;y<D.H;y++) for(let x=0;x<D.W;x++){ c.fillStyle=TC[D.rows[y][x]]||'#6f9a52'; c.fillRect(ox+x*k,oy+y*k,k+0.6,k+0.6); }
  c.strokeStyle='#2b2b30'; c.lineWidth=Math.max(1,k*0.35); c.lineCap='round';
  for(const f of ROADS){ c.beginPath(); for(let i=0;i<f.length;i+=2){ const X=ox+f[i]*k, Y=oy+f[i+1]*k; i?c.lineTo(X,Y):c.moveTo(X,Y);} c.stroke(); }
  for(const p of D.pins){ const X=ox+p.x*k, Y=oy+p.y*k; c.fillStyle=p===hot?'#fff':p.k==='food'?'#f2c230':p.k==='landmark'?'#e05a4a':'#4fc3f7'; c.beginPath(); c.arc(X,Y,p===hot?6:4,0,7); c.fill(); c.strokeStyle='#000'; c.lineWidth=1; c.stroke(); }
  c.font='600 12px Georgia'; c.fillStyle='#fff'; c.textAlign='center';
  for(const p of D.pins) if(p.k==='place'){ c.strokeStyle='#000'; c.lineWidth=3; c.strokeText(p.n,ox+p.x*k,oy+p.y*k-8); c.fillText(p.n,ox+p.x*k,oy+p.y*k-8); }
}
cv.addEventListener('mousemove', e=>{
  const r=cv.getBoundingClientRect(), mx=e.clientX-r.left, my=e.clientY-r.top; let best=null, bd=144;
  for(const p of D.pins){ const dd=(ox+p.x*k-mx)**2+(oy+p.y*k-my)**2; if(dd<bd){bd=dd;best=p;} }
  if(best!==hot){ hot=best; draw(); }
  if(best){ tip.style.display='block'; tip.style.left=(mx+12)+'px'; tip.style.top=(my+12)+'px'; tip.textContent=best.n; } else tip.style.display='none';
});
addEventListener('resize', draw); draw();
</script></body></html>"""
out = ROOT.parent / 'coverage'; out.mkdir(exist_ok=True)
(out / 'index.html').write_text(HTML.replace('__DATA__', json.dumps(data, ensure_ascii=False)).replace('__ROADS__', json.dumps(roads)).replace('__OUTLINE__', (ROOT / 'tools/goa_outline.json').read_text()), encoding='utf-8')
print('wrote', out / 'index.html', len(pins), 'pins')
