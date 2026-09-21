import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContext } from '@react-navigation/native';
import { SettingsScreen } from '../../src/screens/SettingsScreen';
import { fetchCoachStatus, type CoachStatusDTO } from '../../src/api/coach';
import { getTimezoneState, listTimeZones } from '../../src/lib/timezone';
import { getPushState, enablePush, disablePush } from '../../src/lib/pushRegistration';

jest.mock('../../src/lib/timezone');
jest.mock('../../src/api/coach');
jest.mock('../../src/lib/pushRegistration');

const status: CoachStatusDTO = {
  enabled: true,
  consented: true,
  consent: { version: 'v1', summary: 's', dataItems: ['x'] },
  personaId: 'encouraging',
  personas: [{ id: 'encouraging', name: 'Encouraging', verbosity: 'normal', proactivity: 'threshold-triggered' }],
};

function renderSettings() {
  return render(
    <NavigationContext.Provider value={{ navigate: jest.fn() } as any}>
      <SettingsScreen />
    </NavigationContext.Provider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  (getTimezoneState as jest.Mock).mockResolvedValue({ timezone: 'UTC', overridden: false });
  (listTimeZones as jest.Mock).mockReturnValue([]);
  (fetchCoachStatus as jest.Mock).mockResolvedValue(status);
  (getPushState as jest.Mock).mockResolvedValue({ status: 'off' });
  (enablePush as jest.Mock).mockResolvedValue({ status: 'on' });
  (disablePush as jest.Mock).mockResolvedValue({ status: 'off' });
});

describe('SettingsScreen: weekly recap notifications', () => {
  it('shows the toggle, off, when the coach is enabled and consented', async () => {
    const { findByTestId, getByText } = renderSettings();

    const toggle = await findByTestId('push-toggle');
    expect(getByText('Weekly recap notifications')).toBeTruthy();
    expect(toggle.props.value).toBe(false);
  });

  it('shows the toggle on when push is registered', async () => {
    (getPushState as jest.Mock).mockResolvedValue({ status: 'on' });
    const { findByTestId } = renderSettings();

    await waitFor(async () => expect((await findByTestId('push-toggle')).props.value).toBe(true));
  });

  it('is hidden, and never touches push, when the coach is disabled', async () => {
    (fetchCoachStatus as jest.Mock).mockResolvedValue({ ...status, enabled: false });
    const { findByTestId, queryByTestId, queryByText } = renderSettings();

    await findByTestId('timezone-value');
    await waitFor(() => expect(fetchCoachStatus).toHaveBeenCalled());
    expect(queryByTestId('push-toggle')).toBeNull();
    expect(queryByText(/notifications/i)).toBeNull();
    expect(getPushState).not.toHaveBeenCalled();
    expect(enablePush).not.toHaveBeenCalled();
  });

  it('is hidden when the coach is enabled but not consented', async () => {
    (fetchCoachStatus as jest.Mock).mockResolvedValue({ ...status, consented: false });
    const { findByTestId, queryByTestId } = renderSettings();

    await findByTestId('coach-settings');
    expect(queryByTestId('push-toggle')).toBeNull();
    expect(getPushState).not.toHaveBeenCalled();
  });

  it('never requests permission just from rendering', async () => {
    const { findByTestId } = renderSettings();
    await findByTestId('push-toggle');
    expect(enablePush).not.toHaveBeenCalled();
  });

  it('enables push when toggled on', async () => {
    const { findByTestId } = renderSettings();

    fireEvent(await findByTestId('push-toggle'), 'valueChange', true);

    await waitFor(() => expect(enablePush).toHaveBeenCalledTimes(1));
    await waitFor(async () => expect((await findByTestId('push-toggle')).props.value).toBe(true));
  });

  it('disables push when toggled off', async () => {
    (getPushState as jest.Mock).mockResolvedValue({ status: 'on' });
    const { findByTestId } = renderSettings();
    await waitFor(async () => expect((await findByTestId('push-toggle')).props.value).toBe(true));

    fireEvent(await findByTestId('push-toggle'), 'valueChange', false);

    await waitFor(() => expect(disablePush).toHaveBeenCalledTimes(1));
    await waitFor(async () => expect((await findByTestId('push-toggle')).props.value).toBe(false));
  });

  it('explains how to unblock notifications when permission is denied', async () => {
    (enablePush as jest.Mock).mockResolvedValue({ status: 'denied' });
    const { findByTestId, findByText } = renderSettings();

    fireEvent(await findByTestId('push-toggle'), 'valueChange', true);

    expect(await findByText('Notifications are blocked — enable them in system settings')).toBeTruthy();
    expect((await findByTestId('push-toggle')).props.value).toBe(false);
  });

  it('shows the blocked message on load when the system already denied notifications', async () => {
    (getPushState as jest.Mock).mockResolvedValue({ status: 'denied' });
    const { findByText } = renderSettings();

    expect(await findByText('Notifications are blocked — enable them in system settings')).toBeTruthy();
  });

  it("says notifications aren't available in this build", async () => {
    (getPushState as jest.Mock).mockResolvedValue({ status: 'unavailable', reason: 'no_project_id' });
    const { findByText } = renderSettings();

    expect(await findByText("Notifications aren't available in this build")).toBeTruthy();
  });

  it("switches to the unavailable message when enabling finds no push support", async () => {
    (enablePush as jest.Mock).mockResolvedValue({ status: 'unavailable', reason: 'simulator' });
    const { findByTestId, findByText } = renderSettings();

    fireEvent(await findByTestId('push-toggle'), 'valueChange', true);

    expect(await findByText("Notifications aren't available in this build")).toBeTruthy();
    expect((await findByTestId('push-toggle')).props.value).toBe(false);
  });

  it('says so when registration failed', async () => {
    (enablePush as jest.Mock).mockResolvedValue({ status: 'error', reason: 'offline' });
    const { findByTestId, findByTestId: find, findByText } = renderSettings();

    fireEvent(await findByTestId('push-toggle'), 'valueChange', true);

    expect(await findByText(/could not be turned on/i)).toBeTruthy();
    expect((await find('push-toggle')).props.value).toBe(false);
  });

  it('keeps the rest of the coach section working when the push state cannot be read', async () => {
    (getPushState as jest.Mock).mockRejectedValue(new Error('boom'));
    const { findByTestId } = renderSettings();

    expect(await findByTestId('persona-option-encouraging')).toBeTruthy();
  });
});
