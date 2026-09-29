import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { CoachScreen } from '../../src/screens/CoachScreen';
import { fetchCoachStatus, fetchLatestConversation, sendCoachMessage, type CoachReplyDTO, type CoachStatusDTO } from '../../src/api/coach';

jest.mock('../../src/api/coach', () => ({
  ...jest.requireActual('../../src/api/coach'),
  fetchCoachStatus: jest.fn(),
  fetchLatestConversation: jest.fn(),
  sendCoachMessage: jest.fn(),
}));

jest.mock('../../src/lib/useKeyboardVisible', () => ({ useKeyboardVisible: jest.fn(() => false) }));

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, setParams: jest.fn(), addListener: () => () => undefined }),
  useRoute: () => ({ params: undefined }),
}));

const status: CoachStatusDTO = {
  enabled: true,
  consented: true,
  consent: { version: 'v1', summary: 's', dataItems: ['x'] },
  personaId: 'encouraging',
  personas: [],
};

function reply(text: string): CoachReplyDTO {
  return {
    conversationId: 'conv-1',
    message: { id: `m-${text}`, role: 'assistant', text, source: 'model', createdAt: '2026-09-20T10:00:00.000Z' },
  };
}

async function openChat() {
  const utils = render(<CoachScreen />);
  await utils.findByTestId('coach-input');
  return utils;
}

beforeEach(() => {
  jest.clearAllMocks();
  (fetchCoachStatus as jest.Mock).mockResolvedValue(status);
  (fetchLatestConversation as jest.Mock).mockResolvedValue({ conversationId: null, messages: [] });
});

describe('CoachScreen: redesign affordances', () => {
  it('offers one-tap starter questions on an empty conversation, sending the full prompt', async () => {
    (sendCoachMessage as jest.Mock).mockResolvedValue(reply('You slept well.'));
    const utils = await openChat();

    fireEvent.press(utils.getByTestId('coach-suggestion-sleep'));

    await waitFor(() => expect(sendCoachMessage).toHaveBeenCalledWith({ message: 'How did I sleep last night, and what stood out?' }));
    expect(await utils.findByText('You slept well.')).toBeTruthy();
    // The starters belong to the empty state only.
    expect(utils.queryByTestId('coach-suggestion-sleep')).toBeNull();
  });

  it('leaves the field as typed when a starter is sent', async () => {
    (sendCoachMessage as jest.Mock).mockResolvedValue(reply('Sure.'));
    const utils = await openChat();
    fireEvent.changeText(utils.getByTestId('coach-input'), 'half-written thought');

    fireEvent.press(utils.getByTestId('coach-suggestion-patterns'));

    await utils.findByText('Sure.');
    expect(utils.getByTestId('coach-input').props.value).toBe('half-written thought');
  });

  it('opens what the coach remembers from the header', async () => {
    const utils = await openChat();

    fireEvent.press(utils.getByTestId('coach-memory-button'));

    expect(mockNavigate).toHaveBeenCalledWith('CoachMemory');
  });

  it('hides the memory entry while the coach status is unconfirmed', async () => {
    (fetchCoachStatus as jest.Mock).mockRejectedValue(new Error('offline'));
    const utils = await openChat();

    expect(utils.queryByTestId('coach-memory-button')).toBeNull();
  });
});
