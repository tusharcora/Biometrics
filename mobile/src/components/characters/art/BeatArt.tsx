import React from 'react';
import { Circle, Group, LinearGradient, Oval, Path, vec } from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import { kf, MoodLayers, useLoop, type MoodLayerProps } from '../engine';
import type { CharacterArtProps } from '../types';

// Beat, a heart with a face. Ported from docs/design/companions/BuddyBeat.dc.html
// (100×100 viewBox; path data, colours and keyframes copied unchanged).

const INK = '#4C0519';
const BODY_TOP = '#FDA4AF';
const BODY_BOTTOM = '#F43F5E';
const REST_BODY = '#E48A9A';

const HEART =
  'M50 88 C44 82 12 62 12 38 C12 24 22 16 33 16 C41 16 47 21 50 27 C53 21 59 16 67 16 C78 16 88 24 88 38 C88 62 56 82 50 88 Z';
const MOUTH = 'M45 56 Q50 60 55 56';
// Answering: happy arcs and an open smile.
const HAPPY_EYE_L = 'M35 44 Q40 38 45 44';
const HAPPY_EYE_R = 'M55 44 Q60 38 65 44';
const SMILE = 'M43 54 Q50 62 57 54';
// Resting: closed eyes, small mouth, a blanket line across the bottom.
const REST_EYE_L = 'M35 46 Q40 49 45 46';
const REST_EYE_R = 'M55 46 Q60 49 65 46';
const REST_MOUTH = 'M47 57 Q50 58 53 57';
const BLANKET = 'M14 80 Q50 70 86 80';

// Mini (tab-bar pill): a bigger heart filling the square, eyes only.
const MINI_HEART =
  'M50 92 C42 84 6 62 6 36 C6 20 18 12 30 12 C40 12 46 18 50 24 C54 18 60 12 70 12 C82 12 94 20 94 36 C94 62 58 84 50 92 Z';
// Mini resting isn't in the mockup: the full mood's closed eyes, sized to the mini's eyes.
const MINI_REST_EYE_L = 'M32 44 Q38 49 44 44';
const MINI_REST_EYE_R = 'M56 44 Q62 49 68 44';

// .bt-beat: lub-dub then rest (ease-in-out), pivot 50,56 (the mini's centre is 50,52).
const BEAT_STOPS = [0, 0.15, 0.25, 0.32, 0.4, 1];
const BEAT_SCALE = [1, 1.06, 0.99, 1.03, 1, 1];
// .bt-look: eyes wander up-left, up-right, back.
const LOOK_STOPS = [0, 0.35, 0.7, 1];
const LOOK_X = [0, -4, 4, 0];
const LOOK_Y = [0, -3, -3, 0];

function Ellipse({ cx, cy, rx, ry, color }: { cx: number; cy: number; rx: number; ry: number; color: string }) {
  return <Oval x={cx - rx} y={cy - ry} width={rx * 2} height={ry * 2} color={color} />;
}

// url(#bt-body): objectBoundingBox top → bottom, pink to rose.
function Heart({ path, top, bottom }: { path: string; top: number; bottom: number }) {
  return (
    <Path path={path}>
      <LinearGradient start={vec(50, top)} end={vec(50, bottom)} colors={[BODY_TOP, BODY_BOTTOM]} />
    </Path>
  );
}

function Beating({ durationMs, paused, pivotY, children }: {
  durationMs: number;
  paused: boolean;
  pivotY: number;
  children: React.ReactNode;
}) {
  const t = useLoop(durationMs, paused);
  const transform = useDerivedValue(() => [{ scale: kf(t.value, BEAT_STOPS, BEAT_SCALE) }]);
  return (
    <Group origin={vec(50, pivotY)} transform={transform}>
      {children}
    </Group>
  );
}

// .bt-blink: scaleY(.1) at 47% of a 4.2s loop, around each eye's centre.
function BlinkEye({ t, cx, cy, rx, ry }: { t: SharedValue<number>; cx: number; cy: number; rx: number; ry: number }) {
  const transform = useDerivedValue(() => [{ scaleY: kf(t.value, [0, 0.45, 0.47, 0.49, 1], [1, 1, 0.1, 1, 1]) }]);
  return (
    <Group origin={vec(cx, cy)} transform={transform}>
      <Ellipse cx={cx} cy={cy} rx={rx} ry={ry} color={INK} />
    </Group>
  );
}

function Looking({ paused, children }: { paused: boolean; children: React.ReactNode }) {
  const t = useLoop(1800, paused);
  const transform = useDerivedValue(() => [
    { translateX: kf(t.value, LOOK_STOPS, LOOK_X) },
    { translateY: kf(t.value, LOOK_STOPS, LOOK_Y) },
  ]);
  return <Group transform={transform}>{children}</Group>;
}

