// ---- shared props ----
function cat2(r, x, y, c, patch) {
  shade(r, x + 11, y + 10, 13, 2);
  E(r, x + 10, y + 6, 10, 4.5, c); E(r, x + 9, y + 4.2, 7, 1.8, kMix(c, "#FFFFFF", 0.22));
  E(r, x + 4, y + 8.6, 6, 1.6, kDark(c, 0.86)); R(r, x + 2, y + 10, 16, 1, kDark(c, 0.7));
  E(r, x + 18, y + 4, 4.2, 4, c);
  poly(r, [[x + 14.5, y + 2], [x + 15.5, y - 3], [x + 18, y + 0.5]], c); poly(r, [[x + 18.5, y + 0.5], [x + 21, y - 3], [x + 22, y + 2]], c);
  px(r, x + 16, y - 1, "#E8A0A0"); px(r, x + 20, y - 1, "#E8A0A0");
  R(r, x + 16, y + 4, 2, 1, "#1F1A17"); R(r, x + 19, y + 4, 2, 1, "#1F1A17");
  if (patch) { E(r, x + 7, y + 5, 3.4, 2.2, patch); E(r, x + 19.5, y + 2, 1.6, 1.4, patch); }
}
function dog2(r, x, y, c) {
  shade(r, x + 9, y + 21, 11, 2);
  E(r, x + 9, y + 14, 7, 6.5, c); E(r, x + 9, y + 16, 3.6, 4, kMix(c, "#FFFFFF", 0.4));
  R(r, x + 5, y + 18, 3, 3, c); R(r, x + 11, y + 18, 3, 3, c); R(r, x + 5, y + 20, 3, 1, kDark(c, 0.8)); R(r, x + 11, y + 20, 3, 1, kDark(c, 0.8));
  E(r, x + 9, y + 6, 5.6, 5, c); E(r, x + 9, y + 9, 3, 2.2, kMix(c, "#FFFFFF", 0.4));
  poly(r, [[x + 3, y + 3], [x + 6, y + 2], [x + 5.5, y + 10], [x + 3, y + 9]], kDark(c, 0.72)); poly(r, [[x + 12, y + 2], [x + 15, y + 3], [x + 15, y + 9], [x + 12.5, y + 10]], kDark(c, 0.72));
  R(r, x + 8, y + 8, 2, 1, "#1F1A17"); px(r, x + 6, y + 5, "#1F1A17"); px(r, x + 12, y + 5, "#1F1A17"); px(r, x + 9, y + 11, "#E8858A");
}
function chair(r, x, y, c, hl) { shade(r, x + 16, y + 12, 18, 2); R(r, x, y - 26, 3, 28, c); R(r, x, y - 26, 1, 28, hl); R(r, x, y, 32, 3, c); R(r, x, y, 32, 1, hl); R(r, x + 2, y + 3, 2, 9, kDark(c, 0.8)); R(r, x + 28, y + 3, 2, 9, kDark(c, 0.8)); }
function desk(r, x0, x1, top, legC, topC, depth) {
  shade(r, (x0 + x1) / 2, top + 26, (x1 - x0) / 2 + 4, 3, 0.12);
  R(r, x0 + 2, top + 3, 3, 24, kDark(legC, 0.85)); R(r, x1 - 5, top + 3, 3, 24, kDark(legC, 0.85));
  R(r, x0, top, x1 - x0, depth || 3, topC); R(r, x0, top, x1 - x0, 1, kMix(topC, "#FFFFFF", 0.22)); R(r, x0, top + (depth || 3), x1 - x0, 2, legC);
}
function lamp2(r, x, yb, shadeC, armC) { R(r, x - 3, yb - 2, 8, 2, armC); R(r, x, yb - 14, 2, 12, armC); poly(r, [[x - 5, yb - 14], [x + 2, yb - 19], [x + 5, yb - 16], [x - 2, yb - 11]], shadeC); poly(r, [[x - 2, yb - 11], [x + 5, yb - 16], [x + 5, yb - 15], [x - 1, yb - 10]], kDark(shadeC, 0.7)); }
function screen2(r, x, y, w, h, frameC, glowC, mode, accent) {
  R(r, x, y, w, h, frameC); gradV(r, x + 1, y + 1, w - 2, h - 2, [kDark(glowC, 0.35), kDark(glowC, 0.42), kDark(glowC, 0.5)]);
  if (mode === "chart") [[3, 4], [7, 7], [11, 3], [15, 9], [19, 6]].forEach(function (q, k) { if (x + q[0] + 3 < x + w - 1) R(r, x + q[0], y + h - 2 - q[1], 3, q[1], k === 3 ? accent : glowC); });
  else { [3, 6, 9, 12].forEach(function (yy, k) { if (y + yy < y + h - 2) R(r, x + 3, y + yy, [w - 10, w - 14, w - 8, w - 16][k], 1, glowC); }); }
}

