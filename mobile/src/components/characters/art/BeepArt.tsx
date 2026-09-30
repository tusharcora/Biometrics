import React from 'react';
import { Circle, Group, Path, RoundedRect, vec } from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import { kf, MoodLayers, useLoop, type MoodLayerProps } from '../engine';
import type { CharacterArtProps } from '../types';

// Beep, the soft robot. Ported from docs/design/companions/BuddyBeep.dc.html
// (100×100 viewBox; shapes, colours and keyframes copied unchanged).

const STEM = 'M50 26 V14';
const SHELL = '#E2E8F0';
const VISOR = '#0F172A';
const EYE = '#5EEAD4';
const EAR = '#94A3B8';

// bp-bulb: 0%,100% opacity .6, 50% opacity 1 (2.6s idle, .5s while thinking).
function useBulb(durationMs: number, paused: boolean) {
  const t = useLoop(durationMs, paused);
  return useDerivedValue(() => kf(t.value, [0, 0.5, 1], [0.6, 1, 0.6]));
}

// The side "ears" from the large mockup render. The small mood cells omit them; they are kept
// on every full-size mood so the silhouette doesn't change on a mood cross-fade.
function Ears({ color = EAR }: { color?: string }) {
  return (
    <>
      <RoundedRect x={10} y={48} width={6} height={16} r={3} color={color} />
      <RoundedRect x={84} y={48} width={6} height={16} r={3} color={color} />
    </>
  );
}

// bp-blink: 4s, 0%,45%,49%,100% scaleY(1), 47% scaleY(.15); fill-box centre = the eye centre.
function BlinkEye({ t, x, y, w, h }: { t: SharedValue<number>; x: number; y: number; w: number; h: number }) {
  const transform = useDerivedValue(() => [{ scaleY: kf(t.value, [0, 0.45, 0.47, 0.49, 1], [1, 1, 0.15, 1, 1]) }]);
  return (
    <Group transform={transform} origin={vec(x + w / 2, y + h / 2)}>
      <RoundedRect x={x} y={y} width={w} height={h} r={w / 2} color={EYE} />
    </Group>
  );
}

// Antenna stem, drawn before the bulb (the bulb overlaps its top), then shell and visor.
function Stem({ color = '#64748B' }: { color?: string }) {
  return <Path path={STEM} style="stroke" strokeWidth={3} strokeCap="round" color={color} />;
}

function Head({ shell = SHELL }: { shell?: string }) {
  return (
    <>
      <RoundedRect x={16} y={26} width={68} height={58} r={24} color={shell} />
      <RoundedRect x={24} y={38} width={52} height={30} r={15} color={VISOR} />
    </>
  );
}

// Idle · light glows softly (bp-bulb 2.6s) + blink.
function Idle({ paused, mini }: MoodLayerProps) {
  const bulb = useBulb(2600, paused);
  const blink = useLoop(4000, paused);
  if (mini) {
    return (
      <>
        <Circle cx={50} cy={10} r={7} color="#2DD4BF" opacity={bulb} />
        <RoundedRect x={12} y={22} width={76} height={66} r={28} color={SHELL} />
        <RoundedRect x={22} y={36} width={56} height={34} r={17} color={VISOR} />
        <BlinkEye t={blink} x={32} y={45} w={10} h={16} />
        <BlinkEye t={blink} x={58} y={45} w={10} h={16} />
      </>
    );
  }
  return (
    <>
      <Stem />
      <Circle cx={50} cy={12} r={5} color="#2DD4BF" opacity={bulb} />
      <Head />
      <BlinkEye t={blink} x={34} y={46} w={8} h={12} />
      <BlinkEye t={blink} x={58} y={46} w={8} h={12} />
      <Ears />
    </>
  );
}

// Thinking · scans (bp-scan 1.2s: translateX -7px ↔ 7px), light blinks amber (bp-fast .5s).
function Thinking({ paused, mini }: MoodLayerProps) {
  const bulb = useBulb(500, paused);
  const t = useLoop(1200, paused);
  const scan = useDerivedValue(() => [{ translateX: kf(t.value, [0, 0.5, 1], [-7, 7, -7]) }]);
  return (
    <>
      <Stem />
      <Circle cx={50} cy={12} r={5} color="#FBBF24" opacity={bulb} />
      <Head />
      {!mini && <Ears />}
      <Group transform={scan}>
        <RoundedRect x={36} y={50} width={28} height={5} r={2.5} color={EYE} />
      </Group>
    </>
  );
}

// Answering · green light, smiling eyes, bob (bp-bob .9s: 50% translateY(-4px)).
function Answering({ paused, mini }: MoodLayerProps) {
  const t = useLoop(900, paused);
  const bob = useDerivedValue(() => [{ translateY: kf(t.value, [0, 0.5, 1], [0, -4, 0]) }]);
  return (
    <Group transform={bob}>
      <Stem />
      <Circle cx={50} cy={12} r={6} color="#4ADE80" />
      <Head />
      {!mini && <Ears />}
      <Path path="M32 54 Q38 46 44 54" style="stroke" strokeWidth={4} strokeCap="round" color={EYE} />
      <Path path="M56 54 Q62 46 68 54" style="stroke" strokeWidth={4} strokeCap="round" color={EYE} />
    </Group>
  );
}

// Resting day · low-power mode: grey shell, dim indigo light, flat eyes. Static in the mockup.
function Resting({ mini }: MoodLayerProps) {
  return (
    <>
      <Stem color="#475569" />
      <Circle cx={50} cy={12} r={5} color="#818CF8" opacity={0.7} />
      <Head shell="#94A3B8" />
      {!mini && <Ears color="#64748B" />}
      <Path path="M33 53 H43" style="stroke" strokeWidth={4} strokeCap="round" color="#818CF8" />
      <Path path="M57 53 H67" style="stroke" strokeWidth={4} strokeCap="round" color="#818CF8" />
    </>
  );
}

const LAYERS = { idle: Idle, thinking: Thinking, answering: Answering, resting: Resting };

export function BeepArt({ mood, mini, paused }: CharacterArtProps): React.ReactElement {
  return <MoodLayers mood={mood} mini={mini} paused={paused} layers={LAYERS} />;
}
