import { useEffect } from 'react';
import { Skia, createPicture, type SkPicture } from '@shopify/react-native-skia';
import type { RoomRect } from '../../lib/room/grid';

// The room's Skia pictures (spec 2026-10-15 §3.7), shared by RoomView and the editor's overlay.

/** One Path per colour per layer, on whole points, antialiasing off (spec §5). */
export function record(layers: readonly (readonly RoomRect[])[], cellPt: number): SkPicture {
  return createPicture((canvas) => {
    for (const rects of layers) {
      const byColour = new Map<string, ReturnType<typeof Skia.Path.Make>>();
      for (const [x, y, w, h, colour] of rects) {
        let path = byColour.get(colour);
        if (!path) { path = Skia.Path.Make(); byColour.set(colour, path); }
        path.addRect(Skia.XYWHRect(x * cellPt, y * cellPt, w * cellPt, h * cellPt));
      }
      for (const [colour, path] of byColour) {
        const paint = Skia.Paint();
        paint.setAntiAlias(false);
        paint.setColor(Skia.Color(colour));
        canvas.drawPath(path, paint);
      }
    }
  });
}

/** Releases a picture when it is replaced or the view unmounts (one picture set per screen). */
export function useDisposed<T extends { dispose?: () => void }>(value: T): T {
  useEffect(() => () => value.dispose?.(), [value]);
  return value;
}
