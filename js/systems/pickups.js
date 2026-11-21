// Embers (currency) and healing flasks lying in the world.
import { V3, lerp } from '../core/util.js';
import { sfx } from '../core/audio.js';
import { FLASK } from '../data/tuning.js';
import { scene } from '../render/renderer.js';
import { TEX } from '../render/textures.js';
import { boxM } from '../world/geometry.js';
import { hero } from '../entities/hero.js';
import { dmgNum } from '../ui/numbers.js';
import { showHint } from '../ui/messages.js';

// ---------- embers ----------
const embers = [];
const emberGeo = new THREE.OctahedronGeometry(0.1, 0);
export const emberMat = new THREE.MeshBasicMaterial({ color: 0xffa040 });

export function dropEmbers(p, n) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(emberGeo, emberMat);
    m.position.set(p.x, 1.2, p.z); scene.add(m);
    const a = Math.random() * Math.PI * 2, s = 1.5 + Math.random() * 2;
    embers.push({ m, v: new V3(Math.cos(a) * s, 3 + Math.random() * 2, Math.sin(a) * s), age: 0 });
  }
}

export function updateEmbers(dt) {
  for (let i = embers.length - 1; i >= 0; i--) {
    const em = embers[i]; em.age += dt;
    const p = em.m.position, dx = hero.pos.x - p.x, dz = hero.pos.z - p.z, d = Math.hypot(dx, dz) || 1;
    if (em.age > 0.5 && d < 3.5 && !hero.dead) { // magnet toward the hero
      em.v.x = lerp(em.v.x, dx / d * 9, dt * 6); em.v.z = lerp(em.v.z, dz / d * 9, dt * 6); em.v.y = lerp(em.v.y, (1 - p.y) * 6, dt * 6);
    } else em.v.y -= 14 * dt;
    p.addScaledVector(em.v, dt);
    if (p.y < 0.25) { p.y = 0.25; em.v.y *= -0.4; em.v.x *= 0.7; em.v.z *= 0.7; }
    em.m.rotation.y += dt * 4;
    if (d < 0.7 && em.age > 0.5 && !hero.dead) { scene.remove(em.m); embers.splice(i, 1); hero.carried++; sfx.ember(); }
  }
}

export function clearEmbers() {
  for (const e of embers) scene.remove(e.m);
  embers.length = 0;
}

// ---------- flasks ----------
export const flaskMats = {
  glass: new THREE.MeshLambertMaterial({ color: 0xd83a2a, emissive: 0x5a0a06 }),
  cork: new THREE.MeshLambertMaterial({ map: TEX.noise, color: 0x8a6a40 }),
  glow: new THREE.MeshBasicMaterial({ color: 0xff5040, transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending }),
};
const flasks = [];
let fullNote = 0;

function flaskMesh() {
  const g = new THREE.Group(), M = flaskMats;
  boxM(0.26, 0.26, 0.26, M.glass, 0, 0.13, 0, g);
  boxM(0.1, 0.14, 0.1, M.glass, 0, 0.33, 0, g);
  boxM(0.12, 0.06, 0.12, M.cork, 0, 0.42, 0, g);
  const glow = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), M.glow); glow.position.y = 0.2; g.add(glow);
  return g;
}

/** Place a flask. World flasks respawn when the dungeon resets; drops vanish. */
export function addFlask(x, z, fromDrop) {
  const m = flaskMesh(); m.position.set(x, 0.3, z); scene.add(m);
  const p = { m, x, z, active: true, drop: !!fromDrop, t: Math.random() * 6 };
  flasks.push(p);
  return p;
}

export function resetFlasks() {
  for (let i = flasks.length - 1; i >= 0; i--) {
    const p = flasks[i];
    if (p.drop) { scene.remove(p.m); flasks.splice(i, 1); }
    else { p.active = true; p.m.visible = true; }
  }
}

export function updateFlasks(dt) {
  fullNote -= dt;
  for (let i = flasks.length - 1; i >= 0; i--) {
    const p = flasks[i]; if (!p.active) continue;
    p.t += dt; p.m.position.y = 0.3 + Math.sin(p.t * 2.2) * 0.08; p.m.rotation.y += dt * 1.2;
    if (hero.dead || Math.hypot(hero.pos.x - p.x, hero.pos.z - p.z) > 0.9) continue;
    if (hero.flasks >= FLASK.max) {
      if (fullNote <= 0) { showHint(`Flasks full (${FLASK.max}/${FLASK.max})`, 1.5); fullNote = 2.5; }
      continue;
    }
    hero.flasks++;
    dmgNum(p.x, 1.0, p.z, '+1 flask', 'heal'); sfx.flask();
    if (p.drop) { scene.remove(p.m); flasks.splice(i, 1); } else { p.active = false; p.m.visible = false; }
  }
}
