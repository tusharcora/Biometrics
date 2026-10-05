import React from 'react';
import { Text, View } from 'react-native';
import type { Recap } from '../../api/recaps';
import { weekdayName, weekRange } from '../../lib/recapCopy';
import { APP_NAME, fitQuote, PIXEL_ADVANCE_EM, QUOTE_LINE_HEIGHT, QUOTE_MIN_FONT_SCALE, quoteLines, type Includes } from '../../lib/recapShare';
import { coachFrameStats, coachFrameText, headlineStats, STORY_FRAME_COUNT, storyEyebrow, stripDays, type StoryFrameIndex } from '../../lib/recapStory';
import { CHANGE_COLORS, recapTint, type RecapTint } from '../../lib/recapTheme';
import { formatTextDuration } from '../../lib/sleepStats';
import { FONTS } from '../../theme';
import { Character, DIMMED_OPACITY } from '../characters/Character';
import { characterInfo } from '../characters/registry';
import type { CharacterId } from '../characters/types';
import { pixelFont } from '../coach/thinking/shared';
import { ShareCanvas } from './ShareCanvas';

export { STORY_FRAME_COUNT } from '../../lib/recapStory';
export type { StoryFrameIndex } from '../../lib/recapStory';

// The weekly story (recap restyle, 1a): three 9:16 frames on the 360×640 design grid × scale,
// each exported on its own at 1080×1920. Every frame shares the chrome: a three-segment progress
// bar and the "MY WEEK · N OF 3" eyebrow, on the coach's tinted, dotted ground.
const W = 360;
const H = 640;
const PAD_X = 24;
const PAD_Y = 28;
const CONTENT_W = W - 2 * PAD_X;
const CONTENT_H = H - 2 * PAD_Y;
const GAP = 16;
/** Height of the progress bar's row and the eyebrow's line (design units). */
export const STORY_PROGRESS_HEIGHT = 3;
const EYEBROW_LINE = 18;
const FOOTER_LINE = 18;
const CARD_CHROME = 2 + 16 + 16 + 6 + 16; // border, padding, label line, gap, padding
const CARD_VALUE_LINE = 30;
const STRIP = 38 + 4 + 14;
const QUOTE_BASE = 16;
const STORY_BASE = 18;

/** The design's padding, so an overlay (the story viewer's own animated bar) can sit exactly on the frame's. */
export const STORY_FRAME_INSETS = { top: PAD_Y, left: PAD_X, right: PAD_X, bottom: PAD_Y } as const;

export interface WeeklyStoryFrameProps {
  recap: Recap;
  coachId: CharacterId;
  includes: Includes;
  scale: number;
  index: StoryFrameIndex;
  /**
   * Draw the static progress bar (frames up to this one filled). The story viewer passes false and
   * draws its own animated bar over the same spot; the room is kept either way.
   */
  showProgress?: boolean;
  testID?: string;
}

export interface StoryProgressProps {
  tint: RecapTint;
  index: number;
  scale: number;
  count?: number;
  /** How far the current segment is filled, 0–1 (1 for an exported frame). */
  progress?: number;
  testID?: string;
}

/** The three-segment bar: segments before `index` full, `index` at `progress`, the rest a track. */
export function StoryProgress({ tint, index, scale, count = STORY_FRAME_COUNT, progress = 1, testID = 'story-progress' }: StoryProgressProps) {
  const u = (n: number) => n * scale;
  return (
    <View testID={testID} style={{ flexDirection: 'row', gap: u(4), height: u(STORY_PROGRESS_HEIGHT) }}>
      {Array.from({ length: count }, (_, i) => {
        const fill = i < index ? 1 : i === index ? Math.max(0, Math.min(1, progress)) : 0;
        return (
          <View key={i} testID={`${testID}-${i}`} accessibilityLabel={`${Math.round(fill * 100)}%`} style={{ flex: 1, borderRadius: u(2), backgroundColor: tint.track, overflow: 'hidden' }}>
            <View style={{ width: `${fill * 100}%`, height: '100%', backgroundColor: tint.text }} />
          </View>
        );
      })}
    </View>
  );
}

