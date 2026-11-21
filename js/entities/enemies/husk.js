// Husk Walker: slow, hunched, telegraphs a wide overhead slam. Can't be staggered
// mid-wind-up; punish it during recovery.
import { lerp, angDiff, turnTo } from '../../core/util.js';
import { S } from '../../core/state.js';
import { HUSK } from '../../data/tuning.js';
import { sectorGeo } from '../../world/geometry.js';
import { hero } from '../hero.js';
import { hurtHero } from '../../systems/combat.js';
import { enemyBase, resetEnemy } from './registry.js';
import { buildHuskBody, idleCommon, stepForward, inCone, applyKnockback } from './common.js';

export function makeHusk(x, z, f) {
  const e = enemyBase('husk', x, z, f, HUSK);
  buildHuskBody(e, { skin: 0x7d8a6a, rag: 0x3a3226, head: 0x66704f, darkSkin: 0x3c4632 });
  e.cO = e.T(sectorGeo(0.4, HUSK.REACH, HUSK.ARC), 0xd04030, 0.04);
  e.cF = e.T(sectorGeo(0.01, 1, HUSK.ARC), 0xff4030, 0.05);
  resetEnemy(e);
  return e;
}

export function updateHusk(e, c, dt) {
  switch (e.state) {
    case 'idle':
      idleCommon(e, c, dt, 1.4);
      e.upper.rotation.x = 0.42 + Math.sin(S.clock * 1.5 + e.spawn.x) * 0.04;
      break;
    case 'chase':
      if (hero.dead || c.fromSpawn > 18) { e.state = 'idle'; break; }
      e.facing = turnTo(e.facing, c.toH, 3.2 * dt);
      if (c.dist > 1.7) stepForward(e, c, 2.1, dt);
      e.cd -= dt;
      if (c.dist < 2.6 && e.cd <= 0 && Math.abs(angDiff(e.facing, c.toH)) < 0.6) { e.state = 'windup'; e.t = 0; }
      e.arm.rotation.x = lerp(e.arm.rotation.x, Math.sin(e.walk) * 0.25, dt * 8);
      break;
    case 'windup': {
      e.t += dt; const k = Math.min(1, e.t / HUSK.WIND);
      if (e.t < HUSK.WIND * 0.6) e.facing = turnTo(e.facing, c.toH, 2.4 * dt);
      e.arm.rotation.x = lerp(0, 2.5, 1 - Math.pow(1 - k, 2));
      e.upper.rotation.x = lerp(0.42, 0.05, k);
      e.cO.material.opacity = 0.3; e.cO.material.color.setHex(0xd04030);
      e.cF.material.opacity = 0.2 + 0.35 * k; e.cF.scale.set(HUSK.REACH * k, 1, HUSK.REACH * k);
      e.eyeMat.color.setRGB(0.25 + 0.75 * k, 0.06, 0.04);
      if (e.t >= HUSK.WIND) {
        if (!hero.dead && inCone(e, c, HUSK.REACH, HUSK.ARC, 0.4)) hurtHero(HUSK.DMG, c.p.x, c.p.z);
        if (c.dist < 8) S.shake = Math.max(S.shake, 0.18);
        e.state = 'recover'; e.t = 0;
        e.cO.material.color.setHex(0xffe0c0); e.cO.material.opacity = 0.7; e.cF.material.opacity = 0;
      }
      break;
    }
    case 'recover':
      e.t += dt;
      e.arm.rotation.x = e.t < 0.08 ? lerp(2.5, -1.0, e.t / 0.08) : lerp(-1.0, 0, (e.t - 0.08) / (HUSK.REC - 0.08));
      e.upper.rotation.x = e.t < 0.08 ? lerp(0.05, 0.85, e.t / 0.08) : lerp(0.85, 0.42, (e.t - 0.08) / (HUSK.REC - 0.08));
      e.cO.material.opacity = Math.max(0, 0.7 - e.t * 3);
      e.eyeMat.color.setRGB(0.25, 0.06, 0.04);
      applyKnockback(e, c, dt);
      if (e.t >= HUSK.REC) { e.state = 'chase'; e.cd = 0.7; }
      break;
    case 'stagger':
      e.t += dt; applyKnockback(e, c, dt, 0.86);
      e.upper.rotation.x = 0.42 - Math.sin(Math.min(1, e.t / 0.3) * Math.PI) * 0.3;
      if (e.t > 0.3) e.state = 'chase';
      break;
  }
  const sw = Math.sin(e.walk) * 0.4;
  e.lL.rotation.x = sw; e.lR.rotation.x = -sw;
}
