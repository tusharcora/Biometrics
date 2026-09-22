import { NextFunction, Response, Router } from 'express';
import { AuthedRequest, requireAuth } from '../auth/middleware';
import { prisma } from '../db/client';
import { CoachClock, systemClock } from './clock';
import { COACH_CONSENT, COACH_CONSENT_VERSION, grantConsent, hasCurrentConsent, revokeConsent } from './consent';
import { getCoachProvider, isCoachEnabled, isExpoPushProvider } from './config';
import { isExpoPushToken } from './push';
import { TurnInProgressError, TurnRateLimitedError, withTurnGuard } from './turnGuard';
import type { CoachModelProvider } from './model/provider';
import { toMemoryDTO, validateMemoryValue } from './memory';
import { createCoachOrchestrator, HISTORY_WINDOW, OrchestratorDeps } from './orchestrator';
import { findPersona, listPersonas, resolvePersona } from './personas';
import { CoachTelemetry, LoggerCoachTelemetry } from './telemetry';
import type { CoachTools } from './tools';

export const MAX_MESSAGE_CHARS = 2000;
export const MAX_PUSH_TOKEN_CHARS = 512;
const MAX_TRANSCRIPT_MESSAGES = 200;

export interface CoachRouterDeps {
  getProvider: () => CoachModelProvider;
  telemetry: CoachTelemetry;
  clock: CoachClock;
  tools?: CoachTools;
  budgets?: OrchestratorDeps['budgets'];
}

interface MessageRow {
  id: string;
  role: 'USER' | 'ASSISTANT';
  text: string;
  source: 'MODEL' | 'FALLBACK' | 'SAFETY' | null;
  createdAt: Date;
}

const messageDTO = (m: MessageRow) => ({
  id: m.id,
  role: m.role === 'USER' ? 'user' : 'assistant',
  text: m.text,
  source: m.source === null ? null : (m.source.toLowerCase() as 'model' | 'fallback' | 'safety'),
  createdAt: m.createdAt.toISOString(),
});

/** Logs the failure class only: a Prisma or provider error message can echo request values. */
function logFailure(where: string, err: unknown): void {
  const name = err instanceof Error ? err.name : 'unknown';
  console.error(JSON.stringify({ event: 'coach.request_failed', where, error: name }));
}

