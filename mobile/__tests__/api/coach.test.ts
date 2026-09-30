import * as SecureStore from 'expo-secure-store';
import { setBaseUrl } from '../../src/api/client';
import {
  COACH_REQUEST_TIMEOUT_MS,
  DEFAULT_COACH_REQUEST_TIMEOUT_MS,
  coachTimeoutFromEnv,
  CoachConsentRequiredError,
  CoachDisabledError,
  StaleConversationError,
  CoachTimeoutError,
  StaleConsentVersionError,
  acceptCoachConsent,
  fetchCoachStatus,
  fetchLatestConversation,
  revokeCoachConsent,
  sendCoachMessage,
  setCoachPersona,
} from '../../src/api/coach';

jest.mock('expo-secure-store');

const fetchMock = jest.fn();
(global as any).fetch = fetchMock;

const status = {
  enabled: true,
  consented: false,
  consent: { version: 'v1', summary: 'Scores are sent to a provider.', dataItems: ['Recovery score'] },
  personaId: 'hoot',
  personaChosen: true,
  personas: [
    {
      id: 'hoot',
      name: 'Hoot',
      verbosity: 'normal',
      proactivity: 'threshold-triggered',
      tagline: 'Calm and curious. Spots the patterns in your weeks.',
      greeting: "I've been watching your numbers overnight. Want to see what stood out?",
    },
  ],
};

function ok(body: unknown, statusCode = 200) {
  return { ok: true, status: statusCode, json: async () => body };
}
function fail(statusCode: number, body: unknown = {}) {
  return { ok: false, status: statusCode, json: async () => body };
}

beforeEach(() => {
  setBaseUrl('https://api.example.com');
  fetchMock.mockReset();
  (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('token');
});

describe('fetchCoachStatus', () => {
  it('returns the server status', async () => {
    fetchMock.mockResolvedValueOnce(ok(status));
    await expect(fetchCoachStatus()).resolves.toEqual(status);
    expect(fetchMock).toHaveBeenCalledWith('https://api.example.com/me/coach/status', expect.anything());
  });

  it('treats a malformed body as a disabled coach rather than throwing', async () => {
    fetchMock.mockResolvedValueOnce(ok([]));
    const result = await fetchCoachStatus();
    expect(result.enabled).toBe(false);
    expect(result.consented).toBe(false);
    expect(result.personaChosen).toBe(false);
  });

  it('keeps the character while the coach is off, since it is also the app look', async () => {
    fetchMock.mockResolvedValueOnce(ok({ ...status, enabled: false, consented: true, personaId: 'mochi' }));
    const result = await fetchCoachStatus();
    expect(result).toEqual({
      enabled: false,
      consented: false,
      consent: { version: '', summary: '', dataItems: [] },
      personaId: 'mochi',
      personaChosen: true,
      personas: status.personas,
    });
  });

  // A server that predates characters can't store their ids, so it must never
  // prompt the picker: a missing personaChosen reads as chosen (ruling R18).
  it('reads a server that predates characters as chosen, with no picker copy', async () => {
    fetchMock.mockResolvedValueOnce(
      ok({
        enabled: true,
        consented: true,
        consent: status.consent,
        personaId: 'encouraging',
        personas: [{ id: 'encouraging', name: 'Encouraging', verbosity: 'normal', proactivity: 'threshold-triggered' }],
      }),
    );
    const result = await fetchCoachStatus();
    expect(result.personaChosen).toBe(true);
    expect(result.personas).toEqual([
      { id: 'encouraging', name: 'Encouraging', verbosity: 'normal', proactivity: 'threshold-triggered', tagline: null, greeting: null },
    ]);
  });

  it('only reads personaChosen as not chosen when it is literally false, and drops malformed persona entries', async () => {
    fetchMock.mockResolvedValueOnce(ok({ ...status, personaChosen: 'no', personaId: 7, personas: [null, 'hoot', status.personas[0]] }));
    const result = await fetchCoachStatus();
    // Not a boolean: treated like a missing field, so no prompt.
    expect(result.personaChosen).toBe(true);
    expect(result.personaId).toBe('');
    expect(result.personas).toEqual(status.personas);
  });

  it('keeps a literal personaChosen false as not chosen', async () => {
    fetchMock.mockResolvedValueOnce(ok({ ...status, personaChosen: false }));
    expect((await fetchCoachStatus()).personaChosen).toBe(false);
  });
});

describe('consent', () => {
  it('POSTs the version the server offered', async () => {
    fetchMock.mockResolvedValueOnce(ok({ consented: true }));
    await expect(acceptCoachConsent('v1')).resolves.toEqual({ consented: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.example.com/me/coach/consent');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ version: 'v1' });
  });

  it('maps a 409 to StaleConsentVersionError', async () => {
    fetchMock.mockResolvedValueOnce(fail(409, { error: 'stale_consent_version' }));
    await expect(acceptCoachConsent('v0')).rejects.toBeInstanceOf(StaleConsentVersionError);
  });

  it('revokes with DELETE and tolerates the 204', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 204, json: jest.fn() });
    await expect(revokeCoachConsent()).resolves.toBeUndefined();
    expect(fetchMock.mock.calls[0][1].method).toBe('DELETE');
  });
});

