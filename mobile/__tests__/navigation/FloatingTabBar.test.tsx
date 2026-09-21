import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { FloatingTabBar } from '../../src/navigation/FloatingTabBar';
import { TAB_ORDER } from '../../src/navigation/tabBarLayout';
import { DIMMED_OPACITY } from '../../src/components/orb/Orb';
import { useCoachStatus } from '../../src/lib/useCoachStatus';
import { useKeyboardVisible } from '../../src/lib/useKeyboardVisible';

let mockScheme: 'light' | 'dark' = 'dark';
jest.mock('nativewind', () => ({ useColorScheme: () => ({ colorScheme: mockScheme }) }));
jest.mock('../../src/lib/useCoachStatus', () => ({ useCoachStatus: jest.fn() }));
jest.mock('../../src/lib/useKeyboardVisible', () => ({ useKeyboardVisible: jest.fn() }));

const METRICS = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
// The bar is hidden from the accessibility tree while the keyboard is open, so
// queries for it must opt in to hidden elements.
const HIDDEN_OK = { includeHiddenElements: true };
const enabledStatus = { enabled: true, consented: true, consent: { version: 'v1', summary: 's', dataItems: [] }, personaId: 'p', personas: [] };
const refresh = jest.fn();

function setCoach(status: unknown) {
  (useCoachStatus as jest.Mock).mockReturnValue({ status, setStatus: jest.fn(), refresh });
}

function makeProps(index = 0, preventDefault = false) {
  const routes = TAB_ORDER.map((name) => ({ key: `${name}-key`, name, params: undefined }));
  const navigation = { emit: jest.fn(() => ({ defaultPrevented: preventDefault })), navigate: jest.fn() };
  return { state: { index, routes }, navigation, descriptors: {}, insets: METRICS.insets } as never;
}

function bar(props: ReturnType<typeof makeProps>) {
  return (
    <SafeAreaProvider initialMetrics={METRICS}>
      <FloatingTabBar {...(props as object as React.ComponentProps<typeof FloatingTabBar>)} />
    </SafeAreaProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockScheme = 'dark';
  (useKeyboardVisible as jest.Mock).mockReturnValue(false);
  setCoach(enabledStatus);
});

describe('FloatingTabBar', () => {
  it('renders five labelled tabs, with the coach orb in the middle', () => {
    const { getByLabelText, getByTestId } = render(bar(makeProps()));

    for (const label of ['Home', 'Activity', 'AI coach', 'Metrics', 'Profile']) expect(getByLabelText(label)).toBeTruthy();
    expect(getByTestId('tab-Coach')).toContainElement(getByTestId('hub-orb'));
  });

  it('marks only the focused tab selected', () => {
    const { getByTestId } = render(bar(makeProps(3)));

    expect(getByTestId('tab-Metrics').props.accessibilityState).toEqual({ selected: true });
    expect(getByTestId('tab-Home').props.accessibilityState).toEqual({ selected: false });
  });

  it('emits tabPress and navigates when an unfocused tab is pressed', () => {
    const props = makeProps(0);
    const { getByTestId } = render(bar(props));

    fireEvent.press(getByTestId('tab-Activity'));

    const navigation = (props as unknown as { navigation: { emit: jest.Mock; navigate: jest.Mock } }).navigation;
    expect(navigation.emit).toHaveBeenCalledWith({ type: 'tabPress', target: 'Activity-key', canPreventDefault: true });
    expect(navigation.navigate).toHaveBeenCalledWith('Activity', undefined);
  });

  it('does not navigate when the focused tab is pressed again', () => {
    const props = makeProps(1);
    const { getByTestId } = render(bar(props));

    fireEvent.press(getByTestId('tab-Activity'));

    expect((props as unknown as { navigation: { navigate: jest.Mock } }).navigation.navigate).not.toHaveBeenCalled();
  });

  it('does not navigate when a listener prevents the default', () => {
    const props = makeProps(0, true);
    const { getByTestId } = render(bar(props));

    fireEvent.press(getByTestId('tab-Metrics'));

    expect((props as unknown as { navigation: { navigate: jest.Mock } }).navigation.navigate).not.toHaveBeenCalled();
  });

  it('opens the Coach tab from the hub even when the coach is disabled', () => {
    setCoach({ ...enabledStatus, enabled: false });
    const props = makeProps(0);
    const { getByTestId } = render(bar(props));

    fireEvent.press(getByTestId('tab-Coach'));

    expect((props as unknown as { navigation: { navigate: jest.Mock } }).navigation.navigate).toHaveBeenCalledWith('Coach', undefined);
  });

  describe('hub orb', () => {
    it('is dim, paused and shaping when the status is unknown', () => {
      setCoach(null);
      const { getByTestId } = render(bar(makeProps(0)));

      expect(getByTestId('thinking-orb').props.accessibilityLabel).toBe('shaping:64:paused:dark');
      expect(getByTestId('hub-orb')).toHaveStyle({ opacity: DIMMED_OPACITY });
    });

    it('is dim, paused and shaping when the coach is disabled', () => {
      setCoach({ ...enabledStatus, enabled: false });
      const { getByTestId } = render(bar(makeProps(2)));

      expect(getByTestId('thinking-orb').props.accessibilityLabel).toBe('shaping:64:paused:dark');
    });

    it('breathes, dimmed, while another tab is active', () => {
      const { getByTestId } = render(bar(makeProps(0)));

      expect(getByTestId('thinking-orb').props.accessibilityLabel).toBe('breathing:64:playing:dark');
      expect(getByTestId('hub-orb')).toHaveStyle({ opacity: DIMMED_OPACITY });
    });

    it('keeps the light-dotted ink on the always-dark pill when the app theme is light', () => {
      mockScheme = 'light';
      const { getByTestId } = render(bar(makeProps(0)));

      expect(getByTestId('thinking-orb').props.accessibilityLabel).toBe('breathing:64:playing:dark');
    });

    it('breathes at full brightness on the Coach tab', () => {
      const { getByTestId } = render(bar(makeProps(2)));

      expect(getByTestId('hub-orb')).toHaveStyle({ opacity: 1 });
    });
  });

  it('refreshes the coach status when the focused tab changes, not on first render', () => {
    const { rerender } = render(bar(makeProps(0)));
    expect(refresh).not.toHaveBeenCalled();

    rerender(bar(makeProps(1)));

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('stops taking touches while the keyboard is open', () => {
    (useKeyboardVisible as jest.Mock).mockReturnValue(true);
    const { getByTestId } = render(bar(makeProps(0)));

    expect(getByTestId('floating-tab-bar', HIDDEN_OK).props.pointerEvents).toBe('none');
  });

  it('hides the bar from screen readers while the keyboard is open', () => {
    (useKeyboardVisible as jest.Mock).mockReturnValue(true);
    const { getByTestId } = render(bar(makeProps(0)));

    expect(getByTestId('floating-tab-bar', HIDDEN_OK).props.accessibilityElementsHidden).toBe(true);
    expect(getByTestId('floating-tab-bar', HIDDEN_OK).props.importantForAccessibility).toBe('no-hide-descendants');
  });

  it('keeps the bar in the accessibility tree while the keyboard is closed', () => {
    const { getByTestId } = render(bar(makeProps(0)));

    expect(getByTestId('floating-tab-bar').props.accessibilityElementsHidden).toBe(false);
    expect(getByTestId('floating-tab-bar').props.importantForAccessibility).toBe('auto');
  });
});
