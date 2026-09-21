import React from 'react';
import { StyleSheet } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { CoachScreen } from '../../src/screens/CoachScreen';
import { useKeyboardVisible } from '../../src/lib/useKeyboardVisible';
import { FLOATING_BAR_HEIGHT, FLOATING_BAR_MARGIN } from '../../src/navigation/tabBarLayout';
import {
  CoachConsentRequiredError,
  CoachDisabledError,
  CoachTimeoutError,
  fetchCoachStatus,
  fetchLatestConversation,
  sendCoachMessage,
  type CoachReplyDTO,
  type CoachStatusDTO,
} from '../../src/api/coach';

jest.mock('../../src/api/coach', () => ({
  ...jest.requireActual('../../src/api/coach'),
  fetchCoachStatus: jest.fn(),
  fetchLatestConversation: jest.fn(),
  sendCoachMessage: jest.fn(),
}));

jest.mock('../../src/lib/useKeyboardVisible', () => ({ useKeyboardVisible: jest.fn(() => false) }));

const mockNavigate = jest.fn();
const mockSetParams = jest.fn();
let mockFocusListener: (() => void) | undefined;
let mockParams: unknown;
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    setParams: mockSetParams,
    goBack: jest.fn(),
    addListener: (_event: string, cb: () => void) => {
      mockFocusListener = cb;
      return () => {
        mockFocusListener = undefined;
      };
    },
  }),
  useRoute: () => ({ params: mockParams }),
}));

const status: CoachStatusDTO = {
  enabled: true,
  consented: true,
  consent: { version: 'v1', summary: 's', dataItems: ['x'] },
  personaId: 'encouraging',
  personas: [],
};

let replySeq = 0;
function reply(text: string, extra: Partial<CoachReplyDTO['message']> = {}, safety?: CoachReplyDTO['safety']): CoachReplyDTO {
  return {
    conversationId: 'conv-1',
    message: { id: `m-${++replySeq}`, role: 'assistant', text, source: 'model', createdAt: '2026-09-20T10:00:00.000Z', ...extra },
    ...(safety ? { safety } : {}),
  };
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function openChat() {
  const utils = render(<CoachScreen />);
  await utils.findByTestId('coach-input');
  return utils;
}

function type(utils: ReturnType<typeof render>, text: string) {
  fireEvent.changeText(utils.getByTestId('coach-input'), text);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = undefined;
  mockFocusListener = undefined;
  (useKeyboardVisible as jest.Mock).mockReturnValue(false);
  (fetchCoachStatus as jest.Mock).mockResolvedValue(status);
  (fetchLatestConversation as jest.Mock).mockResolvedValue({ conversationId: null, messages: [] });
});

