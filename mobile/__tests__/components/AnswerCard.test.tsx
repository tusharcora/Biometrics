import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import type { AnswerCardDTO } from '../../src/api/coach';
import { AnswerCard } from '../../src/components/coach/AnswerCard';
import { ErrorCard } from '../../src/components/coach/ErrorCard';
import { FollowUpChips } from '../../src/components/coach/FollowUpChips';
import { COLORS } from '../../src/theme';

let mockScheme: 'light' | 'dark' = 'light';
jest.mock('nativewind', () => ({
  ...jest.requireActual('nativewind'),
  useColorScheme: () => ({ colorScheme: mockScheme, setColorScheme: jest.fn(), toggleColorScheme: jest.fn() }),
}));

const style = (el: { props: { style?: unknown } }) => StyleSheet.flatten(el.props.style as never) as Record<string, unknown>;

const tiles: AnswerCardDTO = {
  headline: 'Decent night, broken after 4am',
  tiles: [
    { factId: 'sleep.total', label: 'total', display: '6h 48m', value: 408, usual: 433, status: 'below' },
    { factId: 'sleep.deep', label: 'deep', display: '1h 12m', value: 72, usual: 70, status: 'near' },
    { factId: 'sleep.wakeups', label: 'wake-ups', display: '4', value: 4 },
  ],
  tip: 'a cooler room tonight, then see if the early wake-ups drop.',
  source: 'Sleep · last night vs your 30-day usual',
};

const ranked: AnswerCardDTO = {
  headline: 'What moves your recovery',
  ranked: [
    { factId: 'habit.caffeine_late', label: 'Caffeine after 2pm', display: '−8 pts', value: -8 },
    { factId: 'habit.walk', label: 'Evening walk', display: '+6 pts', value: 6 },
    { factId: 'habit.alcohol', label: 'Alcohol', display: '−4 pts · low confidence', value: -4 },
  ],
  source: 'Habit correlations · last 90 days',
};

beforeEach(() => {
  mockScheme = 'light';
});

describe('AnswerCard', () => {
  it('shows the headline and one tile per number, with how each compares to usual', () => {
    const { getByTestId } = render(<AnswerCard card={tiles} />);

    expect(getByTestId('answer-card')).toHaveTextContent(/^Decent night, broken after 4am/);
    expect(getByTestId('answer-tile-sleep.total')).toHaveTextContent('6h 48mtotal · below usual');
    expect(getByTestId('answer-tile-sleep.deep')).toHaveTextContent('1h 12mdeep · on par');
    expect(getByTestId('answer-tile-sleep.wakeups')).toHaveTextContent('4wake-ups');
  });

  it('words a resting HR above usual by the number, though its status is below', () => {
    const card: AnswerCardDTO = {
      headline: 'Resting HR up',
      tiles: [{ factId: 'rhr.today', label: 'resting HR', display: '62 bpm', value: 62, usual: 56, status: 'below' }],
      source: 'Resting HR · today vs your 30-day usual',
    };
    const { getByTestId } = render(<AnswerCard card={card} />);

    expect(getByTestId('answer-tile-rhr.today')).toHaveTextContent('62 bpmresting HR · above usual');
  });

  it('reads each tile to a screen reader in words', () => {
    const { getByTestId } = render(<AnswerCard card={tiles} />);

    expect(getByTestId('answer-tile-sleep.total').props.accessibilityLabel).toBe('total 6h 48m, below usual');
    expect(getByTestId('answer-tile-sleep.wakeups').props.accessibilityLabel).toBe('wake-ups 4');
  });

  // R40: tile numbers take the text-safe status colours (rose/teal-700 in
  // light mode); a value near usual stays in the text colour.
  it('colours tile values with the text-safe status colours in light mode', () => {
    const { getByTestId } = render(<AnswerCard card={tiles} />);

    expect(style(getByTestId('answer-tile-value-sleep.total')).color).toBe(COLORS.light.statusBelowText);
    expect(style(getByTestId('answer-tile-value-sleep.total')).color).not.toBe(COLORS.light.statusBelow);
    expect(style(getByTestId('answer-tile-value-sleep.deep')).color).toBe(COLORS.light.foreground);
  });

  it('colours a tile value by its status in dark mode', () => {
    mockScheme = 'dark';
    const { getByTestId } = render(<AnswerCard card={tiles} />);

    expect(style(getByTestId('answer-tile-value-sleep.total')).color).toBe(COLORS.dark.statusBelowText);
    expect(style(getByTestId('answer-tile-value-sleep.deep')).color).toBe(COLORS.dark.foreground);
  });

  it('shows a ranked list with bars sized to the effect and coloured by its sign', () => {
    const { getByTestId, queryByTestId } = render(<AnswerCard card={ranked} />);

    expect(getByTestId('answer-rank-1')).toHaveTextContent('1Caffeine after 2pm−8 pts');
    expect(getByTestId('answer-rank-3')).toHaveTextContent('3Alcohol−4 pts · low confidence');
    expect(getByTestId('answer-rank-1').props.accessibilityLabel).toBe('1. Caffeine after 2pm, −8 pts');
    expect(style(getByTestId('answer-rank-bar-1')).width).toBe(70);
    expect(style(getByTestId('answer-rank-bar-2')).width).toBeCloseTo(52.5);
    expect(style(getByTestId('answer-rank-bar-1')).backgroundColor).toBe(COLORS.light.statusBelow);
    expect(style(getByTestId('answer-rank-bar-2')).backgroundColor).toBe(COLORS.light.statusAbove);
    expect(queryByTestId(/^answer-tile-/)).toBeNull();
  });

  it('prefixes the tip with "Try:" once', () => {
    const { getByTestId, rerender } = render(<AnswerCard card={tiles} />);
    expect(getByTestId('answer-tip')).toHaveTextContent('Try: a cooler room tonight, then see if the early wake-ups drop.');

    rerender(<AnswerCard card={{ ...tiles, tip: 'Try: an earlier night.' }} />);
    expect(getByTestId('answer-tip')).toHaveTextContent(/^Try: an earlier night\.$/);
  });

  it('opens the source when its line is tapped, and has no tip line without a tip', () => {
    const onOpenSource = jest.fn();
    const { getByTestId, queryByTestId } = render(<AnswerCard card={ranked} onOpenSource={onOpenSource} />);

    expect(queryByTestId('answer-tip')).toBeNull();
    const source = getByTestId('answer-source');
    expect(source).toHaveTextContent('Habit correlations · last 90 days ›');
    expect(source.props.accessibilityRole).toBe('link');
    fireEvent.press(source);
    expect(onOpenSource).toHaveBeenCalledTimes(1);
  });

  it('shows the source as plain text when there is nowhere to open', () => {
    const { getByTestId } = render(<AnswerCard card={ranked} />);

    expect(getByTestId('answer-source')).toHaveTextContent(/^Habit correlations · last 90 days$/);
  });
});

