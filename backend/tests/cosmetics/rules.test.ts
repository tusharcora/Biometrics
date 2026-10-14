import { COSMETIC_ITEMS, COSMETIC_SETS, type CosmeticItem, type CosmeticSet } from '../../src/cosmetics/catalogue';
import { BACKFILL, metAt, planGrants, sourceOf, type UnlockFacts } from '../../src/cosmetics/rules';

const t = (iso: string) => new Date(iso);
const NONE: UnlockFacts = { levels: [], recapsReadAt: [], cheersAt: [] };
const SETS = new Map(COSMETIC_SETS.map((s) => [s.id, s]));
const LAUNCH = { 1: t('2026-10-15T00:00:00Z') };
const plan = (facts: UnlockFacts, over: Partial<Parameters<typeof planGrants>[0]> = {}) =>
  planGrants({ items: COSMETIC_ITEMS, sets: COSMETIC_SETS, facts, owned: new Set(), release: 1, launchedAt: LAUNCH, ...over });
const ids = (rows: { itemId: string }[]) => rows.map((r) => r.itemId).sort();

describe('metAt', () => {
  const facts: UnlockFacts = {
    levels: [
      { family: 'STEADY_BEDTIME', level: 1, at: t('2026-10-16T08:00:00Z') },
      { family: 'STEADY_BEDTIME', level: 2, at: t('2026-10-20T08:00:00Z') },
      { family: 'STEP_GOAL', level: 1, at: t('2026-10-17T08:00:00Z') },
    ],
    recapsReadAt: [t('2026-10-16T09:00:00Z'), t('2026-10-23T09:00:00Z'), t('2026-10-30T09:00:00Z'), t('2026-11-06T09:00:00Z')],
    cheersAt: [t('2026-10-16T10:00:00Z')],
  };
  it('a family level is met when that level (or a higher one) was stored', () => {
    expect(metAt({ kind: 'family', family: 'STEADY_BEDTIME', level: 2 }, facts, SETS)).toEqual(t('2026-10-20T08:00:00Z'));
    expect(metAt({ kind: 'family', family: 'STEADY_BEDTIME', level: 3 }, facts, SETS)).toBeNull();
  });
  it('any family is met by the first family to reach the level', () => {
    expect(metAt({ kind: 'anyFamily', level: 1 }, facts, SETS)).toEqual(t('2026-10-16T08:00:00Z'));
    expect(metAt({ kind: 'anyFamily', level: 2 }, facts, SETS)).toEqual(t('2026-10-20T08:00:00Z'));
  });
  it('a counter is met at its n-th event', () => {
    expect(metAt({ kind: 'counter', counter: 'recaps_read', atLeast: 4 }, facts, SETS)).toEqual(t('2026-11-06T09:00:00Z'));
    expect(metAt({ kind: 'counter', counter: 'buddy_cheers', atLeast: 5 }, facts, SETS)).toBeNull();
  });
  it('a set piece is met when its set is; a starter is never granted', () => {
    expect(metAt({ kind: 'set', set: 'cottage' }, facts, SETS)).toEqual(t('2026-11-06T09:00:00Z'));
    expect(metAt({ kind: 'starter' }, facts, SETS)).toBeNull();
  });
  it('names each source', () => {
    expect([
      sourceOf({ kind: 'family', family: 'STEADY_BEDTIME', level: 3 }), sourceOf({ kind: 'anyFamily', level: 4 }),
      sourceOf({ kind: 'counter', counter: 'recaps_read', atLeast: 8 }), sourceOf({ kind: 'set', set: 'cottage' }),
    ]).toEqual(['family:STEADY_BEDTIME:3', 'anyFamily:4', 'counter:recaps_read:8', 'set:cottage']);
  });
});

