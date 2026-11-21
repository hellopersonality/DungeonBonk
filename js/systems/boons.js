// Boons: altars that offer them, the active set, and their visual effects
// (crescent waves, ember trails, corpse bursts).
import { S } from '../core/state.js';
import { av, sfx } from '../core/audio.js';
import { BOON_FX } from '../data/boons.js';
import { scene } from '../render/renderer.js';
import { maskMat } from '../render/visibility.js';
import { MAT } from '../render/textures.js';
import { boxM, circleGeo, sectorGeo, camBlocked } from '../world/geometry.js';
import { V3 } from '../core/util.js';
import { hero, weapon, refreshReach } from '../entities/hero.js';
import { enemies } from '../entities/enemies/registry.js';
import { dealDamage } from './combat.js';
import { addInteract } from './interact.js';
import { openChoice } from '../ui/choice.js';
import { renderBoons } from '../ui/hud.js';
import { showHint } from '../ui/messages.js';

export const has = id => hero.boons.has(id);

export function addBoon(id) {
  hero.boons.add(id);
  renderBoons(); refreshReach();
}

export function clearBoons(reason) {
  if (hero.boons.size && reason) showHint(reason, 3);
  hero.boons.clear(); hero.riposte = false;
  renderBoons(); refreshReach();
}

// ---------- altars ----------
const altars = [];
export const runeMats = {
  core: new THREE.MeshBasicMaterial({ color: 0xb070ff }),
  glow: new THREE.MeshBasicMaterial({ color: 0x8040d0, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending }),
};

/** An altar offering `offer` boons. `hidden` altars appear later (boss reward). */
export function makeAltar(x, z, offer, hidden) {
  const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
  boxM(1.0, 0.2, 1.0, MAT.stone, 0, 0.1, 0, g);
  boxM(0.6, 0.8, 0.6, MAT.stone, 0, 0.6, 0, g);
  boxM(0.85, 0.12, 0.85, MAT.stone, 0, 1.06, 0, g);
  [[0.31, 0], [-0.31, 0], [0, 0.31], [0, -0.31]].forEach(([a, b]) => boxM(a ? 0.02 : 0.3, 0.06, a ? 0.3 : 0.02, runeMats.core, a, 0.6, b, g));
  const rune = new THREE.Group(); rune.position.y = 1.6; g.add(rune);
  rune.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), runeMats.core));
  rune.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), runeMats.glow));
  const a = { g, rune, x, z, offer, used: false, hidden: !!hidden, reveal: !!hidden };
  g.visible = !hidden;
  altars.push(a);
  addInteract({ x, z, r: 2, label: 'Altar', cond: () => !a.used && !a.hidden, act: () => openChoice(a) });
  return a;
}

export function revealAltar(a) { a.hidden = false; a.g.visible = true; a.used = false; a.rune.visible = true; }
export function useAltar(a) { a.used = true; a.rune.visible = false; }

export function resetAltars() {
  for (const a of altars) {
    a.used = false; a.rune.visible = true;
    if (a.reveal) { a.hidden = true; a.g.visible = false; }
  }
}

export function updateAltars(now, dt) {
  for (const a of altars) { a.rune.rotation.y += dt * 1.5; a.rune.position.y = 1.6 + Math.sin(now * 0.003 + a.x) * 0.1; }
}

