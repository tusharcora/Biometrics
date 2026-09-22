import * as SecureStore from 'expo-secure-store';
import { setBaseUrl } from '../../src/api/client';
import {
  COACH_REQUEST_TIMEOUT_MS,
  CoachConsentRequiredError,
  CoachDisabledError,
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
  personaId: 'encouraging',
  personas: [{ id: 'encouraging', name: 'Encouraging', verbosity: 'normal', proactivity: 'threshold-triggered' }],
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
    fetchMock.mockResolvedValueOnce(ok({ personaId: 'direct' }));
    await expect(setCoachPersona('direct')).resolves.toEqual({ personaId: 'direct' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.example.com/me/coach/persona');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body)).toEqual({ personaId: 'direct' });
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

  it('uses a 20 s client timeout, longer than the server 12 s budget', () => {
    expect(COACH_REQUEST_TIMEOUT_MS).toBe(20000);
    expect(COACH_REQUEST_TIMEOUT_MS).toBeGreaterThan(12000);
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
    const body = { conversationId: 'c1', messages: [{ id: 'a', role: 'USER', text: 'Hi', createdAt: 'x' }] };
    fetchMock.mockResolvedValueOnce(ok(body));
    await expect(fetchLatestConversation()).resolves.toEqual(body);
  });

  it('normalises a missing body to an empty conversation', async () => {
    fetchMock.mockResolvedValueOnce(ok({}));
    await expect(fetchLatestConversation()).resolves.toEqual({ conversationId: null, messages: [] });
  });
});
