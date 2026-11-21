// The hero: data, model, movement, dash, drinking and the auto-attacking sweep blade.
import { V3, lerp, angDiff } from '../core/util.js';
import { S } from '../core/state.js';
import { save } from '../core/save.js';
import { sfx } from '../core/audio.js';
import { HERO, DASH, FLASK } from '../data/tuning.js';
import { weaponStats, SWING_T, BLADE_GLOW } from '../data/weapons.js';
import { BOON_FX } from '../data/boons.js';
import { scene } from '../render/renderer.js';
import { TEX } from '../render/textures.js';
import { boxM, collide, sectorGeo } from '../world/geometry.js';
import { enemies } from './enemies/registry.js';
import { hitEnemy } from '../systems/combat.js';
import { has, spawnWave, spawnTrail } from '../systems/boons.js';
import { respawn } from '../systems/world.js';
import { moveInput } from '../input/input.js';
import { dmgNum } from '../ui/numbers.js';
import { showHint } from '../ui/messages.js';

export const hero = {
  pos: new V3(0, 0, -5), prev: new V3(0, 0, -5), vel: new V3(),
  hp: HERO.maxHp, st: 100, stDelay: 0,
  roll: 0, rollDir: new V3(), iframes: 0,
  atkCd: 0, swingT: 0, swings: 0,
  hurt: 0, dead: false, deadT: 0, walk: 0,
  carried: 0, flasks: save.flasks,
  drinkT: 0, drinkDone: false,
  boons: new Set(), riposte: false, trailT: 0,
};

/** Current sweep blade stats (updated by applyWeapon). */
export const weapon = { s: weaponStats(save.wlvl), glow: 0 };

const rig = {}; // model parts
const heroMats = [];
const ghosts = [];
let ghostT = 0;

// ---------- model ----------
function HM(c) { const m = new THREE.MeshLambertMaterial({ map: TEX.noise, color: c }); heroMats.push(m); return m; }

