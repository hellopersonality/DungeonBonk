// Reusable props and interactive level objects. Builders add meshes to the scene and
// register anything that animates. Wall-mounted props take `rot`: the yaw that points
// their local +Z away from the wall into the room (east wall: -PI/2, west: PI/2,
// north: PI, south: 0).
import { scene } from '../render/renderer.js';
import { MAT, TEX } from '../render/textures.js';
import { boxM, cylM, makeBox, addSolid, solids, ceilings, WALL_H } from './geometry.js';
import { rand } from '../core/util.js';

const torches = [], crystals = [], gates = [], waters = [], spinners = [];
export { crystals, gates };

const group = (x, y, z, rot) => { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot || 0; scene.add(g); return g; };

// ---------- light sources ----------
export function torch(x, z, rot, kind) {
  const witch = kind === 'witch';
  const g = group(x, 2.3, z, rot);
  boxM(0.12, 0.42, 0.12, MAT.iron, 0, -0.05, 0.08, g);
  boxM(0.1, 0.08, 0.34, MAT.iron, 0, -0.2, 0.17, g);
  boxM(0.2, 0.14, 0.2, MAT.iron, 0, 0.14, 0.3, g);
  const fl = boxM(0.17, 0.28, 0.17, witch ? MAT.witchFlame : MAT.flame, 0, 0.34, 0.3, g);
  const core = boxM(0.08, 0.16, 0.08, witch ? MAT.witchCore : MAT.flameCore, 0, 0.3, 0.3, g);
  const l = new THREE.PointLight(witch ? 0x50d0c0 : 0xff8840, 1.1, 10, 2);
  l.position.set(0, 0.45, 0.6); g.add(l);
  torches.push({ l, fl, core, seed: Math.random() * 10, base: 1.1 });
}

export function brazier(x, z, withLight) {
  const g = group(x, 0, z);
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; const leg = boxM(0.08, 0.9, 0.08, MAT.iron, Math.cos(a) * 0.32, 0.45, Math.sin(a) * 0.32, g); leg.rotation.z = Math.cos(a) * 0.2; leg.rotation.x = -Math.sin(a) * 0.2; }
  cylM(0.55, 0.32, 0.3, 8, MAT.iron, 0, 0.95, 0, g);
  cylM(0.48, 0.48, 0.06, 8, MAT.coal, 0, 1.08, 0, g);
  const fl = boxM(0.4, 0.5, 0.4, MAT.flame, 0, 1.35, 0, g);
  const core = boxM(0.22, 0.32, 0.22, MAT.flameCore, 0, 1.28, 0, g);
  let l = null;
  if (withLight) { l = new THREE.PointLight(0xff6a30, 1.2, 11, 2); l.position.y = 1.8; g.add(l); }
  torches.push({ l, fl, core, seed: Math.random() * 10, base: 1.2 });
  addSolid(x - 0.45, x + 0.45, z - 0.45, z + 0.45, 1.1);
}

// ---------- save crystal ----------
export function crystal(x, z, name) {
  const g = group(x, 0, z);
  boxM(1.1, 0.18, 1.1, MAT.stone, 0, 0.09, 0, g);
  boxM(0.8, 0.5, 0.8, MAT.stone, 0, 0.43, 0, g);
  boxM(0.95, 0.1, 0.95, MAT.stone, 0, 0.72, 0, g);
  const runeMat = new THREE.MeshBasicMaterial({ color: 0x3a6aa0 });
  [[0, 0.43, 0.41], [0, 0.43, -0.41]].forEach(([a, b, c]) => boxM(0.3, 0.06, 0.02, runeMat, a, b, c, g));
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), new THREE.MeshLambertMaterial({ color: 0x6fb8ff, emissive: 0x1a4a90 }));
  gem.position.y = 1.45; gem.scale.y = 1.35; g.add(gem);
  const shards = new THREE.Group(); shards.position.y = 1.45; g.add(shards);
  for (let i = 0; i < 3; i++) { const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.1, 0), gem.material); const a = i / 3 * Math.PI * 2; s.position.set(Math.cos(a) * 0.7, 0, Math.sin(a) * 0.7); shards.add(s); }
  const l = new THREE.PointLight(0x5fa8ff, 1.3, 9, 2); l.position.y = 1.5; g.add(l);
  addSolid(x - 0.5, x + 0.5, z - 0.5, z + 0.5, 0.8);
  const c = { x, z, name, gem, shards, l };
  crystals.push(c);
  return c;
}

