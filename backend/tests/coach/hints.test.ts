import { referenceCopiedValues, suggestReferences } from '../../src/coach/guardrails/hints';
import { validateReply } from '../../src/coach/guardrails/grounding';

const history = {
  name: 'getMetricHistory',
  result: {
    days: 7,
    daysWithData: 4,
    coverageDisplay: '4 of 7',
    trendPercent: -8,
    trendDisplay: 'down 8%',
    averageDisplay: '69 ms',
    highest: { date: '2026-09-17', dateLabel: 'Sep 17', value: 78.1, display: '78.1 ms' },
  },
};
const today = {
  name: 'getTodayMetrics',
  result: { sleep: { value: 270, display: '4h 30m', changeDisplay: '2h 25m less than the night before' } },
};

describe('referenceCopiedValues', () => {
  it('turns exact copies of unit-bearing tool values into references, so the reply validates', () => {
    const raw = 'Your HRV trended down 8% with data on 4 of 7 days; the high was 78.1 ms on Sep 17.';
    const rewritten = referenceCopiedValues(raw, [history]);
    expect(rewritten).toBe(
      'Your HRV trended {{getMetricHistory.trendDisplay}} with data on {{getMetricHistory.coverageDisplay}} days; ' +
        'the high was {{getMetricHistory.highest.display}} on {{getMetricHistory.highest.dateLabel}}.',
    );
    expect(validateReply(rewritten, [history])).toMatchObject({ ok: true, text: raw });
  });

  it('prefers the longest match and leaves existing references alone', () => {
    const raw = 'You slept {{getTodayMetrics.sleep.display}}, 2h 25m less than the night before.';
    expect(referenceCopiedValues(raw, [today])).toBe(
      'You slept {{getTodayMetrics.sleep.display}}, {{getTodayMetrics.sleep.changeDisplay}}.',
    );
  });

  it('never grounds an invented or altered value, or a bare number', () => {
    for (const raw of ['Your HRV trended down 9% this week.', 'Your average was 70 ms.', 'You had 4 good days.']) {
      const verdict = validateReply(referenceCopiedValues(raw, [history]), [history]);
      expect(verdict).toEqual({ ok: false, reasons: ['unwrapped_number'] });
    }
  });
});

describe('suggestReferences', () => {
  it('names the display reference for a copied number, and nothing for an invented one', () => {
    const hints = suggestReferences('It went down 8% on 4 days, and 12 more.', [history]);
    expect(hints).toEqual([
      { literal: '8%', references: ['{{getMetricHistory.trendDisplay}}'] },
      { literal: '4', references: ['{{getMetricHistory.coverageDisplay}}'] },
    ]);
  });

  it('never suggests ISO date fields', () => {
    const hints = suggestReferences('The high was on the 17th.', [history]);
    expect(JSON.stringify(hints)).not.toContain('.date}}');
  });
});
