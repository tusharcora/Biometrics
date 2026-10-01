import { routeQuestion } from '../../src/coach/answer/route';

describe('routeQuestion', () => {
  it.each([
    // today: today's scores and readings, and "should I train" questions
    ['How am I doing today?', 'today'],
    ['Why is my recovery so low?', 'today'],
    ['What is my HRV this morning?', 'today'],
    ['Is my resting heart rate ok?', 'today'],
    ['Should I train hard today?', 'today'],
    ['How many steps have I done?', 'today'],
    // sleep: last night and this week's sleep
    ['How did I sleep?', 'sleep'],
    ['Why did I wake up so tired?', 'sleep'],
    ['What time should I go to bed tonight?', 'sleep'],
    ['How has my sleep been this week?', 'sleep'],
    ['Was my nap too long?', 'sleep'],
    // trends: weeks, months, habits, correlations, goals
    ['How has my HRV trended this month?', 'trends'],
    ['Does caffeine affect my recovery?', 'trends'],
    ['What habits hurt my scores?', 'trends'],
    ['How was my week?', 'trends'],
    ['Am I making progress on my goals?', 'trends'],
    ['Compare my sleep over the last 30 days', 'trends'],
    ['Did drinking last night change anything for me?', 'trends'],
    // general: health/fitness knowledge, no personal reference
    ['What is HRV?', 'general'],
    ['How much sleep do adults need?', 'general'],
    ['Why does alcohol affect sleep?', 'general'],
    ['Any tips for falling asleep faster?', 'general'],
    ['What does resting heart rate tell you?', 'general'],
    ['Is a cold shower good after a workout?', 'general'],
  ] as const)('%s -> %s', (message, route) => {
    expect(routeQuestion(message)).toBe(route);
  });

  it('routes an ambiguous personal question to today', () => {
    expect(routeQuestion('Talk to me')).toBe('today');
    expect(routeQuestion('hello')).toBe('today');
  });

  it('a short follow-up with no topic of its own inherits the previous question\'s route', () => {
    expect(routeQuestion('why?', 'How did I sleep?')).toBe('sleep');
    expect(routeQuestion('and what should I do about it?', 'Does caffeine affect my recovery?')).toBe('trends');
    expect(routeQuestion('tell me more', 'What is HRV?')).toBe('general');
  });

  it('a follow-up that names its own topic is routed on its own', () => {
    expect(routeQuestion('what about my sleep?', 'Does caffeine affect my recovery?')).toBe('sleep');
    expect(routeQuestion('and my HRV today?', 'How did I sleep?')).toBe('today');
  });

  it('a short follow-up without a previous question is ambiguous, so today', () => {
    expect(routeQuestion('why?')).toBe('today');
  });

  it('is case- and apostrophe-insensitive', () => {
    expect(routeQuestion('HOW DID I SLEEP')).toBe('sleep');
    expect(routeQuestion('What’s HRV?')).toBe('general');
  });
});
