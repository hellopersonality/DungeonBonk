// Over-the-shoulder camera. It never zooms: walls between the camera and the hero are
// cut away with the clip plane, pillars fade, and line-of-sight hides what the hero
// can't see (see visibility.js).
import { V3, lerp } from '../core/util.js';
import { S } from '../core/state.js';
import { camera } from './renderer.js';
import { clipPlane, updateSight } from './visibility.js';
import { camBlocked, segHitsRect, fadeables, WALL_H } from '../world/geometry.js';
import { hero } from '../entities/hero.js';
import { keyLook } from '../input/input.js';

const DIST = 4.2, SHOULDER = 0.75, EYE = 1.75;
const target = new V3(), dir = new V3(), pos = new V3(), _p = new V3(), _fwd = new V3();
let shoulder = SHOULDER, clip = 0;

export function updateCamera(dt) {
  keyLook(dt);
  const fx = Math.sin(S.yaw), fz = Math.cos(S.yaw), rx = -fz, rz = fx;

  // shoulder offset slides in when a wall is right beside the hero
  let sh = SHOULDER;
  for (let o = 0.1; o <= SHOULDER; o += 0.05) {
    _p.set(hero.pos.x + rx * o, EYE, hero.pos.z + rz * o);
    if (camBlocked(_p, 0.2)) { sh = Math.max(0, o - 0.2); break; }
  }
  shoulder = lerp(shoulder, sh, Math.min(1, dt * (sh < shoulder ? 9 : 2.5)));
  target.set(hero.pos.x + rx * shoulder, EYE, hero.pos.z + rz * shoulder);
  dir.set(fx * Math.cos(S.pitch), -Math.sin(S.pitch), fz * Math.cos(S.pitch));

  pos.copy(target).addScaledVector(dir, -DIST);
  pos.y = Math.min(WALL_H - 0.35, Math.max(0.3, pos.y));

  // find the first wall between hero and camera; clip everything in front of it
  const rdx = pos.x - target.x, rdy = pos.y - target.y, rdz = pos.z - target.z, rlen = Math.hypot(rdx, rdy, rdz);
  let hitD = -1;
  for (let d = 0.2; d <= rlen; d += 0.05) {
    _p.set(target.x + rdx / rlen * d, target.y + rdy / rlen * d, target.z + rdz / rlen * d);
    if (camBlocked(_p, 0)) { hitD = d; break; }
  }
  const want = hitD > 0 ? Math.max(0, rlen - hitD + 0.05) : 0;
  clip = want > clip ? want : lerp(clip, want, Math.min(1, dt * 12));

  if (S.shake > 0) { pos.x += (Math.random() - 0.5) * S.shake * 0.5; pos.y += (Math.random() - 0.5) * S.shake * 0.5; }
  camera.position.copy(pos);
  const lx = target.x + dir.x * 2, ly = target.y + dir.y * 2, lz = target.z + dir.z * 2;
  camera.lookAt(lx, ly, lz);
  _fwd.set(lx - pos.x, ly - pos.y, lz - pos.z).normalize();
  clipPlane.normal.copy(_fwd);
  clipPlane.constant = -(_fwd.x * pos.x + _fwd.y * pos.y + _fwd.z * pos.z + clip);

  updateSight(hero.pos, dt);

  // fade pillars/ledges between the camera and the hero
  for (const f of fadeables) {
    const hit = f.b.h > 1.2 && segHitsRect(pos.x, pos.z, hero.pos.x, hero.pos.z, f.b, 0.25);
    f.op = lerp(f.op, hit ? 0.22 : 1, Math.min(1, dt * 10));
    f.mat.opacity = f.op; f.mat.depthWrite = f.op > 0.95;
  }
}
