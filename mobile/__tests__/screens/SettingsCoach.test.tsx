import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContext } from '@react-navigation/native';
import { SettingsScreen } from '../../src/screens/SettingsScreen';
import { fetchCoachStatus, revokeCoachConsent, setCoachPersona, type CoachStatusDTO } from '../../src/api/coach';
import { getTimezoneState, listTimeZones } from '../../src/lib/timezone';

jest.mock('../../src/lib/timezone');
jest.mock('../../src/api/coach');

const status: CoachStatusDTO = {
  enabled: true,
  consented: true,
  consent: { version: 'v1', summary: 's', dataItems: ['x'] },
  personaId: 'encouraging',
  personas: [
    { id: 'encouraging', name: 'Encouraging', verbosity: 'normal', proactivity: 'threshold-triggered' },
    { id: 'direct', name: 'Direct', verbosity: 'terse', proactivity: 'reactive-only' },
  ],
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
  (setCoachPersona as jest.Mock).mockResolvedValue({ personaId: 'direct' });
  (revokeCoachConsent as jest.Mock).mockResolvedValue(undefined);
});

describe('SettingsScreen: AI Coach', () => {
  it('shows nothing about the coach when it is disabled', async () => {
    (fetchCoachStatus as jest.Mock).mockResolvedValue({ ...status, enabled: false });
    const { findByTestId, queryByTestId, queryByText } = renderSettings();

    await findByTestId('timezone-value');
    await waitFor(() => expect(fetchCoachStatus).toHaveBeenCalled());
    expect(queryByTestId('coach-settings')).toBeNull();
    expect(queryByText(/coach/i)).toBeNull();
  });

  it('lists the server personas and marks the current one', async () => {
    const { findByTestId } = renderSettings();

    const current = await findByTestId('persona-option-encouraging');
    const other = await findByTestId('persona-option-direct');
    expect(current.props.accessibilityState).toEqual(expect.objectContaining({ selected: true }));
    expect(other.props.accessibilityState).toEqual(expect.objectContaining({ selected: false }));
    expect(current).toHaveTextContent(/Encouraging/);
    expect(other).toHaveTextContent(/Direct/);
  });

  it('saves a newly picked persona and marks it selected', async () => {
    const { findByTestId } = renderSettings();

    fireEvent.press(await findByTestId('persona-option-direct'));

    await waitFor(() => expect(setCoachPersona).toHaveBeenCalledWith('direct'));
    await waitFor(async () =>
      expect((await findByTestId('persona-option-direct')).props.accessibilityState).toEqual(expect.objectContaining({ selected: true })),
    );
  });

  it('puts the previous persona back and says so when saving fails', async () => {
    (setCoachPersona as jest.Mock).mockRejectedValue(new Error('offline'));
    const { findByTestId } = renderSettings();

    fireEvent.press(await findByTestId('persona-option-direct'));

    expect(await findByTestId('persona-error')).toBeTruthy();
    expect((await findByTestId('persona-option-encouraging')).props.accessibilityState).toEqual(expect.objectContaining({ selected: true }));
  });

  it('revokes consent with DELETE and switches the section to its "off" state', async () => {
    const { findByTestId, queryByTestId } = renderSettings();

    fireEvent.press(await findByTestId('coach-revoke-button'));

    await waitFor(() => expect(revokeCoachConsent).toHaveBeenCalledTimes(1));
    expect(await findByTestId('coach-setup-button')).toBeTruthy();
    expect(queryByTestId('persona-option-direct')).toBeNull();
    expect(queryByTestId('coach-revoke-button')).toBeNull();
  });

  it('keeps consent shown as on, with an error, if revoking fails', async () => {
    (revokeCoachConsent as jest.Mock).mockRejectedValue(new Error('offline'));
    const { findByTestId } = renderSettings();

    fireEvent.press(await findByTestId('coach-revoke-button'));

    expect(await findByTestId('coach-revoke-error')).toBeTruthy();
    expect(await findByTestId('coach-revoke-button')).toBeTruthy();
  });

  it('offers to set up the coach (via consent) when enabled but not consented', async () => {
    (fetchCoachStatus as jest.Mock).mockResolvedValue({ ...status, consented: false });
    const { findByTestId, queryByTestId } = renderSettings();

    fireEvent.press(await findByTestId('coach-setup-button'));

    expect(navigate).toHaveBeenCalledWith('CoachConsent');
    expect(queryByTestId('persona-option-direct')).toBeNull();
  });
});
