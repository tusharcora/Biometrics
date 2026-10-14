import React from 'react';
import { render } from '@testing-library/react-native';
import { Rect } from 'react-native-svg';
import { ItemIcon } from '../../src/components/room/ItemIcon';
import { KIP_COLOURS, kipRamp } from '../../src/lib/kip/kipArt';
import '../../src/lib/room/art';

const fills = (s: ReturnType<typeof render>) => s.UNSAFE_getAllByType(Rect).map((r) => r.props.fill);

it('draws a room piece\'s sprite at 48 points, decorative, in KIP\'s colour when tinted', () => {
  const s = render(<ItemIcon id="art.pennant" colour="lime" testID="icon" />);
  expect(s.getByTestId('icon', { includeHiddenElements: true }).props.style).toMatchObject({ width: 48, height: 48 });
  expect(fills(s)).toContain(kipRamp(KIP_COLOURS.lime).body);
});

it('draws a worn piece on KIP\'s head', () => {
  expect(fills(render(<ItemIcon id="out.round" colour="coral" />))).toContain('#FCD34D');
});

it('draws an empty box for an id it has no icon for', () => {
  expect(render(<ItemIcon id="no.such" colour="coral" />).UNSAFE_queryAllByType(Rect)).toHaveLength(0);
});
