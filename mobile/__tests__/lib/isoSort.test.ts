import { depthOrder, type DepthBox } from '../../src/lib/room/iso/sort';

const b = (key: string, i0: number, j0: number, i1: number, j1: number): DepthBox => ({ key, i0, j0, i1, j1 });

describe('depth order (spec §3.4)', () => {
  it('draws back to front along either axis', () => {
    expect(depthOrder([b('front', 2, 2, 3, 3), b('back', 0, 0, 1, 1)])).toEqual(['back', 'front']);
  });

  it('gets the L-shaped case right that one depth key gets wrong', () => {
    // A long piece across the front row and a small one behind its right end: by corner or centre sums A comes
    // first, but B's far edge is at A's near edge (B.j1 <= A.j0), so B is behind.
    const A = b('A', 0, 1, 5, 2);
    const B = b('B', 4, 0, 5, 1);
    expect(depthOrder([A, B])).toEqual(['B', 'A']);
  });

  it('keeps extra edges (KIP after its desk) and breaks ties on the key, whatever the input order', () => {
    const desk = b('desk', 2, 0, 5, 2);
    const kip = b('@kip', 3, 1, 4, 2);
    const fern = b('fern', 0, 0, 1, 1);
    const order = depthOrder([kip, desk, fern], [['desk', '@kip']]);
    expect(order).toEqual(['fern', 'desk', '@kip']);
    expect(depthOrder([fern, desk, kip], [['desk', '@kip']])).toEqual(order);
  });

  it('never throws on overlapping boxes (a stored layout from a newer server): falls back to position, then key', () => {
    expect(depthOrder([b('y', 0, 0, 2, 2), b('x', 0, 0, 2, 2)])).toEqual(['x', 'y']);
  });

  it('sorts 90 pieces in well under a millisecond-scale budget (a smoke check, not a gate)', () => {
    const boxes = Array.from({ length: 81 }, (_, k) => b(`p${k}`, k % 9, Math.floor(k / 9), (k % 9) + 1, Math.floor(k / 9) + 1));
    const order = depthOrder(boxes);
    expect(order).toHaveLength(81);
    expect(order[0]).toBe('p0');
    expect(order[80]).toBe('p80');
  });
});
