// The weekly story viewer's navigation and timing (recap restyle 2026-10-05), pure so it is tested
// without a clock: each frame runs STORY_FRAME_MS and then moves on, a tap on the right half goes
// to the next frame and on the left half to the previous one, a hold (or a share in progress)
// pauses, and going past the last frame closes the viewer. Times are passed in (`now`, ms).

export const STORY_FRAME_MS = 5000;

/** Why the story is paused; it runs only when there is none. */
export type PauseReason = 'hold' | 'drag' | 'share' | 'background';

export interface ViewerState {
  index: number;
  count: number;
  /** Time the current frame has already run, not counting the current run. */
  elapsed: number;
  /** When the current run started; null while paused or closed. */
  startedAt: number | null;
  pausedBy: PauseReason[];
  closed: boolean;
}

export type ViewerAction =
  | { type: 'next' | 'prev' | 'close'; now: number }
  | { type: 'pause' | 'resume'; reason: PauseReason; now: number };

export function initialViewer(count: number, now: number): ViewerState {
  return { index: 0, count, elapsed: 0, startedAt: now, pausedBy: [], closed: false };
}

export function isRunning(s: ViewerState): boolean {
  return !s.closed && s.pausedBy.length === 0;
}

/** A frame shown from its start: running now, or waiting for the pause to end. */
function showFrame(s: ViewerState, index: number, now: number): ViewerState {
  return { ...s, index, elapsed: 0, startedAt: s.pausedBy.length === 0 ? now : null };
}

export function viewerReducer(s: ViewerState, a: ViewerAction): ViewerState {
  if (s.closed) return s;
  switch (a.type) {
    case 'next':
      return s.index >= s.count - 1 ? { ...s, startedAt: null, closed: true } : showFrame(s, s.index + 1, a.now);
    case 'prev':
      return showFrame(s, Math.max(0, s.index - 1), a.now);
    case 'close':
      return { ...s, startedAt: null, closed: true };
    case 'pause': {
      if (s.pausedBy.includes(a.reason)) return s;
      const elapsed = s.startedAt === null ? s.elapsed : s.elapsed + (a.now - s.startedAt);
      return { ...s, elapsed, startedAt: null, pausedBy: [...s.pausedBy, a.reason] };
    }
    case 'resume': {
      if (!s.pausedBy.includes(a.reason)) return s;
      const pausedBy = s.pausedBy.filter((r) => r !== a.reason);
      return { ...s, pausedBy, startedAt: pausedBy.length === 0 ? a.now : null };
    }
  }
}

/** Time left on the current frame. */
export function remainingMs(s: ViewerState, now: number): number {
  const ran = s.elapsed + (s.startedAt === null ? 0 : now - s.startedAt);
  return Math.max(0, STORY_FRAME_MS - ran);
}

/** How far the current frame's bar is filled, 0–1. */
export function frameProgress(s: ViewerState, now: number): number {
  return 1 - remainingMs(s, now) / STORY_FRAME_MS;
}

/** A tap on the frame: the right half moves on, the left half goes back. */
export function tapSide(x: number, width: number): 'prev' | 'next' {
  return x >= width / 2 ? 'next' : 'prev';
}
