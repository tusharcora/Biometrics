import React from 'react';
import { Circle, Group, LinearGradient, Oval, Path, RadialGradient, rect, rrect, vec } from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import { kf, MoodLayers, phase, useLoop, type MoodLayerProps } from '../engine';
import type { CharacterArtProps } from '../types';

// Hoot, the owl on a branch. Ported from docs/design/companions/BuddyHoot.dc.html
// (100×100 viewBox; path data, colours and keyframes copied unchanged).

const DEG = Math.PI / 180;

const INK = '#1E1B4B';
const AMBER = '#F59E0B';
const FACE_COLOR = '#E0E7FF';
const WING_COLOR = '#3730A3';
const BRANCH_COLOR = '#5B3A1E';

const BODY =
  'M26 10 L38 21 Q50 17 62 21 L74 10 Q79 22 76 32 Q82 48 78 62 Q74 80 50 84 Q26 80 22 62 Q18 48 24 32 Q21 22 26 10 Z';
const CHEST =
  'M43 60 l3 2.5 l3 -2.5 M51 60 l3 2.5 l3 -2.5 M47 67 l3 2.5 l3 -2.5 M43 74 l3 2.5 l3 -2.5 M51 74 l3 2.5 l3 -2.5';
const WING_L = 'M25 38 Q15 58 27 80 Q32 64 31 46 Z';
const WING_R = 'M75 38 Q85 58 73 80 Q68 64 69 46 Z';
const WING_LINE_L = 'M24 54 Q23 64 26 72';
const WING_LINE_R = 'M76 54 Q77 64 74 72';
const FACE = 'M50 31 Q41 22 32 27 Q23 34 28 45 Q36 54 50 50 Q64 54 72 45 Q77 34 68 27 Q59 22 50 31 Z';
const BEAK = 'M46.5 44 L53.5 44 L50 51 Z';
const FEET = 'M43 82 v4.5 M40.5 82 l-2 4 M45.5 82 l2 4 M57 82 v4.5 M54.5 82 l-2 4 M59.5 82 l2 4';
// The thinking and answering cards draw slightly shorter toes.
const FEET_SHORT = 'M43 82 v4 M40.5 82 l-2 3.5 M45.5 82 l2 3.5 M57 82 v4 M54.5 82 l-2 3.5 M59.5 82 l2 3.5';
const BRANCH = 'M2 88 Q50 83 98 90';
const TWIG = 'M80 88 Q85 81 93 80';

// Thinking: back of the head and the two side profiles.
const BACK_FEATHERS =
  'M42 31 l4 3 l4 -3 l4 3 l4 -3 M40 38 l5 3.5 l5 -3.5 l5 3.5 l5 -3.5 M44 45 l3 2.5 l3 -2.5 l3 2.5 l3 -2.5';
const BEAK_RIGHT = 'M72 40 L79 43.5 L72 47 Z';
const BEAK_LEFT = 'M28 40 L21 43.5 L28 47 Z';

// Answering: happy squint, open beak, cheeks.
const HAPPY_EYE_L = 'M34 40 Q40 32 46 40';
const HAPPY_EYE_R = 'M54 40 Q60 32 66 40';
const BEAK_UPPER = 'M46.5 44 L53.5 44 L50 48.5 Z';
const BEAK_LOWER = 'M47.5 49 L52.5 49 L50 52 Z';
const CHEEK = 'rgba(244,114,182,0.5)';

// Resting: fluffed-up body (flattened tufts), muted palette, eyes closed.
const REST_BODY =
  'M22 24 L38 26 Q50 23 62 26 L78 24 Q80 32 76 38 Q82 52 78 66 Q74 84 50 88 Q26 84 22 66 Q18 52 24 38 Q20 32 22 24 Z';
