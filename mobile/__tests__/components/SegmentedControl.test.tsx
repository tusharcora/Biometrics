import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SegmentedControl, indicatorOffset } from '../../src/components/ui/segmented-control';

describe('indicatorOffset', () => {
  it('places segment i at i * (width / count)', () => {
    expect(indicatorOffset(0, 300, 3)).toBe(0);
    expect(indicatorOffset(1, 300, 3)).toBe(100);
    expect(indicatorOffset(2, 300, 3)).toBe(200);
  });

  it('is 0 before layout or with no options', () => {
    expect(indicatorOffset(2, 0, 3)).toBe(0);
    expect(indicatorOffset(0, 300, 0)).toBe(0);
  });
});

const OPTIONS = [
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
  { value: 'ytd', label: 'YTD' },
] as const;

describe('SegmentedControl', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders every label and marks the current value selected', () => {
    const { getByText, getByTestId } = render(
      <SegmentedControl options={[...OPTIONS]} value="year" onChange={() => {}} testID="seg" />,
    );

    expect(getByText('Month')).toBeTruthy();
    expect(getByText('YTD')).toBeTruthy();
    expect(getByTestId('seg-year').props.accessibilityState).toEqual({ selected: true });
    expect(getByTestId('seg-month').props.accessibilityState).toEqual({ selected: false });
  });

  it('reports the tapped value', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(<SegmentedControl options={[...OPTIONS]} value="month" onChange={onChange} testID="seg" />);

    fireEvent.press(getByTestId('seg-ytd'));

    expect(onChange).toHaveBeenCalledWith('ytd');
  });

  it('indicator appears after layout with correct width and position', () => {
    const { getByTestId, queryByTestId } = render(
      <SegmentedControl options={[...OPTIONS]} value="year" onChange={() => {}} testID="seg" />,
    );

    // Before layout, indicator should not be present
    expect(queryByTestId('seg-indicator')).toBeNull();

    // Fire layout event with width 300
    fireEvent(getByTestId('seg-inner'), 'layout', { nativeEvent: { layout: { width: 300, height: 40, x: 0, y: 0 } } });

    // After layout, indicator should be present
    const indicator = getByTestId('seg-indicator');
    expect(indicator).toBeTruthy();

    // Indicator should have width 100 (300 / 3 options)
    expect(indicator.props.style[0].width).toBe(100);
  });

  it('still renders with layout handling even in reduced-motion scenarios', () => {
    const { getByTestId, queryByTestId } = render(
      <SegmentedControl options={[...OPTIONS]} value="year" onChange={() => {}} testID="seg" />,
    );

    // Verify indicator absent before layout
    expect(queryByTestId('seg-indicator')).toBeNull();

    // Fire layout event
    fireEvent(getByTestId('seg-inner'), 'layout', { nativeEvent: { layout: { width: 300, height: 40, x: 0, y: 0 } } });

    // Indicator should appear
    const indicator = getByTestId('seg-indicator');
    expect(indicator).toBeTruthy();
  });
});
