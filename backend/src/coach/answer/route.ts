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

// First-person words, plus time and collective words that only make sense about
// the user's own data ("How's recovery today?", "How was last night?").
const PERSONAL_RE =
  /\b(my|me|i|i'm|im|i've|i'd|i'll|mine|myself|we|us|our|today|tonight|yesterday|this morning|last night|this week)\b/;
// Imperatives that contain "me" without being about the user ("tell me more").
const IMPERATIVE_ME_RE = /\b(tell|show|give|explain to) me\b/g;
const GENERAL_SHAPE_RE = /^(what|what's|whats|why|how|is|are|does|do|can|could|should|any|tips?|explain|tell me about)\b/;

const HABIT_RE =
  /\b(habits?|caffeine|coffees?|espressos?|teas?|alcohol|drinks?|drinking|drank|beers?|wines?|booze|workouts?|work out|exercis\w*|gym|logged)\b/;
const TRENDS_RE =
  /\b(trend\w*|months?|monthly|weeks|lately|recently|over time|averages?|compare|comparison|progress|goals?|patterns?|correlat\w*|this year|(?:last|past) \d+ days)\b/;
const WEEK_RE = /\b(week|weekly)\b/;
const SLEEP_RE = /\b(sleep\w*|slept|asleep|bed|bedtime|naps?|napping|woke|wake|waking|tired|rested|insomnia|night)\b/;
// Sleep words that are about sleep on their own; "night" and "tired" are not.
const STRONG_SLEEP_RE = /\b(sleep\w*|slept|asleep|bed|bedtime|naps?|napping|woke|wake|waking|rested|insomnia)\b/;
// Today's metrics, which beat a sleep match resting only on "night"/"tired".
const TODAY_METRIC_RE = /\b(recovery|hrv|heart rate|rhr|train\w*|workouts?)\b/;
const TODAY_RE =
  /\b(today|this morning|right now|now|recovery|scores?|hrv|heart|rhr|pulse|steps?|readiness|train\w*|run|running|push|rest day|energy)\b/;

const FOLLOW_UP_MAX_WORDS = 8;

function normalize(message: string): string {
  return message.toLowerCase().replace(/[‘’ʼ]/g, "'").replace(/\s+/g, ' ').trim();
}

function hasTopic(text: string): boolean {
  return [HABIT_RE, TRENDS_RE, WEEK_RE, SLEEP_RE, TODAY_RE].some((re) => re.test(text));
}

function isPersonal(text: string): boolean {
  return PERSONAL_RE.test(text.replace(IMPERATIVE_ME_RE, ' '));
}

// Route by topic alone, treating the question as personal.
function topicRoute(text: string): Exclude<AnswerRoute, 'general'> {
  if (HABIT_RE.test(text) || TRENDS_RE.test(text)) return 'trends';
  if (STRONG_SLEEP_RE.test(text) || (SLEEP_RE.test(text) && !TODAY_METRIC_RE.test(text))) return 'sleep';
  if (WEEK_RE.test(text)) return 'trends';
  return 'today';
}

export function routeQuestion(message: string, previousUserMessage?: string): AnswerRoute {
  const text = normalize(message);
  const topic = hasTopic(text);

  if (!topic && previousUserMessage !== undefined && text.split(' ').length <= FOLLOW_UP_MAX_WORDS) {
    const inherited = routeQuestion(previousUserMessage);
    // "and what is mine?" after "What is HRV?" asks about the user's own data.
    if (inherited === 'general' && isPersonal(text)) return topicRoute(normalize(previousUserMessage));
    return inherited;
  }
  if (topic && !isPersonal(text) && GENERAL_SHAPE_RE.test(text)) return 'general';
  return topicRoute(text);
}
