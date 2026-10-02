import React from 'react';
import { Platform, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Pattern, Rect, Stop } from 'react-native-svg';
import { Text } from '../ui/text';
import { Character } from './Character';
import { CHARACTERS } from './registry';
import type { CharacterId } from './types';

const ART_HEIGHT = 176;
const SPRITE = 120;
const DOT_GAP = 12;
// No mono face is bundled; the system one matches the mockup's ui-monospace.
const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });

export interface CoachCardProps {
  characterId: CharacterId;
  /** Server copy (persona tagline); falls back to the local registry. */
  tagline?: string;
  /** Server copy (persona greeting); falls back to the local registry. */
  greeting?: string;
  paused?: boolean;
  testID?: string;
}

// The accent's tinted panel: a 10 % → 4 % vertical wash with a 12 pt dot grid
// at 16 % (02-coach-cards.html). Decorative only.
function ArtPanel({ accent }: { accent: string }) {
  const key = accent.replace(/[^a-zA-Z0-9]/g, '');
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
    >
      <Svg width="100%" height={ART_HEIGHT}>
        <Defs>
          <LinearGradient id={`coach-panel-${key}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={accent} stopOpacity={0.1} />
            <Stop offset="1" stopColor={accent} stopOpacity={0.04} />
          </LinearGradient>
          <Pattern id={`coach-dots-${key}`} width={DOT_GAP} height={DOT_GAP} patternUnits="userSpaceOnUse">
            <Circle cx={DOT_GAP / 2} cy={DOT_GAP / 2} r={1.2} fill={accent} fillOpacity={0.16} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#coach-panel-${key})`} />
        <Rect width="100%" height="100%" fill={`url(#coach-dots-${key})`} />
      </Svg>
    </View>
  );
}

// A coach's collectible card for the picker sheet and the dev gallery
// (02-coach-cards.html): number, focus chip, the coach idling on its accent
// panel, then name, tagline and a first hello in a speech bubble.
export function CoachCard({ characterId, tagline, greeting, paused = false, testID }: CoachCardProps) {
  const c = CHARACTERS[characterId];
  const number = `No.${String(c.number).padStart(2, '0')}`;
  return (
    <View testID={testID} className="overflow-hidden rounded-[24px] border border-border bg-card">
      <View style={{ height: ART_HEIGHT }} className="items-center justify-center">
        <ArtPanel accent={c.accent} />
        {/* Ground shadow under the sprite. */}
        <View
          pointerEvents="none"
          className="absolute left-1/2 rounded-full"
          style={{ bottom: 22, width: 96, height: 10, marginLeft: -48, backgroundColor: 'rgba(0,0,0,0.28)' }}
        />
        <Text
          className="absolute left-3.5 top-3 text-[11px] text-muted-foreground"
          style={{ fontFamily: MONO, fontWeight: '600', letterSpacing: 0.44 }}
        >
          {number}
        </Text>
        <View className="absolute right-3 top-2.5 rounded-full px-2.5 py-1" style={{ backgroundColor: withAlpha(c.accent, 0.16) }}>
          <Text className="text-[11px] font-semibold" style={{ color: c.accent }}>
            {c.focus}
          </Text>
        </View>
        <View style={{ marginBottom: 6 }}>
          <Character characterId={characterId} mood="idle" size={SPRITE} glow paused={paused} attachment={null} />
        </View>
      </View>
      <View className="gap-2 px-4 pb-4 pt-3.5">
        <Text accessibilityRole="header" className="text-xl font-bold" style={{ letterSpacing: -0.2 }}>
          {c.name}
        </Text>
        <Text className="text-[13px] leading-[18px] text-muted-foreground">{tagline ?? c.tagline}</Text>
        <View className="mt-1.5 rounded-[14px] border border-border bg-muted px-3 py-2.5">
          {/* Speech-bubble tail: a rotated square sharing the bubble's fill and edge. */}
          <View
            pointerEvents="none"
            className="absolute border-l border-t border-border bg-muted"
            style={{ top: -6, left: 22, width: 10, height: 10, transform: [{ rotate: '45deg' }] }}
          />
          <Text className="text-[13px] leading-[18px]">{greeting ?? c.greeting}</Text>
        </View>
      </View>
    </View>
  );
}

function withAlpha(hex: string, a: number): string {
  return `${hex}${Math.round(a * 255).toString(16).padStart(2, '0')}`;
}
