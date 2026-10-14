import express from 'express';
import request from 'supertest';
import { prisma } from '../../src/db/client';
import { civilDateToUtcMidnight } from '../../src/biometrics/civilDate';
import { migrateTestDb } from '../setupTestDb';
import { authHeaderFor } from '../helpers/auth';
import { testServer } from '../helpers/server';
import { createCoachRouter } from '../../src/coach/routes';
import { COACH_CONSENT_VERSION } from '../../src/coach/consent';
import type { FactSheet } from '../../src/coach/answer/facts';
import type { CoachModelProvider, CoachStreamRequest } from '../../src/coach/model/provider';
import { FakeClock, RecordingTelemetry, createUser } from './helpers';

beforeAll(() => {
  migrateTestDb();
  process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 3).toString('base64');
});
afterAll(async () => {
  await prisma.$disconnect();
});

let savedFlag: string | undefined;
beforeEach(() => {
  savedFlag = process.env.COACH_ENABLED;
  process.env.COACH_ENABLED = 'true';
  jest.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => {
  if (savedFlag === undefined) delete process.env.COACH_ENABLED;
  else process.env.COACH_ENABLED = savedFlag;
  jest.restoreAllMocks();
});

const NOW = new Date('2026-09-30T12:00:00Z');
const DAY = civilDateToUtcMidnight('2026-09-30');
const SHEET: FactSheet = {
  route: 'today',
  facts: [{ id: 'recovery.today', label: 'Recovery today', value: 26, unit: 'score', display: '26', usual: 58 }],
  notes: [],
};
const NEW_VOICE = 'Recovery is 26, so we go easy and still move. Short walk, early night.';

function setup(today: { now?: () => Date } = {}) {
  const requests: CoachStreamRequest[] = [];
  const local: CoachModelProvider = {
    id: 'local',
    async *stream(req: CoachStreamRequest) {
      requests.push(req);
      yield NEW_VOICE;
    },
  };
  const tasks: Array<() => Promise<unknown>> = [];
  const a = express();
  a.use(express.json());
  a.use(
    createCoachRouter({
      getProvider: () => local,
      getHostedProvider: () => null,
      telemetry: new RecordingTelemetry(),
      clock: new FakeClock(),
      today: { loadSheet: async () => SHEET, now: () => NOW, ...today },
      background: (task) => {
        tasks.push(task);
      },
    }),
  );
  return { app: a, requests, tasks };
}

async function userWithSummary(personaId: string | null) {
  const user = await createUser();
  if (personaId !== null) await prisma.user.update({ where: { id: user.id }, data: { coachPersonaId: personaId } });
  await prisma.coachConsent.create({ data: { userId: user.id, version: COACH_CONSENT_VERSION } });
  await prisma.coachDaySummary.create({
    data: { userId: user.id, date: DAY, text: 'Old voice.', spans: [{ text: 'Old voice.' }], source: 'AI' },
  });
  return user;
}

const rowOf = (userId: string) => prisma.coachDaySummary.findUnique({ where: { userId_date: { userId, date: DAY } } });

async function choose(app: express.Express, userId: string, personaId: string) {
  return request(await testServer(app))
    .put('/me/coach/persona')
    .set(await authHeaderFor(userId))
    .send({ personaId });
}

// Spec 2026-10-14 §2: there is nobody to switch to, so an old app's character pick never touches today's sentence.
describe('PUT /me/coach/persona and the day summary', () => {
  it('a stored summary survives an old app picking luna, unchanged', async () => {
    const user = await userWithSummary('mochi');
    const before = await rowOf(user.id);
    const { app, requests, tasks } = setup();
    const res = await choose(app, user.id, 'luna');
    expect([res.status, res.body]).toEqual([200, { personaId: 'kip' }]);
    const after = await rowOf(user.id);
    expect(after).toMatchObject({ id: before!.id, createdAt: before!.createdAt, text: 'Old voice.' });
    expect(tasks).toHaveLength(0);
    expect(requests).toHaveLength(0);
  });
});
