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

// Fix round 1 (ruling R9): invented numbers about the user must not pass by
// borrowing another metric's value, a digit from an id or label, or a number word.
const PROBE: FactSheet = {
  route: 'today',
  facts: [
    { id: 'recovery.today', label: 'Recovery today', value: 26, unit: 'score', display: '26', usual: 58 },
    { id: 'hrv.today', label: 'HRV today', value: 41, unit: 'ms', display: '41 ms', usual: 52.3 },
    { id: 'rhr.today', label: 'Resting heart rate today', value: 61, unit: 'bpm', display: '61 bpm', usual: 57, lowerIsBetter: true },
    { id: 'sleep.total', label: 'Sleep last night', value: 408, unit: 'minutes', display: '6h 48m', usual: 433 },
    { id: 'recovery.avg7', label: 'Recovery 7-day average', value: 44, unit: 'score', display: '44', usual: 58 },
    { id: 'hrv.avg30', label: 'HRV 30-day average', value: 52.3, unit: 'ms', display: '52.3 ms' },
    { id: 'habit.alcohol.hrv.lag2', label: 'Alcohol (1+ drinks) and 2-days-later HRV', value: 12, unit: 'percent', display: '12% lower', note: '(n=14)' },
  ],
  notes: ['Sleep recorded on 5 of the last 7 nights'],
};

describe('validateSentence: units, metrics and sheet digits (fix round 1)', () => {
  it.each([
    ['Your HRV was 62 ms.', "resting HR's 61 is not an HRV value"],
    ['Your HRV dropped 26%.', "recovery's 26 is not a percent"],
    ['Your HRV is 31 ms.', "the 30 in 'hrv.avg30' / '30-day' is not a value"],
    ['Your HRV is 7 ms.', "the 7 in 'recovery.avg7' / '7-day' is not a value"],
    ['Your HRV is 61.', 'a bare number in an HRV sentence must be an HRV value'],
    ['Your recovery is 2.', "the 2 in 'lag2' is not a value"],
    ['Your resting heart rate is 41 bpm.', "HRV's 41 is not a bpm value"],
    ['You have 26 steps so far.', "recovery's 26 is not a step count"],
    ['Recovery is 12 points below usual.', "the habit's 12% is not a score"],
  ])('rejects %j (%s)', (sentence) => {
    expect(validateSentence(sentence, PROBE)).toEqual(unknown);
  });

  it.each([
    'Your HRV is 41 ms, against a usual 52.3 ms.',
    'Your HRV is 11.3 ms below usual.',
    'Your resting heart rate is 61 bpm, 4 bpm above usual.',
    'Your recovery is 26/100.',
    'Your recovery is 26 out of 100.',
    'Your recovery is 32 points below usual.',
    'Your 7-day recovery average is 44.',
    'Your HRV 30-day average is 52.3 ms.',
    'Over the last 30 days your HRV averaged 52.3 ms.',
    'Alcohol showed 12% lower HRV two days later, across 14 nights.',
    'Sleep was recorded on 5 of the last 7 nights.',
    'You slept about 7 hours.',
    'Since Sep 26, 2026 your recovery has been 26.',
  ])('accepts %j', (sentence) => {
    expect(validateSentence(sentence, PROBE)).toEqual(ok);
  });

  it('accepts "Your HRV is N ms." only near an HRV value (sweep 0-120)', () => {
    const accepted = Array.from({ length: 121 }, (_, n) => n).filter((n) => validateSentence(`Your HRV is ${n} ms.`, PROBE).ok);
    // 41 (today), 52.3 (usual and 30-day average) and 11.3 (the difference), integers within ±1.
    expect(accepted).toEqual([11, 12, 40, 41, 42, 52, 53]);
  });
});

describe('extractNumbers: number words and exemptions (fix round 1)', () => {
  it('reads number words followed by a unit or metric word', () => {
    expect(extractNumbers('nine hours')).toEqual([{ kind: 'duration', minutes: 540 }]);
    expect(extractNumbers('about seven hours')).toEqual([{ kind: 'duration', minutes: 420, hedged: true }]);
    expect(extractNumbers('five points lower')).toEqual([{ kind: 'plain', value: 5 }]);
    expect(extractNumbers('Twenty-five minutes')).toEqual([{ kind: 'duration', minutes: 25 }]);
    expect(extractNumbers('nine thousand steps')).toEqual([{ kind: 'plain', value: 9000 }]);
  });

  it('leaves number words without a unit alone', () => {
    expect(extractNumbers('Here is one thing to try.')).toEqual([]);
    expect(extractNumbers('Take it one step at a time.')).toEqual([]);
  });

  it('skips a year after a month-date, the /100 scale and the sheet windows', () => {
    expect(extractNumbers('Since Sep 26, 2026.')).toEqual([]);
    expect(extractNumbers('Recovery 26/100.')).toEqual([{ kind: 'plain', value: 26 }]);
    expect(extractNumbers('Your 7-day and 30-day averages over the last 30 days.')).toEqual([]);
  });
});

describe('validateSentence: number words (fix round 1)', () => {
  it('rejects invented number words about the user', () => {
    expect(validateSentence('You slept nine hours.', PROBE)).toEqual(unknown);
    expect(validateSentence('You slept about nine hours.', PROBE)).toEqual(unknown);
    expect(validateSentence('Your recovery is five points below usual.', PROBE)).toEqual(unknown);
  });

  it('accepts a hedged number word within 10%', () => {
    expect(validateSentence('You slept about seven hours.', PROBE)).toEqual(ok);
  });
});

describe('validateSentence: general route claims about the user (fix round 1)', () => {
  it.each([
    "You've been sleeping 5 hours a night.",
    "You're averaging 5 hours.",
    'Last night was only 5 hours.',
    'Sleep 5 hours and recovery will drop to 20.',
    'You slept five hours.',
    'This week you managed 6 hours a night.',
  ])('rejects %j', (sentence) => {
    expect(validateSentence(sentence, GENERAL)).toEqual(unknown);
  });

  it('still allows general knowledge that is not about the user', () => {
    expect(validateSentence('Most adults need seven to nine hours of sleep.', GENERAL)).toEqual(ok);
    expect(validateSentence('Caffeine has a half-life of about 5 hours.', GENERAL)).toEqual(ok);
  });
});
