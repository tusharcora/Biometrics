import express from 'express';
import request from 'supertest';
import { RATE_LIMIT_MAX_TURNS, resetTurnGuards } from '../../src/coach/turnGuard';
import { createApp } from '../../src/app';
import { prisma } from '../../src/db/client';
import { migrateTestDb } from '../setupTestDb';
import { issueSessionTokens } from '../../src/auth/jwt';
import { createCoachRouter } from '../../src/coach/routes';
import { COACH_CONSENT_VERSION } from '../../src/coach/consent';
import { COACH_DISCLAIMER } from '../../src/coach/guardrails/disclaimer';
import { LoggerCoachTelemetry } from '../../src/coach/telemetry';
import { ScriptedProvider, ScriptStep } from '../../src/coach/model/provider';
import { FakeClock, RecordingTelemetry, createUser, daysAgo, putScore, todayUtc } from './helpers';

beforeAll(() => {
  migrateTestDb();
  process.env.JWT_ACCESS_SECRET = 'test-access-secret';
  process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 3).toString('base64');
});

afterAll(async () => {
  await prisma.$disconnect();
});

let savedFlag: string | undefined;
beforeEach(() => {
  savedFlag = process.env.COACH_ENABLED;
  process.env.COACH_ENABLED = 'true';
  jest.spyOn(console, 'info').mockImplementation(() => {}); // default telemetry sink
});
afterEach(() => {
  if (savedFlag === undefined) delete process.env.COACH_ENABLED;
  else process.env.COACH_ENABLED = savedFlag;
  jest.restoreAllMocks();
});

async function authed(userId: string) {
  const { accessToken } = await issueSessionTokens(userId);
  return { Authorization: `Bearer ${accessToken}` };
}

const GOOD = 'Your recovery is {{getDailyScore.recoveryScore}}, {{getDailyScore.direction}} than yesterday.';

/** An app whose coach runs against a scripted provider and a recording telemetry sink. */
function scriptedApp(script: ScriptStep[]) {
  const provider = new ScriptedProvider(script);
  const telemetry = new RecordingTelemetry();
  const app = express();
  app.use(express.json());
  app.use(createCoachRouter({ getProvider: () => provider, telemetry, clock: new FakeClock() }));
  return { app, provider, telemetry };
}

async function consented() {
  const user = await createUser();
  await prisma.coachConsent.create({ data: { userId: user.id, version: COACH_CONSENT_VERSION } });
  return user;
}

const ROUTES = [
  ['get', '/me/coach/status'],
  ['post', '/me/coach/consent'],
  ['delete', '/me/coach/consent'],
  ['put', '/me/coach/persona'],
  ['post', '/me/coach/message'],
  ['get', '/me/coach/conversations/latest'],
  ['get', '/me/coach/conversations/some-id'],
] as const;

describe('auth', () => {
  it.each(ROUTES)('%s %s requires a bearer token (flag on)', async (method, path) => {
    expect((await request(createApp())[method](path)).status).toBe(401);
  });

  it.each(ROUTES)('%s %s requires a bearer token (flag off)', async (method, path) => {
    process.env.COACH_ENABLED = 'false';
    expect((await request(createApp())[method](path)).status).toBe(401);
  });
});

describe('COACH_ENABLED flag (default off)', () => {
  it('is off when unset: status says enabled:false', async () => {
    delete process.env.COACH_ENABLED;
    const user = await createUser();
    const res = await request(createApp()).get('/me/coach/status').set(await authed(user.id));
    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(false);
    expect(res.body.consented).toBe(false);
  });

  it.each(['false', '0', '', 'yes-please'])('COACH_ENABLED=%j is off', async (value) => {
    process.env.COACH_ENABLED = value;
    const user = await createUser();
    const res = await request(createApp()).get('/me/coach/status').set(await authed(user.id));
    expect(res.body.enabled).toBe(false);
  });

  it.each(ROUTES.filter(([, p]) => p !== '/me/coach/status'))('%s %s returns 404 coach_disabled when off', async (method, path) => {
    process.env.COACH_ENABLED = 'false';
    const user = await consented();
    const res = await request(createApp())
      [method](path)
      .set(await authed(user.id))
      .send({ version: COACH_CONSENT_VERSION, personaId: 'direct', message: 'hi' });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'coach_disabled' });
  });

  it('never calls the model or persists anything while off', async () => {
    process.env.COACH_ENABLED = 'false';
    const { app, provider } = scriptedApp([{ type: 'text', text: GOOD }]);
    const user = await consented();
    await request(app).post('/me/coach/message').set(await authed(user.id)).send({ message: 'hi' });
    expect(provider.callCount).toBe(0);
    expect(await prisma.coachMessage.count({ where: { userId: user.id } })).toBe(0);
  });
});

