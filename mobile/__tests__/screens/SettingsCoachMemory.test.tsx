import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContext } from '@react-navigation/native';
import { ProfileSectionScreen } from '../../src/screens/ProfileSectionScreen';
import { fetchCoachStatus, listCoachMemory, type CoachStatusDTO } from '../../src/api/coach';
import { getTimezoneState, listTimeZones } from '../../src/lib/timezone';

jest.mock('../../src/lib/timezone');
jest.mock('../../src/api/coach');

const status: CoachStatusDTO = {
  enabled: true,
  consented: true,
  consent: { version: 'v1', summary: 's', dataItems: ['x'] },
  personaId: 'kit',
  personaChosen: true,
  personas: [{ id: 'kit', name: 'Kit', verbosity: 'terse', proactivity: 'threshold-triggered', tagline: null, greeting: null }],
};

const navigate = jest.fn();
function renderSettings() {
  return render(
    <NavigationContext.Provider value={{ navigate } as any}>
      <ProfileSectionScreen route={{ params: { section: 'kip' } }} />
    </NavigationContext.Provider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  (getTimezoneState as jest.Mock).mockResolvedValue({ timezone: 'UTC', overridden: false });
  (listTimeZones as jest.Mock).mockReturnValue([]);
  (fetchCoachStatus as jest.Mock).mockResolvedValue(status);
  (listCoachMemory as jest.Mock).mockResolvedValue([{ id: 'm1' }]);
});

describe('Profile → KIP: What KIP remembers', () => {
  it('has a What KIP remembers row, with the count, that opens the memory screen', async () => {
    const { findByTestId, findByText } = renderSettings();

    const row = await findByTestId('kip-memory-row');
    expect(row).toHaveTextContent(/What KIP remembers/);
    expect(await findByText('See, edit or delete · 1 thing')).toBeTruthy();
    fireEvent.press(row);

    expect(navigate).toHaveBeenCalledWith('CoachMemory');
  });

  it('is absent when the coach is disabled', async () => {
    (fetchCoachStatus as jest.Mock).mockResolvedValue({ ...status, enabled: false });
    const { queryByTestId } = renderSettings();

    await waitFor(() => expect(fetchCoachStatus).toHaveBeenCalled());
    expect(queryByTestId('kip-memory-row')).toBeNull();
    expect(listCoachMemory).not.toHaveBeenCalled();
  });

  it('is absent when enabled but not consented', async () => {
    (fetchCoachStatus as jest.Mock).mockResolvedValue({ ...status, consented: false });
    const { findByTestId, queryByTestId } = renderSettings();

    await findByTestId('coach-setup-button');
    expect(queryByTestId('kip-memory-row')).toBeNull();
  });
});
