import React, { useRef, useState } from 'react';
import { Modal, PixelRatio, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useReducedMotion } from 'react-native-reanimated';
import { useCharacterOptional } from '../../characters/CharacterContext';
import { LOCKED_PIP, mixHex, tierColors } from '../../lib/badgeArt';
import { coachLine, levelTitle, valueLine } from '../../lib/badges';
import type { Celebration } from '../../lib/celebrationQueue';
import { EXPORT_NOTICES, useRecapExport } from '../../lib/useRecapExport';
import { FONTS } from '../../theme';
import { Character } from '../characters/Character';
import { hexAlpha } from '../characters/palette';
import { characterInfo } from '../characters/registry';
import { DEFAULT_CHARACTER_ID } from '../characters/types';
import { pixelFont } from '../coach/thinking/shared';
import { Text } from '../ui/text';
import { BadgeIcon } from './BadgeIcon';
import { BadgeShareCard, badgeShareLayout } from './BadgeShareCard';

export interface CelebrationModalProps {
  celebration: Celebration;
  thresholds: readonly number[];
  onDone: () => void;
}

// Pixel confetti from the canvas (Unlock.dc.html): fixed spots and colours. None under Reduce Motion.
const CONFETTI: ReadonlyArray<readonly [number, number]> = [[40, 120], [320, 96], [70, 300], [330, 260], [24, 210], [350, 180], [110, 70], [270, 60], [56, 420], [338, 400], [190, 40], [300, 340]];
const CONFETTI_COLORS = ['#FACC15', '#F9A8D4', '#5EEAD4', '#FDE68A', '#FDBA74'];
const INK = '#FAFAF9';
// The failed-share notice, as on the recap story viewer's dark ground.
const NOTICE_INK = '#FCA5A5';

// The unlock celebration (spec 2026-10-06 §6; canvas Unlock.dc.html): full screen, on a ground
// tinted by the new tier — the badge with the coach beside it, the level pips, the level name and
// value, the coach's fixed line, Share (a 1080 px badge card) and "Nice!", which closes it.
// One Modal stays presented while the queue lasts and the next family swaps in inside it: on iOS a
// Modal presented in the same commit another one starts dismissing is dropped.
export function CelebrationModal({ celebration, thresholds, onDone }: CelebrationModalProps) {
  const reduceMotion = useReducedMotion();
  return (
    <Modal visible transparent={false} animationType={reduceMotion ? 'none' : 'fade'} presentationStyle="fullScreen" onRequestClose={onDone}>
      <CelebrationContent key={`${celebration.family}-${celebration.level}`} celebration={celebration} thresholds={thresholds} onDone={onDone} />
    </Modal>
  );
}

/** One family's celebration: remounted per family, so its share and close state start afresh. */
function CelebrationContent({ celebration, thresholds, onDone }: CelebrationModalProps) {
  const reduceMotion = useReducedMotion();
  const characterId = useCharacterOptional()?.characterId ?? DEFAULT_CHARACTER_ID;
  const accent = characterInfo(characterId).accent;
  const { family, level, value } = celebration;
  const t = tierColors(level, accent);
  const ground = mixHex(t.ring, '#0B0B0F', 0.9);
  const pixel = pixelFont();
  const { exportRef, busy, notice, share } = useRecapExport();
  const layout = badgeShareLayout(PixelRatio.get());
  // Two presses in one frame both see closing === false; the ref lets only the first through.
  const closed = useRef(false);
  const [closing, setClosing] = useState(false);
  const close = () => {
    if (closed.current) return;
    closed.current = true;
    setClosing(true);
    onDone();
  };

  return (
    <View testID="celebration-screen" style={{ flex: 1, backgroundColor: ground }}>
      {reduceMotion ? null : (
        <View testID="celebration-confetti" pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
          {CONFETTI.map(([x, y], i) => (
            <View key={i} style={{ position: 'absolute', left: x, top: y, width: i % 3 ? 6 : 9, height: i % 3 ? 6 : 9, backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length], opacity: 0.85 }} />
          ))}
        </View>
      )}
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={{ flex: 1, alignItems: 'center', gap: 18, paddingHorizontal: 24, paddingTop: 40, paddingBottom: 24 }}>
          <Text style={{ fontFamily: pixel, fontSize: 14, letterSpacing: 2, color: t.ring }}>NEW BADGE LEVEL</Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 12 }}>
            <BadgeIcon testID="celebration-badge" family={family} level={level} size={190} pips={false} coachAccent={accent} />
            <View testID="celebration-coach" style={{ marginLeft: -40, marginBottom: -10 }}>
              <Character characterId={characterId} mood="idle" size={86} />
            </View>
          </View>
          <View testID="celebration-pips" style={{ flexDirection: 'row', gap: 6 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <View key={i} style={{ width: 12, height: 12, backgroundColor: i <= level ? t.ring : LOCKED_PIP }} />
            ))}
          </View>
          <Text testID="celebration-title" style={{ fontFamily: pixel, fontSize: 26, lineHeight: 30, textAlign: 'center', color: INK }}>
            {levelTitle(family, level).toUpperCase()}
          </Text>
          <Text testID="celebration-value" style={{ fontFamily: FONTS.sans, fontSize: 17, lineHeight: 24, textAlign: 'center', color: t.glyph }}>
            {valueLine(family, value)}
          </Text>
          <View style={{ alignSelf: 'stretch', flexDirection: 'row', gap: 12, alignItems: 'center', borderWidth: 1, borderColor: hexAlpha(t.ring, 0.3), backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 18, paddingVertical: 14, paddingHorizontal: 16 }}>
            <Character characterId={characterId} mood="idle" size={36} />
            <Text testID="celebration-coach-line" style={{ flex: 1, fontFamily: FONTS.sans, fontSize: 15, lineHeight: 21, color: INK }}>
              {coachLine(family, level, thresholds)}
            </Text>
          </View>
          <View style={{ flex: 1 }} />
          {notice ? (
            <Text testID="celebration-notice" accessibilityLiveRegion="polite" style={{ fontFamily: FONTS.sans, fontSize: 14, lineHeight: 20, textAlign: 'center', color: NOTICE_INK }}>
              {EXPORT_NOTICES[notice]}
            </Text>
          ) : null}
          <View style={{ alignSelf: 'stretch', flexDirection: 'row', gap: 10 }}>
            <Pressable
              testID="celebration-share"
              accessibilityRole="button"
              accessibilityState={{ disabled: busy }}
              disabled={busy}
              onPress={() => void share()}
              style={{ flex: 1, height: 52, borderRadius: 26, borderWidth: 1, borderColor: hexAlpha(t.ring, 0.5), alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.5 : 1 }}
            >
              <Text style={{ fontFamily: FONTS.sansSemibold, fontSize: 16, color: INK }}>Share</Text>
            </Pressable>
            <Pressable
              testID="celebration-done"
              accessibilityRole="button"
              accessibilityState={{ disabled: closing }}
              disabled={closing}
              onPress={close}
              style={{ flex: 1, height: 52, borderRadius: 26, backgroundColor: t.ring, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ fontFamily: FONTS.sansBold, fontSize: 16, color: ground }}>Nice!</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
      {/* The export view: off screen at a fixed size, the only thing captured. */}
      <View pointerEvents="none" style={{ position: 'absolute', left: -10000, top: 0 }}>
        <View ref={exportRef} collapsable={false} testID="celebration-export" style={{ width: layout.width, height: layout.height }}>
          <BadgeShareCard family={family} level={level} value={value} coachAccent={accent} scale={layout.scale} />
        </View>
      </View>
    </View>
  );
}
