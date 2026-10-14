import React from 'react';
import { HIDDEN_OK } from '../../jest-mocks/coachStatus';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { CoachConsentScreen } from '../../src/screens/CoachConsentScreen';
import { acceptCoachConsent, fetchCoachStatus, StaleConsentVersionError, type CoachStatusDTO } from '../../src/api/coach';

jest.mock('../../src/api/coach', () => ({
  ...jest.requireActual('../../src/api/coach'),
  fetchCoachStatus: jest.fn(),
  acceptCoachConsent: jest.fn(),
  revokeCoachConsent: jest.fn(),
}));

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
let mockParams: unknown;
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack, navigate: mockNavigate }),
  useRoute: () => ({ params: mockParams }),
}));

const status: CoachStatusDTO = {
  enabled: true,
  consented: false,
  consent: {
    version: 'v1',
    summary: 'To answer, the coach sends your scores to an AI provider. Raw Google Health tokens never leave the server.',
    dataItems: ['Recovery and Sleep Score values', 'Per-factor breakdowns', 'Habit pattern results'],
  },
  personaId: 'kit',
  personaChosen: true,
  personas: [],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = undefined;
  (fetchCoachStatus as jest.Mock).mockResolvedValue(status);
  (acceptCoachConsent as jest.Mock).mockResolvedValue({ consented: true });
});

describe('CoachConsentScreen', () => {
  it('shows the server-provided summary and every data item verbatim', async () => {
    const { findByText } = render(<CoachConsentScreen />);

    expect(await findByText(status.consent.summary)).toBeTruthy();
    for (const item of status.consent.dataItems) {
      expect(await findByText(item)).toBeTruthy();
    }
  });

  it('announces its heading as a header, like the hosted consent screen', async () => {
    const { findByRole } = render(<CoachConsentScreen />);

    expect(await findByRole('header', { name: 'Before you use KIP coaching' })).toBeTruthy();
  });

  it('says plainly that declining changes nothing else in the app', async () => {
    const { findByTestId } = render(<CoachConsentScreen />);

    expect(await findByTestId('coach-consent-decline-note')).toHaveTextContent(/^Choosing not to turn on KIP coaching changes nothing else in the app/);
  });

  it('requires an explicit action: no checkbox, and nothing is sent until "I agree" is pressed', async () => {
    const { findByTestId, queryByRole } = render(<CoachConsentScreen />);
    await findByTestId('coach-consent-agree');

    expect(queryByRole('checkbox')).toBeNull();
    expect(queryByRole('switch')).toBeNull();
    expect(acceptCoachConsent).not.toHaveBeenCalled();
  });

  it('accepts the version the server offered, then opens the chat carrying any prefill', async () => {
    mockParams = { prefill: 'Why did my score change today?' };
    const { findByTestId } = render(<CoachConsentScreen />);

    fireEvent.press(await findByTestId('coach-consent-agree'));

    await waitFor(() => expect(acceptCoachConsent).toHaveBeenCalledWith('v1'));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('Tabs', { screen: 'Coach', params: { prefill: 'Why did my score change today?' } }, { pop: true }));
  });

  it('"Not now" leaves the coach off: goes back and never calls the consent API', async () => {
    const { findByTestId } = render(<CoachConsentScreen />);

    fireEvent.press(await findByTestId('coach-consent-decline'));

    expect(mockGoBack).toHaveBeenCalledTimes(1);
    expect(acceptCoachConsent).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('re-shows the new text when the consent version changed (409), and agrees to the new version', async () => {
    (acceptCoachConsent as jest.Mock).mockRejectedValueOnce(new StaleConsentVersionError());
    const updated: CoachStatusDTO = {
      ...status,
      consent: { version: 'v2', summary: 'Updated: a second provider may also process your scores.', dataItems: ['Recovery and Sleep Score values'] },
    };
    const { findByTestId, findByText } = render(<CoachConsentScreen />);
    fireEvent.press(await findByTestId('coach-consent-agree'));

    (fetchCoachStatus as jest.Mock).mockResolvedValue(updated);
    expect(await findByText(updated.consent.summary)).toBeTruthy();
    expect(await findByTestId('coach-consent-updated-note')).toBeTruthy();
    expect(mockNavigate).not.toHaveBeenCalled();

    fireEvent.press(await findByTestId('coach-consent-agree'));
    await waitFor(() => expect(acceptCoachConsent).toHaveBeenLastCalledWith('v2'));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('Tabs', { screen: 'Coach' }, { pop: true }));
  });

  it('shows an error and stays put when accepting fails', async () => {
    (acceptCoachConsent as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    const { findByTestId } = render(<CoachConsentScreen />);

    fireEvent.press(await findByTestId('coach-consent-agree'));

    expect(await findByTestId('coach-consent-error')).toBeTruthy();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('skips straight to the chat when the server already reports consent', async () => {
    (fetchCoachStatus as jest.Mock).mockResolvedValue({ ...status, consented: true });
    mockParams = { prefill: 'Hi' };
    render(<CoachConsentScreen />);

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('Tabs', { screen: 'Coach', params: { prefill: 'Hi' } }, { pop: true }));
  });

  it('renders no consent controls when the coach is disabled', async () => {
    (fetchCoachStatus as jest.Mock).mockResolvedValue({ ...status, enabled: false });
    const { findByTestId, queryByTestId } = render(<CoachConsentScreen />);

    expect(await findByTestId('coach-consent-unavailable')).toHaveTextContent("KIP isn't available right now.");
    expect(queryByTestId('coach-consent-agree')).toBeNull();
  });

  it('offers a retry when the status cannot be loaded', async () => {
    (fetchCoachStatus as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    const { findByTestId } = render(<CoachConsentScreen />);

    fireEvent.press(await findByTestId('coach-consent-retry'));

    expect(await findByTestId('coach-consent-agree')).toBeTruthy();
  });
});

describe('CoachConsentScreen: review mode', () => {
  it('shows a consented user what is sent, without sending them on or asking again', async () => {
    (fetchCoachStatus as jest.Mock).mockResolvedValue({ ...status, consented: true });
    mockParams = { review: true };
    const { findByText, getByText, queryByTestId, getByTestId } = render(<CoachConsentScreen />);

    expect(await findByText(status.consent.summary)).toBeTruthy();
    for (const item of status.consent.dataItems) expect(getByText(item)).toBeTruthy();
    expect(getByTestId('coach-consent-review')).toBeTruthy();
    expect(queryByTestId('coach-consent-agree')).toBeNull();
    expect(queryByTestId('coach-consent-decline')).toBeNull();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('still asks for consent in review mode when it is not held', async () => {
    mockParams = { review: true };
    const { findByTestId } = render(<CoachConsentScreen />);

    expect(await findByTestId('coach-consent-agree')).toBeTruthy();
  });
});

describe('CoachConsentScreen: KIP', () => {
  it('shows your KIP above the consent text', async () => {
    const utils = render(<CoachConsentScreen />);
    await utils.findByText(status.consent.summary);

    expect(utils.getByTestId('coach-consent-kip', HIDDEN_OK)).toBeTruthy();
  });
});
