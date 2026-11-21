// Billboard sprite actors: the 2.5D characters. Each actor is an upright quad that always
// faces the camera (it turns with the orbit but only around the vertical axis, plus a
// slight lean back so it isn't foreshortened from a high camera), with a blob shadow on
// the floor.
//
// The pixels come from a draw function `draw(ctx, A)` that paints one frame onto a small
// canvas. Right now those are procedural placeholders (render/placeholders.js). When real
// pixel art exists, swap `draw` for something that blits a frame from a sprite sheet; the
// rest of the pipeline (billboarding, flipping, outline, hit flash, masking) stays.
import { S } from '../core/state.js';
import { lerp } from '../core/util.js';
import { scene } from './renderer.js';
import { maskMat } from './visibility.js';

/** Sprite pixels per world unit. Walls are 32px per 2 units, so this matches their texel size. */
export const PX = 16;
const LEAN = 0.55; // fraction of camera pitch the sprite tilts back by
const OUTLINE = [18, 14, 12];

const actors = [], ghostMeshes = [];

// Sprites use unlit materials, so they are tinted by the point lights around them (torches,
// the hero's lantern), matching three's non-physical Lambert falloff, as if lit from the front.
const MIN_LIGHT = 0.12;
let lights = null;
const _lp = new THREE.Vector3();
function lightAt(x, z, out) {
  if (!lights) { lights = []; scene.traverse(o => { if (o.isPointLight) lights.push(o); }); }
  let r = MIN_LIGHT, g = MIN_LIGHT, b = MIN_LIGHT;
  for (const l of lights) {
    if (!l.visible || l.intensity <= 0) continue;
    l.getWorldPosition(_lp);
    const d = Math.hypot(_lp.x - x, _lp.y - 1, _lp.z - z);
    if (l.distance > 0 && d >= l.distance) continue;
    const k = l.intensity * (l.distance > 0 ? Math.pow(1 - d / l.distance, l.decay) : 1);
    r += l.color.r * k; g += l.color.g * k; b += l.color.b * k;
  }
  out.setRGB(Math.min(1, r), Math.min(1, g), Math.min(1, b));
}

// Feet at the origin. Normals point straight up so the sight-mask shader (visibility.js)
// judges the sprite where it stands instead of offset toward the camera.
const quadGeo = (() => {
  const g = new THREE.PlaneGeometry(1, 1); g.translate(0, 0.5, 0);
  const n = g.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
  return g;
})();
const shadowGeo = (() => { const g = new THREE.CircleGeometry(1, 20); g.rotateX(-Math.PI / 2); return g; })();

