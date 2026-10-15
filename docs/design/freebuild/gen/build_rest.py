import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_f import *
from front import room, piece_rects, spr, kip_rects, recolour, SPR
from px import paths

S = 2
ROWS = {'back': 88, 'mid': 98, 'front': 108}


def froom(placed, night=False, kip=dict(pose='rest', x=110, y=52, z=104), vw=390, vh=None, ox=None, oy=0, S=2, under='', over='', label=None, **kw):
    b, l, e, n0 = room(placed, night=night, kip=kip, split=True, **kw)
    width = 170 + kw.get('extra', 0)
    vh = vh or 110 * S
    ox = (vw - width * S) / 2 if ox is None else ox
    return rsvg(b[:n0], vw, vh, S, ox, oy, label=label, over=under + paths(b[n0:] + l + e) + over), ox


def bands(active=None, labels=True):
    s = ''
    spans = [('back', 76, 88), ('mid', 88, 98), ('front', 98, 110)]
    for k, (n, y0, y1) in enumerate(spans):
        a = .16 if n == active else .07
        col = '163,230,53' if n == active else '125,211,252'
        s += f'<rect x="0" y="{y0}" width="170" height="{y1 - y0}" fill="rgba({col},{a})"></rect>'
        s += f'<line x1="0" y1="{y1}" x2="170" y2="{y1}" stroke="rgba({col},0.5)" stroke-width="1" stroke-dasharray="3 3" vector-effect="non-scaling-stroke"></line>'
    return s


def wallgrid(x0=12, x1=160, y0=6, y1=70, step=8):
    s = ''
    for y in range(y0, y1, step):
        for x in range(x0, x1, step):
            s += f'M{x} {y}h1v1h-1z'
    return f'<path d="{s}" fill="rgba(255,255,255,0.28)"></path>'


def band_labels(ox, active=None, top=0):
    out = ''
    for n, t, y in (('back', 'BACK', 82), ('mid', 'MIDDLE', 93), ('front', 'FRONT', 104)):
        st = 'background: rgb(163,230,53); color: rgb(10,11,14); ' if n == active else ''
        out += f'<span class="plab" aria-hidden="true" style="{st}left: {ox + 2}px; top: {top + y * 2 - 7}px">{t}</span>'
    return out


def pbox(p, night=False):
    r, _ = piece_rects(p, night)
    return bounds([q for q in r if not q[4].startswith('rgba')])


def toolbar(x, y, items, aria):
    bt = ''.join(f'<button class="b {"df" if k == "Place" or k == "Done" else "gh"} tb">{icon(i, 18)}{k}</button>' for i, k in items)
    pos = f'position: absolute; left: {x}px; top: {y}px; ' if x is not None else 'align-self: center; margin-top: 10px; '
    return f'<div role="toolbar" aria-label="{aria}" style="{pos}display: flex; gap: 2px; padding: 3px; border-radius: 10px; background: rgb(20,22,27); border: 1px solid rgb(44,47,55)">{bt}</div>'


def edit_header(title='Editing', sub='Drag to move'):
    h = header(title, sub, '', ibtn('grid', 'Grid', pressed=True) + btn('Done', 'df'))
    return h.replace('<div style="flex: 1; min-width: 0;', ibtn('undo', 'Undo') + ibtn('redo', 'Redo') + '<div style="flex: 1; min-width: 0;', 1)


# the recommended room: today's art, freely placed
ROOM2 = [
    dict(id='art.calendar', z=1), dict(id='art.mountain', x=66, dy=4, z=1), dict(id='shelf.books', z=1),
    dict(id='rug.slate', z=50),
    dict(id='corner.floorlamp', x=4, foot=88, z=88), dict(id='plant.fern', x=14, foot=88, z=88.2),
    dict(id='plant.snake', x=40, foot=88, z=88.5),
    dict(id='desk.monitor', z=100, dy=-3), dict(id='item.mug', z=101, dy=-3), dict(id='lamp.amber', z=101, dy=-3),
    dict(spr='radio', x=86, foot=67, z=101),
    dict(id='plant.cactus', x=147, foot=98, z=98),
    dict(id='corner.beanbag', x=16, foot=108, z=108), dict(id='set.cottage.pet', x=52, foot=108, z=108),
    dict(id='plant.fern', x=149, foot=109, z=109), dict(spr='cone', x=134, foot=109, z=109.5),
]
KIP_DESK = dict(pose='type', x=110, y=49, z=104, mirror=True)

