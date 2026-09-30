import React from 'react';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import {
  Circle,
  Group,
  LinearGradient,
  Oval,
  Path,
  RadialGradient,
  Skia,
  usePathInterpolation,
  vec,
  type SkPath,
} from '@shopify/react-native-skia';
import { MoodLayers, cubicBezier, kf, phase, useLoop, type MoodLayerProps } from '../engine';
import type { CharacterArtProps } from '../types';

// Ember: a three-layer flame (docs/design/companions/BuddyEmber.dc.html).
// The outer/mid/core outlines morph through the mockup's <animate values>
// (keyTimes 0/.25/.5/.75/1, keySplines .45 0 .55 1) on separate rhythms.

const DEG = Math.PI / 180;
const INK = '#431407';

const OUTER_A =
  'M50 6 C56 20 78 32 78 58 C78 76 66 90 50 90 C34 90 22 76 22 58 C22 42 34 36 38 24 C42 30 44 34 46 34 C46 24 46 16 50 6 Z';
const OUTER_B =
  'M54 4 C58 20 79 32 78 58 C78 76 66 90 50 90 C34 90 22 76 22 58 C22 40 32 34 35 20 C40 28 43 32 46 32 C47 22 50 14 54 4 Z';
const OUTER_C =
  'M46 6 C54 18 77 34 77 58 C77 76 66 90 50 90 C34 90 23 76 23 58 C23 44 35 38 39 27 C43 32 45 35 47 35 C45 24 43 16 46 6 Z';
const MID_A =
  'M50 26 C55 38 70 46 70 64 C70 78 61 88 50 88 C39 88 30 78 30 64 C30 54 36 48 40 42 C43 47 45 49 47 49 C47 42 47 34 50 26 Z';
const MID_B =
  'M47 24 C53 36 69 48 69 64 C69 78 61 88 50 88 C39 88 31 78 31 64 C31 55 37 50 41 44 C44 48 46 50 48 50 C46 42 45 34 47 24 Z';
const MID_C =
  'M53 22 C57 36 71 46 70 64 C70 78 61 88 50 88 C39 88 30 78 30 64 C30 52 35 46 38 38 C42 44 44 47 47 47 C48 40 50 32 53 22 Z';
const CORE_A = 'M50 58 C54 66 62 72 62 79 C62 85 57 89 50 89 C43 89 38 85 38 79 C38 72 46 66 50 58 Z';
const CORE_B = 'M51 55 C56 64 63 71 63 79 C63 85 57 89 50 89 C43 89 37 85 37 79 C37 71 45 64 51 55 Z';
const CORE_C = 'M49 56 C52 65 62 72 62 79 C62 85 57 89 50 89 C43 89 38 85 38 79 C38 73 44 65 49 56 Z';

function svgPath(d: string): SkPath {
  const path = Skia.Path.MakeFromSVGString(d);
  if (!path) throw new Error(`EmberArt: bad path ${d}`);
  return path;
}

// Frames in <animate values> order: A;B;A;C;A.
const OUTER_FRAMES = [OUTER_A, OUTER_B, OUTER_A, OUTER_C, OUTER_A].map(svgPath);
const MID_FRAMES = [MID_A, MID_B, MID_A, MID_C, MID_A].map(svgPath);
const CORE_FRAMES = [CORE_A, CORE_B, CORE_A, CORE_C, CORE_A].map(svgPath);
const FRAME_INPUT = [0, 1, 2, 3, 4];

type Curve = readonly [number, number, number, number];

// Like kf, for the mockup's cubic-bezier(...) timing functions.
function kfCurve(t: number, stops: readonly number[], values: readonly number[], c: Curve): number {
  'worklet';
  const n = stops.length;
  if (t <= stops[0]!) return values[0]!;
  if (t >= stops[n - 1]!) return values[n - 1]!;
  for (let i = 1; i < n; i++) {
    const end = stops[i]!;
    if (t <= end) {
      const start = stops[i - 1]!;
      const u = end - start <= 0 ? 1 : (t - start) / (end - start);
      const from = values[i - 1]!;
      return from + (values[i]! - from) * cubicBezier(c[0], c[1], c[2], c[3], u);
    }
  }
  return values[n - 1]!;
}

