import json, re, os
P = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'project')
c = json.load(open(os.path.join(P, 'canvas.json')))
B = [('C1', 'C1 · The daily loop · recommended'), ('C2', 'C2 · Grow your room'), ('C3', 'C3 · Weekly theme challenge'), ('C4', 'C4 · Visit & gift'),
     ('C5', 'C5 · A living room'), ('C6', 'C6 · KIP lives there'), ('C7', 'C7 · First week'), ('C8', 'C8 · Economy map')]
x, y = 0, 3400
for k, t in B:
    h = open(os.path.join(P, k + '.dc.html')).read()
    w, hh = map(int, re.search(r'"width": (\d+), "height": (\d+)', h).groups())
    f = k + '.dc.html'
    assert f not in c['boards']
    c['boards'][f] = {"x": x, "y": y, "w": w, "h": hh, "title": t}
    c['order'].append(f)
    x += w + 80
c['notes']['row3'] = {"x": 0, "y": 3120, "text": "Combined ideas", "kind": "title1", "maxW": x - 80}
json.dump(c, open(os.path.join(P, 'canvas.json'), 'w'), indent=2, ensure_ascii=False)
print(x - 80, len(c['boards']))
