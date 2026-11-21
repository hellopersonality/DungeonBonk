// Level-up window: three offers (boons and Sweep Blade upgrades), or skip.
// Opens whenever a level-up is pending and play isn't otherwise interrupted (see main.js).
import { S, releaseKeys, exitPointerLock } from '../core/state.js';
import { shuffle } from '../core/util.js';
import { sfx } from '../core/audio.js';
import { BOONS } from '../data/boons.js';
import { UPGRADES, weaponStats } from '../data/weapons.js';
import { hero, applyWeapon } from '../entities/hero.js';
import { addBoon } from '../systems/boons.js';
import { run, weaponMaxed } from '../systems/leveling.js';
import { showMsg } from './messages.js';

const OFFERS = 3;
const WEAPON_CHANCE = 0.6; // chance a level-up includes the next blade upgrade (when one is left)

const root = document.getElementById('choice');
const head = root.querySelector('h3');
const cards = root.querySelector('.cards');
const state = { open: false, offers: [], sel: 0 };
export const choiceOpen = () => state.open;

const fmtArc = a => Math.round(a * 180 / Math.PI) + '°';
/** One line of what the next blade upgrade changes, e.g. "Damage 10 → 13". */
function bladeDiff(l) {
  const a = weaponStats(l), b = weaponStats(l + 1), out = [];
  if (a.dmg !== b.dmg) out.push(`Damage ${a.dmg} → ${b.dmg}`);
  if (a.cd !== b.cd) out.push(`Swing ${a.cd.toFixed(2)}s → ${b.cd.toFixed(2)}s`);
  if (a.reach !== b.reach) out.push(`Reach ${a.reach.toFixed(1)} → ${b.reach.toFixed(1)}`);
  if (a.arc !== b.arc) out.push(`Arc ${fmtArc(a.arc)} → ${fmtArc(b.arc)}`);
  if (a.crit !== b.crit) out.push(`Crit ×${a.crit} → ×${b.crit}`);
  return out.join(' · ');
}

function rollOffers() {
  const boons = shuffle(BOONS.filter(b => !hero.boons.has(b.id))).map(b => ({ kind: 'boon', b }));
  const blade = weaponMaxed() ? null : { kind: 'blade', u: UPGRADES[run.wlvl] };
  const offers = [];
  if (blade && (Math.random() < WEAPON_CHANCE || boons.length < OFFERS)) offers.push(blade);
  while (offers.length < OFFERS && boons.length) offers.push(boons.pop());
  return shuffle(offers);
}

/** Open the window for the next pending level-up. Returns false if nothing is pending. */
export function openLevelUp() {
  if (state.open || run.pending <= 0) return false;
  state.offers = rollOffers();
  if (!state.offers.length) { // every boon owned and the blade maxed
    run.pending--;
    showMsg('LEVEL ' + run.level, 'nothing left to learn', '#e8c070', 2);
    return false;
  }
  state.open = true;
  S.paused = true; releaseKeys(); exitPointerLock();
  head.textContent = 'LEVEL UP · ' + (run.level - run.pending + 1);
  cards.innerHTML = '';
  state.offers.forEach((o, i) => {
    const c = document.createElement('button');
    c.className = 'card' + (o.kind === 'blade' ? ' blade' : '');
    c.innerHTML = o.kind === 'blade'
      ? `<div class="k">[${i + 1}] WEAPON</div><b>Sweep Blade +${run.wlvl + 1}</b><span>${o.u.name}: ${o.u.desc}<br><em>${bladeDiff(run.wlvl)}</em></span>`
      : `<div class="k">[${i + 1}] BOON</div><b>${o.b.name}</b><span>${o.b.desc}</span>`;
    c.onclick = () => pickOffer(i);
    cards.appendChild(c);
  });
  root.style.display = 'flex';
  sfx.altar();
  if (S.padActive) selectChoice(0);
  return true;
}

export function pickOffer(i) {
  const o = state.offers[i];
  if (!o || !state.open) return;
  close();
  if (o.kind === 'blade') {
    run.wlvl++; applyWeapon(); sfx.forge(); S.shake = 0.15;
    showMsg('SWEEP BLADE +' + run.wlvl, o.u.name, '#e8c070', 2.2);
  } else {
    addBoon(o.b.id); sfx.boon();
    showMsg(o.b.name.toUpperCase(), o.b.desc, '#c9a0ff', 2.6);
  }
}

/** Skip: take nothing for this level. */
export function skipLevelUp() { if (state.open) close(); }

function close() {
  root.style.display = 'none';
  state.open = false; S.paused = false;
  run.pending--;
}

/** Gamepad helpers */
export function selectChoice(i) {
  const list = cards.querySelectorAll('.card');
  if (!list.length) return;
  state.sel = (i + list.length) % list.length;
  list.forEach((c, j) => c.classList.toggle('sel', j === state.sel));
}
export const moveChoice = d => selectChoice(state.sel + d);
export const confirmChoice = () => pickOffer(state.sel);

root.querySelector('.skip').onclick = skipLevelUp;