// ================= JAPANESE =================
function lantern(r, x, night) {
  var body = night ? "#FFE7B0" : "#F4E3C1", rib = night ? "#E9C98A" : "#D9C59C";
  R(r, x, 0, 1, 12, "#3B2619"); R(r, x - 3, 12, 7, 2, "#2A1C14");
  E(r, x + 0.5, 21, 6, 8, body); E(r, x - 1.5, 19, 2.5, 5, kMix(body, "#FFFFFF", 0.35));
  R(r, x - 5, 16, 11, 1, rib); R(r, x - 6, 20, 13, 1, rib); R(r, x - 5, 24, 11, 1, rib); R(r, x - 4, 27, 9, 1, rib);
  R(r, x - 3, 28, 7, 2, "#2A1C14"); R(r, x, 30, 1, 3, "#C8553D"); R(r, x - 1, 33, 3, 2, "#C8553D");
}
var JP = {
  id: "Japanese", color: "#FB7185", alt: "#2A2F3A", altName: "Ink", weather: "cloudy", unlock: "Steady bedtime · III", owned: false,
  pal: [["Shoji paper", "#EFE6D2"], ["Paper shade", "#D9CCB0"], ["Cedar", "#5A3A2A"], ["Dark cedar", "#3B2619"], ["Tatami", "#B9B37A"], ["Tatami edge", "#2F3B2A"], ["Indigo", "#2B3A67"], ["Vermilion", "#C8553D"]],
  items: [["Wallpaper", "Shoji screens, paper glow"], ["Floor", "Tatami, woven"], ["Window", "Engawa view with noren"], ["Art", "Wave scroll in the alcove"], ["Shelf", "Tokonoma tea set"], ["Desk", "Low cedar table"], ["Desk item", "Notebook and matcha bowl"], ["Plant", "Bonsai on a stand"], ["Lamp", "Paper lantern · sways"], ["Corner", "Gold byobu screen"], ["Rug", "Indigo goza mat"], ["Pet", "Calico cat"]],
  worn: [["Head", "Hachimaki"]], wear: ["hachimaki"], win: [14, 48, 56], anim: "Lantern sways",
  draw: function (r, c) {
    var x, y;
    shell(r, ["#3B2619", "#3B2619"], "#4A3020", "#B9B37A");
    gradV(r, 10, 4, 150, 52, ["#F4ECDC", "#EFE6D2", "#E8DEC6", "#DED2B6"]);
    for (x = 20; x < 160; x += 10) R(r, x, 4, 1, 52, "#8A6448");
    for (y = 12; y < 56; y += 8) R(r, 10, y, 150, 1, "#8A6448");
    for (x = 10; x <= 160; x += 30) R(r, x - 1, 2, 3, 57, "#5A3A2A");
    R(r, 10, 2, 150, 3, "#5A3A2A"); R(r, 10, 56, 150, 3, "#5A3A2A");
    gradV(r, 10, 59, 150, 15, ["#5A3A2A", "#4E3224", "#45291D"]); R(r, 10, 59, 150, 1, "#7A5238");
    // tatami
    for (y = FY + 2; y < RH; y += 2) { var xl = y < FY + 12 ? Math.round(10 - (y - FY) * 10 / 12) : 0; R(r, xl, y, RW - 2 * xl, 1, "#ADA76F"); }
    floorSeams(r, 38, "#2F3B2A", [92]);
    // engawa opening
    sky2(r, [14, 5, 34, 30], c.wx);
    E(r, 20, 34, 8, 4, "#4B6B3A"); E(r, 33, 33, 9, 5, "#4B6B3A"); E(r, 44, 35, 6, 3, "#4B6B3A"); R(r, 14, 34, 34, 9, "#4B6B3A"); E(r, 30, 31, 5, 2, "#5E8048");
    R(r, 39, 20, 2, 16, "#4A2F20"); E(r, 40, 20, 7, 5.5, "#C2410C"); E(r, 37, 23, 4, 3, "#EA580C"); E(r, 41, 18, 3.5, 2, "#F97316");
    R(r, 14, 42, 34, 6, "#6B7F4A"); E(r, 22, 45, 3, 1, "#A3A3A3"); E(r, 31, 46, 3, 1, "#A3A3A3");
    R(r, 14, 48, 34, 8, "#8A6A48"); R(r, 14, 48, 34, 1, "#A88A64"); R(r, 14, 51, 34, 1, "#6E5236"); R(r, 14, 54, 34, 1, "#6E5236");
    R(r, 12, 3, 3, 54, "#5A3A2A"); R(r, 48, 3, 3, 54, "#5A3A2A"); R(r, 13, 5, 37, 1, "#2A1C14");
    for (x = 15; x < 46; x += 11) { R(r, x, 6, 10, 14, "#2B3A67"); R(r, x + 9, 6, 1, 14, "#1E2A4E"); R(r, x, 19, 10, 1, "#1E2A4E"); R(r, x, 6, 1, 14, "#3A4B80"); }
    E(r, 31.5, 12, 3, 3, "#E9E1CF"); E(r, 31.5, 12, 1.6, 1.6, "#2B3A67");
    // tokonoma alcove + scroll + tea set
    R(r, 70, 6, 26, 56, "#D3C4A5"); R(r, 70, 6, 26, 3, "rgba(0,0,0,0.14)"); R(r, 70, 6, 3, 56, "rgba(0,0,0,0.1)"); R(r, 96, 3, 3, 71, "#6B4A33"); R(r, 97, 3, 1, 71, "#8A6448");
    R(r, 68, 62, 30, 4, "#5A3A2A"); R(r, 68, 62, 30, 1, "#7A5238"); R(r, 68, 66, 30, 8, "#45291D");
    R(r, 82, 6, 1, 3, "#3B2619"); R(r, 75, 9, 16, 1, "#3B2619"); R(r, 77, 10, 12, 1, "rgba(0,0,0,0.15)");
    gradV(r, 76, 10, 14, 34, ["#F7F0E1", "#F1E8D4", "#EAE0C8"]); R(r, 76, 10, 14, 2, "#8C6A4A"); R(r, 76, 42, 14, 2, "#8C6A4A");
    E(r, 86, 18, 2.4, 2.4, "#C8553D"); E(r, 81, 33, 5, 3.2, "#2B3A67"); E(r, 82, 32.2, 3.4, 1.8, "#F1E8D4"); E(r, 87, 37, 3.6, 2.4, "#2B3A67"); E(r, 87.5, 36.3, 2.2, 1.2, "#EAE0C8"); px(r, 79, 30, "#F8FAFC"); px(r, 84, 34, "#F8FAFC");
    R(r, 75, 44, 16, 2, "#3B2619"); R(r, 74, 44, 1, 2, "#C9A05A"); R(r, 91, 44, 1, 2, "#C9A05A");
    R(r, 73, 61, 22, 1, "rgba(0,0,0,0.2)");
    R(r, 74, 52, 7, 1, "#2E3A33"); R(r, 74, 52, 1, 4, "#2E3A33"); R(r, 80, 52, 1, 4, "#2E3A33"); E(r, 77.5, 58, 4, 3.4, "#3F4F45"); E(r, 76.5, 57, 2, 1.4, "#5C6E62"); E(r, 77.5, 55, 2, 0.9, "#2E3A33");
    poly(r, [[80.5, 57], [84, 54], [84.5, 55], [81.5, 59]], "#3F4F45");
    R(r, 85, 58, 3, 3, "#E8E1D3"); R(r, 85, 58, 3, 1, "#F8F4EC"); R(r, 89, 58, 3, 3, "#E8E1D3"); R(r, 89, 58, 3, 1, "#F8F4EC"); R(r, 92, 55, 3, 6, "#8C2F2A"); R(r, 92, 55, 3, 1, "#B0453D");
    // byobu screen (corner)
    shade(r, 60, 87, 10, 2);
    poly(r, [[52, 36], [57, 38], [57, 88], [52, 86]], "#C9A86A"); poly(r, [[57, 38], [62, 36], [62, 86], [57, 88]], "#A98A52"); poly(r, [[62, 36], [67, 38], [67, 88], [62, 86]], "#C9A86A");
    poly(r, [[52, 46], [57, 48], [57, 50], [52, 48]], "#E6CD90"); poly(r, [[62, 46], [67, 48], [67, 50], [62, 48]], "#E6CD90");
    [[52, 36, 86], [57, 38, 88], [62, 36, 86], [67, 38, 88]].forEach(function (q) { R(r, q[0], q[1], 1, q[2] - q[1], "#6B4A2F"); }); poly(r, [[52, 36], [57, 38], [62, 36], [67, 38], [67, 39], [62, 37], [57, 39], [52, 37]], "#6B4A2F");
    E(r, 54.5, 66, 1.6, 4, "#4D7C3A"); E(r, 64.5, 70, 1.6, 4, "#4D7C3A"); px(r, 59, 58, "#F8FAFC"); px(r, 60, 57, "#F8FAFC");
    // goza mat + cat
    poly(r, [[30, 91], [86, 91], [92, 104], [24, 104]], "#2B3A67"); poly(r, [[32, 92], [84, 92], [89, 103], [27, 103]], "#34467A");
    for (y = 94; y < 103; y += 2) R(r, Math.round(31 - (y - 92) * 0.4), y, Math.round(54 + (y - 92) * 0.8), 1, "#2E3D6E");
    cat2(r, 44, 90, "#F2E8DA", "#D9822B");
    // low table + KIP
    kip2(r, c.kc, "type", "glance", JP.wear, 106, 49);
    shade(r, 124, 92, 34, 2.5);
    R(r, 94, 85, 3, 7, "#3B2619"); R(r, 151, 85, 3, 7, "#3B2619");
    R(r, 92, 79, 64, 3, "#6B4530"); R(r, 92, 79, 64, 1, "#8C6244"); R(r, 92, 82, 64, 3, "#4A2F20");
    R(r, 110, 77, 14, 2, "#F4EFE3"); R(r, 117, 77, 1, 2, "#C9BFA8"); R(r, 111, 77, 5, 1, "#FFFFFF");
    E(r, 134, 77.5, 4.2, 2.4, "#454B44"); R(r, 130, 75, 8, 1, "#6B726A"); R(r, 131, 75, 6, 1, "#7FA35A"); R(r, 141, 73, 2, 6, "#D9C79E"); R(r, 141, 73, 2, 1, "#EFE3C3");
    R(r, 108, 79, 40, 1, "rgba(0,0,0,0.18)");
    // bonsai (foreground)
    shade(r, 15, 107, 15, 2);
    R(r, 2, 98, 26, 3, "#3B2619"); R(r, 2, 98, 26, 1, "#5A3A2A"); R(r, 4, 101, 2, 7, "#2A1C14"); R(r, 24, 101, 2, 7, "#2A1C14");
    R(r, 6, 92, 18, 6, "#2B3A67"); R(r, 5, 91, 20, 2, "#3E4F86"); R(r, 21, 92, 3, 6, "#1E2A4E"); R(r, 6, 91, 18, 1, "#6B8F3A");
    poly(r, [[12, 91], [16, 91], [18, 84], [15, 79], [17, 74], [14, 75], [12, 80], [13, 85]], "#5A3A2A"); poly(r, [[15, 80], [23, 76], [23, 77.5], [16, 82]], "#5A3A2A"); poly(r, [[13, 83], [7, 79], [7, 80.5], [13, 85]], "#5A3A2A");
    E(r, 21, 74, 6, 3, "#3F6B32"); E(r, 9, 77.5, 5, 2.6, "#3F6B32"); E(r, 15.5, 69, 5.5, 3, "#3F6B32");
    E(r, 20.5, 73, 4, 1.6, "#6E9A4A"); E(r, 8.5, 76.6, 3.2, 1.3, "#6E9A4A"); E(r, 15, 68, 3.6, 1.6, "#6E9A4A");
  },
  emit: function (r, c) {
    if (c.night) { R(r, 10, 4, 150, 52, "rgba(255,206,140,0.06)"); glow(r, 140, 22, 44, 34, "253,200,130", 0.06); glow(r, 126, 82, 36, 8, "253,200,130", 0.08); }
    else glow(r, 140, 22, 16, 16, "253,208,140", 0.04);
  },
  frames: function (c) { return [-1, 0, 1].map(function (d) { var f = []; lantern(f, 140 + d, c.night); return f; }); }
};

