// Shared enemy AI helpers and the humanoid "husk" body used by Husks and the Gatekeeper.
import { angDiff, turnTo } from '../../core/util.js';
import { S } from '../../core/state.js';
import { boxM } from '../../world/geometry.js';
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

/**
 * Hunched humanoid with a club arm. opts.armored adds plate, helm, horns, cape and a
 * maul (the Gatekeeper). Sets e.upper, e.arm, e.lL, e.lR, e.eyeMat.
 */
export function buildHuskBody(e, o) {
  const mdl = e.model, M = e.M;
  const skin = M(o.skin), rag = M(o.rag), bone = M(o.bone || 0xcfc6a8), darkSkin = M(o.darkSkin || 0x3a4030);
  const leg = x => { const g = new THREE.Group(); g.position.set(x, 0.82, 0); mdl.add(g); boxM(0.3, 0.62, 0.3, rag, 0, -0.31, 0, g); boxM(0.32, 0.22, 0.4, darkSkin, 0, -0.71, 0.05, g); return g; };
  e.lL = leg(0.26); e.lR = leg(-0.26);
  e.upper = new THREE.Group(); e.upper.position.y = 0.82; e.upper.rotation.x = 0.42; mdl.add(e.upper);
  const U = e.upper;
  boxM(0.95, 0.95, 0.62, skin, 0, 0.48, 0, U);
  boxM(1.0, 0.3, 0.66, rag, 0, 0.1, 0, U);
  e.eyeMat = new THREE.MeshBasicMaterial({ color: 0x401010 });
  if (o.armored) {
    const steel = M(0x5e5e68), dark = M(0x34343a), cape = M(0x4a1414);
    boxM(0.88, 0.7, 0.1, steel, 0, 0.55, 0.33, U);
    boxM(0.4, 0.06, 0.02, dark, 0, 0.62, 0.39, U);
    [-0.6, 0.6].forEach(x => { boxM(0.45, 0.26, 0.64, steel, x, 0.98, 0, U); boxM(0.47, 0.06, 0.66, dark, x, 0.86, 0, U); });
    boxM(0.95, 1.25, 0.06, cape, 0, 0.35, -0.35, U).rotation.x = 0.12;
    e.head = boxM(0.52, 0.52, 0.52, steel, 0, 1.15, 0.2, U);
    boxM(0.4, 0.05, 0.02, e.eyeMat, 0, 1.17, 0.47, U);
    boxM(0.12, 0.45, 0.12, bone, 0.26, 1.5, 0.2, U).rotation.z = -0.45;
    boxM(0.12, 0.45, 0.12, bone, -0.26, 1.5, 0.2, U).rotation.z = 0.45;
  } else {
    for (let i = 0; i < 3; i++) boxM(0.7 - i * 0.08, 0.05, 0.02, darkSkin, 0, 0.35 + i * 0.16, 0.32, U); // ribs
    for (let i = 0; i < 3; i++) { const s = boxM(0.1, 0.42, 0.1, bone, (i - 1) * 0.22, 0.75, -0.3, U); s.rotation.x = -0.7; } // spine spikes
    e.head = boxM(0.46, 0.42, 0.46, M(o.head), 0, 1.14, 0.22, U);
    boxM(0.36, 0.12, 0.3, darkSkin, 0, 0.9, 0.3, U); // slack jaw
    boxM(0.08, 0.06, 0.02, e.eyeMat, 0.1, 1.18, 0.46, U);
    boxM(0.08, 0.06, 0.02, e.eyeMat, -0.1, 1.18, 0.46, U);
  }
  // dangling off arm
  boxM(0.2, 0.9, 0.2, skin, 0.62, 0.32, 0.08, U);
  boxM(0.24, 0.2, 0.26, darkSkin, 0.62, -0.18, 0.12, U);
  // weapon arm
  e.arm = new THREE.Group(); e.arm.position.set(-0.62, 0.8, 0); U.add(e.arm);
  boxM(0.24, 0.95, 0.24, skin, 0, -0.47, 0, e.arm);
  if (o.armored) {
    const steel = M(0x5e5e68);
    boxM(0.12, 0.5, 0.12, M(0x3a2a1a), 0, -1.05, 0, e.arm);
    boxM(0.75, 0.5, 0.5, steel, 0, -1.35, 0, e.arm);
    boxM(0.8, 0.08, 0.55, M(0x34343a), 0, -1.12, 0, e.arm);
  } else {
    const club = M(0x4a3a2a), spike = M(0x8a8a90);
    boxM(0.46, 0.66, 0.46, club, 0, -1.1, 0, e.arm);
    boxM(0.12, 0.12, 0.6, spike, 0, -1.2, 0, e.arm);
    boxM(0.6, 0.12, 0.12, spike, 0, -1.0, 0, e.arm);
  }
}
