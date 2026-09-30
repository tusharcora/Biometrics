import React from 'react';
import { Circle, Group, LinearGradient, Oval, Path, vec } from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import { cubicBezier, kf, MoodLayers, useLoop, type MoodLayerProps } from '../engine';
import type { CharacterArtProps } from '../types';

// Pip, the round buddy with Kirby-style stub arms. Ported from
// docs/design/companions/BuddyPip.dc.html (100×100 viewBox; path data, colours and
// keyframes copied unchanged).

const DEG = Math.PI / 180;

const INK = '#0A0B0E';
const FOOT = '#0F766E';
const ARM_OUTLINE = '#0F766E';
const ARM_LEFT = '#5EEAD4';
const ARM_RIGHT = '#2DD4BF';
const BLUSH = 'rgba(251,113,133,0.45)';
const BLUSH_HAPPY = 'rgba(251,113,133,0.55)';

const SMILE = 'M45 62 Q50 66 55 62';
const HAPPY_EYE_L = 'M35 50 Q40 44 45 50';
const HAPPY_EYE_R = 'M55 50 Q60 44 65 50';
const OPEN_MOUTH = 'M42 61 Q50 69 58 61';
const REST_EYE_L = 'M35 54 H45';
const REST_EYE_R = 'M55 54 H65';
const REST_MOUTH = 'M46 65 Q50 67 54 65';
// The mockup's z's are <text> (Geist, 12px at 76,26 and 9px at 84,16); drawn as strokes
// with the glyph's proportions so no font has to load.
const Z_BIG = 'M76.6 19.9 H81.4 L76.6 25.4 H81.6';
const Z_SMALL = 'M84.45 11.4 H88.05 L84.45 15.55 H88.2';

// Arms pivot at the shoulders (transform-origin 23px 58px / 77px 58px, view-box).
const SHOULDER_L = vec(23, 58);
const SHOULDER_R = vec(77, 58);
// Squash/hop pivot: transform-origin 50px 90px (between the feet).
const GROUND = vec(50, 90);

// Mini (tab-bar pill) is drawn in a 110×100 viewBox; fit its width to the 100 square
// and centre it vertically.
const MINI_FIT = [{ translateY: 50 / 11 }, { scale: 10 / 11 }];
const MINI_GROUND = vec(55, 92);
// Mini moods other than idle aren't in the mockup; they reuse the full moods' faces
// scaled to the mini's eyes (6×8 at 44/66, 50).
const MINI_HAPPY_EYE_L = 'M37.5 51 Q44 43 50.5 51';
const MINI_HAPPY_EYE_R = 'M59.5 51 Q66 43 72.5 51';
const MINI_REST_EYE_L = 'M38 53 H50';
const MINI_REST_EYE_R = 'M60 53 H72';

// url(#pp-body): diagonal #99F6E4 → #14B8A6 over the body circle's bounding box.
function Body({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <Circle cx={cx} cy={cy} r={r}>
      <LinearGradient start={vec(cx - r, cy - r)} end={vec(cx + r, cy + r)} colors={['#99F6E4', '#14B8A6']} />
    </Circle>
  );
}

function Feet({ color = FOOT }: { color?: string }) {
  return (
    <>
      <Oval x={30} y={84} width={16} height={8} color={color} />
      <Oval x={54} y={84} width={16} height={8} color={color} />
    </>
  );
}

// A stub arm: ellipse rx×ry at cx,cy rotated by `angle` degrees about its centre.
function Arm({ cx, cy, rx, ry, angle, color, outline }: { cx: number; cy: number; rx: number; ry: number; angle: number; color: string; outline?: boolean }) {
  return (
    <Group transform={[{ rotate: angle * DEG }]} origin={vec(cx, cy)}>
      <Oval x={cx - rx} y={cy - ry} width={rx * 2} height={ry * 2} color={color} />
      {outline ? (
        <Oval x={cx - rx} y={cy - ry} width={rx * 2} height={ry * 2} color={ARM_OUTLINE} style="stroke" strokeWidth={1} />
      ) : null}
    </Group>
  );
}

const LeftArm = () => <Arm cx={15} cy={64} rx={9} ry={6.5} angle={35} color={ARM_LEFT} outline />;
const RightArm = () => <Arm cx={85} cy={64} rx={9} ry={6.5} angle={-35} color={ARM_RIGHT} outline />;

// An arm swinging about its shoulder by `degrees(t)`.
function SwingingArm({ t, stops, values, pivot, children }: { t: SharedValue<number>; stops: number[]; values: number[]; pivot: ReturnType<typeof vec>; children: React.ReactNode }) {
  const transform = useDerivedValue(() => [{ rotate: kf(t.value, stops, values) * DEG }]);
  return (
    <Group transform={transform} origin={pivot}>
      {children}
    </Group>
  );
}

