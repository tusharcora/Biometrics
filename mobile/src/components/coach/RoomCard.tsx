import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, Pressable, View, type ViewProps } from 'react-native';
import { ApiError } from '../../api/client';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { SectionLabel } from '../ui/section-label';
import { Skeleton } from '../ui/skeleton';
import { Text } from '../ui/text';
import { HotTag } from '../home/HotTag';
import { RoomWelcomeCard } from './RoomWelcomeCard';
import { RoomRadio } from '../room/RoomRadio';
import { RoomGiftBoxes, giftBoxTiles } from '../room/RoomGiftBoxes';
import { RoomView, type RoomViewHandle } from '../room/RoomView';
import { useRoomEffects } from '../room/useRoomEffects';
import { useCoinsLanding } from '../coins/useCoinsLanding';
import { HOME_COPY } from '../../lib/homeCopy';
import { buddyErrorMessage } from '../../lib/buddyCopy';
import { useMyKip } from '../../lib/kip/myKip';
import { KIP_COPY } from '../../lib/kipCopy';
import { hotTagLabel, roomLabel, type KipStage } from '../../lib/kipStage';
import { cardPieces, pieceTap } from '../../lib/room/card';
import { markWelcomed, useCosmetics, useMyRoom } from '../../lib/room/cosmeticsStore';
import { effectOf, type RoomEffects } from '../../lib/room/effects';
import { MAX_BOXES } from '../../lib/room/gifts';
import { loadRoomSocial, openGiftNow, useRoomSocial } from '../../lib/room/giftsStore';
import type { RoomLayout } from '../../lib/room/iso/geometry';
import { ROOM_COPY, itemName, spokenName } from '../../lib/room/roomCopy';
import type { KipLook } from '../../lib/useKipTurn';
import type { RoomWeather } from '../../lib/room/weather';
import type { ScoreBand } from '../../lib/scoreInsights';
import { useScreenFocused } from '../../lib/useScreenFocused';
import { COLORS } from '../../theme';

export const ROOM_FRAME_HEIGHT = 240;
const WOOD = '#5B4636';
const WOOD_LINE = '#3A2D23';

/** A running radio is in the room (spec §8.2): only then is its sound mounted. */
export function runsSound(layout: RoomLayout, effects: RoomEffects): boolean {
  return layout.pieces.some((p) => effects.running.has(p.id) && effectOf(p.item) === 'sound');
}

