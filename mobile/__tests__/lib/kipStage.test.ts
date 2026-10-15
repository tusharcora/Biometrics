import { hotTagLabel, kipStage, kipStatusLine, roomLabel, spokenLine, type KipStageInput } from '../../src/lib/kipStage';

const READY: KipStageInput = {
  phase: 'ready', statusUnverified: false, offline: false, waiting: false, streaming: false, error: false, empty: false,
  idle: { pose: 'wave', mood: 'idle' },
};

describe('kipStage (spec §3.4)', () => {
  it.each([
    ['idle: the day\'s pose and mood, no bubble', {}, { id: 'idle', pose: 'wave', mood: 'idle', bubble: null, screen: 'lines' }],
    ['empty / first open', { empty: true }, { id: 'empty', pose: 'wave', mood: 'idle', bubble: 'HI!', screen: 'lines' }],
    ['thinking', { waiting: true, streaming: true }, { id: 'thinking', pose: 'type', mood: 'glance', bubble: 'ON IT…', screen: 'dots' }],
    ['answering', { streaming: true }, { id: 'answering', pose: 'point', mood: 'glance', bubble: "HERE'S MY TAKE", screen: 'chart' }],
    ['error', { error: true }, { id: 'error', pose: 'shrug', mood: 'startled', bubble: 'OOPS', screen: 'lines' }],
    ['offline', { offline: true }, { id: 'offline', pose: 'rest', mood: 'sleepy', bubble: 'Z Z', screen: 'lines' }],
    ['unavailable', { phase: 'unavailable' }, { id: 'unavailable', pose: 'rest', mood: 'sleepy', bubble: null, screen: 'lines' }],
    ['status unverified', { statusUnverified: true }, { id: 'unavailable', pose: 'rest', mood: 'sleepy', bubble: null, screen: 'lines' }],
    ['consent needed', { phase: 'needs-consent' }, { id: 'consent', pose: 'wave', mood: 'curious', bubble: 'MAY I?', screen: 'lines' }],
    ['loading', { phase: 'loading' }, { id: 'loading', pose: 'rest', mood: 'idle', bubble: null, screen: 'lines' }],
  ] as const)('%s', (_label, change, expected) => {
    expect(kipStage({ ...READY, ...change })).toEqual(expected);
  });

  it('a turn in progress wins over offline and errors; offline wins over an old error', () => {
    expect(kipStage({ ...READY, offline: true, waiting: true, streaming: true }).id).toBe('thinking');
    expect(kipStage({ ...READY, offline: true, error: true }).id).toBe('offline');
    expect(kipStage({ ...READY, empty: true, error: true }).id).toBe('error');
  });

  it('uses the HTML-safe apostrophe in "HERE\'S MY TAKE" exactly as the board', () => {
    expect(kipStage({ ...READY, streaming: true }).bubble).toBe("HERE'S MY TAKE");
  });
});

describe('the status line (§3.3)', () => {
  const R = { score: 58, band: 'scoreFair' as const };
  const NONE = { score: null, band: null };
  it.each([
    ['idle', R, false, 'In the pocket room · fair day'],
    ['idle', R, true, 'In the pocket room'],
    ['idle', NONE, false, 'In the pocket room'],
    ['empty', R, false, 'In the pocket room · fair day'],
    ['thinking', R, false, 'Typing it up…'],
    ['thinking', R, true, 'Typing it up…'],
    ['answering', R, false, 'Answering'],
    ['answering', R, true, 'Answering · Recovery 58'],
    ['answering', NONE, true, 'Answering'],
    ['offline', R, false, 'Offline'],
    ['offline', R, true, 'Offline'],
  ] as const)('%s (score %p, collapsed %p): %s', (stage, recovery, collapsed, line) => {
    expect(kipStatusLine(stage, recovery, collapsed)).toBe(line);
  });

  it('is spoken with a comma where it shows a middle dot', () => {
    expect(spokenLine('In the pocket room · fair day')).toBe('In the pocket room, fair day');
    expect(spokenLine('Answering · Recovery 58')).toBe('Answering, Recovery 58');
    expect(spokenLine('Typing it up…')).toBe('Typing it up…');
  });
});

describe('labels', () => {
  it('names the state and the window in the room\'s one label', () => {
    expect(roomLabel('thinking', { weather: 'cloudy', night: false })).toBe('KIP in its room, typing. Window: cloudy');
    expect(roomLabel('idle', { weather: 'fallback', night: true })).toBe('KIP in its room, resting. Window: night');
    for (const id of ['loading', 'empty', 'idle', 'thinking', 'answering', 'error', 'offline', 'unavailable', 'consent'] as const) {
      expect(roomLabel(id, { weather: 'short', night: false })).not.toMatch(/[·−]/);
    }
  });

  it('speaks the hot tag with the score and its Recovery weather, or says there is no reading', () => {
    expect(hotTagLabel({ score: 58, band: 'scoreFair' })).toBe('Recovery 58, cloudy day. Open Recovery');
    expect(hotTagLabel({ score: 90, band: 'scoreExcellent' })).toBe('Recovery 90, clear day. Open Recovery');
    expect(hotTagLabel({ score: 70, band: 'scoreGood' })).toBe('Recovery 70, mostly clear day. Open Recovery');
    expect(hotTagLabel({ score: 20, band: 'scorePoor' })).toBe('Recovery 20, stormy day. Open Recovery');
    expect(hotTagLabel({ score: null, band: null })).toBe('Recovery, no reading yet. Open Recovery');
  });
});
