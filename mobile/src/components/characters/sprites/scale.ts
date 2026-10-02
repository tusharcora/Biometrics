export interface CrispLayout {
  /** Device pixels per sprite pixel (always a whole number, at least 1). */
  cellPx: number;
  /** Points per sprite pixel: cellPx / pixelRatio. */
  cellPt: number;
  /** Drawn width in points: cellPt * cells. */
  drawnPt: number;
  /** Left offset in points that centres the drawing, snapped to a device pixel. */
  offsetPt: number;
  /** Top offset in points that centres the drawing, snapped to a device pixel. */
  offsetYPt: number;
}

// Whole-device-pixel layout for a pixel sprite (spec §2 "Crisp scaling").
export function crispLayout(slotPt: number, pixelRatio: number, cells = 24, rows = cells): CrispLayout {
  const cellPx = Math.max(1, Math.floor((slotPt * pixelRatio) / Math.max(cells, rows)));
  const cellPt = cellPx / pixelRatio;
  const drawnPt = cellPt * cells;
  const drawnHPt = cellPt * rows;
  // Offsets are rounded to device pixels so the grid never straddles one.
  const offsetPt = Math.floor(((slotPt - drawnPt) / 2) * pixelRatio) / pixelRatio;
  const offsetYPt = Math.floor(((slotPt * (rows / cells) - drawnHPt) / 2) * pixelRatio) / pixelRatio;
  return { cellPx, cellPt, drawnPt, offsetPt, offsetYPt };
}
