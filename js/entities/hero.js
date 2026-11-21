// The hero: data, model, movement, dash, drinking and the auto-attacking sweep blade.
import { V3, lerp, angDiff, turnTo } from '../core/util.js';
import { S } from '../core/state.js';
import { sfx } from '../core/audio.js';
import { HERO, DASH, FLASK } from '../data/tuning.js';
import { weaponStats, SWING_T, BLADE_GLOW } from '../data/weapons.js';
import { BOON_FX } from '../data/boons.js';
import { scene } from '../render/renderer.js';
import { createActor, createGhost, removeGhost } from '../render/sprites.js';
import { KNIGHT, knightLoaded, whenKnightLoaded } from '../render/knight.js';
import { collide, sectorGeo } from '../world/geometry.js';
import { enemies } from './enemies/registry.js';
import { hitEnemy } from '../systems/combat.js';
import { has, spawnWave, spawnTrail } from '../systems/boons.js';
import { respawn } from '../systems/world.js';
import { run } from '../systems/leveling.js';
import { moveInput } from '../input/input.js';
import { dmgNum } from '../ui/numbers.js';
import { showHint } from '../ui/messages.js';

export const hero = {
  pos: new V3(0, 0, -5), prev: new V3(0, 0, -5), vel: new V3(),
  facing: 0, // world angle the hero faces (movement direction); the sweep arc points this way
  hp: HERO.maxHp, st: 100, stDelay: 0,
  roll: 0, rollDir: new V3(), iframes: 0,
  atkCd: 0, swingT: 0, swingAnim: 0, swings: 0,
  hurt: 0, dead: false, deadT: 0, walk: 0,
  flasks: FLASK.start,
  drinkT: 0, drinkDone: false,
  boons: new Set(), riposte: false, trailT: 0,
};

/** Current sweep blade stats (updated by applyWeapon). */
export const weapon = { s: weaponStats(0), glow: 0 };

/** Sprite swing animation length (s); the hit itself lands instantly. Keep below the weapon cooldown. */
const SWING_ANIM = 0.3;

const rig = {}; // sprite actor, floor shapes, light
const ghosts = [];
let ghostT = 0;

