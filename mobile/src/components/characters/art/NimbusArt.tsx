import React from 'react';
import { Circle, Group, Oval, Path, vec } from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import { kf, MoodLayers, phase, useLoop, type MoodLayerProps } from '../engine';
import type { CharacterArtProps } from '../types';

// Nimbus, the little cloud. Ported from docs/design/companions/BuddyNimbus.dc.html
// (100×100 viewBox; path data, colours and keyframes copied unchanged).

const INK = '#0C4A6E';
const CLOUD = 'M22 72 C12 72 8 62 14 56 C12 46 22 40 30 44 C32 32 46 26 56 32 C64 26 78 32 78 44 C88 44 94 54 88 62 C92 70 86 76 78 74 Z';
// Answering and resting draw the same cloud 4 units lower.
const CLOUD_LOW = 'M22 76 C12 76 8 66 14 60 C12 50 22 44 30 48 C32 36 46 30 56 36 C64 30 78 36 78 48 C88 48 94 58 88 66 C92 74 86 80 78 78 Z';
const MINI_CLOUD = 'M20 76 C8 76 4 64 10 56 C8 44 20 36 30 40 C32 26 48 20 58 28 C68 20 84 28 84 42 C94 42 100 54 94 64 C98 72 90 80 80 78 Z';
const SUN_RAYS = 'M72 8 V12 M72 48 V52 M50 30 H54 M90 30 H94 M57 15 L60 18 M84 42 L87 45 M57 45 L60 42 M84 18 L87 15';
// The crescent moon: the mockup paints a card-coloured disc (#14161B) over the moon; here that
// disc is a clip cut-out so the crescent works on light and dark backgrounds alike.
const MOON_BITE = 'M91 19 A7 7 0 1 1 77 19 A7 7 0 1 1 91 19 Z';

// Mini variant of the non-idle moods: the full art scaled up to fill the square like the pill.
const MINI_FIT = [{ scale: 1.1 }];
const MINI_FIT_ORIGIN = vec(50, 50);

// nb-blink: 4.6s, 0%,45%,49%,100% scaleY(1), 47% scaleY(.1); fill-box centre = the eye centre.
function BlinkEye({ t, cx, cy, rx, ry }: { t: SharedValue<number>; cx: number; cy: number; rx: number; ry: number }) {
  const transform = useDerivedValue(() => [{ scaleY: kf(t.value, [0, 0.45, 0.47, 0.49, 1], [1, 1, 0.1, 1, 1]) }]);
  return (
    <Group transform={transform} origin={vec(cx, cy)}>
      <Oval x={cx - rx} y={cy - ry} width={rx * 2} height={ry * 2} color={INK} />
    </Group>
  );
}

// Idle · drifts (nb-float 4s ease-in-out: 50% translateY(-4px)) + blink.
function Idle({ paused, mini }: MoodLayerProps) {
  const t = useLoop(4000, paused);
  const blink = useLoop(4600, paused);
  const float = useDerivedValue(() => [{ translateY: kf(t.value, [0, 0.5, 1], [0, -4, 0]) }]);
  if (mini) {
    return (
      <Group transform={float}>
        <Path path={MINI_CLOUD} color="#E0F2FE" />
        <BlinkEye t={blink} cx={42} cy={56} rx={5} ry={7} />
        <BlinkEye t={blink} cx={62} cy={56} rx={5} ry={7} />
      </Group>
    );
  }
  return (
    <Group transform={float}>
      <Path path={CLOUD} color="#E0F2FE" />
      <BlinkEye t={blink} cx={42} cy={56} rx={3.5} ry={5} />
      <BlinkEye t={blink} cx={60} cy={56} rx={3.5} ry={5} />
      <Path path="M46 64 Q51 68 56 64" style="stroke" strokeWidth={2.5} strokeCap="round" color={INK} />
      <Oval x={29} y={60} width={10} height={6} color="rgba(251,113,133,0.35)" />
      <Oval x={63} y={60} width={10} height={6} color="rgba(251,113,133,0.35)" />
    </Group>
  );
}

