import React from 'react';
import { render } from '@testing-library/react-native';
import { CoachMessageRow } from '../../src/components/coach/CoachMessageRow';
import { KIP_COLOURS } from '../../src/lib/kip/kipArt';
import { resetMyKip, setMyKipColour } from '../../src/lib/kip/myKip';
import { HIDDEN_OK } from '../../jest-mocks/coachStatus';

let mockScheme: 'light' | 'dark' = 'light';
jest.mock('nativewind', () => ({ useColorScheme: () => ({ colorScheme: mockScheme }) }));

const ROW_PROPS = { showFollowUps: false, busy: false, onAsk: () => true, onOverrideSafety: () => {}, onOpenSource: () => {} };

afterEach(() => {
  mockScheme = 'light';
  resetMyKip();
});

describe('CoachMessageRow (spec 2026-10-14 KIP Coach §3.4, §7.7)', () => {
  it('heads an answer with KIP\'s head and a "KIP" label, coloured on the dark card where it reads', () => {
    setMyKipColour('coral');
    mockScheme = 'dark';
    const s = render(<CoachMessageRow message={{ id: 'a1', role: 'assistant', text: 'Hi.', state: 'done' }} {...ROW_PROPS} />);
    expect(s.getByTestId('coach-reply-kip-a1', HIDDEN_OK)).toBeTruthy();
    expect(s.getByText('KIP')).toHaveStyle({ color: KIP_COLOURS.coral });
  });

  it('uses the foreground for the label in light mode and for a colour that would not read (ink)', () => {
    setMyKipColour('coral');
    const light = render(<CoachMessageRow message={{ id: 'a2', role: 'assistant', text: 'Hi.', state: 'done' }} {...ROW_PROPS} />);
    expect(light.getByText('KIP')).not.toHaveStyle({ color: KIP_COLOURS.coral });
    light.unmount();

    setMyKipColour('ink');
    mockScheme = 'dark';
    const ink = render(<CoachMessageRow message={{ id: 'a3', role: 'assistant', text: 'Hi.', state: 'done' }} {...ROW_PROPS} />);
    expect(ink.getByText('KIP')).not.toHaveStyle({ color: KIP_COLOURS.ink });
  });

  it('draws no KIP beside your own question', () => {
    const s = render(<CoachMessageRow message={{ id: 'u1', role: 'user', text: 'How did I sleep?' }} {...ROW_PROPS} />);
    expect(s.queryByTestId('coach-reply-kip-u1', HIDDEN_OK)).toBeNull();
    expect(s.queryByText('KIP')).toBeNull();
  });
});
