// Enemy registry: creation, reset, per-frame dispatch to each type's AI.
// To add an enemy type: create a module with make<Type>() and update<Type>(), then
// add it to UPDATERS below (and to WIND_TIME if it has a wind-up sound).
import { V3, lerp } from '../../core/util.js';
import { av, sfx } from '../../core/audio.js';
import { HUSK, SKIT, SPIT } from '../../data/tuning.js';
import { scene } from '../../render/renderer.js';
import { TEX } from '../../render/textures.js';
import { collide, teleMat } from '../../world/geometry.js';
import { rumble } from '../../input/gamepad.js';
import { ctxFor } from './common.js';
import { updateHusk } from './husk.js';
import { updateSkitter } from './skitter.js';
import { updateSpitter } from './spitter.js';
import { updateBoss } from './gatekeeper.js';

export const enemies = [];
/** The current region's boss (set by its make function). */
export const bossRef = { e: null };

const UPDATERS = { husk: updateHusk, skitter: updateSkitter, spitter: updateSpitter, boss: updateBoss };
const WIND_TIME = { husk: HUSK.WIND, skitter: SKIT.WIND, spitter: SPIT.WIND };

/** Common enemy object. `o` = stats from data/tuning.js. */
export function enemyBase(type, sx, sz, face, o) {
  const root = new THREE.Group(); scene.add(root);
  const model = new THREE.Group(); root.add(model);
  const e = {
    type, root, model, mats: [], tele: [],
    spawn: new V3(sx, 0, sz), spawnFace: face, facing: face,
    state: 'idle', t: 0, cd: 0, flash: 0, kb: new V3(), walk: 0,
    hp: o.hp, maxHp: o.hp, radius: o.radius, height: o.height, embers: o.embers, aggro: o.aggro || 9,
  };
  /** Material that flashes white when the enemy is hit. */
  e.M = c => { const m = new THREE.MeshLambertMaterial({ map: TEX.noise, color: c }); e.mats.push(m); return m; };
  /** Telegraph mesh on the floor. */
  e.T = (geo, c, y) => { const m = new THREE.Mesh(geo, teleMat(c)); m.position.y = y; root.add(m); e.tele.push(m); return m; };
  enemies.push(e);
  return e;
}

export function resetEnemy(e) {
  e.root.position.copy(e.spawn); e.root.visible = true; e.root.rotation.set(0, 0, 0);
  e.hp = e.maxHp; e.state = 'idle'; e.t = 0; e.facing = e.spawnFace; e.cd = 0; e.flash = 0;
  e.kb.set(0, 0, 0); e.spin = 0; e.phase2 = false; e.combo = false; e.hitDone = false; e.burnCd = 0;
  if (e.arm) e.arm.rotation.set(0, 0, 0);
  if (e.upper) e.upper.rotation.set(e.type === 'spitter' ? 0 : 0.42, 0, 0);
  if (e.body) { e.body.position.set(0, 0, 0); e.body.rotation.set(0, 0, 0); }
  e.model.position.y = 0; e.model.scale.setScalar(e.baseScale || 1);
  e.tele.forEach(m => { m.material.opacity = 0; });
}

export function resetEnemies() { enemies.forEach(resetEnemy); }

function updateEnemy(e, dt) {
  if (e.state === 'dead') {
    e.t += dt;
    e.root.rotation.z = lerp(0, 1.4, Math.min(1, e.t * 2.5));
    e.root.position.y = -Math.max(0, e.t - 0.6) * 0.9;
    if (e.t > 2) e.root.visible = false;
    return;
  }
  const c = ctxFor(e);
  if (c.dist > 34 && e.state === 'idle') return; // far away and asleep
  if (e.flash > 0) e.flash -= dt;
  const fl = e.flash > 0 ? 0x777777 : 0;
  for (const m of e.mats) m.emissive.setHex(fl);
  const prev = e.state;
  UPDATERS[e.type](e, c, dt);
  if (prev !== e.state && e.state !== 'dead') enemySound(e, prev, c.dist);
  collide(c.p, e.radius);
  e.root.rotation.y = e.facing;
}

function enemySound(e, prev, dist) {
  const v = av(dist); if (v <= 0) return;
  const st = e.state;
  if (st === 'windup') sfx.windup(e.type, e.type === 'boss' ? e.wind : WIND_TIME[e.type], v);
  else if (prev === 'windup' && (st === 'recover' || st === 'combo')) {
    if (e.type === 'spitter') sfx.spit(v);
    else if (e.type !== 'skitter') { sfx.slam(v * (e.type === 'boss' ? 1.2 : 0.8)); if (v > 0.5) rumble(0.25 * v, 90); }
  }
  else if (st === 'lunge') sfx.lunge(v);
  else if (st === 'roar') sfx.roar();
}

function separateEnemies() {
  for (let i = 0; i < enemies.length; i++) for (let j = i + 1; j < enemies.length; j++) {
    const a = enemies[i], b = enemies[j];
    if (a.state === 'dead' || b.state === 'dead') continue;
    const pa = a.root.position, pb = b.root.position;
    const dx = pb.x - pa.x, dz = pb.z - pa.z, d = Math.hypot(dx, dz), r = a.radius + b.radius + 0.05;
    if (d < r && d > 1e-4) {
      const wa = a.type === 'boss' ? 0.1 : b.type === 'boss' ? 0.9 : 0.5, k = (r - d) / d;
      pa.x -= dx * k * wa; pa.z -= dz * k * wa; pb.x += dx * k * (1 - wa); pb.z += dz * k * (1 - wa);
    }
  }
}

export function updateEnemies(dt) {
  for (const e of enemies) updateEnemy(e, dt);
  separateEnemies();
}