def offplank(id):
    r = [q for q in piece_rects(dict(id=id))[0] if not q[4].startswith('rgba')]
    py = max(r, key=lambda q: q[2])[1]
    return [q for q in r if q[1] + q[3] <= py]


INV_FRONT = {
    'fern': (lambda: piece_rects(dict(id='plant.fern'))[0], 'Fern'),
    'snake': (lambda: piece_rects(dict(id='plant.snake'))[0], 'Snake plant'),
    'sunflower': (lambda: piece_rects(dict(id='plant.sunflower'))[0], 'Sunflower'),
    'monstera': (lambda: piece_rects(dict(id='plant.monstera'))[0], 'Monstera'),
    'cactus': (lambda: piece_rects(dict(id='plant.cactus'))[0], 'Cactus'),
    'beanbag': (lambda: piece_rects(dict(id='corner.beanbag'))[0], 'Beanbag'),
    'floorlamp': (lambda: piece_rects(dict(id='corner.floorlamp'))[0], 'Floor lamp'),
    'lamp': (lambda: piece_rects(dict(id='lamp.amber'))[0], 'Desk lamp'),
    'saltlamp': (lambda: piece_rects(dict(id='lamp.salt'))[0], 'Salt lamp'),
    'mug': (lambda: piece_rects(dict(id='item.mug'))[0], 'Mug'),
    'bottle': (lambda: piece_rects(dict(id='item.bottle'))[0], 'Bottle'),
    'mountain': (lambda: piece_rects(dict(id='art.mountain'))[0], 'Mountain'),
    'clock': (lambda: piece_rects(dict(id='art.clock'))[0], 'Clock'),
    'cork': (lambda: piece_rects(dict(id='art.cork'))[0], 'Cork board'),
    'wave': (lambda: piece_rects(dict(id='art.wave'))[0], 'Wave print'),
    'band': (lambda: piece_rects(dict(id='art.band'))[0], 'Band poster'),
    'heart': (lambda: piece_rects(dict(id='art.heart'))[0], 'Neon heart'),
    'cat': (lambda: piece_rects(dict(id='set.cottage.pet'))[0], 'Cat bed'),
    'bag': (lambda: piece_rects(dict(id='corner.bag'))[0], 'Punch bag'),
    'radio': (lambda: spr('radio', 0, 10), 'Radio'),
    'cone': (lambda: spr('cone', 0, 10), 'Cone'),
    'duck': (lambda: spr('duck', 0, 10), 'Duck'),
    'gnome': (lambda: spr('gnome', 0, 10), 'Gnome'),
    'lava': (lambda: spr('lava', 0, 10), 'Lava lamp'),
    'figure': (lambda: spr('figure', 0, 10), 'KIP figure'),
    'pumpkin': (lambda: spr('pumpkin', 0, 10), 'Pumpkin'),
    'candle': (lambda: spr('candle', 0, 10), 'Candle'),
    'star': (lambda: spr('star', 0, 10), 'Star sticker'),
    'hearts': (lambda: spr('heart', 0, 10), 'Heart sticker'),
    'leaves': (lambda: spr('leaves', 0, 10), 'Leaf pile'),
    'cactusmini': (lambda: offplank('shelf.minicactus'), 'Mini cactus'),
    'luckycat': (lambda: offplank('shelf.luckycat'), 'Lucky cat'),
    'trophy': (lambda: offplank('shelf.trophyB'), 'Trophy'),
}


