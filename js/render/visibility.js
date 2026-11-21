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
  uOccSize: { value: new THREE.Vector2(1, 1) },
  uHero: { value: new THREE.Vector2() },
};
let occ = null; // {data, tex, x0, z0, w, h}

const bg = new THREE.Color(BG);
const BG_GLSL = `vec3(${bg.r.toFixed(4)},${bg.g.toFixed(4)},${bg.b.toFixed(4)})`;

const MASK_HEAD = `varying vec3 vWPos;varying vec3 vWNrm;
uniform sampler2D uOcc;uniform vec4 uOccRect;uniform vec2 uOccSize;uniform vec2 uHero;
float occCell(ivec2 c){
  if(c.x<0||c.y<0||c.x>=int(uOccSize.x)||c.y>=int(uOccSize.y))return 1.0;
  return texture2D(uOcc,(vec2(c)+0.5)/uOccSize).r;
}
// Exact grid traversal (Amanatides-Woo) from o to p across the wall map. Cells are
// visited in order, so the result can't flicker as the hero moves by small amounts.
float rayVis(vec2 o,vec2 p){
  vec2 g0=(o-uOccRect.xy)/uOccRect.zw*uOccSize, g1=(p-uOccRect.xy)/uOccRect.zw*uOccSize;
  ivec2 c=ivec2(floor(g0)), e=ivec2(floor(g1));
  vec2 d=g1-g0;
  ivec2 st=ivec2(d.x>0.0?1:-1,d.y>0.0?1:-1);
  vec2 ad=max(abs(d),vec2(1e-6));
  vec2 tD=1.0/ad;
  vec2 fr=g0-floor(g0);
  vec2 tM=vec2(d.x>0.0?(1.0-fr.x):fr.x, d.y>0.0?(1.0-fr.y):fr.y)*tD;
  bool started=occCell(c)<0.5;
  for(int i=0;i<200;i++){
    if(c==e)return 1.0;
    if(min(tM.x,tM.y)>1.0)return 1.0; // walked past the target (float safety)
    if(tM.x<tM.y){c.x+=st.x;tM.x+=tD.x;}else{c.y+=st.y;tM.y+=tD.y;}
    if(c==e)return 1.0;               // the target's own cell is never an occluder
    float oc=occCell(c);
    if(!started){if(oc<0.5)started=true;}
    else if(oc>0.5)return 0.0;
  }
  return 1.0;
}
float heroVis(vec2 p){
  vec2 d=p-uHero;float L=length(d);
  if(L>30.0)return 1.0;
  if(L<0.3)return 1.0;
  vec2 n=vec2(-d.y,d.x)/L;
  float c=rayVis(uHero,p);
  float acc=c*0.3;
  vec2 o1=uHero+n*0.45,o2=uHero-n*0.45,o3=uHero+n*1.0,o4=uHero-n*1.0;
  acc+=(occAt(o1)<0.5?rayVis(o1,p):c)*0.2;
  acc+=(occAt(o2)<0.5?rayVis(o2,p):c)*0.2;
  acc+=(occAt(o3)<0.5?rayVis(o3,p):c)*0.15;
  acc+=(occAt(o4)<0.5?rayVis(o4,p):c)*0.15;
  return smoothstep(0.0,1.0,acc);
}
// Wall faces sit on the boundary of wall cells; test a point just in front of the
// face (along its normal) so the face is judged from the open side.
vec2 sightTarget(){
  vec3 n=normalize(vWNrm);
  vec2 nh=n.xz;float l=length(nh);
  return l>0.6?vWPos.xz+nh/l*0.3:vWPos.xz;
}
`;
const OCC_AT = `float occAt(vec2 p){vec2 uv=(p-uOccRect.xy)/uOccRect.zw;if(uv.x<0.0||uv.y<0.0||uv.x>1.0||uv.y>1.0)return 1.0;return texture2D(uOcc,uv).r;}
`;

/** Patch a material so it respects hero line-of-sight and the camera cut-away. */
export function maskMat(m) {
  if (!m || m.userData.masked) return m;
  m.userData.masked = true;
  m.clippingPlanes = [clipPlane];
  m.onBeforeCompile = sh => {
    sh.uniforms.uOcc = maskU.uOcc;
    sh.uniforms.uOccRect = maskU.uOccRect;
    sh.uniforms.uOccSize = maskU.uOccSize;
    sh.uniforms.uHero = maskU.uHero;
    sh.vertexShader = 'varying vec3 vWPos;varying vec3 vWNrm;\n' + sh.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\nvWPos=(modelMatrix*vec4(transformed,1.0)).xyz;vWNrm=mat3(modelMatrix)*normal;');
    sh.fragmentShader = MASK_HEAD.replace('float occCell', OCC_AT + 'float occCell') + sh.fragmentShader
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nfloat visF=heroVis(sightTarget());')
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
  maskU.uOccSize.value.set(GW, GH);
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
