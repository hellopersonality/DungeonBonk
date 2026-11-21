// Shared enemy AI helpers.
import { angDiff, turnTo } from '../../core/util.js';
import { S } from '../../core/state.js';
import { los } from '../../world/geometry.js';
import { hero } from '../hero.js';

/** Per-frame context: position, distance and angle to the hero. */
export function ctxFor(e) {
  const p = e.root.position, dx = hero.pos.x - p.x, dz = hero.pos.z - p.z;
  return { p, dx, dz, dist: Math.hypot(dx, dz), toH: Math.atan2(dx, dz), fromSpawn: Math.hypot(p.x - e.spawn.x, p.z - e.spawn.z) };
}

/** Idle: wake when the hero is close and visible, otherwise drift home. */
export function idleCommon(e, c, dt, speed) {
  const canSee = e.type === 'boss' ? S.bossFight : los(c.p.x, c.p.z, hero.pos.x, hero.pos.z);
  if (!hero.dead && c.dist < e.aggro && canSee) { e.state = 'chase'; e.cd = Math.max(e.cd, 0.3); return true; }
  if (c.fromSpawn > 0.3) {
    const a = Math.atan2(e.spawn.x - c.p.x, e.spawn.z - c.p.z);
    e.facing = turnTo(e.facing, a, 3 * dt);
    c.p.x += Math.sin(e.facing) * speed * dt; c.p.z += Math.cos(e.facing) * speed * dt; e.walk += dt * 3.5;
  } else e.facing = turnTo(e.facing, e.spawnFace, 1.5 * dt);
  return false;
}

export function stepForward(e, c, speed, dt) {
  c.p.x += Math.sin(e.facing) * speed * dt; c.p.z += Math.cos(e.facing) * speed * dt; e.walk += dt * speed * 2.4;
}

export function inCone(e, c, reach, arc, pad) {
  return c.dist < reach + pad && Math.abs(angDiff(e.facing, c.toH)) < arc / 2 + Math.atan2(pad, Math.max(c.dist, 0.5));
}

export function applyKnockback(e, c, dt, damp = 0.85) {
  c.p.x += e.kb.x * dt; c.p.z += e.kb.z * dt; e.kb.multiplyScalar(damp);
}
