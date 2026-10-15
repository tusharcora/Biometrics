# Isometric room extensions for the "Combined ideas" row (C boards), built on F1's iso.py.
import math
from px import R, E, glow, shade, bounds, DATA, ITEMS, paths, fmt
from iso import Iso, POSTER, CLOCK, HT, HH, dark, lite, mix
from front import sprite, recolour, SPR

XS = {
    'medal': (['r.b', 'rrb', '.y.', 'yYy', '.y.'], {'r': '#DC2626', 'b': '#2563EB', 'y': '#F59E0B', 'Y': '#FDE68A'}),
    'cup': (['yYyyy', 'yYyyy', '.yyy.', '..y..', '.kkk.'], {'y': '#F59E0B', 'Y': '#FDE68A', 'k': '#78350F'}),
    'acorn': (['...g...', '..kkk..', '.kKkkk.', 'kkkkkkk', '.yYyyy.', '.yYyyy.', '.yyyyy.', '..yyy..', '...y...', '.ooooo.', 'ooooooo'],
              {'g': '#4D7C0F', 'k': '#92400E', 'K': '#B45309', 'y': '#F59E0B', 'Y': '#FDE68A', 'o': '#57534E'}),
    'lantern': (['..k..', '.kkk.', 'kyyyk', 'kyYyk', 'kyyyk', 'kyyyk', '.kkk.'], {'k': '#44403C', 'y': '#F59E0B', 'Y': '#FEF3C7'}),
    'gift': (['..p.p..', '...p...', 'rrrprrr', 'rRrprrr', 'rrrprrr', 'rrrprrr', 'rrrprrr'], {'p': '#FDE68A', 'r': '#7C3AED', 'R': '#A78BFA'}),
    'sprout': (['g...g', 'gg.gg', '.ggg.', '..g..', '..g..'], {'g': '#22C55E'}),
    'yarn': (['.ppp.', 'pPppp', 'ppPpp', 'pppPp', '.ppp.'], {'p': '#F472B6', 'P': '#FBCFE8'}),
    'zz': (['kkk.....', '..k.....', '.k..kkkk', 'kkk....k', '......k.', '.....k..', '....kkkk'], {'k': '#CBD5E1'}),
}


def xs(name, x, foot, mirror=False):
    rows, pal = XS[name] if name in XS else SPR[name]
    r = sprite(rows, pal, x, foot - len(rows))
    if mirror:
        b = bounds(r)
        r = [[2 * ((b[0] + b[2]) / 2) - q[0] - q[2], q[1], q[2], q[3], q[4]] for q in r]
    return r


SKIES = {
    'sun': ['#3B82F6', '#5596F8', '#71AAFA', '#93C1FC'],
    'cloud': ['#64748B', '#71819A', '#8292A9', '#94A3B8'],
    'rain': ['#334155', '#384659', '#3E4C61', '#475569'],
    'night': ['#060A17', '#0A1122', '#0F1830', '#1A1A45'],
}


