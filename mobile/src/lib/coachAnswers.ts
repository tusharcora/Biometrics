import type { AnswerCardDTO } from '../api/coach';
import type { ScoreType } from '../api/scores';

// What surrounds an answer card: the follow-up chips under it and where its
// source line leads. Both key off the fact ids the server put on the card
// ('sleep.total', 'habit.caffeine_late', ...): the part before the dot names
// the area. Fact ids are stable; the card's `source` text is display copy
// and is not keyed on. The stream carries no follow-ups of its own, so they
// are chosen here from that area.

// Fact areas that belong with another: the sleep score is about sleep.
const AREA_ALIASES: Record<string, string> = { sleep_score: 'sleep' };

function firstArea(card: AnswerCardDTO | undefined): string | null {
  const first = card?.tiles?.[0] ?? card?.ranked?.[0];
  if (!first) return null;
  const area = first.factId.split('.')[0]!;
  return AREA_ALIASES[area] ?? area;
}

// Each is sent as a chat message, so each must route as intended on the
// server (backend/src/coach/answer/route.ts; checked in
// backend/tests/coach/answerRoute.test.ts). "How sure is that?" has no topic
// of its own and inherits the habit question it follows.
const FOLLOW_UPS: Record<string, string[]> = {
  sleep: ['What would help me sleep better?', "How's my sleep this week?"],
  recovery: ['Should I train today?', 'What moved my recovery?'],
  hrv: ['What affects my HRV?', "How's my HRV this week?"],
  rhr: ['Why does my resting heart rate change?', "How's my week looking?"],
  habit: ['How sure is that?', 'Which habit should I change first?'],
};

// A general (card-less) answer gets one chip that brings it back to the user.
const GENERAL_FOLLOW_UP = ['How does that apply to me?'];

export function followUpsFor(card: AnswerCardDTO | undefined): string[] {
  const area = firstArea(card);
  return (area && FOLLOW_UPS[area]) || GENERAL_FOLLOW_UP;
}

export type CardDestination =
  | { name: 'ScoreDetail'; params: { date: string; type: ScoreType } }
  | { name: 'Patterns'; params: undefined }
  | { name: 'Tabs'; params: { screen: 'Metrics' } };

// The source line opens the screen that holds the underlying data. HRV and
// resting HR have no stack screen that loads itself (MetricDetail needs the
// series passed in), so they open the Metrics tab.
export function cardDestination(card: AnswerCardDTO, date: string): CardDestination {
  switch (firstArea(card)) {
    case 'recovery':
      return { name: 'ScoreDetail', params: { date, type: 'RECOVERY' } };
    case 'sleep':
      return { name: 'ScoreDetail', params: { date, type: 'SLEEP' } };
    case 'habit':
      return { name: 'Patterns', params: undefined };
    default:
      return { name: 'Tabs', params: { screen: 'Metrics' } };
  }
}
