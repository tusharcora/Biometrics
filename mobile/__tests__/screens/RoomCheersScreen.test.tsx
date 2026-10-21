import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { fetchRoomCheers } from '../../src/api/rooms';
import { RoomCheersScreen } from '../../src/screens/RoomCheersScreen';

jest.mock('../../src/api/rooms', () => ({ fetchRoomCheers: jest.fn() }));
const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ goBack: mockGoBack }) }));

beforeEach(() => jest.clearAllMocks());

it('shows who cheered your room this week (spec §10.2)', async () => {
  (fetchRoomCheers as jest.Mock).mockResolvedValue({ count: 2, cheers: [{ name: 'Maya', day: '2026-10-27' }, { name: 'Jo', day: '2026-10-26' }] });
  render(<RoomCheersScreen />);
  await act(async () => undefined);
  expect(screen.getByTestId('cheers-title')).toHaveTextContent('Cheers on your room');
  expect(screen.getAllByTestId(/^cheer-row-/).map((r) => r.props.children)).toEqual(['Maya', 'Jo']);
});

it('says when no one has cheered yet, and closes with its own Close button (PF4-F16)', async () => {
  (fetchRoomCheers as jest.Mock).mockResolvedValue({ count: 0, cheers: [] });
  render(<RoomCheersScreen />);
  await act(async () => undefined);
  expect(screen.getByTestId('cheers-none')).toHaveTextContent('No cheers this week yet.');
  fireEvent.press(screen.getByTestId('cheers-close'));
  expect(mockGoBack).toHaveBeenCalled();
});

it('a failed read says so, not that no one cheered', async () => {
  (fetchRoomCheers as jest.Mock).mockRejectedValue(new Error('network'));
  render(<RoomCheersScreen />);
  await act(async () => undefined);
  expect(screen.queryByTestId('cheers-none')).toBeNull();
  expect(screen.getByTestId('cheers-failed')).toHaveTextContent("Couldn't load the cheers just now.");
});
