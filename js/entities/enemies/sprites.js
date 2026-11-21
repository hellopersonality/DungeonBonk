// Enemy visuals: each enemy is a billboard sprite actor (render/sprites.js) driven by its AI
// state. The AI code is unchanged: it still poses the old 3D rig parts (e.arm, e.upper,
// e.legs...) which are now invisible stand-ins (see stubRig). Remove those writes once the
// real art pipeline is settled.
import { S } from '../../core/state.js';
import { HUSK, SKIT, SPIT, GK } from '../../data/tuning.js';
import { createActor } from '../../render/sprites.js';
import { PLACEHOLDER } from '../../render/placeholders.js';

const WIND = { husk: HUSK.WIND, skitter: SKIT.WIND, spitter: SPIT.WIND };
const REC = { husk: HUSK.REC, skitter: SKIT.REC, spitter: SPIT.REC };

/** Invisible stand-ins for the old 3D rig parts, so AI code that poses them keeps working. */
export function stubRig(e) {
  const o = () => new THREE.Object3D();
  e.lL = o(); e.lR = o(); e.upper = o(); e.arm = o(); e.body = o(); e.head = o();
  e.legs = [o(), o(), o(), o(), o(), o()];
  e.eyeMat = new THREE.MeshBasicMaterial();
  e.sacMat = new THREE.MeshBasicMaterial({ color: 0x3a5a18 });
}

/** Give an enemy its billboard sprite: kind is a key of PLACEHOLDER (husk, skitter, ...). */
export function attachSprite(e, kind) {
  const P = PLACEHOLDER[kind];
  e.actor = createActor({ w: P.w, h: P.h, shadow: P.shadow, draw: P.draw });
  e.lastX = e.spawn.x; e.lastZ = e.spawn.z;
}

/** Per frame: choose the animation frame from the enemy's state and repaint if it changed. */
export function updateEnemySprite(e) {
  const A = e.actor, p = e.root.position;
  A.group.visible = e.root.visible;
  if (!e.root.visible) return;
  A.setPos(p.x, 0, p.z);
  const view = A.orient(e.facing);
  const moved = Math.hypot(p.x - e.lastX, p.z - e.lastZ) > 0.008;
  e.lastX = p.x; e.lastZ = p.z;

  let anim = 'idle', f = Math.floor(S.clock * 2 + e.spawn.x) & 1, k = 0;
  const jitter = Math.floor(S.clock * 30) & 1;
  switch (e.state) {
    case 'dead': anim = 'dead'; k = Math.min(1, e.t * 4); break;
    case 'windup': anim = 'windup'; f = jitter; k = Math.min(1, e.t / (e.type === 'boss' ? e.wind : WIND[e.type])); break;
    case 'combo': anim = 'windup'; f = jitter; break;
    case 'lunge': anim = 'lunge'; break;
    case 'recover': anim = 'recover'; k = Math.min(1, e.t / (e.type === 'boss' ? GK.REC : REC[e.type])); break;
    case 'stagger': anim = 'stagger'; f = jitter; break;
    case 'roar': anim = 'roar'; k = 1; break;
    default: if (moved) { anim = 'walk'; f = Math.floor(e.walk / (Math.PI / 2)) & 3; }
  }
  const q = Math.min(5, Math.floor(k * 6));
  const flash = e.flash > 0 ? 'hit' : '';
  A.show(`${anim}|${f}|${q}|${view}|${flash}`, { anim, f, k: anim === 'dead' ? Math.round(k * 4) / 4 : q / 5, view, flash });
  // squash and stretch (the spitter swells as it winds up) comes from the old model scale
  const base = e.baseScale || 1;
  A.sx = e.model.scale.x / base; A.sy = e.model.scale.y / base;
}
