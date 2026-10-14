import React from 'react';
import { act, render, fireEvent, screen, within } from '@testing-library/react-native';
import { fetchRecaps } from '../../src/api/recaps';
import { storyRingColor } from '../../src/lib/recapTheme';
import { openRecap } from '../../src/lib/unwatchedRecap';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { FloatingTabBar } from '../../src/navigation/FloatingTabBar';
import { Rect } from 'react-native-svg';
import { TAB_LABELS, TAB_ORDER } from '../../src/navigation/tabBarLayout';
import { HUB_DIMMED_OPACITY } from '../../src/navigation/FloatingTabBar';
import { setMyKipColour, resetMyKip } from '../../src/lib/kip/myKip';
import { KIP_COLOURS, kipArt } from '../../src/lib/kip/kipArt';
import { useCoachStatus } from '../../src/lib/useCoachStatus';
import { useKeyboardVisible } from '../../src/lib/useKeyboardVisible';

let mockScheme: 'light' | 'dark' = 'dark';
jest.mock('nativewind', () => ({ useColorScheme: () => ({ colorScheme: mockScheme }) }));
jest.mock('../../src/lib/useCoachStatus', () => ({ useCoachStatus: jest.fn() }));
jest.mock('../../src/lib/useKeyboardVisible', () => ({ useKeyboardVisible: jest.fn() }));
jest.mock('../../src/api/recaps', () => ({ fetchRecaps: jest.fn(), markRecapOpened: jest.fn() }));
let mockUnread = 0;
jest.mock('../../src/lib/socialStore', () => ({ useSocialUnreadCount: () => mockUnread }));

const METRICS = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
// The bar is hidden from the accessibility tree while the keyboard is open, so
// queries for it must opt in to hidden elements.
const HIDDEN_OK = { includeHiddenElements: true };
const enabledStatus = {
  enabled: true,
  consented: true,
  consent: { version: 'v1', summary: 's', dataItems: [] },
  personaId: 'mochi',
  personaChosen: true,
  personas: [],
};
const refresh = jest.fn();

function setCoach(status: unknown) {
  (useCoachStatus as jest.Mock).mockReturnValue({ status, setStatus: jest.fn(), refresh });
}

// The hub KIP's drawn fills, and the opacity it is drawn at (every opacity between
// the hub-character view and the tab, multiplied).
function hub(utils: ReturnType<typeof render>) {
  const kip = utils.getByTestId('hub-character', HIDDEN_OK);
  const tab = utils.getByTestId('tab-Coach', HIDDEN_OK);
  let opacity = 1;
  for (let node: typeof kip | null = kip; node && node !== tab; node = node.parent) {
    // Host views only: a composite View passes the same style to its host.
    const style = typeof node.type === 'string' ? StyleSheet.flatten(node.props.style) : null;
    if (style && typeof style.opacity === 'number') opacity *= style.opacity;
  }
  const fills = within(kip).UNSAFE_getAllByType(Rect).map((r) => r.props.fill as string);
  return { fills, opacity };
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
  mockUnread = 0;
  (useKeyboardVisible as jest.Mock).mockReturnValue(false);
  (fetchRecaps as jest.Mock).mockResolvedValue([]);
  setCoach(enabledStatus);
});

afterEach(() => resetMyKip());

describe('FloatingTabBar: story ring on the Profile tab', () => {
  const week = { id: 'w1', kind: 'WEEK', periodStart: '2026-09-28', periodEnd: '2026-10-04', line: 'A week.', personaId: 'luna', builtAt: '2026-10-05T09:00:00.000Z', openedAt: null };

  it.each(['dark', 'light'] as const)("rings the Profile icon in your KIP's colour (%s), whatever coach the recap names, says so, and still opens Profile", async (scheme) => {
    mockScheme = scheme;
    setMyKipColour('lime');
    (fetchRecaps as jest.Mock).mockResolvedValue([week]);
    const props = makeProps(0);
    const utils = render(bar(props));
    await act(async () => {});
    expect(StyleSheet.flatten(utils.getByTestId('tab-Profile-story-ring').props.style)).toMatchObject({ borderColor: storyRingColor('lime', scheme) });
    expect(StyleSheet.flatten(utils.getByTestId('tab-Profile-story-ring-dot').props.style)).toMatchObject({ backgroundColor: storyRingColor('lime', scheme) });
    // The tab opens Profile, so it only says what is ready.
    expect(utils.getByTestId('tab-Profile').props.accessibilityLabel).toBe('Profile. Your week is ready');
    fireEvent.press(utils.getByTestId('tab-Profile'));
    expect((props as unknown as { navigation: { navigate: jest.Mock } }).navigation.navigate).toHaveBeenCalledWith('Profile', undefined);
  });

  it('clears the moment the recap is opened anywhere', async () => {
    (fetchRecaps as jest.Mock).mockResolvedValue([week]);
    const utils = render(bar(makeProps(0)));
    await act(async () => {});
    expect(utils.getByTestId('tab-Profile-story-ring')).toBeTruthy();
    await act(async () => openRecap('w1'));
    expect(utils.queryByTestId('tab-Profile-story-ring')).toBeNull();
    expect(utils.getByTestId('tab-Profile').props.accessibilityLabel).toBe('Profile');
  });

  it('has no ring without an unwatched recap', async () => {
    const utils = render(bar(makeProps(0)));
    await act(async () => {});
    expect(utils.queryByTestId('tab-Profile-story-ring')).toBeNull();
  });
});