// ================= HOME GYM =================
var GYM = {
  id: "Home gym", color: "#3B82F6", alt: "#3B82F6", altName: "Cobalt", weather: "clear", unlock: "Step goal · IV", owned: false,
  pal: [["Concrete", "#5B6270"], ["Concrete light", "#737B8A"], ["Rubber", "#1F2329"], ["Rubber fleck", "#3A414C"], ["Steel", "#9AA3B2"], ["Cobalt", "#3B82F6"], ["Amber", "#F59E0B"], ["Towel", "#E5E7EB"]],
  items: [["Wallpaper", "Painted concrete, cobalt band"], ["Floor", "Rubber tiles"], ["Window", "Half-raised blinds"], ["Art", "Full-length mirror"], ["Shelf", "Trophy, chalk bag, towel"], ["Desk", "Steel bench desk"], ["Desk item", "Laptop and water jug"], ["Plant", "Snake plant"], ["Lamp", "Amber cage pendant"], ["Corner", "Dumbbell rack with plates"], ["Rug", "Cobalt training mat"], ["Pet", "Pixel dog · tail wags"]],
  worn: [["Head", "Sweatband"], ["Neck", "Gym towel"]], wear: ["sweatband", "towel"], win: [16, 56, 46], anim: "Dog's tail wags",
  draw: function (r, c) {
    var x, y;
    shell(r, ["#69717F", "#636B79", "#5B6270", "#535A67"], "#474D58", "#1F2329");
    for (y = 14; y < FY; y += 18) R(r, 10, y, 150, 1, "#545B68");
    for (x = 13; x < 160; x += 7) for (y = 3 + (x % 5); y < FY; y += 9) px(r, x, y, (x + y) % 3 ? "#6E7684" : "#565D6A");
    R(r, 10, 40, 150, 4, "#3B82F6"); R(r, 10, 40, 150, 1, "#60A5FA"); R(r, 10, 44, 150, 1, "#1E40AF");
    // rubber tiles
    floorSeams(r, 15, "#15181D", [80, 88, 98]);
    for (x = 3; x < 168; x += 5) for (y = FY + 3 + (x % 4); y < RH; y += 6) px(r, x, y, (x * y) % 3 ? "#2C323A" : "#3A414C");
    // window + blinds
    R(r, 14, 6, 44, 42, "#2B3039"); sky2(r, [16, 8, 40, 38], c.wx);
    for (y = 8; y < 30; y += 3) { R(r, 16, y, 40, 2, "#D9DDE3"); R(r, 16, y + 1, 40, 1, "#B9BFC8"); }
    R(r, 16, 30, 40, 2, "#AEB4BD"); R(r, 52, 8, 1, 34, "#9AA3B2"); R(r, 51, 42, 3, 2, "#9AA3B2"); R(r, 13, 46, 46, 2, "#3A404A"); R(r, 13, 46, 46, 1, "#8B93A1");
    // mirror (art)
    shade(r, 80, 74, 14, 1.5, 0.12);
    R(r, 64, 4, 32, 70, "#14171C"); gradV(r, 66, 6, 28, 66, ["#9FB1C4", "#8EA1B6", "#7F92A8", "#71849A"]);
    poly(r, [[70, 6], [76, 6], [66, 18], [66, 12]], "rgba(255,255,255,0.18)"); poly(r, [[84, 6], [87, 6], [66, 40], [66, 36]], "rgba(255,255,255,0.12)");
    R(r, 66, 64, 28, 8, "rgba(31,35,41,0.35)");
    // shelf
    R(r, 112, 24, 44, 2, "#2B3039"); R(r, 112, 24, 44, 1, "#9AA3B2"); R(r, 114, 26, 1, 3, "#2B3039"); R(r, 153, 26, 1, 3, "#2B3039");
    R(r, 116, 10, 8, 6, "#F59E0B"); E(r, 120, 16, 3, 2, "#F59E0B"); R(r, 119, 17, 2, 4, "#D97706"); R(r, 116, 21, 8, 3, "#334155"); R(r, 117, 11, 2, 4, "#FCD34D"); R(r, 114, 11, 2, 3, "#D97706"); R(r, 124, 11, 2, 3, "#D97706");
    E(r, 133, 19.5, 5, 4.5, "#E5E7EB"); R(r, 129, 14, 8, 2, "#CBD5E1"); R(r, 132, 12, 1, 3, "#94A3B8"); R(r, 135, 12, 1, 3, "#94A3B8"); E(r, 131.5, 18, 1.6, 2, "#F8FAFC"); px(r, 139, 23, "rgba(255,255,255,0.6)"); px(r, 141, 22, "rgba(255,255,255,0.4)");
    R(r, 142, 18, 12, 6, "#3B82F6"); R(r, 142, 18, 12, 1, "#60A5FA"); R(r, 142, 21, 12, 1, "#1E40AF");
    // corner: dumbbell rack + plates
    shade(r, 58, 90, 15, 2.5);
    E(r, 30, 82, 7, 7, "#2A2F38"); E(r, 30, 82, 2, 2, "#9AA3B2"); E(r, 35, 84, 6, 6, "#333A45"); E(r, 35, 84, 1.6, 1.6, "#9AA3B2"); shade(r, 33, 91, 9, 1.5);
    R(r, 48, 58, 2, 32, "#4B5563"); R(r, 66, 58, 2, 32, "#4B5563"); poly(r, [[48, 66], [68, 64], [68, 66], [48, 68]], "#6B7280"); poly(r, [[48, 78], [68, 76], [68, 78], [48, 80]], "#6B7280");
    [[50, 62, "#DC2626"], [58, 61, "#DC2626"], [50, 74, "#2563EB"], [58, 73, "#2563EB"]].forEach(function (d) { R(r, d[0], d[1], 3, 4, kDark(d[2], 0.8)); R(r, d[0] + 3, d[1] + 1, 3, 2, "#9AA3B2"); R(r, d[0] + 6, d[1], 3, 4, d[2]); R(r, d[0] + 6, d[1], 3, 1, kMix(d[2], "#FFFFFF", 0.3)); });
    R(r, 46, 88, 24, 2, "#374151");
    // mat + dog
    poly(r, [[24, 92], [76, 92], [82, 106], [16, 106]], "#1E40AF"); poly(r, [[24, 92], [76, 92], [77, 94], [23, 94]], "#3B82F6"); R(r, 18, 104, 63, 1, "#1E3A8A");
    // bench desk + items
    desk(r, 108, 160, 62, "#374151", "#4B5563");
    screen2(r, 118, 44, 24, 16, "#1F2937", "#7DD3FC", "chart", c.kc); R(r, 114, 60, 32, 2, "#9AA3B2");
    R(r, 147, 46, 9, 16, "rgba(147,197,253,0.55)"); R(r, 147, 50, 9, 12, "rgba(59,130,246,0.55)"); R(r, 148, 44, 7, 2, "#1E3A8A"); R(r, 147, 47, 1, 14, "rgba(255,255,255,0.5)"); R(r, 156, 49, 2, 1, "rgba(147,197,253,0.7)"); R(r, 157, 49, 1, 7, "rgba(147,197,253,0.7)");
    R(r, 110, 61, 50, 1, "rgba(0,0,0,0.2)");
    chair(r, 74, 88, "#2B3039", "#4B5563"); R(r, 74, 62, 3, 14, "#E5E7EB"); R(r, 74, 62, 3, 1, "#F8FAFC");
    kip2(r, c.kc, "type", "glance", GYM.wear, 78, 58);
    dog2(r, 124, 74, "#C08A55");
    // snake plant foreground
    shade(r, 14, 107, 12, 2);
    leaf(r, 10, 98, 6, 66, 2.4, "#2F6B3A", "#4E8F4E"); leaf(r, 13, 98, 14, 60, 2.6, "#2F6B3A", "#5BA05A"); leaf(r, 16, 98, 22, 70, 2.4, "#2F6B3A", "#4E8F4E"); leaf(r, 12, 98, 10, 72, 2, "#3C7A42", "#C9D96A");
    pot(r, 13, 107, 14, 10, "#E5E7EB", "#F8FAFC");
  },
  emit: function (r, c) {
    R(r, 100, 0, 1, 12, "#1F2937"); R(r, 97, 12, 7, 2, "#1F2937"); E(r, 100.5, 17, 3, 3.5, c.night ? "#FFD27A" : "#F59E0B"); R(r, 97, 15, 7, 1, "#1F2937"); R(r, 97, 18, 7, 1, "#1F2937"); R(r, 100, 13, 1, 9, "#1F2937");
    glow(r, 100, 17, c.night ? 40 : 14, c.night ? 32 : 14, "245,170,60", c.night ? 0.07 : 0.05);
    if (c.night) { glow(r, 130, 52, 20, 12, "125,211,252", 0.06); glow(r, 92, 96, 40, 8, "245,170,60", 0.06); }
  },
  frames: function (c) { return [0, 1, 0].map(function (k) { var f = []; poly(f, k ? [[140, 90], [143, 84], [144, 85], [141, 91]] : [[140, 91], [145, 88], [145, 89.5], [140, 92]], "#C08A55"); return f; }); }
};

