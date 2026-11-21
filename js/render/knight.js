// The hero's sprite sheet: assets/sprites/knight.png, cut from the knight concept sheet by
// tools/cut_knight.py. 64x48 cells, feet at (32, 45). Rows: one block of 4 directions
// (down = facing the camera, left, up = facing away, right) per animation.
const CW = 64, CH = 48;
const DIR_ROW = { down: 0, left: 1, up: 2, right: 3 };
export const KNIGHT_ANIMS = {
  walk: { row: 0, frames: 6 },
  attack: { row: 4, frames: 6 },
  hurt: { row: 8, frames: 3 },
  death: { row: 12, frames: 4 },
};

const img = new Image();
let loaded = false;
const onLoad = [];
img.onload = () => { loaded = true; onLoad.forEach(f => f()); };
img.src = 'assets/sprites/knight.png';

export const knightLoaded = () => loaded;
export function whenKnightLoaded(f) { if (loaded) f(); else onLoad.push(f); }

/** Sprite actor options for createActor(). A = { sheet, frame, dir }. */
export const KNIGHT = {
  w: CW, h: CH, shadow: 0.5, dirs4: true, ownDeath: true,
  draw(g, A) {
    if (!loaded) return;
    const an = KNIGHT_ANIMS[A.sheet];
    const f = Math.max(0, Math.min(an.frames - 1, A.frame | 0));
    g.drawImage(img, f * CW, (an.row + DIR_ROW[A.dir]) * CH, CW, CH, 0, 0, CW, CH);
  },
};
