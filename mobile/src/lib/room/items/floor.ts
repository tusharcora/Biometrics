// Floors (CatWalls.dc.html "slot · floor"): v2 perspective boards and tiles on the floor polygon (shared.floorSurface).
import { registerItems, type ItemArt } from '../items';
import { registerIcons, type SpriteRect } from '../icons';
import { FLOOR_Y, ROOM_H, ROOM_W } from '../grid';
import { floorSeams, R, type Rects } from '../paint';
import { floorSurface } from './shared';

const FLOOR_BOX = { x: 0, y: FLOOR_Y, w: ROOM_W, h: ROOM_H - FLOOR_Y };

/** Speckles as on the board (CatWalls patch 'carpet' / 'concreteF'), over a box. */
function speckle(p: Rects, x0: number, y0: number, w: number, h: number, n: number, a: string, b: string): void {
  for (let i = 0; i < n; i++) R(p, x0 + ((i * 5 + 1) % w), y0 + ((i * 3 + 2) % h), 1, 1, i % 2 ? a : b);
}

const art: ItemArt[] = [
  {
    id: 'floor.tiles', slot: 'floor',
    draw: () => {
      const r: Rects = [];
      floorSurface(r, '#E5E7EB', (p) => floorSeams(p, 10, '#CBD5E1', [79, 85, 93, 103]));
      return { base: r };
    },
  },
  {
    id: 'floor.carpet', slot: 'floor', tint: true,
    draw: ({ ramp }) => {
      const r: Rects = [];
      floorSurface(r, ramp.shade, (p) => speckle(p, FLOOR_BOX.x, FLOOR_BOX.y, FLOOR_BOX.w, FLOOR_BOX.h, (FLOOR_BOX.w * FLOOR_BOX.h) / 4, ramp.deep, ramp.body));
      return { base: r };
    },
  },
  {
    id: 'floor.concrete', slot: 'floor',
    draw: () => {
      const r: Rects = [];
      floorSurface(r, '#57534E', (p) => {
        speckle(p, FLOOR_BOX.x, FLOOR_BOX.y, FLOOR_BOX.w, FLOOR_BOX.h, (FLOOR_BOX.w * FLOOR_BOX.h) / 6, '#48443F', '#6B665F');
        floorSeams(p, 30, '#4A4642', [92]);
      });
      return { base: r };
    },
  },
];

const icon = (base: string, rest: (p: Rects) => void): SpriteRect[] => {
  const p: Rects = [];
  R(p, 0, 0, 16, 16, base);
  rest(p);
  return p as SpriteRect[];
};

registerItems(art);
registerIcons({
  'floor.oakDark': icon('#5B4636', (p) => { for (let y = 4; y < 16; y += 5) R(p, 0, y, 16, 1, '#4A382B'); R(p, 8, 0, 1, 4, '#4A382B'); R(p, 4, 5, 1, 4, '#4A382B'); }),
  'floor.tiles': icon('#E5E7EB', (p) => { for (let i = 0; i < 16; i += 6) { R(p, i, 0, 1, 16, '#CBD5E1'); R(p, 0, i, 16, 1, '#CBD5E1'); } }),
  'floor.carpet': icon('@s', (p) => speckle(p, 0, 0, 16, 16, 64, '@d', '@b')),
  'floor.concrete': icon('#57534E', (p) => speckle(p, 0, 0, 16, 16, 42, '#48443F', '#6B665F')),
});
