// Room builder. A room is a rectangle of walkable floor; walls are generated around it
// (1 unit thick, just outside the rectangle) except where doors leave gaps.
//
// Doors are given per side as [from, to] ranges along that side:
//   n = +z side, s = -z side, e = +x side, w = -x side.
// FULL means the whole side is open (used by corridors that join another room).
import { makeBox, ceilings, WALL_H } from './geometry.js';
import { scene } from '../render/renderer.js';

export const FULL = [[-1e9, 1e9]];
export const rooms = {};

function segs(a, b, gaps) {
  let out = [[a, b]];
  for (const [g0, g1] of gaps) {
    const nx = [];
    for (const [s0, s1] of out) {
      if (g1 <= s0 || g0 >= s1) { nx.push([s0, s1]); continue; }
      if (g0 > s0) nx.push([s0, g0]);
      if (g1 < s1) nx.push([g1, s1]);
    }
    out = nx;
  }
  return out.filter(s => s[1] - s[0] > 0.01);
}
const isFull = g => !!g && g.some(x => x[0] < -1e8);

function flatPlane(x0, x1, z0, z1, y, mat, up) {
  const w = x1 - x0, d = z1 - z0;
  const geo = new THREE.PlaneGeometry(w, d, Math.ceil(w), Math.ceil(d)); // subdivided for vertex lighting
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w * 0.5, uv.getY(i) * d * 0.5);
  geo.rotateX(up ? -Math.PI / 2 : Math.PI / 2);
  const m = new THREE.Mesh(geo, mat);
  m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
  scene.add(m);
  return m;
}

// Wall footprints are collected first and merged in buildWalls(). Neighbouring rooms'
// walls overlap at doorways and corners; emitting them separately would create
// coplanar faces that z-fight (flicker).
const pendingWalls = [];

/** Build a room: floor and ceiling now, walls (with door gaps) queued for buildWalls(). */
export function room(name, x0, x1, z0, z1, doors, theme) {
  doors = doors || {};
  const T = 1, wall = (a, b, c, d) => pendingWalls.push({ x0: a, x1: b, z0: c, z1: d, theme });
  const exW = isFull(doors.w) ? 0 : T, exE = isFull(doors.e) ? 0 : T;
  for (const [a, b] of segs(x0 - exW, x1 + exE, doors.s || [])) wall(a, b, z0 - T, z0);
  for (const [a, b] of segs(x0 - exW, x1 + exE, doors.n || [])) wall(a, b, z1, z1 + T);
  for (const [a, b] of segs(z0, z1, doors.w || [])) wall(x0 - T, x0, a, b);
  for (const [a, b] of segs(z0, z1, doors.e || [])) wall(x1, x1 + T, a, b);
  flatPlane(x0, x1, z0, z1, 0, theme.floor, true);
  ceilings.push(flatPlane(x0, x1, z0, z1, WALL_H, theme.ceil, false));
  rooms[name] = { name, x0, x1, z0, z1, theme };
  return rooms[name];
}

/**
 * Merge every queued wall footprint on a 0.2-unit grid and emit the union as
 * non-overlapping boxes (greedy rectangles). A cell keeps the theme of the first
 * room that claimed it. Call once after all rooms of a region are defined.
 */
export function buildWalls() {
  const G = 5; // cells per unit; all wall edges in our layouts sit on 0.2-unit steps
  const q = v => Math.round(v * G);
  let gx0 = Infinity, gz0 = Infinity, gx1 = -Infinity, gz1 = -Infinity;
  for (const w of pendingWalls) { gx0 = Math.min(gx0, q(w.x0)); gx1 = Math.max(gx1, q(w.x1)); gz0 = Math.min(gz0, q(w.z0)); gz1 = Math.max(gz1, q(w.z1)); }
  const W = gx1 - gx0, D = gz1 - gz0;
  const themes = [], cell = new Int16Array(W * D); // 0 empty, else theme index + 1
  for (const w of pendingWalls) {
    let ti = themes.indexOf(w.theme); if (ti < 0) { themes.push(w.theme); ti = themes.length - 1; }
    for (let z = q(w.z0) - gz0; z < q(w.z1) - gz0; z++)
      for (let x = q(w.x0) - gx0; x < q(w.x1) - gx0; x++)
        if (!cell[z * W + x]) cell[z * W + x] = ti + 1;
  }
  const used = new Uint8Array(W * D);
  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
    const t = cell[z * W + x];
    if (!t || used[z * W + x]) continue;
    let w = 1; while (x + w < W && cell[z * W + x + w] === t && !used[z * W + x + w]) w++;
    let d = 1;
    grow: while (z + d < D) {
      for (let i = 0; i < w; i++) { const k = (z + d) * W + x + i; if (cell[k] !== t || used[k]) break grow; }
      d++;
    }
    for (let j = 0; j < d; j++) for (let i = 0; i < w; i++) used[(z + j) * W + x + i] = 1;
    makeBox((gx0 + x) / G, (gx0 + x + w) / G, 0, WALL_H, (gz0 + z) / G, (gz0 + z + d) / G, themes[t - 1].wall, true);
  }
  pendingWalls.length = 0;
}

export const inRoom = (n, p) => { const r = rooms[n]; return !!r && p.x > r.x0 && p.x < r.x1 && p.z > r.z0 && p.z < r.z1; };
export function roomAt(p) {
  for (const n in rooms) if (inRoom(n, p)) return n;
  return null;
}