// ================= GAMER NIGHT =================
var GAMER = {
  id: "Gamer night", color: "#C4B5FD", alt: "#C4B5FD", altName: "Lilac", weather: "cloudy", unlock: "Any family · level IV", owned: false,
  pal: [["Night violet", "#1A1530"], ["Violet", "#241C42"], ["Carpet", "#2A2340"], ["Neon pink", "#F472B6"], ["Neon cyan", "#22D3EE"], ["Lilac", "#C4B5FD"], ["Screen blue", "#60A5FA"], ["Desk black", "#111827"]],
  items: [["Wallpaper", "Violet wall, neon strips"], ["Floor", "Dark plush carpet"], ["Window", "Blackout blind, fairy lights"], ["Art", "Two pixel posters"], ["Shelf", "Figures, cartridges, a can"], ["Desk", "Black desk with cable tidy"], ["Desk item", "Dual screens and controller"], ["Plant", "Cactus under neon"], ["Lamp", "Neon bolt · flickers"], ["Corner", "Bean bag"], ["Rug", "Rainbow rug"], ["Pet", "Hamster"]],
  worn: [["Ears", "Headphones"]], wear: ["phones"], win: [14, 44, 46], anim: "Neon bolt flickers, fairy lights chase",
  draw: function (r, c) {
    var x, y;
    shell(r, ["#120F24", "#16122C", "#1A1530", "#1E1838"], "#100D20", "#2A2340");
    for (x = 12; x < 168; x += 3) for (y = FY + 2 + (x % 3); y < RH; y += 4) px(r, x, y, (x + y) % 2 ? "#322A4C" : "#241E38");
    // window w/ blind
    R(r, 12, 8, 34, 40, "#0B0918"); sky2(r, [14, 10, 30, 36], c.wx); gradV(r, 14, 10, 30, 20, ["#2E2550", "#2A2249", "#262044"]); R(r, 14, 29, 30, 2, "#3A3060"); R(r, 28, 31, 2, 3, "#C4B5FD"); R(r, 11, 46, 36, 2, "#2A2346");
    // posters
    R(r, 64, 8, 16, 22, "#0F172A"); gradV(r, 65, 9, 14, 20, ["#312E81", "#4C1D95", "#6D28D9"]); poly(r, [[72, 12], [76, 20], [68, 20]], "#E5E7EB"); R(r, 70, 20, 4, 3, "#F472B6"); px(r, 67, 13, "#F8FAFC"); px(r, 77, 24, "#F8FAFC"); px(r, 66, 26, "#22D3EE");
    R(r, 84, 12, 14, 18, "#0F172A"); R(r, 85, 13, 12, 16, "#0E7490"); E(r, 89, 19, 2.4, 2.4, "#F472B6"); E(r, 93, 19, 2.4, 2.4, "#F472B6"); poly(r, [[87, 20], [95, 20], [91, 25]], "#F472B6");
    // shelf
    R(r, 112, 22, 44, 2, "#0B0918"); R(r, 114, 16, 4, 6, "#A3E635"); E(r, 116, 14, 2.4, 2.4, "#A3E635"); px(r, 115, 14, "#111827"); px(r, 117, 14, "#111827");
    R(r, 121, 15, 5, 7, "#F472B6"); R(r, 122, 13, 3, 2, "#F472B6"); px(r, 122, 16, "#111827"); px(r, 124, 16, "#111827");
    [[130, "#6B7280"], [133, "#9CA3AF"], [136, "#4B5563"], [139, "#6B7280"]].forEach(function (q) { R(r, q[0], 14, 2, 8, q[1]); R(r, q[0], 14, 2, 1, "#D1D5DB"); });
    R(r, 145, 15, 5, 7, "#22D3EE"); R(r, 145, 15, 5, 1, "#A5F3FC"); R(r, 145, 18, 5, 1, "#0E7490");
    // bean bag (corner)
    shade(r, 58, 98, 16, 3);
    E(r, 58, 90, 15, 9, "#6D28D9"); E(r, 56, 86, 10, 5, "#7C3AED"); E(r, 53, 84, 5, 2, "#8B5CF6"); E(r, 60, 96, 14, 3, "#5B21B6");
    // rainbow rug
    var rc = ["#F472B6", "#FB923C", "#FDE047", "#4ADE80", "#22D3EE", "#A78BFA"];
    rc.forEach(function (col, k) { E(r, 52, 102, 30 - k * 4, 7 - k * 1.1, col); });
    // hamster
    shade(r, 34, 104, 5, 1);
    E(r, 34, 101, 4.6, 3.4, "#E5B57A"); E(r, 35, 102, 2.6, 1.8, "#F8E3C2"); px(r, 32, 98, "#E5B57A"); px(r, 36, 98, "#E5B57A"); px(r, 31, 100, "#111827"); px(r, 30, 101, "#F472B6");
    // gaming chair + KIP
    shade(r, 92, 100, 18, 2.5);
    R(r, 76, 48, 32, 40, "#2A2440"); R(r, 76, 48, 32, 2, "#F472B6"); R(r, 76, 48, 2, 40, "#F472B6"); R(r, 106, 48, 2, 40, "#F472B6"); R(r, 84, 52, 16, 4, "#3A3354"); R(r, 74, 88, 36, 4, "#1F1B2E"); R(r, 74, 88, 36, 1, "#3A3354"); R(r, 90, 92, 4, 6, "#111827"); R(r, 82, 98, 20, 2, "#111827");
    kip2(r, c.kc, "type", "glance", GAMER.wear, 76, 58);
    R(r, 102, 70, 4, 14, "rgba(96,165,250,0.32)"); R(r, 104, 72, 2, 10, "rgba(165,243,252,0.35)");
    // desk + cable tidy + screens
    desk(r, 104, 160, 64, "#0B0F17", "#111827");
    R(r, 114, 69, 34, 4, "#0B0F17"); for (x = 115; x < 147; x += 2) px(r, x, 70, "#1F2937"); R(r, 120, 73, 1, 14, "#111827"); R(r, 122, 73, 1, 12, "#0B0F17"); R(r, 121, 86, 3, 2, "#111827");
    screen2(r, 106, 40, 25, 18, "#0B0F17", "#60A5FA", "lines"); screen2(r, 132, 40, 25, 18, "#0B0F17", "#C084FC", "chart", c.kc);
    R(r, 117, 58, 3, 6, "#0B0F17"); R(r, 143, 58, 3, 6, "#0B0F17");
    R(r, 110, 61, 30, 3, "#1F2937"); ["#F472B6", "#FB923C", "#FDE047", "#4ADE80", "#22D3EE", "#A78BFA"].forEach(function (col, k) { R(r, 111 + k * 5, 62, 4, 1, col); });
    E(r, 150, 62, 4, 1.6, "#E5E7EB"); px(r, 148, 61, "#F472B6"); px(r, 152, 61, "#22D3EE");
    // cactus foreground
    shade(r, 14, 107, 10, 2);
    E(r, 14, 86, 4, 12, "#3F8F4A"); E(r, 12.5, 84, 1.5, 9, "#5DB863"); E(r, 7, 88, 2.4, 4, "#3F8F4A"); R(r, 7, 90, 4, 2, "#3F8F4A"); E(r, 21, 82, 2.4, 5, "#3F8F4A"); R(r, 17, 85, 4, 2, "#3F8F4A"); E(r, 14, 74.5, 1.6, 1.2, "#F472B6");
    pot(r, 14, 107, 14, 9, "#1F1B2E", "#3A3354");
  },
  emit: function (r, c) {
    var a = c.night ? 1 : 0.6;
    R(r, 10, 34, 150, 1, "#F472B6"); R(r, 10, 33, 150, 1, "rgba(244,114,182," + 0.35 * a + ")"); R(r, 10, 35, 150, 2, "rgba(244,114,182," + 0.22 * a + ")"); R(r, 10, 29, 150, 4, "rgba(244,114,182," + 0.06 * a + ")"); R(r, 10, 37, 150, 4, "rgba(244,114,182," + 0.06 * a + ")");
    R(r, 158, 2, 1, 70, "#22D3EE"); R(r, 155, 2, 3, 70, "rgba(34,211,238," + 0.18 * a + ")"); R(r, 150, 2, 5, 70, "rgba(34,211,238," + 0.06 * a + ")");
    R(r, 106, 69, 52, 1, "#22D3EE"); R(r, 104, 70, 56, 3, "rgba(34,211,238," + 0.2 * a + ")"); glow(r, 130, 92, 34, 6, "34,211,238", 0.05 * a);
    R(r, 107, 41, 23, 16, "rgba(96,165,250,0.05)"); glow(r, 130, 50, 36, 22, "120,140,255", 0.05 * a);
    glow(r, 14, 74, 12, 12, "244,114,182", 0.06 * a);
  },
  frames: function (c) {
    return [0, 1, 2].map(function (k) {
      var f = [], on = k !== 1, col = on ? "#FDE047" : "#A16207";
      poly(f, [[54, 10], [58, 10], [55, 18], [59, 18], [51, 32], [53, 21], [49, 21]], col);
      if (on) glow(f, 54, 21, 12, 14, "253,224,71", c.night ? 0.04 : 0.025);
      for (var x = 14, i = 0; x < 44; x += 4, i++) { var y = 11 + Math.round(Math.sin(i * 0.9) * 1.5) + (i % 2); var lit = (i + k) % 3 !== 0; px(f, x, y, lit ? ["#FDE68A", "#F472B6", "#22D3EE"][i % 3] : "#3A3060"); if (lit && c.night) R(f, x - 1, y - 1, 3, 3, "rgba(253,230,138,0.12)"); }
      R(f, 14, 11, 30, 1, "rgba(30,24,56,0.6)");
      return f;
    });
  }
};

