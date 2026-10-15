# Shared helpers for the C row ("Combined ideas"): F1's iso art + F4's drawer/toolbar UI.
import sys, os, re, json, html
D = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, D)
from build_rest import *            # F1/F2 helpers: header, phone, btn, ibtn, icon, coin, tile, notes, plabel, toolbar, tabs, edit_header, isogrid, diamond, handles, ghost, wallquad, crop
from px import paths, bounds, fmt, R, E, glow
from isox import IsoX, room, xs, standard
from iso import POSTER, CLOCK

I.update({
    'gift': '<rect x="3" y="8" width="18" height="4" rx="1"></rect><path d="M12 8v13"></path><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"></path><path d="M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"></path>',
    'spark': '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"></path>',
    'send': '<path d="M22 2L11 13"></path><path d="M22 2l-7 20-4-9-9-4z"></path>',
    'arrowr': '<path d="M5 12h14"></path><path d="M13 6l6 6-6 6"></path>',
    'bag': '<path d="M6 7h12l1 14H5z"></path><path d="M9 7a3 3 0 0 1 6 0"></path>',
    'sun': '<circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"></path>',
    'moon': '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"></path>',
    'steps': '<path d="M4 16v-2.4C4 11.5 3 10.5 3 8c0-2.7 1.5-6 4.5-6C9.4 2 10 3.8 10 5.5c0 3.1-2 5.7-2 8.7V16a2 2 0 1 1-4 0z"></path><path d="M20 20v-2.4c0-2.1 1-3.1 1-5.6 0-2.7-1.5-6-4.5-6C14.6 6 14 7.8 14 9.5c0 3.1 2 5.7 2 8.7V20a2 2 0 1 0 4 0z"></path>',
    'leaf': '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10z"></path><path d="M2 21c0-3 1.9-5.4 5.1-6"></path>',
})

LIME = 'rgb(163,230,53)'
W3 = 3 * 390 + 2 * 40
W2 = 2 * 390 + 40


# ---------- iso rendering ----------
def iso_view(r, vw=390, S=None, vh=None, label=None, grid=False, over=None, oy=0, ox=None, bg='#0A0B0E'):
    b, l, e, Iso_ = r
    S = S or min(2, vw / Iso_.W)
    vh = vh or round(Iso_.H * S)
    ox = (vw - Iso_.W * S) / 2 if ox is None else ox
    ov = over(Iso_) if over else ''
    g = isogrid(Iso_) if grid else ''
    s = rsvg(b[:Iso_.n0], vw, vh, S, ox, oy, label=label, over=g + paths(b[Iso_.n0:] + l + e) + ov, bg=bg)
    return s, (ox, oy, S, Iso_)


def pos(geo, i, j, z=0):
    ox, oy, S, Iso_ = geo
    x, y = Iso_.P(i, j, z)
    return ox + x * S, oy + y * S


def stage(svg_, h, extra=''):
    return f'  <div style="position: relative; height: {h}px; flex: none">{svg_}{extra}</div>\n'


def say(text, x, y, bg=None):
    st = f'background: {bg}; ' if bg else ''
    return f'<span class="say" aria-hidden="true" style="{st}left: {round(x)}px; top: {round(y)}px">{text}</span>'


def mark(n, x, y):
    return f'<span class="num" aria-hidden="true" style="position: absolute; left: {round(x) - 10}px; top: {round(y) - 10}px">{n}</span>'


# ---------- iso inventory art ----------
_Ii = IsoX(7)
ART = {
    'fern': lambda: _Ii.plant(0, 0, 'fern')[0],
    'monstera': lambda: _Ii.plant(0, 0, 'monstera')[0],
    'cactus': lambda: _Ii.plant(0, 0, 'cactus')[0],
    'radio': lambda: _Ii.radio(0, 0, 0)[0],
    'cone': lambda: _Ii.cone(0, 0)[0],
    'lamp': lambda: _Ii.floor_lamp(0, 0)[0],
    'catbed': lambda: _Ii.cat_bed(0, 0)[0],
    'beanbag': lambda: _Ii.beanbag(0, 0)[0],
    'mug': lambda: _Ii.mug(0, 0, 0)[0],
    'chair': lambda: _Ii.chair(0, 0)[0],
    'duck': lambda: spr('duck', 0, 10),
    'gnome': lambda: spr('gnome', 0, 10),
    'lava': lambda: spr('lava', 0, 10),
    'pumpkin': lambda: _Ii.spr_at('pumpkin', 0, 0, sh=False),
    'leaves': lambda: _Ii.spr_at('leaves', 0, 0, sh=False),
    'candle': lambda: _Ii.spr_at('candle', 0, 0, sh=False),
    'lantern': lambda: _Ii.spr_at('lantern', 0, 0, sh=False),
    'acorn': lambda: _Ii.spr_at('acorn', 0, 0, sh=False),
    'gift': lambda: _Ii.spr_at('gift', 0, 0, sh=False),
    'medal': lambda: _Ii.spr_at('medal', 0, 0, sh=False),
    'cup': lambda: _Ii.spr_at('cup', 0, 0, sh=False),
    'yarn': lambda: _Ii.spr_at('yarn', 0, 0, sh=False),
}
NAMES = {'fern': 'Fern', 'monstera': 'Monstera', 'cactus': 'Cactus', 'radio': 'Radio', 'cone': 'Cone', 'lamp': 'Floor lamp', 'catbed': 'Cat bed',
         'beanbag': 'Beanbag', 'mug': 'Mug', 'chair': 'Chair', 'duck': 'Duck', 'gnome': 'Gnome', 'lava': 'Lava lamp', 'pumpkin': 'Pumpkin',
         'leaves': 'Leaf pile', 'candle': 'Candle', 'lantern': 'Lantern', 'acorn': 'Golden acorn', 'gift': 'Gift', 'medal': 'Medal', 'cup': 'Cup', 'yarn': 'Yarn'}


