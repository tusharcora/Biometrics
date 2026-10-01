import express from 'express';
import http from 'http';
import type { AddressInfo } from 'net';
import request from 'supertest';
import { prisma } from '../../src/db/client';
import { createCoachRouter } from '../../src/coach/routes';
import { COACH_CONSENT_VERSION } from '../../src/coach/consent';
import { COACH_DISCLAIMER } from '../../src/coach/guardrails/disclaimer';
import { CoachModelProvider, CoachStreamRequest, ScriptedStreamProvider, StreamStep, UnconfiguredProvider } from '../../src/coach/model/provider';
import { resetWarmState } from '../../src/coach/answer/warm';
import { resetTurnGuards } from '../../src/coach/turnGuard';
import { migrateTestDb } from '../setupTestDb';
import { authHeaderFor } from '../helpers/auth';
import { FakeClock, RecordingTelemetry, createUser, putScore, todayUtc } from './helpers';

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
  resetTurnGuards();
  resetWarmState();
  jest.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => {
  if (savedFlag === undefined) delete process.env.COACH_ENABLED;
  else process.env.COACH_ENABLED = savedFlag;
  jest.restoreAllMocks();
});

function appWith(provider: CoachModelProvider) {
  const app = express();
  app.use(express.json());
  app.use(createCoachRouter({ getProvider: () => provider, telemetry: new RecordingTelemetry(), clock: new FakeClock() }));
  return app;
}

function scripted(script: StreamStep[]) {
  const provider = new ScriptedStreamProvider(script);
  return { provider, app: appWith(provider) };
}

async function consented() {
  const user = await createUser();
  await prisma.coachConsent.create({ data: { userId: user.id, version: COACH_CONSENT_VERSION } });
  return user;
}

interface SseEvent {
  event: string;
  data: any;
}

/** Parses a full text/event-stream body into its events. */
function parseSse(body: string): SseEvent[] {
  return body
    .split('\n\n')
    .filter((block) => block.trim().length > 0)
    .map((block) => {
      const lines = block.split('\n');
      const event = lines.find((l) => l.startsWith('event: '))!.slice('event: '.length);
      const data = JSON.parse(lines.find((l) => l.startsWith('data: '))!.slice('data: '.length));
      return { event, data };
    });
}

function postSse(app: express.Express, headers: Record<string, string>, body: object) {
  return request(app)
    .post('/me/coach/message')
    .set(headers)
    .set('Accept', 'text/event-stream')
    .send(body)
    .buffer(true)
    .parse((res, cb) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (c: string) => (data += c));
      res.on('end', () => cb(null, data));
    });
}

const CARD = '```card\n{"headline":"Recovery is steady","tiles":[{"fact":"recovery.today","label":"Recovery"}],"source":"Today"}\n```';

