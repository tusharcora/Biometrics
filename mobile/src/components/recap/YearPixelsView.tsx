import React from 'react';
import { Text, View } from 'react-native';
import { goalLabel } from '../../lib/recapCopy';
import { APP_NAME, DESIGN_WIDTH, type Includes } from '../../lib/recapShare';
import { recapTint, YEAR_SCALE } from '../../lib/recapTheme';
import { pixelStep, YEAR_COLUMNS, type PixelLevel, type YearPixels } from '../../lib/yearPixels';
import { FONTS } from '../../theme';
import { Character } from '../characters/Character';
import type { CharacterId } from '../characters/types';
import { hexAlpha } from '../characters/palette';
import { pixelFont } from '../coach/thinking/shared';
import { ShareCanvas } from './ShareCanvas';

// Laid out in the design's own units (a 540×540 artboard); a(n) maps them onto the 360 grid × scale.
const ART = 540;
const PAD = 32;
const INNER = ART - 2 * PAD;
const GAP = 16;
const CELL_GAP = 3;
const CELL = (INNER - (YEAR_COLUMNS - 1) * CELL_GAP) / YEAR_COLUMNS;
const SPRITE = 88;

export interface YearPixelsViewProps {
  year: number;
  pixels: YearPixels;
  goalMinutes: number;
  coachId: CharacterId;
  includes: Pick<Includes, 'count' | 'coach'>;
  scale: number;
  testID?: string;
}

const LEVEL_LABEL: Record<PixelLevel, string> = { none: 'no data', short: 'short', near: 'near goal', goal: 'on goal', future: 'still to come' };

/**
 * Year in pixels (recap restyle, 1b): square, tinted by the current coach; every night of the
 * year in a 26-column grid on the four-step purple scale (no data, short, near, on goal).
 */
export function YearPixelsView({ year, pixels, goalMinutes, coachId, includes, scale, testID = 'year-pixels' }: YearPixelsViewProps) {
  const a = (n: number) => (n * scale * DESIGN_WIDTH) / ART;
  const t = recapTint(coachId);
  const pixel = pixelFont();
  const fill = (level: PixelLevel) => {
    const step = pixelStep(level);
    return step === null ? hexAlpha(t.text, 0.05) : YEAR_SCALE[step];
  };
  return (
    <ShareCanvas testID={testID} tint={t} width={a(ART)} height={a(ART)} dotSpacing={a(16)} dotRadius={a(1.3)} style={{ padding: a(PAD), gap: a(GAP) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: a(16), minHeight: a(SPRITE) }}>
        {includes.coach ? (
          <View testID={`${testID}-coach`}>
            <Character characterId={coachId} mood="idle" size={Math.round(a(SPRITE))} paused />
          </View>
        ) : null}
        <View style={{ flex: 1, gap: a(4) }}>
          <Text testID={`${testID}-eyebrow`} style={{ fontFamily: pixel, fontSize: a(13), lineHeight: a(18), letterSpacing: a(1.04), color: t.accentText }}>{`${year} IN PIXELS`}</Text>
          <Text numberOfLines={2} adjustsFontSizeToFit style={{ fontFamily: FONTS.sansBold, fontSize: a(28), lineHeight: a(32), color: t.text }}>
            Every night, one square
          </Text>
        </View>
      </View>
      {/* Rows of 26 drawn explicitly: a wrapping row could round a cell onto the next line. */}
      <View testID={`${testID}-grid`} style={{ gap: a(CELL_GAP) }}>
        {Array.from({ length: Math.ceil(pixels.cells.length / YEAR_COLUMNS) }, (_, r) => (
          <View key={r} testID={`${testID}-row-${r}`} style={{ flexDirection: 'row', gap: a(CELL_GAP) }}>
            {pixels.cells.slice(r * YEAR_COLUMNS, (r + 1) * YEAR_COLUMNS).map((cell) => (
              <View
                key={cell.date}
                testID={`${testID}-cell-${cell.date}`}
                accessibilityLabel={cell.level}
                style={{ width: a(CELL), height: a(CELL), borderRadius: a(2), backgroundColor: fill(cell.level) }}
              />
            ))}
          </View>
        ))}
      </View>
      <View
        testID={`${testID}-legend`}
        accessible
        accessibilityLabel={`From ${LEVEL_LABEL.none} through ${LEVEL_LABEL.short} and ${LEVEL_LABEL.near} to ${LEVEL_LABEL.goal}`}
        style={{ flexDirection: 'row', alignItems: 'center', gap: a(8) }}
      >
        <Text style={{ fontFamily: FONTS.sans, fontSize: a(12), lineHeight: a(16), color: t.muted }}>Short</Text>
        {YEAR_SCALE.map((c) => (
          <View key={c} style={{ width: a(14), height: a(14), borderRadius: a(3), backgroundColor: c }} />
        ))}
        <Text style={{ fontFamily: FONTS.sans, fontSize: a(12), lineHeight: a(16), color: t.muted }}>On goal</Text>
      </View>
      <View style={{ marginTop: 'auto', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: a(12), borderTopWidth: a(1), borderTopColor: t.hairline, paddingTop: a(12) }}>
        {/* The caption qualifies the count, so it goes with it. */}
        {includes.count ? (
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: a(8), flexShrink: 1 }}>
            <Text testID={`${testID}-count`} style={{ fontFamily: FONTS.sansSemibold, fontSize: a(14), lineHeight: a(18), color: t.text }}>
              {`${pixels.onGoal} ${pixels.onGoal === 1 ? 'night' : 'nights'} on goal`}
            </Text>
            <Text testID={`${testID}-caption`} numberOfLines={1} style={{ flexShrink: 1, fontFamily: FONTS.sans, fontSize: a(11), lineHeight: a(18), color: t.muted }}>
              {`on your current goal of ${goalLabel(goalMinutes)}`}
            </Text>
          </View>
        ) : (
          <View />
        )}
        <Text testID={`${testID}-app`} style={{ fontFamily: pixel, fontSize: a(12), lineHeight: a(18), color: t.accentText }}>{APP_NAME}</Text>
      </View>
    </ShareCanvas>
  );
}
