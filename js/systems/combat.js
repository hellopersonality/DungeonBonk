// Damage in both directions: hero → enemy (with crits, stagger, boons) and enemy → hero.
import { run } from './leveling.js';
import { S } from '../core/state.js';
import { sfx } from '../core/audio.js';
import { BOON_FX } from '../data/boons.js';
import { FLASK, HERO } from '../data/tuning.js';
import { hero, weapon } from '../entities/hero.js';
import { has, queueBurst } from './boons.js';
import { dropEmbers, addFlask } from './pickups.js';
import { level } from './world.js';
import { rumble } from '../input/gamepad.js';
import { dmgNum } from '../ui/numbers.js';
import { showMsg } from '../ui/messages.js';

/** Apply damage to an enemy. Returns true if it died. `small` = boon/AoE tick (no hitstop). */
export function dealDamage(e, dmg, crit, small) {
  if (e.state === 'dead') return true;
  e.hp -= dmg;
  e.flash = crit ? 0.18 : small ? 0.06 : 0.1;
  if (!small) S.hitstop = Math.max(S.hitstop, crit ? 0.08 : 0.045);
  const p = e.root.position;
  dmgNum(p.x, e.height + 0.2, p.z, crit ? dmg + '!' : String(dmg), crit ? 'crit' : small ? 'small' : '');
  if (!small) sfx.hit(crit);
  if (e.hp <= 0) { killEnemy(e); return true; }
  return false;
}

/** A sweep-blade hit. Crits land on recovering enemies or after a riposte. */
export function hitEnemy(e) {
  if (e.state === 'dead') return;
  const W = weapon.s;
  const crit = e.state === 'recover' || hero.riposte;
  const base = W.dmg * (has('whirl') ? BOON_FX.whirlDmgMul : 1);
  const dmg = Math.round((base + Math.random() * 4 - 2) * (crit ? W.crit : 1));
  if (crit && has('blood') && hero.hp < HERO.maxHp) {
    const b = hero.hp; hero.hp = Math.min(HERO.maxHp, hero.hp + BOON_FX.bloodHeal);
    dmgNum(hero.pos.x, 2.1, hero.pos.z, '+' + Math.round(hero.hp - b), 'heal');
  }
  const p = e.root.position, dx = p.x - hero.pos.x, dz = p.z - hero.pos.z, l = Math.hypot(dx, dz) || 1;
  if (dealDamage(e, dmg, crit, false)) return;
  // stagger rules
  if (e.type === 'boss') return;                        // bosses never stagger
  if (e.type === 'husk' && e.state === 'windup') return; // husks have poise while winding up
  if (crit) { e.kb.set(dx / l * 1.5, 0, dz / l * 1.5); return; }
  if (e.state === 'lunge') return;
  e.state = 'stagger'; e.t = 0;
  e.tele.forEach(m => { m.material.opacity = 0; });
  const kb = e.type === 'skitter' ? 6 : 4;
  e.kb.set(dx / l * kb, 0, dz / l * kb);
}

export function killEnemy(e) {
  e.state = 'dead'; e.t = 0;
  e.tele.forEach(m => { m.material.opacity = 0; });
  const p = e.root.position;
  dropEmbers(p, e.embers + (has('greed') ? BOON_FX.greedBonus : 0));
  sfx.kill();
  if (has('volatile')) queueBurst(p.x, p.z);
  if (e.type === 'boss' || Math.random() < FLASK.dropChance) addFlask(p.x, p.z, true);
  level.onEnemyKilled && level.onEnemyKilled(e);
}

/** Enemy attack lands on the hero. Dashing (i-frames) avoids it, and can trigger Riposte. */
export function hurtHero(dmg, fromX, fromZ) {
  if (hero.dead) return;
  if (hero.iframes > 0) {
    if (hero.roll > 0 && has('riposte') && !hero.riposte) {
      hero.riposte = true;
      dmgNum(hero.pos.x, 2.2, hero.pos.z, 'RIPOSTE', 'crit');
      sfx.riposte();
    }
    return;
  }
  sfx.hurt(); rumble(0.6, 180);
  hero.hp -= dmg; hero.hurt = 0.35;
  S.hitstop = 0.07; S.shake = 0.35;
  dmgNum(hero.pos.x, 1.9, hero.pos.z, '-' + dmg, 'hurt');
  const dx = hero.pos.x - fromX, dz = hero.pos.z - fromZ, l = Math.hypot(dx, dz) || 1;
  hero.vel.set(dx / l * 7, 0, dz / l * 7);
  hero.iframes = 0.5;
  if (hero.hp <= 0) {
    hero.hp = 0; hero.dead = true; hero.deadT = 0;
    sfx.death();
    showMsg('YOU FELL', 'the run ends at level ' + run.level, '#c0392b', 2.4);
  }
}
