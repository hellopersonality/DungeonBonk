// Room builder. A room is a rectangle of walkable floor; walls are generated around it
// (1 unit thick, just outside the rectangle) except where doors leave gaps.
//
// Doors are given per side as [from, to] ranges along that side:
//   n = +z side, s = -z side, e = +x side, w = -x side.
// FULL means the whole side is open (used by corridors that join another room).
import { makeBox, WALL_H } from './geometry.js';
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

/** Build a room: walls (with door gaps), floor and ceiling using the theme's materials. */
export function room(name, x0, x1, z0, z1, doors, theme) {
  doors = doors || {};
  const T = 1, wall = (a, b, c, d) => makeBox(a, b, 0, WALL_H, c, d, theme.wall, true);
  const exW = isFull(doors.w) ? 0 : T, exE = isFull(doors.e) ? 0 : T;
  for (const [a, b] of segs(x0 - exW, x1 + exE, doors.s || [])) wall(a, b, z0 - T, z0);
  for (const [a, b] of segs(x0 - exW, x1 + exE, doors.n || [])) wall(a, b, z1, z1 + T);
  for (const [a, b] of segs(z0, z1, doors.w || [])) wall(x0 - T, x0, a, b);
  for (const [a, b] of segs(z0, z1, doors.e || [])) wall(x1, x1 + T, a, b);
  flatPlane(x0, x1, z0, z1, 0, theme.floor, true);
  flatPlane(x0, x1, z0, z1, WALL_H, theme.ceil, false);
  rooms[name] = { name, x0, x1, z0, z1, theme };
  return rooms[name];
}

export const inRoom = (n, p) => { const r = rooms[n]; return !!r && p.x > r.x0 && p.x < r.x1 && p.z > r.z0 && p.z < r.z1; };
export function roomAt(p) {
  for (const n in rooms) if (inRoom(n, p)) return n;
  return null;
}
