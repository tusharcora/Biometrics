from cbase import *
from c3 import PURPLE_WALL, WARM_FLOOR, autumn


def maya(extra=(), kip=(3.0, 3.4, 'wave', True, '#A3E635')):
    return room(n=8, wallc=PURPLE_WALL, floor=WARM_FLOOR, drop=['cone', 'mug', 'fern3'], kip=kip,
                extra=autumn(None) + [('lava', 3.33, lambda I: (I.spr_at('lava', 4.1, .7, 22, sh=False), []))] + list(extra))


def c4():
    # ---- phone A: visiting ----
    r = maya()
    sv, geo = iso_view(r, S=1.8, label='Maya’s room, 8 by 8: purple walls, a warm floor, pumpkins and a lantern, a lava lamp on her desk, her lime KIP waving')
    kx, ky = pos(geo, 3.5, 3.9)
    A = header('Maya’s room', '8 × 8 · 44 pieces', ibtn('back', 'Back', 'gh'), ibtn('more', 'More'))
    A += stage(sv, round(r[3].H * 1.8), say('HI THERE!', kx + 4, ky - 58))
    A += f"""  <div style="display: flex; flex-direction: column; gap: 10px; padding: 6px 16px 0">
    <span class="row" style="gap: 6px; color: rgb(155,157,166); font-size: 13px">{icon('eye', 16)}Just looking: you can’t move anything</span>
    <div class="card" style="padding: 14px; display: flex; flex-direction: column; gap: 10px">
      <div class="row" style="justify-content: space-between">{lbl('Cheers')}<span class="muted" style="font-size: 13px">12 this week</span></div>
      {btn('Cheer Maya’s room', 'df', ico='heart', style='width: 100%')}
      <span class="row" style="gap: 6px; font-size: 12px; line-height: 16px; color: rgb(214,215,219)">{coin(12)}You both get +2 coins. One cheer per room a day.</span>
    </div>
    <div class="card" style="padding: 12px 14px; display: flex; align-items: center; gap: 12px">
      <div style="flex: none; width: 44px; height: 44px; border-radius: 8px; background: rgb(14,15,19); display: flex; align-items: center; justify-content: center">{art('gift', 32)}</div>
      <div class="col" style="flex: 1; gap: 2px"><span style="font-size: 14px; font-weight: 600">Send Maya a spare</span><span class="muted" style="font-size: 12px">You have 4 duplicates</span></div>
      {btn('Gift', 'ol', ico='gift')}
    </div>
    {lbl('In her room, not in yours')}
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px">{it('lava', fx=True)}{it('lantern', fx=True)}{it('pumpkin')}{it('candle')}</div>
    <span class="muted" style="font-size: 12px">Tap one to see its coin price or how it’s earned.</span>
  </div>
"""
    # ---- phone B: gift sheet ----
    rg = maya(extra=[('gift', 9.0, lambda I: (I.spr_at('gift', 5.2, 3.0, k=2), []))], kip=(3.0, 3.4, 'cheer', True, '#A3E635'))
    bb, ll, ee, Ig = rg
    gx, gy = Ig.P(4.7, 3.2)
    mini = crop(bb + ll + ee, gx, gy - 10, 124, 96, 2, label='A wrapped gift box waiting on Maya’s floor, her KIP cheering next to it')
    tiles = ''.join([it('duck', '×2', sel=True), it('fern', '×3'), it('pumpkin', '×4'), it('mug', '×3'),
                     it('radio', '×1', dis=True), it('lava', '×1', dis=True), it('catbed', '×1', dis=True), it('gnome', '×1', dis=True)])
    msgs = ''.join(f'<button class="b {"df" if k == 1 else "ol"}" aria-pressed="{"true" if k == 1 else "false"}" style="height: 40px; padding: 0 10px; font-size: 13px">{m}</button>' for k, m in enumerate(['For your desk', 'Cosy!', 'Thought of you']))
    Bp = header('Gift to Maya', 'From your spares', ibtn('x', 'Close', 'gh'), '')
    Bp += f"""  <div style="display: flex; flex-direction: column; gap: 10px; padding: 0 16px">
    <span class="muted" style="font-size: 13px; line-height: 18px">Only spares can be gifted: you always keep at least one of everything.</span>
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px">{tiles}</div>
    <div class="row" style="justify-content: space-between; min-height: 32px"><span style="font-size: 14px; font-weight: 600">Duck</span><span class="muted" style="font-size: 13px">you keep 1</span></div>
    {lbl('Add a note')}
    <div role="group" aria-label="Note" class="row" style="gap: 6px">{msgs}</div>
    {btn('Send gift', 'df', ico='gift', style='width: 100%')}
    <div class="card" style="padding: 10px; display: flex; gap: 12px; align-items: center">
      <div style="flex: none; width: 124px; height: 96px; border-radius: 8px; overflow: hidden">{mini}</div>
      <div class="col" style="gap: 4px">{lbl('What Maya sees')}<span style="font-size: 13px; line-height: 18px">A gift box on her floor. She taps it and the duck goes to her inventory.</span></div>
    </div>
    <span class="muted" style="font-size: 12px; line-height: 16px">Gifts don’t earn coins, so nobody farms them. Notes are picked, not typed.</span>
  </div>
"""
    ft = foot('F8 buddy visit · F6 cheer coins · F4 inventory duplicates · F1 isometric room.',
              'Visit a buddy’s room, cheer it (+2 coins each), and pass on a piece you own twice.',
              'Coin cheers invite cheer-swapping: cap coin cheers at 5 a day and one per room per day. Gifts need block and mute from day one.',
              'S–M after C1 · read-only room view, a cheer that pays both sides, gifting duplicates, the gift-box piece.')
    cols = [plabel('Visiting Maya', 'read-only, cheer it') + phone(A), plabel('Gift a spare', 'duplicates only') + phone(Bp)]
    CB['C4'] = ('C4 · Visit & gift', cboard('C4 · Visit & gift', cols, ft, W2, 1010))


if __name__ == '__main__':
    c4()
