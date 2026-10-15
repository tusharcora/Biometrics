import React from 'react';
import { View } from 'react-native';
import { Button } from '../ui/button';
import { SectionLabel } from '../ui/section-label';
import { selectedTools, type EditorAction, type EditorState, type NudgeDir } from '../../lib/room/edit/editor';
import { putOnOptions } from '../../lib/room/edit/targets';
import { ROOM_COPY } from '../../lib/room/roomCopy';

const N = ROOM_COPY.edit.nudge;
const TOOL = 'h-[44px]'; // spec §5.7: 44-point targets

/** Which arrows a piece gets: the floor's four tile axes, a wall's own axis plus Up and Down, none on a surface. */
export function arrowsFor(layer: string): NudgeDir[] {
  if (layer === 'floor') return ['backLeft', 'backRight', 'frontLeft', 'frontRight'];
  if (layer === 'wallR') return ['backLeft', 'frontRight', 'up', 'down'];
  if (layer === 'wallL') return ['backRight', 'frontLeft', 'up', 'down'];
  return [];
}

// Moving without a drag (spec 2026-10-15 §5.7): arrow Buttons along the tile axes, Up / Down on a wall, Put on… the
// free surfaces (or back to the floor), and Done moving. What each press did shows on the pinned notice line under the
// room (ruling T14-FIX), so it never scrolls out of sight.
export function NudgePad({ state, dispatch }: { state: EditorState; dispatch: (a: EditorAction) => void }) {
  const tools = selectedTools(state);
  if (!tools || !state.nudging) return null;
  const arrows = arrowsFor(tools.piece.layer);
  const options = putOnOptions(state);
  return (
    <View testID="edit-nudge" className="gap-2">
      {arrows.length ? (
        <View className="flex-row flex-wrap gap-2">
          {arrows.map((dir) => (
            <Button key={dir} testID={`edit-nudge-${dir}`} variant="outline" className={TOOL} accessibilityLabel={N.label(N.dirs[dir])} onPress={() => dispatch({ type: 'nudge', dir })}>
              {N.dirs[dir]}
            </Button>
          ))}
        </View>
      ) : null}
      {options.length ? (
        <View className="gap-1">
          <SectionLabel>{N.putOn}</SectionLabel>
          <View className="flex-row flex-wrap gap-2">
            {options.map((o) => (
              <Button
                key={o.key}
                testID={`edit-put-${o.key}`}
                variant="outline"
                className={TOOL}
                onPress={() => dispatch(o.parent === null ? { type: 'toFloor' } : { type: 'putOn', parent: o.parent, spot: o.spot })}
              >
                {o.parent === null ? N.onFloor : N.on(o.noun)}
              </Button>
            ))}
          </View>
        </View>
      ) : null}
      <View className="flex-row">
        <Button testID="edit-nudge-done" className={TOOL} onPress={() => dispatch({ type: 'nudging', on: false })}>{N.done}</Button>
      </View>
    </View>
  );
}
