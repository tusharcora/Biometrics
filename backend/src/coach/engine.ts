// backend/src/coach/engine.ts
// Which model answers a message (spec 2026-09-30 section 3). Local by
// default; the hosted model only when the user chose it, it is offered
// (COACH_HOSTED_ENABLED + ANTHROPIC_API_KEY) and the user holds both the
// current coach (LOCAL) consent and the current HOSTED consent. Anything else
// quietly answers locally.
//
// A hosted call that fails before any text reached the user (network, 5xx,
// rate limit, or a refusal the server-side fallback could not rescue) is
// retried on the local model for that one message, and the message is
// reported as done.engine = 'local' so the app can say "answered by the
// on-device model". Once hosted text has been shown it cannot be taken back,
// and once the caller aborted (budget spent, user tapped stop) there is no one
// to answer, so neither case falls back.
//
// The fallback lives inside the provider, not around runAnswer: the pipeline
// runs once per message, so memory resolution, the status event and the stored
// reply each happen once, whichever model ends up answering.

import { prisma } from '../db/client';
import type { AnswerEvent } from './answer/pipeline';
import { hasCurrentConsent } from './consent';
import type {
  CoachModelProvider,
  CoachModelRequest,
  CoachModelResponse,
  CoachStreamRequest,
} from './model/provider';

export type EngineName = 'local' | 'hosted';

export interface EngineSelection {
  /** The engine the user's settings pick for this message. */
  requested: EngineName;
  provider: CoachModelProvider;
  /** The engine that actually produced the answer. Read it after the provider has finished. */
  servedBy(): EngineName;
}

export interface SelectEngineOptions {
  local: CoachModelProvider;
  /** Null while the hosted engine is not offered. */
  hosted: CoachModelProvider | null;
  /** Called with the error NAME (never its message) when a hosted call falls back. */
  onFallback?: (errorName: string) => void;
}

/**
 * One message's provider: the hosted model, falling back to the local one.
 * Create one per message. Once it has fallen back it stays on the local model
 * for the rest of that message (a regeneration attempt does not go back to
 * hosted), so `servedBy` names the model behind every sentence shown.
 */
export class HostedWithLocalFallback implements CoachModelProvider {
  readonly id: string;
  servedBy: EngineName = 'hosted';

  constructor(
    private readonly hosted: CoachModelProvider,
    private readonly local: CoachModelProvider,
    private readonly onFallback?: (errorName: string) => void,
  ) {
    this.id = `${hosted.id}|fallback:${local.id}`;
  }

  private fellBack(err: unknown): void {
    this.servedBy = 'local';
    this.onFallback?.(err instanceof Error ? err.name : 'unknown');
  }

  async *stream(request: CoachStreamRequest): AsyncIterable<string> {
    if (this.servedBy === 'hosted') {
      let yielded = false;
      try {
        for await (const chunk of this.hosted.stream(request)) {
          if (chunk.length > 0) yielded = true;
          yield chunk;
        }
        return;
      } catch (err) {
        if (yielded || request.signal?.aborted) throw err;
        this.fellBack(err);
      }
    }
    yield* this.local.stream(request);
  }

  async generate(request: CoachModelRequest): Promise<CoachModelResponse> {
    if (this.servedBy === 'hosted') {
      try {
        return await this.hosted.generate(request);
      } catch (err) {
        if (request.signal.aborted) throw err;
        this.fellBack(err);
      }
    }
    return this.local.generate(request);
  }
}

export async function selectEngine(userId: string, options: SelectEngineOptions): Promise<EngineSelection> {
  if (options.hosted) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { coachEngine: true } });
    if (
      user?.coachEngine === 'HOSTED' &&
      (await hasCurrentConsent(userId, 'local')) &&
      (await hasCurrentConsent(userId, 'hosted'))
    ) {
      const provider = new HostedWithLocalFallback(options.hosted, options.local, options.onFallback);
      return { requested: 'hosted', provider, servedBy: () => provider.servedBy };
    }
  }
  return { requested: 'local', provider: options.local, servedBy: () => 'local' };
}

/**
 * Passes the answer events through, correcting `done.engine` (and the stored
 * assistant message's engine) when the hosted call fell back to the local model.
 */
export async function* withServedEngine(
  events: AsyncIterable<AnswerEvent>,
  selection: EngineSelection,
): AsyncIterable<AnswerEvent> {
  for await (const event of events) {
    if (event.type === 'done') {
      const engine = selection.servedBy();
      if (engine !== event.engine) {
        // The reply is already stored and shown, so a failed correction must not
        // turn this message into an error: it only leaves the stored engine stale
        // (the history note), which is logged by error class only.
        try {
          await prisma.coachMessage.updateMany({
            where: { id: event.messageId },
            data: { engine: engine === 'hosted' ? 'HOSTED' : 'LOCAL' },
          });
        } catch (err) {
          const name = err instanceof Error ? err.name : 'unknown';
          console.error(JSON.stringify({ event: 'coach.request_failed', where: 'engine_correction', error: name }));
        }
        yield { ...event, engine };
        continue;
      }
    }
    yield event;
  }
}
