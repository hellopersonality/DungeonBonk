// Procedural pixel-art textures and shared materials. Everything is drawn into small
// canvases with nearest-neighbour filtering for the PSX-style look.

// Seeded RNG so textures look the same on every load.
let seed = 1337;
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

function makeTex(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  draw(g, size);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const px = (g, x, y, r, gg, b) => { g.fillStyle = `rgb(${r | 0},${gg | 0},${b | 0})`; g.fillRect(x, y, 1, 1); };
const rect = (g, col, x, y, w, h) => { g.fillStyle = col; g.fillRect(x, y, w, h); };

/** Running-bond bricks. `rowH` and `brickW` in pixels (32px texture = 2 world units). */
function bricks({ base = [64, 58, 50], vary = 18, mortar = '#17130f', rowH = 8, brickW = 16, moss = 0, mossCol = [58, 76, 46], drip = 0, cracks = 0 }) {
  return makeTex(32, (g, s) => {
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const row = (y / rowH) | 0, off = row % 2 ? brickW / 2 : 0;
      const bx = ((x + off) / brickW) | 0;
      const tone = ((bx * 37 + row * 53) % 19) - 9;
      let k = 1 + (tone + rnd() * vary - vary / 2) / 100;
      if (y % rowH === rowH - 1) k *= 0.72;           // shadowed lower edge
      if (y % rowH === 1) k *= 1.08;                  // lit upper edge
      let [r, gg, b] = base.map(v => v * k);
      if (moss && rnd() < moss * (1 - y / s)) [r, gg, b] = mossCol.map(v => v * (0.8 + rnd() * 0.4));
      px(g, x, y, r, gg, b);
    }
    g.fillStyle = mortar;
    for (let r = 0; r < s / rowH; r++) {
      g.fillRect(0, r * rowH, s, 1);
      const off = r % 2 ? brickW / 2 : 0;
      for (let x = off; x < s; x += brickW) g.fillRect(x, r * rowH, 1, rowH);
    }
    for (let i = 0; i < drip; i++) { // dark water streaks running down
      const x = (rnd() * s) | 0, len = 6 + ((rnd() * 18) | 0);
      g.fillStyle = 'rgba(10,20,24,0.45)'; g.fillRect(x, 0, 1, len);
    }
    for (let i = 0; i < cracks; i++) {
      let x = (rnd() * s) | 0, y = (rnd() * s) | 0;
      g.fillStyle = 'rgba(0,0,0,0.45)';
      for (let j = 0; j < 5; j++) { g.fillRect((x + s) % s, (y + s) % s, 1, 1); x += ((rnd() * 3) | 0) - 1; y++; }
    }
  });
}

function rock(base, vary) {
  return makeTex(32, (g, s) => {
    const blobs = Array.from({ length: 9 }, () => [rnd() * s, rnd() * s, 5 + rnd() * 8, 0.75 + rnd() * 0.4]);
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      let k = 1;
      for (const [bx, by, br, bk] of blobs) {
        const dx = Math.min(Math.abs(x - bx), s - Math.abs(x - bx)), dy = Math.min(Math.abs(y - by), s - Math.abs(y - by));
        if (dx * dx + dy * dy < br * br) k *= bk;
      }
      k *= 1 + (rnd() * vary - vary / 2) / 100;
      px(g, x, y, base[0] * k, base[1] * k, base[2] * k);
    }
  });
}

function tiles({ base, vary = 12, grout = '#120f0c', size = 16, sheen = 0, cracks = 4 }) {
  return makeTex(32, (g, s) => {
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const tx = (x / size) | 0, ty = (y / size) | 0;
      const k = 1 + ((((tx * 29 + ty * 41) % 13) - 6) + rnd() * vary - vary / 2) / 100;
      px(g, x, y, base[0] * k, base[1] * k, base[2] * k);
      if (sheen && rnd() < sheen) px(g, x, y, base[0] * 1.6, base[1] * 1.7, base[2] * 1.8);
    }
    g.fillStyle = grout;
    for (let i = 0; i < s; i += size) { g.fillRect(0, i, s, 1); g.fillRect(i, 0, 1, s); }
    for (let k = 0; k < cracks; k++) {
      let x = (rnd() * s) | 0, y = (rnd() * s) | 0;
      g.fillStyle = 'rgba(0,0,0,0.35)';
      for (let j = 0; j < 6; j++) { g.fillRect(((x % s) + s) % s, y % s, 1, 1); x += ((rnd() * 3) | 0) - 1; y++; }
    }
  });
}

