import React from 'react';
import { renderHook } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  TAB_ORDER,
  HUB_TAB,
  FLOATING_BAR_HEIGHT,
  FLOATING_BAR_MARGIN,
  activeCircleTarget,
  slotCenterX,
  useTabBarClearance,
} from '../../src/navigation/tabBarLayout';

describe('tab order', () => {
  it('puts the coach in the centre of five slots', () => {
    expect(TAB_ORDER).toEqual(['Home', 'Activity', 'Coach', 'Metrics', 'Profile']);
    expect(TAB_ORDER.indexOf(HUB_TAB)).toBe(2);
  });
});

describe('slotCenterX', () => {
  it('returns the centre of each equal-width slot', () => {
    expect(slotCenterX(0, 500, 5)).toBe(50);
    expect(slotCenterX(2, 500, 5)).toBe(250);
    expect(slotCenterX(4, 500, 5)).toBe(450);
  });

  it('is 0 with no slots', () => {
    expect(slotCenterX(0, 500, 0)).toBe(0);
  });
});

describe('activeCircleTarget', () => {
  it('shows the circle on an icon tab', () => {
    expect(activeCircleTarget('Metrics')).toEqual({ index: 3, visible: true });
  });

  it('hides the circle on the coach tab, which has the orb instead', () => {
    expect(activeCircleTarget('Coach')).toEqual({ index: 2, visible: false });
  });

  it('hides the circle for an unknown route', () => {
    expect(activeCircleTarget('Nope')).toEqual({ index: 0, visible: false });
  });
});

describe('useTabBarClearance', () => {
  it('adds the bottom safe-area inset', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } }}>
        {children}
      </SafeAreaProvider>
    );
    const { result } = renderHook(() => useTabBarClearance(), { wrapper });
    expect(result.current).toBe(FLOATING_BAR_HEIGHT + 34 + 16);
  });

  it('falls back to the bar margin when there is no provider', () => {
    const { result } = renderHook(() => useTabBarClearance());
    expect(result.current).toBe(FLOATING_BAR_HEIGHT + FLOATING_BAR_MARGIN + 16);
  });
});
