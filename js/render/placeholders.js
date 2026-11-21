// Procedural placeholder sprites, painted frame by frame onto small canvases.
// These stand in for real pixel art: each entry gives the canvas size, shadow size and a
// draw(ctx, A) that paints one frame facing RIGHT (the sprite system flips it for left).
//
// A = { anim, f, k, view, wlvl }
//   anim  idle | walk | windup | attack | recover | stagger | lunge | roar | dash | swing | drink | hurt
//   f     frame counter for looping animations (walk cycle: 4 frames)
//   k     0..1 progress for timed animations (wind-up, recover, swing), quantized by the caller
//   view  'side' | 'front' | 'away': whether the camera sees the face
// To replace one with real art, supply a different `draw` (e.g. blit from a sprite sheet).
import { lerp } from '../core/util.js';

/** Pen with coordinates measured from the sprite's feet: x from centre, y up. `u` scales everything. */
function pen(g, W, H, u = 1) {
  const R = (c, x, y, w, h) => {
    const x0 = Math.round(W / 2 + x * u), x1 = Math.round(W / 2 + (x + w) * u);
    const y1 = Math.round(H - (y + 1) * u), y0 = Math.round(H - (y + 1 + h) * u);
    g.fillStyle = c; g.fillRect(x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0));
  };
  /** Thick line between two points. */
  const L = (c, x0, y0, x1, y1, t = 2) => {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * u));
    for (let i = 0; i <= n; i++) R(c, x0 + (x1 - x0) * i / n - t / 2, y0 + (y1 - y0) * i / n - t / 2, t, t);
  };
  return { R, L };
}
const ease = k => 1 - (1 - k) * (1 - k);
const mix = (a, b, k) => `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], k))).join(',')})`;
const WALK = [[3, -3], [0, 0], [-3, 3], [0, 0]];
const LIFT = [[0, 0], [2, 0], [0, 0], [0, 2]];

// ---------------------------------------------------------------- hero
function drawHero(g, A) {
  const { R, L } = pen(g, 48, 44);
  const f = A.f & 3, away = A.view === 'away';
  const walk = A.anim === 'walk', dash = A.anim === 'dash', swing = A.anim === 'swing', hurt = A.anim === 'hurt';
  const leather = '#6a5038', cloth = '#3a2c22', metal = '#8c8c96', hi = '#b4b4c0', dark = '#2a2018', red = '#7a2820', boot = '#2a1e16', gold = '#c8a040';
  const bob = (A.anim === 'idle' || walk) ? (f & 1) : 0;
  const lean = dash ? 4 : hurt ? -3 : swing ? 1 : 0;
  const st = walk ? WALK[f] : dash ? [5, -5] : [0, 0], lift = walk ? LIFT[f] : [0, 0];

  // cape (behind everything), legs, boots
  R(red, -10 + lean - (walk ? f & 1 : 0) - (dash ? 3 : 0), 7 + bob, 4, 16);
  R('#5a1c16', -10 + lean - (dash ? 3 : 0), 7 + bob, 1, 16);
  R(cloth, -5 + st[0], 3 + lift[0], 4, 9); R(cloth, 1 + st[1], 3 + lift[1], 4, 9);
  R(boot, -5 + st[0], lift[0], 6, 4); R(boot, 1 + st[1], lift[1], 6, 4);
  // off arm (behind torso), torso, armour
  if (A.anim === 'drink') { R(leather, -2 + lean, 15, 3, 11); R('#9adfff', 1 + lean, 27, 3, 4); R(gold, 1 + lean, 31, 3, 1); }
  else R(dark, -2 + lean, 14 + bob, 3, 8);
  R(leather, -6 + lean, 12 + bob, 12, 11);
  R(metal, 0 + lean, 13 + bob, 6, 8); R(hi, 0 + lean, 20 + bob, 6, 1);
  R(dark, -6 + lean, 12 + bob, 12, 2); R(gold, 4 + lean, 12 + bob, 2, 2);
  R(metal, -3 + lean, 21 + bob, 7, 3); R(hi, -3 + lean, 23 + bob, 7, 1);
  // head: helm, visor, crest
  R(metal, -5 + lean, 24 + bob, 10, 9); R(hi, -5 + lean, 32 + bob, 10, 1); R(dark, -5 + lean, 24 + bob, 10, 1);
  if (!away) R('#0c0c0c', 1 + lean, 28 + bob, 5, 2);
  R(red, -1 + lean, 33 + bob, 3, 5);
  // sword arm: shoulder -> hand -> blade
  let al = 0.5, be = 2.4;
  if (swing) { const k = ease(A.k); al = lerp(2.6, 0.9, k); be = lerp(3.7, 1.1, k); }
  else if (dash) { al = -0.4; be = -1.3; }
  else if (hurt) { al = 0.2; be = 1.6; }
  else if (walk) be = 2.4 + [0, 0.1, 0, -0.1][f];
  const sx = 3 + lean, sy = 21 + bob, hx = sx + 6 * Math.sin(al), hy = sy - 6 * Math.cos(al);
  const BL = 11 + (A.wlvl >= 3 ? 2 : 0) + (A.wlvl >= 5 ? 2 : 0);
  const blade = A.riposte ? '#9a9ab8' : A.wlvl >= 5 ? '#ffc080' : A.wlvl >= 3 ? '#e0e4ec' : '#c8ccd4';
  L(leather, sx, sy, hx, hy, 3);
  L(blade, hx, hy, hx + BL * Math.sin(be), hy - BL * Math.cos(be), 2);
  R(gold, hx - 2, hy - 1, 4, 2);
}