describe('setCoachPersona', () => {
  it('PUTs the persona id', async () => {
    fetchMock.mockResolvedValueOnce(ok({ personaId: 'pip' }));
    await expect(setCoachPersona('pip')).resolves.toEqual({ personaId: 'pip' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.example.com/me/coach/persona');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body)).toEqual({ personaId: 'pip' });
  });
});

describe('sendCoachMessage', () => {
  const reply = {
    conversationId: 'c1',
    message: { id: 'm1', role: 'assistant', text: 'Hello', source: 'model', createdAt: '2026-09-20T10:00:00.000Z' },
  };

  it('POSTs the message and only the fields provided', async () => {
    fetchMock.mockResolvedValueOnce(ok(reply));
    await expect(sendCoachMessage({ message: 'Hi' })).resolves.toEqual(reply);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.example.com/me/coach/message');
    expect(JSON.parse(init.body)).toEqual({ message: 'Hi' });
  });

  it('sends conversationId and safetyOverride when given', async () => {
    fetchMock.mockResolvedValueOnce(ok(reply));
    await sendCoachMessage({ message: 'Hi', conversationId: 'c1', safetyOverride: true });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ message: 'Hi', conversationId: 'c1', safetyOverride: true });
  });

  it('maps 403 to CoachConsentRequiredError and 404 to CoachDisabledError', async () => {
    fetchMock.mockResolvedValueOnce(fail(403, { error: 'consent_required' }));
    await expect(sendCoachMessage({ message: 'Hi' })).rejects.toBeInstanceOf(CoachConsentRequiredError);
    fetchMock.mockResolvedValueOnce(fail(404, { error: 'coach_disabled' }));
    await expect(sendCoachMessage({ message: 'Hi' })).rejects.toBeInstanceOf(CoachDisabledError);
  });

  // Both are 404s. Mapping them by status alone hid the whole chat behind
  // "coach unavailable" whenever a conversation aged past the 90-day retention.
  it('separates a stale conversation 404 from a coach-disabled 404', async () => {
    fetchMock.mockResolvedValueOnce(fail(404, { error: 'conversation_not_found' }));
    await expect(sendCoachMessage({ message: 'Hi', conversationId: 'gone' })).rejects.toBeInstanceOf(
      StaleConversationError,
    );

    fetchMock.mockResolvedValueOnce(fail(404, { error: 'coach_disabled' }));
    await expect(sendCoachMessage({ message: 'Hi' })).rejects.toBeInstanceOf(CoachDisabledError);
  });

  it('still treats a 404 with no error code as coach-disabled', async () => {
    fetchMock.mockResolvedValueOnce(fail(404, {}));
    await expect(sendCoachMessage({ message: 'Hi' })).rejects.toBeInstanceOf(CoachDisabledError);
  });

  it('uses a 20 s client timeout, longer than the server 12 s budget', () => {
    expect(COACH_REQUEST_TIMEOUT_MS).toBe(20000);
    expect(COACH_REQUEST_TIMEOUT_MS).toBeGreaterThan(12000);
  });

  it('takes a longer timeout from EXPO_PUBLIC_COACH_TIMEOUT_MS for a slower local model', () => {
    expect(coachTimeoutFromEnv('120000')).toBe(120000);
    expect(coachTimeoutFromEnv(undefined)).toBe(DEFAULT_COACH_REQUEST_TIMEOUT_MS);
    expect(coachTimeoutFromEnv('')).toBe(DEFAULT_COACH_REQUEST_TIMEOUT_MS);
    expect(coachTimeoutFromEnv('soon')).toBe(DEFAULT_COACH_REQUEST_TIMEOUT_MS);
    expect(coachTimeoutFromEnv('-5')).toBe(DEFAULT_COACH_REQUEST_TIMEOUT_MS);
  });

  describe('timeout', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('aborts the request and rejects with CoachTimeoutError after 20 s', async () => {
      let signal: AbortSignal | undefined;
      fetchMock.mockImplementation((_url: string, init: RequestInit) => {
        signal = init.signal as AbortSignal;
        return new Promise(() => {});
      });

      const promise = sendCoachMessage({ message: 'Hi' });
      const assertion = expect(promise).rejects.toBeInstanceOf(CoachTimeoutError);
      await jest.advanceTimersByTimeAsync(COACH_REQUEST_TIMEOUT_MS - 1);
      expect(signal?.aborted).toBeFalsy();
      await jest.advanceTimersByTimeAsync(1);
      await assertion;
      expect(signal?.aborted).toBe(true);
    });

    it('does not time out a reply that arrives in time', async () => {
      fetchMock.mockResolvedValueOnce(ok(reply));
      await expect(sendCoachMessage({ message: 'Hi' })).resolves.toEqual(reply);
      await jest.advanceTimersByTimeAsync(COACH_REQUEST_TIMEOUT_MS * 2);
    });
  });
});

describe('fetchLatestConversation', () => {
  it('returns the conversation', async () => {
    const body = { conversationId: 'c1', messages: [{ id: 'a', role: 'user', text: 'Hi', createdAt: 'x' }] };
    fetchMock.mockResolvedValueOnce(ok(body));
    await expect(fetchLatestConversation()).resolves.toEqual(body);
  });

  it('normalises a missing body to an empty conversation', async () => {
    fetchMock.mockResolvedValueOnce(ok({}));
    await expect(fetchLatestConversation()).resolves.toEqual({ conversationId: null, messages: [] });
  });
});
