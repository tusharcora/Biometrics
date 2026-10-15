import sys, os, re, json
D = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, D)
from px import ITEMS, DATA, bounds, move, flip, fmt, R, paths
from iso import Iso, POSTER, CLOCK, HT, HH
from isoscene import scene
from front import room, piece_rects, spr, kip_rects, recolour, SPR
from fb import *

OUT = os.path.join(D, 'out')
os.makedirs(os.path.join(OUT, 'project'), exist_ok=True)
B = {}


def foot_note(edit, vs, trade, build):
    return [('HOW EDITING WORKS', edit), ('VS TODAY’S 12 SLOTS', vs), ('TRADE-OFF', trade), ('BUILD SIZE', build)]


def P2(I, i, j, z=0):
    x, y = I.P(i, j, z)
    return f'{fmt(x)},{fmt(y)}'


def diamond(I, i, j, di, dj, fill, stroke, z=0, dash=''):
    pts = ' '.join(P2(I, a, b, z) for a, b in ((i, j), (i + di, j), (i + di, j + dj), (i, j + dj)))
    d = f' stroke-dasharray="3 2"' if dash else ''
    return f'<polygon points="{pts}" fill="{fill}" stroke="{stroke}" stroke-width="1" vector-effect="non-scaling-stroke"{d}></polygon>'


def wallquad(I, i0, i1, z0, z1, fill, stroke, wall='right'):
    if wall == 'right':
        pts = [I.P(i0, 0, z0), I.P(i1, 0, z0), I.P(i1, 0, z1), I.P(i0, 0, z1)]
    else:
        pts = [I.P(0, i0, z0), I.P(0, i1, z0), I.P(0, i1, z1), I.P(0, i0, z1)]
    p = ' '.join(f'{fmt(x)},{fmt(y)}' for x, y in pts)
    return f'<polygon points="{p}" fill="{fill}" stroke="{stroke}" stroke-width="1" vector-effect="non-scaling-stroke"></polygon>'


def isogrid(I, walls=True):
    s = []
    L = lambda a, b, c='rgba(255,255,255,0.22)': s.append(f'<line x1="{fmt(a[0])}" y1="{fmt(a[1])}" x2="{fmt(b[0])}" y2="{fmt(b[1])}" stroke="{c}" stroke-width="1" vector-effect="non-scaling-stroke"></line>')
    for i in range(I.n + 1):
        L(I.P(i, 0), I.P(i, I.m))
    for j in range(I.m + 1):
        L(I.P(0, j), I.P(I.n, j))
    if walls:
        c = 'rgba(255,255,255,0.12)'
        for i in range(I.n + 1):
            L(I.P(i, 0, 0), I.P(i, 0, I.wall), c)
        for j in range(I.m + 1):
            L(I.P(0, j, 0), I.P(0, j, I.wall), c)
        for z in range(16, I.wall, 16):
            L(I.P(0, 0, z), I.P(I.n, 0, z), c)
            L(I.P(0, 0, z), I.P(0, I.m, z), c)
    return ''.join(s)


def handles(b, col='rgb(245,245,244)', pad=2):
    x0, y0, x1, y1 = b[0] - pad, b[1] - pad, b[2] + pad, b[3] + pad
    s = f'<rect x="{x0}" y="{y0}" width="{x1 - x0}" height="{y1 - y0}" fill="none" stroke="{col}" stroke-width="1" stroke-dasharray="3 2" vector-effect="non-scaling-stroke"></rect>'
    for x, y in ((x0, y0), (x1, y0), (x0, y1), (x1, y1)):
        s += f'<rect x="{x - 1.5}" y="{y - 1.5}" width="3" height="3" fill="{col}" stroke="rgb(10,11,14)" stroke-width="1" vector-effect="non-scaling-stroke"></rect>'
    return s


def ghost(rects, op=.8, red=False):
    from px import paths
    s = f'<g opacity="{op}">{paths(rects)}</g>'
    if red:
        s += f'<g>{paths([[x, y, w, h, "rgba(248,113,113,0.6)"] for x, y, w, h, c in rects if not c.startswith("rgba")])}</g>'
    return s


def crop(rects, cx, cy, w, h, s=2, over='', under='', label=None, mid=None):
    if mid:
        return rsvg(rects[:mid[0]], w, h, s, w / 2 - cx * s, h / 2 - cy * s, label=label, over=mid[1] + paths(rects[mid[0]:]) + over, under=under)
    return rsvg(rects, w, h, s, w / 2 - cx * s, h / 2 - cy * s, label=label, over=over, under=under)


def isvg(b, l, e, I, vw, vh, S, ox, oy=0, label=None, grid='', over=''):
    return rsvg(b[:I.n0], vw, vh, S, ox, oy, label=label, over=grid + paths(b[I.n0:] + l + e) + over)


