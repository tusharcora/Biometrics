import React, { useEffect, useMemo, useState } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { useColorScheme } from 'nativewind';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '../api/client';
import { fetchScoresWithBands, type DailyScoreDTO, type ScoreBandsDTO, type ScoreType } from '../api/scores';
import { useAuth } from '../auth/AuthContext';
import { Text } from '../components/ui/text';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { Ring } from '../components/ui/ring';
import { ScoreRing } from '../components/ui/score-ring';
import { BaselineProgressRing } from '../components/ui/baseline-progress-ring';
import { ConfidenceBadge } from '../components/ui/confidence-badge';
import { CountUp } from '../components/ui/count-up';
import { ThemeToggle } from '../components/ui/theme-toggle';
import { HabitLogCard } from '../components/habit-log-card';
import { CoachDigestCard } from '../components/coach-digest-card';
import { COLORS, METRIC_CONFIG, METRIC_ORDER, type MetricType } from '../theme';
import { computeStats, buildHeadline, type MetricRecord } from '../lib/metricInsights';
import { pickColdStartProgress, scoreTypeLabel } from '../lib/scoreInsights';
import { coachEntryRoute, useCoachStatus } from '../lib/useCoachStatus';
import { navigateToCoachEntry } from '../navigation/coachNavigation';
import { useTabBarClearance } from '../navigation/tabBarLayout';

type ConnectionStatus = 'CONNECTED' | 'DISCONNECTED' | 'NOT_CONNECTED';

function seriesFor(records: MetricRecord[], type: MetricType): MetricRecord[] {
  return records
    .filter((r) => r.metricType === type)
    .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());
}

