// The room sizes' gates (spec 2026-10-15 §7, C2, C8): coins AND a badge level, always both. A level is never revoked,
// so a broken streak after it costs nothing (C2's grace days). The export copies these to the app (ruling 37).
import type { AchievementFamily } from '@prisma/client';

export const TIER_GATES: Readonly<Record<2 | 3, { price: number; family: AchievementFamily; level: number }>> = {
  2: { price: 600, family: 'CHECK_IN', level: 2 },
  3: { price: 1500, family: 'SLEEP_GOAL', level: 3 },
};
