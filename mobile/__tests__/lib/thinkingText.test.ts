import {
  DEFAULT_THINKING_TEXT, THINKING_TEXT_NAMES, THINKING_TEXTS, isThinkingText, resolveThinkingText,
} from '../../src/lib/thinkingText';

it('keeps five text styles, steps first by default', () => {
  expect(THINKING_TEXTS).toEqual(['lines', 'placeholder', 'typewriter', 'steps', 'shimmer']);
  expect(DEFAULT_THINKING_TEXT).toBe('steps');
  expect(Object.keys(THINKING_TEXT_NAMES).sort()).toEqual([...THINKING_TEXTS].sort());
});

it('resolves the five kept ids to themselves', () => {
  for (const id of THINKING_TEXTS) expect(resolveThinkingText(id)).toBe(id);
});

it.each(['tag', 'nameplate', 'bouncy', 'dialog', 'strip'])('maps the retired %s to steps', (id) => {
  expect(isThinkingText(id)).toBe(false);
  expect(resolveThinkingText(id)).toBe('steps');
});

it('reads anything else as the default', () => {
  for (const v of [null, undefined, '', 'wiggle', 3]) expect(resolveThinkingText(v)).toBe('steps');
});

it('describes the shimmer truly: it may wash to the foreground when the KIP colour does not read', () => {
  expect(THINKING_TEXT_NAMES.shimmer.blurb).toBe('A soft shimmer while KIP types, with a timer.');
});

it('names KIP in the blurbs, never "your coach"', () => {
  for (const { name, blurb } of Object.values(THINKING_TEXT_NAMES)) expect(`${name} ${blurb}`).not.toMatch(/coach/i);
});
