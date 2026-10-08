import { MESSAGE_TEXT_MAX, STATUS_NOTE_MAX, checkMessageText, checkStatusNote, previewText, sanitiseMessageText } from '../../src/chats/text';
import { BUDDY_ERROR_STATUS } from '../../src/buddies/errors';

// Built at run time so no editor or tool can turn the lone surrogate into other bytes.
const LONE_SURROGATE = String.fromCharCode(0xd800);

it('keeps newlines, turns CR/CRLF and the Unicode separators into \\n, strips every other control and format character', () => {
  expect(sanitiseMessageText('a\r\nb\rc\u2028d\u2029e')).toBe('a\nb\nc\nd\ne');
  expect(sanitiseMessageText('a\tb\u0000c\u200Bd\u202Ee')).toBe('abcde');
  expect(sanitiseMessageText('one\n\n\n\n\ntwo')).toBe('one\n\ntwo');
  expect(sanitiseMessageText('  \n hi \n  ')).toBe('hi');
  expect(sanitiseMessageText('e\u0301')).toBe('\u00E9');
  // A variation selector stays: the heart keeps its emoji form.
  expect(sanitiseMessageText('\u2764\uFE0F')).toBe('\u2764\uFE0F');
});

it('accepts 1-1000 code points with something visible, and refuses everything else', () => {
  expect(checkMessageText(' rough night lol ')).toBe('rough night lol');
  expect(checkMessageText('x'.repeat(MESSAGE_TEXT_MAX))).toHaveLength(1000);
  expect(checkMessageText('x'.repeat(MESSAGE_TEXT_MAX + 1))).toBeNull();
  expect(checkMessageText('🔥'.repeat(1000))).toBe('🔥'.repeat(1000)); // code points, not UTF-16 units
  expect(checkMessageText('🔥'.repeat(1001))).toBeNull();
  for (const bad of ['', '   ', '\n\n', '\u200B\u200D', '\u2800', 42, null, undefined, ['hi'], { text: 'hi' }, `hi${LONE_SURROGATE}`]) {
    expect([bad, checkMessageText(bad)]).toEqual([bad, null]);
  }
});

it('sanitises a Chats note like a camp note (no newlines) and allows 1-60 code points', () => {
  expect(checkStatusNote(' early\nnight ')).toBe('earlynight');
  expect(checkStatusNote('x'.repeat(STATUS_NOTE_MAX))).toHaveLength(60);
  expect(checkStatusNote('x'.repeat(61))).toBeNull();
  expect(checkStatusNote('admin says hi')).toBe('admin says hi');
  for (const bad of ['', '  ', '\u200B', 7, `${LONE_SURROGATE}hi`]) expect(checkStatusNote(bad)).toBeNull();
});

it('previews a text on one line of at most 80 code points, ending with an ellipsis when cut', () => {
  expect(previewText('rough night\nlol')).toBe('rough night lol');
  expect(previewText('x'.repeat(80))).toBe('x'.repeat(80));
  expect(previewText(`${'x'.repeat(79)} yz`)).toBe(`${'x'.repeat(79)}…`);
  expect(previewText('🔥'.repeat(81))).toBe(`${'🔥'.repeat(80)}…`);
  expect(previewText('abcdef', 3)).toBe('abc…');
});

it('has the S3 error codes', () => {
  expect(BUDDY_ERROR_STATUS).toMatchObject({
    invalid_message: 400, message_gone: 404, invalid_reaction: 400, card_unavailable: 409,
    invalid_status_note: 400, invalid_report: 400, report_target_gone: 404,
  });
});