describe('GET /me/coach/status', () => {
  it('returns the contract shape', async () => {
    const user = await createUser();
    const res = await request(createApp()).get('/me/coach/status').set(await authed(user.id));
    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(['consent', 'consented', 'enabled', 'personaId', 'personas']);
    expect(res.body).toMatchObject({ enabled: true, consented: false, personaId: 'encouraging' });
    expect(Object.keys(res.body.consent).sort()).toEqual(['dataItems', 'summary', 'version']);
    expect(res.body.consent.version).toBe(COACH_CONSENT_VERSION);
    expect(Array.isArray(res.body.consent.dataItems)).toBe(true);
    expect(res.body.personas).toEqual([
      { id: 'direct', name: 'Direct', verbosity: 'terse', proactivity: 'reactive-only' },
      { id: 'encouraging', name: 'Encouraging', verbosity: 'normal', proactivity: 'threshold-triggered' },
      { id: 'clinical', name: 'Clinical', verbosity: 'detailed', proactivity: 'reactive-only' },
    ]);
  });

  it('consent text states which fields leave the device and what never does', async () => {
    const user = await createUser();
    const { consent } = (await request(createApp()).get('/me/coach/status').set(await authed(user.id))).body;
    const text = `${consent.summary} ${consent.dataItems.join(' ')}`;
    expect(text).toMatch(/score/i);
    expect(text).toMatch(/factor/i);
    expect(text).toMatch(/habit/i);
    expect(text).toMatch(/goal/i);
    expect(text).toMatch(/never sent[^.]*tokens/i);
    expect(text).toMatch(/full biometric history/i);
  });
});

