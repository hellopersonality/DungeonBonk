# Cut the knight master sheet (assets/source/knight_master.png) into the hero atlas assets/sprites/knight.png.
# Run from the repo root. Needs Python with numpy, scipy and Pillow.
# The atlas layout (64x48 cells, 4 direction rows per animation) must match render/knight.js.
import numpy as np
from PIL import Image
from scipy import ndimage as nd

CW, CH = 64, 52              # atlas cell (game pixels); feet anchored at (CW/2, CH-2)
DIRS = ['down', 'left', 'up', 'right']

# The master sheet (assets/source/knight_master.png): per animation the row edges
# (down / left / up / right) and column edges of its grid cells, in source pixels.
MASTER = 'assets/source/knight_master.png'
TOP, MID, DRINK = [115, 181, 247, 313, 380], [430, 496, 561, 627, 694], [745, 814, 882, 951, 1025]
GRID = {
  'walk':   (TOP, [563, 623, 683, 743, 803, 863, 923]),
  'attack': (MID, [124, 196, 270, 344, 418, 489, 557]),
  'hurt':   (MID, [677, 759, 840, 920]),
  'death':  (MID, [1041, 1129, 1216, 1305, 1395]),
  'idle':   (TOP, [120, 200, 282, 364, 446]),
  'dash':   (TOP, [1033, 1093, 1156, 1220, 1282, 1343, 1403]),
  'drink':  (DRINK, [226, 410, 596, 780, 966, 1155, 1345]),
}
SHADOW = (12, 21, 8)   # faint baked shadow: (min brightness, max brightness, max chroma)
HEAD_ANCHOR = {'walk', 'idle', 'drink'}
TARGET_H = 37          # standing knight height in game pixels (~2.3 world units)


def cut(src, x0, x1, y0, y1, shadow, anchor='cell'):
    """Foreground mask with background and baked ground shadow removed, plus a feet anchor."""
    c = src[y0:y1, x0:x1]
    bg = np.median(c.reshape(-1, 3), 0)  # the background covers most of the cell
    d = np.abs(c - bg).sum(2)
    m = c.mean(2); chroma = c.max(2) - c.min(2)
    bglike = d < 24
    lo, hi, ch = shadow
    shadowlike = (m >= lo) & (m <= hi) & (chroma <= ch)
    lab, _ = nd.label(bglike | shadowlike)
    B = 5  # seed from a band around the cell edge (the sheet's grid lines can sit right on it)
    edge = set(np.unique(np.concatenate([lab[:B].ravel(), lab[-B:].ravel(), lab[:, :B].ravel(), lab[:, -B:].ravel()]))) - {0}
    outside = np.isin(lab, list(edge))
    fg = ~outside
    fg[:B] = fg[-B:] = False; fg[:, :B] = fg[:, -B:] = False  # the sheet's grid lines sit in this band
    fg = nd.binary_opening(fg, iterations=1)
    l2, n2 = nd.label(fg); sizes = nd.sum(fg, l2, range(1, n2 + 1))
    big = int(np.argmax(sizes)) + 1 if n2 else 0
    keep = []
    for i, (sl, sz) in enumerate(zip(nd.find_objects(l2), sizes)):
        h, w = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
        if sz < 12: continue
        if (h <= 6 and w > 25) or (w <= 6 and h > 25): continue           # panel / grid lines
        if i + 1 != big and (sl[1].start <= B + 1 or sl[1].stop >= fg.shape[1] - B - 1) and sz < 400: continue  # neighbour spill
        keep.append(i + 1)
    fg = np.isin(l2, keep)
    # anchor: x at the centre of the baked shadow (steady between frames), y at the lowest
    # point of the knight's body (the nearest foot), so the feet stand on the ground
    sh = outside & shadowlike & ~bglike
    # the knight's body can come out in a few pieces: take every substantial piece
    bigsz = sizes[big - 1] if n2 else 0
    body = np.isin(l2, [i for i in keep if sizes[i - 1] >= 0.2 * bigsz])
    by, bx = np.nonzero(body)
    # x anchor: in-place animations hold the helmet steady; moving ones (lunges, recoils,
    # falls) use the cell centre, since the sheet draws each knight centred in its cell
    if anchor == 'head':
        fy, fx = np.nonzero(fg); ax = fx[fy < fy.min() + 10].mean()
    else:
        ax = fg.shape[1] / 2
    fy, fx = np.nonzero(fg)
    near = np.abs(fx - ax) < 25           # feet can be separate pieces from the body; ignore dust/slashes off to the side
    ay = fy[near].max() if near.any() else by.max()
    return c, fg, ax, ay, by.max() - by.min()


def height_of(src, shadow, rows, cols):
    """Median knight height (source px) along the 'down' row of an animation."""
    return np.median([cut(src, cols[i], cols[i + 1], rows[0], rows[1], shadow)[4] for i in range(len(cols) - 1)])


def place(out, src, shadow, S, rows, cols, row0, anchor):
    for di in range(4):
        for fi in range(len(cols) - 1):
            c, fg, ax, ay, _ = cut(src, cols[fi], cols[fi + 1], rows[di], rows[di + 1], shadow, anchor)
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
src = np.array(Image.open(MASTER).convert('RGB')).astype(int)
h = height_of(src, SHADOW, *GRID['idle'])
S = TARGET_H / h
print(f'standing knight {h:.0f}px in the sheet -> scale {S:.3f}')

out = Image.new('RGBA', (CW * 6, CH * 4 * len(GRID)))
for i, (name, (rows, cols)) in enumerate(GRID.items()):
    place(out, src, SHADOW, S, rows, cols, i * 4, 'head' if name in HEAD_ANCHOR else 'cell')
    print(f'{name}: row {i * 4}, {len(cols) - 1} frames')

# one shared palette for a clean pixel-art look
alpha = np.array(out)[..., 3]
q = out.convert('RGB').quantize(48, method=Image.MEDIANCUT).convert('RGB')
final = np.dstack([np.array(q), alpha]); final[alpha == 0] = 0
Image.fromarray(final.astype(np.uint8), 'RGBA').save('assets/sprites/knight.png')
print('wrote assets/sprites/knight.png;', sum(LOST), 'pixels clipped at cell edges, worst frame', max(LOST))
