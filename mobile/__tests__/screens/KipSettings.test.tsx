import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { NavigationContext } from '@react-navigation/native';
import { KipSettingsSection } from '../../src/components/kip-settings-section';
import { listCoachMemory, revokeCoachConsent, type CoachStatusDTO } from '../../src/api/coach';
import { HIDDEN_OK, withCoachStatus } from '../../jest-mocks/coachStatus';
import { setMyKipColour, resetMyKipColour } from '../../src/lib/kip/myKipColour';

jest.mock('../../src/api/coach', () => ({
  ...jest.requireActual('../../src/api/coach'),
  revokeCoachConsent: jest.fn(() => Promise.resolve()),
  listCoachMemory: jest.fn(() => Promise.resolve([{ id: 'm1' }, { id: 'm2' }])),
}));
// Synchronous icons: the real font load re-renders after these tests finish.
jest.mock('@expo/vector-icons', () => require('../../jest-mocks/vectorIcons'));

const navigate = jest.fn();
const ON: CoachStatusDTO = { enabled: true, consented: true, consent: { version: '2', summary: '', dataItems: [] }, personaId: 'kip', personaChosen: true, personas: [], thinkingText: 'steps', engine: 'local' } as CoachStatusDTO;
const OFF: CoachStatusDTO = { ...ON, consented: false };

// The section reads NavigationContext (not useNavigation), as Settings does (ruling H5).
function renderSection(overrides: Parameters<typeof withCoachStatus>[1]) {
  return render(
    <NavigationContext.Provider value={{ navigate } as never}>{withCoachStatus(<KipSettingsSection />, overrides)}</NavigationContext.Provider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  setMyKipColour('cobalt');
});
afterEach(() => resetMyKipColour());

it('is one group titled KIP: your KIP, while KIP thinks, memory and privacy, turn off', async () => {
  const s = renderSection({ status: ON, thinkingText: 'typewriter' });
  expect(s.getByTestId('kip-settings')).toBeTruthy();
  expect(s.getAllByText('KIP').length).toBeGreaterThan(0);
  expect(s.getByText('Cobalt · coaches you on the KIP tab')).toBeTruthy();
  expect(s.getByTestId('kip-your-kip-art', HIDDEN_OK)).toBeTruthy();
  expect(s.getByText('While KIP thinks')).toBeTruthy();
  expect(s.getByText('How the chat shows KIP is working')).toBeTruthy();
  expect(s.getByText('Typewriter')).toBeTruthy();
  await waitFor(() => expect(s.getByText('What KIP remembers')).toBeTruthy());
  expect(s.getByText('What is sent when you ask something')).toBeTruthy();
  expect(s.getByText('Turn off KIP coaching')).toBeTruthy();
  expect(s.getByText('KIP stays on Home; nothing is shared for coaching.')).toBeTruthy();
  expect(s.queryByText(/Answer style/)).toBeNull();
});

it('shows the AI engine row when the server offers Claude', () => {
  const hosted = { available: true, consented: false, consent: { version: 'h1', summary: 's', dataItems: [] } };
  const s = renderSection({ status: { ...ON, engines: { hosted } } as CoachStatusDTO });
  expect(s.getByTestId('ai-engine')).toBeTruthy();
  expect(s.getByText("KIP's AI engine")).toBeTruthy();
});

it('shows no engine choice when only the on-device model is offered', () => {
  const s = renderSection({ status: ON });
  expect(s.queryByTestId('ai-engine')).toBeNull();
});

it('counts the memories, and speaks the subtitles with commas, not middle dots', async () => {
  const s = renderSection({ status: ON });
  expect(await s.findByText('See, edit or delete · 2 things')).toBeTruthy();
  expect(s.getByTestId('kip-memory-row').props.accessibilityLabel).toBe('What KIP remembers, See, edit or delete, 2 things');
  expect(s.getByText('Cobalt · coaches you on the KIP tab').props.accessibilityLabel).toBe('Cobalt, coaches you on the KIP tab');
});