// ================= COTTAGE =================
var COT = {
  id: "Cottage", color: "#A3E635", alt: "#A3E635", altName: "Lime", weather: "mostly", unlock: "Read 4 weekly recaps", owned: true,
  pal: [["Plaster", "#E9DFC9"], ["Plaster shade", "#D3C6A8"], ["Oak beam", "#6B4A2F"], ["Light oak", "#C19A6B"], ["Sage", "#8BA77A"], ["Rose", "#E8A0A0"], ["Stove", "#2F2A28"], ["Ember", "#F59E0B"]],
  items: [["Wallpaper", "Plaster with oak beams"], ["Floor", "Light oak boards"], ["Window", "Gingham curtains, window box"], ["Art", "Embroidery hoop"], ["Shelf", "Jars and a plate rack"], ["Desk", "Farmhouse table"], ["Desk item", "Sage typewriter, teapot"], ["Plant", "Fern in terracotta"], ["Lamp", "Fairy lights on the beam"], ["Corner", "Wood stove · fire flickers"], ["Rug", "Quilted patchwork rug"], ["Pet", "Dog in a pet bed"]],
  worn: [["Head", "Beanie"]], wear: ["beanie"], win: [18, 50, 50], anim: "Stove fire, fairy lights twinkle",
  draw: function (r, c) {
    var x, y;
    shell(r, ["#EFE6D2", "#E9DFC9", "#E2D7BE", "#D8CBAE"], "#C9BB9B", "#C19A6B");
    for (x = 12; x < 160; x += 6) for (y = 6 + (x % 4) * 3; y < FY; y += 13) px(r, x, y, "#DDD1B6");
    R(r, 10, 4, 150, 5, "#6B4A2F"); R(r, 10, 4, 150, 1, "#8A6542"); R(r, 10, 8, 150, 1, "#523822");
    R(r, 58, 9, 4, 65, "#6B4A2F"); R(r, 58, 9, 1, 65, "#8A6542"); R(r, 100, 9, 4, 65, "#6B4A2F"); R(r, 100, 9, 1, 65, "#8A6542");
    poly(r, [[62, 9], [70, 9], [62, 18]], "#6B4A2F"); poly(r, [[92, 9], [100, 9], [100, 18]], "#6B4A2F");
    floorSeams(r, 12, "#A57F52", [82, 93]);
    for (x = 20; x < 160; x += 24) { var xf = seamX(x); poly(r, [[x + 6, FY + 4], [x + 7, FY + 4], [x + 7, FY + 6], [x + 6, FY + 6]], "#A57F52"); }
    // window
    R(r, 16, 12, 36, 38, "#FFFFFF"); R(r, 17, 13, 34, 36, "#6B4A2F"); sky2(r, [19, 15, 30, 32], c.wx); R(r, 33, 15, 2, 32, "#F5F1E6"); R(r, 19, 30, 30, 2, "#F5F1E6");
    R(r, 14, 48, 40, 2, "#8A6542"); R(r, 16, 50, 36, 6, "#8B5A3C"); R(r, 16, 50, 36, 1, "#A87350");
    [[19, "#E8A0A0"], [24, "#F472B6"], [29, "#FDE047"], [34, "#E8A0A0"], [39, "#FB7185"], [44, "#F5F1E6"], [48, "#F472B6"]].forEach(function (q, k) { E(r, q[0] + 1, 47, 2.2, 2.2, "#6E9A4A"); E(r, q[0] + 1, 45.5 - (k % 2), 1.6, 1.6, q[1]); px(r, q[0] + 1, 45 - (k % 2), "#FDE68A"); });
    poly(r, [[13, 10], [22, 10], [20, 30], [16, 54], [13, 54]], "#E8A0A0"); poly(r, [[46, 10], [55, 10], [55, 54], [52, 54], [48, 30]], "#E8A0A0");
    for (y = 12; y < 54; y += 4) { R(r, 13, y, 4, 1, "#F5C6C6"); R(r, 51, y, 4, 1, "#F5C6C6"); } R(r, 16, 30, 4, 2, "#8BA77A"); R(r, 48, 30, 4, 2, "#8BA77A"); R(r, 12, 9, 44, 2, "#523822");
    // hoop (art)
    E(r, 80, 24, 9, 9, "#B88A5A"); E(r, 80, 24, 8, 8, "#F5F1E6"); E(r, 80, 24, 7, 7, "#EFE8D8"); R(r, 79, 13, 2, 3, "#B88A5A");
    leaf(r, 80, 30, 76, 22, 1.4, "#6E9A4A"); leaf(r, 80, 30, 85, 23, 1.4, "#6E9A4A"); E(r, 80, 21, 2.6, 2.6, "#E8A0A0"); E(r, 80, 21, 1, 1, "#FDE047"); E(r, 75.5, 26, 1.6, 1.6, "#F472B6"); E(r, 85, 27, 1.6, 1.6, "#93C5FD");
    // shelf
    R(r, 110, 28, 46, 2, "#6B4A2F"); R(r, 110, 28, 46, 1, "#8A6542"); poly(r, [[112, 30], [116, 30], [112, 34]], "#6B4A2F"); poly(r, [[150, 30], [154, 30], [154, 34]], "#6B4A2F");
    E(r, 118, 21, 6, 6, "#F5F1E6"); E(r, 118, 21, 4.4, 4.4, "#93C5FD"); E(r, 118, 21, 3, 3, "#F5F1E6"); E(r, 130, 21, 6, 6, "#F5F1E6"); E(r, 130, 21, 4.4, 4.4, "#E8A0A0"); E(r, 130, 21, 3, 3, "#F5F1E6"); R(r, 112, 26, 26, 2, "#8A6542");
    [[139, "#F59E0B"], [145, "#C2410C"], [151, "#8BA77A"]].forEach(function (q) { R(r, q[0], 21, 5, 7, "rgba(255,255,255,0.5)"); R(r, q[0], 23, 5, 5, q[1]); R(r, q[0], 20, 5, 2, "#D9C79E"); R(r, q[0], 21, 1, 6, "rgba(255,255,255,0.5)"); });
    // stove (corner)
    shade(r, 72, 90, 14, 2.5);
    R(r, 69, 0, 5, 50, "#2F2A28"); R(r, 69, 0, 1, 50, "#4A4340"); R(r, 67, 20, 9, 2, "#2F2A28");
    R(r, 62, 50, 22, 36, "#2F2A28"); R(r, 62, 50, 22, 2, "#4A4340"); R(r, 60, 48, 26, 3, "#3A3431"); R(r, 64, 86, 3, 3, "#2F2A28"); R(r, 79, 86, 3, 3, "#2F2A28");
    R(r, 65, 58, 16, 16, "#1A1513"); R(r, 66, 59, 14, 14, "#3A1A0C"); R(r, 66, 77, 14, 2, "#4A4340");
    [[86, 82], [88, 85], [86, 88]].forEach(function (q) { E(r, q[0] + 4, q[1], 4.5, 1.5, "#8A6542"); E(r, q[0], q[1], 1.5, 1.5, "#C19A6B"); });
    // quilt rug + pet bed
    poly(r, [[26, 92], [96, 92], [104, 108], [18, 108]], "#F5F1E6");
    var qc = ["#E8A0A0", "#8BA77A", "#F5D58A", "#93C5FD"];
    for (var i = 0; i < 6; i++) for (var j = 0; j < 2; j++) { var t0 = i / 6, t1 = (i + 1) / 6, ya = 93 + j * 7, yb2 = ya + 6, la = 26 - (ya - 92) / 2, ra = 96 + (ya - 92) / 2, lb = 26 - (yb2 - 92) / 2, rbx = 96 + (yb2 - 92) / 2; poly(r, [[la + (ra - la) * t0 + 0.5, ya], [la + (ra - la) * t1 - 0.5, ya], [lb + (rbx - lb) * t1 - 0.5, yb2], [lb + (rbx - lb) * t0 + 0.5, yb2]], qc[(i + j * 2) % 4]); }
    shade(r, 42, 98, 14, 2);
    E(r, 42, 94, 13, 5, "#8BA77A"); E(r, 42, 93, 10, 3, "#6E8A5E"); E(r, 41, 91.5, 8, 2.6, "#D9A066"); E(r, 46, 90, 3.4, 2.4, "#D9A066"); poly(r, [[44, 89], [45, 86], [47, 89]], "#B07A44"); px(r, 47, 90, "#1F1A17"); E(r, 38, 92, 3, 1.2, "#E8BB85"); R(r, 30, 96, 24, 1, "#5E7A50");
    // table + typewriter + teapot
    chair(r, 74, 88, "#8A6542", "#B88A5A"); for (y = 66; y < 86; y += 5) R(r, 74, y, 3, 1, "#6B4A2F");
    kip2(r, c.kc, "type", "glance", COT.wear, 78, 58);
    desk(r, 104, 160, 63, "#8A6542", "#C19A6B", 4);
    R(r, 108, 66, 4, 21, "#8A6542"); R(r, 152, 66, 4, 21, "#8A6542"); E(r, 110, 74, 2.6, 1.4, "#A87350"); E(r, 154, 74, 2.6, 1.4, "#A87350");
    R(r, 112, 52, 22, 9, "#8BA77A"); R(r, 112, 52, 22, 1, "#A9C39A"); R(r, 110, 58, 26, 5, "#6E8A5E"); for (x = 113; x < 133; x += 3) { px(r, x, 59, "#F5F1E6"); px(r, x + 1, 61, "#F5F1E6"); } R(r, 116, 45, 14, 7, "#F5F1E6"); R(r, 117, 47, 10, 1, "#9CA3AF"); R(r, 117, 49, 8, 1, "#9CA3AF"); R(r, 111, 53, 1, 4, "#4A4340"); R(r, 134, 53, 1, 4, "#4A4340");
    E(r, 146, 58, 5.6, 4.6, "#E8A0A0"); E(r, 144.5, 56.5, 2.4, 1.6, "#F5C6C6"); R(r, 144, 52, 4, 2, "#E8A0A0"); px(r, 146, 51, "#C27878"); poly(r, [[150.5, 57], [155, 53], [155.5, 54], [151.5, 60]], "#E8A0A0"); R(r, 139, 55, 2, 5, "#C27878");
    R(r, 106, 62, 52, 1, "rgba(0,0,0,0.16)");
    // fern foreground
    shade(r, 14, 107, 13, 2);
    [[-12, -16], [-8, -22], [-2, -26], [5, -24], [11, -18], [14, -10], [-15, -8]].forEach(function (q) { leaf(r, 14, 97, 14 + q[0], 97 + q[1], 2.2, "#3F6B32", "#6E9A4A"); });
    pot(r, 14, 107, 15, 10, "#C2633A", "#D9805A");
  },
  emit: function (r, c) { if (c.night) { glow(r, 73, 68, 44, 26, "251,146,60", 0.07); glow(r, 85, 6, 70, 10, "253,224,150", 0.05); } else glow(r, 73, 68, 14, 10, "251,146,60", 0.05); },
  frames: function (c) {
    return [0, 1, 2].map(function (k) {
      var f = [], sh = [0, 1, -1][k];
      E(f, 73 + sh * 0.5, 70, 5, 3, "#C2410C"); E(f, 73 - sh, 68, 3.6, 3.4, "#F97316"); E(f, 72 + sh, 66.5, 2, 2.6, "#FDE047"); E(f, 75 - sh, 69, 1.4, 2, "#FDBA74"); R(f, 67, 72, 12, 1, "#7C2D12");
      for (var x = 14, i = 0; x < 158; x += 6, i++) { var y = 10 + Math.round(3 * Math.sin((x - 14) / 144 * Math.PI * 3) ** 2); px(f, x, y - 1, "#4A4340"); var lit = (i + k) % 4 !== 0; px(f, x, y, lit ? "#FDE68A" : "#B59A55"); if (lit && c.night) R(f, x - 1, y - 1, 3, 3, "rgba(253,230,138,0.18)"); }
      return f;
    });
  }
};

