import React, { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { Ionicons } from '@expo/vector-icons';
import { fetchSleepGoal, saveSleepGoal, type SleepGoal } from '../api/sleep';
import { useCharacter } from '../characters/CharacterContext';
import { characterInfo } from '../components/characters/registry';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { SectionLabel } from '../components/ui/section-label';
import { SegmentedControl } from '../components/ui/segmented-control';
import { SettingsGroup, SettingsRow } from '../components/ui/settings-list';
import { Skeleton } from '../components/ui/skeleton';
import { Text } from '../components/ui/text';
import { formatClock } from '../lib/sleepStats';
import { formatGoalDuration, goalWindowMinutes } from '../lib/sleepWindow';
import { disableWindDown, enableWindDown, readWindDown, setWindDownLead, type WindDownLead } from '../lib/windDown';
import { COLORS } from '../theme';

// Shown, not saved, until the user saves a goal of their own.
const DEFAULT_BEDTIME = '23:00';
const DEFAULT_WAKE = '07:00';
const STEP = 15;
const MIN_SLEEP = 4 * 60;
const MAX_SLEEP = 12 * 60;

const LEAD_OPTIONS: { value: `${WindDownLead}`; label: string }[] = [
  { value: '15', label: '15 min' },
  { value: '30', label: '30 min' },
  { value: '45', label: '45 min' },
  { value: '60', label: '60 min' },
];

type Draft = { bed: string; wake: string; sleep: number };
type LoadState = { phase: 'loading' } | { phase: 'error' } | { phase: 'ready'; saved: SleepGoal };
// 'denied' points to Settings; 'error' is a native scheduling failure.
type ReminderNote = 'denied' | 'error' | null;

const draftOf = (goal: SleepGoal): Draft => ({
  bed: goal.bedtimeGoal ?? DEFAULT_BEDTIME,
  wake: goal.wakeGoal ?? DEFAULT_WAKE,
  sleep: goal.sleepGoalMinutes,
});

// "23:45" + 15 -> "00:00": clock arithmetic that wraps midnight both ways.
export function shiftClock(hhmm: string, delta: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  const total = (((h! * 60 + m! + delta) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

// Only the fields that differ from the saved goal; an unset time counts as
// changed, so saving the shown defaults stores them.
function changedFields(saved: SleepGoal, draft: Draft): Partial<SleepGoal> {
  const patch: Partial<SleepGoal> = {};
  if (draft.bed !== saved.bedtimeGoal) patch.bedtimeGoal = draft.bed;
  if (draft.wake !== saved.wakeGoal) patch.wakeGoal = draft.wake;
  if (draft.sleep !== saved.sleepGoalMinutes) patch.sleepGoalMinutes = draft.sleep;
  return patch;
}

export function BedtimeGoalScreen() {
  const { colorScheme } = useColorScheme();
  const colors = colorScheme === 'light' ? COLORS.light : COLORS.dark;
  const { characterId } = useCharacter();
  const coachName = characterInfo(characterId).name;

  const [state, setState] = useState<LoadState>({ phase: 'loading' });
  const [draft, setDraft] = useState<Draft>({ bed: DEFAULT_BEDTIME, wake: DEFAULT_WAKE, sleep: 480 });
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [reminderOn, setReminderOn] = useState(false);
  const [lead, setLead] = useState<WindDownLead>(30);
  const [reminderBusy, setReminderBusy] = useState(false);
  const [reminderNote, setReminderNote] = useState<ReminderNote>(null);

  // The one way the reminder gets (re)scheduled from this screen: switching it
  // on, saving a goal while it is on, and refreshing a stale title or bedtime.
  // A failure leaves it off, on screen and on the device.
  const scheduleReminder = useCallback(
    async (bedtimeGoal: string, leadMinutes: WindDownLead) => {
      setReminderNote(null);
      try {
        const result = await enableWindDown({ bedtimeGoal, leadMinutes, coachName });
        setReminderOn(result === 'scheduled');
        if (result === 'denied') setReminderNote('denied');
      } catch {
        setReminderOn(false);
        setReminderNote('error');
        await disableWindDown().catch(() => undefined);
      }
    },
    [coachName],
  );

  const load = useCallback(async () => {
    setState({ phase: 'loading' });
    try {
      const [saved, reminder] = await Promise.all([fetchSleepGoal(), readWindDown()]);
      setState({ phase: 'ready', saved });
      setDraft(draftOf(saved));
      setLead(reminder.leadMinutes);
      setReminderOn(reminder.enabled);
      // The stored reminder carries the coach's name and the bedtime it was
      // set for; either may have changed since (a new coach, another device).
      if (reminder.enabled && saved.bedtimeGoal && (reminder.coachName !== coachName || reminder.bedtimeGoal !== saved.bedtimeGoal)) {
        await scheduleReminder(saved.bedtimeGoal, reminder.leadMinutes);
      }
    } catch {
      setState({ phase: 'error' });
    }
    // Loads once; a coach change while open is picked up on the next save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (state.phase === 'loading') {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
        <View testID="goal-loading" className="gap-4 px-5 pt-6">
          <Skeleton className="h-40 w-full rounded-card" />
          <Skeleton className="h-20 w-full rounded-card" />
          <Skeleton className="h-32 w-full rounded-card" />
        </View>
      </SafeAreaView>
    );
  }

  if (state.phase === 'error') {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
        <View className="flex-1 items-center justify-center gap-3 p-6">
          <Text className="text-center text-muted-foreground">Your bedtime goal could not be loaded.</Text>
          <Button testID="goal-load-retry" onPress={load}>
            Try again
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  const { saved } = state;
  const patch = changedFields(saved, draft);
  const sameTimes = draft.bed === draft.wake;
  const canSave = Object.keys(patch).length > 0 && !sameTimes && !saving;
  const windowMinutes = goalWindowMinutes(draft.bed, draft.wake);
  const short = !sameTimes && windowMinutes < draft.sleep;

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setSaveFailed(false);
    try {
      const next = await saveSleepGoal(patch);
      setState({ phase: 'ready', saved: next });
      setDraft(draftOf(next));
      // Moves the reminder to the new bedtime and refreshes its coach name.
      if (reminderOn && next.bedtimeGoal) await scheduleReminder(next.bedtimeGoal, lead);
    } catch {
      setDraft(draftOf(saved));
      setSaveFailed(true);
    } finally {
      setSaving(false);
    }
  }

  async function toggleReminder(next: boolean) {
    if (reminderBusy || !saved.bedtimeGoal) return;
    setReminderBusy(true);
    try {
      if (next) {
        await scheduleReminder(saved.bedtimeGoal, lead);
      } else {
        setReminderNote(null);
        setReminderOn(false);
        await disableWindDown();
      }
    } finally {
      setReminderBusy(false);
    }
  }

  function changeLead(value: `${WindDownLead}`) {
    const next = Number(value) as WindDownLead;
    setLead(next);
    setWindDownLead(next).catch(() => undefined);
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <ScrollView contentContainerStyle={{ gap: 20, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32 }}>
        <View className="gap-2">
          <SectionLabel className="px-1">Times</SectionLabel>
          <Card className="gap-4">
            <Stepper
              id="goal-bed"
              label="Bedtime"
              value={formatClock(draft.bed)}
              onMinus={() => setDraft((d) => ({ ...d, bed: shiftClock(d.bed, -STEP) }))}
              onPlus={() => setDraft((d) => ({ ...d, bed: shiftClock(d.bed, STEP) }))}
            />
            <Stepper
              id="goal-wake"
              label="Wake time"
              value={formatClock(draft.wake)}
              onMinus={() => setDraft((d) => ({ ...d, wake: shiftClock(d.wake, -STEP) }))}
              onPlus={() => setDraft((d) => ({ ...d, wake: shiftClock(d.wake, STEP) }))}
            />
            <Text testID="goal-window-line" className="text-sm" style={{ color: short ? colors.scoreFair : colors.muted }}>
              {sameTimes
                ? "Bedtime and wake time can't be the same."
                : `That's ${formatGoalDuration(windowMinutes)} in bed. Your goal is ${formatGoalDuration(draft.sleep)} asleep.`}
            </Text>
          </Card>
        </View>

        <View className="gap-2">
          <SectionLabel className="px-1">Sleep goal</SectionLabel>
          <Card>
            <Stepper
              id="goal-sleep"
              label="Time asleep"
              value={formatGoalDuration(draft.sleep)}
              onMinus={() => setDraft((d) => ({ ...d, sleep: Math.max(MIN_SLEEP, d.sleep - STEP) }))}
              onPlus={() => setDraft((d) => ({ ...d, sleep: Math.min(MAX_SLEEP, d.sleep + STEP) }))}
              minusDisabled={draft.sleep <= MIN_SLEEP}
              plusDisabled={draft.sleep >= MAX_SLEEP}
            />
          </Card>
        </View>

        <View className="gap-2">
          <Button testID="goal-save" onPress={save} disabled={!canSave}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
          {saveFailed ? (
            <Text testID="goal-error" className="px-1 text-center text-sm text-destructive">
              Your goal couldn't be saved. Check your connection and try again.
            </Text>
          ) : null}
        </View>

        <SettingsGroup label="Wind-down reminder">
          <SettingsRow
            icon="moon-outline"
            tint={colors.metricSleep}
            title="Remind me to wind down"
            subtitle={saved.bedtimeGoal ? undefined : 'Set a bedtime first'}
            trailing={
              <Switch
                testID="winddown-switch"
                accessibilityLabel="Wind-down reminder"
                value={reminderOn && !!saved.bedtimeGoal}
                disabled={!saved.bedtimeGoal || reminderBusy}
                accessibilityState={{ disabled: !saved.bedtimeGoal || reminderBusy, checked: reminderOn && !!saved.bedtimeGoal }}
                onValueChange={(next) => void toggleReminder(next)}
                trackColor={{ true: colors.accent }}
              />
            }
          />
          <View className="gap-3 px-4 py-3">
            <Text className="text-sm text-muted-foreground">Before bedtime</Text>
            <SegmentedControl testID="winddown-lead" options={LEAD_OPTIONS} value={`${lead}`} onChange={changeLead} />
            <View className="rounded-xl bg-muted px-3 py-2.5">
              <Text testID="winddown-preview" className="text-sm">
                <Text className="text-sm font-semibold">{`${coachName}: `}</Text>
                {`Wind-down time. Bed in ${lead} min.`}
              </Text>
            </View>
          </View>
        </SettingsGroup>
        {reminderNote === 'denied' ? (
          <View className="gap-1 px-4">
            <Text testID="winddown-denied" className="text-xs text-muted-foreground">Notifications are off for Biometrics. Turn them on in Settings.</Text>
            <Pressable testID="winddown-settings" accessibilityRole="link" onPress={() => void Linking.openSettings()}>
              <Text className="text-xs font-semibold text-accent">Open Settings</Text>
            </Pressable>
          </View>
        ) : null}
        {reminderNote === 'error' ? (
          <Text testID="winddown-error" className="px-4 text-sm text-destructive">
            Couldn't set the reminder. Try again.
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

interface StepperProps {
  // testID prefix: `${id}-minus`, `${id}-value`, `${id}-plus`.
  id: string;
  label: string;
  value: string;
  onMinus: () => void;
  onPlus: () => void;
  minusDisabled?: boolean;
  plusDisabled?: boolean;
}

function Stepper({ id, label, value, onMinus, onPlus, minusDisabled, plusDisabled }: StepperProps) {
  const { colorScheme } = useColorScheme();
  const colors = colorScheme === 'light' ? COLORS.light : COLORS.dark;
  const button = (testID: string, icon: 'remove' | 'add', onPress: () => void, disabled: boolean | undefined, a11y: string) => (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      className={`h-9 w-9 items-center justify-center rounded-full bg-muted active:opacity-70 ${disabled ? 'opacity-40' : ''}`}
    >
      <Ionicons name={icon} size={18} color={colors.foreground} />
    </Pressable>
  );
  return (
    <View className="flex-row items-center gap-3">
      <Text className="flex-1 text-base">{label}</Text>
      {button(`${id}-minus`, 'remove', onMinus, minusDisabled, `${label}, minus 15 minutes`)}
      <Text testID={`${id}-value`} className="min-w-[84px] text-center text-base font-semibold" style={{ fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
      {button(`${id}-plus`, 'add', onPlus, plusDisabled, `${label}, plus 15 minutes`)}
    </View>
  );
}
