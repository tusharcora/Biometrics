// The cat's wander (spec 2026-10-15 §8.2, §9.2; P3 ruling 10): from its own tile to the nearest free tile of the front
// row (j = m − 1, the row nearest you along the left side), then up to 3 tiles along it, toward the side with more
// room; half a tile per 400 ms step, a 2.4 s pause at each end, then home again, round and round. Only a running cat
// in the `wander` state wanders, and only where RoomView animates (the KIP page's room card, Reduce Motion off). It
// paths like KIP (Task 10): over free tiles inside the card's crop only, never over KIP's seat or the tile out of it.
// KIP and the cat never share a tile: KIP plans each trip round the tiles the cat is on and steps onto next
// (takenTiles), and while KIP is off its seat the cat waits on a whole tile, so nothing moves under KIP's path.
import { useEffect, useMemo, useState } from 'react';
import { GEOMETRY_DEPS } from '../catalogue';
import type { Box } from '../grid';
import type { RoomEffects } from '../effects';
import { exitTile, seatTile, tierSize, type GeometryDeps, type Placement, type RoomLayout, type Tier } from '../iso/geometry';
import { isoGrid } from '../iso/grid';
import type { Tile } from '../iso/movers';
import { deskOf, layoutKey } from '../layout';
import type { PieceMover } from '../../../components/room/RoomView';
import { STEP_MS, bfs, blockedTiles, headsLeft, posAt, tileInView } from './walk';

/** 2.4 s at each end of the route. */
export const PAUSE_STEPS = 6;
export interface CatRoute { id: string; path: Tile[] }

const key = (t: Tile) => `${t[0]},${t[1]}`;

/**
 * The cat's way out from its own tile, or null when it can reach no tile of the front row (it sits). With `view`, only
 * tiles inside the room card's crop are walked on (spec §9.2), as for KIP.
 */
export function catRoute(layout: RoomLayout, tier: Tier, cat: Placement, deps: GeometryDeps = GEOMETRY_DEPS, view: Box | null = null): Tile[] | null {
  const { n, m } = tierSize(tier);
  const blocked = blockedTiles(layout, deps);
  blocked.delete(key([cat.x, cat.y]));
  // KIP's seat and the tile out of it stay free for KIP.
  const desk = deskOf(layout);
  const iso = desk ? deps.isoOf(desk.item) : undefined;
  for (const t of desk && iso ? [seatTile(desk, iso), exitTile(desk, iso)] : []) if (t) blocked.add(key(t));
  if (view) {
    const g = isoGrid(tier);
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) if (!tileInView(g, [i, j], view)) blocked.add(key([i, j]));
  }
  const home: Tile = [cat.x, cat.y];
  const front = m - 1;
  let best: Tile[] | null = null;
  for (let i = 0; i < n; i++) {
    const p = bfs(home, [i, front], n, m, blocked);
    if (p && (!best || p.length < best.length)) best = p;
  }
  if (!best) return null;
  const end = best[best.length - 1]!;
  const along = (dir: 1 | -1): Tile[] => {
    const out: Tile[] = [];
    for (let k = 1; k <= 3; k++) {
      const t: Tile = [end[0] + dir * k, front];
      if (t[0] < 0 || t[0] >= n || blocked.has(key(t))) break;
      out.push(t);
    }
    return out;
  };
  const right = along(1);
  const left = along(-1);
  const path = [...best, ...(right.length >= left.length ? right : left)];
  return path.length > 1 ? path : null;
}

/** Every running cat in the `wander` state with somewhere to go. */
export function wanderRoutes(layout: RoomLayout, tier: Tier, effects: RoomEffects, deps: GeometryDeps = GEOMETRY_DEPS, view: Box | null = null): CatRoute[] {
  return layout.pieces
    .filter((p) => p.layer === 'floor' && effects.running.has(p.id) && effects.states.get(p.id) === 'wander' && deps.isoOf(p.item)?.effect === 'wander')
    .flatMap((p) => {
      const path = catRoute(layout, tier, p, deps, view);
      return path ? [{ id: p.id, path }] : [];
    });
}