// SMIL calcMode="spline": 4 equal segments, each eased by keySplines .45 0 .55 1.
// Returns a 0..4 frame index for usePathInterpolation.
function smilFrame(t: number): number {
  'worklet';
  const x = t * 4;
  const i = Math.min(3, Math.floor(x));
  return i + cubicBezier(0.45, 0, 0.55, 1, x - i);
}

// CSS skewX(deg) then scale(sx, sy) as a row-major 4×4 (used with origin=).
// Skia's `skewX` transform shears vertically, so the matrix is built by hand.
function skewScale(skewDeg: number, sx: number, sy: number): number[] {
  'worklet';
  const k = Math.tan(skewDeg * DEG);
  return [sx, k * sy, 0, 0, 0, sy, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

type Palette = 'base' | 'hi' | 'lo';

const OUTER_COLORS: Record<Palette, { colors: string[]; positions: number[] }> = {
  base: { colors: ['#F43F5E', '#FB923C', '#FDBA74'], positions: [0, 0.55, 1] },
  hi: { colors: ['#FB7185', '#FDBA74', '#FEF08A'], positions: [0, 0.5, 1] },
  lo: { colors: ['#9F1239', '#C2410C'], positions: [0, 1] },
};
const MID_COLORS: Record<Palette, string[]> = {
  base: ['#FB923C', '#FDE68A'],
  hi: ['#FB923C', '#FDE68A'],
  lo: ['#EA580C', '#FDBA74'],
};

// Morphing outline: one loop of `durationMs` through the five frames.
function MorphPath({ frames, durationMs, paused, children }: {
  frames: SkPath[];
  durationMs: number;
  paused: boolean;
  children?: React.ReactNode;
}) {
  const t = useLoop(durationMs, paused);
  const frame = useDerivedValue(() => smilFrame(t.value));
  const path = usePathInterpolation(frame, FRAME_INPUT, frames);
  return <Path path={path}>{children}</Path>;
}

// Gradients are objectBoundingBox x1=0 y1=1 x2=0 y2=0 (bottom → top) in the
// mockup; here they span each layer's base outline bounds.
// Idle/thinking (base) and answering (hi) share the cream core; resting has its own.
function Flames({ durations, paused, palette }: {
  durations: readonly [number, number, number];
  paused: boolean;
  palette: 'base' | 'hi';
}) {
  const outer = OUTER_COLORS[palette];
  return (
    <>
      <MorphPath frames={OUTER_FRAMES} durationMs={durations[0]} paused={paused}>
        <LinearGradient start={vec(50, 90)} end={vec(50, 6)} colors={outer.colors} positions={outer.positions} />
      </MorphPath>
      <MorphPath frames={MID_FRAMES} durationMs={durations[1]} paused={paused}>
        <LinearGradient start={vec(50, 88)} end={vec(50, 26)} colors={MID_COLORS[palette]} />
      </MorphPath>
      <MorphPath frames={CORE_FRAMES} durationMs={durations[2]} paused={paused}>
        <LinearGradient start={vec(50, 89)} end={vec(50, 58)} colors={['#FEF3C7', '#FFFBEB']} />
      </MorphPath>
    </>
  );
}

// Resting: dark outer/mid gradients and a flat #FDE7C4 core, on slow rhythms.
function RestingFlames({ paused }: { paused: boolean }) {
  return (
    <>
      <MorphPath frames={OUTER_FRAMES} durationMs={2800} paused={paused}>
        <LinearGradient start={vec(50, 90)} end={vec(50, 6)} colors={OUTER_COLORS.lo.colors} />
      </MorphPath>
      <MorphPath frames={MID_FRAMES} durationMs={2300} paused={paused}>
        <LinearGradient start={vec(50, 88)} end={vec(50, 26)} colors={MID_COLORS.lo} />
      </MorphPath>
      <RestingCore paused={paused} />
    </>
  );
}

function RestingCore({ paused }: { paused: boolean }) {
  const t = useLoop(1900, paused);
  const frame = useDerivedValue(() => smilFrame(t.value));
  const path = usePathInterpolation(frame, FRAME_INPUT, CORE_FRAMES);
  return <Path path={path} color="#FDE7C4" />;
}

function Ellipse({ cx, cy, rx, ry, color, opacity }: {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  color?: string;
  opacity?: number;
}) {
  return <Oval x={cx - rx} y={cy - ry} width={rx * 2} height={ry * 2} color={color} opacity={opacity} />;
}

// Radial glow: objectBoundingBox cx .5 cy .6 r .5 on the ellipse, so the
// gradient is elliptical (a circle of radius rx squashed to ry).
function GlowShape({ cx, cy, rx, ry }: { cx: number; cy: number; rx: number; ry: number }) {
  const c = vec(cx, cy + 0.2 * ry);
  return (
    <Oval x={cx - rx} y={cy - ry} width={rx * 2} height={ry * 2}>
      <RadialGradient
        c={c}
        r={rx}
        origin={c}
        transform={[{ scaleY: ry / rx }]}
        colors={['rgba(251,146,60,0.55)', 'rgba(251,146,60,0)']}
      />
    </Oval>
  );
}

const GLOW_O_STOPS = [0, 0.17, 0.31, 0.52, 0.71, 0.86, 1];
const GLOW_O = [0.75, 0.95, 0.7, 1, 0.8, 0.95, 0.75];
const GLOW_S_STOPS = [0, 0.17, 0.52, 0.71, 1];
const GLOW_S = [1, 1.04, 1.06, 0.98, 1];

// .em-glow: linear flicker of opacity and scale around the ellipse centre.
function FlickerGlow({ durationMs, paused, cx, cy, rx, ry }: {
  durationMs: number;
  paused: boolean;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}) {
  const t = useLoop(durationMs, paused);
  const opacity = useDerivedValue(() => kf(t.value, GLOW_O_STOPS, GLOW_O, 'linear'));
  const transform = useDerivedValue(() => [{ scale: kf(t.value, GLOW_S_STOPS, GLOW_S, 'linear') }]);
  return (
    <Group opacity={opacity} origin={vec(cx, cy)} transform={transform}>
      <GlowShape cx={cx} cy={cy} rx={rx} ry={ry} />
    </Group>
  );
}

// .em-bob: the face floats 1.2px up and down.
function Bob({ paused, children }: { paused: boolean; children: React.ReactNode }) {
  const t = useLoop(1600, paused);
  const transform = useDerivedValue(() => [{ translateY: kf(t.value, [0, 0.5, 1], [0, -1.2, 0]) }]);
  return <Group transform={transform}>{children}</Group>;
}

// .em-blink: scaleY(.1) at 47% of a 4s loop, around each eye's centre.
function BlinkEye({ t, cx, cy, rx, ry }: { t: SharedValue<number>; cx: number; cy: number; rx: number; ry: number }) {
  const transform = useDerivedValue(() => [{ scaleY: kf(t.value, [0, 0.45, 0.47, 0.49, 1], [1, 1, 0.1, 1, 1]) }]);
  return (
    <Group origin={vec(cx, cy)} transform={transform}>
      <Ellipse cx={cx} cy={cy} rx={rx} ry={ry} color={INK} />
    </Group>
  );
}

const SPARK_POS = [
  [44, 34],
  [57, 30],
  [50, 24],
  [38, 42],
  [62, 40],
] as const;
// animation-delay of .em-sp2 … .em-sp5 (sp1 has none), in seconds.
const SPARK_DELAY_S = [0, 0.7, 1.4, 0.35, 1.05];

// .em-spark: drifts up and fades (ease-out). A positive CSS delay is a
// negative phase once the loop is running.
function Spark({ t, index, durationS }: { t: SharedValue<number>; index: number; durationS: number }) {
  const [cx, cy] = SPARK_POS[index]!;
  const offset = -SPARK_DELAY_S[index]! / durationS;
  const opacity = useDerivedValue(() => kf(phase(t.value, offset), [0, 0.12, 0.6, 1], [0, 1, 0.9, 0], 'ease-out'));
  const transform = useDerivedValue(() => {
    const p = phase(t.value, offset);
    return [
      { translateX: kf(p, [0, 0.6, 1], [0, -3, 3], 'ease-out') },
      { translateY: kf(p, [0, 0.6, 1], [0, -14, -24], 'ease-out') },
      { scale: kf(p, [0, 0.6, 1], [1, 0.8, 0.3], 'ease-out') },
    ];
  });
  return (
    <Group opacity={opacity} origin={vec(cx, cy)} transform={transform}>
      <Circle cx={cx} cy={cy} r={1.5} color="#FDE68A" />
    </Group>
  );
}

const BURST_CURVE: Curve = [0.2, 0.6, 0.3, 1];
// End translate of em-burst / em-burst-r (.em-sp2) / em-burst-l (.em-sp4).
const BURST_END = [
  [-8, -24],
  [12, -20],
  [-8, -24],
  [-14, -12],
  [-8, -24],
] as const;

// .em-burst: sparks shoot out from scale 1.3 to .2 over 1.4s.
function Burst({ t, index }: { t: SharedValue<number>; index: number }) {
  const [cx, cy] = SPARK_POS[index]!;
  const [dx, dy] = BURST_END[index]!;
  const offset = -SPARK_DELAY_S[index]! / 1.4;
  const opacity = useDerivedValue(() => kfCurve(phase(t.value, offset), [0, 0.15, 1], [0, 1, 0], BURST_CURVE));
  const transform = useDerivedValue(() => {
    const p = phase(t.value, offset);
    return [
      { translateX: kfCurve(p, [0, 1], [0, dx], BURST_CURVE) },
      { translateY: kfCurve(p, [0, 1], [0, dy], BURST_CURVE) },
      { scale: kfCurve(p, [0, 1], [1.3, 0.2], BURST_CURVE) },
    ];
  });
  return (
    <Group opacity={opacity} origin={vec(cx, cy)} transform={transform}>
      <Circle cx={cx} cy={cy} r={1.5} color="#FEF08A" />
    </Group>
  );
}

function IdleFull({ paused }: { paused: boolean }) {
  const lean = useLoop(3400, paused);
  const blink = useLoop(4000, paused);
  const sparks = useLoop(2200, paused);
  // .em-lean: skewX 0 → 2.5° → -2°, scaleY 1 → 1.02 → .985, pivot at the flame's base.
  const matrix = useDerivedValue(() => {
    const stops = [0, 0.25, 0.6, 1];
    return skewScale(kf(lean.value, stops, [0, 2.5, -2, 0]), 1, kf(lean.value, stops, [1, 1.02, 0.985, 1]));
  });
  return (
    <>
      <FlickerGlow durationMs={2300} paused={paused} cx={50} cy={57} rx={42} ry={36} />
      <Group origin={vec(50, 90)} matrix={matrix}>
        <Flames durations={[1600, 1250, 950]} paused={paused} palette="base" />
        <Bob paused={paused}>
          <BlinkEye t={blink} cx={43} cy={68} rx={3.4} ry={4.8} />
          <BlinkEye t={blink} cx={57} cy={68} rx={3.4} ry={4.8} />
          <Path path="M46 77 Q50 80 54 77" style="stroke" strokeWidth={2.3} strokeCap="round" color={INK} />
          <Ellipse cx={37} cy={75} rx={3.5} ry={2} color="rgba(244,63,94,0.45)" />
          <Ellipse cx={63} cy={75} rx={3.5} ry={2} color="rgba(244,63,94,0.45)" />
        </Bob>
      </Group>
      {/* Still pose: CSS holds delayed sparks at opacity 0, so draw none. */}
      {!paused && (
        <>
          <Spark t={sparks} index={0} durationS={2.2} />
          <Spark t={sparks} index={1} durationS={2.2} />
          <Spark t={sparks} index={2} durationS={2.2} />
        </>
      )}
    </>
  );
}

function ThinkingFull({ paused }: { paused: boolean }) {
  const dance = useLoop(600, paused);
  const sparks = useLoop(1100, paused);
  // .em-dance: skewX -6° ↔ 6° with scale(.97, 1.05) at the midpoint.
  const matrix = useDerivedValue(() => {
    const stops = [0, 0.5, 1];
    const t = dance.value;
    return skewScale(kf(t, stops, [-6, 6, -6]), kf(t, stops, [1, 0.97, 1]), kf(t, stops, [1, 1.05, 1]));
  });
  return (
    <>
      <FlickerGlow durationMs={2300} paused={paused} cx={50} cy={57} rx={42} ry={36} />
      <Group origin={vec(50, 90)} matrix={matrix}>
        <Flames durations={[700, 550, 450]} paused={paused} palette="base" />
        <Bob paused={paused}>
          <Ellipse cx={44} cy={65} rx={3.4} ry={4.8} color={INK} />
          <Ellipse cx={58} cy={65} rx={3.4} ry={4.8} color={INK} />
          <Ellipse cx={51} cy={77} rx={2.4} ry={2.8} color={INK} />
        </Bob>
      </Group>
      {!paused && [0, 1, 2, 3, 4].map((i) => <Spark key={i} t={sparks} index={i} durationS={1.1} />)}
    </>
  );
}

const FLARE_CURVE: Curve = [0.3, 0, 0.2, 1];

function AnsweringFull({ paused }: { paused: boolean }) {
  const flare = useLoop(1400, paused);
  const bursts = useLoop(1400, paused);
  // .em-flare: scale(1.1, 1.14) at 30%, (1.03, 1.05) at 55%.
  const transform = useDerivedValue(() => {
    const stops = [0, 0.3, 0.55, 1];
    return [
      { scaleX: kfCurve(flare.value, stops, [1, 1.1, 1.03, 1], FLARE_CURVE) },
      { scaleY: kfCurve(flare.value, stops, [1, 1.14, 1.05, 1], FLARE_CURVE) },
    ];
  });
  return (
    <>
      <FlickerGlow durationMs={1200} paused={paused} cx={50} cy={56} rx={44} ry={38} />
      <Group origin={vec(50, 90)} transform={transform}>
        <Flames durations={[1000, 800, 600]} paused={paused} palette="hi" />
        <Bob paused={paused}>
          <Path path="M38 68 Q43 62 48 68" style="stroke" strokeWidth={3} strokeCap="round" color={INK} />
          <Path path="M52 68 Q57 62 62 68" style="stroke" strokeWidth={3} strokeCap="round" color={INK} />
          <Path path="M44 75 Q50 83 56 75" color={INK} />
          <Ellipse cx={36} cy={74} rx={3.5} ry={2} color="rgba(244,63,94,0.55)" />
          <Ellipse cx={64} cy={74} rx={3.5} ry={2} color="rgba(244,63,94,0.55)" />
        </Bob>
      </Group>
      {!paused && [0, 1, 2, 3, 4].map((i) => <Burst key={i} t={bursts} index={i} />)}
    </>
  );
}

// The mockup's z is <text> (Geist 11px at x=72 y=44); drawn as a stroke with
// the glyph's proportions (as HootArt does) so no font has to load.
const Z_PATH = 'M72.55 38.41 H76.95 L72.55 43.45 H77.13';

function RestingFull({ paused }: { paused: boolean }) {
  const coal = useLoop(2400, paused);
  const z = useLoop(3000, paused);
  // .em-coal pulses .35 → 1; the second coal (.em-sp3) is delayed 1.4s.
  const coalA = useDerivedValue(() => kf(coal.value, [0, 0.5, 1], [0.35, 1, 0.35]));
  const coalB = useDerivedValue(() => kf(phase(coal.value, -1.4 / 2.4), [0, 0.5, 1], [0.35, 1, 0.35]));
  const zOpacity = useDerivedValue(() => kf(z.value, [0, 0.2, 1], [0, 1, 0], 'ease-out'));
  const zTransform = useDerivedValue(() => [
    { translateX: kf(z.value, [0, 1], [0, 8], 'ease-out') },
    { translateY: kf(z.value, [0, 1], [0, -14], 'ease-out') },
  ]);
  return (
    <>
      <Group opacity={0.6}>
        <GlowShape cx={50} cy={80} rx={34} ry={16} />
      </Group>
      <Group origin={vec(50, 90)} transform={[{ scaleX: 1.06 }, { scaleY: 0.68 }]}>
        <RestingFlames paused={paused} />
      </Group>
      <Path path="M39 77 Q43 80 47 77" style="stroke" strokeWidth={2.4} strokeCap="round" color={INK} />
      <Path path="M53 77 Q57 80 61 77" style="stroke" strokeWidth={2.4} strokeCap="round" color={INK} />
      <Path path="M48 83 Q50 84.5 52 83" style="stroke" strokeWidth={2} strokeCap="round" color={INK} />
      <Ellipse cx={34} cy={91} rx={6} ry={2.6} color="#7F1D1D" />
      <Ellipse cx={50} cy={92} rx={8} ry={2.8} color="#991B1B" />
      <Ellipse cx={66} cy={91} rx={6} ry={2.6} color="#7F1D1D" />
      <Group opacity={coalA}>
        <Circle cx={44} cy={91.5} r={1.3} color="#FB923C" />
      </Group>
      <Group opacity={coalB}>
        <Circle cx={58} cy={91.5} r={1.1} color="#FDBA74" />
      </Group>
      <Group opacity={zOpacity} transform={zTransform}>
        <Path path={Z_PATH} style="stroke" strokeWidth={1} strokeCap="round" strokeJoin="round" color="#A5B4FC" />
      </Group>
    </>
  );
}

// Mini (tab-bar pill): the three flames with big eyes, no glow/sparks. The
// mockup draws it still; here the outlines keep morphing at each mood's
// tempo and palette so the tab bar stays alive.
const MINI_DURATIONS: Record<'idle' | 'thinking' | 'answering' | 'resting', readonly [number, number, number]> = {
  idle: [1600, 1250, 950],
  thinking: [700, 550, 450],
  answering: [1000, 800, 600],
  resting: [2800, 2300, 1900],
};

function Mini({ mood, paused }: { mood: keyof typeof MINI_DURATIONS; paused: boolean }) {
  const blink = useLoop(4000, paused || mood !== 'idle');
  return (
    <>
      {mood === 'resting' ? (
        <RestingFlames paused={paused} />
      ) : (
        <Flames durations={MINI_DURATIONS[mood]} paused={paused} palette={mood === 'answering' ? 'hi' : 'base'} />
      )}
      {mood === 'resting' ? (
        <>
          <Path path="M38.5 69 Q43 72.5 47.5 69" style="stroke" strokeWidth={3} strokeCap="round" color={INK} />
          <Path path="M52.5 69 Q57 72.5 61.5 69" style="stroke" strokeWidth={3} strokeCap="round" color={INK} />
        </>
      ) : (
        <>
          <BlinkEye t={blink} cx={43} cy={68} rx={4.5} ry={6} />
          <BlinkEye t={blink} cx={57} cy={68} rx={4.5} ry={6} />
        </>
      )}
    </>
  );
}

function Idle({ paused, mini }: MoodLayerProps) {
  return mini ? <Mini mood="idle" paused={paused} /> : <IdleFull paused={paused} />;
}
function Thinking({ paused, mini }: MoodLayerProps) {
  return mini ? <Mini mood="thinking" paused={paused} /> : <ThinkingFull paused={paused} />;
}
function Answering({ paused, mini }: MoodLayerProps) {
  return mini ? <Mini mood="answering" paused={paused} /> : <AnsweringFull paused={paused} />;
}
function Resting({ paused, mini }: MoodLayerProps) {
  return mini ? <Mini mood="resting" paused={paused} /> : <RestingFull paused={paused} />;
}

const LAYERS = { idle: Idle, thinking: Thinking, answering: Answering, resting: Resting };

export function EmberArt({ mood, mini, paused }: CharacterArtProps): React.ReactElement {
  return <MoodLayers mood={mood} mini={mini} paused={paused} layers={LAYERS} />;
}
