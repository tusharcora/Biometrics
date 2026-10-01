import type { FactSheet } from '../../src/coach/answer/facts';
import { extractNumbers, resolveCard, validateSentence } from '../../src/coach/answer/validate';

const SHEET: FactSheet = {
  route: 'today',
  facts: [
    { id: 'recovery.today', label: 'Recovery today', value: 26, unit: 'score', display: '26', usual: 58 },
    { id: 'hrv.today', label: 'HRV today', value: 41, unit: 'ms', display: '41 ms', usual: 52.3 },
    { id: 'rhr.today', label: 'Resting heart rate today', value: 66, unit: 'bpm', display: '66 bpm', usual: 57, lowerIsBetter: true },
    { id: 'sleep.total', label: 'Sleep last night', value: 408, unit: 'minutes', display: '6h 48m', usual: 433 },
    { id: 'steps.today', label: 'Steps today so far', value: 3120, unit: 'count', display: '3,120', usual: 8450 },
    { id: 'habit.caffeine.hrv', label: 'Caffeine (3+ cups) and next-day HRV', value: 8, unit: 'percent', display: '8% lower', note: '(n=21)' },
  ],
  notes: [],
};
const GENERAL: FactSheet = {
  route: 'general',
  facts: [{ id: 'sleep.goal', label: 'Sleep goal', value: 480, unit: 'minutes', display: '8h 0m' }],
  notes: [],
};

const ok = { ok: true };
const unknown = { ok: false, reason: 'unknown_number' };
const topic = { ok: false, reason: 'disallowed_topic' };

describe('extractNumbers', () => {
  it('reads plain numbers, thousands separators and decimals, ignoring the sign', () => {
    expect(extractNumbers('Recovery 26, steps 3,120, HRV 41.3 and -8.')).toEqual([
      { kind: 'plain', value: 26 },
      { kind: 'plain', value: 3120 },
      { kind: 'plain', value: 41.3 },
      { kind: 'plain', value: 8 },
    ]);
  });

  it('reads every duration shape as minutes', () => {
    expect(extractNumbers('6h 48m')).toEqual([{ kind: 'duration', minutes: 408 }]);
    expect(extractNumbers('6 hours and 48 minutes')).toEqual([{ kind: 'duration', minutes: 408 }]);
    expect(extractNumbers('408 minutes')).toEqual([{ kind: 'duration', minutes: 408 }]);
    expect(extractNumbers('6.8 hours')).toEqual([{ kind: 'duration', minutes: 408 }]);
    expect(extractNumbers('25m less')).toEqual([{ kind: 'duration', minutes: 25 }]);
    expect(extractNumbers('5:30 of sleep')).toEqual([{ kind: 'duration', minutes: 330 }]);
    expect(extractNumbers('7–9 hours')).toEqual([
      { kind: 'duration', minutes: 420 },
      { kind: 'duration', minutes: 540 },
    ]);
  });

  it('does not read milliseconds or milligrams as minutes', () => {
    expect(extractNumbers('41 ms')).toEqual([{ kind: 'plain', value: 41 }]);
    expect(extractNumbers('3 mg')).toEqual([{ kind: 'plain', value: 3 }]);
  });

  it('skips times of day, month-name dates, ordinals and line-start list markers', () => {
    expect(extractNumbers('Be in bed by 10pm or 10:30 pm, lights out at 22:30.')).toEqual([]);
    expect(extractNumbers('Since September 14 and the 3rd, wake-ups after 04:00.')).toEqual([]);
    expect(extractNumbers('1. Go to bed earlier.')).toEqual([]);
  });
});

describe('validateSentence: numbers', () => {
  it.each([
    'Your recovery is 26 today, well below your usual 58.',
    'That is 32 points lower than usual.',
    'You slept 6h 48m last night.',
    'You slept 408 minutes.',
    'That is about 6.8 hours of sleep.',
    'You got 6 hours and 48 minutes of sleep.',
    'You slept 6h 49m.',
    'Your usual is 7h 13m, so you were 25 minutes short.',
    'You have 3,120 steps so far.',
    'Your HRV is 41.3 ms against a usual 52.3 ms.',
    'Your HRV is 11.3 ms below usual.',
    'Caffeine days show 8% lower HRV across 21 days.',
    'Your recovery of 27 is low.',
    'Try to be in bed by 10pm tonight.',
    'Keep your bedroom cool and dark.',
  ])('accepts %j', (sentence) => {
    expect(validateSentence(sentence, SHEET)).toEqual(ok);
  });

  it.each([
    'Your recovery is 28 today.',
    'Your HRV is 60 ms.',
    'You slept 6h 55m.',
    'You slept 5:30.',
    'Most adults need 7–9 hours of sleep.',
    'Aim for 10,000 steps.',
  ])('rejects %j as unknown_number on a data route', (sentence) => {
    expect(validateSentence(sentence, SHEET)).toEqual(unknown);
  });

  it('marks a number hedged by about/around/roughly/nearly/almost/close to/~/just under/over', () => {
    expect(extractNumbers('about 7 hours, ~8,000 steps, just under 400 minutes, close to 55')).toEqual([
      { kind: 'duration', minutes: 420, hedged: true },
      { kind: 'plain', value: 8000, hedged: true },
      { kind: 'duration', minutes: 400, hedged: true },
      { kind: 'plain', value: 55, hedged: true },
    ]);
    expect(extractNumbers('7 hours')).toEqual([{ kind: 'duration', minutes: 420 }]);
  });

  it.each([
    'You slept about 7 hours.',
    'That is around 400 minutes of sleep.',
    'You got just under 7 hours.',
    'Roughly 7.2 hours, close to your usual.',
    'Your usual is roughly 55.',
    'You have ~3,000 steps so far.',
    'Your HRV is nearly 45 ms.',
  ])('accepts the hedged approximation %j (within 10%)', (sentence) => {
    expect(validateSentence(sentence, SHEET)).toEqual(ok);
  });

  it.each([
    'You slept about 9 hours.',
    'You slept around 5 hours.',
    'That is about 300 minutes.',
    'Your recovery is about 75.',
    'Your HRV is nearly 90 ms.',
    'You slept 7 hours.',
    'Your usual is 55.',
  ])('rejects %j: hedged beyond 10%, or unhedged beyond the strict tolerance', (sentence) => {
    expect(validateSentence(sentence, SHEET)).toEqual(unknown);
  });

  it('allows general-knowledge figures on the general route', () => {
    expect(validateSentence('Most adults need 7–9 hours of sleep.', GENERAL)).toEqual(ok);
    expect(validateSentence('A resting heart rate of 60 to 100 bpm is typical for adults.', GENERAL)).toEqual(ok);
    expect(validateSentence('Your goal of 8 hours sits right in that range.', GENERAL)).toEqual(ok);
  });

  it('still rejects an invented number about the user on the general route', () => {
    expect(validateSentence('You slept 5 hours last night.', GENERAL)).toEqual(unknown);
    expect(validateSentence('Your recovery is 40 today.', GENERAL)).toEqual(unknown);
  });
});