// nb-drop: 1s linear, translateY(0)→(14px) and opacity 1→0. The 2nd and 3rd drops run
// .33s and .66s behind (animation-delay), i.e. at loop offsets .67 and .34.
function Drop({ t, offset, x }: { t: SharedValue<number>; offset: number; x: number }) {
  const transform = useDerivedValue(() => [{ translateY: kf(phase(t.value, offset), [0, 1], [0, 14], 'linear') }]);
  const opacity = useDerivedValue(() => kf(phase(t.value, offset), [0, 1], [1, 0], 'linear'));
  return (
    <Group transform={transform} opacity={opacity}>
      <Path path={`M${x} 76 V82`} style="stroke" strokeWidth={3} strokeCap="round" color="#7DD3FC" />
    </Group>
  );
}

// Thinking · drizzles: three drops fall from under a paler cloud; the cloud itself is still.
function Thinking({ paused, mini }: MoodLayerProps) {
  const t = useLoop(1000, paused);
  return (
    <Group transform={mini ? MINI_FIT : undefined} origin={MINI_FIT_ORIGIN}>
      <Drop t={t} offset={0} x={36} />
      <Drop t={t} offset={0.67} x={52} />
      <Drop t={t} offset={0.34} x={68} />
      <Path path={CLOUD} color="#BAE6FD" />
      <Oval x={40.5} y={47} width={7} height={10} color={INK} />
      <Oval x={58.5} y={47} width={7} height={10} color={INK} />
      <Path path="M48 63 H56" style="stroke" strokeWidth={2.5} strokeCap="round" color={INK} />
    </Group>
  );
}

// Answering · sun peeks out (nb-sun 6s linear, one full turn about the sun's centre 72,30).
function Answering({ paused, mini }: MoodLayerProps) {
  const t = useLoop(6000, paused);
  const spin = useDerivedValue(() => [{ rotate: t.value * Math.PI * 2 }]);
  return (
    <Group transform={mini ? MINI_FIT : undefined} origin={MINI_FIT_ORIGIN}>
      <Group transform={spin} origin={vec(72, 30)}>
        <Circle cx={72} cy={30} r={14} color="#FDE68A" />
        <Path path={SUN_RAYS} style="stroke" strokeWidth={3} strokeCap="round" color="#FDE68A" />
      </Group>
      <Path path={CLOUD_LOW} color="#F0F9FF" />
      <Path path="M37 60 Q42 54 47 60" style="stroke" strokeWidth={3} strokeCap="round" color={INK} />
      <Path path="M55 60 Q60 54 65 60" style="stroke" strokeWidth={3} strokeCap="round" color={INK} />
      <Path path="M45 67 Q51 73 57 67" color={INK} />
    </Group>
  );
}

// Resting day · a quiet grey cloud under a crescent moon. Static in the mockup.
function Resting({ mini }: MoodLayerProps) {
  return (
    <Group transform={mini ? MINI_FIT : undefined} origin={MINI_FIT_ORIGIN}>
      <Path path={CLOUD_LOW} color="#94A3B8" />
      <Path path="M37 60 Q42 63 47 60" style="stroke" strokeWidth={2.5} strokeCap="round" color="#1E293B" />
      <Path path="M55 60 Q60 63 65 60" style="stroke" strokeWidth={2.5} strokeCap="round" color="#1E293B" />
      <Group clip={MOON_BITE} invertClip>
        <Circle cx={80} cy={22} r={7} color="#C7D2FE" />
      </Group>
    </Group>
  );
}

const LAYERS = { idle: Idle, thinking: Thinking, answering: Answering, resting: Resting };

export function NimbusArt({ mood, mini, paused }: CharacterArtProps): React.ReactElement {
  return <MoodLayers mood={mood} mini={mini} paused={paused} layers={LAYERS} />;
}
