import React from 'react';
import { Circle, Group, Oval, Path, RoundedRect, Skia, vec, type SkPath } from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import { cubicBezier, kf, MoodLayers, phase, useLoop, type MoodLayerProps } from '../engine';
import type { CharacterArtProps } from '../types';

// Doze, a fluffy lavender sheep. Ported from docs/design/companions/BuddyDoze.dc.html
// (100×100 viewBox; path data, colours and keyframes copied unchanged).

const DEG = Math.PI / 180;

const DARK = '#4C3F75';
const WOOL_SHADE = '#C4B5FD';
const WOOL_IDLE = '#EDE9FE';
// The thinking and answering cards draw the fleece a shade lighter.
const WOOL_LIGHT = '#F5F3FF';
const PINK = '#F9A8D4';
const PUPIL = '#1E1B2E';
const MOUTH_COLOR = '#E9D5FF';

type CircleSpec = readonly [cx: number, cy: number, r: number];

// Overlapping fleece puffs, merged into one path per colour (one draw each).
function puffs(circles: readonly CircleSpec[]): SkPath {
  const builder = Skia.PathBuilder.Make();
  circles.forEach(([cx, cy, r]) => builder.addCircle(cx, cy, r));
  return builder.build();
}

const WOOL_BACK = puffs([
  [33.5, 52, 13],
  [45.5, 42, 13],
  [59.5, 42, 13],
  [71.5, 52, 13],
  [71.5, 66, 13],
  [59.5, 74, 13],
  [43.5, 74, 13],
  [31.5, 66, 13],
  [51.5, 58, 20],
]);
const WOOL_FRONT = puffs([
  [32, 50, 12.2],
  [44, 40, 12.2],
  [58, 40, 12.2],
  [70, 50, 12.2],
  [70, 64, 12.2],
  [58, 72, 12.2],
  [42, 72, 12.2],
  [30, 64, 12.2],
  [50, 56, 19.2],
]);
const TUFT = puffs([
  [44, 45.5, 5.5],
  [50, 43.5, 6.5],
  [56, 45.5, 5.5],
]);
const LEG_X = [35, 43, 52.5, 60.5];

const MOUTH = 'M50 68.5 V70 M47.5 70.8 Q50 72.6 52.5 70.8';
const COLLAR = 'M39 72.5 Q50 79 61 72.5';
const BELL_SLOT = 'M48.2 80.5 H51.8';
const LID_L = 'M41.6 59 A3.4 3.4 0 0 1 48.4 59 Z';
const LID_R = 'M51.6 59 A3.4 3.4 0 0 1 58.4 59 Z';
// Answering face.
const HAPPY_EYE_L = 'M42 60 Q45 56 48 60';
const HAPPY_EYE_R = 'M52 60 Q55 56 58 60';
const OPEN_MOUTH = 'M46.5 70 Q50 74.5 53.5 70 Z';
// Thinking: the fence.
const FENCE_POSTS = 'M22 72 V90 M50 72 V90 M78 72 V90';
const FENCE_RAILS = 'M18 77 H82 M18 84 H82';
// The "+1" is <text> (Geist 600, 11px at x=70 y=30) and the z's are <text>
// (13px and 10px at x=62 y=46); drawn as strokes with the glyphs' proportions
// (as HootArt does) so no font has to load.
const PLUS_ONE = 'M71 26.1 H75.6 M73.3 23.8 V28.4 M77.3 23.8 L79.3 22.3 V30';
const Z_BIG = 'M62.65 39.39 H67.85 L62.65 45.35 H68.07';
const Z_SMALL = 'M62.5 40.92 H66.5 L62.5 45.5 H66.67';
// Resting: curled up, moon.
const REST_BACK = puffs([
  [31.5, 74, 12],
  [43.5, 68, 13],
  [57.5, 68, 13],
  [71.5, 74, 12],
  [51.5, 78, 15],
  [37.5, 82, 10],
  [65.5, 82, 10],
]);
const REST_FRONT = puffs([
  [30, 72, 11.2],
  [42, 66, 12.2],
  [56, 66, 12.2],
  [70, 72, 11.2],
  [50, 76, 14.2],
  [36, 80, 9.2],
  [64, 80, 9.2],
]);
const REST_TUFT = puffs([
  [33, 65.5, 4],
  [38.5, 64.5, 4.6],
  [43.5, 66, 3.8],
]);
const REST_EYE_L = 'M31 73 Q34 75.5 37 73';
const REST_EYE_R = 'M39.5 73 Q42.5 75.5 45.5 73';
const MOON = 'M84 18 A8 8 0 1 1 76 28 A6 6 0 1 0 84 18 Z';

