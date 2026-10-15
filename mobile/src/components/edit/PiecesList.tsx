import React from 'react';
import { View } from 'react-native';
import { Button } from '../ui/button';
import { SectionLabel } from '../ui/section-label';
import type { EditorAction, EditorState } from '../../lib/room/edit/editor';
import { pieceLabel } from '../../lib/room/edit/labels';
import { ROOM_COPY } from '../../lib/room/roomCopy';

// "Pieces in the room" (spec 2026-10-15 §5.7): one Button per placement, in the room's own order, so a screen reader
// (or anyone) can select a piece without finding it on the picture. Buttons, so no buttons-guard entry.
export function PiecesList({ state, dispatch }: { state: EditorState; dispatch: (a: EditorAction) => void }) {
  const layout = state.draft.layout;
  return (
    <View testID="edit-pieces" className="gap-1 px-4 pt-4">
      <SectionLabel>{ROOM_COPY.edit.piecesTitle}</SectionLabel>
      {layout.pieces.map((p) => {
        const label = pieceLabel(layout, p);
        const selected = state.selected === p.id;
        return (
          <Button
            key={p.id}
            testID={`edit-piece-${p.id}`}
            variant={selected ? 'secondary' : 'ghost'}
            className="h-[44px] justify-start"
            accessibilityLabel={label}
            accessibilityState={{ selected }}
            onPress={() => dispatch({ type: 'select', id: p.id })}
          >
            {label}
          </Button>
        );
      })}
    </View>
  );
}
