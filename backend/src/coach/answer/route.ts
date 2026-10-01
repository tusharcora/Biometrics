// Question routing for the answer pipeline (spec 2026-09-30, section 2.1).
// Deterministic and cheap: a handful of keyword groups decide which fact sheet
// the one model call gets. The crisis classifier runs BEFORE this, unchanged.
//
//   general  a health/fitness knowledge question with no personal reference
//   trends   weeks, months, habits, correlations, goals
//   sleep    last night and this week's sleep
//   today    today's scores and readings; also anything ambiguous
//
// A short follow-up with no topic of its own ("why?", "tell me more") inherits
// the previous user question's route, so the fact sheet stays on topic.

export type AnswerRoute = 'today' | 'sleep' | 'trends' | 'general';

const PERSONAL_RE = /\b(my|me|i|i'm|im|i've|i'd|i'll|mine|myself)\b/;
const GENERAL_SHAPE_RE = /^(what|what's|whats|why|how|is|are|does|do|can|could|should|any|tips?|explain|tell me about)\b/;

const HABIT_RE =
  /\b(habits?|caffeine|coffees?|espressos?|teas?|alcohol|drinks?|drinking|drank|beers?|wines?|booze|workouts?|work out|exercis\w*|gym|logged)\b/;
const TRENDS_RE =
  /\b(trend\w*|months?|monthly|weeks|lately|recently|over time|averages?|compare|comparison|progress|goals?|patterns?|correlat\w*|this year|(?:last|past) \d+ days)\b/;
const WEEK_RE = /\b(week|weekly)\b/;
const SLEEP_RE = /\b(sleep\w*|slept|asleep|bed|bedtime|naps?|napping|woke|wake|waking|tired|rested|insomnia|night)\b/;
const TODAY_RE =
  /\b(today|this morning|right now|now|recovery|scores?|hrv|heart|rhr|pulse|steps?|readiness|train\w*|run|running|push|rest day|energy)\b/;

const FOLLOW_UP_MAX_WORDS = 8;

function normalize(message: string): string {
  return message.toLowerCase().replace(/[‘’ʼ]/g, "'").replace(/\s+/g, ' ').trim();
}

function hasTopic(text: string): boolean {
  return [HABIT_RE, TRENDS_RE, WEEK_RE, SLEEP_RE, TODAY_RE].some((re) => re.test(text));
}

export function routeQuestion(message: string, previousUserMessage?: string): AnswerRoute {
  const text = normalize(message);
  const topic = hasTopic(text);

  if (!topic && previousUserMessage !== undefined && text.split(' ').length <= FOLLOW_UP_MAX_WORDS) {
    return routeQuestion(previousUserMessage);
  }
  if (topic && !PERSONAL_RE.test(text) && GENERAL_SHAPE_RE.test(text)) return 'general';
  if (HABIT_RE.test(text) || TRENDS_RE.test(text)) return 'trends';
  if (SLEEP_RE.test(text)) return 'sleep';
  if (WEEK_RE.test(text)) return 'trends';
  return 'today';
}
