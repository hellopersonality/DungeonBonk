// Altar boon choice overlay.
import { S, releaseKeys, exitPointerLock } from '../core/state.js';
import { shuffle } from '../core/util.js';
import { sfx } from '../core/audio.js';
import { BOONS } from '../data/boons.js';
import { hero } from '../entities/hero.js';
import { addBoon, useAltar } from '../systems/boons.js';
import { showMsg } from './messages.js';

const root = document.getElementById('choice');
const cards = root.querySelector('.cards');
const state = { altar: null, offers: [], sel: 0 };
export const choiceOpen = () => !!state.altar;

export function openChoice(a) {
  const pool = BOONS.filter(b => !hero.boons.has(b.id));
  if (!pool.length) { showMsg('THE ALTAR IS SILENT', 'you carry every boon it knows', '#c9a0ff', 2); useAltar(a); return; }
  state.offers = shuffle(pool).slice(0, a.offer);
  state.altar = a;
  S.paused = true; releaseKeys(); exitPointerLock();
  cards.innerHTML = '';
  state.offers.forEach((b, i) => {
    const c = document.createElement('button');
    c.className = 'card';
    c.innerHTML = `<div class="k">[${i + 1}]</div><b>${b.name}</b><span>${b.desc}</span>`;
    c.onclick = () => pickBoon(i);
    cards.appendChild(c);
  });
  root.style.display = 'flex';
  sfx.altar();
  if (S.padActive) selectChoice(0);
}

export function pickBoon(i) {
  const b = state.offers[i];
  if (!b || !state.altar) return;
  useAltar(state.altar);
  closeChoice();
  addBoon(b.id);
  sfx.boon();
  showMsg(b.name.toUpperCase(), b.desc, '#c9a0ff', 2.6);
}

export function closeChoice() {
  root.style.display = 'none';
  S.paused = false; state.altar = null;
}

/** Gamepad helpers */
export function selectChoice(i) {
  const list = cards.querySelectorAll('.card');
  if (!list.length) return;
  state.sel = (i + list.length) % list.length;
  list.forEach((c, j) => c.classList.toggle('sel', j === state.sel));
}
export const moveChoice = d => selectChoice(state.sel + d);
export const confirmChoice = () => pickBoon(state.sel);

root.querySelector('.skip').onclick = closeChoice;
