// Shared runtime state. Modules read and write fields on `S` instead of exporting
// their own mutable variables, so there is one obvious place to look for game flags.
import { CAM } from '../data/tuning.js';

export const S = {
  started: false,   // title screen dismissed
  paused: false,    // any menu is open (pause, crystal, forge, altar)
  yaw: 0,           // camera orbit angle around the hero (radians)
  zoom: CAM.zoom,   // camera distance from the hero (capped by CAM.zoomMin/zoomMax)
  pitch: 0.8,       // camera pitch (positive looks down); derived from zoom each frame
  clock: 0,         // game time in seconds (stops while paused)
  hitstop: 0,       // freeze-frame timer on hits
  shake: 0,         // camera shake amount
  healFlash: 0,     // green flash on the hero after drinking
  isTouch: false,   // touch controls detected
  padActive: false, // last input came from a gamepad
  pixelMode: false, // low-res render toggle
  muted: false,
};

/** Currently held keyboard keys, by KeyboardEvent.code. */
export const keys = {};

export function releaseKeys() {
  for (const k in keys) keys[k] = false;
}

export function exitPointerLock() {
  try { document.exitPointerLock && document.exitPointerLock(); } catch (_) {}
}
