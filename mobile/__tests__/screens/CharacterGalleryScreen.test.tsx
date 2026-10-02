import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { CharacterGalleryScreen } from '../../src/screens/dev/CharacterGalleryScreen';

// Unlabelled characters are hidden from accessibility, so the canvases are
// only reachable with includeHiddenElements.
const labels = (utils: ReturnType<typeof render>) =>
  utils
    .getAllByTestId('character-canvas', { includeHiddenElements: true })
    .map((n) => n.props.accessibilityLabel as string);

describe('CharacterGalleryScreen', () => {
  it('shows every character in every mood plus two smaller sizes', () => {
    const utils = render(<CharacterGalleryScreen />);
    const all = labels(utils);
    expect(all).toHaveLength(15 * 6);
    expect(all).toContain('character:mochi:thinking:96:playing:bulb');
    expect(all).toContain('character:kit:resting:96:playing:none');
    expect(all).toContain('character:bao:idle:64:playing:none');
    expect(all).toContain('character:kit:thinking:20:playing:none');
  });

  it('pauses and resumes every character', () => {
    const utils = render(<CharacterGalleryScreen />);
    fireEvent.press(utils.getByTestId('gallery-pause'));
    expect(labels(utils).every((l) => l.includes(':paused:'))).toBe(true);
    fireEvent.press(utils.getByTestId('gallery-pause'));
    expect(labels(utils).every((l) => l.includes(':playing:'))).toBe(true);
  });
});
