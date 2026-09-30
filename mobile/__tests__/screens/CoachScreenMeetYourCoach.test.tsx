import React from 'react';
import { act, render, waitFor } from '@testing-library/react-native';
import { CoachScreen } from '../../src/screens/CoachScreen';
import { fetchCoachStatus, fetchLatestConversation, type CoachStatusDTO } from '../../src/api/coach';
import { apiFetch } from '../../src/api/client';
import { withCharacter } from '../../jest-mocks/characterContext';
import type { CharacterContextValue } from '../../src/characters/CharacterContext';

jest.mock('../../src/api/coach', () => ({
  ...jest.requireActual('../../src/api/coach'),
  fetchCoachStatus: jest.fn(),
  fetchLatestConversation: jest.fn(),
  sendCoachMessage: jest.fn(),
}));

// The network layer under fetchCoachStatus, so a test can run the real status
// normalization instead of the mocked function.
jest.mock('../../src/api/client', () => ({
  ...jest.requireActual('../../src/api/client'),
  apiFetch: jest.fn(),
}));

jest.mock('../../src/lib/useKeyboardVisible', () => ({ useKeyboardVisible: jest.fn(() => false) }));

const mockNavigate = jest.fn();
let mockFocused = true;
let mockFocusListener: (() => void) | undefined;
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    setParams: jest.fn(),
    goBack: jest.fn(),
    isFocused: () => mockFocused,
    addListener: (_event: string, cb: () => void) => {
      mockFocusListener = cb;
      return () => {
        mockFocusListener = undefined;
      };
    },
  }),
  useRoute: () => ({ params: undefined }),
}));

const status: CoachStatusDTO = {
  enabled: true,
  consented: false,
  consent: { version: 'v1', summary: 's', dataItems: ['x'] },
  personaId: 'hoot',
  personaChosen: false,
  personas: [],
};

function renderCoach(overrides: Partial<CharacterContextValue> | null) {
  return render(overrides ? withCharacter(<CoachScreen />, overrides) : <CoachScreen />);
}

// Navigation calls by route name, in order.
function routes() {
  return mockNavigate.mock.calls.map((call) => call[0]);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFocused = true;
  mockFocusListener = undefined;
  (fetchCoachStatus as jest.Mock).mockResolvedValue(status);
  (fetchLatestConversation as jest.Mock).mockResolvedValue({ conversationId: null, messages: [] });
});

describe('CoachScreen: Meet your coach on the first visit', () => {
  it('opens the picker in first mode before the consent redirect', async () => {
    renderCoach({ status, statusLoaded: true, personaChosen: false });

    expect(mockNavigate).toHaveBeenCalledWith('MeetYourCoach', { mode: 'first' });
    // The picker now covers the tab; the status load settles without redirecting.
    mockFocused = false;
    await waitFor(() => expect(fetchCoachStatus).toHaveBeenCalled());
    await act(async () => {});
    expect(routes()).toEqual(['MeetYourCoach']);

    // Back from the picker: the focus reload sends the user to consent as before.
    mockFocused = true;
    await act(async () => {
      mockFocusListener?.();
    });
    await waitFor(() => expect(routes()).toEqual(['MeetYourCoach', 'CoachConsent']));
  });

  it("opens from the screen's own status when it settles before the provider's", async () => {
    renderCoach({ status: null, statusLoaded: false, personaChosen: false });

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('MeetYourCoach', { mode: 'first' }));
    expect(routes()).toEqual(['MeetYourCoach']);
  });

  it('still loads the chat underneath for a consented user', async () => {
    (fetchCoachStatus as jest.Mock).mockResolvedValue({ ...status, consented: true });
    const { findByTestId } = renderCoach({ status: { ...status, consented: true }, statusLoaded: true, personaChosen: false });

    expect(await findByTestId('coach-input')).toBeTruthy();
    expect(routes()).toEqual(['MeetYourCoach']);
  });

  it('opens at most once per mount, even if nothing was saved', async () => {
    renderCoach({ status, statusLoaded: true, personaChosen: false });
    await waitFor(() => expect(fetchCoachStatus).toHaveBeenCalledTimes(1));

    await act(async () => {
      mockFocusListener?.();
    });
    await act(async () => {
      mockFocusListener?.();
    });

    expect(routes().filter((r) => r === 'MeetYourCoach')).toHaveLength(1);
  });

  it('does not open once a character has been chosen', async () => {
    (fetchCoachStatus as jest.Mock).mockResolvedValue({ ...status, personaChosen: true });
    renderCoach({ status: { ...status, personaChosen: true }, statusLoaded: true, personaChosen: true });

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('CoachConsent', { prefill: undefined }));
    expect(routes()).not.toContain('MeetYourCoach');
  });

  it('never opens while the coach is disabled', async () => {
    (fetchCoachStatus as jest.Mock).mockResolvedValue({ ...status, enabled: false });
    const { findByTestId } = renderCoach({ status: { ...status, enabled: false }, statusLoaded: true, personaChosen: false });

    expect(await findByTestId('coach-unavailable')).toBeTruthy();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('does not open when the status request failed', async () => {
    (fetchCoachStatus as jest.Mock).mockRejectedValue(new Error('offline'));
    const { findByTestId } = renderCoach({ status: null, statusLoaded: true, personaChosen: false });

    expect(await findByTestId('coach-status-unverified')).toBeTruthy();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('does not open for a server that does not report personaChosen', async () => {
    // The real fetchCoachStatus runs over a server body without the field. Its
    // result feeds both paths: the screen's own load and the provider's status.
    const realFetchCoachStatus = jest.requireActual<typeof import('../../src/api/coach')>('../../src/api/coach').fetchCoachStatus;
    const { personaChosen: _omitted, ...legacy } = status;
    (apiFetch as jest.Mock).mockImplementation(async (path: string) => {
      if (path !== '/me/coach/status') throw new Error(`unexpected request ${path}`);
      return legacy;
    });
    (fetchCoachStatus as jest.Mock).mockImplementation(realFetchCoachStatus);
    const normalized = await realFetchCoachStatus();
    expect(normalized.enabled).toBe(true);

    renderCoach({ status: normalized, statusLoaded: true, personaChosen: false });

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('CoachConsent', { prefill: undefined }));
    expect(apiFetch).toHaveBeenCalledTimes(2);
    expect(routes()).not.toContain('MeetYourCoach');
  });

  it("follows the status, not the provider's own flag, for a status with no character id", async () => {
    // The provider's personaChosen stays at its initial false when the status
    // has an empty personaId; the status itself says chosen, so nothing opens.
    const noId = { ...status, personaId: '', personaChosen: true };
    (fetchCoachStatus as jest.Mock).mockResolvedValue(noId);
    renderCoach({ status: noId, statusLoaded: true, personaChosen: false });

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('CoachConsent', { prefill: undefined }));
    expect(routes()).not.toContain('MeetYourCoach');
  });
});