export function createCoachRouter(overrides: Partial<CoachRouterDeps> = {}): Router {
  const deps: CoachRouterDeps = {
    getProvider: overrides.getProvider ?? getCoachProvider,
    telemetry: overrides.telemetry ?? new LoggerCoachTelemetry(),
    clock: overrides.clock ?? systemClock,
    ...(overrides.tools ? { tools: overrides.tools } : {}),
    ...(overrides.budgets ? { budgets: overrides.budgets } : {}),
  };
  const router = Router();

  // Auth first, so an unauthenticated caller learns nothing about the flag.
  function requireEnabled(_req: AuthedRequest, res: Response, next: NextFunction): void {
    if (!isCoachEnabled()) {
      res.status(404).json({ error: 'coach_disabled' });
      return;
    }
    next();
  }

  router.get('/me/coach/status', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const userId = req.userId!;
      const enabled = isCoachEnabled();
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { coachPersonaId: true } });
      res.json({
        enabled,
        consented: enabled ? await hasCurrentConsent(userId) : false,
        consent: { version: COACH_CONSENT.version, summary: COACH_CONSENT.summary, dataItems: COACH_CONSENT.dataItems },
        personaId: resolvePersona(user?.coachPersonaId).id,
        personas: listPersonas().map((p) => ({ id: p.id, name: p.name, verbosity: p.verbosity, proactivity: p.proactivity })),
      });
    } catch (err) {
      logFailure('status', err);
      res.status(500).json({ error: 'coach_unavailable' });
    }
  });

  router.post('/me/coach/consent', requireAuth, requireEnabled, async (req: AuthedRequest, res) => {
    const version: unknown = req.body?.version;
    if (typeof version !== 'string') {
      res.status(400).json({ error: 'version must be a string' });
      return;
    }
    if (version !== COACH_CONSENT_VERSION) {
      res.status(409).json({ error: 'stale_consent_version' });
      return;
    }
    try {
      await grantConsent(req.userId!);
      res.json({ consented: true });
    } catch (err) {
      logFailure('consent_grant', err);
      res.status(500).json({ error: 'coach_unavailable' });
    }
  });

  router.delete('/me/coach/consent', requireAuth, requireEnabled, async (req: AuthedRequest, res) => {
    try {
      await revokeConsent(req.userId!);
      res.status(204).end();
    } catch (err) {
      logFailure('consent_revoke', err);
      res.status(500).json({ error: 'coach_unavailable' });
    }
  });

  router.put('/me/coach/persona', requireAuth, requireEnabled, async (req: AuthedRequest, res) => {
    const persona = findPersona(req.body?.personaId);
    if (!persona) {
      res.status(400).json({ error: 'unknown_persona' });
      return;
    }
    try {
      const result = await prisma.user.updateMany({ where: { id: req.userId! }, data: { coachPersonaId: persona.id } });
      if (result.count === 0) {
        res.status(404).json({ error: 'User not found' });
        return;
      }
      res.json({ personaId: persona.id });
    } catch (err) {
      logFailure('persona', err);
      res.status(500).json({ error: 'coach_unavailable' });
    }
  });

  router.post('/me/coach/message', requireAuth, requireEnabled, async (req: AuthedRequest, res) => {
    const userId = req.userId!;
    try {
      // Consent is enforced here, server-side, before the message is looked at.
      if (!(await hasCurrentConsent(userId))) {
        res.status(403).json({ error: 'consent_required' });
        return;
      }

      const { message, conversationId, safetyOverride } = (req.body ?? {}) as Record<string, unknown>;
      if (typeof message !== 'string' || message.trim().length === 0 || message.length > MAX_MESSAGE_CHARS) {
        res.status(400).json({ error: `message must be a string of 1 to ${MAX_MESSAGE_CHARS} characters` });
        return;
      }
      if (conversationId !== undefined && typeof conversationId !== 'string') {
        res.status(400).json({ error: 'conversationId must be a string' });
        return;
      }
      if (safetyOverride !== undefined && typeof safetyOverride !== 'boolean') {
        res.status(400).json({ error: 'safetyOverride must be a boolean' });
        return;
      }

      let history: Array<{ role: 'user' | 'assistant'; text: string }> = [];
      if (conversationId !== undefined) {
        const conversation = await prisma.coachConversation.findFirst({ where: { id: conversationId, userId } });
        if (!conversation) {
          res.status(404).json({ error: 'conversation_not_found' });
          return;
        }
        const prior = await prisma.coachMessage.findMany({
          where: { conversationId },
          orderBy: { createdAt: 'desc' },
          take: HISTORY_WINDOW,
        });
        history = prior.reverse().map((m) => ({
          role: m.role === 'USER' ? 'user' : 'assistant',
          text: m.text,
        }));
      }

      const receivedAt = new Date();
      const orchestrator = createCoachOrchestrator({
        provider: deps.getProvider(),
        telemetry: deps.telemetry,
        clock: deps.clock,
        ...(deps.tools ? { tools: deps.tools } : {}),
        ...(deps.budgets ? { budgets: deps.budgets } : {}),
      });
      // Guarded here, not around the whole handler: validation and the history
      // read are cheap, and a 400 should not consume a rate-limit slot. The
      // model call is what costs a minute and (once a provider is wired) money.
      const turn = await withTurnGuard(userId, () =>
        orchestrator.handleTurn({
          userId,
          message: message.trim(),
          history,
          safetyOverride: safetyOverride === true,
          conversationId: conversationId ?? null,
        }),
      );

      // The assistant row is stamped strictly after the user row so transcript order is unambiguous.
      const repliedAt = new Date(Math.max(Date.now(), receivedAt.getTime() + 1));
      const assistantData = {
        userId,
        role: 'ASSISTANT' as const,
        text: turn.text,
        source: turn.source,
        ...(turn.events.length > 0 ? { guardrailEvents: turn.events } : {}),
        createdAt: repliedAt,
      };
      const userData = { userId, role: 'USER' as const, text: message.trim(), createdAt: receivedAt };

      const saved = await prisma.$transaction(async (tx) => {
        let id = conversationId;
        if (id === undefined) {
          id = (await tx.coachConversation.create({ data: { userId, createdAt: receivedAt, lastMessageAt: repliedAt } })).id;
        } else {
          await tx.coachConversation.update({ where: { id }, data: { lastMessageAt: repliedAt } });
        }
        await tx.coachMessage.create({ data: { conversationId: id, ...userData } });
        const assistant = await tx.coachMessage.create({ data: { conversationId: id, ...assistantData } });
        // Proposals are written during the turn, before a brand-new
        // conversation has an id. Stamp them here so the user's next message in
        // THIS conversation -- and only this one -- can settle them.
        const proposalIds = (turn.memoryProposals ?? []).map((m) => m.id);
        if (proposalIds.length > 0) {
          await tx.coachMemory.updateMany({ where: { id: { in: proposalIds }, userId }, data: { conversationId: id } });
        }
        return { id, assistant };
      });

      res.json({
        conversationId: saved.id,
        message: {
          id: saved.assistant.id,
          role: 'assistant',
          text: turn.text,
          source: turn.source.toLowerCase(),
          createdAt: repliedAt.toISOString(),
        },
        ...(turn.safety ? { safety: turn.safety } : {}),
        ...(turn.memoryProposals && turn.memoryProposals.length > 0 ? { memoryProposals: turn.memoryProposals } : {}),
      });
    } catch (err) {
      // Neither is a server fault, so neither is logged as one.
      if (err instanceof TurnRateLimitedError) {
        res.set('Retry-After', String(err.retryAfterSeconds));
        res.status(429).json({ error: 'too_many_messages', retryAfterSeconds: err.retryAfterSeconds });
        return;
      }
      if (err instanceof TurnInProgressError) {
        res.status(409).json({ error: 'turn_in_progress' });
        return;
      }
      logFailure('message', err);
      res.status(500).json({ error: 'coach_unavailable' });
    }
  });

  async function sendConversation(userId: string, conversationId: string | null, res: Response): Promise<void> {
    if (conversationId === null) {
      res.json({ conversationId: null, messages: [] });
      return;
    }
    const rows = await prisma.coachMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: MAX_TRANSCRIPT_MESSAGES,
    });
    res.json({ conversationId, messages: rows.reverse().map(messageDTO) });
  }

  router.get('/me/coach/conversations/latest', requireAuth, requireEnabled, async (req: AuthedRequest, res) => {
    try {
      const userId = req.userId!;
      const latest = await prisma.coachConversation.findFirst({ where: { userId }, orderBy: { lastMessageAt: 'desc' } });
      await sendConversation(userId, latest?.id ?? null, res);
    } catch (err) {
      logFailure('conversation_latest', err);
      res.status(500).json({ error: 'coach_unavailable' });
    }
  });

  router.get('/me/coach/conversations/:id', requireAuth, requireEnabled, async (req: AuthedRequest, res) => {
    try {
      const userId = req.userId!;
      const id = req.params.id as string;
      const conversation = await prisma.coachConversation.findFirst({ where: { id, userId }, select: { id: true } });
      if (!conversation) {
        res.status(404).json({ error: 'conversation_not_found' });
        return;
      }
      await sendConversation(userId, conversation.id, res);
    } catch (err) {
      logFailure('conversation', err);
      res.status(500).json({ error: 'coach_unavailable' });
    }
  });

  // ---- coach memory (spec sections 5 and 6) ----------------------------------
  // Viewing, editing and deleting memory never sends anything to the model
  // provider, so these routes need the flag but not consent: a user can always
  // see and remove what is stored about them.

  router.get('/me/coach/memory', requireAuth, requireEnabled, async (req: AuthedRequest, res) => {
    try {
      const rows = await prisma.coachMemory.findMany({
        where: { userId: req.userId! },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });
      res.json({ entries: rows.map(toMemoryDTO) });
    } catch (err) {
      logFailure('memory_list', err);
      res.status(500).json({ error: 'coach_unavailable' });
    }
  });

  router.patch('/me/coach/memory/:id', requireAuth, requireEnabled, async (req: AuthedRequest, res) => {
    try {
      const id = req.params.id as string;
      const existing = await prisma.coachMemory.findFirst({ where: { id, userId: req.userId! }, select: { id: true } });
      if (!existing) {
        res.status(404).json({ error: 'memory_not_found' });
        return;
      }
      // Same value rules as a model proposal: length and the health-fact classifier.
      const checked = validateMemoryValue(req.body?.value);
      if (!checked.ok) {
        res.status(400).json({ error: 'invalid_memory_value', reason: checked.reason });
        return;
      }
      const entry = await prisma.coachMemory.update({ where: { id }, data: { value: checked.value } });
      res.json({ entry: toMemoryDTO(entry) });
    } catch (err) {
      logFailure('memory_edit', err);
      res.status(500).json({ error: 'coach_unavailable' });
    }
  });

  router.delete('/me/coach/memory/:id', requireAuth, requireEnabled, async (req: AuthedRequest, res) => {
    try {
      const result = await prisma.coachMemory.deleteMany({ where: { id: req.params.id as string, userId: req.userId! } });
      if (result.count === 0) {
        res.status(404).json({ error: 'memory_not_found' });
        return;
      }
      res.status(204).end();
    } catch (err) {
      logFailure('memory_delete', err);
      res.status(500).json({ error: 'coach_unavailable' });
    }
  });

  // ---- weekly digest ----------------------------------------------------------

  router.get('/me/coach/digests/latest', requireAuth, requireEnabled, async (req: AuthedRequest, res) => {
    try {
      const digest = await prisma.coachDigest.findFirst({
        where: { userId: req.userId! },
        orderBy: [{ weekStart: 'desc' }, { createdAt: 'desc' }],
      });
      res.json({
        digest: digest ? { id: digest.id, text: digest.text, createdAt: digest.createdAt.toISOString() } : null,
      });
    } catch (err) {
      logFailure('digest_latest', err);
      res.status(500).json({ error: 'coach_unavailable' });
    }
  });

  // ---- push tokens ------------------------------------------------------------

  const isToken = (v: unknown): v is string =>
    typeof v === 'string' && v.length > 0 && v.length <= MAX_PUSH_TOKEN_CHARS && !/\s/.test(v);

  router.post('/me/push-token', requireAuth, requireEnabled, async (req: AuthedRequest, res) => {
    const { token, platform } = (req.body ?? {}) as Record<string, unknown>;
    if (!isToken(token)) {
      res.status(400).json({ error: 'token must be a non-empty string without whitespace' });
      return;
    }
    if (platform !== 'ios' && platform !== 'android') {
      res.status(400).json({ error: "platform must be 'ios' or 'android'" });
      return;
    }
    if (isExpoPushProvider() && !isExpoPushToken(token)) {
      res.status(400).json({ error: 'token must be an Expo push token' });
      return;
    }
    try {
      // A device token must never silently change hands: whoever holds the
      // string would otherwise redirect another account's coach notifications
      // to their own device. The update is scoped to this user's own rows and
      // the create leans on the unique constraint, so two concurrent claims
      // cannot race one through. A genuinely shared device still works --
      // signing out unregisters the token first (unregisterPushBestEffort).
      const claimed = await prisma.pushToken.updateMany({
        where: { token, userId: req.userId! },
        data: { platform },
      });
      if (claimed.count === 0) {
        try {
          await prisma.pushToken.create({ data: { userId: req.userId!, token, platform } });
        } catch (err) {
          if ((err as { code?: string } | null)?.code === 'P2002') {
            res.status(409).json({ error: 'token_registered_to_another_account' });
            return;
          }
          throw err;
        }
      }
      res.status(204).end();
    } catch (err) {
      logFailure('push_token_register', err);
      res.status(500).json({ error: 'coach_unavailable' });
    }
  });

  router.delete('/me/push-token', requireAuth, requireEnabled, async (req: AuthedRequest, res) => {
    const token = (req.body ?? {}).token;
    if (!isToken(token)) {
      res.status(400).json({ error: 'token must be a non-empty string without whitespace' });
      return;
    }
    try {
      await prisma.pushToken.deleteMany({ where: { token, userId: req.userId! } });
      res.status(204).end();
    } catch (err) {
      logFailure('push_token_delete', err);
      res.status(500).json({ error: 'coach_unavailable' });
    }
  });

  return router;
}

export const coachRouter = createCoachRouter();
