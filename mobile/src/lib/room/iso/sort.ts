// Depth order for floor pieces (spec 2026-10-15 §3.4): a topological sort, not one depth key. A is behind B when
// A's far edge is at or behind B's near edge on either axis. When both hold, the two never overlap on screen (A is
// wholly left or right of B), so no edge is needed. Kahn's algorithm picks, among the pieces ready to draw, the one
// furthest back (i0 + j0), then the key (the instance id), so the picture is deterministic. Footprints of a valid
// layout never overlap, so a cycle cannot form; if a stored layout (or a bad extra edge) ever makes one, the
// lowest-ranked piece still waiting is released and Kahn carries on, so every other edge still holds and nothing
// throws. O(n²) for at most 90 pieces.

export interface DepthBox {
  key: string;
  i0: number;
  j0: number;
  i1: number;
  j1: number;
}

const behind = (a: DepthBox, b: DepthBox) => a.i1 <= b.i0 || a.j1 <= b.j0;
const rank = (a: DepthBox, b: DepthBox) => a.i0 + a.j0 - (b.i0 + b.j0) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);

export function depthOrder(boxes: readonly DepthBox[], extra: ReadonlyArray<readonly [string, string]> = []): string[] {
  const n = boxes.length;
  const indeg = new Array<number>(n).fill(0);
  const next: number[][] = boxes.map(() => []);
  const edge = (a: number, b: number) => { next[a]!.push(b); indeg[b]!++; };
  for (let a = 0; a < n; a++) {
    for (let b = a + 1; b < n; b++) {
      const ab = behind(boxes[a]!, boxes[b]!);
      const ba = behind(boxes[b]!, boxes[a]!);
      if (ab && !ba) edge(a, b);
      else if (ba && !ab) edge(b, a);
    }
  }
  const index = new Map(boxes.map((box, k) => [box.key, k]));
  for (const [from, to] of extra) {
    const a = index.get(from);
    const b = index.get(to);
    if (a !== undefined && b !== undefined) edge(a, b);
  }
  const done = new Array<boolean>(n).fill(false);
  const out: string[] = [];
  const lowest = (ready: boolean) => {
    let pick = -1;
    for (let k = 0; k < n; k++) if (!done[k] && (!ready || indeg[k] === 0) && (pick < 0 || rank(boxes[k]!, boxes[pick]!) < 0)) pick = k;
    return pick;
  };
  while (out.length < n) {
    // Only a cycle leaves nothing ready: release its lowest-ranked piece.
    const ready = lowest(true);
    const pick = ready >= 0 ? ready : lowest(false);
    done[pick] = true;
    out.push(boxes[pick]!.key);
    for (const b of next[pick]!) indeg[b]!--;
  }
  return out;
}
