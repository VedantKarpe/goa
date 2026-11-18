// Rakhondar in three.js: Panjim from the map data, the child, the turning view, and the game: traffic and lifts,
// townspeople, the day and its street lights, the night's demons, tasks, the minimap with fog of war.
import * as THREE from 'three';
import { loadPanjim, Ground, T } from './world/data';
import { buildTerrain, buildWater, waterTime } from './world/terrain';
import { buildRoads, StreetIndex } from './world/roads';
import { buildBuildings, BuildingIndex, windowsLit } from './world/buildings';
import { buildTrees } from './world/trees';
import { Child } from './entities/child';
import { Input } from './systems/input';
import { CameraRig } from './systems/cameraRig';
import { Movement } from './systems/movement';
import { Hud } from './ui/hud';
import { Network } from './world/network';
import { Traffic } from './entities/traffic';
import { People } from './entities/people';
import { Monsters } from './entities/monsters';
import { Clock } from './systems/clock';
import { Quests } from './systems/quests';
import { Minimap } from './ui/minimap';
import { sfx, unlockAudio } from './systems/sfx';
import { loadModels, rawModel } from './world/models';
import { Boats } from './entities/boats';
import { Pumps } from './entities/pumps';
import { Bikes } from './entities/bikes';
import { toonify } from './world/toon';
import { infill } from './world/infill';
import { Places } from './ui/places';
import { buildStreetLife } from './world/streetlife';
import { Signals } from './systems/signals';
import { Blackout } from './systems/blackout';
import { buildPromenade } from './world/promenade';
import { Cows } from './entities/cows';
import { Rentals } from './entities/rentals';
import { buildShops, buildLoveSign } from './world/shops';
import { Campaign } from './systems/campaign';
import { AreaManager } from './areas/manager';
import { areas, beachSand } from './areas/registry';