// pp-blink: 4s, 0%,45%,49%,100% scaleY(1), 47% scaleY(.1); fill-box centre = the eye centre.
function BlinkingEye({ t, cx, cy, rx, ry }: { t: SharedValue<number>; cx: number; cy: number; rx: number; ry: number }) {
  const transform = useDerivedValue(() => [{ scaleY: kf(t.value, [0, 0.45, 0.47, 0.49, 1], [1, 1, 0.1, 1, 1]) }]);
  return (
    <Group transform={transform} origin={vec(cx, cy)}>
      <Oval x={cx - rx} y={cy - ry} width={rx * 2} height={ry * 2} color={INK} />
    </Group>
  );
}

// pp-idle: 3.2s, 50% scale(1.02, .98) about the ground point.
function useIdleSquash(t: SharedValue<number>) {
  return useDerivedValue(() => [
    { scaleX: kf(t.value, [0, 0.5, 1], [1, 1.02, 1]) },
    { scaleY: kf(t.value, [0, 0.5, 1], [1, 0.98, 1]) },
  ]);
}

// pp-look: 1.8s, 35% translate(-4px,-4px), 70% translate(4px,-4px).
function useLookAround(paused: boolean) {
  const t = useLoop(1800, paused);
  return useDerivedValue(() => [
    { translateX: kf(t.value, [0, 0.35, 0.7, 1], [0, -4, 4, 0]) },
    { translateY: kf(t.value, [0, 0.35, 0.7, 1], [0, -4, -4, 0]) },
  ]);
}

// pp-hop: .9s cubic-bezier(.3,0,.3,1); 0%,100% translateY(0) scale(1.03,.97),
// 45% translateY(-6px) scale(.98,1.02).
function useHop(paused: boolean) {
  const t = useLoop(900, paused);
  return useDerivedValue(() => {
    const up = t.value < 0.45;
    const u = up ? t.value / 0.45 : (t.value - 0.45) / 0.55;
    const e = cubicBezier(0.3, 0, 0.3, 1, u);
    const m = up ? e : 1 - e;
    return [{ translateY: -6 * m }, { scaleX: 1.03 - 0.05 * m }, { scaleY: 0.97 + 0.05 * m }];
  });
}

// Idle · breathes (pp-idle 3.2s), blinks (pp-blink 4s), left arm sways (pp-sway-l 3.2s,
// 50% rotate(8deg)), right arm waves hello (pp-wave 3.6s).
function Idle({ paused, mini }: MoodLayerProps) {
  return mini ? <IdleMini paused={paused} /> : <IdleFull paused={paused} />;
}

function IdleFull({ paused }: { paused: boolean }) {
  const t = useLoop(3200, paused);
  const wave = useLoop(3600, paused);
  const blink = useLoop(4000, paused);
  const squash = useIdleSquash(t);
  return (
    <Group transform={squash} origin={GROUND}>
      <Feet />
      <Body cx={50} cy={54} r={34} />
      <SwingingArm t={t} stops={[0, 0.5, 1]} values={[0, 8, 0]} pivot={SHOULDER_L}>
        <LeftArm />
      </SwingingArm>
      <SwingingArm
        t={wave}
        stops={[0, 0.55, 0.62, 0.68, 0.74, 0.8, 0.88, 1]}
        values={[0, 0, -85, -62, -85, -62, 0, 0]}
        pivot={SHOULDER_R}
      >
        <RightArm />
      </SwingingArm>
      <BlinkingEye t={blink} cx={40} cy={50} rx={4.5} ry={6.5} />
      <BlinkingEye t={blink} cx={60} cy={50} rx={4.5} ry={6.5} />
      <Oval x={27} y={59} width={10} height={6} color={BLUSH} />
      <Oval x={63} y={59} width={10} height={6} color={BLUSH} />
      <Path path={SMILE} style="stroke" strokeWidth={2.5} strokeCap="round" color={INK} />
    </Group>
  );
}

// The pill's mini is still in the mockup; it gets idle's breathing and blink so the
// tab bar stays alive.
function IdleMini({ paused }: { paused: boolean }) {
  const t = useLoop(3200, paused);
  const blink = useLoop(4000, paused);
  const squash = useIdleSquash(t);
  return (
    <Group transform={MINI_FIT}>
      <Group transform={squash} origin={MINI_GROUND}>
        <MiniArms />
        <Body cx={55} cy={54} r={38} />
        <BlinkingEye t={blink} cx={44} cy={50} rx={6} ry={8} />
        <BlinkingEye t={blink} cx={66} cy={50} rx={6} ry={8} />
      </Group>
    </Group>
  );
}

function MiniArms({ color }: { color?: string }) {
  return (
    <>
      <Arm cx={17} cy={66} rx={11} ry={8} angle={35} color={color ?? ARM_LEFT} />
      <Arm cx={93} cy={66} rx={11} ry={8} angle={-35} color={color ?? ARM_RIGHT} />
    </>
  );
}

