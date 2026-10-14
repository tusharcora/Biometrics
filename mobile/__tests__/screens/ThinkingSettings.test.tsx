import React from 'react';
import { AccessibilityInfo } from 'react-native';
import { act, fireEvent, render, within } from '@testing-library/react-native';
import { THINKING_STYLE_ERROR, ThinkingStyleScreen } from '../../src/screens/ThinkingStyleScreen';
import { THINKING_TEXT_ERROR, ThinkingTextScreen } from '../../src/screens/ThinkingTextScreen';
import { THINKING_ATTACHMENTS } from '../../src/components/characters/thinking';
import { KIP_COPY } from '../../src/lib/kipCopy';
import { THINKING_TEXTS } from '../../src/lib/thinkingText';
import { characterLabel, HIDDEN_OK, withCharacter } from '../../jest-mocks/characterContext';

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

describe('ThinkingStyleScreen', () => {
  it('lists the 9 attachments with Lightbulb selected by default and saves a choice', async () => {
    const chooseThinking = jest.fn(async () => {});
    const s = render(withCharacter(<ThinkingStyleScreen />, { chooseThinking }));
    for (const id of THINKING_ATTACHMENTS) expect(s.getByTestId(`thinking-style-${id}`)).toBeTruthy();
    expect(s.getByTestId('thinking-style-bulb').props.accessibilityState).toMatchObject({ checked: true });
    expect(s.getByTestId('thinking-style-gears').props.accessibilityState).toMatchObject({ checked: false });
    expect(s.getByTestId('thinking-style-bulb').props.accessibilityRole).toBe('radio');
    await act(async () => fireEvent.press(s.getByTestId('thinking-style-gears')));
    expect(chooseThinking).toHaveBeenCalledWith({ attachment: 'gears' });
  });

  it("previews with the user's own coach and attachment", () => {
    const s = render(withCharacter(<ThinkingStyleScreen />, { characterId: 'luna', thinkingAttachment: 'clock' }));
    expect(characterLabel(s, 'thinking-preview')).toMatch(/^character:luna:thinking:96:playing:clock$/);
  });

  it('loops the preview from thinking into the answering moment', () => {
    jest.useFakeTimers();
    try {
      const s = render(withCharacter(<ThinkingStyleScreen />, { characterId: 'kit' }));
      expect(characterLabel(s, 'thinking-preview')).toMatch(/^character:kit:thinking:/);
      act(() => jest.advanceTimersByTime(2400));
      expect(characterLabel(s, 'thinking-preview')).toMatch(/^character:kit:answering:/);
      act(() => jest.advanceTimersByTime(800));
      expect(characterLabel(s, 'thinking-preview')).toMatch(/^character:kit:thinking:/);
      s.unmount();
    } finally {
      jest.useRealTimers();
    }
  });

  it('animates only the selected tile, each wearing its own attachment', () => {
    const s = render(withCharacter(<ThinkingStyleScreen />, { characterId: 'boba', thinkingAttachment: 'cloud' }));
    expect(characterLabel(s, 'thinking-style-cloud')).toBe('character:boba:thinking:48:playing:cloud');
    expect(characterLabel(s, 'thinking-style-spinner')).toBe('character:boba:thinking:48:paused:spinner');
  });

  it('shows an error when saving fails', async () => {
    const chooseThinking = jest.fn(async () => {
      throw new Error('offline');
    });
    const s = render(withCharacter(<ThinkingStyleScreen />, { chooseThinking }));
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    await act(async () => fireEvent.press(s.getByTestId('thinking-style-hourglass')));
    expect(s.getByText(/thinking style couldn't be saved/i)).toBeTruthy();
    expect(announce).toHaveBeenCalledWith(THINKING_STYLE_ERROR);
    announce.mockRestore();
    expect(s.getByTestId('thinking-style-bulb').props.accessibilityState).toMatchObject({ checked: true });
  });
});

describe('ThinkingTextScreen', () => {
  it('lists the five text styles with Steps selected by default and saves a choice', async () => {
    const chooseThinking = jest.fn(async () => {});
    const s = render(withCharacter(<ThinkingTextScreen />, { chooseThinking }));
    for (const id of THINKING_TEXTS) expect(s.getByTestId(`thinking-text-${id}`)).toBeTruthy();
    expect(s.getAllByTestId(/^thinking-text-[a-z]+$/)).toHaveLength(5);
    expect(s.queryByTestId('thinking-text-dialog')).toBeNull();
    expect(s.getByTestId('thinking-text-steps').props.accessibilityState).toMatchObject({ checked: true });
    expect(s.getByTestId('thinking-text-shimmer').props.accessibilityState).toMatchObject({ checked: false });
    expect(s.getByTestId('thinking-text-steps')).toHaveTextContent(/Steps/);
    await act(async () => fireEvent.press(s.getByTestId('thinking-text-shimmer')));
    expect(chooseThinking).toHaveBeenCalledWith({ text: 'shimmer' });
  });

  it("previews the chosen style with KIP, under KIP's intro line", () => {
    const s = render(withCharacter(<ThinkingTextScreen />, { characterId: 'pengu', thinkingText: 'steps' }));
    expect(within(s.getByTestId('thinking-preview', HIDDEN_OK)).getByTestId('thinking-kip-head', HIDDEN_OK)).toBeTruthy();
    expect(s.getByTestId('thinking-preview', HIDDEN_OK)).toHaveTextContent(/Looking at your sleep/);
    expect(s.getByText(KIP_COPY.thinkingTextIntro)).toBeTruthy();
  });

  it('shows an error and keeps the old choice when saving fails', async () => {
    const chooseThinking = jest.fn(async () => {
      throw new Error('offline');
    });
    const s = render(withCharacter(<ThinkingTextScreen />, { chooseThinking }));
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    await act(async () => fireEvent.press(s.getByTestId('thinking-text-typewriter')));
    expect(s.getByText(/couldn't be saved/i)).toBeTruthy();
    expect(announce).toHaveBeenCalledWith(THINKING_TEXT_ERROR);
    announce.mockRestore();
    expect(s.getByTestId('thinking-text-steps').props.accessibilityState).toMatchObject({ checked: true });
  });

  it("previews each style in its own row, with KIP's head beside it", () => {
    const s = render(withCharacter(<ThinkingTextScreen />, { thinkingText: 'shimmer' }));
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
    const s = render(withCharacter(<ThinkingTextScreen />, { thinkingText: 'typewriter' }));
    act(() => jest.advanceTimersByTime(300));
    const typed = within(s.getByTestId('thinking-text-preview-typewriter', HIDDEN_OK)).getByTestId('thinking-typewriter-text', HIDDEN_OK);
    expect(typed.props.children).not.toBe('KIP is typing it up…');
    s.unmount();
    const still = render(withCharacter(<ThinkingTextScreen />, { thinkingText: 'steps' }));
    act(() => jest.advanceTimersByTime(300));
    expect(within(still.getByTestId('thinking-text-preview-typewriter', HIDDEN_OK)).getByTestId('thinking-typewriter-text', HIDDEN_OK)).toHaveTextContent('KIP is typing it up…');
    still.unmount();
    jest.useRealTimers();
  });

  it('reads each row as its name and blurb, with the preview hidden from screen readers', () => {
    const s = render(withCharacter(<ThinkingTextScreen />));
    const row = s.getByTestId('thinking-text-steps');
    expect(row.props.accessibilityLabel).toBe('Steps. The real steps, ticked off as they happen.');
    expect(s.getByTestId('thinking-text-preview-steps', HIDDEN_OK).props.accessibilityElementsHidden).toBe(true);
    expect(s.queryByTestId('thinking-text-preview-steps')).toBeNull();
  });
});

describe('Reduce Motion', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('holds the Thinking style preview on thinking', () => {
    mockReduceMotion = true;
    const s = render(withCharacter(<ThinkingStyleScreen />, { characterId: 'kit' }));
    act(() => jest.advanceTimersByTime(5000));
    expect(characterLabel(s, 'thinking-preview')).toMatch(/^character:kit:thinking:96:paused:/);
    s.unmount();
  });

  it('does not cycle the Thinking text sample steps', () => {
    mockReduceMotion = true;
    const s = render(withCharacter(<ThinkingTextScreen />));
    const preview = () => within(s.getByTestId('thinking-preview', HIDDEN_OK));
    expect(preview().getByTestId('thinking-step-route-active', HIDDEN_OK)).toBeTruthy();
    act(() => jest.advanceTimersByTime(3500));
    expect(preview().getByTestId('thinking-step-route-active', HIDDEN_OK)).toBeTruthy();
    expect(preview().queryByTestId('thinking-step-facts-active', HIDDEN_OK)).toBeNull();
    s.unmount();
  });

  it('cycles them when motion is allowed', () => {
    const s = render(withCharacter(<ThinkingTextScreen />));
    act(() => jest.advanceTimersByTime(1000));
    expect(within(s.getByTestId('thinking-preview', HIDDEN_OK)).getByTestId('thinking-step-facts-active', HIDDEN_OK)).toBeTruthy();
    s.unmount();
  });
});
