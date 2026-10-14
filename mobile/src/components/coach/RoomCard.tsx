import React, { useState } from 'react';
import { View, type ViewProps } from 'react-native';
import { Card } from '../ui/card';
import { SectionLabel } from '../ui/section-label';
import { Skeleton } from '../ui/skeleton';
import { Text } from '../ui/text';
import { HotTag } from '../home/HotTag';
import { RoomView } from '../room/RoomView';
import { HOME_COPY } from '../../lib/homeCopy';
import { useMyKipColour } from '../../lib/kip/myKip';
import { KIP_COPY } from '../../lib/kipCopy';
import { hotTagLabel, roomLabel, type KipStage } from '../../lib/kipStage';
import { EMPTY_WORN, STARTER_LOADOUT } from '../../lib/room/loadout';
import type { KipLook } from '../../lib/useKipTurn';
import type { RoomWeather } from '../../lib/room/weather';
import type { ScoreBand } from '../../lib/scoreInsights';
import { COLORS } from '../../theme';

export const ROOM_FRAME_HEIGHT = 200;
const WOOD = '#5B4636';
const WOOD_LINE = '#3A2D23';

// The W7 room card (spec 2026-10-14 KIP Coach §3.1, §3.2): KIP's room as a framed diorama (crop, never shrink: the
// inner width is measured, the height fixed at 200), a caption row with the RECOVERY hot tag, and an optional footer
// ("Shrink room", passed in by the page). The frame is part of the picture, not a button. The tag keeps Home's
// dark-palette colours in both themes, as on the scene. `look` is KIP mid-turn (useKipTurn); without it the stage's
// pose and mood are drawn.
export function RoomCard({ stage, look, window, recovery, reduceMotion, onOpenRecovery, footer, onLayout }: {
  stage: KipStage;
  look?: KipLook;
  window: { weather: RoomWeather; night: boolean };
  recovery: { score: number | null; band: ScoreBand | null };
  reduceMotion: boolean;
  onOpenRecovery: () => void;
  footer?: React.ReactNode;
  onLayout?: ViewProps['onLayout'];
}) {
  const colour = useMyKipColour();
  const [inner, setInner] = useState(0);
  return (
    <Card testID="kip-room-card" className="gap-3 p-3.5" onLayout={onLayout}>
      <View testID="kip-room-frame" style={{ borderWidth: 2, borderColor: WOOD_LINE, borderRadius: 4 }}>
        <View style={{ borderWidth: 6, borderColor: WOOD, borderRadius: 2 }}>
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
                loadout={STARTER_LOADOUT}
                worn={EMPTY_WORN}
                weather={window.weather}
                night={window.night}
                colour={colour}
                pose={look?.pose ?? stage.pose}
                mood={look?.mood ?? stage.mood}
                facing={look?.facing}
                screen={stage.screen}
                bubble={stage.bubble}
                crop={{ width: inner, height: ROOM_FRAME_HEIGHT }}
                cellPt={2}
                reduceMotion={reduceMotion}
                accessibilityLabel={roomLabel(stage.id, window)}
              />
            ) : null}
          </View>
        </View>
      </View>
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
