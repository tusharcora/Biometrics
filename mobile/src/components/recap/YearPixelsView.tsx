import React from 'react';
import { Text, View } from 'react-native';
import { goalLabel } from '../../lib/recapCopy';
import { APP_NAME, type Includes } from '../../lib/recapShare';
import type { PixelLevel, YearPixels } from '../../lib/yearPixels';
import { COLORS, FONTS } from '../../theme';
import { Character } from '../characters/Character';
import type { CharacterId } from '../characters/types';

const MONTH_LETTERS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const CELL = 8;
const GAP = 1.5;

export interface YearPixelsViewProps {
  year: number;
  pixels: YearPixels;
  goalMinutes: number;
  coachId: CharacterId;
  includes: Pick<Includes, 'count' | 'coach'>;
  scale: number;
  /** 'dark' for the share image (always); the app theme for the in-app screen. */
  palette: 'light' | 'dark';
  testID?: string;
}

/** Year in pixels (spec §3, 1b): 360×360 × scale; on goal sleepDeep, short a muted track, no data an outline. */
export function YearPixelsView({ year, pixels, goalMinutes, coachId, includes, scale, palette, testID = 'year-pixels' }: YearPixelsViewProps) {
  const u = (n: number) => n * scale;
  const c = COLORS[palette];
  const fill = (level: PixelLevel) => (level === 'goal' ? c.sleepDeep : level === 'short' ? c.todayTrack : 'transparent');
  return (
    <View testID={testID} collapsable={false} style={{ width: u(360), height: u(360), backgroundColor: c.background, padding: u(24), justifyContent: 'space-between' }}>
      <Text style={{ fontFamily: FONTS.display, fontSize: u(26), color: c.foreground }}>{`${year} in pixels`}</Text>
      <View testID={`${testID}-grid`} style={{ gap: u(GAP) }}>
        {pixels.rows.map((row) => (
          <View key={row.month} style={{ flexDirection: 'row', alignItems: 'center', gap: u(GAP) }}>
            <Text style={{ width: u(12), fontFamily: FONTS.sansMedium, fontSize: u(8), color: c.muted }}>{MONTH_LETTERS[row.month]}</Text>
            {row.cells.map((cell) => (
              <View
                key={cell.date}
                testID={`${testID}-cell-${cell.date}`}
                accessibilityLabel={cell.level}
                style={{ width: u(CELL), height: u(CELL), borderRadius: u(2), backgroundColor: fill(cell.level), borderWidth: cell.level === 'none' ? u(1) : 0, borderColor: c.hairline }}
              />
            ))}
          </View>
        ))}
      </View>
      <View style={{ gap: u(4) }}>
        {/* The caption qualifies the count, so it goes with it. */}
        {includes.count ? (
          <>
            <Text testID={`${testID}-count`} style={{ fontFamily: FONTS.sansBold, fontSize: u(18), color: c.foreground }}>
              {`${pixels.onGoal} ${pixels.onGoal === 1 ? 'night' : 'nights'} on goal`}
            </Text>
            <Text testID={`${testID}-caption`} style={{ fontFamily: FONTS.sans, fontSize: u(11), color: c.muted }}>{`on your current goal of ${goalLabel(goalMinutes)}`}</Text>
          </>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {includes.coach ? (
          <View testID={`${testID}-coach`}>
            <Character characterId={coachId} mood="idle" size={Math.round(u(36))} paused />
          </View>
        ) : (
          <View />
        )}
        <Text testID={`${testID}-app`} style={{ fontFamily: FONTS.sansSemibold, fontSize: u(12), color: c.muted }}>{APP_NAME}</Text>
      </View>
    </View>
  );
}