async function start() {
  const [d] = await Promise.all([loadPanjim(), loadModels()]);
  const g = new Ground(d);

  const app = document.getElementById('app')!;
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  // draw at least 1.5x the screen's pixels (2x on phones) so edges come out smooth
  renderer.setPixelRatio(Math.min(2, Math.max(1.5, devicePixelRatio)));
  renderer.toneMapping = THREE.NoToneMapping;   // flat, bold cartoon colour (no film grading)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  app.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9cc3d8);
  const hemi = new THREE.HemisphereLight(0xcfe3f5, 0x6a5a38, 1.1);
  const sun = new THREE.DirectionalLight(0xfff1d6, 2.2);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -160, right: 160, top: 160, bottom: -160, near: 1, far: 900 });
  sun.shadow.bias = -0.0015; sun.shadow.normalBias = 1.4;   // no striping on the ground when the sun is low
  scene.add(hemi, sun, sun.target);
  scene.fog = new THREE.Fog(0xdcdcd4, 300, 1500);   // the humid haze that greys the far shore and Altinho

  const roads = buildRoads(d, g); scene.add(roads.group);
  const si = new StreetIndex(roads.segs);
  // the landmarks: their Blender models stand on their map points, in place of the plain blocks there
  const lmBox = d.lm.flatMap(l => l.at.map(([x, y]) => [x + l.cov[0], x + l.cov[1], y + l.cov[2], y + l.cov[3]]));
  const plain = { ...d, b: d.b.filter(([f]) => {
    let cx = 0, cy = 0; for (let i = 0; i < f.length; i += 2) { cx += f[i]; cy += f[i + 1]; } cx /= f.length / 2; cy /= f.length / 2;
    return !lmBox.some(([x0, x1, y0, y1]) => cx > x0 && cx < x1 && cy > y0 && cy < y1);
  }) };
  const extra = infill(d, g, si); plain.b = plain.b.concat(extra);
  const blds = buildBuildings(plain, g); scene.add(blds.group);
  // the landmarks' own outlines stay solid, though their plain blocks are not drawn
  const kept = new Set(plain.b.map(b => b[0]));
  for (const [f] of d.b) {
    if (kept.has(f)) continue;
    const p: [number, number][] = []; for (let i = 0; i < f.length; i += 2) p.push([f[i] * T, f[i + 1] * T]);
    const xs = p.map(q => q[0]), zs = p.map(q => q[1]);
    blds.list.push({ p, bb: [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)], base: 0, top: 30 });
  }
  const bi = new BuildingIndex(blds.list);
  // the ground: built up wherever a street or a building stands, so nothing stands in the water; the promenade follows
  // the same drawn shoreline
  const solidGround = (X: number, Z: number) => { const s = si.at(X, Z); return (!!s && s.deck === null) || bi.solid(X, Z, 9); };   // a bank 9 m round every building, so none stands in the water
  const drawnLand = (X: number, Z: number) => (solidGround(X, Z) ? 1 : g.landAt(X, Z));
  scene.add(buildTerrain(d, g, solidGround), buildWater(d));
  const atalGlow = new THREE.MeshBasicMaterial({ color: 0xd8d6d0 });
  for (const l of d.lm) for (const [x, y] of l.at) {
    const m = rawModel(l.name); if (!m) continue;
    const X = x * T, Z = y * T, sg = si.at(X, Z), deck = sg?.deckAt ? sg.deckAt(X, Z) : sg?.deck;
    m.position.set(X, deck ?? g.heightAt(X, Z), Z); m.traverse(o => { o.receiveShadow = true; }); scene.add(m);
    if (l.name === 'atalsetu') {
      // the Atal Setu pylons stand out on the skyline: drawn taller, with a strip of light up each mast that glows at night
      m.scale.set(1, 1.8, 1);
      const strip = new THREE.Mesh(new THREE.BoxGeometry(1.5, 30, 1.5).translate(0, 17, 0), atalGlow);
      m.add(strip);
    }
  }
  const treeGroup = buildTrees(d, g, bi, si); scene.add(treeGroup);

  const child = new Child(); scene.add(child.obj);
  const move = new Movement(g, bi, si);
  // start below the Church of the Immaculate Conception, where the canvas game starts
  let px = 92 * T, pz = 34 * T;
  if (!move.free(px, pz)) for (let r = 2; r < 200 && !move.free(px, pz); r += 2) { px = 92 * T + r; }

  const net = new Network(d, g);
  scene.add(buildStreetLife(net, g, (x, z) => move.free(x, z) && (si.at(x, z)?.deck ?? null) === null));   // nothing parked on a flyover or its ramps
  const traffic = new Traffic(net, g, 48); scene.add(traffic.group);
  const signals = new Signals(net, g, (x, z) => bi.solid(x, z, 1.2)); scene.add(signals.group); traffic.signals = signals;
  const people = new People(net, g, d); scene.add(people.group);
  const monsters = new Monsters(g, move); scene.add(monsters.group);
  const day = new Clock(net, g, (x, z, iron) => bi.solid(x, z, 1.2) || (!iron && (si.at(x, z)?.half ?? 0) > 2.5)); scene.add(day.lamps);   // no lamp post inside a building; no tubelight out on another road (the iron lamps along Atal Setu stand between its carriageways)
  const quests = new Quests(d, net, g, blds.list, px, pz, (x, z) => move.free(x, z)); scene.add(quests.group);
  // the areas of Goa with their own scenery and characters (Fontainhas, Miramar...) load as the child comes near them
  const sand = beachSand(d);
  if (sand.length) d.places.push(['Miramar', sand.reduce((a, q) => a + q[0], 0) / sand.length / T, sand.reduce((a, q) => a + q[1], 0) / sand.length / T]);
  const areaMgr = new AreaManager(areas(d), { d, g, houses: blds.list, segs: roads.segs, free: (x, z) => move.free(x, z) }, scene);
  areaMgr.onLoaded = (name, grp, inst, first) => {
    if (name === 'Fontainhas') toonify(grp, [], () => true); else toonify(grp, [grp], () => false);   // the cartoon look, ink outlines as before
    if (first && inst.cast?.length) people.add(inst.cast);   // the area's own people move into town
  };   // the cartoon look, ink outlines as before
  // shops from OpenStreetMap, the famous places to eat also in the Places guide
  const shops = buildShops(d, g, roads.segs); scene.add(shops.group);
  for (const s of shops.list) if (s.famous) d.places.push([s.name, s.x / T, s.z / T]);
  // the cows: some resting by the market and Church Square, the rest out on the streets
  const restAt = d.places.filter(([n]) => n === 'Panjim Bazaar' || n === 'Church Square').map(([, x, y]) => [x * T, y * T] as [number, number]);
  // drunk tourists in rental cars: avoid them at all times
  const rentals = new Rentals(net, g, (x, z) => !bi.solid(x, z, 1) && !g.isWet(x, z)); scene.add(rentals.group);
  rentals.onWarn = m => { hud.whisper(m, 3, true); sfx.honk(); };
  const dangerEl = document.createElement('div'); dangerEl.id = 'danger'; dangerEl.style.display = 'none';
  dangerEl.innerHTML = '<div class="arr">➤</div><div class="txt"></div>'; document.body.appendChild(dangerEl);
  const dangerArrow = dangerEl.querySelector('.arr') as HTMLElement, dangerTxt = dangerEl.querySelector('.txt') as HTMLElement;
  const dst = document.createElement('style');
  dst.textContent = `#danger{position:fixed;transform:translate(-50%,-50%);pointer-events:none;z-index:20;text-align:center;color:#fff;font:700 13px system-ui,sans-serif;text-shadow:0 1px 3px #000}
#danger .arr{font-size:34px;color:#ff2a2a;line-height:1;filter:drop-shadow(0 0 4px #000)}
#danger .txt{background:rgba(180,20,20,.85);padding:2px 7px;border-radius:8px;margin-top:2px;white-space:nowrap}
#danger.hot .arr{animation:dpulse .35s infinite alternate;font-size:44px}
#danger.hot .txt{background:#e01010}
@keyframes dpulse{from{opacity:1}to{opacity:.35}}`; document.head.appendChild(dst);
  const cows = new Cows(net, g, (x, z) => move.free(x, z), restAt); scene.add(cows.group); traffic.cows = cows.list;
  for (let i = 0; i < sand.length && i < 60; i += 9) { const [x, z] = sand[i]; cows.addAt(x + 3, z + 2, i % 2 === 0); }   // cows on Miramar beach
  // "I love Goa" on the riverfront: the open bank west of the Old Secretariat, where the road leaves room by the water
  {
    let best: [number, number] | null = null, bd = 1e9;
    for (let x = 60 * T; x <= 135 * T; x += 4) for (let z = 0; z <= 30 * T; z += 3) {
      if (g.landAt(x, z) < 0.9 || si.at(x, z) || bi.solid(x, z, 5) || g.landAt(x, z - 12) > 0.5) continue;
      if ([[-6, 0], [6, 0], [0, 3]].some(([a, b]) => si.at(x + a, z + b) || g.landAt(x + a, z + b) < 0.9)) continue;
      const dd = Math.hypot(x - 75.4 * T, z - 9.5 * T); if (dd < bd) { bd = dd; best = [x, z]; }
    }
    if (best) scene.add(buildLoveSign(best[0], g.heightAt(best[0], best[1]), best[1], 0));
  }
  const map = new Minimap(d);
  scene.add(buildPromenade(d, g, bi, (x, z) => { const s = si.at(x, z); return !!s && s.half > 2; }, drawnLand));   // no railing across a street
  const bikes = new Bikes(net, g, (x, z) => move.free(x, z) && !si.at(x, z)); scene.add(bikes.group);
  const places2 = new Places(d, g, scene, p => hud.whisper(`Okay, ${p.name}. Follow the green light, baba. ${p.note}`, 6));
  const boats = new Boats(g, d.casinos ?? []); scene.add(boats.group);
  const pumps = new Pumps(net, g, (x, z) => !bi.solid(x, z, 9) && !g.isWet(x, z) && !si.at(x, z)); scene.add(pumps.group);
  let home: [number, number] = [px, pz];

  const rig = new CameraRig(), input = new Input(renderer.domElement), hud = new Hud();
  const st = { courage: 100, oil: 100, points: 0, lamp: true };
  let knockX = 0, knockZ = 0, hurtT = 0;
  const talk = () => {
    const said = areaMgr.talk(px, pz); if (said) { hud.whisper(said, 9, true); return; }
    const giver = quests.giverNear(px, pz); if (giver) { hud.whisper(quests.accept(giver), 10, true); sfx.pick(); return; }   // tasks start only when you ask
    const p = people.near(px, pz);
    hud.whisper(p ? people.talk(px, pz, quests.target) : 'Nobody here to ask, baba. Go near someone and ask.');
  };
  const lift = () => {
    if (bikes.riding) { bikes.park(px, pz); hud.whisper('Parked. Lock it, no? Somebody will take it otherwise.', 2); return; }
    const bk = traffic.riding ? null : bikes.near(px, pz);
    if (bk) { bikes.mount(bk); hud.whisper(bk.kind === 'scooter' ? 'Vroom! Keys were in it only. Go slow near the church, men.' : 'Tring tring! Pedal, baba, pedal!', 3); return; }
    if (traffic.riding) { const o = traffic.hopOff(); if (o && move.free(o.x, o.z)) { px = o.x; pz = o.z; } else { px = Math.max(T * 1.5, Math.min((d.W - 1.5) * T, px)); pz = Math.max(T * 1.5, Math.min((d.H - 1.5) * T, pz)); } }
    else if (!traffic.hopOn(px, pz)) hud.whisper('No vehicle near. Stand beside the road and wait for a pilot.', 3);
  };
  const banish = () => {
    if (!day.night) { hud.whisper('No demons in the daytime, men. Relax.', 2); return; }
    if (st.oil < 8) { hud.whisper('Your torch battery is dead! Find a street light, quick.', 3); return; }
    const b = monsters.banishNear(px, pz);
    if (b === 'dodged') { st.oil -= 8; hud.whisper('It laughs and slips round your beam! Try again.', 2); return; }
    if (b) { st.oil -= 8; st.points += 15; sfx.banish(); hud.whisper('Begone! The demon melts into the dark.', 2); }
    else hud.whisper('No demon close enough.', 2);
  };
  const call = () => {
    if (st.points < 50) { hud.whisper('You need 50 points of good deeds before you can ask for help.', 3); return; }
    st.points -= 50; monsters.call(); sfx.spirit(); hud.whisper('Help comes: a guardian spirit rises beside you, staff glowing. The demons flee!', 4);
  };
  input.onKey = k => {
    unlockAudio();
    if (k === '[' || k === 'pagedown') rig.tiltBy(-0.1);
    if (k === ']' || k === 'pageup') rig.tiltBy(0.1);
    if (k === 'n') day.min = day.night ? 7 * 60 : 19 * 60 + 30;
    if (k === 't') talk();
    if (k === 'f') lift();
    if (k === ' ') banish();
    if (k === 'r') call();
    if (k === 'l') st.lamp = !st.lamp;
    if (k === 'p') places2.toggle();
    if (k === '0' || k === 'home') rig.reset();
    if (k === 'm') document.getElementById('map')!.click();
  };
  addEventListener('pointerdown', unlockAudio);
  traffic.onEvent = (kind, text) => {
    if (kind === 'honk') { if (Math.random() < 0.5) sfx.honk(); return; }
    if (kind === 'crash') sfx.crash();
    if (text) hud.whisper(text, 4);
  };
  const btn = (id: string, f: () => void) => document.getElementById(id)!.addEventListener('click', e => { (e.currentTarget as HTMLElement).blur(); unlockAudio(); f(); });
  // the turn buttons turn the view for as long as they are held (and work while the other thumb walks)
  for (const [id, dir] of [['bL', -1], ['bR', 1]] as [string, number][]) {
    const b = document.getElementById(id)!;
    b.addEventListener('pointerdown', e => { e.preventDefault(); input.btnTurn = dir; b.setPointerCapture(e.pointerId); });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, () => { input.btnTurn = 0; });
  } btn('bIn', () => rig.zoom(2)); btn('bOut', () => rig.zoom(-2));
  btn('bHome', () => rig.reset()); btn('bTiltD', () => rig.tiltBy(-0.12)); btn('bTiltU', () => rig.tiltBy(0.12));
  btn('bTalk', talk); btn('bLift', lift); btn('bBan', banish); btn('bCall', call);

  const places = d.places.map(([n, x, y]) => ({ n, X: x * T, Z: y * T }));
  const resize = () => { renderer.setSize(app.clientWidth, app.clientHeight, false); };
  addEventListener('resize', resize); resize();
  document.getElementById('loading')!.remove();

  // the cartoon look: cel shading everywhere, ink outlines on everything solid but the ground, streets and buildings
  const flat = new Set(['roads', 'buildings', 'grass', 'street life', 'love sign']);
  const outlined = scene.children.filter(o => !flat.has(o.name) && o.type === 'Group');
  toonify(scene, outlined, o => { let p: THREE.Object3D | null = o; while (p) { if (flat.has(p.name)) return true; p = p.parent; } return false; });
  let inkT = 0, edgeT = 0, wasNight = false;
  const blackout = new Blackout(net, pumps.spots);
  // the story: seven nights to bring back the church bell
  const campaign = new Campaign(new Map(d.places.map(([n, x, y]) => [n, { x: x * T, z: y * T }])), (x, z) => move.free(x, z), (x, z) => g.heightAt(x, z));
  scene.add(campaign.group);
  const card = document.createElement('div'); document.body.appendChild(card);
  card.style.cssText = 'position:fixed;inset:0;display:none;align-items:center;justify-content:center;flex-direction:column;gap:14px;background:#0a0814cc;color:#f6e7c1;font:700 34px Georgia,serif;text-align:center;z-index:20;padding:24px';
  let cardT = 0;
  const showCard = (title: string, sub: string, secs = 4, button = '') => {
    card.innerHTML = `<div>${title}</div><div style="font:400 17px Georgia,serif;max-width:560px;line-height:1.45">${sub}</div>${button ? `<button style="font:600 16px Georgia,serif;padding:8px 18px;border-radius:8px;border:2px solid #f2c230;background:#7a1e1e;color:#fff4d8;cursor:pointer">${button}</button>` : ''}`;
    card.style.display = 'flex'; cardT = button ? 1e9 : secs;
    card.querySelector('button')?.addEventListener('click', () => { campaign.reset(); card.style.display = 'none'; cardT = 0; hud.whisper('A new story begins. Night 1 at dusk.', 4); });
  };
  card.addEventListener('click', e => { if ((e.target as HTMLElement).tagName !== 'BUTTON') { card.style.display = 'none'; cardT = 0; } });
  let phaseSeen = '';
  const camDir = new THREE.Vector3();
  const inView = (x: number, z: number) => {   // is (x, z) in front of the view, not too far off?
    const c = rig.camera.position; rig.camera.getWorldDirection(camDir);
    const dx = x - c.x, dz = z - c.z, L = Math.hypot(dx, dz) || 1, fl = Math.hypot(camDir.x, camDir.z) || 1;
    return L < 160 && (dx * camDir.x + dz * camDir.z) / (L * fl) > Math.cos(0.5);
  };
  const clock = new THREE.Clock();
  let mapT = 0, shopT = 0, cowSaid = false, cullT = 0;
  const smallStuff = [bikes.group, cows.group, pumps.group, traffic.group];   // (people show and hide themselves)
  const shopTag = document.createElement('div'); shopTag.id = 'shopTag'; document.body.appendChild(shopTag);
  shopTag.style.cssText = 'position:fixed;left:50%;top:14px;transform:translateX(-50%);background:#7a1e1ee6;color:#fff4d8;font:600 14px Georgia,serif;padding:4px 12px;border-radius:6px;border:2px solid #f2c230;display:none;pointer-events:none;z-index:5';
  (window as unknown as { rk: unknown }).rk = { rentals, areaMgr, campaign, cows, THREE, d, g, si, bi, signals, scene, renderer, rig, child, day, traffic, people, monsters, quests, st, get pos() { return [px, pz]; }, set pos(v: number[]) { px = v[0]; pz = v[1]; } };
  // the sun's disc (a soft glowing sprite, not fogged)
  const sunDisc = (() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const c = cv.getContext('2d')!;
    const gr = c.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.42, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = gr; c.fillRect(0, 0, 128, 128);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), fog: false, depthWrite: false, transparent: true }));
    s.renderOrder = -1; scene.add(s); return s;
  })();
  // each new day starts somewhere else in Panjim, with a different task (and the day number is kept)
  const STARTS = ['Church Square', 'Miramar', 'Fontainhas', 'Campal', 'Panjim Bazaar', 'Altinho', 'Patto'];
  let dayNo = 0;   // days this visit (nothing is saved)
  const startDay = (first: boolean, before = '') => {
    const pool = d.places.filter(q => STARTS.includes(q[0]) || q[0] === 'Miramar'), pick = pool[Math.floor(Math.random() * pool.length)];
    const name = pick?.[0] ?? 'Church Square', p = pick;
    if (p) {
      let x = p[1] * T, z = p[2] * T;
      for (let r = 0; r < 300 && !move.free(x, z); r += 3) { x = p[1] * T + Math.cos(r) * r; z = p[2] * T + Math.sin(r) * r; }
      if (move.free(x, z)) { if (traffic.riding) traffic.hopOff(); if (bikes.riding) bikes.park(px, pz); px = x; pz = z; home = [x, z]; }
    }
    const task = quests.startDay(Math.floor(Math.random() * 4));
    hud.whisper(`${before}${first ? 'Good afternoon' : 'Good morning'}, baba! Day ${dayNo + 1}: you are in ${name} today. ${task ?? ''}`, 10, true);
  };
  places2.onTravel = async p => {
    if (campaign.active && day.night) { hud.whisper('No pilot will go out tonight, baba. Too many bhoots on the road. Walk, or ride a cycle.', 4, true); return; }
    let x = p.x, z = p.z;
    for (let r = 0; r < 300 && !move.free(x, z); r += 3) { x = p.x + Math.cos(r) * r; z = p.z + Math.sin(r) * r; }
    if (!move.free(x, z)) { hud.whisper(`The pilot can't find a way to ${p.name}, men.`, 3); return; }
    hud.whisper(`Waiting for a pilot to ${p.name}...`, 3, true);
    await areaMgr.ready(x, z);
    if (traffic.riding) traffic.hopOff(); if (bikes.riding) bikes.park(px, pz);
    px = x; pz = z; day.min = Math.min(day.min + 10, 1439);   // the ride takes ten minutes
    hud.whisper(`The pilot drops you at ${p.name}. "Thirty rupees, baba. Okay okay, for you twenty." ${p.note}`, 6, true);
  };
  day.min = 15 * 60;   // start in the afternoon: a little daylight to explore before dusk
  startDay(true);
  const frame = (dt: number) => {
    const night = day.night;
    // a night passes three times faster than a day; once tonight's story is won (or lost), on to morning quickly
    day.rate = night ? (campaign.phase === 'won' || campaign.phase === 'lost' ? 12 : 3) : 2;
    let speed = 0;
    if (traffic.riding) {
      // riding: the child sits on the vehicle
      const v = traffic.riding; px = v.x; pz = v.z; child.heading = Math.atan2(v.hz, v.hx);
    } else {
      // walk: screen directions turned to the ground under the current view
      const m = input.move(), run = input.has('shift') ? 2 : 1;
      speed = Math.hypot(m.x, m.y) * 32 * run * bikes.boost;
      if (speed > 0) {
        const w = rig.screenToGround(m.x, m.y), L = Math.hypot(w.x, w.z) || 1;
        child.heading = Math.atan2(w.z, w.x);
        const ox = px, oz = pz;
        [px, pz] = move.step(px, pz, (w.x / L) * speed * dt, (w.z / L) * speed * dt);
        // walked into the edge of the map: say so, rather than seeming stuck
        const nearEdge = px < T * 4 || pz < T * 4 || px > (d.W - 4) * T || pz > (d.H - 4) * T;
        edgeT -= dt;
        if (nearEdge && Math.hypot(px - ox, pz - oz) < 0.01 && edgeT <= 0) { edgeT = 6; hud.whisper('Porvorim is that side, bhurgea. Our Panjim ends here; turn back, no?', 3); }
      }
      // thrown by a vehicle
      if (Math.abs(knockX) + Math.abs(knockZ) > 0.1) {
        [px, pz] = move.step(px, pz, knockX * dt, knockZ * dt);
        knockX *= 1 - Math.min(1, dt * 4); knockZ *= 1 - Math.min(1, dt * 4);
      }
    }
    const gy = move.standY(px, pz);
    const py = traffic.riding ? traffic.riding.obj.position.y + 2.2 : bikes.riding ? gy + 1.3 : gy;
    bikes.follow(px, gy + 0.15, pz, child.heading, performance.now() / 1000);
    child.obj.position.set(px, py, pz);
    const noTorch = campaign.active && !!campaign.cur?.noTorch;
    const lampLit = st.lamp && st.oil > 0.5 && !noTorch;   // an empty battery gives no light at all (and on the creek night none works)
    child.update(dt, speed, night && lampLit);
    child.obj.rotation.z = hurtT > 0 ? Math.sin(hurtT * 30) * 0.15 : 0; hurtT = Math.max(0, hurtT - dt);

    day.update(dt, scene, hemi, sun, px, pz);
    windowsLit.value = Math.max(0, day.dark * 1.6 - 0.6);
    atalGlow.color.setHSL(0.78 + Math.sin(performance.now() / 4000) * 0.05, day.dark > 0.5 ? 0.8 : 0, day.dark > 0.5 ? 0.7 : 0.85);
    signals.update(dt);
    waterTime.value += dt;
    const hit = traffic.update(dt, px, pz, night);
    if (hit && !traffic.riding) { knockX = hit.kx; knockZ = hit.kz; st.courage = Math.max(0, st.courage - 15); hurtT = 0.6; }
    people.update(dt, day.min, px, pz);
    // the rental cars: hit by one and you lose (safe while riding a pilot or the bus)
    if (rentals.update(dt, px, pz, night, !!traffic.riding)) {
      sfx.crash(); rentals.clearNear(px, pz); st.points = Math.max(0, st.points - 25); st.courage = 100;
      if (bikes.riding) bikes.park(px, pz);
      const spots = d.places.filter(q => STARTS.includes(q[0])), q = spots[Math.floor(Math.random() * spots.length)];
      let x = q[1] * T, z = q[2] * T; for (let r = 0; r < 300 && !move.free(x, z); r += 3) { x = q[1] * T + Math.cos(r) * r; z = q[2] * T + Math.sin(r) * r; }
      px = x; pz = z;
      showCard('Dashed by a drunk tourist!', `A rental car with the red sign got you, baba. Minus 25 points. You wake up in ${q[0]}. Keep away from those cars!`, 4);
    }
    // the danger indicator: a red arrow at the screen edge pointing at the nearest rental within 120 m
    {
      const c = traffic.riding ? null : rentals.closest(px, pz);
      if (!c || c.d > 120) dangerEl.style.display = 'none';
      else {
        const v = new THREE.Vector3(c.x, g.heightAt(c.x, c.z) + 3, c.z).project(rig.camera);
        let sx = v.x, sy = -v.y; if (v.z > 1) { sx = -sx; sy = -sy; }
        const onScreen = v.z <= 1 && Math.abs(sx) < 0.85 && Math.abs(sy) < 0.8;
        const k = onScreen ? 1 : 0.85 / Math.max(Math.abs(sx), Math.abs(sy) / 0.8 * 0.85, 1e-3);
        const X = (sx * k * 0.5 + 0.5) * innerWidth, Y = (sy * k * 0.5 + 0.5) * innerHeight;
        const ang = Math.atan2(sy, sx) * 180 / Math.PI, hot = c.lunge || c.d < 35;
        dangerEl.style.display = 'block'; dangerEl.style.left = `${X}px`; dangerEl.style.top = `${onScreen ? Y - 40 : Y}px`;
        dangerEl.className = hot ? 'hot' : '';
        dangerArrow.style.transform = onScreen ? 'rotate(90deg)' : `rotate(${ang}deg)`;
        dangerTxt.textContent = `${c.lunge ? 'COMING AT YOU! ' : 'Rental '}${Math.round(c.d)} m`;
      }
    }
    // rush hours: the roads fill up 8-10 am and 5-7:30 pm, thin out at midday and empty late at night
    { const h = day.min / 60; traffic.count = (h >= 8 && h < 10) || (h >= 17 && h < 19.5) ? 58 : (h >= 7 && h < 21) ? 34 : (h >= 21 && h < 23) || (h >= 6 && h < 7) ? 20 : 10; }
    const az = areaMgr.tick(px, pz); if (az) { st.points += az.pts; sfx.done(); hud.whisper(az.msg, 6, true); }
    boats.update(dt, day.dark); cows.update(dt); areaMgr.update(dt, performance.now() / 1000, px, pz);
    // the shop the child is standing by
    shopT -= dt;
    if (shopT <= 0) {
      shopT = 0.4; let nm = '';
      for (const s of shops.list) if (Math.hypot(s.x - px, s.z - pz) < 12) { nm = s.name; break; }
      shopTag.textContent = nm; shopTag.style.display = nm ? 'block' : 'none';
      const cw = cows.near(px, pz, 4); if (cw && !cowSaid) { hud.whisper(['Moo. The cow does not move, men. Go around.', 'Aay deva, a cow sitting right in the middle!', 'Careful, baba, she is chewing. Don\'t disturb.'][Math.floor(Math.random() * 3)], 3); cowSaid = true; } else if (!cw) cowSaid = false;
    }
    const pumpLine = pumps.update(dt, px, pz, st.oil);
    if (pumpLine) {
      st.oil = 100; sfx.pick();
      if (blackout.active) { blackout.end(); day.setLitStreets(null); sfx.done(); hud.whisper('Uncle: "Aay deva, you came through all that dark? Here, a fresh battery, baba." The street lights flicker back on across Panjim.', 6); }
      else hud.whisper(pumpLine, 4);
    }
    // the torch dies at night: the blackout quest. Only one way stays lit, to a battery shop; demons wait along it
    if (night && st.oil <= 0.5 && !blackout.active && !noTorch) { const m = blackout.start(px, pz); if (m) { day.setLitStreets(blackout.edges); sfx.hurt(); hud.whisper(m, 9); } }
    if (blackout.active) {
      for (const a of blackout.ambushAhead(px, pz)) { monsters.spawnAt(a.x, a.z); monsters.spawnAt(a.x + 6, a.z - 4); }
      if (!night) { blackout.end(); day.setLitStreets(null); hud.whisper('Morning. The lights go off by themselves, and the sun charges your torch.', 4); }
    }
    // tonight's spirits; good deeds (points) buy a stronger torch that holds them further off
    monsters.rules = campaign.rules; monsters.level = campaign.active ? campaign.night + 1 : 0; monsters.rules.reach += st.points >= 300 ? 4 : st.points >= 150 ? 2 : 0;
    const hurt = monsters.update(dt, px, pz, night, lampLit, (x, z) => day.litAt(x, z) || (noTorch && cows.byGuide(x, z)), inView);
    if (hurt > 0) { st.courage = Math.max(0, st.courage - hurt); if (hurtT <= 0) { sfx.hurt(); hurtT = 0.4; } }
    // the torch drains its battery at night and recharges by day; standing in light restores courage
    if (night && lampLit) st.oil = Math.max(0, st.oil - dt * (campaign.active ? campaign.cur!.drain : 0.35) * (st.points >= 300 ? 0.75 : 1));
    // recharging at night: stand under a street light (the torch's charger in your pocket fills from it)
    // night falls: the Rakhondar sends you after the stranded; morning calls the search off
    if (night !== wasNight) {
      if (night) {
        const n = campaign.cur;
        if (n) {
          // the story's night: the blackout night starts dark, with Uncle's shop as the goal
          let shop: { x: number; z: number } | null = null;
          if (n.blackout) { st.oil = 0; const m = blackout.start(px, pz); if (m) { day.setLitStreets(blackout.edges); shop = blackout.target; } }
          const m = campaign.startNight(shop);
          if (m) { showCard(n.title, `Out tonight: ${n.spirit}. ${n.hint}`, 4); hud.whisper(m, 14, true); sfx.spirit(); }
        } else { const m = quests.startNight(px, pz); if (m) hud.whisper(m, 8); }
      } else {
        quests.endNight(); cows.clearGuides();
        dayNo++;
        const m = campaign.endNight(); if (m) sfx.hurt();
        startDay(false, m ? m + ' ' : '');
      }
      wasNight = night;
    }
    // the story, each frame
    const ev = campaign.update(dt, px, pz, day.min);
    if (ev) {
      hud.whisper(ev.msg, ev.big ? 10 : 5, true); (ev.lost ? sfx.hurt : ev.big ? sfx.done : sfx.pick)();
      if (ev.won) st.points += 100;
      if (ev.won && campaign.done) showCard('Panjim is free!', 'The bell rings every evening again, and the spirits sleep in the river mist. Dev borem korum, baba.', 0, 'Play the seven nights again');
      else if (ev.won) showCard(`Piece ${campaign.night} of 6 saved`, 'Tomorrow night will be harder.', 3);
    }
    // the creek night: glowing cows stand along the way to the piece (and then to the church)
    if (campaign.phase + campaign.night !== phaseSeen) {
      phaseSeen = campaign.phase + campaign.night;
      if (campaign.active && campaign.cur?.noTorch) cows.guide(blackout.route(px, pz, campaign.piece.x, campaign.piece.z, 35)); else cows.clearGuides();
    }
    if (noTorch && cows.byGuide(px, pz)) st.courage = Math.min(100, st.courage + dt * 6);
    if (cardT > 0 && cardT < 1e8) { cardT -= dt; if (cardT <= 0) card.style.display = 'none'; }
    if (!night) st.oil = Math.min(100, st.oil + dt * 2);
    if (day.litAt(px, pz) && hurt === 0) st.courage = Math.min(100, st.courage + dt * (night ? 3 : 1));
    if (st.courage <= 0) {
      hud.whisper('Too scared! You run home to Aunty. "Mhaka bhirant dili tuvem! Rest a little, then go."', 6);
      if (traffic.riding) traffic.hopOff();
      st.courage = 70; [px, pz] = home;
    }
    const q = quests.update(dt, px, pz);
    if (q) { st.points += q.pts; const big = q.msg.length > 40; (big ? sfx.done : sfx.pick)(); hud.whisper(q.msg, big ? 9 : 2); }

    // the view: held keys turn it steadily, the mouse turns it as it is dragged, it zooms in steps
    rig.turn(input.heldTurn() * 2.2 * dt + input.turnDelta); input.turnDelta = 0;
    if (input.tiltDelta) { rig.tiltBy(input.tiltDelta); input.tiltDelta = 0; }
    if (input.zoomDelta) { rig.zoom(input.zoomDelta); input.zoomDelta = 0; }
    rig.update(dt, child.obj.position, app.clientWidth / Math.max(1, app.clientHeight));
    // the sun follows the child so its shadows are always sharp where you are
    // the sun crosses from east (morning) to west (evening), low early and late
    const sa = Math.max(0.2, Math.min(Math.PI - 0.2, (day.min - 360) / 720 * Math.PI)), sh = Math.max(0.6, Math.sin(sa))   // never so low that poles and palms cast long stripes across the town;
    sun.position.set(px + Math.cos(sa) * 260, py + sh * 260, pz + 80); sun.target.position.set(px, py, pz);
    // the sun itself, low over the sea in the evening: yellow, then deep orange as it goes down
    const eve = Math.max(0, Math.min(1, (day.min - 990) / 130));
    sunDisc.visible = day.min > 900 && day.min < 1150;
    if (sunDisc.visible) {
      const cam = rig.camera.position, dirS = new THREE.Vector3(Math.cos(sa), 0.012 + 0.05 * (1 - eve), 0.12).normalize();
      sunDisc.position.copy(cam).addScaledVector(dirS, 850); sunDisc.scale.setScalar(70 + eve * 40);
      (sunDisc.material as THREE.SpriteMaterial).color.setRGB(1, 0.85 - eve * 0.45, 0.45 - eve * 0.35);
    }
    const camD = rig.camera.position.distanceTo(child.obj.position); const fog = scene.fog as THREE.Fog; fog.near = Math.max(260, camD * 1.5); fog.far = Math.max(900, camD * 4.5);
    if (campaign.active && campaign.cur?.fog && night) { fog.near = Math.max(20, camD * 0.6); fog.far = Math.max(150, camD * 2); }   // the bhoot's fog   // zoomed in close, the haze still starts far off
    let near = '', nd = 1e9;
    for (const p of places) { const dd = Math.hypot(p.X - px, p.Z - pz); if (dd < nd) { nd = dd; near = p.n; } }
    map.reveal(px, pz, 6);
    mapT -= dt;
    if (mapT <= 0) { mapT = 0.1; map.draw(px, pz, rig.yaw, [...(campaign.active ? [{ x: campaign.piece.x, z: campaign.piece.z, name: 'Bell', done: false }] : blackout.target ? [{ ...blackout.target, done: false }] : quests.pins), ...(places2.target ? [{ x: places2.target.x, z: places2.target.z, name: places2.target.name, done: false }] : [])], night); }
    // vehicles, people, demons and quest markers come and go: give the new ones the cartoon look too
    inkT -= dt;
    if (inkT <= 0) { inkT = 0.5; for (const gr of [traffic.group, people.group, monsters.group, quests.group]) toonify(gr, [gr], () => false); }
    const seen = places2.update(px, pz, rig.camera, performance.now() / 1000);
    if (seen) { st.points += 5; hud.whisper(`${seen.name}! ${seen.note}`, 6); }
    // performance: hide what is far away (trees by map square, and small things one by one); the haze hides the rest
    cullT -= dt;
    if (cullT <= 0) {
      cullT = 0.3;
      areaMgr.refresh(px, pz);
      const far = fog.far + 150, near = 320;
      for (const m of treeGroup.children) { const c = m.userData.cell as [number, number] | undefined; if (c) m.visible = Math.hypot(c[0] - px, c[1] - pz) < far + 170; }
      for (const gr of smallStuff) for (const o of gr.children) o.visible = Math.hypot(o.position.x - px, o.position.z - pz) < near || o.position.lengthSq() === 0;
    }
    renderer.render(scene, rig.camera);
    const t = campaign.active ? campaign.piece : blackout.target ?? quests.target;
    const hint = t && (campaign.active || blackout.active || quests.cur?.kind !== 'collect') ? `${Math.round(Math.hypot(t.x - px, t.z - pz) / 10) * 10} m` : '';
    hud.update(dt, renderer, { courage: st.courage, oil: st.oil, points: st.points, time: day.label + (night ? ' · night' : ''), placeName: nd < 400 ? near : '', objective: campaign.active ? campaign.objective : blackout.active ? "Torch dead: follow the only lit street to Uncle's battery shop" : quests.objective, riding: !!traffic.riding, hint });
  };
  (window as unknown as { rkFrame: (dt: number) => void }).rkFrame = frame;   // for tests: run one frame by hand
  // adaptive resolution: draw fewer pixels when frames run slow, more when there is room, so it stays smooth
  let pr = renderer.getPixelRatio(), slow = 0, fast = 0;
  const maxPR = Math.min(2, Math.max(1.5, devicePixelRatio)), minPR = Math.min(1.25, devicePixelRatio);   // never so low it looks blurry
  renderer.setAnimationLoop(() => {
    const dt = clock.getDelta();
    frame(Math.min(0.05, dt));
    if (dt > 1 / 28) { slow++; fast = 0; } else if (dt < 1 / 57) { fast++; slow = 0; }
    if (slow > 60 && pr > minPR) { pr = Math.max(minPR, pr - 0.25); renderer.setPixelRatio(pr); resize(); slow = 0; }
    if (fast > 180 && pr < maxPR) { pr = Math.min(maxPR, pr + 0.25); renderer.setPixelRatio(pr); resize(); fast = 0; }
  });
}

start().catch(e => { const l = document.getElementById('loading'); if (l) l.textContent = 'Could not start: ' + e.message; console.error(e); });
