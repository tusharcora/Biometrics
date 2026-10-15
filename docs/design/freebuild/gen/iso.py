# Isometric pixel room for F1: 2:1 tiles, items re-drawn as iso boxes with the v2 palette.
import math
from px import R, poly, E, glow, shade, ITEMS, DATA, move, bounds

HT, HH = 12, 6          # half tile width / height in cells (tile = 24 x 12)


def hexrgb(h):
    h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def mix(a, b, t):
    A, B = hexrgb(a), hexrgb(b)
    return '#%02X%02X%02X' % tuple(round(A[k] + (B[k] - A[k]) * t) for k in range(3))


def dark(c, t=.25):
    return mix(c, '#000000', t)


def lite(c, t=.2):
    return mix(c, '#FFFFFF', t)


class Iso:
    def __init__(self, n=7, m=None, wall=64, ox=None, oy=None):
        self.n, self.m, self.wall = n, (m or n), wall
        self.ox = self.m * HT + 2 if ox is None else ox
        self.oy = wall + 4 if oy is None else oy
        self.W = (self.n + self.m) * HT + 4
        self.H = self.oy + (self.n + self.m) * HH + 8

    def P(self, i, j, z=0):
        return (self.ox + (i - j) * HT, self.oy + (i + j) * HH - z)

    # ---- primitives ----
    def box(self, r, i, j, z, di, dj, h, top, left=None, right=None):
        P = self.P
        left = left or dark(top, .22)
        right = right or dark(top, .38)
        poly(r, [P(i, j + dj, z), P(i + di, j + dj, z), P(i + di, j + dj, z + h), P(i, j + dj, z + h)], left)
        poly(r, [P(i + di, j, z), P(i + di, j + dj, z), P(i + di, j + dj, z + h), P(i + di, j, z + h)], right)
        poly(r, [P(i, j, z + h), P(i + di, j, z + h), P(i + di, j + dj, z + h), P(i, j + dj, z + h)], top)
        # lit top edge
        a, b = P(i, j + dj, z + h), P(i + di, j + dj, z + h)
        self.line(r, a, b, lite(top, .18))

    def flat(self, r, i, j, di, dj, c, z=0):
        P = self.P
        poly(r, [P(i, j, z), P(i + di, j, z), P(i + di, j + dj, z), P(i, j + dj, z)], c)

    def line(self, r, a, b, c):
        (x0, y0), (x1, y1) = a, b
        n = int(max(abs(x1 - x0), 1))
        for k in range(n):
            t = k / n
            R(r, math.floor(x0 + (x1 - x0) * t), math.floor(y0 + (y1 - y0) * t), 1, 1, c)

    def face(self, r, rows, pal, x0, y0, slope):
        """A sprite sheared onto a wall/face: slope +1 for a j-plane (runs down-right), -1 for an i-plane."""
        for v, row in enumerate(rows):
            for u, ch in enumerate(row):
                if ch == '.' or ch == ' ':
                    continue
                dy = (u // 2) if slope > 0 else -((u + 1) // 2)
                R(r, x0 + u, y0 + v + dy, 1, 1, pal[ch])

    def shadow(self, r, i, j, di, dj, a=.22):
        cx, cy = self.P(i + di / 2, j + dj / 2)
        shade(r, cx, cy, (di + dj) * HT * .55, (di + dj) * HH * .55, a)

    # ---- the room shell ----
    def shell(self, r, wall='#2E3646', floor=('#4A382B', '#523E2F'), night=False, window=True):
        n, m, H, P = self.n, self.m, self.wall, self.P
        wl, wr = dark(wall, .14), wall
        # walls (left = plane i=0 along j; right = plane j=0 along i)
        poly(r, [P(0, 0, 0), P(0, m, 0), P(0, m, H), P(0, 0, H)], wl)
        poly(r, [P(0, 0, 0), P(n, 0, 0), P(n, 0, H), P(0, 0, H)], wr)
        # wall panel seams
        for j in range(1, m):
            self.line(r, P(0, j, 2), P(0, j, H), dark(wl, .1))
        for i in range(1, n):
            self.line(r, P(i, 0, 2), P(i, 0, H), dark(wr, .1))
        # wall caps
        self.line(r, P(0, m, H), P(0, 0, H), '#3A4357')
        self.line(r, P(0, 0, H), P(n, 0, H), '#3A4357')
        # skirting
        poly(r, [P(0, 0, 0), P(0, m, 0), P(0, m, 3), P(0, 0, 3)], '#1E2430')
        poly(r, [P(0, 0, 0), P(n, 0, 0), P(n, 0, 3), P(0, 0, 3)], '#232A37')
        # floor slab edge
        poly(r, [P(n, 0, 0), P(n, m, 0), P(n, m, -5), P(n, 0, -5)], '#2B2019')
        poly(r, [P(0, m, 0), P(n, m, 0), P(n, m, -5), P(0, m, -5)], '#33261C')
        # floor tiles: planks running along i
        for i in range(n):
            for j in range(m):
                self.flat(r, i, j, 1, 1, floor[(i + j) % 2])
        for j in range(m):
            for s in (0.5,):
                self.line(r, P(0, j + s), P(n, j + s), dark(floor[0], .12))
        if window:
            self.window(r, 1.6, 2.0, night)

    def window(self, r, j0, dj, night=False):
        P = self.P
        z0, z1 = 24, 54
        sky = ['#060A17', '#0A1122', '#0F1830', '#1A1A45'] if night else ['#3B82F6', '#5596F8', '#71AAFA', '#93C1FC']
        poly(r, [P(0, j0, z0 - 2), P(0, j0 + dj, z0 - 2), P(0, j0 + dj, z1 + 2), P(0, j0, z1 + 2)], '#1E2430')
        band = (z1 - z0) / 4
        for k, c in enumerate(sky):
            za = z1 - band * (k + 1); zb = z1 - band * k
            poly(r, [P(0, j0 + .08, za), P(0, j0 + dj - .08, za), P(0, j0 + dj - .08, zb), P(0, j0 + .08, zb)], c)
        x, y = P(0, j0 + dj * .35, z1 - 8)
        if night:
            E(r, x, y, 3, 3, '#CBD5E1'); R(r, x + 8, y + 10, 1, 1, '#E2E8F0'); R(r, x - 6, y + 14, 1, 1, '#E2E8F0')
        else:
            E(r, x, y, 4, 4, '#FCD34D'); E(r, x - 1, y - 1, 2, 2, '#FDE68A')
        # mullion + sill
        self.line(r, P(0, j0 + dj / 2, z0), P(0, j0 + dj / 2, z1), '#1E2430')
        poly(r, [P(0, j0 - .1, z0 - 2), P(0, j0 + dj + .1, z0 - 2), P(0.25, j0 + dj + .1, z0 - 2), P(0.25, j0 - .1, z0 - 2)], '#3F4656')

    def daylight(self, r, j0, dj):
        P = self.P
        pts = [P(0, j0, 0), P(0, j0 + dj, 0), P(3.4, j0 + dj + 1.6, 0), P(3.4, j0 + 1.6, 0)]
        poly(r, pts, 'rgba(255,241,210,0.11)')
        pts2 = [P(0, j0 + .3, 0), P(0, j0 + dj - .3, 0), P(2.4, j0 + dj + 1.0, 0), P(2.4, j0 + 1.3, 0)]
        poly(r, pts2, 'rgba(255,241,210,0.07)')

    def veil(self, r):
        R(r, 0, 0, self.W + 10, self.H + 10, 'rgba(6,8,24,0.56)')

    # ---- items (each returns (base, emissive)) ----
    def desk(self, i, j, di=2.4, dj=1.1, h=22, wood='#9A7350'):
        r = []
        self.shadow(r, i, j, di, dj)
        for (a, b) in ((i + .1, j + .1), (i + di - .25, j + .1), (i + .1, j + dj - .25), (i + di - .25, j + dj - .25)):
            self.box(r, a, b, 0, .15, .15, h - 3, '#694d35')
        self.box(r, i, j, h - 3, di, dj, 3, wood, '#7a5a3e', '#694d35')
        return r, []

    def monitor(self, i, j, z, night=False):
        r, em = [], []
        self.box(r, i + .3, j + .35, z, .25, .25, 4, '#334155')
        self.box(r, i, j, z + 4, .18, 1.0, 14, '#3F4656', '#323845', '#1F2532')
        # screen on the i-face (faces down-right): plane i+.18, j..j+1
        x0, y0 = self.P(i + .18, j + 1.0 - .08, z + 4 + 12)
        rows = ['............',
                '.bbbbbbbbbbb',
                '.bLLLLLLbbbb',
                '.bbbbbbbbbbb',
                '.bLLLLbbbbbb',
                '.bbbbbbbbbbb',
                '.bLLLLLLLbbb',
                '.bbbbbbbbbbb',
                '.bbbbbbbbbbb']
        pal = {'b': '#0F1A2A', 'L': '#7DD3FC'}
        self.face(r, rows, pal, int(x0), int(y0) - 1, -1)
        if night:
            self.face(em, rows, pal, int(x0), int(y0) - 1, -1)
            cx, cy = self.P(i + .4, j + .5, z + 10)
            glow(em, cx + 8, cy + 4, 18, 10, '125,211,252', .06)
        return r, em

    def keyboard(self, i, j, z):
        r = []
        self.box(r, i, j, z, .35, .8, 1, '#5c626f', '#3F4656', '#323845')
        return r, []

    def mug(self, i, j, z, colour='#FB7185'):
        r = []
        x, y = self.P(i, j, z)
        R(r, x - 2, y - 6, 4, 6, colour); R(r, x - 2, y - 6, 4, 1, lite(colour, .3)); R(r, x + 2, y - 5, 1, 3, dark(colour, .2))
        R(r, x - 1, y - 9, 1, 2, 'rgba(255,255,255,0.35)'); R(r, x + 1, y - 11, 1, 2, 'rgba(255,255,255,0.25)')
        return r, []

    def desk_lamp(self, i, j, z, head='#F59E0B', night=False):
        r, em = [], []
        x, y = self.P(i, j, z)
        R(r, x - 3, y - 1, 6, 2, '#334155')
        R(r, x, y - 12, 1, 11, '#475569')
        R(r, x - 1, y - 13, 6, 2, '#475569')
        R(r, x + 3, y - 15, 5, 4, head); R(r, x + 3, y - 15, 5, 1, lite(head, .3)); R(r, x + 4, y - 11, 3, 1, '#FDE68A')
        if night:
            R(em, x + 4, y - 11, 3, 1, '#FDE68A')
            glow(em, x + 6, y - 2, 16, 8, '253,224,71', .07)
        return r, em

    def chair(self, i, j, col='#475569'):
        r = []
        self.shadow(r, i, j, .8, .8, .18)
        self.box(r, i + .35, j + .35, 0, .1, .1, 8, '#1F2937')
        self.box(r, i + .05, j + .05, 8, .75, .75, 3, col)
        self.box(r, i + .05, j + .05, 11, .12, .75, 14, col)
        return r, []

    def bookshelf(self, i, j, di=1.0, dj=.6, h=44):
        r = []
        self.shadow(r, i, j, di, dj)
        self.box(r, i, j, 0, di, dj, h, '#5B4636', '#4A382B', '#3A2D23')
        # books on the j-face (faces down-left): plane j+dj, runs along i (slope +1)
        cols = 'abcdefghij'
        pal = {'a': '#60A5FA', 'b': '#A78BFA', 'c': '#F59E0B', 'd': '#22C55E', 'e': '#FB7185', 'f': '#94A3B8', 'g': '#FDE68A', 'h': '#4577b4', 'i': '#a3c2dc', 'j': '#c45868', 'p': '#3A2D23'}
        w = int(di * 2 * HT) - 3
        for s, zz in enumerate((16, 28, 40)):
            rows = []
            for v in range(10):
                row = ''
                for u in range(w):
                    k = (u // 2 + s * 3)
                    tall = 6 + (k * 7) % 4
                    row += cols[(k * 3 + s) % 10] if v >= 10 - tall and u % 2 == 0 or (v >= 10 - tall and u % 2 == 1 and (k % 3) != 0) else '.'
                rows.append(row)
            rows.append('p' * w)
            x0, y0 = self.P(i, j + dj, zz)
            self.face(r, rows, pal, int(x0) + 1, int(y0) - 1, +1)
        return r, []

    def radio(self, i, j, z, night=False):
        r, em = [], []
        self.box(r, i, j, z, .55, .3, 7, '#B45309', '#92400E', '#78350F')
        x, y = self.P(i + .1, j + .3, z + 6)
        for k in range(3):
            R(r, x + 1 + k * 2, y + 1 + k, 1, 3, '#FDE68A')
        x2, y2 = self.P(i + .4, j + .3, z + 5)
        E(r, x2 + 1, y2 + 2, 2, 2, '#1F2937')
        x3, y3 = self.P(i + .1, j + .1, z + 7)
        R(r, x3, y3 - 7, 1, 7, '#94A3B8')
        return r, em

    def plant(self, i, j, kind='fern', pot='#B45309', z=0):
        r = []
        cx, cy = self.P(i + .5, j + .5, z)
        shade(r, cx, cy, 8, 4, .22)
        # iso pot: body + rim ellipse
        for k in range(9):
            w = 10 - k // 3
            R(r, cx - w // 2 - 1, cy - 1 - k, w + 2, 1, pot if k > 1 else dark(pot, .25))
        R(r, cx + 3, cy - 9, 2, 8, dark(pot, .3))
        E(r, cx, cy - 10, 7, 2.5, lite(pot, .15)); E(r, cx, cy - 10, 5, 1.5, '#3A2D23')
        # leaves: reuse the front-on sprite's foliage
        src = {'fern': 'plant.fern', 'monstera': 'plant.monstera', 'cactus': 'plant.cactus', 'snake': 'plant.snake', 'sunflower': 'plant.sunflower', 'bamboo': 'plant.bamboo'}[kind]
        it = ITEMS[src]['base']
        potc = {'#B45309', '#8c4107', '#D97706', '#F8FAFC', '#E5E7EB', '#C2410C', '#F1F5F9'}
        pots = [q for q in it if q[4] in potc]
        ptop = min(q[1] for q in pots)
        pcx = (min(q[0] for q in pots) + max(q[0] + q[2] for q in pots)) / 2
        dx = cx - pcx
        dy = (cy - 10) - ptop + 1
        for q in it:
            if q[4].startswith('rgba') or q[4] in potc or q[1] >= ptop:
                continue
            h = min(q[3], ptop - q[1])
            R(r, round(q[0] + dx), round(q[1] + dy), q[2], h, q[4])
        return r, []

    def floor_lamp(self, i, j, night=False):
        r, em = [], []
        cx, cy = self.P(i + .5, j + .5)
        shade(r, cx, cy, 6, 3, .2)
        E(r, cx, cy - 1, 4, 1.6, '#334155')
        R(r, cx, cy - 44, 1, 43, '#475569')
        for k in range(8):
            w = 6 + k
            R(r, cx - w // 2, cy - 54 + k, w, 1, '#FDE68A' if k > 0 else '#FEF3C7')
        R(r, cx - 7, cy - 46, 14, 1, '#F59E0B')
        if night:
            for k in range(8):
                w = 6 + k
                R(em, cx - w // 2, cy - 54 + k, w, 1, '#FDE68A' if k > 0 else '#FEF3C7')
            glow(em, cx, cy - 34, 22, 18, '253,224,71', .06)
            glow(em, cx + 6, cy + 2, 30, 12, '253,224,71', .06)
        return r, em

    def beanbag(self, i, j, c='#FB7185'):
        r = []
        cx, cy = self.P(i + .5, j + .5)
        shade(r, cx, cy, 12, 5, .22)
        E(r, cx, cy - 6, 12, 7, dark(c, .25)); E(r, cx - 1, cy - 8, 11, 6, c); E(r, cx - 4, cy - 11, 5, 2.5, lite(c, .25))
        E(r, cx + 2, cy - 6, 6, 2, dark(c, .12))
        return r, []

    def rug(self, i, j, di, dj, c='#475569', c2='#334155'):
        r = []
        self.flat(r, i, j, di, dj, c2)
        self.flat(r, i + .15, j + .15, di - .3, dj - .3, c)
        self.flat(r, i + .45, j + .45, di - .9, dj - .9, '#3E4A5C')
        return r, []

    def cat_bed(self, i, j):
        r = []
        cx, cy = self.P(i + .5, j + .5)
        shade(r, cx, cy, 11, 5, .22)
        E(r, cx, cy - 3, 11, 5, '#9A3B3B'); E(r, cx, cy - 4, 8, 3, '#7F2D2D')
        # sleeping cat (ginger loaf)
        E(r, cx - 1, cy - 6, 6, 3, '#EA9A4A'); E(r, cx + 4, cy - 8, 3, 2.5, '#F0A75A')
        R(r, cx + 3, cy - 11, 1, 2, '#C2410C'); R(r, cx + 6, cy - 11, 1, 2, '#C2410C')
        R(r, cx + 3, cy - 8, 2, 1, '#7C2D12'); R(r, cx - 5, cy - 5, 6, 1, '#C2410C')
        return r, []

    def cone(self, i, j):
        r = []
        cx, cy = self.P(i + .5, j + .5)
        shade(r, cx, cy, 7, 3, .22)
        R(r, cx - 6, cy - 2, 12, 2, '#C2410C')
        for k in range(16):
            w = max(2, 9 - k // 2)
            c = '#F1F5F9' if 6 <= k <= 8 else ('#F97316' if k % 16 < 14 else '#FB923C')
            R(r, cx - w // 2, cy - 3 - k, w, 1, c)
            R(r, cx - w // 2, cy - 3 - k, 1, 1, '#FDBA74' if c != '#F1F5F9' else '#FFFFFF')
        return r, []

    def wall_art(self, i0, z_top, rows, pal, wall='right'):
        r = []
        if wall == 'right':
            x0, y0 = self.P(i0, 0, z_top)
            self.face(r, rows, pal, int(x0), int(y0), +1)
        else:
            x0, y0 = self.P(0, i0, z_top)  # i0 is j here; the sprite runs from the far end (left) toward the corner
            self.face(r, rows, pal, int(x0) - len(rows[0]), int(y0) + len(rows[0]) // 2, -1)
        return r, []

    def kip(self, i, j, pose='wave', flip=False):
        cx, cy = self.P(i + .5, j + .5)
        r = []
        shade(r, cx, cy, 13, 4, .22)
        k = DATA['kip'][pose]
        b = bounds(k)
        dx = cx - (b[0] + b[2]) / 2
        dy = cy - b[3] + 1
        for q in k:
            x = q[0] + dx
            if flip:
                x = 2 * cx - x - q[2]
            R(r, round(x), round(q[1] + dy), q[2], q[3], q[4])
        return r, []


POSTER = (['kkkkkkkkkkkk',
           'kssssssssssk',
           'kssssssyysk.',
           'ksssssssyssk',
           'ksssggsssssk',
           'kssggggssssk',
           'ksgggGggggsk',
           'kgggGGGggggk',
           'kGGGGGGGGGGk',
           'kkkkkkkkkkkk'][:], {'k': '#1E2430', 's': '#93C1FC', 'y': '#FCD34D', 'g': '#16A34A', 'G': '#15803D'})
POSTER = ([row.replace('.', 'k') for row in POSTER[0]], POSTER[1])

CLOCK = (['..wwww..',
          '.wwwwww.',
          'wwwkwwww',
          'wwwkwwww',
          'wwwkkkww',
          'wwwwwwww',
          '.wwwwww.',
          '..wwww..'], {'w': '#F1F5F9', 'k': '#1F2937'})

SHELF_PLANK = None