describe('consent gate', () => {
  it('POST /me/coach/message is 403 consent_required without consent, and the model is never called', async () => {
    const { app, provider } = scriptedApp([{ type: 'text', text: GOOD }]);
    const user = await createUser();
    const res = await request(app).post('/me/coach/message').set(await authed(user.id)).send({ message: 'hi' });
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'consent_required' });
    expect(provider.callCount).toBe(0);
    expect(await prisma.coachMessage.count({ where: { userId: user.id } })).toBe(0);
  });

  it('POST consent with the current version grants it (200 {consented:true}) and is idempotent', async () => {
    const user = await createUser();
    const app = createApp();
    const headers = await authed(user.id);
    const first = await request(app).post('/me/coach/consent').set(headers).send({ version: COACH_CONSENT_VERSION });
    const again = await request(app).post('/me/coach/consent').set(headers).send({ version: COACH_CONSENT_VERSION });
    expect(first.status).toBe(200);
    expect(first.body).toEqual({ consented: true });
    expect(again.status).toBe(200);
    expect(await prisma.coachConsent.count({ where: { userId: user.id } })).toBe(1);
    const status = await request(app).get('/me/coach/status').set(headers);
    expect(status.body.consented).toBe(true);
  });

  it('POST consent with a stale or unknown version is 409 stale_consent_version and stores nothing', async () => {
    const user = await createUser();
    const res = await request(createApp()).post('/me/coach/consent').set(await authed(user.id)).send({ version: '0-old' });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'stale_consent_version' });
    expect(await prisma.coachConsent.count({ where: { userId: user.id } })).toBe(0);
    const bad = await request(createApp()).post('/me/coach/consent').set(await authed(user.id)).send({});
    expect(bad.status).toBe(400);
  });

  it('a consent to an older version does not satisfy the current one (a version bump requires re-consent)', async () => {
    const { app, provider } = scriptedApp([{ type: 'text', text: GOOD }]);
    const user = await createUser();
    await prisma.coachConsent.create({ data: { userId: user.id, version: '0-old' } });
    const res = await request(app).post('/me/coach/message').set(await authed(user.id)).send({ message: 'hi' });
    expect(res.status).toBe(403);
    expect(provider.callCount).toBe(0);
    const status = await request(createApp()).get('/me/coach/status').set(await authed(user.id));
    expect(status.body.consented).toBe(false);
  });

  it('DELETE consent revokes it (204) and messages are refused again until re-consent', async () => {
    const { app, provider } = scriptedApp([{ type: 'text', text: 'Fine.' }, { type: 'text', text: 'Fine.' }]);
    const user = await consented();
    const headers = await authed(user.id);
    expect((await request(app).post('/me/coach/message').set(headers).send({ message: 'hi' })).status).toBe(200);

    const del = await request(createApp()).delete('/me/coach/consent').set(headers);
    expect(del.status).toBe(204);
    expect((await request(app).post('/me/coach/message').set(headers).send({ message: 'hi' })).status).toBe(403);
    expect(provider.callCount).toBe(1);

    await request(createApp()).post('/me/coach/consent').set(headers).send({ version: COACH_CONSENT_VERSION });
    expect((await request(app).post('/me/coach/message').set(headers).send({ message: 'hi' })).status).toBe(200);
    // The audit trail keeps both grants; the first is stamped revoked.
    const rows = await prisma.coachConsent.findMany({ where: { userId: user.id }, orderBy: { consentedAt: 'asc' } });
    expect(rows).toHaveLength(2);
    expect(rows[0]!.revokedAt).not.toBeNull();
    expect(rows[1]!.revokedAt).toBeNull();
  });
});

describe('PUT /me/coach/persona', () => {
  it('sets the persona, echoes it, and status reflects it', async () => {
    const user = await createUser();
    const headers = await authed(user.id);
    const res = await request(createApp()).put('/me/coach/persona').set(headers).send({ personaId: 'clinical' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ personaId: 'clinical' });
    expect((await request(createApp()).get('/me/coach/status').set(headers)).body.personaId).toBe('clinical');
    expect((await prisma.user.findUnique({ where: { id: user.id } }))?.coachPersonaId).toBe('clinical');
  });

  it.each([[{ personaId: 'pirate' }], [{}], [{ personaId: 7 }]])('400 for an unknown persona %j', async (body) => {
    const user = await createUser();
    const res = await request(createApp()).put('/me/coach/persona').set(await authed(user.id)).send(body);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'unknown_persona' });
  });

  it('the chosen persona is the one the coach uses on the next turn', async () => {
    const { app, provider, telemetry } = scriptedApp([{ type: 'text', text: 'Fine.' }]);
    const user = await consented();
    await prisma.user.update({ where: { id: user.id }, data: { coachPersonaId: 'direct' } });
    await request(app).post('/me/coach/message').set(await authed(user.id)).send({ message: 'hi' });
    expect(provider.requests[0]!.system).toContain('"Direct"');
    expect(telemetry.events.every((e) => e.personaId === 'direct')).toBe(true);
  });
});

