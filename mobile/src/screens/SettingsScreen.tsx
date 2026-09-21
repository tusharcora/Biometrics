import React, { useEffect, useMemo, useState } from 'react';
import { View, Pressable, TextInput, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { Text } from '../components/ui/text';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { CoachSettingsSection } from '../components/coach-settings-section';
import { COLORS } from '../theme';
import { useTabBarClearance } from '../navigation/tabBarLayout';
import {
  clearTimezoneOverride,
  getTimezoneState,
  listTimeZones,
  setTimezoneOverride,
  type TimezoneState,
} from '../lib/timezone';

const MAX_RESULTS = 60;

export function SettingsScreen() {
  const clearance = useTabBarClearance();
  const { colorScheme: scheme } = useColorScheme();
  const colors = scheme === 'dark' ? COLORS.dark : COLORS.light;
  const [state, setState] = useState<TimezoneState | null>(null);
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getTimezoneState().then(setState).catch(() => setState(null));
  }, []);

  const zones = useMemo(() => (picking ? listTimeZones() : []), [picking]);
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase().replace(/ /g, '_');
    const filtered = needle ? zones.filter((z) => z.toLowerCase().includes(needle)) : zones;
    return filtered.slice(0, MAX_RESULTS);
  }, [zones, query]);

  async function choose(zone: string) {
    setError(null);
    try {
      await setTimezoneOverride(zone);
      setState(await getTimezoneState());
      setPicking(false);
      setQuery('');
    } catch {
      setError('That time zone could not be saved.');
    }
  }

  async function useDevice() {
    setError(null);
    try {
      await clearTimezoneOverride();
      setState(await getTimezoneState());
    } catch {
      setError('Could not switch back to the device time zone.');
    }
  }

  if (picking) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View testID="timezone-picker" className="flex-1" style={{ paddingBottom: clearance }}>
          <View className="gap-3 p-4">
            <TextInput
              testID="timezone-search-input"
              value={query}
              onChangeText={setQuery}
              placeholder="Search time zones"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
              style={{ color: colors.foreground }}
              className="rounded-xl border border-border bg-card px-4 py-3"
            />
            {error ? <Text className="text-sm text-destructive">{error}</Text> : null}
          </View>
          <FlatList
            data={matches}
            keyExtractor={(zone) => zone}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
            ListEmptyComponent={<Text className="p-4 text-center text-muted-foreground">No matching time zones.</Text>}
            renderItem={({ item }) => (
              <Pressable testID={`timezone-option-${item}`} onPress={() => choose(item)} className="py-3 active:opacity-70">
                <Text className={item === state?.timezone ? 'font-semibold' : ''}>{item}</Text>
              </Pressable>
            )}
          />
          <View className="items-center p-2">
            <Button testID="timezone-cancel-button" variant="ghost" size="sm" onPress={() => setPicking(false)}>
              Cancel
            </Button>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="gap-3 p-4" style={{ paddingBottom: clearance }}>
        <Card className="gap-1">
          <Pressable testID="timezone-row" onPress={() => setPicking(true)} className="active:opacity-70">
            <Text className="text-sm text-muted-foreground">Time zone</Text>
            <Text testID="timezone-value" className="text-base font-medium">
              {state ? state.timezone : '…'}
            </Text>
            <Text className="text-xs text-muted-foreground">
              {state?.overridden ? 'Custom — tap to change' : 'Using your device time zone — tap to change'}
            </Text>
          </Pressable>
        </Card>
        {state?.overridden ? (
          <Button testID="use-device-timezone-button" variant="ghost" onPress={useDevice}>
            Use device time zone
          </Button>
        ) : null}
        {error ? <Text className="text-sm text-destructive">{error}</Text> : null}
        <CoachSettingsSection />
      </View>
    </SafeAreaView>
  );
}
