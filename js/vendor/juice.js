// juice.js — CloverPit-style juicy icons & text. No dependencies. Canvas 2D + DOM.
export const PALETTE = ['#ff3df0','#ff3b2f','#ff8a1f','#ffd92e','#7dff4a','#3ff0ff','#3d6bff','#a34dff'];
export const cfg = { shadow:true, cycle:true, punch:true, shake:true, timeScale:1,
  lag:0.5,          // 0 = shadow glued on, 1 = very floaty
  offset:7,         // px of resting shadow offset per layer (scaled by size/44 for text)
  layers:1,         // 1..3 trailing shadow copies
  cycleHz:8 };      // palette steps per second

// ---------- springs ----------
export const spring = (x, t = x, k = 400, z = 0.4) => ({ x, v: 0, t, k, z });
export function stepSpring(s, dt) { const c = 2*s.z*Math.sqrt(s.k); s.v += (-s.k*(s.x-s.t) - c*s.v)*dt; s.x += s.v*dt; }
const lagK = () => 900 - 840*cfg.lag;
export const cycleIndex = (now = performance.now()) => cfg.cycle ? Math.floor(now/1000*cfg.cycleHz) % 8 : 3;
export const pal = (i) => PALETTE[((i % 8) + 8) % 8];

// ---------- silhouettes (canvas) ----------
const tintCache = new Map();
export function silhouette(img, color, key = img.src || img) {
  const k = key + color; let c = tintCache.get(k); if (c) return c;
  c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0); g.globalCompositeOperation = 'source-in';
  g.fillStyle = color; g.fillRect(0, 0, c.width, c.height); tintCache.set(k, c); return c;
}

// ---------- a juicy thing: position/scale/rotation springs + lagging shadow copies ----------
export class Juicy {
  constructor(x, y, o = {}) {
    this.p = { x: spring(x, x, o.k ?? 500, o.z ?? 0.35), y: spring(y, y, o.k ?? 500, o.z ?? 0.35) };
    this.s = spring(o.from ?? 1, 1, o.sk ?? 420, o.sz ?? 0.3);
    this.r = spring(0, 0, 300, 0.3);
    this.kick = { x: spring(0, 0, 260, 0.4), y: spring(0, 0, 260, 0.4) };
    this.sh = [0,1,2].map(() => ({ x: spring(x), y: spring(y), s: spring(o.from ?? 1) }));
    this.ci = o.ci ?? 0;          // palette offset
    this.highlight = o.highlight ?? 0;  // 0..1: colored shadow opacity when still
    this.dead = false;
  }
  moveTo(x, y) { this.p.x.t = x; this.p.y.t = y; return this; }
  snap(x, y) { for (const s of [this.p.x, ...this.sh.map(h=>h.x)]) { s.x = s.t = x; s.v = 0 } for (const s of [this.p.y, ...this.sh.map(h=>h.y)]) { s.x = s.t = y; s.v = 0 } return this; }
  punch(v = 10) { if (cfg.punch) this.s.v += v; return this; }
  wobble(a = 0.35) { if (cfg.punch) this.r.x = (Math.random() < .5 ? -1 : 1)*a; return this; }
  shove(f = 260) { if (!cfg.punch) return this; const a = Math.random()*6.283; this.kick.x.v += Math.cos(a)*f; this.kick.y.v += Math.sin(a)*f; return this; }
  pop() { this.s.x = 0; this.s.t = 1; return this.punch(6).wobble(); }
  hide() { this.s.t = 0; this.s.k = 600; this.s.z = 0.9; return this; }
  // how much the colored shadow should show: motion + highlight
  get motion() { const h = this.sh[0]; return Math.min(1, (Math.abs(this.p.x.x-h.x.x)+Math.abs(this.p.y.x-h.y.x))/14 + Math.abs(this.p.x.v)/900 + Math.abs(this.p.y.v)/900); }
  update(dt) {
    for (const s of [this.p.x, this.p.y, this.s, this.r, this.kick.x, this.kick.y]) stepSpring(s, dt);
    this.sh.forEach((h, j) => { const k = lagK()*Math.pow(.6, j);
      h.x.k = h.y.k = h.s.k = k; h.x.z = h.y.z = h.s.z = .55;
      h.x.t = this.p.x.x; h.y.t = this.p.y.x; h.s.t = this.s.x;
      stepSpring(h.x, dt); stepSpring(h.y, dt); stepSpring(h.s, dt); });
  }
  // layer j shadow transform; base = resting offset unit (px)
  shadowXf(j, base = cfg.offset) { const h = this.sh[j], o = base*(j+1);
    return { x: h.x.x + o + this.kick.x.x*(j+1)*.06, y: h.y.x + o + this.kick.y.x*(j+1)*.06, s: Math.max(0, h.s.x), r: this.r.x*.7 }; }
  xf() { return { x: this.p.x.x, y: this.p.y.x, s: Math.max(0, this.s.x), r: this.r.x }; }
}

