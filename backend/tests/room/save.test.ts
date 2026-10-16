import { Prisma } from '@prisma/client';
import { prisma } from '../../src/db/client';
import { connection } from '../../src/sync/queue';
import { migrateTestDb } from '../setupTestDb';
import { authHeaderFor } from '../helpers/auth';
import { api, buddyUser } from '../buddies/helpers';
import { EMPTY_WORN, STARTER_ROOM } from '../../src/cosmetics/catalogue';
import { starterLayout } from '../../src/room/convert';
import { lockRoom } from '../../src/room/lock';
import type { RoomLayout } from '../../src/room/geometry';
import { piece, withPieces } from './helpers';

beforeAll(() => migrateTestDb());
afterAll(async () => {
  await prisma.$disconnect();
  await connection.quit();
});
let info: jest.SpyInstance;
beforeEach(() => { info = jest.spyOn(console, 'info').mockImplementation(() => {}); });
afterEach(() => info.mockRestore());

async function me() {
  const user = await buddyUser();
  return { user, headers: await authHeaderFor(user.id) };
}
const put = async (headers: Record<string, string>, body: unknown) => (await api()).put('/me/cosmetics').set(headers).send(body as object);
const body = (layout: RoomLayout = starterLayout(), version = 0, worn: Record<string, string | null> = { ...EMPTY_WORN }) => ({ layout, worn, version });
const fern = (id: string, x: number, y: number) => piece(id, 'plant.fern', { x, y });

