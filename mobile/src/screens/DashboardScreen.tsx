import React, { useEffect, useMemo, useState } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useColorScheme } from 'nativewind';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '../api/client';
import { fetchScoresWithBands, type DailyScoreDTO, type ScoreBandsDTO } from '../api/scores';
import { useAuth } from '../auth/AuthContext';
import { Text } from '../components/ui/text';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { SectionLabel } from '../components/ui/section-label';
import { Character } from '../components/characters/Character';
import { useScreenFocused } from '../characters/useScreenFocused';
import { ThemeToggle } from '../components/ui/theme-toggle';
import { Reveal } from '../components/ui/reveal';
import { HabitLogCard } from '../components/habit-log-card';
import { CoachDigestCard } from '../components/coach-digest-card';
import { StoryRing, useStoryRing } from '../components/recap/StoryRing';
import { TomorrowCard } from '../components/tomorrow-card';
import { RecoveryHero } from '../components/home/recovery-hero';
import { SleepTile } from '../components/home/sleep-tile';
import { CoachTile } from '../components/home/coach-tile';
import { MetricTile } from '../components/home/metric-tile';
import { COLORS, METRIC_ORDER, type MetricType } from '../theme';
import { computeStats, buildHeadline, type MetricRecord } from '../lib/metricInsights';
import { coachEntryRoute, useCoachStatus } from '../lib/useCoachStatus';
import { useForecast } from '../lib/useForecast';
import { useSync } from '../sync/SyncProvider';
import { SyncStatusLine } from '../components/sync-status-line';
import { navigateToCoachEntry } from '../navigation/coachNavigation';
import { useTabBarClearance } from '../navigation/tabBarLayout';

type ConnectionStatus = 'CONNECTED' | 'DISCONNECTED' | 'NOT_CONNECTED';

function seriesFor(records: MetricRecord[], type: MetricType): MetricRecord[] {
  return records
    .filter((r) => r.metricType === type)
    .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());
}

// A real comparison against this person's own recent readings -- never a
// fabricated score. Picks whichever metric deviates most from its own
// trailing average (excluding today's own reading from that average).
function computeHeadlineInsight(records: MetricRecord[]): string | null {
  let best: { deviation: number; message: string } | null = null;

  for (const type of METRIC_ORDER) {
    const stats = computeStats(seriesFor(records, type));
    if (!stats || stats.direction === 'steady') continue;
    if (!best || stats.trendPercent > best.deviation) {
      best = { deviation: stats.trendPercent, message: buildHeadline(type, stats) };
    }
  }

  return best?.message ?? null;
}

