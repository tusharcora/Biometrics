import React, { useState } from 'react';
import { View, Pressable } from 'react-native';
import { CoachMemoryNotFoundError, deleteCoachMemory, type MemoryDTO } from '../api/coach';
import { MEMORY_ERROR_TEXT } from '../lib/coachMemory';
import { Text } from './ui/text';
import { MemoryEditForm } from './memory-edit-form';

function MemoryProposalChip({ proposal }: { proposal: MemoryDTO }) {
  const [value, setValue] = useState(proposal.value);
  const [editing, setEditing] = useState(false);
  const [gone, setGone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [undoError, setUndoError] = useState(false);

  if (gone) return null;

  async function undo() {
    if (busy) return;
    setUndoError(false);
    setBusy(true);
    try {
      await deleteCoachMemory(proposal.id);
      setGone(true);
    } catch (e) {
      // Already deleted elsewhere is the outcome the user asked for.
      if (e instanceof CoachMemoryNotFoundError) setGone(true);
      else {
        setUndoError(true);
        setBusy(false);
      }
    }
  }

  if (editing) {
    return (
      <View className="max-w-[85%] px-1">
        <MemoryEditForm
          id={proposal.id}
          initialValue={value}
          testIDPrefix="memory-chip"
          onSaved={(entry) => {
            setValue(entry.value);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
          onGone={() => setGone(true)}
        />
      </View>
    );
  }

  return (
    <View className="max-w-[85%] gap-1 px-1">
      <View className="flex-row flex-wrap items-center gap-x-3 gap-y-1">
        <Text testID={`memory-chip-${proposal.id}`} className="shrink text-xs text-muted-foreground">
          {`I'll remember: ${value}`}
        </Text>
        <Pressable testID={`memory-chip-edit-${proposal.id}`} accessibilityRole="button" hitSlop={8} onPress={() => setEditing(true)} className="active:opacity-70">
          <Text className="text-xs font-semibold text-accent">Edit</Text>
        </Pressable>
        <Pressable testID={`memory-chip-undo-${proposal.id}`} accessibilityRole="button" hitSlop={8} disabled={busy} onPress={() => void undo()} className="active:opacity-70">
          <Text className="text-xs font-semibold text-accent">Undo</Text>
        </Pressable>
      </View>
      {undoError ? (
        <Text testID={`memory-chip-error-${proposal.id}`} className="text-xs text-destructive">
          {MEMORY_ERROR_TEXT.generic}
        </Text>
      ) : null}
    </View>
  );
}

// A subtle line under a coach reply for each memory the coach proposed that
// turn, so the user always sees what is being remembered and can correct it.
export function MemoryProposalChips({ proposals }: { proposals: MemoryDTO[] }) {
  if (proposals.length === 0) return null;
  return (
    <View className="gap-1">
      {proposals.map((proposal) => (
        <MemoryProposalChip key={proposal.id} proposal={proposal} />
      ))}
    </View>
  );
}