// The W7 room card (spec 2026-10-14 KIP Coach §3.1, §3.2; spec 2026-10-15 §9.1): KIP's isometric room as a framed
// diorama, cropped on KIP's desk (crop, never shrink: the inner width is measured, the height fixed at 240), a caption
// row with the RECOVERY hot tag, an optional footer ("Shrink room", passed in by the page) and, last, the page's
// first-week list (spec 2026-10-15 §11.2). The frame is part of the picture, not a button; a long-press on the room
// opens the editor (§5.1), and a tap opens a piece card (spec 2026-10-15 §8.1). The tag keeps Home's dark-palette colours in both themes, as on the scene. `look` is KIP
// mid-turn (useKipTurn); without it the stage's pose and mood are drawn. The room is your saved layout, with KIP in
// what it wears; `paused` stops its loops while the editor is open (Spec B ruling 17). Until the first-week welcome is
// answered it sits under the frame and KIP says "WELCOME HOME!" (spec 2026-10-15 §11.1, plan ruling 18); both of its
// buttons record it for every device. Coins that landed since the last look show once in KIP's bubble, with a line
// under the room (spec 2026-10-15 §6.7). Gifts from buddies wait on the floor as boxes over the room, at most 3, and
// a tap opens one into the inventory with NEW; a line says one came unless its sender is muted (spec §10.3, rulings
// 13-14). This week's cheers on the room open who cheered (spec §10.2). Both are read on each focus.
export function RoomCard({ stage, look, window, recovery, reduceMotion, paused, holdCoins, holdClock, kipWalks, onOpenRecovery, onDecorate, onOpenPiece, onPlaceLantern, onOpenCheers, onOpenChallenge, footer, children, onLayout }: {
  stage: KipStage;
  look?: KipLook;
  window: { weather: RoomWeather; night: boolean };
  recovery: { score: number | null; band: ScoreBand | null };
  reduceMotion: boolean;
  paused?: boolean;
  /** Keeps landing coins waiting, unseen: the page does not know yet whether the card is shrunk (ruling PF-F13). */
  holdCoins?: boolean;
  /** The card is scrolled under the collapsed header: its clock keeps its minute (ruling T5-FIX). */
  holdClock?: boolean;
  /** The page's part of when KIP may walk (spec §9.2): no turn running and the prompt bar blurred. */
  kipWalks?: boolean;
  onOpenRecovery: () => void;
  /** Long-press on the room opens the editor (spec 2026-10-15 §5.1). */
  onDecorate?: () => void;
  /** A piece card (spec 2026-10-15 §8.1): a tap on an effect piece or a plant, or the room image's action. */
  onOpenPiece?: (pieceId: string) => void;
  /** The welcome card's Place the lantern: opens the guided first placement (spec §11.1). */
  onPlaceLantern?: () => void;
  /** The room's cheers this week (spec §10.2): who cheered. */
  onOpenCheers?: () => void;
  /** The weekly room challenge (spec §10.4; ruling 22), while a theme is live. */
  onOpenChallenge?: () => void;
  footer?: React.ReactNode;
  /** Drawn last in the card: the first-week list (spec 2026-10-15 §11.2). */
  children?: React.ReactNode;
  onLayout?: ViewProps['onLayout'];
}) {
  const me = useMyKip();
  const { layout, tier, living } = useMyRoom();
  // Only which pieces run matters here, never the time, so this copy of the effects keeps no minute timer.
  const effects = useRoomEffects(layout, tier, living, { hold: true });
  const cosmetics = useCosmetics();
  const welcome = !!cosmetics && !cosmetics.welcomed && stage.id !== 'loading';
  const [inner, setInner] = useState(0);
  const focused = useScreenFocused();
  // Coins land in KIP's bubble (spec §6.7, ruling 12) only once it is really on screen (ruling PF-F13): the room drawn,
  // the page focused, never over the welcome and never while the editor covers the room.
  const landing = useCoinsLanding(stage.id !== 'loading' && inner > 0 && focused && !paused && !holdCoins && !welcome);
  // KIP walks between answers only in the idle stage with nothing in its bubble, and only while the card is really in
  // view: not under the editor, the collapsed header or a held coin landing (ruling 13).
  const walks = !!kipWalks && stage.id === 'idle' && !stage.bubble && !welcome && !landing && !paused && !holdCoins && !holdClock;
  // The radio plays only while the room is really on screen (ruling 15, PF3-AUDIO): drawn, the page focused (a sheet
  // over it, such as the piece card, blurs it), the editor not over it, and the card neither under the collapsed header
  // nor waiting to know whether it is shrunk.
  const audible = stage.id !== 'loading' && inner > 0 && focused && !paused && !holdCoins && !holdClock;
  // The cat wanders under the same holds (FINAL-FIX M3): RoomView adds focus, the pause, holdClock and Reduce Motion;
  // the held coins are the card's own.
  const catWanders = !holdCoins;
  // A tap on the room (spec §8.1, rulings 16-17): a running tap piece squashes, an effect piece or a plant opens its
  // card, anything else (the rug, the desk) does nothing; a tap on a walking KIP finds the piece behind it (T13-TAP).
  // When the card closes, a screen reader's focus comes back to the room image (the house pattern): only after a card,
  // never after another trip away.
  const roomRef = useRef<RoomViewHandle>(null);
  const cardOpen = useRef(false);
  const openPiece = (id: string) => {
    if (!onOpenPiece) return;
    cardOpen.current = true;
    onOpenPiece(id);
  };
  const onRoomPress = (x: number, y: number) => {
    const id = roomRef.current?.pieceAtPoint(x, y);
    if (!id) return;
    const tap = pieceTap(layout, id, effects);
    if (tap === 'squash') roomRef.current?.squash(id);
    else if (tap === 'card') openPiece(id);
  };
  const cardAway = useRef(false);
  useEffect(() => {
    if (!cardOpen.current) return;
    if (!focused) {
      cardAway.current = true;
    } else if (cardAway.current) {
      cardOpen.current = false;
      cardAway.current = false;
      roomRef.current?.focus();
    }
  }, [focused]);
  const landLine = landing ? ROOM_COPY.coins.landLine(ROOM_COPY.coins.landed[landing.kind], landing.more) : '';

  // Gifts and cheers (spec §10.2, §10.3), read on each focus. The boxes' tiles are kept free of the cat and KIP
  // (PF4-F8): the same tiles RoomGiftBoxes draws on.
  const social = useRoomSocial();
  const [giftLine, setGiftLine] = useState<{ text: string; spoken: string } | null>(null);
  const [opening, setOpening] = useState(false);
  // `opening` disables only after a re-render; two taps in one frame open once (T10-FIX M1).
  const inFlight = useRef(false);
  useEffect(() => {
    if (!focused) return;
    // Back on the page, an old "is in your inventory" line has been read: the floor speaks for itself again.
    setGiftLine(null);
    void loadRoomSocial();
  }, [focused]);
  const boxCount = social.gifts.length;
  const boxTiles = giftBoxTiles(boxCount, layout, tier, inner, ROOM_FRAME_HEIGHT);
  const boxKey = boxTiles.map(([i, j]) => `${i},${j}`).join(';');
  // Fewer free tiles in view than boxes due (a full room, a narrow card): the gifts with no box wait behind one
  // button that opens the next of them, a muted sender's too, so every gift can be opened (T10-FIX I1).
  const roomShown = stage.id !== 'loading' && inner > 0;
  const boxless = roomShown && boxTiles.length < Math.min(boxCount, MAX_BOXES) ? social.gifts.slice(boxTiles.length) : [];
  const avoid = useMemo(() => new Set(boxKey ? boxKey.split(';') : []), [boxKey]);
  // A muted sender's gift arrives without a notice (ruling 13): its box shows, its line does not. The count is of the
  // gifts that may say so (PF4 F27).
  const loud = social.gifts.filter((g) => !g.quiet);
  const arrived = loud.length > 1 ? ROOM_COPY.gifts.many(loud.length) : loud.length === 1 ? ROOM_COPY.gifts.arrived(loud[0]!.from?.name ?? null) : null;
  const line = giftLine ?? (arrived ? { text: arrived, spoken: arrived } : null);
  const say = (text: string, spoken = text) => {
    setGiftLine({ text, spoken });
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(spoken);
  };
  const openBox = async (id: string) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setOpening(true);
    try {
      const item = await openGiftNow(id);
      if (item) say(ROOM_COPY.gifts.opened(itemName(item)), ROOM_COPY.gifts.opened(spokenName(item)));
      else say(buddyErrorMessage('gift_gone'));
    } catch (e) {
      // try_later or offline: the box stays, and a tap tries again.
      say(e instanceof ApiError ? buddyErrorMessage(e.code ?? null) : ROOM_COPY.gifts.openFailed);
    } finally {
      inFlight.current = false;
      setOpening(false);
    }
  };
  return (
    <Card testID="kip-room-card" className="gap-3 p-3.5" onLayout={onLayout}>
      <View testID="kip-room-frame" style={{ borderWidth: 2, borderColor: WOOD_LINE, borderRadius: 4 }}>
        <View style={{ borderWidth: 6, borderColor: WOOD, borderRadius: 2 }}>
          {/* No button role: the room stays one image; the card's Decorate button is the accessible way in, and the image's
              actions open the piece cards. */}
          <Pressable
            testID="kip-room-press"
            accessible={false}
            delayLongPress={400}
            onLongPress={onDecorate}
            onPress={(e) => onRoomPress(e.nativeEvent.locationX, e.nativeEvent.locationY)}
          >
            <View
              testID="kip-room-frame-inner"
              style={{ height: ROOM_FRAME_HEIGHT, overflow: 'hidden', backgroundColor: '#0A0B0E' }}
              onLayout={(e) => setInner(Math.floor(e.nativeEvent.layout.width))}
            >
              {stage.id === 'loading' ? (
                <Skeleton testID="kip-room-skeleton" className="h-full w-full rounded-none" />
              ) : inner > 0 ? (
                <RoomView
                  ref={roomRef}
                  testID="kip-room"
                  layout={layout}
                  tier={tier}
                  living={living}
                  worn={me.worn}
                  weather={window.weather}
                  night={window.night}
                  colour={me.colour}
                  pose={look?.pose ?? stage.pose}
                  mood={look?.mood ?? stage.mood}
                  facing={look?.facing}
                  screen={stage.screen}
                  bubble={welcome ? ROOM_COPY.welcome.bubble : landing ? ROOM_COPY.coins.bubble(landing.total) : stage.bubble}
                  crop={{ width: inner, height: ROOM_FRAME_HEIGHT }}
                  cellPt={2}
                  reduceMotion={reduceMotion}
                  paused={paused}
                  holdClock={holdClock}
                  kipWalks={walks}
                  live={catWanders}
                  idle={stage.id === 'idle'}
                  accessibilityLabel={roomLabel(stage.id, window)}
                  pieceActions={onOpenPiece ? cardPieces(layout, effects) : undefined}
                  onPieceAction={openPiece}
                  avoid={avoid}
                />
              ) : null}
              {roomShown ? (
                <RoomGiftBoxes gifts={social.gifts} layout={layout} tier={tier} width={inner} height={ROOM_FRAME_HEIGHT} onOpen={(id) => void openBox(id)} busy={opening} />
              ) : null}
            </View>
          </Pressable>
        </View>
      </View>
      {/* A polite live region for Android, read as words (no "·"); iOS is told by the hook (the EditNotices pattern).
          It stays mounted, empty and hidden while idle, and its text changes when coins land, so TalkBack hears the
          change (ruling T12-FIX); idle, it is out of the card's flow, so it adds no gap. */}
      <Text
        testID="coins-landed"
        accessibilityLiveRegion="polite"
        accessibilityLabel={landing ? ROOM_COPY.coins.landSpoken(landing.total, landLine) : undefined}
        accessibilityElementsHidden={!landing}
        importantForAccessibility={landing ? 'auto' : 'no-hide-descendants'}
        className={landing ? 'text-caption text-muted-foreground' : 'absolute h-0 w-0 overflow-hidden text-caption'}
      >
        {landLine}
      </Text>
      {runsSound(layout, effects) ? <RoomRadio active={audible} /> : null}
      {welcome ? (
        <RoomWelcomeCard
          onPlace={() => { void markWelcomed(); onPlaceLantern?.(); }}
          onLater={() => { void markWelcomed(); }}
        />
      ) : null}
      {/* Wraps the tag under the caption on a narrow phone at large text, rather than overflowing. */}
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <View className="shrink gap-0.5">
          <SectionLabel>{KIP_COPY.deskLabel}</SectionLabel>
          <Text className="text-caption text-muted-foreground">{KIP_COPY.windowCaption}</Text>
        </View>
        <HotTag
          testID="kip-tag-recovery"
          keyText={KIP_COPY.recoveryTag}
          keyColour={recovery.band ? COLORS.dark[recovery.band] : COLORS.dark.muted}
          value={recovery.score === null ? HOME_COPY.none : String(recovery.score)}
          label={hotTagLabel(recovery)}
          onPress={onOpenRecovery}
        />
      </View>
      {line ? (
        <Text testID="room-gift-line" accessibilityLiveRegion="polite" accessibilityLabel={line.spoken} className="text-caption text-muted-foreground">{line.text}</Text>
      ) : null}
      {boxless.length ? (
        <Button testID="room-gift-waiting" variant="outline" className="h-[44px] self-start" disabled={opening} onPress={() => void openBox(boxless[0]!.id)}>
          {ROOM_COPY.gifts.waiting(boxless.length)}
        </Button>
      ) : null}
      {social.cheers > 0 && onOpenCheers ? (
        <Button testID="room-cheers" variant="outline" className="h-[44px] self-start" accessibilityLabel={ROOM_COPY.gifts.cheersSpoken(social.cheers)} onPress={onOpenCheers}>
          {ROOM_COPY.gifts.cheers(social.cheers)}
        </Button>
      ) : null}
      {social.challenge?.live && onOpenChallenge ? (
        <Button testID="room-challenge" variant="outline" className="h-[44px] self-start" onPress={onOpenChallenge}>
          {ROOM_COPY.challenge.open}
        </Button>
      ) : null}
      {footer}
      {children}
    </Card>
  );
}
