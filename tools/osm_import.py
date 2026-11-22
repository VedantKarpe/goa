"""Turn a real Goan village from OpenStreetMap into a Rakhondar map.

    python tools/osm_import.py fetch NAME LAT LON [--radius 0.007]
    python tools/osm_import.py sights NAME LAT LON [--radius 0.012]
    python tools/osm_import.py survey NAME
    python tools/osm_import.py build NAME LAT LON [--tile 12] [--size 96x80] [--inline rakhondar.html] [--anchor kind=lat,lon[,name]]

`fetch` downloads everything around the point once and caches it in data/NAME.osm.json.
`survey` lists the places of worship, ferry points and bus stops in the cache, to pick a centre.
`build` rasterises the cache onto the game's tile grid (--size, default 96x80) (x east, y south) and writes
data/NAME.map.json; with --inline it also replaces the VILLAGE block inside the game file.

Map data (c) OpenStreetMap contributors, available under the Open Database License (ODbL).
"""
import argparse, json, math, pathlib, re, subprocess, sys, time

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / 'data'
W, H = 96, 80   # must match W and H in rakhondar.html
ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter',
             'https://overpass.private.coffee/api/interpreter']


def overpass(query):
    wait = 5
    for attempt in range(8):
        for ep in ENDPOINTS:
            out = subprocess.run(['curl', '-s', '-m', '180', '-A', 'rakhondar-game-dev/0.1', '--data-urlencode', 'data=' + query, ep],
                                 capture_output=True, text=True, encoding='utf-8').stdout
            if out.lstrip().startswith('{'):
                return json.loads(out)
        print(f'  Overpass busy, retrying in {wait}s', file=sys.stderr)
        time.sleep(wait)
        wait = min(wait * 2, 60)
    sys.exit('Overpass did not answer; try again later.')


def fetch(name, lat, lon, radius):
    b = f'({lat - radius},{lon - radius * 1.04},{lat + radius},{lon + radius * 1.04})'
    q = (f'[out:json][timeout:150];(way["highway"]{b};way["building"]{b};nwr["landuse"]{b};nwr["natural"]{b};'
         f'nwr["waterway"]{b};nwr["amenity"]{b};nwr["highway"="bus_stop"]{b};nwr["place"]{b};);out geom;')
    d = overpass(q)
    DATA.mkdir(exist_ok=True)
    (DATA / f'{name}.osm.json').write_text(json.dumps(d), encoding='utf-8', newline=chr(10))
    print(f'{len(d["elements"])} elements cached in data/{name}.osm.json')


def sights_fetch(name, lat, lon, radius):
    """Monuments, museums, viewpoints and other places a visitor would look for, cached in data/NAME.sights.json."""
    b = f'({lat - radius},{lon - radius * 1.04},{lat + radius},{lon + radius * 1.04})'
    q = (f'[out:json][timeout:120];(nwr["historic"]{b};nwr["tourism"~"attraction|museum|viewpoint|artwork|gallery"]{b};'
         f'nwr["leisure"="park"]["name"]{b};);out center tags;')
    d = overpass(q)
    (DATA / f'{name}.sights.json').write_text(json.dumps(d), encoding='utf-8', newline=chr(10))
    print(f'{len(d["elements"])} sights cached in data/{name}.sights.json')


def load(name):
    return json.loads((DATA / f'{name}.osm.json').read_text(encoding='utf-8'))['elements']


def centre(e):
    if 'lat' in e:
        return e['lat'], e['lon']
    g = e.get('geometry') or []
    if g:
        return sum(p['lat'] for p in g) / len(g), sum(p['lon'] for p in g) / len(g)
    b = e.get('bounds')
    return ((b['minlat'] + b['maxlat']) / 2, (b['minlon'] + b['maxlon']) / 2) if b else (None, None)


