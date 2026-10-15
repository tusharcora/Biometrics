import sys, os
D = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, D)
from px import svg
from isox import room
out = ''
cfg = [dict(), dict(weather='rain'), dict(weather='cloud'), dict(night=True),
       dict(n=8, extra=[('g', 11, lambda I: I.plantg(7.0, 6.0, 'fern', .3)), ('g2', 11, lambda I: I.plantg(5.0, 6.8, 'fern', 0)), ('t', -7, lambda I: I.trophy_shelf(4.3, 36, ['medal', 'cup', 'medal', 'acorn']))]),
       dict(n=9, window2=True, wallc='#4A3B5C', floor=('#6B4F3A', '#735641'), kip=(4, 4, 'cheer', False, '#A3E635'))]
for c in cfg:
    b, l, e, I = room(**c)
    out += svg(b + l + e, I.W * 2, I.H * 2, 2, bg='#0A0B0E')
open(os.path.join(D, 't1.html'), 'w').write('<body style="margin:0;background:#000;display:flex;flex-wrap:wrap;width:1400px">' + out + '</body>')
