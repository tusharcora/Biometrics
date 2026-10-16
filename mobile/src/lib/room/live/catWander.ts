// The cat's wander (spec 2026-10-15 §8.2, §9.2; P3 ruling 10): from its own tile to the nearest free tile of the front
// row, then up to 3 tiles along it, toward the side with more room. The front row is j = m − 1 (the row nearest you
// along the left side) when the card shows 2 of its tiles free; in a bigger room the card's crop cuts that row off,
// so it is the frontmost row that does (ruling T11-ROW). Then half a tile per 400 ms step, a 2.4 s pause at each end, then home again, round and round. Only a running cat
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
import { STEP_MS, bfs, blockedTiles, headsLeft, posAt, tileInView, tileKey } from './walk';

/** 2.4 s at each end of the route. */
export const PAUSE_STEPS = 6;
export interface CatRoute { id: string; path: Tile[] }

const NO_TILES: ReadonlySet<string> = new Set();

/**
 * The cat's way out from its own tile, or null when no row has 2 free tiles or it can reach none of its row's (it
 * sits). With `view`, only tiles inside the room card's crop are walked on (spec §9.2), as for KIP; `avoid` holds the
 * tiles other wandering cats walk, so two cats never share one.
 */
export function catRoute(
  layout: RoomLayout, tier: Tier, cat: Placement, deps: GeometryDeps = GEOMETRY_DEPS, view: Box | null = null,
  avoid: ReadonlySet<string> = NO_TILES,
): Tile[] | null {
  const { n, m } = tierSize(tier);
  const blocked = blockedTiles(layout, deps);
  blocked.delete(tileKey([cat.x, cat.y]));
  // KIP's seat and the tile out of it stay free for KIP.
  const desk = deskOf(layout);
  const iso = desk ? deps.isoOf(desk.item) : undefined;
  for (const t of desk && iso ? [seatTile(desk, iso), exitTile(desk, iso)] : []) if (t) blocked.add(tileKey(t));
  if (view) {
    const g = isoGrid(tier);
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) if (!tileInView(g, [i, j], view)) blocked.add(tileKey([i, j]));
  }
  for (const t of avoid) blocked.add(t);
  const home: Tile = [cat.x, cat.y];
  const freeIn = (j: number) => { let c = 0; for (let i = 0; i < n; i++) if (!blocked.has(tileKey([i, j]))) c++; return c; };
  let front = m - 1;
  while (front >= 0 && freeIn(front) < 2) front--;
  if (front < 0) return null;
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
      if (t[0] < 0 || t[0] >= n || blocked.has(tileKey(t))) break;
      out.push(t);
    }
    return out;
  };
  const right = along(1);
  const left = along(-1);
  const path = [...best, ...(right.length >= left.length ? right : left)];
  return path.length > 1 ? path : null;
}

/** Every running cat in the `wander` state with somewhere to go; each plans round the routes before it. */
export function wanderRoutes(layout: RoomLayout, tier: Tier, effects: RoomEffects, deps: GeometryDeps = GEOMETRY_DEPS, view: Box | null = null): CatRoute[] {
  const taken = new Set<string>();
  const out: CatRoute[] = [];
  for (const p of layout.pieces) {
    if (p.layer !== 'floor' || !effects.running.has(p.id) || effects.states.get(p.id) !== 'wander' || deps.isoOf(p.item)?.effect !== 'wander') continue;
    const path = catRoute(layout, tier, p, deps, view, taken);
    if (!path) continue;
    for (const t of path) taken.add(tileKey(t));
    out.push({ id: p.id, path });
  }
  return out;
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
    out.add(tileKey(m.depth));
    if (m.next) out.add(tileKey(m.next));
  }
  return out;
}

/** A step between two tiles moves on to the tile it was stepping onto: where a cat waits (no half-tile jump back). */
const wholeStep = (r: CatRoute, tick: number): number => {
  const { pos } = catAt(r, tick);
  return pos[0] % 1 !== 0 || pos[1] % 1 !== 0 ? tick + 1 : tick;
};
const NO_TICKS: readonly number[] = [];

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
  // The route the ticks belong to joins them, so a new room puts each cat home in that same render. Each cat has its
  // own tick: waiting snaps each to a whole tile, and they need not be in step.
  const [state, setState] = useState<{ route: string; ticks: readonly number[] }>({ route: '', ticks: NO_TICKS });
  const ticks = state.route === routeKey ? state.ticks : NO_TICKS;
  const tickOf = (k: number) => ticks[k] ?? 0;
  useEffect(() => {
    const fresh = (s: { route: string; ticks: readonly number[] }) => (s.route === routeKey ? s.ticks : NO_TICKS);
    // Waiting, each cat stays on the tile it was stepping onto, and goes on from there when KIP sits.
    setState((s) => (s.route === routeKey && !waits ? s : { route: routeKey, ticks: routes.map((r, k) => (waits ? wholeStep(r, fresh(s)[k] ?? 0) : 0)) }));
    if (!routes.length || waits) return undefined;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const step = () => {
      setState((s) => ({ route: routeKey, ticks: routes.map((_, k) => (fresh(s)[k] ?? 0) + 1) }));
      timer = setTimeout(step, STEP_MS);
    };
    timer = setTimeout(step, STEP_MS);
    return () => { if (timer) clearTimeout(timer); };
  }, [routes, routeKey, waits]);
  return useMemo(
    () => routes.map((r, k) => catAt(r, waits ? wholeStep(r, tickOf(k)) : tickOf(k))),
    [routes, ticks, waits], // eslint-disable-line react-hooks/exhaustive-deps
  );
}