def T(key, n=None, sel=False, w=None, dis=False, price=None, name=None, extra=''):
    f, nm = INV_FRONT[key]
    return tile(f(), name or nm, n, sel, w=w, dis=dis, price=price, extra=extra)


def tabs(names, active, aria='Categories'):
    return f'<div role="group" aria-label="{aria}" style="display: flex; gap: 4px; overflow: hidden">' + ''.join(
        f'<button class="b tab" aria-pressed="{"true" if n == active else "false"}">{n}</button>' for n in names) + '</div>'


# ======================================================================
# F2 · Front-on free-build
# ======================================================================
def f2():
    moving = dict(id='plant.fern', x=96, foot=98, z=98.2)
    placed = [p for p in ROOM2] + [moving]
    gb = pbox(moving)
    origin = pbox(dict(id='plant.fern', x=104, foot=108))
    under = bands('mid') + wallgrid()
    trail = (f'<rect x="{origin[0] - 1}" y="{origin[1] - 1}" width="{origin[2] - origin[0] + 2}" height="{origin[3] - origin[1] + 2}" fill="none" stroke="rgba(245,245,244,0.6)" stroke-width="1" stroke-dasharray="2 2" vector-effect="non-scaling-stroke"></rect>'
             f'<path d="M{(origin[0] + origin[2]) / 2} {origin[1] + 4} L{(gb[0] + gb[2]) / 2 + 3} {gb[3] - 2}" stroke="rgb(163,230,53)" stroke-width="1.5" fill="none" vector-effect="non-scaling-stroke" stroke-dasharray="3 2"></path>')
    over = trail + handles(gb, LIME)
    svg_, ox = froom(placed, kip=KIP_DESK, under=under, over=over, label='Edit mode on today’s front-on room: the floor split into back, middle and front rows, a dot grid on the wall, and a second fern being moved from the front row to the middle row')
    rh = 220
    tb = toolbar(None, None, [('flip', 'Flip'), ('up', 'Back'), ('dn', 'Front'), ('store', 'Store'), ('check', 'Place')], 'Selected: fern')
    A = edit_header()
    A += f'  <div style="position: relative; height: {rh}px; flex: none">{svg_}{band_labels(ox, "mid")}</div>\n' + tb
    A += f"""  <div class="row" style="padding: 10px 16px; justify-content: space-between"><span class="muted" style="font-size: 13px">Fern · middle row · in front of the floor lamp</span><span class="tag">31 / 40</span></div>
  <div style="margin-top: auto; border-top: 1px solid rgb(30,33,40); padding: 10px 16px 14px; display: flex; flex-direction: column; gap: 10px; background: rgb(14,15,19)">
    {tabs(['All', 'Floor', 'Wall', 'On top', 'Funny'], 'All', 'Inventory categories')}
    <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px">{T('fern', '×1', True)}{T('sunflower', '×2')}{T('beanbag', '×1')}{T('duck', '×2')}{T('gnome', '×1')}{T('clock', '×1')}{T('wave', '×1')}{T('mug', '×3')}{T('lava', '×1')}{T('pumpkin', '×4')}{T('snake', '×1')}{T('saltlamp', '×1')}{T('heart', '×1')}{T('radio', '×1')}{T('cone', '×2')}</div>
  </div>
"""
    # reuse card: the same sprite at three rows
    strip = [dict(id='plant.fern', x=36, foot=88, z=88), dict(id='plant.fern', x=50, foot=98, z=98), dict(id='plant.fern', x=64, foot=108, z=108),
             dict(id='corner.beanbag', x=100, foot=88, z=88), dict(id='corner.beanbag', x=112, foot=98, z=98), dict(id='corner.beanbag', x=124, foot=108, z=108)]
    s2, ox2 = froom(strip, kip=None, vw=358, vh=88, oy=-132, S=2, under=bands(None), label='The same fern and beanbag sprites placed in the back, middle and front rows, overlapping')
    reuse = f"""<div class="card" style="padding: 14px; display: flex; flex-direction: column; gap: 10px">
  <span class="label" style="color: rgb(245,245,244)">Today’s art, as-is</span>
  <div style="border-radius: 8px; overflow: hidden">{s2}</div>
  <span class="muted" style="font-size: 13px; line-height: 18px">Every piece already has a foot line on the 170 × 110 grid. Free placement only changes its x and its row; no sprite is redrawn. Pixels stay 2 pt: depth comes from the row’s height, overlap and draw order, not scaling.</span>
</div>"""
    ft = notes(foot_note(
        'Tap Edit. The floor shows three rows (back, middle, front) and the wall a dot grid. Drag sideways to slide; drag up or down to change row. Pieces in front overlap pieces behind. Desk tops and shelf planks catch small pieces.',
        'The 12 slots become free pieces with x, row (or wall x, y) and a flip. Same catalogue and art; duplicates allowed; room-wide pieces (wallpaper, floor, window) stay single.',
        'Less depth than isometric: only three rows, and you can’t walk things toward the back corners. Tall pieces in the front row can hide KIP’s desk.',
        'M · placement model + server list, edit mode with rows, overlap sort, inventory drawer. No new art.'))
    B['F2'] = ('F2 · Front-on free-build · recommended', board('F2 · Front-on free-build · recommended', [plabel('Edit mode', 'moving a second fern back a row') + phone(A) + reuse + ft], '', 390, 1460))


