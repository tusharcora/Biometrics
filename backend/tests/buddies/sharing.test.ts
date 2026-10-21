import { prisma } from '../../src/db/client';
import { connection } from '../../src/sync/queue';
import { migrateTestDb } from '../setupTestDb';
import { authHeaderFor } from '../helpers/auth';
import { BUDDY_SHARING_CONSENT_VERSION, effectiveSharing, parseSharingPatch, updateSharing } from '../../src/buddies/sharing';
import { api, buddyUser } from './helpers';

beforeAll(() => migrateTestDb());
afterAll(async () => {
  await prisma.$disconnect();
  await connection.quit();
});

const ALL_OFF = { recovery: false, sleepScore: false, hoursSlept: false, steps: false, streaks: false, room: false };
const row = (over: object = {}) => ({
  shareRecovery: true, shareSleepScore: true, shareHoursSlept: true, shareSteps: true, shareStreaks: true,
  shareRoom: false,
  buddySharingConsentVersion: BUDDY_SHARING_CONSENT_VERSION, ...over,
});

it('effective sharing is the stored switches only under the current consent version', () => {
  expect(effectiveSharing(row())).toEqual({ recovery: true, sleepScore: true, hoursSlept: true, steps: true, streaks: true, room: false });
  expect(effectiveSharing(row({ buddySharingConsentVersion: null }))).toEqual(ALL_OFF);
  expect(effectiveSharing(row(), BUDDY_SHARING_CONSENT_VERSION + 1)).toEqual(ALL_OFF);
});

it('parses only a non-empty patch of known switches with boolean values', () => {
  expect(parseSharingPatch({ steps: true, streaks: false })).toEqual({ steps: true, streaks: false });
  for (const bad of [{}, { steps: 'yes' }, { mood: true }, [true], null, 'steps']) expect(parseSharingPatch(bad)).toBeNull();
});

describe('the room switch (spec 2026-10-15 §10.1, controller ruling)', () => {
  it('passes through as stored, whatever the health consent', () => {
    expect(effectiveSharing(row({ shareRoom: true, buddySharingConsentVersion: null })).room).toBe(true);
    expect(effectiveSharing(row({ shareRoom: true }), BUDDY_SHARING_CONSENT_VERSION + 1)).toMatchObject({ room: true, steps: false });
    expect(parseSharingPatch({ room: true })).toEqual({ room: true });
  });

  it('turns on without the health consent and survives a consent-version bump; off never asks', async () => {
    const user = await buddyUser();
    const headers = await authHeaderFor(user.id);
    const agent = await api();
    const on = await agent.put('/me/buddies/sharing').set(headers).send({ room: true });
    expect([on.status, on.body]).toEqual([200, { consentVersion: BUDDY_SHARING_CONSENT_VERSION, consented: false, ...ALL_OFF, room: true }]);
    // A bump looks like an older stored version: the health switches read off, the room stays open.
    await prisma.user.update({ where: { id: user.id }, data: { buddySharingConsentVersion: BUDDY_SHARING_CONSENT_VERSION - 1 } });
    expect((await agent.get('/me/buddies/sharing').set(headers)).body.room).toBe(true);
    // Mixing a health key into the patch still needs the health consent, and writes nothing.
    const mixed = await agent.put('/me/buddies/sharing').set(headers).send({ room: false, steps: true });
    expect([mixed.status, mixed.body]).toEqual([409, { error: 'consent_required' }]);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).shareRoom).toBe(true);
    const off = await agent.put('/me/buddies/sharing').set(headers).send({ room: false });
    expect(off.body.room).toBe(false);
  });
});