const REST_WING_L = 'M25 42 Q15 62 27 84 Q32 68 31 50 Z';
const REST_WING_R = 'M75 42 Q85 62 73 84 Q68 68 69 50 Z';
const REST_FACE = 'M50 35 Q41 26 32 31 Q23 38 28 49 Q36 58 50 54 Q64 58 72 49 Q77 38 68 31 Q59 26 50 35 Z';
const REST_EYE_L = 'M34 42 Q40 46 46 42';
const REST_EYE_R = 'M54 42 Q60 46 66 42';
const REST_BEAK = 'M47 48 L53 48 L50 53 Z';
// The mockup's z's are <text> (Geist, 12px and 9px at x=78 y=20); drawn as strokes
// with the glyph's proportions so no font has to load.
const Z_BIG = 'M78.6 13.9 H83.4 L78.6 19.4 H83.6';
const Z_SMALL = 'M78.45 15.4 H82.05 L78.45 19.55 H82.2';
const Z_COLOR = '#A5B4FC';

// Mini (tab-bar pill): a bigger head with no branch, feet or wings.
const MINI_BODY =
  'M20 4 L36 18 Q50 13 64 18 L80 4 Q86 20 82 32 Q90 50 84 66 Q78 88 50 92 Q22 88 16 66 Q10 50 18 32 Q14 20 20 4 Z';
const MINI_FACE = 'M50 30 Q40 18 28 24 Q18 34 24 48 Q34 58 50 53 Q66 58 76 48 Q82 34 72 24 Q60 18 50 30 Z';
const MINI_BEAK = 'M45 46 L55 46 L50 55 Z';
// Mini moods other than idle aren't in the mockup; they reuse the full moods'
// features scaled to the mini's eyes (r 9 instead of 7, centres 38/62).
const MINI_HAPPY_EYE_L = 'M30 41 Q38 31 46 41';
const MINI_HAPPY_EYE_R = 'M54 41 Q62 31 70 41';
const MINI_REST_EYE_L = 'M30 40 Q38 45 46 40';
const MINI_REST_EYE_R = 'M54 40 Q62 45 70 40';
const MINI_SCALE = 1.2;

const HEAD_PIVOT = vec(50, 38);
// clipPath #ho-head-clip: ellipse cx 50 cy 38 rx 27 ry 19.
const headClip = (k: number) => rrect(rect(50 - 27 * k, 38 - 19 * k, 54 * k, 38 * k), 27 * k, 19 * k);
const HEAD_CLIP = headClip(1);
const MINI_HEAD_CLIP = headClip(MINI_SCALE);

// url(#ho-body): vertical, #818CF8 → #6366F1 (55%) → #3730A3 over the body's bounding box.
function BodyGradient({ top, bottom }: { top: number; bottom: number }) {
  return (
    <LinearGradient
      start={vec(0, top)}
      end={vec(0, bottom)}
      colors={['#818CF8', '#6366F1', '#3730A3']}
      positions={[0, 0.55, 1]}
    />
  );
}

// One amber eye (url(#ho-iris): radial #FDE68A → #F59E0B over the iris circle).
function Eye({ cx, cy, r, iris, pupil, glint }: { cx: number; cy: number; r: number; iris: number; pupil: number; glint?: boolean }) {
  return (
    <>
      <Circle cx={cx} cy={cy} r={r} color={INK} />
      <Circle cx={cx} cy={cy} r={iris}>
        <RadialGradient c={vec(cx, cy)} r={iris} colors={['#FDE68A', AMBER]} />
      </Circle>
      <Circle cx={cx} cy={cy} r={pupil} color={INK} />
      {glint ? <Circle cx={cx + 1.4} cy={cy - 1.5} r={1.1} color="#FFFFFF" /> : null}
    </>
  );
}

// ho-blink: 5s, 0%,46%,52%,100% scaleY(1), 49% scaleY(.08); fill-box centre = the eye centre.
function BlinkingEye({ t, cx, cy, r, iris, pupil, glint }: { t: SharedValue<number>; cx: number; cy: number; r: number; iris: number; pupil: number; glint?: boolean }) {
  const transform = useDerivedValue(() => [{ scaleY: kf(t.value, [0, 0.46, 0.49, 0.52, 1], [1, 1, 0.08, 1, 1]) }]);
  return (
    <Group transform={transform} origin={vec(cx, cy)}>
      <Eye cx={cx} cy={cy} r={r} iris={iris} pupil={pupil} glint={glint} />
    </Group>
  );
}

function Feet({ path }: { path: string }) {
  return <Path path={path} style="stroke" strokeWidth={1.7} strokeCap="round" color={AMBER} />;
}