describe('PUT /me/cosmetics (free-build §12)', () => {
  it('saves a layout of owned pieces, answers the GET body, and logs counts only', async () => {
    const { user, headers } = await me();
    const layout = withPieces(piece('p1', 'plant.cactus', { x: 6, y: 6 }));
    const res = await put(headers, body(layout, 0, { ...EMPTY_WORN, head: 'out.beanie' }));
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('private, no-store');
    expect([res.body.layout, res.body.worn.head, res.body.version, 'room' in res.body]).toEqual([layout, 'out.beanie', 1, false]);
    const lines = info.mock.calls.map((c) => String(c[0])).filter((l) => l.includes('room.saved'));
    expect(lines.map((l) => JSON.parse(l))).toEqual([{ event: 'room.saved', pieces: 8, tier: 1 }]);
    expect(lines.join('')).not.toContain(user.id);
  });

  it('400 update_app for a Spec B slot body (spec §2.4)', async () => {
    const { headers } = await me();
    const res = await put(headers, { room: { ...STARTER_ROOM }, worn: { ...EMPTY_WORN }, version: 0 });
    expect([res.status, res.body]).toEqual([400, { error: 'update_app' }]);
  });

  it.each([
    ['no body', () => undefined],
    ['a missing layout', () => ({ worn: { ...EMPTY_WORN }, version: 0 })],
    ['an extra key', () => ({ ...body(), tier: 3 })],
    ['a bad layout shape', () => ({ ...body(), layout: { v: 1, styles: {}, pieces: [] } })],
    ['a duplicate instance id', () => body({ ...starterLayout(), pieces: [...starterLayout().pieces, fern('desk', 6, 6)] })],
    ['a missing worn key', () => ({ ...body(), worn: { head: null, face: null, neck: null } })],
    ['an extra worn key', () => ({ ...body(), worn: { ...EMPTY_WORN, tail: null } })],
    ['a non-integer version', () => body(starterLayout(), 1.5)],
    ['a negative version', () => body(starterLayout(), -1)],
    ['a version past 2^31 - 1', () => body(starterLayout(), 2 ** 31)],
  ])('400 invalid_body for %s', async (_label, make) => {
    const { headers } = await me();
    const res = await put(headers, make());
    expect([res.status, res.body]).toEqual([400, { error: 'invalid_body' }]);
  });

  it('400 invalid_body for a valid body over 32 KB (plan ruling 14): the cap, not the shape, refuses it', async () => {
    const { headers } = await me();
    const raw = JSON.stringify(body());
    for (const pad of [40 * 1024, 120 * 1024]) { // 120 KB is past the global parser's 100 KB default (its 413)
      const res = await (await api()).put('/me/cosmetics').set(headers).set('Content-Type', 'application/json').send(raw + ' '.repeat(pad));
      expect([res.status, res.body]).toEqual([400, { error: 'invalid_body' }]);
    }
    const ok = await (await api()).put('/me/cosmetics').set(headers).set('Content-Type', 'application/json').send(raw + ' '.repeat(1024));
    expect(ok.status).toBe(200);
  });

  it('400 unknown_item for a piece or style that is not shipped', async () => {
    const { headers } = await me();
    for (const layout of [withPieces(piece('p1', 'plant.nope', { x: 6, y: 6 })), { ...starterLayout(), styles: { ...starterLayout().styles, wallpaper: 'wall.shoji' } }]) {
      const res = await put(headers, body(layout));
      expect([res.status, res.body]).toEqual([400, { error: 'unknown_item' }]);
    }
  });

  it('400 wrong_layer for a layer the item does not allow, or a style under the wrong key', async () => {
    const { headers } = await me();
    for (const layout of [withPieces(piece('p1', 'item.mug', { x: 6, y: 6 })), { ...starterLayout(), styles: { ...starterLayout().styles, wallpaper: 'floor.oakDark' } }]) {
      const res = await put(headers, body(layout));
      expect([res.status, res.body]).toEqual([400, { error: 'wrong_layer' }]);
    }
  });

  it('400 bad_place with the pieces and the reason', async () => {
    const { headers } = await me();
    const res = await put(headers, body(withPieces(piece('p1', 'plant.cactus', { x: 3, y: 2 }))));
    expect([res.status, res.body]).toEqual([400, { error: 'bad_place', reason: 'seat', pieceIds: ['desk', 'p1'] }]); // the desk is checked first
  });

  it('400 desk_required without exactly one desk', async () => {
    const { headers } = await me();
    const noDesk = { ...starterLayout(), pieces: starterLayout().pieces.filter((p) => p.id !== 'desk' && p.parent !== 'desk') };
    expect((await put(headers, body(noDesk))).body).toEqual({ error: 'desk_required' });
  });

  it('400 room_full past the cap, before ownership is checked', async () => {
    const { headers } = await me();
    const tiles: Array<[number, number]> = [];
    for (let x = 0; x < 7; x++) for (let y = 0; y < 7; y++) if (!(x >= 2 && x < 5 && y < 2) && !(x === 3 && y === 2)) tiles.push([x, y]);
    const layout: RoomLayout = { ...starterLayout(), pieces: [piece('desk', 'desk.monitor', { x: 2 }), ...tiles.slice(0, 40).map(([x, y], k) => fern(`f${k}`, x, y))] };
    expect((await put(headers, body(layout))).body).toEqual({ error: 'room_full' });
  });

  it('403 not_owned when more copies are placed than owned, or a style or worn piece is not owned', async () => {
    const { headers } = await me();
    const two = withPieces(fern('p1', 6, 6));
    expect((await put(headers, body(two))).body).toEqual({ error: 'not_owned', itemIds: ['plant.fern'] });
    const res = await put(headers, body({ ...starterLayout(), styles: { ...starterLayout().styles, wallpaper: 'wall.brick' } }, 0, { ...EMPTY_WORN, head: 'out.cap' }));
    expect([res.status, res.body]).toEqual([403, { error: 'not_owned', itemIds: ['out.cap', 'wall.brick'] }]);
  });

  it('409 stale for an old version; two concurrent first saves give one 200 and one 409; the next version saves', async () => {
    const { headers } = await me();
    const [a, b] = await Promise.all([put(headers, body()), put(headers, body())]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect((await put(headers, body())).body).toEqual({ error: 'stale' });
    const next = await put(headers, body(starterLayout(), 1));
    expect([next.status, next.body.version]).toEqual([200, 2]);
  });

  it('a welcomed user\'s first save still creates the row at version 1 (spec §11.1)', async () => {
    const { headers } = await me();
    expect((await (await api()).post('/me/room/welcomed').set(headers)).status).toBe(204);
    const res = await put(headers, body());
    expect([res.status, res.body.version, res.body.welcomed]).toEqual([200, 1, true]);
  });

  it('sets firstPlacedAt once, on the first save holding an instance id the stored layout did not have', async () => {
    const { user, headers } = await me();
    await put(headers, body());
    const firstWeek = () => prisma.roomFirstWeek.findUnique({ where: { userId: user.id } });
    expect((await firstWeek())?.firstPlacedAt ?? null).toBeNull();
    await put(headers, body(withPieces(piece('p1', 'plant.cactus', { x: 6, y: 6 })), 1));
    const placedAt = (await firstWeek())!.firstPlacedAt;
    expect(placedAt).toBeInstanceOf(Date);
    await put(headers, body(withPieces(piece('p2', 'plant.cactus', { x: 6, y: 6 })), 2));
    expect((await firstWeek())!.firstPlacedAt).toEqual(placedAt);
  });

  it('needs a session', async () => {
    expect((await (await api()).put('/me/cosmetics').send({})).status).toBe(401);
  });
});

describe('the room lock (spec §2.2, §12 Concurrency)', () => {
  it('serialises room writes for one user', async () => {
    const user = await buddyUser();
    const order: string[] = [];
    const a = prisma.$transaction(async (tx) => {
      await lockRoom(tx, user.id);
      order.push('a in');
      await new Promise((r) => setTimeout(r, 300));
      order.push('a out');
    });
    await new Promise((r) => setTimeout(r, 50));
    const b = prisma.$transaction(async (tx) => {
      await lockRoom(tx, user.id);
      order.push('b in');
    });
    await Promise.all([a, b]);
    expect(order).toEqual(['a in', 'a out', 'b in']);
  });
});

describe('PUT /me/cosmetics takes the room lock', () => {
  it('waits while another transaction holds the lock, and saves once it is released', async () => {
    const { user, headers } = await me();
    let release!: () => void;
    let locked!: () => void;
    const held = new Promise<void>((r) => { release = r; });
    const isLocked = new Promise<void>((r) => { locked = r; });
    const holder = prisma.$transaction(async (tx) => {
      await lockRoom(tx, user.id);
      locked();
      await held;
    }, { timeout: 10_000 });
    await isLocked;
    let done = false;
    const save = put(headers, body()).then((res) => { done = true; return res; });
    await new Promise((r) => setTimeout(r, 200));
    expect(done).toBe(false);
    release();
    await holder;
    const res = await save;
    expect([done, res.status, res.body.version]).toEqual([true, 200, 1]);
  });
});

describe('POST /me/room/welcomed', () => {
  it('answers 204, is idempotent, keeps the first time, and needs a session', async () => {
    const { user, headers } = await me();
    expect((await (await api()).post('/me/room/welcomed').set(headers)).status).toBe(204);
    const at = (await prisma.roomFirstWeek.findUnique({ where: { userId: user.id } }))!.welcomedAt;
    await Promise.all([(await api()).post('/me/room/welcomed').set(headers), (await api()).post('/me/room/welcomed').set(headers)]);
    expect((await prisma.roomFirstWeek.findUnique({ where: { userId: user.id } }))!.welcomedAt).toEqual(at);
    expect((await (await api()).post('/me/room/welcomed')).status).toBe(401);
  });
});

describe('effect slots (spec §8.1, §12, P3 ruling 4)', () => {
  const clocks = [
    piece('c1', 'art.clock', { layer: 'wallR', x: 0, y: 0 }),
    piece('c2', 'art.clock', { layer: 'wallR', x: 10, y: 0 }),
    piece('c3', 'art.clock', { layer: 'wallL', x: 0, y: 0 }),
  ];
  const fourth = piece('c4', 'art.clock', { layer: 'wallL', x: 9, y: 0 });
  async function withClocks() {
    const m = await me();
    await prisma.itemGrant.create({ data: { userId: m.user.id, itemId: 'art.clock', qty: 4, sourceKey: 'test:clocks' } });
    return m;
  }

  it('saves up to the slots, and answers 400 effects_full with the slots for one more', async () => {
    const { headers } = await withClocks();
    expect((await put(headers, body(withPieces(...clocks), 0))).status).toBe(200);
    const res = await put(headers, body(withPieces(...clocks, fourth), 1));
    expect([res.status, res.body]).toEqual([400, { error: 'effects_full', slots: 3 }]);
  });

  it('a room stored before P3 with more than its slots still saves any other change, and keeps every piece', async () => {
    const { user, headers } = await withClocks();
    expect((await put(headers, body(withPieces(...clocks), 0))).status).toBe(200);
    const four = withPieces(...clocks, fourth);
    await prisma.cosmeticLoadout.update({ where: { userId: user.id }, data: { layout: four as unknown as Prisma.InputJsonValue } });
    const moved = { ...four, pieces: four.pieces.map((p) => (p.id === 'plant' ? { ...p, x: 0, y: 3 } : p)) };
    const res = await put(headers, body(moved, 1));
    expect(res.status).toBe(200);
    expect(res.body.layout.pieces.filter((p: { item: string }) => p.item === 'art.clock')).toHaveLength(4);
  });

  it('the cap answers before the slots: a room over its cap is room_full, not effects_full', async () => {
    const { headers } = await withClocks();
    // 7 starter pieces + 4 clocks + 30 cacti on free tiles (not the desk, its exit tile or the fern) = 41 > 40.
    const taken = (x: number, y: number) => (x >= 2 && x <= 4 && y <= 1) || (x === 3 && y === 2) || (x === 0 && y === 0);
    const tiles = Array.from({ length: 49 }, (_, k) => [k % 7, Math.floor(k / 7)] as const).filter(([x, y]) => !taken(x, y)).slice(0, 30);
    const cacti = tiles.map(([x, y], k) => piece(`k${k}`, 'plant.cactus', { x, y }));
    const res = await put(headers, body(withPieces(...clocks, fourth, ...cacti), 0));
    expect([res.status, res.body.error]).toEqual([400, 'room_full']);
  });
});