describe('routes', () => {
  it('starts all off and unconsented; enabling needs consent for the current version', async () => {
    const user = await buddyUser();
    const headers = await authHeaderFor(user.id);
    const agent = await api();
    expect((await agent.get('/me/buddies/sharing').set(headers)).body).toEqual({ consentVersion: BUDDY_SHARING_CONSENT_VERSION, consented: false, ...ALL_OFF });

    const refused = await agent.put('/me/buddies/sharing').set(headers).send({ steps: true });
    expect([refused.status, refused.body]).toEqual([409, { error: 'consent_required' }]);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).shareSteps).toBe(false);

    const stale = await agent.post('/me/buddies/sharing/consent').set(headers).send({ version: BUDDY_SHARING_CONSENT_VERSION - 1 });
    expect([stale.status, stale.body]).toEqual([400, { error: 'stale_consent_version' }]);

    const consent = await agent.post('/me/buddies/sharing/consent').set(headers).send({ version: BUDDY_SHARING_CONSENT_VERSION });
    expect(consent.body).toMatchObject({ consented: true });
    const on = await agent.put('/me/buddies/sharing').set(headers).send({ steps: true });
    expect(on.body).toEqual({ consentVersion: BUDDY_SHARING_CONSENT_VERSION, consented: true, ...ALL_OFF, steps: true });

    const invalid = await agent.put('/me/buddies/sharing').set(headers).send({ mood: false });
    expect([invalid.status, invalid.body]).toEqual([400, { error: 'invalid_settings' }]);
  });

  it('after a version bump every switch reads off until re-consent, then the stored values return', async () => {
    const user = await buddyUser();
    const headers = await authHeaderFor(user.id);
    // The user consented to an older version: exactly what a bump of the constant looks like to them.
    await prisma.user.update({ where: { id: user.id }, data: { shareSteps: true, shareStreaks: true, buddySharingConsentVersion: BUDDY_SHARING_CONSENT_VERSION - 1 } });
    const agent = await api();
    expect((await agent.get('/me/buddies/sharing').set(headers)).body).toEqual({ consentVersion: BUDDY_SHARING_CONSENT_VERSION, consented: false, ...ALL_OFF });
    // Turning a switch off needs no consent.
    expect((await agent.put('/me/buddies/sharing').set(headers).send({ streaks: false })).status).toBe(200);
    await agent.post('/me/buddies/sharing/consent').set(headers).send({ version: BUDDY_SHARING_CONSENT_VERSION });
    expect((await agent.get('/me/buddies/sharing').set(headers)).body).toEqual({ consentVersion: BUDDY_SHARING_CONSENT_VERSION, consented: true, ...ALL_OFF, steps: true });
  });

  it('the consent gate is part of the write: consent gone by the time of the update leaves the switch off', async () => {
    const user = await buddyUser();
    // Stale consent in the database, while an earlier read (say, before a version bump landed) still saw it current.
    await prisma.user.update({ where: { id: user.id }, data: { buddySharingConsentVersion: BUDDY_SHARING_CONSENT_VERSION - 1 } });
    const consentedRead = { ...row(), shareSteps: false };
    jest.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(consentedRead as never);
    try {
      await expect(updateSharing(user.id, { steps: true })).rejects.toMatchObject({ code: 'consent_required' });
    } finally {
      jest.restoreAllMocks();
    }
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).shareSteps).toBe(false);
  });

  it('answers GET sharing with Cache-Control private, no-store', async () => {
    const user = await buddyUser();
    const res = await (await api()).get('/me/buddies/sharing').set(await authHeaderFor(user.id));
    expect([res.status, res.headers['cache-control']]).toEqual([200, 'private, no-store']);
  });

  it('records the mood notice once', async () => {
    const user = await buddyUser({ notice: false });
    const headers = await authHeaderFor(user.id);
    const agent = await api();
    expect((await agent.post('/me/buddies/mood-notice').set(headers)).body).toEqual({ moodNoticeSeen: true });
    const first = (await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).buddyMoodNoticeAt;
    await agent.post('/me/buddies/mood-notice').set(headers);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).buddyMoodNoticeAt).toEqual(first);
    expect((await agent.get('/me/buddies/me').set(headers)).body.moodNoticeSeen).toBe(true);
  });
});
