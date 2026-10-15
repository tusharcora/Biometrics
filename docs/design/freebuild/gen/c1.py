from cbase import *


# ======================================================================
# C1 · The daily loop
# ======================================================================
def c1():
    # ---- phone A: coins land ----
    r = room(weather='sun', radio=False)
    sv, geo = iso_view(r, label='KIP’s room in the morning: desk, bookshelf, ferns, a floor lamp, beanbag, a cat asleep, and KIP cheering on the rug as coins fly up to the wallet')
    kx, ky = pos(geo, 3.8, 3.8)
    coins = ''
    path = f'<svg aria-hidden="true" width="390" height="400" viewBox="0 0 390 400" style="position: absolute; left: 0; top: -60px; overflow: visible"><path d="M{kx:.0f} {ky + 60 - 64:.0f} C {kx + 30:.0f} {ky - 60:.0f}, 330 120, 338 6" fill="none" stroke="rgba(253,224,71,0.6)" stroke-width="1.5" stroke-dasharray="3 4"></path></svg>'
    for k, (x, y) in enumerate(((kx + 18, ky - 86), (300, 92), (326, 40), (334, 4))):
        coins += f'<span aria-hidden="true" style="position: absolute; left: {x - 8:.0f}px; top: {y - 8:.0f}px">{coin(16 + (k % 2) * 2)}</span>'
    A = header('KIP’s room', 'Tuesday · 07:14', ibtn('back', 'Back to KIP', 'gh'), wallet('360', '360 KIP coins, 20 just added'))
    A += stage(sv, 320, path + coins + say('+20!', kx + 4, ky - 64))
    A += f"""  <div style="display: flex; flex-direction: column; gap: 10px; padding: 8px 16px 0">
    <div role="status" class="card" style="padding: 12px 14px; display: flex; align-items: center; gap: 12px; border-color: rgba(163,230,53,.45)">
      <span style="flex: none">{coin(28)}</span>
      <div class="col" style="flex: 1; gap: 2px"><span style="font-size: 15px; font-weight: 600">Sleep goal hit</span><span class="muted" style="font-size: 13px">7 h 42 m last night · goal 7 h 30 m</span></div>
      <span class="coin" style="font-size: 17px; color: {LIME}">+20</span>
    </div>
    <div class="card" style="padding: 12px 14px; display: flex; flex-direction: column; gap: 8px">
      <div class="row" style="justify-content: space-between">{lbl('Earned today')}<span class="coin" style="font-size: 13px">{coin(12)}25 of 60</span></div>
      {bar(42, '25 of 60 coins today')}
      <div class="col" style="gap: 0">
        <div class="row" style="justify-content: space-between; min-height: 30px"><span class="row" style="gap: 6px; font-size: 13px"><span style="color: {LIME}">{icon('check', 14)}</span>Morning check-in</span><span class="muted" style="font-size: 13px">+5</span></div>
        <div class="row" style="justify-content: space-between; min-height: 30px"><span class="row" style="gap: 6px; font-size: 13px"><span style="color: {LIME}">{icon('check', 14)}</span>Sleep goal</span><span class="muted" style="font-size: 13px">+20</span></div>
        <div class="row" style="justify-content: space-between; min-height: 30px"><span class="row" style="gap: 6px; font-size: 13px"><span class="muted">{icon('steps', 14)}</span>Step goal · 3,120 of 8,000</span><span class="muted" style="font-size: 13px">+15</span></div>
        <div class="row" style="justify-content: space-between; min-height: 30px"><span class="row" style="gap: 6px; font-size: 13px"><span class="muted">{icon('clock', 14)}</span>Weekly recap · ready to read</span><span class="muted" style="font-size: 13px">+10</span></div>
      </div>
    </div>
    <div class="row">{btn('Coin shop', 'df', ico='bag', style='flex: 1')}{btn('Edit room', 'ol', ico='edit', style='flex: 1')}</div>
  </div>
"""
    # ---- phone B: coin shop -> inventory ----
    shop = [('radio', 150, True, True), ('lamp', 120, False, True), ('lava', 120, False, True), ('catbed', 140, False, True), ('fern', 40, False, False), ('duck', 40, False, False)]
    grid = ''.join(it(k, price=p, sel=s, fx=f, extra='height: 100px') for k, p, s, f in shop)
    Bp = header('Coin shop', 'New pieces every Monday', ibtn('back', 'Back', 'gh'), wallet('360'))
    Bp += f"""  <div style="display: flex; flex-direction: column; gap: 10px; padding: 0 16px">
    {tabs(['All', 'Effects', 'Floor', 'Wall', 'On top'], 'All', 'Shop categories')}
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px">{grid}</div>
    <span class="row muted" style="gap: 6px; font-size: 12px"><span style="color: rgb(253,224,71)">{icon('spark', 12)}</span>does something in the room</span>
  </div>
"""
    Bp += sheet(f"""<div class="row" style="gap: 14px; align-items: center">
      <div style="flex: none; width: 96px; height: 84px; border-radius: 12px; background: rgb(14,15,19); display: flex; align-items: center; justify-content: center">{art('radio', 64, 5)}</div>
      <div class="col" style="gap: 4px"><span style="font-family: 'Silkscreen', monospace; font-size: 18px; line-height: 22px">Old radio</span><span class="muted" style="font-size: 13px">Shelf, desk or floor · 1 tile</span><span class="coin" style="font-size: 14px">{coin(13)}150</span></div>
    </div>
    <div class="card" style="padding: 12px; display: flex; gap: 10px; align-items: flex-start; background: rgb(14,15,19)">
      <span style="color: rgb(253,224,71); flex: none">{icon('music', 18)}</span>
      <div class="col" style="gap: 2px">{lbl('Effect', 'rgb(253,224,71)')}<span style="font-size: 14px; line-height: 20px">Plays a quiet lo-fi loop while the room is open. Notes float up.</span></div>
    </div>
    <div class="row" style="justify-content: space-between"><span class="muted" style="font-size: 13px">You have 360 · 210 after</span><span class="tag">Goes to your inventory</span></div>
    <div class="row">{btn('Not now', 'ol', style='flex: 1')}{btn('Get for 150', 'df', style='flex: 1')}</div>
    <span class="muted" style="font-size: 12px; line-height: 16px">Coins come from healthy days only. They can’t be bought.</span>""", 'Old radio')
    # ---- phone C: place it, effect starts ----
    r = room(weather='sun', radio=False, drop=['cactus'])
    Iso_ = r[3]
    g = Iso_.radio(3.15, .02, 40)[0]
    gb = bounds(g)

    def over(I):
        return diamond(I, 3.0, 0, 1.6, .35, 'rgba(163,230,53,0.35)', LIME, z=40) + ghost(g, .9) + handles(gb, LIME, 1)
    sv, geo = iso_view(r, grid=True, over=over, label='Edit mode with the tile grid: the new radio hovers over the wall shelf, which is outlined in lime where it will snap')
    ox, oy, S, _ = geo
    tbx = min(max(8, ox + (gb[0] + gb[2]) / 2 * S - 118), 390 - 252)
    tby = gb[3] * S + 14
    tb = f"""<div role="toolbar" aria-label="Selected: radio" style="position: absolute; left: {tbx:.0f}px; top: {tby:.0f}px; display: flex; gap: 2px; padding: 3px; border-radius: 10px; background: rgb(20,22,27); border: 1px solid rgb(44,47,55)">
      <button class="b gh tb">{icon('flip', 18)}Flip</button><button class="b gh tb">{icon('rotate', 18)}Turn</button><button class="b gh tb">{icon('store', 18)}Store</button><button class="b df tb">{icon('check', 18)}Place</button></div>"""
    C = edit_header('Editing', 'Radio · shelf')
    C += stage(sv, 320, tb)
    # effect preview crop: radio placed, notes floating
    def notes_fx(I):
        e = []
        x, y = I.P(3.4, .1, 48)
        for k, (dx, dy) in enumerate(((6, -10), (14, -20), (2, -26))):
            for q in xs('note', 0, 0):
                e.append([q[0] + x + dx, q[1] + y + dy, q[2], q[3], q[4]])
        return [], e
    rp = room(weather='sun', extra=[('notes', 20, notes_fx)])
    bb, ll, ee, Ip = rp
    cx, cy = Ip.P(3.45, .1, 44)
    mini = crop(bb + ll + ee, cx, cy, 120, 92, 2, label='The radio on the shelf with music notes floating up')
    C += f"""  <div style="display: flex; flex-direction: column; gap: 10px; padding: 8px 16px 0">
    <div class="card" style="padding: 10px; display: flex; gap: 12px; align-items: center">
      <div style="flex: none; width: 120px; height: 92px; border-radius: 8px; overflow: hidden">{mini}</div>
      <div class="col" style="gap: 4px">{lbl('After Place', 'rgb(253,224,71)')}<span style="font-size: 13px; line-height: 18px">The loop starts and notes float up. Sound stays off until you turn it on.</span></div>
    </div>
  </div>
"""
    inv = ''.join([it('radio', '×1', sel=True, w=64, new=True), it('fern', '×1', w=64), it('duck', '×2', w=64), it('cone', '×1', w=64), it('gnome', '×1', w=64)])
    C += drawer(f"""<div class="row" style="justify-content: space-between">{lbl('Inventory · 9 not placed')}<span class="tag">31 / 40 in room</span></div>
    <div style="display: flex; gap: 6px">{inv}</div>""")
    top = steps([(1, 'Earn', 'hit a healthy goal, coins land'), (2, 'Get', 'pick a piece in the coin shop'), (3, 'Place', 'it waits in the inventory; drag it in'), (4, 'Enjoy', 'its effect starts right away')])
    ft = foot('F6 earned coins → F4 inventory → F1 isometric placement → F7 effects.',
              'Hit a healthy goal, coins land in the wallet, get a piece, drag it into the room, and it does something.',
              'Healthy days can start to feel like a job that pays. A daily cap (60), no penalties and no real money keep it light, but it needs testing with real people.',
              'L · coin ledger, earn rules and caps, the coin shop, the inventory drawer, the iso renderer with snap and ghost, 4 effects. Everything else in this row builds on it.')
    cols = [plabel('1 · Coins land', 'sleep goal hit this morning') + phone(A), plabel('2 · Coin shop', 'the radio, 150 coins') + phone(Bp), plabel('3 · Place it', 'snaps to the shelf, then plays') + phone(C)]
    CB['C1'] = ('C1 · The daily loop · recommended', cboard('C1 · The daily loop · recommended', cols, ft, W3, 1080, top))


if __name__ == '__main__':
    c1()
