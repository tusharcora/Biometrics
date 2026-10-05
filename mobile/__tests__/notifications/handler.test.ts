import * as Notifications from 'expo-notifications';
import {
  RECAP_PUSH_KIND,
  WIND_DOWN_KIND,
  installNotificationHandler,
  listenForNotificationTaps,
  routeInitialNotification,
} from '../../src/notifications/handler';
import { navigationRef } from '../../src/navigation/navigationRef';
import { ApiError } from '../../src/api/client';
import { fetchRecap } from '../../src/api/recaps';

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getLastNotificationResponseAsync: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(),
}));
jest.mock('../../src/navigation/navigationRef', () => ({
  navigationRef: { isReady: jest.fn(), navigate: jest.fn() },
}));
jest.mock('../../src/api/recaps', () => ({ fetchRecap: jest.fn() }));

const N = Notifications as jest.Mocked<typeof Notifications>;
const ref = navigationRef as unknown as { isReady: jest.Mock; navigate: jest.Mock };
const notification = (data: Record<string, unknown>) => ({ request: { content: { data } } }) as never;
const response = (data: Record<string, unknown>) => ({ notification: notification(data), actionIdentifier: 'default' }) as never;

beforeEach(() => {
  jest.clearAllMocks();
  ref.isReady.mockReturnValue(true);
});
afterEach(() => {
  jest.useRealTimers();
});

describe('installNotificationHandler', () => {
  const handle = () => {
    installNotificationHandler();
    return N.setNotificationHandler.mock.calls[0][0]!.handleNotification;
  };

  it('shows wind-down reminders while the app is open', async () => {
    expect(await handle()(notification({ kind: WIND_DOWN_KIND }))).toEqual({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    });
  });

  it('keeps every other notification as before (not shown in the foreground)', async () => {
    const off = { shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false };
    expect(await handle()(notification({ kind: 'weekly-recap' }))).toEqual(off);
    expect(await handle()(notification({}))).toEqual(off);
    expect(await handle()({ request: { content: { data: null } } } as never)).toEqual(off);
  });

  it('never throws when the native module is missing', () => {
    N.setNotificationHandler.mockImplementationOnce(() => {
      throw new Error('unavailable');
    });
    expect(() => installNotificationHandler()).not.toThrow();
  });
});

describe('routeInitialNotification (cold start)', () => {
  it('opens Sleep when the app was launched from a wind-down reminder', async () => {
    N.getLastNotificationResponseAsync.mockResolvedValue(response({ kind: WIND_DOWN_KIND }));
    await routeInitialNotification();
    expect(ref.navigate).toHaveBeenCalledWith('Sleep', undefined, { pop: true });
  });

  it('does nothing for any other launch', async () => {
    N.getLastNotificationResponseAsync.mockResolvedValue(response({ kind: 'weekly-recap' }));
    await routeInitialNotification();
    N.getLastNotificationResponseAsync.mockResolvedValue(null);
    await routeInitialNotification();
    N.getLastNotificationResponseAsync.mockRejectedValue(new Error('unavailable'));
    await routeInitialNotification();
    expect(ref.navigate).not.toHaveBeenCalled();
  });

  it('waits for the signed-in navigator to be ready', async () => {
    jest.useFakeTimers();
    ref.isReady.mockReturnValue(false);
    N.getLastNotificationResponseAsync.mockResolvedValue(response({ kind: WIND_DOWN_KIND }));
    const done = routeInitialNotification();
    await jest.advanceTimersByTimeAsync(300);
    expect(ref.navigate).not.toHaveBeenCalled();
    ref.isReady.mockReturnValue(true);
    await jest.advanceTimersByTimeAsync(100);
    await done;
    expect(ref.navigate).toHaveBeenCalledWith('Sleep', undefined, { pop: true });
    expect(jest.getTimerCount()).toBe(0);
  });

  it('gives up after 5 s (signed out: the signed-in navigator never mounts)', async () => {
    jest.useFakeTimers();
    ref.isReady.mockReturnValue(false);
    N.getLastNotificationResponseAsync.mockResolvedValue(response({ kind: WIND_DOWN_KIND }));
    const done = routeInitialNotification();
    await jest.advanceTimersByTimeAsync(5000);
    await done;
    expect(jest.getTimerCount()).toBe(0);
    ref.isReady.mockReturnValue(true);
    await jest.advanceTimersByTimeAsync(1000);
    expect(ref.navigate).not.toHaveBeenCalled();
  });

  it('stops waiting when aborted (unmount)', async () => {
    jest.useFakeTimers();
    ref.isReady.mockReturnValue(false);
    N.getLastNotificationResponseAsync.mockResolvedValue(response({ kind: WIND_DOWN_KIND }));
    const controller = new AbortController();
    const done = routeInitialNotification(controller.signal);
    await jest.advanceTimersByTimeAsync(200);
    controller.abort();
    await done;
    expect(jest.getTimerCount()).toBe(0);
    ref.isReady.mockReturnValue(true);
    await jest.advanceTimersByTimeAsync(1000);
    expect(ref.navigate).not.toHaveBeenCalled();
  });
});

