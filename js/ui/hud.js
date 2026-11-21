// Heads-up display: bars, embers, flasks, blade level, boons, boss bar
// and the interaction prompt.
import { S } from '../core/state.js';
import { FLASK, HERO } from '../data/tuning.js';
import { run, xpToNext } from '../systems/leveling.js';
import { BOONS } from '../data/boons.js';
import { hero } from '../entities/hero.js';
import { bossRef } from '../entities/enemies/registry.js';
import { nearestInteract } from '../systems/interact.js';
import { btnLabel } from '../input/gamepad.js';
import { updateMessages, setPrompt } from './messages.js';

const $ = id => document.getElementById(id);
const el = {
  hp: document.querySelector('#hp>i'), st: document.querySelector('#st>i'),
  xp: document.querySelector('#xp .bar>i'), xpBox: $('xp'), xpn: $('xpn'), lvl: $('lvl'), flasks: $('flasks'), wlvl: $('wlvl'), boons: $('boons'),
  vig: $('vig'), act: $('actBtn'),
  boss: $('boss'), bossName: document.querySelector('#boss .n'), bossBar: document.querySelector('#boss .bar>i'),
};
let flasksKey = '';
let lastXp = 0, lastLvl = 1, gainT = 0;
const shown = new Map(); // last value written per element/property, so unchanged fields aren't rewritten
function put(node, prop, v) {
  const m = shown.get(node) || {}; if (m[prop] === v) return;
  m[prop] = v; shown.set(node, m);
  if (prop === 'text') node.textContent = v; else if (prop === 'className') node.className = v; else node.style[prop] = v;
}

export function renderBoons() {
  el.boons.innerHTML = [...hero.boons].map(id => '<div>◈ ' + BOONS.find(b => b.id === id).name + '</div>').join('');
}

export function updateHUD(dt) {
  put(el.hp, 'width', (hero.hp / HERO.maxHp * 100).toFixed(1) + '%');
  put(el.st, 'width', hero.st.toFixed(1) + '%');
  // level bar (top centre): glows briefly whenever embers come in
  const need = xpToNext();
  if (run.xp !== lastXp || run.level !== lastLvl) { if (run.xp > lastXp || run.level > lastLvl) gainT = 0.3; lastXp = run.xp; lastLvl = run.level; }
  gainT -= dt;
  put(el.lvl, 'text', 'LEVEL ' + run.level);
  put(el.xpn, 'text', run.pending ? 'LEVEL UP!' : run.xp + ' / ' + need + ' embers');
  put(el.xp, 'width', (run.pending ? 100 : run.xp / need * 100).toFixed(1) + '%');
  put(el.xpBox, 'className', run.pending ? 'full' : gainT > 0 ? 'gain' : '');
  const key = hero.flasks + '|' + S.padActive + '|' + S.isTouch;
  if (key !== flasksKey) {
    flasksKey = key;
    const fh = '<span class="f">' + '▮'.repeat(hero.flasks) + '</span><span class="e">' + '▮'.repeat(FLASK.max - hero.flasks) + '</span>';
    el.flasks.innerHTML = 'Flasks ' + fh + (S.isTouch && !S.padActive ? '' : ' <span style="color:#8a7a60;letter-spacing:0">[' + btnLabel('drink') + ']</span>');
  }
  put(el.wlvl, 'text', 'Sweep Blade +' + run.wlvl);
  put(el.vig, 'opacity', (Math.max(0, hero.hurt * 2.2) + (hero.hp < 35 && !hero.dead ? 0.25 + Math.sin(S.clock * 6) * 0.1 : 0)).toFixed(2));

  const it = nearestInteract();
  put(el.act, 'display', S.isTouch && it ? 'block' : 'none');
  if (it) put(el.act, 'text', it.label.toUpperCase());
  if (!updateMessages(dt)) {
    setPrompt(it ? (S.isTouch && !S.padActive ? '' : btnLabel('interact') + ': ') + (it.prompt || it.label) : '');
  }

  const b = bossRef.e;
  const showBoss = b && b.state !== 'dead' && b.state !== 'idle' && !hero.dead;
  put(el.boss, 'display', showBoss ? 'block' : 'none');
  if (showBoss) { put(el.bossName, 'text', b.name || 'BOSS'); put(el.bossBar, 'width', Math.max(0, b.hp / b.maxHp * 100).toFixed(1) + '%'); }
}
