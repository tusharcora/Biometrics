from cbase import *


def living(I, good=True, n=8):
    out = [('shelf', -7, lambda I: I.trophy_shelf(5.0, 34, ['medal', 'cup', 'medal', 'medal'][:4])),
           ('grow', 10.8, lambda I: I.plantg(6.1, 4.1, 'fern', .55))]
    if good:
        out += [('cat', 10.6, lambda I: I.cat_play(4.8, 5.4)), ('yarn', 10.2, lambda I: (I.spr_at('yarn', 4.6, 6.6), []))]
    else:
        out += [('catbed', 10.4, lambda I: I.cat_bed(4.7, 5.2)),
                ('zz', 10.5, lambda I: (I.spr_at('zz', 5.6, 5.3, 14, sh=False), []))]
    return out


def c5():
    # ---- phone A: the living room, labelled ----
    r = room(n=8, weather='sun', drop=['catbed', 'fern3', 'cone', 'floorlamp'], extra=living(None, True))
    sv, geo = iso_view(r, S=1.8, label='KIP’s 8 by 8 room on a good day: sun in the window, a growing fern, a ginger cat playing with yarn, and a shelf of four award pieces on the left wall')
    m = [(1, pos(geo, 0, 2.6, 60)), (2, pos(geo, 6.6, 4.6, 26)), (3, pos(geo, 5.3, 5.9, 26)), (4, pos(geo, 0, 6.0, 52))]
    marks = ''.join(mark(n, x, y) for n, (x, y) in m)
    leg = [(1, 'sun', 'Window · recovery', 'Recovered 78% today: sun. Low days bring clouds or rain.'),
           (2, 'leaf', 'Fern · sleep-goal streak', 'Grows a stage every 7 nights at your goal. Stage 3 of 5.'),
           (3, 'steps', 'Cat · steps', '8,400 steps today, so it’s playing. On quiet days it naps.'),
           (4, 'trophy', 'Shelf · badges', 'One award piece per badge you earn. 4 so far.')]
    el = ''.join(f'<div class="row" style="align-items: flex-start; gap: 10px"><span class="num" style="flex: none">{n}</span><div class="col" style="gap: 2px"><span class="row" style="gap: 6px; font-size: 14px; font-weight: 600"><span class="muted">{icon(ic, 14)}</span>{t}</span><span class="muted" style="font-size: 13px; line-height: 18px">{d}</span></div></div>' for n, ic, t, d in leg)
    A = header('KIP’s room', '8 × 8 · grown in week 3', ibtn('back', 'Back', 'gh'), btn('Edit', 'ol', ico='edit'))
    A += stage(sv, round(r[3].H * 1.8), marks)
    A += f'  <div style="display: flex; flex-direction: column; gap: 12px; padding: 8px 16px 0">{el}</div>\n'
    A += '  <div style="margin-top: auto; padding: 0 16px 16px"><div class="card" style="padding: 12px"><span class="muted" style="font-size: 12px; line-height: 16px">The room mirrors your data. It never tells you what to do, and nothing breaks: plants pause, they never wilt.</span></div></div>\n'
    # ---- phone B: low day vs good day ----
    def day(good):
        rr = room(n=7, weather='sun' if good else 'rain', drop=['catbed', 'fern3', 'cone', 'floorlamp'] + ([] if good else ['kip']),
                  kip=None if good else (3.3, 3.3, 'rest', False, None), extra=living(None, good))
        if good:
            rr = room(n=7, weather='sun', drop=['catbed', 'fern3', 'cone', 'floorlamp'], kip=(3.3, 3.3, 'cheer', False, None), extra=living(None, True))
        s, _ = iso_view(rr, vw=236, S=236 / rr[3].W, bg='#14161B', label=('A good day: sun, the cat playing, KIP cheering' if good else 'A low day: rain at the window, the cat asleep in its bed, KIP resting'))
        return s
    rows = [(False, 'Tuesday · low day', [('Recovery 41%', 'rain'), ('3,100 steps', 'cat naps'), ('Missed sleep goal', 'fern waits')]),
            (True, 'Saturday · good day', [('Recovery 82%', 'sun'), ('11,200 steps', 'cat plays'), ('7th night at goal', 'fern grows')])]
    blocks = ''
    for good, t, maps in rows:
        mp = ''.join(f'<div class="col" style="gap: 1px"><span style="font-size: 12px; font-weight: 600">{a}</span><span class="muted" style="font-size: 12px">{b}</span></div>' for a, b in maps)
        blocks += f"""<div class="card" style="padding: 10px; display: flex; flex-direction: column; gap: 8px">
      {lbl(t)}
      <div class="row" style="gap: 10px; align-items: center"><div style="flex: none; width: 236px">{day(good)}</div><div class="col" style="gap: 10px">{mp}</div></div>
    </div>"""
    Bp = header('Same room, two days', 'Effects follow your data', ibtn('back', 'Back', 'gh'), '')
    Bp += f"""  <div style="display: flex; flex-direction: column; gap: 10px; padding: 0 16px">
    {blocks}
    <div class="card" style="padding: 12px; display: flex; flex-direction: column; gap: 6px">
      {lbl('Words the room uses')}
      <span style="font-size: 13px; line-height: 18px"><span style="color: {LIME}">Yes:</span> “The fern grew: 7 nights at your goal.”</span>
      <span style="font-size: 13px; line-height: 18px"><span style="color: rgb(248,113,113)">Never:</span> “Sleep more to grow your fern.”</span>
    </div>
  </div>
"""
    ft = foot('F7 effects, tied to health · F1 isometric room · F5 the room that grows (and the badge shelf from achievements).',
              'Live your week and the room quietly shows it: sun after good recovery, plants that grow with sleep, a cat as lively as your steps, a shelf of badges.',
              'A rainy room on a bad day can read as judgment. It has to stay cosy, never shame, and effects must never sound like advice.',
              'M after C1 · four data-driven states (weather, plant stage, pet energy, shelf), a daily state snapshot, iso art per state, a copy review.')
    cols = [plabel('Living room', 'four effects, four signals') + phone(A), plabel('Low day vs good day', 'nothing breaks') + phone(Bp)]
    CB['C5'] = ('C5 · A living room', cboard('C5 · A living room', cols, ft, W2, 1010))


if __name__ == '__main__':
    c5()
