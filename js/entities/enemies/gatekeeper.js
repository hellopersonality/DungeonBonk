// The Gatekeeper (Region 1 boss): armored brute with a maul.
// Phase 1: cone slam; spins (full-circle sweep) if you get behind it.
// Phase 2 (below half health): faster, sweeps more often, slams can chain twice.
import { lerp, angDiff, turnTo } from '../../core/util.js';
import { S } from '../../core/state.js';
import { save } from '../../core/save.js';
import { GK } from '../../data/tuning.js';
import { sectorGeo, circleGeo } from '../../world/geometry.js';
import { inRoom } from '../../world/rooms.js';
import { hero } from '../hero.js';
import { hurtHero } from '../../systems/combat.js';
import { showMsg } from '../../ui/messages.js';
import { enemyBase, resetEnemy, bossRef } from './registry.js';
import { buildHuskBody, idleCommon, stepForward, inCone } from './common.js';

export function makeGatekeeper(x, z, f, arenaRoom) {
  const e = enemyBase('boss', x, z, f, GK);
  e.name = 'THE GATEKEEPER';
  e.arenaRoom = arenaRoom;
  buildHuskBody(e, { skin: 0x8a8070, rag: 0x3a2a2a, head: 0x6a6a70, darkSkin: 0x4a4038, armored: true });
  e.baseScale = 1.7; e.model.scale.setScalar(1.7);
  e.cO = e.T(sectorGeo(0.6, GK.SLAM_R, GK.SLAM_A), 0xd04030, 0.04);
  e.cF = e.T(sectorGeo(0.01, 1, GK.SLAM_A), 0xff4030, 0.05);
  e.rO = e.T(circleGeo(GK.SWEEP_R - 0.12, GK.SWEEP_R), 0xd04030, 0.04);
  e.rF = e.T(circleGeo(0.0, 1), 0xff4030, 0.05);
  resetEnemy(e);
  bossRef.e = e;
  return e;
}

