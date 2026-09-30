import React from 'react';
import { Group, LinearGradient, Oval, Path, vec } from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import { cubicBezier, kf, MoodLayers, useLoop, type MoodLayerProps } from '../engine';
import type { CharacterArtProps } from '../types';

// Mochi, the squishy rice cake. Ported from docs/design/companions/BuddyMochi.dc.html
// (100×100 viewBox; path data, colours and keyframes copied unchanged).

const INK = '#3F2A35';
const BLUSH = 'rgba(244,114,182,0.45)';
const BLUSH_HAPPY = 'rgba(244,114,182,0.6)';
const BODY_TOP = '#FFF1F5';
const BODY_BOTTOM = '#FBCFE8';

const BODY = 'M14 70 C14 42 30 26 50 26 C70 26 86 42 86 70 C86 82 76 86 50 86 C24 86 14 82 14 70 Z';
const MINI_BODY = 'M10 72 C10 40 28 22 50 22 C72 22 90 40 90 72 C90 86 78 90 50 90 C22 90 10 86 10 72 Z';
const RESTING_BODY = 'M12 74 C12 50 28 36 50 36 C72 36 88 50 88 74 C88 84 76 88 50 88 C24 88 12 84 12 74 Z';

// transform-origin: 50px 86px (view-box) — the bottom of the body; the mini body sits on y=90.
const PIVOT = vec(50, 86);
const MINI_PIVOT = vec(50, 90);
// Mini variant of the non-idle moods: the full art scaled up to fill the square like the pill.
const MINI_FIT = [{ scale: 10 / 9 }];
const MINI_FIT_ORIGIN = vec(50, 56);

// url(#mc-body): vertical gradient over the body's bounding box.
function BodyGradient({ top, bottom }: { top: number; bottom: number }) {
  return <LinearGradient start={vec(0, top)} end={vec(0, bottom)} colors={[BODY_TOP, BODY_BOTTOM]} />;
}

// mc-blink: 5s, 0%,46%,50%,100% scaleY(1), 48% scaleY(.1); fill-box centre = the eye centre.
function BlinkEye({ t, cx, cy, rx, ry }: { t: SharedValue<number>; cx: number; cy: number; rx: number; ry: number }) {
  const transform = useDerivedValue(() => [{ scaleY: kf(t.value, [0, 0.46, 0.48, 0.5, 1], [1, 1, 0.1, 1, 1]) }]);
  return (
    <Group transform={transform} origin={vec(cx, cy)}>
      <Oval x={cx - rx} y={cy - ry} width={rx * 2} height={ry * 2} color={INK} />
    </Group>
  );
}

// Idle · slow squish (mc-squish 3.6s ease-in-out: 50% scale(1.04,.95)) + blink.
function Idle({ paused, mini }: MoodLayerProps) {
  const t = useLoop(3600, paused);
  const blink = useLoop(5000, paused);
  const squish = useDerivedValue(() => [
    { scaleX: kf(t.value, [0, 0.5, 1], [1, 1.04, 1]) },
    { scaleY: kf(t.value, [0, 0.5, 1], [1, 0.95, 1]) },
  ]);
  if (mini) {
    return (
      <Group transform={squish} origin={MINI_PIVOT}>
        <Path path={MINI_BODY}>
          <BodyGradient top={22} bottom={90} />
        </Path>
        <BlinkEye t={blink} cx={38} cy={60} rx={5} ry={6} />
        <BlinkEye t={blink} cx={62} cy={60} rx={5} ry={6} />
      </Group>
    );
  }
  return (
    <>
      <Oval x={16} y={84} width={68} height={8} color="rgba(0,0,0,0.35)" />
      <Group transform={squish} origin={PIVOT}>
        <Path path={BODY}>
          <BodyGradient top={26} bottom={86} />
        </Path>
        <BlinkEye t={blink} cx={40} cy={58} rx={3.5} ry={4.5} />
        <BlinkEye t={blink} cx={60} cy={58} rx={3.5} ry={4.5} />
        <Oval x={25} y={62.5} width={12} height={7} color={BLUSH} />
        <Oval x={63} y={62.5} width={12} height={7} color={BLUSH} />
        <Path
          path="M46 66 Q48 68 50 66 Q52 68 54 66"
          style="stroke"
          strokeWidth={2}
          strokeCap="round"
          color={INK}
        />
      </Group>
    </>
  );
}

