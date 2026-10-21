import { prisma } from '../../src/db/client';
import { authHeaderFor } from '../helpers/auth';
import { buddyUser, pairUp } from '../buddies/helpers';

/** Two buddies, both with a handle and the mood notice, each in the given zone. */
export async function pairedPair(zones: [string, string] = ['UTC', 'UTC']) {
  const a = await buddyUser({ timezone: zones[0] });
  const b = await buddyUser({ timezone: zones[1] });
  await pairUp(a.id, b.id);
  return { a, b, ha: await authHeaderFor(a.id), hb: await authHeaderFor(b.id) };
}

/** The owner turns "Buddies can visit my room" on (spec §10.1). */
export async function openRoom(userId: string): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { shareRoom: true } });
}