/** 1px dark outline around every opaque pixel: gives placeholders (and sheets) a cohesive look. */
function outline(g, w, h) {
  const img = g.getImageData(0, 0, w, h), d = img.data, solid = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) solid[i] = d[i * 4 + 3] > 127 ? 1 : 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (solid[i]) continue;
    if ((x > 0 && solid[i - 1]) || (x < w - 1 && solid[i + 1]) || (y > 0 && solid[i - w]) || (y < h - 1 && solid[i + w])) {
      d[i * 4] = OUTLINE[0]; d[i * 4 + 1] = OUTLINE[1]; d[i * 4 + 2] = OUTLINE[2]; d[i * 4 + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
}

const FLASH = { hit: 'rgba(255,255,255,0.6)', hurt: 'rgba(255,40,30,0.5)', heal: 'rgba(80,255,120,0.4)' };

/**
 * @param {object} o  w,h: canvas size in px · draw(ctx, A): paints one frame ·
 *                    shadow: blob radius in world units · mask: obey hero line of sight
 */
export function createActor(o) {
  const canvas = document.createElement('canvas'); canvas.width = o.w; canvas.height = o.h;
  const g = canvas.getContext('2d', { willReadFrequently: true }); g.imageSmoothingEnabled = false;
  const tmp = document.createElement('canvas'); tmp.width = o.w; tmp.height = o.h;
  const tg = tmp.getContext('2d', { willReadFrequently: true });

  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false;
  const mat = new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(quadGeo, mat);
  mesh.rotation.order = 'YXZ';
  const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.42, depthWrite: false });
  const shadow = new THREE.Mesh(shadowGeo, shadowMat);
  shadow.position.y = 0.03; shadow.scale.setScalar(o.shadow || 0.6);
  if (o.mask !== false) { maskMat(mat); maskMat(shadowMat); }

  const group = new THREE.Group();
  group.add(shadow, mesh);
  scene.add(group);
  group.traverse(m => { m.userData.noMask = o.mask === false; });

  const a = {
    group, mesh, mat, w: o.w, h: o.h, key: null, flip: false,
    sx: 1, sy: 1, // squash/stretch on top of the pixel size
    setPos(x, y, z) { group.position.set(x, y, z); },
    /** Work out left/right flip (with hysteresis) and front/back view for a world facing angle. */
    orient(facing) {
      const s = Math.sin(S.yaw - facing);       // + = facing screen-right
      if (s > 0.12) a.flip = false; else if (s < -0.12) a.flip = true;
      const c = Math.cos(facing - S.yaw);       // + = facing away from the camera
      return c > 0.4 ? 'away' : c < -0.4 ? 'front' : 'side';
    },
    /** Repaint only when the frame key changed. */
    show(key, A) {
      if (key === a.key) return;
      a.key = key;
      g.clearRect(0, 0, o.w, o.h);
      if (A.anim === 'dead') { // fall over: the idle frame squashed flat against the floor
        tg.clearRect(0, 0, o.w, o.h);
        o.draw(tg, { ...A, anim: 'idle', f: 0 }); outline(tg, o.w, o.h);
        const k = A.k, dw = o.w * lerp(1, 1.15, k), dh = o.h * lerp(1, 0.28, k);
        g.drawImage(tmp, (o.w - dw) / 2, o.h - dh, dw, dh);
      } else {
        o.draw(g, A); outline(g, o.w, o.h);
      }
      if (A.flash && FLASH[A.flash]) {
        g.globalCompositeOperation = 'source-atop'; g.fillStyle = FLASH[A.flash]; g.fillRect(0, 0, o.w, o.h);
        g.globalCompositeOperation = 'source-over';
      }
      tex.needsUpdate = true;
    },
    /** Frozen copy of the current frame as a new texture (dash afterimages). */
    snapshot() {
      const c = document.createElement('canvas'); c.width = o.w; c.height = o.h;
      c.getContext('2d').drawImage(canvas, 0, 0);
      const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
      return t;
    },
    dispose() { scene.remove(group); mat.dispose(); tex.dispose(); shadowMat.dispose(); const i = actors.indexOf(a); if (i >= 0) actors.splice(i, 1); },
  };
  actors.push(a);
  return a;
}

/** A one-off billboard (afterimage). Dispose it with removeGhost(). */
export function createGhost(tex, w, h, flip, color) {
  const mat = new THREE.MeshBasicMaterial({ map: tex, color, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  const mesh = new THREE.Mesh(quadGeo, mat);
  mesh.rotation.order = 'YXZ'; mesh.userData.noMask = true;
  mesh.userData.sx = (flip ? -1 : 1) * w / PX; mesh.userData.sy = h / PX;
  scene.add(mesh); ghostMeshes.push(mesh);
  return mesh;
}
export function removeGhost(m) {
  scene.remove(m); m.material.map.dispose(); m.material.dispose();
  const i = ghostMeshes.indexOf(m); if (i >= 0) ghostMeshes.splice(i, 1);
}

/** Called once per frame by the camera: turn every sprite to face it. */
export function updateBillboards(yaw, pitch) {
  const ry = yaw + Math.PI, rx = -pitch * LEAN;
  for (const a of actors) {
    if (!a.group.visible) continue;
    lightAt(a.group.position.x, a.group.position.z, a.mat.color);
    a.mesh.rotation.set(rx, ry, 0);
    a.mesh.scale.set((a.flip ? -1 : 1) * a.sx * a.w / PX, a.sy * a.h / PX, 1);
  }
  for (const m of ghostMeshes) { m.rotation.set(rx, ry, 0); m.scale.set(m.userData.sx, m.userData.sy, 1); }
}