describe('POST /me/coach/message', () => {
  it('returns the contract shape and persists both messages in order', async () => {
    const { app } = scriptedApp([{ type: 'text', text: GOOD }]);
    const user = await consented();
    await putScore(user.id, daysAgo(1), 75);
    await putScore(user.id, todayUtc(), 72.4);

    const res = await request(app).post('/me/coach/message').set(await authed(user.id)).send({ message: '  why is my score low  ' });

    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(['conversationId', 'message']);
    expect(Object.keys(res.body.message).sort()).toEqual(['createdAt', 'id', 'role', 'source', 'text']);
    expect(res.body.message).toMatchObject({
      role: 'assistant',
      source: 'model',
      text: `Your recovery is 72.4, lower than yesterday.\n\n${COACH_DISCLAIMER}`,
    });
    expect(new Date(res.body.message.createdAt).toISOString()).toBe(res.body.message.createdAt);

    const rows = await prisma.coachMessage.findMany({ where: { conversationId: res.body.conversationId }, orderBy: { createdAt: 'asc' } });
    expect(rows.map((r) => [r.role, r.source, r.text])).toEqual([
      ['USER', null, 'why is my score low'],
      ['ASSISTANT', 'MODEL', res.body.message.text],
    ]);
    expect(rows[1]!.id).toBe(res.body.message.id);
    expect(rows.every((r) => r.userId === user.id)).toBe(true);
    const conv = await prisma.coachConversation.findUnique({ where: { id: res.body.conversationId } });
    expect(conv?.userId).toBe(user.id);
    expect(conv!.lastMessageAt.getTime()).toBeGreaterThanOrEqual(rows[1]!.createdAt.getTime());
  });

  it('with the default (unconfigured) provider every turn is the server-composed fallback, source "fallback"', async () => {
    const user = await consented();
    await putScore(user.id, todayUtc(), 66.5);
    const res = await request(createApp()).post('/me/coach/message').set(await authed(user.id)).send({ message: 'how am I doing' });
    expect(res.status).toBe(200);
    expect(res.body.message.source).toBe('fallback');
    expect(res.body.message.text).toContain('Your recovery score today is 66.5.');
    expect(res.body.message.text.endsWith(COACH_DISCLAIMER)).toBe(true);
  });

  it('continues a conversation with conversationId, feeding prior turns to the model', async () => {
    const { app, provider } = scriptedApp([{ type: 'text', text: 'First.' }, { type: 'text', text: 'Second.' }]);
    const user = await consented();
    const headers = await authed(user.id);
    const one = await request(app).post('/me/coach/message').set(headers).send({ message: 'hello' });
    const two = await request(app).post('/me/coach/message').set(headers).send({ message: 'again', conversationId: one.body.conversationId });
    expect(two.status).toBe(200);
    expect(two.body.conversationId).toBe(one.body.conversationId);
    expect(await prisma.coachMessage.count({ where: { conversationId: one.body.conversationId } })).toBe(4);
    expect(provider.requests[1]!.messages.slice(0, 3)).toEqual([
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'First.' },
      { role: 'user', content: 'again' },
    ]);
  });

  it('omitting conversationId starts a new conversation', async () => {
    const { app } = scriptedApp([{ type: 'text', text: 'A.' }, { type: 'text', text: 'B.' }]);
    const user = await consented();
    const headers = await authed(user.id);
    const one = await request(app).post('/me/coach/message').set(headers).send({ message: 'hello' });
    const two = await request(app).post('/me/coach/message').set(headers).send({ message: 'hello' });
    expect(two.body.conversationId).not.toBe(one.body.conversationId);
  });

  it("404s on another user's or an unknown conversationId, without calling the model", async () => {
    const { app, provider } = scriptedApp([{ type: 'text', text: 'A.' }, { type: 'text', text: 'B.' }]);
    const owner = await consented();
    const other = await consented();
    const conv = (await request(app).post('/me/coach/message').set(await authed(owner.id)).send({ message: 'hello' })).body.conversationId;
    const calls = provider.callCount;
    const res = await request(app).post('/me/coach/message').set(await authed(other.id)).send({ message: 'hi', conversationId: conv });
    expect(res.status).toBe(404);
    expect((await request(app).post('/me/coach/message').set(await authed(other.id)).send({ message: 'hi', conversationId: 'nope' })).status).toBe(404);
    expect(provider.callCount).toBe(calls);
    expect(await prisma.coachMessage.count({ where: { conversationId: conv } })).toBe(2);
  });

  it.each([
    ['missing', {}],
    ['empty', { message: '' }],
    ['whitespace only', { message: '   ' }],
    ['not a string', { message: 5 }],
    ['over 2000 characters', { message: 'x'.repeat(2001) }],
    ['non-string conversationId', { message: 'hi', conversationId: 5 }],
    ['non-boolean safetyOverride', { message: 'hi', safetyOverride: 'yes' }],
  ])('400 for an invalid body: %s', async (_l, body) => {
    const { app, provider } = scriptedApp([{ type: 'text', text: 'A.' }]);
    const user = await consented();
    const res = await request(app).post('/me/coach/message').set(await authed(user.id)).send(body);
    expect(res.status).toBe(400);
    expect(provider.callCount).toBe(0);
  });

  it('accepts a message of exactly 2000 characters', async () => {
    const { app } = scriptedApp([{ type: 'text', text: 'A.' }]);
    const user = await consented();
    const res = await request(app).post('/me/coach/message').set(await authed(user.id)).send({ message: 'x'.repeat(2000) });
    expect(res.status).toBe(200);
  });

  it('a crisis message gets the fixed safety reply with resources and canContinue, no model call, both messages persisted', async () => {
    const { app, provider } = scriptedApp([{ type: 'text', text: 'never' }]);
    const user = await consented();
    const res = await request(app).post('/me/coach/message').set(await authed(user.id)).send({ message: 'I want to end my life' });
    expect(res.status).toBe(200);
    expect(res.body.message.source).toBe('safety');
    expect(res.body.safety.canContinue).toBe(true);
    expect(res.body.safety.resources.length).toBeGreaterThan(0);
    expect(provider.callCount).toBe(0);
    const rows = await prisma.coachMessage.findMany({ where: { conversationId: res.body.conversationId }, orderBy: { createdAt: 'asc' } });
    expect(rows.map((r) => r.source)).toEqual([null, 'SAFETY']);
  });

  it('safetyOverride:true returns control to normal chat for that message', async () => {
    const { app, provider, telemetry } = scriptedApp([{ type: 'text', text: 'Glad to help with your data.' }]);
    const user = await consented();
    const res = await request(app)
      .post('/me/coach/message')
      .set(await authed(user.id))
      .send({ message: 'should I take melatonin', safetyOverride: true });
    expect(res.status).toBe(200);
    expect(res.body.message.source).toBe('model');
    expect(res.body.safety).toBeUndefined();
    expect(provider.callCount).toBe(1);
    expect(telemetry.named('coach.safety_classifier')[0]!.attributes).toMatchObject({ overridden: true });
  });

  it('persists guardrail events on the assistant message when a reply was rejected then regenerated', async () => {
    const { app } = scriptedApp([{ type: 'text', text: 'Here are 3 tips.' }, { type: 'text', text: 'Rest well.' }]);
    const user = await consented();
    const res = await request(app).post('/me/coach/message').set(await authed(user.id)).send({ message: 'tips?' });
    const assistant = await prisma.coachMessage.findUnique({ where: { id: res.body.message.id } });
    expect(assistant?.guardrailEvents).toEqual([{ type: 'guardrail_reject', reason: 'unwrapped_number', attempt: 1, outcome: 'regenerate' }]);
  });

  it('never writes message text or tool results to the logs', async () => {
    const SENTINEL = 'quokka-sentinel-question';
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => jest.spyOn(console, m).mockImplementation(() => {}));
    const provider = new ScriptedProvider([
      { type: 'tool_calls', calls: [{ id: 'c', name: 'getUserGoals', args: {} }] },
      { type: 'text', text: 'Take 3 naps.' },
      { type: 'text', text: `Still ${SENTINEL} 4 naps.` },
    ]);
    const app = express();
    app.use(express.json());
    app.use(createCoachRouter({ getProvider: () => provider, telemetry: new LoggerCoachTelemetry(), clock: new FakeClock() }));
    const user = await consented();
    await putScore(user.id, todayUtc(), 71.1);
    const res = await request(app).post('/me/coach/message').set(await authed(user.id)).send({ message: `${SENTINEL} why` });
    expect(res.status).toBe(200);
    const logged = spies.flatMap((s) => s.mock.calls.map((c) => c.join(' '))).join('\n');
    expect(logged).toContain('coach.tool_call'); // logging is on...
    expect(logged).toContain(user.id);
    expect(logged).not.toContain(SENTINEL); // ...but carries ids/counts/reasons only
    expect(logged).not.toContain('71.1');
    expect(logged).not.toContain('naps');
  });
});

