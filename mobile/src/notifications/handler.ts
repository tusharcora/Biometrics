import * as Notifications from 'expo-notifications';
import { navigationRef } from '../navigation/navigationRef';
import { WIND_DOWN_KIND } from '../lib/windDown';

// What the app does with notifications while it runs: shows the wind-down
// reminder in the foreground and opens the Sleep screen when one is tapped.
// Every native call here is best-effort: a build or simulator without the
// notifications module must still start.

export { WIND_DOWN_KIND };

const SHOW: Notifications.NotificationBehavior = {
  shouldShowBanner: true,
  shouldShowList: true,
  shouldPlaySound: true,
  shouldSetBadge: false,
};
// What the OS does with no handler set: a notification that arrives while the
// app is open is not shown. Coach pushes keep that.
const HIDE: Notifications.NotificationBehavior = {
  shouldShowBanner: false,
  shouldShowList: false,
  shouldPlaySound: false,
  shouldSetBadge: false,
};

// A cold start mounts the signed-in navigator a little after launch.
const READY_POLL_MS = 100;
const READY_TIMEOUT_MS = 5000;

function isWindDown(notification: Notifications.Notification): boolean {
  return notification.request.content.data?.kind === WIND_DOWN_KIND;
}

// Call once, at module load (App.tsx).
export function installNotificationHandler(): void {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async (notification) => (isWindDown(notification) ? SHOW : HIDE),
    });
  } catch {
    // No native module: nothing would arrive to handle.
  }
}

// `{ pop: true }`, as in coachNavigation: in React Navigation v7 a NAVIGATE
// reuses an existing route only when it is the current one or `pop` is set, so
// without it a tap while Sleep sits under the bedtime goal or a night would
// push a second Sleep instead of returning to the first.
function navigateToSleep(): void {
  navigationRef.navigate('Sleep', undefined, { pop: true });
}

// Navigates to Sleep once the signed-in navigator is ready, polling until it
// is, for up to 5 s. Signed out it never becomes ready, so this does nothing.
function openSleep(signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    if (navigationRef.isReady()) {
      navigateToSleep();
      return resolve();
    }
    const startedAt = Date.now();
    const finish = () => {
      clearInterval(timer);
      signal?.removeEventListener('abort', finish);
      resolve();
    };
    const timer = setInterval(() => {
      if (navigationRef.isReady()) {
        navigateToSleep();
        finish();
      } else if (Date.now() - startedAt >= READY_TIMEOUT_MS) {
        finish();
      }
    }, READY_POLL_MS);
    signal?.addEventListener('abort', finish);
  });
}

// Cold start: the app was launched by tapping a notification. Pass a signal to
// stop waiting for the navigator (on unmount).
export async function routeInitialNotification(signal?: AbortSignal): Promise<void> {
  let response: Notifications.NotificationResponse | null;
  try {
    response = await Notifications.getLastNotificationResponseAsync();
  } catch {
    return;
  }
  if (response && isWindDown(response.notification)) await openSleep(signal);
}

// Warm start: a notification tapped while the app is running. Returns the
// unsubscribe, which also stops any wait still pending.
export function listenForNotificationTaps(): () => void {
  const controller = new AbortController();
  let subscription: { remove(): void } | undefined;
  try {
    subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      if (isWindDown(response.notification)) void openSleep(controller.signal);
    });
  } catch {
    // No native module: no taps to listen for.
  }
  return () => {
    controller.abort();
    subscription?.remove();
  };
}
