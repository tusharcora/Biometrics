from cbase import *


# ======================================================================
# C2 · Grow your room
# ======================================================================
def slot(key=None):
    if key:
        return f'<div style="width: 52px; height: 52px; flex: none; border-radius: 8px; background: rgb(14,15,19); border: 1px solid rgb(44,47,55); display: flex; align-items: center; justify-content: center">{art(key, 36)}</div>'
    return f'<div style="width: 52px; height: 52px; flex: none; box-sizing: border-box; border-radius: 8px; border: 1px dashed {LIME}; color: {LIME}; display: flex; align-items: center; justify-content: center">{icon("plus", 18)}</div>'


def c2():
    sizes = [
        (7, False, 'Starter · 7 × 7', '40 pieces · 3 effects', None, None),
        (8, False, 'Bigger · 8 × 8', '60 pieces · 5 effects · longer walls', ('600 coins', 60, '360 of 600'), ('14-day check-in streak', 64, '9 of 14')),
        (9, True, 'Loft · 9 × 9', '90 pieces · 8 effects · second window', ('1,500 coins', 24, '360 of 1,500'), ('Sleep goal badge, level 3', 66, 'level 2 now')),
    ]
    cards = ''
    for n, w2, nm, sub, g1, g2 in sizes:
        r = room(n=n, window2=w2)
        sv, _ = iso_view(r, vw=150, S=.68, vh=126, oy=126 - round(r[3].H * .68), label=f'{nm} room', bg='#14161B')
        if g1 is None:
            right = f'<span class="tag" style="background: rgb(163,230,53); color: rgb(10,11,14); font-weight: 600; align-self: flex-start">Yours</span>'
        else:
            right = ''
            for t, pct, v in (g1, g2):
                right += f'<div class="col" style="gap: 4px"><div class="row" style="justify-content: space-between; gap: 6px"><span style="font-size: 12px">{t}</span><span class="muted" style="font-size: 11px; white-space: nowrap">{v}</span></div>{bar(pct, t + ", " + v)}</div>'
        lock = '' if g1 is None else f'<span class="muted">{icon("lock", 14)}</span>'
        cards += f"""<div class="card" style="padding: 10px; display: flex; gap: 10px; align-items: center{'; opacity: .7' if n == 9 else ''}">
      <div style="flex: none; width: 150px">{sv}</div>
      <div class="col" style="flex: 1; min-width: 0; gap: 8px">
        <div class="row" style="gap: 6px">{lock}<span class="label" style="color: rgb(245,245,244); font-size: 10px">{nm}</span></div>
        <span class="muted" style="font-size: 12px; line-height: 16px">{sub}</span>
        {right}
      </div>
    </div>"""
    A = header('Room sizes', 'Coins and a streak, both', ibtn('back', 'Back', 'gh'), wallet('360'))
    A += f"""  <div style="display: flex; flex-direction: column; gap: 10px; padding: 0 16px">
    {cards}
    <button class="b df dis" aria-disabled="true" style="height: 44px; width: 100%">Grow to 8 × 8</button>
    <span class="muted" style="font-size: 12px; line-height: 16px">Needs 240 more coins and 5 more days in a row. Coins alone never buy space, and a streak alone doesn’t either.</span>
  </div>
"""
    # ---- phone B: the room grew ----
    r = room(n=8, kip=(3.3, 3.3, 'cheer', False, None))

    def over(I):
        s = diamond(I, 7, 0, 1, 8, 'rgba(163,230,53,0.22)', LIME, dash=True) + diamond(I, 0, 7, 7, 1, 'rgba(163,230,53,0.22)', LIME, dash=True)
        s += wallquad(I, 7, 8, 0, I.wall, 'rgba(163,230,53,0.18)', LIME, 'right') + wallquad(I, 7, 8, 0, I.wall, 'rgba(163,230,53,0.18)', LIME, 'left')
        return s
    sv, geo = iso_view(r, S=1.8, over=over, label='The room grew to 8 by 8: a new row of floor tiles along both front edges and a new wall section on each side, outlined in lime; KIP cheers')
    fx, fy = pos(geo, 7.5, 6.5)
    wx, wy = pos(geo, 7.5, 0, 56)
    lx, ly = pos(geo, 0, 7.5, 56)
    labs = (f'<span class="plab" style="left: {fx - 34:.0f}px; top: {fy - 6:.0f}px; background: {LIME}; color: rgb(10,11,14)">NEW FLOOR</span>'
            f'<span class="plab" style="left: {min(wx - 30, 300):.0f}px; top: {wy - 20:.0f}px; background: {LIME}; color: rgb(10,11,14)">NEW WALL</span>'
            f'<span class="plab" style="left: {max(lx - 26, 6):.0f}px; top: {ly - 20:.0f}px; background: {LIME}; color: rgb(10,11,14)">NEW WALL</span>')
    kx, ky = pos(geo, 3.8, 3.8)
    Bp = header('KIP’s room', '8 × 8 · 60 pieces', ibtn('back', 'Back', 'gh'), btn('Edit', 'ol', ico='edit'))
    Bp += stage(sv, round(r[3].H * geo[2]), labs + say('MORE ROOM!', kx + 4, ky - 64))
    Bp += f"""  <div role="dialog" aria-label="Your room grew" style="margin: 10px 12px 0; padding: 16px; border-radius: 16px; background: rgb(20,22,27); border: 1px solid rgb(44,47,55); display: flex; flex-direction: column; gap: 12px">
    {lbl('Unlocked', LIME)}
    <span style="font-family: 'Silkscreen', monospace; font-size: 20px; line-height: 24px">Your room grew</span>
    <span style="font-size: 14px; line-height: 20px; color: rgb(214,215,219)">600 coins and 14 days of check-ins in a row. A row of floor on each side, two new wall sections, and two more effect slots.</span>
    <div class="col" style="gap: 6px">
      <div class="row" style="justify-content: space-between">{lbl('Effect slots')}<span class="muted" style="font-size: 12px">3 of 5 in use</span></div>
      <div class="row" style="gap: 8px">{slot('lava')}{slot('radio')}{slot('catbed')}{slot()}{slot()}</div>
    </div>
    <div class="row">{btn('Place things', 'df', style='flex: 1')}{btn('Later', 'ol', style='flex: 1')}</div>
  </div>
"""
    ft = foot('F5 room sizes · F6 coins · F1 isometric room · F7 effect slots.',
              'Save coins and keep a streak; the room grows a tile row on each side, with new wall space and more effect slots to fill.',
              'Two gates can feel like a paywall made of your own health. A broken streak just before the coins are there stings, so the streak needs grace days.',
              'M on top of C1 · iso tiles repeat, so bigger shells are cheap; per-size caps, a two-gate unlock rule, the unlock card, effect-slot limits.')
    cols = [plabel('Room sizes', 'both gates shown') + phone(A), plabel('Unlock moment', 'new floor, walls and slots') + phone(Bp)]
    CB['C2'] = ('C2 · Grow your room', cboard('C2 · Grow your room', cols, ft, W2, 1010))


if __name__ == '__main__':
    c2()
