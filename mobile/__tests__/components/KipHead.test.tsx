import React from 'react';
import { render } from '@testing-library/react-native';
import { KipHead, kipHeadRects } from '../../src/components/kip/KipHead';
import { Rect } from 'react-native-svg';
import { KIP_GRID, kipArt } from '../../src/lib/kip/kipArt';
import { resetMyKip, setMyKipWorn } from '../../src/lib/kip/myKip';

afterEach(() => resetMyKip());

it('keeps only the rows above the legs (0–9) of the 16-wide grid', () => {
  const rects = kipHeadRects({ colour: 'cobalt', mood: 'sleepy' });
  expect(rects.length).toBeGreaterThan(0);
  for (const r of rects) expect(r.y).toBeLessThan(10);
  expect(rects).toEqual(kipArt({ colour: 'cobalt', mood: 'sleepy' }).filter((r) => r.y < 10));
});

it('is 64 × 40 at scale 4 and 32 × 20 at the default scale 2, hidden from screen readers', () => {
  const big = render(<KipHead testID="h" scale={4} />);
  expect(big.getByTestId('h', { includeHiddenElements: true }).props.style).toEqual({ width: 64, height: 40 });
  const small = render(<KipHead testID="h" />);
  const view = small.getByTestId('h', { includeHiddenElements: true });
  expect(view.props.style).toEqual({ width: KIP_GRID * 2, height: 20 });
  expect(view.props.accessibilityElementsHidden).toBe(true);
});

it('draws your head pieces, and skips face pieces at head size', () => {
  setMyKipWorn({ head: 'out.cap', face: 'out.round' });
  const fills = render(<KipHead />).UNSAFE_getAllByType(Rect).map((r) => r.props.fill);
  expect(fills).toContain('#2563EB');
  expect(fills).not.toContain('#FCD34D');
});
