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
import { hero, initHero, updateHero, updateHeroVisuals, getHeroModel } from './entities/hero.js';
import { enemies, bossRef, updateEnemies, updateEnemySprites } from './entities/enemies/registry.js';
import { updateProjectiles, spitMat } from './entities/enemies/spitter.js';
import { updateEmbers, updateFlasks, emberMat, flaskMats } from './systems/pickups.js';
import { updateBoonFx } from './systems/boons.js';
import { run } from './systems/leveling.js';
import { openLevelUp } from './ui/levelup.js';
import { level } from './systems/world.js';
import { initInput } from './input/input.js';
import { pollPad } from './input/gamepad.js';
import { updateHUD } from './ui/hud.js';
import { updateNums } from './ui/numbers.js';
import { juiceDom } from './vendor/juice.js';
import { showHint } from './ui/messages.js';

// ---------- build ----------
initHero();
const rooms = buildRegion1();
// Sight is blocked by full-height walls (including the illusory wall), not by pillars, ledges or gates.
buildOcc(rooms, solids, b => !b.fade && !b.gate && b.h >= 4.1);
maskScene(scene);
// materials created later at runtime share these, so patch them up front
[spitMat, emberMat, flaskMats.glass, flaskMats.cork, flaskMats.glow].forEach(maskMat);
initInput();

// ---------- title screen ----------
const startBtn = document.getElementById('startBtn');
startBtn.disabled = false; // stays disabled (LOADING…) until everything above has built
startBtn.textContent = hasProgress() ? 'CONTINUE' : 'ENTER';
window.__booted = true;
document.getElementById('bootErr').style.display = 'none'; // a stray error before boot finished wasn't fatal
function start() {
  if (S.started || !window.__booted) return;
  initAudio();
  document.getElementById('overlay').style.display = 'none';
  S.started = true;
  showHint(save.shortcut ? 'The return passage stands open.' : 'Head north through the hall. Find the way around.', 6);
}
startBtn.addEventListener('click', start);
document.getElementById('resetBtn').addEventListener('click', () => { eraseSave(); location.reload(); });

// ---------- loop ----------
// The simulation advances in steps of at most STEP seconds, so a slow frame runs several
// steps instead of slowing game time. Past MAX_STEPS per frame (a stall, a background tab)
// the extra time is dropped rather than fast-forwarded.
const STEP = 0.05, MAX_STEPS = 5;
let last = performance.now();
function simulate(dt) {
  S.clock += dt;
  updateFlasks(dt);
  updateHero(dt);
  level.update && level.update(dt);
  updateEnemies(dt);
  updateProjectiles(dt);
  updateEmbers(dt);
  updateBoonFx(dt);
}
function frame(now) {
  requestAnimationFrame(frame);
  const elapsed = Math.min(STEP * MAX_STEPS, Math.max(0, (now - last) / 1000)); last = now;
  const raw = Math.min(STEP, elapsed); // visual-only timers
  pollPad(raw, start);
  let dt = elapsed;
  if (S.hitstop > 0) { const h = Math.min(S.hitstop, dt); S.hitstop -= h; dt -= h; }
  if (S.shake > 0) S.shake = Math.max(0, S.shake - elapsed * 1.2);

  if (S.started && dt > 0 && !S.paused) {
    const n = Math.ceil(dt / STEP - 1e-9);
    for (let i = 0; i < n; i++) simulate(dt / n);
  }
  // a full level bar opens the upgrade window (one at a time; more queue up)
  if (S.started && run.pending > 0 && !S.paused && !hero.dead) openLevelUp();
  updateProps(now, raw);
  updateHeroVisuals(now, raw);
  updateEnemySprites();
  updateCamera(raw);
  updateNums(raw);
  updateHUD(raw);
  juiceDom.tick(raw);
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);

// Debug handle for testing: open the page with #debug
if (location.hash === '#debug') {
  window.__dbg = { S, save, hero, enemies, get boss() { return bossRef.e; }, get model() { return getHeroModel(); } };
}