function speckle(base, vary, pebble, pebbleCount) {
  return makeTex(32, (g, s) => {
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const k = 1 + (rnd() * vary - vary / 2) / 100;
      px(g, x, y, base[0] * k, base[1] * k, base[2] * k);
    }
    for (let i = 0; i < pebbleCount; i++) {
      const x = (rnd() * s) | 0, y = (rnd() * s) | 0, k = 0.7 + rnd() * 0.6;
      px(g, x, y, pebble[0] * k, pebble[1] * k, pebble[2] * k);
      px(g, (x + 1) % s, y, pebble[0] * k * 0.8, pebble[1] * k * 0.8, pebble[2] * k * 0.8);
    }
  });
}

function planks(base) {
  return makeTex(32, (g, s) => {
    for (let y = 0; y < s; y++) {
      const plank = (y / 8) | 0, pk = 0.85 + ((plank * 37) % 7) / 25;
      for (let x = 0; x < s; x++) {
        const grain = Math.sin((x + plank * 11) * 0.6 + Math.sin(y * 1.3) * 1.5) * 0.06;
        const k = pk + grain + (rnd() - 0.5) * 0.08;
        px(g, x, y, base[0] * k, base[1] * k, base[2] * k);
      }
    }
    rect(g, 'rgba(0,0,0,0.6)', 0, 0, s, 1); rect(g, 'rgba(0,0,0,0.6)', 0, 8, s, 1);
    rect(g, 'rgba(0,0,0,0.6)', 0, 16, s, 1); rect(g, 'rgba(0,0,0,0.6)', 0, 24, s, 1);
    for (let p = 0; p < 4; p++) { const x = ((p * 13) % 28) + 2; rect(g, 'rgba(0,0,0,0.5)', x, p * 8 + 1, 1, 7); }
    g.fillStyle = '#9a9aa0'; [[3, 3], [28, 11], [6, 19], [22, 27]].forEach(([x, y]) => g.fillRect(x, y, 1, 1));
  });
}

function rugTex(main, border, accent) {
  return makeTex(32, (g, s) => {
    rect(g, main, 0, 0, s, s);
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) if (rnd() < 0.15) { g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(x, y, 1, 1); }
    rect(g, border, 0, 0, s, 3); rect(g, border, 0, s - 3, s, 3); rect(g, border, 0, 0, 3, s); rect(g, border, s - 3, 0, 3, s);
    g.fillStyle = accent;
    for (let i = 4; i < s - 4; i += 4) { g.fillRect(i, 1, 2, 1); g.fillRect(i, s - 2, 2, 1); g.fillRect(1, i, 1, 2); g.fillRect(s - 2, i, 1, 2); }
    // central diamond
    for (let y = -6; y <= 6; y++) for (let x = -6; x <= 6; x++) if (Math.abs(x) + Math.abs(y) === 6 || Math.abs(x) + Math.abs(y) === 3) g.fillRect(16 + x, 16 + y, 1, 1);
  });
}

function bannerTex(cloth, trim, emblem) {
  return makeTex(32, (g, s) => {
    rect(g, cloth, 0, 0, s, s);
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) if (rnd() < 0.2) { g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x, y, 1, 1); }
    rect(g, trim, 0, 0, 2, s); rect(g, trim, s - 2, 0, 2, s); rect(g, trim, 0, 0, s, 2);
    g.fillStyle = emblem; // a stylised eye inside a ring
    for (let a = 0; a < 40; a++) { const t = a / 40 * Math.PI * 2; g.fillRect((16 + Math.cos(t) * 8) | 0, (14 + Math.sin(t) * 8) | 0, 1, 1); }
    rect(g, emblem, 12, 13, 9, 2); rect(g, emblem, 15, 12, 3, 4);
    // ragged bottom edge
    g.clearRect(0, s - 4, s, 4);
    for (let x = 0; x < s; x++) { const d = 1 + ((x * 7) % 4); rect(g, cloth, x, s - 4, 1, 4 - d); }
  });
}

function waterTex() {
  return makeTex(32, (g, s) => {
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const w = Math.sin(x * 0.4 + Math.sin(y * 0.3) * 2) * 0.5 + 0.5;
      const k = 0.8 + w * 0.3 + (rnd() - 0.5) * 0.1;
      px(g, x, y, 22 * k, 58 * k, 72 * k);
      if (w > 0.94 && rnd() < 0.5) px(g, x, y, 90, 150, 160);
    }
  });
}