# ======================================================================
# F1 · Isometric free-build
# ======================================================================
def f1():
    b, l, e, I = scene(False)
    S = 2
    vw, vh = 390, I.H * S
    ox = (vw - I.W * S) / 2
    view_room = rsvg(b + l + e, vw, vh, S, ox, 0, label='KIP’s isometric room: a desk with a monitor, lamp and mug, a bookshelf, three ferns, a floor lamp, a beanbag, a cat asleep in its bed, a traffic cone, and KIP waving on the rug')
    kx, ky = I.P(3.8, 3.8)
    say = f'<span class="say" aria-hidden="true" style="left: {ox + kx * S}px; top: {ky * S - 60}px">MY ROOM!</span>'
    edit_btn = btn('Edit', 'ol', ico='edit')
    left = ibtn('back', 'Back to KIP', 'gh')
    A = header('KIP’s room', '27 pieces · 7 × 7 floor', left, edit_btn)
    A += f'  <div style="position: relative; height: {vh}px; flex: none">{view_room}{say}</div>\n'
    A += f"""  <div style="display: flex; flex-direction: column; gap: 10px; padding: 12px 16px">
    <div class="card" style="padding: 14px; display: flex; flex-direction: column; gap: 10px">
      <div class="row" style="justify-content: space-between"><span class="label" style="color: rgb(245,245,244)">Room level 2</span><span class="muted" style="font-size: 13px">Next: 8 × 8 floor</span></div>
      <div class="bar" role="img" aria-label="15 of 21 nights"><i style="width: 71%"></i></div>
      <span class="muted" style="font-size: 13px">21-night sleep-goal streak · 15 of 21</span>
    </div>
    <div class="card" style="padding: 12px 14px; display: flex; align-items: center; gap: 12px">
      <div class="col" style="flex: 1; gap: 2px"><span style="font-size: 14px; font-weight: 600">3 new pieces to place</span><span class="muted" style="font-size: 13px">Traffic cone, a third fern, cat bed</span></div>
      {btn('Place', 'df', h=40)}
    </div>
    <div class="row">{btn('Visit a buddy', 'ol', style='flex: 1')}{btn('Cosy autumn week', 'ol', ico='trophy', style='flex: 1')}</div>
  </div>
"""
    # ---- edit mode ----
    gi, gj = 4.6, 2.2
    def ghost_fern(I):
        r, _ = I.plant(gi, gj, 'fern')
        return r
    eb, el, ee, _ = scene(False)
    g = ghost_fern(I)
    gb = bounds(g)
    under_grid = isogrid(I)
    over = diamond(I, gi, gj, 1, 1, 'rgba(163,230,53,0.32)', LIME) + ghost(g, .85) + handles(gb, LIME)
    # dashed trail from the inventory
    edit_room = isvg(eb, el, ee, I, vw, vh, S, ox, 0, label='Edit mode: tile grid over the floor and walls; a fern from the inventory snaps to an empty tile, outlined in lime', grid=under_grid, over=over)
    tbx = ox + (gb[0] + gb[2]) / 2 * S - 118
    tby = gb[1] * S - 62
    toolbar = f"""<div role="toolbar" aria-label="Selected: fern" style="position: absolute; left: {tbx}px; top: {tby}px; display: flex; gap: 2px; padding: 3px; border-radius: 10px; background: rgb(20,22,27); border: 1px solid rgb(44,47,55)">
      <button class="b gh tb">{icon('flip', 18)}Flip</button><button class="b gh tb">{icon('rotate', 18)}Turn</button><button class="b gh tb">{icon('store', 18)}Store</button><button class="b df tb">{icon('check', 18)}Place</button></div>"""
    left = ibtn('undo', 'Undo') + ibtn('redo', 'Redo')
    Bh = header('Editing', 'Drag to move', '', ibtn('grid', 'Grid', pressed=True) + btn('Done', 'df'))
    Bh = Bh.replace('<div style="flex: 1; min-width: 0;', left + '<div style="flex: 1; min-width: 0;', 1)
    Bp = Bh + f'  <div style="position: relative; height: {vh}px; flex: none">{edit_room}{toolbar}</div>\n'
    # insets: stack, blocked, wall
    ins = []
    I2 = I
    desk_top = diamond(I2, 1.9, .15, 2.4, 1.1, 'rgba(163,230,53,0.30)', LIME, z=22)
    mug = I2.mug(3.5, .95, 22, '#60A5FA')[0]
    ins.append(('Stacks on top', 'A mug snaps onto the desk', crop(eb + el + ee, *I2.P(3.1, .7, 22), 118, 100, 2, over=desk_top + ghost(mug, .95) + handles(bounds(mug), LIME, 1))))
    bean = I2.beanbag(3.1, 1.6)[0]
    ins.append(('Blocked', 'Overlaps the chair: shown red', crop(eb + el + ee, *I2.P(3.5, 1.9, 6), 118, 100, 2, over=diamond(I2, 3.1, 1.6, 1, 1, 'rgba(248,113,113,0.30)', RED) + ghost(bean, .9, red=True))))
    post = I2.wall_art(5.6, 34, *POSTER, wall='right')[0]
    wq = wallquad(I2, 5.5, 6.6, 22, 36, 'rgba(163,230,53,0.25)', LIME)
    ins.append(('Wall snap', 'Posters snap to the wall grid', crop(eb + el + ee, *I2.P(5.8, 0, 30), 118, 100, 2, over=wq + ghost(post, .95), mid=(I.n0, isogrid(I2)))))
    insets = ''.join(f'<div style="display: flex; flex-direction: column; gap: 4px; width: 114px"><div style="width: 114px; height: 100px; overflow: hidden; border-radius: 8px; border: 1px solid rgb(44,47,55)">{svg_}</div><span class="label" style="font-size: 9px; color: rgb(245,245,244)">{t}</span><span class="cap" style="font-size: 11px; line-height: 14px">{c}</span></div>' for t, c, svg_ in ins)
    Bp += f'  <div style="display: flex; gap: 9px; padding: 4px 16px 0">{insets}</div>\n'
    # inventory strip
    Ii = Iso(7)
    inv = [(Ii.plant(0, 0, 'fern')[0], 'Fern', '×1', True), (Ii.cone(0, 0)[0], 'Cone', '×1', False), (spr('duck', 0, 10), 'Duck', '×2', False),
           (spr('gnome', 0, 10), 'Gnome', '×1', False), (Ii.radio(0, 0, 0)[0], 'Radio', '×1', False)]
    tiles = ''.join(tile(r, nm, n, sel, w=64) for r, nm, n, sel in inv)
    Bp += f"""  <div style="margin-top: auto; border-top: 1px solid rgb(30,33,40); padding: 10px 16px 14px; display: flex; flex-direction: column; gap: 8px; background: rgb(14,15,19)">
    <div class="row" style="justify-content: space-between"><span class="label" style="color: rgb(245,245,244)">Inventory · 9 not placed</span>{btn('All', 'gh', h=36, style='font-size: 13px')}</div>
    <div style="display: flex; gap: 6px">{tiles}</div>
  </div>
"""
    cols = [plabel('View mode', 'what you see on the KIP page'), phone(A), ]
    cols = [plabel('View mode', 'tap Edit to rearrange') + phone(A), plabel('Edit mode', 'dragging a third fern from the inventory') + phone(Bp)]
    W = 820
    H = 1110
    ft = notes(foot_note(
        'Tap Edit: a tile grid appears on the floor and both back walls. Drag a piece from the inventory or the room; it snaps to the tile under your finger, shows red where it doesn’t fit, and lands on desks and shelves when dropped on them. Flip and Turn on the selected piece.',
        'Slots go away. A room is a list of pieces with a tile (x, y), a height level, a facing and a wall side. Duplicates are fine. Every piece needs a footprint in tiles.',
        'The closest to the free-build feel you asked for, but every piece is re-drawn isometrically (two facings each), and the diamond room fits the wide room strip on the KIP page badly.',
        'L · new iso renderer, depth sorting, footprints, ~75 pieces re-drawn ×2 facings, new edit mode and server model.'), cols=4)
    B['F1'] = ('F1 · Isometric free-build', board('F1 · Isometric free-build', [cols[0], cols[1]], ft, W, H))


f1()


def write():
    for name, (title, html_) in B.items():
        assert "'" not in re.search(r"data-props='([^']*)'", html_).group(1)
        open(os.path.join(OUT, 'project', name + '.dc.html'), 'w').write(html_)
        prev = html_.replace('<script src="./support.js"></script>', '').replace('<x-dc>', '').replace('</x-dc>', '').replace('<helmet>', '').replace('</helmet>', '')
        open(os.path.join(OUT, name + '.preview.html'), 'w').write(prev)
        w = re.search(r'"width": (\d+)', html_).group(1); h = re.search(r'"height": (\d+)', html_).group(1)
        print(name, len(html_), w, h)
    json.dump({k: [v[0]] + [int(x) for x in re.search(r'"width": (\d+), "height": (\d+)', v[1]).groups()] for k, v in B.items()}, open(os.path.join(OUT, 'titles.json'), 'w'))


if __name__ == '__main__':
    write()