describe('FollowUpChips', () => {
  it('asks the tapped question', () => {
    const onAsk = jest.fn();
    const { getByTestId } = render(<FollowUpChips questions={['Why after 4am?', "How's my week?"]} onAsk={onAsk} />);

    fireEvent.press(getByTestId('follow-up-1'));

    expect(onAsk).toHaveBeenCalledWith("How's my week?");
    expect(getByTestId('follow-up-0').props.accessibilityRole).toBe('button');
  });

  it('cannot be tapped while an answer is streaming', () => {
    const onAsk = jest.fn();
    const { getByTestId } = render(<FollowUpChips questions={['Why after 4am?']} onAsk={onAsk} disabled />);

    fireEvent.press(getByTestId('follow-up-0'));

    expect(onAsk).not.toHaveBeenCalled();
  });

  it('renders nothing when there are no follow-ups', () => {
    const { queryByTestId } = render(<FollowUpChips questions={[]} onAsk={() => {}} />);

    expect(queryByTestId('follow-up-chips')).toBeNull();
  });
});

describe('ErrorCard', () => {
  const request = { message: 'How did I sleep?' };

  it.each([
    ['unavailable', "I couldn't answer that just now."],
    ['timeout', 'That took too long. Nothing was lost; you can try again.'],
    ['interrupted', 'The answer stopped part-way. You can try again.'],
    ['busy', "I'm still finishing your last answer. Give it a moment, then try again."],
    ['rate_limited', "You've sent a lot of messages in a short time. Try again a little later."],
  ] as const)('explains %s and offers retry', (kind, text) => {
    const onRetry = jest.fn();
    const { getByTestId } = render(<ErrorCard error={{ kind, retryable: true, request }} onRetry={onRetry} />);

    expect(getByTestId('coach-error')).toHaveTextContent(text);
    fireEvent.press(getByTestId('coach-retry-button'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it.each([
    [20, 'Try again in under a minute.'],
    [60, 'Try again in about a minute.'],
    [150, 'Try again in about 3 minutes.'],
    [7200, 'Try again in about 2 hours.'],
  ])('says when to try again after a rate limit of %ss', (retryAfterSeconds, text) => {
    const { getByTestId } = render(<ErrorCard error={{ kind: 'rate_limited', retryable: true, retryAfterSeconds, request }} onRetry={() => {}} />);

    expect(getByTestId('coach-error')).toHaveTextContent(`You've sent a lot of messages in a short time. ${text}`);
  });

  it('offers no retry when the server says it would not help', () => {
    const { queryByTestId } = render(<ErrorCard error={{ kind: 'unavailable', retryable: false, request }} onRetry={() => {}} />);

    expect(queryByTestId('coach-retry-button')).toBeNull();
  });
});
