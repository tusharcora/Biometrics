// Eval runner (spec section 7): seeds a fixture's user snapshot, runs the
// fixture's question through the REAL orchestrator with a ScriptedProvider (no
// network, no SDK), and checks the run against the fixture's expectations.
//
// Two suites:
//   FIXTURES           every one must pass.
//   NEGATIVE_FIXTURES  every one must FAIL, on the check it names and no other:
//                      they prove the eval catches a class of error (notably the
//                      directional-claim class the runtime guardrail cannot).

import { CoachClock } from '../../src/coach/clock';
import { createCoachOrchestrator } from '../../src/coach/orchestrator';
import { ScriptedProvider } from '../../src/coach/model/provider';
import { CoachEvent, CoachTelemetry } from '../../src/coach/telemetry';
import { CoachTools, coachTools, DailyScoreToolResult } from '../../src/coach/tools';
import { prisma } from '../../src/db/client';
import { checkDirectionalClaims } from './directionCheck';
import { cleanupUser, seedSnapshot } from './seed';
import type { CheckFailure, EvalFixture, FixtureResult, NegativeFixture } from './types';

/** Never fires: the eval is deterministic and must not depend on wall-clock timers. */
const inertClock: CoachClock = { now: () => Date.now(), setTimer: () => ({ cancel: () => {} }) };

class CollectingTelemetry implements CoachTelemetry {
  events: CoachEvent[] = [];
  emit(event: CoachEvent): void {
    this.events.push(event);
  }
}

function withGroundedOverrides(base: CoachTools, overrides: EvalFixture['groundedOverrides']): CoachTools {
  if (!overrides) return base;
  const patch = (r: DailyScoreToolResult): DailyScoreToolResult => ({ ...r, ...overrides });
  return {
    ...base,
    getDailyScore: async (userId, date) => patch(await base.getDailyScore(userId, date)),
    run: async (userId, name, args, ctx) => {
      const outcome = await base.run(userId, name, args, ctx);
      return name === 'getDailyScore' && outcome.ok ? { ok: true, result: patch(outcome.result as DailyScoreToolResult) } : outcome;
    },
  };
}

const sameList = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/** The `direction` the model was actually handed for today's score: the last getDailyScore tool message. */
function groundedDirection(provider: ScriptedProvider): string | null {
  let direction: string | null = null;
  for (const request of provider.requests) {
    for (const m of request.messages) {
      if (m.role === 'tool' && m.name === 'getDailyScore') {
        const parsed = JSON.parse(m.content) as { direction?: string | null };
        if (typeof parsed.direction === 'string') direction = parsed.direction;
      }
    }
  }
  return direction;
}

