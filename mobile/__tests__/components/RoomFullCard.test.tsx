import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { RoomFullCard } from '../../src/components/edit/RoomFullCard';

it('offers Store a piece and, from P2, See room sizes (spec §5.3)', () => {
  const store = jest.fn();
  const sizes = jest.fn();
  const s = render(<RoomFullCard cap={40} onStore={store} onSizes={sizes} />);
  expect(s.getByText("KIP's room is full. 40 pieces fit this room. Store something to make space, or grow the room")).toBeTruthy();
  fireEvent.press(s.getByTestId('room-full-sizes'));
  fireEvent.press(s.getByTestId('room-full-store'));
  expect([sizes.mock.calls.length, store.mock.calls.length]).toEqual([1, 1]);
});

it('without a way to Room sizes it offers Store a piece only', () => {
  const s = render(<RoomFullCard cap={40} onStore={jest.fn()} />);
  expect(s.queryByTestId('room-full-sizes')).toBeNull();
});
