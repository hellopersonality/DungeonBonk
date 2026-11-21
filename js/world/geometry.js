// Mesh helpers and the collision world. `solids` is the single list of axis-aligned
// blockers used for movement, enemy sight, the camera and the visibility map.
//
// Solid flags:
//   off      - temporarily disabled (an open gate)
//   camOnly  - blocks the camera and sight but can be walked through (illusory wall)
//   fade     - pillar/ledge: fades instead of blocking the camera or sight
//   gate     - see-through bars
import { clamp } from '../core/util.js';
import { scene } from '../render/renderer.js';

export const WALL_H = 4.2;
export const solids = [];
export const fadeables = [];
/** Ceiling planes and beams: hidden while the camera is above ceiling height (render/camera.js). */
export const ceilings = [];

/** World-space planar UVs so textures line up across neighbouring boxes. */
function planarUV(geo, ox, oy, oz) {
  const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + ox, y = p.getY(i) + oy, z = p.getZ(i) + oz;
    const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i));
    let u, v;
    if (nx > 0.5) { u = z; v = y; } else if (ny > 0.5) { u = x; v = z; } else { u = x; v = y; }
    uv.setXY(i, u * 0.5, v * 0.5);
  }
  uv.needsUpdate = true;
}

/** Axis-aligned textured box in world space. `solid` = true | 'cam' | false. */
export function makeBox(x0, x1, y0, y1, z0, z1, mat, solid) {
  const w = x1 - x0, h = y1 - y0, d = z1 - z0;
  const geo = new THREE.BoxGeometry(w, h, d, Math.max(1, Math.ceil(w)), Math.max(1, Math.ceil(h)), Math.max(1, Math.ceil(d)));
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, cz = (z0 + z1) / 2;
  planarUV(geo, cx, cy, cz);
  const m = new THREE.Mesh(geo, mat);
  m.position.set(cx, cy, cz);
  scene.add(m);
  let s = null;
  if (solid) { s = { x0, x1, z0, z1, h: y1, off: false, camOnly: solid === 'cam' }; solids.push(s); }
  return { m, s };
}

/** A pillar/ledge that turns see-through when it hides the hero. */
export function fadeBox(x0, x1, y0, y1, z0, z1, baseMat) {
  const mat = baseMat.clone(); mat.transparent = true;
  const r = makeBox(x0, x1, y0, y1, z0, z1, mat, true);
  r.s.fade = true;
  fadeables.push({ m: r.m, mat, b: r.s, op: 1 });
  return r;
}

/** Add a plain footprint blocker without a mesh (for props with their own models). */
export function addSolid(x0, x1, z0, z1, h) {
  const s = { x0, x1, z0, z1, h, off: false };
  solids.push(s);
  return s;
}

/** Small local-space box attached to a parent (models and props). */
export function boxM(w, h, d, mat, x, y, z, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}
export function cylM(rt, rb, h, seg, mat, x, y, z, parent) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

// Flat telegraph shapes (lie on the floor, +Z forward)
export function sectorGeo(r0, r1, arc) { const g = new THREE.RingGeometry(r0, r1, 28, 1, Math.PI / 2 - arc / 2, arc); g.rotateX(Math.PI / 2); return g; }
export function circleGeo(r0, r1) { const g = new THREE.RingGeometry(r0, r1, 40, 1); g.rotateX(Math.PI / 2); return g; }
export function lineGeo(w) { const g = new THREE.PlaneGeometry(w, 1); g.translate(0, 0.5, 0); g.rotateX(Math.PI / 2); return g; }
export function teleMat(c) { return new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }); }

// ---------- collision queries ----------

/** Push a circle (p, r) out of every walkable-blocking solid. */
export function collide(p, r) {
  for (const b of solids) {
    if (b.off || b.camOnly) continue;
    const cx = clamp(p.x, b.x0, b.x1), cz = clamp(p.z, b.z0, b.z1);
    const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    if (d2 > 1e-8) { const d = Math.sqrt(d2); p.x = cx + dx / d * r; p.z = cz + dz / d * r; }
    else {
      const l = p.x - b.x0, rr = b.x1 - p.x, t = p.z - b.z0, bb = b.z1 - p.z, m = Math.min(l, rr, t, bb);
      if (m === l) p.x = b.x0 - r; else if (m === rr) p.x = b.x1 + r; else if (m === t) p.z = b.z0 - r; else p.z = b.z1 + r;
    }
  }
}

/** Enemy line of sight (ignores low props). */
export function los(ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, n = Math.ceil(Math.hypot(dx, dz) / 0.5);
  for (let i = 1; i < n; i++) {
    const k = i / n, x = ax + dx * k, z = az + dz * k;
    for (const b of solids) {
      if (b.off || b.h < 1.2) continue;
      if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1) return false;
    }
  }
  return true;
}

/** Full-height walls only (used by the camera and projectiles). */
export const isWall = b => !b.off && !b.fade && !b.gate && b.h >= WALL_H - 0.1;
export function camBlocked(p, pad) {
  if (p.y > WALL_H - 0.12 || p.y < 0.12) return true;
  for (const b of solids) {
    if (!isWall(b)) continue;
    if (p.x > b.x0 - pad && p.x < b.x1 + pad && p.z > b.z0 - pad && p.z < b.z1 + pad) return true;
  }
  return false;
}

/** Does segment A→B (top-down) cross rect b (expanded by pad)? */
export function segHitsRect(ax, az, bx, bz, b, pad) {
  let t0 = 0, t1 = 1;
  const dx = bx - ax, dz = bz - az;
  for (const [p, d, lo, hi] of [[ax, dx, b.x0 - pad, b.x1 + pad], [az, dz, b.z0 - pad, b.z1 + pad]]) {
    if (Math.abs(d) < 1e-6) { if (p < lo || p > hi) return false; }
    else {
      let ta = (lo - p) / d, tb = (hi - p) / d;
      if (ta > tb) [ta, tb] = [tb, ta];
      t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
      if (t0 > t1) return false;
    }
  }
  return true;
}
