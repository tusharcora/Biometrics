import { attachmentFrame, frameKey, moodEyes, ATTACHMENT_LOOP_MS } from '../../src/components/characters/attachments/frames';
import { THINKING_ATTACHMENTS } from '../../src/components/characters/thinking';

it.each(THINKING_ATTACHMENTS)('%s draws inside the 36×32 stage, away from the coach body', (id) => {
  for (let t = 0; t < ATTACHMENT_LOOP_MS; t += 50) {
    for (const done of [false, true]) {
      for (const [x, y] of attachmentFrame(id, t, done)) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThan(36);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThan(32);
      }
    }
  }
});

it.each(THINKING_ATTACHMENTS)('%s has a distinct "answer\'s here" frame and animates while thinking', (id) => {
  const keys = new Set(Array.from({ length: 64 }, (_, i) => frameKey(id, i * 50, false)));
  expect(keys.size).toBeGreaterThan(1);
  expect(JSON.stringify(attachmentFrame(id, 0, true))).not.toEqual(JSON.stringify(attachmentFrame(id, 0, false)));
});

it('maps moods to eyes; reduce-motion keeps mood eyes (Review Focus 5)', () => {
  expect(moodEyes('idle', false)).toBe('open');
  expect(moodEyes('idle', true)).toBe('blink');
  expect(moodEyes('thinking', false)).toBe('up');
  expect(moodEyes('answering', true)).toBe('happy');
  expect(moodEyes('resting', false)).toBe('shut');
});
