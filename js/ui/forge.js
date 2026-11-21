// Forge overlay: spend banked embers on Sweep Blade upgrades.
import { S, releaseKeys, exitPointerLock } from '../core/state.js';
import { save, writeSave } from '../core/save.js';
import { sfx } from '../core/audio.js';
import { UPGRADES, weaponStats } from '../data/weapons.js';
import { applyWeapon } from '../entities/hero.js';
import { showMsg } from './messages.js';

const root = document.getElementById('forge');
const panel = root.querySelector('.panel');
const state = { open: false, sel: 0 };
export const forgeOpen = () => state.open;

const fmtArc = a => Math.round(a * 180 / Math.PI) + '°';

function render() {
  const l = save.wlvl, cur = weaponStats(l), max = l >= UPGRADES.length;
  const up = max ? null : UPGRADES[l], nxt = max ? null : weaponStats(l + 1);
  const row = (label, a, b, f) => `<tr><td>${label}</td><td class="v">${f(a)}</td><td class="n">${nxt && f(a) !== f(b) ? '→ ' + f(b) : ''}</td></tr>`;
  const pips = '◆'.repeat(l) + '◇'.repeat(UPGRADES.length - l);
  panel.innerHTML =
    `<h3>THE FORGE</h3><div class="sub">Sweep Blade +${l} <span class="pips">${pips}</span> · ${save.banked} embers banked</div>` +
    '<table>' +
      row('Damage', cur.dmg, nxt && nxt.dmg, v => String(v)) +
      row('Swing interval', cur.cd, nxt && nxt.cd, v => v.toFixed(2) + 's') +
      row('Reach', cur.reach, nxt && nxt.reach, v => v.toFixed(1)) +
      row('Sweep arc', cur.arc, nxt && nxt.arc, fmtArc) +
      row('Critical hit', cur.crit, nxt && nxt.crit, v => '×' + v) +
    '</table>' +
    (max ? '<div class="next">The blade can be improved no further.</div>'
         : `<div class="next">Next: <b>${up.name}</b> · ${up.desc}<br>Cost: <b>${up.cost}</b> embers</div>`) +
    '<div class="btns">' + (max ? '' : `<button id="fUp"${save.banked < up.cost ? ' disabled' : ''}>FORGE</button>`) + '<button id="fClose">LEAVE</button></div>';
  const b = document.getElementById('fUp');
  if (b) b.onclick = () => {
    if (save.banked < up.cost) return;
    save.banked -= up.cost; save.wlvl++; writeSave();
    applyWeapon(); sfx.forge(); S.shake = 0.15;
    render();
    showMsg('SWEEP BLADE +' + save.wlvl, up.name, '#e8c070', 2);
  };
  document.getElementById('fClose').onclick = closeForge;
  if (S.padActive) selectForge(Math.min(state.sel, panel.querySelectorAll('button').length - 1));
}

export function openForge() {
  state.open = true; state.sel = 0;
  S.paused = true; releaseKeys(); exitPointerLock();
  render(); sfx.ui();
  root.style.display = 'flex';
}
export function closeForge() {
  state.open = false; S.paused = false;
  root.style.display = 'none';
}

/** Gamepad helpers */
export function selectForge(i) {
  const bs = panel.querySelectorAll('button');
  if (!bs.length) return;
  state.sel = (i + bs.length) % bs.length;
  bs.forEach((b, j) => b.classList.toggle('sel', j === state.sel));
}
export const moveForge = d => selectForge(state.sel + d);
export function confirmForge() {
  const b = panel.querySelectorAll('button')[state.sel];
  if (b && !b.disabled) b.click();
}
