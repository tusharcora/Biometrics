import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { RoomGiftBoxes } from '../../src/components/room/RoomGiftBoxes';
import { starterLayout } from '../../src/lib/room/layout';

const gift = (id: string, from: string | null, quiet = false) => ({ id, itemId: 'plant.fern', note: 'cosy' as const, from: from ? { name: from } : null, quiet, at: '2026-10-26T10:00:00.000Z' });

it('draws one 44-pt box per gift, at most 3, each a button that says whose it is', () => {
  const onOpen = jest.fn();
  render(<RoomGiftBoxes gifts={[gift('g1', 'Maya'), gift('g2', null), gift('g3', 'Jo'), gift('g4', 'Al')]} layout={starterLayout()} tier={1} width={360} height={240} onOpen={onOpen} />);
  const boxes = screen.getAllByTestId(/^gift-box-/);
  expect(boxes).toHaveLength(3);
  expect(screen.getByTestId('gift-box-g1').props.accessibilityLabel).toBe('Open the gift from Maya');
  expect(screen.getByTestId('gift-box-g2').props.accessibilityLabel).toBe('Open a gift');
  fireEvent.press(screen.getByTestId('gift-box-g1'));
  expect(onOpen).toHaveBeenCalledWith('g1');
});

it.each([1, 2, 3] as const)('tier %i: every box sits wholly inside the card, 44 pt square (PF4-F8)', (tier) => {
  render(<RoomGiftBoxes gifts={[gift('g1', 'Maya'), gift('g2', 'Jo'), gift('g3', 'Al')]} layout={starterLayout()} tier={tier} width={323} height={240} onOpen={jest.fn()} />);
  const spots = screen.getAllByTestId(/^gift-spot-/);
  expect(spots).toHaveLength(3);
  for (const b of spots) {
    const { left, top } = StyleSheet.flatten(b.props.style) as { left: number; top: number };
    expect([left >= 0, top >= 0, left + 44 <= 323, top + 44 <= 240]).toEqual([true, true, true, true]);
  }
});

it('while one opens, every box stays the touch\'s target but says busy and ignores presses (T10-FIX I2); with no gifts or no width it draws nothing', () => {
  const onOpen = jest.fn();
  const s = render(<RoomGiftBoxes gifts={[gift('g1', 'Maya')]} layout={starterLayout()} tier={1} width={323} height={240} onOpen={onOpen} busy />);
  expect(s.getByTestId('gift-box-g1').props.accessibilityState).toMatchObject({ busy: true, disabled: false });
  fireEvent.press(s.getByTestId('gift-box-g1'));
  expect(onOpen).not.toHaveBeenCalled();
  s.rerender(<RoomGiftBoxes gifts={[]} layout={starterLayout()} tier={1} width={323} height={240} onOpen={jest.fn()} />);
  expect(s.queryAllByTestId(/^gift-box-/)).toHaveLength(0);
  s.rerender(<RoomGiftBoxes gifts={[gift('g1', 'Maya')]} layout={starterLayout()} tier={1} width={0} height={240} onOpen={jest.fn()} />);
  expect(s.queryAllByTestId(/^gift-box-/)).toHaveLength(0);
});
