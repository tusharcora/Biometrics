import React from 'react';
import { View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { HERO_ART, SMALL_ART } from '../../lib/weatherArt';
import type { WeatherKey } from '../../lib/recoveryCopy';

// Decorative: the verdict text carries the meaning (spec §3.0, §7).
export function WeatherIcon({ kind, variant, size = 22, dim = false, testID }: { kind: WeatherKey; variant: 'hero' | 'small'; size?: number; dim?: boolean; testID?: string }) {
  const hero = variant === 'hero';
  const art = hero ? HERO_ART[kind] : SMALL_ART[kind];
  const width = hero ? 150 : size;
  const height = hero ? 107 : size;
  // react-native-svg has no shapeRendering (see CampScene); small sizes 22 and 44 put every edge on a whole point.
  return (
    <View testID={testID} accessible={false} importantForAccessibility="no-hide-descendants" style={{ width, height, opacity: dim ? 0.45 : 1 }}>
      <Svg width={width} height={height} viewBox={hero ? '0 0 28 20' : '0 0 11 11'}>
        {art.map((p, i) => (
          <Rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} fill={p.fill} />
        ))}
      </Svg>
    </View>
  );
}
