// The share card's words and size (spec 2026-10-15 §10.5; P4 ruling 23).
import { SHARE_PIXELS, firstNameOf, shareLines, shareSize } from '../../src/lib/room/shareCard';

it('is 1080 px wide on any screen', () => {
  expect(SHARE_PIXELS).toBe(1080);
  expect(shareSize(3)).toEqual({ width: 360, height: 450 });
  expect(shareSize(2).width * 2).toBe(1080);
});

it('says the size and pieces, the theme week while one is live, and the first name only when asked', () => {
  const base = { size: { n: 8, m: 8 }, pieces: 31, themeTitle: 'Cosy autumn', name: 'Maya Lee' };
  expect(shareLines({ ...base, showName: false })).toEqual({
    title: "KIP's room", meta: '8 × 8 · 31 pieces · Cosy autumn week', metaSpoken: '8 by 8, 31 pieces, Cosy autumn week', byline: null,
  });
  expect(shareLines({ ...base, showName: true }).byline).toBe("Maya's room");
  expect(shareLines({ ...base, themeTitle: null, showName: true, name: null }).meta).toBe('8 × 8 · 31 pieces');
  expect(shareLines({ ...base, themeTitle: null, showName: true, name: null }).byline).toBeNull();
  expect([firstNameOf('  Maya Lee '), firstNameOf(''), firstNameOf(null)]).toEqual(['Maya', null, null]);
});

it('never reads "·" or "×" aloud (PF4-F15)', () => {
  const lines = shareLines({ size: { n: 8, m: 8 }, pieces: 31, themeTitle: 'Cosy autumn', name: 'Maya', showName: true });
  expect(lines.metaSpoken).not.toMatch(/·|×|−/);
});
