import fs from 'fs';
import path from 'path';
import React from 'react';
import { renderHook } from '@testing-library/react-native';
import { CHARACTERS, characterInfo } from '../../src/components/characters/registry';
import { CHARACTER_IDS } from '../../src/components/characters/types';
import { CharacterContext, useCharacter, useCharacterOptional, type CharacterContextValue } from '../../src/characters/CharacterContext';

describe('registry', () => {
  it('has one entry per character id, keyed by its own id', () => {
    expect(Object.keys(CHARACTERS).sort()).toEqual([...CHARACTER_IDS].sort());
    for (const id of CHARACTER_IDS) expect(CHARACTERS[id].id).toBe(id);
  });

  it('matches the backend v2 persona ids exactly', () => {
    const source = fs.readFileSync(path.join(__dirname, '../../../backend/src/coach/personas/v2.ts'), 'utf8');
    const backendIds = [...source.matchAll(/\bid: '([a-z]+)'/g)].map((m) => m[1]);
    expect(backendIds).toEqual([...CHARACTER_IDS]);
  });

  it('gives every character a name, a hex accent, a tagline and a greeting', () => {
    for (const id of CHARACTER_IDS) {
      const c = CHARACTERS[id];
      expect(c.name.length).toBeGreaterThan(0);
      expect(c.accent).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(c.tagline.length).toBeGreaterThan(0);
      expect(c.greeting.length).toBeGreaterThan(0);
    }
  });

  it('falls back to Hoot for unknown, legacy and missing ids', () => {
    expect(characterInfo('ember').name).toBe('Ember');
    expect(characterInfo('encouraging').id).toBe('hoot');
    expect(characterInfo('twinkle').id).toBe('hoot');
    expect(characterInfo(null).id).toBe('hoot');
    expect(characterInfo(undefined).id).toBe('hoot');
  });
});

describe('CharacterContext', () => {
  it('is null outside a provider for the optional hook', () => {
    const { result } = renderHook(() => useCharacterOptional());
    expect(result.current).toBeNull();
  });

  it('throws outside a provider for the required hook', () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => renderHook(() => useCharacter())).toThrow('useCharacter must be used inside CharacterProvider');
  });

  it('returns the provided value', () => {
    const value = { characterId: 'beep' } as CharacterContextValue;
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <CharacterContext.Provider value={value}>{children}</CharacterContext.Provider>
    );
    const { result } = renderHook(() => useCharacter(), { wrapper });
    expect(result.current.characterId).toBe('beep');
  });
});