describe('CoachScreen: gating', () => {
  it('sends a not-yet-consented user to the consent screen, keeping the prefill', async () => {
    (fetchCoachStatus as jest.Mock).mockResolvedValue({ ...status, consented: false });
    mockParams = { prefill: 'Why did my score change today?' };
    render(<CoachScreen />);

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('CoachConsent', { prefill: 'Why did my score change today?' }));
    expect(fetchLatestConversation).not.toHaveBeenCalled();
  });

  it('shows a review card, instead of bouncing back to consent, when the user returns without agreeing', async () => {
    (fetchCoachStatus as jest.Mock).mockResolvedValue({ ...status, consented: false });
    const { findByTestId, queryByTestId } = render(<CoachScreen />);
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(1));

    await act(async () => {
      mockFocusListener?.();
    });

    expect(await findByTestId('coach-needs-consent')).toBeTruthy();
    expect(queryByTestId('coach-input')).toBeNull();
    expect(mockNavigate).toHaveBeenCalledTimes(1);

    fireEvent.press(await findByTestId('coach-review-consent-button'));
    expect(mockNavigate).toHaveBeenCalledTimes(2);
    expect(mockNavigate).toHaveBeenLastCalledWith('CoachConsent', { prefill: undefined });
  });

  it('reloads when the tab regains focus after the user agreed', async () => {
    (fetchCoachStatus as jest.Mock).mockResolvedValue({ ...status, consented: false });
    const { findByTestId } = render(<CoachScreen />);
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(1));

    (fetchCoachStatus as jest.Mock).mockResolvedValue(status);
    await act(async () => {
      mockFocusListener?.();
    });

    expect(await findByTestId('coach-input')).toBeTruthy();
  });

  it('does not lose a focus that fires during the first load: the stale result is discarded and one fresh load runs', async () => {
    const first = deferred<CoachStatusDTO>();
    (fetchCoachStatus as jest.Mock).mockReturnValueOnce(first.promise).mockResolvedValue(status);
    const { findByTestId } = render(<CoachScreen />);

    // Focus while the first status request is still pending.
    await act(async () => {
      mockFocusListener?.();
    });
    expect(fetchCoachStatus).toHaveBeenCalledTimes(1);

    // The first response is stale: the user has since consented.
    await act(async () => {
      first.resolve({ ...status, consented: false });
    });

    expect(await findByTestId('coach-input')).toBeTruthy();
    expect(fetchCoachStatus).toHaveBeenCalledTimes(2);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('keeps a safety card, and does not re-read history, when the tab regains focus on a ready chat', async () => {
    const safetyReply = reply(
      "I'm really sorry you're feeling this way.",
      { source: 'safety' },
      { resources: ['Call or text 988 (US)'], canContinue: true },
    );
    (sendCoachMessage as jest.Mock).mockResolvedValueOnce(safetyReply);
    const utils = await openChat();
    type(utils, 'I feel awful');
    fireEvent.press(utils.getByTestId('coach-send-button'));
    await utils.findByTestId('coach-safety-resources');

    await act(async () => {
      mockFocusListener?.();
    });

    expect(fetchCoachStatus).toHaveBeenCalledTimes(2);
    expect(fetchLatestConversation).toHaveBeenCalledTimes(1);
    expect(utils.getByTestId('coach-safety-resources')).toBeTruthy();
    expect(utils.getByText('I feel awful')).toBeTruthy();
  });

  it('consumes a prefill param once applied, and fills the input again when the same text re-arrives', async () => {
    mockParams = { prefill: 'Why did my score change today?' };
    const utils = await openChat();
    expect(utils.getByTestId('coach-input').props.value).toBe('Why did my score change today?');
    expect(mockSetParams).toHaveBeenCalledWith({ prefill: undefined });

    // The user clears the input; the param has been consumed.
    fireEvent.changeText(utils.getByTestId('coach-input'), '');
    mockParams = undefined;
    utils.rerender(<CoachScreen />);
    expect(utils.getByTestId('coach-input').props.value).toBe('');

    // The identical text arrives again.
    mockParams = { prefill: 'Why did my score change today?' };
    utils.rerender(<CoachScreen />);
    expect(utils.getByTestId('coach-input').props.value).toBe('Why did my score change today?');
  });

  it('still carries the prefill to the consent screen from the review card after the param was consumed', async () => {
    (fetchCoachStatus as jest.Mock).mockResolvedValue({ ...status, consented: false });
    mockParams = { prefill: 'Why did my score change today?' };
    const utils = render(<CoachScreen />);
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(1));
    // The param is consumed by the app, so the route no longer has it.
    mockParams = undefined;
    utils.rerender(<CoachScreen />);

    await act(async () => {
      mockFocusListener?.();
    });
    fireEvent.press(await utils.findByTestId('coach-review-consent-button'));

    expect(mockNavigate).toHaveBeenLastCalledWith('CoachConsent', { prefill: 'Why did my score change today?' });
  });

  it('puts a prefill that arrives after mount into the input', async () => {
    const utils = await openChat();
    expect(utils.getByTestId('coach-input').props.value).toBe('');

    mockParams = { prefill: 'Why did my score change today?' };
    utils.rerender(<CoachScreen />);

    expect(utils.getByTestId('coach-input').props.value).toBe('Why did my score change today?');
  });

  it('shows no chat UI at all when the coach is disabled', async () => {
    (fetchCoachStatus as jest.Mock).mockResolvedValue({ ...status, enabled: false });
    const { findByTestId, queryByTestId } = render(<CoachScreen />);

    await findByTestId('coach-unavailable');
    expect(queryByTestId('coach-input')).toBeNull();
    expect(fetchLatestConversation).not.toHaveBeenCalled();
  });
});

