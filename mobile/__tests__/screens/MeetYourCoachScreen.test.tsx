import React from 'react';
import { Dimensions } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { MeetYourCoachScreen } from '../../src/screens/MeetYourCoachScreen';
import { HIDDEN_OK, withCharacter } from '../../jest-mocks/characterContext';
import type { CharacterContextValue } from '../../src/characters/CharacterContext';
import type { CoachStatusDTO } from '../../src/api/coach';

const mockGoBack = jest.fn();
let mockParams: unknown;
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack, navigate: jest.fn() }),
  useRoute: () => ({ params: mockParams }),
}));

const mockToastShow = jest.fn();
jest.mock('../../src/components/ui/toast', () => ({ useToast: () => ({ show: mockToastShow }) }));

const { width } = Dimensions.get('window');

const status: CoachStatusDTO = {
  enabled: true,
  consented: false,
  consent: { version: 'v1', summary: 's', dataItems: ['x'] },
  personaId: 'hoot',
  personaChosen: false,
  personas: [
    { id: 'hoot', name: 'Hoot', verbosity: 'normal', proactivity: 'threshold-triggered', tagline: 'Server tagline for Hoot.', greeting: 'Server hello from Hoot.' },
    { id: 'pip', name: 'Pip', verbosity: 'terse', proactivity: 'threshold-triggered', tagline: null, greeting: '   ' },
  ],
};

let chooseCharacter: jest.Mock;

function renderMeet(overrides: Partial<CharacterContextValue> = {}) {
  return render(withCharacter(<MeetYourCoachScreen />, { chooseCharacter, ...overrides }));
}

// Labels of the characters that are animating (only the visible page may).
function playing(utils: ReturnType<typeof render>) {
  return utils
    .getAllByTestId('character-canvas', HIDDEN_OK)
    .map((node) => node.props.accessibilityLabel as string)
    .filter((label) => label.includes(':playing:'));
}

