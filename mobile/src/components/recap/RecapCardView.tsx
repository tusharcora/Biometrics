import React from 'react';
import { Text, View } from 'react-native';
import type { Recap } from '../../api/recaps';
import { cardStats, monthName } from '../../lib/recapCopy';
import { APP_NAME, type Includes } from '../../lib/recapShare';
import { COLORS, FONTS } from '../../theme';
import { Character } from '../characters/Character';
import { characterInfo } from '../characters/registry';
import type { CharacterId } from '../characters/types';

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
  return (
    <View testID={testID} collapsable={false} style={{ width: u(360), height: u(360), backgroundColor: c.background, padding: u(28), justifyContent: 'space-between' }}>
      <View style={{ gap: u(14) }}>
        <Text style={{ fontFamily: FONTS.sansSemibold, fontSize: u(13), letterSpacing: u(2), color: c.muted }}>{`MY ${monthName(recap.periodStart).toUpperCase()}`}</Text>
        {includes.coach ? (
          <View testID={`${testID}-coach`} style={{ flexDirection: 'row', alignItems: 'center', gap: u(10) }}>
            <Character characterId={coachId} mood="idle" size={Math.round(u(44))} paused />
            <Text style={{ fontFamily: FONTS.sansSemibold, fontSize: u(15), color: c.foreground }}>{characterInfo(coachId).name}</Text>
          </View>
        ) : null}
        {includes.quote ? (
          <Text testID={`${testID}-quote`} numberOfLines={4} style={{ fontFamily: FONTS.display, fontSize: u(24), lineHeight: u(29), color: c.foreground }}>
            {`“${recap.line}”`}
          </Text>
        ) : null}
      </View>
      <View style={{ gap: u(14) }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: u(12) }}>
          {stats.map((s) => (
            <View key={s.key} testID={`${testID}-stat-${s.key}`} style={{ width: '50%' }}>
              <Text style={{ fontFamily: FONTS.sansBold, fontSize: u(22), color: c.foreground }}>{s.value}</Text>
              <Text style={{ fontFamily: FONTS.sans, fontSize: u(11), color: c.muted }}>{s.label}</Text>
            </View>
          ))}
        </View>
        <Text testID={`${testID}-app`} style={{ fontFamily: FONTS.sansSemibold, fontSize: u(12), color: c.muted }}>{APP_NAME}</Text>
      </View>
    </View>
  );
}
