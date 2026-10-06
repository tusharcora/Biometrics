import React from 'react';
import { Pressable, Text } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { confirmMoodNotice } from '../../src/api/buddies';
import { MoodNoticeSheet } from '../../src/components/buddies/MoodNoticeSheet';
import { useMoodNoticeGate } from '../../src/components/buddies/useMoodNoticeGate';

jest.mock('../../src/api/buddies', () => ({ confirmMoodNotice: jest.fn() }));
const confirm = confirmMoodNotice as jest.Mock;

function Harness({ seen, action }: { seen: boolean; action: () => void }) {
  const gate = useMoodNoticeGate(seen);
  return (
    <>
      <Pressable testID="pair-action" onPress={() => gate.run(action)}><Text>Pair</Text></Pressable>
      <MoodNoticeSheet {...gate.sheet} />
    </>
  );
}

beforeEach(() => jest.clearAllMocks());

it('shows the notice once before the first pairing action, then runs it; later actions go straight through', async () => {
  confirm.mockResolvedValue(undefined);
  const action = jest.fn();
  render(<Harness seen={false} action={action} />);
  fireEvent.press(screen.getByTestId('pair-action'));
  expect(await screen.findByTestId('mood-notice')).toBeTruthy();
  expect(action).not.toHaveBeenCalled();
  await act(async () => fireEvent.press(screen.getByTestId('mood-notice-confirm')));
  expect(confirm).toHaveBeenCalledTimes(1);
  expect(action).toHaveBeenCalledTimes(1);
  fireEvent.press(screen.getByTestId('pair-action'));
  expect(action).toHaveBeenCalledTimes(2);
  expect(confirm).toHaveBeenCalledTimes(1);
});

it('never shows for someone who already saw it; a failed confirm keeps the action back', async () => {
  const action = jest.fn();
  const first = render(<Harness seen action={action} />);
  fireEvent.press(screen.getByTestId('pair-action'));
  expect(action).toHaveBeenCalledTimes(1);
  first.unmount();

  confirm.mockRejectedValue(new Error('offline'));
  render(<Harness seen={false} action={action} />);
  fireEvent.press(screen.getByTestId('pair-action'));
  await act(async () => fireEvent.press(await screen.findByTestId('mood-notice-confirm')));
  expect(action).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId('mood-notice-failed')).toBeTruthy();
});
