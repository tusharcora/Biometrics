import React, { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  CoachConsentRequiredError,
  CoachDisabledError,
  CoachMemoryNotFoundError,
  deleteCoachMemory,
  listCoachMemory,
  type MemoryDTO,
} from '../api/coach';
import { groupMemories, MEMORY_ERROR_TEXT, PENDING_MEMORY_TEXT } from '../lib/coachMemory';
import { Text } from '../components/ui/text';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { MemoryEditForm } from '../components/memory-edit-form';

type Phase = 'loading' | 'ready' | 'error' | 'unavailable';

interface MemoryRowProps {
  entry: MemoryDTO;
  onChange: (entry: MemoryDTO) => void;
  onRemove: (id: string) => void;
}

function MemoryRow({ entry, onChange, onRemove }: MemoryRowProps) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleteError, setDeleteError] = useState(false);

  async function confirmDelete() {
    if (busy) return;
    setDeleteError(false);
    setBusy(true);
    try {
      await deleteCoachMemory(entry.id);
      onRemove(entry.id);
    } catch (e) {
      if (e instanceof CoachMemoryNotFoundError) {
        onRemove(entry.id);
        return;
      }
      setDeleteError(true);
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <Card testID={`memory-entry-${entry.id}`}>
        <MemoryEditForm
          id={entry.id}
          initialValue={entry.value}
          testIDPrefix="memory"
          onSaved={(saved) => {
            onChange(saved);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
          onGone={() => onRemove(entry.id)}
        />
      </Card>
    );
  }

  return (
    <Card testID={`memory-entry-${entry.id}`} className="gap-2">
      <Text className="text-base">{entry.value}</Text>
      {entry.status === 'PENDING' ? (
        <Text testID={`memory-pending-${entry.id}`} className="text-xs text-muted-foreground">
          {PENDING_MEMORY_TEXT}
        </Text>
      ) : null}
      {deleteError ? (
        <Text testID={`memory-error-${entry.id}`} className="text-sm text-destructive">
          {MEMORY_ERROR_TEXT.generic}
        </Text>
      ) : null}
      {confirming ? (
        <View className="gap-1">
          <Text className="text-sm">Delete this memory?</Text>
          <View className="flex-row justify-end gap-2">
            <Button testID={`memory-cancel-delete-${entry.id}`} variant="ghost" size="sm" disabled={busy} onPress={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button testID={`memory-confirm-delete-${entry.id}`} variant="destructive" size="sm" disabled={busy} onPress={() => void confirmDelete()}>
              Delete
            </Button>
          </View>
        </View>
      ) : (
        <View className="flex-row justify-end gap-4">
          <Pressable testID={`memory-edit-${entry.id}`} accessibilityRole="button" hitSlop={8} onPress={() => setEditing(true)} className="active:opacity-70">
            <Text className="text-sm font-semibold text-accent">Edit</Text>
          </Pressable>
          <Pressable
            testID={`memory-delete-${entry.id}`}
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => {
              setDeleteError(false);
              setConfirming(true);
            }}
            className="active:opacity-70"
          >
            <Text className="text-sm font-semibold text-destructive">Delete</Text>
          </Pressable>
        </View>
      )}
    </Card>
  );
}

// Settings -> Coach Memory: everything the coach remembers about the user,
// editable or deletable at any time (spec 6).
export function CoachMemoryScreen() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [entries, setEntries] = useState<MemoryDTO[]>([]);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setPhase('loading');
    (async () => {
      try {
        const loaded = await listCoachMemory();
        if (cancelled) return;
        setEntries(loaded);
        setPhase('ready');
      } catch (e) {
        if (cancelled) return;
        setPhase(e instanceof CoachDisabledError || e instanceof CoachConsentRequiredError ? 'unavailable' : 'error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const replace = useCallback((saved: MemoryDTO) => {
    setEntries((prev) => prev.map((e) => (e.id === saved.id ? saved : e)));
  }, []);
  const remove = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  if (phase === 'loading') {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View testID="coach-memory-loading" className="gap-3 p-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </View>
      </SafeAreaView>
    );
  }

  if (phase === 'unavailable') {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View testID="coach-memory-unavailable" className="flex-1 items-center justify-center p-6">
          <Text className="text-center text-muted-foreground">The AI Coach is not available right now.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (phase === 'error') {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center gap-3 p-6">
          <Text testID="coach-memory-error" className="text-center text-muted-foreground">
            Your coach memory could not be loaded.
          </Text>
          <Button testID="coach-memory-retry" variant="ghost" onPress={() => setAttempt((n) => n + 1)}>
            Try again
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  const groups = groupMemories(entries);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ gap: 16, padding: 16 }}>
        {groups.length === 0 ? (
          <Card testID="coach-memory-empty" className="gap-2">
            <Text className="text-base font-semibold">Nothing remembered yet</Text>
            <Text className="text-sm text-muted-foreground">
              The coach only remembers your training goals, your schedule and your preferences, and never health or medical details.
              Anything it remembers will appear here, and you can change or delete it at any time.
            </Text>
          </Card>
        ) : (
          groups.map((group) => (
            <View key={group.key} className="gap-2">
              <Text className="text-sm font-semibold text-muted-foreground">{group.label}</Text>
              {group.entries.map((entry) => (
                <MemoryRow key={entry.id} entry={entry} onChange={replace} onRemove={remove} />
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