// Mini (tab-bar pill): a bigger head in a ring of fleece.
const MINI_WOOL = puffs([
  [26, 44, 15],
  [40, 30, 15],
  [60, 30, 15],
  [74, 44, 15],
  [74, 62, 15],
  [26, 62, 15],
  [50, 52, 24],
  [50, 72, 15],
]);
const MINI_TUFT = puffs([
  [43, 38, 7],
  [50, 36, 8],
  [57, 38, 7],
]);
// Mini resting isn't in the mockup: closed eyes like the curled-up sheep, sized to the mini's eyes.
const MINI_REST_EYE_L = 'M39.5 57.5 Q43.5 61 47.5 57.5';
const MINI_REST_EYE_R = 'M52.5 57.5 Q56.5 61 60.5 57.5';

function Ellipse({ cx, cy, rx, ry, color, opacity }: {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  color: string;
  opacity?: number;
}) {
  return <Oval x={cx - rx} y={cy - ry} width={rx * 2} height={ry * 2} color={color} opacity={opacity} />;
}

function Legs() {
  return (
    <>
      {LEG_X.map((x) => (
        <RoundedRect key={x} x={x} y={78} width={4.5} height={15} r={2.2} color={DARK} />
      ))}
    </>
  );
}

function Wool({ front }: { front: string }) {
  return (
    <>
      <Path path={WOOL_BACK} color={WOOL_SHADE} />
      <Path path={WOOL_FRONT} color={front} />
    </>
  );
}

// Floppy ear, tilted 25° (left) or -25° (right) around its centre.
function Ear({ side }: { side: 'left' | 'right' }) {
  const cx = side === 'left' ? 35 : 65;
  const angle = side === 'left' ? 25 : -25;
  return (
    <Group origin={vec(cx, 54)} transform={[{ rotate: angle * DEG }]}>
      <Ellipse cx={cx} cy={54} rx={7.5} ry={3.4} color={DARK} />
      <Ellipse cx={cx} cy={54} rx={4.2} ry={1.6} color={PINK} opacity={0.75} />
    </Group>
  );
}

function FaceBase() {
  return (
    <>
      <Ellipse cx={50} cy={60} rx={12.5} ry={15} color={DARK} />
      <Path path={TUFT} color={WOOL_LIGHT} />
    </>
  );
}

function OpenEyes({ sparkle }: { sparkle: boolean }) {
  return (
    <>
      <Circle cx={45} cy={59} r={3.4} color="#FFFFFF" />
      <Circle cx={45} cy={59.6} r={2} color={PUPIL} />
      {sparkle ? <Circle cx={45.8} cy={58.6} r={0.7} color="#FFFFFF" /> : null}
      <Circle cx={55} cy={59} r={3.4} color="#FFFFFF" />
      <Circle cx={55} cy={59.6} r={2} color={PUPIL} />
      {sparkle ? <Circle cx={55.8} cy={58.6} r={0.7} color="#FFFFFF" /> : null}
    </>
  );
}

function NoseAndMouth() {
  return (
    <>
      <Ellipse cx={50} cy={67} rx={2.5} ry={1.6} color={PINK} />
      <Path path={MOUTH} style="stroke" strokeWidth={1.2} strokeCap="round" color={MOUTH_COLOR} />
    </>
  );
}

function Collar() {
  return <Path path={COLLAR} style="stroke" strokeWidth={2.6} strokeCap="round" color="#F472B6" />;
}

function Bell() {
  return (
    <>
      <Circle cx={50} cy={79.5} r={3.2} color="#FCD34D" />
      <Path path={BELL_SLOT} style="stroke" strokeWidth={0.9} strokeCap="round" color="#B45309" />
    </>
  );
}

// Whole-body breathing: scale around a pivot, keyframes 0/50/100%.
function Breathe({ durationMs, paused, pivot, sx, sy, children }: {
  durationMs: number;
  paused: boolean;
  pivot: readonly [number, number];
  sx: number;
  sy: number;
  children: React.ReactNode;
}) {
  const t = useLoop(durationMs, paused);
  const transform = useDerivedValue(() => [
    { scaleX: kf(t.value, [0, 0.5, 1], [1, sx, 1]) },
    { scaleY: kf(t.value, [0, 0.5, 1], [1, sy, 1]) },
  ]);
  return (
    <Group origin={vec(pivot[0], pivot[1])} transform={transform}>
      {children}
    </Group>
  );
}

