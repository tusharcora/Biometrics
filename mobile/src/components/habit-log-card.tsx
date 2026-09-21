import React, { useEffect, useState } from 'react';
import { View, Pressable, TextInput } from 'react-native';
import { useColorScheme } from 'nativewind';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './ui/text';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';
import { COLORS } from '../theme';
import {
  createCheckIn,
  fetchHabitConfig,
  fetchHabitStatus,
  logHabit,
  type HabitStatusDTO,
  type HabitTypeDTO,
} from '../api/habits';
import {
  buildCheckInStrip,
  dayOfMonth,
  parseHabitValue,
  stepValue,
  weekdayInitial,
  withCheckIn,
  withObserved,
} from '../lib/habitDays';

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; habitTypes: HabitTypeDTO[]; habitStatus: HabitStatusDTO };

type Feedback = { kind: 'ok' | 'error'; text: string } | null;

// Big thresholds (minutes) step in fives; counts (drinks, cups) step by one.
function stepSize(habit: HabitTypeDTO): number {
  return habit.exposureThreshold >= 10 ? 5 : 1;
}

// "Anything to log today?" -- the daily habit prompt. A value of 0 logs an
// explicit "none"; "Nothing today" checks in for the whole day, which is what
// lets the correlation engine tell "didn't do it" from "didn't log it".
export function HabitLogCard() {
  const { colorScheme: scheme } = useColorScheme();
  const colors = scheme === 'dark' ? COLORS.dark : COLORS.light;
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [valueText, setValueText] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    (async () => {
      try {
        const [habitTypes, habitStatus] = await Promise.all([fetchHabitConfig(), fetchHabitStatus(14)]);
        if (!cancelled) setState({ status: 'ready', habitTypes, habitStatus });
      } catch {
        if (!cancelled) setState({ status: 'error' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  if (state.status === 'loading') {
    return <Skeleton testID="habit-log-loading" className="h-40 w-full" />;
  }

  if (state.status === 'error') {
    return (
      <Card testID="habit-log-unavailable" className="items-start gap-2">
        <Text className="text-sm text-muted-foreground">Habits are unavailable right now.</Text>
        <Button testID="habit-log-retry" variant="ghost" size="sm" onPress={() => setAttempt((n) => n + 1)}>
          Try again
        </Button>
      </Card>
    );
  }

  const { habitTypes, habitStatus } = state;
  const selected = habitTypes.find((t) => t.type === selectedType) ?? habitTypes[0] ?? null;
  const parsed = parseHabitValue(valueText);
  const canLog = selected !== null && parsed !== null && !Number.isNaN(parsed) && !busy;
  const todayEntry = habitStatus.days.find((d) => d.habitDay === habitStatus.today);
  const checkedInToday = todayEntry?.checkedIn === true;
  const strip = buildCheckInStrip(habitStatus, habitTypes);

  function setStatus(next: HabitStatusDTO) {
    setState({ status: 'ready', habitTypes, habitStatus: next });
  }

  function chooseType(type: string) {
    if (type === selected?.type) return;
    setSelectedType(type);
    setValueText('');
    setFeedback(null);
  }

  async function submitLog() {
    if (!selected || parsed === null || Number.isNaN(parsed)) return;
    setBusy(true);
    setFeedback(null);
    try {
      const log = await logHabit({ habitType: selected.type, value: parsed, unit: selected.unit });
      // habitDay is derived by the server (04:00-local boundary); use what it says.
      setStatus(withObserved(habitStatus, log.habitDay, selected.type));
      setValueText('');
      setFeedback({ kind: 'ok', text: parsed === 0 ? `Logged ${selected.label}: none` : `Logged ${selected.label}: ${parsed} ${selected.unit}` });
    } catch {
      setFeedback({ kind: 'error', text: 'Could not save that. Try again.' });
    } finally {
      setBusy(false);
    }
  }

  async function checkIn(habitDay?: string) {
    setBusy(true);
    setFeedback(null);
    try {
      const created = await createCheckIn(habitDay);
      setStatus(withCheckIn(habitStatus, created?.habitDay ?? habitDay ?? habitStatus.today));
    } catch {
      setFeedback({ kind: 'error', text: 'Could not check in. Try again.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card testID="habit-log-card" className="gap-4">
      <Text className="text-base font-semibold">Anything to log today?</Text>

      {selected ? (
        <View className="gap-3">
          <View className="flex-row flex-wrap gap-2">
            {habitTypes.map((habit) => {
              const active = habit.type === selected.type;
              return (
                <Pressable
                  key={habit.type}
                  testID={`habit-type-${habit.type}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => chooseType(habit.type)}
                  className={`rounded-full border px-3 py-1.5 active:opacity-80 ${active ? 'border-accent bg-accent/10' : 'border-border'}`}
                >
                  <Text className={`text-sm ${active ? 'font-semibold text-accent' : 'text-muted-foreground'}`}>{habit.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <View className="flex-row items-center gap-3">
            <Pressable
              testID="habit-decrement"
              accessibilityRole="button"
              accessibilityLabel="Decrease"
              onPress={() => setValueText(stepValue(valueText, -1, stepSize(selected)))}
              hitSlop={8}
              className="h-10 w-10 items-center justify-center rounded-full border border-border active:opacity-70"
            >
              <Ionicons name="remove" size={18} color={colors.foreground} />
            </Pressable>
            <TextInput
              testID="habit-value-input"
              value={valueText}
              onChangeText={setValueText}
              placeholder="0"
              placeholderTextColor={colors.muted}
              keyboardType="decimal-pad"
              accessibilityLabel={`${selected.label} amount in ${selected.unit}`}
              style={{ color: colors.foreground, fontVariant: ['tabular-nums'] }}
              className="w-20 rounded-xl border border-border bg-card px-3 py-2 text-center text-base"
            />
            <Pressable
              testID="habit-increment"
              accessibilityRole="button"
              accessibilityLabel="Increase"
              onPress={() => setValueText(stepValue(valueText, 1, stepSize(selected)))}
              hitSlop={8}
              className="h-10 w-10 items-center justify-center rounded-full border border-border active:opacity-70"
            >
              <Ionicons name="add" size={18} color={colors.foreground} />
            </Pressable>
            <Text className="flex-1 text-sm text-muted-foreground">{selected.unit}</Text>
          </View>

          <Button
            testID="habit-log-submit"
            variant="ghost"
            size="sm"
            disabled={!canLog}
            onPress={submitLog}
            className={`border border-border ${canLog ? '' : 'opacity-50'}`}
          >
            {parsed === 0 ? 'Log none' : parsed === null || Number.isNaN(parsed) ? 'Log' : `Log ${parsed} ${selected.unit}`}
          </Button>
          <Text className="text-[11px] text-muted-foreground">Enter 0 to log that you had none.</Text>
        </View>
      ) : null}

      {feedback ? (
        <Text testID="habit-log-feedback" className={`text-sm ${feedback.kind === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>
          {feedback.text}
        </Text>
      ) : null}

      {checkedInToday ? (
        <View testID="checked-in-today" className="flex-row items-center gap-2">
          <Ionicons name="checkmark-circle" size={18} color={colors.scoreExcellent} />
          <Text className="flex-1 text-sm text-muted-foreground">You’ve checked in for today.</Text>
        </View>
      ) : (
        <Button testID="nothing-today-button" disabled={busy} onPress={() => checkIn()}>
          Nothing today
        </Button>
      )}

      {strip.length > 0 ? (
        <View className="gap-2">
          <Text className="text-xs text-muted-foreground">Missed a day? Tap it to check in.</Text>
          <View className="flex-row justify-between">
            {strip.map((day) => (
              <Pressable
                key={day.habitDay}
                testID={`checkin-day-${day.habitDay}`}
                accessibilityRole="button"
                accessibilityLabel={`${day.habitDay}: ${day.done ? 'checked in' : 'tap to check in'}`}
                disabled={day.done || busy}
                onPress={() => checkIn(day.habitDay)}
                className="items-center gap-1 active:opacity-70"
              >
                <Text className="text-[10px] text-muted-foreground">{weekdayInitial(day.habitDay)}</Text>
                <View
                  className={`h-8 w-8 items-center justify-center rounded-full border ${day.done ? 'border-accent bg-accent/10' : 'border-border'}`}
                >
                  {day.done ? (
                    <Ionicons name="checkmark" size={14} color={colors.accent} />
                  ) : (
                    <Text className="text-xs text-muted-foreground">{dayOfMonth(day.habitDay)}</Text>
                  )}
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </Card>
  );
}