/** Where a cat is at step `tick` of its round: out, a pause, back, a pause; `next` is where the next step takes it. */
export function catAt(r: CatRoute, tick: number): PieceMover {
  const S = 2 * (r.path.length - 1);
  const round = 2 * (S + PAUSE_STEPS);
  const at = (t: number): [number, 1 | -1] => {
    const c = t % round;
    return c <= S ? [c, 1] : c < S + PAUSE_STEPS ? [S, 1] : c <= 2 * S + PAUSE_STEPS ? [2 * S + PAUSE_STEPS - c, -1] : [0, -1];
  };
  const [s, dir] = at(tick);
  const here = posAt(r.path, s, dir);
  const ahead = posAt(r.path, Math.max(0, Math.min(S, s + dir)), dir);
  const [ns, ndir] = at(tick + 1);
  return { id: r.id, pos: here.pos, depth: here.depth, flip: headsLeft(here.pos, ahead.pos), next: posAt(r.path, ns, ndir).depth };
}

/** The tiles the cats are on (both, between two) and step onto next: KIP's next trip keeps off them. */
export function takenTiles(movers: readonly PieceMover[]): Set<string> {
  const out = new Set<string>();
  for (const m of movers) {
    out.add(`${Math.floor(m.pos[0])},${Math.floor(m.pos[1])}`);
    out.add(`${Math.ceil(m.pos[0])},${Math.ceil(m.pos[1])}`);
    out.add(key(m.depth));
    if (m.next) out.add(key(m.next));
  }
  return out;
}

const onTile = (m: PieceMover): PieceMover => ({ ...m, pos: m.depth, next: m.depth });

export interface CatWanderInput {
  enabled: boolean;
  layout: RoomLayout;
  tier: Tier;
  effects: RoomEffects;
  /** The room card's crop in room cells: the cat walks inside it only. */
  view?: Box | null;
  /** KIP is off its seat: the cat waits on the tile it was stepping onto, with no timer. */
  waits?: boolean;
}

/**
 * The wandering cats as piece movers. Disabled (unfocused, paused, under the collapsed header, Reduce Motion, the
 * editor) it is [] in that same render, so each cat is back on its own tile in the static room, with its timer
 * cleared; enabled again, or in a new room, it starts from home. One pending timer, a step at a time (Task 10's
 * pattern). It says nothing to a screen reader and takes no focus: the room stays one image with one label.
 */
export function useCatWander({ enabled, layout, tier, effects, view = null, waits = false }: CatWanderInput): readonly PieceMover[] {
  // Keyed on the wandering cats, not the whole effects key: the clock's minute never sends the cat home.
  const cats = [...effects.states].filter(([, s]) => s === 'wander').map(([id]) => id).sort().join(',');
  const layoutId = useMemo(() => layoutKey(layout), [layout]);
  const viewId = view ? `${view.x},${view.y},${view.w},${view.h}` : '';
  const routeKey = enabled ? `${layoutId}#${tier}#${cats}#${viewId}` : '';
  const routes = useMemo(() => (routeKey ? wanderRoutes(layout, tier, effects, GEOMETRY_DEPS, view) : []), [routeKey]); // eslint-disable-line react-hooks/exhaustive-deps
  // The route the tick belongs to joins it, so a new room puts the cat home in that same render.
  const [state, setState] = useState({ route: '', tick: 0 });
  const tick = state.route === routeKey ? state.tick : 0;
  useEffect(() => {
    setState((s) => (s.route === routeKey ? s : { route: routeKey, tick: 0 }));
    if (!routes.length || waits) return undefined;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const step = () => {
      setState((s) => ({ route: routeKey, tick: (s.route === routeKey ? s.tick : 0) + 1 }));
      timer = setTimeout(step, STEP_MS);
    };
    timer = setTimeout(step, STEP_MS);
    return () => { if (timer) clearTimeout(timer); };
  }, [routes, routeKey, waits]);
  return useMemo(() => routes.map((r) => (waits ? onTile(catAt(r, tick)) : catAt(r, tick))), [routes, tick, waits]);
}
