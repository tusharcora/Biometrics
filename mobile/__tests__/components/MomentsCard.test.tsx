import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { MOCKUP_OFFSET, MOCKUP_SEGMENTS, seg } from '../../jest-mocks/sleepNightFixture';
import { MomentsCard } from '../../src/components/sleep/MomentsCard';

describe('MomentsCard', () => {
  it('shows the stage mix of time asleep around the total', () => {
    render(<MomentsCard stages={MOCKUP_SEGMENTS} offset={MOCKUP_OFFSET} minutesToFallAsleep={null} />);

    const card = screen.getByTestId('moments-card');
    expect(card).toHaveTextContent(/7h 24m\s*asleep/);
    // 444 min asleep: deep 90, light 231, REM 123.
    expect(card).toHaveTextContent(/Deep\s*1h 30m\s*20%/);
    expect(card).toHaveTextContent(/Light\s*3h 51m\s*52%/);
    expect(card).toHaveTextContent(/REM\s*2h 03m\s*28%/);
    expect(screen.getByLabelText('Stage mix: deep 20 percent, light 52 percent, REM 28 percent of time asleep')).toBeTruthy();
  });

  it('lists the night\'s highlights in order', () => {
    render(<MomentsCard stages={MOCKUP_SEGMENTS} offset={MOCKUP_OFFSET} minutesToFallAsleep={null} />);

    const rows = screen.getAllByTestId('moment-row');
    expect(rows).toHaveLength(4);
    expect(rows[0]).toHaveTextContent(/Fell asleep\s*after getting into bed\s*8m/);
    expect(rows[1]).toHaveTextContent(/Deepest stretch\s*from 11:35 pm\s*45m/);
    expect(rows[2]).toHaveTextContent(/Longest dream sleep\s*from 5:10 am\s*30m/);
    expect(rows[3]).toHaveTextContent(/Woke during the night\s*3m at 3:35 am\s*1×/);
  });

  it('uses the night\'s own time to fall asleep when it has one', () => {
    render(<MomentsCard stages={MOCKUP_SEGMENTS} offset={MOCKUP_OFFSET} minutesToFallAsleep={12} />);

    expect(screen.getAllByTestId('moment-row')[0]).toHaveTextContent(/Fell asleep\s*after getting into bed\s*12m/);
  });

  it('leaves out highlights the night does not have', () => {
    render(<MomentsCard stages={[seg('LIGHT', 0, 60), seg('DEEP', 60, 100), seg('LIGHT', 100, 150)]} offset={0} minutesToFallAsleep={null} />);

    const rows = screen.getAllByTestId('moment-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent(/Fell asleep/);
    expect(rows[1]).toHaveTextContent(/Deepest stretch/);
    expect(screen.queryByText('Longest dream sleep')).toBeNull();
    expect(screen.queryByText('Woke during the night')).toBeNull();
  });
});
