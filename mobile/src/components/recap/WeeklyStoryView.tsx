import React from 'react';
import { Text, View } from 'react-native';
import type { Recap, WeekStripEntry } from '../../api/recaps';
import { weekdayName } from '../../lib/recapCopy';
import { APP_NAME, fitQuote, QUOTE_MIN_FONT_SCALE, quoteLines, type Includes } from '../../lib/recapShare';
import { formatDuration } from '../../lib/sleepStats';
import { COLORS, FONTS } from '../../theme';
import { Character } from '../characters/Character';
import { characterInfo } from '../characters/registry';
import type { CharacterId } from '../characters/types';

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const BAR_MAX = 170;
// The shortest bar drawn: a day with no data, or a short day of almost no sleep, stays visible.
const BAR_MIN = 6;
// Design units on the 360×640 grid (32 padding each side).
const CONTENT_W = 296;
const CONTENT_H = 576;
const TITLE_SIZE = 34;
const TITLE_LINE = 38;
const STRIP = BAR_MAX + 30;
const BEST_LINE = 20;
const COACH = 56;
const APP_LINE = 16;
const MIN_GAP = 16;
const QUOTE_BASE = 22;

export interface WeeklyStoryViewProps {
  recap: Recap;
  coachId: CharacterId;
  includes: Includes;
  scale: number;
  testID?: string;
}

const stateOf = (d: WeekStripEntry) => (d.onGoal === null ? 'no data' : d.onGoal ? 'on goal' : 'short');

/** The weekly story (spec §3, 1a): 360×640 × scale, dark palette; the strip is coloured by on goal. */
export function WeeklyStoryView({ recap, coachId, includes, scale, testID = 'recap-story' }: WeeklyStoryViewProps) {
  const u = (n: number) => n * scale;
  const c = COLORS.dark;
  const strip = recap.stats.weekStrip ?? [];
  const tallest = Math.max(recap.sleepGoalMinutes * 1.25, ...strip.map((d) => d.minutesAsleep ?? 0));
  const best = recap.stats.bestNight;
  const fill = (d: WeekStripEntry) => (d.onGoal === null ? 'transparent' : d.onGoal ? c.sleepDeep : c.todayTrack);
  const title = `How ${characterInfo(coachId).name} saw my week`;
  const quote = `“${recap.line}”`;
  // The quote gets what the content box leaves after the other blocks and a 16pt gap between each.
  const blocks = [quoteLines(title, TITLE_SIZE, CONTENT_W) * TITLE_LINE, STRIP, includes.bestNight && best ? BEST_LINE : 0, includes.coach ? COACH : APP_LINE].filter((h) => h > 0);
  const quoteBox = CONTENT_H - blocks.reduce((a, b) => a + b, 0) - blocks.length * MIN_GAP;
  const fit = fitQuote(quote, CONTENT_W, quoteBox, QUOTE_BASE);
  return (
    <View testID={testID} collapsable={false} style={{ width: u(360), height: u(640), backgroundColor: c.background, padding: u(32), justifyContent: 'space-between' }}>
      <Text testID={`${testID}-title`} style={{ fontFamily: FONTS.display, fontSize: u(TITLE_SIZE), lineHeight: u(TITLE_LINE), color: c.foreground }}>
        {title}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: u(STRIP) }}>
        {strip.map((d, i) => (
          <View key={d.date} testID={`${testID}-day-${d.date}`} accessibilityLabel={`${DAY_LETTERS[i]}: ${stateOf(d)}`} style={{ alignItems: 'center', gap: u(8) }}>
            <View
              testID={`${testID}-bar-${d.date}`}
              style={{
                width: u(28),
                height: u(Math.max(BAR_MIN, (BAR_MAX * (d.minutesAsleep ?? 0)) / tallest)),
                borderRadius: u(8),
                backgroundColor: fill(d),
                borderWidth: d.onGoal === null ? u(1) : 0,
                borderColor: c.hairline,
              }}
            />
            <Text style={{ fontFamily: FONTS.sansMedium, fontSize: u(12), color: c.muted }}>{DAY_LETTERS[i]}</Text>
          </View>
        ))}
      </View>
      {includes.bestNight && best ? (
        <Text testID={`${testID}-best`} style={{ fontFamily: FONTS.sansSemibold, fontSize: u(15), lineHeight: u(BEST_LINE), color: c.foreground }}>
          {`Best night · ${weekdayName(best.date)} · ${formatDuration(best.minutesAsleep)}`}
        </Text>
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
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        {includes.coach ? (
          <View testID={`${testID}-coach`}>
            <Character characterId={coachId} mood="idle" size={Math.round(u(COACH))} paused />
          </View>
        ) : (
          <View />
        )}
        <Text testID={`${testID}-app`} style={{ fontFamily: FONTS.sansSemibold, fontSize: u(13), lineHeight: u(APP_LINE), color: c.muted }}>{APP_NAME}</Text>
      </View>
    </View>
  );
}
