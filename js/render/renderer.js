// WebGL renderer, scene and camera setup.
import { W, H } from '../core/util.js';
import { S } from '../core/state.js';
import { CAM } from '../data/tuning.js';

export const BG = 0x07060a;

function createRenderer() {
  try { return new THREE.WebGLRenderer({ antialias: false }); }
  catch (err) { throw new Error('WebGL unavailable: ' + (err && err.message || err)); } // shown on the title screen (index.html)
}
export const renderer = createRenderer();
renderer.localClippingEnabled = true; // used by the wall cut-away (see render/visibility.js)
document.body.appendChild(renderer.domElement);
export const canvas = renderer.domElement;

export const scene = new THREE.Scene();
scene.background = new THREE.Color(BG);
scene.fog = new THREE.Fog(BG, 5, 30);

export const camera = new THREE.PerspectiveCamera(CAM.fov, W() / H(), 0.1, 80);

export function applySize() {
  renderer.setPixelRatio(S.pixelMode ? 0.38 : Math.min(devicePixelRatio, 1.5));
  renderer.setSize(W(), H());
  canvas.style.imageRendering = S.pixelMode ? 'pixelated' : 'auto';
}
applySize();

addEventListener('resize', () => {
  camera.aspect = W() / H();
  camera.updateProjectionMatrix();
  applySize();
});

export function togglePixelMode() {
  S.pixelMode = !S.pixelMode;
  applySize();
}