// .dz-lid: the half-lid droops to cover the eye, snaps open, settles.
// Pivot is the lid's top edge (transform-origin 50% 0% of its box).
function Lid({ t, path, cx }: { t: SharedValue<number>; path: string; cx: number }) {
  const transform = useDerivedValue(() => [
    { scaleY: kf(t.value, [0, 0.2, 0.62, 0.66, 0.72, 1], [1, 1, 2, 0.2, 1, 1]) },
  ]);
  return (
    <Group origin={vec(cx, 55.6)} transform={transform}>
      <Path path={path} color={DARK} />
    </Group>
  );
}

// Idle · eyelids droop, the head nods off, snaps awake, the right ear flicks (6s); fleece breathes (4s).
function IdleFull({ paused }: { paused: boolean }) {
  const t = useLoop(6000, paused);
  const flick = useDerivedValue(() => [
    { rotate: kf(t.value, [0, 0.68, 0.72, 0.76, 0.8, 1], [0, 0, -22, 4, 0, 0]) * DEG },
  ]);
  const nod = useDerivedValue(() => [{ translateY: kf(t.value, [0, 0.2, 0.62, 0.66, 1], [0, 0, 2.5, 0, 0]) }]);
  return (
    <>
      <Legs />
      <Breathe durationMs={4000} paused={paused} pivot={[50, 60]} sx={1.025} sy={1.025}>
        <Wool front={WOOL_IDLE} />
      </Breathe>
      <Ear side="left" />
      <Group origin={vec(60, 52)} transform={flick}>
        <Ear side="right" />
      </Group>
      <Group transform={nod}>
        <FaceBase />
        <OpenEyes sparkle={false} />
        <Lid t={t} path={LID_L} cx={45} />
        <Lid t={t} path={LID_R} cx={55} />
        <NoseAndMouth />
      </Group>
      <Collar />
      <Bell />
    </>
  );
}

// dz-jump easing is per keyframe: ease-out up to the top (50%), ease-in down.
function jump(p: number, from: number, top: number, to: number): number {
  'worklet';
  return p < 0.5 ? kf(p, [0, 0.5], [from, top], 'ease-out') : kf(p, [0.5, 1], [top, to], 'ease-in');
}

// translate(50 44) scale(0.62) translate(-50 -56): the jumping sheep is a shrunk copy.
const SMALL_SHEEP = [{ translateX: 50 }, { translateY: 44 }, { scale: 0.62 }, { translateX: -50 }, { translateY: -56 }];

// The loop starts half-way (top of the jump) so the paused / Reduce Motion
// pose shows the sheep over the fence instead of an empty field.
const JUMP_START = 0.5;

// Thinking · counts itself over the fence: a small sheep arcs across, "+1" rises.
function ThinkingFull({ paused }: { paused: boolean }) {
  const t = useLoop(1800, paused);
  const sheepOpacity = useDerivedValue(() => {
    const p = phase(t.value, JUMP_START);
    if (p < 0.1) return kf(p, [0, 0.1], [0, 1], 'ease-out');
    if (p < 0.9) return 1;
    return kf(p, [0.9, 1], [1, 0], 'linear');
  });
  const sheepTransform = useDerivedValue(() => {
    const p = phase(t.value, JUMP_START);
    return [{ translateX: jump(p, -40, 0, 40) }, { translateY: jump(p, 14, -10, 14) }];
  });
  const countOpacity = useDerivedValue(() =>
    kf(phase(t.value, JUMP_START), [0, 0.5, 0.62, 1], [0, 0, 1, 0], 'ease-out'),
  );
  const countTransform = useDerivedValue(() => [
    { translateY: kf(phase(t.value, JUMP_START), [0, 0.5, 1], [4, 4, -8], 'ease-out') },
  ]);
  return (
    <>
      <Path path={FENCE_POSTS} style="stroke" strokeWidth={3} strokeCap="round" color="#6D5BA6" />
      <Path path={FENCE_RAILS} style="stroke" strokeWidth={2.4} strokeCap="round" color="#8B7BB8" />
      <Group opacity={sheepOpacity} transform={sheepTransform}>
        <Group transform={SMALL_SHEEP}>
          <Legs />
          <Wool front={WOOL_LIGHT} />
          <Ear side="left" />
          <Ear side="right" />
          <FaceBase />
          <OpenEyes sparkle />
          <NoseAndMouth />
          <Collar />
          <Bell />
        </Group>
      </Group>
      <Group opacity={countOpacity} transform={countTransform}>
        <Path
          path={PLUS_ONE}
          style="stroke"
          strokeWidth={1.3}
          strokeCap="round"
          strokeJoin="round"
          color={WOOL_SHADE}
        />
      </Group>
    </>
  );
}