describe('conversation transcripts', () => {
  it('GET /latest returns { conversationId: null, messages: [] } when there is none', async () => {
    const user = await createUser();
    const res = await request(createApp()).get('/me/coach/conversations/latest').set(await authed(user.id));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ conversationId: null, messages: [] });
  });

  it('GET /latest and GET /:id return the transcript in order with the contract shape', async () => {
    const { app } = scriptedApp([{ type: 'text', text: 'A.' }, { type: 'text', text: 'B.' }]);
    const user = await consented();
    const headers = await authed(user.id);
    const first = await request(app).post('/me/coach/message').set(headers).send({ message: 'one' });
    const second = await request(app).post('/me/coach/message').set(headers).send({ message: 'two' });

    const latest = await request(createApp()).get('/me/coach/conversations/latest').set(headers);
    expect(latest.status).toBe(200);
    expect(latest.body.conversationId).toBe(second.body.conversationId);
    expect(latest.body.messages).toHaveLength(2);
    expect(Object.keys(latest.body.messages[0]).sort()).toEqual(['createdAt', 'id', 'role', 'source', 'text']);
    expect(latest.body.messages.map((m: any) => [m.role, m.source])).toEqual([
      ['user', null],
      ['assistant', 'model'],
    ]);
    expect(latest.body.messages[0].text).toBe('two');

    const byId = await request(createApp()).get(`/me/coach/conversations/${first.body.conversationId}`).set(headers);
    expect(byId.status).toBe(200);
    expect(byId.body.conversationId).toBe(first.body.conversationId);
    expect(byId.body.messages[0].text).toBe('one');
  });

  it("GET /:id is 404 for another user's conversation and for an unknown id", async () => {
    const { app } = scriptedApp([{ type: 'text', text: 'A.' }]);
    const owner = await consented();
    const other = await createUser();
    const conv = (await request(app).post('/me/coach/message').set(await authed(owner.id)).send({ message: 'private' })).body.conversationId;
    const stolen = await request(createApp()).get(`/me/coach/conversations/${conv}`).set(await authed(other.id));
    expect(stolen.status).toBe(404);
    expect(JSON.stringify(stolen.body)).not.toContain('private');
    expect((await request(createApp()).get('/me/coach/conversations/unknown-id').set(await authed(other.id))).status).toBe(404);
    // Latest never leaks across users either.
    const latest = await request(createApp()).get('/me/coach/conversations/latest').set(await authed(other.id));
    expect(latest.body.conversationId).toBeNull();
  });
});

