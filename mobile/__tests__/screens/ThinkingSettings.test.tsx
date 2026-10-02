import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { ThinkingStyleScreen } from '../../src/screens/ThinkingStyleScreen';
import { ThinkingTextScreen } from '../../src/screens/ThinkingTextScreen';
import { THINKING_ATTACHMENTS, THINKING_TEXTS } from '../../src/components/characters/thinking';
import { characterLabel, HIDDEN_OK, withCharacter } from '../../jest-mocks/characterContext';

// Synchronous icons: the real font load re-renders after these tests finish.
jest.mock('@expo/vector-icons', () => require('../../jest-mocks/vectorIcons'));

describe('ThinkingStyleScreen', () => {
  it('lists the 9 attachments with Lightbulb selected by default and saves a choice', async () => {
    const chooseThinking = jest.fn(async () => {});
    const s = render(withCharacter(<ThinkingStyleScreen />, { chooseThinking }));
    for (const id of THINKING_ATTACHMENTS) expect(s.getByTestId(`thinking-style-${id}`)).toBeTruthy();
    expect(s.getByTestId('thinking-style-bulb').props.accessibilityState).toMatchObject({ selected: true });
    expect(s.getByTestId('thinking-style-gears').props.accessibilityState).toMatchObject({ selected: false });
    expect(s.getByTestId('thinking-style-bulb').props.accessibilityRole).toBe('radio');
    await act(async () => fireEvent.press(s.getByTestId('thinking-style-gears')));
    expect(chooseThinking).toHaveBeenCalledWith({ attachment: 'gears' });
  });

  it("previews with the user's own coach and attachment", () => {
    const s = render(withCharacter(<ThinkingStyleScreen />, { characterId: 'luna', thinkingAttachment: 'clock' }));
    expect(characterLabel(s, 'thinking-preview')).toMatch(/^character:luna:thinking:96:playing:clock$/);
  });

  it('loops the preview from thinking into the answering moment', () => {
    jest.useFakeTimers();
    try {
      const s = render(withCharacter(<ThinkingStyleScreen />, { characterId: 'kit' }));
      expect(characterLabel(s, 'thinking-preview')).toMatch(/^character:kit:thinking:/);
      act(() => jest.advanceTimersByTime(2400));
      expect(characterLabel(s, 'thinking-preview')).toMatch(/^character:kit:answering:/);
      act(() => jest.advanceTimersByTime(800));
      expect(characterLabel(s, 'thinking-preview')).toMatch(/^character:kit:thinking:/);
      s.unmount();
    } finally {
      jest.useRealTimers();
    }
  });

  it('animates only the selected tile, each wearing its own attachment', () => {
    const s = render(withCharacter(<ThinkingStyleScreen />, { characterId: 'boba', thinkingAttachment: 'cloud' }));
    expect(characterLabel(s, 'thinking-style-cloud')).toBe('character:boba:thinking:48:playing:cloud');
    expect(characterLabel(s, 'thinking-style-spinner')).toBe('character:boba:thinking:48:paused:spinner');
  });

  it('shows an error when saving fails', async () => {
    const chooseThinking = jest.fn(async () => {
      throw new Error('offline');
    });
    const s = render(withCharacter(<ThinkingStyleScreen />, { chooseThinking }));
    await act(async () => fireEvent.press(s.getByTestId('thinking-style-hourglass')));
    expect(s.getByText(/thinking style couldn't be saved/i)).toBeTruthy();
    expect(s.getByTestId('thinking-style-bulb').props.accessibilityState).toMatchObject({ selected: true });
  });
});

describe('ThinkingTextScreen', () => {
  it("lists the 10 text styles with What it's doing selected by default and saves a choice", async () => {
    const chooseThinking = jest.fn(async () => {});
    const s = render(withCharacter(<ThinkingTextScreen />, { chooseThinking }));
    for (const id of THINKING_TEXTS) expect(s.getByTestId(`thinking-text-${id}`)).toBeTruthy();
    expect(s.getByTestId('thinking-text-steps').props.accessibilityState).toMatchObject({ selected: true });
    expect(s.getByTestId('thinking-text-dialog').props.accessibilityState).toMatchObject({ selected: false });
    expect(s.getByTestId('thinking-text-steps')).toHaveTextContent(/What it's doing/);
    await act(async () => fireEvent.press(s.getByTestId('thinking-text-dialog')));
    expect(chooseThinking).toHaveBeenCalledWith({ text: 'dialog' });
  });

  it("previews the chosen style with the user's coach", () => {
    const s = render(withCharacter(<ThinkingTextScreen />, { characterId: 'pengu', thinkingText: 'steps' }));
    expect(characterLabel(s, 'thinking-preview')).toMatch(/^character:pengu:thinking:36:/);
    expect(s.getByTestId('thinking-preview', HIDDEN_OK)).toHaveTextContent(/Looking at your sleep/);
  });

  it('shows an error and keeps the old choice when saving fails', async () => {
    const chooseThinking = jest.fn(async () => {
      throw new Error('offline');
    });
    const s = render(withCharacter(<ThinkingTextScreen />, { chooseThinking }));
    await act(async () => fireEvent.press(s.getByTestId('thinking-text-tag')));
    expect(s.getByText(/couldn't be saved/i)).toBeTruthy();
    expect(s.getByTestId('thinking-text-steps').props.accessibilityState).toMatchObject({ selected: true });
  });
});
