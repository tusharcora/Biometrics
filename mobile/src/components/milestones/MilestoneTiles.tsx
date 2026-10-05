import React from 'react';
import { View } from 'react-native';
import { useColorScheme } from 'nativewind';
import Svg, { Path, Rect } from 'react-native-svg';
import { COLORS } from '../../theme';
import { Text } from '../ui/text';

// Milestone tiles (recap restyle 2026-10-05: the month screen's "Milestones"). A standalone grid,
// three to a row, so a later Achievements screen can reuse it: every milestone is shown, the ones
// not earned dimmed with a lock and no progress count.

export type MilestoneGlyph = 'star' | 'heart' | 'calendar' | 'moon';

export interface MilestoneTile {
  key: string;
  label: string;
  glyph: MilestoneGlyph;
  earned: boolean;
}

export interface MilestoneTilesProps {
  tiles: MilestoneTile[];
  testID?: string;
}

const COLUMNS = 3;
const GAP = 10;
const GLYPH = 32;
export const LOCKED_OPACITY = 0.5;

type Px = [x: number, y: number, w: number, h: number];

// 8×8 pixel glyphs (the design's star and heart; a calendar and a moon in the same hand).
const GLYPHS: Record<MilestoneGlyph, { px: Px[]; color: { light: string; dark: string } }> = {
  star: { px: [[3, 0, 2, 2], [0, 2, 8, 2], [2, 4, 4, 2], [1, 6, 2, 2], [5, 6, 2, 2]], color: { light: '#CA8A04', dark: '#FEF08A' } },
  heart: { px: [[1, 1, 2, 1], [5, 1, 2, 1], [0, 2, 8, 2], [1, 4, 6, 1], [2, 5, 4, 1], [3, 6, 2, 1]], color: { light: '#DB2777', dark: '#F472B6' } },
  calendar: { px: [[2, 0, 1, 2], [5, 0, 1, 2], [0, 1, 8, 2], [0, 3, 1, 5], [7, 3, 1, 5], [0, 7, 8, 1], [2, 4, 1, 1], [4, 4, 1, 1], [2, 5, 1, 1]], color: { light: '#2563EB', dark: '#93C5FD' } },
  moon: { px: [[2, 0, 4, 1], [1, 1, 2, 1], [0, 2, 2, 4], [1, 6, 2, 1], [2, 7, 4, 1], [6, 6, 1, 1]], color: { light: '#7C3AED', dark: '#C4B5FD' } },
};

function Glyph({ glyph, scheme, testID }: { glyph: MilestoneGlyph; scheme: 'light' | 'dark'; testID: string }) {
  const { px, color } = GLYPHS[glyph];
  return (
    <Svg testID={testID} viewBox="0 0 8 8" width={GLYPH} height={GLYPH}>
      {px.map(([x, y, w, h], i) => (
        <Rect key={i} x={x} y={y} width={w} height={h} fill={color[scheme]} />
      ))}
    </Svg>
  );
}

function Lock({ color, testID }: { color: string; testID: string }) {
  return (
    <Svg testID={testID} viewBox="0 0 24 24" width={28} height={GLYPH} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Rect x={5} y={11} width={14} height={9} rx={2} />
      <Path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </Svg>
  );
}

export function MilestoneTiles({ tiles, testID = 'milestone-tiles' }: MilestoneTilesProps) {
  const { colorScheme } = useColorScheme();
  const scheme = colorScheme === 'dark' ? 'dark' : 'light';
  const rows: MilestoneTile[][] = [];
  for (let i = 0; i < tiles.length; i += COLUMNS) rows.push(tiles.slice(i, i + COLUMNS));
  return (
    <View testID={testID} style={{ gap: GAP }}>
      {rows.map((row, r) => (
        <View key={r} testID={`${testID}-row-${r}`} style={{ flexDirection: 'row', gap: GAP }}>
          {row.map((tile) => (
            <View
              key={tile.key}
              testID={`${testID}-${tile.key}`}
              accessible
              accessibilityLabel={`${tile.label}, ${tile.earned ? 'earned' : 'locked'}`}
              className="flex-1 items-center gap-1.5 rounded-2xl border border-border bg-card px-2 py-3"
              style={{ opacity: tile.earned ? 1 : LOCKED_OPACITY }}
            >
              <View style={{ height: GLYPH, justifyContent: 'center' }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                {tile.earned ? <Glyph glyph={tile.glyph} scheme={scheme} testID={`${testID}-${tile.key}-glyph`} /> : <Lock color={COLORS[scheme].muted} testID={`${testID}-${tile.key}-lock`} />}
              </View>
              <Text className="text-center text-xs">{tile.label}</Text>
            </View>
          ))}
          {/* Empty slots keep a short last row on the same columns. */}
          {Array.from({ length: COLUMNS - row.length }, (_, i) => (
            <View key={`empty-${i}`} style={{ flex: 1 }} />
          ))}
        </View>
      ))}
    </View>
  );
}
