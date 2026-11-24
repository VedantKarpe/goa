#!/usr/bin/env bash
# Rebuild the 3D game's map of Goa (Panjim, Miramar, Caranzalem, Taleigao, Dona Paula, Sinquerim and Aguada) from the
# downloaded region (python tools/fetch_region.py goa 15.4455 73.7570 15.5110 73.8565, ELEV_STEP=0.0005).
# The grid keeps the old Panjim tiles: old map x + 296, y + 40.
set -e
cd "$(dirname "$0")/.."
export GOA_REGION=goa3 GOA_OX=364 GOA_OY=328
python tools/osm_import.py build goa3 15.504804 73.833079 --tile 20 --size 948x640 > /dev/null
python tools/export_real.py
python tools/export_web.py
python tools/export_named.py | tail -1
python - <<'EOF'
import json
els = json.load(open('data/goa3.osm.json', encoding='utf-8'))['elements']
keep = [e for e in els if 'name' in e.get('tags', {}) and (e['tags'].get('shop') or e['tags'].get('amenity') in ('restaurant', 'cafe', 'bar', 'fast_food'))]
for e in keep:
    if 'lat' not in e and 'center' not in e:
        g = [p for p in e.get('geometry') or [] if p]
        if g: e['center'] = {'lat': sum(p['lat'] for p in g) / len(g), 'lon': sum(p['lon'] for p in g) / len(g)}
json.dump({'elements': keep}, open('data/goa3.shops.json', 'w', encoding='utf-8'))
EOF
python tools/export_shops.py data/goa3.shops.json | head -c 60; echo