describe('POST /me/coach/message with Accept: text/event-stream', () => {
  it('streams status, text, card and done as SSE events and stores the clean reply with its card', async () => {
    const { app } = scripted([['Your recovery is 72 ', 'today. Nice work.\n', CARD]]);
    const user = await consented();
    await putScore(user.id, todayUtc(), 72.4);

    const res = await postSse(app, await authHeaderFor(user.id), { message: 'How am I doing today?' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^text\/event-stream/);
    expect(res.headers['cache-control']).toBe('no-cache, no-transform');
    const events = parseSse(res.body);
    expect(events.map((e) => e.event)).toEqual(['status', 'text', 'text', 'card', 'done']);
    for (const e of events) expect(e.data.type).toBe(e.event);
    expect(events.filter((e) => e.event === 'text').map((e) => e.data.sentence)).toEqual(['Your recovery is 72 today.', 'Nice work.']);
    expect(events[3]!.data.card.tiles[0]).toMatchObject({ factId: 'recovery.today', display: '72' });
    const done = events[4]!.data;
    expect(done).toMatchObject({ engine: 'local', durationMs: expect.any(Number) });

    const row = await prisma.coachMessage.findUniqueOrThrow({ where: { id: done.messageId } });
    expect(row).toMatchObject({ conversationId: done.conversationId, text: 'Your recovery is 72 today. Nice work.', engine: 'LOCAL' });
    expect(row.card).toEqual(events[3]!.data.card);
  });

  it('streams the safety card for a crisis message', async () => {
    const { app, provider } = scripted([]);
    const user = await consented();
    const events = parseSse((await postSse(app, await authHeaderFor(user.id), { message: 'I want to end my life' })).body);
    expect(events.map((e) => e.event)).toEqual(['safety', 'done']);
    expect(events[0]!.data.resources.length).toBeGreaterThan(0);
    expect(provider.callCount).toBe(0);
  });

  it('streams an error event (still HTTP 200) when the model is unavailable', async () => {
    const app = appWith(new UnconfiguredProvider());
    const user = await consented();
    const res = await postSse(app, await authHeaderFor(user.id), { message: 'How did I sleep?' });
    expect(res.status).toBe(200);
    expect(parseSse(res.body).map((e) => e.data)).toEqual([
      { type: 'status', label: 'Looking at your sleep…' },
      { type: 'error', code: 'model_unavailable', retryable: true },
    ]);
  });

  it('answers request errors before the stream as plain JSON', async () => {
    const { app } = scripted([]);
    const noConsent = await createUser();
    const r403 = await postSse(app, await authHeaderFor(noConsent.id), { message: 'hi' });
    expect(r403.status).toBe(403);
    expect(JSON.parse(r403.body)).toEqual({ error: 'consent_required' });
    const user = await consented();
    const r400 = await postSse(app, await authHeaderFor(user.id), { message: '' });
    expect(r400.status).toBe(400);
  });

  it('aborts the model call and keeps the partial reply, marked stopped, when the client disconnects', async () => {
    let signal: AbortSignal | undefined;
    const step = async function* (req: CoachStreamRequest): AsyncIterable<string> {
      signal = req.signal!;
      yield 'Rest is good today. ';
      await new Promise((_resolve, reject) => req.signal!.addEventListener('abort', () => reject(new Error('aborted'))));
    };
    const { app } = scripted([step]);
    const user = await consented();
    const headers = await authHeaderFor(user.id);
    const server = app.listen(0);
    try {
      const { port } = server.address() as AddressInfo;
      await new Promise<void>((resolve, reject) => {
        const req = http.request(
          { port, method: 'POST', path: '/me/coach/message', headers: { ...headers, Accept: 'text/event-stream', 'Content-Type': 'application/json' } },
          (res) => {
            res.setEncoding('utf8');
            res.on('data', (chunk: string) => {
              if (chunk.includes('event: text')) {
                req.destroy();
                resolve();
              }
            });
          },
        );
        req.on('error', () => {});
        req.end(JSON.stringify({ message: 'Should I rest today?' }));
        setTimeout(() => reject(new Error('no text event')), 5000);
      });
      for (let i = 0; i < 200 && !(signal?.aborted && (await prisma.coachMessage.count({ where: { userId: user.id } })) === 2); i++) {
        await new Promise((r) => setTimeout(r, 10));
      }
      expect(signal?.aborted).toBe(true);
      const assistant = await prisma.coachMessage.findFirstOrThrow({ where: { userId: user.id, role: 'ASSISTANT' } });
      expect(assistant.text).toBe('Rest is good today.');
      expect(assistant.guardrailEvents).toEqual([{ type: 'stopped' }]);
    } finally {
      server.close();
    }
  });
});

describe('POST /me/coach/message without the Accept header (older apps)', () => {
  it('returns the old JSON shape from the same pipeline: reply plus disclaimer, clean text stored', async () => {
    const { app } = scripted([['Your recovery is 72 today.\n', CARD]]);
    const user = await consented();
    await putScore(user.id, todayUtc(), 72.4);
    const res = await request(app).post('/me/coach/message').set(await authHeaderFor(user.id)).send({ message: 'How am I doing?' });
    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(['conversationId', 'message']);
    expect(Object.keys(res.body.message).sort()).toEqual(['createdAt', 'id', 'role', 'source', 'text']);
    expect(res.body.message).toMatchObject({ role: 'assistant', source: 'model', text: `Your recovery is 72 today.\n\n${COACH_DISCLAIMER}` });
    const row = await prisma.coachMessage.findUniqueOrThrow({ where: { id: res.body.message.id } });
    expect(row.text).toBe('Your recovery is 72 today.');
    expect(row.createdAt.toISOString()).toBe(res.body.message.createdAt);
    expect(row.card).not.toBeNull();
  });

  it.each([
    ['model_unavailable', [new Error('down')]],
    ['validation_failed', [['Your HRV is 99 ms.'], ['Your HRV is 98 ms.']]],
  ] as const)('maps a %s error to 503 with the code', async (code, script) => {
    const { app } = scripted([...script] as StreamStep[]);
    const user = await consented();
    const res = await request(app).post('/me/coach/message').set(await authHeaderFor(user.id)).send({ message: 'How am I doing?' });
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: code, retryable: true });
    expect(await prisma.coachMessage.count({ where: { userId: user.id } })).toBe(0);
  });
});

describe('conversation transcripts carry the card', () => {
  it('GET /me/coach/conversations/:id returns card (null when none) on every message', async () => {
    const { app } = scripted([['Your recovery is 72 today.\n', CARD]]);
    const user = await consented();
    await putScore(user.id, todayUtc(), 72.4);
    const headers = await authHeaderFor(user.id);
    const sent = await request(app).post('/me/coach/message').set(headers).send({ message: 'How am I doing?' });
    const res = await request(app).get(`/me/coach/conversations/${sent.body.conversationId}`).set(headers);
    expect(res.body.messages.map((m: { card: unknown }) => m.card === null)).toEqual([true, false]);
    expect(res.body.messages[1].card.headline).toBe('Recovery is steady');
  });
});

describe('GET /me/coach/status warms the model', () => {
  it('starts a warm-up (fire-and-forget) when the coach is enabled, throttled', async () => {
    const provider = Object.assign(new ScriptedStreamProvider([]), { warm: jest.fn(() => new Promise<void>(() => {})) });
    const app = appWith(provider);
    const user = await createUser();
    const headers = await authHeaderFor(user.id);
    expect((await request(app).get('/me/coach/status').set(headers)).status).toBe(200);
    expect((await request(app).get('/me/coach/status').set(headers)).status).toBe(200);
    expect(provider.warm).toHaveBeenCalledTimes(1);
  });

  it('does not warm while the coach is off', async () => {
    process.env.COACH_ENABLED = 'false';
    const provider = Object.assign(new ScriptedStreamProvider([]), { warm: jest.fn(async () => {}) });
    const user = await createUser();
    await request(appWith(provider)).get('/me/coach/status').set(await authHeaderFor(user.id));
    expect(provider.warm).not.toHaveBeenCalled();
  });
});
