from cbase import *

PURPLE_WALL = '#4A3B5C'
WARM_FLOOR = ('#6B4F3A', '#735641')


def autumn(I, night=False, lantern=True):
    """Warm pieces added to the standard room."""
    out = [('pk1', 7.2, lambda I: (I.spr_at('pumpkin', 1.2, 6.0), [])),
           ('pk2', 7.9, lambda I: (I.spr_at('pumpkin', 1.9, 6.0), [])),
           ('leaves', 8.6, lambda I: (I.spr_at('leaves', 2.9, 5.7), [])),
           ('candle', 3.32, lambda I: (I.spr_at('candle', 4.2, .75, 22, sh=False), []))]
    if lantern:
        out.append(('lantern', 9.0, lambda I: I.glow_piece('lantern', 5.4, 3.6, 0, night, big=.8)))
    return out


def c3():
    # ---- phone A: the brief ----
    banner = ''.join(f'<g transform="translate({x} {y})">{paths(spr(n, 0, 9))}</g>' for n, x, y in (('leaves', 3, -1), ('pumpkin', 14, 1), ('leaves', 28, 0), ('candle', 40, 1), ('leaves', 52, -2), ('pumpkin', 64, 1), ('leaves', 78, 0)))
    rew = [('coin', 'Enter', '+30 coins, once', None),
           ('lantern', 'Harvest lantern', 'This week only · coin shop · 80', 'Limited'),
           ('acorn', 'Golden acorn', 'Trophy for the most-cheered room · glows at night', 'Prize')]
    rows = ''
    for k, t, s, tag in rew:
        a = coin(30) if k == 'coin' else art(k, 36)
        tg = f'<span class="tag">{tag}</span>' if tag else f'<span class="coin" style="color: {LIME}">+30</span>'
        rows += f'<div class="row" style="gap: 12px; padding: 8px 0; border-bottom: 1px solid rgb(30,33,40)"><div style="flex: none; width: 44px; height: 44px; border-radius: 8px; background: rgb(14,15,19); display: flex; align-items: center; justify-content: center">{a}</div><div class="col" style="flex: 1; gap: 2px"><span style="font-size: 14px; font-weight: 600">{t}</span><span class="muted" style="font-size: 12px; line-height: 16px">{s}</span></div>{tg}</div>'
    A = header('Room challenge', 'Buddies only · 3 days left', ibtn('back', 'Back', 'gh'), wallet('360'))
    A += f"""  <div style="display: flex; flex-direction: column; gap: 12px; padding: 0 16px">
    <div class="card" style="padding: 0; overflow: hidden">
      <svg aria-hidden="true" width="358" height="44" viewBox="0 0 89.5 11" shape-rendering="crispEdges" style="display: block; background: rgb(42,24,16)">{banner}</svg>
      <div style="padding: 14px; display: flex; flex-direction: column; gap: 8px">
        {lbl('This week’s theme', 'rgb(251,146,60)')}
        <span style="font-family: 'Silkscreen', monospace; font-size: 22px; line-height: 26px">Cosy autumn</span>
        <span class="muted" style="font-size: 13px; line-height: 18px">Use 3 or more warm pieces. Buddies cheer the rooms they like; the most-cheered room wins on Sunday.</span>
        <div class="row" style="gap: 6px"><span class="tag">5 buddies in</span><span class="tag">Ends Sunday 20:00</span></div>
      </div>
    </div>
    {lbl('Rewards')}
    <div class="col">{rows}</div>
    {btn('Start my entry', 'df', style='width: 100%')}
    <span class="muted" style="font-size: 12px; line-height: 16px">Your entry is a snapshot of your room on Sunday. Build as usual until then.</span>
  </div>
"""
    # ---- phone B: build it ----
    r = room(drop=['cone', 'beanbag', 'mug'], extra=autumn(None, lantern=False))
    Iso_ = r[3]
    g = Iso_.spr_at('lantern', 5.6, 2.4)
    gb = bounds([q for q in g if not q[4].startswith('rgba')])

    def over(I):
        return diamond(I, 5.1, 1.9, 1, 1, 'rgba(163,230,53,0.32)', LIME) + ghost(g, .9) + handles(gb, LIME, 1)
    sv, geo = iso_view(r, grid=True, over=over, label='Edit mode: pumpkins, a leaf pile and a candle are placed; a lantern from the inventory hovers over an empty tile outlined in lime')
    lx, ly = pos(geo, 3.8, 3.8)
    Bp = edit_header('Entry', 'Cosy autumn')
    Bp += stage(sv, 320, say('SO COSY', lx + 4, ly - 64))
    Bp += f"""  <div style="padding: 6px 16px 0">
    <div class="card" style="padding: 12px 14px; display: flex; flex-direction: column; gap: 8px">
      <div class="row" style="justify-content: space-between">{lbl('Warm pieces')}<span style="font-size: 13px; font-variant-numeric: tabular-nums">2 of 3</span></div>
      {bar(66, '2 of 3 warm pieces', 'rgb(251,146,60)')}
      <div class="row" style="gap: 6px; flex-wrap: wrap"><span class="tag">{icon('check', 12)}Pumpkins</span><span class="tag">{icon('check', 12)}Leaf pile</span><span class="tag" style="border: 1px dashed rgb(251,146,60); background: transparent">Lantern?</span></div>
    </div>
  </div>
"""
    inv = ''.join([it('lantern', '×1', sel=True, new=True, fx=True), it('pumpkin', '×2'), it('candle', '×1'), it('leaves', '×1')])
    Bp += drawer(f"""<div class="row" style="justify-content: space-between">{lbl('Inventory')}<span class="tag">Autumn · 5</span></div>
    {tabs(['All', 'Autumn', 'Floor', 'Wall', 'On top'], 'Autumn', 'Inventory categories')}
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px">{inv}</div>""")
    # ---- phone C: results ----
    def maya_extra():
        return autumn(None, night=True) + [('acorn', 9.6, lambda I: I.glow_piece('acorn', 6.5, 4.4, 0, True, big=1.6, k=2))]
    rm = room(night=True, wallc=PURPLE_WALL, floor=WARM_FLOOR, drop=['cone', 'mug', 'fern3'], kip=(2.6, 3.4, 'wave', True, '#A3E635'), extra=maya_extra())
    win, wgeo = iso_view(rm, vw=358, S=1.7, label='Maya’s winning room at night: purple walls, pumpkins, a glowing lantern and the golden acorn trophy glowing on the floor, her lime KIP waving')
    ax, ay = pos(wgeo, 6.5, 4.4)

    def thumb(nm, cfg):
        rr = room(**cfg)
        s, _ = iso_view(rr, vw=108, S=.6, vh=100, oy=100 - round(rr[3].H * .6), label=f'{nm}’s entry')
        return s
    ents = [('Jonah', 21, dict(wallc='#3B4A3A', floor=('#4A382B', '#523E2F'), drop=['cone', 'beanbag'], kip=(3.3, 3.3, 'rest', False, '#7DD3FC'), extra=autumn(None))),
            ('You', 18, dict(drop=['cone', 'beanbag', 'mug'], extra=autumn(None))),
            ('Priya', 12, dict(night=True, wallc='#5A3A3A', drop=['cone'], kip=(3.3, 3.3, 'rest', False, '#C4B5FD'), extra=autumn(None, night=True)))]
    et = ''.join(f'<div class="col" style="gap: 4px; width: 108px"><div style="border-radius: 6px; overflow: hidden; width: 108px; height: 100px; background: rgb(14,15,19)">{thumb(n, c)}</div><div class="row" style="justify-content: space-between"><span style="font-size: 13px; font-weight: 600">{n}</span><span class="row" style="gap: 4px; font-size: 12px; color: rgb(214,215,219)">{icon("heart", 13)}{v}</span></div></div>' for n, v, c in ents)
    C = header('Cosy autumn', 'Results · Sunday', ibtn('back', 'Back', 'gh'), '')
    C += f"""  <div style="display: flex; flex-direction: column; gap: 12px; padding: 0 16px">
    <div class="card" style="padding: 0; overflow: hidden">
      <div style="position: relative">{win}<span class="plab" style="left: {ax - 92:.0f}px; top: {ay + 6:.0f}px; background: rgb(253,224,71); color: rgb(10,11,14)">GOLDEN ACORN</span></div>
      <div class="row" style="padding: 12px 14px; justify-content: space-between"><div class="col" style="gap: 2px"><span style="font-size: 15px; font-weight: 600">Maya’s room won</span><span class="muted" style="font-size: 12px">The acorn glows on her floor at night</span></div><span class="row" style="gap: 4px; font-size: 13px">{icon('heart', 14)}34</span></div>
    </div>
    <div class="row" style="gap: 17px">{et}</div>
    <div class="card" style="padding: 12px 14px; display: flex; align-items: center; gap: 12px; border-color: rgba(163,230,53,.45)">
      <span style="flex: none">{coin(24)}</span>
      <div class="col" style="flex: 1; gap: 2px"><span style="font-size: 14px; font-weight: 600">You entered</span><span class="muted" style="font-size: 12px">The lantern stays in your room</span></div>
      <span class="coin" style="color: {LIME}">+30</span>
    </div>
  </div>
"""
    ft = foot('F8 weekly theme and cheers · F6 entry coins · F4 inventory · F1 isometric build · F7 glowing trophy.',
              'A weekly brief, build it from your inventory, buddies cheer, everyone who enters gets coins, and the top room gets a trophy that glows.',
              'Needs enough buddies: two entries feel empty or awkward. Under 3 entries, skip the ranking and give everyone the entry reward.',
              'M · weekly theme config, entry snapshots, cheer tally, a limited shop slot, the trophy piece and its glow.')
    cols = [plabel('The brief', 'rewards up front') + phone(A), plabel('Build it', 'from the Autumn tab') + phone(Bp), plabel('Results', 'Sunday night') + phone(C)]
    CB['C3'] = ('C3 · Weekly theme challenge', cboard('C3 · Weekly theme challenge', cols, ft, W3, 1010))


if __name__ == '__main__':
    c3()
