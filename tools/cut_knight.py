# Cut the knight concept sheets in assets/source/ into the hero atlas assets/sprites/knight.png.
# Run from the repo root. Needs Python with numpy, scipy and Pillow.
# The atlas layout (64x48 cells, 4 direction rows per animation) must match render/knight.js.
import numpy as np
from PIL import Image
from scipy import ndimage as nd

CW, CH = 64, 52              # atlas cell (game pixels); feet anchored at (CW/2, CH-2)
DIRS = ['down', 'left', 'up', 'right']
S1 = 0.42                    # sheet 1: ~95px tall knight -> ~40px (16 px per world unit)

# Each sheet: file, and per animation the row edges (down/left/up/right) and column edges.
SHEET1 = ('assets/source/knight_sheet.png', {
  'walk':   ([78, 183, 284, 391, 500], [140, 230, 325, 415, 508, 600, 695]),
  'attack': ([78, 183, 284, 391, 500], [858, 955, 1050, 1145, 1240, 1330, 1425]),
  'hurt':   ([605, 716, 818, 926, 1035], [165, 315, 465, 620]),
  'death':  ([605, 716, 818, 926, 1035], [860, 990, 1130, 1272, 1425]),
})
SHEET2 = ('assets/source/knight_sheet2.png', {
  'idle':  ([54, 126, 187, 258, 328], [265, 515, 765, 1020, 1270]),
  'dash':  ([399, 471, 532, 606, 676], [210, 400, 595, 790, 980, 1170, 1350]),
  'drink': ([752, 825, 897, 970, 1046], [210, 400, 590, 775, 960, 1145, 1330]),
})
# Baked ground-shadow colour per sheet: (min brightness, max brightness, max chroma). The
# knight's outlines are darker than the shadow, which keeps the flood fill out of the sprite.
SHADOW = {SHEET1[0]: (13, 33, 11), SHEET2[0]: (9, 23, 9)}


def cut(src, x0, x1, y0, y1, shadow):
    """Foreground mask with background and baked ground shadow removed, plus a feet anchor."""
    c = src[y0:y1, x0:x1]
    border = np.concatenate([c[0], c[-1], c[:, 0], c[:, -1]])
    bg = np.median(border, 0)
    d = np.abs(c - bg).sum(2)
    m = c.mean(2); chroma = c.max(2) - c.min(2)
    bglike = d < 24
    lo, hi, ch = shadow
    shadowlike = (m >= lo) & (m <= hi) & (chroma <= ch)
    lab, _ = nd.label(bglike | shadowlike)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    outside = np.isin(lab, list(edge))
    fg = nd.binary_opening(~outside, iterations=1)
    l2, n2 = nd.label(fg); sizes = nd.sum(fg, l2, range(1, n2 + 1))
    big = int(np.argmax(sizes)) + 1 if n2 else 0
    keep = []
    for i, (sl, sz) in enumerate(zip(nd.find_objects(l2), sizes)):
        h, w = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
        if sz < 12: continue
        if h <= 6 and w > 25: continue                                   # panel border lines
        if i + 1 != big and (sl[1].start == 0 or sl[1].stop == fg.shape[1]) and sz < 400: continue  # neighbour spill
        keep.append(i + 1)
    fg = np.isin(l2, keep)
    # anchor: x at the centre of the baked shadow (steady between frames), y at the lowest
    # point of the knight's body (the nearest foot), so the feet stand on the ground
    sh = outside & shadowlike & ~bglike
    body = l2 == big
    by, bx = np.nonzero(body)
    if sh.sum() > 40: ax = np.nonzero(sh)[1].mean()
    else: ax = (bx.min() + bx.max()) / 2
    fy, fx = np.nonzero(fg)
    near = np.abs(fx - ax) < 25           # feet can be separate pieces from the body; ignore dust/slashes off to the side
    ay = fy[near].max() if near.any() else by.max()
    return c, fg, ax, ay, by.max() - by.min()


def height_of(src, shadow, rows, cols):
    """Median knight height (source px) along the 'down' row of an animation."""
    return np.median([cut(src, cols[i], cols[i + 1], rows[0], rows[1], shadow)[4] for i in range(len(cols) - 1)])


def place(out, src, shadow, S, rows, cols, row0):
    for di in range(4):
        for fi in range(len(cols) - 1):
            c, fg, ax, ay, _ = cut(src, cols[fi], cols[fi + 1], rows[di], rows[di + 1], shadow)
            im = Image.fromarray(np.dstack([c, fg * 255]).astype(np.uint8), 'RGBA')
            w, h = max(1, round(im.width * S)), max(1, round(im.height * S))
            pre = np.array(im).astype(float); pre[..., :3] *= pre[..., 3:4] / 255
            small = np.array(Image.fromarray(pre.astype(np.uint8)).resize((w, h), Image.BOX)).astype(float)
            a = small[..., 3]
            rgb = np.where(a[..., None] > 0, small[..., :3] * 255 / np.maximum(a[..., None], 1), 0)
            small = Image.fromarray(np.dstack([rgb, np.where(a > 110, 255, 0)]).astype(np.uint8), 'RGBA')
            px, py = round(CW / 2 - ax * S), round(CH - 2 - ay * S)
            tmp = Image.new('RGBA', (CW + 2 * w, CH + 2 * h)); tmp.alpha_composite(small, (px + w, py + h))
            ta = np.array(tmp)[..., 3] > 0
            LOST.append(int(ta.sum() - ta[h:h + CH, w:w + CW].sum()))
            out.alpha_composite(tmp.crop((w, h, w + CW, h + CH)), (fi * CW, (row0 + di) * CH))


LOST = []
src1 = np.array(Image.open(SHEET1[0]).convert('RGB')).astype(int)
src2 = np.array(Image.open(SHEET2[0]).convert('RGB')).astype(int)
# sheet 2 draws the knight smaller: scale it so the standing knight matches sheet 1
h1 = height_of(src1, SHADOW[SHEET1[0]], *SHEET1[1]['walk'])
h2 = height_of(src2, SHADOW[SHEET2[0]], *SHEET2[1]['idle'])
S2 = S1 * h1 / h2
print(f'knight height: sheet1 {h1:.0f}px, sheet2 {h2:.0f}px -> sheet2 scale {S2:.3f}')

order = list(SHEET1[1]) + list(SHEET2[1])
out = Image.new('RGBA', (CW * 6, CH * 4 * len(order)))
row = 0
for name in order:
    sheet, src, S = (SHEET1, src1, S1) if name in SHEET1[1] else (SHEET2, src2, S2)
    spec = sheet[1]
    rows, cols = spec[name]
    place(out, src, SHADOW[sheet[0]], S, rows, cols, row)
    print(f'{name}: row {row}, {len(cols) - 1} frames')
    row += 4

# one shared palette for a clean pixel-art look
alpha = np.array(out)[..., 3]
q = out.convert('RGB').quantize(48, method=Image.MEDIANCUT).convert('RGB')
final = np.dstack([np.array(q), alpha]); final[alpha == 0] = 0
Image.fromarray(final.astype(np.uint8), 'RGBA').save('assets/sprites/knight.png')
print('wrote assets/sprites/knight.png;', sum(LOST), 'pixels clipped at cell edges, worst frame', max(LOST))
