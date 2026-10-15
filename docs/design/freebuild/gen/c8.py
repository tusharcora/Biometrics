from cbase import *


def row(ic, title, rule, amt, col=LIME):
    return (f'<div class="row" style="gap: 10px; min-height: 48px; padding: 6px 0; border-bottom: 1px solid rgb(30,33,40)">'
            f'<span style="flex: none; width: 32px; height: 32px; border-radius: 8px; background: rgb(14,15,19); display: inline-flex; align-items: center; justify-content: center">{ic}</span>'
            f'<div class="col" style="flex: 1; gap: 1px; min-width: 0"><span style="font-size: 14px; font-weight: 600">{title}</span><span class="muted" style="font-size: 12px; line-height: 16px">{rule}</span></div>'
            f'<span class="coin" style="font-size: 14px; color: {col}; white-space: nowrap">{amt}</span></div>')


def arrow():
    return f'<div aria-hidden="true" style="flex: none; width: 40px; align-self: center; display: flex; justify-content: center; color: rgb(155,157,166)">{icon("arrowr", 28, 1.5)}</div>'


def c8():
    sources = ''.join([
        row(icon('moon', 16), 'Sleep goal hit', 'once a night', '+20'),
        row(icon('steps', 16), 'Step goal hit', 'once a day', '+15'),
        row(icon('check', 16), 'Check-in', 'once a day', '+5'),
        row(icon('clock', 16), 'Weekly recap read', 'once a week', '+10'),
        row(icon('heart', 16), 'Cheers, given or received', '+2 each · 5 a day count', '+2'),
        row(icon('trophy', 16), 'Theme challenge entry', 'once a week', '+30'),
        row(icon('spark', 16), 'First-week list', 'one time only', '+80'),
    ])
    sinks = ''.join([
        row(art('fern', 24), 'Pieces', 'about 1 to 4 good days each', '25–200', 'rgb(245,245,244)'),
        row(art('radio', 24), 'Pieces with effects', 'radio, lamps, pets, lantern', '120–200', 'rgb(245,245,244)'),
        row(art('lantern', 24), 'Theme piece', 'limited, this week only', '80', 'rgb(245,245,244)'),
        row(icon('expand', 16), 'Bigger room · 8 × 8', 'and a 14-day check-in streak', '600', 'rgb(245,245,244)'),
        row(icon('expand', 16), 'Loft · 9 × 9', 'and sleep goal badge, level 3', '1,500', 'rgb(245,245,244)'),
        row(icon('trophy', 16), 'Challenge entry', 'free; the theme piece is optional', '0', 'rgb(245,245,244)'),
    ])
    col = lambda title, sub, inner, w: f'<div class="card" style="width: {w}px; flex: none; padding: 16px; display: flex; flex-direction: column; gap: 6px"><span style="font-family: \'Silkscreen\', monospace; font-size: 18px; line-height: 22px">{title}</span><span class="muted" style="font-size: 13px; line-height: 18px; margin-bottom: 4px">{sub}</span>{inner}</div>'
    wallet_ = f"""<div class="card" style="width: 330px; flex: none; padding: 16px; display: flex; flex-direction: column; gap: 12px; border-color: rgba(253,224,71,.35)">
      <div class="row" style="gap: 12px">{coin(40)}<div class="col" style="gap: 2px"><span style="font-family: 'Silkscreen', monospace; font-size: 18px; line-height: 22px">Wallet</span><span class="muted" style="font-size: 13px">KIP coins, one balance</span></div></div>
      <div class="col" style="gap: 6px; padding: 10px 12px; border-radius: 8px; background: rgb(14,15,19)">
        <div class="row" style="justify-content: space-between"><span style="font-size: 13px">Daily cap</span><span class="coin" style="font-size: 13px">60</span></div>
        {bar(67, 'health goals 40 of the 60 cap')}
        <span class="muted" style="font-size: 12px; line-height: 16px">Health goals pay up to 40 a day, cheers up to 10, the weekly recap 10. Challenge and first-week rewards sit outside it.</span>
      </div>
      <div class="col" style="gap: 6px">
        <div class="row" style="justify-content: space-between; min-height: 26px"><span style="font-size: 13px">A good week</span><span class="coin" style="font-size: 13px">≈ 340</span></div>
        <div class="row" style="justify-content: space-between; min-height: 26px"><span style="font-size: 13px">A quiet week</span><span class="coin" style="font-size: 13px">≈ 120</span></div>
        <div class="row" style="justify-content: space-between; min-height: 26px"><span style="font-size: 13px">8 × 8 room, coin side</span><span style="font-size: 13px">≈ 2 good weeks</span></div>
      </div>
      <div class="col" style="gap: 6px; padding: 12px; border-radius: 8px; border: 1px solid rgba(163,230,53,.4)">
        <span class="row" style="gap: 6px; color: {LIME}">{icon('lock', 16)}{lbl('No real money', LIME)}</span>
        <span style="font-size: 13px; line-height: 18px">Coins can’t be bought, sold, traded or won from ads. Gifts move pieces, never coins.</span>
      </div>
      <span class="muted" style="font-size: 12px; line-height: 16px">Coins never expire and are never taken away. A missed day earns less; it costs nothing.</span>
    </div>"""
    top = f'<div class="row" style="gap: 12px; align-items: stretch">{col("Sources", "Earned only from things the app already measures: sleep and steps from your health data, not typed in.", sources, 400)}{arrow()}{wallet_}{arrow()}{col("Sinks", "Where coins go. Space also needs a streak or badge, so coins alone can’t buy it.", sinks, 400)}</div>'
    guard = [('Caps, not grind', 'One earn per goal per day, a 60-coin daily cap, 5 paid cheers a day, one cheer per room a day. Doing more doesn’t pay more.'),
             ('No loss, no shame', 'No coin decay, no streak fines, no wilting plants. A low week buys a fern instead of a radio.'),
             ('Server-side ledger', 'Each earn is one idempotent event tied to a source record (a night, a day’s steps), so it can’t be replayed or doubled.'),
             ('No comparisons by coins', 'Nobody sees anyone else’s balance. Rooms are shown off, wallets are not.')]
    gl = ''.join(f'<div class="col" style="gap: 4px"><span style="font-size: 14px; font-weight: 600">{t}</span><span class="muted" style="font-size: 13px; line-height: 18px">{d}</span></div>' for t, d in guard)
    advice = f"""<div class="card" style="flex: 1; padding: 16px; display: flex; flex-direction: column; gap: 10px">
      <span style="font-family: 'Silkscreen', monospace; font-size: 18px; line-height: 22px">Effects never advise</span>
      <span class="muted" style="font-size: 13px; line-height: 18px">Room effects describe what happened. Health advice only ever comes from KIP’s coach answers, with their usual care rules.</span>
      <div class="col" style="gap: 6px">
        <span style="font-size: 13px; line-height: 18px"><span style="color: {LIME}">Yes:</span> “The fern grew: 7 nights at your goal.”</span>
        <span style="font-size: 13px; line-height: 18px"><span style="color: {LIME}">Yes:</span> “Rainy today. Recovery is lower than usual.”</span>
        <span style="font-size: 13px; line-height: 18px"><span style="color: rgb(248,113,113)">Never:</span> “Sleep more to grow your fern.”</span>
        <span style="font-size: 13px; line-height: 18px"><span style="color: rgb(248,113,113)">Never:</span> “Walk 2,000 more steps to wake the cat.”</span>
      </div>
      <span class="muted" style="font-size: 12px; line-height: 16px">Effects never change scores, goals or what KIP says about your health.</span>
    </div>"""
    bottom = f"""<div class="row" style="gap: 12px; align-items: stretch">
    <div class="card" style="flex: 1.6; padding: 16px; display: flex; flex-direction: column; gap: 12px"><span style="font-family: 'Silkscreen', monospace; font-size: 18px; line-height: 22px">Guardrails</span><div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px 20px">{gl}</div></div>
    {advice}
  </div>"""
    ft = foot('F6 earned coins · F5 room sizes · F4 pieces · F7 effects · F8 cheers and challenges. The map behind C1 to C7.',
              'Healthy actions in, pieces and space out; caps and no-loss rules keep it a habit, not a grind.',
              'Balance. Too stingy feels pointless; too generous empties the shop in a month. Prices need a live tuning knob and a look at real weekly earnings.',
              'M · server ledger with idempotent earn events, caps, price config, audit view. Shared by every board in this row.')
    W, H = 1250, 1010
    html_ = head('C8 · Economy map') + f"""<div style="width: {W}px; height: {H}px; box-sizing: border-box; overflow: hidden; background: rgb(10,11,14); color: rgb(245,245,244); font-family: 'Geist', system-ui, sans-serif; display: flex; flex-direction: column; gap: 16px; padding: 0 0 16px">
{plabel('Systems map', 'not a screen')}
{top}
{bottom}
{ft}
</div>
""" + tail(W, H)
    CB['C8'] = ('C8 · Economy map', html_)


if __name__ == '__main__':
    c8()