describe('planGrants', () => {
  const after = (family: string, level: number) => ({ family, level, at: t('2026-10-20T00:00:00Z') });

  it('a family level grants its pieces and the any-family pieces of that level', () => {
    const rows = plan({ ...NONE, levels: [after('STEADY_BEDTIME', 1)] });
    expect(ids(rows)).toEqual(['lamp.kiplamp', 'out.scarf', 'shelf.trophyB', 'wall.stripes', 'win.curtains']);
    expect(rows.find((r) => r.itemId === 'wall.stripes')!.source).toBe('family:STEADY_BEDTIME:1');
    expect(rows.find((r) => r.itemId === 'shelf.trophyB')!.source).toBe('anyFamily:1');
  });

  it('4 recaps read grants the wood panel, the cork board and every Cottage piece not owned from day one', () => {
    const at = t('2026-10-20T00:00:00Z');
    const rows = plan({ ...NONE, recapsReadAt: [at, at, at, at] });
    expect(ids(rows)).toEqual([
      'art.cork', 'set.cottage.art', 'set.cottage.corner', 'set.cottage.desk', 'set.cottage.desk_item', 'set.cottage.floor',
      'set.cottage.lamp', 'set.cottage.pet', 'set.cottage.rug', 'set.cottage.shelf', 'set.cottage.wallpaper', 'set.cottage.window',
      'wall.panel',
    ]);
    expect(rows.find((r) => r.itemId === 'set.cottage.desk')!.source).toBe('set:cottage');
  });

  it('5 cheers grants florals, fairy lights, the sunflower and the party hat', () => {
    const at = t('2026-10-20T00:00:00Z');
    expect(ids(plan({ ...NONE, cheersAt: [at, at, at, at, at] }))).toEqual(['out.party', 'plant.sunflower', 'wall.florals', 'win.fairy']);
  });

  it('skips owned, retired and release-2 items, and never grants a starter', () => {
    const facts = { ...NONE, levels: [after('STEADY_BEDTIME', 1), after('STEADY_BEDTIME', 2), after('STEADY_BEDTIME', 3)] };
    const retired: CosmeticItem[] = COSMETIC_ITEMS.map((i) => (i.id === 'out.scarf' ? { ...i, retired: true } : i));
    const rows = plan(facts, { items: retired, owned: new Set(['wall.stripes']) });
    expect(ids(rows)).not.toContain('wall.stripes');
    expect(ids(rows)).not.toContain('out.scarf');
    expect(ids(rows)).not.toContain('wall.shoji'); // SB3, release 2
    expect(rows.every((r) => !COSMETIC_ITEMS.find((i) => i.id === r.itemId)!.unlock.kind.startsWith('starter'))).toBe(true);
  });

  it('decides the backfill by time: a rule met before its release launched is backfill, whichever path grants it', () => {
    const before = { family: 'STEADY_BEDTIME', level: 1, at: t('2026-10-01T00:00:00Z') };
    expect(plan({ ...NONE, levels: [before] }).every((r) => r.source === BACKFILL)).toBe(true);
    const mixed = plan({ ...NONE, levels: [before, { family: 'SLEEP_GOAL', level: 1, at: t('2026-10-16T00:00:00Z') }] });
    expect(mixed.find((r) => r.itemId === 'art.mountain')!.source).toBe('family:SLEEP_GOAL:1');
    expect(mixed.find((r) => r.itemId === 'wall.stripes')!.source).toBe(BACKFILL);
  });

  it('a release-2 item whose rule was met before the bump is backfill when granted after it', () => {
    const facts = { ...NONE, levels: [1, 2, 3].map((level) => ({ family: 'STEADY_BEDTIME', level, at: t('2026-11-01T00:00:00Z') })) };
    const launchedAt = { 1: t('2026-10-15T00:00:00Z'), 2: t('2027-01-10T00:00:00Z') };
    const rows = plan(facts, { release: 2, launchedAt });
    expect(rows.find((r) => r.itemId === 'wall.shoji')!.source).toBe(BACKFILL);
    expect(rows.find((r) => r.itemId === 'wall.stripes')!.source).toBe('family:STEADY_BEDTIME:1');
  });

  it('takes the earliest path when an item can be earned two ways', () => {
    const sets: CosmeticSet[] = COSMETIC_SETS.map((s) => (s.id === 'cottage' ? { ...s, worn: { ...s.worn, neck: 'out.scarf' } } : s));
    const items = COSMETIC_ITEMS.map((i) => (i.id === 'out.scarf' ? { ...i, sets: ['cottage' as const] } : i));
    const early = t('2026-10-16T00:00:00Z');
    const rows = plan({ levels: [{ family: 'STEADY_BEDTIME', level: 1, at: t('2026-10-30T00:00:00Z') }], recapsReadAt: [early, early, early, early], cheersAt: [] }, { items, sets });
    expect(rows.find((r) => r.itemId === 'out.scarf')!.source).toBe('set:cottage');
  });
});
