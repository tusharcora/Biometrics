import React, { useCallback, useRef, useState } from 'react';
import { FlatList, Pressable, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCharacter } from '../characters/CharacterContext';
import { Character } from '../components/characters/Character';
import { CHARACTERS } from '../components/characters/registry';
import { CHARACTER_IDS, type CharacterId } from '../components/characters/types';
import type { CoachStatusDTO } from '../api/coach';
import { Button } from '../components/ui/button';
import { Text } from '../components/ui/text';
import { useToast } from '../components/ui/toast';
import { cn } from '../lib/utils';
import type { RootStackParamList } from '../navigation/RootNavigator';

type MeetRoute = RouteProp<RootStackParamList, 'MeetYourCoach'>;
type MeetNavigation = NativeStackNavigationProp<RootStackParamList, 'MeetYourCoach'>;

const ART_SIZE = 180;

// The server's copy wins when it has any (spec §1 Registry); a missing, null
// or blank field falls back to the app's own.
function serverCopy(value: string | null | undefined, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function pageCopy(id: CharacterId, status: CoachStatusDTO | null) {
  const persona = status?.personas?.find((p) => p.id === id);
  return {
    tagline: serverCopy(persona?.tagline, CHARACTERS[id].tagline),
    greeting: serverCopy(persona?.greeting, CHARACTERS[id].greeting),
  };
}

// "Meet your coach" (spec §5): a horizontal pager of the eight characters.
// 'first' opens by itself on the first Coach-tab visit, starts on Hoot and can
// be skipped (Skip saves Hoot so it never comes back); 'switch' comes from
// Profile, starts on the current character and just closes.
export function MeetYourCoachScreen() {
  const navigation = useNavigation<MeetNavigation>();
  const route = useRoute<MeetRoute>();
  // Anything but an explicit 'first' is the harmless mode: no Skip, nothing
  // saved unless a character is chosen.
  const mode = route.params?.mode === 'first' ? 'first' : 'switch';
  const { characterId, status, chooseCharacter } = useCharacter();
  const toast = useToast();
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<CharacterId>>(null);
  const startIndex = mode === 'first' ? 0 : Math.max(0, CHARACTER_IDS.indexOf(characterId));
  const [index, setIndex] = useState(startIndex);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeId = CHARACTER_IDS[index] ?? CHARACTER_IDS[0];
  const activeName = CHARACTERS[activeId].name;

  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (width <= 0) return;
      const next = Math.round(e.nativeEvent.contentOffset.x / width);
      setIndex(Math.min(CHARACTER_IDS.length - 1, Math.max(0, next)));
      setError(null);
    },
    [width],
  );

  function goTo(next: number) {
    listRef.current?.scrollToIndex({ index: next, animated: true });
    setIndex(next);
    setError(null);
  }

  async function choose(id: CharacterId) {
    if (saving) return;
    // Nothing to save when switching to the character you already have.
    if (mode === 'switch' && id === characterId) {
      navigation.goBack();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await chooseCharacter(id);
      navigation.goBack();
    } catch {
      if (mode === 'first') {
        // Closes anyway: the choice isn't saved, so the picker comes back on
        // a later Coach-tab visit rather than trapping the user here.
        toast.show("Couldn't save your coach. We'll ask again later.", 'error');
        navigation.goBack();
        return;
      }
      setError(`${CHARACTERS[id].name} couldn't be saved. Please try again.`);
      setSaving(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <View className="flex-row items-center justify-between px-5 pt-2">
        <Text className="text-eyebrow font-semibold uppercase text-muted-foreground">Meet your coach</Text>
        {mode === 'first' ? (
          <Button testID="meet-skip" variant="ghost" size="sm" disabled={saving} onPress={() => void choose('hoot')}>
            Skip
          </Button>
        ) : (
          <Button testID="meet-close" variant="ghost" size="sm" disabled={saving} onPress={() => navigation.goBack()}>
            Close
          </Button>
        )}
      </View>

      <FlatList
        ref={listRef}
        testID="meet-pager"
        data={CHARACTER_IDS}
        keyExtractor={(id) => id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={startIndex}
        initialNumToRender={CHARACTER_IDS.length}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        onMomentumScrollEnd={onMomentumScrollEnd}
        extraData={index}
        renderItem={({ item: id, index: i }) => {
          const { tagline, greeting } = pageCopy(id, status);
          const name = CHARACTERS[id].name;
          return (
            <View testID={`meet-page-${id}`} style={{ width }} className="flex-1 items-center justify-center gap-6 px-8">
              {/* Only the page on screen animates (spec §1 Performance). */}
              <Character characterId={id} mood="idle" size={ART_SIZE} paused={i !== index} glow accessibilityLabel={name} />
              <View className="items-center gap-1.5">
                <Text className="font-display text-display-lg">{name}</Text>
                <Text testID={`meet-tagline-${id}`} className="text-center text-base text-muted-foreground">
                  {tagline}
                </Text>
              </View>
              <View className="items-center">
                {/* The bubble's tail, pointing up at the character. */}
                <View className="-mb-1.5 h-3 w-3 rotate-45 border-l border-t border-border bg-card" />
                <View className="max-w-[320px] rounded-card border border-border bg-card px-4 py-3">
                  <Text testID={`meet-greeting-${id}`} className="text-center text-base">
                    {greeting}
                  </Text>
                </View>
              </View>
            </View>
          );
        }}
      />

      <View className="gap-4 px-5 pb-4">
        <View className="flex-row items-center justify-center gap-2">
          {CHARACTER_IDS.map((id, i) => (
            <Pressable
              key={id}
              testID={`meet-dot-${id}`}
              accessibilityRole="button"
              accessibilityLabel={`Show ${CHARACTERS[id].name}`}
              accessibilityState={{ selected: i === index }}
              hitSlop={8}
              onPress={() => goTo(i)}
              className={cn('h-2 rounded-full', i === index ? 'w-5 bg-foreground' : 'w-2 bg-border')}
            />
          ))}
        </View>
        {error ? (
          <Text testID="meet-error" className="text-center text-sm text-destructive">
            {error}
          </Text>
        ) : null}
        <Button testID="meet-choose" disabled={saving} onPress={() => void choose(activeId)}>
          {`Choose ${activeName}`}
        </Button>
      </View>
    </SafeAreaView>
  );
}
