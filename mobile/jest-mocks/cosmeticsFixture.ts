// The GET /me/cosmetics body the mobile tests use (plan ruling 22): a new user's starter layout and counts. Tests
// override what they need. `welcomed` is true so the welcome card stays away unless a test asks for it.
import type { CosmeticsDTO } from '../src/api/cosmetics';
import { CATALOGUE } from '../src/lib/room/catalogue';
import { EMPTY_WORN } from '../src/lib/room/loadout';

export const STARTER_COUNTS: Readonly<Record<string, number>> = Object.fromEntries(
  CATALOGUE.items.filter((i) => i.unlock.kind === 'starter').map((i) => [i.id, 1]),
);

export function cosmeticsDTO(over: Partial<CosmeticsDTO> = {}): CosmeticsDTO {
  return {
    catalogueVersion: 1,
    owned: Object.keys(STARTER_COUNTS).sort(),
    fresh: [],
    layout: JSON.parse(JSON.stringify(CATALOGUE.starterLayout)),
    tier: 1,
    cap: 40,
    counts: { ...STARTER_COUNTS },
    worn: { ...EMPTY_WORN },
    version: 1,
    counters: { recapsRead: 0, buddyCheers: 0 },
    welcomed: true,
    ...over,
  };
}
