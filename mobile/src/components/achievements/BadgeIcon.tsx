import React from 'react';
import { View } from 'react-native';
import Svg, { Polygon, Rect } from 'react-native-svg';
import { useColorScheme } from 'nativewind';
import type { AchievementFamily } from '../../api/achievements';
import { LOCKED_PIP, TIER_SURFACE, glyphCells, octagonPoints, tierColors, tierInk } from '../../lib/badgeArt';
import { badgeLabel } from '../../lib/badges';
import type { KipColour } from '../../lib/kip/kipArt';
import { useMyKipColour } from '../../lib/kip/myKip';

export interface BadgeIconProps {
  family: AchievementFamily;
  /** 0 (locked) .. 5. */
  level: number;
  size: number;
  /** The five level pips under the badge. */
  pips?: boolean;
  /** Level V's colour; your KIP's colour when omitted. */
  colour?: KipColour;
  /** What the pips sit on, so a level V pip reads there; the app's page or card for this theme when omitted. */
  pipSurface?: string;
  testID?: string;
}

// One badge (canvas Badge.dc.html): the tier-coloured octagon ring, its dark face, the family's
// 12×12 glyph in the middle 52%, and optionally five pips. Drawn on a 100-unit viewBox.
const VIEW = 100;
const GLYPH_BOX = 52;
const CELL = GLYPH_BOX / 12;
const ORIGIN = (VIEW - GLYPH_BOX) / 2;

export function BadgeIcon({ family, level, size, pips = true, colour, pipSurface, testID = 'badge' }: BadgeIconProps) {
  const mine = useMyKipColour();
  const scheme = useColorScheme().colorScheme === 'dark' ? 'dark' : 'light';
  const lv = Math.max(0, Math.min(5, Math.round(level)));
  const t = tierColors(lv, colour ?? mine);
  // The ring art keeps the raw colour; an earned pip is a UI mark, so level V's reads on its surface.
  const pipColour = tierInk(lv, colour ?? mine, pipSurface ?? TIER_SURFACE[scheme]).ring;
  const ring = lv === 5 ? 9 : 6;
  const pip = Math.max(4, Math.round(size * 0.07));
  const label = badgeLabel(family, lv);
  return (
    <View testID={testID} accessible accessibilityRole="image" accessibilityLabel={label} style={{ width: size, alignItems: 'center', gap: Math.round(size * 0.08) }}>
      <Svg width={size} height={size} viewBox={`0 0 ${VIEW} ${VIEW}`}>
        <Polygon points={octagonPoints(0, VIEW)} fill={t.ring} />
        <Polygon points={octagonPoints(ring, VIEW)} fill={t.fill} />
        {glyphCells(family).map(([c, r]) => (
          <Rect key={`${c}-${r}`} x={ORIGIN + c * CELL} y={ORIGIN + r * CELL} width={CELL + 0.05} height={CELL + 0.05} fill={t.glyph} />
        ))}
      </Svg>
      {pips ? (
        <View testID={`${testID}-pips`} style={{ flexDirection: 'row', gap: 4 }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <View key={i} testID={`${testID}-pip-${i}`} style={{ width: pip, height: pip, backgroundColor: i <= lv ? pipColour : LOCKED_PIP }} />
          ))}
        </View>
      ) : null}
    </View>
  );
}
