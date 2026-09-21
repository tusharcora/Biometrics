import { useContext } from 'react';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

export const TAB_ORDER = ['Home', 'Activity', 'Coach', 'Metrics', 'Profile'] as const;
export type TabName = (typeof TAB_ORDER)[number];

// The centre slot holds the coach orb instead of an icon.
export const HUB_TAB: TabName = 'Coach';

export const TAB_LABELS: Record<string, string> = {
  Home: 'Home',
  Activity: 'Activity',
  Coach: 'AI coach',
  Metrics: 'Metrics',
  Profile: 'Profile',
};

// About 80 dp so the 64 dp orb fits inside the pill (spec 2.3).
export const FLOATING_BAR_HEIGHT = 80;
export const FLOATING_BAR_MARGIN = 12;

export function slotCenterX(index: number, innerWidth: number, count: number): number {
  return count > 0 ? (index + 0.5) * (innerWidth / count) : 0;
}

// The white circle sits behind the active icon. The hub has the orb instead,
// so the circle hides there (and for any route we do not know).
export function activeCircleTarget(activeRouteName: string): { index: number; visible: boolean } {
  const index = (TAB_ORDER as readonly string[]).indexOf(activeRouteName);
  return { index: Math.max(0, index), visible: index >= 0 && activeRouteName !== HUB_TAB };
}

// How far screen content must be inset from the bottom so the floating bar does
// not cover it. Uses the context directly (not useSafeAreaInsets) so screens
// still render in tests, and anywhere else, without a SafeAreaProvider.
export function useTabBarClearance(): number {
  const insets = useContext(SafeAreaInsetsContext);
  return FLOATING_BAR_HEIGHT + Math.max(insets?.bottom ?? 0, FLOATING_BAR_MARGIN) + 16;
}