it('reads the memory count again when Settings comes back into focus (a delete on the memory page)', async () => {
  const focus: (() => void)[] = [];
  const nav = { navigate, isFocused: () => true, addListener: (event: string, cb: () => void) => {
    if (event === 'focus') focus.push(cb);
    return () => undefined;
  } };
  const s = render(<NavigationContext.Provider value={nav as never}>{withCoachStatus(<KipSettingsSection />, { status: ON })}</NavigationContext.Provider>);
  expect(await s.findByText('See, edit or delete · 2 things')).toBeTruthy();
  (listCoachMemory as jest.Mock).mockResolvedValueOnce([{ id: 'm2' }]);
  await act(async () => focus.forEach((cb) => cb()));
  expect(await s.findByText('See, edit or delete · 1 thing')).toBeTruthy();
});

it('a late reply from an older read never overwrites a newer count', async () => {
  const focus: (() => void)[] = [];
  const nav = { navigate, isFocused: () => true, addListener: (event: string, cb: () => void) => {
    if (event === 'focus') focus.push(cb);
    return () => undefined;
  } };
  let slow: (items: { id: string }[]) => void = () => {};
  (listCoachMemory as jest.Mock)
    .mockImplementationOnce(() => new Promise((res) => { slow = res; }))
    .mockResolvedValueOnce([{ id: 'm1' }]);
  const s = render(<NavigationContext.Provider value={nav as never}>{withCoachStatus(<KipSettingsSection />, { status: ON })}</NavigationContext.Provider>);
  await act(async () => focus.forEach((cb) => cb()));
  expect(await s.findByText('See, edit or delete · 1 thing')).toBeTruthy();
  await act(async () => slow([{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }]));
  expect(s.getByText('See, edit or delete · 1 thing')).toBeTruthy();
});

it.each([
  ['kip-change-colour', ['ProfileSection', { section: 'kipColour' }]],
  ['kip-thinking-text', ['ThinkingText']],
  ['kip-memory-row', ['CoachMemory']],
  // CoachConsent in review mode: the consented user sees what is sent, and is not sent on to the chat.
  ['kip-what-is-sent', ['CoachConsent', { review: true }]],
] as const)('%s opens its page', async (testID, call) => {
  const s = renderSection({ status: ON });
  fireEvent.press(await s.findByTestId(testID));
  expect(navigate).toHaveBeenCalledWith(...call);
});

it('turns KIP coaching off with the existing revoke', async () => {
  const setStatus = jest.fn();
  const s = renderSection({ status: ON, setStatus });
  fireEvent.press(s.getByTestId('coach-revoke-button'));
  await waitFor(() => expect(revokeCoachConsent).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(setStatus).toHaveBeenCalledWith({ ...ON, consented: false }));
});

it('keeps coaching on, with an error, if turning it off fails', async () => {
  (revokeCoachConsent as jest.Mock).mockRejectedValueOnce(new Error('offline'));
  const s = renderSection({ status: ON });
  fireEvent.press(s.getByTestId('coach-revoke-button'));
  expect(await s.findByText("KIP coaching couldn't be turned off. Please try again.")).toBeTruthy();
  expect(s.getByTestId('coach-revoke-button')).toBeTruthy();
});

it('off: offers "Set up KIP coaching" with the off footer', () => {
  const s = renderSection({ status: OFF });
  expect(s.getByText('Set up KIP coaching')).toBeTruthy();
  expect(s.getByText('KIP coaching is off. Nothing is shared, and the rest of the app works as normal.')).toBeTruthy();
  expect(s.queryByTestId('kip-memory-row')).toBeNull();
  expect(s.queryByTestId('coach-revoke-button')).toBeNull();
  fireEvent.press(s.getByTestId('coach-setup-button'));
  expect(navigate).toHaveBeenCalledWith('CoachConsent');
});

it('disabled on the server: your KIP and While KIP thinks stay, nothing about coaching', () => {
  const s = renderSection({ status: { ...ON, enabled: false } });
  expect(s.getByTestId('kip-your-kip')).toBeTruthy();
  expect(s.getByTestId('kip-thinking-text')).toBeTruthy();
  expect(s.queryByTestId('coach-setup-button')).toBeNull();
  expect(s.queryByTestId('kip-memory-row')).toBeNull();
  expect(s.queryByText('KIP coaching is off. Nothing is shared, and the rest of the app works as normal.')).toBeNull();
});
