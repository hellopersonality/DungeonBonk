// Gamepad support (standard mapping): A dash · X interact · Y drink · Start pause.
// Menus: D-pad / left stick to move, A to confirm, B to back out.
import { clamp } from '../core/util.js';
import { S } from '../core/state.js';
import { settings } from '../core/save.js';
import { tryDodge, tryDrink } from '../entities/hero.js';
import { tryInteract } from '../systems/interact.js';
import { menuOpen, openPause, closeMenu, moveMenu, adjustMenu, activateMenu } from '../ui/menus.js';
import { choiceOpen, moveChoice, confirmChoice, closeChoice } from '../ui/choice.js';
import { forgeOpen, moveForge, confirmForge, closeForge } from '../ui/forge.js';

export const pad = { x: 0, y: 0 };
let prev = [], navT = 0;

const BTN = { A: 0, B: 1, X: 2, Y: 3, RB: 5, RT: 7, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
const DZ = v => (Math.abs(v) < 0.16 ? 0 : (v - Math.sign(v) * 0.16) / 0.84);

function getPad() {
  const ps = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const p of ps) if (p && p.connected) return p;
  return null;
}

export function rumble(strength, ms) {
  try {
    const gp = getPad();
    if (gp && gp.vibrationActuator) gp.vibrationActuator.playEffect('dual-rumble', { duration: ms, strongMagnitude: strength, weakMagnitude: strength * 0.6 });
  } catch (_) {}
}

/** Button name for prompts, following the last input device. */
export const btnLabel = a => (S.padActive
  ? { interact: 'X', drink: 'Y', dash: 'A' }[a]
  : { interact: 'E', drink: 'Q', dash: 'Space' }[a]);

export function pollPad(dt, onStart) {
  const gp = getPad();
  if (!gp) { pad.x = pad.y = 0; return; }
  const down = i => !!(gp.buttons[i] && gp.buttons[i].pressed);
  const pressed = i => down(i) && !prev[i];
  const ax = i => DZ(gp.axes[i] || 0);
  const lx = ax(0), ly = ax(1), rx = ax(2), ry = ax(3);
  if (lx || ly || rx || ry || gp.buttons.some(b => b.pressed)) S.padActive = true;

  // menu navigation from the d-pad or a left-stick flick (with repeat delay)
  navT -= dt;
  let h = 0, v = 0;
  if (pressed(BTN.LEFT) || (lx < -0.6 && navT <= 0)) h = -1;
  if (pressed(BTN.RIGHT) || (lx > 0.6 && navT <= 0)) h = 1;
  if (pressed(BTN.UP) || (ly < -0.6 && navT <= 0)) v = -1;
  if (pressed(BTN.DOWN) || (ly > 0.6 && navT <= 0)) v = 1;
  if ((h || v) && (Math.abs(lx) > 0.6 || Math.abs(ly) > 0.6)) navT = 0.25;
  if (Math.abs(lx) < 0.3 && Math.abs(ly) < 0.3) navT = 0;

  pad.x = pad.y = 0;
  if (!S.started) {
    if (pressed(BTN.A) || pressed(BTN.START)) onStart();
  } else if (menuOpen()) {
    if (v) moveMenu(v); if (h) adjustMenu(h);
    if (pressed(BTN.A)) activateMenu();
    if (pressed(BTN.B) || pressed(BTN.START)) closeMenu();
  } else if (choiceOpen()) {
    if (h || v) moveChoice(h || v);
    if (pressed(BTN.A)) confirmChoice();
    if (pressed(BTN.B)) closeChoice();
  } else if (forgeOpen()) {
    if (h || v) moveForge(h || v);
    if (pressed(BTN.A)) confirmForge();
    if (pressed(BTN.B)) closeForge();
  } else {
    pad.x = lx; pad.y = ly;
    const sens = settings.padSens;
    S.yaw -= rx * Math.abs(rx) * 3.0 * dt * sens;
    S.pitch = clamp(S.pitch + ry * Math.abs(ry) * 1.8 * dt * sens * (settings.invertY ? -1 : 1), -0.35, 0.95);
    if (pressed(BTN.A) || pressed(BTN.RB) || pressed(BTN.RT)) tryDodge();
    if (pressed(BTN.X)) tryInteract();
    if (pressed(BTN.Y)) tryDrink();
    if (pressed(BTN.START)) openPause();
  }
  prev = gp.buttons.map(b => b.pressed);
}
