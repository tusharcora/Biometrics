# Board scaffolding for the F row (house style from the R row).
import json, html
from px import paths, bounds, fmt, ITEMS

CSS = """body{margin:0}
.b{display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;font-family:'Geist',system-ui,sans-serif;font-weight:500;white-space:nowrap;cursor:pointer;gap:6px;border:1px solid transparent;border-radius:8px;background:transparent;color:rgb(245,245,244);text-decoration:none;font-size:14px;padding:0}
.ol{border-color:rgb(44,47,55);background:rgba(44,47,55,.3)}
.df{background:rgb(245,245,244);color:rgb(10,11,14)}
.gh{background:transparent}
.dis{opacity:.4;cursor:default}
.label{font-family:'Silkscreen',monospace;font-size:11px;line-height:14px;letter-spacing:1px;text-transform:uppercase;color:rgb(155,157,166)}
.muted{color:rgb(155,157,166)}
.card{border-radius:12px;background:rgb(20,22,27);border:1px solid rgb(30,33,40);box-sizing:border-box}
.say{position:absolute;font-family:'Silkscreen',monospace;font-size:10px;line-height:12px;letter-spacing:1px;padding:5px 8px;border-radius:8px;background:rgb(245,245,244);color:rgb(10,11,14);white-space:nowrap}
.ph{position:relative;width:390px;box-sizing:border-box;overflow:hidden;background:rgb(10,11,14);display:flex;flex-direction:column;padding-top:12px;border-radius:20px;box-shadow:0 0 0 1px rgb(30,33,40)}
.cap{font-size:12px;line-height:16px;color:rgb(155,157,166)}
.notes{display:grid;gap:12px 20px;padding:16px;border-radius:12px;background:rgb(20,22,27);border:1px solid rgb(30,33,40)}
.notes p{margin:0;font-size:13px;line-height:19px;color:rgb(214,215,219)}
.notes b{display:block;font-family:'Silkscreen',monospace;font-weight:400;font-size:10px;letter-spacing:1px;color:rgb(155,157,166);margin-bottom:2px}
.tile{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:4px;box-sizing:border-box;height:84px;padding:6px 4px 6px;border-radius:8px;border:1px solid rgb(44,47,55);background:rgb(20,22,27);color:rgb(245,245,244);font-family:'Geist',system-ui,sans-serif;font-size:11px;line-height:13px;cursor:pointer}
.tile .n{position:absolute;right:4px;top:4px;font-size:11px;font-weight:600;font-variant-numeric:tabular-nums;color:rgb(214,215,219);background:rgb(30,33,40);border-radius:6px;padding:1px 5px}
.tile.sel{border-color:rgb(163,230,53);box-shadow:inset 0 0 0 1px rgb(163,230,53)}
.tab{height:36px;padding:0 12px;font-size:13px;border-radius:8px}
.tab[aria-pressed=true]{background:rgb(245,245,244);color:rgb(10,11,14)}
.tb{flex-direction:column;gap:2px;width:56px;height:52px;font-size:11px;border-radius:8px}
.bar{height:6px;border-radius:3px;background:rgb(44,47,55);overflow:hidden}
.bar i{display:block;height:6px;background:rgb(163,230,53)}
.tag{display:inline-flex;align-items:center;gap:4px;font-size:11px;line-height:14px;padding:2px 6px;border-radius:6px;background:rgb(30,33,40);color:rgb(214,215,219)}
.row{display:flex;align-items:center;gap:8px}
.col{display:flex;flex-direction:column}
.plab{position:absolute;font-family:'Silkscreen',monospace;font-size:9px;line-height:11px;letter-spacing:1px;padding:2px 5px;border-radius:4px;background:rgba(10,11,14,.82);color:rgb(245,245,244);white-space:nowrap}
.num{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:6px;background:rgb(163,230,53);color:rgb(10,11,14);font-size:11px;font-weight:700;font-family:'Geist',system-ui,sans-serif}
.coin{display:inline-flex;align-items:center;gap:4px;font-variant-numeric:tabular-nums;font-weight:600}"""

LIME = 'rgb(163,230,53)'
RED = 'rgb(248,113,113)'
ACC = 'rgb(251,113,133)'


def head(title):
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{title}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&amp;family=Silkscreen&amp;display=swap" rel="stylesheet">
<style>
{CSS}
</style>
</helmet>
"""


def tail(w, h):
    props = json.dumps({"$preview": {"width": w, "height": h}})
    return f"""</x-dc>
