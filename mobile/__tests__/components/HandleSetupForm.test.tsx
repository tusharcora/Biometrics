import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { fetchIdentity, saveIdentity } from '../../src/api/buddies';
import { HandleSetupForm } from '../../src/components/buddies/HandleSetupForm';
import { IdentityGate } from '../../src/components/buddies/IdentityGate';
import { Text } from 'react-native';

jest.mock('../../src/api/buddies', () => ({ ...jest.requireActual('../../src/api/buddies'), fetchIdentity: jest.fn(), saveIdentity: jest.fn() }));
const load = fetchIdentity as jest.Mock;
const save = saveIdentity as jest.Mock;
const NEW = { handle: null, displayName: null, displayNamePrefill: 'Sam', moodNoticeSeen: false };

beforeEach(() => jest.clearAllMocks());

it('prefills the display name and saves both fields on first setup', async () => {
  const onSaved = jest.fn();
  save.mockResolvedValue({ ...NEW, handle: 'sam_r', displayName: 'Sam' });
  render(<HandleSetupForm identity={NEW} mode="setup" onSaved={onSaved} />);
  expect(screen.getByTestId('display-name-input').props.value).toBe('Sam');
  fireEvent.changeText(screen.getByTestId('handle-input'), '@Sam_R');
  await act(async () => fireEvent.press(screen.getByTestId('handle-setup-save')));
  expect(save).toHaveBeenCalledWith({ handle: '@Sam_R', displayName: 'Sam' });
  expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ handle: 'sam_r' }));
});

it('starts empty when there is no prefill, and shows the server reason on failure', async () => {
  save.mockRejectedValue(Object.assign(new Error('x'), { status: 409, code: 'handle_taken' }));
  render(<HandleSetupForm identity={{ ...NEW, displayNamePrefill: '' }} mode="setup" onSaved={jest.fn()} />);
  expect(screen.getByTestId('display-name-input').props.value).toBe('');
  fireEvent.changeText(screen.getByTestId('handle-input'), 'sam');
  fireEvent.changeText(screen.getByTestId('display-name-input'), 'Sam');
  await act(async () => fireEvent.press(screen.getByTestId('handle-setup-save')));
  expect(screen.getByTestId('handle-setup-error')).toHaveTextContent('That handle is taken.');
});

it('in edit mode sends only what changed', async () => {
  save.mockResolvedValue({ ...NEW, handle: 'sam', displayName: 'Sammy' });
  render(<HandleSetupForm identity={{ ...NEW, handle: 'sam', displayName: 'Sam' }} mode="edit" onSaved={jest.fn()} />);
  fireEvent.changeText(screen.getByTestId('display-name-input'), 'Sammy');
  await act(async () => fireEvent.press(screen.getByTestId('handle-setup-save')));
  expect(save).toHaveBeenCalledWith({ displayName: 'Sammy' });
});

it('the gate shows setup until a handle exists, then the content', async () => {
  load.mockResolvedValue(NEW);
  save.mockResolvedValue({ ...NEW, handle: 'sam', displayName: 'Sam' });
  render(<IdentityGate>{(identity) => <Text testID="gated">{identity.handle}</Text>}</IdentityGate>);
  expect(await screen.findByTestId('handle-setup')).toBeTruthy();
  fireEvent.changeText(screen.getByTestId('handle-input'), 'sam');
  await act(async () => fireEvent.press(screen.getByTestId('handle-setup-save')));
  expect(screen.getByTestId('gated')).toHaveTextContent('sam');
});
