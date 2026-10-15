# Pixel helpers for the F row: rect lists -> SVG, front-on composition, isometric primitives.
import json, os, math
D = os.path.dirname(os.path.abspath(__file__))
DATA = json.load(open(os.path.join(D, 'data.json')))
ITEMS = DATA['items']


def paths(rects):
    order, by = [], {}
    for x, y, w, h, c in rects:
        if w <= 0 or h <= 0:
            continue
        if c not in by:
            by[c] = []
            order.append(c)
        by[c].append(f'M{fmt(x)} {fmt(y)}h{fmt(w)}v{fmt(h)}h{fmt(-w)}z')
    return ''.join(f'<path d="{"".join(by[c])}" fill="{c}"></path>' for c in order)


def fmt(v):
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    if isinstance(v, float):
        return f'{v:.2f}'.rstrip('0').rstrip('.')
    return str(v)


def svg(rects, vw, vh, scale, ox=0, oy=0, label=None, style='', bg=None, extra=''):
    a = f'role="img" aria-label="{label}"' if label else 'aria-hidden="true"'
    b = f'<rect width="{vw}" height="{vh}" fill="{bg}"></rect>' if bg else ''
    return (f'<svg {a} width="{vw}" height="{vh}" viewBox="0 0 {vw} {vh}" shape-rendering="crispEdges" style="display: block; {style}">'
            f'{b}<g transform="translate({fmt(ox)} {fmt(oy)}) scale({fmt(scale)})">{paths(rects)}{extra}</g></svg>')


def move(rects, dx, dy):
    return [[x + dx, y + dy, w, h, c] for x, y, w, h, c in rects]


def flip(rects, axis):
    # mirror around vertical line x = axis
    return [[2 * axis - x - w, y, w, h, c] for x, y, w, h, c in rects]


def bounds(rects):
    if not rects:
        return (0, 0, 0, 0)
    return (min(r[0] for r in rects), min(r[1] for r in rects), max(r[0] + r[2] for r in rects), max(r[1] + r[3] for r in rects))


def tint(rects, rgba):
    """A same-shape overlay in one colour (ghost / invalid red)."""
    return [[x, y, w, h, rgba] for x, y, w, h, c in rects if not c.startswith('rgba')]


def item(id, night=False):
    k = id + ('@n' if night else '')
    it = ITEMS[k]
    return it


def piece(id, foot=None, x=None, night=False, mirror=False, dy=0):
    """An item's base+emissive+frame0 rects, moved so its bbox left = x and its bottom = foot (cells)."""
    it = item(id, night)
    base = it['base'] + it['f0']
    em = it['em']
    b = bounds(base)
    dx = 0 if x is None else x - b[0]
    ddy = (0 if foot is None else foot - b[3]) + dy
    base, em = move(base, dx, ddy), move(em, dx, ddy)
    if mirror:
        bb = bounds(base)
        ax = (bb[0] + bb[2]) / 2
        base, em = flip(base, ax), flip(em, ax)
    return base, em


def kip(pose='rest', x=0, y=0, cell=1):
    r = DATA['kip'][pose]
    return [[x + a * cell / 1, y + b * cell / 1, w * cell, h * cell, c] for a, b, w, h, c in r]


# ---------- rasterising (cells) ----------
def R(r, x, y, w, h, c):
    if w > 0 and h > 0:
        r.append([x, y, w, h, c])


def poly(r, pts, c):
    minx = min(p[0] for p in pts); maxx = max(p[0] for p in pts)
    for x in range(int(round(minx)), int(round(maxx))):
        cx = x + 0.5
        lo, hi = math.inf, -math.inf
        n = len(pts)
        for i in range(n):
            a, b = pts[i], pts[(i + 1) % n]
            if (a[0] <= cx < b[0]) or (b[0] <= cx < a[0]):
                yy = a[1] + (cx - a[0]) / (b[0] - a[0]) * (b[1] - a[1])
                lo = min(lo, yy); hi = max(hi, yy)
        if hi > lo:
            y0, y1 = int(round(lo)), int(round(hi))
            if y1 > y0:
                R(r, x, y0, 1, y1 - y0, c)


def E(r, cx, cy, rx, ry, c):
    for y in range(math.floor(cy - ry), math.ceil(cy + ry)):
        dy = (y + 0.5 - cy) / ry
        if abs(dy) >= 1:
            continue
        hw = rx * math.sqrt(1 - dy * dy)
        x0, x1 = round(cx - hw), round(cx + hw)
        if x1 > x0:
            R(r, x0, y, x1 - x0, 1, c)


def glow(r, cx, cy, rx, ry, rgb, a):
    for k in (1, .78, .56, .34):
        E(r, cx, cy, rx * k, ry * k, f'rgba({rgb},{a})')


def shade(r, cx, cy, rx, ry, a=.18):
    E(r, cx, cy, rx, ry, f'rgba(0,0,0,{a})')
