// Region 1: the first loop.
//   Hub → Hall → Corridor → Cistern → Passage → Gatekeeper Arena → Return Passage → Hub
// Everything specific to this region lives here: layout, set dressing, spawns,
// interactables and triggers (loop timer, boss gate, shortcut, secret cache).
// A new region should be a new file with the same shape (build + level hooks).
import { V3, fmtTime } from '../core/util.js';
import { S } from '../core/state.js';
import { save, writeSave } from '../core/save.js';
import { sfx } from '../core/audio.js';
import { MAT, THEMES } from '../render/textures.js';
import { makeBox, fadeBox, boxM, WALL_H } from './geometry.js';
import { room, rooms, inRoom, FULL } from './rooms.js';
import * as P from './props.js';
import { scene } from '../render/renderer.js';
import { hero } from '../entities/hero.js';
import { bossRef } from '../entities/enemies/registry.js';
import { makeHusk } from '../entities/enemies/husk.js';
import { makeSkitter } from '../entities/enemies/skitter.js';
import { makeSpitter } from '../entities/enemies/spitter.js';
import { makeGatekeeper } from '../entities/enemies/gatekeeper.js';
import { addFlask } from '../systems/pickups.js';
import { makeAltar, revealAltar } from '../systems/boons.js';
import { addInteract } from '../systems/interact.js';
import { setLevel, progress } from '../systems/world.js';
import { openCrystal } from '../ui/menus.js';
import { openForge } from '../ui/forge.js';
import { loop } from '../ui/hud.js';
import { showMsg } from '../ui/messages.js';
import { dmgNum } from '../ui/numbers.js';

const HUB_SPAWN = new V3(0, 0, -5);
const PI = Math.PI;
// wall-facing rotations for wall-mounted props (see props.js)
const FACE = { east: -PI / 2, west: PI / 2, north: PI, south: 0 };

const R = {}; // region references (gates, crystals, boss altar, cache)

