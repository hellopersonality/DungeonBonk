// Orbit camera. It follows the hero at a fixed distance and is freely rotated around them:
// S.yaw orbits, S.pitch tilts between a low angle and near top-down. The camera never moves to dodge walls: walls between it and the
// hero are cut away with the clip plane, pillars fade, and line-of-sight hides what the
// hero can't see (see visibility.js).
import { V3, lerp, clamp } from '../core/util.js';
import { S } from '../core/state.js';
import { CAM } from '../data/tuning.js';
import { camera, scene } from './renderer.js';
import { clipPlane, updateSight } from './visibility.js';
import { updateBillboards } from './sprites.js';
import { solids, isWall, segHitsRect, fadeables, ceilings, WALL_H } from '../world/geometry.js';
import { hero } from '../entities/hero.js';
import { keyLook } from '../input/input.js';

const target = new V3(), dir = new V3(), pos = new V3(), _p = new V3(), _fwd = new V3();
const dist = CAM.dist;
let clip = 0;

/** Is there a full-height wall at this point? (The camera may sit above the walls.) */
function wallAt(p) {
  if (p.y > WALL_H - 0.12) return false;
  for (const b of solids) {
    if (isWall(b) && p.x > b.x0 && p.x < b.x1 && p.z > b.z0 && p.z < b.z1) return true;
  }
  return false;
}

export function updateCamera(dt) {
  keyLook(dt);
  S.pitch = clamp(S.pitch, CAM.pitchMin, CAM.pitchMax);

  const fx = Math.sin(S.yaw), fz = Math.cos(S.yaw);
  target.set(hero.pos.x, CAM.targetY, hero.pos.z);
  dir.set(fx * Math.cos(S.pitch), -Math.sin(S.pitch), fz * Math.cos(S.pitch));
  pos.copy(target).addScaledVector(dir, -dist);
  pos.y = Math.max(0.5, pos.y);

  // find the first wall between hero and camera; clip everything in front of it
  const rdx = pos.x - target.x, rdy = pos.y - target.y, rdz = pos.z - target.z, rlen = Math.hypot(rdx, rdy, rdz);
  let hitD = -1;
  for (let d = 0.2; d <= rlen; d += 0.05) {
    _p.set(target.x + rdx / rlen * d, target.y + rdy / rlen * d, target.z + rdz / rlen * d);
    if (wallAt(_p)) { hitD = d; break; }
  }
  const want = hitD > 0 ? Math.max(0, rlen - hitD + 0.05) : 0;
  clip = want > clip ? want : lerp(clip, want, Math.min(1, dt * 12));

  if (S.shake > 0) { pos.x += (Math.random() - 0.5) * S.shake * 0.5; pos.y += (Math.random() - 0.5) * S.shake * 0.5; }
  camera.position.copy(pos);
  // tilted high, the camera rises above the ceiling: hide ceilings and beams so you look down into the room
  const above = pos.y > WALL_H - 0.4;
  for (const c of ceilings) c.visible = !above;
  camera.lookAt(target);
  _fwd.set(target.x - pos.x, target.y - pos.y, target.z - pos.z).normalize();
  clipPlane.normal.copy(_fwd);
  clipPlane.constant = -(_fwd.x * pos.x + _fwd.y * pos.y + _fwd.z * pos.z + clip);

  // fog is measured from the camera, so keep it clear of the hero
  scene.fog.near = dist + 2; scene.fog.far = dist + 25;

  updateSight(hero.pos, dt);

  // fade pillars/ledges between the camera and the hero (only if the view ray passes
  // through them below their top, so a high camera sees over low pillars)
  for (const f of fadeables) {
    let hit = false;
    if (f.b.h > 1.2 && segHitsRect(pos.x, pos.z, hero.pos.x, hero.pos.z, f.b, 0.25)) {
      const cx = (f.b.x0 + f.b.x1) / 2, cz = (f.b.z0 + f.b.z1) / 2;
      const sx = hero.pos.x - pos.x, sz = hero.pos.z - pos.z, l2 = sx * sx + sz * sz || 1;
      const t = clamp(((cx - pos.x) * sx + (cz - pos.z) * sz) / l2, 0, 1);
      hit = lerp(pos.y, target.y, t) < f.b.h + 0.3;
    }
    f.op = lerp(f.op, hit ? 0.22 : 1, Math.min(1, dt * 10));
    f.mat.opacity = f.op; f.mat.depthWrite = f.op > 0.95;
  }

  updateBillboards(S.yaw, S.pitch);
}
