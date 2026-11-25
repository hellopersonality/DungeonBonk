// Persistent progress and player settings (localStorage). Everything is wrapped in
// try/catch because storage can be unavailable (private mode, sandboxed frames).
const SAVE_KEY = 'hollowloop_save_v1';
const SET_KEY = 'hollowloop_settings_v1';

// Only permanent world progress is saved. Levels, boons and blade upgrades belong to a
// run and are lost on death (systems/leveling.js).
export const save = {
  shortcut: false,// Region 1 return passage opened
  defeated: {},   // permanently defeated bosses, by id
};

export const settings = {
  invertY: false,
  invertMouseY: false,
  padSens: 1,
  mouseSens: 1,
  juice: true,    // juicy text: springy pops and colour shadows
};

try { Object.assign(save, JSON.parse(localStorage.getItem(SAVE_KEY) || 'null') || {}); } catch (_) {}
// older saves: opening the shortcut meant the Gatekeeper had been beaten
if (save.shortcut && !save.defeated.gatekeeper) save.defeated.gatekeeper = true;
for (const k of ['bestLoop', 'banked', 'secret', 'wlvl', 'flasks', 'checkpoint']) delete save[k]; // from older versions
try { Object.assign(settings, JSON.parse(localStorage.getItem(SET_KEY) || '{}')); } catch (_) {}

export function writeSave() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (_) {}
}
export function eraseSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (_) {}
}
export function saveSettings() {
  try { localStorage.setItem(SET_KEY, JSON.stringify(settings)); } catch (_) {}
}
export const hasProgress = () => !!(save.shortcut || Object.keys(save.defeated).length);
