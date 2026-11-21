// Skitter: fast crab-like crawler. Circles at mid range, crouches, then lunges along
// a telegraphed line. Hitting it during the crouch cancels the lunge.
import { lerp, turnTo } from '../../core/util.js';
import { S } from '../../core/state.js';
import { SKIT } from '../../data/tuning.js';
import { lineGeo, los } from '../../world/geometry.js';
import { hero } from '../hero.js';
import { hurtHero } from '../../systems/combat.js';
import { enemyBase, resetEnemy } from './registry.js';
import { idleCommon, stepForward, applyKnockback } from './common.js';
import { stubRig, attachSprite } from './sprites.js';

export function makeSkitter(x, z, f) {
  const e = enemyBase('skitter', x, z, f, SKIT);
  stubRig(e); attachSprite(e, 'skitter');
  e.lO = e.T(lineGeo(0.75), 0xd04030, 0.04);
  e.lF = e.T(lineGeo(0.75), 0xff4030, 0.05);
  resetEnemy(e);
  return e;
}

export function updateSkitter(e, c, dt) {
  const LEN = SKIT.SPEED * SKIT.LUNGE * 0.85;
  switch (e.state) {
    case 'idle': idleCommon(e, c, dt, 2); break;
    case 'chase': {
      if (hero.dead || c.fromSpawn > 20) { e.state = 'idle'; break; }
      e.facing = turnTo(e.facing, c.toH, 6 * dt); e.cd -= dt;
      if (c.dist > 5.2) stepForward(e, c, 3.6, dt);
      else { // circle-strafe while waiting to lunge
        const side = Math.sin(S.clock * 0.9 + e.spawn.x) > 0 ? 1 : -1, a = c.toH + side * Math.PI / 2;
        c.p.x += Math.sin(a) * 2.2 * dt; c.p.z += Math.cos(a) * 2.2 * dt; e.walk += dt * 6;
        if (c.dist < 3) stepForward(e, c, -2, dt);
        if (e.cd <= 0 && los(c.p.x, c.p.z, hero.pos.x, hero.pos.z)) { e.state = 'windup'; e.t = 0; }
      }
      break;
    }
    case 'windup': {
      e.t += dt; const k = Math.min(1, e.t / SKIT.WIND);
      if (e.t < SKIT.WIND * 0.65) e.facing = turnTo(e.facing, c.toH, 8 * dt);
      e.body.position.y = -0.12 * k; e.body.rotation.x = -0.25 * k; e.body.position.x = (Math.random() - 0.5) * 0.04;
      e.lO.material.opacity = 0.32; e.lO.scale.set(1, 1, LEN);
      e.lF.material.opacity = 0.2 + 0.35 * k; e.lF.scale.set(1, 1, LEN * k);
      e.eyeMat.color.setRGB(0.3 + 0.7 * k, 0.1, 0.05);
      if (e.t >= SKIT.WIND) { e.state = 'lunge'; e.t = 0; e.hitDone = false; e.lF.material.opacity = 0; e.lO.material.opacity = 0.5; }
      break;
    }
    case 'lunge':
      e.t += dt; stepForward(e, c, SKIT.SPEED, dt);
      e.body.position.y = 0.15; e.body.rotation.x = 0.15;
      e.lO.material.opacity = Math.max(0, 0.5 - e.t * 2);
      if (!e.hitDone && c.dist < 0.4 + e.radius + 0.35) { e.hitDone = true; hurtHero(SKIT.DMG, c.p.x, c.p.z); }
      if (e.t >= SKIT.LUNGE) { e.state = 'recover'; e.t = 0; }
      break;
    case 'recover':
      e.t += dt;
      e.body.position.y = lerp(e.body.position.y, -0.1, dt * 10); e.body.rotation.x = lerp(e.body.rotation.x, 0.3, dt * 10);
      e.lO.material.opacity = 0; e.eyeMat.color.setRGB(0.3, 0.1, 0.05);
      applyKnockback(e, c, dt);
      if (e.t >= SKIT.REC) { e.state = 'chase'; e.cd = 1.0 + Math.random() * 0.6; e.body.position.y = 0; e.body.rotation.x = 0; }
      break;
    case 'stagger':
      e.t += dt; applyKnockback(e, c, dt); e.body.rotation.z = Math.sin(e.t * 30) * 0.2;
      if (e.t > 0.35) { e.state = 'chase'; e.cd = Math.max(e.cd, 0.5); e.body.rotation.set(0, 0, 0); e.body.position.y = 0; }
      break;
  }
  const w = Math.sin(e.walk * 2);
  e.legs.forEach((l, i) => { l.rotation.y = (i % 2 ? w : -w) * 0.4; });
}
