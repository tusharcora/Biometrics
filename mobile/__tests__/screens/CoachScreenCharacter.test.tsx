import React from 'react';
import { act, render, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContext } from '@react-navigation/native';
import { characterLabel as label, withCharacter } from '../../jest-mocks/characterContext';
import { CoachScreen } from '../../src/screens/CoachScreen';
import { fetchCoachStatus, fetchLatestConversation, sendCoachMessage, type CoachReplyDTO, type CoachStatusDTO } from '../../src/api/coach';
import type { ScoreBand } from '../../src/lib/scoreInsights';

jest.mock('../../src/api/coach', () => ({
  ...jest.requireActual('../../src/api/coach'),
  fetchCoachStatus: jest.fn(),
  fetchLatestConversation: jest.fn(),
  sendCoachMessage: jest.fn(),
}));
jest.mock('../../src/lib/useKeyboardVisible', () => ({ useKeyboardVisible: jest.fn(() => false) }));
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: jest.fn(), setParams: jest.fn(), addListener: () => () => undefined }),
  useRoute: () => ({ params: undefined }),
}));

const status: CoachStatusDTO = {
  enabled: true,
  consented: true,
  consent: { version: 'v1', summary: 's', dataItems: ['x'] },
  personaId: 'ember',
  personaChosen: true,
  personas: [],
};

