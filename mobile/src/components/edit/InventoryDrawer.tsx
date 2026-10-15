import React, { useState, type RefObject } from 'react';
import { Alert, View, useWindowDimensions } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { Button } from '../ui/button';
import { SectionLabel } from '../ui/section-label';
import { Text } from '../ui/text';
import { Kip } from '../kip/Kip';
import { DecorateTile } from '../decorate/DecorateTile';
import { SetCard } from '../decorate/SetCard';
import { RoomFullCard } from './RoomFullCard';
import type { EditRoomHandle } from './EditRoom';
import type { KipColour } from '../../lib/kip/kipArt';
import { useAchievements } from '../../lib/achievementsStore';
import { WORN_SLOTS, isoOf } from '../../lib/room/catalogue';
import { canPlace, displayDraft, inventory, type DrawerTab, type EditorAction, type EditorState } from '../../lib/room/edit/editor';
import { drawerTabs, notPlaced, pieceTiles, setCards, styleRows, wornTiles, type DrawerTile } from '../../lib/room/edit/drawer';
import { capFor } from '../../lib/room/iso/geometry';
import { ROOM_COPY, SET_NAMES, SLOT_TITLES, itemName, progressFromAchievements } from '../../lib/room/roomCopy';

const D = ROOM_COPY.drawer;
const PIECE_TABS: ReadonlySet<DrawerTab> = new Set(['all', 'floor', 'wall', 'onTop', 'funny', 'new']);
const NO_COUNTERS = { recapsRead: 0, buddyCheers: 0 };
const TARGET = 'h-[44px]'; // spec §5.7: every target 44 points tall at least

