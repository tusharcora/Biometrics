import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { RoomWelcomeCard } from '../../src/components/coach/RoomWelcomeCard';

it('welcomes you home with the free lantern, Place the lantern and Later (spec §11.1, C7)', () => {
  const onPlace = jest.fn();
  const onLater = jest.fn();
  const s = render(<RoomWelcomeCard onPlace={onPlace} onLater={onLater} />);
  expect(s.getByText("This is KIP's room. Make it yours: drag pieces in, flip them, stack them.")).toBeTruthy();
  expect(s.getByTestId('welcome-lantern')).toHaveTextContent('A welcome lanternFree · in your inventory · glows at night');
  expect(s.getByTestId('welcome-lantern').props.accessibilityLabel).toBe('A welcome lantern. Free, in your inventory, glows at night');
  fireEvent.press(s.getByTestId('welcome-place'));
  fireEvent.press(s.getByTestId('welcome-later'));
  expect([onPlace.mock.calls.length, onLater.mock.calls.length]).toEqual([1, 1]);
});