function Chest() {
  return <Path path={CHEST} style="stroke" strokeWidth={1.4} strokeCap="round" strokeJoin="round" color="#C7D2FE" />;
}

// ho-leaf: 2.8s, 50% rotate(-12deg) about the leaf's left-centre. The CSS transform
// replaces the ellipse's transform="rotate(...)" attribute, so the mockup draws the
// leaves level; this ports what the mockup renders.
function Leaf({ t, cx, cy, rx, ry, color }: { t: SharedValue<number>; cx: number; cy: number; rx: number; ry: number; color: string }) {
  const transform = useDerivedValue(() => [{ rotate: kf(t.value, [0, 0.5, 1], [0, -12, 0]) * DEG }]);
  return (
    <Group transform={transform} origin={vec(cx - rx, cy)}>
      <Oval x={cx - rx} y={cy - ry} width={rx * 2} height={ry * 2} color={color} />
    </Group>
  );
}

// Idle · perched on the branch: breathes (ho-breathe 3.6s), glances (ho-look 7s),
// blinks (ho-blink 5s); leaves sway (ho-leaf 2.8s).
function Idle({ paused, mini }: MoodLayerProps) {
  return mini ? <IdleMini paused={paused} /> : <IdleFull paused={paused} />;
}

function useBreathe(paused: boolean) {
  const t = useLoop(3600, paused);
  return useDerivedValue(() => [
    { scaleX: kf(t.value, [0, 0.5, 1], [1, 1.015, 1]) },
    { scaleY: kf(t.value, [0, 0.5, 1], [1, 1.025, 1]) },
  ]);
}

function useLook(paused: boolean) {
  const t = useLoop(7000, paused);
  return useDerivedValue(() => [
    { translateX: kf(t.value, [0, 0.2, 0.28, 0.45, 0.53, 0.7, 0.78, 1], [0, 0, -2.6, -2.6, 2.6, 2.6, 0, 0]) },
  ]);
}

function IdleFull({ paused }: { paused: boolean }) {
  const breathe = useBreathe(paused);
  const look = useLook(paused);
  const blink = useLoop(5000, paused);
  const leaf = useLoop(2800, paused);
  return (
    <>
      <Path path={BRANCH} style="stroke" strokeWidth={5} strokeCap="round" color={BRANCH_COLOR} />
      <Path path={TWIG} style="stroke" strokeWidth={2.6} strokeCap="round" color={BRANCH_COLOR} />
      <Leaf t={leaf} cx={95} cy={78} rx={5} ry={2.4} color="#65A30D" />
      <Leaf t={leaf} cx={12} cy={84} rx={5} ry={2.3} color="#4D7C0F" />
      <Group transform={breathe} origin={vec(50, 84)}>
        <Path path={BODY}>
          <BodyGradient top={10} bottom={84} />
        </Path>
        <Oval x={35} y={51} width={30} height={30} color="#818CF8" opacity={0.55} />
        <Chest />
        <Path path={WING_L} color={WING_COLOR} />
        <Path path={WING_LINE_L} style="stroke" strokeWidth={1.2} strokeCap="round" color="#6366F1" />
        <Path path={WING_R} color={WING_COLOR} />
        <Path path={WING_LINE_R} style="stroke" strokeWidth={1.2} strokeCap="round" color="#6366F1" />
        <Group transform={look}>
          <Path path={FACE} color={FACE_COLOR} />
          <BlinkingEye t={blink} cx={40} cy={38} r={7} iris={5.2} pupil={2.8} glint />
          <BlinkingEye t={blink} cx={60} cy={38} r={7} iris={5.2} pupil={2.8} glint />
          <Path path={BEAK} color={AMBER} />
        </Group>
      </Group>
      <Feet path={FEET} />
    </>
  );
}

function IdleMini({ paused }: { paused: boolean }) {
  const breathe = useBreathe(paused);
  const look = useLook(paused);
  const blink = useLoop(5000, paused);
  return (
    <Group transform={breathe} origin={vec(50, 92)}>
      <Path path={MINI_BODY}>
        <BodyGradient top={4} bottom={92} />
      </Path>
      <Group transform={look}>
        <Path path={MINI_FACE} color={FACE_COLOR} />
        <BlinkingEye t={blink} cx={38} cy={38} r={9} iris={6.5} pupil={3.4} />
        <BlinkingEye t={blink} cx={62} cy={38} r={9} iris={6.5} pupil={3.4} />
        <Path path={MINI_BEAK} color={AMBER} />
      </Group>
    </Group>
  );
}

