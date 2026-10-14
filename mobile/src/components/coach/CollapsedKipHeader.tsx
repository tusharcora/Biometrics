import React from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import { Button, buttonIconSize } from '../ui/button';
import { PageTitle } from '../ui/page-title';
import { Text } from '../ui/text';
import { RoomView } from '../room/RoomView';
import { useMyKipColour } from '../../lib/kip/myKipColour';
import { KIP_COPY } from '../../lib/kipCopy';
import { spokenLine, type KipStage } from '../../lib/kipStage';
import { EMPTY_WORN, STARTER_LOADOUT } from '../../lib/room/loadout';
import type { RoomWeather } from '../../lib/room/weather';
import type { KipLook } from '../../lib/useKipTurn';
import { COLORS } from '../../theme';

export const COLLAPSED_HEIGHT = 60;
/** The collapsed header's row: the 60-point header plus the thumbnail frame's room (its 66-point picture). */
export const COLLAPSED_ROW_HEIGHT = COLLAPSED_HEIGHT + 12;
export const FADE_PT = 24;

/**
 * 0 → 1 over the last 24 points before the card's bottom edge passes under the pinned header (§3.5). `covered` is
 * how far the pinned header reaches down over the top of the scroll area: all 60 points when it pins over the scroll
 * itself; on the KIP page, where it pins over the expanded header above the scroll, the overlap measured from layout.
 */
export function collapseProgress(scrollY: number, cardBottom: number, covered: number = COLLAPSED_HEIGHT): number {
  const end = cardBottom - Math.max(0, covered);
  return Math.max(0, Math.min(1, (scrollY - (end - FADE_PT)) / FADE_PT));
}

// W7 "Collapsed · after scroll" (spec §3.5): the room's thumbnail (96 × 60 at 1 point a cell, cropped to THUMB_BOX,
// inside a 3-point frame), "KIP" with the collapsed status line, and the Conversations and New chat buttons. The
// thumbnail's picture is decorative: the button around it carries the label.
export function CollapsedKipHeader({ stage, look, statusLine, window, reduceMotion, onExpand, onConversations, onNewChat, showActions }: {
  stage: KipStage;
  look: KipLook;
  statusLine: string;
  window: { weather: RoomWeather; night: boolean };
  reduceMotion: boolean;
  onExpand: () => void;
  onConversations: () => void;
  onNewChat: () => void;
  showActions: boolean;
}) {
  const colour = useMyKipColour();
  const { colorScheme } = useColorScheme();
  const colors = colorScheme === 'dark' ? COLORS.dark : COLORS.light;
  return (
    <View className="flex-row items-center gap-3 px-5" style={{ height: COLLAPSED_ROW_HEIGHT }}>
      <Pressable
        testID="kip-room-thumbnail"
        accessibilityRole="button"
        accessibilityLabel={KIP_COPY.expandRoomLabel}
        onPress={onExpand}
        style={{ borderWidth: 3, borderColor: '#5B4636', borderRadius: 4 }}
      >
        <RoomView
          testID="kip-room-thumb"
          loadout={STARTER_LOADOUT}
          worn={EMPTY_WORN}
          weather={window.weather}
          night={window.night}
          colour={colour}
          pose={look.pose}
          mood={look.mood}
          facing={look.facing}
          screen={stage.screen}
          bubble={null}
          crop={{ width: 96, height: 60 }}
          cellPt={1}
          box="thumb"
          reduceMotion={reduceMotion}
          accessible={false}
        />
      </Pressable>
      <View className="shrink grow gap-0.5">
        <PageTitle>{KIP_COPY.pageTitle}</PageTitle>
        <Text testID="kip-collapsed-status" numberOfLines={1} accessibilityLabel={spokenLine(statusLine)} className="text-caption text-muted-foreground">
          {statusLine}
        </Text>
      </View>
      {showActions ? (
        <View className="flex-row gap-2">
          <Button testID="kip-collapsed-conversations" variant="outline" size="icon-lg" accessibilityLabel={KIP_COPY.conversationsLabel} onPress={onConversations}>
            <Ionicons name="menu-outline" size={buttonIconSize('icon-lg')} color={colors.foreground} />
          </Button>
          <Button testID="kip-collapsed-new-chat" variant="outline" size="icon-lg" accessibilityLabel={KIP_COPY.newChatLabel} onPress={onNewChat}>
            <Ionicons name="create-outline" size={buttonIconSize('icon-lg')} color={colors.foreground} />
          </Button>
        </View>
      ) : null}
    </View>
  );
}