// .dz-hop keyframes 0/45/100% with cubic-bezier(.3,0,.3,1) per segment.
function hopKf(t: number, values: readonly number[]): number {
  'worklet';
  const first = t <= 0.45;
  const u = first ? t / 0.45 : (t - 0.45) / 0.55;
  const from = first ? values[0]! : values[1]!;
  const to = first ? values[1]! : values[2]!;
  return from + (to - from) * cubicBezier(0.3, 0, 0.3, 1, u);
}

function Hop({ t, children }: { t: SharedValue<number>; children: React.ReactNode }) {
  const transform = useDerivedValue(() => [
    { translateY: hopKf(t.value, [0, -5, 0]) },
    { scaleX: hopKf(t.value, [1.02, 0.99, 1.02]) },
    { scaleY: hopKf(t.value, [0.98, 1.01, 0.98]) },
  ]);
  return (
    <Group origin={vec(50, 88)} transform={transform}>
      {children}
    </Group>
  );
}

// Answering · bounces, ears perk up and down, the bell swings (all .8s).
function AnsweringFull({ paused }: { paused: boolean }) {
  const t = useLoop(800, paused);
  const perkL = useDerivedValue(() => [{ rotate: kf(t.value, [0, 0.5, 1], [-30, -40, -30]) * DEG }]);
  const perkR = useDerivedValue(() => [{ rotate: kf(t.value, [0, 0.5, 1], [30, 40, 30]) * DEG }]);
  const bell = useDerivedValue(() => [{ rotate: kf(t.value, [0, 0.5, 1], [-20, 20, -20]) * DEG }]);
  return (
    <Hop t={t}>
      <Legs />
      <Wool front={WOOL_LIGHT} />
      <Group origin={vec(41, 54)} transform={perkL}>
        <Ear side="left" />
      </Group>
      <Group origin={vec(59, 54)} transform={perkR}>
        <Ear side="right" />
      </Group>
      <FaceBase />
      <Path path={HAPPY_EYE_L} style="stroke" strokeWidth={2} strokeCap="round" color="#FFFFFF" />
      <Path path={HAPPY_EYE_R} style="stroke" strokeWidth={2} strokeCap="round" color="#FFFFFF" />
      <Ellipse cx={50} cy={67} rx={2.5} ry={1.6} color={PINK} />
      <Path path={OPEN_MOUTH} color={PINK} />
      <Ellipse cx={41} cy={66} rx={2.6} ry={1.5} color="rgba(244,114,182,0.55)" />
      <Ellipse cx={59} cy={66} rx={2.6} ry={1.5} color="rgba(244,114,182,0.55)" />
      <Collar />
      <Group origin={vec(50, 76)} transform={bell}>
        <Bell />
      </Group>
    </Hop>
  );
}

// .dz-z: drifts up-right and fades (ease-out); the second z is delayed 1.3s of 2.6s.
function FloatingZ({ t, offset, path, width }: {
  t: SharedValue<number>;
  offset: number;
  path: string;
  width: number;
}) {
  const opacity = useDerivedValue(() => kf(phase(t.value, offset), [0, 0.2, 1], [0, 1, 0], 'ease-out'));
  const transform = useDerivedValue(() => {
    const p = phase(t.value, offset);
    return [{ translateX: kf(p, [0, 1], [0, 8], 'ease-out') }, { translateY: kf(p, [0, 1], [0, -14], 'ease-out') }];
  });
  return (
    <Group opacity={opacity} transform={transform}>
      <Path path={path} style="stroke" strokeWidth={width} strokeCap="round" strokeJoin="round" color={WOOL_SHADE} />
    </Group>
  );
}

