import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

// A still rendering of the coach orb for small, repeated places (the Ask
// Coach tile, the digest header). The animated Skia ThinkingOrb stays in the
// tab bar and the Coach screen, so Home never runs more than one canvas.
export function OrbDot({ size = 40, glow = true }: { size?: number; glow?: boolean }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        shadowColor: 'rgb(45, 212, 191)',
        shadowOpacity: glow ? 0.45 : 0,
        shadowRadius: size * 0.35,
        shadowOffset: { width: 0, height: 0 },
      }}
    >
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id="orb-dot" cx="35%" cy="30%" r="75%">
            <Stop offset="0" stopColor="rgb(207, 250, 254)" />
            <Stop offset="0.32" stopColor="rgb(45, 212, 191)" />
            <Stop offset="0.72" stopColor="rgb(99, 102, 241)" />
            <Stop offset="1" stopColor="rgb(30, 27, 75)" />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill="url(#orb-dot)" />
      </Svg>
    </View>
  );
}