function reply(text: string, source: 'model' | 'safety' = 'model'): CoachReplyDTO {
  return {
    conversationId: 'conv-1',
    message: { id: `m-${text}`, role: 'assistant', text, source, createdAt: '2026-09-29T10:00:00.000Z' },
    ...(source === 'safety' ? { safety: { resources: ['Call 988'] } } : {}),
  } as CoachReplyDTO;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

// The screen as the app mounts it: under CharacterProvider, inside a navigator
// whose focus the test controls.
function renderCoach({ recoveryBand = null, focused = true }: { recoveryBand?: ScoreBand | null; focused?: boolean } = {}) {
  const navigation = { isFocused: () => focused, addListener: () => () => undefined };
  return render(
    <NavigationContext.Provider value={navigation as never}>
      {withCharacter(<CoachScreen />, { characterId: 'ember', status, recoveryBand })}
    </NavigationContext.Provider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  (fetchCoachStatus as jest.Mock).mockResolvedValue(status);
  (fetchLatestConversation as jest.Mock).mockResolvedValue({ conversationId: null, messages: [] });
});

describe('CoachScreen: character', () => {
  it("shows the user's character, idle and animating, in the header and on the empty chat", async () => {
    const utils = renderCoach();
    await utils.findByTestId('coach-empty');

    expect(label(utils, 'coach-header-character')).toBe('character:ember:idle:36:playing:mini');
    expect(label(utils, 'coach-hero-character')).toBe('character:ember:idle:64:playing:full');
  });

  it('rests on a poor recovery day', async () => {
    const utils = renderCoach({ recoveryBand: 'scorePoor' });
    await utils.findByTestId('coach-empty');

    expect(label(utils, 'coach-hero-character')).toBe('character:ember:resting:64:playing:full');
  });

  it('thinks while a message is sending, with a mini thinking character on the Thinking line', async () => {
    const pending = deferred<CoachReplyDTO>();
    (sendCoachMessage as jest.Mock).mockReturnValue(pending.promise);
    const utils = renderCoach();
    await utils.findByTestId('coach-input');

    fireEvent.changeText(utils.getByTestId('coach-input'), 'How did I sleep?');
    fireEvent.press(utils.getByTestId('coach-send-button'));

    await utils.findByTestId('coach-thinking');
    expect(label(utils, 'coach-header-character')).toBe('character:ember:thinking:36:playing:mini');
    expect(label(utils, 'coach-thinking-character')).toBe('character:ember:thinking:20:playing:mini');
    await act(async () => pending.resolve(reply('Well.')));
  });

  it('answers right after a reply lands, then goes back to idle', async () => {
    jest.useFakeTimers();
    try {
      (sendCoachMessage as jest.Mock).mockResolvedValue(reply('You slept well.'));
      const utils = renderCoach();
      await utils.findByTestId('coach-input');

      fireEvent.press(utils.getByTestId('coach-suggestion-sleep'));
      await utils.findByText('You slept well.');

      expect(label(utils, 'coach-header-character')).toBe('character:ember:answering:36:playing:mini');
      act(() => jest.advanceTimersByTime(2500));
      expect(label(utils, 'coach-header-character')).toBe('character:ember:idle:36:playing:mini');
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not celebrate a crisis-safety reply', async () => {
    (sendCoachMessage as jest.Mock).mockResolvedValue(reply('Support is available.', 'safety'));
    const utils = renderCoach();
    await utils.findByTestId('coach-input');

    fireEvent.press(utils.getByTestId('coach-suggestion-sleep'));
    await utils.findByTestId('coach-safety-resources');

    expect(label(utils, 'coach-header-character')).toBe('character:ember:idle:36:playing:mini');
  });

  it('does not answer after a failed send', async () => {
    (sendCoachMessage as jest.Mock).mockRejectedValue(new Error('offline'));
    const utils = renderCoach();
    await utils.findByTestId('coach-input');

    fireEvent.press(utils.getByTestId('coach-suggestion-sleep'));
    await utils.findByTestId('coach-error');

    expect(label(utils, 'coach-header-character')).toBe('character:ember:idle:36:playing:mini');
  });

  it('leaves the character idle for a safety reply that lands right after a normal one', async () => {
    (sendCoachMessage as jest.Mock).mockResolvedValueOnce(reply('You slept well.')).mockResolvedValueOnce(reply('Support is available.', 'safety'));
    const utils = renderCoach();
    await utils.findByTestId('coach-input');

    fireEvent.press(utils.getByTestId('coach-suggestion-sleep'));
    await utils.findByText('You slept well.');
    expect(label(utils, 'coach-header-character')).toBe('character:ember:answering:36:playing:mini');

    fireEvent.changeText(utils.getByTestId('coach-input'), 'I feel awful');
    fireEvent.press(utils.getByTestId('coach-send-button'));
    await utils.findByTestId('coach-safety-resources');

    expect(label(utils, 'coach-header-character')).toBe('character:ember:idle:36:playing:mini');
  });

  it('leaves the character idle for a failed send right after a normal reply', async () => {
    (sendCoachMessage as jest.Mock).mockResolvedValueOnce(reply('You slept well.')).mockRejectedValueOnce(new Error('offline'));
    const utils = renderCoach();
    await utils.findByTestId('coach-input');

    fireEvent.press(utils.getByTestId('coach-suggestion-sleep'));
    await utils.findByText('You slept well.');
    expect(label(utils, 'coach-header-character')).toBe('character:ember:answering:36:playing:mini');

    fireEvent.changeText(utils.getByTestId('coach-input'), 'And today?');
    fireEvent.press(utils.getByTestId('coach-send-button'));
    await utils.findByTestId('coach-error');

    expect(label(utils, 'coach-header-character')).toBe('character:ember:idle:36:playing:mini');
  });

  it('holds the characters still while the Coach tab is not focused, even when a reply lands', async () => {
    (sendCoachMessage as jest.Mock).mockResolvedValue(reply('Done.'));
    const utils = renderCoach({ focused: false });
    await utils.findByTestId('coach-empty');
    expect(label(utils, 'coach-hero-character')).toBe('character:ember:idle:64:paused:full');

    fireEvent.press(utils.getByTestId('coach-suggestion-sleep'));
    await utils.findByText('Done.');

    expect(label(utils, 'coach-header-character')).toBe('character:ember:answering:36:paused:mini');
  });

  it('keeps the settled "Thought for" glyph still', async () => {
    (sendCoachMessage as jest.Mock).mockResolvedValue(reply('Fine.'));
    const utils = renderCoach();
    await utils.findByTestId('coach-input');

    fireEvent.press(utils.getByTestId('coach-suggestion-sleep'));
    await utils.findByText('Fine.');

    expect(label(utils, 'coach-thought-settled')).toBe('character:ember:idle:14:paused:mini');
  });

  it('does not update after unmount when a reply lands late', async () => {
    const pending = deferred<CoachReplyDTO>();
    (sendCoachMessage as jest.Mock).mockReturnValue(pending.promise);
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
    const utils = renderCoach();
    await utils.findByTestId('coach-input');
    fireEvent.press(utils.getByTestId('coach-suggestion-sleep'));
    await utils.findByTestId('coach-thinking');

    utils.unmount();
    await act(async () => pending.resolve(reply('Too late.')));

    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  it('shows Hoot when rendered without a CharacterProvider', async () => {
    const utils = render(<CoachScreen />);
    await utils.findByTestId('coach-empty');

    await waitFor(() => expect(label(utils, 'coach-header-character')).toBe('character:hoot:idle:36:playing:mini'));
  });
});
