"""Fetch a rectangle of Goa for the three.js map: OpenStreetMap features and SRTM heights.

    python tools/fetch_region.py NAME SOUTH WEST NORTH EAST

Writes data/NAME.osm.json (the same features tools/osm_import.py fetches) and data/NAME.elev.json (SRTM 30 m from
OpenTopoData on a ~140 m grid, rows south to north, the format tools/mock_real.py reads).
Map data (c) OpenStreetMap contributors (ODbL). Elevation: SRTM via OpenTopoData.
"""
import json, pathlib, subprocess, sys, time
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from osm_import import overpass, DATA

name, s, w, n, e = sys.argv[1], *map(float, sys.argv[2:6])
b = f'({s},{w},{n},{e})'
q = (f'[out:json][timeout:300];(way["highway"]{b};way["building"]{b};nwr["landuse"]{b};nwr["natural"]{b};'
     f'nwr["waterway"]{b};nwr["amenity"]{b};nwr["highway"="bus_stop"]{b};nwr["place"]{b};nwr["shop"]{b};nwr["historic"]{b};'
     f'nwr["tourism"]{b};nwr["leisure"]{b};nwr["man_made"]{b};);out geom;')
out = DATA / f'{name}.osm.json'
if not out.exists():
    d = overpass(q); out.write_text(json.dumps(d), encoding='utf-8', newline=chr(10)); print(f'{len(d["elements"])} OSM elements -> {out.name}')

step = 0.0013
nx, ny = int(round((e - w) / step)) + 1, int(round((n - s) / step)) + 1
pts = [(s + (n - s) * j / (ny - 1), w + (e - w) * i / (nx - 1)) for j in range(ny) for i in range(nx)]
elev = []
for k in range(0, len(pts), 100):
    locs = '|'.join(f'{la:.5f},{lo:.5f}' for la, lo in pts[k:k + 100])
    for attempt in range(5):
        r = subprocess.run(['curl', '-s', '-m', '60', '-A', 'rakhondar-game-dev/0.1', f'https://api.opentopodata.org/v1/srtm30m?locations={locs}'], capture_output=True, text=True).stdout
        try:
            elev += [max(0.0, x['elevation'] or 0.0) for x in json.loads(r)['results']]; break
        except Exception:
            time.sleep(3)
    else: sys.exit(f'elevation request failed: {r[:200]}')
    time.sleep(1.1)
(DATA / f'{name}.elev.json').write_text(json.dumps({'bbox': [s, n, w, e], 'nx': nx, 'ny': ny, 'elev': elev}), encoding='utf-8')
print(f'{nx}x{ny} heights -> {name}.elev.json')