// ---------- gates ----------
const barGeo = new THREE.BoxGeometry(0.09, WALL_H, 0.09);
export function gate(x0, x1, z0, z1, open) {
  const g = new THREE.Group(); scene.add(g);
  const alongX = (x1 - x0) > (z1 - z0), len = alongX ? x1 - x0 : z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  for (let t = 0.18; t < len; t += 0.34) {
    const b = new THREE.Mesh(barGeo, MAT.iron);
    b.position.set(alongX ? x0 + t : cx, WALL_H / 2, alongX ? cz : z0 + t); g.add(b);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 4), MAT.iron);
    tip.position.set(b.position.x, -0.08, b.position.z); tip.rotation.x = Math.PI; g.add(tip);
  }
  [0.7, 2.4].forEach(y => { const b = new THREE.Mesh(new THREE.BoxGeometry(alongX ? len : 0.12, 0.12, alongX ? 0.12 : len), MAT.iron); b.position.set(cx, y, cz); g.add(b); });
  const s = { x0, x1, z0, z1, h: WALL_H, off: !!open, gate: true };
  solids.push(s);
  const gt = { g, s, open: !!open, y: open ? WALL_H - 0.25 : 0 };
  g.position.y = gt.y;
  gates.push(gt);
  return gt;
}
export function setGate(gt, open) { gt.open = open; gt.s.off = open; }

