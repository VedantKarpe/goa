"""Adds Panjim's named shops and its famous places to eat (from OpenStreetMap) to web/public/data/panjim.json.
Usage: python tools/export_shops.py OSM_JSON   (an Overpass 'out center' result for shop / restaurant / cafe / bar)"""
import json, math, sys
FAMOUS = ['ritz classic', 'viva panjim', 'venite', "mum's kitchen", 'kokni kanteen', 'george restaurant', 'horse shoe',
          'vihar', 'anand', "fisherman's wharf", 'upper house', 'quarterdeck', 'goenchin', 'kamat', 'cafe tato',
          'clube nacional', 'bhonsle', 'confeitaria', 'mr. baker', 'cafe real', 'hospedaria venite', 'cafe central']
d = json.load(open('web/public/data/panjim.json', encoding='utf-8'))
lat, lon = d['centre']; t = d['tile']; W, H = d['W'], d['H']
kx = 111320 * math.cos(math.radians(lat)) / t; ky = 110540 / t
out, seen = [], set()
for e in json.load(open(sys.argv[1], encoding='utf-8'))['elements']:
    tg = e['tags']; c = e.get('center') or e
    if 'lat' not in c: continue
    name = tg['name'].strip(); kind = tg.get('shop') or tg.get('amenity')
    x, y = (c['lon'] - lon) * kx + W / 2, (lat - c['lat']) * ky + H / 2
    if not (0 <= x < W and 0 <= y < H) or (name.lower(), round(x), round(y)) in seen: continue
    seen.add((name.lower(), round(x), round(y)))
    food = kind in ('restaurant', 'cafe', 'bar', 'fast_food', 'bakery')
    famous = food and any(f in name.lower() for f in FAMOUS)
    if food and not famous: continue                     # only the famous places to eat; every named shop
    out.append([name, kind, round(x, 2), round(y, 2), 1 if famous else 0])
d['shops'] = out
json.dump(d, open('web/public/data/panjim.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(len(out), 'shops,', sum(s[4] for s in out), 'famous:', [s[0] for s in out if s[4]])
