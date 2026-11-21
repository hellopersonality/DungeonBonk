// Hero line-of-sight rendering.
//
// 1. A top-down "wall map" texture marks every cell that blocks sight.
// 2. Every level material is patched so each pixel checks five sight lines from
//    around the hero across that map; anything the hero can't see fades to black.
// 3. A clip plane (moved by render/camera.js) cuts away walls between the camera
//    and the hero, without clipping the hero.
import { BG } from './renderer.js';

export const clipPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 1e5);

const RES = 4; // wall-map cells per world unit
export const maskU = {
  uOcc: { value: null },
  uOccRect: { value: new THREE.Vector4() },
  uHero: { value: new THREE.Vector2() },
};
let occ = null; // {data, tex, x0, z0, w, h}

const bg = new THREE.Color(BG);
const BG_GLSL = `vec3(${bg.r.toFixed(4)},${bg.g.toFixed(4)},${bg.b.toFixed(4)})`;

const MASK_HEAD = `varying vec3 vWPos;
uniform sampler2D uOcc;uniform vec4 uOccRect;uniform vec2 uHero;
float occAt(vec2 p){vec2 uv=(p-uOccRect.xy)/uOccRect.zw;if(uv.x<0.0||uv.y<0.0||uv.x>1.0||uv.y>1.0)return 1.0;return texture2D(uOcc,uv).r;}
float rayVis(vec2 o,vec2 p){
  vec2 d=p-o;float L=length(d);if(L<0.4)return 1.0;
  vec2 dir=d/L;float stop=L-0.4;bool started=occAt(o)<0.5;
  for(int i=0;i<110;i++){
    float t=float(i)*0.28;if(t>stop)break;
    float oc=occAt(o+dir*t);
    if(!started){if(oc<0.5)started=true;}
    else if(oc>0.5)return 0.0;
  }
  return 1.0;
}
float heroVis(vec2 p){
  vec2 d=p-uHero;float L=length(d);
  if(L>30.0)return 1.0;
  vec2 n=vec2(-d.y,d.x)/max(L,0.001);
  float c=rayVis(uHero,p);
  float acc=c*0.3;
  vec2 o1=uHero+n*0.45,o2=uHero-n*0.45,o3=uHero+n*1.0,o4=uHero-n*1.0;
  acc+=(occAt(o1)<0.5?rayVis(o1,p):c)*0.2;
  acc+=(occAt(o2)<0.5?rayVis(o2,p):c)*0.2;
  acc+=(occAt(o3)<0.5?rayVis(o3,p):c)*0.15;
  acc+=(occAt(o4)<0.5?rayVis(o4,p):c)*0.15;
  return smoothstep(0.0,1.0,acc);
}
`;

/** Patch a material so it respects hero line-of-sight and the camera cut-away. */
export function maskMat(m) {
  if (!m || m.userData.masked) return m;
  m.userData.masked = true;
  m.clippingPlanes = [clipPlane];
  m.onBeforeCompile = sh => {
    sh.uniforms.uOcc = maskU.uOcc;
    sh.uniforms.uOccRect = maskU.uOccRect;
    sh.uniforms.uHero = maskU.uHero;
    sh.vertexShader = 'varying vec3 vWPos;\n' + sh.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\nvWPos=(modelMatrix*vec4(transformed,1.0)).xyz;');
    sh.fragmentShader = MASK_HEAD + sh.fragmentShader
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nfloat visF=heroVis(vWPos.xz);')
      .replace('#include <dithering_fragment>', `gl_FragColor.rgb=mix(${BG_GLSL},gl_FragColor.rgb,visF);\n#include <dithering_fragment>`);
  };
  return m;
}

/** Patch every material in the scene except objects flagged userData.noMask. */
export function maskScene(scene) {
  scene.traverse(o => {
    if (!o.material || o.userData.noMask) return;
    (Array.isArray(o.material) ? o.material : [o.material]).forEach(maskMat);
  });
}

/**
 * Build the wall map. A cell is open when it lies inside a room and is not covered
 * by a sight-blocking solid (`blocksSight(solid)` decides which solids count).
 */
export function buildOcc(rooms, solids, blocksSight) {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const r of Object.values(rooms)) {
    x0 = Math.min(x0, r.x0); z0 = Math.min(z0, r.z0); x1 = Math.max(x1, r.x1); z1 = Math.max(z1, r.z1);
  }
  x0 = Math.floor(x0) - 3; z0 = Math.floor(z0) - 3; x1 = Math.ceil(x1) + 3; z1 = Math.ceil(z1) + 3;
  const w = x1 - x0, h = z1 - z0, GW = w * RES, GH = h * RES;
  const data = new Uint8Array(GW * GH * 4);
  const roomList = Object.values(rooms);
  const blockers = solids.filter(blocksSight);
  for (let r = 0; r < GH; r++) {
    for (let c = 0; c < GW; c++) {
      const x = x0 + (c + 0.5) / RES, z = z0 + (r + 0.5) / RES;
      let solid = !roomList.some(rm => x > rm.x0 && x < rm.x1 && z > rm.z0 && z < rm.z1);
      if (!solid) solid = blockers.some(b => x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1);
      if (solid) data[(r * GW + c) * 4] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, GW, GH, THREE.RGBAFormat);
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  maskU.uOcc.value = tex;
  maskU.uOccRect.value.set(x0, z0, w, h);
  occ = { data, tex, x0, z0, w, h, GW, GH };
  return occ;
}
export const getOcc = () => occ;

// The sight origin trails the hero slightly so reveals ease in instead of snapping.
const sightEye = { x: 0, z: 0, init: false };
export function updateSight(pos, dt) {
  const dx = pos.x - sightEye.x, dz = pos.z - sightEye.z;
  if (!sightEye.init || dx * dx + dz * dz > 9) { sightEye.x = pos.x; sightEye.z = pos.z; sightEye.init = true; }
  else { const k = Math.min(1, dt * 7); sightEye.x += dx * k; sightEye.z += dz * k; }
  maskU.uHero.value.set(sightEye.x, sightEye.z);
}