# ======================================================================
# F3 · Hybrid: slots + free props
# ======================================================================
def f3():
    props = [
        dict(spr='duck', x=93, foot=52, z=102), dict(spr='figure', x=78, foot=73, z=102),
        dict(spr='star', x=62, foot=24, z=2), dict(spr='star', x=70, foot=32, z=2), dict(spr='heart', x=38, foot=34, z=2),
        dict(id='art.band', x=74, dy=6, z=2), dict(spr='candle', x=124, foot=33, z=3),
        dict(spr='gnome', x=20, foot=108, z=108), dict(spr='pumpkin', x=126, foot=108, z=108), dict(spr='pumpkin', x=134, foot=109, z=109),
        dict(id='plant.succulents', x=74, foot=106, z=106), dict(spr='leaves', x=96, foot=104, z=104),
    ]
    slots = [dict(id='art.calendar', z=1), dict(id='shelf.books', z=1), dict(id='rug.slate', z=50), dict(id='desk.monitor', z=100),
             dict(id='item.mug', z=101), dict(id='lamp.amber', z=101), dict(id='plant.fern', z=120)]
    sel = props[0]
    gb = pbox(sel)
    outl = ''.join(f'<rect x="{b[0] - 1}" y="{b[1] - 1}" width="{b[2] - b[0] + 2}" height="{b[3] - b[1] + 2}" fill="none" stroke="rgba(245,245,244,0.45)" stroke-width="1" stroke-dasharray="2 2" vector-effect="non-scaling-stroke"></rect>' for b in (pbox(p) for p in props[1:]))
    svg_, ox = froom(slots + props, kip=dict(pose='rest', x=110, y=52, z=104), over=outl + handles(gb, LIME, 1), label='Props mode: the slot pieces stay put while a duck on the monitor, a figurine, stickers, a poster, a candle, a gnome, pumpkins and leaves sit freely on top, each outlined')
    tb = toolbar(None, None, [('flip', 'Flip'), ('layers', 'Front'), ('store', 'Store'), ('copy', 'Another'), ('check', 'Done')], 'Selected: rubber duck')
    seg = f'<div style="padding: 0 16px 10px"><div role="group" aria-label="Edit layer" style="display: flex; gap: 4px; padding: 3px; border: 1px solid rgb(44,47,55); border-radius: 8px; background: rgb(20,22,27)"><button class="b" aria-pressed="false" style="flex: 1; height: 38px; border-radius: 6px; font-size: 14px">Big pieces · 12 slots</button><button class="b df" aria-pressed="true" style="flex: 1; height: 38px; border-radius: 6px; font-size: 14px">Props · anywhere</button></div></div>'
    A = edit_header('Editing', 'Props layer') + seg
    A += f'  <div style="position: relative; height: 220px; flex: none">{svg_}</div>\n' + tb
    A += f"""  <div class="row" style="padding: 10px 16px; justify-content: space-between"><span class="muted" style="font-size: 13px">Duck · sitting on the monitor</span><span class="tag">12 / 30 props</span></div>
  <div style="margin-top: auto; border-top: 1px solid rgb(30,33,40); padding: 10px 16px 14px; display: flex; flex-direction: column; gap: 10px; background: rgb(14,15,19)">
    {tabs(['All', 'Stickers', 'Figures', 'Plants', 'Posters'], 'All', 'Prop categories')}
    <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px">{T('duck', '×1', True)}{T('star', '×6')}{T('hearts', '×3')}{T('figure', '×1')}{T('cactusmini', '×2')}{T('luckycat', '×1')}{T('candle', '×2')}{T('pumpkin', '×3')}{T('gnome', '×1')}{T('trophy', '×1')}{T('leaves', '×2')}{T('cactus', '×1')}{T('band', '×1')}{T('bottle', '×1')}{T('cone', '×1')}</div>
  </div>
"""
    # the slot mode, small
    from front import room as froom_raw
    sb, sl, se = froom_raw(slots, kip=dict(pose='rest', x=110, y=52))
    anchors = {'wallpaper': None, 'window': (16, 12, 40, 43), 'art': (130, 12, 22, 24), 'shelf': (94, 16, 38, 18), 'desk': (58, 46, 84, 56), 'desk_item': (102, 56, 8, 18), 'plant': (148, 74, 22, 36), 'lamp': (58, 50, 16, 22), 'corner': (0, 30, 14, 66), 'rug': (28, 90, 118, 18), 'pet': (30, 92, 26, 14)}
    o = ''.join(f'<rect x="{a[0]}" y="{a[1]}" width="{a[2]}" height="{a[3]}" fill="rgba(125,211,252,0.10)" stroke="rgba(125,211,252,0.8)" stroke-width="1" vector-effect="non-scaling-stroke"></rect>' for a in anchors.values() if a)
    mini = rsvg(sb + sl + se, 358, 220, 2, 9, 0, label='Big pieces mode: today’s twelve slot hotspots outlined over the room', over=o)
    card = f"""<div class="card" style="padding: 14px; display: flex; flex-direction: column; gap: 10px">
  <span class="label" style="color: rgb(245,245,244)">Big pieces mode = today</span>
  <div style="border-radius: 8px; overflow: hidden">{mini}</div>
  <span class="muted" style="font-size: 13px; line-height: 18px">Wallpaper, floor, window, desk, shelf and rug keep their slots and today’s hotspots and tray. Only the props layer is free.</span>
</div>"""
    ft = notes(foot_note(
        'Two layers behind one toggle. Big pieces: tap a hotspot, pick from the tray (today). Props: drag small things anywhere on the floor, walls, desk, shelf or monitor; overlap and duplicates allowed.',
        'Keeps the 12 slots and the decorate code. Adds a props list (id, x, y, flip) drawn after the slots, and a 30-prop cap so it stays tidy.',
        'The room’s layout never changes (the desk, window and rug are always where they are), so rooms look alike from far away. Props are small, so it feels like a sticker book more than free building.',
        'S–M · a props layer, drag and drop, a props drawer, new small sprites. The slot engine is untouched.'))
    B['F3'] = ('F3 · Hybrid: slots + free props', board('F3 · Hybrid: slots + free props', [plabel('Props layer', 'the duck sits on the monitor') + phone(A) + card + ft], '', 390, 1570))


f2()
f3()

if __name__ == '__main__':
    write()
