// The hero's 3D knight: assets/models/knight.fbx (Tripo mesh on a Mixamo skeleton) with its
// animation clips cut down to the parts the game uses.
//
// Needs the global THREE plus the vendored THREE.FBXLoader, fflate and THREE.SkeletonUtils
// (see index.html). Nothing here touches the game state: hero.js feeds it a few numbers each
// frame (speed, dead, ...) and calls the play* methods when an action starts.
//
// How the clips are used
//   - Every source clip is trimmed to a WINDOW (seconds into the source) and resampled at 30 fps.
//   - The sword slash is not a clip: slashPose() drives the right arm with two-bone IK along a
//     horizontal arc (matching the floor wedge) and twists the spine through it.
//   - Each trimmed clip is split into a LOWER set of tracks (hips + legs) and an UPPER set
//     (spine, arms, head), so the sword swing and the flask can play on the upper body while the
//     legs keep running. Weights are set by hand every frame (see update()) and always sum to 1
//     per body half.
//   - Horizontal hip motion is removed: the game moves the hero, the clips only animate the pose.
const FPS = 30;
const MODEL_URL = 'assets/models/knight.fbx';
const TEX_URL = 'assets/models/knight_albedo.jpg';

/** Standing height in world units (the old sprite was about 2.4 tall including the plume). */
export const HERO_HEIGHT = 2.2;

/**
 * Windows into the source clips, in seconds. `match` finds the clip by name (lower-case prefix).
 * Loops are cut to a whole stride so they wrap cleanly. Source clip names, for reference:
 *   wait (6s, near-static idle) · look_around (15.6s) · walk (2.3s) · run (1.25s)
 *   "Make the character swing a sword with one hand" (5s; not used, the slash is built in code, see slashPose())
 *   drinking a potion (5s) · dive (2.7s, the dodge roll) · fall (3s, the death)
 */
const WINDOWS = {
  idle:   { match: 'wait',        t0: 1.5,      t1: 4.5 },
  look:   { match: 'look_around', t0: 2.0,      t1: 8.0 },
  walk:   { match: 'walk',        t0: 2 / 30,   t1: 37 / 30 },
  run:    { match: 'run',         t0: 11 / 30,  t1: 30 / 30 },
  drink:  { match: 'drinking',    t0: 1.1,      t1: 2.5,  upper: true },
  dive:   { match: 'dive',        t0: 0.75,     t1: 1.95 },
  fall:   { match: 'fall',        t0: 0,        t1: 2.0 },
};

// Ground speed (world units / s) at which each loop plays at 1x. Faster movement plays faster.
const WALK_SPEED = 1.15, RUN_SPEED = 2.8;
const RUN_PHASE = 0.035;           // run stride phase relative to the walk stride, so crossfades keep the feet in step
const ATTACK_LEN = 0.5;            // seconds the slash lasts (keep below the weapon cooldown)
const LOOK_AFTER = 7;              // idle seconds before the hero glances around
const BREATH = 0.012;              // chest breathing amount

const LOWER_BONE = /^mixamorig(Hips|(Left|Right)(UpLeg|Leg|Foot|ToeBase|Toe_End))$/;

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = x => x * x * (3 - 2 * x);

// scratch objects for the sword / IK maths
const _up = new THREE.Vector3(), _bw = new THREE.Vector3(), _side = new THREE.Vector3(), _t = new THREE.Vector3(), _pole = new THREE.Vector3();
const _s0 = new THREE.Vector3(), _e0 = new THREE.Vector3(), _h0 = new THREE.Vector3(), _e1 = new THREE.Vector3(), _tc = new THREE.Vector3();
const _d = new THREE.Vector3(), _pl = new THREE.Vector3(), _z = new THREE.Vector3(), _x = new THREE.Vector3();
const _dq = new THREE.Quaternion(), _wq = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _qa = new THREE.Quaternion(), _qf = new THREE.Quaternion();
const _hq = new THREE.Quaternion(), _lq = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _m = new THREE.Matrix4();
const _p0 = new THREE.Vector3(), _p1 = new THREE.Vector3(), _d0 = new THREE.Vector3(), _d1 = new THREE.Vector3();

