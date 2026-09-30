import React, { useContext } from 'react';
import { NavigationContext } from '@react-navigation/native';
import { useCharacterOptional } from '../characters/CharacterContext';
import { useScreenFocused } from '../characters/useScreenFocused';
import { Character } from './characters/Character';
import { characterInfo } from './characters/registry';
import { SettingsGroup, SettingsRow } from './ui/settings-list';

// Profile's "Your coach" row: the current character, small and animating, and
// the way into Meet your coach to switch. It shows whether or not the coach is
// enabled, because the character is also the app's look (spec §5, §6).
export function YourCoachRow() {
  // Context rather than useNavigation(): Settings also renders outside a
  // navigator (see SettingsScreen).
  const navigation = useContext(NavigationContext);
  const info = characterInfo(useCharacterOptional()?.characterId);
  // Profile stays mounted under the picker and other tabs; hold still there.
  const focused = useScreenFocused();

  return (
    <SettingsGroup testID="your-coach" label="Your coach" footer="How your coach looks and talks to you.">
      <SettingsRow
        testID="your-coach-row"
        leading={<Character characterId={info.id} mood="idle" size={36} paused={!focused} />}
        title={info.name}
        subtitle={info.tagline}
        accessibilityLabel={`${info.name}, your coach`}
        accessibilityHint="Opens Meet your coach to choose another"
        onPress={() => navigation?.navigate('MeetYourCoach', { mode: 'switch' })}
      />
    </SettingsGroup>
  );
}