function swipeTo(utils: ReturnType<typeof render>, page: number) {
  fireEvent(utils.getByTestId('meet-pager'), 'momentumScrollEnd', {
    nativeEvent: {
      contentOffset: { x: width * page, y: 0 },
      contentSize: { width: width * 8, height: 600 },
      layoutMeasurement: { width, height: 600 },
    },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = { mode: 'first' };
  chooseCharacter = jest.fn(() => Promise.resolve());
});

describe('MeetYourCoachScreen: first visit', () => {
  it('starts on Hoot, with only Hoot animating, and offers Skip', () => {
    const utils = renderMeet({ personaChosen: false, status });

    expect(utils.getByTestId('meet-choose')).toHaveTextContent('Choose Hoot');
    expect(playing(utils)).toEqual(['character:hoot:idle:180:playing:full']);
    expect(utils.getByTestId('meet-dot-hoot').props.accessibilityState).toEqual(expect.objectContaining({ selected: true }));
    expect(utils.getByTestId('meet-skip')).toBeTruthy();
    expect(utils.queryByTestId('meet-close')).toBeNull();
  });

  it("labels each page's character with its name", () => {
    const utils = renderMeet({ personaChosen: false, status });

    expect(utils.getByLabelText('Hoot')).toBeTruthy();
    expect(utils.getByLabelText('Beat')).toBeTruthy();
    expect(utils.queryByLabelText('Hoot, your coach')).toBeNull();
  });

  it("shows the server's tagline and greeting when it has them, else the app's own", () => {
    const utils = renderMeet({ personaChosen: false, status });

    expect(utils.getByTestId('meet-tagline-hoot')).toHaveTextContent('Server tagline for Hoot.');
    expect(utils.getByTestId('meet-greeting-hoot')).toHaveTextContent('Server hello from Hoot.');
    // null tagline and a blank greeting both fall back to the registry.
    expect(utils.getByTestId('meet-tagline-pip')).toHaveTextContent('Your tiny cheerleader. Celebrates every small win.');
    expect(utils.getByTestId('meet-greeting-pip')).toHaveTextContent("Hi! You showed up, and that's already a win. What should we look at?");
    // Not in the server's list at all.
    expect(utils.getByTestId('meet-greeting-doze')).toHaveTextContent('*yawn* Oh, hi. Shall we talk about how you slept?');
  });

  it('uses the app copy when the status is unknown', () => {
    const utils = renderMeet({ personaChosen: false, status: null });

    expect(utils.getByTestId('meet-greeting-hoot')).toHaveTextContent("I've been watching your numbers overnight. Want to see what stood out?");
  });

  it('pages: the visible page animates and the button follows it', () => {
    const utils = renderMeet({ personaChosen: false, status });

    swipeTo(utils, 2);

    expect(utils.getByTestId('meet-choose')).toHaveTextContent('Choose Mochi');
    expect(playing(utils)).toEqual(['character:mochi:idle:180:playing:full']);
    expect(utils.getByTestId('meet-dot-mochi').props.accessibilityState).toEqual(expect.objectContaining({ selected: true }));
  });

  it('keeps the page in range for an overscroll past either end', () => {
    const utils = renderMeet({ personaChosen: false, status });

    swipeTo(utils, 12);
    expect(utils.getByTestId('meet-choose')).toHaveTextContent('Choose Beat');

    swipeTo(utils, -3);
    expect(utils.getByTestId('meet-choose')).toHaveTextContent('Choose Hoot');
  });

  it('jumps to a page from its dot', () => {
    const utils = renderMeet({ personaChosen: false, status });

    fireEvent.press(utils.getByTestId('meet-dot-beep'));

    expect(utils.getByTestId('meet-choose')).toHaveTextContent('Choose Beep');
  });

  it('chooses the visible character and closes', async () => {
    const utils = renderMeet({ personaChosen: false, status });
    swipeTo(utils, 4);

    fireEvent.press(utils.getByTestId('meet-choose'));

    await waitFor(() => expect(mockGoBack).toHaveBeenCalledTimes(1));
    expect(chooseCharacter).toHaveBeenCalledWith('ember');
  });

  it('saves Hoot on Skip, even when Hoot is already the current character', async () => {
    const utils = renderMeet({ characterId: 'hoot', personaChosen: false, status });
    swipeTo(utils, 3);

    fireEvent.press(utils.getByTestId('meet-skip'));

    await waitFor(() => expect(mockGoBack).toHaveBeenCalledTimes(1));
    expect(chooseCharacter).toHaveBeenCalledWith('hoot');
    expect(chooseCharacter).toHaveBeenCalledTimes(1);
  });

  it('closes anyway, with a short error, when saving fails', async () => {
    chooseCharacter.mockRejectedValue(new Error('offline'));
    const utils = renderMeet({ personaChosen: false, status });

    fireEvent.press(utils.getByTestId('meet-skip'));

    await waitFor(() => expect(mockGoBack).toHaveBeenCalledTimes(1));
    expect(mockToastShow).toHaveBeenCalledWith("Couldn't save your coach. We'll ask again later.", 'error');
  });

  it('saves once for a double tap', async () => {
    let resolveSave!: () => void;
    chooseCharacter.mockImplementation(() => new Promise<void>((r) => (resolveSave = r)));
    const utils = renderMeet({ personaChosen: false, status });

    fireEvent.press(utils.getByTestId('meet-choose'));
    fireEvent.press(utils.getByTestId('meet-choose'));
    await act(async () => resolveSave());

    expect(chooseCharacter).toHaveBeenCalledTimes(1);
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });
});

describe('MeetYourCoachScreen: switching from Profile', () => {
  beforeEach(() => {
    mockParams = { mode: 'switch' };
  });

  it('starts on the current character and has Close instead of Skip', () => {
    const utils = renderMeet({ characterId: 'ember', status: { ...status, personaChosen: true } });

    expect(utils.getByTestId('meet-choose')).toHaveTextContent('Choose Ember');
    expect(playing(utils)).toEqual(['character:ember:idle:180:playing:full']);
    expect(utils.queryByTestId('meet-skip')).toBeNull();
    fireEvent.press(utils.getByTestId('meet-close'));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('closes without saving when the current character is chosen again', async () => {
    const utils = renderMeet({ characterId: 'beat' });

    fireEvent.press(utils.getByTestId('meet-choose'));

    await waitFor(() => expect(mockGoBack).toHaveBeenCalledTimes(1));
    expect(chooseCharacter).not.toHaveBeenCalled();
  });

  it('stays open with a short error when saving fails, and can try again', async () => {
    chooseCharacter.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);
    const utils = renderMeet({ characterId: 'hoot' });
    swipeTo(utils, 1);

    fireEvent.press(utils.getByTestId('meet-choose'));

    expect(await utils.findByTestId('meet-error')).toHaveTextContent("Pip couldn't be saved. Please try again.");
    expect(mockGoBack).not.toHaveBeenCalled();
    expect(mockToastShow).not.toHaveBeenCalled();

    fireEvent.press(utils.getByTestId('meet-choose'));
    await waitFor(() => expect(mockGoBack).toHaveBeenCalledTimes(1));
    expect(chooseCharacter).toHaveBeenCalledTimes(2);
  });

  it('treats missing params as switch mode', () => {
    mockParams = undefined;
    const utils = renderMeet({ characterId: 'nimbus' });

    expect(utils.getByTestId('meet-choose')).toHaveTextContent('Choose Nimbus');
    expect(utils.queryByTestId('meet-skip')).toBeNull();
  });
});