/** Rotate `bone` by the world-space rotation dq (about the bone's own origin). */
function rotateWorld(bone, dq) {
  bone.getWorldQuaternion(_wq); bone.parent.getWorldQuaternion(_pq);
  _wq.premultiply(dq);
  bone.quaternion.copy(_pq.invert().multiply(_wq));
  bone.updateMatrixWorld(true);
}
/** Turn `bone` so the segment from it to `child` points at `target` (world). */
function aimBone(bone, child, target) {
  bone.getWorldPosition(_p0); child.getWorldPosition(_p1);
  _d0.subVectors(_p1, _p0).normalize(); _d1.subVectors(target, _p0).normalize();
  rotateWorld(bone, _dq.setFromUnitVectors(_d0, _d1));
}
/** Sword orientation (world): blade (+Y) along `dir`, the flat of the blade (+Z) as close to `flat` as possible. */
function bladeQuat(dir, flat, out) {
  _z.copy(flat).addScaledVector(dir, -flat.dot(dir));
  if (_z.lengthSq() < 1e-4) _z.set(1, 0, 0).addScaledVector(dir, -dir.x);
  _z.normalize(); _x.crossVectors(dir, _z);
  return (out || new THREE.Quaternion()).setFromRotationMatrix(_m.makeBasis(_x, dir, _z));
}

/** Copy of `clip` between t0 and t1 resampled at FPS, keeping only the tracks `keep` accepts. */
function sliceClip(clip, name, t0, t1, keep, restHips) {
  const n = Math.max(1, Math.round((t1 - t0) * FPS)), dt = (t1 - t0) / n;
  const times = new Float32Array(n + 1);
  for (let i = 0; i <= n; i++) times[i] = i * dt;
  const tracks = [];
  for (const tr of clip.tracks) {
    if (!keep(tr.name)) continue;
    const size = tr.getValueSize(), it = tr.createInterpolant(), vals = new Float32Array((n + 1) * size);
    for (let i = 0; i <= n; i++) {
      const r = it.evaluate(t0 + i * dt);
      for (let k = 0; k < size; k++) vals[i * size + k] = r[k];
    }
    if (tr.name === 'mixamorigHips.position') {
      // Armature is rotated -90 degrees about X, so hip-local x / y are the floor plane and z is height.
      // Keep the motion relative to the first frame, centred on the rest pose.
      const x0 = vals[0], y0 = vals[1];
      for (let i = 0; i <= n; i++) { vals[i * 3] += restHips.x - x0; vals[i * 3 + 1] += restHips.y - y0; }
    }
    tracks.push(new tr.constructor(tr.name, times, vals));
  }
  return new THREE.AnimationClip(name, n * dt, tracks);
}

/** Load the knight. Resolves to a HeroModel; rejects if the files or the loader scripts are missing. */
export function loadHeroModel() {
  return new Promise((resolve, reject) => {
    if (!THREE.FBXLoader || !THREE.SkeletonUtils || typeof fflate === 'undefined') { reject(new Error('FBXLoader scripts missing')); return; }
    // the FBX points at 4096px PBR textures that aren't shipped: hand it the small albedo for any image
    const mgr = new THREE.LoadingManager();
    mgr.setURLModifier(u => (/\.(jpe?g|png|tga|bmp)(\?.*)?$/i.test(u) ? TEX_URL : u));
    new THREE.FBXLoader(mgr).load(MODEL_URL, fbx => {
      try { resolve(new HeroModel(fbx)); } catch (e) { reject(e); }
    }, undefined, e => reject(e && e.message ? e : new Error('could not load ' + MODEL_URL)));
  });
}