export function greetingFor(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

// undefined while loading, null when no score of that type exists yet (for
// Sleep: no night of sleep recorded).
type ScoreState = DailyScoreDTO | null | undefined;

export function DashboardScreen() {
  const navigation = useNavigation<any>();
  const clearance = useTabBarClearance();
  const { signOut, session } = useAuth();
  const { colorScheme: scheme } = useColorScheme();
  const colors = scheme === 'dark' ? COLORS.dark : COLORS.light;
  const [records, setRecords] = useState<MetricRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [recovery, setRecovery] = useState<ScoreState>(undefined);
  const [sleep, setSleep] = useState<ScoreState>(undefined);
  const [scoresFailed, setScoresFailed] = useState(false);
  // Undefined until loaded (and on an older server): scoreBand uses its defaults.
  const [bands, setBands] = useState<ScoreBandsDTO | undefined>(undefined);
  // Null until known, and null on failure: the coach entry simply isn't drawn.
  const { status: coachStatus } = useCoachStatus(navigation);
  const coachRoute = coachEntryRoute(coachStatus);
  const focused = useScreenFocused();
  // Bumped after each successful sync with Google Health, so the data reloads.
  const { dataVersion } = useSync();
  const forecastState = useForecast(dataVersion);

  useEffect(() => {
    apiFetch<MetricRecord[]>('/me/biometrics')
      .then((r) => { setRecords(r); setError(null); })
      .catch(() => setError('Something went wrong loading your data.'));
  }, [dataVersion]);

  useEffect(() => {
    // A disconnected Google Health is why the data stops updating, so say so
    // rather than leaving the user staring at silently stale numbers.
    apiFetch<{ status: ConnectionStatus }>('/me/connection')
      .then((res) => setConnectionStatus(res?.status ?? null))
      .catch(() => setConnectionStatus(null));
  }, [dataVersion]);

  useEffect(() => {
    // Independent of the metric cards: a scores failure must not take the rest
    // of the dashboard down with it.
    let cancelled = false;
    (async () => {
      try {
        const { scores, bands: serverBands } = await fetchScoresWithBands(7);
        // One request returns both types, newest first; each card is the most
        // recent score of its type. No Sleep Score means no recorded sleep.
        if (!cancelled) {
          setBands(serverBands);
          setRecovery(scores?.find((s) => s.type === 'RECOVERY') ?? null);
          setSleep(scores?.find((s) => s.type === 'SLEEP') ?? null);
        }
      } catch {
        if (!cancelled) setScoresFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dataVersion]);

  const seriesByMetric = useMemo(() => {
    const all = records ?? [];
    return Object.fromEntries(METRIC_ORDER.map((type) => [type, seriesFor(all, type)])) as Record<MetricType, MetricRecord[]>;
  }, [records]);
  const insight = useMemo(() => computeHeadlineInsight(records ?? []), [records]);

  function openDetail(type: MetricType) {
    navigation.navigate('MetricDetail', { metricType: type, records: seriesByMetric[type] });
  }

  // An unwatched weekly recap rings the avatar in its coach's colour; a tap plays its story
  // instead of opening Profile.
  const ring = useStoryRing(scheme === 'dark' ? 'dark' : 'light', navigation);
  function openProfile() {
    if (ring) navigation.navigate(ring.destination.name, ring.destination.params);
    else navigation.navigate('Tabs', { screen: 'Profile' });
  }

  const initial = session?.email?.trim().charAt(0).toUpperCase() ?? '';
  const profileButton = (
    <Pressable
      testID="settings-button"
      accessibilityRole="button"
      accessibilityLabel={ring ? `Profile. ${ring.hint}` : 'Profile and settings'}
      onPress={openProfile}
      hitSlop={4}
      className="active:opacity-70"
    >
      <StoryRing testID="profile-story-ring" color={ring?.color ?? null} size={44} ringWidth={2.5} gap={2.5} dotSize={12} surface={colors.background}>
        <View className={ring ? 'flex-1 items-center justify-center bg-muted' : 'flex-1 items-center justify-center rounded-full border border-border bg-muted'}>
          {initial ? (
            <Text className={ring ? 'text-sm font-semibold' : 'text-base font-semibold'}>{initial}</Text>
          ) : (
            <Ionicons name="person-outline" size={ring ? 16 : 18} color={colors.foreground} />
          )}
        </View>
      </StoryRing>
    </Pressable>
  );

  // The fallback states can't reach anything else on Home, so they keep
  // sign-out right there; the full Home moves it to Profile.
  function fallback({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-row items-center justify-end gap-3 px-5 pt-2">
          <ThemeToggle color={colors.muted} />
          {profileButton}
        </View>
        <View className="flex-1 items-center justify-center gap-4 px-8">
          <Character testID="dashboard-fallback-character" mood="idle" size={56} glow paused={!focused} />
          <Text className="font-display text-display text-center">{title}</Text>
          <Text className="text-center text-base text-muted-foreground">{body}</Text>
          {action}
          <Button testID="sign-out-button" variant="ghost" size="sm" onPress={() => signOut()}>
            Sign Out
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  if (connectionStatus === 'DISCONNECTED') {
    return fallback({
      title: 'Reconnect your Google Health',
      body: 'Your Google Health is disconnected, so your data has stopped updating.',
      action: (
        <Button testID="reconnect-health-button" onPress={() => navigation.navigate('ConnectHealth')}>
          Reconnect Google Health
        </Button>
      ),
    });
  }

  if (error !== null) {
    return fallback({ title: 'Couldn’t load Today', body: error });
  }

  if (records === null) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="items-center gap-5 px-5 pt-16">
          <Skeleton className="h-[216px] w-[216px] rounded-full" />
          <View className="w-full flex-row gap-3">
            <Skeleton className="h-32 flex-1 rounded-card" />
            <Skeleton className="h-32 flex-1 rounded-card" />
          </View>
          <View className="w-full flex-row gap-3">
            <Skeleton className="h-36 flex-1 rounded-card" />
            <Skeleton className="h-36 flex-1 rounded-card" />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (records.length === 0) {
    // Never connected: this is where someone lands on their first sign-in, so
    // it has to offer the connect step rather than describe a sync that cannot
    // happen yet. Connecting is no longer a gate in front of the app, so the
    // dashboard is the thing that asks for it.
    const neverConnected = connectionStatus === 'NOT_CONNECTED';
    return fallback({
      title: neverConnected ? 'Connect Google Health' : 'No data yet',
      body: neverConnected
        ? 'Your scores and trends appear here once Google Health is connected.'
        : 'Check back after your Google Health syncs.',
      action: neverConnected ? (
        <Button testID="connect-health-button" onPress={() => navigation.navigate('ConnectHealth')}>
          Connect Google Health
        </Button>
      ) : null,
    });
  }

  const today = new Date();
  const metricsWithData = METRIC_ORDER.filter((type) => seriesByMetric[type].length > 0);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView contentContainerStyle={{ gap: 20, paddingHorizontal: 20, paddingTop: 8, paddingBottom: clearance }}>
        <View className="flex-row items-end justify-between gap-3">
          <View className="flex-1 gap-1">
            <SectionLabel>
              {today.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </SectionLabel>
            <Text className="font-display text-display-lg">{greetingFor(today)}</Text>
            <SyncStatusLine />
          </View>
          <View className="flex-row items-center gap-3 pb-1">
            <ThemeToggle color={colors.muted} />
            {profileButton}
          </View>
        </View>

        <RecoveryHero
          score={recovery}
          bands={bands}
          failed={scoresFailed}
          onPress={(score) => navigation.navigate('ScoreDetail', { date: score.date, type: 'RECOVERY' })}
        />

        <View className="flex-row gap-3">
          <SleepTile
            score={sleep}
            bands={bands}
            failed={scoresFailed}
            // The Sleep screen; its score header links on to the score detail.
            onPress={() => navigation.navigate('Sleep')}
          />
          {coachRoute ? (
            <CoachTile needsConsent={coachRoute === 'CoachConsent'} onPress={() => navigateToCoachEntry(navigation, coachRoute)} />
          ) : null}
        </View>

        <TomorrowCard state={forecastState} onPress={() => navigation.navigate('Forecast')} />

        <HabitLogCard />

        {/* The digest is the newest week's recap: it plays that week's story, whose last frame
            offers the full recap. */}
        {coachRoute === 'Coach' ? <CoachDigestCard onOpenRecap={(id) => navigation.navigate('RecapStory', { id })} /> : null}

        {metricsWithData.length > 0 ? (
          <View className="gap-3">
            <SectionLabel>Your metrics</SectionLabel>
            <View className="flex-row flex-wrap gap-3">
              {metricsWithData.map((type, index) => (
                <Reveal key={type} index={index} className="w-[47%] grow">
                  <MetricTile type={type} series={seriesByMetric[type]} onPress={() => openDetail(type)} />
                </Reveal>
              ))}
            </View>
          </View>
        ) : null}

        {insight ? (
          <Card className="gap-1.5">
            <SectionLabel>Worth knowing</SectionLabel>
            <Text className="text-base leading-snug">{insight}</Text>
          </Card>
        ) : null}
        {/* Per-metric trends and the Patterns entry live on the Metrics tab. */}
      </ScrollView>
    </SafeAreaView>
  );
}
