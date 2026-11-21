// Entry point: build the world, wire up input and UI, run the game loop.
import { S } from './core/state.js';
import { save, eraseSave, hasProgress } from './core/save.js';
import { initAudio } from './core/audio.js';
import { renderer, scene, camera } from './render/renderer.js';
import { buildOcc, maskScene, maskMat } from './render/visibility.js';
import { updateCamera } from './render/camera.js';
import { solids } from './world/geometry.js';
import { updateProps } from './world/props.js';
import { buildRegion1 } from './world/region1.js';
import { hero, initHero, updateHero, updateHeroVisuals } from './entities/hero.js';
import { enemies, bossRef, updateEnemies } from './entities/enemies/registry.js';
import { updateProjectiles, spitMat } from './entities/enemies/spitter.js';
import { updateEmbers, updateFlasks, emberMat, flaskMats } from './systems/pickups.js';
import { updateBoonFx, updateAltars, runeMats } from './systems/boons.js';
import { level } from './systems/world.js';
import { initInput } from './input/input.js';
import { pollPad } from './input/gamepad.js';
import { updateHUD } from './ui/hud.js';
import { updateNums } from './ui/numbers.js';
import { showHint } from './ui/messages.js';

// ---------- build ----------
initHero();
const rooms = buildRegion1();
// Sight is blocked by full-height walls (including the illusory wall), not by pillars, ledges or gates.
buildOcc(rooms, solids, b => !b.fade && !b.gate && b.h >= 4.1);
maskScene(scene);
// materials created later at runtime share these, so patch them up front
[spitMat, emberMat, flaskMats.glass, flaskMats.cork, flaskMats.glow, runeMats.core, runeMats.glow].forEach(maskMat);
initInput();

// ---------- title screen ----------
const startBtn = document.getElementById('startBtn');
if (hasProgress()) startBtn.textContent = 'CONTINUE';
function start() {
  if (S.started) return;
  initAudio();
  document.getElementById('overlay').style.display = 'none';
  S.started = true;
  showHint(save.shortcut ? 'The return passage stands open. Run the loop.' : 'Head north through the hall. Find the way around.', 6);
}
startBtn.addEventListener('click', start);
document.getElementById('resetBtn').addEventListener('click', () => { eraseSave(); location.reload(); });

// ---------- loop ----------
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const raw = Math.min(0.05, (now - last) / 1000); last = now;
  let dt = raw;
  pollPad(raw, start);
  if (S.hitstop > 0) { S.hitstop -= raw; dt = 0; }
  if (S.shake > 0) S.shake = Math.max(0, S.shake - raw * 1.2);

  if (S.started && dt > 0 && !S.paused) {
    S.clock += dt;
    updateFlasks(dt);
    updateHero(dt);
    level.update && level.update(dt);
    updateEnemies(dt);
    updateProjectiles(dt);
    updateEmbers(dt);
    updateBoonFx(dt);
  }
  updateProps(now, raw);
  updateAltars(now, raw);
  updateHeroVisuals(now, raw);
  updateCamera(raw);
  updateNums(raw);
  updateHUD(raw);
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);

// Debug handle for testing: open the page with #debug
if (location.hash === '#debug') {
  window.__dbg = { S, save, hero, enemies, get boss() { return bossRef.e; } };
}