// ================= STARGAZER =================
var STAR = {
  id: "Stargazer", color: "#7DD3FC", alt: "#7DD3FC", altName: "Sky", weather: "mostly", unlock: "Steadiest month · V", owned: false,
  pal: [["Midnight", "#0B1430"], ["Night blue", "#14214A"], ["Dusk blue", "#1B2B5E"], ["Carpet", "#1E2A4A"], ["Starlight", "#E0F2FE"], ["Sky", "#7DD3FC"], ["Brass", "#D4A84B"], ["Moon", "#F5F1DA"]],
  items: [["Wallpaper", "Night blue, star ceiling, constellations"], ["Floor", "Midnight carpet"], ["Window", "Round porthole"], ["Art", "Star map"], ["Shelf", "Globe and snow globe"], ["Desk", "Walnut desk"], ["Desk item", "Retro monitor and cocoa"], ["Plant", "Herbs under a grow light"], ["Lamp", "Moon lamp"], ["Corner", "Brass telescope"], ["Rug", "Shaggy round rug"], ["Pet", "Fish bowl"]],
  worn: [["Face", "Round glasses"]], wear: ["round"], win: [20, 48, 44], anim: "Stars twinkle",
  draw: function (r, c) {
    var x, y;
    shell(r, ["#0B1430", "#101B3E", "#14214A", "#192A57", "#1B2B5E"], "#0E1838", "#1E2A4A");
    for (x = 11; x < 168; x += 3) for (y = FY + 2 + (x % 3); y < RH; y += 3) px(r, x, y, (x + y) % 2 ? "#25335A" : "#19223E");
    // constellation decals
    [[[96, 14], [104, 10], [110, 15], [118, 12]], [[124, 34], [130, 30], [136, 36], [130, 42]]].forEach(function (cn) { for (var i = 0; i < cn.length - 1; i++) { var a = cn[i], b = cn[i + 1], n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])); for (var t = 1; t < n; t += 2) px(r, Math.round(a[0] + (b[0] - a[0]) * t / n), Math.round(a[1] + (b[1] - a[1]) * t / n), "#3E5A8A"); } cn.forEach(function (p) { R(r, p[0] - 1, p[1], 3, 1, "#C7E3F7"); R(r, p[0], p[1] - 1, 1, 3, "#C7E3F7"); }); });
    // porthole window
    E(r, 34, 28, 17, 17, "#9C7A33"); E(r, 34, 28, 16, 16, "#D4A84B"); E(r, 34, 28, 14, 14, "#7A5E22"); sky2(r, [20, 14, 28, 28], c.wx, [34, 28, 13]);
    R(r, 33, 15, 2, 26, "#7A5E22"); R(r, 21, 27, 26, 2, "#7A5E22"); [[34, 12], [34, 44], [18, 28], [50, 28]].forEach(function (q) { E(r, q[0], q[1], 1.2, 1.2, "#F5E7B5"); });
    poly(r, [[26, 18], [30, 16], [22, 30], [21, 26]], "rgba(255,255,255,0.1)");
    // star map
    R(r, 58, 8, 26, 30, "#D4A84B"); R(r, 59, 9, 24, 28, "#0B1430"); E(r, 71, 23, 10, 10, "#14214A"); E(r, 71, 23, 10, 10, "rgba(125,211,252,0.06)");
    [[65, 17], [70, 14], [76, 19], [73, 27], [66, 28], [78, 30]].forEach(function (p, k, a) { px(r, p[0], p[1], "#E0F2FE"); if (k) { var q = a[k - 1]; px(r, Math.round((p[0] + q[0]) / 2), Math.round((p[1] + q[1]) / 2), "#3E5A8A"); } });
    // shelf: globe + snow globe
    R(r, 112, 26, 44, 2, "#3B2A1E"); R(r, 112, 26, 44, 1, "#5C4430");
    R(r, 118, 24, 6, 2, "#D4A84B"); R(r, 120, 21, 2, 3, "#D4A84B"); E(r, 121, 15, 6, 6, "#2563EB"); E(r, 119, 13, 2.6, 2, "#4ADE80"); E(r, 123, 17, 2.4, 2.2, "#4ADE80"); E(r, 119, 12, 1.6, 1.2, "rgba(255,255,255,0.5)"); poly(r, [[114, 9], [115, 9], [128, 21], [127, 21]], "#D4A84B");
    E(r, 138, 19, 5, 5, "rgba(186,230,253,0.45)"); R(r, 134, 22, 8, 4, "#3B2A1E"); E(r, 138, 21, 3.2, 1.2, "#F8FAFC"); poly(r, [[137, 15], [139, 15], [140, 20], [136, 20]], "#4D7C3A"); px(r, 136, 16, "#F8FAFC"); px(r, 140, 17, "#F8FAFC"); E(r, 136.5, 17, 1, 1.4, "rgba(255,255,255,0.6)");
    R(r, 147, 16, 3, 10, "#E5E7EB"); poly(r, [[147, 16], [150, 16], [148.5, 12]], "#F87171"); R(r, 145, 23, 2, 3, "#F87171"); R(r, 150, 23, 2, 3, "#F87171"); px(r, 148, 19, "#7DD3FC");
    // telescope (corner)
    shade(r, 66, 90, 13, 2.5);
    poly(r, [[66, 62], [67, 62], [58, 90], [57, 90]], "#9C7A33"); poly(r, [[66, 62], [67, 62], [76, 90], [75, 90]], "#9C7A33"); R(r, 66, 62, 1, 28, "#7A5E22");
    poly(r, [[54, 44], [57, 41], [74, 60], [71, 63]], "#E8D9B0"); poly(r, [[54, 44], [55.5, 42.5], [72.5, 61.5], [71, 63]], "#F5ECD2"); poly(r, [[51, 41], [55, 37], [58, 40], [54, 44]], "#D4A84B"); R(r, 70, 60, 3, 3, "#D4A84B"); R(r, 64, 52, 3, 2, "#D4A84B");
    // shaggy rug + fishbowl
    E(r, 70, 100, 40, 8, "#1F4E79"); for (x = 32; x < 110; x += 2) { var dy = Math.sqrt(Math.max(0, 1 - ((x - 70) / 40) ** 2)) * 8; px(r, x, Math.round(100 + dy), "#1F4E79"); px(r, x + 1, Math.round(100 - dy) - 1, "#2B6AA0"); }
    E(r, 70, 100, 30, 5, "#2B6AA0"); E(r, 70, 100, 18, 3, "#3B82C4");
    shade(r, 34, 100, 9, 1.6); R(r, 26, 96, 16, 4, "#3B2A1E"); E(r, 34, 89, 7, 6.5, "rgba(186,230,253,0.35)"); R(r, 28, 89, 12, 6, "rgba(56,189,248,0.4)"); R(r, 29, 83, 10, 1, "rgba(224,242,254,0.7)"); E(r, 35, 91, 2.2, 1.4, "#FB923C"); px(r, 32, 91, "#FB923C"); px(r, 36, 90, "#111827"); E(r, 31, 86, 1, 2, "rgba(255,255,255,0.6)");
    // desk + CRT + cocoa
    chair(r, 74, 88, "#24304F", "#3A4A72");
    kip2(r, c.kc, "type", "glance", STAR.wear, 78, 58);
    desk(r, 104, 160, 63, "#3B2A1E", "#5C4430");
    R(r, 112, 40, 28, 22, "#D8CFB8"); R(r, 112, 40, 28, 1, "#EDE6D3"); R(r, 138, 41, 2, 21, "#B8AE96"); R(r, 116, 61, 20, 2, "#B8AE96");
    gradV(r, 115, 43, 21, 15, ["#0E3B4A", "#0F4A5C", "#11576C"]); [[118, 46], [122, 49], [127, 45], [131, 51], [125, 54]].forEach(function (p) { px(r, p[0], p[1], "#A5F3FC"); }); R(r, 118, 47, 1, 1, "#5EEAD4"); R(r, 121, 48, 1, 1, "#2DD4BF"); R(r, 125, 47, 2, 1, "#2DD4BF"); R(r, 128, 48, 2, 1, "#2DD4BF");
    R(r, 142, 56, 5, 6, "#F5F1DA"); R(r, 147, 57, 1, 3, "#F5F1DA"); R(r, 142, 56, 5, 1, "#7C4A2B"); E(r, 144, 53, 0.8, 2, "rgba(226,232,240,0.5)");
    R(r, 150, 61, 7, 2, "#2B2B33"); R(r, 153, 55, 1, 6, "#2B2B33");
    R(r, 106, 62, 52, 1, "rgba(0,0,0,0.2)");
    // herbs under grow light (foreground)
    shade(r, 16, 107, 14, 2);
    R(r, 4, 70, 1, 37, "#9CA3AF"); R(r, 28, 70, 1, 37, "#9CA3AF"); R(r, 2, 68, 28, 3, "#4B5563"); R(r, 4, 71, 24, 1, "#F0ABFC");
    [[10, "#4ADE80"], [22, "#22C55E"]].forEach(function (q) { leaf(r, q[0], 98, q[0] - 4, 88, 1.6, "#2F6B3A", q[1]); leaf(r, q[0], 98, q[0] + 4, 87, 1.6, "#2F6B3A", q[1]); leaf(r, q[0], 98, q[0], 85, 1.6, "#3C7A42", q[1]); pot(r, q[0], 107, 9, 8, "#E2E8F0", "#F8FAFC"); });
  },
  emit: function (r, c) {
    var a = c.night ? 1 : 0.5;
    E(r, 153, 49, 5, 5, "#F5F1DA"); E(r, 151.5, 47.5, 1.2, 1.2, "#DAD3B4"); E(r, 155, 51, 1.6, 1.2, "#DAD3B4"); E(r, 154, 46.5, 0.8, 0.8, "#DAD3B4");
    glow(r, 153, 49, c.night ? 30 : 10, c.night ? 26 : 10, "245,241,218", 0.06 * a);
    R(r, 4, 71, 24, 1, "#F0ABFC"); poly(r, [[4, 72], [28, 72], [32, 100], [0, 100]], "rgba(240,171,252," + 0.08 * a + ")");
    glow(r, 125, 50, 20, 14, "45,212,191", 0.05 * a);
    if (c.night) { [[96, 14], [104, 10], [110, 15], [118, 12], [124, 34], [130, 30], [136, 36], [130, 42]].forEach(function (p) { R(r, p[0] - 1, p[1] - 1, 3, 3, "rgba(199,227,247,0.18)"); }); }
  },
  frames: function (c) {
    var S = [[16, 4], [28, 8], [44, 3], [52, 10], [90, 4], [102, 22], [142, 6], [150, 14], [124, 6], [80, 5], [64, 46], [94, 40], [146, 36]];
    return [0, 1, 2].map(function (k) { var f = []; S.forEach(function (p, i) { var big = (i + k) % 3 === 0; px(f, p[0], p[1], "#E0F2FE"); if (big) { px(f, p[0] - 1, p[1], "rgba(224,242,254,0.6)"); px(f, p[0] + 1, p[1], "rgba(224,242,254,0.6)"); px(f, p[0], p[1] - 1, "rgba(224,242,254,0.6)"); px(f, p[0], p[1] + 1, "rgba(224,242,254,0.6)"); } }); return f; });
  }
};

