import React from 'react';
import { ScrollView, View } from 'react-native';
import { Button } from '../ui/button';
import { DecorateTile } from './DecorateTile';
import type { KipColour } from '../../lib/kip/kipArt';
import type { DecorateAction, DecorateState } from '../../lib/room/decorate';
import { SLOT_TITLES } from '../../lib/room/roomCopy';
import { ROOM_SLOTS } from '../../lib/room/slots';
import { tilesFor, type TrayContext } from '../../lib/room/tray';

// The tray under the tabs (spec 2026-10-14 KIP's room §6.2, §6.3). Room: the 12 category chips, then the chosen
// slot's tiles; an owned tile places, a locked one previews (ruling 18). The KIP and Sets tabs come with Task 14.
export function DecorateTray({ state, dispatch, ctx, colour }: {
  state: DecorateState;
  dispatch: (action: DecorateAction) => void;
  ctx: TrayContext;
  colour: KipColour;
}) {
  if (state.tab !== 'room') return null;
  const slot = state.roomSlot;
  return (
    <View className="gap-3 pt-3">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
        {ROOM_SLOTS.map((s) => {
          const selected = s === slot;
          return (
            <Button
              key={s}
              testID={`decorate-chip-${s}`}
              size="sm"
              variant={selected ? 'default' : 'outline'}
              accessibilityState={{ selected }}
              onPress={() => dispatch({ type: 'slot', slot: s })}
            >
              {SLOT_TITLES[s]}
            </Button>
          );
        })}
      </ScrollView>
      <View className="flex-row flex-wrap gap-2 px-4">
        {tilesFor(state, slot, ctx).map((tile) => (
          <DecorateTile
            key={tile.key}
            testID={`decorate-tile-${tile.key}`}
            tile={tile}
            colour={colour}
            onPress={() =>
              tile.state === 'locked'
                ? dispatch({ type: 'preview', slot, itemId: tile.itemId! })
                : dispatch({ type: 'place', slot, itemId: tile.itemId })
            }
          />
        ))}
      </View>
    </View>
  );
}