export function buildRegion1() {
  const T = THEMES;
  // ---------- layout ----------
  room('hub', -8, 8, -8, 8, { n: [[-1.6, 1.6]], w: [[-1.6, 1.6]] }, T.hub);
  room('hall', -6, 8, 8, 28, { s: [[-1.6, 1.6]], w: [[22, 25.2]], e: [[12, 14]] }, T.hall);
  room('secret', 8, 11, 11, 15, { w: FULL }, T.secret);
  room('corridor', -26, -6, 22, 25.2, { e: FULL, w: FULL }, T.corridor);
  room('cistern', -40, -26, 14, 34, { e: [[22, 25.2]], s: [[-35, -31.8]] }, T.cistern);
  room('passage', -35, -31.8, 10, 14, { n: FULL, s: FULL }, T.passage);
  room('arena', -42, -24, -10, 10, { n: [[-35, -31.8]], e: [[-1.6, 1.6]] }, T.arena);
  room('ret', -24, -8, -1.6, 1.6, { e: FULL, w: FULL }, T.passage);

  const pillar = (x, z, w, theme) => fadeBox(x - w, x + w, 0, WALL_H, z - w, z + w, theme.wall);

  // ---------- hub: warm, lived-in ----------
  [[-5, 5], [5, 5], [-5, -5]].forEach(([x, z]) => pillar(x, z, 0.6, T.hub));
  P.ceilingBeams(-8, 8, -8, 7, 'x', 3);
  P.rug(0, 0, 5, 5);
  R.hubCrystal = P.crystal(0, 0, 'Hub');
  P.forge(5, -5.2);
  P.bench(-3, 4, 0); P.bench(3, 4, 0);
  P.barrel(-6.7, -6.7); P.barrel(-5.9, -6.8); P.crate(-6.7, -5.8, 0.7, 0.2);
  P.crate(6.8, 6.2, 0.6, 0.4); P.barrel(6.1, 6.6);
  P.weaponRack(-7.4, 4, FACE.west);
  P.banner(-3.2, 6.95, FACE.north, MAT.bannerBlue); P.banner(3.2, 6.95, FACE.north, MAT.bannerBlue);
  P.banner(7.95, 3.5, FACE.east, MAT.bannerBlue);
  P.torch(7.95, 1, FACE.east);
  P.torch(-7.95, -4.5, FACE.west);

  // ---------- hall: grand, abandoned ----------
  [[2, 12.5], [5, 18.5], [1, 23.5]].forEach(([x, z]) => pillar(x, z, 0.7, T.hall));
  fadeBox(-6, -3, 0, 2.4, 15, 21, T.hall.wall);        // overlook ledge (visible, unreachable)
  P.ledgeWithChest(-6, -3, 15, 21, 2.4, -3.1);
  P.banner(7.95, 17.5, FACE.east, MAT.bannerRed); P.banner(7.95, 26.5, FACE.east, MAT.bannerRed, 1.6);
  P.banner(-2, 27.95, FACE.north, MAT.bannerRed); P.banner(3, 27.95, FACE.north, MAT.bannerRed);
  P.statue(-4.3, 26.5, PI * 0.75);
  P.rubble(-2.4, 14.2, 7, 0.6); P.rubble(6.5, 21, 5, 0.5); P.bones(3.5, 15.5, 4);
  P.torch(-5.95, 11, FACE.west); P.torch(7.95, 23, FACE.east);
  // illusory wall into the secret alcove, with a faint ember glow at its base as the tell
  const fake = T.hall.wall.clone(); fake.color.setHex(0xe2d6c4);
  makeBox(8, 9, 0, WALL_H, 12, 14, fake, 'cam');
  boxM(0.04, 0.05, 1.9, new THREE.MeshBasicMaterial({ color: 0x7a3a12 }), 7.98, 0.03, 13, scene);
  if (!save.secret) R.cache = P.emberCache(10, 13);
  P.roots(9.5, 14, 3);

  // ---------- corridor: rough-hewn tunnel ----------
  P.chain(-10, 23.6, 1.4); P.chain(-14.5, 23.0, 2.0); P.chain(-20.5, 24.3, 1.1);
  P.rubble(-22.5, 22.6, 5, 0.35); P.rubble(-8.5, 24.7, 3, 0.3);
  P.bones(-18, 22.7, 3); P.roots(-17, 24.6, 3);
  P.torch(-16, 25.15, FACE.north);

  // ---------- cistern: cold, wet stone ----------
  [[-37, 17], [-29, 31]].forEach(([x, z]) => pillar(x, z, 0.7, T.cistern));
  P.pool(-36, -30, 23, 30);
  P.pipe('z', -39.8, 15, 33, 2.9); P.pipe('x', 33.8, -39.5, -35.4, 3.3); P.pipe('x', 33.8, -31.4, -26.5, 3.3);
  P.moss(-38, 19, 1.4); P.moss(-28, 21, 1.2); P.moss(-31, 32, 1.0); P.moss(-37, 31.5, 1.2);
  P.barrel(-27.1, 33.1); P.barrel(-27.9, 33.2); P.crate(-39.1, 26.5, 0.6, 0.3);
  P.sigilDoor(-33.4, 33.96, FACE.north);
  P.torch(-39.95, 22, FACE.west, 'witch'); P.torch(-26.05, 31, FACE.east, 'witch');
  R.cisternCrystal = P.crystal(-29, 17, 'Cistern');

  // ---------- passage ----------
  P.rubble(-34.5, 12, 3, 0.3); P.roots(-33.4, 12, 2);

  // ---------- arena: sand, bones, braziers ----------
  [[-38, -6], [-28, -6], [-38, 5], [-28, 5]].forEach(([x, z]) => pillar(x, z, 0.8, T.arena));
  P.brazier(-40.4, -8.4, true); P.brazier(-25.6, -8.4, true); P.brazier(-40.4, 8.4, true); P.brazier(-25.6, 8.4, false);
  P.banner(-41.95, -3.5, FACE.west, MAT.bannerTorn, 2.4); P.banner(-41.95, 3.5, FACE.west, MAT.bannerTorn, 2.4);
  P.banner(-33, -9.95, FACE.south, MAT.bannerTorn, 2.6);
  P.bones(-30, -2, 6); P.bones(-36.5, 2, 5); P.bones(-26.5, 4, 4); P.bones(-39, -2, 4); P.bones(-31, 7.5, 3);
  P.weaponRack(-28.5, -9.5, FACE.south);

  // ---------- return passage ----------
  P.roots(-12, 0, 4); P.roots(-20, 0.3, 3); P.rubble(-16, 1.1, 3, 0.3);

  // ---------- gates ----------
  R.hubGate = P.gate(-8.55, -8.45, -1.6, 1.6, save.shortcut);
  R.arenaN = P.gate(-35, -31.8, 10.45, 10.55, true);
  R.arenaE = P.gate(-23.55, -23.45, -1.6, 1.6, save.shortcut);
  { const l = new THREE.PointLight(0xff6a20, 0.6, 5, 2); l.position.set(-10, 1.5, 0); scene.add(l); }

  // ---------- enemies ----------
  makeHusk(2, 16, PI); makeSkitter(-1, 21, PI); makeSkitter(5, 25, PI); makeHusk(-1, 26.5, PI);
  makeSkitter(-12, 23.6, PI / 2); makeSkitter(-17, 23.6, PI / 2); makeSpitter(-24.5, 23.6, PI / 2);
  makeHusk(-31, 20, PI / 2); makeHusk(-38, 27, PI / 2); makeSpitter(-33, 32.5, PI); makeSkitter(-28, 27.5, PI / 2);
  makeGatekeeper(-33, -3, 0, 'arena');
  makeHusk(-15, 0, -PI / 2); makeSkitter(-11, 0.5, -PI / 2);

  // ---------- items ----------
  [[6.2, 10.4], [-20, 23.6], [-39, 33], [-27.5, 33], [-19, 0.9]].forEach(([x, z]) => addFlask(x, z, false));
  makeAltar(6.2, 26.2, 2);
  makeAltar(-38.6, 15.4, 2);
  R.bossAltar = makeAltar(-33, -6.5, 3, true);

  // ---------- interactables ----------
  for (const c of [R.hubCrystal, R.cisternCrystal]) addInteract({ x: c.x, z: c.z, r: 2.3, label: 'Crystal', prompt: 'Crystal (rest or save)', act: () => openCrystal(c) });
  addInteract({ x: 5, z: -3.8, r: 2, label: 'Forge', act: openForge });
  addInteract({ x: -33.4, z: 32.6, r: 2.4, label: 'Examine', act: () => showMsg('SEALED', 'a sigil is carved here. you have none.', '#a070e0', 2.4) });
  addInteract({ x: -2.4, z: 18, r: 2.2, label: 'Examine', act: () => showMsg('OUT OF REACH', 'something glints on the ledge above', '#e8c070', 2.4) });
  addInteract({ x: -7, z: 0, r: 2.2, label: 'Examine', cond: () => !save.shortcut, act: () => showMsg('BARRED', 'it will not open from this side', '#e8c070', 2.4) });

  progress.lastCrystal = R.hubCrystal;
  hero.pos.copy(HUB_SPAWN); hero.prev.copy(HUB_SPAWN);

  setLevel({
    spawnFor: c => (!c || c === R.hubCrystal ? { x: HUB_SPAWN.x, z: HUB_SPAWN.z } : { x: c.x + 1.4, z: c.z + 1.2 }),
    onReset() { if (!save.shortcut) P.setGate(R.arenaN, true); },
    onRespawn() { loop.start = null; },
    onEnemyKilled,
    update,
  });
  return rooms;
}