// ---------------------------------------------------------------- husk + gatekeeper
function drawHusk(g, A, o) {
  const u = o.u || 1, { R, L } = pen(g, o.W, o.H, u);
  const f = A.f & 3, away = A.view === 'away', k = A.k || 0;
  const { skin, rag, head, dark, club = '#4a3a2a', spike = '#8a8a90', bone = '#cfc6a8', steel = '#5e5e68', cape = '#4a1414' } = o;
  const st = A.anim === 'walk' ? WALK[f] : [0, 0];
  let lean = 2, tip = [4 + [0, 1, 0, -1][f], 12]; // hunched; club hangs by the knee
  if (A.anim === 'walk') tip = [[4, 12], [7, 13], [4, 12], [1, 13]][f];
  else if (A.anim === 'idle') lean = 2 + (f & 1);
  else if (A.anim === 'windup') { const e = ease(k); lean = lerp(2, -2, k); tip = [lerp(4, -3, e), lerp(12, 45, e)]; }
  else if (A.anim === 'recover') { lean = lerp(5, 2, k); tip = k < 0.25 ? [17, 4] : [lerp(17, 4, (k - 0.25) / 0.75), lerp(4, 12, (k - 0.25) / 0.75)]; }
  else if (A.anim === 'stagger') { lean = -3; tip = [-2, 14]; }
  else if (A.anim === 'roar') { lean = -3; tip = [-4, 40]; }
  const wk = A.anim === 'windup' || A.anim === 'roar' ? Math.max(k, A.anim === 'roar' ? 1 : 0) : 0;
  const eye = mix([64, 16, 16], [255, 24, 12], wk);

  if (o.armored) R(cape, -13 + lean, 8, 4, 24);
  // legs
  R(rag, -6 + st[0], 3, 5, 11); R(rag, 1 + st[1], 3, 5, 11);
  R(dark, -7 + st[0], 0, 7, 4); R(dark, 0 + st[1], 0, 7, 4);
  // off arm, torso, rags
  R(dark, -2 + lean, 10, 3, 14);
  R(skin, -8 + lean, 13, 15, 14); R(rag, -8 + lean, 13, 15, 4);
  for (let i = 0; i < 3; i++) { if (o.armored) break; R(dark, 0 + lean, 18 + i * 3, 6, 1); R(bone, -11 + lean, 17 + i * 4, 4, 2); }
  if (o.armored) {
    R(steel, 1 + lean, 14, 7, 12); R('#7a7a86', 1 + lean, 25, 7, 1); R(dark, 1 + lean, 14, 7, 1);
    R(steel, -4 + lean, 26, 10, 5); R('#7a7a86', -4 + lean, 30, 10, 1);
  }
  // head
  R(o.armored ? steel : head, 1 + lean, 27, 9, 8);
  if (!o.armored) R(dark, 3 + lean, 25, 6, 3);
  if (!away) R(eye, 6 + lean, 31, 3, 2);
  if (o.armored) { R(bone, 4 + lean, 35, 2, 6); R(bone, -1 + lean, 35, 2, 5); }
  // club arm
  const sx = 3 + lean, sy = 25;
  L(skin, sx, sy, tip[0], tip[1], 4);
  if (o.armored) { R(steel, tip[0] - 6, tip[1] - 6, 12, 12); R('#7a7a86', tip[0] - 6, tip[1] + 5, 12, 1); R(dark, tip[0] - 6, tip[1] - 6, 12, 2); }
  else { R(club, tip[0] - 4, tip[1] - 4, 8, 8); R(spike, tip[0] + 3, tip[1] - 1, 3, 2); R(spike, tip[0] - 1, tip[1] + 4, 2, 3); }
}

