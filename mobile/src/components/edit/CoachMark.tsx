import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import { Button } from '../ui/button';
import { Text } from '../ui/text';
import type { EditorAction, EditorState } from '../../lib/room/edit/editor';
import { COACH_ITEM } from '../../lib/room/edit/targets';
import { ROOM_COPY } from '../../lib/room/roomCopy';

const C = ROOM_COPY.coach;
export const COACH_PLACE_AFTER_MS = 10_000;
/** Below this window height the drawer sits under the fold with the mark above it: Place is offered at once (T15-FIX). */
export const COACH_PLACE_AT_ONCE_BELOW = 700;
const TOOL = 'h-[44px]'; // the editor's 44-point targets

// The guided first placement (spec 2026-10-15 §11.1, C7 "Your first piece"): three steps, Skip always there. Without
// a drag (a screen reader, a short phone, or after 10 seconds) step 1 offers to place the lantern on the lime tile. Each new step is
// said once, on both platforms, as it starts (the mark itself is no live region, so nothing is said twice); the first
// is read with the mark.
export function CoachMark({ state, dispatch, placeAtOnce = false }: { state: EditorState; dispatch: (a: EditorAction) => void; placeAtOnce?: boolean }) {
  const [waited, setWaited] = useState(false);
  const offerPlace = waited || placeAtOnce;
  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isScreenReaderEnabled().then((on) => { if (live && on) setWaited(true); });
    const t = setTimeout(() => setWaited(true), COACH_PLACE_AFTER_MS);
    return () => { live = false; clearTimeout(t); };
  }, []);
  const coach = state.coach;
  const step = coach?.step ?? null;
  const lastStep = useRef(step);
  useEffect(() => {
    if (step === null || step === lastStep.current) return;
    lastStep.current = step;
    AccessibilityInfo.announceForAccessibility(C.stepSpoken(step, C.steps[step - 1]));
  }, [step]);
  if (!coach) return null;
  const k = coach.step - 1;
  return (
    <View testID="coach-mark" accessibilityRole="summary" className="mx-4 my-2 gap-1 rounded-lg border border-border bg-card p-3">
      <View className="flex-row items-center justify-between gap-2">
        <Text testID="coach-title" accessibilityLabel={`${C.title}. ${C.sub}`} className="shrink text-body font-semibold">{`${C.title} · ${C.sub}`}</Text>
        <Button testID="coach-skip" variant="ghost" size="sm" className={TOOL} onPress={() => dispatch({ type: 'coach', step: null })}>{C.skip}</Button>
      </View>
      <View className="flex-row items-center gap-3">
        <Text testID="coach-step" className="font-pixel text-label text-muted-foreground">{C.step(coach.step)}</Text>
        {/* Drag, Turn, Done: the step line above already says where you are. */}
        <View className="flex-row gap-2" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {C.labels.map((label, i) => (
            <Text key={label} className={i === k ? 'text-caption font-semibold' : 'text-caption text-muted-foreground'}>{label}</Text>
          ))}
        </View>
      </View>
      <Text className="text-body">{C.steps[k]}</Text>
      {C.next[k] ? <Text className="text-caption text-muted-foreground">{C.next[k]}</Text> : null}
      {coach.step === 1 && offerPlace ? (
        <View className="flex-row pt-1">
          <Button testID="coach-place" className={TOOL} onPress={() => dispatch({ type: 'drop', id: null, item: COACH_ITEM, target: { layer: 'floor', x: coach.tile[0], y: coach.tile[1] } })}>
            {C.place}
          </Button>
        </View>
      ) : null}
    </View>
  );
}
