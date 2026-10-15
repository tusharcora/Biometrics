import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, buttonIconSize } from '../ui/button';
import { Text } from '../ui/text';
import { selectedTools, type EditorAction, type EditorState } from '../../lib/room/edit/editor';
import { pieceNoun, toolLine } from '../../lib/room/edit/labels';
import { ROOM_COPY } from '../../lib/room/roomCopy';
import { NudgePad } from './NudgePad';

const T = ROOM_COPY.edit.tools;
const TOOL = 'h-[44px]'; // spec §5.2: 44 points tall at least

// The toolbar (spec 2026-10-15 §5.2, F4 "Selected piece"): the piece's name and where it is, then Flip, Turn,
// Another, Store, each greyed when it can't act (a symmetric or blocked Turn, Another at ×0 or a full room, the desk's
// Store and Another). Move swaps the tool row for the nudge pad (arrows, Put on…, Done moving; spec §5.7). With
// nothing selected: Undo, Redo and the grid toggle.
export function EditToolbar({ state, dispatch, showGrid, onToggleGrid }: {
  state: EditorState;
  dispatch: (a: EditorAction) => void;
  showGrid: boolean;
  onToggleGrid: () => void;
}) {
  const tools = selectedTools(state);
  if (!tools) {
    return (
      <View testID="edit-history" className="flex-row items-center gap-2 px-4 py-2">
        <Button testID="edit-undo" variant="outline" className={TOOL} disabled={!state.past.length} accessibilityLabel={ROOM_COPY.edit.undoLabel} onPress={() => dispatch({ type: 'undo' })}>{T.undo}</Button>
        <Button testID="edit-redo" variant="outline" className={TOOL} disabled={!state.future.length} accessibilityLabel={ROOM_COPY.edit.redoLabel} onPress={() => dispatch({ type: 'redo' })}>{T.redo}</Button>
        <View className="flex-1" />
        <Button testID="edit-grid" variant="outline" size="icon-lg" className="size-[44px]" accessibilityLabel={showGrid ? T.hideGrid : T.showGrid} onPress={onToggleGrid}>
          <Ionicons name={showGrid ? 'grid' : 'grid-outline'} size={buttonIconSize('icon-lg')} />
        </Button>
      </View>
    );
  }
  const line = toolLine(state.draft.layout, tools);
  return (
    <View testID="edit-toolbar" className="gap-2 px-4 py-2">
      <View className="flex-row items-start gap-2">
        <View testID="edit-tool-info" accessible accessibilityLabel={line.spoken} className="shrink grow gap-0.5">
          <Text testID="edit-tool-line" className="text-body">{line.text}</Text>
          <Text className="text-caption text-muted-foreground">{line.inventory}</Text>
        </View>
        <Button testID="edit-room-deselect" variant="ghost" size="icon-lg" className="size-[44px]" accessibilityLabel={T.deselect} onPress={() => dispatch({ type: 'select', id: null })}>
          <Ionicons name="close" size={buttonIconSize('icon-lg')} />
        </Button>
      </View>
      {state.nudging ? (
        <NudgePad state={state} dispatch={dispatch} />
      ) : (
        <View className="flex-row flex-wrap gap-2">
          <Button testID="edit-move" variant="outline" className={TOOL} onPress={() => dispatch({ type: 'nudging', on: true })}>{T.move}</Button>
          <Button testID="edit-flip" variant="outline" className={TOOL} onPress={() => dispatch({ type: 'flip' })}>{T.flip}</Button>
          <Button testID="edit-turn" variant="outline" className={TOOL} disabled={!tools.canTurn} onPress={() => dispatch({ type: 'turn' })}>{T.turn}</Button>
          <Button testID="edit-another" variant="outline" className={TOOL} disabled={!tools.canAnother} onPress={() => dispatch({ type: 'another' })}>{T.another}</Button>
          <Button testID="edit-store" variant="outline" className={TOOL} disabled={!tools.canStore} accessibilityLabel={ROOM_COPY.edit.storeLabel(pieceNoun(tools.piece.item), tools.children)} onPress={() => dispatch({ type: 'store' })}>{T.store}</Button>
        </View>
      )}
    </View>
  );
}