describe('validateSentence: topics', () => {
  it.each([
    'Try 3 mg of melatonin before bed.',
    'A magnesium supplement could help you sleep.',
    'You might have sleep apnea.',
    'This could be a sign of insomnia.',
    'Ask about a higher dose of your medication.',
  ])('rejects %j as disallowed_topic', (sentence) => {
    expect(validateSentence(sentence, GENERAL)).toEqual(topic);
  });
});

describe('resolveCard', () => {
  it('fills tiles from the fact sheet, with usual and status, keeping the model labels', () => {
    const card = resolveCard(
      {
        headline: 'Recovery is well below usual',
        tiles: [
          { fact: 'recovery.today', label: 'Recovery' },
          { fact: 'rhr.today', label: 'Resting HR' },
          { fact: 'sleep.total', label: 'Sleep' },
        ],
        tip: 'Keep today easy.',
        source: 'Today · Recovery',
      },
      SHEET,
    );
    expect(card).toEqual({
      headline: 'Recovery is well below usual',
      tiles: [
        { factId: 'recovery.today', label: 'Recovery', display: '26', value: 26, usual: 58, status: 'below' },
        { factId: 'rhr.today', label: 'Resting HR', display: '66 bpm', value: 66, usual: 57, status: 'below' },
        { factId: 'sleep.total', label: 'Sleep', display: '6h 48m', value: 408, usual: 433, status: 'near' },
      ],
      tip: 'Keep today easy.',
      source: 'Today · Recovery',
    });
  });

  it('drops unknown fact ids and duplicates, and caps tiles at four', () => {
    const card = resolveCard(
      {
        headline: 'Today',
        tiles: ['recovery.today', 'nope', 'recovery.today', 'hrv.today', 'rhr.today', 'sleep.total', 'steps.today'].map((fact) => ({ fact, label: 'L' })),
        source: 'Today',
      },
      SHEET,
    );
    expect(card?.tiles?.map((t) => t.factId)).toEqual(['recovery.today', 'hrv.today', 'rhr.today', 'sleep.total']);
  });

  it('builds a ranked card when there are no valid tiles', () => {
    const card = resolveCard(
      { headline: 'What moved your recovery', ranked: [{ fact: 'habit.caffeine.hrv', label: 'Late caffeine' }, { fact: 'sleep.total', label: 'Short sleep' }], source: 'Trends' },
      SHEET,
    );
    expect(card?.tiles).toBeUndefined();
    expect(card?.ranked?.map((r) => [r.factId, r.display])).toEqual([
      ['habit.caffeine.hrv', '8% lower'],
      ['sleep.total', '6h 48m'],
    ]);
  });

  it('uses the fact label when the model label is missing, too long or has digits', () => {
    const card = resolveCard(
      { headline: 'Today', tiles: [{ fact: 'recovery.today' }, { fact: 'hrv.today', label: 'HRV 99' }, { fact: 'sleep.total', label: 'x'.repeat(40) }], source: 'Today' },
      SHEET,
    );
    expect(card?.tiles?.map((t) => t.label)).toEqual(['Recovery today', 'HRV today', 'Sleep last night']);
  });

  it('is null with no card, no headline, a headline with an invented number, or no valid rows', () => {
    expect(resolveCard(undefined, SHEET)).toBeNull();
    expect(resolveCard({ tiles: [{ fact: 'recovery.today' }], source: 'x' }, SHEET)).toBeNull();
    expect(resolveCard({ headline: 'Recovery is 90', tiles: [{ fact: 'recovery.today' }] }, SHEET)).toBeNull();
    expect(resolveCard({ headline: 'Today', tiles: [{ fact: 'nope' }], ranked: 'x' }, SHEET)).toBeNull();
    expect(resolveCard({ headline: 'Today', tiles: 'recovery.today' }, SHEET)).toBeNull();
  });

  it('drops a tip that fails validation and falls back to the route source', () => {
    const card = resolveCard({ headline: 'Today', tiles: [{ fact: 'recovery.today' }], tip: 'Take 5 mg of melatonin.', source: 42 }, SHEET);
    expect(card).toEqual({
      headline: 'Today',
      tiles: [{ factId: 'recovery.today', label: 'Recovery today', display: '26', value: 26, usual: 58, status: 'below' }],
      source: "Today's scores and readings",
    });
  });
});
