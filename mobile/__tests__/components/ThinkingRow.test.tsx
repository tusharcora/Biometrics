import React from 'react';
import { StyleSheet } from 'react-native';
import { render, act } from '@testing-library/react-native';
import { ThinkingRow } from '../../src/components/coach/thinking/ThinkingRow';
import { SILKSCREEN, pixelFont } from '../../src/components/coach/thinking/shared';
import { COLORS, FONTS } from '../../src/theme';
import { THINKING_TEXTS } from '../../src/lib/thinkingText';
import { KIP_THINKING_VERBS } from '../../src/lib/kipCopy';
import { KIP_COLOURS } from '../../src/lib/kip/kipArt';
import { setMyKipColour, resetMyKip } from '../../src/lib/kip/myKip';

let mockReduceMotion = false;
jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual('react-native-reanimated');
  // `default` (Animated) is not an own enumerable key, so a spread alone drops it.
  return { __esModule: true, ...actual, default: actual.default, useReducedMotion: () => mockReduceMotion };
});

// App.tsx loads Silkscreen at start-up; here the test decides whether it is in.
let mockFontLoaded = true;
jest.mock('expo-font', () => ({
  ...jest.requireActual('expo-font'),
  isLoaded: (family: string) => mockFontLoaded && family === 'Silkscreen',
}));

let mockScheme: 'light' | 'dark' = 'light';
jest.mock('nativewind', () => ({
  ...jest.requireActual('nativewind'),
  useColorScheme: () => ({ colorScheme: mockScheme, setColorScheme: jest.fn(), toggleColorScheme: jest.fn() }),
}));

const steps = [
  { id: 'route', label: 'Looking at your sleep…', done: true },
  { id: 'facts', label: 'Going through your recent nights…', done: false },
];

beforeEach(() => {
  mockReduceMotion = false;
  mockFontLoaded = true;
  mockScheme = 'light';
});

afterEach(() => {
  jest.useRealTimers();
  resetMyKip();
});

it.each(THINKING_TEXTS)('%s draws KIP\'s head beside its text', (style) => {
  const s = render(<ThinkingRow style={style} steps={steps} paused testID="row" />);
  expect(s.getByTestId('thinking-kip-head', { includeHiddenElements: true })).toBeTruthy();
});

it.each(THINKING_TEXTS)('%s is a polite live region with a plain spoken label', (style) => {
  const s = render(<ThinkingRow style={style} steps={steps} paused testID="row" />);
  const row = s.getByTestId('row');
  expect(row.props.accessibilityLiveRegion).toBe('polite');
  expect(row.props.accessible).toBe(true);
  expect(row.props.accessibilityLabel).toBe(style === 'steps' ? 'Going through your recent nights' : 'KIP is typing it up');
});

it('steps shows the real steps, ticking finished ones', () => {
  const s = render(<ThinkingRow style="steps" steps={steps} paused testID="row" />);
  expect(s.getByText('Going through your recent nights…')).toBeTruthy();
  expect(s.getByTestId('thinking-step-route-done')).toBeTruthy();
  expect(s.getByTestId('thinking-step-facts-active')).toBeTruthy();
});

it('steps shows an all-ticked list (the 300 ms linger after the turn) with no active row', () => {
  const all = steps.map((step) => ({ ...step, done: true }));
  const s = render(<ThinkingRow style="steps" steps={all} paused testID="row" />);
  expect(s.getByTestId('thinking-step-route-done')).toBeTruthy();
  expect(s.getByTestId('thinking-step-facts-done')).toBeTruthy();
  expect(s.queryByTestId('thinking-step-facts-active')).toBeNull();
  expect(s.getByTestId('row').props.accessibilityLabel).toBe('Going through your recent nights');
});

it('steps shows a stepless status from an older server as a single line', () => {
  const s = render(<ThinkingRow style="steps" steps={[{ id: 'status', label: 'Thinking…', done: false }]} paused testID="row" />);
  expect(s.getByTestId('thinking-step-status-active')).toHaveTextContent(/Thinking…/);
});

it('steps falls back to KIP\'s first line before the first status arrives', () => {
  const s = render(<ThinkingRow style="steps" steps={[]} paused testID="row" />);
  expect(s.getByText(new RegExp(`KIP is ${KIP_THINKING_VERBS[0]}`))).toBeTruthy();
});

