import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { clampTagLeft } from '../../lib/home/scene';
import { Text } from '../ui/text';

const INK = '#F5F5F4';

// Home F's hot tag (dark, rounded-lg, a band-colour square, a pixel key, a tabular value). Home places it over the
// scene (`position`); the KIP page's room card lays it out in normal flow (spec 2026-10-14 KIP Coach §3.1).
export function HotTag({ testID, keyText, keyColour, value, label, onPress, position }: {
  testID: string; keyText: string; keyColour: string; value: string | null; label: string; onPress: () => void;
  position?: { left: number; top: number; screenWidth: number };
}) {
  const [width, setWidth] = useState(0);
  const placed = position
    ? { position: 'absolute' as const, left: clampTagLeft(position.left, width, position.screenWidth), top: position.top }
    : { alignSelf: 'flex-start' as const };
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      className="flex-row items-center rounded-lg border active:opacity-80"
      style={{ ...placed, height: 26, gap: 5, paddingHorizontal: 7, backgroundColor: 'rgba(10,11,14,0.82)', borderColor: 'rgba(255,255,255,0.18)' }}
    >
      <View style={{ width: 4, height: 4, backgroundColor: keyColour }} />
      <Text className="font-pixel text-label" style={{ color: keyColour }}>{keyText}</Text>
      {value !== null ? <Text className="text-caption font-semibold tabular-nums" style={{ color: INK }}>{value}</Text> : null}
    </Pressable>
  );
}
