// `npm run eval:coach:local`: runs the coach eval fixtures' (snapshot, question)
// pairs through the REAL orchestrator with the local Ollama provider (built from
// OLLAMA_* env, exactly as the server builds it) and reports, per fixture, what
// a real model did: reply source, latency, guardrail retries, tool calls, and
// whether its stated direction matches the grounded one. Scripted outputs in
// the fixtures are ignored. Promoted from the local-model spike
// (docs/superpowers/notes/local-model-coach-plan.md).
//
// Env: OLLAMA_MODEL (required) and the other OLLAMA_* settings; EVAL_BUDGET_MS
// (default 300000, so quality is measured apart from speed; latency is reported
// separately); EVAL_IDS (comma list); EVAL_LIMIT; EVAL_OUT (jsonl path).
// DATABASE_URL must name a *_test database: each fixture seeds and deletes a user.
//
// Output quotes model replies to fixture questions about seeded fixture data;
// no real user's data is ever read.

import * as fs from 'fs';
import { createCoachOrchestrator } from '../../src/coach/orchestrator';
import { coachTools } from '../../src/coach/tools';
import { ollamaProviderFromEnv } from '../../src/coach/model/ollama';
import type { CoachModelProvider, CoachModelRequest, CoachModelResponse } from '../../src/coach/model/provider';
import { prisma } from '../../src/db/client';
import { checkDirectionalClaims } from './directionCheck';
import { FIXTURES } from './fixtures';
import { cleanupUser, seedSnapshot } from './seed';

if (!/_test(\?|$)/.test(process.env.DATABASE_URL ?? '')) {
  console.error('refusing to run: DATABASE_URL must name a *_test database');
  process.exit(2);
}

const BUDGET = Number(process.env.EVAL_BUDGET_MS ?? 300_000);
const OUT = process.env.EVAL_OUT;

/** Wraps the real provider to record requests and per-call latency. */
class RecordingProvider implements CoachModelProvider {
  readonly id: string;
  readonly requests: CoachModelRequest[] = [];
  readonly callMs: number[] = [];
  constructor(private readonly inner: CoachModelProvider) {
    this.id = inner.id;
  }
  async generate(request: CoachModelRequest): Promise<CoachModelResponse> {
    this.requests.push(request);
    const started = Date.now();
    try {
      return await this.inner.generate(request);
    } finally {
      this.callMs.push(Date.now() - started);
    }
  }
}

// Same as runner.ts (not exported there).
function withGroundedOverrides(base: typeof coachTools, overrides: Record<string, unknown> | undefined): typeof coachTools {
  if (!overrides) return base;
  const patch = <T>(r: T): T => ({ ...r, ...overrides });
  return {
    ...base,
    getDailyScore: async (userId, date) => patch(await base.getDailyScore(userId, date)),
    run: async (userId, name, args, ctx) => {
      const outcome = await base.run(userId, name, args, ctx);
      return name === 'getDailyScore' && outcome.ok ? { ok: true, result: patch(outcome.result) } : outcome;
    },
  };
}

function groundedDirection(provider: RecordingProvider): string | null {
  let direction: string | null = null;
  for (const request of provider.requests) {
    for (const m of request.messages) {
      if (m.role === 'tool' && m.name === 'getDailyScore') {
        const parsed = JSON.parse(m.content) as { direction?: unknown };
        if (typeof parsed.direction === 'string') direction = parsed.direction;
      }
    }
  }
  return direction;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]!;
}

async function main(): Promise<number> {
  const base = ollamaProviderFromEnv();
  const ids = process.env.EVAL_IDS ? new Set(process.env.EVAL_IDS.split(',')) : null;
  const fixtures = FIXTURES.filter((f) => f.category !== 'safety') // the safety path never reaches the model
    .filter((f) => (ids ? ids.has(f.id) : true))
    .slice(0, Number(process.env.EVAL_LIMIT ?? 1000));
  if (OUT) fs.writeFileSync(OUT, '');
  console.log(`provider=${base.id} fixtures=${fixtures.length} budget=${BUDGET}ms`);

  const rows: { source: string; wallMs: number; directionOk: boolean | null; retried: boolean }[] = [];
  for (const fx of fixtures) {
    const { userId } = await seedSnapshot(fx.snapshot);
    const provider = new RecordingProvider(base);
    const events: { name: string; attributes: Record<string, unknown> }[] = [];
    const orchestrator = createCoachOrchestrator({
      provider,
      telemetry: { emit: (e: { name: string; attributes: Record<string, unknown> }) => events.push(e) } as never,
      budgets: { fast: BUDGET, synthesis: BUDGET },
      tools: withGroundedOverrides(coachTools, fx.groundedOverrides as Record<string, unknown> | undefined),
    });
    const t0 = Date.now();
    try {
      const result = await orchestrator.handleTurn({ userId, message: fx.question, history: [] });
      const wallMs = Date.now() - t0;
      const grounded = groundedDirection(provider);
      let directionOk: boolean | null = null;
      if (result.source === 'MODEL' && (grounded === 'higher' || grounded === 'lower' || grounded === 'unchanged')) {
        directionOk = checkDirectionalClaims(result.text, grounded).ok;
      }
      const guardrail = result.events.filter((e) => e.type === 'guardrail_reject').map((e) => JSON.stringify(e));
      const tools = events.filter((e) => e.name === 'coach.tool_call' && e.attributes.preamble !== true).map((e) => String(e.attributes.tool));
      rows.push({ source: result.source, wallMs, directionOk, retried: guardrail.length > 0 });
      const row = { id: fx.id, category: fx.category, source: result.source, wallMs, modelCalls: provider.callMs.length, tools, guardrail, directionOk, text: result.text };
      if (OUT) fs.appendFileSync(OUT, JSON.stringify(row) + '\n');
      console.log(`${result.source.padEnd(8)} ${String(wallMs).padStart(6)}ms  calls=${provider.callMs.length} retry=${guardrail.length > 0 ? 'y' : 'n'} tools=[${tools.join(',')}]  ${fx.id}`);
    } catch (err) {
      rows.push({ source: 'ERROR', wallMs: Date.now() - t0, directionOk: null, retried: false });
      console.log(`ERROR    ${err instanceof Error ? err.name : 'unknown'}  ${fx.id}`);
    } finally {
      await cleanupUser(userId);
    }
  }

  const model = rows.filter((r) => r.source === 'MODEL');
  const ms = model.map((r) => r.wallMs).sort((a, b) => a - b);
  const checked = model.filter((r) => r.directionOk !== null);
  console.log(`\nmodel replies ${model.length}/${rows.length}, first-try guardrail rejects ${rows.filter((r) => r.retried).length}`);
  console.log(`direction ok ${checked.filter((r) => r.directionOk).length}/${checked.length} (checker over-flags free prose; read the flagged ones)`);
  console.log(`latency of model replies: min ${ms[0] ?? 0} median ${percentile(ms, 50)} p90 ${percentile(ms, 90)} max ${ms[ms.length - 1] ?? 0} ms`);
  for (const budget of [12_000, 30_000, 60_000, 90_000]) {
    console.log(`  within ${budget / 1000}s: ${ms.filter((m) => m <= budget).length}/${rows.length}`);
  }
  return 0;
}

main()
  .then(async (code) => {
    await prisma.$disconnect();
    process.exit(code);
  })
  .catch(async (err) => {
    console.error(err instanceof Error ? `${err.name}: ${err.message}` : 'eval_failed');
    await prisma.$disconnect();
    process.exit(1);
  });