class IsoX(Iso):
    def __init__(self, n=7, m=None, wall=64, wallc='#2E3646', floor=('#4A382B', '#523E2F'), weather='sun'):
        super().__init__(n, m, wall)
        self.wallc, self.floorc, self.weather = wallc, floor, weather

    def wp(self, side, a, z):
        return self.P(0, a, z) if side == 'L' else self.P(a, 0, z)

    def win(self, r, side, a0, da, night=False, weather=None):
        weather = 'night' if night else (weather or self.weather)
        W = lambda a, z: self.wp(side, a, z)
        z0, z1 = 24, 54
        poly = __import__('px').poly
        poly(r, [W(a0, z0 - 2), W(a0 + da, z0 - 2), W(a0 + da, z1 + 2), W(a0, z1 + 2)], '#1E2430')
        band = (z1 - z0) / 4
        for k, c in enumerate(SKIES[weather]):
            za = z1 - band * (k + 1); zb = z1 - band * k
            poly(r, [W(a0 + .08, za), W(a0 + da - .08, za), W(a0 + da - .08, zb), W(a0 + .08, zb)], c)
        x, y = W(a0 + da * .35, z1 - 8)
        if weather == 'night':
            E(r, x, y, 3, 3, '#CBD5E1'); R(r, x + 8, y + 10, 1, 1, '#E2E8F0'); R(r, x - 6, y + 14, 1, 1, '#E2E8F0')
        elif weather == 'sun':
            E(r, x, y, 4, 4, '#FCD34D'); E(r, x - 1, y - 1, 2, 2, '#FDE68A')
        elif weather == 'cloud':
            E(r, x + 2, y + 2, 6, 2.5, '#E2E8F0'); E(r, x - 1, y, 3.5, 2.5, '#F1F5F9'); E(r, x + 6, y + 9, 5, 2, '#CBD5E1')
        else:  # rain
            E(r, x + 2, y, 7, 2.5, '#64748B'); E(r, x - 1, y - 1, 4, 2, '#7C8BA1')
            for k in range(14):
                a = a0 + .2 + (k * .37) % (da - .4)
                z = z0 + 3 + (k * 7) % (z1 - z0 - 10)
                px_, py_ = W(a, z)
                R(r, px_, py_, 1, 2, '#93C5FD')
        mid = a0 + da / 2
        self.line(r, W(mid, z0), W(mid, z1), '#1E2430')

    def shell(self, r, night=False, window=True, window2=False):
        n, m, H, P = self.n, self.m, self.wall, self.P
        poly = __import__('px').poly
        wall, floor = self.wallc, self.floorc
        wl, wr = dark(wall, .14), wall
        poly(r, [P(0, 0, 0), P(0, m, 0), P(0, m, H), P(0, 0, H)], wl)
        poly(r, [P(0, 0, 0), P(n, 0, 0), P(n, 0, H), P(0, 0, H)], wr)
        for j in range(1, m):
            self.line(r, P(0, j, 2), P(0, j, H), dark(wl, .1))
        for i in range(1, n):
            self.line(r, P(i, 0, 2), P(i, 0, H), dark(wr, .1))
        cap = lite(wall, .12)
        self.line(r, P(0, m, H), P(0, 0, H), cap)
        self.line(r, P(0, 0, H), P(n, 0, H), cap)
        poly(r, [P(0, 0, 0), P(0, m, 0), P(0, m, 3), P(0, 0, 3)], dark(wall, .35))
        poly(r, [P(0, 0, 0), P(n, 0, 0), P(n, 0, 3), P(0, 0, 3)], dark(wall, .28))
        poly(r, [P(n, 0, 0), P(n, m, 0), P(n, m, -5), P(n, 0, -5)], dark(floor[0], .42))
        poly(r, [P(0, m, 0), P(n, m, 0), P(n, m, -5), P(0, m, -5)], dark(floor[0], .3))
        for i in range(n):
            for j in range(m):
                self.flat(r, i, j, 1, 1, floor[(i + j) % 2])
        for j in range(m):
            self.line(r, P(0, j + .5), P(n, j + .5), dark(floor[0], .12))
        if window:
            self.win(r, 'L', 1.6, 2.0, night)
            poly(r, [P(0, 1.5, 22), P(0, 3.7, 22), P(0.25, 3.7, 22), P(0.25, 1.5, 22)], '#3F4656')
        if window2:
            self.win(r, 'R', n - 2.6, 2.0, night)

    def light(self, r, night=False, weather=None):
        weather = weather or self.weather
        if night:
            self.veil(r)
        elif weather == 'sun':
            self.daylight(r, 1.6, 2.0)
        elif weather == 'cloud':
            R(r, 0, 0, self.W + 10, self.H + 10, 'rgba(30,41,59,0.16)')
        else:
            R(r, 0, 0, self.W + 10, self.H + 10, 'rgba(15,23,42,0.32)')

    # ---- extra pieces ----
    def spr_at(self, name, i, j, z=0, mirror=False, sh=True, colour=None, k=1):
        cx, cy = self.P(i, j, z)
        r = []
        s = xs(name, 0, 0, mirror)
        if k != 1:
            s = [[q[0] * k, q[1] * k, q[2] * k, q[3] * k, q[4]] for q in s]
        b = bounds(s)
        if sh and z == 0:
            shade(r, cx, cy, (b[2] - b[0]) * .6 + 2, 3, .22)
        dx = round(cx - (b[0] + b[2]) / 2)
        dy = round(cy - b[3])
        for q in s:
            R(r, q[0] + dx, q[1] + dy, q[2], q[3], q[4])
        return r

    def kipx(self, i, j, pose='rest', flip=False, colour=None):
        cx, cy = self.P(i + .5, j + .5)
        r = []
        shade(r, cx, cy, 13, 4, .22)
        k = DATA['kip'][pose]
        if colour:
            k = recolour(k, colour)
        b = bounds(k)
        dx = cx - (b[0] + b[2]) / 2
        dy = cy - b[3] + 1
        for q in k:
            x = q[0] + dx
            if flip:
                x = 2 * cx - x - q[2]
            R(r, round(x), round(q[1] + dy), q[2], q[3], q[4])
        return r, []

    def plantg(self, i, j, kind='fern', grow=1.0, pot='#B45309', z=0):
        """A plant whose foliage is revealed from the pot upward: grow 0..1."""
        r = []
        cx, cy = self.P(i + .5, j + .5, z)
        shade(r, cx, cy, 8, 4, .22)
        for k in range(9):
            w = 10 - k // 3
            R(r, cx - w // 2 - 1, cy - 1 - k, w + 2, 1, pot if k > 1 else dark(pot, .25))
        R(r, cx + 3, cy - 9, 2, 8, dark(pot, .3))
        E(r, cx, cy - 10, 7, 2.5, lite(pot, .15)); E(r, cx, cy - 10, 5, 1.5, '#3A2D23')
        if grow <= 0:
            for q in xs('sprout', 0, 0):
                R(r, q[0] + cx - 2, q[1] + cy - 10, q[2], q[3], q[4])
            return r, []
        src = {'fern': 'plant.fern', 'monstera': 'plant.monstera', 'cactus': 'plant.cactus', 'snake': 'plant.snake', 'sunflower': 'plant.sunflower'}[kind]
        it = ITEMS[src]['base']
        potc = {'#B45309', '#8c4107', '#D97706', '#F8FAFC', '#E5E7EB', '#C2410C', '#F1F5F9'}
        pots = [q for q in it if q[4] in potc]
        ptop = min(q[1] for q in pots)
        pcx = (min(q[0] for q in pots) + max(q[0] + q[2] for q in pots)) / 2
        leaves = [q for q in it if not (q[4].startswith('rgba') or q[4] in potc or q[1] >= ptop)]
        top = min(q[1] for q in leaves)
        hgt = ptop - top
        cut = ptop - hgt * grow
        sc = .45 + .55 * grow  # shorter plants are also narrower
        dx = cx - pcx
        dy = (cy - 10) - ptop + 1
        for q in leaves:
            y0 = max(q[1], cut)
            h = min(q[1] + q[3], ptop) - y0
            if h <= 0:
                continue
            nx = pcx + (q[0] - pcx) * sc
            R(r, round(nx + dx), round(y0 + dy + (hgt * (1 - grow)) * 0), max(1, round(q[2] * sc)), h, q[4])
        return r, []

    def cat_play(self, i, j, flip=False):
        r = []
        cx, cy = self.P(i + .5, j + .5)
        f = -1 if flip else 1
        shade(r, cx, cy, 10, 3.5, .22)
        for dx in (-5, -2, 2, 5):
            R(r, cx + dx * f, cy - 4, 1, 4, '#C2410C')
        E(r, cx, cy - 7, 7, 3.5, '#EA9A4A'); E(r, cx - 1 * f, cy - 6, 4, 1.6, '#F0A75A')
        E(r, cx + 7 * f, cy - 11, 3.6, 3.2, '#F0A75A')
        R(r, cx + 5 * f - (1 if f < 0 else 0), cy - 15, 1, 2, '#C2410C'); R(r, cx + 9 * f - (1 if f < 0 else 0), cy - 15, 1, 2, '#C2410C')
        R(r, cx + 8 * f - (1 if f < 0 else 0), cy - 12, 1, 1, '#1F2937')
        for k in range(6):
            R(r, cx - (7 + k // 2) * f - (1 if f < 0 else 0), cy - 8 - k, 1, 1, '#C2410C')
        return r, []

    def plank_L(self, j0, dj, z):
        r = []
        self.box(r, 0, j0, z, .35, dj, 2, '#5B4636', '#4A382B', '#3A2D23')
        return r

    def trophy_shelf(self, j0, z, items, k=2):
        """A plank on the left wall with award sprites standing on it."""
        r = self.plank_L(j0, 1.8, z)
        for n_, nm in enumerate(items):
            r += self.spr_at(nm, .18, j0 + .25 + n_ * .45, z + 2, sh=False, k=k)
        return r, []

    def glow_piece(self, name, i, j, z=0, night=False, rgb='253,224,71', big=1.0, k=1):
        r, em = [], []
        cx, cy = self.P(i, j, z)
        s = self.spr_at(name, i, j, z, k=k)
        if night:
            glow(em, cx, cy - 6, 16 * big, 10 * big, rgb, .08)
            em += [q for q in s if not q[4].startswith('rgba')]
        else:
            glow(r, cx, cy - 6, 12 * big, 8 * big, rgb, .06)
        r += s
        return r, em


def standard(I, night=False, drop=(), radio=True, extra=()):
    """F1's furnished room as named, depth-sorted objects."""
    O = []
    A = lambda nm, d, f: O.append((nm, d, f))
    A('poster', -10, lambda: I.wall_art(1.0, 50, *POSTER, wall='right'))
    A('clock', -10, lambda: I.wall_art(5.0, 52, *CLOCK, wall='right'))

    def plank():
        r = []
        I.box(r, 3.0, 0, 38, 1.6, .35, 2, '#5B4636', '#4A382B', '#3A2D23')
        return r, []
    A('plank', -9, plank)
    if radio:
        A('radio', -8.9, lambda: I.radio(3.15, .02, 40, night))
    A('cactus', -8.8, lambda: I.plant(3.95, -.2, 'cactus', z=40))
    A('rug', 0, lambda: I.rug(1.4, 2.6, 3.6, 3.0))
    A('bookshelf', 1.6, lambda: I.bookshelf(5.4, 0.0, 1.0, .6))
    A('desk', 3.1, lambda: I.desk(1.9, 0.15))
    A('monitor', 3.2, lambda: I.monitor(2.6, 0.2, 22, night))
    A('keyboard', 3.25, lambda: I.keyboard(3.0, 0.3, 22))
    A('mug', 3.3, lambda: I.mug(4.05, .55, 22))
    A('desklamp', 3.3, lambda: I.desk_lamp(2.2, .45, 22, night=night))
    A('chair', 4.0, lambda: I.chair(3.3, 1.35))
    A('fern1', 0.6, lambda: I.plant(0.05, 0.05, 'fern'))
    A('monstera', 6.8, lambda: I.plant(6.1, 0.05, 'monstera'))
    A('floorlamp', 5.5, lambda: I.floor_lamp(0.1, 4.4, night))
    A('beanbag', 7.0, lambda: I.beanbag(0.5, 5.6))
    A('fern2', 7.4, lambda: I.plant(0.05, 6.05, 'fern'))
    A('kip', 9.4, lambda: I.kipx(3.3, 3.3, 'wave'))
    A('catbed', 10.4, lambda: I.cat_bed(4.7, 5.2))
    A('fern3', 10.8, lambda: I.plant(6.1, 4.1, 'fern'))
    A('cone', 8.4, lambda: I.cone(1.9, 6.1))
    O = [o for o in O if o[0] not in drop]
    O += list(extra)
    return O


def room(n=7, night=False, weather='sun', drop=(), extra=(), window2=False, wallc='#2E3646', floor=('#4A382B', '#523E2F'),
         radio=True, objs=None, kip=None):
    """Returns (base, light, em, I). `extra` = [(name, depth, fn(I) -> (b, e))]; `kip` = (i, j, pose, flip, colour)."""
    I = IsoX(n, wallc=wallc, floor=floor, weather=weather)
    base, em = [], []
    I.shell(base, night=night, window2=window2)
    I.n0 = len(base)
    if objs is None:
        O = standard(I, night, drop=tuple(drop) + (('kip',) if kip else ()), radio=radio)
    else:
        O = list(objs(I))
    for nm, d, f in extra:
        O.append((nm, d, (lambda f=f: f(I))))
    if kip:
        ki, kj, pose, fl, col = kip
        O.append(('kip', ki + kj + 2.8, lambda: I.kipx(ki, kj, pose, fl, col)))
    O.sort(key=lambda o: o[1])
    for nm, d, f in O:
        b, e = f()
        base += b
        em += e
    light = []
    I.light(light, night)
    return base, light, em, I
