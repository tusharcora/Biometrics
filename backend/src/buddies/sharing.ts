// What a buddy may see beyond mood and coach (spec 2026-10-06 buddies §1, §4; free-build 2026-10-15 §10.1): five
// health switches under a versioned consent, and the room switch with its own one-line consent. All off, one set
// for all buddies. Enabling a health switch needs consent for the CURRENT version; after a bump every health switch
// reads off (in every response and every buddy view) until the user re-consents, and then the stored values return.
// The room switch never asks for, or depends on, the health consent. Always read the switches through
// effectiveSharing.

import { prisma } from '../db/client';
import { BuddyError } from './errors';

export const BUDDY_SHARING_CONSENT_VERSION = 1;

export const HEALTH_SHARE_KEYS = ['recovery', 'sleepScore', 'hoursSlept', 'steps', 'streaks'] as const;
export type HealthShareKey = (typeof HEALTH_SHARE_KEYS)[number];
/** The five health switches and `room` (spec 2026-10-15 §10.1): buddies can visit my room. */
export const SHARE_KEYS = [...HEALTH_SHARE_KEYS, 'room'] as const;
export type ShareKey = (typeof SHARE_KEYS)[number];
export type Sharing = Record<ShareKey, boolean>;

export const SHARE_COLUMNS = {
  recovery: 'shareRecovery',
  sleepScore: 'shareSleepScore',
  hoursSlept: 'shareHoursSlept',
  steps: 'shareSteps',
  streaks: 'shareStreaks',
  room: 'shareRoom',
} as const satisfies Record<ShareKey, string>;

export const SHARING_SELECT = {
  shareRecovery: true,
  shareSleepScore: true,
  shareHoursSlept: true,
  shareSteps: true,
  shareStreaks: true,
  shareRoom: true,
  buddySharingConsentVersion: true,
} as const;

export interface SharingRow {
  shareRecovery: boolean;
  shareSleepScore: boolean;
  shareHoursSlept: boolean;
  shareSteps: boolean;
  shareStreaks: boolean;
  shareRoom: boolean;
  buddySharingConsentVersion: number | null;
}

/** For relation filters: "this user currently shares streaks & badges". */
export const SHARES_STREAKS_WHERE = { shareStreaks: true, buddySharingConsentVersion: BUDDY_SHARING_CONSENT_VERSION } as const;

/** The health switches need the CURRENT consent version; the room switch is its own consent (spec §10.1). */
export function effectiveSharing(row: SharingRow, version: number = BUDDY_SHARING_CONSENT_VERSION): Sharing {
  const consented = row.buddySharingConsentVersion === version;
  return {
    recovery: consented && row.shareRecovery,
    sleepScore: consented && row.shareSleepScore,
    hoursSlept: consented && row.shareHoursSlept,
    steps: consented && row.shareSteps,
    streaks: consented && row.shareStreaks,
    room: row.shareRoom,
  } satisfies Sharing;
}

/** The room is open to buddies' visits (spec §10.1): the stored switch, never the health consent. */
export const roomOpen = (row: { shareRoom: boolean }): boolean => row.shareRoom;

export interface SharingDTO extends Sharing {
  consentVersion: number;
  consented: boolean;
}

const toDTO = (row: SharingRow): SharingDTO => ({
  consentVersion: BUDDY_SHARING_CONSENT_VERSION,
  consented: row.buddySharingConsentVersion === BUDDY_SHARING_CONSENT_VERSION,
  ...effectiveSharing(row),
});

export function parseSharingPatch(body: unknown): Partial<Sharing> | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const entries = Object.entries(body as Record<string, unknown>);
  if (entries.length === 0) return null;
  const out: Partial<Sharing> = {};
  for (const [key, value] of entries) {
    if (!(SHARE_KEYS as readonly string[]).includes(key) || typeof value !== 'boolean') return null;
    out[key as ShareKey] = value;
  }
  return out;
}

export async function getSharing(userId: string): Promise<SharingDTO | null> {
  const row = await prisma.user.findUnique({ where: { id: userId }, select: SHARING_SELECT });
  return row ? toDTO(row) : null;
}

/**
 * Turning a health switch on needs current consent (consent_required); turning one off never does. The
 * consent check is part of the UPDATE's WHERE, so consent that changes meanwhile can't let a switch on.
 */
export async function updateSharing(userId: string, patch: Partial<Sharing>): Promise<SharingDTO> {
  // Only a health switch turned on needs the health consent (spec 2026-10-15 §10.1): `{ room: true }` alone does not.
  const enabling = HEALTH_SHARE_KEYS.some((key) => patch[key] === true);
  const data = Object.fromEntries(Object.entries(patch).map(([key, value]) => [SHARE_COLUMNS[key as ShareKey], value]));
  const done = await prisma.user.updateMany({
    where: { id: userId, ...(enabling ? { buddySharingConsentVersion: BUDDY_SHARING_CONSENT_VERSION } : {}) },
    data,
  });
  const row = await prisma.user.findUnique({ where: { id: userId }, select: SHARING_SELECT });
  if (!row) throw new BuddyError('not_found');
  if (done.count === 0) throw new BuddyError('consent_required');
  return toDTO(row);
}

/** The app sends the version of the text it showed; anything but the current one is refused. */
export async function recordSharingConsent(userId: string, version: unknown, now: Date): Promise<SharingDTO> {
  if (version !== BUDDY_SHARING_CONSENT_VERSION) throw new BuddyError('stale_consent_version');
  const saved = await prisma.user.update({
    where: { id: userId },
    data: { buddySharingConsentVersion: BUDDY_SHARING_CONSENT_VERSION, buddySharingConsentAt: now },
    select: SHARING_SELECT,
  });
  return toDTO(saved);
}

/** The one-time "your mood is always shared" notice (spec §4). Set once, never moved. */
export async function confirmMoodNotice(userId: string, now: Date): Promise<void> {
  await prisma.user.updateMany({ where: { id: userId, buddyMoodNoticeAt: null }, data: { buddyMoodNoticeAt: now } });
}