// ---------- effects ----------
const waves = [], trails = [], bursts = [];
const waveGeo = sectorGeo(0.9, 1.4, Math.PI * 0.7);
const trailGeo = (() => { const g = new THREE.PlaneGeometry(0.75, 0.75); g.rotateX(-Math.PI / 2); return g; })();
const fxMat = (c, o) => maskMat(new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
const _wp = new V3();

export function spawnWave() {
  const m = new THREE.Mesh(waveGeo, fxMat(0xffb060, 0.7));
  m.position.set(hero.pos.x, 0.9, hero.pos.z); m.rotation.y = hero.facing; scene.add(m);
  waves.push({ m, dx: Math.sin(hero.facing), dz: Math.cos(hero.facing), t: 0, hit: new Set() });
  sfx.wave();
}
export function spawnTrail() {
  const m = new THREE.Mesh(trailGeo, fxMat(0xff7a20, 0.55));
  m.position.set(hero.pos.x, 0.05, hero.pos.z); m.rotation.y = Math.random() * 3; scene.add(m);
  trails.push({ m, x: hero.pos.x, z: hero.pos.z, t: BOON_FX.trailLife });
}
export function queueBurst(x, z) { bursts.push({ x, z, t: BOON_FX.burstDelay, m: null }); }

export function updateBoonFx(dt) {
  const F = BOON_FX;
  for (let i = waves.length - 1; i >= 0; i--) {
    const w = waves[i]; w.t += dt;
    const p = w.m.position; p.x += w.dx * F.waveSpeed * dt; p.z += w.dz * F.waveSpeed * dt;
    w.m.material.opacity = 0.7 * (1 - w.t / F.waveLife); w.m.scale.setScalar(1 + w.t * 0.8);
    for (const e of enemies) {
      if (e.state === 'dead' || w.hit.has(e)) continue;
      const ep = e.root.position;
      if (Math.hypot(ep.x - p.x, ep.z - p.z) < 1.3 + e.radius) { w.hit.add(e); dealDamage(e, Math.round(weapon.s.dmg * F.waveDmgMul), false, true); }
    }
    _wp.set(p.x, 1.0, p.z);
    if (w.t > F.waveLife || camBlocked(_wp, 0)) { scene.remove(w.m); w.m.material.dispose(); waves.splice(i, 1); }
  }
  for (let i = trails.length - 1; i >= 0; i--) {
    const tr = trails[i]; tr.t -= dt;
    tr.m.material.opacity = 0.55 * Math.min(1, tr.t / 0.5) * (0.8 + Math.random() * 0.2);
    if (tr.t <= 0) { scene.remove(tr.m); tr.m.material.dispose(); trails.splice(i, 1); }
  }
  if (trails.length) for (const e of enemies) {
    if (e.state === 'dead') continue;
    e.burnCd = (e.burnCd || 0) - dt; if (e.burnCd > 0) continue;
    const ep = e.root.position;
    for (const tr of trails) {
      if (Math.hypot(ep.x - tr.x, ep.z - tr.z) < 0.55 + e.radius) {
        dealDamage(e, F.trailDmg, false, true); e.burnCd = F.trailTick;
        sfx.burn(av(Math.hypot(ep.x - hero.pos.x, ep.z - hero.pos.z)));
        break;
      }
    }
  }
  for (let i = bursts.length - 1; i >= 0; i--) {
    const b = bursts[i];
    if (!b.m) {
      b.t -= dt;
      if (b.t <= 0) {
        b.m = new THREE.Mesh(circleGeo(0, 1), fxMat(0xff8a30, 0.75)); b.m.position.set(b.x, 0.08, b.z); scene.add(b.m); b.life = 0;
        for (const e of enemies) {
          if (e.state === 'dead') continue;
          const ep = e.root.position;
          if (Math.hypot(ep.x - b.x, ep.z - b.z) < F.burstRadius + e.radius) dealDamage(e, F.burstDmg, false, true);
        }
        const d = Math.hypot(b.x - hero.pos.x, b.z - hero.pos.z);
        sfx.explode(av(d)); if (d < 12) S.shake = Math.max(S.shake, 0.15);
      }
      continue;
    }
    b.life += dt; const k = b.life / 0.3, s = F.burstRadius * Math.min(1, k * 1.5);
    b.m.scale.set(s, 1, s); b.m.material.opacity = 0.75 * (1 - k);
    if (k >= 1) { scene.remove(b.m); b.m.material.dispose(); bursts.splice(i, 1); }
  }
}

export function clearBoonFx() {
  for (const w of waves) scene.remove(w.m);
  for (const t of trails) scene.remove(t.m);
  for (const b of bursts) if (b.m) scene.remove(b.m);
  waves.length = trails.length = bursts.length = 0;
}