<script type="text/x-dc" data-dc-script data-props='{props}'>
class Component extends DCLogic {{
  renderVals() {{
    return {{}};
  }}
}}
</script>
</body>
</html>
"""


def ic(d, s=20, sw=2):
    return f'<svg width="{s}" height="{s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{d}</svg>'


I = {
    'back': '<path d="M15 6l-6 6 6 6"></path>',
    'edit': '<path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"></path>',
    'undo': '<path d="M9 14L4 9l5-5"></path><path d="M4 9h10a6 6 0 0 1 0 12h-3"></path>',
    'redo': '<path d="M15 14l5-5-5-5"></path><path d="M20 9H10a6 6 0 0 0 0 12h3"></path>',
    'grid': '<rect x="3" y="3" width="18" height="18" rx="2"></rect><path d="M3 9h18M3 15h18M9 3v18M15 3v18"></path>',
    'flip': '<path d="M12 3v18"></path><path d="M8 7L3 12l5 5z"></path><path d="M16 7l5 5-5 5z"></path>',
    'rotate': '<path d="M21 12a9 9 0 1 1-3-6.7"></path><path d="M21 3v6h-6"></path>',
    'store': '<path d="M21 8v13H3V8"></path><path d="M1 3h22v5H1z"></path><path d="M10 12h4"></path>',
    'trash': '<path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="M19 6l-1 14H6L5 6"></path>',
    'plus': '<path d="M12 5v14M5 12h14"></path>',
    'move': '<path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20"></path>',
    'check': '<path d="M20 6L9 17l-5-5"></path>',
    'x': '<path d="M18 6L6 18M6 6l12 12"></path>',
    'heart': '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21.2l8.8-8.8a5.5 5.5 0 0 0 0-7.8z"></path>',
    'share': '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><path d="M16 6l-4-4-4 4"></path><path d="M12 2v13"></path>',
    'down': '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><path d="M7 10l5 5 5-5"></path><path d="M12 15V3"></path>',
    'lock': '<rect x="4" y="11" width="16" height="10" rx="2"></rect><path d="M8 11V7a4 4 0 0 1 8 0v4"></path>',
    'layers': '<path d="M12 2L2 7l10 5 10-5z"></path><path d="M2 17l10 5 10-5"></path><path d="M2 12l10 5 10-5"></path>',
    'up': '<path d="M12 19V5"></path><path d="M6 11l6-6 6 6"></path>',
    'dn': '<path d="M12 5v14"></path><path d="M6 13l6 6 6-6"></path>',
    'eye': '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"></path><circle cx="12" cy="12" r="3"></circle>',
    'music': '<path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle>',
    'trophy': '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"></path><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"></path>',
    'clock': '<circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path>',
    'more': '<circle cx="5" cy="12" r="1"></circle><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle>',
    'expand': '<path d="M15 3h6v6"></path><path d="M9 21H3v-6"></path><path d="M21 3l-7 7"></path><path d="M3 21l7-7"></path>',
    'copy': '<rect x="9" y="9" width="12" height="12" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>',
}


def icon(name, s=20, sw=2):
    return ic(I[name], s, sw)


def coin(s=14):
    # a pixel coin
    return (f'<svg width="{s}" height="{s}" viewBox="0 0 7 7" shape-rendering="crispEdges" aria-hidden="true">'
            '<path d="M2 0h3v1H2zM1 1h5v5H1zM0 2h1v3H0zM6 2h1v3H6zM2 6h3v1H2z" fill="#F59E0B"></path>'
            '<path d="M2 1h3v1H2zM1 2h1v3H1z" fill="#FDE68A"></path><path d="M3 2h1v3H3z" fill="#B45309"></path></svg>')


def btn(label, kind='ol', h=44, w=None, ico=None, extra='', aria=None, style=''):
    wv = f'width: {w}px; ' if w else 'padding: 0 14px; '
    a = f' aria-label="{aria}"' if aria else ''
    inner = (icon(ico, 18) if ico else '') + (label or '')
    return f'<button class="b {kind}"{a} style="{wv}height: {h}px; {style}"{extra}>{inner}</button>'


def ibtn(name, aria, kind='ol', s=44, pressed=None):
    p = f' aria-pressed="{"true" if pressed else "false"}"' if pressed is not None else ''
    st = 'background: rgb(245,245,244); color: rgb(10,11,14); ' if pressed else ''
    return f'<button class="b {kind}" aria-label="{aria}"{p} style="{st}width: {s}px; height: {s}px">{icon(name)}</button>'


def header(title, sub, left='', right=''):
    return f"""  <div style="display: flex; align-items: center; gap: 8px; padding: 4px 16px 10px">
    {left}<div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px">
      <h1 style="margin: 0; font-family: 'Silkscreen', monospace; font-weight: 400; font-size: 20px; line-height: 24px; letter-spacing: 1px; white-space: nowrap">{title}</h1>
      <span class="muted" style="font-size: 13px; line-height: 17px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{sub}</span>
    </div>
    {right}
  </div>
