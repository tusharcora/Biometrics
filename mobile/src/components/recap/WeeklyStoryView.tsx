import React from 'react';
import { Text, View } from 'react-native';
import type { Recap, WeekStripEntry } from '../../api/recaps';
import { weekdayName } from '../../lib/recapCopy';
import { APP_NAME, type Includes } from '../../lib/recapShare';
import { formatDuration } from '../../lib/sleepStats';
import { COLORS, FONTS } from '../../theme';
import { Character } from '../characters/Character';
import { characterInfo } from '../characters/registry';
import type { CharacterId } from '../characters/types';

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const BAR_MAX = 170;

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
  return (
    <View testID={testID} collapsable={false} style={{ width: u(360), height: u(640), backgroundColor: c.background, padding: u(32), justifyContent: 'space-between' }}>
      <Text testID={`${testID}-title`} style={{ fontFamily: FONTS.display, fontSize: u(34), lineHeight: u(38), color: c.foreground }}>
        {`How ${characterInfo(coachId).name} saw my week`}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: u(BAR_MAX + 30) }}>
        {strip.map((d, i) => (
          <View key={d.date} testID={`${testID}-day-${d.date}`} accessibilityLabel={`${DAY_LETTERS[i]}: ${stateOf(d)}`} style={{ alignItems: 'center', gap: u(8) }}>
            <View
              style={{
                width: u(28),
                height: d.minutesAsleep === null ? u(6) : u((BAR_MAX * d.minutesAsleep) / tallest),
                borderRadius: u(8),
                backgroundColor: fill(d),
                borderWidth: d.onGoal === null ? 1 : 0,
                borderColor: c.hairline,
              }}
            />
            <Text style={{ fontFamily: FONTS.sansMedium, fontSize: u(12), color: c.muted }}>{DAY_LETTERS[i]}</Text>
          </View>
        ))}
      </View>
      {includes.bestNight && best ? (
        <Text testID={`${testID}-best`} style={{ fontFamily: FONTS.sansSemibold, fontSize: u(15), color: c.foreground }}>
          {`Best night · ${weekdayName(best.date)} · ${formatDuration(best.minutesAsleep)}`}
        </Text>
      ) : null}
      {includes.quote ? (
        <Text testID={`${testID}-quote`} numberOfLines={5} style={{ fontFamily: FONTS.display, fontSize: u(26), lineHeight: u(31), color: c.foreground }}>
          {`“${recap.line}”`}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {includes.coach ? (
          <View testID={`${testID}-coach`}>
            <Character characterId={coachId} mood="idle" size={Math.round(u(56))} paused />
          </View>
        ) : (
          <View />
        )}
        <Text testID={`${testID}-app`} style={{ fontFamily: FONTS.sansSemibold, fontSize: u(13), color: c.muted }}>{APP_NAME}</Text>
      </View>
    </View>
  );
}
