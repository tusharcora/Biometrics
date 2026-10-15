import { setCards, type TrayContext } from '../../src/lib/room/tray';
import '../../src/lib/room/art';

const OWNED = new Set(['wall.plain', 'wall.dots', 'rug.slate', 'rug.red', 'art.calendar']);
const CTX: TrayContext = { owned: OWNED, facts: { levels: { SLEEP_GOAL: 1 }, recapsRead: 2, buddyCheers: 0 } };

it('lists the Cottage card with its count, rule and ownership', () => {
  expect(setCards(CTX)).toEqual([expect.objectContaining({ id: 'cottage', name: 'Cottage', pieces: 13, line: '13 pieces · Read 4 weekly recaps', owned: false })]);
});