// Thinking · wobbles (mc-think 1.2s ease-in-out: 30% scale(.97,1.04) rotate(-3deg), 70% … rotate(3deg)).
function Thinking({ paused, mini }: MoodLayerProps) {
  const t = useLoop(1200, paused);
  const wobble = useDerivedValue(() => {
    const stops = [0, 0.3, 0.7, 1];
    return [
      { scaleX: kf(t.value, stops, [1, 0.97, 0.97, 1]) },
      { scaleY: kf(t.value, stops, [1, 1.04, 1.04, 1]) },
      { rotate: (kf(t.value, stops, [0, -3, 3, 0]) * Math.PI) / 180 },
    ];
  });
  return (
    <Group transform={mini ? MINI_FIT : undefined} origin={MINI_FIT_ORIGIN}>
      <Group transform={wobble} origin={PIVOT}>
        <Path path={BODY}>
          <BodyGradient top={26} bottom={86} />
        </Path>
        <Oval x={38.5} y={49.5} width={7} height={9} color={INK} />
        <Oval x={58.5} y={49.5} width={7} height={9} color={INK} />
        <Path path="M47 67 H55" style="stroke" strokeWidth={2} strokeCap="round" color={INK} />
      </Group>
    </Group>
  );
}

// mc-bounce's timing function, cubic-bezier(.3,0,.3,1), over its two segments (0→50%→100%).
function bounce(t: number, rest: number, peak: number): number {
  'worklet';
  if (t < 0.5) return rest + (peak - rest) * cubicBezier(0.3, 0, 0.3, 1, t / 0.5);
  return peak + (rest - peak) * cubicBezier(0.3, 0, 0.3, 1, (t - 0.5) / 0.5);
}

// Answering · happy squish (mc-bounce .8s: 0%/100% scale(1.08,.9), 50% scale(.95,1.07) translateY(-4px)).
function Answering({ paused, mini }: MoodLayerProps) {
  const t = useLoop(800, paused);
  const squash = useDerivedValue(() => [
    { scaleX: bounce(t.value, 1.08, 0.95) },
    { scaleY: bounce(t.value, 0.9, 1.07) },
    { translateY: bounce(t.value, 0, -4) },
  ]);
  return (
    <Group transform={mini ? MINI_FIT : undefined} origin={MINI_FIT_ORIGIN}>
      <Group transform={squash} origin={PIVOT}>
        <Path path={BODY}>
          <BodyGradient top={26} bottom={86} />
        </Path>
        <Path path="M35 58 Q40 52 45 58" style="stroke" strokeWidth={3} strokeCap="round" color={INK} />
        <Path path="M55 58 Q60 52 65 58" style="stroke" strokeWidth={3} strokeCap="round" color={INK} />
        <Path path="M44 66 Q50 72 56 66" color={INK} />
        <Oval x={24} y={62.5} width={12} height={7} color={BLUSH_HAPPY} />
        <Oval x={64} y={62.5} width={12} height={7} color={BLUSH_HAPPY} />
      </Group>
    </Group>
  );
}

// Resting day · under a blanket. Static in the mockup.
function Resting({ mini }: MoodLayerProps) {
  return (
    <Group transform={mini ? MINI_FIT : undefined} origin={MINI_FIT_ORIGIN}>
      <Path path={RESTING_BODY} color="#E7C6D6" />
      <Path path="M36 64 Q40 67 44 64" style="stroke" strokeWidth={2.5} strokeCap="round" color={INK} />
      <Path path="M56 64 Q60 67 64 64" style="stroke" strokeWidth={2.5} strokeCap="round" color={INK} />
      <Path path="M20 36 Q50 22 80 36 L78 40 Q50 30 22 40 Z" color="#A5B4FC" />
    </Group>
  );
}

const LAYERS = { idle: Idle, thinking: Thinking, answering: Answering, resting: Resting };

export function MochiArt({ mood, mini, paused }: CharacterArtProps): React.ReactElement {
  return <MoodLayers mood={mood} mini={mini} paused={paused} layers={LAYERS} />;
}