describe('CoachScreen: conversation', () => {
  it('loads the latest conversation on open', async () => {
    (fetchLatestConversation as jest.Mock).mockResolvedValue({
      conversationId: 'conv-1',
      messages: [
        { id: 'a', role: 'USER', text: 'How did I sleep?', createdAt: '2026-09-19T10:00:00.000Z' },
        { id: 'b', role: 'ASSISTANT', text: 'You slept a little less than usual.', source: 'model', createdAt: '2026-09-19T10:00:05.000Z' },
      ],
    });
    const { findByText, getByTestId } = render(<CoachScreen />);

    expect(await findByText('How did I sleep?')).toBeTruthy();
    expect(await findByText('You slept a little less than usual.')).toBeTruthy();
    expect(getByTestId('coach-input')).toBeTruthy();
  });

  it('shows an empty state when there is no conversation yet', async () => {
    const { findByTestId } = render(<CoachScreen />);
    expect(await findByTestId('coach-empty')).toBeTruthy();
  });

  it('puts a prefilled question in the input without sending it', async () => {
    mockParams = { prefill: 'Why did my score change today?' };
    const { findByTestId } = render(<CoachScreen />);

    expect((await findByTestId('coach-input')).props.value).toBe('Why did my score change today?');
    expect(sendCoachMessage).not.toHaveBeenCalled();
  });

  it('does not allow sending an empty message', async () => {
    const utils = await openChat();

    fireEvent.press(utils.getByTestId('coach-send-button'));
    type(utils, '   ');
    fireEvent.press(utils.getByTestId('coach-send-button'));

    expect(sendCoachMessage).not.toHaveBeenCalled();
  });

  it('sends a message, shows "Thinking…" while waiting, then shows the whole reply', async () => {
    const pending = deferred<CoachReplyDTO>();
    (sendCoachMessage as jest.Mock).mockReturnValue(pending.promise);
    const utils = await openChat();

    type(utils, 'How is my recovery?');
    fireEvent.press(utils.getByTestId('coach-send-button'));

    expect(await utils.findByText('How is my recovery?')).toBeTruthy();
    expect(utils.getByTestId('coach-thinking')).toHaveTextContent('Thinking…');
    expect(utils.getByTestId('coach-input').props.value).toBe('');
    expect(sendCoachMessage).toHaveBeenCalledWith({ message: 'How is my recovery?' });

    // A second send is blocked while one is in flight.
    type(utils, 'Another');
    fireEvent.press(utils.getByTestId('coach-send-button'));
    expect(sendCoachMessage).toHaveBeenCalledTimes(1);

    await act(async () => pending.resolve(reply('Your recovery is steady.')));

    expect(await utils.findByText('Your recovery is steady.')).toBeTruthy();
    expect(utils.queryByTestId('coach-thinking')).toBeNull();
  });

  it('never implies live streaming: no typing indicator, only the static "Thinking…" state', async () => {
    const pending = deferred<CoachReplyDTO>();
    (sendCoachMessage as jest.Mock).mockReturnValue(pending.promise);
    const utils = await openChat();

    type(utils, 'Hello');
    fireEvent.press(utils.getByTestId('coach-send-button'));
    await utils.findByTestId('coach-thinking');

    expect(utils.queryByText(/typing|streaming|generating/i)).toBeNull();
    expect(utils.getByTestId('coach-thinking')).toHaveTextContent('Thinking…');
    // No partial assistant bubble exists before the full reply arrives.
    expect(utils.queryByTestId('chat-bubble-assistant')).toBeNull();
    await act(async () => pending.resolve(reply('Hi')));
  });

  it('continues in the same conversation on later messages', async () => {
    (fetchLatestConversation as jest.Mock).mockResolvedValue({ conversationId: 'conv-1', messages: [] });
    (sendCoachMessage as jest.Mock).mockImplementation(async () => reply('First'));
    const utils = await openChat();

    type(utils, 'One');
    fireEvent.press(utils.getByTestId('coach-send-button'));
    await utils.findByText('First');
    type(utils, 'Two');
    fireEvent.press(utils.getByTestId('coach-send-button'));

    await waitFor(() => expect(sendCoachMessage).toHaveBeenCalledTimes(2));
    expect(sendCoachMessage).toHaveBeenLastCalledWith({ message: 'Two', conversationId: 'conv-1' });
  });

  it('renders a fallback reply exactly like a normal one', async () => {
    (sendCoachMessage as jest.Mock).mockResolvedValue(reply('Your recovery score today is higher than yesterday.', { source: 'fallback' }));
    const utils = await openChat();

    type(utils, 'How am I?');
    fireEvent.press(utils.getByTestId('coach-send-button'));

    expect(await utils.findByText('Your recovery score today is higher than yesterday.')).toBeTruthy();
    expect(utils.queryByTestId('coach-safety-resources')).toBeNull();
    expect(utils.queryByTestId('coach-safety-override')).toBeNull();
    expect(utils.queryByTestId('coach-error')).toBeNull();
  });
});

