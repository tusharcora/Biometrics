import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { OrbGalleryScreen, ORB_STATES } from '../../src/screens/dev/OrbGalleryScreen';

describe('OrbGalleryScreen', () => {
  it('lists the nine states, each at both sizes', () => {
    const { getAllByTestId, getByText } = render(<OrbGalleryScreen />);

    expect(ORB_STATES).toHaveLength(9);
    // 9 states x (64 + 20)
    expect(getAllByTestId('thinking-orb')).toHaveLength(18);
    for (const state of ORB_STATES) expect(getByText(state)).toBeTruthy();
  });

  it('starts dark and toggles the theme passed to every orb', () => {
    const { getAllByTestId, getByTestId } = render(<OrbGalleryScreen />);
    expect(getAllByTestId('thinking-orb')[0]!.props.accessibilityLabel).toMatch(/:dark$/);

    fireEvent.press(getByTestId('gallery-theme'));

    expect(getAllByTestId('thinking-orb')[0]!.props.accessibilityLabel).toMatch(/:light$/);
  });

  it('pauses every orb', () => {
    const { getAllByTestId, getByTestId } = render(<OrbGalleryScreen />);

    fireEvent.press(getByTestId('gallery-pause'));

    for (const orb of getAllByTestId('thinking-orb')) expect(orb.props.accessibilityLabel).toContain(':paused:');
  });
});
