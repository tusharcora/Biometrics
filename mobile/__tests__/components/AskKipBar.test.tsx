import React from 'react';
import { fireEvent, render, within } from '@testing-library/react-native';
import { Rect } from 'react-native-svg';
import { AskKipBar } from '../../src/components/coach/AskKipBar';
import { kipHeadRects } from '../../src/components/kip/KipHead';
import { RECOVERY_COPY } from '../../src/lib/recoveryCopy';
import { askLabel } from '../../src/lib/sleepCopy';
import { setMyKipColour, resetMyKipColour } from '../../src/lib/kip/myKipColour';
import { KIP_COLOURS } from '../../src/lib/kip/kipArt';

afterEach(() => resetMyKipColour());

it('is the one Ask KIP button, labelled as given, and asks on press', () => {
  const onPress = jest.fn();
  const s = render(<AskKipBar label={RECOVERY_COPY.askToday} mood="idle" onPress={onPress} />);
  const bar = s.getByTestId('ask-kip-button');
  expect(bar.props.accessibilityLabel).toBe('Ask KIP about today');
  fireEvent.press(bar);
  expect(onPress).toHaveBeenCalledTimes(1);
});

it('draws KIP\'s head at scale 4 (64 × 40) in your colour and the page\'s mood', () => {
  setMyKipColour('cobalt');
  const s = render(<AskKipBar label="Ask KIP about last night" mood="sleepy" onPress={jest.fn()} />);
  const head = s.getByTestId('ask-kip-head', { includeHiddenElements: true });
  expect(head.props.style).toEqual({ width: 64, height: 40 });
  // The fills actually drawn under the head (ruling L3): your cobalt KIP, sleepy, not the default coral idle one.
  const drawn = within(head).UNSAFE_getAllByType(Rect).map((r) => r.props.fill);
  expect(drawn).toEqual(kipHeadRects({ colour: 'cobalt', mood: 'sleepy' }).map((r) => r.fill));
  expect(drawn).toContain(KIP_COLOURS.cobalt);
  expect(drawn).not.toContain(KIP_COLOURS.coral);
});

it('labels every bar KIP, never a coach name', () => {
  expect([RECOVERY_COPY.askToday, RECOVERY_COPY.askPast, askLabel(true), askLabel(false)]).toEqual([
    'Ask KIP about today', 'Ask KIP about this day', 'Ask KIP about last night', 'Ask KIP about this night',
  ]);
});
