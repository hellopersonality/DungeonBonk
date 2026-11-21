# Cut assets/source/knight_sheet.png into the hero atlas assets/sprites/knight.png (run from the repo root).
# Needs Python with numpy, scipy and Pillow. Cell layout must match render/knight.js.
import json, numpy as np
from PIL import Image
from scipy import ndimage as nd
SRC = np.array(Image.open('assets/source/knight_sheet.png').convert('RGB')).astype(int)
S = 0.42                     # downscale: ~95px tall source -> ~40px (16 px per world unit)
CW, CH = 64, 48              # atlas cell (game pixels); feet anchored at (CW/2, CH-3)
DIRS = ['down', 'left', 'up', 'right']
TOP = [78, 183, 284, 391, 500]; BOT = [605, 716, 818, 926, 1035]
PANELS = {
  'walk':   (TOP, [140, 230, 325, 415, 508, 600, 695]),
  'attack': (TOP, [858, 955, 1050, 1145, 1240, 1330, 1425]),
  'hurt':   (BOT, [165, 315, 465, 620]),
  'death':  (BOT, [860, 990, 1130, 1272, 1425]),
}
frames = {}
def cut(x0, x1, y0, y1):
    c = SRC[y0:y1, x0:x1]
    border = np.concatenate([c[0], c[-1], c[:, 0], c[:, -1]])
    bg = np.median(border, 0)
    d = np.abs(c - bg).sum(2)
    m = c.mean(2); chroma = c.max(2) - c.min(2)
    bglike = d < 24
    shadowlike = (m >= 13) & (m <= 33) & (chroma <= 11)
    passable = bglike | shadowlike
    lab, _ = nd.label(passable)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    outside = np.isin(lab, list(edge))
    fg = ~outside
    fg = nd.binary_opening(fg, iterations=1)
    # drop specks (keep sparks of a reasonable size)
    l2, n2 = nd.label(fg); sizes = nd.sum(fg, l2, range(1, n2 + 1))
    keep = []
    big = int(np.argmax(sizes)) + 1 if n2 else 0
    for i, (sl, sz) in enumerate(zip(nd.find_objects(l2), sizes)):
        h, w = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
        if sz < 25: continue
        if h <= 6 and w > 25: continue                      # panel border lines
        if i + 1 != big and (sl[1].start == 0 or sl[1].stop == fg.shape[1]) and sz < 400: continue  # neighbour's slash spill
        keep.append(i + 1)
    fg = np.isin(l2, keep)
    sh = outside & shadowlike & ~bglike
    ys, xs = np.nonzero(fg)
    if sh.sum() > 80:
        sy, sx = np.nonzero(sh); ax, ay = sx.mean(), np.percentile(sy, 60)
    else: ax, ay = (xs.min() + xs.max()) / 2, ys.max()
    return c, fg, ax, ay
out = Image.new('RGBA', (CW * 6, CH * 4 * 4), (0, 0, 0, 0))
meta = {}; row = 0
for anim, (rows, cols) in PANELS.items():
    meta[anim] = {'row': row, 'frames': len(cols) - 1}
    for di, dname in enumerate(DIRS):
        for fi in range(len(cols) - 1):
            c, fg, ax, ay = cut(cols[fi], cols[fi + 1], rows[di], rows[di + 1])
            rgba = np.dstack([c, fg * 255]).astype(np.uint8)
            im = Image.fromarray(rgba, 'RGBA')
            w, h = round(im.width * S), round(im.height * S)
            # premultiplied downscale, then hard alpha
            pre = np.array(im).astype(float); pre[..., :3] *= pre[..., 3:4] / 255
            small = np.array(Image.fromarray(pre.astype(np.uint8)).resize((w, h), Image.BOX)).astype(float)
            a = small[..., 3]; rgb = np.where(a[..., None] > 0, small[..., :3] * 255 / np.maximum(a[..., None], 1), 0)
            small = np.dstack([rgb, np.where(a > 110, 255, 0)]).astype(np.uint8)
            tile = Image.new('RGBA', (CW, CH))
            px = round(CW / 2 - ax * S); py = round(CH - 3 - ay * S)
            tile.alpha_composite(Image.fromarray(small, 'RGBA'), (max(-w, px), max(-h, py)) if False else (0, 0)) if False else None
            tmp = Image.new('RGBA', (CW + 2 * w, CH + 2 * h)); tmp.alpha_composite(Image.fromarray(small, 'RGBA'), (px + w, py + h))
            tile = tmp.crop((w, h, w + CW, h + CH))
            out.alpha_composite(tile, (fi * CW, (row + di) * CH))
    row += 4
# reduce to a shared palette for a cleaner pixel-art look
alpha = np.array(out)[..., 3]
q = out.convert('RGB').quantize(40, method=Image.MEDIANCUT).convert('RGB')
final = np.dstack([np.array(q), alpha]); final[alpha == 0] = 0
Image.fromarray(final.astype(np.uint8), 'RGBA').save('assets/sprites/knight.png')
print('wrote assets/sprites/knight.png')

