// Your circle = you + your current buddies (live BuddyPair rows; a block deletes the pair, so blocked people drop
// out on their own). Sharing switches are read only through effectiveSharing (switch on AND current consent).

import { prisma } from '../db/client';
import { PERSON_SELECT, toPerson, type PersonDTO } from '../buddies/people';
import { SHARING_SELECT, effectiveSharing } from '../buddies/sharing';

export const MEMBER_SELECT = { ...PERSON_SELECT, ...SHARING_SELECT, timezone: true } as const;

export interface Member {
  person: PersonDTO;
  timezone: string;
  shares: { steps: boolean; streaks: boolean };
}

/**
 * Every current buddy's id. Unbounded on purpose: Buddies has no buddy cap, and S1 circles are small, so every
 * Social read loads the whole circle (fine for S1; a cap or paging would come with growth).
 */
export async function buddyIdsOf(userId: string): Promise<string[]> {
  const pairs = await prisma.buddyPair.findMany({
    where: { OR: [{ userAId: userId }, { userBId: userId }] },
    select: { userAId: true, userBId: true },
  });
  return pairs.map((p) => (p.userAId === userId ? p.userBId : p.userAId));
}

export async function membersById(ids: string[]): Promise<Map<string, Member>> {
  if (ids.length === 0) return new Map();
  const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: MEMBER_SELECT });
  return new Map(users.map((u) => {
    const s = effectiveSharing(u);
    return [u.id, { person: toPerson(u), timezone: u.timezone, shares: { steps: s.steps, streaks: s.streaks } }];
  }));
}