/** One frame of the weekly story, renderable (and capturable) on its own by index. */
export function WeeklyStoryFrame({ recap, coachId, includes, scale, index, showProgress = true, testID = 'recap-story' }: WeeklyStoryFrameProps) {
  const u = (n: number) => n * scale;
  const t = recapTint(coachId);
  const pixel = pixelFont();
  const range = weekRange(recap.periodStart, recap.periodEnd);
  return (
    <ShareCanvas
      testID={testID}
      tint={t}
      width={u(W)}
      height={u(H)}
      dotSpacing={u(14)}
      dotRadius={u(1.2)}
      style={{ paddingHorizontal: u(PAD_X), paddingVertical: u(PAD_Y), gap: u(GAP) }}
    >
      <View testID={`${testID}-progress-slot`} style={{ opacity: showProgress ? 1 : 0 }}>
        <StoryProgress tint={t} index={index} scale={scale} testID={`${testID}-progress`} />
      </View>
      <Text testID={`${testID}-eyebrow`} style={{ fontFamily: pixel, fontSize: u(13), lineHeight: u(EYEBROW_LINE), letterSpacing: u(1.04), color: t.accentText }}>
        {storyEyebrow(index)}
      </Text>
      {index === 0 ? <HeadlineBody recap={recap} coachId={coachId} includes={includes} u={u} t={t} pixel={pixel} testID={testID} /> : null}
      {index === 1 ? <CoachSawBody recap={recap} coachId={coachId} includes={includes} u={u} t={t} pixel={pixel} testID={testID} /> : null}
      {index === 2 ? <CoachStoryBody recap={recap} coachId={coachId} includes={includes} u={u} t={t} pixel={pixel} testID={testID} /> : null}
      {index === 2 ? (
        <View style={{ marginTop: 'auto', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: u(1), borderTopColor: t.hairline, paddingTop: u(16) }}>
          <Text style={{ fontFamily: FONTS.sans, fontSize: u(14), lineHeight: u(FOOTER_LINE), color: t.soft }}>Find your coach</Text>
          <Text testID={`${testID}-app`} style={{ fontFamily: pixel, fontSize: u(12), lineHeight: u(FOOTER_LINE), color: t.accentText }}>{APP_NAME}</Text>
        </View>
      ) : (
        <View style={{ marginTop: 'auto', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text testID={`${testID}-range`} style={{ fontFamily: FONTS.sans, fontSize: u(13), lineHeight: u(FOOTER_LINE), color: t.muted }}>{range}</Text>
          <Text testID={`${testID}-app`} style={{ fontFamily: pixel, fontSize: u(12), lineHeight: u(FOOTER_LINE), color: t.accentText }}>{APP_NAME}</Text>
        </View>
      )}
    </ShareCanvas>
  );
}

/** Frame 2 on its own: the in-app preview of the weekly recap shows it. */
export function WeeklyStoryView(props: Omit<WeeklyStoryFrameProps, 'index'> & { index?: StoryFrameIndex }) {
  return <WeeklyStoryFrame {...props} index={props.index ?? 1} />;
}

interface BodyProps {
  recap: Recap;
  coachId: CharacterId;
  includes: Includes;
  u: (n: number) => number;
  t: RecapTint;
  pixel: string;
  testID: string;
}

function Label({ children, u, t }: { children: string; u: BodyProps['u']; t: RecapTint }) {
  return <Text style={{ fontFamily: FONTS.sansMedium, fontSize: u(12), lineHeight: u(16), letterSpacing: u(0.72), color: t.muted }}>{children.toUpperCase()}</Text>;
}

function cardStyle(u: BodyProps['u'], t: RecapTint) {
  return { backgroundColor: t.surface, borderWidth: u(1), borderColor: t.border, borderRadius: u(18), padding: u(16), gap: u(6) } as const;
}

/** Frame 1: "My week" and its big numbers. */
function HeadlineBody({ recap, coachId, includes, u, t, pixel, testID }: BodyProps) {
  const stats = headlineStats(recap.stats);
  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: u(16) }}>
        {includes.coach ? (
          <View testID={`${testID}-coach`}>
            <Character characterId={coachId} mood="idle" size={Math.round(u(96))} paused />
          </View>
        ) : null}
        <Text testID={`${testID}-title`} style={{ flex: 1, fontFamily: pixel, fontSize: u(40), lineHeight: u(44), color: t.text }}>My week</Text>
      </View>
      {stats.length > 0 ? (
        stats.map((s) => (
          <View key={s.key} testID={`${testID}-stat-${s.key}`} style={cardStyle(u, t)}>
            <Label u={u} t={t}>{s.label}</Label>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={{ fontFamily: FONTS.sansBold, fontSize: u(44), lineHeight: u(52), color: s.tone ? (s.tone === 'same' ? t.muted : CHANGE_COLORS[s.tone]) : t.text }}
            >
              {s.value}
            </Text>
          </View>
        ))
      ) : (
        // A week without its numbers still says something: the coach's line.
        <Text testID={`${testID}-quote`} numberOfLines={8} adjustsFontSizeToFit style={{ fontFamily: FONTS.sans, fontSize: u(20), lineHeight: u(28), color: t.soft }}>
          {`“${recap.line}”`}
        </Text>
      )}
    </>
  );
}