export class HeroModel {
  constructor(fbx) {
    // ---- mesh, material, size
    this.fbx = fbx;
    const bones = this.bones = {};
    let mesh = null;
    fbx.traverse(o => { if (o.isBone) bones[o.name] = o; if (o.isSkinnedMesh) mesh = o; });
    if (!mesh || !bones.mixamorigHips) throw new Error('knight.fbx: no skinned mesh / Mixamo skeleton');
    const tex = new THREE.TextureLoader().load(TEX_URL);
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestMipmapLinearFilter;
    // emissiveMap = the albedo itself gives a flat ambient term: the hero's lantern hangs overhead
    // and would leave the front of the body black otherwise
    this.mat = new THREE.MeshLambertMaterial({ map: tex, emissiveMap: tex, emissive: new THREE.Color(0x9a9a9a), skinning: true });
    mesh.material = this.mat; mesh.frustumCulled = false; mesh.userData.noMask = true;
    fbx.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(fbx);
    const k = HERO_HEIGHT / (box.max.y - box.min.y);
    this.holder = new THREE.Group();
    this.holder.add(fbx);
    this.holder.scale.setScalar(k);
    this.holder.position.y = -box.min.y * k;
    this.root = new THREE.Group();          // hero.js places and turns this
    this.root.add(this.holder);
    this.root.traverse(o => { o.userData.noMask = true; });
    this.scale = k;

    // ---- clips
    const restHips = bones.mixamorigHips.position.clone();
    const isTrack = n => /^mixamorig[A-Za-z0-9_]+\.quaternion$/.test(n) || n === 'mixamorigHips.position';
    const lower = n => LOWER_BONE.test(n.split('.')[0]);
    this.mixer = new THREE.AnimationMixer(fbx);
    this.a = {}; // key -> { L, U, len, raw: {L,U} }
    for (const key in WINDOWS) {
      const w = WINDOWS[key];
      const src = fbx.animations.find(c => c.name.toLowerCase().startsWith(w.match));
      if (!src) throw new Error('knight.fbx: missing clip "' + w.match + '"');
      const mk = (suffix, keep) => {
        const c = sliceClip(src, key + suffix, w.t0, w.t1, keep, restHips);
        if (!c.tracks.length) return null;
        const act = this.mixer.clipAction(c);
        act.play(); act.paused = true; act.setEffectiveWeight(0);
        return act;
      };
      this.a[key] = {
        L: w.upper ? null : mk('_L', n => isTrack(n) && lower(n)),
        U: mk('_U', n => isTrack(n) && !lower(n)),
        len: w.t1 - w.t0, raw: { L: 0, U: 0 },
      };
    }
    this.a.idle.raw.L = this.a.idle.raw.U = 1;

    // ---- state
    this.phase = 0;          // shared stride phase 0..1 (walk and run)
    this.idleT = 0;          // seconds spent standing still
    this.idleLoop = 0;       // idle loop time
    this.lookT = -1;         // >= 0 while glancing around
    this.atkT = -1; this.diveT = -1; this.drinkT = -1; this.drinkLen = 0.75; this.diveLen = 0.55;
    this.dead = false; this.atkDir = 1;
    this.breath = 0;
    this.flash = null;       // { r, g, b, k }: tint on top of the texture
    this.sword = null;
    this.makeSword();
    this.setPose();
  }

  // ------------------------------------------------------------------ actions
  playSwing() { this.atkT = 0; this.atkDir = -this.atkDir; }
  playDive(len) { this.diveT = 0; this.diveLen = len; }
  playDrink(len) { this.drinkT = 0; this.drinkLen = len; }
  /** Back to standing (respawn). */
  reset() {
    this.atkT = this.diveT = this.drinkT = this.lookT = -1; this.dead = false; this.idleT = 0;
    for (const key in this.a) this.a[key].raw.L = this.a[key].raw.U = key === 'idle' ? 1 : 0;
    this.holder.rotation.set(0, 0, 0);
    if (this.flask) { this.flask.visible = false; this.sword.visible = true; }
    this.setPose();
  }

