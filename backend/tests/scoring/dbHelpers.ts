import { randomUUID } from 'crypto';
import { prisma } from '../../src/db/client';
import { civilDateToUtcMidnight } from '../../src/biometrics/civilDate';
import { shiftDate } from '../../src/scoring/dates';

export async function createUser(over: { timezone?: string; sleepGoalMinutes?: number } = {}) {
  return prisma.user.create({
    data: {
      email: `score-${randomUUID()}@example.com`,
      authProvider: 'GOOGLE',
      providerUserId: randomUUID(),
      ...over,
    },
  });
}

// Deterministic pseudo-noise so a failing run reproduces.
export function wave(i: number, base: number, amp: number, phase = 0): number {
  return base + amp * Math.sin((i + phase) * 1.7);
}

/**
 * Seeds `days` consecutive days of HRV, RESTING_HR, SLEEP and STEPS starting at
 * `start`. Returns the last date seeded.
 */
export async function seedHistory(userId: string, start: string, days: number): Promise<string> {
  const data = [];
  for (let i = 0; i < days; i++) {
    const recordedAt = civilDateToUtcMidnight(shiftDate(start, i));
    data.push(
      { userId, metricType: 'HRV' as const, recordedAt, value: wave(i, 50, 4) },
      { userId, metricType: 'RESTING_HR' as const, recordedAt, value: wave(i, 55, 2, 1) },
      { userId, metricType: 'SLEEP' as const, recordedAt, value: wave(i, 450, 30, 2) },
      { userId, metricType: 'STEPS' as const, recordedAt, value: wave(i, 8000, 1500, 3) },
    );
  }
  await prisma.biometricRecord.createMany({ data, skipDuplicates: true });
  return shiftDate(start, days - 1);
}

export const day = (date: string) => civilDateToUtcMidnight(date);
