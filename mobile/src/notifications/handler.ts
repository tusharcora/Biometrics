import * as Notifications from 'expo-notifications';
import { navigationRef } from '../navigation/navigationRef';
import { WIND_DOWN_KIND } from '../lib/windDown';

// What the app does with notifications while it runs: shows the wind-down
// reminder in the foreground and opens the Sleep screen, or a recap, when one
// is tapped.
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

/** The recap push's id-only data (spec 2026-10-04 §2): { kind: 'recap', recapId: <uuid> }. */
export const RECAP_PUSH_KIND = 'recap';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function dataOf(notification: Notifications.Notification): Record<string, unknown> | null {
  const data = notification.request.content.data;
  return data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
}

function isWindDown(notification: Notifications.Notification): boolean {
  return dataOf(notification)?.kind === WIND_DOWN_KIND;
}

function recapIdOf(notification: Notifications.Notification): string | null {
  const data = dataOf(notification);
  return data?.kind === RECAP_PUSH_KIND && typeof data.recapId === 'string' && UUID_RE.test(data.recapId) ? data.recapId : null;
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

// `{ pop: true }`, as in coachNavigation: in React Navigation v7 a NAVIGATE reuses an existing
// route only when it is the current one or `pop` is set, so without it a tap would stack a second
// copy. A recap tapped while another recap is on screen updates that screen's params, and
// RecapScreen drops the earlier recap's late answer (T19 ruling).
/** Where a tapped notification goes; null for anything else, which is ignored as before. */
function routeFor(notification: Notifications.Notification): (() => void) | null {
  if (isWindDown(notification)) return () => navigationRef.navigate('Sleep', undefined, { pop: true });
  const recapId = recapIdOf(notification);
  return recapId ? () => navigationRef.navigate('Recap', { id: recapId }, { pop: true }) : null;
}

// Runs `go` once the signed-in navigator is ready, polling until it is, for up to 5 s. Signed out
// it never becomes ready, so this does nothing.
function openWhenReady(go: () => void, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    if (navigationRef.isReady()) {
      go();
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
        go();
        finish();
      } else if (Date.now() - startedAt >= READY_TIMEOUT_MS) {
        finish();
      }
    }, READY_POLL_MS);
    signal?.addEventListener('abort', finish);
  });
}

// Cold start: the app was launched by tapping a notification. Pass a signal to stop waiting for
// the navigator (on unmount).
export async function routeInitialNotification(signal?: AbortSignal): Promise<void> {
  let response: Notifications.NotificationResponse | null;
  try {
    response = await Notifications.getLastNotificationResponseAsync();
  } catch {
    return;
  }
  const go = response ? routeFor(response.notification) : null;
  if (go) await openWhenReady(go, signal);
}

// Warm start: a notification tapped while the app is running. Returns the unsubscribe, which also
// stops any wait still pending.
export function listenForNotificationTaps(): () => void {
  const controller = new AbortController();
  let subscription: { remove(): void } | undefined;
  try {
    subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const go = routeFor(response.notification);
      if (go) void openWhenReady(go, controller.signal);
    });
  } catch {
    // No native module: no taps to listen for.
  }
  return () => {
    controller.abort();
    subscription?.remove();
  };
}
