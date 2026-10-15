import React, { useState } from 'react';
import { Pressable, View, type ViewProps } from 'react-native';
import { Card } from '../ui/card';
import { SectionLabel } from '../ui/section-label';
import { Skeleton } from '../ui/skeleton';
import { Text } from '../ui/text';
import { HotTag } from '../home/HotTag';
import { RoomWelcomeCard } from './RoomWelcomeCard';
import { RoomView } from '../room/RoomView';
import { HOME_COPY } from '../../lib/homeCopy';
import { useMyKip } from '../../lib/kip/myKip';
import { KIP_COPY } from '../../lib/kipCopy';
import { hotTagLabel, roomLabel, type KipStage } from '../../lib/kipStage';
import { markWelcomed, useCosmetics, useMyRoom } from '../../lib/room/cosmeticsStore';
import { ROOM_COPY } from '../../lib/room/roomCopy';
import type { KipLook } from '../../lib/useKipTurn';
import type { RoomWeather } from '../../lib/room/weather';
import type { ScoreBand } from '../../lib/scoreInsights';
import { COLORS } from '../../theme';

export const ROOM_FRAME_HEIGHT = 240;
const WOOD = '#5B4636';
const WOOD_LINE = '#3A2D23';

// The W7 room card (spec 2026-10-14 KIP Coach §3.1, §3.2; spec 2026-10-15 §9.1): KIP's isometric room as a framed
// diorama, cropped on KIP's desk (crop, never shrink: the inner width is measured, the height fixed at 240), a caption
// row with the RECOVERY hot tag, and an optional footer ("Shrink room", passed in by the page). The frame is part of
// the picture, not a button; a long-press on the room opens the editor (§5.1). The tag keeps Home's dark-palette
// colours in both themes, as on the scene. `look` is KIP mid-turn (useKipTurn); without it the stage's pose and mood
// are drawn. The room is your saved layout, with KIP in what it wears; `paused` stops its loops while the editor is
// open (Spec B ruling 17). Until the first-week welcome is answered it sits under the frame and KIP says "WELCOME HOME!"
// (spec 2026-10-15 §11.1, plan ruling 18); both of its buttons record it for every device.
export function RoomCard({ stage, look, window, recovery, reduceMotion, paused, onOpenRecovery, onDecorate, onPlaceLantern, footer, onLayout }: {
  stage: KipStage;
  look?: KipLook;
  window: { weather: RoomWeather; night: boolean };
  recovery: { score: number | null; band: ScoreBand | null };
  reduceMotion: boolean;
  paused?: boolean;
  onOpenRecovery: () => void;
  /** Long-press on the room opens the editor (spec 2026-10-15 §5.1). */
  onDecorate?: () => void;
  /** The welcome card's Place the lantern: opens the guided first placement (spec §11.1). */
  onPlaceLantern?: () => void;
  footer?: React.ReactNode;
  onLayout?: ViewProps['onLayout'];
}) {
  const me = useMyKip();
  const { layout, tier } = useMyRoom();
  const cosmetics = useCosmetics();
  const welcome = !!cosmetics && !cosmetics.welcomed && stage.id !== 'loading';
  const [inner, setInner] = useState(0);
  return (
    <Card testID="kip-room-card" className="gap-3 p-3.5" onLayout={onLayout}>
      <View testID="kip-room-frame" style={{ borderWidth: 2, borderColor: WOOD_LINE, borderRadius: 4 }}>
        <View style={{ borderWidth: 6, borderColor: WOOD, borderRadius: 2 }}>
          {/* No button role: the room stays one image; the card's Decorate button is the accessible way in. */}
          <Pressable testID="kip-room-press" accessible={false} delayLongPress={400} onLongPress={onDecorate}>
            <View
              testID="kip-room-frame-inner"
              style={{ height: ROOM_FRAME_HEIGHT, overflow: 'hidden', backgroundColor: '#0A0B0E' }}
              onLayout={(e) => setInner(Math.floor(e.nativeEvent.layout.width))}
            >
              {stage.id === 'loading' ? (
                <Skeleton testID="kip-room-skeleton" className="h-full w-full rounded-none" />
              ) : inner > 0 ? (
                <RoomView
                  testID="kip-room"
                  layout={layout}
                  tier={tier}
                  worn={me.worn}
                  weather={window.weather}
                  night={window.night}
                  colour={me.colour}
                  pose={look?.pose ?? stage.pose}
                  mood={look?.mood ?? stage.mood}
                  facing={look?.facing}
                  screen={stage.screen}
                  bubble={welcome ? ROOM_COPY.welcome.bubble : stage.bubble}
                  crop={{ width: inner, height: ROOM_FRAME_HEIGHT }}
                  cellPt={2}
                  reduceMotion={reduceMotion}
                  paused={paused}
                  accessibilityLabel={roomLabel(stage.id, window)}
                />
              ) : null}
            </View>
          </Pressable>
        </View>
      </View>
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
      {footer}
    </Card>
  );
}
