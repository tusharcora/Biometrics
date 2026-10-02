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
  it('shows every character in every mood plus both mini sizes', () => {
    const utils = render(<CharacterGalleryScreen />);
    const all = labels(utils);
    expect(all).toHaveLength(8 * 6);
    expect(all).toContain('character:hoot:thinking:96:playing:full');
    expect(all).toContain('character:doze:resting:96:playing:full');
    expect(all).toContain('character:beat:idle:64:playing:mini');
    expect(all).toContain('character:ember:thinking:20:playing:mini');
  });

  it('pauses and resumes every character', () => {
    const utils = render(<CharacterGalleryScreen />);
    fireEvent.press(utils.getByTestId('gallery-pause'));
    expect(labels(utils).every((l) => l.includes(':paused:'))).toBe(true);
    fireEvent.press(utils.getByTestId('gallery-pause'));
    expect(labels(utils).every((l) => l.includes(':playing:'))).toBe(true);
  });
});