"""


def phone(inner, h=780, style=''):
    return f'<div class="ph" style="height: {h}px; flex: none; {style}">\n{inner}</div>\n'


def rsvg(rects, vw, vh, scale, ox=0, oy=0, label=None, over='', under='', style='', bg='#0A0B0E'):
    a = f'role="img" aria-label="{html.escape(label)}"' if label else 'aria-hidden="true"'
    b = f'<rect width="{vw}" height="{vh}" fill="{bg}"></rect>' if bg else ''
    return (f'<svg {a} width="{vw}" height="{vh}" viewBox="0 0 {vw} {vh}" shape-rendering="crispEdges" style="display: block; {style}">{b}'
            f'<g transform="translate({fmt(ox)} {fmt(oy)}) scale({fmt(scale)})">{under}{paths(rects)}{over}</g></svg>')


def icon_svg(rects, box=40, maxs=4, label=None):
    solid = [q for q in rects if not q[4].startswith('rgba')] or rects
    b = bounds(solid)
    w, h = b[2] - b[0], b[3] - b[1]
    s = max(1, min(maxs, int(min(box / max(w, 1), box / max(h, 1)))))
    if s == 1 and (w > box or h > box):
        s = min(box / w, box / h)
    ox = (box - w * s) / 2 - b[0] * s
    oy = (box - h * s) / 2 - b[1] * s
    return rsvg(solid, box, box, s, ox, oy, label=label, bg=None)


def tile(rects, name, n=None, sel=False, w=None, extra='', aria=None, dis=False, price=None):
    cnt = f'<span class="n">{n}</span>' if n else ''
    pr = f'<span class="coin">{coin(11)}{price}</span>' if price is not None else ''
    st = f'width: {w}px; ' if w else ''
    cls = 'tile' + (' sel' if sel else '') + (' dis' if dis else '')
    a = aria or (name + (f', {n}' if n else ''))
    return f'<button class="{cls}" aria-label="{html.escape(a)}" style="{st}{extra}">{cnt}{icon_svg(rects, 40)}<span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%">{name}</span>{pr}</button>'


def notes(items, cols=1):
    n = ''.join(f'<p><b>{k}</b>{v}</p>' for k, v in items)
    return f'<div class="notes" style="grid-template-columns: repeat({cols}, minmax(0, 1fr))">{n}</div>'


def plabel(text, sub=''):
    s = f'<span class="muted" style="font-size: 12px">{sub}</span>' if sub else ''
    return f'<div style="display: flex; align-items: baseline; gap: 8px; height: 20px"><span class="label" style="color: rgb(245,245,244)">{text}</span>{s}</div>'


def board(title, cols, footer, W, H, intro=''):
    """cols: list of html columns laid out in a row with 40-px gaps."""
    c = ''.join(f'<div style="display: flex; flex-direction: column; gap: 10px; width: 390px; flex: none">{x}</div>' for x in cols)
    it = f'<p style="margin: 0; font-size: 14px; line-height: 20px; color: rgb(214,215,219); max-width: 760px">{intro}</p>' if intro else ''
    return head(title) + f"""<div style="width: {W}px; height: {H}px; box-sizing: border-box; overflow: hidden; background: rgb(10,11,14); color: rgb(245,245,244); font-family: 'Geist', system-ui, sans-serif; display: flex; flex-direction: column; gap: 16px; padding: 0 0 16px">
{it}<div style="display: flex; gap: 40px; align-items: flex-start">{c}</div>
{footer}
</div>
""" + tail(W, H)
