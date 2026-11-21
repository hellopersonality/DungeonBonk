// Things the hero can interact with (crystals, forge, altars, examine spots).
// Each entry: { x, z, r, label, act(), cond?() }
import { hero } from '../entities/hero.js';

export const interactables = [];

export function addInteract(it) { interactables.push(it); return it; }

export function nearestInteract() {
  if (hero.dead) return null;
  let best = null, bd = 1e9;
  for (const it of interactables) {
    if (it.cond && !it.cond()) continue;
    const d = Math.hypot(hero.pos.x - it.x, hero.pos.z - it.z);
    if (d < it.r && d < bd) { bd = d; best = it; }
  }
  return best;
}

export function tryInteract() {
  const it = nearestInteract();
  if (it) it.act();
}
