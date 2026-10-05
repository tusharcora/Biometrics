import { EXPIRE_GRACE_MS, frameProgress, initialViewer, isRunning, remainingMs, STORY_FRAME_MS, tapSide, viewerReducer, type ViewerState } from '../../src/lib/storyViewer';

const run = (s: ViewerState, ...actions: Parameters<typeof viewerReducer>[1][]) => actions.reduce(viewerReducer, s);

it('gives each frame about five seconds', () => {
  expect(STORY_FRAME_MS).toBe(5000);
});

it('starts on the first frame, running, with the whole frame time left', () => {
  const s = initialViewer(3, 1000);
  expect(s).toMatchObject({ index: 0, count: 3, closed: false });
  expect(isRunning(s)).toBe(true);
  expect(remainingMs(s, 1000)).toBe(5000);
  expect(remainingMs(s, 3000)).toBe(3000);
  expect(frameProgress(s, 2250)).toBeCloseTo(0.25);
});

it('steps forward and back, restarting the frame each time, and stays on the first frame going back from it', () => {
  let s = run(initialViewer(3, 0), { type: 'next', now: 4000 });
  expect(s.index).toBe(1);
  expect(remainingMs(s, 4000)).toBe(5000);
  s = run(s, { type: 'prev', now: 6000 });
  expect(s.index).toBe(0);
  expect(remainingMs(s, 6000)).toBe(5000);
  s = run(s, { type: 'prev', now: 7000 });
  expect(s.index).toBe(0);
  expect(remainingMs(s, 8000)).toBe(4000);
});

it('closes after the last frame, by tap or by its time running out', () => {
  const last = run(initialViewer(3, 0), { type: 'next', now: 0 }, { type: 'next', now: 0 });
  expect(last.index).toBe(2);
  expect(run(last, { type: 'next', now: 100 })).toMatchObject({ index: 2, closed: true });
  expect(isRunning(run(last, { type: 'next', now: 100 }))).toBe(false);
  expect(run(initialViewer(3, 0), { type: 'close', now: 10 }).closed).toBe(true);
});

it('pauses while held and resumes with the time that was left', () => {
  let s = run(initialViewer(3, 0), { type: 'pause', reason: 'hold', now: 2000 });
  expect(isRunning(s)).toBe(false);
  // Time held does not count.
  expect(remainingMs(s, 9000)).toBe(3000);
  expect(frameProgress(s, 9000)).toBeCloseTo(0.4);
  s = run(s, { type: 'resume', reason: 'hold', now: 9000 });
  expect(isRunning(s)).toBe(true);
  expect(remainingMs(s, 10000)).toBe(2000);
});

it('stays paused until every reason to pause has ended (a hold during a share)', () => {
  let s = run(initialViewer(3, 0), { type: 'pause', reason: 'share', now: 1000 }, { type: 'pause', reason: 'hold', now: 1500 });
  s = run(s, { type: 'resume', reason: 'hold', now: 2000 });
  expect(isRunning(s)).toBe(false);
  s = run(s, { type: 'resume', reason: 'share', now: 3000 });
  expect(isRunning(s)).toBe(true);
  expect(remainingMs(s, 3000)).toBe(4000);
  // A repeated pause or a resume without a pause changes nothing.
  expect(run(s, { type: 'resume', reason: 'hold', now: 3000 })).toEqual(s);
});

it('a tap while paused moves frame and starts the new one paused, its full time ahead', () => {
  const s = run(initialViewer(3, 0), { type: 'pause', reason: 'hold', now: 1000 }, { type: 'next', now: 1200 });
  expect(s.index).toBe(1);
  expect(isRunning(s)).toBe(false);
  expect(remainingMs(s, 5000)).toBe(5000);
  expect(remainingMs(run(s, { type: 'resume', reason: 'hold', now: 5000 }), 6000)).toBe(4000);
});

it("moves on when a frame's time runs out, and ignores a timer that races a tap", () => {
  expect(EXPIRE_GRACE_MS).toBe(150);
  const s = initialViewer(3, 0);
  expect(run(s, { type: 'expire', index: 0, now: 5000 }).index).toBe(1);
  // The tap landed first: the timer set for frame 1 is stale.
  const tapped = run(s, { type: 'next', now: 4990 });
  expect(run(tapped, { type: 'expire', index: 0, now: 5000 }).index).toBe(1);
  // A timer for the frame on screen, but within the grace of a change, is a race too.
  expect(run(tapped, { type: 'expire', index: 1, now: 4990 + EXPIRE_GRACE_MS - 1 }).index).toBe(1);
  expect(run(tapped, { type: 'expire', index: 1, now: 4990 + STORY_FRAME_MS }).index).toBe(2);
  // Expiry on the last frame closes.
  expect(run(initialViewer(1, 0), { type: 'expire', index: 0, now: 5000 }).closed).toBe(true);
});

it('ignores everything once closed', () => {
  const closed = run(initialViewer(3, 0), { type: 'close', now: 0 });
  expect(run(closed, { type: 'prev', now: 1 }, { type: 'resume', reason: 'hold', now: 2 })).toEqual(closed);
});

it('reads a tap on the right half as next and the left half as previous', () => {
  expect(tapSide(300, 400)).toBe('next');
  expect(tapSide(200, 400)).toBe('next');
  expect(tapSide(199, 400)).toBe('prev');
  expect(tapSide(0, 400)).toBe('prev');
});