def it(key, n=None, sel=False, w=None, dis=False, price=None, name=None, new=False, fx=False, extra=''):
    s = tile(ART[key](), name or NAMES[key], n, sel, w=w, dis=dis, price=price, extra=extra)
    badges = ''
    if new:
        badges += '<span class="n" style="left: 4px; right: auto; background: rgb(163,230,53); color: rgb(10,11,14)">NEW</span>'
    if fx:
        badges += f'<span aria-hidden="true" style="position: absolute; left: 5px; top: 5px; color: rgb(253,224,71)">{icon("spark", 12)}</span>'
    if badges:
        s = s.replace('">', '">' + badges, 1)
    return s


def art(key, box=40, maxs=4, label=None):
    return icon_svg(ART[key](), box, maxs, label)


def wallet(n, aria=None, h=44):
    return f'<button class="b ol coin" aria-label="{aria or f"{n} KIP coins, open coin history"}" style="height: {h}px; padding: 0 12px; font-size: 15px">{coin(16)}{n}</button>'


def drawer(inner, top=''):
    return f"""  <div style="margin-top: auto; border-top: 1px solid rgb(30,33,40); padding: 10px 16px 14px; display: flex; flex-direction: column; gap: 10px; background: rgb(14,15,19); border-radius: 16px 16px 0 0">
    <span aria-hidden="true" style="align-self: center; width: 36px; height: 4px; border-radius: 2px; background: rgb(58,62,72)"></span>
    {top}{inner}
  </div>
"""


def sheet(inner, aria):
    return f"""  <div role="dialog" aria-label="{aria}" style="margin-top: auto; padding: 10px 16px 16px; border-radius: 16px 16px 0 0; background: rgb(20,22,27); border-top: 1px solid rgb(44,47,55); display: flex; flex-direction: column; gap: 12px">
    <span aria-hidden="true" style="align-self: center; width: 36px; height: 4px; border-radius: 2px; background: rgb(58,62,72)"></span>
    {inner}
  </div>
"""


def bar(pct, aria, col=None):
    st = f' style="width: {pct}%; background: {col}"' if col else f' style="width: {pct}%"'
    return f'<div class="bar" role="img" aria-label="{aria}"><i{st}></i></div>'


def lbl(t, col='rgb(245,245,244)'):
    return f'<span class="label" style="color: {col}">{t}</span>'


def foot(combines, loop, risk, build):
    return notes([('COMBINES', combines), ('CORE LOOP', loop), ('RISK', risk), ('BUILD SIZE', build)], cols=4)


def cboard(title, cols, footer, W, H, top=''):
    c = ''.join(f'<div style="display: flex; flex-direction: column; gap: 10px; width: 390px; flex: none">{x}</div>' for x in cols)
    return head(title) + f"""<div style="width: {W}px; height: {H}px; box-sizing: border-box; overflow: hidden; background: rgb(10,11,14); color: rgb(245,245,244); font-family: 'Geist', system-ui, sans-serif; display: flex; flex-direction: column; gap: 16px; padding: 0 0 16px">
{top}<div style="display: flex; gap: 40px; align-items: flex-start">{c}</div>
{footer}
</div>
""" + tail(W, H)


def steps(items):
    """A one-line flow strip: [(n, title, sub)] with arrows between."""
    out = []
    for k, (n, t, s) in enumerate(items):
        out.append(f'<div class="row" style="gap: 10px; flex: 1; min-width: 0; padding: 10px 12px; border-radius: 12px; background: rgb(20,22,27); border: 1px solid rgb(30,33,40)"><span class="num" style="flex: none">{n}</span><div class="col" style="gap: 2px; min-width: 0"><span style="font-size: 14px; font-weight: 600">{t}</span><span class="muted" style="font-size: 12px; line-height: 16px">{s}</span></div></div>')
        if k < len(items) - 1:
            out.append(f'<span aria-hidden="true" style="flex: none; color: rgb(155,157,166)">{icon("arrowr", 18)}</span>')
    return f'<div class="row" style="gap: 8px; align-items: center">{"".join(out)}</div>'


CB = {}
