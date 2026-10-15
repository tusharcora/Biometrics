from cbase import *

STARTER_DROP = ['poster', 'clock', 'plank', 'radio', 'cactus', 'bookshelf', 'mug', 'desklamp', 'monstera', 'floorlamp', 'beanbag', 'fern2', 'catbed', 'fern3', 'cone']


def c7():
    # ---- phone A: day 1 ----
    r = room(drop=STARTER_DROP, kip=(3.3, 3.3, 'wave', False, None))
    sv, geo = iso_view(r, label='The starter room: bare walls with one window, a desk with a monitor, a chair, a rug, one fern, and KIP waving')
    kx, ky = pos(geo, 3.8, 3.8)
    A = header('KIP’s room', 'Starter · 6 pieces', ibtn('back', 'Back', 'gh'), wallet('5', '5 KIP coins'))
    A += stage(sv, 320, say('WELCOME HOME!', kx + 4, ky - 64))
    A += f"""  <div style="display: flex; flex-direction: column; gap: 10px; padding: 8px 16px 0">
    <span style="font-size: 14px; line-height: 20px; color: rgb(214,215,219)">This is KIP’s room. Healthy days earn coins, and coins turn into things for the room.</span>
    <div role="status" class="card" style="padding: 12px 14px; display: flex; align-items: center; gap: 12px; border-color: rgba(163,230,53,.45)">
      <span style="flex: none">{coin(26)}</span>
      <div class="col" style="flex: 1; gap: 2px"><span style="font-size: 14px; font-weight: 600">First check-in</span><span class="muted" style="font-size: 12px">Your first coins</span></div>
      <span class="coin" style="color: {LIME}">+5</span>
    </div>
    <div class="card" style="padding: 12px 14px; display: flex; align-items: center; gap: 12px">
      <div style="flex: none; width: 40px; height: 40px; border-radius: 8px; background: rgb(14,15,19); display: flex; align-items: center; justify-content: center">{art('lantern', 30)}</div>
      <div class="col" style="flex: 1; gap: 2px"><span style="font-size: 14px; font-weight: 600">A welcome lantern</span><span class="muted" style="font-size: 12px">Free · in your inventory · glows at night</span></div>
    </div>
    {btn('Place the lantern', 'df', style='width: 100%')}
  </div>
"""
    # ---- phone B: guided first placement ----
    r2 = room(drop=STARTER_DROP, kip=(1.8, 4.6, 'point', False, None))
    I2 = r2[3]
    g = I2.spr_at('lantern', 5.0, 3.0, k=2)
    gb = bounds([q for q in g if not q[4].startswith('rgba')])

    def over(I):
        dim = f'<rect x="-20" y="-20" width="{I.W + 40}" height="{I.H + 40}" fill="rgba(10,11,14,0.45)"></rect>'
        return dim + diamond(I, 4.5, 2.5, 1, 1, 'rgba(163,230,53,0.4)', LIME) + ghost(g, .95)
    sv2, geo2 = iso_view(r2, grid=True, over=over, label='Guided placement: the room is dimmed except a lime target tile; the lantern is being dragged toward it from the inventory')
    tx, ty = pos(geo2, 5.0, 3.0)
    trail = f'<svg aria-hidden="true" width="390" height="760" style="position: absolute; left: 0; top: 0; overflow: visible"><path d="M66 610 C 60 460, {tx - 40:.0f} {ty + 120:.0f}, {tx:.0f} {ty + 8:.0f}" fill="none" stroke="{LIME}" stroke-width="1.5" stroke-dasharray="4 4"></path><circle cx="{tx:.0f}" cy="{ty - 8:.0f}" r="16" fill="none" stroke="{LIME}" stroke-width="2"></circle></svg>'
    ring = f'<svg aria-hidden="true" width="390" height="320" style="position: absolute; left: 0; top: 0"><circle cx="{tx:.0f}" cy="{ty - 10:.0f}" r="18" fill="none" stroke="{LIME}" stroke-width="2"></circle><circle cx="{tx:.0f}" cy="{ty - 10:.0f}" r="26" fill="none" stroke="rgba(163,230,53,0.4)" stroke-width="1.5"></circle></svg>'
    coach = f"""<div role="note" style="margin: 4px 16px 0; padding: 12px 14px; border-radius: 12px; background: rgb(245,245,244); color: rgb(10,11,14); display: flex; flex-direction: column; gap: 4px">
      <span class="label" style="color: rgb(64,68,78)">Step 1 of 3</span>
      <span style="font-size: 14px; line-height: 20px; font-weight: 600">Drag the lantern onto the lime tile. It snaps to the grid.</span>
      <span style="font-size: 12px; line-height: 16px; color: rgb(64,68,78)">Next: turn it, then tap Done.</span>
    </div>"""
    Bp = header('Your first piece', 'Takes 10 seconds', '', btn('Skip', 'gh'))
    Bp += stage(sv2, 320, ring)
    Bp += coach
    Bp += f"""  <div class="row" style="padding: 14px 16px 0; gap: 8px">
    <span class="num">1</span><span style="font-size: 13px">Drag</span><span class="muted">{icon('arrowr', 14)}</span>
    <span class="num" style="background: rgb(44,47,55); color: rgb(214,215,219)">2</span><span class="muted" style="font-size: 13px">Turn</span><span class="muted">{icon('arrowr', 14)}</span>
    <span class="num" style="background: rgb(44,47,55); color: rgb(214,215,219)">3</span><span class="muted" style="font-size: 13px">Done</span>
  </div>
"""
    Bp += drawer(f"""<div class="row" style="justify-content: space-between">{lbl('Inventory · 1')}<span class="tag">7 / 40 in room</span></div>
    <div class="row" style="gap: 6px">{it('lantern', '×1', sel=True, new=True, fx=True, w=72)}<div style="flex: 1; height: 84px; box-sizing: border-box; border-radius: 8px; border: 1px dashed rgb(44,47,55); display: flex; align-items: center; justify-content: center; padding: 0 12px"><span class="muted" style="font-size: 12px; line-height: 16px; text-align: center">More pieces arrive from the coin shop</span></div></div>""")
    Bp = Bp.replace('<div class="ph" style="', '<div class="ph" style="', 1)
    # ---- phone C: first-week list + expansion teaser ----
    items = [(True, 'First check-in', '+5'), (True, 'Place your first piece', '+10'), (True, 'Hit your sleep goal', '+20'), (True, 'Get a fern in the coin shop', '−40'),
             (False, 'Cheer a buddy’s room', '+2'), (False, 'Read your first weekly recap', '+10'), (False, '7 check-ins in a row', '+25')]
    rows = ''.join(f'<div class="row" style="min-height: 34px; gap: 10px; border-bottom: 1px solid rgb(30,33,40)"><span style="flex: none; width: 20px; height: 20px; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; {"background: rgb(163,230,53); color: rgb(10,11,14)" if d else "border: 1px solid rgb(58,62,72)"}">{icon("check", 14) if d else ""}</span><span style="flex: 1; font-size: 13px; {"color: rgb(155,157,166); text-decoration: line-through" if d else ""}">{t}</span><span class="coin" style="font-size: 13px; color: {"rgb(155,157,166)" if v.startswith("−") else LIME}">{v}</span></div>' for d, t, v in items)
    r3 = room(n=8, drop=['poster', 'clock', 'plank', 'radio', 'cactus', 'bookshelf', 'mug', 'monstera', 'floorlamp', 'beanbag', 'fern2', 'catbed', 'cone'],
              kip=(3.3, 3.3, 'rest', False, None), extra=[('lantern', 9.0, lambda I: I.glow_piece('lantern', 5.0, 3.0, k=2))])

    def lock(I):
        return (diamond(I, 7, 0, 1, 8, 'rgba(10,11,14,0.65)', LIME, dash=True) + diamond(I, 0, 7, 7, 1, 'rgba(10,11,14,0.65)', LIME, dash=True))
    sv3, geo3 = iso_view(r3, vw=150, S=.74, vh=140, oy=140 - round(r3[3].H * .74), over=lock, bg='#14161B', label='Your room with a locked outer row of tiles, dashed in lime: the 8 by 8 size ahead')
    C = header('First week', 'Day 4 of 7', ibtn('back', 'Back', 'gh'), wallet('85'))
    C += f"""  <div style="display: flex; flex-direction: column; gap: 10px; padding: 0 16px">
    <div class="row" style="justify-content: space-between">{lbl('4 of 7 done')}<span class="muted" style="font-size: 12px">one-time rewards</span></div>
    {bar(57, '4 of 7 done')}
    <div class="col">{rows}</div>
    <div class="card" style="padding: 10px; display: flex; gap: 10px; align-items: center">
      <div style="flex: none; width: 150px">{sv3}</div>
      <div class="col" style="gap: 6px; min-width: 0">
        <span class="row" style="gap: 6px"><span class="muted">{icon('lock', 14)}</span>{lbl('Next: 8 × 8')}</span>
        <span class="muted" style="font-size: 12px; line-height: 16px">600 coins and a 14-day check-in streak. The dashed row is yours then.</span>
        {bar(14, '85 of 600 coins')}
        <span class="muted" style="font-size: 11px">85 of 600 · 4 of 14 days</span>
      </div>
    </div>
  </div>
"""
    ft = foot('F1 isometric placement with the ghost and grid · F4 inventory · F5 expansion teaser · F6 first coins.',
              'Day 1 check-in pays the first coins and a free lantern; one guided drag teaches the grid; a 7-day list earns a first shop piece and shows the bigger room ahead.',
              'Too much tutorial on day 1 delays the health part of the app. Keep it to one guided drag, make it skippable, and never block the rest of the app.',
              'S–M after C1 · a starter room preset, a coach mark for one drag, the first-week list with one-time rewards, the locked-row overlay.')
    cols = [plabel('Day 1', 'starter room, first coins') + phone(A), plabel('First placement', 'guided drag onto the grid') + phone(Bp), plabel('Day 4', 'first-week list, bigger room teased') + phone(C)]
    CB['C7'] = ('C7 · First week', cboard('C7 · First week', cols, ft, W3, 1010))


if __name__ == '__main__':
    c7()