function onEnemyKilled(e) {
  if (e !== bossRef.e) return;
  S.bossFight = false;
  P.setGate(R.arenaN, true);
  revealAltar(R.bossAltar);
  if (!save.shortcut) {
    save.shortcut = true; writeSave();
    P.setGate(R.arenaE, true); P.setGate(R.hubGate, true);
    sfx.gate();
    showMsg('THE WAY HOME OPENS', 'the return passage is unbarred · it will stay open', '#e8c070', 3.5);
  } else showMsg('GATEKEEPER FELLED', '', '#e8c070', 2.2);
}

function update() {
  if (hero.dead) return;
  // secret cache behind the illusory wall
  if (R.cache && Math.hypot(hero.pos.x - 10, hero.pos.z - 13) < 1.1) {
    scene.remove(R.cache); R.cache = null;
    hero.carried += 12; save.secret = true; writeSave();
    dmgNum(10, 1.4, 13, '+12', 'gain');
    showMsg('A HIDDEN CACHE', '+12 embers · save at a crystal to keep them', '#ffb050', 2.6);
  }
  // loop timer: starts in the hall, completes when entering the hub from the return passage
  const inHub = inRoom('hub', hero.pos);
  if (loop.start === null && inRoom('hall', hero.pos)) loop.start = S.clock;
  if (loop.start !== null && inHub) {
    if (hero.prev.x < -8 && hero.pos.x >= -8) {
      const t = S.clock - loop.start, best = !save.bestLoop || t < save.bestLoop;
      if (best) { save.bestLoop = t; writeSave(); }
      sfx.loop();
      showMsg('LOOP COMPLETE', fmtTime(t) + (best ? ' · new best' : '') + ' · save at a crystal to bank your embers', '#e8c070', 3.5);
    }
    loop.start = null;
  }
  // boss arena: entering starts the fight; the first time, the door locks behind you
  const boss = bossRef.e;
  if (boss && boss.state !== 'dead' && !S.bossFight && inRoom('arena', hero.pos) && hero.pos.z < 9.6) {
    S.bossFight = true;
    if (boss.state === 'idle') { boss.state = 'chase'; boss.cd = 0.8; }
    if (!save.shortcut) { P.setGate(R.arenaN, false); sfx.gate(); showMsg('THE GATEKEEPER', '', '#c0392b', 2.2); }
  }
}