// ---------- texture library ----------
export const TEX = {
  brick:      bricks({ base: [66, 60, 52], moss: 0.04, cracks: 2 }),
  brickWarm:  bricks({ base: [84, 66, 50], vary: 14, cracks: 1 }),
  brickMoss:  bricks({ base: [58, 58, 50], moss: 0.22, cracks: 2 }),
  blueStone:  bricks({ base: [46, 58, 64], rowH: 16, brickW: 16, vary: 14, moss: 0.12, mossCol: [40, 70, 58], drip: 6, mortar: '#0e1416' }),
  sandstone:  bricks({ base: [112, 82, 58], vary: 16, mortar: '#2a1a10', cracks: 4 }),
  rock:       rock([52, 46, 42], 16),
  flag:       tiles({ base: [46, 42, 38] }),
  wetTile:    tiles({ base: [36, 46, 52], size: 8, sheen: 0.03, grout: '#0a1012' }),
  sand:       speckle([104, 84, 60], 18, [70, 58, 48], 40),
  dirt:       speckle([58, 46, 36], 20, [80, 72, 62], 24),
  planks:     planks([92, 62, 38]),
  darkPlanks: planks([52, 38, 28]),
  noise:      makeTex(16, (g, s) => { for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) { const v = 190 + rnd() * 65; px(g, x, y, v, v, v); } }),
  rug:        rugTex('#6a1e1a', '#c09040', '#e0c070'),
  bannerRed:  bannerTex('#7a1c18', '#c09040', '#e0c070'),
  bannerBlue: bannerTex('#1c2a5a', '#a0a8b8', '#d0d8e8'),
  bannerTorn: bannerTex('#3a1414', '#5a4020', '#8a6a3a'),
  water:      waterTex(),
};

// ---------- shared materials ----------
const lam = (o) => new THREE.MeshLambertMaterial(o);
export const MAT = {
  iron:    lam({ map: TEX.noise, color: 0x2a2a30 }),
  steel:   lam({ map: TEX.noise, color: 0x6a6a74 }),
  wood:    lam({ map: TEX.planks, color: 0xffffff }),
  darkWood:lam({ map: TEX.darkPlanks, color: 0xffffff }),
  gold:    lam({ map: TEX.noise, color: 0xc8a040, emissive: 0x302008 }),
  bone:    lam({ map: TEX.noise, color: 0xcfc6a8 }),
  stone:   lam({ map: TEX.brick, color: 0xffffff }),
  rubble:  lam({ map: TEX.rock, color: 0xffffff }),
  rope:    lam({ map: TEX.noise, color: 0x6a5434 }),
  moss:    lam({ map: TEX.noise, color: 0x3a5a2a }),
  coal:    new THREE.MeshBasicMaterial({ color: 0xff7a20 }),
  flame:   new THREE.MeshBasicMaterial({ color: 0xffa040 }),
  flameCore: new THREE.MeshBasicMaterial({ color: 0xfff0a0 }),
  witchFlame: new THREE.MeshBasicMaterial({ color: 0x60e0c8 }),
  witchCore:  new THREE.MeshBasicMaterial({ color: 0xd0fff0 }),
  rug:     lam({ map: TEX.rug, color: 0xffffff }),
  bannerRed: lam({ map: TEX.bannerRed, side: THREE.DoubleSide }),
  bannerBlue: lam({ map: TEX.bannerBlue, side: THREE.DoubleSide }),
  bannerTorn: lam({ map: TEX.bannerTorn, side: THREE.DoubleSide }),
};

/** Wall / floor / ceiling material set for a room. */
export function makeTheme({ wall, floor, ceil, wallTint = 0xffffff, floorTint = 0xffffff, ceilTint = 0x4a4540, torch = 'fire' }) {
  return {
    wall: lam({ map: wall, color: wallTint }),
    floor: lam({ map: floor, color: floorTint }),
    ceil: lam({ map: ceil || wall, color: ceilTint }),
    wallTex: wall, wallTint, torch,
  };
}

export const THEMES = {
  hub:      makeTheme({ wall: TEX.brickWarm, floor: TEX.flag, ceil: TEX.darkPlanks, floorTint: 0xe8dccc, ceilTint: 0x6a5a4a }),
  hall:     makeTheme({ wall: TEX.brick, floor: TEX.flag }),
  corridor: makeTheme({ wall: TEX.rock, floor: TEX.dirt, ceilTint: 0x3a3430 }),
  cistern:  makeTheme({ wall: TEX.blueStone, floor: TEX.wetTile, ceilTint: 0x344048, torch: 'witch' }),
  arena:    makeTheme({ wall: TEX.sandstone, floor: TEX.sand, ceilTint: 0x4a3828 }),
  passage:  makeTheme({ wall: TEX.rock, floor: TEX.dirt, ceilTint: 0x302a26 }),
  secret:   makeTheme({ wall: TEX.rock, floor: TEX.dirt, ceilTint: 0x302a26 }),
};
