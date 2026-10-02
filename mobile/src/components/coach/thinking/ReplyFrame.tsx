import React from 'react';
import type { TextStyle } from 'react-native';
import type { ThinkingTextId } from '../../characters/thinking';
import type { CharacterId } from '../../characters/types';
import { DialogBox, dialogTextStyle } from './Dialog';
import { BubbleName, PlaceholderBubble } from './Placeholder';

/** The styles whose thinking frame the streaming answer then flows into (spec §5 B, I). */
export const REPLY_FRAME_STYLES = ['placeholder', 'dialog'] as const;
export type ReplyFrameStyle = (typeof REPLY_FRAME_STYLES)[number];

export function isReplyFrameStyle(style: ThinkingTextId | null | undefined): style is ReplyFrameStyle {
  return (REPLY_FRAME_STYLES as readonly string[]).includes(style ?? '');
}

/** The answer text's style inside the frame: the pixel font in the dialog box, unchanged in the bubble. */
export function replyFrameTextStyle(style: ReplyFrameStyle): TextStyle | undefined {
  return style === 'dialog' ? dialogTextStyle() : undefined;
}

// The in-progress answer, inside the same bubble (B) or RPG box (I) the
// thinking text drew. Only the streaming message uses it; once the turn is
// done the answer renders as a normal message, so history looks the same for
// every style.
export function ReplyFrame({ style, characterId, children }: { style: ReplyFrameStyle; characterId: CharacterId; children: React.ReactNode }) {
  if (style === 'dialog') {
    return (
      <DialogBox testID="reply-frame-dialog" characterId={characterId}>
        {children}
      </DialogBox>
    );
  }
  return (
    <PlaceholderBubble testID="reply-frame-placeholder" style={{ maxWidth: '100%' }}>
      <BubbleName characterId={characterId} />
      {children}
    </PlaceholderBubble>
  );
}
