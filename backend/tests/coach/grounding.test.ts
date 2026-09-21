import { validateReply, resolveReferences, parseReference } from '../../src/coach/guardrails/grounding';
import { withDisclaimer, COACH_DISCLAIMER } from '../../src/coach/guardrails/disclaimer';

const RESULTS = [
  {
    name: 'getDailyScore',
    result: {
      date: '2026-09-20',
      recoveryScore: 72.4,
      sleepScore: null,
      direction: 'lower',
      deltaFromYesterday: -3.1,
      factors: [{ label: 'HRV', points: 4.5 }],
    },
  },
  { name: 'getHabitCorrelations', result: { correlations: [{ habitLabel: 'Alcohol', effectSizePercent: 8, lagDays: 1 }] } },
];

const verdict = (text: string) => validateReply(text, RESULTS);

describe('reference grammar', () => {
  it('parses toolName.path with dotted and indexed segments', () => {
    expect(parseReference('getDailyScore.recoveryScore')).toEqual({ tool: 'getDailyScore', path: ['recoveryScore'] });
    expect(parseReference('getDailyScore.factors[0].points')).toEqual({
      tool: 'getDailyScore',
      path: ['factors', 0, 'points'],
    });
    expect(parseReference(' getHabitCorrelations.correlations[10].lagDays ')).toEqual({
      tool: 'getHabitCorrelations',
      path: ['correlations', 10, 'lagDays'],
    });
  });

  it.each(['', 'getDailyScore', 'getDailyScore.', 'getDailyScore..x', '.x', 'getDailyScore.x[', 'getDailyScore.x[-1]', 'a b.c', 'getDailyScore.__proto__'])(
    'rejects malformed reference %j',
    (raw) => {
      expect(parseReference(raw)).toBeNull();
    },
  );

  it('resolves against the latest call of a tool and reports spans', () => {
    const r = resolveReferences('Score {{getDailyScore.recoveryScore}}!', [
      { name: 'getDailyScore', result: { recoveryScore: 10 } },
      { name: 'getDailyScore', result: { recoveryScore: 20 } },
    ]);
    expect(r.text).toBe('Score 20!');
    expect(r.spans).toEqual([[6, 8]]);
    expect(r.invalid).toEqual([]);
  });

  it('never re-parses a resolved value (no template injection through data)', () => {
    const r = resolveReferences('{{getDailyScore.label}}', [{ name: 'getDailyScore', result: { label: '{{getDailyScore.label}}' } }]);
    expect(r.text).toBe('{{getDailyScore.label}}');
    // Leftover braces in the OUTPUT are checked by validateReply, not by re-resolution.
    const v = validateReply('{{getDailyScore.label}}', [{ name: 'getDailyScore', result: { label: '{{getDailyScore.label}}' } }]);
    expect(v.ok).toBe(true);
  });
});

describe('numeric grounding: must ACCEPT', () => {
  it('a fully {{field}}-resolved sentence', () => {
    const v = verdict('Your recovery is {{getDailyScore.recoveryScore}}, {{getDailyScore.direction}} than yesterday.');
    expect(v).toEqual({ ok: true, text: 'Your recovery is 72.4, lower than yesterday.' });
  });

  it('resolves multiple refs incl. negative and indexed values', () => {
    const v = verdict('Delta {{getDailyScore.deltaFromYesterday}}; HRV {{getDailyScore.factors[0].points}} pts; {{getHabitCorrelations.correlations[0].effectSizePercent}}%.');
    expect(v).toEqual({ ok: true, text: 'Delta -3.1; HRV 4.5 pts; 8%.' });
  });

  it('a line-start list marker', () => {
    expect(verdict('Try this:\n1. Sleep earlier tonight.\n2) Skip the late coffee.').ok).toBe(true);
  });

  it('a clock time with am/pm: "10pm"', () => {
    expect(verdict('Try winding down by 10pm.').ok).toBe(true);
  });

  it('"10:30 pm"', () => {
    expect(verdict('Lights out around 10:30 pm works well.').ok).toBe(true);
  });

  it('"7 a.m."', () => {
    expect(verdict('Wake at 7 a.m. consistently.').ok).toBe(true);
  });

  it('a month-name date: "March 14"', () => {
    expect(verdict('Since March 14 things looked better.').ok).toBe(true);
  });

  it('an ordinal date: "the 14th"', () => {
    expect(verdict('Around the 14th you slept well.').ok).toBe(true);
  });
});

describe('numeric grounding: must REJECT as unwrapped_number', () => {
  it.each([
    ['a bare count', 'Here are 3 tips for tonight.'],
    ['a unit-suffixed value (hours)', 'You slept about 8 hours.'],
    ['a unit-suffixed value (ms, no space)', 'Your HRV is 42ms.'],
    ['a unit-suffixed value (bpm)', 'Your heart rate was 62 bpm.'],
    ['a percentage', 'That is a 12% drop.'],
    ['a decimal', 'A score of 7.5 is decent.'],
    ['a ratio', 'You are at 7/10 today.'],
    ['a bare h:mm duration', 'You slept 7:32 last night.'],
    ['a digit that merely resembles an exempt span ("5 amazing tips")', 'Here are 5 amazing tips.'],
    ['a digit adjacent to an exempt span', 'Go to bed at 10pm for 8 hours.'],
    ['a numeric slash date', 'Since 3/14 it improved.'],
    ['a digit inside a list item body', '1. Sleep 8 hours.'],
    ['a non-ASCII digit', 'You slept ٨ hours.'],
    ['a year', 'Back in 2026 it was different.'],
  ])('%s', (_label, text) => {
    expect(verdict(text)).toEqual({ ok: false, reasons: ['unwrapped_number'] });
  });

  it('a digit that follows a resolved span is still scanned', () => {
    expect(verdict('{{getDailyScore.recoveryScore}} and 3 more')).toEqual({ ok: false, reasons: ['unwrapped_number'] });
  });
});

describe('numeric grounding: bad field paths', () => {
  it('a {{ref}} to a path not in this turn\'s results is invalid_field_path (not unwrapped_number)', () => {
    expect(verdict('Your HRV is {{getDailyScore.hrv.deltaFromLastWeek}}.')).toEqual({
      ok: false,
      reasons: ['invalid_field_path'],
    });
  });

  it.each([
    ['a tool that was not called', '{{getScoreHistory.average}}'],
    ['a null value', '{{getDailyScore.sleepScore}}'],
    ['an object value', '{{getDailyScore.factors[0]}}'],
    ['an out-of-range index', '{{getDailyScore.factors[5].points}}'],
    ['a malformed reference', '{{HRV value}}'],
    ['an unterminated reference', 'Your score is {{getDailyScore.recoveryScore'],
    ['a stray closing brace pair', 'Your score is }} here'],
  ])('%s', (_label, text) => {
    expect(verdict(text)).toEqual({ ok: false, reasons: ['invalid_field_path'] });
  });

  it('reports both reasons when both occur', () => {
    const v = verdict('3 tips and {{nope.x}}');
    expect(v).toEqual({ ok: false, reasons: ['invalid_field_path', 'unwrapped_number'] });
  });

  it('rejects an empty reply', () => {
    expect(verdict('   ')).toEqual({ ok: false, reasons: ['empty_reply'] });
  });
});

describe('disclaimer', () => {
  it('is appended by the server and states the not-a-medical-assessment framing', () => {
    const out = withDisclaimer('Hello.');
    expect(out.endsWith(COACH_DISCLAIMER)).toBe(true);
    expect(COACH_DISCLAIMER).toMatch(/comparison against your own recent readings, not a medical assessment/i);
  });
});
