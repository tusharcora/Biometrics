// ---- v2 room engine: 170 x 110 cells at 2 px; KIP at 2 cells per KIP pixel ----
WEAR.hachimaki = [[4, 6], ["wwwrrwwwwW", ".........W"], { w: "#F8FAFC", r: "#DC2626", W: "#E5E7EB" }];
WEAR.sweatband = [[4, 6], ["wwwwwwww", "rrrrrrrr"], { w: "#F8FAFC", r: "#2563EB" }];
var RW = 170, RH = 110, FY = 74, VY = 20;
function E(r, cx, cy, rx, ry, c) { for (var y = Math.floor(cy - ry); y < Math.ceil(cy + ry); y++) { var dy = (y + 0.5 - cy) / ry; if (Math.abs(dy) >= 1) continue; var hw = rx * Math.sqrt(1 - dy * dy), x0 = Math.round(cx - hw), x1 = Math.round(cx + hw); if (x1 > x0) R(r, x0, y, x1 - x0, 1, c); } }
function glow(r, cx, cy, rx, ry, rgb, a) { [1, 0.78, 0.56, 0.34].forEach(function (k) { E(r, cx, cy, rx * k, ry * k, "rgba(" + rgb + "," + a + ")"); }); }
function shade(r, cx, cy, rx, ry, a) { a = a || 0.16; E(r, cx, cy, rx, ry, "rgba(0,0,0," + a + ")"); E(r, cx, cy, rx * 0.72, ry * 0.62, "rgba(0,0,0," + a + ")"); }
function px(r, x, y, c) { R(r, x, y, 1, 1, c); }
// vertical gradient with ordered-dither seams between bands
function gradV(r, x, y, w, h, cols) {
  var n = cols.length, i, xx, yb;
  for (i = 0; i < n; i++) { var y0 = Math.round(y + i * h / n), y1 = Math.round(y + (i + 1) * h / n); R(r, x, y0, w, y1 - y0, cols[i]); }
  for (i = 1; i < n; i++) {
    yb = Math.round(y + i * h / n);
    for (xx = x; xx < x + w; xx += 2) px(r, xx, yb, cols[i - 1]);
    for (xx = x + 1; xx < x + w; xx += 4) px(r, xx, yb + 1, cols[i - 1]);
    for (xx = x + 3; xx < x + w; xx += 4) px(r, xx, yb - 1, cols[i]);
  }
}
function clipB(rs, b) { var o = []; rs.forEach(function (q) { var x0 = Math.max(q[0], b[0]), y0 = Math.max(q[1], b[1]), x1 = Math.min(q[0] + q[2], b[0] + b[2]), y1 = Math.min(q[1] + q[3], b[1] + b[3]); if (x1 > x0 && y1 > y0) o.push([x0, y0, x1 - x0, y1 - y0, q[4]]); }); return o; }
function clipC(rs, cx, cy, rad) { var o = []; rs.forEach(function (q) { for (var y = q[1]; y < q[1] + q[3]; y++) { var dy = y + 0.5 - cy; if (Math.abs(dy) >= rad) continue; var hw = Math.sqrt(rad * rad - dy * dy), x0 = Math.max(q[0], Math.round(cx - hw)), x1 = Math.min(q[0] + q[2], Math.round(cx + hw)); if (x1 > x0) o.push([x0, y, x1 - x0, 1, q[4]]); } }); return o; }
function leaf(r, bx, by, tx, ty, w, c, hl) { var mx = (bx + tx) / 2, my = (by + ty) / 2, L = Math.hypot(tx - bx, ty - by) || 1, nx = -(ty - by) / L * w, ny = (tx - bx) / L * w; poly(r, [[bx, by], [mx + nx, my + ny], [tx, ty], [mx - nx, my - ny]], c); if (hl) poly(r, [[bx, by], [mx + nx * 0.6, my + ny * 0.6], [tx, ty], [mx, my]], hl); }
function pot(r, cx, yb, w, h, c, rim) { poly(r, [[cx - w / 2, yb - h], [cx + w / 2, yb - h], [cx + w / 2 - 2, yb], [cx - w / 2 + 2, yb]], c); R(r, Math.round(cx - w / 2 - 1), yb - h - 2, w + 2, 2, rim || kMix(c, "#FFFFFF", 0.2)); poly(r, [[cx + w / 2 - 3, yb - h], [cx + w / 2, yb - h], [cx + w / 2 - 2, yb], [cx + w / 2 - 4, yb]], kDark(c, 0.78)); }
function book(r, x, yb, w, h, c) { R(r, x, yb - h, w, h, c); R(r, x, yb - h, w, 1, kMix(c, "#FFFFFF", 0.28)); R(r, x + w - 1, yb - h, 1, h, kDark(c, 0.72)); if (h > 6) { R(r, x, yb - h + 2, w - 1, 1, kMix(c, "#F5E6B8", 0.45)); R(r, x, yb - 3, w - 1, 1, kMix(c, "#F5E6B8", 0.45)); } }
function bookRow(r, x, yb, x1, cols, seed, hmax) { var i = 0; hmax = hmax || 11; while (x < x1 - 2) { var w = 2 + ((seed + i * 7) % 3 === 0 ? 1 : 0), h = Math.min(hmax, hmax - 4 + ((seed + i * 5) % 5)); if (x + w > x1) break; book(r, x, yb, w, h, cols[(seed + i * 3) % cols.length]); x += w; i++; if ((seed + i) % 11 === 0 && x < x1 - 5) { poly(r, [[x, yb], [x + 2, yb], [x + 5, yb - h + 2], [x + 3, yb - h + 1]], cols[(i + 2) % cols.length]); x += 5; } } }
function kip2(r, c, pose, mood, wear, ox, oy) { var g = kSprite(c, pose, mood, wear); for (var y = 0; y < KN; y++) for (var x = 0; x < KN; x++) if (g[y][x]) R(r, ox + x * 2, oy + y * 2, 2, 2, g[y][x]); }
// back wall + side walls + floor in one-point perspective
function shell(r, wallCols, side, floorC) {
  gradV(r, 10, 0, 150, FY, wallCols);
  poly(r, [[0, 0], [10, 0], [10, FY], [0, FY + 12]], side); poly(r, [[160, 0], [170, 0], [170, FY + 12], [160, FY]], side);
  poly(r, [[10, FY], [160, FY], [170, FY + 12], [170, RH], [0, RH], [0, FY + 12]], floorC);
}
function seamX(xb) { return 85 + (xb - 85) * (RH - VY) / (FY - VY); }
function floorSeams(r, step, c, ys) { for (var xb = 10 + step; xb < 160; xb += step) { var xf = seamX(xb); poly(r, [[xb, FY], [xb + 1, FY], [xf + 1, RH], [xf, RH]], c); } (ys || []).forEach(function (y) { var xl = y < FY + 12 ? 10 - (y - FY) * 10 / 12 : 0; R(r, Math.round(xl), y, Math.round(RW - 2 * xl), 1, c); }); }
function ao(r) {
  R(r, 0, 0, RW, 2, "rgba(0,0,0,0.22)"); R(r, 0, 2, RW, 3, "rgba(0,0,0,0.1)");
  R(r, 10, 0, 3, FY, "rgba(0,0,0,0.14)"); R(r, 13, 0, 3, FY, "rgba(0,0,0,0.06)"); R(r, 157, 0, 3, FY, "rgba(0,0,0,0.14)"); R(r, 154, 0, 3, FY, "rgba(0,0,0,0.06)");
  R(r, 10, FY - 3, 150, 3, "rgba(0,0,0,0.08)"); R(r, 10, FY - 1, 150, 1, "rgba(0,0,0,0.1)"); R(r, 10, FY, 150, 2, "rgba(0,0,0,0.16)"); R(r, 8, FY + 2, 154, 2, "rgba(0,0,0,0.07)");
  poly(r, [[0, 0], [10, 0], [10, FY], [0, FY + 12]], "rgba(0,0,0,0.12)"); poly(r, [[160, 0], [170, 0], [170, FY + 12], [160, FY]], "rgba(0,0,0,0.18)");
  R(r, 0, RH - 3, RW, 3, "rgba(0,0,0,0.12)");
}
// window sky with smooth sun, puffy clouds, rain, moon
var SK2 = { clear: ["#3B82F6", "#5596F8", "#71AAFA", "#93C1FC"], mostly: ["#3F86F6", "#5998F8", "#76ADFA", "#9CC6FC"], cloudy: ["#66758D", "#76849B", "#8794AA", "#9EA9BC"], stormy: ["#192131", "#202A3A", "#283244", "#323D52"], night: ["#060A17", "#0A1122", "#0F1830", "#1A1A45"] };
function puff(t, cx, cy, s, base, hl, sh) { E(t, cx, cy + s * 0.35, s * 1.7, s * 0.5, sh); E(t, cx - s * 0.7, cy + s * 0.05, s * 0.75, s * 0.6, base); E(t, cx + s * 0.6, cy, s * 0.85, s * 0.68, base); E(t, cx - s * 0.05, cy - s * 0.35, s * 0.7, s * 0.66, base); E(t, cx - s * 0.2, cy - s * 0.7, s * 0.4, s * 0.22, hl); }
function sky2(r, b, wx, circle) {
  var t = [], x = b[0], y = b[1], w = b[2], h = b[3], i, s = Math.max(4, Math.round(h * 0.14));
  gradV(t, x, y, w, h, SK2[wx] || SK2.cloudy);
  var sx = x + w * 0.72, sy = y + h * 0.27;
  if (wx === "clear" || wx === "mostly") { glow(t, sx, sy, s * 2.8, s * 2.8, "253,230,138", 0.1); E(t, sx, sy, s, s, "#FCD34D"); E(t, sx - s * 0.25, sy - s * 0.25, s * 0.62, s * 0.62, "#FDE68A"); }
  if (wx === "mostly") puff(t, x + w * 0.3, y + h * 0.62, s * 1.1, "#F3F5F9", "#FFFFFF", "#D6DCE6");
  if (wx === "cloudy") { E(t, sx, sy, s * 0.8, s * 0.8, "#E9D9A6"); puff(t, x + w * 0.28, y + h * 0.36, s * 1.2, "#DCE1E8", "#EEF1F5", "#B9C1CD"); puff(t, x + w * 0.74, y + h * 0.56, s * 1.3, "#C7CFDA", "#DCE1E8", "#A9B3C2"); puff(t, x + w * 0.2, y + h * 0.84, s, "#BAC3D0", "#CDD4DE", "#A0AABA"); }
  if (wx === "stormy") { puff(t, x + w * 0.3, y + h * 0.22, s * 1.5, "#2A3446", "#3A465C", "#1A2130"); puff(t, x + w * 0.76, y + h * 0.3, s * 1.4, "#252F40", "#354157", "#161C29"); for (i = 0; i < w; i += 3) { var yy = y + h * 0.45 + ((i * 7) % 11); px(t, x + i, Math.round(yy), "#8FB4E8"); px(t, x + i + 1, Math.round(yy) + 1, "#8FB4E8"); px(t, x + i + 1, Math.round(yy + h * 0.25) % (y + h) || y + 1, "rgba(143,180,232,0.6)"); } poly(t, [[x + w * 0.56, y + h * 0.38], [x + w * 0.6, y + h * 0.38], [x + w * 0.55, y + h * 0.56], [x + w * 0.58, y + h * 0.56], [x + w * 0.5, y + h * 0.78], [x + w * 0.52, y + h * 0.58], [x + w * 0.49, y + h * 0.58]], "#FDE047"); }
  if (wx === "night") { glow(t, sx, sy, s * 2.4, s * 2.4, "226,232,240", 0.06); E(t, sx, sy, s, s, "#EEF2F7"); E(t, sx + s * 0.35, sy - s * 0.2, s * 0.8, s * 0.8, SK2.night[1]); [[0.12, 0.2], [0.3, 0.12], [0.22, 0.55], [0.45, 0.35], [0.86, 0.7], [0.6, 0.62], [0.08, 0.8], [0.4, 0.82]].forEach(function (q) { px(t, Math.round(x + w * q[0]), Math.round(y + h * q[1]), "#F8FAFC"); }); }
  (circle ? clipC(t, circle[0], circle[1], circle[2]) : clipB(t, b)).forEach(function (q) { r.push(q); });
}
var DAYA = { clear: 0.11, mostly: 0.09, cloudy: 0.05, stormy: 0.03, night: 0 };
function daylight(r, wx, x0, x1, ybot) { var a = DAYA[wx] || 0; if (!a) return; poly(r, [[x0 + 2, ybot], [x1 + 2, ybot], [x1 + 30, RH], [x0 + 12, RH]], "rgba(255,241,210," + a + ")"); poly(r, [[x0 + 6, ybot + 6], [x1 - 2, ybot + 6], [x1 + 20, RH], [x0 + 16, RH]], "rgba(255,241,210," + (a * 0.6).toFixed(3) + ")"); }
function nightVeil(r) { R(r, 0, 0, RW, RH, "rgba(6,8,24,0.56)"); }
function pic2(r, u) { return { w: RW * u, h: RH * u, layers: pxLayers(r, u) }; }
// a v2 room: base, light, emissive, 3 animation frames
function room2(S, o) {
  var r = [], night = o.night, wx = night ? "night" : S.weather;
  var c = { wx: wx, night: night, kc: o.kc, alt: o.alt };
  S.draw(r, c);
  ao(r);
  if (!night) daylight(r, wx, S.win[0], S.win[1], S.win[2]); else nightVeil(r);
  S.emit(r, c);
  var fr = S.frames ? S.frames(c) : [[], [], []];
  return { r: r, fr: fr };
}