/** Frame 2 (the design's artboard): the week as seven coaches, the best night and the line. */
function CoachSawBody({ recap, coachId, includes, u, t, pixel, testID }: BodyProps) {
  const name = characterInfo(coachId).name;
  const title = `How ${name} saw my week`;
  const days = stripDays(recap.stats.weekStrip ?? []);
  const best = includes.bestNight ? recap.stats.bestNight : undefined;
  const quote = `“${recap.line}”`;
  // The line gets what the frame leaves after the other blocks and a 16pt gap between each.
  const titleH = quoteLines(title, 30, CONTENT_W, PIXEL_ADVANCE_EM) * 33;
  const blocks = [STORY_PROGRESS_HEIGHT, EYEBROW_LINE, titleH, STRIP, best ? CARD_CHROME + CARD_VALUE_LINE : 0, CARD_CHROME, FOOTER_LINE].filter((h) => h > 0);
  const quoteBox = CONTENT_H - blocks.reduce((x, y) => x + y, 0) - (blocks.length - 1) * GAP - 8;
  const fit = fitQuote(quote, CONTENT_W - 34, quoteBox, QUOTE_BASE);
  const state = { goal: 'on goal', short: 'short', none: 'no data' } as const;
  return (
    <>
      <Text testID={`${testID}-title`} numberOfLines={3} adjustsFontSizeToFit style={{ fontFamily: pixel, fontSize: u(30), lineHeight: u(33), color: t.text }}>
        {title}
      </Text>
      <View testID={includes.coach ? `${testID}-coach` : undefined} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {days.map((d) => (
          <View key={d.date} testID={`${testID}-day-${d.date}`} accessibilityLabel={`${d.letter}: ${state[d.state]}`} style={{ alignItems: 'center', gap: u(4) }}>
            <View testID={`${testID}-sprite-${d.date}`} style={{ width: u(38), height: u(38), alignItems: 'center', justifyContent: 'center', opacity: d.dimmed ? DIMMED_OPACITY : 1 }}>
              {includes.coach ? (
                <Character characterId={coachId} mood="idle" size={Math.round(u(38))} paused />
              ) : (
                <View style={{ width: u(30), height: u(30), borderRadius: u(6), backgroundColor: t.accent }} />
              )}
            </View>
            <Text style={{ fontFamily: FONTS.sans, fontSize: u(11), lineHeight: u(14), color: t.muted }}>{d.letter}</Text>
          </View>
        ))}
      </View>
      {best ? (
        <View testID={`${testID}-best`} style={cardStyle(u, t)}>
          <Label u={u} t={t}>Best night</Label>
          <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: FONTS.sansBold, fontSize: u(24), lineHeight: u(CARD_VALUE_LINE), color: t.text }}>
            {`${weekdayName(best.date)} · ${formatTextDuration(best.minutesAsleep)}`}
          </Text>
        </View>
      ) : null}
      {includes.quote ? (
        <View testID={`${testID}-says`} style={[cardStyle(u, t), { flexShrink: 1, minHeight: 0 }]}>
          <Label u={u} t={t}>{`${name} says`}</Label>
          <Text
            testID={`${testID}-quote`}
            numberOfLines={fit.lines + 1}
            adjustsFontSizeToFit
            minimumFontScale={QUOTE_MIN_FONT_SCALE}
            style={{ flexShrink: 1, fontFamily: FONTS.sans, fontSize: u(fit.fontSize), lineHeight: u(fit.fontSize * QUOTE_LINE_HEIGHT), color: t.text }}
          >
            {quote}
          </Text>
        </View>
      ) : null}
    </>
  );
}

/** Frame 3: the coach's weekly story (the line when there is none), the streak and the spread. */
function CoachStoryBody({ recap, coachId, includes, u, t, pixel, testID }: BodyProps) {
  const name = characterInfo(coachId).name;
  const text = coachFrameText(recap);
  const stats = coachFrameStats(recap.stats);
  const header = includes.coach ? 72 : 30;
  const footer = 1 + 16 + FOOTER_LINE;
  const blocks = [STORY_PROGRESS_HEIGHT, EYEBROW_LINE, header, stats.length > 0 ? CARD_CHROME + CARD_VALUE_LINE : 0, footer].filter((h) => h > 0);
  // The text is the fifth block, so one more gap.
  const box = CONTENT_H - blocks.reduce((x, y) => x + y, 0) - blocks.length * GAP - 8;
  const fit = fitQuote(text, CONTENT_W, box, STORY_BASE);
  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: u(16) }}>
        {includes.coach ? (
          <View testID={`${testID}-coach`}>
            <Character characterId={coachId} mood="idle" size={Math.round(u(72))} paused />
          </View>
        ) : null}
        <Text testID={`${testID}-title`} numberOfLines={2} adjustsFontSizeToFit style={{ flex: 1, fontFamily: pixel, fontSize: u(26), lineHeight: u(30), color: t.text }}>
          {`Notes from ${name}`}
        </Text>
      </View>
      <Text
        testID={`${testID}-story`}
        numberOfLines={fit.lines + 1}
        adjustsFontSizeToFit
        minimumFontScale={QUOTE_MIN_FONT_SCALE}
        style={{ flexShrink: 1, fontFamily: FONTS.sans, fontSize: u(fit.fontSize), lineHeight: u(fit.fontSize * QUOTE_LINE_HEIGHT), color: t.text }}
      >
        {text}
      </Text>
      {stats.length > 0 ? (
        <View style={{ flexDirection: 'row', gap: u(12) }}>
          {stats.map((s) => (
            <View key={s.key} testID={`${testID}-stat-${s.key}`} style={[cardStyle(u, t), { flex: 1 }]}>
              <Label u={u} t={t}>{s.label}</Label>
              <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: FONTS.sansBold, fontSize: u(24), lineHeight: u(CARD_VALUE_LINE), color: t.text }}>
                {s.value}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </>
  );
}
