import sys, os, re, json, subprocess
D = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, D)
import cbase
from cbase import CB
mods = sys.argv[1:] or ['c1']
for m in mods:
    mod = __import__(m)
    getattr(mod, m)()
PROJ = os.path.join(os.path.dirname(D), 'project')
OUT = os.path.join(D, 'cout')
os.makedirs(OUT, exist_ok=True)
for name, (title, h) in CB.items():
    assert "'" not in re.search(r"data-props='([^']*)'", h).group(1)
    open(os.path.join(PROJ, name + '.dc.html'), 'w').write(h)
    prev = h.replace('<script src="./support.js"></script>', '').replace('<x-dc>', '').replace('</x-dc>', '').replace('<helmet>', '').replace('</helmet>', '')
    pf = os.path.join(OUT, name + '.preview.html')
    open(pf, 'w').write(prev)
    w, hh = re.search(r'"width": (\d+), "height": (\d+)', h).groups()
    subprocess.run(['node', os.path.join(D, 'shot.js'), pf, os.path.join(OUT, name + '.png'), w, hh], check=True)
    print(name, len(h), w, hh, title)