// Resting · curled up asleep under the moon; slow breathing, two z's.
function RestingFull({ paused }: { paused: boolean }) {
  const z = useLoop(2600, paused);
  return (
    <>
      <Breathe durationMs={5000} paused={paused} pivot={[50, 86]} sx={1.02} sy={1.05}>
        <Path path={REST_BACK} color="#A99BD6" />
        <Path path={REST_FRONT} color="#D8D2F0" />
      </Breathe>
      <Group origin={vec(38, 74)} transform={[{ rotate: -18 * DEG }]}>
        <Group origin={vec(26, 72)} transform={[{ rotate: 40 * DEG }]}>
          <Ellipse cx={26} cy={72} rx={6.5} ry={3} color="#463A6B" />
        </Group>
        <Ellipse cx={38} cy={74} rx={11} ry={10} color="#463A6B" />
        <Path path={REST_TUFT} color="#E9E5F7" />
        <Path path={REST_EYE_L} style="stroke" strokeWidth={1.6} strokeCap="round" color={MOUTH_COLOR} />
        <Path path={REST_EYE_R} style="stroke" strokeWidth={1.6} strokeCap="round" color={MOUTH_COLOR} />
        <Ellipse cx={38.5} cy={79} rx={2} ry={1.3} color={PINK} opacity={0.8} />
      </Group>
      <FloatingZ t={z} offset={0} path={Z_BIG} width={1.2} />
      <FloatingZ t={z} offset={-0.5} path={Z_SMALL} width={0.92} />
      <Path path={MOON} color="#FDE68A" opacity={0.8} />
    </>
  );
}

// Mini: the mockup's pill head. Its other moods aren't in the mockup; they
// reuse each full mood's body motion on the head (breathing, a quicker
// breath while counting, the answering hop, slow sleepy breathing).
function MiniHead({ closed }: { closed: boolean }) {
  return (
    <>
      <Path path={MINI_WOOL} color={WOOL_IDLE} />
      <Ellipse cx={50} cy={58} rx={16} ry={19} color={DARK} />
      <Path path={MINI_TUFT} color={WOOL_LIGHT} />
      {closed ? (
        <>
          <Path path={MINI_REST_EYE_L} style="stroke" strokeWidth={2.2} strokeCap="round" color={MOUTH_COLOR} />
          <Path path={MINI_REST_EYE_R} style="stroke" strokeWidth={2.2} strokeCap="round" color={MOUTH_COLOR} />
        </>
      ) : (
        <>
          <Circle cx={43.5} cy={57} r={4.2} color="#FFFFFF" />
          <Circle cx={56.5} cy={57} r={4.2} color="#FFFFFF" />
          <Circle cx={43.5} cy={58} r={2.4} color={PUPIL} />
          <Circle cx={56.5} cy={58} r={2.4} color={PUPIL} />
        </>
      )}
    </>
  );
}

function AnsweringMini({ paused }: { paused: boolean }) {
  const t = useLoop(800, paused);
  return (
    <Hop t={t}>
      <MiniHead closed={false} />
    </Hop>
  );
}

function Idle({ paused, mini }: MoodLayerProps) {
  if (!mini) return <IdleFull paused={paused} />;
  return (
    <Breathe durationMs={4000} paused={paused} pivot={[50, 56]} sx={1.025} sy={1.025}>
      <MiniHead closed={false} />
    </Breathe>
  );
}
function Thinking({ paused, mini }: MoodLayerProps) {
  if (!mini) return <ThinkingFull paused={paused} />;
  return (
    <Breathe durationMs={1800} paused={paused} pivot={[50, 56]} sx={1.025} sy={1.025}>
      <MiniHead closed={false} />
    </Breathe>
  );
}
function Answering({ paused, mini }: MoodLayerProps) {
  return mini ? <AnsweringMini paused={paused} /> : <AnsweringFull paused={paused} />;
}
function Resting({ paused, mini }: MoodLayerProps) {
  if (!mini) return <RestingFull paused={paused} />;
  return (
    <Breathe durationMs={5000} paused={paused} pivot={[50, 86]} sx={1.02} sy={1.05}>
      <MiniHead closed />
    </Breathe>
  );
}

const LAYERS = { idle: Idle, thinking: Thinking, answering: Answering, resting: Resting };

export function DozeArt({ mood, mini, paused }: CharacterArtProps): React.ReactElement {
  return <MoodLayers mood={mood} mini={mini} paused={paused} layers={LAYERS} />;
}