it("lines rotates through KIP's three lines, and holds when paused", () => {
  jest.useFakeTimers();
  const s = render(<ThinkingRow style="lines" steps={[]} paused={false} testID="row" />);
  expect(s.getByText(new RegExp(KIP_THINKING_VERBS[0]))).toBeTruthy();
  act(() => {
    jest.advanceTimersByTime(2400);
  });
  expect(s.getByText(new RegExp(KIP_THINKING_VERBS[1]))).toBeTruthy();
  s.rerender(<ThinkingRow style="lines" steps={[]} paused testID="row" />);
  act(() => {
    jest.advanceTimersByTime(5000);
  });
  expect(s.getByText(new RegExp(KIP_THINKING_VERBS[1]))).toBeTruthy();
});

it('typewriter shows the whole first line when paused', () => {
  const s = render(<ThinkingRow style="typewriter" steps={steps} paused testID="row" />);
  expect(s.getByTestId('thinking-typewriter-text')).toHaveTextContent('KIP is typing it up…');
});

it('typewriter types the line out over time', () => {
  jest.useFakeTimers();
  const s = render(<ThinkingRow style="typewriter" steps={[]} paused={false} testID="row" />);
  act(() => {
    jest.advanceTimersByTime(300);
  });
  const early = s.getByTestId('thinking-typewriter-text').props.children as string;
  expect('KIP is typing it up…'.startsWith(early)).toBe(true);
  expect(early.length).toBeLessThan('KIP is typing it up…'.length);
  act(() => {
    jest.advanceTimersByTime(1500);
  });
  expect(s.getByTestId('thinking-typewriter-text')).toHaveTextContent('KIP is typing it up…');
});

it('Reduce Motion freezes the styles even when the screen is focused', () => {
  mockReduceMotion = true;
  jest.useFakeTimers();
  const s = render(<ThinkingRow style="typewriter" steps={[]} paused={false} testID="row" />);
  act(() => {
    jest.advanceTimersByTime(100);
  });
  expect(s.getByTestId('thinking-typewriter-text')).toHaveTextContent('KIP is typing it up…');
});

it('placeholder shows KIP\'s line over three pulsing bars', () => {
  const s = render(<ThinkingRow style="placeholder" steps={[]} paused testID="row" />);
  expect(s.getByText(/typing it up/)).toBeTruthy();
  expect(s.getAllByTestId(/^thinking-placeholder-bar-/, { includeHiddenElements: true })).toHaveLength(3);
});

it('shimmer names KIP and counts the seconds since it appeared', () => {
  const s = render(<ThinkingRow style="shimmer" steps={[]} paused testID="row" />);
  // Spec §3.4's label, from KIP_COPY.
  expect(s.getByText('KIP is typing it up')).toBeTruthy();
  expect(s.getByTestId('thinking-shimmer-seconds')).toHaveTextContent('0s');
});

describe('the KIP label colour (spec §3.4)', () => {
  const kipColour = (s: ReturnType<typeof render>) => StyleSheet.flatten(s.getByText('KIP').props.style).color;

  it('names KIP in the KIP colour on the dark card', () => {
    mockScheme = 'dark';
    setMyKipColour('cobalt');
    const s = render(<ThinkingRow style="lines" steps={steps} paused testID="row" />);
    expect(kipColour(s)).toBe(KIP_COLOURS.cobalt);
  });

  it('uses foreground on the dark card for a colour that does not read there (ink)', () => {
    mockScheme = 'dark';
    setMyKipColour('ink');
    const s = render(<ThinkingRow style="lines" steps={steps} paused testID="row" />);
    expect(kipColour(s)).toBe(COLORS.dark.foreground);
  });

  it('uses foreground on the light card', () => {
    setMyKipColour('cobalt');
    const s = render(<ThinkingRow style="lines" steps={steps} paused testID="row" />);
    expect(kipColour(s)).toBe(COLORS.light.foreground);
  });
});

it('keeps pixelFont for the frozen Campfire scene', () => {
  expect(pixelFont()).toBe(SILKSCREEN);
  mockFontLoaded = false;
  expect(pixelFont()).toBe(FONTS.sans);
});
