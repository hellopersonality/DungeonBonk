// Heads-up display: bars, embers, flasks, blade level, boons, loop timer, boss bar
// and the interaction prompt.
import { S } from '../core/state.js';
import { save } from '../core/save.js';
import { fmtTime } from '../core/util.js';
import { FLASK, HERO } from '../data/tuning.js';
import { BOONS } from '../data/boons.js';
import { hero } from '../entities/hero.js';
import { bossRef } from '../entities/enemies/registry.js';
import { nearestInteract } from '../systems/interact.js';
import { btnLabel } from '../input/gamepad.js';
import { updateMessages, setPrompt } from './messages.js';

const $ = id => document.getElementById(id);
const el = {
  hp: document.querySelector('#hp>i'), st: document.querySelector('#st>i'),
  banked: $('banked'), carried: $('carried'), flasks: $('flasks'), wlvl: $('wlvl'), boons: $('boons'),
  vig: $('vig'), act: $('actBtn'), timer: $('timer'),
  boss: $('boss'), bossName: document.querySelector('#boss .n'), bossBar: document.querySelector('#boss .bar>i'),
};
let flasksKey = '';

/** Loop timer shown top-right. The level sets `loop.start` (game-clock seconds) or null. */
export const loop = { start: null };

export function renderBoons() {
  el.boons.innerHTML = [...hero.boons].map(id => '<div>◈ ' + BOONS.find(b => b.id === id).name + '</div>').join('');
}

export function updateHUD(dt) {
  el.hp.style.width = (hero.hp / HERO.maxHp * 100) + '%';
  el.st.style.width = hero.st + '%';
  el.banked.textContent = save.banked;
  el.carried.textContent = hero.carried;
  const key = hero.flasks + '|' + S.padActive + '|' + S.isTouch;
  if (key !== flasksKey) {
    flasksKey = key;
    const fh = '<span class="f">' + '▮'.repeat(hero.flasks) + '</span><span class="e">' + '▮'.repeat(FLASK.max - hero.flasks) + '</span>';
    el.flasks.innerHTML = 'Flasks ' + fh + (S.isTouch && !S.padActive ? '' : ' <span style="color:#8a7a60;letter-spacing:0">[' + btnLabel('drink') + ']</span>');
  }
  el.wlvl.textContent = 'Sweep Blade +' + save.wlvl;
  el.vig.style.opacity = Math.max(0, hero.hurt * 2.2) + (hero.hp < 35 && !hero.dead ? 0.25 + Math.sin(S.clock * 6) * 0.1 : 0);

  const it = nearestInteract();
  el.act.style.display = S.isTouch && it ? 'block' : 'none';
  if (it) el.act.textContent = it.label.toUpperCase();
  if (!updateMessages(dt)) {
    setPrompt(it ? (S.isTouch && !S.padActive ? '' : btnLabel('interact') + ': ') + (it.prompt || it.label) : '');
  }

  el.timer.textContent = (loop.start !== null ? 'LOOP ' + fmtTime(S.clock - loop.start) : '') + (save.bestLoop ? '  ·  BEST ' + fmtTime(save.bestLoop) : '');

  const b = bossRef.e;
  const showBoss = b && b.state !== 'dead' && b.state !== 'idle' && !hero.dead;
  el.boss.style.display = showBoss ? 'block' : 'none';
  if (showBoss) { el.bossName.textContent = b.name || 'BOSS'; el.bossBar.style.width = Math.max(0, b.hp / b.maxHp * 100) + '%'; }
}
