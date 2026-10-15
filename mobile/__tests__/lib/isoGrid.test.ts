import { isoGrid, LOCAL, projOf, unproject } from '../../src/lib/room/iso/grid';
import { box, flat, line, mirrorRects, moveRects, opaqueBounds, scaleRects, shear } from '../../src/lib/room/iso/prims';
import type { RoomRect } from '../../src/lib/room/grid';

describe('the grid (spec §3.1, iso.py Iso)', () => {
  it('P(i, j, z) is iso.py\'s 2:1 projection with the back corner at (m·12 + 2, 68)', () => {
    const P = projOf(isoGrid(1));
    expect([P(0, 0), P(7, 0), P(0, 7), P(7, 7), P(1, 2, 10)]).toEqual([[86, 68], [170, 110], [2, 110], [86, 152], [74, 76]]);
    expect(LOCAL(1, 0, 0)).toEqual([12, 6]);
  });

  it('a room is (n + m)·12 + 4 by 68 + (n + m)·6 + 8 cells: 172 × 160, 196 × 172, 220 × 184', () => {
    expect([1, 2, 3].map((t) => { const g = isoGrid(t as 1 | 2 | 3); return [g.n, g.W, g.H]; })).toEqual([[7, 172, 160], [8, 196, 172], [9, 220, 184]]);
  });

  it('unproject is P\'s inverse on the floor', () => {
    const g = isoGrid(2);
    const [x, y] = projOf(g)(3.5, 4.25);
    expect(unproject(g, x, y)).toEqual([3.5, 4.25]);
  });
});

describe('primitives (iso.py line, box, flat, face)', () => {
  it('a diagonal is 2:1 stair steps of single cells', () => {
    const r: RoomRect[] = [];
    line(r, [0, 0], [4, 2], '#fff');
    expect(r).toEqual([[0, 0, 1, 1, '#fff'], [1, 0, 1, 1, '#fff'], [2, 1, 1, 1, '#fff'], [3, 1, 1, 1, '#fff']]);
  });

  it('a box draws its left face lighter than its right, its top, and a lit top edge, on whole cells', () => {
    const r: RoomRect[] = [];
    box(r, LOCAL, 0, 0, 0, 1, 1, 6, '#808080');
    const colours = new Set(r.map((q) => q[4]));
    expect(colours.size).toBe(4);
    expect(r.every(([x, y, w, h]) => [x, y, w, h].every(Number.isInteger))).toBe(true);
  });

  it('flat fills a floor parallelogram', () => {
    const r: RoomRect[] = [];
    flat(r, LOCAL, 0, 0, 1, 1, '#123456');
    const b = opaqueBounds(r)!;
    expect(b.x >= -12 && b.x + b.w <= 12 && b.w >= 22).toBe(true); // the tile's two side points are a cell thin
    expect([b.y, b.h]).toEqual([0, 12]);
  });

  it('shear puts columns on a wall: down by floor(u/2) on the right wall, up by ceil(u/2) on the left', () => {
    const rect: RoomRect[] = [[0, 0, 4, 1, '#f00']];
    expect(shear(rect, 10, 20, 1)).toEqual([[10, 20, 2, 1, '#f00'], [12, 21, 2, 1, '#f00']]);
    expect(shear(rect, 10, 20, -1)).toEqual([[10, 20, 1, 1, '#f00'], [11, 19, 2, 1, '#f00'], [13, 18, 1, 1, '#f00']]);
  });

  it('scale, move, mirror; opaque bounds ignore shadows', () => {
    expect(scaleRects([[2, 2, 2, 2, '#a']], 0.5, 1.5)).toEqual([[1, 3, 1, 3, '#a']]);
    expect(moveRects([[1, 1, 1, 1, '#a']], 2, -1)).toEqual([[3, 0, 1, 1, '#a']]);
    expect(mirrorRects([[1, 0, 2, 1, '#a']], 0)).toEqual([[-3, 0, 2, 1, '#a']]);
    expect(opaqueBounds([[0, 0, 9, 9, 'rgba(0,0,0,0.2)'], [2, 3, 1, 1, '#a']])).toEqual({ x: 2, y: 3, w: 1, h: 1 });
  });
});
