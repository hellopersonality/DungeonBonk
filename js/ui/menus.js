// List menu: the pause menu (settings).
import { S, releaseKeys, exitPointerLock } from '../core/state.js';
import { clamp } from '../core/util.js';
import { settings, saveSettings } from '../core/save.js';
import { sfx } from '../core/audio.js';

const root = document.getElementById('pause');
const title = root.querySelector('h3');
const opts = document.getElementById('pauseOpts');
const help = document.getElementById('pauseHelp');

const state = { open: false, sel: 0, items: null, help: null };
export const menuOpen = () => state.open;

const step = (v, d) => clamp(Math.round((v + d * 0.1) * 10) / 10, 0.3, 2.5);
const toggle = key => () => { settings[key] = !settings[key]; saveSettings(); };
const slider = key => ({
  act: () => { settings[key] = settings[key] >= 2.5 ? 0.3 : step(settings[key], 1); saveSettings(); },
  adj: d => { settings[key] = step(settings[key], d); saveSettings(); },
  slider: true,
});

const PAUSE_ITEMS = [
  { label: () => 'Resume', act: () => closeMenu() },
  { label: () => `Invert Y (controller) <b>${settings.invertY ? 'On' : 'Off'}</b>`, act: toggle('invertY'), adj: toggle('invertY') },
  { label: () => `Invert Y (mouse) <b>${settings.invertMouseY ? 'On' : 'Off'}</b>`, act: toggle('invertMouseY'), adj: toggle('invertMouseY') },
  { label: () => `Stick sensitivity <b>◀ ${settings.padSens.toFixed(1)} ▶</b>`, ...slider('padSens') },
  { label: () => `Mouse sensitivity <b>◀ ${settings.mouseSens.toFixed(1)} ▶</b>`, ...slider('mouseSens') },
  { label: () => `Sound <b>${S.muted ? 'Off' : 'On'}</b>`, act: () => { S.muted = !S.muted; }, adj: () => { S.muted = !S.muted; } },
];
const PAUSE_HELP = () => S.padActive
  ? 'D-pad: choose · Left/Right: adjust · A: select · B/Start: resume'
  : 'Click to toggle · click the left side of a slider to lower it · Esc: resume';

function render() {
  opts.innerHTML = '';
  state.items.forEach((it, i) => {
    const b = document.createElement('button');
    b.className = 'opt' + (i === state.sel ? ' sel' : '');
    b.innerHTML = it.label();
    b.onclick = ev => {
      state.sel = i;
      const r = b.getBoundingClientRect();
      if (it.slider && ev.clientX < r.left + r.width * 0.35) it.adj(-1); else it.act();
      sfx.ui();
      if (state.open) render();
    };
    opts.appendChild(b);
  });
  help.innerHTML = state.help();
}

function open(name, items, helpFn) {
  if (state.open || !S.started) return;
  state.open = true; state.sel = 0; state.items = items; state.help = helpFn;
  title.textContent = name;
  S.paused = true; releaseKeys(); exitPointerLock();
  render();
  root.style.display = 'flex';
}

export const openPause = () => open('PAUSED', PAUSE_ITEMS, PAUSE_HELP);

export function closeMenu() {
  state.open = false; S.paused = false;
  root.style.display = 'none';
}

/** Gamepad / keyboard navigation */
export function moveMenu(d) { const n = state.items.length; state.sel = (state.sel + d + n) % n; render(); sfx.ui(); }
export function adjustMenu(d) { const it = state.items[state.sel]; if (it.adj) { it.adj(d); render(); sfx.ui(); } }
export function activateMenu() { state.items[state.sel].act(); sfx.ui(); if (state.open) render(); }