// ---------- furniture and clutter ----------
export function barrel(x, z, solid = true) {
  const g = group(x, 0, z, rand(0, 6));
  cylM(0.34, 0.34, 0.85, 8, MAT.wood, 0, 0.43, 0, g);
  cylM(0.36, 0.36, 0.06, 8, MAT.iron, 0, 0.18, 0, g);
  cylM(0.36, 0.36, 0.06, 8, MAT.iron, 0, 0.68, 0, g);
  cylM(0.3, 0.3, 0.02, 8, MAT.darkWood, 0, 0.86, 0, g);
  if (solid) addSolid(x - 0.35, x + 0.35, z - 0.35, z + 0.35, 0.9);
}
export function crate(x, z, size = 0.7, rot = 0, solid = true) {
  const g = group(x, 0, z, rot);
  boxM(size, size, size, MAT.wood, 0, size / 2, 0, g);
  boxM(size + 0.02, 0.08, size + 0.02, MAT.darkWood, 0, size - 0.04, 0, g);
  boxM(size + 0.02, 0.08, size + 0.02, MAT.darkWood, 0, 0.04, 0, g);
  if (solid) addSolid(x - size / 2, x + size / 2, z - size / 2, z + size / 2, size);
  return g;
}
export function bench(x, z, rot, len = 1.8) {
  const g = group(x, 0, z, rot);
  boxM(len, 0.08, 0.45, MAT.wood, 0, 0.48, 0, g);
  [-len / 2 + 0.15, len / 2 - 0.15].forEach(o => boxM(0.1, 0.44, 0.4, MAT.darkWood, o, 0.22, 0, g));
  const alongX = Math.abs(Math.sin(rot || 0)) < 0.5;
  const hx = alongX ? len / 2 : 0.25, hz = alongX ? 0.25 : len / 2;
  addSolid(x - hx, x + hx, z - hz, z + hz, 0.5);
}
export function rug(x, z, w, d, rot) {
  const geo = new THREE.PlaneGeometry(w, d); geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, MAT.rug); m.position.set(x, 0.015, z); m.rotation.y = rot || 0; scene.add(m);
}
export function banner(x, z, rot, mat, h = 2.0) {
  const g = group(x, 0, z, rot);
  boxM(1.2, 0.07, 0.07, MAT.darkWood, 0, 3.55, 0.12, g);
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.0, h, 1, 4), mat);
  cloth.position.set(0, 3.5 - h / 2, 0.08); g.add(cloth);
  boxM(0.06, 0.06, 0.06, MAT.gold, -0.62, 3.55, 0.12, g); boxM(0.06, 0.06, 0.06, MAT.gold, 0.62, 3.55, 0.12, g);
}
export function chain(x, z, len = 1.6) {
  const g = group(x, WALL_H, z);
  for (let i = 0; i < len / 0.18; i++) { const l = boxM(0.05, 0.16, 0.1, MAT.iron, 0, -0.09 - i * 0.18, 0, g); l.rotation.y = i % 2 ? Math.PI / 2 : 0; }
  boxM(0.12, 0.2, 0.04, MAT.iron, 0, -len - 0.1, 0, g);
  spinners.push({ o: g, sway: true, seed: Math.random() * 10 });
}
export function skull(x, y, z, rot) {
  const g = group(x, y, z, rot);
  boxM(0.22, 0.2, 0.24, MAT.bone, 0, 0.1, 0, g);
  boxM(0.18, 0.06, 0.14, MAT.bone, 0, -0.02, 0.06, g);
  const dark = new THREE.MeshBasicMaterial({ color: 0x100c08 });
  boxM(0.05, 0.05, 0.02, dark, 0.05, 0.12, 0.12, g); boxM(0.05, 0.05, 0.02, dark, -0.05, 0.12, 0.12, g);
}
export function bones(x, z, n = 5) {
  for (let i = 0; i < n; i++) {
    const b = boxM(0.05, 0.05, rand(0.3, 0.55), MAT.bone, x + rand(-0.5, 0.5), 0.03, z + rand(-0.5, 0.5), scene);
    b.rotation.y = rand(0, 6); b.rotation.z = rand(-0.2, 0.2);
  }
  if (Math.random() < 0.7) skull(x + rand(-0.3, 0.3), 0, z + rand(-0.3, 0.3), rand(0, 6));
}
export function rubble(x, z, n = 6, spread = 0.8) {
  for (let i = 0; i < n; i++) {
    const s = rand(0.12, 0.35);
    const r = boxM(s, s * rand(0.5, 1), s, MAT.rubble, x + rand(-spread, spread), s * 0.35, z + rand(-spread, spread), scene);
    r.rotation.set(rand(-0.4, 0.4), rand(0, 6), rand(-0.4, 0.4));
  }
}
export function statue(x, z, rot, broken = true) {
  const g = group(x, 0, z, rot);
  boxM(1.2, 0.5, 1.2, MAT.stone, 0, 0.25, 0, g);
  boxM(1.0, 0.15, 1.0, MAT.stone, 0, 0.57, 0, g);
  boxM(0.3, 1.1, 0.3, MAT.stone, -0.18, 1.2, 0, g); boxM(0.3, 1.1, 0.3, MAT.stone, 0.18, 1.2, 0, g);
  boxM(0.8, 1.1, 0.45, MAT.stone, 0, 2.3, 0, g);
  boxM(0.25, 0.9, 0.25, MAT.stone, 0.55, 2.3, 0.05, g);
  if (!broken) boxM(0.4, 0.45, 0.4, MAT.stone, 0, 3.1, 0, g);
  else { boxM(0.25, 0.25, 0.25, MAT.stone, 0.4, 0.15, 0.9, g).rotation.set(0.4, 0.6, 0.2); boxM(0.25, 0.5, 0.25, MAT.stone, -0.7, 0.13, 0.5, g).rotation.set(1.5, 0.3, 0); }
  addSolid(x - 0.6, x + 0.6, z - 0.6, z + 0.6, 3);
}
export function weaponRack(x, z, rot) {
  const g = group(x, 0, z, rot);
  boxM(1.6, 0.08, 0.3, MAT.darkWood, 0, 0.9, 0.15, g);
  boxM(1.6, 0.08, 0.3, MAT.darkWood, 0, 0.2, 0.15, g);
  [-0.75, 0.75].forEach(o => boxM(0.08, 1.2, 0.08, MAT.darkWood, o, 0.6, 0.15, g));
  [-0.45, 0, 0.45].forEach((o, i) => {
    const w = new THREE.Group(); w.position.set(o, 0.1, 0.25); w.rotation.z = (i - 1) * 0.08; g.add(w);
    boxM(0.05, 1.5, 0.05, MAT.darkWood, 0, 0.75, 0, w);
    if (i === 1) boxM(0.25, 0.2, 0.04, MAT.steel, 0, 1.55, 0, w); else boxM(0.06, 0.35, 0.02, MAT.steel, 0, 1.65, 0, w);
  });
  addSolid(x - 0.4, x + 0.4, z - 0.4, z + 0.4, 1.2);
}
/** Pipe running along a wall at height y, from a to b along the wall's axis. */
export function pipe(axis, fixed, a, b, y) {
  const len = Math.abs(b - a), mid = (a + b) / 2;
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, len, 6), MAT.steel);
  if (axis === 'x') { m.rotation.z = Math.PI / 2; m.position.set(mid, y, fixed); } else { m.rotation.x = Math.PI / 2; m.position.set(fixed, y, mid); }
  scene.add(m);
  for (let t = Math.min(a, b) + 1; t < Math.max(a, b); t += 2.5) {
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.12, 6), MAT.iron);
    if (axis === 'x') { r.rotation.z = Math.PI / 2; r.position.set(t, y, fixed); } else { r.rotation.x = Math.PI / 2; r.position.set(fixed, y, t); }
    scene.add(r);
  }
}
export function moss(x, z, r) {
  for (let i = 0; i < 4; i++) {
    const geo = new THREE.PlaneGeometry(rand(0.5, 1.1) * r, rand(0.5, 1.1) * r); geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, MAT.moss); m.position.set(x + rand(-r, r) * 0.5, 0.012 + i * 0.002, z + rand(-r, r) * 0.5); m.rotation.y = rand(0, 3); scene.add(m);
  }
}
export function roots(x, z, n = 4) {
  for (let i = 0; i < n; i++) {
    const len = rand(0.8, 2.0);
    const r = boxM(0.07, len, 0.07, MAT.rope, x + rand(-0.6, 0.6), WALL_H - len / 2, z + rand(-0.6, 0.6), scene);
    r.rotation.set(rand(-0.25, 0.25), rand(0, 3), rand(-0.25, 0.25));
  }
}
export function ceilingBeams(x0, x1, z0, z1, axis = 'x', every = 3) {
  if (axis === 'x') for (let z = z0 + every / 2; z < z1; z += every) ceilings.push(makeBox(x0, x1, WALL_H - 0.3, WALL_H, z - 0.15, z + 0.15, MAT.darkWood, false).m);
  else for (let x = x0 + every / 2; x < x1; x += every) ceilings.push(makeBox(x - 0.15, x + 0.15, WALL_H - 0.3, WALL_H, z0, z1, MAT.darkWood, false).m);
}