// The inventory drawer (spec 2026-10-15 §5.4): a panel 42% of the window tall, growing to 75%, in the scrolling part
// under the editor's room (ruling T13-LAYOUT: on a 568-point phone a pinned drawer would leave no room for the
// toolbar). Header "Inventory · n not placed", the tabs, the tiles, the picked tile's Place (or Replace desk) row, the
// room-full card, the Room / KIP / Sets tabs, and "How new things arrive" last. Locked worn pieces and sets show how
// they are earned, never a price. The drawer is never taller than the scroll area it sits in (maxHeight, once
// measured). Its lists are RNGH ScrollViews, so a tile's drag cancels their scrolling, and while a drag is live they
// don't scroll at all (onDragChange tells the page to hold its own scroll too).
export function InventoryDrawer({ state, dispatch, room, colour, counters = NO_COUNTERS, maxHeight, onDragChange }: {
  state: EditorState;
  dispatch: (a: EditorAction) => void;
  room: RefObject<EditRoomHandle | null>;
  colour: KipColour;
  /** The server's counters, for the KIP tab's progress lines ("3 of 10"). */
  counters?: { recapsRead: number; buddyCheers: number };
  /** The visible height of the scroll area holding the drawer; until it is measured the window decides alone. */
  maxHeight?: number;
  /** A tile's drag went live (lift) or ended (drop or cancel). */
  onDragChange?: (live: boolean) => void;
}) {
  const { height } = useWindowDimensions();
  const [full, setFull] = useState(false);
  const [dragging, setDragging] = useState(false);
  const live = (on: boolean) => { setDragging(on); onDragChange?.(on); };
  const drawerHeight = Math.min(Math.round(height * (full ? 0.75 : 0.42)), maxHeight ? Math.round(maxHeight) : Infinity);
  // Store a piece's hint stays until a piece has gone: the room's count when it was pressed.
  const [storeHint, setStoreHint] = useState<number | null>(null);
  const facts = progressFromAchievements(useAchievements(), counters);
  const n = notPlaced(state);
  const tabs = drawerTabs(state);
  const picked = state.picked;
  const left = picked ? inventory(state)[picked] ?? 0 : 0;
  const isDesk = !!(picked && isoOf(picked)?.kipDesk);
  // Room full (spec §5.3): a refused 'full', or a picked piece Place can't add because the room is at its cap.
  const atCap = !!picked && !isDesk && left > 0 && state.draft.layout.pieces.length >= capFor(state.tier);
  const roomFull = atCap || (!!state.outcome && !state.outcome.ok && state.outcome.refused.reason === 'full');
  const tile = (t: DrawerTile, onPress: () => void, draggable = false) => (
    <DecorateTile
      key={t.key}
      testID={`drawer-tile-${t.item ?? t.key}`}
      tile={t}
      colour={colour}
      onPress={onPress}
      drag={draggable && t.item ? {
        lift: (x, y) => { live(true); room.current?.lift(t.item!, x, y); },
        move: (x, y) => room.current?.move(x, y),
        drop: () => { live(false); room.current?.drop(); },
        cancel: () => { live(false); room.current?.cancel(); },
      } : undefined}
    />
  );
  const applySet = (id: string) =>
    Alert.alert(D.applyConfirm(SET_NAMES[id] ?? id), undefined, [
      { text: D.applyKeep, style: 'cancel' },
      { text: D.applyGo, onPress: () => dispatch({ type: 'applySet', setId: id }) },
    ]);
  return (
    <View testID="drawer" className="border-t border-border bg-background" style={{ height: drawerHeight }}>
      <View className="flex-row items-center justify-between px-4 pt-2">
        <Text testID="drawer-title" accessibilityLabel={D.titleSpoken(n)} className="font-pixel text-label text-muted-foreground">{D.title(n)}</Text>
        <Button testID="drawer-handle" variant="ghost" size="sm" className={TARGET} accessibilityLabel={full ? D.less : D.more} onPress={() => setFull((v) => !v)}>
          {full ? D.less : D.more}
        </Button>
      </View>
      <ScrollView horizontal scrollEnabled={!dragging} showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 8 }}>
        <View testID="drawer-tabs" accessibilityRole="tablist" accessibilityLabel={D.tabsLabel} className="flex-row gap-2">
          {tabs.map((tab) => (
            <Button key={tab} testID={`drawer-tab-${tab}`} accessibilityRole="tab" accessibilityState={{ selected: state.drawer === tab }}
              size="sm" className={TARGET} variant={state.drawer === tab ? 'default' : 'outline'} onPress={() => dispatch({ type: 'drawer', tab })}>
              {D.tabs[tab]}
            </Button>
          ))}
        </View>
      </ScrollView>
      <ScrollView testID="drawer-scroll" nestedScrollEnabled scrollEnabled={!dragging} contentContainerStyle={{ paddingBottom: 24 }}>
        {roomFull ? (
          <View className="px-4 pb-3">
            <RoomFullCard cap={capFor(state.tier)} onStore={() => { setStoreHint(state.draft.layout.pieces.length); dispatch({ type: 'clearOutcome' }); }} />
          </View>
        ) : null}
        {storeHint !== null && state.draft.layout.pieces.length >= storeHint ? <Text testID="room-full-hint" className="px-4 pb-2 text-caption text-muted-foreground">{D.full.hint}</Text> : null}
        {PIECE_TABS.has(state.drawer) ? (
          <>
            {picked ? (
              <View testID="drawer-picked" className="flex-row items-center gap-3 px-4 pb-3">
                <Text className="shrink grow text-body">{`${itemName(picked)} ${D.count(left)}`}</Text>
                <Button
                  testID="drawer-place"
                  className={TARGET}
                  disabled={isDesk ? left === 0 : !canPlace(state, picked)}
                  onPress={() => dispatch(isDesk ? { type: 'replaceDesk', item: picked } : { type: 'place', item: picked })}
                >
                  {isDesk ? D.replaceDesk : D.place}
                </Button>
              </View>
            ) : null}
            <View className="flex-row flex-wrap gap-2 px-4">
              {pieceTiles(state, state.drawer).map((t) => tile(t, () => dispatch({ type: 'pick', item: t.item }), true))}
            </View>
          </>
        ) : null}
        {state.drawer === 'room' ? styleRows(state).map((row) => (
          <View key={row.key} testID={`drawer-row-${row.key}`} className="gap-2 px-4 pb-3">
            <SectionLabel>{D.rows[row.key]}</SectionLabel>
            <View className="flex-row flex-wrap gap-2">{row.tiles.map((t) => tile(t, () => dispatch({ type: 'style', key: row.key, item: t.item! })))}</View>
          </View>
        )) : null}
        {state.drawer === 'kip' ? (
          <>
            <View className="items-center py-3">
              <Kip testID="drawer-kip" colour={colour} pose="wave" mood="idle" worn={displayDraft(state).worn} scale={6} />
            </View>
            {WORN_SLOTS.map((slot) => (
              <View key={slot} testID={`drawer-group-${slot}`} className="gap-2 px-4 pb-3">
                <SectionLabel>{SLOT_TITLES[slot]}</SectionLabel>
                <View className="flex-row flex-wrap gap-2">
                  {wornTiles(state, slot, facts).map((t) => tile(t, () => dispatch(t.locked ? { type: 'previewWorn', slot, item: t.item! } : { type: 'wear', slot, item: t.item })))}
                </View>
              </View>
            ))}
          </>
        ) : null}
        {state.drawer === 'sets' ? (
          <View className="gap-3 px-4">
            {state.preview?.kind === 'set' ? (
              <View className="flex-row items-center gap-2">
                <Text className="shrink grow text-caption text-muted-foreground">{D.previewing(SET_NAMES[state.preview.setId] ?? state.preview.setId)}</Text>
                <Button testID="drawer-stop-preview" variant="outline" size="sm" className={TARGET} onPress={() => dispatch({ type: 'previewSet', setId: null })}>{D.stopPreview}</Button>
              </View>
            ) : null}
            {setCards(state, facts).map((card) => (
              <SetCard key={card.id} card={card} onApply={() => applySet(card.id)} onPreview={() => dispatch({ type: 'previewSet', setId: card.id })} />
            ))}
          </View>
        ) : null}
        <View testID="drawer-arrive" className="gap-2 px-4 pt-4">
          <SectionLabel>{ROOM_COPY.arrive.title}</SectionLabel>
          {ROOM_COPY.arrive.items.map(({ lead, body }, i) => (
            <Text key={i} testID={`drawer-arrive-${i}`} className={lead ? 'text-caption' : 'text-fine text-muted-foreground'}>
              {lead ? <Text className="text-caption font-semibold">{`${lead} `}</Text> : null}
              <Text className={lead ? 'text-caption text-muted-foreground' : 'text-fine text-muted-foreground'}>{body}</Text>
            </Text>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