// ================= LIBRARY =================
var LIB = {
  id: "Library", color: "#6EE7B7", alt: "#6EE7B7", altName: "Mint", weather: "cloudy", unlock: "Read 12 weekly recaps", owned: false,
  pal: [["Walnut panel", "#4A3426"], ["Panel light", "#5E4331"], ["Dark oak", "#3A281D"], ["Library green", "#2F5D50"], ["Shade green", "#3C7A5F"], ["Oxblood", "#7A2E2E"], ["Brass", "#C9A05A"], ["Paper", "#EDE3CC"]],
  items: [["Wallpaper", "Walnut panelling"], ["Floor", "Dark oak boards"], ["Window", "Tall window, velvet curtains"], ["Art", "Framed old map"], ["Shelf", "Shelf of varied spines"], ["Desk", "Writing desk, green inset"], ["Desk item", "Desk globe and stacked books"], ["Plant", "Snake plant in brass"], ["Lamp", "Green reading lamp"], ["Corner", "Tall bookcase, rolling ladder"], ["Rug", "Oxblood bordered rug"], ["Pet", "Cat asleep on books"]],
  worn: [["Face", "Round glasses"], ["Neck", "Bow tie"]], wear: ["round", "bowtie"], win: [16, 42, 58], anim: "Dust drifts in the window light",
  draw: function (r, c) {
    var x, y, BC = ["#7A2E2E", "#2F5D50", "#C9A05A", "#3B4F7A", "#8C6A4A", "#5E4331", "#9A3B3B", "#3C7A5F", "#D9C79E", "#4A3A5A"];
    shell(r, ["#523A2A", "#4E3728", "#4A3426", "#453023"], "#3A281D", "#3A281D");
    for (x = 12; x < 160; x += 16) { R(r, x, 40, 14, 30, "#55392A"); R(r, x, 40, 14, 1, "#6A4A36"); R(r, x, 40, 1, 30, "#6A4A36"); R(r, x + 13, 40, 1, 30, "#3A281D"); R(r, x, 69, 14, 1, "#3A281D"); }
    R(r, 10, 37, 150, 3, "#3A281D"); R(r, 10, 37, 150, 1, "#6A4A36");
    floorSeams(r, 10, "#2E2017", [80, 88, 98]);
    for (x = 14; x < 160; x += 30) poly(r, [[x, FY + 6], [x + 1, FY + 6], [x + 1, FY + 8], [x, FY + 8]], "#2E2017");
    // window + curtains
    R(r, 14, 4, 30, 54, "#2A1D14"); sky2(r, [16, 6, 26, 50], c.wx); R(r, 28, 6, 2, 50, "#2A1D14"); R(r, 16, 22, 26, 1, "#2A1D14"); R(r, 16, 39, 26, 1, "#2A1D14"); R(r, 12, 56, 34, 3, "#5E4331");
    poly(r, [[10, 2], [20, 2], [17, 24], [14, 60], [10, 62]], "#2F5D50"); poly(r, [[38, 2], [48, 2], [48, 62], [44, 60], [41, 24]], "#2F5D50");
    for (x = 11; x < 18; x += 3) R(r, x, 4, 1, 56, "#24493F"); for (x = 41; x < 48; x += 3) R(r, x, 4, 1, 56, "#24493F");
    R(r, 9, 1, 41, 3, "#C9A05A"); E(r, 10, 2.5, 2, 2, "#C9A05A"); E(r, 49, 2.5, 2, 2, "#C9A05A");
    // tall bookcase + ladder (corner)
    shade(r, 68, 92, 20, 2.5);
    R(r, 50, 2, 36, 88, "#3A281D"); R(r, 50, 2, 36, 2, "#5E4331");
    [14, 28, 42, 56, 70].forEach(function (yb, k) { R(r, 52, yb - 11, 32, 11, "#24180F"); bookRow(r, 52, yb, 84, BC, k * 3 + 1, 10); R(r, 51, yb, 34, 2, "#5E4331"); });
    R(r, 52, 72, 32, 16, "#2E2017"); R(r, 53, 73, 14, 14, "#3A281D"); R(r, 69, 73, 14, 14, "#3A281D"); px(r, 66, 80, "#C9A05A"); px(r, 70, 80, "#C9A05A");
    R(r, 48, 6, 40, 1, "#C9A05A"); poly(r, [[78, 6], [80, 6], [94, 92], [92, 92]], "#8C6A4A"); poly(r, [[86, 6], [88, 6], [102, 92], [100, 92]], "#8C6A4A");
    for (y = 14; y < 92; y += 9) { var t = (y - 6) / 86; R(r, Math.round(79 + 14 * t), y, 9, 1, "#A88560"); }
    // map (art) + shelf of spines
    R(r, 112, 4, 40, 18, "#C9A05A"); gradV(r, 113, 5, 38, 16, ["#EDE3CC", "#E4D7B8", "#D9C9A4"]); E(r, 124, 12, 6, 4, "#B6A07A"); E(r, 140, 14, 7, 4, "#B6A07A"); px(r, 131, 9, "#7A2E2E"); R(r, 116, 18, 6, 1, "#8C6A4A");
    R(r, 108, 38, 50, 2, "#5E4331"); R(r, 108, 38, 50, 1, "#7A5A42"); bookRow(r, 110, 38, 156, BC, 5, 11);
    // rug
    poly(r, [[22, 90], [100, 90], [110, 108], [12, 108]], "#7A2E2E"); poly(r, [[26, 92], [98, 92], [106, 106], [17, 106]], "#C9A05A"); poly(r, [[28, 93], [96, 93], [103, 105], [20, 105]], "#7A2E2E");
    for (x = 34; x < 96; x += 8) E(r, x, 99, 2, 1.4, "#9A3B3B");
    // desk + armchair + KIP
    shade(r, 92, 98, 20, 2.5);
    R(r, 72, 56, 40, 32, "#6B2525"); R(r, 74, 56, 36, 2, "#8C3535"); R(r, 70, 92, 3, 3, "#3A281D"); R(r, 111, 92, 3, 3, "#3A281D");
    for (x = 76; x < 110; x += 6) for (y = 60; y < 70; y += 5) px(r, x, y, "#4E1A1A");
    kip2(r, c.kc, "type", "glance", LIB.wear, 78, 56);
    R(r, 68, 72, 8, 20, "#7A2E2E"); R(r, 108, 72, 8, 20, "#7A2E2E"); R(r, 68, 72, 8, 2, "#9A3B3B"); R(r, 108, 72, 8, 2, "#9A3B3B");
    R(r, 72, 86, 40, 4, "#7A2E2E"); R(r, 72, 86, 40, 1, "#9A3B3B");
    desk(r, 112, 160, 64, "#2E2017", "#4A3426", 4); R(r, 120, 64, 32, 2, "#2F5D50");
    E(r, 124, 56, 5, 5, "#3B82C4"); E(r, 122.5, 54.5, 2, 1.6, "#4ADE80"); E(r, 126, 57.5, 1.8, 1.6, "#4ADE80"); R(r, 121, 61, 6, 3, "#C9A05A"); R(r, 123, 60, 2, 1, "#C9A05A");
    book(r, 134, 64, 12, 3, "#2F5D50"); book(r, 135, 61, 10, 3, "#7A2E2E"); book(r, 133, 58, 12, 3, "#C9A05A"); R(r, 135, 54, 9, 1, "#EDE3CC");
    R(r, 114, 63, 44, 1, "rgba(0,0,0,0.2)");
    // books stack + cat (floor)
    shade(r, 128, 96, 14, 2);
    book(r, 116, 96, 22, 4, "#3B4F7A"); book(r, 118, 92, 19, 4, "#7A2E2E"); book(r, 117, 88, 21, 3, "#2F5D50");
    cat2(r, 115, 76, "#9CA3AF", "#4B5563");
    // snake plant in brass (foreground)
    shade(r, 13, 107, 12, 2);
    leaf(r, 10, 98, 5, 66, 2.4, "#2F6B3A", "#4E8F4E"); leaf(r, 13, 98, 13, 58, 2.6, "#2F6B3A", "#5BA05A"); leaf(r, 16, 98, 22, 68, 2.4, "#2F6B3A", "#4E8F4E"); leaf(r, 12, 98, 9, 72, 2, "#3C7A42", "#C9D96A");
    pot(r, 13, 107, 14, 10, "#C9A05A", "#E2BE78");
  },
  emit: function (r, c) {
    var a = c.night ? 1 : 0.55;
    R(r, 150, 49, 2, 13, "#C9A05A"); R(r, 147, 62, 8, 2, "#C9A05A"); poly(r, [[143, 46], [157, 46], [155, 51], [145, 51]], "#3C7A5F"); R(r, 143, 46, 14, 1, "#5FA07F"); R(r, 145, 51, 10, 1, c.night ? "#FFE3A3" : "#E9D39A");
    poly(r, [[145, 52], [155, 52], [168, 64], [132, 64]], "rgba(255,220,150," + 0.12 * a + ")"); glow(r, 150, 64, 30, 6, "255,220,150", 0.07 * a);
    if (c.night) glow(r, 150, 56, 50, 34, "255,210,140", 0.05);
  },
  frames: function (c) { if (c.night) return [[], [], []]; return [0, 1, 2].map(function (k) { var f = []; [[22, 70], [30, 82], [26, 94], [38, 76], [44, 88], [34, 100]].forEach(function (p, i) { px(f, p[0] + ((i + k) % 3) - 1, p[1] - k * 2, "rgba(255,244,214,0.55)"); }); return f; }); }
};
var SETS2 = [JP, GYM, GAMER, COT, STAR, LIB];