// ho-sw-*: one head angle φ (deg) over 6.4s, linear loop. Swivel right 0→180 (6–24%),
// hold, back 180→0 (34–48%), hold, left 0→-180 (54–72%), hold, back (82–96%), hold.
// Each move eases (1 − cos πu)/2. The mockup's 201 precomputed keyframes per layer
// match this to within 0.005.
const SWIVEL: readonly (readonly [number, number, number, number])[] = [
  [0, 0.06, 0, 0],
  [0.06, 0.24, 0, 180],
  [0.24, 0.34, 180, 180],
  [0.34, 0.48, 180, 0],
  [0.48, 0.54, 0, 0],
  [0.54, 0.72, 0, -180],
  [0.72, 0.82, -180, -180],
  [0.82, 0.96, -180, 0],
  [0.96, 1, 0, 0],
];

function swivelAngle(t: number): number {
  'worklet';
  for (let i = 0; i < SWIVEL.length; i++) {
    const [start, end, from, to] = SWIVEL[i]!;
    if (t <= end) {
      const u = (t - start) / (end - start);
      return from + (to - from) * ((1 - Math.cos(Math.PI * u)) / 2);
    }
  }
  return 0;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  'worklet';
  const u = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return u * u * (3 - 2 * u);
}

// The head drawn as one turning disc: the front face slides/narrows (translateX 17·sinφ,
// scaleX max(.3, cosφ)) and fades out towards 90°; the side profile (translateX ∓7·cosφ)
// is visible around ±90°; the back of the head (translateX −17·sinφ, scaleX max(.3, −cosφ))
// fades in towards 180°. Opacities (fitted to the mockup's keyframes):
// front smoothstep(.12, .5, cosφ), back smoothstep(.12, .5, −cosφ),
// profile smoothstep(.72, .92, |sinφ|) on the side φ points to.
// k scales the head for the mini variant; front/back are clipped to the head ellipse.
function SwivelHead({ t, k, clip, front }: { t: SharedValue<number>; k: number; clip: ReturnType<typeof headClip>; front: React.ReactNode }) {
  const angle = useDerivedValue(() => swivelAngle(t.value) * DEG);
  const frontTransform = useDerivedValue(() => [
    { translateX: 17 * k * Math.sin(angle.value) },
    { scaleX: Math.max(0.3, Math.cos(angle.value)) },
  ]);
  const frontOpacity = useDerivedValue(() => smoothstep(0.12, 0.5, Math.cos(angle.value)));
  const backTransform = useDerivedValue(() => [
    { translateX: -17 * Math.sin(angle.value) },
    { scaleX: Math.max(0.3, -Math.cos(angle.value)) },
  ]);
  const backOpacity = useDerivedValue(() => smoothstep(0.12, 0.5, -Math.cos(angle.value)));
  const rightTransform = useDerivedValue(() => [{ translateX: -7 * Math.cos(angle.value) }]);
  const rightOpacity = useDerivedValue(() => (angle.value > 0 ? smoothstep(0.72, 0.92, Math.sin(angle.value)) : 0));
  const leftTransform = useDerivedValue(() => [{ translateX: 7 * Math.cos(angle.value) }]);
  const leftOpacity = useDerivedValue(() => (angle.value < 0 ? smoothstep(0.72, 0.92, -Math.sin(angle.value)) : 0));
  const scale = [{ scale: k }];
  return (
    <>
      <Group clip={clip}>
        <Group transform={scale} origin={HEAD_PIVOT}>
          <Group transform={backTransform} origin={HEAD_PIVOT} opacity={backOpacity}>
            <Oval x={30} y={23} width={40} height={28} color="#4F46E5" opacity={0.55} />
            <Path path={BACK_FEATHERS} style="stroke" strokeWidth={1.4} strokeCap="round" strokeJoin="round" color="#A5B4FC" />
          </Group>
        </Group>
        <Group transform={frontTransform} origin={HEAD_PIVOT} opacity={frontOpacity}>
          {front}
        </Group>
      </Group>
      <Group transform={scale} origin={HEAD_PIVOT}>
        <Group transform={rightTransform} opacity={rightOpacity}>
          <Oval x={51} y={26.5} width={24} height={25} color={FACE_COLOR} />
          <Circle cx={66} cy={36} r={6} color={INK} />
          <Circle cx={66.8} cy={36} r={4.4}>
            <RadialGradient c={vec(66.8, 36)} r={4.4} colors={['#FDE68A', AMBER]} />
          </Circle>
          <Circle cx={67.8} cy={36} r={2.3} color={INK} />
          <Path path={BEAK_RIGHT} color={AMBER} />
        </Group>
        <Group transform={leftTransform} opacity={leftOpacity}>
          <Oval x={25} y={26.5} width={24} height={25} color={FACE_COLOR} />
          <Circle cx={34} cy={36} r={6} color={INK} />
          <Circle cx={33.2} cy={36} r={4.4}>
            <RadialGradient c={vec(33.2, 36)} r={4.4} colors={['#FDE68A', AMBER]} />
          </Circle>
          <Circle cx={32.2} cy={36} r={2.3} color={INK} />
          <Path path={BEAK_LEFT} color={AMBER} />
        </Group>
      </Group>
    </>
  );
}

