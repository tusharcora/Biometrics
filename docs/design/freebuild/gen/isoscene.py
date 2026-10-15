import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from px import svg, paths, bounds, R
from iso import Iso, POSTER, CLOCK, HT, HH


def scene(night=False, n=7, m=7, edit=None, hide=(), extra=None):
    """Returns (rects_base, rects_light, rects_em, iso). Objects sorted back to front by depth."""
    I = Iso(n, m)
    base, em = [], []
    I.shell(base, night=night)
    I.n0 = len(base)
    objs = []  # (depth, fn)
    A = objs.append
    # wall things
    A((-10, lambda: I.wall_art(1.0, 50, *POSTER, wall='right')))
    A((-10, lambda: I.wall_art(5.0, 52, *CLOCK, wall='right')))
    # shelf plank on the right wall with a radio and a mini cactus
    def plank():
        r = []
        I.box(r, 3.0, 0, 38, 1.6, .35, 2, '#5B4636', '#4A382B', '#3A2D23')
        return r, []
    A((-9, plank))
    A((-8.9, lambda: I.radio(3.15, .02, 40, night)))
    A((-8.8, lambda: I.plant(3.95, -.2, 'cactus', z=40)))
    # floor things: depth = i + j of the front corner
    A((0, lambda: I.rug(1.4, 2.6, 3.6, 3.0)))
    A((1.0 + .6, lambda: I.bookshelf(5.4, 0.0, 1.0, .6)))
    A((2.0 + 1.1, lambda: I.desk(1.9, 0.15)))
    A((3.2, lambda: I.monitor(2.6, 0.2, 22, night)))
    A((3.25, lambda: I.keyboard(3.0, 0.3, 22)))
    A((3.3, lambda: I.mug(4.05, .55, 22)))
    A((3.3, lambda: I.desk_lamp(2.2, .45, 22, night=night)))
    A((4.0, lambda: I.chair(3.3, 1.35)))
    A((0.6, lambda: I.plant(0.05, 0.05, 'fern')))
    A((6.8, lambda: I.plant(6.1, 0.05, 'monstera')))
    A((5.5, lambda: I.floor_lamp(0.1, 4.4, night)))
    A((7.0, lambda: I.beanbag(0.5, 5.6)))
    A((7.4, lambda: I.plant(0.05, 6.05, 'fern')))
    A((9.4, lambda: I.kip(3.3, 3.3, 'wave')))
    A((10.4, lambda: I.cat_bed(4.7, 5.2)))
    A((10.8, lambda: I.plant(6.1, 4.1, 'fern')))
    A((8.4, lambda: I.cone(1.9, 6.1)))
    if extra:
        for d, f in extra(I):
            A((d, f))
    objs.sort(key=lambda o: o[0])
    for k, (d, f) in enumerate(objs):
        if k in hide:
            continue
        b, e = f()
        base += b
        em += e
    light = []
    if night:
        I.veil(light)
    else:
        I.daylight(light, 1.6, 2.0)
    return base, light, em, I


if __name__ == '__main__':
    out = ''
    for nt in (False, True):
        b, l, e, I = scene(nt)
        out += svg(b + l + e, I.W * 3, I.H * 3, 3, bg='#0A0B0E')
    open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'iso_test.html'), 'w').write('<body style="margin:0;background:#000">' + out + '</body>')