// ---------- level features ----------
export function forge(x, z) {
  const g = group(x, 0, z);
  boxM(1.5, 0.8, 1.0, MAT.stone, 0, 0.4, 0, g);
  boxM(1.2, 0.1, 0.7, MAT.coal, 0, 0.82, 0, g);
  for (let i = 0; i < 6; i++) boxM(0.14, 0.1, 0.14, MAT.iron, rand(-0.5, 0.5), 0.86, rand(-0.25, 0.25), g);
  boxM(1.0, 0.25, 0.8, MAT.stone, 0, 2.3, 0, g);
  boxM(0.7, 1.7, 0.6, MAT.stone, 0, 3.3, 0, g);
  const glow = new THREE.PointLight(0xff6a20, 0.7, 5, 2); glow.position.set(0, 1.2, 0.7); g.add(glow);
  // anvil
  const a = group(x - 1.6, 0, z + 0.1, 0.3);
  boxM(0.35, 0.45, 0.3, MAT.iron, 0, 0.22, 0, a);
  boxM(0.7, 0.18, 0.32, MAT.steel, 0, 0.54, 0, a);
  boxM(0.25, 0.12, 0.2, MAT.steel, 0.42, 0.56, 0, a);
  addSolid(x - 0.75, x + 0.75, z - 0.5, z + 0.5, 0.9);
  addSolid(x - 2.0, x - 1.2, z - 0.3, z + 0.5, 0.6);
  torches.push({ l: glow, fl: null, core: null, seed: 3, base: 0.7 });
}

export function pool(x0, x1, z0, z1) {
  makeBox(x0, x1, 0, 0.28, z0, z1, MAT.stone, true);
  const w = x1 - x0 - 0.4, d = z1 - z0 - 0.4;
  const tex = TEX.water.clone(); tex.needsUpdate = true; tex.repeat.set(w / 2, d / 2);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d, 6, 6), new THREE.MeshLambertMaterial({ map: tex, emissive: 0x061418, transparent: true, opacity: 0.9 }));
  m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, 0.3, (z0 + z1) / 2); scene.add(m);
  waters.push({ m, tex });
}

