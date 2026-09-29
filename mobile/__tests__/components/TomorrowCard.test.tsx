import { fireEvent, render, screen } from '@testing-library/react-native';
import { TomorrowCard } from '../../src/components/tomorrow-card';
import { READY } from '../../jest-mocks/forecastFixture';

describe('TomorrowCard', () => {
  it('shows the default forecast with its band and opens the planner', () => {
    const onPress = jest.fn();
    render(<TomorrowCard state={{ status: 'loaded', forecast: READY }} onPress={onPress} />);
    expect(screen.getByTestId('tomorrow-card')).toBeTruthy();
    expect(screen.getByText('Likely 40–80')).toBeTruthy();
    fireEvent.press(screen.getByText('Plan tomorrow →'));
    expect(onPress).toHaveBeenCalled();
  });

  it('shows progress toward 21 days when there is not enough history', () => {
    render(
      <TomorrowCard
        state={{ status: 'loaded', forecast: { status: 'NOT_ENOUGH_DATA', reason: 'NO_HISTORY', daysOfHistory: 12 } }}
        onPress={jest.fn()}
      />,
    );
    expect(screen.getByText('Forecast unlocks after 21 days of data (12/21)')).toBeTruthy();
  });

  it('shows loading and error states', () => {
    const { rerender } = render(<TomorrowCard state={{ status: 'loading' }} onPress={jest.fn()} />);
    expect(screen.getByTestId('tomorrow-loading')).toBeTruthy();
    rerender(<TomorrowCard state={{ status: 'error' }} onPress={jest.fn()} />);
    expect(screen.getByTestId('tomorrow-unavailable')).toBeTruthy();
  });
});
