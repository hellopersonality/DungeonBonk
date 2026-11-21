// World rules shared by every region: dying ends the run and resets the dungeon.
// The active level registers itself with setLevel() and supplies region-specific hooks.
import { S } from '../core/state.js';
import { HERO, FLASK } from '../data/tuning.js';
import { hero, resetHeroPose, applyWeapon } from '../entities/hero.js';
import { resetEnemies } from '../entities/enemies/registry.js';
import { clearProjectiles } from '../entities/enemies/spitter.js';
import { resetFlasks, clearEmbers } from './pickups.js';
import { clearBoons, clearBoonFx } from './boons.js';
import { resetRun } from './leveling.js';

/**
 * The active level. Hooks (all optional):
 *   spawn() -> {x,z}             where a new run starts
 *   onReset()                    the dungeon resets (new run)
 *   onEnemyKilled(e)
 *   update(dt)                   region triggers (gates, timers, secrets)
 */
export const level = {};
export function setLevel(l) { Object.assign(level, l); }

export function resetWorld() {
  resetEnemies(); resetFlasks(); clearProjectiles();
  S.bossFight = false;
  level.onReset && level.onReset();
}

/**
 * After death: the run is over. Levels, boons, blade upgrades and flasks are lost and you
 * start again from the Hub. Defeated bosses and opened shortcuts stay (save.js).
 */
export function respawn() {
  hero.dead = false; hero.hp = HERO.maxHp; hero.st = 100;
  hero.drinkT = 0; hero.roll = 0; hero.vel.set(0, 0, 0); hero.flasks = FLASK.start;
  const sp = level.spawn ? level.spawn() : { x: 0, z: 0 };
  hero.pos.set(sp.x, 0, sp.z); hero.prev.copy(hero.pos);
  resetHeroPose();
  resetRun(); applyWeapon();
  resetWorld(); clearEmbers(); clearBoons(); clearBoonFx();
}
