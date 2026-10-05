import React from 'react';
import { Text, View } from 'react-native';
import type { Recap } from '../../api/recaps';
import { cardStats, monthName } from '../../lib/recapCopy';
import { APP_NAME, fitQuote, QUOTE_MIN_FONT_SCALE, type Includes } from '../../lib/recapShare';
import { COLORS, FONTS } from '../../theme';
import { Character } from '../characters/Character';
import { characterInfo } from '../characters/registry';
import type { CharacterId } from '../characters/types';

// Design units on the 360 grid (28 padding each side).
const CONTENT = 304;
const GAP = 14;
const LABEL_LINE = 18;
const COACH = 44;
const STAT_ROW = 42; // 28 value line + 14 label line
const APP_LINE = 16;
const QUOTE_BASE = 20;

export interface RecapCardViewProps {
  recap: Recap;
  coachId: CharacterId;
  includes: Includes;
  scale: number;
  testID?: string;
}

/** The monthly card (spec §3, 1): a 360×360 design grid × scale, always in the dark palette. */
export function RecapCardView({ recap, coachId, includes, scale, testID = 'recap-card' }: RecapCardViewProps) {
  const u = (n: number) => n * scale;
  const c = COLORS.dark;
  const stats = cardStats(recap.stats).filter((s) => includes[s.key]).slice(0, 4);
  const quote = `“${recap.line}”`;
  // The quote gets what the 304×304 content box leaves (design units, matching the line heights
  // below): the month label, the coach row, the stat rows, the app name and a 12pt breathing gap.
  const statRows = Math.ceil(stats.length / 2);
  const bottom = (statRows > 0 ? statRows * STAT_ROW + (statRows - 1) * 12 + GAP : 0) + APP_LINE;
  const quoteBox = CONTENT - LABEL_LINE - (includes.coach ? GAP + COACH : 0) - GAP - bottom - 12;
  const fit = fitQuote(quote, CONTENT, quoteBox, QUOTE_BASE);
  return (
    <View testID={testID} collapsable={false} style={{ width: u(360), height: u(360), backgroundColor: c.background, padding: u(28), justifyContent: 'space-between' }}>
      <View style={{ gap: u(GAP), flexShrink: 1, minHeight: 0 }}>
        <Text style={{ fontFamily: FONTS.sansSemibold, fontSize: u(13), lineHeight: u(LABEL_LINE), letterSpacing: u(2), color: c.muted }}>{`MY ${monthName(recap.periodStart).toUpperCase()}`}</Text>
        {includes.coach ? (
          <View testID={`${testID}-coach`} style={{ flexDirection: 'row', alignItems: 'center', gap: u(10) }}>
            <Character characterId={coachId} mood="idle" size={Math.round(u(COACH))} paused />
            <Text style={{ fontFamily: FONTS.sansSemibold, fontSize: u(15), color: c.foreground }}>{characterInfo(coachId).name}</Text>
          </View>
        ) : null}
        {includes.quote ? (
          <Text
            testID={`${testID}-quote`}
            numberOfLines={fit.lines + 1}
            adjustsFontSizeToFit
            minimumFontScale={QUOTE_MIN_FONT_SCALE}
            style={{ flexShrink: 1, fontFamily: FONTS.display, fontSize: u(fit.fontSize), color: c.foreground }}
          >
            {quote}
          </Text>
        ) : null}
      </View>
      <View style={{ gap: u(GAP), flexShrink: 0 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: u(12) }}>
          {stats.map((s) => (
            <View key={s.key} testID={`${testID}-stat-${s.key}`} style={{ width: '50%' }}>
              <Text style={{ fontFamily: FONTS.sansBold, fontSize: u(22), lineHeight: u(28), color: c.foreground }}>{s.value}</Text>
              <Text style={{ fontFamily: FONTS.sans, fontSize: u(11), lineHeight: u(14), color: c.muted }}>{s.label}</Text>
            </View>
          ))}
        </View>
        <Text testID={`${testID}-app`} style={{ fontFamily: FONTS.sansSemibold, fontSize: u(12), lineHeight: u(APP_LINE), color: c.muted }}>{APP_NAME}</Text>
      </View>
    </View>
  );
}
