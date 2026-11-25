// Floating damage / heal / pickup numbers, drawn as juicy "sticker" text on a 2D canvas
// overlay (CloverPit style: springy pop-in, wobble, lagging palette-cycling colour shadows).
// World-anchored numbers are projected from world space every frame; screen pops
// (LEVEL UP! etc.) sit at a fixed point on screen.
import { V3, W, H } from '../core/util.js';
import { camera } from '../render/renderer.js';
import { settings } from '../core/save.js';
import { Juicy, cycleIndex, pal, cfg } from '../vendor/juice.js';

const FONT = 'Anton, Impact, "Arial Black", sans-serif';
const canvas = document.getElementById('nums');
const ctx = canvas.getContext('2d');
const pops = [];
const _proj = new V3();
let dirty = false;

if (matchMedia('(prefers-reduced-motion: reduce)').matches) cfg.shake = false;

// Look per class. rainbow = stroke and fill both cycle the palette (big moments).
// shadowFor = seconds the colour shadow stays fully on before fading.
const STYLE = {
  '':    { size: 24, fill: '#fff6e4', stroke: '#1c1008', life: 0.75, vy: 1.2, shadowFor: 0.12, layers: 1, kick: 0 },
  small: { size: 16, fill: '#ffd2a0', stroke: '#1c1008', life: 0.6,  vy: 1.0, shadowFor: 0,    layers: 0, kick: 0 },
  crit:  { size: 38, rainbow: true,                      life: 1.05, vy: 1.6, shadowFor: 1.0,  layers: 2, kick: 9 },
  hurt:  { size: 30, fill: '#ff4a38', stroke: '#2a0604', life: 0.9,  vy: 1.3, shadowFor: 0.35, layers: 2, kick: 6 },
  heal:  { size: 24, fill: '#8cff7a', stroke: '#06240a', life: 0.85, vy: 1.2, shadowFor: 0.25, layers: 1, kick: 3 },
  gain:  { size: 20, fill: '#ffc050', stroke: '#2a1404', life: 0.85, vy: 1.2, shadowFor: 0.2,  layers: 1, kick: 2 },
  big:   { size: 72, rainbow: true,                      life: 1.6,  vy: 0,   shadowFor: 9,    layers: 3, kick: 9 },
};

function makePop(text, cls, o = {}) {
  const st = { ...STYLE[cls || ''] || STYLE[''], ...o };
  const j = new Juicy(0, 10, { from: 0, sk: 380, ci: (Math.random() * 8) | 0 });
  j.moveTo(0, -(st.rise ?? 12)); j.pop(); if (st.kick) j.punch(st.kick).shove(st.kick * 25);
  const p = { j, text, st, age: 0 };
  pops.push(p); return p;
}

/** cls: '' | 'crit' | 'hurt' | 'gain' | 'heal' | 'small' */
export function dmgNum(x, y, z, text, cls) {
  const p = makePop(text, cls);
  p.world = new V3(x + (Math.random() - 0.5) * 0.5, y, z + (Math.random() - 0.5) * 0.5);
  p.vy = p.st.vy;
}

/** Big sticker text at a fixed screen point (fractions of the screen), e.g. "LEVEL UP!". */
export function screenPop(text, fx = 0.5, fy = 0.3, o = {}) {
  const p = makePop(text, 'big', o);
  p.fx = fx; p.fy = fy;
}

function resize() {
  const dpr = Math.min(2, devicePixelRatio || 1), w = W(), h = H();
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function draw(p, sx, sy, step) {
  const { j, st, text } = p, juice = settings.juice !== false;
  // phone screens get slightly smaller text
  const size = st.size * (W() < 600 ? 0.8 : 1);
  ctx.font = `${size}px ${FONT}`;
  ctx.lineWidth = size * 0.3;
  ctx.save(); ctx.translate(sx, sy);
  // colour shadow: full on while fresh, then only while it's still moving
  const hl = st.shadowFor > 0 ? Math.max(0, Math.min(1, 1 - (p.age - st.shadowFor) * 4)) : 0;
  const a = juice ? Math.max(hl, st.layers ? j.motion : 0) : 0;
  if (a > 0.02) {
    for (let L = st.layers - 1; L >= 0; L--) {
      const t = j.shadowXf(L, 7 * size / 44), col = pal(step + j.ci + 5 + L * 2);
      ctx.save(); ctx.globalAlpha = a; ctx.translate(t.x, t.y); ctx.rotate(t.r); ctx.scale(t.s, t.s);
      ctx.strokeStyle = ctx.fillStyle = col; ctx.strokeText(text, 0, 0); ctx.fillText(text, 0, 0); ctx.restore();
    }
  }
  const t = j.xf();
  if (!juice) { t.r = 0; t.s = Math.min(t.s, 1.2); }
  ctx.translate(t.x, t.y); ctx.rotate(t.r); ctx.scale(t.s, t.s);
  ctx.strokeStyle = st.rainbow && juice ? pal(step + j.ci) : st.stroke || '#1c1008';
  ctx.strokeText(text, 0, 0);
  ctx.fillStyle = st.rainbow && juice ? pal(step + j.ci + 2) : st.fill || '#ffd040';
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

export function updateNums(dt) {
  if (!pops.length) { if (dirty) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); dirty = false; } return; }
  // springs: clamp the frame, integrate in small substeps
  const d = Math.min(0.05, dt) * cfg.timeScale, n = Math.ceil(d * 240) || 1;
  for (const p of pops) {
    for (let i = 0; i < n; i++) p.j.update(d / n);
    p.age += d;
    if (p.age > p.st.life && !p.hiding) { p.j.hide(); p.hiding = true; }
    if (p.world) { p.world.y += p.vy * d; p.vy *= Math.pow(0.96, d * 60); }
  }
  for (let i = pops.length - 1; i >= 0; i--) {
    const p = pops[i];
    if (p.hiding && p.j.s.x < 0.02 && p.j.sh.every(h => h.s.x < 0.02)) pops.splice(i, 1);
  }

  resize();
  ctx.clearRect(0, 0, W(), H());
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  const step = cycleIndex();
  for (const p of pops) {
    let sx, sy;
    if (p.world) {
      _proj.copy(p.world).project(camera);
      if (_proj.z > 1) continue; // behind the camera
      sx = (_proj.x + 1) / 2 * W(); sy = (1 - _proj.y) / 2 * H();
    } else { sx = p.fx * W(); sy = p.fy * H(); }
    draw(p, sx, sy, step);
  }
  dirty = true;
}
