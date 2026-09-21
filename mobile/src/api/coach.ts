import { ApiError, apiFetch } from './client';

// The whole coach reply arrives at once (spec 2: no incremental streaming).
// The server gives a turn 12 s end to end before it returns its own fallback
// reply, so the client must wait strictly longer -- otherwise a slow turn would
// surface as a network error instead of the server's fallback.
export const COACH_REQUEST_TIMEOUT_MS = 20_000;

export interface CoachPersonaDTO {
  id: string;
  name: string;
  verbosity: string;
  proactivity: string;
}

export interface CoachConsentDTO {
  version: string;
  // Shown verbatim: this is the plain statement of what data leaves the device.
  summary: string;
  dataItems: string[];
}

export interface CoachStatusDTO {
  enabled: boolean;
  consented: boolean;
  consent: CoachConsentDTO;
  personaId: string;
  personas: CoachPersonaDTO[];
}

export type CoachMessageSource = 'model' | 'fallback' | 'safety';

export interface CoachMessageDTO {
  id: string;
  role: 'assistant';
  text: string;
  source: CoachMessageSource;
  createdAt: string;
}

export interface CoachSafetyDTO {
  resources: string[];
  canContinue: true;
}

export interface CoachReplyDTO {
  conversationId: string;
  message: CoachMessageDTO;
  safety?: CoachSafetyDTO;
}

export interface CoachHistoryMessageDTO {
  id: string;
  role: 'USER' | 'ASSISTANT';
  text: string;
  source?: string;
  createdAt: string;
}

export interface CoachConversationDTO {
  conversationId: string | null;
  messages: CoachHistoryMessageDTO[];
}

export interface SendCoachMessageInput {
  message: string;
  conversationId?: string;
  safetyOverride?: boolean;
}

// 403 { error: 'consent_required' }
export class CoachConsentRequiredError extends Error {
  constructor() {
    super('Coach consent is required');
    this.name = 'CoachConsentRequiredError';
    Object.setPrototypeOf(this, CoachConsentRequiredError.prototype);
  }
}

// 404 { error: 'coach_disabled' }
export class CoachDisabledError extends Error {
  constructor() {
    super('The coach is not available');
    this.name = 'CoachDisabledError';
    Object.setPrototypeOf(this, CoachDisabledError.prototype);
  }
}

// 409 { error: 'stale_consent_version' }: the consent text changed since the
// screen was loaded, so the user has not agreed to what is now in force.
export class StaleConsentVersionError extends Error {
  constructor() {
    super('The consent version is out of date');
    this.name = 'StaleConsentVersionError';
    Object.setPrototypeOf(this, StaleConsentVersionError.prototype);
  }
}

export class CoachTimeoutError extends Error {
  constructor() {
    super('The coach took too long to answer');
    this.name = 'CoachTimeoutError';
    Object.setPrototypeOf(this, CoachTimeoutError.prototype);
  }
}

// Status codes are enough to tell these apart on the coach endpoints, and
// apiFetch already surfaces them; anything else is passed through unchanged.
function mapCoachError(error: unknown): unknown {
  if (error instanceof ApiError) {
    if (error.status === 403) return new CoachConsentRequiredError();
    if (error.status === 404) return new CoachDisabledError();
    if (error.status === 409) return new StaleConsentVersionError();
  }
  return error;
}

async function coachFetch<T>(path: string, options?: Parameters<typeof apiFetch>[1]): Promise<T> {
  try {
    return await apiFetch<T>(path, options);
  } catch (error) {
    throw mapCoachError(error);
  }
}

function json(method: string, body: unknown): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

const DISABLED_STATUS: CoachStatusDTO = {
  enabled: false,
  consented: false,
  consent: { version: '', summary: '', dataItems: [] },
  personaId: '',
  personas: [],
};

// A malformed status must fail closed: the coach stays invisible rather than
// half-rendering.
export async function fetchCoachStatus(): Promise<CoachStatusDTO> {
  const res = await coachFetch<Partial<CoachStatusDTO> | undefined>('/me/coach/status');
  if (!res || typeof res !== 'object' || Array.isArray(res) || res.enabled !== true) return DISABLED_STATUS;
  return {
    enabled: true,
    consented: res.consented === true,
    consent: {
      version: res.consent?.version ?? '',
      summary: res.consent?.summary ?? '',
      dataItems: res.consent?.dataItems ?? [],
    },
    personaId: res.personaId ?? '',
    personas: res.personas ?? [],
  };
}

export function acceptCoachConsent(version: string): Promise<{ consented: true }> {
  return coachFetch<{ consented: true }>('/me/coach/consent', json('POST', { version }));
}

export async function revokeCoachConsent(): Promise<void> {
  await coachFetch<void>('/me/coach/consent', { method: 'DELETE' });
}

export function setCoachPersona(personaId: string): Promise<{ personaId: string }> {
  return coachFetch<{ personaId: string }>('/me/coach/persona', json('PUT', { personaId }));
}

export async function sendCoachMessage(input: SendCoachMessageInput): Promise<CoachReplyDTO> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  // Raced as well as aborted: abort cancels the socket, the race guarantees the
  // caller is released even if a layer below ignores the signal.
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new CoachTimeoutError());
    }, COACH_REQUEST_TIMEOUT_MS);
  });

  try {
    return await Promise.race([
      coachFetch<CoachReplyDTO>('/me/coach/message', { ...json('POST', input), signal: controller.signal }),
      timeout,
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchLatestConversation(): Promise<CoachConversationDTO> {
  const res = await coachFetch<Partial<CoachConversationDTO> | undefined>('/me/coach/conversations/latest');
  return { conversationId: res?.conversationId ?? null, messages: res?.messages ?? [] };
}
