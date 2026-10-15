import { EMPTY_TOASTED, decorateTarget, nextToast, piecesForBadge, toastSpoken } from '../../src/lib/room/announce';

const f = (itemId: string, source: string) => ({ itemId, source });

it('toasts a recap or cheer piece once, naming the first and counting the rest', () => {
  const fresh = [f('wall.panel', 'counter:recaps_read:4'), f('art.cork', 'counter:recaps_read:4'), f('set.cottage.desk', 'set:cottage')];
  const first = nextToast(fresh, EMPTY_TOASTED);
  expect(first.toast).toEqual({ kind: 'items', itemIds: ['wall.panel', 'art.cork', 'set.cottage.desk'], text: "New for KIP's room: Wood panel and 2 more" });
  expect(nextToast(fresh, first.toasted).toast).toBeNull();
});

it('never toasts a badge piece (the celebration names it)', () => {
  expect(nextToast([f('rug.red', 'family:SLEEP_GOAL:1'), f('shelf.trophyB', 'anyFamily:1')], EMPTY_TOASTED).toast).toBeNull();
});

it('summarises the backfill once, again only when more arrives, and forgets it once seen', () => {
  const backfill = [f('pet.bed', 'backfill'), f('rug.red', 'backfill'), f('wall.stripes', 'backfill')];
  const one = nextToast(backfill, EMPTY_TOASTED);
  expect(one.toast).toEqual({ kind: 'backfill', count: 3, text: "Your badges unlocked 3 things for KIP's room" });
  expect(nextToast(backfill, one.toasted).toast).toBeNull();
  const more = nextToast([...backfill, f('out.scarf', 'backfill')], one.toasted);
  expect(more.toast).toMatchObject({ kind: 'backfill', count: 4 });
  expect(nextToast([], more.toasted).toasted).toEqual(EMPTY_TOASTED);
});

// Review Focus 2: a long-time user's pre-launch pieces arrive as backfill, then a piece is earned after launch.
it('gives a long-time user one summary that does not come back, then a toast for a piece earned after launch', () => {
  const ids = ['pet.bed', 'rug.red', 'wall.stripes', 'art.motto', 'shelf.trophyB', 'out.beanie', 'plant.cactus', 'lamp.amber', 'rug.gymmat'];
  const backfill = ids.map((id) => f(id, 'backfill'));
  const first = nextToast(backfill, EMPTY_TOASTED);
  expect(first.toast?.text).toBe("Your badges unlocked 9 things for KIP's room");
  expect(first.toasted).toEqual({ ids: [], backfill: 9 });
  // The next foreground: nothing.
  const second = nextToast(backfill, first.toasted);
  expect(second.toast).toBeNull();
  // A recap read after launch gets its own toast, once.
  const now = [...backfill, f('wall.panel', 'counter:recaps_read:4')];
  const later = nextToast(now, second.toasted);
  expect(later.toast).toEqual({ kind: 'items', itemIds: ['wall.panel'], text: "New for KIP's room: Wood panel" });
  expect(later.toasted).toEqual({ ids: ['wall.panel'], backfill: 9 });
  expect(nextToast(now, later.toasted).toast).toBeNull();
});

it('drops ids from the device list once they are seen, so it stays small', () => {
  const { toasted } = nextToast([f('wall.panel', 'counter:recaps_read:4')], EMPTY_TOASTED);
  expect(nextToast([], toasted).toasted.ids).toEqual([]);
});

it('speaks a toast without the "·" (ruling 19)', () => {
  const { toast } = nextToast([f('art.band', 'counter:buddy_cheers:10')], EMPTY_TOASTED);
  expect(toast!.text).toBe("New for KIP's room: Band poster · “The Naps”");
  expect(toastSpoken(toast!)).toBe("New for KIP's room: Band poster, “The Naps”");
  expect(toastSpoken({ kind: 'backfill', count: 2, text: "Your badges unlocked 2 things for KIP's room" })).toBe("Your badges unlocked 2 things for KIP's room");
});

it('finds a celebration\'s pieces: its family at its level or below, and any family at those levels', () => {
  const fresh = [
    f('rug.red', 'family:SLEEP_GOAL:1'), f('art.motto', 'family:SLEEP_GOAL:2'), f('wall.brick', 'family:STEP_GOAL:2'),
    f('shelf.trophyB', 'anyFamily:1'), f('wall.panel', 'counter:recaps_read:4'),
  ];
  expect(piecesForBadge(fresh, 'SLEEP_GOAL', 2)).toEqual(['rug.red', 'art.motto', 'shelf.trophyB']);
  expect(piecesForBadge(fresh, 'SLEEP_GOAL', 1)).toEqual(['rug.red', 'shelf.trophyB']);
});

it('opens decorate mode on the piece\'s tab and slot', () => {
  expect(decorateTarget('rug.red')).toEqual({ drawer: 'new', item: 'rug.red' });
  expect(decorateTarget('out.scarf')).toEqual({ drawer: 'new', item: 'out.scarf' });
});
