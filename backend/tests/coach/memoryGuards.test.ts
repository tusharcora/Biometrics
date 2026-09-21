import { classifyHealthFact } from '../../src/coach/guardrails/healthFact';
import { classifyMemoryFeedback } from '../../src/coach/guardrails/memoryFeedback';
import { validateMemoryInput, MEMORY_CATEGORIES, MAX_MEMORY_VALUE_CHARS } from '../../src/coach/memory';
import { COACH_TOOL_SCHEMAS, coachTools, PROPOSE_MEMORY_SCHEMA } from '../../src/coach/tools';

describe('health-fact classifier (memory second layer)', () => {
  it.each([
    'has a knee injury',
    'I am on medication for blood pressure',
    'diagnosed with hypertension',
    'takes 20 mg of something at night',
    'recovering from surgery',
    'has type 2 diabetes',
    'suffers from insomnia and anxiety',
    'my back pain flares up',
    'pregnant, due in spring',
    'heart condition',
    'takes melatonin',
    'feeling depressed lately',
  ])('blocks %j', (value) => {
    expect(classifyHealthFact(value).blocked).toBe(true);
  });

  it.each([
    'Training for a half marathon in October',
    'Runs at 6am on weekdays',
    'Prefers short, direct answers',
    'Wants to get stronger this year',
    'Lifts on Monday, Wednesday and Friday',
    'Likes evening workouts',
  ])('allows %j', (value) => {
    expect(classifyHealthFact(value).blocked).toBe(false);
  });

  it('is case- and apostrophe-insensitive', () => {
    expect(classifyHealthFact('HAS A KNEE INJURY').blocked).toBe(true);
  });
});

describe('memory input validation (allowlist)', () => {
  it('has exactly the three closed categories', () => {
    expect([...MEMORY_CATEGORIES]).toEqual(['TRAINING_GOAL', 'SCHEDULE', 'PREFERENCE']);
  });

  it('accepts a valid proposal and trims it', () => {
    expect(validateMemoryInput({ category: 'SCHEDULE', value: '  Runs at 6am  ' })).toEqual({
      ok: true,
      category: 'SCHEDULE',
      value: 'Runs at 6am',
    });
  });

  it.each([
    [{ category: 'MEDICAL', value: 'x' }, 'invalid_category'],
    [{ category: 'training_goal', value: 'x' }, 'invalid_category'],
    [{ category: undefined, value: 'x' }, 'invalid_category'],
    [{ category: 'PREFERENCE' }, 'invalid_value'],
    [{ category: 'PREFERENCE', value: 12 }, 'invalid_value'],
    [{ category: 'PREFERENCE', value: '   ' }, 'invalid_value'],
    [{ category: 'PREFERENCE', value: 'x'.repeat(MAX_MEMORY_VALUE_CHARS + 1) }, 'value_too_long'],
    [{ category: 'PREFERENCE', value: 'has a knee injury' }, 'health_content'],
  ])('rejects %j as %s', (input, reason) => {
    expect(validateMemoryInput(input)).toEqual({ ok: false, reason });
  });

  it('accepts exactly 140 characters', () => {
    expect(validateMemoryInput({ category: 'PREFERENCE', value: 'a'.repeat(140) }).ok).toBe(true);
  });

  it('rejects non-object input', () => {
    expect(validateMemoryInput(null)).toEqual({ ok: false, reason: 'invalid_category' });
    expect(validateMemoryInput('x')).toEqual({ ok: false, reason: 'invalid_category' });
  });
});

describe('next-message feedback detector', () => {
  it.each([
    'thanks, what about my HRV',
    'ok how is my sleep score this week',
    'sounds good. can you compare last night to yesterday',
    'yes that is right',
  ])('confirms on an uncorrected message: %j', (m) => {
    expect(classifyMemoryFeedback(m)).toBe('confirm');
  });

  it.each([
    'no, that is not right',
    'Actually I changed my mind',
    'forget that please',
    "don't remember that",
    'that was wrong',
    'wrong goal, it is a 10k',
    'nope',
    'delete that',
    "that isn't what I said",
    'I meant something else',
    'please stop remembering things',
    'why is my score not higher', // doubt: a bare negation is treated as a correction
    'undo that',
    'ignore that',
  ])('dismisses on a correction or dismissal cue: %j', (m) => {
    expect(classifyMemoryFeedback(m)).toBe('dismiss');
  });

  it('treats an empty or unusable message as doubt', () => {
    expect(classifyMemoryFeedback('')).toBe('dismiss');
    expect(classifyMemoryFeedback('   ')).toBe('dismiss');
  });

  it('is case-insensitive and normalises curly apostrophes', () => {
    expect(classifyMemoryFeedback('THAT’S NOT RIGHT')).toBe('dismiss');
    expect(classifyMemoryFeedback('DON’T SAVE THAT')).toBe('dismiss');
  });
});

describe('proposeMemory tool', () => {
  const ctx = { today: '2026-09-20' };

  it('is exposed to the model but is not part of the read-only registry, and its schema pins the closed enum and the length', () => {
    expect(COACH_TOOL_SCHEMAS.map((t) => t.name)).not.toContain('proposeMemory');
    expect(coachTools.schemas.map((t) => t.name)).toContain('proposeMemory');
    const props = (PROPOSE_MEMORY_SCHEMA.parameters as any).properties;
    expect(props.category.enum).toEqual(['TRAINING_GOAL', 'SCHEDULE', 'PREFERENCE']);
    expect(props.value.maxLength).toBe(140);
    expect((PROPOSE_MEMORY_SCHEMA.parameters as any).additionalProperties).toBe(false);
  });

  it('validates only: a good call returns the normalised proposal and touches no database', async () => {
    const out = await coachTools.run('no-such-user', 'proposeMemory', { category: 'SCHEDULE', value: ' Runs at 6am ' }, ctx);
    expect(out).toEqual({ ok: true, result: { proposal: { category: 'SCHEDULE', value: 'Runs at 6am' } } });
  });

  it.each([
    [{ category: 'MEDICAL', value: 'x' }, 'invalid_arguments'],
    [{ category: 'SCHEDULE', value: 'y'.repeat(141) }, 'invalid_arguments'],
    [{ category: 'SCHEDULE', value: 'has a knee injury' }, 'memory_rejected'],
    [{}, 'invalid_arguments'],
    [null, 'invalid_arguments'],
    ['nope', 'invalid_arguments'],
  ])('rejects %j as %s', async (args, error) => {
    expect(await coachTools.run('u', 'proposeMemory', args, ctx)).toEqual({ ok: false, error });
  });
});