def kind_of(t):
    if t.get('amenity') == 'place_of_worship':
        return {'hindu': 'temple', 'christian': 'chapel'}.get(t.get('religion'), 'worship')
    if t.get('amenity') == 'ferry_terminal':
        return 'ferry'
    if t.get('highway') == 'bus_stop' or t.get('amenity') == 'bus_station':
        return 'bus'
    if 'place' in t:
        return 'place'
    return None


def survey(name):
    for e in load(name):
        k = kind_of(e.get('tags', {}))
        if k:
            la, lo = centre(e)
            t = e['tags']
            print(f'{k:8s} {la:.5f} {lo:.5f}  {t.get("name", "")} {t.get("name:en", "")}')


def build(name, lat, lon, tile, inline, pins=()):
    kx = 111320 * math.cos(math.radians(lat)) / tile
    ky = 110540 / tile

    def xy(la, lo):
        return (lo - lon) * kx + W / 2, (lat - la) * ky + H / 2

    grid = [['G'] * W for _ in range(H)]

    def paint_poly(rings_, ch):
        """Even-odd scanline fill over every ring at once, so inner rings (islands in a river) stay holes."""
        rings_ = [r for r in rings_ if len(r) >= 3]
        if not rings_:
            return
        ys = [p[1] for r in rings_ for p in r]
        for ty in range(max(0, int(min(ys))), min(H, int(max(ys)) + 1)):
            cy = ty + 0.5
            xs = []
            for pts in rings_:
                for (x1, y1), (x2, y2) in zip(pts, pts[1:] + pts[:1]):
                    if (y1 <= cy < y2) or (y2 <= cy < y1):
                        xs.append(x1 + (cy - y1) * (x2 - x1) / (y2 - y1))
            xs.sort()
            for a, b in zip(xs[::2], xs[1::2]):
                for tx in range(max(0, math.ceil(a - 0.5)), min(W, math.floor(b - 0.5) + 1)):
                    grid[ty][tx] = ch

    def paint_line(pts, width, ch, keep=()):
        r = width / 2
        for (x1, y1), (x2, y2) in zip(pts, pts[1:]):
            for ty in range(max(0, int(min(y1, y2) - r - 1)), min(H, int(max(y1, y2) + r + 2))):
                for tx in range(max(0, int(min(x1, x2) - r - 1)), min(W, int(max(x1, x2) + r + 2))):
                    px, py = tx + 0.5, ty + 0.5
                    dx, dy = x2 - x1, y2 - y1
                    L = dx * dx + dy * dy or 1e-9
                    u = max(0, min(1, ((px - x1) * dx + (py - y1) * dy) / L))
                    if math.hypot(px - x1 - u * dx, py - y1 - u * dy) <= r and grid[ty][tx] not in keep:
                        grid[ty][tx] = ch

    els = load(name)
    geo = lambda e: [xy(p['lat'], p['lon']) for p in e.get('geometry') or [] if p]

    def rings(e):
        """Closed outlines of an area: a closed way, or a multipolygon's members (outer and inner) stitched end to end."""
        if e['type'] == 'way':
            return [geo(e)]
        parts = [[xy(p['lat'], p['lon']) for p in m.get('geometry') or [] if p]
                 for m in e.get('members', []) if m.get('type') == 'way' and m.get('role', 'outer') in ('outer', 'inner', '')]
        parts = [p for p in parts if len(p) > 1]
        out = []
        while parts:
            ring = parts.pop(0)
            grown = True
            while grown and ring[0] != ring[-1]:
                grown = False
                for i, p in enumerate(parts):
                    if p[0] == ring[-1]: ring += p[1:]
                    elif p[-1] == ring[-1]: ring += p[-2::-1]
                    elif p[-1] == ring[0]: ring = p[:-1] + ring
                    elif p[0] == ring[0]: ring = p[:0:-1] + ring
                    else: continue
                    parts.pop(i); grown = True; break
            out.append(ring)
        return out

    def area(e, ch):
        paint_poly(rings(e), ch)

    # paint in layers: fields (khazan farmland counts, even when also tagged wetland), mangroves, water, then roads on top
    tagged = lambda e: e.get('tags', {})
    for e in els:
        t = tagged(e)
        if (t.get('landuse') in ('farmland', 'paddy', 'meadow') or t.get('crop') == 'rice') and t.get('wetland') != 'mangrove':
            area(e, 'P')
    for e in els:
        t = tagged(e)
        if t.get('landuse') == 'forest' or t.get('natural') in ('wood', 'scrub'):
            area(e, 'F')
    for e in els:
        t = tagged(e)
        if t.get('wetland') == 'mangrove' or (t.get('natural') == 'wetland' and t.get('landuse') != 'farmland'):
            area(e, 'M')
    for e in els:
        t = tagged(e)
        if t.get('natural') == 'water' or t.get('waterway') in ('riverbank', 'dock'):
            area(e, 'W')
        if t.get('waterway') in ('river', 'canal', 'stream', 'drain', 'ditch', 'tidal_channel') and e['type'] == 'way':
            w = {'river': float(t.get('width', 40)), 'canal': 12, 'stream': 5, 'tidal_channel': 8}.get(t['waterway'], 3) / tile
            paint_line(geo(e), max(1.2, w), 'W')
    # beaches, then the sea: OSM draws the coastline with land on the left, so the sea starts on its right
    for e in els:
        if tagged(e).get('natural') == 'beach':
            area(e, 'B')
    coast = [geo(e) for e in els if tagged(e).get('natural') == 'coastline' and e['type'] == 'way']
    for pts in coast:
        paint_line(pts, 1.4, 'C')
    seeds = []
    for pts in coast:
        for (x1, y1), (x2, y2) in zip(pts, pts[1:]):
            L = math.hypot(x2 - x1, y2 - y1) or 1
            seeds.append((int((x1 + x2) / 2 - (y2 - y1) / L * 2.5), int((y1 + y2) / 2 + (x2 - x1) / L * 2.5)))
    stack = [s_ for s_ in seeds if 0 <= s_[0] < W and 0 <= s_[1] < H]
    # where the coastline does not close inside the map (a big region), the fill would run round its ends and over the
    # land: with heights at hand (data/NAME.elev.json), the sea never spreads onto ground above 1.5 m
    ep = DATA / f'{name}.elev.json'; high = lambda x, y: False
    if ep.exists():
        EL = json.loads(ep.read_text()); s0, n0, w0, e0 = EL['bbox']; enx, eny, ev = EL['nx'], EL['ny'], EL['elev']
        def high(x, y):
            la, lo = lat - (y + 0.5 - H / 2) / ky, lon + (x + 0.5 - W / 2) / kx
            fx = max(0, min(enx - 1.001, (lo - w0) / (e0 - w0) * (enx - 1))); fy = max(0, min(eny - 1.001, (la - s0) / (n0 - s0) * (eny - 1)))
            i, j = int(fx), int(fy); tx, ty = fx - i, fy - j; v = lambda a, b2: ev[(j + b2) * enx + i + a]
            return (v(0, 0) * (1 - tx) + v(1, 0) * tx) * (1 - ty) + (v(0, 1) * (1 - tx) + v(1, 1) * tx) * ty > 1.5
    # a big region: join the coastline into chains; a chain that enters and leaves the map is closed round a big box on
    # the side where the buildings are, giving the exact land outline; every cell outside it is sea (no flood, no guess)
    land_rings = []
    if ep.exists():
        chains = [list(c) for c in coast if len(c) > 1]
        joined = True
        while joined:
            joined = False
            for i in range(len(chains)):
                for j in range(len(chains)):
                    if i != j and chains[i] and chains[j] and math.hypot(chains[i][-1][0] - chains[j][0][0], chains[i][-1][1] - chains[j][0][1]) < 0.05:
                        chains[i] += chains[j][1:]; chains[j] = []; joined = True
            chains = [c for c in chains if c]
        out_ = lambda q: not (0 <= q[0] < W and 0 <= q[1] < H)
        M_ = 2000
        corners = [(-M_, -M_), (W + M_, -M_), (W + M_, H + M_), (-M_, H + M_)]   # clockwise on screen (y down)
        def proj(q):
            x, y = q; d = [(abs(x + M_), 3, (-M_, y)), (abs(y + M_), 0, (x, -M_)), (abs(W + M_ - x), 1, (W + M_, y)), (abs(H + M_ - y), 2, (x, H + M_))]
            d.sort(); return d[0][1], d[0][2]      # side index: 0 top, 1 right, 2 bottom, 3 left (clockwise), point on it
        blds = [centre(e) for e in els if tagged(e).get('building') and e['type'] == 'way']
        blds = [xy(la, lo) for la, lo in blds if la]
        def inside(rings_, x, y):
            c = False
            for r in rings_:
                for (x1, y1), (x2, y2) in zip(r, r[1:] + r[:1]):
                    if (y1 > y) != (y2 > y) and x < x1 + (y - y1) * (x2 - x1) / (y2 - y1): c = not c
            return c
        for c in chains:
            if c[0] == c[-1]:
                land_rings.append(c); continue     # an island
            if not (out_(c[0]) and out_(c[-1])): continue
            se, pe = proj(c[-1]); ss, ps = proj(c[0])
            best = None
            for step in (1, -1):                   # walk the box clockwise or anticlockwise from the end back to the start
                ring = c + [pe]; k = se
                for _ in range(5):
                    if k == ss and len(ring) > len(c) + 1 or k == ss and step == 1 and _ > 0: break
                    if k == ss and _ == 0 and (step == 1) == (True): pass
                    if step == 1: ring.append(corners[(k + 1) % 4]); k = (k + 1) % 4
                    else: ring.append(corners[k]); k = (k - 1) % 4
                    if k == ss: break
                ring.append(ps)
                area2 = sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(ring, ring[1:] + ring[:1]))
                n = 1 if area2 < 0 else 0          # land on the left of the coastline (checked: Panaji land, the open sea west of Aguada water)
                if best is None or n > best[0]: best = (n, ring)
            land_rings.append(best[1])
    if land_rings:
        stack = []
        for ty in range(H):
            for tx in range(W):
                if grid[ty][tx] in 'GPFMC' and not any(inside([r], tx + 0.5, ty + 0.5) for r in land_rings): grid[ty][tx] = 'S'   # beaches stay (OSM often draws them seaward of the coastline)
    while stack:
        x, y = stack.pop()
        if not (0 <= x < W and 0 <= y < H) or grid[y][x] not in 'GPFMB' or high(x, y):
            continue
        grid[y][x] = 'S'
        stack += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
    # a strip of sand along the sea, where the coastline ran
    BAND = 0 if ep.exists() else 3   # a big region: sand only on mapped beaches (rocky shores stay rock); the old villages keep their strip
    for y in range(H):
        for x in range(W):
            if grid[y][x] == 'C' and BAND == 0:
                grid[y][x] = 'G'; continue      # the coastline itself is just the land's edge
            if grid[y][x] == 'C' or (grid[y][x] in 'GF' and any(0 <= x + dx < W and 0 <= y + dy < H and grid[y + dy][x + dx] == 'S'
                                                                for dx in range(-BAND, BAND + 1) for dy in range(-BAND, BAND + 1))):
                grid[y][x] = 'B'
    ROADS = {'trunk': 2.4, 'primary': 2.4, 'secondary': 2.2, 'tertiary': 2.0}
    LANES = {'unclassified': 1.6, 'residential': 1.6, 'living_street': 1.6, 'service': 1.3, 'track': 1.3, 'path': 1.1, 'footway': 1.1}
    for e in els:
        t = e.get('tags', {})
        hw = t.get('highway')
        if e['type'] != 'way' or not hw:
            continue
        # widths are for 12 m tiles; at larger tiles roads narrow so a city's streets stay a tile or two wide
        k = min(1.0, 12 / tile)
        if hw in ROADS:
            paint_line(geo(e), max(1.4, ROADS[hw] * k), 'R')
        elif hw in LANES:
            if tile >= 18 and hw in ('footway', 'path', 'service'):
                continue   # in a city these are pavements, alleys and driveways: at this scale they would cover every block
            paint_line(geo(e), max(1.05, LANES[hw] * k), 'L', keep=('R',))
    houses = []
    for e in els:
        t = e.get('tags', {})
        if 'building' in t and e['type'] == 'way':
            pts = geo(e)
            if not pts:
                continue
            x0, x1 = int(min(p[0] for p in pts)), int(max(p[0] for p in pts))
            y0, y1 = int(min(p[1] for p in pts)), int(max(p[1] for p in pts))
            if tile >= 18:   # a city map: each building keeps its own footprint, 1 to 6 tiles a side
                w, h = max(1, min(6, x1 - x0 + 1)), max(1, min(6, y1 - y0 + 1))
            else:            # a village map: every house is the game's 3 x 3 (or 4 x 3) house with its balcão
                w, h = max(3, min(4, x1 - x0 + 1)), 3
            if tile >= 18:
                # shave the building back off any road, lane or water its outline overlaps, a row or column at a time
                bad = lambda x, y: not (0 <= x < W and 0 <= y < H) or grid[y][x] not in 'GPF'
                while w > 0 and h > 0:
                    sides = {'l': sum(bad(x0, y) for y in range(y0, y0 + h)), 'r': sum(bad(x0 + w - 1, y) for y in range(y0, y0 + h)),
                             't': sum(bad(x, y0) for x in range(x0, x0 + w)), 'b': sum(bad(x, y0 + h - 1) for x in range(x0, x0 + w))}
                    worst = max(sides, key=sides.get)
                    if not sides[worst]:
                        break
                    if worst == 'l': x0 += 1; w -= 1
                    elif worst == 'r': w -= 1
                    elif worst == 't': y0 += 1; h -= 1
                    else: h -= 1
                if w < 1 or h < 1:
                    continue
            if 1 <= x0 and x0 + w < W - 1 and 1 <= y0 and y0 + h < H - 1:
                houses.append([x0, y0, w, h])
    # sights: named monuments and the like, from the separate sights cache when there is one
    sights = []
    sp = DATA / f'{name}.sights.json'
    for e in json.loads(sp.read_text(encoding='utf-8'))['elements'] if sp.exists() else []:
        t = e.get('tags', {})
        nm = t.get('name:en') or t.get('name')
        c = e.get('center') or ({'lat': e['lat'], 'lon': e['lon']} if 'lat' in e else None)
        if not nm or not c or t.get('historic') in ('boundary_stone', 'milestone'):
            continue
        x, y = xy(c['lat'], c['lon'])
        if 3 <= x < W - 3 and 3 <= y < H - 3 and all(math.hypot(x - s[0], y - s[1]) > 6 for s in sights):
            kind = 'park' if t.get('leisure') == 'park' else 'museum' if t.get('tourism') in ('museum', 'gallery') else 'view' if t.get('tourism') == 'viewpoint' else 'monument'
            if len(nm) > 34:   # keep labels short: cut at a word, and drop a dangling 'and', 'of' or 'the'
                nm = nm[:34].rsplit(' ', 1)[0].rstrip(':,-')
                while nm.split()[-1].lower() in ('and', 'of', 'the', 'de', 'da'):
                    nm = nm.rsplit(' ', 1)[0]
            sights.append([round(x, 1), round(y, 1), nm, kind])
    # petrol pumps, for riding (and pushing) a motorbike
    pumps = []
    for e in els:
        t = e.get('tags', {})
        if t.get('amenity') == 'fuel':
            la, lo = centre(e)
            if la is None:
                continue
            x, y = xy(la, lo)
            if 2 <= x < W - 2 and 2 <= y < H - 2 and all(math.hypot(x - q[0], y - q[1]) > 4 for q in pumps):
                pumps.append([round(x, 1), round(y, 1), (t.get('brand') or t.get('name') or 'Petrol pump')[:24]])
    anchors, names = {}, {}
    for e in els:
        t = e.get('tags', {})
        k = kind_of(t)
        if k in ('temple', 'chapel', 'ferry', 'bus') or (k == 'worship' and 'worship' not in anchors):
            la, lo = centre(e)
            if la is None:
                continue
            x, y = xy(la, lo)
            if 0 <= x < W and 0 <= y < H:
                d = math.hypot(x - W / 2, y - H / 2)
                if k not in anchors or d < anchors[k][2]:
                    anchors[k] = (round(x, 1), round(y, 1), d)
                    names[k] = t.get('name:en') or t.get('name') or ''
    # --anchor kind=lat,lon[,name] pins a landmark the tags don't mark (an untagged ferry point, a particular temple)
    for pin in pins:
        k, rest = pin.split('=', 1)
        parts = rest.split(',', 2)
        x, y = xy(float(parts[0]), float(parts[1]))
        anchors[k] = (round(x, 1), round(y, 1), 0)
        if len(parts) > 2:
            names[k] = parts[2]
    out = {'name': name.title(), 'centre': [lat, lon], 'tile': tile, 'W': W, 'H': H,
           'credit': 'Map data © OpenStreetMap contributors (ODbL)',
           'rows': [''.join(r) for r in grid], 'houses': houses,
           'anchors': {k: [v[0], v[1]] for k, v in anchors.items()}, 'names': names, 'sights': sights, 'pumps': pumps}
    (DATA / f'{name}.map.json').write_text(json.dumps(out), encoding='utf-8', newline=chr(10))
    for r in out['rows']:
        print(r)
    print('anchors', out['anchors'], names)
    print('houses', len(houses))
    print('sights', sights)
    print('pumps', pumps)
    if inline:
        f = pathlib.Path(inline)
        src = f.read_text(encoding='utf-8')
        block = f'/* VILLAGE-DATA {name} */VILLAGES.{name} = ' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + f';/* END VILLAGE-DATA {name} */'
        src, n = re.subn(rf'/\* VILLAGE-DATA {name} \*/.*?/\* END VILLAGE-DATA {name} \*/', lambda m: block, src, flags=re.S)
        if n == 0:
            if '/* VILLAGES-END */' not in src:
                sys.exit('VILLAGES-END marker not found in ' + inline)
            src = src.replace('/* VILLAGES-END */', block + '\n/* VILLAGES-END */')
        f.write_text(src, encoding='utf-8', newline=chr(10))
        print('inlined into', inline)


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('cmd', choices=['fetch', 'sights', 'survey', 'build'])
    ap.add_argument('name')
    ap.add_argument('lat', type=float, nargs='?')
    ap.add_argument('lon', type=float, nargs='?')
    ap.add_argument('--radius', type=float, default=0.007)
    ap.add_argument('--tile', type=float, default=9)
    ap.add_argument('--size', default=f'{W}x{H}', help='grid width x height in tiles; must match the game')
    ap.add_argument('--inline')
    ap.add_argument('--anchor', action='append', default=[], help='kind=lat,lon[,name], e.g. ferry=15.5277,73.9046,Piedade Ferry')
    a = ap.parse_args()
    W, H = (int(v) for v in a.size.split('x'))
    if a.cmd == 'fetch':
        fetch(a.name, a.lat, a.lon, a.radius)
    elif a.cmd == 'sights':
        sights_fetch(a.name, a.lat, a.lon, a.radius)
    elif a.cmd == 'survey':
        survey(a.name)
    else:
        build(a.name, a.lat, a.lon, a.tile, a.inline, a.anchor)