describe('listenForNotificationTaps (warm start)', () => {
  const remove = jest.fn();
  const tap = () => N.addNotificationResponseReceivedListener.mock.calls[0][0];
  beforeEach(() => {
    N.addNotificationResponseReceivedListener.mockReturnValue({ remove } as never);
  });

  it('opens Sleep when a wind-down reminder is tapped', async () => {
    listenForNotificationTaps();
    tap()(response({ kind: WIND_DOWN_KIND }));
    await Promise.resolve();
    expect(ref.navigate).toHaveBeenCalledWith('Sleep', undefined, { pop: true });
  });

  it('ignores taps on other notifications', async () => {
    listenForNotificationTaps();
    tap()(response({ kind: 'weekly-recap' }));
    await Promise.resolve();
    expect(ref.navigate).not.toHaveBeenCalled();
  });

  it('unsubscribes and cancels a pending wait', async () => {
    jest.useFakeTimers();
    ref.isReady.mockReturnValue(false);
    const stop = listenForNotificationTaps();
    tap()(response({ kind: WIND_DOWN_KIND }));
    stop();
    expect(remove).toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
    ref.isReady.mockReturnValue(true);
    await jest.advanceTimersByTimeAsync(1000);
    expect(ref.navigate).not.toHaveBeenCalled();
  });

  it('never throws when the native module is missing', () => {
    N.addNotificationResponseReceivedListener.mockImplementationOnce(() => {
      throw new Error('unavailable');
    });
    expect(() => listenForNotificationTaps()()).not.toThrow();
  });
});

const RECAP_ID = '3f2c7a8e-1b2d-4c5e-9f00-0123456789ab';

describe('recap pushes', () => {
  const week = { id: RECAP_ID, kind: 'WEEK', periodStart: '2026-09-28', periodEnd: '2026-10-04' };
  const month = { id: RECAP_ID, kind: 'MONTH', periodStart: '2026-09-01', periodEnd: '2026-09-30' };
  const load = fetchRecap as jest.Mock;
  beforeEach(() => load.mockResolvedValue(week));

  it("cold start: a week's push plays its story, with the recap it loaded", async () => {
    N.getLastNotificationResponseAsync.mockResolvedValue(response({ kind: RECAP_PUSH_KIND, recapId: RECAP_ID }));
    await routeInitialNotification();
    expect(load).toHaveBeenCalledWith(RECAP_ID);
    expect(ref.navigate).toHaveBeenCalledTimes(1);
    expect(ref.navigate).toHaveBeenCalledWith('RecapStory', { recap: week }, { pop: true });
  });

  it("a month's push opens its recap screen", async () => {
    load.mockResolvedValue(month);
    N.getLastNotificationResponseAsync.mockResolvedValue(response({ kind: RECAP_PUSH_KIND, recapId: RECAP_ID }));
    await routeInitialNotification();
    expect(ref.navigate).toHaveBeenCalledWith('Recap', { id: RECAP_ID }, { pop: true });
  });

  it("a stale push (404) or a failed load opens the recap screen, which says it isn't available or offers a retry", async () => {
    N.getLastNotificationResponseAsync.mockResolvedValue(response({ kind: RECAP_PUSH_KIND, recapId: RECAP_ID }));
    load.mockRejectedValueOnce(new ApiError(404, 'gone', 'not_found'));
    await routeInitialNotification();
    expect(ref.navigate).toHaveBeenLastCalledWith('Recap', { id: RECAP_ID }, { pop: true });
    load.mockRejectedValueOnce(new Error('offline'));
    await routeInitialNotification();
    expect(ref.navigate).toHaveBeenLastCalledWith('Recap', { id: RECAP_ID }, { pop: true });
  });

  it('cold start: waits for the signed-in navigator before loading', async () => {
    jest.useFakeTimers();
    ref.isReady.mockReturnValue(false);
    N.getLastNotificationResponseAsync.mockResolvedValue(response({ kind: RECAP_PUSH_KIND, recapId: RECAP_ID }));
    const done = routeInitialNotification();
    await Promise.resolve();
    await Promise.resolve();
    expect(load).not.toHaveBeenCalled();
    ref.isReady.mockReturnValue(true);
    jest.advanceTimersByTime(100);
    await done;
    expect(ref.navigate).toHaveBeenCalledWith('RecapStory', { recap: week }, { pop: true });
  });

  it('cold start: goes nowhere once the wait is called off (signed out meanwhile)', async () => {
    let finish!: (v: unknown) => void;
    load.mockImplementation(() => new Promise((r) => (finish = r)));
    N.getLastNotificationResponseAsync.mockResolvedValue(response({ kind: RECAP_PUSH_KIND, recapId: RECAP_ID }));
    const controller = new AbortController();
    const done = routeInitialNotification(controller.signal);
    await new Promise((r) => setImmediate(r));
    controller.abort();
    finish(week);
    await done;
    expect(ref.navigate).not.toHaveBeenCalled();
  });

  it("warm start: a week's push tapped while the app runs plays its story", async () => {
    const unsubscribe = listenForNotificationTaps();
    const listener = N.addNotificationResponseReceivedListener.mock.calls[0]![0];
    listener(response({ kind: RECAP_PUSH_KIND, recapId: RECAP_ID }));
    await new Promise((r) => setImmediate(r));
    expect(ref.navigate).toHaveBeenCalledWith('RecapStory', { recap: week }, { pop: true });
    unsubscribe();
  });

  it('ignores malformed recap data and other kinds, as before', async () => {
    for (const data of [{ kind: 'recap' }, { kind: 'recap', recapId: 'not-a-uuid' }, { kind: 'recap', recapId: 42 }, { kind: 'weekly_digest' }]) {
      N.getLastNotificationResponseAsync.mockResolvedValue(response(data));
      await routeInitialNotification();
    }
    const unsubscribe = listenForNotificationTaps();
    N.addNotificationResponseReceivedListener.mock.calls[0]![0](response({ kind: 'recap', recapId: 'x' }));
    unsubscribe();
    expect(ref.navigate).not.toHaveBeenCalled();
  });

  it('keeps a recap push hidden while the app is open, like every other push', async () => {
    installNotificationHandler();
    const handle = N.setNotificationHandler.mock.calls[0]![0]!.handleNotification;
    expect(await handle(notification({ kind: RECAP_PUSH_KIND, recapId: RECAP_ID }))).toEqual({ shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false });
  });
});
