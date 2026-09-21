import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContext } from '@react-navigation/native';
import { SettingsScreen } from '../../src/screens/SettingsScreen';
import { fetchCoachStatus, type CoachStatusDTO } from '../../src/api/coach';
import { getTimezoneState, listTimeZones } from '../../src/lib/timezone';

jest.mock('../../src/lib/timezone');
jest.mock('../../src/api/coach');

const status: CoachStatusDTO = {
  enabled: true,
  consented: true,
  consent: { version: 'v1', summary: 's', dataItems: ['x'] },
  personaId: 'encouraging',
  personas: [{ id: 'encouraging', name: 'Encouraging', verbosity: 'normal', proactivity: 'threshold-triggered' }],
};

const navigate = jest.fn();
function renderSettings() {
  return render(
    <NavigationContext.Provider value={{ navigate } as any}>
      <SettingsScreen />
    </NavigationContext.Provider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  (getTimezoneState as jest.Mock).mockResolvedValue({ timezone: 'UTC', overridden: false });
  (listTimeZones as jest.Mock).mockReturnValue([]);
  (fetchCoachStatus as jest.Mock).mockResolvedValue(status);
});

describe('SettingsScreen: Coach Memory entry', () => {
  it('has a Coach Memory row that opens the memory screen', async () => {
    const { findByTestId } = renderSettings();

    const row = await findByTestId('coach-memory-row');
    expect(row).toHaveTextContent(/Coach Memory/);
    fireEvent.press(row);

    expect(navigate).toHaveBeenCalledWith('CoachMemory');
  });

  it('is absent when the coach is disabled', async () => {
    (fetchCoachStatus as jest.Mock).mockResolvedValue({ ...status, enabled: false });
    const { findByTestId, queryByTestId } = renderSettings();

    await findByTestId('timezone-value');
    await waitFor(() => expect(fetchCoachStatus).toHaveBeenCalled());
    expect(queryByTestId('coach-memory-row')).toBeNull();
  });

  it('is absent when enabled but not consented', async () => {
    (fetchCoachStatus as jest.Mock).mockResolvedValue({ ...status, consented: false });
    const { findByTestId, queryByTestId } = renderSettings();

    await findByTestId('coach-setup-button');
    expect(queryByTestId('coach-memory-row')).toBeNull();
  });
});