// Thinking · 180° head swivel right, then left (ho-sw-* 6.4s). No branch, no breathing.
function Thinking({ paused, mini }: MoodLayerProps) {
  const t = useLoop(6400, paused);
  if (mini) {
    return (
      <>
        <Path path={MINI_BODY}>
          <BodyGradient top={4} bottom={92} />
        </Path>
        <SwivelHead
          t={t}
          k={MINI_SCALE}
          clip={MINI_HEAD_CLIP}
          front={
            <>
              <Path path={MINI_FACE} color={FACE_COLOR} />
              <Eye cx={38} cy={38} r={9} iris={6.5} pupil={3.4} />
              <Eye cx={62} cy={38} r={9} iris={6.5} pupil={3.4} />
              <Path path={MINI_BEAK} color={AMBER} />
            </>
          }
        />
      </>
    );
  }
  return (
    <>
      <Path path={BODY}>
        <BodyGradient top={10} bottom={84} />
      </Path>
      <Oval x={35} y={51} width={30} height={30} color="#818CF8" opacity={0.55} />
      <Chest />
      <Path path={WING_L} color={WING_COLOR} />
      <Path path={WING_R} color={WING_COLOR} />
      <SwivelHead
        t={t}
        k={1}
        clip={HEAD_CLIP}
        front={
          <>
            <Path path={FACE} color={FACE_COLOR} />
            <Eye cx={40} cy={38} r={7} iris={5.2} pupil={2.8} />
            <Eye cx={60} cy={38} r={7} iris={5.2} pupil={2.8} />
            <Path path={BEAK} color={AMBER} />
          </>
        }
      />
      <Feet path={FEET_SHORT} />
    </>
  );
}

