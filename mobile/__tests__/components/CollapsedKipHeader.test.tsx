import { COLLAPSED_HEIGHT, COLLAPSED_ROW_HEIGHT, FADE_PT, collapseProgress } from '../../src/components/coach/CollapsedKipHeader';

it('the collapsed header is 60 points, its row 72, and the fade 24 points', () => {
  expect([COLLAPSED_HEIGHT, COLLAPSED_ROW_HEIGHT, FADE_PT]).toEqual([60, 72, 24]);
});

it('pinned over the scroll (60 points covered): 0 → 1 over the 24 points before the card\'s bottom passes under it', () => {
  expect(collapseProgress(228, 312)).toBe(0);
  expect(collapseProgress(240, 312)).toBe(0.5);
  expect(collapseProgress(252, 312)).toBe(1);
  expect(collapseProgress(900, 312)).toBe(1);
});

it('pinned over a header above the scroll: only the measured overlap counts', () => {
  // The 72-point row over a 60-point expanded header reaches 12 points over the scroll.
  expect(collapseProgress(276, 312, 12)).toBe(0);
  expect(collapseProgress(288, 312, 12)).toBe(0.5);
  expect(collapseProgress(300, 312, 12)).toBe(1);
});

it('a header taller than the row covers nothing: the fade ends as the card leaves the scroll\'s top', () => {
  expect(collapseProgress(312, 312, -8)).toBe(1);
  expect(collapseProgress(300, 312, -8)).toBe(0.5);
});
