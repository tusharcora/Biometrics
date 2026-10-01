import type { AnswerCardDTO } from '../../src/api/coach';
import { cardDestination, followUpsFor } from '../../src/lib/coachAnswers';

function card(...factIds: string[]): AnswerCardDTO {
  return {
    headline: 'h',
    tiles: factIds.map((factId) => ({ factId, label: factId, display: '1', value: 1 })),
    source: 's',
  };
}

describe('followUpsFor', () => {
  it('follows the first fact on the card', () => {
    expect(followUpsFor(card('sleep.total', 'recovery.today'))).toEqual(['What would help me sleep better?', "How's my sleep this week?"]);
    expect(followUpsFor(card('recovery.today'))).toEqual(['Should I train today?', 'What moved my recovery?']);
    expect(followUpsFor(card('hrv.today'))).toEqual(['What affects my HRV?', "How's my HRV this week?"]);
    expect(followUpsFor(card('rhr.today'))).toEqual(['Why does my resting heart rate change?', "How's my week looking?"]);
  });

  it('asks how sure a habit finding is, from a ranked card', () => {
    const ranked: AnswerCardDTO = { headline: 'h', ranked: [{ factId: 'habit.caffeine_late', label: 'Caffeine', display: '−8', value: -8 }], source: 's' };
    expect(followUpsFor(ranked)).toEqual(['How sure is that?', 'Which habit should I change first?']);
  });

  it('brings a general answer back to the user, and falls back for an unknown fact', () => {
    expect(followUpsFor(undefined)).toEqual(['How does that apply to me?']);
    expect(followUpsFor(card('goal.steps'))).toEqual(['How does that apply to me?']);
  });

  // The server's fact sheet names the sleep score 'sleep_score.today'.
  it('treats the sleep score fact as sleep', () => {
    expect(followUpsFor(card('sleep_score.today'))).toEqual(['What would help me sleep better?', "How's my sleep this week?"]);
  });
});

describe('cardDestination', () => {
  it('opens the score detail for recovery and sleep, on the given day', () => {
    expect(cardDestination(card('recovery.today'), '2026-09-30')).toEqual({ name: 'ScoreDetail', params: { date: '2026-09-30', type: 'RECOVERY' } });
    expect(cardDestination(card('sleep.total'), '2026-09-30')).toEqual({ name: 'ScoreDetail', params: { date: '2026-09-30', type: 'SLEEP' } });
    expect(cardDestination(card('sleep_score.today'), '2026-09-30')).toEqual({ name: 'ScoreDetail', params: { date: '2026-09-30', type: 'SLEEP' } });
  });

  it('opens Patterns for habits and the Metrics tab for HRV, resting HR and anything else', () => {
    expect(cardDestination(card('habit.walk'), '2026-09-30')).toEqual({ name: 'Patterns', params: undefined });
    expect(cardDestination(card('hrv.today'), '2026-09-30')).toEqual({ name: 'Tabs', params: { screen: 'Metrics' } });
    expect(cardDestination(card('rhr.today'), '2026-09-30')).toEqual({ name: 'Tabs', params: { screen: 'Metrics' } });
    expect(cardDestination(card('goal.steps'), '2026-09-30')).toEqual({ name: 'Tabs', params: { screen: 'Metrics' } });
  });
});
