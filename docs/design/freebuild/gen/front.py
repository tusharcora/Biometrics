# Front-on free placement on the app's real art (data.json from mobile/src/lib/room via gen.ts).
from px import DATA, ITEMS, R, E, glow, shade, move, flip, bounds, svg, paths

SKY_LIGHT = None


def ramp(body):
    def rgb(h): return [int(h[i:i + 2], 16) for i in (1, 3, 5)]
    def hx(v): return '#%02x%02x%02x' % tuple(max(0, min(255, round(x))) for x in v)
    b = rgb(body)
    return {'body': body.upper(), 'light': hx([v + (255 - v) * .25 for v in b]), 'shade': hx([v * .78 for v in b]), 'deep': hx([v * .6 for v in b])}


CORAL = ramp('#FB7185')


def recolour(rects, colour):
    to = ramp(colour)
    m = {}
    for k in ('body', 'light', 'shade', 'deep'):
        m[CORAL[k].lower()] = to[k]
    return [[x, y, w, h, m.get(c.lower(), c)] for x, y, w, h, c in rects]


def daylight_of(shell):
    ao = {tuple(r) for r in DATA['light']['ao']}
    return [r for r in DATA['rooms'][shell]['light'] if tuple(r) not in ao]


# ---------- custom front-on sprites (one char = one cell) ----------
def sprite(rows, pal, x, y):
    r = []
    for v, row in enumerate(rows):
        u = 0
        while u < len(row):
            ch = row[u]
            if ch in '. ':
                u += 1; continue
            w = 1
            while u + w < len(row) and row[u + w] == ch:
                w += 1
            R(r, x + u, y + v, w, 1, pal[ch])
            u += w
    return r


SPR = {
    'radio': (['...........k...',
               '..........k....',
               '.oooooooookooo.',
               'oOOOOOOOOOOOOOo',
               'oyyyyyyoo.dd.oo',
               'oyHyHyyoodddd.o',
               'oyyyyyyoo.dd..o',
               'oOOOOOOOOOOOOOo',
               '.ss.........ss.'],
              {'k': '#94A3B8', 'o': '#92400E', 'O': '#B45309', 'y': '#FDE68A', 'H': '#B45309', 'd': '#1F2937', 's': '#3A2D23'}),
    'cat': (['o.o.........',
             'ooo.........',
             'oeoe.......t',
             'oooooooooo.t',
             '.oooOOooooot',
             '.oooOOoooo..',
             '.o.o...o.o..'],
            {'o': '#EA9A4A', 'O': '#F0A75A', 'e': '#1F2937', 't': '#C2410C'}),
    'duck': (['..yyy..',
              '.yyeyoo',
              '.yyyy..',
              'yyyyyyy',
              'yYyyyyy',
              '.yyyyy.'],
             {'y': '#FACC15', 'Y': '#FDE68A', 'e': '#1F2937', 'o': '#F97316'}),
    'cone': (['...oo...',
              '...oo...',
              '..oOoo..',
              '..wwww..',
              '..wwww..',
              '.oooooo.',
              '.oOooooo',
              '.oooooo.',
              'cccccccc'],
             {'o': '#F97316', 'O': '#FDBA74', 'w': '#F1F5F9', 'c': '#C2410C'}),
    'gnome': (['...r...',
               '..rrr..',
               '..rrrr.',
               '.rrrrr.',
               '.ppppp.',
               '.wwwww.',
               '.wwwww.',
               '.bbbbb.',
               '.bbbbb.',
               '.k...k.'],
              {'r': '#DC2626', 'p': '#FCD9B6', 'w': '#F1F5F9', 'b': '#2563EB', 'k': '#1F2937'}),
    'lava': (['..kkk..',
              '.pmmmp.',
              '.pmMmp.',
              '.pmmmp.',
              '.pMmmp.',
              '.pmmmp.',
              '..kkk..',
              '.kkkkk.'],
             {'k': '#334155', 'p': '#7C3AED', 'm': '#A855F7', 'M': '#F0ABFC'}),
    'star': (['..y..',
              '.yyy.',
              'yyyyy',
              '.yyy.',
              '.y.y.'], {'y': '#FDE047'}),
    'heart': (['.p.p.',
               'ppppp',
               'ppppp',
               '.ppp.',
               '..p..'], {'p': '#F472B6'}),
    'note': (['..kk',
              '..k.',
              '..k.',
              'kkk.',
              'kk..'], {'k': '#FDE68A'}),
    'sparkle': (['.w.',
                 'www',
                 '.w.'], {'w': '#FEF9C3'}),
    'figure': (['.ggg.',
                '.gGg.',
                '.ggg.',
                'ggggg',
                '.ggg.',
                '.g.g.',
                'kkkkk'], {'g': '#6EE7B7', 'G': '#14161B', 'k': '#334155'}),
    'pumpkin': (['....g...',
                 '...g....',
                 '.oOoOoo.',
                 'oOoOoOoo',
                 'oOoOoOoo',
                 'oOoOoOoo',
                 '.oooooo.'],
                {'g': '#4D7C0F', 'o': '#EA580C', 'O': '#C2410C'}),
    'candle': (['..y..',
                '..Y..',
                '.www.',
                '.www.',
                '.www.',
                'kkkkk'], {'y': '#FDE68A', 'Y': '#F59E0B', 'w': '#FEF3C7', 'k': '#78350F'}),
    'leaves': (['o..r.',
                '.oo..',
                '..y.o',
                'r.o..'], {'o': '#EA580C', 'r': '#B91C1C', 'y': '#F59E0B'}),
}


