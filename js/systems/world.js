// World rules shared by every region: resting, saving, dying and resetting the dungeon.
// The active level registers itself with setLevel() and supplies region-specific hooks.
import { S } from '../core/state.js';
import { save, writeSave } from '../core/save.js';
import { sfx } from '../core/audio.js';
import { HERO } from '../data/tuning.js';
import { hero, resetHeroPose } from '../entities/hero.js';
import { resetEnemies } from '../entities/enemies/registry.js';
import { clearProjectiles } from '../entities/enemies/spitter.js';
import { resetFlasks, clearEmbers } from './pickups.js';
import { clearBoons, clearBoonFx, resetAltars } from './boons.js';
import { dmgNum } from '../ui/numbers.js';
import { showMsg } from '../ui/messages.js';

/**
 * The active level. Hooks (all optional):
 *   spawnFor(crystal) -> {x,z}   where the hero wakes after dying
 *   onReset()                    dungeon reset (rest or death)
 *   onEnemyKilled(e)
 *   update(dt)                   region triggers (gates, timers, secrets)
 */
export const level = {};
export function setLevel(l) { Object.assign(level, l); }

export const progress = { lastCrystal: null };

export function resetWorld() {
  resetEnemies(); resetFlasks(); resetAltars(); clearProjectiles();
  S.bossFight = false;
  level.onReset && level.onReset();
}

/** Rest: full health, but enemies/flasks/altars return and boons fade. */
export function rest() {
  hero.hp = HERO.maxHp; hero.st = 100;
  resetWorld(); clearBoons(); clearBoonFx();
  sfx.rest();
  showMsg('RESTED', 'health restored · boons fade · the dungeon stirs again', '#6fb8ff', 2.4);
}

/** Save: bank carried embers and set this crystal as the return point. Boons stay. */
export function saveAt(c) {
  progress.lastCrystal = c;
  const n = hero.carried;
  if (n) dmgNum(c.x, 2, c.z, '+' + n, 'gain');
  save.banked += n; hero.carried = 0; save.flasks = hero.flasks;
  writeSave();
  sfx.save();
  showMsg('SAVED', (n ? n + ' embers banked · ' : '') + 'you will return here', '#e8c070', 2.2);
}

/** After death: wake at the last saved crystal, lose carried embers and boons. */
export function respawn() {
  hero.dead = false; hero.hp = HERO.maxHp; hero.st = 100; hero.carried = 0;
  hero.drinkT = 0; hero.roll = 0; hero.vel.set(0, 0, 0);
  const sp = level.spawnFor ? level.spawnFor(progress.lastCrystal) : { x: 0, z: 0 };
  hero.pos.set(sp.x, 0, sp.z); hero.prev.copy(hero.pos);
  resetHeroPose();
  resetWorld(); clearEmbers(); clearBoons(); clearBoonFx();
  level.onRespawn && level.onRespawn();
}