  // ------------------------------------------------------------------ the sword
  /** A simple sword held in the right fist (the model has none). */
  makeSword() {
    const hand = this.bones.mixamorigRightHand;
    if (!hand) return;
    const g = new THREE.Group();
    this.bladeMat = new THREE.MeshLambertMaterial({ color: 0xc4c8d4 });
    const hiltMat = new THREE.MeshLambertMaterial({ color: 0x7a5a2c, emissive: 0x201408 });
    const goldMat = new THREE.MeshLambertMaterial({ color: 0xd8a838, emissive: 0x3a2808 });
    // built along +Y: grip at the origin, blade up
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.1, 6), hiltMat); grip.position.y = 0;
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.018, 0.026), goldMat); guard.position.y = 0.055;
    const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 5), goldMat); pommel.position.y = -0.055;
    this.blade = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1, 0.012), this.bladeMat);
    g.add(grip, guard, pommel, this.blade);
    // hand-local axes (Mixamo right hand): +Y fingers, +X blade-up for a fist, +Z thumb. The blade
    // stands out of the fist tilted a little toward the fingers, so it points forward during the swing
    g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(Math.cos(0.52), Math.sin(0.52), 0));
    this.gripQ = g.quaternion.clone(); // fixed orientation in the fist (used while rolling / dead)
    g.position.set(0, 0.02, 0);
    this.sword = g;
    g.userData.noMask = true;
    hand.add(g);
    this.setBlade(0, 0);

    // the healing flask, in the same fist while drinking (the sword is put away meanwhile)
    const f = new THREE.Group(), glass = new THREE.MeshLambertMaterial({ color: 0xd83a2a, emissive: 0x7a1208 });
    const cork = new THREE.MeshLambertMaterial({ color: 0x8a6a40, emissive: 0x241a0c });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.05), glass); body.position.x = 0.03;
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.025, 0.025), glass); neck.position.x = 0.07;
    const stop = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.03, 0.03), cork); stop.position.x = 0.088;
    f.add(body, neck, stop); f.position.set(0, 0.02, 0); f.visible = false; f.userData.noMask = true;
    this.flask = f; hand.add(f);
  }

  /** Blade length / glow follow the weapon upgrade level (see data/weapons.js). */
  setBlade(level, glowHex) {
    if (!this.blade) return;
    const len = level >= 4 ? 0.45 : 0.36;
    this.blade.scale.y = len; this.blade.position.y = 0.064 + len / 2;
    // steel needs a self-lit base or it reads as dark blue in the dungeon; the upgrade glow adds on top
    const gl = new THREE.Color(glowHex || 0);
    this.bladeMat.emissive.setRGB(Math.min(1, 0.45 + gl.r), Math.min(1, 0.47 + gl.g), Math.min(1, 0.52 + gl.b));
    this.bladeMat.color.setHex(level >= 5 ? 0xe8b080 : 0xc4c8d4);
  }

  // ------------------------------------------------------------------ per frame
  /**
   * s: { speed: world units/s, dead, hurt: 0..1 (1 = just hit), flash: 'hurt' | 'heal' | '' }
   * dt is simulation time, so the pose freezes with the game (pause, hit-stop).
   */
  update(dt, s) {
    this.dead = !!s.dead;
    if (this.atkT >= 0) { this.atkT += dt; if (this.atkT >= ATTACK_LEN) this.atkT = -1; }
    if (this.diveT >= 0) { this.diveT += dt; if (this.diveT >= this.diveLen) this.diveT = -1; }
    if (this.drinkT >= 0) { this.drinkT += dt; if (this.drinkT >= this.drinkLen) this.drinkT = -1; }
    const fullOv = this.dead ? 'fall' : this.diveT >= 0 ? 'dive' : null;
    const upperOv = this.drinkT >= 0 ? 'drink' : null;

    // ---- locomotion mix
    const sp = s.speed;
    const a = clamp(sp / 0.6, 0, 1), run = clamp((sp - 2.4) / 1.4, 0, 1);
    const still = sp < 0.5 && !fullOv && !upperOv;
    if (still) this.idleT += dt; else { this.idleT = 0; if (this.lookT >= 0 && sp >= 0.5) this.lookT = -1; }
    if (this.lookT < 0 && this.idleT > LOOK_AFTER) this.lookT = 0;
    let lookShare = 0;
    if (this.lookT >= 0) {
      this.lookT += dt;
      const L = this.a.look.len;
      if (this.lookT >= L) { this.lookT = -1; this.idleT = 0; }
      else lookShare = smooth(clamp(Math.min(this.lookT, L - this.lookT) / 0.7, 0, 1));
    }
    const share = { idle: (1 - a) * (1 - lookShare), look: (1 - a) * lookShare, walk: a * (1 - run), run };

    // ---- target weights per body half, then ease toward them
    const T = {};
    for (const key in this.a) {
      let tl = 0, tu = 0;
      if (key in share) { tl = share[key] * (fullOv ? 0 : 1); tu = share[key] * (fullOv || upperOv ? 0 : 1); }
      else if (key === 'dive' || key === 'fall') tl = tu = fullOv === key ? 1 : 0;
      else tu = upperOv === key && !fullOv ? 1 : 0; // drink: upper body only
      T[key] = { L: tl, U: tu };
    }
    const RATE = { drink: [14, 9], dive: [34, 14], fall: [14, 14] };
    for (const key in this.a) {
      const rate = RATE[key] || [10, 10], A = this.a[key];
      for (const g of ['L', 'U']) {
        const t = T[key][g], r = A.raw[g];
        A.raw[g] = r + (t - r) * (1 - Math.exp(-(t > r ? rate[0] : rate[1]) * dt));
      }
    }
    // ---- times
    const walkRate = clamp(sp / WALK_SPEED, 0, 2.4) / this.a.walk.len;   // stride cycles per second
    const runRate = clamp(sp / RUN_SPEED, 0.6, 2.2) / this.a.run.len;
    this.phase = (this.phase + dt * (walkRate + (runRate - walkRate) * run)) % 1;
    this.idleLoop = (this.idleLoop + dt) % this.a.idle.len;
    this.setTime('idle', this.idleLoop);
    this.setTime('look', clamp(this.lookT, 0, this.a.look.len));
    this.setTime('walk', this.phase * this.a.walk.len);
    this.setTime('run', ((this.phase + RUN_PHASE) % 1) * this.a.run.len);
    this.setTime('drink', clamp(this.drinkT / this.drinkLen, 0, 1) * this.a.drink.len);
    this.setTime('dive', clamp(this.diveT / this.diveLen, 0, 1) * this.a.dive.len);
    this.setTime('fall', clamp(s.deadT || 0, 0, this.a.fall.len));
    this.setPose();

    // ---- extras on top of the clips
    this.breath += dt * 2.2;
    const idleW = this.a.idle.raw.U / Math.max(1e-3, this.sumU);
    if (this.bones.mixamorigSpine1) this.bones.mixamorigSpine1.scale.setScalar(1 + BREATH * Math.sin(this.breath) * idleW);
    // knocked back when hit: lean away from the blow, eased out
    const hurt = clamp(s.hurt || 0, 0, 1);
    this.holder.rotation.x = this.dead ? 0 : -0.32 * hurt * hurt;
    // sword: held at the ready, or driven through the slash (poses the spine and right arm on top of the clips)
    const fullW = (this.a.dive.L ? this.a.dive.L.getEffectiveWeight() : 0) + (this.a.fall.L ? this.a.fall.L.getEffectiveWeight() : 0);
    this.holder.rotation.y = 0;
    this.slashPose(fullW);
    const drinking = this.drinkT >= 0 && !fullOv;
    if (this.flask) { this.flask.visible = drinking; this.sword.visible = !drinking; }
    const f = s.flash === 'hurt' ? [1, 0.18, 0.1] : s.flash === 'heal' ? [0.25, 1, 0.45] : null;
    if (f) this.mat.emissive.setRGB(0.6 + f[0] * 0.3, 0.6 + f[1] * 0.3, 0.6 + f[2] * 0.3);
    else this.mat.emissive.setRGB(0.6, 0.6, 0.6);
  }

  /**
   * Hand-built sword slash + the rest of the sword's orientation.
   * The slash is a horizontal cut across the front (the same arc as the reach wedge on the floor), right to
   * left, then left to right on the next swing. The right arm is solved with two-bone IK to a hand target on
   * that arc, the spine twists with it, and the blade points outward and leads the hand. Outside a slash the
   * blade is held forward and up whatever the arm is doing; while rolling or dead it stays glued to the fist.
   */
  slashPose(fullW) {
    if (!this.sword) return;
    const B = this.bones, hold = this.holder;
    hold.updateMatrixWorld(true);
    const k = this.atkT >= 0 ? this.atkT / ATTACK_LEN : 0;
    const w = this.atkT >= 0 ? smooth(clamp(k / 0.08, 0, 1)) * (1 - smooth(clamp((k - 0.66) / 0.34, 0, 1))) : 0;
    const dir = this.atkDir, up = _up.set(0, 1, 0).transformDirection(hold.matrixWorld);
    // blade direction (model space) at the ready, and during the slash
    let bladeW = _bw.set(-0.12, 0.62, 0.78).normalize();
    this._carryQ = bladeQuat(bladeW.transformDirection(hold.matrixWorld), _side.set(1, 0, 0).transformDirection(hold.matrixWorld), this._carryQ);
    let q = this._carryQ;
    if (w > 0) {
      const s = clamp(k / 0.4, 0, 1), e = s * s * (3 - 2 * s);
      const th = dir > 0 ? lerp(-1.3, 1.1, e) : lerp(1.1, -1.3, e);               // 0 = straight ahead, + = to the knight's left
      const y = dir > 0 ? lerp(0.69, 0.54, e) : lerp(0.52, 0.66, e);              // high to low, or low to high
      const tilt = dir > 0 ? lerp(0.3, -0.25, e) : lerp(-0.2, 0.3, e);
      // spine twist follows the sword (about the model's up axis), shared over the three spine bones
      const tw = w * 0.4 * th;
      for (const [n, f] of [['mixamorigSpine', 0.3], ['mixamorigSpine1', 0.35], ['mixamorigSpine2', 0.35]]) rotateWorld(B[n], _dq.setFromAxisAngle(up, tw * f));
      hold.updateMatrixWorld(true);
      // hand target on the arc, then the arm
      const target = _t.set(-0.02 + 0.19 * Math.sin(th), y, 0.03 + 0.19 * Math.cos(th));
      hold.localToWorld(target);
      const pole = _pole.set(-0.3, -1, -0.4).transformDirection(hold.matrixWorld);
      this.solveArm(target, pole, w);
      const lead = th + dir * 0.4;
      const bd = _bw.set(Math.sin(lead), tilt, Math.cos(lead)).normalize().transformDirection(hold.matrixWorld);
      this._slashQ = bladeQuat(bd, up, this._slashQ);
      q = _q2.copy(this._carryQ).slerp(this._slashQ, w);
    }
    // world orientation q -> the sword's local rotation under the hand bone, blended back to the fixed grip
    // orientation while rolling or dead
    B.mixamorigRightHand.getWorldQuaternion(_hq).invert();
    _lq.copy(_hq).multiply(q);
    this.sword.quaternion.copy(this.gripQ).slerp(_lq, 1 - clamp(fullW, 0, 1));
  }

  /** Two-bone IK for the right arm: hand to `target` (world), elbow bending toward `pole`. */
  solveArm(target, pole, w) {
    const A = this.bones.mixamorigRightArm, F = this.bones.mixamorigRightForeArm, H = this.bones.mixamorigRightHand;
    const qa = _qa.copy(A.quaternion), qf = _qf.copy(F.quaternion);
    A.getWorldPosition(_s0); F.getWorldPosition(_e0); H.getWorldPosition(_h0);
    const L1 = _s0.distanceTo(_e0), L2 = _e0.distanceTo(_h0);
    _d.subVectors(target, _s0);
    const D = clamp(_d.length(), 0.1 * (L1 + L2), 0.985 * (L1 + L2));
    _d.normalize();
    const a = (L1 * L1 - L2 * L2 + D * D) / (2 * D), h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
    _pl.copy(pole).addScaledVector(_d, -pole.dot(_d)).normalize();
    _e1.copy(_s0).addScaledVector(_d, a).addScaledVector(_pl, h);
    _tc.copy(_s0).addScaledVector(_d, D);
    aimBone(A, F, _e1); aimBone(F, H, _tc);
    A.quaternion.slerpQuaternions(qa, A.quaternion, w); F.quaternion.slerpQuaternions(qf, F.quaternion, w);
    A.updateMatrixWorld(true);
  }

  setTime(key, t) { const A = this.a[key]; if (A.L) A.L.time = t; if (A.U) A.U.time = t; }

  /** Normalise the weights of each body half to sum to 1 and pose the skeleton. */
  setPose() {
    let sl = 0, su = 0;
    for (const key in this.a) { sl += this.a[key].raw.L; su += this.a[key].raw.U; }
    if (sl < 1e-4) { this.a.idle.raw.L = 1; sl = 1; }
    if (su < 1e-4) { this.a.idle.raw.U = 1; su = 1; }
    this.sumU = su;
    for (const key in this.a) {
      const A = this.a[key];
      if (A.L) A.L.setEffectiveWeight(A.raw.L / sl);
      if (A.U) A.U.setEffectiveWeight(A.raw.U / su);
    }
    this.mixer.update(0);
  }

  /** A frozen, tinted copy of the current pose for dash afterimages. Add it to the scene; call disposeGhost() when done. */
  makeGhost(color) {
    const g = THREE.SkeletonUtils.clone(this.root);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, skinning: true });
    g.traverse(o => { if (o.isMesh) { o.material = mat; o.frustumCulled = false; } });
    g.userData.mat = mat;
    return g;
  }
  disposeGhost(g) { g.userData.mat.dispose(); g.traverse(o => { if (o.isSkinnedMesh) o.skeleton.dispose(); }); }
}