export async function runFixture(fixture: EvalFixture): Promise<FixtureResult> {
  const failures: CheckFailure[] = [];
  const fail = (check: CheckFailure['check'], message: string) => failures.push({ check, message });
  let text = '';
  const { userId, conversationId } = await seedSnapshot(fixture.snapshot);
  try {
    const provider = new ScriptedProvider(fixture.script);
    const telemetry = new CollectingTelemetry();
    const orchestrator = createCoachOrchestrator({
      provider,
      telemetry,
      clock: inertClock,
      tools: withGroundedOverrides(coachTools, fixture.groundedOverrides),
    });
    const result = await orchestrator.handleTurn({ userId, message: fixture.question, history: [], conversationId });
    text = result.text;
    const want = fixture.expect;

    if (result.source !== want.source) fail('source', `expected ${want.source}, got ${result.source}`);
    if (want.modelCalls !== undefined && provider.callCount !== want.modelCalls) {
      fail('modelCalls', `expected ${want.modelCalls} model calls, got ${provider.callCount}`);
    }
    if (want.toolCalls) {
      const seen = telemetry.events
        .filter((e) => e.name === 'coach.tool_call' && e.attributes.preamble !== true)
        .map((e) => String(e.attributes.tool));
      if (!sameList(seen, want.toolCalls)) fail('toolCalls', `expected [${want.toolCalls.join(', ')}], got [${seen.join(', ')}]`);
    }
    for (const v of want.valuesPresent ?? []) if (!text.includes(v)) fail('valuesPresent', `reply is missing the expected value ${JSON.stringify(v)}`);
    for (const v of want.valuesAbsent ?? []) if (text.includes(v)) fail('valuesAbsent', `reply contains the forbidden text ${JSON.stringify(v)}`);
    if (want.guardrail) {
      const seen = result.events.flatMap((e) => (e.type === 'guardrail_reject' ? [`${e.reason}#${e.attempt}:${e.outcome}`] : []));
      const expected = want.guardrail.map((g) => `${g.reason}#${g.attempt}:${g.outcome}`);
      if (!sameList(seen, expected)) fail('guardrail', `expected guardrail events [${expected.join(', ')}], got [${seen.join(', ')}]`);
    }
    if (want.directionConsistent) {
      const grounded = groundedDirection(provider);
      if (grounded !== 'higher' && grounded !== 'lower' && grounded !== 'unchanged') {
        fail('direction', 'the turn has no grounded direction to check the reply against');
      } else {
        const check = checkDirectionalClaims(text, grounded);
        if (!check.ok) {
          fail(
            'direction',
            `grounded direction is "${grounded}" but the reply says ${check.contradictions.map((c) => `"${c.word}"`).join(', ')}`,
          );
        }
      }
    }
    if (want.memory) {
      const rows = await prisma.coachMemory.findMany({ where: { userId }, select: { value: true, status: true } });
      const byStatus = (s: string) => rows.filter((r) => r.status === s).map((r) => r.value).sort();
      const pending = byStatus('PENDING');
      const confirmed = byStatus('CONFIRMED');
      if (want.memory.pending && !sameList(pending, [...want.memory.pending].sort())) {
        fail('memory', `expected ${want.memory.pending.length} pending memory rows, got ${pending.length}`);
      }
      if (want.memory.confirmed && !sameList(confirmed, [...want.memory.confirmed].sort())) {
        fail('memory', `expected ${want.memory.confirmed.length} confirmed memory rows, got ${confirmed.length}`);
      }
    }
  } catch (err) {
    fail('run_error', err instanceof Error ? err.name : 'unknown');
  } finally {
    await cleanupUser(userId);
  }
  return { id: fixture.id, category: fixture.category, passed: failures.length === 0, failures, text };
}

export async function runFixtures(fixtures: readonly EvalFixture[]): Promise<FixtureResult[]> {
  const out: FixtureResult[] = [];
  for (const f of fixtures) out.push(await runFixture(f));
  return out;
}

export interface NegativeResult {
  id: string;
  mustFailCheck: NegativeFixture['mustFailCheck'];
  /** True when the fixture failed on exactly the named check and on nothing else. */
  caught: boolean;
  failures: CheckFailure[];
}

export async function runNegativeFixtures(fixtures: readonly NegativeFixture[]): Promise<NegativeResult[]> {
  const out: NegativeResult[] = [];
  for (const f of fixtures) {
    const result = await runFixture(f);
    out.push({
      id: f.id,
      mustFailCheck: f.mustFailCheck,
      caught: result.failures.length > 0 && result.failures.every((x) => x.check === f.mustFailCheck),
      failures: result.failures,
    });
  }
  return out;
}

export interface EvalReport {
  ok: boolean;
  results: FixtureResult[];
  negatives: NegativeResult[];
}

export async function runEval(fixtures: readonly EvalFixture[], negatives: readonly NegativeFixture[]): Promise<EvalReport> {
  const results = await runFixtures(fixtures);
  const negativeResults = await runNegativeFixtures(negatives);
  return {
    ok: results.every((r) => r.passed) && negativeResults.every((n) => n.caught),
    results,
    negatives: negativeResults,
  };
}