// ---------- canvas drawing ----------
export function drawIcon(ctx, j, img, size, o = {}) {
  const step = cycleIndex(), a = Math.max(j.motion, j.highlight);
  if (cfg.shadow && a > .02) for (let L = Math.min(cfg.layers,3)-1; L >= 0; L--) {
    const t = j.shadowXf(L), col = pal(step + j.ci + L*2);
    ctx.save(); ctx.globalAlpha = a; ctx.translate(t.x, t.y); ctx.rotate(t.r); ctx.scale(t.s, t.s);
    ctx.drawImage(silhouette(img, col, o.key), -size/2, -size/2, size, size); ctx.restore();
  }
  const t = j.xf(); ctx.save(); ctx.translate(t.x, t.y); ctx.rotate(t.r); ctx.scale(t.s, t.s);
  ctx.drawImage(img, -size/2, -size/2, size, size); ctx.restore();
}
// Sticker text: thick stroke in pal(i), fill in pal(i+2), shadow copies in pal(i+5+2L)
export function drawSticker(ctx, j, text, size, font = 'Anton, Impact, sans-serif') {
  const step = cycleIndex() + j.ci;
  ctx.font = `${size}px ${font}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  ctx.lineWidth = size*.36;
  if (cfg.shadow) for (let L = Math.min(cfg.layers,3)-1; L >= 0; L--) {
    const t = j.shadowXf(L, cfg.offset*size/44);
    ctx.save(); ctx.translate(t.x, t.y); ctx.rotate(t.r); ctx.scale(t.s, t.s);
    ctx.strokeStyle = ctx.fillStyle = pal(step+5+L*2); ctx.strokeText(text,0,0); ctx.fillText(text,0,0); ctx.restore();
  }
  const t = j.xf(); ctx.save(); ctx.translate(t.x, t.y); ctx.rotate(t.r); ctx.scale(t.s, t.s);
  ctx.strokeStyle = pal(step); ctx.strokeText(text,0,0); ctx.fillStyle = pal(step+2); ctx.fillText(text,0,0); ctx.restore();
}
export function drawFrame(ctx, j, w, h, lw = 5, radius = 8) {
  const t = j.xf(); if (t.s < .03) return; ctx.save(); ctx.translate(t.x, t.y); ctx.scale(t.s, t.s);
  ctx.strokeStyle = pal(cycleIndex()); ctx.lineWidth = lw; ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(-w/2,-h/2,w,h,radius) : ctx.rect(-w/2,-h/2,w,h); ctx.stroke(); ctx.restore();
}

// ---------- popups, count-up, coins, shake ----------
export class JuiceWorld {
  constructor() { this.pops = []; this.coins = []; this.trauma = 0; this.items = new Set(); }
  add(j) { this.items.add(j); return j; }
  // floating sticker number/word: "+80", "AGAIN!"
  popText(text, x, y, o = {}) { const j = new Juicy(x, y+10, { from: 0, sk: o.k ?? 380, ci: o.ci });
    j.moveTo(x, y-(o.rise ?? 12)); j.pop(); if (o.kick) j.punch(o.kick);
    const p = { j, text, size: o.size ?? 44, age: 0, life: o.life ?? 1.1, layers: o.layers };
    this.pops.push(p); return p; }
  burst(x, y, n = 6) { for (let i = 0; i < n; i++) this.coins.push({ x, y, vx:(Math.random()*2-1)*260, vy:-420-Math.random()*520, ph:Math.random()*6, vp:10+Math.random()*14, r:11+Math.random()*4 }); }
  shake(amount = .3) { if (cfg.shake) this.trauma = Math.min(1, this.trauma + amount); }
  shakeOffset(max = 18) { const s = this.trauma*this.trauma*max; return { x:(Math.random()*2-1)*s, y:(Math.random()*2-1)*s }; }
  update(rawDt, H = 2000) {
    const dt = Math.min(.05, rawDt)*cfg.timeScale, n = Math.ceil(dt*240) || 1, d = dt/n;
    for (let i = 0; i < n; i++) {
      this.items.forEach(j => j.update(d));
      this.pops.forEach(p => { p.age += d; if (p.age > p.life) p.j.hide(); p.j.update(d); });
      this.coins.forEach(c => { c.vy += 1500*d; c.x += c.vx*d; c.y += c.vy*d; c.ph += c.vp*d; });
    }
    this.pops = this.pops.filter(p => !(p.age > p.life && p.j.s.x < .02 && p.j.sh.every(h => h.s.x < .02)));
    this.coins = this.coins.filter(c => c.y < H);
    this.trauma = Math.max(0, this.trauma - dt*1.6);
  }
  drawPops(ctx) { this.pops.forEach(p => { const L = cfg.layers; if (p.layers) cfg.layers = p.layers; drawSticker(ctx, p.j, p.text, p.size); cfg.layers = L; }); }
  drawCoins(ctx) { this.coins.forEach(p => { const w = Math.abs(Math.cos(p.ph))*p.r+1.5;
    ctx.fillStyle='#b88200'; ctx.beginPath(); ctx.ellipse(p.x+1.5,p.y+2,w,p.r,0,0,7); ctx.fill();
    ctx.fillStyle='#ffd23a'; ctx.beginPath(); ctx.ellipse(p.x,p.y,w,p.r,0,0,7); ctx.fill(); }); }
}
export class CountUp { // displayed value eases toward real value; call punch on change
  constructor(v = 0) { this.value = v; this.shown = v; this.s = spring(1, 1, 500, .3); }
  add(n) { this.value += n; if (cfg.punch) this.s.v += 9; }
  update(dt) { this.shown += (this.value-this.shown)*Math.min(1, dt*7); if (Math.abs(this.value-this.shown) < .5) this.shown = this.value; stepSpring(this.s, dt); }
  get text() { return Math.round(this.shown).toLocaleString(); }
}

// ---------- DOM adapter: juice any element (text, number, icon <img>) ----------
// Creates shadow clones behind el, drives transforms from springs. Call juiceDom.tick(dt) each frame
// (or juiceDom.autoTick()). Parent must be positioned (relative/absolute); clones sit at el's offsetLeft/Top.
export const juiceDom = {
  list: new Set(),
  attach(el, o = {}) {
    const j = new Juicy(0, 0, o); j.el = el; j.clones = [];
    for (let L = 0; L < 3; L++) {
      let c; if (el.tagName === 'IMG') { c = document.createElement('div'); // tinted silhouette via CSS mask
        Object.assign(c.style, { width:el.offsetWidth+'px', height:el.offsetHeight+'px', maskImage:`url("${el.src}")`, webkitMaskImage:`url("${el.src}")`,
          maskSize:'100% 100%', webkitMaskSize:'100% 100%' }); c.dataset.mask = '1'; }
      else { c = el.cloneNode(true); c.removeAttribute('id'); }
      c.setAttribute('aria-hidden','true');
      Object.assign(c.style, { position:'absolute', left:el.offsetLeft+'px', top:el.offsetTop+'px', margin:0, pointerEvents:'none', zIndex:0 });
      el.parentNode.insertBefore(c, el); j.clones.push(c); }
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    el.style.zIndex = 1; el.style.willChange = 'transform'; this.list.add(j);
    j.sync = () => j.clones.forEach(c => { if (!c.dataset.mask) c.innerHTML = el.innerHTML; }); // call after changing text
    return j;
  },
  tick(dt) {
    const step = cycleIndex();
    const d = Math.min(.05, dt)*cfg.timeScale, n = Math.ceil(d*240) || 1;
    this.list.forEach(j => { for (let i = 0; i < n; i++) j.update(d/n);
      const t = j.xf(); j.el.style.transform = `translate(${t.x}px,${t.y}px) rotate(${t.r}rad) scale(${t.s})`;
      const a = Math.max(j.motion, j.highlight);
      j.clones.forEach((c, L) => { const on = cfg.shadow && L < cfg.layers && a > .02, s = j.shadowXf(L), col = pal(step + j.ci + L*2);
        c.style.display = on ? '' : 'none'; if (!on) return;
        c.style.opacity = a; c.style.transform = `translate(${s.x}px,${s.y}px) rotate(${s.r}rad) scale(${s.s})`;
        if (c.dataset.mask) c.style.background = col; else { c.style.color = col; c.style.webkitTextStrokeColor = col; } }); });
  },
  autoTick() { let last = performance.now(); const f = now => { this.tick((now-last)/1000); last = now; requestAnimationFrame(f); }; requestAnimationFrame(f); }
};
