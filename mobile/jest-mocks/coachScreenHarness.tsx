// Shared mocks and helpers for the suites that render CoachScreen (the KIP page). Kept out of __tests__ so jest does
// not collect it as a suite. Import it FIRST in a test file: its jest.mock calls must run before CoachScreen and the
// api modules load.
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import {
  deleteCoachMemory,
  fetchCoachStatus,
  fetchLatestConversation,
  fetchTodaySummary,
  listConversations,
  type CoachStatusDTO,
  type TodaySummaryDTO,
} from '../src/api/coach';
import { streamCoachMessage } from '../src/api/coachStream';
import { fetchScoresWithBands } from '../src/api/scores';
import { fetchSleep } from '../src/api/sleep';
import { useKeyboardVisible } from '../src/lib/useKeyboardVisible';
import type { ThinkingTextId } from '../src/lib/thinkingText';
import { CoachScreen } from '../src/screens/CoachScreen';
import { withCoachStatus } from './coachStatus';

jest.mock('../src/api/coach', () => ({
  ...jest.requireActual('../src/api/coach'),
  fetchCoachStatus: jest.fn(),
  fetchLatestConversation: jest.fn(),
  fetchTodaySummary: jest.fn(),
  fetchConversation: jest.fn(),
  listConversations: jest.fn(),
  deleteCoachMemory: jest.fn(),
}));
jest.mock('../src/api/coachStream', () => ({
  ...jest.requireActual('../src/api/coachStream'),
  streamCoachMessage: jest.fn(),
}));
jest.mock('../src/lib/useKeyboardVisible', () => ({ useKeyboardVisible: jest.fn(() => false) }));
// The room card's reads (useTodayScene): no scores and no night unless a test says otherwise.
jest.mock('../src/api/scores', () => ({ ...jest.requireActual('../src/api/scores'), fetchScoresWithBands: jest.fn() }));
jest.mock('../src/api/sleep', () => ({ ...jest.requireActual('../src/api/sleep'), fetchSleep: jest.fn() }));
// The KIP page loads coins and the first-week list on focus (Task 12): no real HTTP from Jest.
jest.mock('../src/api/coins', () => ({
  fetchCoins: jest.fn(async () => ({ balance: 0, today: { earned: 0, cap: 60 }, events: [], next: null })),
  postCoinsSeen: jest.fn(async () => undefined),
  fetchFirstWeek: jest.fn(async () => ({ open: false })),
  fetchShop: jest.fn(), postPurchase: jest.fn(), postExpand: jest.fn(),
}));
jest.mock('../src/components/room/RoomView', () => require('./RoomView'));

/** The navigation the screen sees: `params` is the route's, `focus()` fires the tab's focus listeners. */
export const mockNav = {
  navigate: jest.fn(),
  setParams: jest.fn(),
  params: undefined as unknown,
  focusListeners: new Set<() => void>(),
  focus() {
    mockNav.focusListeners.forEach((cb) => cb());
  },
};
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNav.navigate,
    setParams: mockNav.setParams,
    goBack: jest.fn(),
    // Tests drive focus only; the room's blur listener (useTodayScene) is never fired.
    addListener: (event: string, cb: () => void) => {
      if (event !== 'focus') return () => {};
      mockNav.focusListeners.add(cb);
      return () => {
        mockNav.focusListeners.delete(cb);
      };
    },
  }),
  useRoute: () => ({ params: mockNav.params }),
}));

export const stream = streamCoachMessage as jest.Mock;

export const status: CoachStatusDTO = {
  enabled: true,
  consented: true,
  consent: { version: 'v1', summary: 's', dataItems: ['x'] },
  personaId: 'kit',
  personaChosen: true,
  personas: [],
};

export const today: TodaySummaryDTO = {
  date: '2026-09-30',
  hasData: true,
  sentence: { text: "Recovery's 26, about half your usual.", spans: [{ text: "Recovery's " }, { text: '26', metric: 'recovery' }, { text: ', about half your usual.' }], source: 'template' },
  bars: [
    { metric: 'recovery', label: 'Recovery', value: 26, usual: 58, unit: 'score', display: '26', usualDisplay: '58', status: 'below', scaleMax: 100 },
    { metric: 'sleep', label: 'Sleep', value: 408, usual: 433, unit: 'minutes', display: '6h 48m', usualDisplay: '7h 13m', status: 'near', scaleMax: 606 },
    { metric: 'hrv', label: 'HRV', value: 41, usual: 52, unit: 'ms', display: '41', usualDisplay: '52', status: 'below', scaleMax: 72.8 },
    { metric: 'rhr', label: 'Rest HR', value: 58, usual: 58, unit: 'bpm', display: '58', usualDisplay: '58', status: 'near', scaleMax: 81.2 },
  ],
};

export function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

export async function openChat(thinkingText?: ThinkingTextId) {
  // No CoachStatusProvider by default (the steps thinking text).
  const utils = render(thinkingText ? withCoachStatus(<CoachScreen />, { thinkingText }) : <CoachScreen />);
  await utils.findByTestId('coach-input');
  return utils;
}

export async function ask(utils: ReturnType<typeof render>, text: string) {
  fireEvent.changeText(utils.getByTestId('coach-input'), text);
  await act(async () => {
    fireEvent.press(utils.getByTestId('coach-send-button'));
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  stream.mockReset();
  mockNav.params = undefined;
  mockNav.focusListeners.clear();
  (useKeyboardVisible as jest.Mock).mockReturnValue(false);
  (fetchCoachStatus as jest.Mock).mockResolvedValue(status);
  (fetchLatestConversation as jest.Mock).mockResolvedValue({ conversationId: null, messages: [] });
  (fetchTodaySummary as jest.Mock).mockResolvedValue(today);
  (listConversations as jest.Mock).mockResolvedValue([]);
  (deleteCoachMemory as jest.Mock).mockResolvedValue(undefined);
  (fetchScoresWithBands as jest.Mock).mockResolvedValue({ scores: [], bands: undefined });
  (fetchSleep as jest.Mock).mockResolvedValue({ nights: [] });
});
