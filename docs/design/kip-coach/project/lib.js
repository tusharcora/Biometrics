var KN = 16, KE = "................", KBODY = "....bbbbbbbs....";
var KBASE = [KE, KE, KE, KE, KE, KE, KBODY, KBODY, KBODY, KBODY, KBODY, KBODY, KBODY, ".....b....s.....", ".....b....s.....", "...zzzzzzzzzz..."];
var KEYES = [[6, 8], [9, 8]];
var KPOSES = { rest: {}, wave: { arms: [[12, 9, "s"], [13, 8, "s"]] }, type: { arms: [[12, 10, "s"], [13, 10, "s"]] }, read: { arms: [[3, 10, "b"], [12, 10, "s"]] }, point: { arms: [[3, 9, "b"], [2, 8, "b"]] } };
var KMOODS = { idle: {}, blink: { eyes: "shut" }, glance: { eyes: "glance" }, up: { eyes: "up" }, down: { eyes: "down" } };
var WEAR = {
  beanie: [[4, 2], ["...wW...", ".LLrrrR.", "LrrrrrrR", "ddddddDD"], { w: "#F8FAFC", W: "#CBD5E1", r: "#EF4444", L: "#F87171", R: "#B91C1C", d: "#B91C1C", D: "#7F1D1D" }],
  cap: [[4, 4], [".LbbbbR....", "bbbbbbbbkkk"], { b: "#2563EB", L: "#60A5FA", R: "#1E40AF", k: "#1E3A8A" }],
  bucket: [[3, 3], ["..cccccc..", "..dddddd..", "bbbbbbbbbb"], { c: "@h", d: "@d", b: "@s" }],
  round: [[5, 7], ["FFFFFf", "f.ff.f", "ffffff"], { F: "#FCD34D", f: "#D97706" }],
  mask: [[4, 6], ["kkkkkkkk", ".mm..mm."], { k: "#334155", m: "#C4B5FD" }],
  scarf: [[3, 10], ["LssssssssS", ".ddddddLs.", ".......Ls.", ".......dd."], { L: "#F87171", s: "#DC2626", S: "#991B1B", d: "#991B1B" }],
  bowtie: [[5, 10], ["bb..bb", "bbkkbb", "bb..bb"], { b: "#2563EB", k: "#1E3A8A" }],
  towel: [[3, 10], ["ssssssssss", "w........w", "w........w"], { s: "#60A5FA", w: "#F1F5F9" }],
  phones: [[3, 5], ["..kkkkkk..", ".k......k.", "cc......cc", "cC......cC", "cc......cc"], { k: "#1F2937", c: "#38BDF8", C: "#0369A1" }],
  earbuds: [[3, 8], ["w........w", "w........w"], { w: "#F8FAFC" }],
  muffs: [[3, 5], ["..kkkkkk..", ".k......k.", "ww......ww", "ww......ww", "ww......ww"], { k: "#94A3B8", w: "#FBCFE8" }]
};
function kRgb(h) { var n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function kHx(n) { var s = Math.max(0, Math.min(255, Math.round(n))).toString(16); return s.length < 2 ? "0" + s : s; }
function kMix(a, b, k) { var x = kRgb(a), y = kRgb(b); return "#" + kHx(x[0] * (1 - k) + y[0] * k) + kHx(x[1] * (1 - k) + y[1] * k) + kHx(x[2] * (1 - k) + y[2] * k); }
function kDark(a, k) { var x = kRgb(a); return "#" + kHx(x[0] * k) + kHx(x[1] * k) + kHx(x[2] * k); }
function kLum(h) { var c = kRgb(h).map(function (v) { v = v / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
function kRamp(body) { return { b: body, h: kMix(body, "#FFFFFF", 0.25), s: kDark(body, 0.78), d: kDark(body, 0.6), e: kLum(body) > 0.2 ? "#14161B" : "#F5F5F4", w: "#F8FAFC", z: "rgba(0,0,0,0.35)" }; }
function kBlank() { var g = []; for (var i = 0; i < KN; i++) { var r = []; for (var j = 0; j < KN; j++) r.push(null); g.push(r); } return g; }
function kPut(g, x, y, c) { if (x >= 0 && y >= 0 && x < KN && y < KN && c) g[y][x] = c; }
// KIP sprite: body colour, pose, mood, worn ids (head, face, neck, ears order), flip
function kSprite(body, pn, mn, wear, flip) {
  var p = kRamp(body), pose = KPOSES[pn] || {}, mood = KMOODS[mn] || {}, g = kBlank(), x, y, c;
  for (y = 0; y < KN; y++) for (x = 0; x < KN; x++) if (KBASE[y][x] !== ".") g[y][x] = KBASE[y][x];
  var em = mood.eyes;
  KEYES.forEach(function (e, i) {
    var cs = [[e[0], e[1]]];
    if (em === "shut") cs = [[e[0], e[1]], [i === 0 ? e[0] - 1 : e[0] + 1, e[1]]];
    else if (em === "up") cs = [[e[0], e[1] - 1]];
    else if (em === "down") cs = [[e[0], e[1] + 1]];
    else if (em === "glance") cs = [[e[0] + 1, e[1]]];
    cs.forEach(function (q) { kPut(g, q[0], q[1], "e"); });
  });
  (pose.arms || []).forEach(function (a) { if (!g[a[1]][a[0]]) g[a[1]][a[0]] = a[2]; });
  var out = kBlank();
  for (y = 0; y < KN; y++) for (x = 0; x < KN; x++) { c = g[y][x]; if (c) out[y][x] = p[c]; }
  (wear || []).forEach(function (id) {
    var it = WEAR[id]; if (!it) return;
    it[1].forEach(function (row, yy) { for (var xx = 0; xx < row.length; xx++) { var ch = row[xx]; if (ch === ".") continue; var col = it[2][ch]; if (col && col[0] === "@") col = p[col.slice(1)]; kPut(out, it[0][0] + xx, it[0][1] + yy, col); } });
  });
  if (flip) out = out.map(function (row) { return row.slice().reverse(); });
  return out;
}
function kPush(r, cells, ox, oy) { for (var y = 0; y < KN; y++) for (var x = 0; x < KN; x++) if (cells[y][x]) r.push([ox + x, oy + y, 1, 1, cells[y][x]]); }

function R(r, x, y, w, h, c) { if (w > 0 && h > 0) r.push([x, y, w, h, c]); }
function pxLayers(rects, u) { var out = [], cur = null; rects.forEach(function (q) { if (!cur || cur.fill !== q[4]) { cur = { fill: q[4], d: "" }; out.push(cur); } cur.d += "M" + q[0] * u + " " + q[1] * u + "h" + q[2] * u + "v" + q[3] * u + "h-" + q[2] * u + "z"; }); return out; }
function pic(rects, w, h, u) { return { w: w * u, h: h * u, layers: pxLayers(rects, u) }; }
// clipped rect
function Rc(r, b, x, y, w, h, c) { var x0 = Math.max(x, b[0]), y0 = Math.max(y, b[1]), x1 = Math.min(x + w, b[0] + b[2]), y1 = Math.min(y + h, b[1] + b[3]); R(r, x0, y0, x1 - x0, y1 - y0, c); }
// convex polygon, filled column by column
function poly(r, pts, c) {
  var minX = 1e9, maxX = -1e9, i, x;
  pts.forEach(function (p) { minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); });
  for (x = Math.round(minX); x < Math.round(maxX); x++) {
    var cx = x + 0.5, lo = 1e9, hi = -1e9;
    for (i = 0; i < pts.length; i++) { var a = pts[i], b = pts[(i + 1) % pts.length]; if ((a[0] <= cx && b[0] > cx) || (b[0] <= cx && a[0] > cx)) { var y = a[1] + (cx - a[0]) / (b[0] - a[0]) * (b[1] - a[1]); lo = Math.min(lo, y); hi = Math.max(hi, y); } }
    if (hi > lo) { var y0 = Math.round(lo), y1 = Math.round(hi); if (y1 > y0) R(r, x, y0, 1, y1 - y0, c); }
  }
}
// rect list with @b/@h/@s/@d against a ramp
function stamp(r, list, ox, oy, body, flip, w) { var p = kRamp(body || "#475569"); list.forEach(function (q) { var c = q[4][0] === "@" ? p[q[4].slice(1)] : q[4]; R(r, flip ? ox + w - q[0] - q[2] : ox + q[0], oy + q[1], q[2], q[3], c); }); }

// today's Recovery weather, drawn into box b = [x, y, w, h]
var SKY = { clear: ["#60A5FA", "#7DB4FB", "#93C5FD"], mostly: ["#60A5FA", "#7DB4FB", "#93C5FD"], cloudy: ["#7C8AA0", "#8592A6", "#A3AEC0"], stormy: ["#232C3B", "#2B3546", "#3A4559"], night: ["#0B1222", "#0F172A", "#1E1B4B"] };
function cloud(r, b, x, y, n, c, hl) { Rc(r, b, x, y, n, 3, c); Rc(r, b, x + 2, y - 1, n - 5, 1, hl); Rc(r, b, x + Math.round(n / 3), y - 2, Math.round(n / 3), 1, hl); }
function sky(r, b, wx, opt) {
  opt = opt || {};
  var s = opt.sky || SKY[wx] || SKY.cloudy, x = b[0], y = b[1], w = b[2], h = b[3], i, k;
  var h1 = Math.round(h * 0.4), h2 = Math.round(h * 0.3);
  R(r, x, y, w, h1, s[0]); R(r, x, y + h1, w, h2, s[1]); R(r, x, y + h1 + h2, w, h - h1 - h2, s[2]);
  var sx = x + Math.round(w * (opt.sunX == null ? 0.68 : opt.sunX)), sy = y + Math.round(h * (opt.sunY == null ? 0.18 : opt.sunY)), ss = Math.max(4, Math.min(9, Math.round(Math.min(w, h) / 5)));
  if (wx === "clear" || wx === "mostly") { Rc(r, b, sx, sy, ss, ss, opt.sunC || "#FBBF24"); Rc(r, b, sx + 1, sy - 1, ss - 2, 1, "#FDE68A"); Rc(r, b, sx - 1, sy + 1, 1, ss - 2, "#FDE68A"); }
  if (wx === "mostly") cloud(r, b, x + Math.round(w * 0.12), y + Math.round(h * 0.55), Math.max(8, Math.round(w * 0.32)), "#F3F4F6", "#FFFFFF");
  if (wx === "cloudy") { Rc(r, b, sx + 1, sy, ss - 1, ss - 2, "#FCD34D"); cloud(r, b, x + Math.round(w * 0.06), y + Math.round(h * 0.3), Math.max(8, Math.round(w * 0.4)), "#E5E7EB", "#F3F4F6"); cloud(r, b, x + Math.round(w * 0.48), y + Math.round(h * 0.48), Math.max(8, Math.round(w * 0.44)), "#CBD5E1", "#E2E8F0"); cloud(r, b, x + Math.round(w * 0.1), y + Math.round(h * 0.8), Math.max(6, Math.round(w * 0.3)), "#CBD5E1", "#E2E8F0"); }
  if (wx === "stormy") {
    Rc(r, b, x, y + Math.round(h * 0.1), w, Math.round(h * 0.18), "#1E293B"); Rc(r, b, x + Math.round(w * 0.12), y + Math.round(h * 0.28), Math.round(w * 0.7), 2, "#1E293B");
    for (i = 0, k = x + 2; k < x + w - 1; k += 4, i++) { Rc(r, b, k, y + Math.round(h * 0.38) + (i % 3) * 2, 1, 3, "#93C5FD"); Rc(r, b, k + 2, y + Math.round(h * 0.68) + (i % 2) * 2, 1, 3, "#93C5FD"); }
    var lx = x + Math.round(w * 0.55), ly = y + Math.round(h * 0.3); Rc(r, b, lx, ly, 2, 4, "#FDE047"); Rc(r, b, lx - 2, ly + 4, 2, 3, "#FDE047"); Rc(r, b, lx - 1, ly + 7, 1, 2, "#FDE047");
  }
  if (wx === "night") { Rc(r, b, sx, sy, ss, ss, "#F1F5F9"); Rc(r, b, sx + Math.round(ss / 2), sy, ss - Math.round(ss / 2), Math.round(ss / 2), s[0]); [[0.12, 0.2], [0.3, 0.5], [0.18, 0.82], [0.85, 0.72], [0.45, 0.14], [0.6, 0.6]].forEach(function (q) { Rc(r, b, x + Math.round(w * q[0]), y + Math.round(h * q[1]), 1, 1, "#F8FAFC"); }); }
}
function rainOver(r, b, wx, gap) { if (wx !== "stormy") return; gap = gap || 6; for (var yy = b[1], j = 0; yy < b[1] + b[3]; yy += 7, j++) for (var xx = b[0] + (j % 2) * 3; xx < b[0] + b[2]; xx += gap) Rc(r, b, xx, yy + (xx % 3), 1, 3, "rgba(147,197,253,0.55)"); }

function plant(r, x, y, kind) {
  if (kind === "tall") { R(r, x, y, 8, 7, "#E5E7EB"); R(r, x - 1, y - 1, 10, 2, "#F8FAFC"); R(r, x + 3, y - 14, 2, 13, "#15803D"); R(r, x - 3, y - 16, 6, 4, "#22C55E"); R(r, x + 4, y - 20, 7, 5, "#16A34A"); R(r, x - 2, y - 10, 5, 3, "#4ADE80"); R(r, x + 5, y - 11, 6, 3, "#22C55E"); return; }
  if (kind === "cactus") { R(r, x + 1, y + 2, 6, 5, "#C2410C"); R(r, x + 3, y - 7, 3, 9, "#65A30D"); R(r, x + 1, y - 4, 2, 3, "#65A30D"); R(r, x + 6, y - 5, 2, 3, "#65A30D"); R(r, x + 3, y - 8, 2, 1, "#F472B6"); return; }
  R(r, x, y, 8, 7, "#B45309"); R(r, x - 1, y - 1, 10, 2, "#D97706"); R(r, x + 3, y - 8, 2, 7, "#4ADE80"); R(r, x, y - 6, 3, 2, "#22C55E"); R(r, x + 5, y - 7, 3, 2, "#22C55E"); R(r, x - 1, y - 9, 2, 3, "#16A34A"); R(r, x + 7, y - 10, 2, 3, "#16A34A");
}
var CAT = ["........k..k", "........kkkk", "........kekk", "t.kkkkkkkkkk", "tkkkkkkkkkk.", ".dddddddddd."];
function cat(r, x, y, c, flip) { CAT.forEach(function (row, yy) { for (var xx = 0; xx < 12; xx++) { var ch = row[xx], col = ch === "k" ? c : ch === "e" ? "#14161B" : ch === "t" ? kDark(c, 0.8) : ch === "d" ? kDark(c, 0.7) : null; if (col) R(r, flip ? x + 11 - xx : x + xx, y + yy, 1, 1, col); } }); }
function art(r, x, y, a, b) { R(r, x, y, 18, 14, "#1F2937"); R(r, x + 1, y + 1, 16, 12, a); R(r, x + 3, y + 8, 6, 5, b); R(r, x + 6, y + 6, 4, 7, b); R(r, x + 12, y + 3, 2, 2, "#FDE68A"); }
function books(r, x, y, cols) { cols.forEach(function (c, i) { var h = [7, 5, 8, 6, 4, 7][i % 6]; R(r, x, y - h, 3, h, c); x += 4; }); }
function mug(r, x, y) { R(r, x, y, 3, 4, "#F1F5F9"); R(r, x + 3, y + 1, 1, 2, "#F1F5F9"); }
function monitor(r, x, y, mode, accent, night) {
  R(r, x, y, 26, 13, "#1F2937"); R(r, x + 1, y + 1, 24, 11, "#0F1A2A"); R(r, x + 11, y + 13, 3, 3, "#334155"); R(r, x + 7, y + 15, 11, 1, "#334155");
  var ix = x + 1, iy = y + 1, L = "#7DD3FC";
  if (mode === "dots") { R(r, ix + 5, iy + 5, 2, 2, accent); R(r, ix + 10, iy + 5, 2, 2, accent); R(r, ix + 15, iy + 5, 2, 2, accent); }
  else if (mode === "chart") [[3, 3], [6, 5], [9, 2], [12, 6], [15, 4]].forEach(function (q) { R(r, ix + q[0], iy + 9 - q[1], 2, q[1], q[0] === 12 ? accent : L); });
  else { R(r, ix + 2, iy + 2, 10, 1, L); R(r, ix + 2, iy + 4, 16, 1, L); R(r, ix + 2, iy + 6, 8, 1, L); R(r, ix + 2, iy + 8, 13, 1, L); }
  if (night) R(r, x - 3, y - 2, 32, 18, "rgba(125,211,252,0.07)");
}
function deskLamp(r, x, y, c, night) { R(r, x, y - 2, 5, 2, "#334155"); R(r, x + 2, y - 10, 1, 8, "#334155"); R(r, x - 3, y - 13, 7, 3, c); if (night) R(r, x - 5, y - 10, 11, 10, "rgba(253,224,71,0.18)"); }
function floorLamp(r, x, y, c) { R(r, x + 3, y - 42, 1, 42, "#94A3B8"); R(r, x, y - 46, 7, 4, c); R(r, x + 1, y, 5, 1, "#94A3B8"); }
var BEANBAG = [[5, 1, 6, 2, "@h"], [3, 3, 10, 3, "@b"], [1, 6, 14, 8, "@b"], [0, 9, 16, 5, "@s"], [3, 7, 8, 1, "@h"]];
var WEIGHTS = [[0, 6, 1, 26, "#334155"], [11, 6, 1, 26, "#334155"], [0, 9, 12, 1, "#334155"], [0, 20, 12, 1, "#334155"], [-1, 32, 14, 1, "#1F2937"], [1, 6, 2, 3, "#DC2626"], [3, 7, 6, 1, "#94A3B8"], [9, 6, 2, 3, "#DC2626"], [1, 17, 2, 3, "#2563EB"], [3, 18, 6, 1, "#94A3B8"], [9, 17, 2, 3, "#2563EB"], [1, 28, 2, 4, "#111827"], [3, 29, 6, 1, "#94A3B8"], [9, 28, 2, 4, "#111827"]];
var KETTLE = [[2, 0, 5, 1, "#1F2937"], [1, 1, 1, 3, "#1F2937"], [7, 1, 1, 3, "#1F2937"], [1, 3, 7, 1, "@b"], [0, 4, 9, 7, "@b"], [1, 11, 7, 1, "@s"], [2, 5, 2, 2, "@h"]];
var YOGAMAT = [[1, 0, 5, 26, "@b"], [0, 0, 7, 2, "@h"], [2, 0, 3, 2, "@d"], [0, 10, 7, 1, "#1F2937"], [0, 18, 7, 1, "#1F2937"]];
var CUSHION = [[1, 0, 12, 3, "#E5E7EB"], [1, 0, 12, 1, "#F8FAFC"], [0, 3, 14, 4, "@b"], [0, 3, 14, 1, "@h"], [1, 7, 12, 1, "@d"]];
// starter furnishing palette, same as K4
var T = { wall: "#2A3140", wall2: "#323A4B", trim: "#1E2430", trim2: "#191E28", floor: "#5B4636", floor2: "#4A382B", rug: "#475569", rug2: "#334155", desk: "#7C5A3E", deskTop: "#9A7350", chair: "#3F4656", lamp: "#F59E0B", sleep: "#9333EA" };
function planks(r, x, y, w, h) { R(r, x, y, w, h, T.floor); for (var yy = y + 4; yy < y + h; yy += 5) R(r, x, yy, w, 1, T.floor2); for (yy = y; yy < y + h; yy += 5) for (var xx = x + ((yy - y) % 10 ? 8 : 20); xx < x + w; xx += 24) R(r, xx, yy, 1, 5, T.floor2); }
function panelWall(r, x, y, w, h) { R(r, x, y, w, h, T.wall); var py = y + h - 18; R(r, x, py, w, 1, T.wall2); for (var xx = x + 4; xx < x + w; xx += 12) R(r, xx, py + 2, 1, 14, T.wall2); }
var STAGE = { thinking: { pose: "type", mood: "glance", scr: "dots" }, answering: { pose: "wave", mood: "idle", scr: "chart" } };
function accentOf(c) { return kLum(c) < 0.12 ? "#F5F5F4" : c; }