describe('CoachScreen: errors and retry', () => {
  it('shows an error with a retry that resends the same message without duplicating it', async () => {
    (sendCoachMessage as jest.Mock).mockRejectedValueOnce(new Error('network'));
    const utils = await openChat();

    type(utils, 'How is my recovery?');
    fireEvent.press(utils.getByTestId('coach-send-button'));
    expect(await utils.findByTestId('coach-error')).toBeTruthy();
    expect(utils.queryByTestId('coach-thinking')).toBeNull();

    (sendCoachMessage as jest.Mock).mockResolvedValueOnce(reply('Steady.'));
    fireEvent.press(utils.getByTestId('coach-retry-button'));

    expect(await utils.findByText('Steady.')).toBeTruthy();
    expect(sendCoachMessage).toHaveBeenCalledTimes(2);
    expect(sendCoachMessage).toHaveBeenLastCalledWith({ message: 'How is my recovery?' });
    expect(utils.getAllByText('How is my recovery?')).toHaveLength(1);
    expect(utils.queryByTestId('coach-error')).toBeNull();
  });

  it('explains a client timeout and offers retry', async () => {
    (sendCoachMessage as jest.Mock).mockRejectedValueOnce(new CoachTimeoutError());
    const utils = await openChat();

    type(utils, 'Hello');
    fireEvent.press(utils.getByTestId('coach-send-button'));

    expect(await utils.findByTestId('coach-error')).toHaveTextContent(/too long/i);
    expect(utils.getByTestId('coach-retry-button')).toBeTruthy();
  });

  it('sends the user to consent when the server says consent is required (403)', async () => {
    (sendCoachMessage as jest.Mock).mockRejectedValueOnce(new CoachConsentRequiredError());
    const utils = await openChat();

    type(utils, 'Hello');
    fireEvent.press(utils.getByTestId('coach-send-button'));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('CoachConsent', { prefill: undefined }));
  });

  it('shows the coach as unavailable when the server says it is disabled (404)', async () => {
    (sendCoachMessage as jest.Mock).mockRejectedValueOnce(new CoachDisabledError());
    const utils = await openChat();

    type(utils, 'Hello');
    fireEvent.press(utils.getByTestId('coach-send-button'));

    expect(await utils.findByTestId('coach-unavailable')).toBeTruthy();
    expect(utils.queryByTestId('coach-input')).toBeNull();
  });
});

describe('CoachScreen: safety reply', () => {
  const safetyReply = reply(
    "I'm really sorry you're feeling this way. You don't have to go through it alone.",
    { source: 'safety' },
    { resources: ['Call or text 988 (US)', 'Text HOME to 741741'], canContinue: true },
  );

  async function sendSafetyMessage() {
    (sendCoachMessage as jest.Mock).mockResolvedValueOnce(safetyReply);
    const utils = await openChat();
    type(utils, 'I feel awful about my sleep and everything');
    fireEvent.press(utils.getByTestId('coach-send-button'));
    await utils.findByTestId('coach-safety-resources');
    return utils;
  }

  it('shows the resources prominently with a visible "That\'s not why I\'m asking" button', async () => {
    const utils = await sendSafetyMessage();

    expect(utils.getByTestId('coach-safety-resources')).toHaveTextContent(/Call or text 988 \(US\)/);
    expect(utils.getByTestId('coach-safety-resources')).toHaveTextContent(/Text HOME to 741741/);
    expect(utils.getByText("That's not why I'm asking")).toBeTruthy();
    expect(utils.getByText(safetyReply.message.text)).toBeTruthy();
  });

  it('resends the same message with safetyOverride:true and no duplicate bubble', async () => {
    const utils = await sendSafetyMessage();
    (sendCoachMessage as jest.Mock).mockResolvedValueOnce(reply('Your sleep was shorter than usual.'));

    fireEvent.press(utils.getByTestId('coach-safety-override'));

    expect(await utils.findByText('Your sleep was shorter than usual.')).toBeTruthy();
    expect(sendCoachMessage).toHaveBeenLastCalledWith({
      message: 'I feel awful about my sleep and everything',
      conversationId: 'conv-1',
      safetyOverride: true,
    });
    expect(utils.getAllByText('I feel awful about my sleep and everything')).toHaveLength(1);
    expect(utils.queryByTestId('coach-safety-override')).toBeNull();
  });

  it('keeps the override available for retry if the resend fails', async () => {
    const utils = await sendSafetyMessage();
    (sendCoachMessage as jest.Mock).mockRejectedValueOnce(new Error('network'));

    fireEvent.press(utils.getByTestId('coach-safety-override'));
    await utils.findByTestId('coach-error');

    (sendCoachMessage as jest.Mock).mockResolvedValueOnce(reply('Here you go.'));
    fireEvent.press(utils.getByTestId('coach-retry-button'));

    expect(await utils.findByText('Here you go.')).toBeTruthy();
    expect(sendCoachMessage).toHaveBeenLastCalledWith(expect.objectContaining({ safetyOverride: true }));
  });
});

describe('CoachScreen: tab bar clearance', () => {
  // No SafeAreaProvider here, so the bottom inset falls back to the bar margin.
  const clearance = FLOATING_BAR_HEIGHT + FLOATING_BAR_MARGIN + 16;

  it('clears the floating bar with a wrapper the keyboard-avoiding view cannot override', async () => {
    const { getByTestId } = await openChat();

    expect(StyleSheet.flatten(getByTestId('coach-clearance').props.style).paddingBottom).toBe(clearance);
  });

  it('drops the clearance while the keyboard is open, because the bar hides', async () => {
    (useKeyboardVisible as jest.Mock).mockReturnValue(true);
    const { getByTestId } = await openChat();

    expect(StyleSheet.flatten(getByTestId('coach-clearance').props.style).paddingBottom).toBe(0);
  });
});