// ---------- model ----------
// The hero is a billboarded sprite (see render/sprites.js). Only the floor shapes (reach
// wedge, swing flash) and the light are 3D; they rotate with hero.facing.
export function initHero() {
  const root = new THREE.Group(); scene.add(root);
  rig.actor = createActor({ ...KNIGHT, mask: false }); // the hero is always visible
  whenKnightLoaded(() => { rig.actor.key = null; });

  // reach wedge on the floor and the swing flash
  const W = weapon.s;
  rig.reach = new THREE.Mesh(sectorGeo(0.5, W.reach, W.arc), new THREE.MeshBasicMaterial({ color: 0xe8dcc0, transparent: true, opacity: 0.06, side: THREE.DoubleSide, depthWrite: false }));
  rig.reach.position.y = 0.03; root.add(rig.reach);
  rig.swing = new THREE.Mesh(sectorGeo(0.5, W.reach, W.arc), new THREE.MeshBasicMaterial({ color: 0xfff4d0, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  rig.swing.position.y = 0.9; root.add(rig.swing);

  rig.light = new THREE.PointLight(0xffb060, 0.9, 11, 2); scene.add(rig.light);
  rig.root = root;
  root.traverse(o => { o.userData.noMask = true; });
  applyWeapon();
}

/** Re-read the upgrade level and rebuild blade length/glow and reach shapes. */
export function applyWeapon() {
  weapon.s = weaponStats(run.wlvl);
  weapon.glow = BLADE_GLOW[run.wlvl] || 0;
  rig.swing.material.color.setHex(run.wlvl >= 5 ? 0xffb060 : 0xfff4d0);
  rig.actor.key = null; // the sprite's blade changes with the upgrade level
  refreshReach();
}

export const effArc = () => (has('whirl') ? Math.PI * 2 : weapon.s.arc);
export function refreshReach() {
  const a = effArc();
  rig.reach.geometry.dispose(); rig.reach.geometry = sectorGeo(0.5, weapon.s.reach, a);
  rig.swing.geometry.dispose(); rig.swing.geometry = sectorGeo(0.5, weapon.s.reach, a);
}

export function resetHeroPose() {
  hero.facing = 0; rig.actor.key = null;
}

// ---------- actions ----------
export function tryDodge() {
  const cost = DASH.cost * (has('quick') ? BOON_FX.quickCostMul : 1);
  if (hero.dead || hero.roll > 0 || hero.drinkT > 0 || hero.st < cost * 0.6) return;
  hero.st = Math.max(0, hero.st - cost); hero.stDelay = HERO.staminaDelay;
  sfx.dash();
  const d = moveInput();
  if (d.lengthSq() < 0.01) d.set(-Math.sin(hero.facing), 0, -Math.cos(hero.facing)); // no input: dash backwards
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

/** Dash afterimage: a frozen, tinted copy of the current sprite frame. */
function spawnGhost() {
  const A = rig.actor;
  const m = createGhost(A.snapshot(), A.w, A.h, A.flip, 0x9fc8ff);
  m.position.set(hero.pos.x, 0, hero.pos.z);
  ghosts.push({ m, t: 0 });
}

// ---------- per-frame ----------
export function updateHero(dt) {
  hero.iframes -= dt; hero.hurt -= dt;
  if (hero.dead) {
    hero.deadT += dt;
    if (hero.deadT > 2.4) respawn();
    return;
  }
  hero.prev.copy(hero.pos);
  const mv = moveInput();

  if (hero.roll > 0) {
    // dash: afterimages behind, facing the direction of travel
    hero.roll -= dt;
    hero.pos.addScaledVector(hero.rollDir, DASH.speed * dt * (0.5 + Math.max(0, hero.roll) / DASH.time));
    hero.facing = Math.atan2(hero.rollDir.x, hero.rollDir.z);
    ghostT -= dt; if (ghostT <= 0) { ghostT = 0.035; spawnGhost(); }
    if (has('trail')) { hero.trailT -= dt; if (hero.trailT <= 0) { hero.trailT = 0.05; spawnTrail(); } }
  } else {
    const spdMul = hero.drinkT > 0 ? 0.35 : 1;
    hero.vel.x = lerp(hero.vel.x, mv.x * HERO.speed * spdMul, Math.min(1, dt * 14));
    hero.vel.z = lerp(hero.vel.z, mv.z * HERO.speed * spdMul, Math.min(1, dt * 14));
    hero.pos.addScaledVector(hero.vel, dt);
    const spd = Math.hypot(hero.vel.x, hero.vel.z);
    hero.walk += dt * spd * 2.2;
    // the hero faces where they walk; the camera is free to orbit independently
    // (it keeps that facing when you stop, until you move again)
    if (mv.lengthSq() > 0.04) hero.facing = turnTo(hero.facing, Math.atan2(mv.x, mv.z), dt * 18);
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
    if (!hero.drinkDone && k >= FLASK.healAt / FLASK.drinkTime) {
      hero.drinkDone = true;
      const before = hero.hp; hero.hp = Math.min(HERO.maxHp, hero.hp + FLASK.heal);
      dmgNum(hero.pos.x, 2.0, hero.pos.z, '+' + Math.round(hero.hp - before), 'heal');
      S.healFlash = 0.5; sfx.heal();
    }
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
      if (has('whirl') || Math.abs(angDiff(hero.facing, Math.atan2(dx, dz))) < W.arc / 2 + slack) targets.push(e);
    }
    if (targets.length) {
      sfx.swing();
      targets.forEach(hitEnemy);
      hero.riposte = false;
      hero.atkCd = W.cd; hero.swingT = SWING_T; hero.swingAnim = SWING_ANIM; hero.swings++;
      if (has('third') && hero.swings % 3 === 0) spawnWave();
    }
  }
  if (hero.swingAnim > 0) hero.swingAnim -= dt;
  if (hero.swingT > 0) {
    hero.swingT -= dt;
    const k = 1 - Math.max(0, hero.swingT) / SWING_T;
    rig.swing.material.opacity = 0.55 * Math.sin(k * Math.PI);
  } else rig.swing.material.opacity = 0;
  rig.reach.material.opacity = hero.atkCd <= 0 ? 0.08 : 0.035;
}

/** Visual-only updates that run every frame (also while paused). */
export function updateHeroVisuals(now, raw) {
  const A = rig.actor;
  rig.root.position.set(hero.pos.x, 0, hero.pos.z);
  rig.root.rotation.y = hero.facing;
  A.setPos(hero.pos.x, 0, hero.pos.z);
  S.healFlash -= raw;

  // pick the sheet animation and frame for the current state (see render/knight.js)
  const dir = A.orient(hero.facing);
  const flash = hero.hurt > 0.2 ? 'hurt' : S.healFlash > 0 ? 'heal' : '';
  const moving = Math.hypot(hero.vel.x, hero.vel.z) > 0.6;
  const prog = (t, total, n) => Math.max(0, Math.min(n - 1, Math.floor((1 - t / total) * n)));
  let sheet = 'idle', frame = Math.floor(S.clock * 5) % 4;  // idle: breathing loop
  if (hero.dead) { sheet = 'death'; frame = Math.min(3, Math.floor(hero.deadT / 0.18)); }
  else if (hero.roll > 0) { sheet = 'dash'; frame = prog(hero.roll, DASH.time, 6); }
  else if (hero.swingAnim > 0) { sheet = 'attack'; frame = 1 + prog(hero.swingAnim, SWING_ANIM, 5); }
  else if (hero.hurt > 0) { sheet = 'hurt'; frame = Math.min(2, Math.floor((0.35 - hero.hurt) / 0.12)); }
  else if (hero.drinkT > 0) { sheet = 'drink'; frame = prog(hero.drinkT, FLASK.drinkTime, 6); }
  else if (moving) { sheet = 'walk'; frame = Math.floor(hero.walk / (Math.PI / 3)) % 6; }
  A.show(`${sheet}|${frame}|${dir}|${flash}|${knightLoaded() ? 1 : 0}`, { sheet, frame, dir, flash });
  A.mesh.visible = !(hero.iframes > 0 && hero.roll <= 0 && !hero.dead && Math.floor(now / 60) % 2 === 0);

  rig.light.position.set(hero.pos.x, 2.4, hero.pos.z);
  for (let i = ghosts.length - 1; i >= 0; i--) {
    const g = ghosts[i]; g.t += raw;
    g.m.material.opacity = 0.32 * (1 - g.t / 0.22);
    if (g.t >= 0.22) { removeGhost(g.m); ghosts.splice(i, 1); }
  }
}
