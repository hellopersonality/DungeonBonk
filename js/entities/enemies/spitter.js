// Spitter: bloated ranged enemy. Keeps its distance and lobs bile at where you're
// heading; a red circle marks the landing spot. Also owns its projectiles.
import { V3, lerp, turnTo } from '../../core/util.js';
import { S } from '../../core/state.js';
import { av, sfx } from '../../core/audio.js';
import { SPIT } from '../../data/tuning.js';
import { scene } from '../../render/renderer.js';
import { maskMat } from '../../render/visibility.js';
import { circleGeo, teleMat, los } from '../../world/geometry.js';
import { hero } from '../hero.js';
import { hurtHero } from '../../systems/combat.js';
import { enemyBase, resetEnemy } from './registry.js';
import { idleCommon, stepForward, applyKnockback } from './common.js';
import { stubRig, attachSprite } from './sprites.js';

const SAC_IDLE = 0x3a5a18;

export function makeSpitter(x, z, f) {
  const e = enemyBase('spitter', x, z, f, SPIT);
  stubRig(e); attachSprite(e, 'spitter');
  resetEnemy(e);
  return e;
}

export function updateSpitter(e, c, dt) {
  switch (e.state) {
    case 'idle':
      idleCommon(e, c, dt, 1.2);
      e.upper.rotation.x = Math.sin(S.clock * 2 + e.spawn.z) * 0.05;
      break;
    case 'chase': {
      if (hero.dead || c.fromSpawn > 20) { e.state = 'idle'; break; }
      e.facing = turnTo(e.facing, c.toH, 3 * dt); e.cd -= dt;
      const sight = los(c.p.x, c.p.z, hero.pos.x, hero.pos.z);
      if (c.dist < 4.2) { const a = c.toH + Math.PI; c.p.x += Math.sin(a) * 2.4 * dt; c.p.z += Math.cos(a) * 2.4 * dt; e.walk += dt * 5; }
      else if (c.dist > 9 || !sight) stepForward(e, c, 2.0, dt);
      if (sight && c.dist > 2.5 && c.dist < 11 && e.cd <= 0) { e.state = 'windup'; e.t = 0; }
      break;
    }
    case 'windup': {
      e.t += dt; const k = Math.min(1, e.t / SPIT.WIND);
      e.facing = turnTo(e.facing, c.toH, 4 * dt);
      e.sacMat.color.setRGB(0.23 + 0.5 * k, 0.35 + 0.5 * k, 0.1);
      e.upper.rotation.x = -0.3 * k;
      e.model.scale.set(1 + 0.08 * k, 1 - 0.06 * k, 1 + 0.08 * k);
      if (e.t >= SPIT.WIND) { fireSpit(e); e.state = 'recover'; e.t = 0; e.model.scale.set(1, 1, 1); }
      break;
    }
    case 'recover':
      e.t += dt;
      e.sacMat.color.setRGB(0.15, 0.25, 0.08);
      e.upper.rotation.x = lerp(0.35, 0, e.t / SPIT.REC);
      applyKnockback(e, c, dt);
      if (e.t >= SPIT.REC) { e.state = 'chase'; e.cd = 1.4 + Math.random() * 0.6; e.sacMat.color.setHex(SAC_IDLE); }
      break;
    case 'stagger':
      e.t += dt; applyKnockback(e, c, dt, 0.86);
      e.model.scale.set(1, 1, 1); e.sacMat.color.setHex(SAC_IDLE);
      e.upper.rotation.x = -Math.sin(Math.min(1, e.t / 0.3) * Math.PI) * 0.3;
      if (e.t > 0.3) { e.state = 'chase'; e.cd = Math.max(e.cd, 0.6); }
      break;
  }
  const sw = Math.sin(e.walk) * 0.4;
  e.lL.rotation.x = sw; e.lR.rotation.x = -sw;
}

// ---------- projectiles ----------
const projectiles = [];
const spitGeo = new THREE.OctahedronGeometry(0.22, 0);
export const spitMat = new THREE.MeshBasicMaterial({ color: 0x9adf40 });
const ringOGeo = circleGeo(SPIT.R - 0.1, SPIT.R), ringFGeo = circleGeo(0, 1);

function fireSpit(e) {
  const p = e.root.position;
  const tx = hero.pos.x + hero.vel.x * 0.35, tz = hero.pos.z + hero.vel.z * 0.35; // lead the target
  const m = new THREE.Mesh(spitGeo, spitMat); m.position.set(p.x, 1.5, p.z); scene.add(m);
  const o = new THREE.Mesh(ringOGeo, maskMat(teleMat(0xd04030))); o.material.opacity = 0.45; o.position.set(tx, 0.05, tz); scene.add(o);
  const f = new THREE.Mesh(ringFGeo, maskMat(teleMat(0xff4030))); f.position.set(tx, 0.06, tz); scene.add(f);
  projectiles.push({ m, o, f, from: new V3(p.x, 1.5, p.z), to: new V3(tx, 0.2, tz), t: 0 });
}

export function updateProjectiles(dt) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const pr = projectiles[i];
    pr.t += dt; const k = Math.min(1, pr.t / SPIT.FLIGHT);
    pr.m.position.lerpVectors(pr.from, pr.to, k); pr.m.position.y += Math.sin(k * Math.PI) * 2.6; pr.m.rotation.y += dt * 8;
    pr.f.scale.set(SPIT.R * k, 1, SPIT.R * k); pr.f.material.opacity = 0.2 + 0.35 * k;
    if (k >= 1) {
      const d = Math.hypot(hero.pos.x - pr.to.x, hero.pos.z - pr.to.z);
      sfx.splat(av(d));
      if (d < SPIT.R + 0.3) hurtHero(SPIT.DMG, pr.to.x, pr.to.z);
      scene.remove(pr.m, pr.o, pr.f); projectiles.splice(i, 1);
    }
  }
}

export function clearProjectiles() {
  for (const pr of projectiles) scene.remove(pr.m, pr.o, pr.f);
  projectiles.length = 0;
}
