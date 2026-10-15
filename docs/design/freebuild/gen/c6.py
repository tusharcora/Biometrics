from cbase import *


def notes_on_radio(I):
    e = []
    x, y = I.P(3.4, .1, 48)
    for dx, dy in ((6, -10), (14, -20), (2, -26)):
        for q in xs('note', 0, 0):
            e.append([q[0] + x + dx, q[1] + y + dy, q[2], q[3], q[4]])
    return [], e


def c6():
    # ---- phone A: KIP page with the room as backdrop ----
    r = room(weather='sun', drop=['cone'], kip=(4.4, 1.3, 'rest', True, None), extra=[('notes', 20, notes_on_radio)])

    def path(I):
        pts = [I.P(2.4, 4.6), I.P(4.6, 3.4), I.P(4.9, 1.8)]
        d = 'M' + ' L'.join(f'{fmt(x)} {fmt(y)}' for x, y in pts)
        return f'<path d="{d}" fill="none" stroke="rgba(245,245,244,0.6)" stroke-width="1" stroke-dasharray="2 3" vector-effect="non-scaling-stroke"></path>'
    sv, geo = iso_view(r, vh=300, oy=-14, over=path, label='KIP’s room behind the chat: the radio on the wall shelf plays notes, and KIP has walked along a dotted path from the rug to stand under it')
    rx, ry = pos(geo, 3.4, 0, 62)
    fx, fy = pos(geo, 6.6, 4.6, 36)
    kx, ky = pos(geo, 4.9, 1.8)
    labs = (f'<span class="plab" style="left: {rx - 10:.0f}px; top: {ry - 14:.0f}px">RADIO</span>'
            + say('TUNES ON', kx + 14, ky - 70))
    right = '<div class="row" style="gap: 8px">' + wallet('360') + ibtn('edit', 'Edit room') + '</div>'
    A = header('KIP', 'Your coach', '', right)
    A += stage(sv, 300, labs)
    A += f"""  <div style="display: flex; flex-direction: column; gap: 10px; padding: 6px 16px 0">
    <div style="align-self: flex-end; max-width: 260px; padding: 10px 12px; border-radius: 12px; background: rgb(245,245,244); color: rgb(10,11,14); font-size: 14px; line-height: 20px">How did I sleep?</div>
    <div class="card" style="align-self: flex-start; max-width: 300px; padding: 10px 12px; font-size: 14px; line-height: 20px">7 h 42 m, your best this week. Deep sleep was 1 h 31 m, about the same as your usual.</div>
    <span class="row muted" style="gap: 6px; font-size: 12px">{icon('clock', 13)}Between answers KIP wanders to the radio or the fern.</span>
  </div>
  <div style="margin-top: auto; border-top: 1px solid rgb(30,33,40); padding: 8px 12px 12px; display: flex; gap: 8px; align-items: center">
    <label for="ask-kip" style="position: absolute; width: 1px; height: 1px; overflow: hidden">Ask KIP</label>
    <input id="ask-kip" type="text" placeholder="Ask KIP" style="flex: 1; height: 44px; box-sizing: border-box; padding: 0 12px; border-radius: 8px; border: 1px solid rgb(44,47,55); background: transparent; color: rgb(245,245,244); font-family: 'Geist', system-ui, sans-serif; font-size: 14px">
    {ibtn('send', 'Send', 'df')}
  </div>
"""
    # ---- phone B: long-press -> inventory drawer ----
    r2 = room(weather='sun', drop=['cone'], kip=(1.6, 3.6, 'think', False, None))
    I2 = r2[3]
    sel = I2.plant(6.1, 4.1, 'fern')[0]
    sb = bounds([q for q in sel if not q[4].startswith('rgba')])
    sv2, geo2 = iso_view(r2, vh=300, oy=-14, grid=True, over=lambda I: handles(sb, LIME, 1) + diamond(I, 6.1, 4.1, 1, 1, 'rgba(163,230,53,0.25)', LIME), label='Edit mode over the KIP page: the tile grid is on and the fern by the front wall is selected')
    ox2, oy2, S2, _ = geo2
    tbx = min(max(8, ox2 + (sb[0] + sb[2]) / 2 * S2 - 150), 390 - 300)
    tb = f"""<div role="toolbar" aria-label="Selected: fern" style="position: absolute; left: {tbx:.0f}px; top: {oy2 + sb[1] * S2 - 62:.0f}px; display: flex; gap: 2px; padding: 3px; border-radius: 10px; background: rgb(20,22,27); border: 1px solid rgb(44,47,55)">
      <button class="b gh tb">{icon('move', 18)}Move</button><button class="b gh tb">{icon('flip', 18)}Flip</button><button class="b gh tb">{icon('rotate', 18)}Turn</button><button class="b gh tb">{icon('copy', 18)}Another</button><button class="b gh tb">{icon('store', 18)}Store</button></div>"""
    Bp = edit_header('Editing', 'Chat waits below')
    Bp += stage(sv2, 300, tb)
    Bp += f'  <div class="row" style="padding: 4px 16px; justify-content: space-between"><span class="muted" style="font-size: 13px">Fern · 1 tile · no effect</span><span class="tag">Effects 3 of 5</span></div>\n'
    inv = ''.join([it('lantern', '×1', fx=True), it('lava', '×1', fx=True), it('fern', '×2', sel=True), it('duck', '×2'), it('pumpkin', '×4'), it('gnome', '×1'), it('cone', '×1'), it('mug', '×3')])
    Bp += drawer(f"""<div class="row" style="justify-content: space-between">{lbl('Inventory · 9 not placed')}{btn('Coin shop', 'ol', h=36, ico='bag', style='font-size: 13px')}</div>
    {tabs(['All', 'Effects', 'Floor', 'Wall', 'On top'], 'All', 'Inventory categories')}
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px">{inv}</div>""")
    ft = foot('F1 isometric room · F4 inventory drawer · F6 wallet in the header · F7 effect pieces KIP uses.',
              'Chat with KIP inside its own room; between answers it walks to the radio or waters the fern; long-press the room to decorate without leaving the coach.',
              'Motion behind a chat pulls eyes from the answers. KIP should only wander while idle, stop when you type, and respect reduced motion.',
              'M after C1 · the room as the KIP page backdrop, idle walk paths on the tile grid to effect pieces, long-press into edit mode.')
    cols = [plabel('KIP page', 'the room is the backdrop') + phone(A), plabel('Long-press the room', 'drawer over the chat') + phone(Bp)]
    CB['C6'] = ('C6 · KIP lives there', cboard('C6 · KIP lives there', cols, ft, W2, 1010))


if __name__ == '__main__':
    c6()