def spr(name, x, foot, mirror=False):
    rows, pal = SPR[name]
    r = sprite(rows, pal, x, foot - len(rows))
    if mirror:
        b = bounds(r)
        r = flip(r, (b[0] + b[2]) / 2)
    return r


# ---------- a placed room ----------
# A placement: dict(id=..., x=left cell, foot=bottom cell, mirror=False, z=sort) or dict(spr=name, ...)
def piece_rects(p, night=False):
    if 'spr' in p:
        r = spr(p['spr'], p['x'], p['foot'], p.get('mirror', False))
        if p.get('em'):
            return [], r
        return r, []
    it = ITEMS[p['id'] + ('@n' if night else '')]
    base = it['base'] + it['f0']
    em = list(it['em'])
    if p.get('strip'):
        base = [q for q in base if q[4] not in p['strip']]
    b = bounds([q for q in base if not q[4].startswith('rgba')] or base)
    dx = 0 if p.get('x') is None else p['x'] - b[0]
    dy = 0 if p.get('foot') is None else p['foot'] - b[3]
    if 'dx' in p:
        dx += p['dx']
    if 'dy' in p:
        dy += p['dy']
    base, em = move(base, dx, dy), move(em, dx, dy)
    if p.get('mirror'):
        bb = bounds(base)
        ax = (bb[0] + bb[2]) / 2
        base, em = flip(base, ax), flip(em, ax)
    return base, em


def kip_rects(pose='rest', x=110, y=52, colour=None, mirror=False):
    k = [[a + x, b + y, w, h, c] for a, b, w, h, c in DATA['kip'][pose]]
    if mirror:
        bb = bounds(k)
        k = flip(k, (bb[0] + bb[2]) / 2)
    if colour:
        k = recolour(k, colour)
    return k


def widen(rects, extra, at=85, band=20):
    """Make the room `extra` cells wider: left of `at` stays, right shifts, the middle repeats the band left of `at`."""
    out = []
    for x, y, w, h, c in rects:
        x1 = x + w
        if x1 <= at:
            out.append([x, y, w, h, c])
        elif x >= at:
            out.append([x + extra, y, w, h, c])
        else:
            out.append([x, y, at - x, h, c])
            out.append([at + extra, y, x1 - at, h, c])
        # fill
        lo, hi = max(x, at - band), min(x1, at)
        if hi > lo:
            for k in range(extra // band):
                out.append([lo + band + k * band, y, hi - lo, h, c])
    return out


def room(placed, night=False, wall='wall.plain', floor='floor.oakDark', window=True, kip=None, extra=0, windows2=None, lights=True, split=False, win='win.plain'):
    shell = 'shell_night' if night else 'shell_day'
    base = []
    for sid in (wall, floor):
        b, _ = piece_rects({'id': sid}, night)
        base += b
    if extra:
        base = widen(base, extra)
    em = []
    if window:
        b, e = piece_rects({'id': win}, night)
        base += b
        em += e
    if windows2 is not None:
        b, e = piece_rects({'id': 'win.plain', 'dx': windows2}, night)
        base += b
    n0 = len(base)
    seq = sorted(placed, key=lambda p: p.get('z', p.get('foot', 0)))
    kip_done = False
    for p in seq:
        if kip and not kip_done and p.get('z', p.get('foot', 0)) > kip.get('z', 200):
            base += kip_rects(kip.get('pose', 'rest'), kip.get('x', 110), kip.get('y', 52), kip.get('colour'), kip.get('mirror', False))
            kip_done = True
        b, e = piece_rects(p, night)
        base += b
        em += e
    if kip and not kip_done:
        base += kip_rects(kip.get('pose', 'rest'), kip.get('x', 110), kip.get('y', 52), kip.get('colour'), kip.get('mirror', False))
    light = list(DATA['light']['ao'])
    if extra:
        light = widen(light, extra)
    if night:
        light.append([0, 0, 170 + extra, 110, 'rgba(6,8,24,0.56)'])
    elif window:
        light += daylight_of('shell_day')
        if windows2 is not None:
            light += move(daylight_of('shell_day'), windows2, 0)
    if split:
        return base, light, em, n0
    return base, light, em


STARTER = [
    dict(id='art.calendar', z=1), dict(id='shelf.books', z=1), dict(id='rug.slate', z=50),
    dict(id='desk.monitor', z=100), dict(id='item.mug', z=101), dict(id='lamp.amber', z=101), dict(id='plant.fern', z=120),
]