function latestByMetric(records: MetricRecord[]): Partial<Record<MetricType, MetricRecord>> {
  const latest: Partial<Record<MetricType, MetricRecord>> = {};
  for (const record of records) {
    const current = latest[record.metricType];
    if (!current || new Date(record.recordedAt) > new Date(current.recordedAt)) {
      latest[record.metricType] = record;
    }
  }
  return latest;
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

// undefined while loading, null when no score of that type exists yet (for
// Sleep: no night of sleep recorded).
type ScoreState = DailyScoreDTO | null | undefined;

const SCORE_CARD_COPY: Record<ScoreType, { slug: string; empty: string }> = {
  RECOVERY: { slug: 'recovery', empty: 'Your Recovery Score will appear once it has been calculated.' },
  SLEEP: { slug: 'sleep', empty: 'Your Sleep Score will appear once a night of sleep has been recorded.' },
};

// One card per score type. A Sleep Score with fewer factors than usual (e.g.
// Bedtime consistency still building) is normal, so a present score always
// shows the ring and confidence badge; the cold-start ring is only for a null score.
function ScoreCard({
  type,
  score,
  bands,
  failed,
  onPress,
}: {
  type: ScoreType;
  score: ScoreState;
  bands?: ScoreBandsDTO;
  failed: boolean;
  onPress: (score: DailyScoreDTO) => void;
}) {
  const { slug, empty } = SCORE_CARD_COPY[type];
  const label = scoreTypeLabel(type);

  if (failed) {
    return (
      <Card testID={`${slug}-score-unavailable`}>
        <Text className="text-sm text-muted-foreground">{`${label} is unavailable right now.`}</Text>
      </Card>
    );
  }

  if (score === undefined) {
    return <Skeleton testID={`${slug}-score-loading`} className="h-28 w-full" />;
  }

  if (score === null) {
    return (
      <Card testID={`${slug}-score-empty`}>
        <Text className="text-sm text-muted-foreground">{empty}</Text>
      </Card>
    );
  }

  const cold = score.score === null ? pickColdStartProgress(score.coldStart) : null;

  return (
    <Pressable testID={`${slug}-score-card`} onPress={() => onPress(score)} className="active:opacity-80">
      <Card className="flex-row items-center gap-4">
        {score.score === null && cold ? (
          <BaselineProgressRing daysCollected={cold.daysCollected} daysRequired={cold.daysRequired} />
        ) : (
          <ScoreRing score={score.score} factors={score.factors} bands={bands} />
        )}
        <View className="flex-1 gap-1.5">
          <Text className="text-base font-semibold">{label}</Text>
          {score.score !== null ? (
            <ConfidenceBadge level={score.confidenceLevel} />
          ) : (
            <Text className="text-xs text-muted-foreground">Building your baseline</Text>
          )}
          <Text className="text-xs text-muted-foreground">Tap to see what moved it</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="rgb(120, 113, 108)" />
      </Card>
    </Pressable>
  );
}

export function DashboardScreen() {
  const navigation = useNavigation<any>();
  const clearance = useTabBarClearance();
  const { signOut } = useAuth();
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

  useEffect(() => {
    apiFetch<MetricRecord[]>('/me/biometrics')
      .then(setRecords)
      .catch(() => setError('Something went wrong loading your data.'));
  }, []);

  useEffect(() => {
    // A disconnected Google Health is why the data stops updating, so say so
    // rather than leaving the user staring at silently stale numbers.
    apiFetch<{ status: ConnectionStatus }>('/me/connection')
      .then((res) => setConnectionStatus(res?.status ?? null))
      .catch(() => setConnectionStatus(null));
  }, []);

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
  }, []);

  const latest = useMemo(() => latestByMetric(records ?? []), [records]);
  const insight = useMemo(() => computeHeadlineInsight(records ?? []), [records]);

  function openDetail(type: MetricType) {
    navigation.navigate('MetricDetail', { metricType: type, records: seriesFor(records ?? [], type) });
  }

  // Rendered on every branch so signing out is always reachable.
  const headerActions = (
    <View className="flex-row items-center gap-4">
      <ThemeToggle color={colors.muted} />
      <Pressable testID="settings-button" onPress={() => navigation.navigate('Tabs', { screen: 'Profile' })} hitSlop={8} className="active:opacity-70">
        <Ionicons name="settings-outline" size={20} color={colors.muted} />
      </Pressable>
      <Button testID="sign-out-button" variant="ghost" size="sm" onPress={() => signOut()}>
        Sign Out
      </Button>
    </View>
  );

  if (connectionStatus === 'DISCONNECTED') {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center gap-3 p-6">
          <Text className="text-xl font-semibold">Reconnect your Google Health</Text>
          <Text className="text-center text-muted-foreground">
            Your Google Health is disconnected, so your data has stopped updating.
          </Text>
          <Button testID="reconnect-health-button" onPress={() => navigation.navigate('ConnectHealth')}>
            Reconnect Google Health
          </Button>
          {headerActions}
        </View>
      </SafeAreaView>
    );
  }

  if (error !== null) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center gap-3 p-6">
          <Text className="text-center text-muted-foreground">{error}</Text>
          {headerActions}
        </View>
      </SafeAreaView>
    );
  }

  if (records === null) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-row flex-wrap gap-3 p-4">
          <Skeleton className="h-32 w-[47%]" />
          <Skeleton className="h-32 w-[47%]" />
          <Skeleton className="h-32 w-[47%]" />
          <Skeleton className="h-32 w-[47%]" />
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
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center gap-3 p-6">
          <Text className="text-xl font-semibold">
            {neverConnected ? 'Connect Google Health' : 'No data yet'}
          </Text>
          <Text className="text-center text-muted-foreground">
            {neverConnected
              ? 'Your scores and trends appear here once Google Health is connected.'
              : 'Check back after your Google Health syncs.'}
          </Text>
          {neverConnected ? (
            <Button testID="connect-health-button" onPress={() => navigation.navigate('ConnectHealth')}>
              Connect Google Health
            </Button>
          ) : null}
          {headerActions}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ gap: 16, padding: 16, paddingBottom: clearance }}>
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-bold">Today</Text>
          {headerActions}
        </View>

        <ScoreCard
          type="RECOVERY"
          score={recovery}
          bands={bands}
          failed={scoresFailed}
          onPress={(score) => navigation.navigate('ScoreDetail', { date: score.date, type: 'RECOVERY' })}
        />

        <ScoreCard
          type="SLEEP"
          score={sleep}
          bands={bands}
          failed={scoresFailed}
          onPress={(score) => navigation.navigate('ScoreDetail', { date: score.date, type: 'SLEEP' })}
        />

        <HabitLogCard />

        {coachRoute === 'Coach' ? <CoachDigestCard /> : null}

        {coachRoute ? (
          <Pressable testID="coach-entry-button" onPress={() => navigateToCoachEntry(navigation, coachRoute)} className="active:opacity-80">
            <Card className="flex-row items-center gap-3">
              <Ionicons name="chatbubbles-outline" size={18} color={colors.accent} />
              <View className="flex-1 gap-0.5">
                <Text className="text-base font-semibold">AI Coach</Text>
                <Text className="text-xs text-muted-foreground">
                  {coachRoute === 'CoachConsent' ? 'Review what is shared, then ask about your scores' : 'Ask about your scores and patterns'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Card>
          </Pressable>
        ) : null}

        <View className="flex-row flex-wrap gap-3">
          {METRIC_ORDER.map((type, index) => {
            const record = latest[type];
            if (!record) return null;
            const config = METRIC_CONFIG[type];
            const color = scheme === 'dark' ? config.color.dark : config.color.light;
            const percent = config.goal ? record.value / config.goal : undefined;
            return (
              <Animated.View key={type} entering={FadeInDown.delay(index * 70).duration(400)} className="w-[47%] grow">
                <Pressable testID={`metric-card-${type}`} onPress={() => openDetail(type)} className="active:opacity-80">
                  <Card className="items-center gap-2 py-5">
                    <Ring size={84} strokeWidth={8} color={color} percent={percent}>
                      <View className="items-center gap-0.5">
                        <Ionicons name={config.icon as any} size={14} color={color} />
                        <CountUp
                          value={record.value}
                          format={config.format}
                          className="text-base font-bold"
                          style={{ fontVariant: ['tabular-nums'] }}
                        />
                      </View>
                    </Ring>
                    <Text className="text-xs font-medium text-muted-foreground">{config.label}</Text>
                    {config.goalLabel ? (
                      <Text className="text-[10px] text-muted-foreground">{config.goalLabel}</Text>
                    ) : null}
                  </Card>
                </Pressable>
              </Animated.View>
            );
          })}
        </View>

        {insight ? (
          <Card className="flex-row items-center gap-3">
            <Ionicons name="sparkles-outline" size={18} color={colors.accent} />
            <Text className="flex-1 text-sm text-muted-foreground">{insight}</Text>
          </Card>
        ) : null}
        {/* Per-metric trends and the Patterns entry live on the Metrics tab. */}
      </ScrollView>
    </SafeAreaView>
  );
}