// Answering · hops (ho-hop .8s, 50% translateY(-4)), wings flap out behind the body
// (ho-flap-l/r .4s: 8°↔42° about 29,42 and −8°↔−42° about 71,42), happy squint.
function Answering({ paused, mini }: MoodLayerProps) {
  const hopT = useLoop(800, paused);
  const flapT = useLoop(400, paused);
  const hop = useDerivedValue(() => [{ translateY: kf(hopT.value, [0, 0.5, 1], [0, -4, 0]) }]);
  const flapL = useDerivedValue(() => [{ rotate: kf(flapT.value, [0, 0.5, 1], [8, 42, 8]) * DEG }]);
  const flapR = useDerivedValue(() => [{ rotate: kf(flapT.value, [0, 0.5, 1], [-8, -42, -8]) * DEG }]);
  if (mini) {
    return (
      <Group transform={hop}>
        <Path path={MINI_BODY}>
          <BodyGradient top={4} bottom={92} />
        </Path>
        <Path path={MINI_FACE} color={FACE_COLOR} />
        <Path path={MINI_HAPPY_EYE_L} style="stroke" strokeWidth={4} strokeCap="round" color={INK} />
        <Path path={MINI_HAPPY_EYE_R} style="stroke" strokeWidth={4} strokeCap="round" color={INK} />
        <Path path={MINI_BEAK} color={AMBER} />
        <Oval x={23} y={47.5} width={9} height={5} color={CHEEK} />
        <Oval x={68} y={47.5} width={9} height={5} color={CHEEK} />
      </Group>
    );
  }
  return (
    <Group transform={hop}>
      <Group transform={flapL} origin={vec(29, 42)}>
        <Path path={WING_L} color="#4338CA" />
      </Group>
      <Group transform={flapR} origin={vec(71, 42)}>
        <Path path={WING_R} color="#4338CA" />
      </Group>
      <Path path={BODY}>
        <BodyGradient top={10} bottom={84} />
      </Path>
      <Oval x={35} y={51} width={30} height={30} color="#818CF8" opacity={0.55} />
      <Chest />
      <Path path={FACE} color={FACE_COLOR} />
      <Path path={HAPPY_EYE_L} style="stroke" strokeWidth={3.2} strokeCap="round" color={INK} />
      <Path path={HAPPY_EYE_R} style="stroke" strokeWidth={3.2} strokeCap="round" color={INK} />
      <Path path={BEAK_UPPER} color={AMBER} />
      <Path path={BEAK_LOWER} color="#D97706" />
      <Oval x={28.5} y={44} width={7} height={4} color={CHEEK} />
      <Oval x={64.5} y={44} width={7} height={4} color={CHEEK} />
      <Feet path={FEET_SHORT} />
    </Group>
  );
}

// ho-z: 2.6s ease-out, 0% translate(0,0) opacity 0, 20% opacity 1, 100% translate(8px,-14px)
// opacity 0; the second z runs half a loop behind (animation-delay 1.3s).
function FloatingZ({ t, offset, path, width }: { t: SharedValue<number>; offset: number; path: string; width: number }) {
  const transform = useDerivedValue(() => {
    const p = phase(t.value, offset);
    return [{ translateX: kf(p, [0, 1], [0, 8], 'ease-out') }, { translateY: kf(p, [0, 1], [0, -14], 'ease-out') }];
  });
  const opacity = useDerivedValue(() => kf(phase(t.value, offset), [0, 0.2, 1], [0, 1, 0], 'ease-out'));
  return (
    <Group transform={transform} opacity={opacity}>
      <Path path={path} style="stroke" strokeWidth={width} strokeCap="round" strokeJoin="round" color={Z_COLOR} />
    </Group>
  );
}

// Resting · fluffed up, muted, eyes closed; two z's float up. The body itself is still.
function Resting({ paused, mini }: MoodLayerProps) {
  const t = useLoop(2600, paused);
  if (mini) {
    return (
      <>
        <Path path={MINI_BODY} color="#6B6FB8" />
        <Path path={MINI_FACE} color="#C9CDEA" />
        <Path path={MINI_REST_EYE_L} style="stroke" strokeWidth={3.2} strokeCap="round" color={INK} />
        <Path path={MINI_REST_EYE_R} style="stroke" strokeWidth={3.2} strokeCap="round" color={INK} />
        <Path path={MINI_BEAK} color="#C2842B" />
      </>
    );
  }
  return (
    <>
      <Path path={REST_BODY} color="#6B6FB8" />
      <Oval x={35} y={56} width={30} height={28} color="#8184C9" opacity={0.6} />
      <Path path={REST_WING_L} color="#43437F" />
      <Path path={REST_WING_R} color="#43437F" />
      <Path path={REST_FACE} color="#C9CDEA" />
      <Path path={REST_EYE_L} style="stroke" strokeWidth={2.6} strokeCap="round" color={INK} />
      <Path path={REST_EYE_R} style="stroke" strokeWidth={2.6} strokeCap="round" color={INK} />
      <Path path={REST_BEAK} color="#C2842B" />
      <FloatingZ t={t} offset={0} path={Z_BIG} width={1.1} />
      <FloatingZ t={t} offset={0.5} path={Z_SMALL} width={0.85} />
    </>
  );
}

const LAYERS = { idle: Idle, thinking: Thinking, answering: Answering, resting: Resting };

export function HootArt({ mood, mini, paused }: CharacterArtProps): React.ReactElement {
  return <MoodLayers mood={mood} mini={mini} paused={paused} layers={LAYERS} />;
}
