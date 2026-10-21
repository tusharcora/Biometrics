import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, PixelRatio, ScrollView, Switch, View, findNodeHandle, useWindowDimensions, type Text as RNText } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { fetchIdentity } from '../api/buddies';
import { NeutralRoom } from '../components/room/NeutralRoom';
import { Button } from '../components/ui/button';
import { Text } from '../components/ui/text';
import { useMyKip } from '../lib/kip/myKip';
import { useMyRoom } from '../lib/room/cosmeticsStore';
import { useRoomSocial } from '../lib/room/giftsStore';
import { tierSize } from '../lib/room/iso/geometry';
import { ROOM_COPY } from '../lib/room/roomCopy';
import { shareLines, shareSize } from '../lib/room/shareCard';
import { useRecapExport } from '../lib/useRecapExport';
import type { RootStackParamList } from '../navigation/RootNavigator';

const S = ROOM_COPY.share;
const TARGET = 'h-[44px]';
const PAD = 16;
const TEXT_ROOM = 120; // the card's title, size line and byline under and over the room
const ASPECT = 1.25;
// The card is an image with a fixed text band (TEXT_ROOM): Dynamic Type never grows its lines past it (FINAL-M6).
const CARD_FONT_SCALE = 1;

/** The card as the image shows it: the title, the room, the size line (spoken without "·" or "×") and the byline. */
function Card({ width, height, lines, children }: { width: number; height: number; lines: ReturnType<typeof shareLines>; children: React.ReactNode }) {
  return (
    <View style={{ width, height, backgroundColor: '#0A0B0E', padding: PAD, gap: 8, borderRadius: 12 }}>
      <Text maxFontSizeMultiplier={CARD_FONT_SCALE} className="font-pixel text-page-title text-white">{lines.title}</Text>
      {children}
      <Text maxFontSizeMultiplier={CARD_FONT_SCALE} accessibilityLabel={lines.metaSpoken} className="text-caption tabular-nums text-white">{lines.meta}</Text>
      {lines.byline ? <Text maxFontSizeMultiplier={CARD_FONT_SCALE} className="text-caption text-white">{lines.byline}</Text> : null}
    </View>
  );
}

// The share card (spec 2026-10-15 §10.5, F8; P4 rulings 23, 24): your SAVED room (never an unsaved draft) drawn
// neutral (no `living`, the fallback sky, no `live`: the card stays still, T11-FIX), "KIP's room", the size and pieces
// and the theme's week while one is live, your first name only when switched on, KIP waving unless switched off. The
// card is captured from an off-screen view 1080 px wide through lib/recapCapture.ts; nothing leaves the phone until
// Save image or Share…. A refused Photos permission or a failed capture reads in the result line (a live region).
// Focus lands on the heading; Close (and back) leaves (PF4-F16). Nothing here is logged.
export function ShareRoomScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'ShareRoom'>>();
  const { layout, tier } = useMyRoom();
  const me = useMyKip();
  const social = useRoomSocial();
  const { width } = useWindowDimensions();
  const [name, setName] = useState<string | null>(null);
  const [showName, setShowName] = useState(false);
  const [waves, setWaves] = useState(true);
  const { exportRef, busy, notice, save, share, clear } = useRecapExport({ dialogTitle: S.dialog });
  // A switch changes the card, so the last Save or Share result no longer describes it (FINAL-M6).
  const onShowName = (v: boolean) => { setShowName(v); clear(); };
  const onWaves = (v: boolean) => { setWaves(v); clear(); };
  const headRef = useRef<RNText>(null);
  useEffect(() => {
    let live = true;
    // The name is read for the switch only; it is never shown unless switched on, and none hides the byline.
    fetchIdentity()
      .then((i) => { if (live) setName(i?.displayName ?? null); })
      .catch(() => { if (live) setName(null); });
    const node = headRef.current ? findNodeHandle(headRef.current) : null;
    if (node) AccessibilityInfo.setAccessibilityFocus(node);
    return () => {
      live = false;
    };
  }, []);
  // The theme's week only while it is live and this build knows its words (a newer server's theme reads no line).
  const themes: Readonly<Record<string, { title: string }>> = ROOM_COPY.challenge.themes;
  const themeId = social.challenge?.live ? social.challenge.themeId : null;
  const themeTitle = themeId && Object.prototype.hasOwnProperty.call(themes, themeId) ? themes[themeId]!.title : null;
  const lines = shareLines({ size: tierSize(tier), pieces: layout.pieces.length, themeTitle, name, showName });
  const room = (w: number, h: number, testID: string) => (
    <NeutralRoom testID={testID} layout={layout} tier={tier} colour={me.colour} worn={me.worn} pose={waves ? 'wave' : 'rest'} bubble={null} width={w} height={h} label={S.label} />
  );
  const out = shareSize(PixelRatio.get());
  const preview = Math.min(width - 2 * PAD, 360);
  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-background">
      <View className="flex-row items-center justify-between gap-2 px-4 pb-2 pt-1">
        <Text ref={headRef} testID="share-title" accessibilityRole="header" className="shrink text-heading">{S.heading}</Text>
        <Button testID="share-close" variant="ghost" className={TARGET} onPress={() => navigation.goBack()}>{S.close}</Button>
      </View>
      <ScrollView contentContainerStyle={{ padding: PAD, paddingTop: 4, gap: 12 }}>
        <Text className="text-caption text-muted-foreground">{S.note}</Text>
        <Card width={preview} height={preview * ASPECT} lines={lines}>{room(preview - 2 * PAD, preview * ASPECT - TEXT_ROOM, 'share-preview')}</Card>
        <View className="min-h-[44px] flex-row items-center justify-between gap-2">
          <Text className="shrink text-body">{S.showName}</Text>
          <Switch testID="share-name" accessibilityLabel={S.showName} value={showName} onValueChange={onShowName} />
        </View>
        <View className="min-h-[44px] flex-row items-center justify-between gap-2">
          <Text className="shrink text-body">{S.waves}</Text>
          <Switch testID="share-waves" accessibilityLabel={S.waves} value={waves} onValueChange={onWaves} />
        </View>
        <Button testID="share-save" className={TARGET} disabled={busy} onPress={() => void save()}>{S.save}</Button>
        <Button testID="share-share" variant="outline" className={TARGET} disabled={busy} onPress={() => void share()}>{S.share}</Button>
        <Text testID="share-notice" accessibilityLiveRegion="polite" className="text-caption text-muted-foreground">{notice ? S.notices[notice] : ''}</Text>
        <Text className="text-caption text-muted-foreground">{S.footer}</Text>
      </ScrollView>
      {/* The export view: off-screen, 1080 px wide, the only thing captured (the recap card's pattern). */}
      <View testID="share-export-wrap" pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: 'absolute', left: -10000, top: 0 }}>
        <View ref={exportRef} collapsable={false}>
          <Card width={out.width} height={out.height} lines={lines}>{room(out.width - 2 * PAD, out.height - TEXT_ROOM, 'share-export')}</Card>
        </View>
      </View>
    </SafeAreaView>
  );
}