describe('FloatingTabBar', () => {
  it('renders five labelled tabs, with KIP in the middle', () => {
    const { getByLabelText, getByTestId } = render(bar(makeProps()));

    for (const label of ['Home', 'Activity', 'KIP', 'Social', 'Profile']) expect(getByLabelText(label)).toBeTruthy();
    expect(getByTestId('tab-Coach')).toContainElement(getByTestId('hub-character', HIDDEN_OK));
  });

  it('labels only the focused tab, under its icon', () => {
    const { getByTestId, queryByTestId } = render(bar(makeProps(1)));

    expect(getByTestId('tab-label-Activity')).toHaveTextContent('Activity');
    for (const name of ['Home', 'Social', 'Profile']) expect(queryByTestId(`tab-label-${name}`)).toBeNull();
  });

  it('shows a dot on Social when something is unread, and says how many; hides it otherwise', async () => {
    mockUnread = 3;
    const utils = render(bar(makeProps()));
    await act(async () => {});
    expect(screen.getByTestId('tab-Social-dot')).toHaveStyle({ width: 8, height: 8 });
    expect(screen.getByTestId('tab-Social')).toHaveProp('accessibilityLabel', 'Social, 3 new');
    mockUnread = 0;
    utils.rerender(bar(makeProps()));
    expect(screen.queryByTestId('tab-Social-dot')).toBeNull();
    expect(screen.getByTestId('tab-Social')).toHaveProp('accessibilityLabel', 'Social');
  });

  it('is a solid rounded rectangle, not a pill', () => {
    const { getByTestId } = render(bar(makeProps()));

    const surface = StyleSheet.flatten(getByTestId('floating-tab-bar-surface').props.style);
    expect(surface.height).toBe(62);
    expect(surface.borderRadius).toBe(18);
  });

  it('marks only the focused tab selected', () => {
    const { getByTestId } = render(bar(makeProps(3)));

    expect(getByTestId('tab-Social').props.accessibilityState).toEqual({ selected: true });
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

    fireEvent.press(getByTestId('tab-Social'));

    expect((props as unknown as { navigation: { navigate: jest.Mock } }).navigation.navigate).not.toHaveBeenCalled();
  });

  it('opens the Coach tab from the hub even when the coach is disabled', () => {
    setCoach({ ...enabledStatus, enabled: false });
    const props = makeProps(0);
    const { getByTestId } = render(bar(props));

    fireEvent.press(getByTestId('tab-Coach'));

    expect((props as unknown as { navigation: { navigate: jest.Mock } }).navigation.navigate).toHaveBeenCalledWith('Coach', undefined);
  });

  describe('hub KIP', () => {
    const resting = kipArt({ colour: 'coral', pose: 'rest', mood: 'idle' }).map((r) => r.fill);

    it('labels the hub tab KIP and draws your KIP resting at scale 2', () => {
      const s = render(bar(makeProps(0)));
      expect(s.getByTestId('hub-character', HIDDEN_OK).props.style).toEqual(expect.objectContaining({ width: 32, height: 32 }));
      expect(TAB_LABELS.Coach).toBe('KIP');
      expect(hub(s).fills).toEqual(resting);
    });

    it.each([0, 1, 2, 3, 4])('rests at full brightness with tab %i focused', (index) => {
      const utils = render(bar(makeProps(index)));

      expect(hub(utils)).toEqual({ fills: resting, opacity: 1 });
    });

    it('dims when the status is unknown', () => {
      setCoach(null);
      const utils = render(bar(makeProps(0)));

      expect(hub(utils).opacity).toBe(HUB_DIMMED_OPACITY);
    });

    it('dims when the coach is disabled, even on the KIP tab', () => {
      setCoach({ ...enabledStatus, enabled: false });
      const utils = render(bar(makeProps(2)));

      expect(hub(utils).opacity).toBe(HUB_DIMMED_OPACITY);
    });

    it('is not dimmed for an enabled coach the user has not consented to yet', () => {
      setCoach({ ...enabledStatus, consented: false });
      const utils = render(bar(makeProps(0)));

      expect(hub(utils).opacity).toBe(1);
    });

    it('is drawn in your KIP colour', () => {
      setMyKipColour('cobalt');
      const utils = render(bar(makeProps(0)));

      expect(hub(utils).fills).toEqual(kipArt({ colour: 'cobalt', pose: 'rest', mood: 'idle' }).map((r) => r.fill));
      expect(hub(utils).fills).toContain(KIP_COLOURS.cobalt);
    });

    it('draws the same KIP in light mode (its colours are fixed)', () => {
      mockScheme = 'light';
      const utils = render(bar(makeProps(0)));

      expect(hub(utils).fills).toEqual(resting);
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