// Idle · calm heartbeat (1.2s) with blinks. Drawn as the large hero pose,
// which also has the two soft cheek highlights.
function IdleFull({ paused }: { paused: boolean }) {
  const blink = useLoop(4200, paused);
  return (
    <Beating durationMs={1200} paused={paused} pivotY={56}>
      <Heart path={HEART} top={16} bottom={88} />
      <BlinkEye t={blink} cx={40} cy={44} rx={4} ry={5.5} />
      <BlinkEye t={blink} cx={60} cy={44} rx={4} ry={5.5} />
      <Path path={MOUTH} style="stroke" strokeWidth={2.5} strokeCap="round" color={INK} />
      <Ellipse cx={30} cy={52} rx={5} ry={3} color="rgba(255,255,255,0.3)" />
      <Ellipse cx={70} cy={52} rx={5} ry={3} color="rgba(255,255,255,0.3)" />
    </Beating>
  );
}

// Thinking · the heart holds still while the eyes wander; small round mouth.
function ThinkingFull({ paused }: { paused: boolean }) {
  return (
    <>
      <Heart path={HEART} top={16} bottom={88} />
      <Looking paused={paused}>
        <Ellipse cx={40} cy={42} rx={4} ry={5.5} color={INK} />
        <Ellipse cx={60} cy={42} rx={4} ry={5.5} color={INK} />
      </Looking>
      <Circle cx={50} cy={57} r={2.5} color={INK} />
    </>
  );
}

// Answering · happy flutter: the same beat at .7s, happy eyes, open smile.
function AnsweringFull({ paused }: { paused: boolean }) {
  return (
    <Beating durationMs={700} paused={paused} pivotY={56}>
      <Heart path={HEART} top={16} bottom={88} />
      <Path path={HAPPY_EYE_L} style="stroke" strokeWidth={3} strokeCap="round" color={INK} />
      <Path path={HAPPY_EYE_R} style="stroke" strokeWidth={3} strokeCap="round" color={INK} />
      <Path path={SMILE} color={INK} />
    </Beating>
  );
}

// Resting · muted flat heart, eyes closed, tucked under a blanket line. Still in the mockup.
function RestingFull() {
  return (
    <>
      <Path path={HEART} color={REST_BODY} />
      <Path path={REST_EYE_L} style="stroke" strokeWidth={2.5} strokeCap="round" color={INK} />
      <Path path={REST_EYE_R} style="stroke" strokeWidth={2.5} strokeCap="round" color={INK} />
      <Path path={REST_MOUTH} style="stroke" strokeWidth={2.5} strokeCap="round" color={INK} />
      <Path path={BLANKET} style="stroke" strokeWidth={4} strokeCap="round" color="#A5B4FC" />
    </>
  );
}

// Mini moods other than idle aren't in the mockup; they reuse each full
// mood's motion on the mini heart (beat, wandering eyes, fast beat, still).
function IdleMini({ paused }: { paused: boolean }) {
  const blink = useLoop(4200, paused);
  return (
    <Beating durationMs={1200} paused={paused} pivotY={52}>
      <Heart path={MINI_HEART} top={12} bottom={92} />
      <BlinkEye t={blink} cx={38} cy={42} rx={6} ry={8} />
      <BlinkEye t={blink} cx={62} cy={42} rx={6} ry={8} />
    </Beating>
  );
}

function ThinkingMini({ paused }: { paused: boolean }) {
  return (
    <>
      <Heart path={MINI_HEART} top={12} bottom={92} />
      <Looking paused={paused}>
        <Ellipse cx={38} cy={42} rx={6} ry={8} color={INK} />
        <Ellipse cx={62} cy={42} rx={6} ry={8} color={INK} />
      </Looking>
    </>
  );
}

function AnsweringMini({ paused }: { paused: boolean }) {
  return (
    <Beating durationMs={700} paused={paused} pivotY={52}>
      <Heart path={MINI_HEART} top={12} bottom={92} />
      <Ellipse cx={38} cy={42} rx={6} ry={8} color={INK} />
      <Ellipse cx={62} cy={42} rx={6} ry={8} color={INK} />
    </Beating>
  );
}

function RestingMini() {
  return (
    <>
      <Path path={MINI_HEART} color={REST_BODY} />
      <Path path={MINI_REST_EYE_L} style="stroke" strokeWidth={3.5} strokeCap="round" color={INK} />
      <Path path={MINI_REST_EYE_R} style="stroke" strokeWidth={3.5} strokeCap="round" color={INK} />
    </>
  );
}

function Idle({ paused, mini }: MoodLayerProps) {
  return mini ? <IdleMini paused={paused} /> : <IdleFull paused={paused} />;
}
function Thinking({ paused, mini }: MoodLayerProps) {
  return mini ? <ThinkingMini paused={paused} /> : <ThinkingFull paused={paused} />;
}
function Answering({ paused, mini }: MoodLayerProps) {
  return mini ? <AnsweringMini paused={paused} /> : <AnsweringFull paused={paused} />;
}
function Resting({ mini }: MoodLayerProps) {
  return mini ? <RestingMini /> : <RestingFull />;
}

const LAYERS = { idle: Idle, thinking: Thinking, answering: Answering, resting: Resting };

export function BeatArt({ mood, mini, paused }: CharacterArtProps): React.ReactElement {
  return <MoodLayers mood={mood} mini={mini} paused={paused} layers={LAYERS} />;
}
