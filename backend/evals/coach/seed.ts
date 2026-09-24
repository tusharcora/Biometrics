// Seeds a UserSnapshot into the database for one fixture run and removes it
// afterwards. Uses a throwaway user per run so fixtures never see each other's
// rows, and cleans up after itself (the CLI can point at any dev/test database).

import { randomUUID } from 'crypto';
import { civilDateToUtcMidnight, localCivilDate } from '../../src/biometrics/civilDate';
import { prisma } from '../../src/db/client';
import { deleteUserCoachData } from '../../src/coach/retention';
import { shiftDate } from '../../src/scoring/dates';
import type { UserSnapshot } from './types';

const RECOVERY_FACTORS = [
  { factor: 'HRV', z: 1, weight: 0.45, contribution: 0.45, points: 6, imputed: false, excluded: false },
  { factor: 'RHR', z: -0.5, weight: 0.35, contribution: 0.175, points: 2.33, imputed: false, excluded: false },
  { factor: 'SLEEP_DEBT', z: 0.5, weight: 0.2, contribution: -0.1, points: -1.33, imputed: false, excluded: false },
];

export const todayCivil = () => localCivilDate(new Date(), 'UTC');

export async function seedSnapshot(snapshot: UserSnapshot): Promise<{ userId: string; conversationId: string }> {
  const user = await prisma.user.create({
    data: { email: `eval-${randomUUID()}@example.com`, name: 'Test User' },
  });
  const today = todayCivil();
  const scoreRows = [
    ...(snapshot.recovery ?? []).map(([daysAgo, score]) => ({ daysAgo, score, type: 'RECOVERY' as const })),
    ...(snapshot.sleep ?? []).map(([daysAgo, score]) => ({ daysAgo, score, type: 'SLEEP' as const })),
  ];
  for (const row of scoreRows) {
    await prisma.dailyScore.create({
      data: {
        userId: user.id,
        date: civilDateToUtcMidnight(shiftDate(today, -row.daysAgo)),
        type: row.type,
        algorithmVersion: 'v1',
        score: row.score,
        confidenceLevel: 'HIGH',
        factors: (row.type === 'RECOVERY' ? RECOVERY_FACTORS : []) as never,
      },
    });
  }
  // Fixtures run their question as the next message of one ongoing
  // conversation, and a pending proposal is settled only from the conversation
  // it was made in, so the seeded PENDING rows have to belong to that one.
  const conversation = await prisma.coachConversation.create({ data: { userId: user.id } });
  for (const [status, entries] of [
    ['PENDING', snapshot.pendingMemories ?? []],
    ['CONFIRMED', snapshot.confirmedMemories ?? []],
  ] as const) {
    for (const e of entries) {
      await prisma.coachMemory.create({
        data: {
          userId: user.id,
          category: e.category,
          value: e.value,
          status,
          ...(status === 'PENDING' ? { conversationId: conversation.id } : {}),
          ...(status === 'CONFIRMED' ? { confirmedAt: new Date() } : {}),
        },
      });
    }
  }
  return { userId: user.id, conversationId: conversation.id };
}

export async function cleanupUser(userId: string): Promise<void> {
  await deleteUserCoachData(userId);
  await prisma.dailyScore.deleteMany({ where: { userId } });
  await prisma.user.deleteMany({ where: { id: userId } });
}