export function sigilDoor(x, z, rot) {
  const g = group(x, 0, z, rot);
  boxM(3.2, 3.4, 0.12, MAT.iron, 0, 1.7, 0.02, g);
  for (let i = -1; i <= 1; i++) boxM(0.08, 3.3, 0.06, MAT.steel, i * 1.0, 1.7, 0.1, g);
  const sig = new THREE.MeshBasicMaterial({ color: 0x8a50d0 });
  boxM(0.12, 1.2, 0.04, sig, 0, 1.8, 0.12, g); boxM(0.9, 0.12, 0.04, sig, 0, 2.1, 0.12, g); boxM(0.6, 0.12, 0.04, sig, 0, 1.4, 0.12, g);
  boxM(3.6, 0.3, 0.3, MAT.stone, 0, 3.5, 0.1, g);
  [-1.7, 1.7].forEach(o => boxM(0.3, 3.6, 0.3, MAT.stone, o, 1.8, 0.1, g));
}

export function ledgeWithChest(x0, x1, z0, z1, h, railX) {
  for (let z = z0 + 0.2; z <= z1 - 0.15; z += 0.8) boxM(0.1, 0.7, 0.1, MAT.darkWood, railX, h + 0.35, z, scene);
  boxM(0.08, 0.08, z1 - z0 - 0.1, MAT.darkWood, railX, h + 0.7, (z0 + z1) / 2, scene);
  const ch = group((x0 + railX) / 2 - 0.1, h, (z0 + z1) / 2, Math.PI / 2);
  boxM(0.9, 0.5, 0.6, MAT.wood, 0, 0.25, 0, ch);
  boxM(0.94, 0.12, 0.64, MAT.gold, 0, 0.5, 0, ch);
  boxM(0.12, 0.16, 0.04, MAT.gold, 0, 0.38, 0.32, ch);
}

export function emberCache(x, z) {
  const g = group(x, 0, z);
  const em = new THREE.MeshBasicMaterial({ color: 0xffa040 });
  for (let i = 0; i < 9; i++) { const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), em); m.position.set(rand(-0.35, 0.35), 0.12 + Math.random() * 0.3, rand(-0.35, 0.35)); g.add(m); }
  const l = new THREE.PointLight(0xff9040, 0.8, 4, 2); l.position.y = 0.6; g.add(l);
  spinners.push({ o: g, spin: 1 });
  return g;
}

// ---------- animation ----------
export function updateProps(now, dt) {
  for (const t of torches) {
    const f = 0.85 + Math.sin(now * 0.013 + t.seed) * 0.1 + Math.sin(now * 0.031 + t.seed * 2) * 0.08;
    if (t.l) t.l.intensity = t.base * f;
    if (t.fl) { t.fl.scale.y = 0.8 + f * 0.4; t.fl.rotation.y += dt * 2; }
    if (t.core) t.core.scale.y = 0.7 + f * 0.5;
  }
  for (const c of crystals) {
    c.gem.rotation.y += dt * 0.9;
    c.gem.position.y = 1.45 + Math.sin(now * 0.002 + c.x) * 0.08;
    c.shards.rotation.y -= dt * 0.6; c.shards.position.y = c.gem.position.y;
    c.l.intensity = 1.2 + Math.sin(now * 0.003 + c.x) * 0.2;
  }
  for (const g of gates) {
    const ty = g.open ? WALL_H - 0.25 : 0;
    g.y += (ty - g.y) * Math.min(1, dt * (g.open ? 1.5 : 8));
    g.g.position.y = g.y;
  }
  for (const w of waters) { w.tex.offset.x = now * 0.00004; w.tex.offset.y = Math.sin(now * 0.0005) * 0.05; w.m.position.y = 0.3 + Math.sin(now * 0.0015) * 0.02; }
  for (const s of spinners) {
    if (s.spin) s.o.rotation.y += dt * s.spin;
    if (s.sway) s.o.rotation.z = Math.sin(now * 0.001 + s.seed) * 0.04;
  }
}
