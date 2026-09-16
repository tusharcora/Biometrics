import { prisma } from '../db/client';
import { BiometricMetricType, HealthMetricPoint } from '../types';

export async function upsertBiometricRecords(
  userId: string,
  metricType: BiometricMetricType,
  points: HealthMetricPoint[],
): Promise<void> {
  for (const point of points) {
    await prisma.biometricRecord.upsert({
      where: { userId_metricType_recordedAt: { userId, metricType, recordedAt: point.recordedAt } },
      update: { value: point.value, syncedAt: new Date() },
      create: { userId, metricType, recordedAt: point.recordedAt, value: point.value },
    });
  }
}

export async function getBiometricsForUser(userId: string) {
  return prisma.biometricRecord.findMany({
    where: { userId },
    // Only what the dashboard actually renders; userId and syncedAt are
    // internal and need not be exposed to the client.
    select: { id: true, metricType: true, value: true, recordedAt: true },
    orderBy: { recordedAt: 'desc' },
  });
}
