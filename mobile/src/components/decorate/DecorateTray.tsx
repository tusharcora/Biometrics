import React from 'react';
import { ScrollView, View } from 'react-native';
import { Button } from '../ui/button';
import { SectionLabel } from '../ui/section-label';
import { Text } from '../ui/text';
import { Kip } from '../kip/Kip';
import { DecorateTile } from './DecorateTile';
import { SetCard } from './SetCard';
import type { KipColour } from '../../lib/kip/kipArt';
import { displayLook, type DecorateAction, type DecorateSlot, type DecorateState } from '../../lib/room/decorate';
import { ROOM_COPY, SLOT_TITLES } from '../../lib/room/roomCopy';
import { ROOM_SLOTS, WORN_SLOTS } from '../../lib/room/slots';
import { setCards, tilesFor, type TileModel, type TrayContext } from '../../lib/room/tray';

// The tray under the tabs (spec 2026-10-14 KIP's room §6.2, §6.3). Room: the 12 category chips, then the chosen
// slot's tiles. KIP: KIP drawn large in the preview, then the worn pieces grouped by head, face, neck and ears. Sets:
// one card per exported theme set (ruling 20). An owned tile or set places, a locked one previews (ruling 18). Every
// tab ends with "How new things arrive".
export function DecorateTray({ state, dispatch, ctx, colour }: {
  state: DecorateState;
  dispatch: (action: DecorateAction) => void;
  ctx: TrayContext;
  colour: KipColour;
}) {
  const tile = (slot: DecorateSlot, t: TileModel) => (
    <DecorateTile
      key={t.key}
      testID={`decorate-tile-${t.key}`}
      tile={t}
      colour={colour}
      onPress={() =>
        t.state === 'locked' ? dispatch({ type: 'preview', slot, itemId: t.itemId! }) : dispatch({ type: 'place', slot, itemId: t.itemId })
      }
    />
  );
  return (
    <View className="gap-3 pt-3">
      {state.tab === 'room' ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
            {ROOM_SLOTS.map((s) => {
              const selected = s === state.roomSlot;
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
          <View className="flex-row flex-wrap gap-2 px-4">{tilesFor(state, state.roomSlot, ctx).map((t) => tile(state.roomSlot, t))}</View>
        </>
      ) : null}
      {state.tab === 'kip' ? (
        <>
          <View className="items-center py-3">
            <Kip testID="decorate-kip" colour={colour} pose="wave" mood="idle" worn={displayLook(state).worn} scale={6} />
          </View>
          {WORN_SLOTS.map((slot) => (
            <View key={slot} testID={`decorate-group-${slot}`} className="gap-2 px-4 pb-3">
              <SectionLabel>{SLOT_TITLES[slot]}</SectionLabel>
              <View className="flex-row flex-wrap gap-2">{tilesFor(state, slot, ctx).map((t) => tile(slot, t))}</View>
            </View>
          ))}
        </>
      ) : null}
      {state.tab === 'sets' ? (
        <View className="gap-3 px-4">
          {setCards(ctx).map((card) => (
            <SetCard
              key={card.id}
              card={card}
              onApply={() => dispatch({ type: 'applySet', setId: card.id })}
              onPreview={() => dispatch({ type: 'previewSet', setId: card.id })}
            />
          ))}
        </View>
      ) : null}
      <View testID="decorate-arrive" className="gap-2 px-4 pt-4">
        <SectionLabel>{ROOM_COPY.arrive.title}</SectionLabel>
        {ROOM_COPY.arrive.lines.map((text, i) => {
          const lead = ROOM_COPY.arrive.leads[i];
          return (
            <Text key={i} className={lead ? 'text-caption' : 'text-fine text-muted-foreground'}>
              {lead ? <Text className="text-caption font-semibold">{lead} </Text> : null}
              {lead ? <Text className="text-caption text-muted-foreground">{text.slice(lead.length + 1)}</Text> : text}
            </Text>
          );
        })}
      </View>
    </View>
  );
}
