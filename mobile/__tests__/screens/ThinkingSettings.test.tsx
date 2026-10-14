import React from 'react';
import { AccessibilityInfo } from 'react-native';
import { act, fireEvent, render, within } from '@testing-library/react-native';
import { THINKING_TEXT_ERROR, ThinkingTextScreen } from '../../src/screens/ThinkingTextScreen';
import { KIP_COPY } from '../../src/lib/kipCopy';
import { THINKING_TEXTS } from '../../src/lib/thinkingText';
import { HIDDEN_OK, withCoachStatus } from '../../jest-mocks/coachStatus';

// Synchronous icons: the real font load re-renders after these tests finish.
jest.mock('@expo/vector-icons', () => require('../../jest-mocks/vectorIcons'));

let mockReduceMotion = false;
jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual('react-native-reanimated');
  // `default` (Animated) is not an own enumerable key, so a spread alone drops it.
  return { __esModule: true, ...actual, default: actual.default, useReducedMotion: () => mockReduceMotion };
});

afterEach(() => {
  mockReduceMotion = false;
});

describe('ThinkingTextScreen', () => {
  it('lists the five text styles with Steps selected by default and saves a choice', async () => {
    const chooseThinkingText = jest.fn(async () => {});
    const s = render(withCoachStatus(<ThinkingTextScreen />, { chooseThinkingText }));
    for (const id of THINKING_TEXTS) expect(s.getByTestId(`thinking-text-${id}`)).toBeTruthy();
    expect(s.getAllByTestId(/^thinking-text-[a-z]+$/)).toHaveLength(5);
    expect(s.queryByTestId('thinking-text-dialog')).toBeNull();
    expect(s.getByTestId('thinking-text-steps').props.accessibilityState).toMatchObject({ checked: true });
    expect(s.getByTestId('thinking-text-shimmer').props.accessibilityState).toMatchObject({ checked: false });
    expect(s.getByTestId('thinking-text-steps')).toHaveTextContent(/Steps/);
    await act(async () => fireEvent.press(s.getByTestId('thinking-text-shimmer')));
    expect(chooseThinkingText).toHaveBeenCalledWith('shimmer');
  });

  it("previews the chosen style with KIP, under KIP's intro line", () => {
    const s = render(withCoachStatus(<ThinkingTextScreen />, { thinkingText: 'steps' }));
    expect(within(s.getByTestId('thinking-preview', HIDDEN_OK)).getByTestId('thinking-kip-head', HIDDEN_OK)).toBeTruthy();
    expect(s.getByTestId('thinking-preview', HIDDEN_OK)).toHaveTextContent(/Looking at your sleep/);
    expect(s.getByText(KIP_COPY.thinkingTextIntro)).toBeTruthy();
  });

  it('shows an error and keeps the old choice when saving fails', async () => {
    const chooseThinkingText = jest.fn(async () => {
      throw new Error('offline');
    });
    const s = render(withCoachStatus(<ThinkingTextScreen />, { chooseThinkingText }));
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    await act(async () => fireEvent.press(s.getByTestId('thinking-text-typewriter')));
    expect(s.getByText(/couldn't be saved/i)).toBeTruthy();
    expect(announce).toHaveBeenCalledWith(THINKING_TEXT_ERROR);
    announce.mockRestore();
    expect(s.getByTestId('thinking-text-steps').props.accessibilityState).toMatchObject({ checked: true });
  });

  it("previews each style in its own row, with KIP's head beside it", () => {
    const s = render(withCoachStatus(<ThinkingTextScreen />, { thinkingText: 'shimmer' }));
    for (const id of THINKING_TEXTS) {
      const row = s.getByTestId(`thinking-text-${id}`);
      const preview = within(row).getByTestId(`thinking-text-preview-${id}`, HIDDEN_OK);
      expect(within(preview).getByTestId('thinking-kip-head', HIDDEN_OK)).toBeTruthy();
    }
    // Each preview draws its own style.
    const marker: Partial<Record<(typeof THINKING_TEXTS)[number], string>> = {
      steps: 'thinking-step-route-done',
      typewriter: 'thinking-typewriter-text',
      shimmer: 'thinking-shimmer-seconds',
      placeholder: 'thinking-placeholder-bar-0',
    };
    for (const [id, testID] of Object.entries(marker)) {
      expect(within(s.getByTestId(`thinking-text-preview-${id}`, HIDDEN_OK)).getByTestId(testID!, HIDDEN_OK)).toBeTruthy();
    }
    expect(within(s.getByTestId('thinking-text-preview-lines', HIDDEN_OK)).queryByTestId('thinking-shimmer-seconds', HIDDEN_OK)).toBeNull();
  });

  it('only the selected row moves: the others hold their first frame', () => {
    jest.useFakeTimers();
    const s = render(withCoachStatus(<ThinkingTextScreen />, { thinkingText: 'typewriter' }));
    act(() => jest.advanceTimersByTime(300));
    const typed = within(s.getByTestId('thinking-text-preview-typewriter', HIDDEN_OK)).getByTestId('thinking-typewriter-text', HIDDEN_OK);
    expect(typed.props.children).not.toBe('KIP is typing it up…');
    s.unmount();
    const still = render(withCoachStatus(<ThinkingTextScreen />, { thinkingText: 'steps' }));
    act(() => jest.advanceTimersByTime(300));
    expect(within(still.getByTestId('thinking-text-preview-typewriter', HIDDEN_OK)).getByTestId('thinking-typewriter-text', HIDDEN_OK)).toHaveTextContent('KIP is typing it up…');
    still.unmount();
    jest.useRealTimers();
  });

  it('reads each row as its name and blurb, with the preview hidden from screen readers', () => {
    const s = render(withCoachStatus(<ThinkingTextScreen />));
    const row = s.getByTestId('thinking-text-steps');
    expect(row.props.accessibilityLabel).toBe('Steps. The real steps, ticked off as they happen.');
    expect(s.getByTestId('thinking-text-preview-steps', HIDDEN_OK).props.accessibilityElementsHidden).toBe(true);
    expect(s.queryByTestId('thinking-text-preview-steps')).toBeNull();
  });
});

describe('Reduce Motion', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('does not cycle the Thinking text sample steps', () => {
    mockReduceMotion = true;
    const s = render(withCoachStatus(<ThinkingTextScreen />));
    const preview = () => within(s.getByTestId('thinking-preview', HIDDEN_OK));
    expect(preview().getByTestId('thinking-step-route-active', HIDDEN_OK)).toBeTruthy();
    act(() => jest.advanceTimersByTime(3500));
    expect(preview().getByTestId('thinking-step-route-active', HIDDEN_OK)).toBeTruthy();
    expect(preview().queryByTestId('thinking-step-facts-active', HIDDEN_OK)).toBeNull();
    s.unmount();
  });

  it('cycles them when motion is allowed', () => {
    const s = render(withCoachStatus(<ThinkingTextScreen />));
    act(() => jest.advanceTimersByTime(1000));
    expect(within(s.getByTestId('thinking-preview', HIDDEN_OK)).getByTestId('thinking-step-facts-active', HIDDEN_OK)).toBeTruthy();
    s.unmount();
  });
});