export function updateBoss(e, c, dt) {
  const p2 = e.phase2, spd = p2 ? 1.2 : 1;
  switch (e.state) {
    case 'idle': idleCommon(e, c, dt, 1.6); break;
    case 'chase':
      if (hero.dead) { e.state = 'idle'; break; }
      if (!inRoom(e.arenaRoom, hero.pos) && save.shortcut && c.dist > 16) { e.state = 'idle'; S.bossFight = false; break; }
      e.facing = turnTo(e.facing, c.toH, (p2 ? 3.4 : 2.6) * dt);
      if (c.dist > 2.6) stepForward(e, c, p2 ? 2.9 : 2.3, dt);
      e.arm.rotation.x = lerp(e.arm.rotation.x, Math.sin(e.walk * 0.6) * 0.2, dt * 6);
      e.cd -= dt;
      if (c.dist < 4.0 && e.cd <= 0) {
        const behind = Math.abs(angDiff(e.facing, c.toH)) > 1.5;
        e.attack = (behind || (p2 && Math.random() < 0.4)) ? 'sweep' : 'slam';
        e.wind = e.attack === 'slam' ? GK.SLAM_W / spd : GK.SWEEP_W / spd;
        e.state = 'windup'; e.t = 0; e.combo = false;
      }
      break;
    case 'windup': {
      e.t += dt; const k = Math.min(1, e.t / e.wind);
      e.eyeMat.color.setRGB(0.3 + 0.7 * k, 0.08, 0.05);
      if (e.attack === 'slam') {
        if (e.t < e.wind * 0.6) e.facing = turnTo(e.facing, c.toH, 2.2 * dt);
        e.arm.rotation.x = lerp(0, 2.5, 1 - Math.pow(1 - k, 2)); e.upper.rotation.x = lerp(0.42, 0.0, k);
        e.cO.material.opacity = 0.32; e.cO.material.color.setHex(0xd04030);
        e.cF.material.opacity = 0.2 + 0.35 * k; e.cF.scale.set(GK.SLAM_R * k, 1, GK.SLAM_R * k);
      } else {
        e.arm.rotation.set(0, 0, lerp(0, -1.5, k)); e.upper.rotation.y = lerp(0, 0.9, k); e.upper.rotation.x = 0.3;
        e.rO.material.opacity = 0.32; e.rO.material.color.setHex(0xd04030);
        e.rF.material.opacity = 0.18 + 0.32 * k; e.rF.scale.set(GK.SWEEP_R * k, 1, GK.SWEEP_R * k);
      }
      if (e.t >= e.wind) {
        if (e.attack === 'slam') {
          if (!hero.dead && inCone(e, c, GK.SLAM_R, GK.SLAM_A, 0.4)) hurtHero(GK.SLAM_D, c.p.x, c.p.z);
          e.cO.material.color.setHex(0xffe0c0); e.cO.material.opacity = 0.8; e.cF.material.opacity = 0;
        } else {
          if (!hero.dead && c.dist < GK.SWEEP_R + 0.4) hurtHero(GK.SWEEP_D, c.p.x, c.p.z);
          e.rO.material.color.setHex(0xffe0c0); e.rO.material.opacity = 0.8; e.rF.material.opacity = 0; e.spin = Math.PI * 2;
        }
        S.shake = Math.max(S.shake, c.dist < 10 ? 0.3 : 0.1);
        if (e.attack === 'slam' && p2 && !e.combo && Math.random() < 0.5) { e.combo = true; e.state = 'combo'; e.t = 0; }
        else { e.state = 'recover'; e.t = 0; }
      }
      break;
    }
    case 'combo': // brief reset into a fast second slam (phase 2)
      e.t += dt; e.arm.rotation.x = lerp(-1, 0, e.t / 0.25); e.cO.material.opacity = Math.max(0, 0.8 - e.t * 4);
      if (e.t >= 0.25) { e.attack = 'slam'; e.wind = 0.62; e.state = 'windup'; e.t = 0; }
      break;
    case 'recover': {
      e.t += dt; const R = GK.REC / (p2 ? 1.1 : 1);
      if (e.attack === 'slam') {
        e.arm.rotation.x = e.t < 0.08 ? lerp(2.5, -1.0, e.t / 0.08) : lerp(-1.0, 0, (e.t - 0.08) / (R - 0.08));
        e.upper.rotation.x = e.t < 0.08 ? lerp(0, 0.85, e.t / 0.08) : lerp(0.85, 0.42, (e.t - 0.08) / (R - 0.08));
        e.cO.material.opacity = Math.max(0, 0.8 - e.t * 3);
      } else {
        if (e.spin > 0) { e.spin = Math.max(0, e.spin - dt * 22); e.upper.rotation.y = (0.9 + (Math.PI * 2 - e.spin)) % (Math.PI * 2); }
        else { e.upper.rotation.y = lerp(e.upper.rotation.y, 0, dt * 6); e.arm.rotation.z = lerp(e.arm.rotation.z, 0, dt * 6); }
        e.rO.material.opacity = Math.max(0, 0.8 - e.t * 3);
      }
      e.eyeMat.color.setRGB(0.3, 0.08, 0.05);
      if (e.t >= R) { e.state = 'chase'; e.cd = p2 ? 0.45 : 0.8; e.upper.rotation.y = 0; e.arm.rotation.set(0, 0, 0); e.upper.rotation.x = 0.42; }
      break;
    }
    case 'roar':
      e.t += dt;
      e.upper.rotation.x = lerp(0.42, -0.4, Math.min(1, e.t * 4));
      e.eyeMat.color.setRGB(1, 0.2 + Math.sin(e.t * 30) * 0.2, 0.1);
      S.shake = Math.max(S.shake, 0.2);
      if (e.t >= 1.1) { e.state = 'chase'; e.cd = 0.4; e.upper.rotation.x = 0.42; }
      break;
  }
  if (!e.phase2 && e.hp <= GK.hp / 2 && e.state !== 'windup' && e.state !== 'combo') {
    e.phase2 = true; e.state = 'roar'; e.t = 0;
    e.tele.forEach(m => { m.material.opacity = 0; });
    e.arm.rotation.set(0, 0, 0); e.upper.rotation.y = 0;
    showMsg('THE GATEKEEPER RAGES', 'faster · it strikes twice', '#c0392b', 2.2);
  }
  const sw = Math.sin(e.walk * 0.8) * 0.35;
  e.lL.rotation.x = sw; e.lR.rotation.x = -sw;
}
