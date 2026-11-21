// Leveling (Megabonk-style). Collected embers fill the bar; each full bar is a level-up that
// opens the upgrade window (ui/levelup.js): choose a boon or a weapon upgrade, or skip.
// Everything here belongs to the current run and is lost on death (systems/world.js).
import { XP } from '../data/tuning.js';
import { UPGRADES } from '../data/weapons.js';
import { hero } from '../entities/hero.js';

export const run = {
  level: 1,
  xp: 0,          // embers toward the next level
  wlvl: 0,        // Sweep Blade upgrade level, 0..UPGRADES.length
  pending: 0,     // level-ups waiting for the upgrade window
};

/** Embers needed to go from `level` to the next. */
export const xpToNext = (level = run.level) => Math.round(XP.base + XP.step * Math.pow(level - 1, XP.pow));
export const weaponMaxed = () => run.wlvl >= UPGRADES.length;

export function gainXp(n) {
  if (hero.dead) return;
  run.xp += n;
  while (run.xp >= xpToNext()) { run.xp -= xpToNext(); run.level++; run.pending++; }
}

export function resetRun() {
  run.level = 1; run.xp = 0; run.wlvl = 0; run.pending = 0;
}
