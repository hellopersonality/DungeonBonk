// Keyboard, mouse and touch input. Gamepad lives in gamepad.js.
import { V3, W, clamp } from '../core/util.js';
import { S, keys } from '../core/state.js';
import { settings } from '../core/save.js';
import { CAM } from '../data/tuning.js';
import { canvas, togglePixelMode } from '../render/renderer.js';
import { pad } from './gamepad.js';
import { tryDodge, tryDrink } from '../entities/hero.js';
import { tryInteract } from '../systems/interact.js';
import { menuOpen, openPause, closeMenu } from '../ui/menus.js';
import { choiceOpen, pickOffer, skipLevelUp } from '../ui/levelup.js';
import { showHint } from '../ui/messages.js';

const stick = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
const look = { id: null, lx: 0, ly: 0 };

/** Orbit the camera by dx radians and tilt it by dy (positive looks further down). */
export function lookDelta(dx, dy) {
  S.yaw -= dx;
  S.pitch = clamp(S.pitch + dy, CAM.pitchMin, CAM.pitchMax);
}

/** Desired movement direction in world space (camera-relative), length ≤ 1. */
export function moveInput() {
  let f = 0, s = 0;
  if (keys.KeyW) f += 1; if (keys.KeyS) f -= 1; if (keys.KeyD) s += 1; if (keys.KeyA) s -= 1;
  f -= stick.y; s += stick.x;
  f -= pad.y; s += pad.x;
  const fx = Math.sin(S.yaw), fz = Math.cos(S.yaw), rx = -fz, rz = fx;
  const v = new V3(fx * f + rx * s, 0, fz * f + rz * s);
  if (v.lengthSq() > 1) v.normalize();
  return v;
}

/** Arrow keys orbit (left/right) and tilt (up/down). Called each frame by the camera. */
export function keyLook(dt) {
  if (S.paused) return;
  if (keys.ArrowLeft) lookDelta(-dt * CAM.rotateSpeed * 0.75, 0);
  if (keys.ArrowRight) lookDelta(dt * CAM.rotateSpeed * 0.75, 0);
  if (keys.ArrowUp) lookDelta(0, -dt * CAM.pitchSpeed * 0.8);
  if (keys.ArrowDown) lookDelta(0, dt * CAM.pitchSpeed * 0.8);
}

function onKeyDown(e) {
  keys[e.code] = true;
  if (!S.started) return;
  if (menuOpen()) { if (e.code === 'Escape') closeMenu(); return; }
  if (choiceOpen()) {
    if (e.code === 'Digit1') pickOffer(0);
    if (e.code === 'Digit2') pickOffer(1);
    if (e.code === 'Digit3') pickOffer(2);
    if (e.code === 'Escape') skipLevelUp();
    return;
  }
  if (e.code === 'Escape') { openPause(); return; }
  S.padActive = false;
  if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') { tryDodge(); e.preventDefault(); }
  if (e.code === 'KeyE') tryInteract();
  if (e.code === 'KeyQ') tryDrink();
  if (e.code === 'KeyP') togglePixelMode();
  if (e.code === 'KeyM') { S.muted = !S.muted; showHint(S.muted ? 'Sound off' : 'Sound on', 1.2); }
}

function enableTouchUI() {
  if (S.isTouch) return;
  S.isTouch = true;
  document.getElementById('dodgeBtn').style.display = 'block';
  document.getElementById('healBtn').style.display = 'block';
}

export function initInput() {
  addEventListener('keydown', onKeyDown);
  addEventListener('keyup', e => { keys[e.code] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

  // mouse: orbit and tilt the camera (pointer lock, or drag as a fallback)
  canvas.addEventListener('mousedown', () => {
    if (!S.started) return;
    try { const r = canvas.requestPointerLock && canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (_) {}
  });
  addEventListener('mousemove', e => {
    if (!S.started || S.paused) return;
    if (document.pointerLockElement === canvas || (e.buttons & 1)) {
      S.padActive = false;
      lookDelta(e.movementX * 0.0026 * settings.mouseSens, e.movementY * 0.0022 * settings.mouseSens * (settings.invertMouseY ? -1 : 1));
    }
  });

  // touch: left side = virtual stick, right side = drag to orbit and tilt the camera
  const stickBase = document.getElementById('stickBase'), stickKnob = document.getElementById('stickKnob');
  canvas.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' || !S.started) return;
    enableTouchUI();
    if (e.clientX < W() * 0.45 && stick.id === null) {
      Object.assign(stick, { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: 0, y: 0 });
      stickBase.style.display = 'block'; stickBase.style.left = e.clientX + 'px'; stickBase.style.top = e.clientY + 'px'; stickKnob.style.transform = '';
    } else if (look.id === null) Object.assign(look, { id: e.pointerId, lx: e.clientX, ly: e.clientY });
  });
  addEventListener('pointermove', e => {
    if (e.pointerId === stick.id) {
      let x = (e.clientX - stick.ox) / 48, y = (e.clientY - stick.oy) / 48;
      const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
      stick.x = x; stick.y = y;
      stickKnob.style.transform = `translate(${x * 34}px,${y * 34}px)`;
    } else if (e.pointerId === look.id) {
      lookDelta((e.clientX - look.lx) * 0.0065, (e.clientY - look.ly) * 0.0045);
      look.lx = e.clientX; look.ly = e.clientY;
    }
  });
  const end = e => {
    if (e.pointerId === stick.id) { stick.id = null; stick.x = stick.y = 0; stickBase.style.display = 'none'; }
    if (e.pointerId === look.id) look.id = null;
  };
  addEventListener('pointerup', end);
  addEventListener('pointercancel', end);

  const tap = (id, fn) => document.getElementById(id).addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); fn(); });
  tap('dodgeBtn', tryDodge);
  tap('healBtn', tryDrink);
  tap('actBtn', tryInteract);
}
