import React, { useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react';
import { View } from 'react-native';
import { Canvas, Group, Picture, Skia, type SkPicture } from '@shopify/react-native-skia';
import { Text } from '../ui/text';
import { record } from './pictures';
import { PictureLru, RunPictures } from './pictureCache';
import type { Rects } from '../../lib/room/paint';
import type { ItemContext, MonitorScreen } from '../../lib/room/items';
import type { KipWorn } from '../../lib/room/loadout';
import type { RoomWeather } from '../../lib/room/weather';
import { pieceLayers } from '../../lib/room/iso/art';
import type { IsoStatic, KipSeat, RoomKip } from '../../lib/room/iso/room';
import { drawIsoFramesEach, drawIsoStatic, drawKipLayer, isoRoomKey, kipLayerKey, pieceAt } from '../../lib/room/iso/room';
import { isoCrop } from '../../lib/room/iso/crop';
import { KIP_MOVER, MOVER_PREFIX, kipTileCell, moverOrder, pieceTileCell, sameTile, type Tile } from '../../lib/room/iso/movers';
import type { Placement, RoomLayout, Tier } from '../../lib/room/iso/geometry';
import { KIP_COLOURS, kipRamp, type KipColour, type KipMood, type KipPose } from '../../lib/kip/kipArt';
import { useFrameClock } from '../../lib/useFrameClock';
import { useScreenFocused } from '../../lib/useScreenFocused';
import type { Living } from '../../lib/room/effects';
import { useRoomEffects } from './useRoomEffects';

export const LOOP_MS = 400;
// The bubble is decoration over a fixed crop, so its text grows only a little with Dynamic Type.
const BUBBLE_MAX_FONT_SCALE = 1.3;
const BUBBLE_INSET = 4;
/** KIP's poses, the loop frames and the movers' sprites a view keeps (a trip uses five or six). */
const PICTURE_SETS = 24;

/** KIP off its seat (spec §9.2): where it stands (half tiles while it glides) and the tile it is drawn at in depth. */
export interface KipMover {
  pos: readonly [number, number];
  depth: Tile;
  flip: boolean;
  pose: KipPose;
  /** Between tiles: a 1-cell bob on alternate frames (spec §3.6). */
  moving: boolean;
  /** At the radio: KIP sways a cell each way (ruling 13). */
  sway: boolean;
}
/** A piece drawn as a mover (the wandering cat, spec §8.2). */
export interface PieceMover { id: string; pos: readonly [number, number]; depth: Tile; flip: boolean }
export interface RoomViewHandle {
  /** The topmost piece under a point in this view, in points (the piece card, spec §8.1), or null. */
  pieceAtPoint(x: number, y: number): string | null;
}

export interface RoomViewProps {
  layout: RoomLayout;
  tier: Tier;
  weather: RoomWeather;
  night: boolean;
  colour: KipColour;
  worn: KipWorn;
  pose: KipPose;
  mood: KipMood;
  facing?: 'desk' | 'you';
  screen: MonitorScreen;
  crop: { width: number; height: number };
  cellPt: 1 | 2;
  box?: 'focus' | 'thumb';
  /** The editor's pan: the room's top-left in points, instead of the crop on the desk. */
  offset?: { x: number; y: number };
  /** The editor: a piece lifted into the drag ghost is left out of the picture (spec §3.7). */
  hide?: string | null;
  /** The editor: the static room it already built for these props (its hit boxes), so it is built once a change. */
  room?: IsoStatic;
  /** The editor: a drag is live, so the clock keeps its minute and the room is not rebuilt under it (PF3-CLOCK). */
  dragging?: boolean;
  /** The editor: a napping cat stays on its own tile (spec §8.2), so a tap or a drag finds it where it is placed. */
  editing?: boolean;
  /** The room is out of sight (the room card scrolled under the collapsed header): the clock keeps its minute. */
  holdClock?: boolean;
  /** The living room (spec §8.3); absent, the neutral room (a visit, the share card, a test). */
  living?: Living;
  /** KIP off its seat, walking or at a target (Task 10 sets it from its own walk; a test may pass it). */
  kipMover?: KipMover | null;
  /** Pieces drawn as movers (Task 11 sets the wandering cat; a test may pass them). */
  pieceMovers?: readonly PieceMover[];
  bubble: string | null;
  reduceMotion: boolean;
  accessibilityLabel?: string;
  /** False when a parent carries the label (the collapsed header's thumbnail button). Default true. */
  accessible?: boolean;
  /** Holds the loops (frame 0) while something covers the room, such as the editor (spec §8 Loops). */
  paused?: boolean;
  testID?: string;
  ref?: Ref<RoomViewHandle>;
}

const NO_MOVERS: readonly PieceMover[] = [];
const NO_IDS: readonly string[] = [];
const NO_KEYS: ReadonlySet<string> = new Set();

/** Where the speech bubble's bottom centre sits, in cells: just above KIP's head. */
export function bubbleAnchor(seat: KipSeat): { x: number; y: number } {
  return { x: seat.x + 16, y: seat.y + 10 };
}

const shift = (dx: number, dy: number, cellPt: number) => [{ translateX: dx * cellPt }, { translateY: dy * cellPt }];

// KIP's isometric room (spec 2026-10-15 §3.7). With no mover the static room is P1's two pictures, back and front,
// recorded once per isoRoomKey (the layout, tier, light, KIP's colour, a lifted piece, the effect states), with KIP
// between them and the loop frame over them (frames behind KIP clipped by its silhouette). With a mover on screen
// (KIP off its seat, a wandering cat: P3 ruling 11) it draws `under`, one cached picture per floor piece and the movers
// in depth order, the light and glow layer, the movers' own loop frames, and the room's loop frame: under an inverted
// clip of KIP's silhouette while KIP walks (ruling 12), the seated frames (behind KIP clipped) while it sits.
// KIP's poses, the room's sets and the movers' sprites are cached (PictureLru), floor pieces by their content
// (RunPictures): a loop tick, a walk step, a bob or a sway records nothing (ruling T10-FIX), and a trip off the seat
// and back records nothing new for the room either (T9-FIX M2). What the committed tree no longer draws is released
// after the commit (PF3-DISPOSE). The scene's elements are memoised, so a frame-clock render between two loop frames
// changes nothing on the canvas (T9-FIX M3). The loops stop when the tab is not focused, under Reduce Motion, or while
// paused.
export function RoomView(props: RoomViewProps) {
  const { layout, tier, weather, night, colour, worn, pose, mood, facing, screen, crop, cellPt, bubble, reduceMotion } = props;
  const focused = useScreenFocused();
  const still = reduceMotion || !focused || !!props.paused;
  const t = useFrameClock(still);
  const frame = still ? 0 : Math.floor(t / LOOP_MS) % 3;

  // The clock's minute rebuilds the room only while this page is focused, the room is not paused or out of sight,
  // and no drag is live (PF3-CLOCK, ruling T5-FIX).
  const effects = useRoomEffects(layout, tier, props.living, {
    hold: !focused || !!props.dragging || !!props.paused || !!props.holdClock,
    editing: props.editing,
  });
  const pieceMovers = props.pieceMovers ?? NO_MOVERS;
  const moverKey = pieceMovers.map((m) => m.id).sort().join(',');
  const moverIds = useMemo(() => (moverKey ? moverKey.split(',') : NO_IDS), [moverKey]);
  const hide = props.hide ?? null;
  // Built from the props once per change, not on each frame-clock render.
  const input = useMemo(
    () => ({ layout, tier, weather, night, colour, hide, effects, movers: moverIds }),
    [layout, tier, weather, night, colour, hide, effects, moverIds],
  );
  const staticKey = useMemo(() => isoRoomKey(input), [input]);
  // A given room (the editor's) has no movers left out of it, so with piece movers the view builds its own (M5).
  const given = props.room && !moverIds.length ? props.room : null;
  const room = useMemo(() => given ?? drawIsoStatic(input), [staticKey, given]); // eslint-disable-line react-hooks/exhaustive-deps

  const kipMover = props.kipMover ?? null;
  const walking = !!kipMover;
  const movers = walking || pieceMovers.length > 0;

  // The caches live as long as the view; on unmount everything is released.
  const caches = useRef<{ lru: PictureLru; runs: RunPictures } | null>(null);
  if (!caches.current) caches.current = { lru: new PictureLru(PICTURE_SETS), runs: new RunPictures() };
  const { lru, runs: runCache } = caches.current;
  useEffect(() => () => { lru.clear(); runCache.clear(); }, [lru, runCache]);

  // KIP in all three loop frames at once, keyed without the frame (ruling T10-FIX); the seat joins the key, so a moved
  // desk re-places KIP. Walking, KIP glances and is mirrored when it heads left (spec §3.6).
  const kip: RoomKip = kipMover
    ? { colour, pose: kipMover.pose, mood: 'glance', worn, facing: 'you', flip: kipMover.flip }
    : { colour, pose, mood, worn, ...(facing ? { facing } : {}) };
  const seat = room.kipSeat;
  const poseKey = `${kipLayerKey({ ...kip, frame: 0 })}#${seat.style}@${seat.x},${seat.y},${seat.deskSide}`;
  const kipRects = useMemo(
    () => [0, 1, 2].map((f) => drawKipLayer({ ...kip, frame: f }, seat)) as [Rects, Rects, Rects],
    [poseKey], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // The picture sets this render draws, by key. Those of one static room carry its key, so a new room lets them go.
  const kipKey = `kip#${poseKey}#${cellPt}`;
  const staticSetKey = movers ? null : `static#${staticKey}#${cellPt}`;
  const seatedKey = walking ? null : `seated#${staticKey}#${screen}#${poseKey}#${cellPt}`;
  const underKey = movers ? `under#${staticKey}#${cellPt}` : null;
  const framesKey = walking ? `frames#${staticKey}#${screen}#${cellPt}` : null;
  const kipPictures = useMemo(() => lru.get(kipKey, () => kipRects.map((r) => record([r], cellPt))), [kipKey]); // eslint-disable-line react-hooks/exhaustive-deps
  // Seated: back and front, kept while KIP is off on a trip, so its return records nothing (M2).
  const staticSet = useMemo(
    () => (staticSetKey ? lru.get(staticSetKey, () => [record([room.back], cellPt), record([room.front, room.light, room.emissive], cellPt)], staticKey) : null),
    [staticSetKey], // eslint-disable-line react-hooks/exhaustive-deps
  );
  // KIP on its seat (no mover, or only the cat): each loop frame behind KIP clipped by its silhouette in that frame.
  const seatedFrames = useMemo(
    () => (seatedKey ? lru.get(seatedKey, () => drawIsoFramesEach(room, { night, colour, screen }, kipRects).map((r) => record([r], cellPt)), staticKey) : null),
    [seatedKey], // eslint-disable-line react-hooks/exhaustive-deps
  );
  // Runs mode (ruling 11): the shell and the overlay, and, while KIP walks, the unclipped loop frames.
  const shell = useMemo(
    () => (underKey ? lru.get(underKey, () => [record([room.under], cellPt), record([room.light, room.emissive], cellPt)], staticKey) : null),
    [underKey], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const walkFrames = useMemo(
    () => (framesKey ? lru.get(framesKey, () => drawIsoFramesEach(room, { night, colour, screen }, [[], [], []]).map((r) => record([r], cellPt)), staticKey) : null),
    [framesKey], // eslint-disable-line react-hooks/exhaustive-deps
  );
  // Each floor piece by its content. They stay while the room keeps them, KIP seated or not (M2).
  const runKeys = useMemo(() => room.runs.map((r) => `${cellPt}#${r.key}`), [room, cellPt]);
  const runPictures = useMemo(() => {
    const byId = new Map<string, SkPicture>();
    if (movers) room.runs.forEach((r, k) => byId.set(r.id, runCache.take(runKeys[k]!, () => record([r.rects], cellPt))));
    return byId;
  }, [runKeys, movers]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { runCache.keep(new Set(runKeys)); }, [runCache, runKeys]);

  // KIP's silhouette as a path per frame (not a picture): the loops are cut by it wherever KIP walks (ruling 12).
  const kipPaths = useMemo(() => (walking ? kipRects.map((rs) => {
    const p = Skia.Path.Make();
    for (const [x, y, w, h] of rs) p.addRect(Skia.XYWHRect(x * cellPt, y * cellPt, w * cellPt, h * cellPt));
    return p;
  }) : null), [kipRects, cellPt, walking]);
  useEffect(() => () => kipPaths?.forEach((p) => p.dispose?.()), [kipPaths]);

  // A mover's sprite (the wandering cat, spec §8.2): its base, drawn at its depth, and each loop frame, drawn over
  // the light (the night veil never covers a tail twice) and never clipped (ruling 10). A sprite has no glow: no
  // shipped mover has an emissive layer (M6).
  const placements = useMemo(() => new Map<string, Placement>(layout.pieces.map((p) => [p.id, p])), [layout]);
  const spriteOf = (m: PieceMover) => {
    const p = placements.get(m.id);
    if (!p) return null;
    const state = effects.states.get(p.id);
    return { p, state, key: `mover#${p.item}#${p.facing}#${m.flip}#${state ?? ''}#${night ? 'n' : 'd'}#${colour}#${weather}#${cellPt}` };
  };
  const spriteSig = pieceMovers.map((m) => `${m.id}=${spriteOf(m)?.key ?? ''}`).join('|');
  const sprites = useMemo(() => {
    const out = new Map<string, { key: string; base: SkPicture; frames: SkPicture[] }>();
    for (const m of pieceMovers) {
      const s = spriteOf(m);
      if (!s) continue;
      const [base, ...frames] = lru.get(s.key, () => {
        const ctx: ItemContext = { weather, night, colour, ramp: kipRamp(KIP_COLOURS[colour]), screen: 'lines' };
        const l = pieceLayers(s.p.item, ctx, { layer: 'floor', facing: s.p.facing, mirror: m.flip, ...(s.state ? { effect: s.state } : {}) });
        return [record([l?.base ?? []], cellPt), ...(l?.frames ?? []).map((f) => record([f], cellPt))];
      });
      out.set(`${MOVER_PREFIX}${m.id}`, { key: s.key, base: base!, frames });
    }
    return out;
  }, [spriteSig]); // eslint-disable-line react-hooks/exhaustive-deps
  const spriteAt = pieceMovers.map((m) => `${MOVER_PREFIX}${m.id}:${m.pos[0]},${m.pos[1]}`).join(';');
  const spriteCells = useMemo(
    () => new Map(pieceMovers.map((m) => [`${MOVER_PREFIX}${m.id}`, pieceTileCell(room.grid, m.pos)])),
    [spriteAt, room.grid], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // After each commit: release the sets the drawn tree no longer needs (another room's, the oldest past the size).
  const drawn = [kipKey, staticSetKey, seatedKey, underKey, framesKey, ...[...sprites.values()].map((s) => s.key)];
  useEffect(() => { lru.trim(new Set(drawn.filter((k): k is string => !!k)), staticKey); });

  // Where KIP is drawn, relative to its seat: its tile, a bob between tiles, a sway at the radio (no recording).
  const [kx, ky] = kipMover ? kipTileCell(room.grid, kipMover.pos) : [seat.x, seat.y];
  const bob = kipMover?.moving && !still && frame % 2 === 1 ? -1 : 0;
  const sway = kipMover?.sway && !still ? [0, 1, -1][frame]! : 0;
  const dx = kx - seat.x + sway;
  const dy = ky - seat.y + bob;
  const kipDepth: Tile | null = kipMover ? kipMover.depth : room.seat;
  const seatedKip = !kipMover || sameTile(kipMover.depth, room.seat);
  const moverAts = [
    ...(kipDepth ? [{ key: KIP_MOVER, depth: kipDepth }] : []),
    ...pieceMovers.map((m) => ({ key: `${MOVER_PREFIX}${m.id}`, depth: m.depth })),
  ];
  // The order changes only when a mover reaches a new tile: a glide between two tiles reuses it.
  const orderKey = movers ? `${staticKey}|${moverAts.map((m) => `${m.key}:${m.depth[0]},${m.depth[1]}`).join(';')}|${seatedKip}` : '';
  const order = useMemo(
    () => (movers ? moverOrder(room.runs, moverAts, seatedKip && room.deskId ? [room.deskId, KIP_MOVER] : null) : NO_IDS),
    [orderKey], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const kipPicture = kipPictures[frame]!;
  const kipNode = useMemo(() => (
    <Group key={KIP_MOVER} transform={shift(dx, dy, cellPt)}>
      <Picture picture={kipPicture} />
    </Group>
  ), [kipPicture, dx, dy, cellPt]);
  // The floor pieces and the movers' bases as elements, made once per picture set and place: a new loop frame or a
  // walk step draws KIP again, never the floor pieces (T9-FIX M3).
  const pieceNodes = useMemo(() => {
    const out = new Map<string, React.ReactElement>();
    for (const [id, pic] of runPictures) out.set(id, <Picture key={id} picture={pic} />);
    for (const [key, m] of sprites) {
      const at = spriteCells.get(key);
      if (at) out.set(key, <Group key={key} transform={shift(at[0], at[1], cellPt)}><Picture picture={m.base} /></Group>);
    }
    return out;
  }, [runPictures, sprites, spriteCells, cellPt]);
  const layers = useMemo(
    () => (shell ? order.map((key) => (key === KIP_MOVER ? kipNode : pieceNodes.get(key) ?? null)) : null),
    [shell, order, kipNode, pieceNodes],
  );
  const spriteLoops = useMemo(() => [...sprites].map(([key, m]) => {
    const at = spriteCells.get(key);
    const f = m.frames[frame];
    return at && f ? <Group key={key} transform={shift(at[0], at[1], cellPt)}><Picture picture={f} /></Group> : null;
  }), [sprites, spriteCells, frame, cellPt]);
  const loops = walkFrames && kipPaths ? (
    <Group transform={shift(dx, dy, cellPt)} clip={kipPaths[frame]!} invertClip>
      <Group transform={shift(-dx, -dy, cellPt)}>
        <Picture picture={walkFrames[frame]!} />
      </Group>
    </Group>
  ) : seatedFrames ? <Picture picture={seatedFrames[frame]!} /> : null;

  const box = props.box === 'thumb' ? room.thumb : room.focus;
  const offset = props.offset ?? isoCrop({ width: crop.width, height: crop.height, cellPt, box, room: room.grid });
  useImperativeHandle(props.ref, () => ({
    pieceAtPoint: (x: number, y: number) => pieceAt(room.hits, Math.floor((x - offset.x) / cellPt), Math.floor((y - offset.y) / cellPt)),
  }), [room, offset.x, offset.y, cellPt]);
  const anchor = bubbleAnchor(seat);
  // Measured, so a long bubble is pulled in from the right edge instead of clipped by the crop.
  const [bubbleWidth, setBubbleWidth] = useState(0);
  const bubbleLeft = Math.max(BUBBLE_INSET, Math.min(offset.x + anchor.x * cellPt - 36, crop.width - bubbleWidth - BUBBLE_INSET));
  return (
    <View
      testID={props.testID}
      accessible={props.accessible ?? true}
      accessibilityRole={props.accessible === false ? undefined : 'image'}
      accessibilityLabel={props.accessibilityLabel}
      style={{ width: crop.width, height: crop.height, overflow: 'hidden' }}
    >
      <Canvas style={{ width: crop.width, height: crop.height }}>
        <Group transform={[{ translateX: offset.x }, { translateY: offset.y }]}>
          {shell ? (
            <>
              <Picture picture={shell[0]!} />
              {kipDepth ? null : kipNode}
              {layers}
              <Picture picture={shell[1]!} />
              {spriteLoops}
              {loops}
            </>
          ) : (
            <>
              <Picture picture={staticSet![0]!} />
              <Picture picture={kipPicture} />
              <Picture picture={staticSet![1]!} />
              {loops}
            </>
          )}
        </Group>
      </Canvas>
      {bubble ? (
        <View
          testID="room-bubble"
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          className="absolute rounded-lg bg-[#F5F5F4] px-2 py-1"
          onLayout={(e) => setBubbleWidth(e.nativeEvent.layout.width)}
          style={{ left: bubbleLeft, bottom: crop.height - (offset.y + anchor.y * cellPt) }}
        >
          <Text className="font-pixel text-label text-[#0A0B0E]" numberOfLines={1} maxFontSizeMultiplier={BUBBLE_MAX_FONT_SCALE}>
            {bubble}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
