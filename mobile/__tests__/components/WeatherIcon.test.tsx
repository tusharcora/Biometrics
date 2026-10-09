import React from 'react';
import { render } from '@testing-library/react-native';
import { Rect } from 'react-native-svg';
import { WeatherIcon } from '../../src/components/recovery/WeatherIcon';
import { HERO_ART, SMALL_ART } from '../../src/lib/weatherArt';

const KINDS = ['clear', 'mostlyClear', 'cloudy', 'stormy', 'building', 'none'] as const;

describe('WeatherIcon', () => {
  it.each(KINDS)('draws one Rect per pixel run for %s (hero and small), crisp, hidden from a11y', (kind) => {
    for (const variant of ['hero', 'small'] as const) {
      const { getByTestId, UNSAFE_getAllByType, unmount } = render(<WeatherIcon kind={kind} variant={variant} testID="w" />);
      const art = variant === 'hero' ? HERO_ART[kind] : SMALL_ART[kind];
      expect(UNSAFE_getAllByType(Rect)).toHaveLength(art.length);
      // The icon is hidden from a11y, so RNTL only reaches it with includeHiddenElements.
      const root = getByTestId('w', { includeHiddenElements: true });
      expect(root.props.accessible).toBe(false);
      expect(root.props.importantForAccessibility).toBe('no-hide-descendants');
      unmount();
    }
  });
  it('every rect fits its grid', () => {
    for (const k of KINDS) {
      for (const r of HERO_ART[k]) expect(r.x + r.w <= 28 && r.y + r.h <= 20).toBe(true);
      for (const r of SMALL_ART[k]) expect(r.x + r.w <= 11 && r.y + r.h <= 11).toBe(true);
    }
  });
  it('the cloudy art has no rain: only greys', () => {
    expect(HERO_ART.cloudy.every((r) => /^#(9CA3AF|D1D5DB|E5E7EB|F3F4F6)$/.test(r.fill))).toBe(true);
    expect(SMALL_ART.cloudy.every((r) => r.fill === '#9CA3AF')).toBe(true);
  });
});
