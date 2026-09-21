import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { CoachScreen } from '../../src/screens/CoachScreen';
import {
  deleteCoachMemory,
  fetchCoachStatus,
  fetchLatestConversation,
  sendCoachMessage,
  type CoachReplyDTO,
  type CoachStatusDTO,
  type MemoryDTO,
} from '../../src/api/coach';

jest.mock('../../src/api/coach', () => ({
  ...jest.requireActual('../../src/api/coach'),
  fetchCoachStatus: jest.fn(),
  fetchLatestConversation: jest.fn(),
  sendCoachMessage: jest.fn(),
  updateCoachMemory: jest.fn(),
  deleteCoachMemory: jest.fn(),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ replace: jest.fn(), navigate: jest.fn(), goBack: jest.fn() }),
  useRoute: () => ({ params: undefined }),
}));

const status: CoachStatusDTO = {
  enabled: true,
  consented: true,
  consent: { version: 'v1', summary: 's', dataItems: ['x'] },
  personaId: 'encouraging',
  personas: [],
};

const proposal: MemoryDTO = { id: 'm1', category: 'SCHEDULE', value: 'Trains at 6am', status: 'PENDING', createdAt: '2026-09-20T00:00:00.000Z' };

function reply(text: string, memoryProposals?: MemoryDTO[]): CoachReplyDTO {
  return {
    conversationId: 'conv-1',
    message: { id: `a-${text}`, role: 'assistant', text, source: 'model', createdAt: '2026-09-20T10:00:00.000Z' },
    ...(memoryProposals ? { memoryProposals } : {}),
  };
}

async function ask(text: string) {
  const utils = render(<CoachScreen />);
  fireEvent.changeText(await utils.findByTestId('coach-input'), text);
  fireEvent.press(utils.getByTestId('coach-send-button'));
  return utils;
}

beforeEach(() => {
  jest.clearAllMocks();
  (fetchCoachStatus as jest.Mock).mockResolvedValue(status);
  (fetchLatestConversation as jest.Mock).mockResolvedValue({ conversationId: null, messages: [] });
  (deleteCoachMemory as jest.Mock).mockResolvedValue(undefined);
});

describe('CoachScreen: memory proposals', () => {
  it('shows an "I\'ll remember" line under the reply, alongside the reply text', async () => {
    (sendCoachMessage as jest.Mock).mockResolvedValue(reply('Got it, mornings then.', [proposal]));
    const { findByTestId, getByText } = await ask('I train at 6am');

    expect(await findByTestId('memory-chip-m1')).toHaveTextContent("I'll remember: Trains at 6am");
    expect(getByText('Got it, mornings then.')).toBeTruthy();
  });

  it('shows no memory line when the reply carries no proposals', async () => {
    (sendCoachMessage as jest.Mock).mockResolvedValue(reply('Nice work.'));
    const { findByText, queryByText } = await ask('hello');

    await findByText('Nice work.');
    expect(queryByText(/I'll remember/)).toBeNull();
  });

  it('undo from the chat deletes the entry', async () => {
    (sendCoachMessage as jest.Mock).mockResolvedValue(reply('Got it.', [proposal]));
    const { findByTestId, queryByTestId } = await ask('I train at 6am');

    fireEvent.press(await findByTestId('memory-chip-undo-m1'));

    await waitFor(() => expect(deleteCoachMemory).toHaveBeenCalledWith('m1'));
    await waitFor(() => expect(queryByTestId('memory-chip-m1')).toBeNull());
  });
});