// Thinking · left arm scratches the head (pp-scratch .6s, 110°↔126°), eyes look around
// (pp-look 1.8s), small "ooh" mouth.
function Thinking({ paused, mini }: MoodLayerProps) {
  const scratch = useLoop(600, paused);
  const look = useLookAround(paused);
  if (mini) {
    return (
      <Group transform={MINI_FIT}>
        <MiniArms />
        <Body cx={55} cy={54} r={38} />
        <Group transform={look}>
          <Oval x={38} y={42} width={12} height={16} color={INK} />
          <Oval x={60} y={42} width={12} height={16} color={INK} />
        </Group>
      </Group>
    );
  }
  return (
    <>
      <Feet />
      <Body cx={50} cy={54} r={34} />
      <RightArm />
      <SwingingArm t={scratch} stops={[0, 0.5, 1]} values={[110, 126, 110]} pivot={SHOULDER_L}>
        <LeftArm />
      </SwingingArm>
      <Group transform={look}>
        <Oval x={35.5} y={41.5} width={9} height={13} color={INK} />
        <Oval x={55.5} y={41.5} width={9} height={13} color={INK} />
      </Group>
      <Circle cx={50} cy={64} r={2.5} color={INK} />
    </>
  );
}

// Answering · both arms up cheering (pp-cheer-l/r .45s, ±72°↔±90°), happy hop (pp-hop .9s).
function Answering({ paused, mini }: MoodLayerProps) {
  const cheer = useLoop(450, paused);
  const hop = useHop(paused);
  if (mini) {
    return (
      <Group transform={MINI_FIT}>
        <Group transform={hop} origin={MINI_GROUND}>
          <MiniArms />
          <Body cx={55} cy={54} r={38} />
          <Path path={MINI_HAPPY_EYE_L} style="stroke" strokeWidth={4} strokeCap="round" color={INK} />
          <Path path={MINI_HAPPY_EYE_R} style="stroke" strokeWidth={4} strokeCap="round" color={INK} />
        </Group>
      </Group>
    );
  }
  return (
    <Group transform={hop} origin={GROUND}>
      <Feet />
      <Body cx={50} cy={54} r={34} />
      <SwingingArm t={cheer} stops={[0, 0.5, 1]} values={[72, 90, 72]} pivot={SHOULDER_L}>
        <LeftArm />
      </SwingingArm>
      <SwingingArm t={cheer} stops={[0, 0.5, 1]} values={[-72, -90, -72]} pivot={SHOULDER_R}>
        <RightArm />
      </SwingingArm>
      <Path path={HAPPY_EYE_L} style="stroke" strokeWidth={3} strokeCap="round" color={INK} />
      <Path path={HAPPY_EYE_R} style="stroke" strokeWidth={3} strokeCap="round" color={INK} />
      <Path path={OPEN_MOUTH} color={INK} />
      <Oval x={27} y={57} width={10} height={6} color={BLUSH_HAPPY} />
      <Oval x={63} y={57} width={10} height={6} color={BLUSH_HAPPY} />
    </Group>
  );
}

// Resting · arms tucked, muted colours, eyes closed, z's. Still in the mockup.
function Resting({ mini }: MoodLayerProps) {
  if (mini) {
    return (
      <Group transform={MINI_FIT}>
        <MiniArms color="#4E9A8F" />
        <Circle cx={55} cy={54} r={38} color="#5EAFA3" />
        <Path path={MINI_REST_EYE_L} style="stroke" strokeWidth={4} strokeCap="round" color={INK} />
        <Path path={MINI_REST_EYE_R} style="stroke" strokeWidth={4} strokeCap="round" color={INK} />
      </Group>
    );
  }
  return (
    <>
      <Feet color="#115E59" />
      <Arm cx={20} cy={74} rx={8.5} ry={6} angle={60} color="#4E9A8F" />
      <Arm cx={80} cy={74} rx={8.5} ry={6} angle={-60} color="#4E9A8F" />
      <Circle cx={50} cy={56} r={33} color="#5EAFA3" />
      <Path path={REST_EYE_L} style="stroke" strokeWidth={3} strokeCap="round" color={INK} />
      <Path path={REST_EYE_R} style="stroke" strokeWidth={3} strokeCap="round" color={INK} />
      <Path path={REST_MOUTH} style="stroke" strokeWidth={2.5} strokeCap="round" color={INK} />
      <Path path={Z_BIG} style="stroke" strokeWidth={1.1} strokeCap="round" strokeJoin="round" color="#A5B4FC" />
      <Path path={Z_SMALL} style="stroke" strokeWidth={0.85} strokeCap="round" strokeJoin="round" color="#A5B4FC" />
    </>
  );
}

const LAYERS = { idle: Idle, thinking: Thinking, answering: Answering, resting: Resting };

export function PipArt({ mood, mini, paused }: CharacterArtProps): React.ReactElement {
  return <MoodLayers mood={mood} mini={mini} paused={paused} layers={LAYERS} />;
}
