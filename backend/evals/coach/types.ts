// Eval harness types (spec section 7). A fixture is (user data snapshot,
// question, scripted model outputs) plus what must be true of the run: the
// expected tool-call sequence, expected-value presence, expected guardrail
// events, memory rows, and (for the directional-claim category) that the reply's
// directional language agrees with the grounded `direction` field.
//
// The fixture is run through the REAL orchestrator with a ScriptedProvider, so a
// change to the prompt builder, guardrails, tools or orchestrator that breaks a
// fixture fails CI (tests/coach/evals.test.ts) and `npm run eval:coach`.

import type { GuardrailReason } from '../../src/coach/guardrails/grounding';
import type { ScriptStep } from '../../src/coach/model/provider';
import type { MemoryCategory } from '../../src/coach/memory';

export type Direction = 'higher' | 'lower' | 'unchanged';

/** Scores are keyed by days ago (0 = today, in the user's civil time). */
export interface UserSnapshot {
  recovery?: Array<[daysAgo: number, score: number]>;
  sleep?: Array<[daysAgo: number, score: number]>;
  pendingMemories?: Array<{ category: MemoryCategory; value: string }>;
  confirmedMemories?: Array<{ category: MemoryCategory; value: string }>;
}

export type FixtureCategory = 'grounding' | 'tools' | 'digit-scan-accept' | 'digit-scan-reject' | 'direction' | 'memory' | 'safety';

export interface FixtureExpectation {
  source: 'MODEL' | 'FALLBACK' | 'SAFETY';
  /** How many times the model was called (the preamble is not a model call). */
  modelCalls?: number;
  /** Exact sequence of tools the MODEL asked for, in order (the server preamble is not included). */
  toolCalls?: string[];
  /** Substrings that must appear in the final, resolved reply. */
  valuesPresent?: string[];
  /** Substrings that must NOT appear (e.g. the rejected text). */
  valuesAbsent?: string[];
  /** Exact guardrail events expected on the turn, in order. Omit to not check; [] means none. */
  guardrail?: Array<{ reason: GuardrailReason; attempt: number; outcome: 'regenerate' | 'fallback' }>;
  /**
   * Run the directional-claim checker: every directional word in the reply must
   * agree with the `direction` the model was actually handed for today's score.
   * The runtime guardrail does NOT catch this class (spec section 4); this check does.
   */
  directionConsistent?: boolean;
  /** Exact memory values in the database after the turn, by status. */
  memory?: { pending?: string[]; confirmed?: string[] };
}

export interface EvalFixture {
  id: string;
  category: FixtureCategory;
  description: string;
  snapshot: UserSnapshot;
  /**
   * Overrides fields of the getDailyScore result (preamble and tool calls alike).
   * Used to set a grounded `direction` deliberately OPPOSITE to what a naive
   * reading of the raw numbers suggests.
   */
  groundedOverrides?: { direction?: Direction; deltaFromYesterday?: number };
  question: string;
  script: ScriptStep[];
  expect: FixtureExpectation;
}

/** Names of the checks the runner performs; a failure is reported against one of these. */
export type CheckName =
  | 'source'
  | 'modelCalls'
  | 'toolCalls'
  | 'valuesPresent'
  | 'valuesAbsent'
  | 'guardrail'
  | 'direction'
  | 'memory'
  | 'run_error';

export interface CheckFailure {
  check: CheckName;
  message: string;
}

export interface FixtureResult {
  id: string;
  category: FixtureCategory;
  passed: boolean;
  failures: CheckFailure[];
  /** Final reply text as the client would see it. Kept for debugging; never logged by the CLI. */
  text: string;
}

/** A fixture that MUST fail, and on which check: proves the eval catches that class of error. */
export interface NegativeFixture extends EvalFixture {
  mustFailCheck: CheckName;
}
