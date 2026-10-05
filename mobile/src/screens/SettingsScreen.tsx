import React, { useContext, useEffect, useMemo, useState } from 'react';
import { View, Pressable, TextInput, FlatList, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { NavigationContext } from '@react-navigation/native';
import { Text } from '../components/ui/text';
import { Button } from '../components/ui/button';
import { Ionicons } from '@expo/vector-icons';
import { SettingsGroup, SettingsRow } from '../components/ui/settings-list';
import { useOptionalAuth } from '../auth/AuthContext';
import { AccountSection } from '../components/account-section';
import { CoachSettingsSection } from '../components/coach-settings-section';
import { DeleteAccountSection } from '../components/delete-account-section';
import { NotificationsSection } from '../components/notifications-section';
import { YourCoachRow } from '../components/your-coach-row';
import { COLORS, FONTS } from '../theme';
import { useSync } from '../sync/SyncProvider';
import { formatLastSynced } from '../sync/formatLastSynced';
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
  // Context rather than useNavigation(): this screen is also rendered in
  // isolation (see useAuthOptional below for the same reason), and
  // useNavigation throws when there is no navigator above it.
  const navigation = useContext(NavigationContext);
  const { state: syncState, lastSyncedAt, connection, syncNow } = useSync();
  const clearance = useTabBarClearance();
  const auth = useOptionalAuth();
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
              style={{ color: colors.foreground, fontFamily: FONTS.sans }}
              className="rounded-tile border border-border bg-card px-4 py-3"
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

  const email = auth?.session?.email ?? null;
  const connected = connection === 'CONNECTED';

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: 24, paddingHorizontal: 20, paddingTop: 8, paddingBottom: clearance }}
      >
        <View className="items-center gap-2 pt-2">
          <View className="h-20 w-20 items-center justify-center rounded-full border border-border bg-muted">
            {email ? (
              <Text className="font-display text-display-lg">{email.charAt(0).toUpperCase()}</Text>
            ) : (
              <Ionicons name="person-outline" size={30} color={colors.muted} />
            )}
          </View>
          <Text className="font-display text-display">Profile</Text>
          {email ? <Text className="text-sm text-muted-foreground">{email}</Text> : null}
        </View>

        {/* Connecting is a task reachable from a tab, not a gate in front of the
            app: signing in lands on the dashboard whatever the status is. */}
        <SettingsGroup label="Health data">
          <SettingsRow
            testID="connect-health-row"
            icon="heart"
            tint={colors.metricHeart}
            title="Google Health"
            subtitle="Sync steps, sleep, heart rate and HRV"
            value={connected ? 'Connected' : 'Connect'}
            onPress={() => navigation?.navigate('ConnectHealth' as never)}
          />
          {connected ? (
            <SettingsRow
              testID="settings-sync-now"
              icon="sync-outline"
              title={syncState === 'syncing' ? 'Syncing…' : 'Sync now'}
              subtitle={lastSyncedAt ? formatLastSynced(lastSyncedAt, new Date(), 'Last synced') : 'Not synced yet'}
              subtitleTestID="settings-last-synced"
              disabled={syncState === 'syncing'}
              onPress={() => void syncNow('manual')}
            />
          ) : null}
        </SettingsGroup>

        <SettingsGroup label="Time zone" footer={error ?? undefined}>
          <SettingsRow
            testID="timezone-row"
            icon="globe-outline"
            tint={colors.metricHrv}
            title={state?.overridden ? 'Custom time zone' : 'Device time zone'}
            value={state ? state.timezone : '…'}
            valueTestID="timezone-value"
            onPress={() => setPicking(true)}
          />
          {state?.overridden ? (
            <SettingsRow testID="use-device-timezone-button" icon="phone-portrait-outline" title="Use device time zone" onPress={useDevice} />
          ) : null}
        </SettingsGroup>

        <NotificationsSection />
        <AccountSection />
        <YourCoachRow />
        <CoachSettingsSection />
        <DeleteAccountSection />
      </ScrollView>
    </SafeAreaView>
  );
}
