import * as Notifications from 'expo-notifications';
import {
  WIND_DOWN_KIND,
  installNotificationHandler,
  listenForNotificationTaps,
  routeInitialNotification,
} from '../../src/notifications/handler';
import { navigationRef } from '../../src/navigation/navigationRef';

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getLastNotificationResponseAsync: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(),
}));
jest.mock('../../src/navigation/navigationRef', () => ({
  navigationRef: { isReady: jest.fn(), navigate: jest.fn() },
}));

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
