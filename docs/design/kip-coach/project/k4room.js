var WX = {
  clear: { sky: ["#60A5FA", "#93C5FD"], f: function (r) { R(r, 28, 12, 8, 8, "#FBBF24"); R(r, 29, 11, 6, 1, "#FDE68A"); } },
  mostly: { sky: ["#60A5FA", "#93C5FD"], f: function (r) { R(r, 28, 12, 8, 8, "#FBBF24"); R(r, 14, 25, 14, 4, "#F3F4F6"); R(r, 16, 24, 8, 1, "#FFFFFF"); } },
  cloudy: { sky: ["#8592A6", "#A3AEC0"], f: function (r) { R(r, 30, 12, 6, 5, "#FCD34D"); R(r, 12, 14, 14, 4, "#E5E7EB"); R(r, 14, 13, 8, 1, "#F3F4F6"); R(r, 24, 17, 15, 5, "#CBD5E1"); R(r, 26, 16, 9, 1, "#E2E8F0"); R(r, 12, 29, 12, 3, "#CBD5E1"); } },
  stormy: { sky: ["#2B3546", "#3A4559"], f: function (r) { var x; R(r, 10, 10, 30, 6, "#1E293B"); R(r, 14, 16, 22, 2, "#1E293B"); for (x = 12; x < 40; x += 4) R(r, x, 19 + (x % 3), 1, 3, "#93C5FD"); for (x = 14; x < 40; x += 4) R(r, x, 28 + (x % 2), 1, 3, "#93C5FD"); R(r, 27, 18, 2, 4, "#FDE047"); R(r, 25, 22, 2, 3, "#FDE047"); R(r, 26, 25, 1, 2, "#FDE047"); } },
  night: { sky: ["#0F172A", "#1E1B4B"], f: function (r) { R(r, 30, 13, 6, 6, "#F1F5F9"); R(r, 33, 13, 3, 3, "#0F172A"); [[14, 14], [20, 18], [16, 30], [36, 28], [24, 12]].forEach(function (s) { R(r, s[0], s[1], 1, 1, "#F8FAFC"); }); } }
};
function plant(r, x, y, kind) {
  if (kind === "tall") { R(r, x, y, 8, 7, "#E5E7EB"); R(r, x - 1, y - 1, 10, 2, "#F8FAFC"); R(r, x + 3, y - 14, 2, 13, "#15803D"); R(r, x - 3, y - 16, 6, 4, "#22C55E"); R(r, x + 4, y - 20, 7, 5, "#16A34A"); R(r, x - 2, y - 10, 5, 3, "#4ADE80"); R(r, x + 5, y - 11, 6, 3, "#22C55E"); return; }
  if (kind === "cactus") { R(r, x + 1, y + 2, 6, 5, "#C2410C"); R(r, x + 3, y - 7, 3, 9, "#65A30D"); R(r, x + 1, y - 4, 2, 3, "#65A30D"); R(r, x + 6, y - 5, 2, 3, "#65A30D"); R(r, x + 3, y - 8, 2, 1, "#F472B6"); return; }
  R(r, x, y, 8, 7, "#B45309"); R(r, x - 1, y - 1, 10, 2, "#D97706"); R(r, x + 3, y - 8, 2, 7, "#4ADE80"); R(r, x, y - 6, 3, 2, "#22C55E"); R(r, x + 5, y - 7, 3, 2, "#22C55E"); R(r, x - 1, y - 9, 2, 3, "#16A34A"); R(r, x + 7, y - 10, 2, 3, "#16A34A");
}
// T: theme; o: { weather, scr: lines|dots|chart, kip: cells, accent, night }
function room(T, o) {
  var r = [], W = 130, H = 80, fy = 56, x, y, wx = WX[o.weather] || WX.cloudy, night = o.weather === "night";
  R(r, 0, 0, W, fy, T.wall);
  if (T.pattern === "stripe") for (x = 2; x < W; x += 8) R(r, x, 0, 2, fy, T.wall2);
  if (T.pattern === "dots") for (y = 3; y < fy - 4; y += 6) for (x = (y % 12 === 3 ? 2 : 6); x < W; x += 8) R(r, x, y, 1, 1, T.wall2);
  if (T.pattern === "panel") { R(r, 0, 38, W, 1, T.wall2); for (x = 4; x < W; x += 12) R(r, x, 40, 1, 14, T.wall2); }
  if (T.neon) R(r, 0, 0, W, 1, T.neon);
  R(r, 8, 8, 34, 30, T.trim); R(r, 10, 10, 30, 13, wx.sky[0]); R(r, 10, 23, 30, 13, wx.sky[1]); wx.f(r);
  R(r, 24, 10, 2, 26, T.trim); R(r, 10, 22, 30, 1, T.trim); R(r, 6, 37, 38, 2, T.trim2);
  if (T.art) { R(r, 52, 12, 18, 14, "#1F2937"); R(r, 53, 13, 16, 12, T.art[0]); R(r, 55, 20, 6, 5, T.art[1]); R(r, 58, 18, 4, 7, T.art[1]); R(r, 64, 15, 2, 2, "#FDE68A"); }
  if (T.neon) [[57, 14, 2, 1], [61, 14, 2, 1], [56, 15, 8, 2], [57, 17, 6, 1], [58, 18, 4, 1], [59, 19, 2, 1]].forEach(function (q) { R(r, q[0], q[1], q[2], q[3], T.neon); });
  R(r, 84, 20, 36, 2, T.desk); R(r, 86, 22, 1, 3, T.desk); R(r, 117, 22, 1, 3, T.desk);
  x = 86; (T.shelf || []).forEach(function (c, i) { var h = [7, 5, 8, 6, 4, 7][i % 6]; R(r, x, 20 - h, 3, h, c); x += 4; });
  if (T.trophy) { R(r, 112, 14, 4, 4, "#FACC15"); R(r, 113, 18, 2, 2, "#CA8A04"); }
  if (T.hang) [48, 72].forEach(function (hx) { R(r, hx + 3, 0, 1, 6, "#A3A3A3"); R(r, hx, 6, 7, 4, "#B45309"); R(r, hx - 1, 10, 2, 5, "#22C55E"); R(r, hx + 3, 10, 2, 7, "#16A34A"); R(r, hx + 6, 10, 2, 4, "#4ADE80"); });
  R(r, 0, fy - 2, W, 2, T.trim2);
  R(r, 0, fy, W, H - fy, T.floor);
  for (y = fy + 4; y < H; y += 5) R(r, 0, y, W, 1, T.floor2);
  for (y = fy; y < H; y += 5) for (x = (y % 10 ? 8 : 20); x < W; x += 24) R(r, x, y, 1, 5, T.floor2);
  if (T.rug) { R(r, 30, 68, 60, 7, T.rug); R(r, 30, 69, 60, 1, T.rug2); R(r, 30, 73, 60, 1, T.rug2); }
  if (T.pet) { R(r, 14, 68, 16, 5, T.pet); R(r, 16, 68, 12, 2, kDark(T.pet, 0.7)); }
  (T.plants || []).forEach(function (p) { plant(r, p[0], p[1], p[2]); });
  if (T.floorLamp) { R(r, 48, 26, 1, 46, "#94A3B8"); R(r, 45, 22, 7, 4, T.floorLamp); R(r, 46, 72, 5, 1, "#94A3B8"); }
  R(r, 58, 44, 2, 18, T.chair); R(r, 58, 60, 20, 2, T.chair); R(r, 59, 62, 2, 10, T.chair); R(r, 75, 62, 2, 10, T.chair);
  R(r, 76, 54, 50, 2, T.deskTop); R(r, 76, 56, 50, 2, T.desk); R(r, 78, 58, 2, 14, T.desk); R(r, 122, 58, 2, 14, T.desk); R(r, 104, 58, 16, 7, T.desk); R(r, 111, 61, 2, 1, "#1F2937");
  var ix = 89, iy = 39;
  if (T.setup === "book") { R(r, 88, 50, 22, 4, "#F1F5F9"); R(r, 98, 50, 2, 4, "#CBD5E1"); R(r, 90, 51, 6, 1, "#94A3B8"); R(r, 101, 51, 7, 1, "#94A3B8"); R(r, 90, 52, 5, 1, "#94A3B8"); if (o.scr === "dots") R(r, 99, 46, 3, 5, "#E2E8F0"); ix = -1; }
  else if (T.setup === "dual") { R(r, 80, 40, 20, 11, "#1F2937"); R(r, 81, 41, 18, 9, T.screen); R(r, 82, 43, 10, 1, T.screenLine); R(r, 82, 45, 14, 1, T.screenLine); R(r, 89, 51, 2, 3, "#334155"); R(r, 102, 38, 22, 13, "#1F2937"); R(r, 103, 39, 20, 11, T.screen); R(r, 112, 51, 3, 3, "#334155"); ix = 103; }
  else { R(r, 88, 38, 26, 13, "#1F2937"); R(r, 89, 39, 24, 11, T.screen); R(r, 100, 51, 3, 3, "#334155"); R(r, 96, 53, 11, 1, "#334155"); }
  if (T.setup !== "book") R(r, 84, 53, 12, 1, "#475569");
  if (T.mug) { R(r, 79, 50, 3, 4, "#F1F5F9"); R(r, 82, 51, 1, 2, "#F1F5F9"); }
  if (T.lamp) { R(r, 118, 52, 5, 2, "#334155"); R(r, 120, 44, 1, 8, "#334155"); R(r, 115, 41, 7, 3, T.lamp); }
  r = r.concat(o.kip);
  if (night) R(r, 0, 0, W, H, "rgba(6,8,24,0.45)");
  if (T.lamp) { R(r, 113, 44, 11, 10, night ? "rgba(253,224,71,0.22)" : "rgba(253,224,71,0.12)"); R(r, 115, 41, 7, 3, T.lamp); }
  if (T.floorLamp && night) R(r, 42, 26, 13, 46, "rgba(253,224,71,0.10)");
  if (ix > 0) {
    var L = T.screenLine;
    if (night) R(r, ix, iy, T.setup === "dual" ? 20 : 24, 11, T.screen);
    if (o.scr === "dots") { R(r, ix + 5, iy + 5, 2, 2, o.accent); R(r, ix + 10, iy + 5, 2, 2, o.accent); R(r, ix + 15, iy + 5, 2, 2, o.accent); }
    else if (o.scr === "chart") { [[3, 3], [6, 5], [9, 2], [12, 6], [15, 4]].forEach(function (b) { R(r, ix + b[0], iy + 9 - b[1], 2, b[1], b[0] === 12 ? o.accent : L); }); }
    else { R(r, ix + 2, iy + 2, 10, 1, L); R(r, ix + 2, iy + 4, 16, 1, L); R(r, ix + 2, iy + 6, 8, 1, L); R(r, ix + 2, iy + 8, 13, 1, L); }
  }
  return { w: W * 3, h: H * 3, layers: pxLayers(r, 3) };
}
var STARTER = { wall: "#2A3140", wall2: "#323A4B", pattern: "panel", trim: "#1E2430", trim2: "#191E28", floor: "#5B4636", floor2: "#4A382B", rug: "#475569", rug2: "#334155", desk: "#7C5A3E", deskTop: "#9A7350", chair: "#3F4656", screen: "#0F1A2A", screenLine: "#7DD3FC", setup: "mono", lamp: "#F59E0B", plants: [[2, 64, "fern"]], shelf: ["#60A5FA", "#F87171", "#FDE047"], mug: true };
var STAGE = { idle: ["rest", "blink", "lines", "KIP resting at the desk"], thinking: ["type", "glance", "dots", "KIP typing at the desk"], answering: ["wave", "idle", "chart", "KIP turned round to face you"] };
