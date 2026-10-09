import React from 'react';
import { StyleSheet } from 'react-native';
import { characterLabel, withCharacter } from '../../jest-mocks/characterContext';
import { render, fireEvent } from '@testing-library/react-native';
import { MetricTile, trendCaption } from '../../src/components/home/metric-tile';
import { RecoveryHero } from '../../src/components/home/recovery-hero';
import { SleepTile } from '../../src/components/home/sleep-tile';
import { CoachTile } from '../../src/components/home/coach-tile';
import type { DailyScoreDTO, FactorDTO } from '../../src/api/scores';
import { FONTS } from '../../src/theme';
import type { MetricRecord } from '../../src/lib/metricInsights';

function records(type: MetricRecord['metricType'], values: number[]): MetricRecord[] {
  return values.map((value, i) => ({
    id: String(i),
    metricType: type,
    value,
    recordedAt: new Date(Date.UTC(2026, 8, 1 + i)).toISOString(),
  }));
}

const hrvFactor: FactorDTO = {
  factor: 'HRV',
  label: 'HRV',
  z: 1,
  weight: 0.4,
  contribution: 0.4,
  points: 9,
  imputed: false,
  excluded: false,
};

const recovery: DailyScoreDTO = {
  date: '2026-09-19',
  type: 'RECOVERY',
  score: 78,
  confidenceLevel: 'HIGH',
  algorithmVersion: 'v1',
  factors: [hrvFactor],
  coldStart: [],
};

describe('trendCaption', () => {
  it('compares the latest reading with the person’s own average', () => {
    expect(trendCaption(records('HRV', [50, 50, 60]))).toBe('20% above your average');
    expect(trendCaption(records('HRV', [50, 50, 40]))).toBe('20% below your average');
  });

  it('calls a small move steady', () => {
    expect(trendCaption(records('HRV', [50, 50, 51]))).toBe('Steady vs your average');
  });

  it('has nothing to say about a single reading', () => {
    expect(trendCaption(records('HRV', [50]))).toBeNull();
  });
});

describe('MetricTile', () => {
  it('shows progress toward a real goal for goal metrics', () => {
    const { getByText } = render(<MetricTile type="STEPS" series={records('STEPS', [8000, 8400])} onPress={jest.fn()} />);
    expect(getByText('Steps')).toBeTruthy();
    expect(getByText('8,400')).toBeTruthy();
    expect(getByText('84% of goal')).toBeTruthy();
  });

  it('shows the own-average comparison for metrics with no universal goal', () => {
    const { getByText } = render(<MetricTile type="HRV" series={records('HRV', [50, 50, 60])} onPress={jest.fn()} />);
    expect(getByText('60.0 ms')).toBeTruthy();
    expect(getByText('20% above your average')).toBeTruthy();
  });

  it('draws its number in tabular figures on one line that shrinks to fit', () => {
    const { getByText } = render(<MetricTile type="STEPS" series={records('STEPS', [8000, 18400])} onPress={jest.fn()} />);
    const value = getByText('18,400');
    expect(StyleSheet.flatten(value.props.style)).toEqual(expect.objectContaining({ fontFamily: FONTS.sansBold, fontVariant: ['tabular-nums'] }));
    expect(String(value.props.className).split(' ')).toEqual(expect.arrayContaining(['text-display', 'tabular-nums']));
    expect(value.props.numberOfLines).toBe(1);
    expect(value.props.adjustsFontSizeToFit).toBe(true);
  });

  it('opens its detail when pressed', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(<MetricTile type="HRV" series={records('HRV', [50, 60])} onPress={onPress} />);
    fireEvent.press(getByTestId('metric-card-HRV'));
    expect(onPress).toHaveBeenCalled();
  });
});

describe('RecoveryHero', () => {
  it('leads with the score, its verdict and its confidence', () => {
    const { getByTestId, getByText } = render(<RecoveryHero score={recovery} failed={false} onPress={jest.fn()} />);
    expect(getByTestId('recovery-score-card')).toBeTruthy();
    expect(getByText('78')).toBeTruthy();
    expect(getByText('HRV is lifting it today.')).toBeTruthy();
    expect(getByTestId('confidence-badge')).toBeTruthy();
  });

  it('sets the score as text-score in tabular figures under a pixel label, and the verdict in Geist', () => {
    const { getByText } = render(<RecoveryHero score={recovery} failed={false} onPress={jest.fn()} />);
    const score = getByText('78');
    expect(String(score.props.className).split(' ')).toEqual(expect.arrayContaining(['text-score', 'tabular-nums']));
    expect(StyleSheet.flatten(score.props.style)).toEqual(expect.objectContaining({ fontFamily: FONTS.sansSemibold, fontVariant: ['tabular-nums'] }));
    expect(StyleSheet.flatten(getByText('Recovery Score').props.style).fontFamily).toBe(FONTS.pixel);
    expect(StyleSheet.flatten(getByText('HRV is lifting it today.').props.style).fontFamily).toBe(FONTS.sansSemibold);
  });

  it('opens the score it shows', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(<RecoveryHero score={recovery} failed={false} onPress={onPress} />);
    fireEvent.press(getByTestId('recovery-score-card'));
    expect(onPress).toHaveBeenCalledWith(recovery);
  });

  it('shows the baseline ring, not a score, while cold-starting', () => {
    const cold = { ...recovery, score: null, factors: [], coldStart: [{ metric: 'HRV', daysCollected: 9, daysRequired: 14 }] };
    const { getByText, queryByTestId, getByTestId } = render(<RecoveryHero score={cold} failed={false} onPress={jest.fn()} />);
    expect(getByTestId('baseline-progress-ring')).toBeTruthy();
    expect(getByText('Building your baseline')).toBeTruthy();
    expect(queryByTestId('score-ring')).toBeNull();
  });
});

describe('SleepTile', () => {
  it('puts the cold-start day count beside its small ring', () => {
    const cold: DailyScoreDTO = {
      ...recovery,
      type: 'SLEEP',
      score: null,
      factors: [],
      coldStart: [{ metric: 'SLEEP', daysCollected: 4, daysRequired: 7 }],
    };
    const { getByText } = render(<SleepTile score={cold} failed={false} onPress={jest.fn()} />);
    expect(getByText('4/7 days')).toBeTruthy();
  });
});

describe('CoachTile', () => {
  it('says consent comes first when the coach is not set up yet', () => {
    const { getByText } = render(<CoachTile needsConsent onPress={jest.fn()} />);
    expect(getByText('See what’s shared first')).toBeTruthy();
  });
});

describe('CoachTile character', () => {
  it("shows the user's character, idle", () => {
    const utils = render(withCharacter(<CoachTile needsConsent={false} onPress={jest.fn()} />, { characterId: 'mochi' }));

    expect(characterLabel(utils, 'coach-tile-character')).toBe('character:mochi:idle:40:playing:none');
  });

  it('rests on a poor recovery day', () => {
    const utils = render(withCharacter(<CoachTile needsConsent={false} onPress={jest.fn()} />, { characterId: 'mochi', recoveryBand: 'scorePoor' }));

    expect(characterLabel(utils, 'coach-tile-character')).toBe('character:mochi:resting:40:playing:none');
  });
});
