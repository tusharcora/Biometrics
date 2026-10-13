import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { KipColourSection } from '../../src/components/profile/KipColourSection';
import { saveKipColour } from '../../src/api/kip';
import { getMyKipColour, resetMyKipColour, setMyKipColour } from '../../src/lib/kip/myKipColour';

jest.mock('../../src/api/kip', () => ({ saveKipColour: jest.fn() }));
const save = saveKipColour as jest.Mock;

beforeEach(() => {
  save.mockReset();
  resetMyKipColour();
});

it('shows your colour in the preview and as the checked radio among 10', () => {
  act(() => setMyKipColour('lilac'));
  render(<KipColourSection />);
  expect(screen.getByText('Lilac · #C4B5FD')).toBeTruthy();
  expect(screen.getByLabelText('Your KIP in Lilac')).toBeTruthy();
  const group = screen.getByTestId('kip-colour-swatches');
  expect(group.props.accessibilityRole).toBe('radiogroup');
  expect(group.props.accessibilityLabel).toBe('KIP colour');
  const radios = screen.getAllByRole('radio');
  expect(radios).toHaveLength(10);
  expect(screen.getByTestId('kip-swatch-lilac').props.accessibilityState).toMatchObject({ checked: true });
  expect(screen.getByTestId('kip-swatch-coral').props.accessibilityState).toMatchObject({ checked: false });
  expect(screen.getByText('Buddies see this colour')).toBeTruthy();
});

it('follows your colour when it loads after the page opens, until you pick', () => {
  render(<KipColourSection />);
  act(() => setMyKipColour('sky'));
  expect(screen.getByText('Sky · #7DD3FC')).toBeTruthy();
  expect(screen.getByTestId('kip-colour-save').props.accessibilityState).toMatchObject({ disabled: true });
});

it('picking changes only the preview until Save, which is off until the pick differs', () => {
  render(<KipColourSection />);
  expect(screen.getByTestId('kip-colour-save').props.accessibilityState).toMatchObject({ disabled: true });
  fireEvent.press(screen.getByTestId('kip-swatch-mint'));
  expect(screen.getByText('Mint · #6EE7B7')).toBeTruthy();
  expect(getMyKipColour()).toBe('coral');
  expect(screen.getByTestId('kip-colour-save').props.accessibilityState).toMatchObject({ disabled: false });
});

it('Save stores the colour for every screen', async () => {
  save.mockResolvedValue({ kipColour: 'mint' });
  render(<KipColourSection />);
  fireEvent.press(screen.getByTestId('kip-swatch-mint'));
  fireEvent.press(screen.getByTestId('kip-colour-save'));
  await waitFor(() => expect(getMyKipColour()).toBe('mint'));
  expect(save).toHaveBeenCalledWith('mint');
  expect(screen.getByTestId('kip-colour-save').props.accessibilityState).toMatchObject({ disabled: true });
  expect(screen.getByTestId('kip-swatch-mint').props.accessibilityState).toMatchObject({ checked: true });
});

it('a failed save keeps the old colour and offers Try again', async () => {
  save.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ kipColour: 'ink' });
  render(<KipColourSection />);
  fireEvent.press(screen.getByTestId('kip-swatch-ink'));
  fireEvent.press(screen.getByTestId('kip-colour-save'));
  expect(await screen.findByText("Your colour couldn't be saved.")).toBeTruthy();
  expect(getMyKipColour()).toBe('coral');
  fireEvent.press(screen.getByText('Try again'));
  await waitFor(() => expect(getMyKipColour()).toBe('ink'));
  expect(screen.queryByTestId('kip-colour-error')).toBeNull();
});

it('Reset to coral only changes the selection', () => {
  act(() => setMyKipColour('slate'));
  render(<KipColourSection />);
  fireEvent.press(screen.getByTestId('kip-colour-reset'));
  expect(screen.getByTestId('kip-swatch-coral').props.accessibilityState).toMatchObject({ checked: true });
  expect(getMyKipColour()).toBe('slate');
  expect(save).not.toHaveBeenCalled();
});