export function initHero() {
  const root = new THREE.Group(); scene.add(root);
  const body = new THREE.Group(); root.add(body);
  const leather = HM(0x6a5038), cloth = HM(0x3a2c22), metal = HM(0x8c8c96), dark = HM(0x2a2018);
  const red = HM(0x7a2820), boot = HM(0x2a1e16), gold = HM(0xc8a040);
  const black = new THREE.MeshBasicMaterial({ color: 0x0c0c0c });

  // legs pivot at the hip
  const leg = x => { const g = new THREE.Group(); g.position.set(x, 0.72, 0); body.add(g); boxM(0.22, 0.5, 0.26, cloth, 0, -0.25, 0, g); boxM(0.24, 0.24, 0.32, boot, 0, -0.6, 0.03, g); return g; };
  rig.legL = leg(0.15); rig.legR = leg(-0.15);
  // torso
  boxM(0.62, 0.72, 0.36, leather, 0, 1.07, 0, body);
  boxM(0.5, 0.42, 0.06, metal, 0, 1.17, 0.19, body);
  boxM(0.66, 0.12, 0.4, dark, 0, 0.76, 0, body);
  boxM(0.12, 0.12, 0.06, gold, 0, 0.76, 0.21, body);
  boxM(0.16, 0.18, 0.1, leather, 0.24, 0.68, 0.2, body);
  boxM(0.3, 0.16, 0.42, metal, 0.38, 1.44, 0, body);
  boxM(0.3, 0.16, 0.42, metal, -0.38, 1.44, 0, body);
  // helmet
  boxM(0.44, 0.06, 0.44, metal, 0, 1.48, 0, body);
  boxM(0.4, 0.4, 0.4, metal, 0, 1.68, 0, body);
  boxM(0.32, 0.06, 0.02, black, 0, 1.7, 0.205, body);
  boxM(0.06, 0.14, 0.42, red, 0, 1.94, -0.02, body);
  // cape
  const cape = boxM(0.6, 1.0, 0.05, red, 0, 0.98, -0.23, body); cape.rotation.x = 0.08;
  // off hand (raises to drink)
  rig.offArm = new THREE.Group(); rig.offArm.position.set(0.4, 1.38, 0); body.add(rig.offArm);
  boxM(0.16, 0.5, 0.16, leather, 0, -0.24, 0, rig.offArm);
  boxM(0.18, 0.14, 0.18, metal, 0, -0.52, 0, rig.offArm);
  // sword arm
  rig.arm = new THREE.Group(); rig.arm.position.set(-0.42, 1.3, 0.05); rig.arm.rotation.order = 'YXZ'; body.add(rig.arm);
  boxM(0.14, 0.14, 0.45, leather, 0, 0, 0.2, rig.arm);
  boxM(0.17, 0.17, 0.14, metal, 0, 0, 0.38, rig.arm);
  boxM(0.26, 0.06, 0.08, gold, 0, 0, 0.5, rig.arm);
  rig.bladeMat = new THREE.MeshLambertMaterial({ map: TEX.noise, color: 0xc8ccd4 }); heroMats.push(rig.bladeMat);
  rig.blade = boxM(0.07, 0.05, 1.05, rig.bladeMat, 0, 0, 1.0, rig.arm);

  // reach wedge on the floor and the swing flash
  const W = weapon.s;
  rig.reach = new THREE.Mesh(sectorGeo(0.5, W.reach, W.arc), new THREE.MeshBasicMaterial({ color: 0xe8dcc0, transparent: true, opacity: 0.06, side: THREE.DoubleSide, depthWrite: false }));
  rig.reach.position.y = 0.03; root.add(rig.reach);
  rig.swing = new THREE.Mesh(sectorGeo(0.5, W.reach, W.arc), new THREE.MeshBasicMaterial({ color: 0xfff4d0, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  rig.swing.position.y = 0.9; root.add(rig.swing);

  rig.light = new THREE.PointLight(0xffb060, 0.9, 11, 2); scene.add(rig.light);
  rig.root = root; rig.body = body;
  root.traverse(o => { o.userData.noMask = true; }); // the hero is always visible
  applyWeapon();
}

/** Re-read the upgrade level and rebuild blade length/glow and reach shapes. */
export function applyWeapon() {
  weapon.s = weaponStats(save.wlvl);
  const len = 1.05 * (weapon.s.reach / 2.7);
  rig.blade.scale.z = len / 1.05; rig.blade.position.z = 0.475 + len / 2;
  rig.bladeMat.color.setHex(save.wlvl >= 5 ? 0xffc080 : save.wlvl >= 3 ? 0xe0e4ec : 0xc8ccd4);
  weapon.glow = BLADE_GLOW[save.wlvl] || 0;
  rig.swing.material.color.setHex(save.wlvl >= 5 ? 0xffb060 : 0xfff4d0);
  refreshReach();
}

export const effArc = () => (has('whirl') ? Math.PI * 2 : weapon.s.arc);
export function refreshReach() {
  const a = effArc();
  rig.reach.geometry.dispose(); rig.reach.geometry = sectorGeo(0.5, weapon.s.reach, a);
  rig.swing.geometry.dispose(); rig.swing.geometry = sectorGeo(0.5, weapon.s.reach, a);
}

export function resetHeroPose() {
  rig.body.rotation.set(0, 0, 0); rig.body.position.set(0, 0, 0);
  rig.offArm.rotation.x = 0;
}

// ---------- actions ----------
export function tryDodge() {
  const cost = DASH.cost * (has('quick') ? BOON_FX.quickCostMul : 1);
  if (hero.dead || hero.roll > 0 || hero.drinkT > 0 || hero.st < cost * 0.6) return;
  hero.st = Math.max(0, hero.st - cost); hero.stDelay = HERO.staminaDelay;
  sfx.dash();
  const d = moveInput();
  if (d.lengthSq() < 0.01) d.set(-Math.sin(S.yaw), 0, -Math.cos(S.yaw)); // no input: dash backwards
  hero.rollDir.copy(d.normalize());
  hero.roll = DASH.time; hero.iframes = DASH.iframes; ghostT = 0;
}

export function tryDrink() {
  if (hero.dead || hero.drinkT > 0 || hero.roll > 0) return;
  if (hero.flasks <= 0) { showHint('No flasks left', 1.4); return; }
  if (hero.hp >= HERO.maxHp) { showHint('Already at full health', 1.4); return; }
  hero.flasks--; hero.drinkT = FLASK.drinkTime; hero.drinkDone = false;
  sfx.drink();
}

function spawnGhost() {
  const m = new THREE.Mesh(ghostGeo, new THREE.MeshBasicMaterial({ color: 0x9fc8ff, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending }));
  m.position.set(hero.pos.x, 0, hero.pos.z);
  m.rotation.order = 'YXZ'; m.rotation.y = Math.atan2(hero.rollDir.x, hero.rollDir.z); m.rotation.x = 0.42;
  scene.add(m); ghosts.push({ m, t: 0 });
}
const ghostGeo = new THREE.BoxGeometry(0.62, 1.55, 0.34); ghostGeo.translate(0, 0.95, 0);

// ---------- per-frame ----------
export function updateHero(dt) {
  hero.iframes -= dt; hero.hurt -= dt;
  const { body, legL, legR, offArm, arm } = rig;
  if (hero.dead) {
    hero.deadT += dt;
    body.rotation.x = lerp(body.rotation.x, -Math.PI / 2, dt * 6);
    body.position.y = lerp(body.position.y, 0.2, dt * 6);
    if (hero.deadT > 2.4) respawn();
    return;
  }
  hero.prev.copy(hero.pos);
  const mv = moveInput();

  if (hero.roll > 0) {
    // dash: lean into the direction of travel, legs stretched, afterimages behind
    hero.roll -= dt;
    hero.pos.addScaledVector(hero.rollDir, DASH.speed * dt * (0.5 + Math.max(0, hero.roll) / DASH.time));
    body.rotation.order = 'YXZ';
    body.rotation.y = angDiff(S.yaw, Math.atan2(hero.rollDir.x, hero.rollDir.z));
    body.rotation.x = lerp(body.rotation.x, 0.42, Math.min(1, dt * 30));
    body.position.y = 0.06;
    legL.rotation.x = 0.7; legR.rotation.x = -0.5;
    ghostT -= dt; if (ghostT <= 0) { ghostT = 0.035; spawnGhost(); }
    if (has('trail')) { hero.trailT -= dt; if (hero.trailT <= 0) { hero.trailT = 0.05; spawnTrail(); } }
  } else {
    body.rotation.x = lerp(body.rotation.x, 0, Math.min(1, dt * 14));
    body.rotation.y = lerp(body.rotation.y, 0, Math.min(1, dt * 14));
    const spdMul = hero.drinkT > 0 ? 0.35 : 1;
    hero.vel.x = lerp(hero.vel.x, mv.x * HERO.speed * spdMul, Math.min(1, dt * 14));
    hero.vel.z = lerp(hero.vel.z, mv.z * HERO.speed * spdMul, Math.min(1, dt * 14));
    hero.pos.addScaledVector(hero.vel, dt);
    const spd = Math.hypot(hero.vel.x, hero.vel.z);
    hero.walk += dt * spd * 2.2;
    const sw = Math.sin(hero.walk) * Math.min(1, spd / 3) * 0.6;
    legL.rotation.x = sw; legR.rotation.x = -sw;
    body.position.y = Math.abs(Math.sin(hero.walk)) * 0.05 * Math.min(1, spd / 3);
  }
  collide(hero.pos, HERO.radius);
  if (hero.roll <= 0) { // can't walk through enemies (dashing can)
    for (const e of enemies) {
      if (e.state === 'dead') continue;
      const p = e.root.position, dx = hero.pos.x - p.x, dz = hero.pos.z - p.z, d = Math.hypot(dx, dz), r = HERO.radius + e.radius;
      if (d < r && d > 1e-4) { hero.pos.x = p.x + dx / d * r; hero.pos.z = p.z + dz / d * r; }
    }
  }
  collide(hero.pos, HERO.radius);

  if (hero.stDelay > 0) hero.stDelay -= dt;
  else hero.st = Math.min(100, hero.st + (has('quick') ? BOON_FX.quickRegen : HERO.staminaRegen) * dt);

  // drinking
  if (hero.drinkT > 0) {
    hero.drinkT -= dt;
    const k = 1 - hero.drinkT / FLASK.drinkTime;
    offArm.rotation.x = -Math.sin(Math.min(1, k * 1.6) * Math.PI * 0.5) * 2.2;
    if (!hero.drinkDone && k >= FLASK.healAt / FLASK.drinkTime) {
      hero.drinkDone = true;
      const before = hero.hp; hero.hp = Math.min(HERO.maxHp, hero.hp + FLASK.heal);
      dmgNum(hero.pos.x, 2.0, hero.pos.z, '+' + Math.round(hero.hp - before), 'heal');
      S.healFlash = 0.5; sfx.heal();
    }
    if (hero.drinkT <= 0) offArm.rotation.x = 0;
  }

  // auto attack: swing at everything inside the reach arc
  const W = weapon.s;
  hero.atkCd -= dt;
  if (hero.atkCd <= 0 && hero.roll <= 0 && hero.drinkT <= 0) {
    const targets = [];
    for (const e of enemies) {
      if (e.state === 'dead') continue;
      const dx = e.root.position.x - hero.pos.x, dz = e.root.position.z - hero.pos.z, d = Math.hypot(dx, dz);
      if (d > W.reach + e.radius) continue;
      const slack = Math.atan2(e.radius, Math.max(d, 0.6));
      if (has('whirl') || Math.abs(angDiff(S.yaw, Math.atan2(dx, dz))) < W.arc / 2 + slack) targets.push(e);
    }
    if (targets.length) {
      sfx.swing();
      targets.forEach(hitEnemy);
      hero.riposte = false;
      hero.atkCd = W.cd; hero.swingT = SWING_T; hero.swings++;
      if (has('third') && hero.swings % 3 === 0) spawnWave();
    }
  }
  if (hero.swingT > 0) {
    hero.swingT -= dt;
    const k = 1 - Math.max(0, hero.swingT) / SWING_T;
    arm.rotation.y = lerp(-1.35, 1.35, k); arm.rotation.x = 0.12;
    rig.swing.material.opacity = 0.55 * Math.sin(k * Math.PI);
  } else {
    arm.rotation.y = lerp(arm.rotation.y, -0.55, dt * 10);
    arm.rotation.x = lerp(arm.rotation.x, 0.75, dt * 10);
    rig.swing.material.opacity = 0;
  }
  rig.reach.material.opacity = hero.atkCd <= 0 ? 0.08 : 0.035;
}

/** Visual-only updates that run every frame (also while paused). */
export function updateHeroVisuals(now, raw) {
  rig.root.position.set(hero.pos.x, 0, hero.pos.z);
  rig.root.rotation.y = S.yaw;
  S.healFlash -= raw;
  const flash = hero.hurt > 0.2 ? 0x660000 : S.healFlash > 0 ? 0x0a3a10 : 0;
  for (const m of heroMats) m.emissive.setHex(flash);
  if (!flash) rig.bladeMat.emissive.setHex(hero.riposte ? 0x8a8aa0 : weapon.glow);
  rig.body.visible = !(hero.iframes > 0 && hero.roll <= 0 && !hero.dead && Math.floor(now / 60) % 2 === 0);
  rig.light.position.set(hero.pos.x, 2.4, hero.pos.z);
  for (let i = ghosts.length - 1; i >= 0; i--) {
    const g = ghosts[i]; g.t += raw;
    g.m.material.opacity = 0.32 * (1 - g.t / 0.22);
    if (g.t >= 0.22) { scene.remove(g.m); g.m.material.dispose(); ghosts.splice(i, 1); }
  }
}
