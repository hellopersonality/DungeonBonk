// Persistent progress and player settings (localStorage). Everything is wrapped in
// try/catch because storage can be unavailable (private mode, sandboxed frames).
const SAVE_KEY = 'hollowloop_save_v1';
const SET_KEY = 'hollowloop_settings_v1';

export const save = {
  banked: 0,      // embers safely stored
  shortcut: false,// Region 1 return passage opened
  secret: false,  // hidden cache collected
  defeated: {},   // permanently defeated bosses, by id
  wlvl: 0,        // sweep blade upgrade level
  flasks: 1,      // flasks carried at last save
  checkpoint: 'hub', // id of the crystal last saved at: the return point after death or reload
};

export const settings = {
  invertY: false,
  invertMouseY: false,
  padSens: 1,
  mouseSens: 1,
};

try { Object.assign(save, JSON.parse(localStorage.getItem(SAVE_KEY) || 'null') || {}); } catch (_) {}
// older saves: opening the shortcut meant the Gatekeeper had been beaten
if (save.shortcut && !save.defeated.gatekeeper) save.defeated.gatekeeper = true;
delete save.bestLoop;
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
export const hasProgress = () => !!(save.banked || save.shortcut || save.wlvl);