describe('POST /me/coach/message: per-user guards', () => {
  // A coach turn can hold a synthesis-tier loop open for 60s and, once a real
  // provider is wired, costs money every time. The endpoint had nothing in
  // front of it.
  it('rate limits a burst and says when to retry', async () => {
    resetTurnGuards();
    const { app } = scriptedApp(Array.from({ length: RATE_LIMIT_MAX_TURNS + 1 }, () => ({ type: 'text' as const, text: GOOD })));
    const user = await consented();
    const headers = await authed(user.id);

    for (let i = 0; i < RATE_LIMIT_MAX_TURNS; i++) {
      const ok = await request(app).post('/me/coach/message').set(headers).send({ message: `hello ${i}` });
      expect(ok.status).toBe(200);
    }

    const limited = await request(app).post('/me/coach/message').set(headers).send({ message: 'one too many' });

    expect(limited.status).toBe(429);
    expect(limited.body.error).toBe('too_many_messages');
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('does not spend a rate-limit slot on a request that fails validation', async () => {
    resetTurnGuards();
    const { app } = scriptedApp([{ type: 'text', text: GOOD }]);
    const user = await consented();
    const headers = await authed(user.id);

    for (let i = 0; i < RATE_LIMIT_MAX_TURNS + 3; i++) {
      const bad = await request(app).post('/me/coach/message').set(headers).send({ message: '' });
      expect(bad.status).toBe(400);
    }

    const ok = await request(app).post('/me/coach/message').set(headers).send({ message: 'still allowed' });
    expect(ok.status).toBe(200);
  });
});
