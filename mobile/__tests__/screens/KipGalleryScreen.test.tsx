import React from 'react';
import { render } from '@testing-library/react-native';
import { KipGalleryScreen } from '../../src/screens/dev/KipGalleryScreen';
import { KIP_MOODS, KIP_POSES } from '../../src/lib/kip/kipArt';

it('draws every pose in every mood, in the three gallery colours', () => {
  const s = render(<KipGalleryScreen />);
  for (const colour of ['coral', 'cobalt', 'lime']) for (const pose of KIP_POSES) for (const mood of KIP_MOODS) {
    expect(s.getByTestId(`kip-gallery-${colour}-${pose}-${mood}`, { includeHiddenElements: true })).toBeTruthy();
  }
});