// ---------------------------------------------------------------- skitter
function drawSkitter(g, A) {
  const { R, L } = pen(g, 36, 24);
  const f = A.f & 3, away = A.view === 'away', k = A.k || 0;
  const shell = '#7a2a1c', plate = '#9a3a24', plate2 = '#b04a2a', dark = '#2a1410', leg = '#24140f';
  let crouch = 0, stretch = 0, clawUp = 0, shake = 0, tilt = 0;
  if (A.anim === 'windup') { crouch = Math.round(2 * k); clawUp = 3; shake = (A.f & 1) ? 1 : -1; }
  else if (A.anim === 'lunge') { stretch = 4; crouch = -1; }
  else if (A.anim === 'recover') crouch = 2;
  else if (A.anim === 'stagger') tilt = (A.f & 1) ? 2 : -2;
  const eye = mix([80, 26, 16], [255, 40, 16], A.anim === 'windup' ? k : 0);
  const dx = shake + tilt;
  // legs: three pairs, alternating swing
  for (let i = 0; i < 3; i++) {
    const x = -6 + i * 5, sw = A.anim === 'walk' || A.anim === 'idle' ? [2, 0, -2, 0][(f + i * 2) & 3] * (A.anim === 'walk' ? 1 : 0) : (A.anim === 'lunge' ? -3 : 0);
    L(leg, x + dx, 6 - crouch, x + sw - 1 + dx, 0, 1); L(leg, x + 2 + dx, 6 - crouch, x + 2 + sw + dx, 0, 1);
  }
  L(dark, -9 - stretch + dx, 9 - crouch, -13 - stretch + dx, 15 - crouch, 2);                // tail spike
  R(shell, -9 - stretch + dx, 5 - crouch, 18 + stretch, 6);                                      // body
  R(plate, -7 - stretch + dx, 11 - crouch, 13 + stretch, 2); R(plate2, -4 - stretch + dx, 13 - crouch, 8, 2);
  R('#5a2018', 9 + dx, 5 - crouch, 6, 5);                                                      // head
  R(dark, 14 + dx, 5 - crouch + clawUp, 3, 2); R(dark, 14 + dx, 8 - crouch + clawUp, 3, 2);    // pincers
  if (!away) R(eye, 11 + dx, 8 - crouch, 2, 2);
}

// ---------------------------------------------------------------- spitter
function drawSpitter(g, A) {
  const { R } = pen(g, 44, 40);
  const f = A.f & 3, away = A.view === 'away', k = A.k || 0;
  const hide = '#5a6a36', dhide = '#3a3424', belly = '#9aa060', lip = '#3a4422';
  const st = A.anim === 'walk' ? WALK[f] : [0, 0];
  let up = A.anim === 'idle' ? (f & 1) : 0, lean = 0;
  if (A.anim === 'windup') lean = -Math.round(2 * k);
  else if (A.anim === 'stagger') lean = -3;
  const sac = A.anim === 'windup' ? mix([58, 90, 24], [190, 230, 70], k) : A.anim === 'recover' ? '#26400f' : '#3a5a18';
  const eye = '#2a4010';
  R(dhide, -9 + st[0], 0, 6, 9); R(dhide, 3 + st[1], 0, 6, 9);
  R(hide, -11 + lean, 8 + up, 22, 14);                                  // body
  R(belly, 2 + lean, 8 + up, 9, 9);
  R(sac, -13 + lean, 20 + up, 11, 12);                                  // bile sac
  for (let i = 0; i < 3; i++) R(lip, -11 + i * 3 + lean, 21 + up, 1, 10);
  R(hide, 6 + lean, 17 + up, 11, 9);                                    // head
  R(lip, 8 + lean, 16 + up, 9, 2); R(sac, 10 + lean, 18 + up, 6, 2);      // jaw + glowing gullet
  if (!away) { R(eye, 12 + lean, 23 + up, 3, 2); R(eye, 8 + lean, 24 + up, 2, 2); }
  R(hide, 7 + lean, 9 + up, 3, 8);                                      // front arm
}

// ---------------------------------------------------------------- registry
export const PLACEHOLDER = {
  hero:       { w: 48, h: 44, shadow: 0.55, draw: drawHero },
  husk:       { w: 48, h: 52, shadow: 0.75, draw: (g, A) => drawHusk(g, A, { W: 48, H: 52, skin: '#7d8a6a', rag: '#3a3226', head: '#66704f', dark: '#3c4632' }) },
  skitter:    { w: 36, h: 24, shadow: 0.7, draw: drawSkitter },
  spitter:    { w: 44, h: 40, shadow: 0.8, draw: drawSpitter },
  // the boss is drawn at 1.7x on a bigger canvas so its pixels stay the same size as everyone else's
  gatekeeper: { w: 84, h: 90, shadow: 1.5, draw: (g, A) => drawHusk(g, A, { W: 84, H: 90, u: 1.7, armored: true, skin: '#8a8070', rag: '#3a2a2a', head: '#6a6a70', dark: '#4a4038' }) },
};
