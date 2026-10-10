import React from 'react';
import { characterLabel, withCharacter } from '../../jest-mocks/characterContext';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ScoreDetailScreen } from '../../src/screens/ScoreDetailScreen';
import { fetchScoreDetail, type ScoreDetailDTO } from '../../src/api/scores';
import { fetchCoachStatus, type CoachStatusDTO } from '../../src/api/coach';

jest.mock('../../src/api/scores');
jest.mock('../../src/api/coach');

const mockNavigate = jest.fn();
const mockReplace = jest.fn();
let mockParams: unknown;
jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({ params: mockParams }),
  useNavigation: () => ({ setOptions: jest.fn(), navigate: mockNavigate, replace: mockReplace }),
}));

const detail: ScoreDetailDTO = {
  score: {
    date: '2026-09-19',
    type: 'SLEEP',
    score: 78,
    confidenceLevel: 'MEDIUM',
    algorithmVersion: 'v1',
    factors: [{ factor: 'SLEEP_EFFICIENCY', label: 'Sleep efficiency', z: 1.2, weight: 0.35, contribution: 0.42, points: 8.2, imputed: false, excluded: false }],
    coldStart: [],
  },
  baselines: [],
  previous: { date: '2026-09-18', score: 70 },
};

const status: CoachStatusDTO = {
  enabled: true,
  consented: true,
  consent: { version: 'v1', summary: 's', dataItems: ['x'] },
  personaId: 'mochi',
  personaChosen: true,
  personas: [],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = { date: '2026-09-19', type: 'SLEEP' };
  (fetchScoreDetail as jest.Mock).mockResolvedValue(detail);
  (fetchCoachStatus as jest.Mock).mockResolvedValue(status);
});

describe('ScoreDetailScreen: Ask about this', () => {
  it('opens the chat with a prefilled question that contains no numbers', async () => {
    const { findByTestId } = render(<ScoreDetailScreen />);

    fireEvent.press(await findByTestId('ask-coach-button'));

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    const [route, args, options] = mockNavigate.mock.calls[0];
    expect(route).toBe('Tabs');
    // pop: reuse the existing Tabs route rather than pushing a second one over this screen.
    expect(options).toEqual({ pop: true });
    expect(args.screen).toBe('Coach');
    expect(args.params.prefill).toMatch(/why did my sleep score change today/i);
    expect(args.params.prefill).not.toMatch(/\d/);
    // Neither the score (78) nor the date leaks into the prompt.
    expect(args.params.prefill).not.toContain('78');
    expect(args.params.prefill).not.toContain('2026');
  });

  it('goes through the consent flow when the coach is enabled but not consented', async () => {
    (fetchCoachStatus as jest.Mock).mockResolvedValue({ ...status, consented: false });
    const { findByTestId } = render(<ScoreDetailScreen />);

    fireEvent.press(await findByTestId('ask-coach-button'));

    expect(mockNavigate).toHaveBeenCalledWith('CoachConsent', expect.objectContaining({ prefill: expect.any(String) }));
  });

  it('renders no button when the coach is disabled', async () => {
    (fetchCoachStatus as jest.Mock).mockResolvedValue({ ...status, enabled: false, consented: true });
    const { findByTestId, queryByTestId } = render(<ScoreDetailScreen />);

    await findByTestId('score-headline');
    await waitFor(() => expect(fetchCoachStatus).toHaveBeenCalled());
    expect(queryByTestId('ask-coach-button')).toBeNull();
  });

  it('renders no button when the status request fails, and the score still shows', async () => {
    (fetchCoachStatus as jest.Mock).mockRejectedValue(new Error('offline'));
    const { findByTestId, queryByTestId } = render(<ScoreDetailScreen />);

    expect(await findByTestId('score-headline')).toBeTruthy();
    await waitFor(() => expect(fetchCoachStatus).toHaveBeenCalled());
    expect(queryByTestId('ask-coach-button')).toBeNull();
  });
});

describe('ScoreDetailScreen: coach character', () => {
  it("shows the user's character on the Ask Coach button", async () => {
    const utils = render(withCharacter(<ScoreDetailScreen />, { characterId: 'sprout', status }));
    await utils.findByTestId('ask-coach-button');

    expect(characterLabel(utils, 'ask-coach-character')).toBe('character:sprout:idle:40:playing:none');
  });
});
