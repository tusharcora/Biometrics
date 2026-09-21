import { createApp } from './app';
import { listenOrExit } from './listen';
import { startSyncWorker } from './sync/worker';
import { enqueueImmediateTokenRefreshSweep, scheduleTokenRefreshSweep } from './sync/queue';
import { scheduleNightlyScoreSweep } from './scoring/queue';
import { scheduleWeeklyHabitCorrelationSweep } from './habits/queue';
import { scheduleDailyCoachRetention, scheduleWeeklyCoachDigest } from './coach/queue';

const port = Number(process.env.PORT ?? 3000);

// Queue workers and schedulers start only once the port is really bound. If
// another backend already owns it, this process must exit rather than run a
// second worker against the same queues while serving nothing (see listen.ts).
listenOrExit(createApp(), port, {
  onListening: () => {
    console.log(`Backend listening on port ${port}`);
    startBackgroundWork();
  },
});

function startBackgroundWork(): void {
  startSyncWorker();

  // The sweep runs as a repeatable queue job, not a per-process setInterval, so
  // that running more than one backend instance does not have several of them
  // racing to refresh the same single-use Google Health refresh token.
  scheduleTokenRefreshSweep().catch((err) =>
    console.error('Failed to schedule the token refresh sweep', err),
  );
  enqueueImmediateTokenRefreshSweep().catch((err) =>
    console.error('Failed to enqueue the startup token refresh sweep', err),
  );

  // Nightly backstop for the debounced per-webhook score recompute: catches
  // missed debounce windows and back-fills days with data but no score.
  scheduleNightlyScoreSweep().catch((err) =>
    console.error('Failed to schedule the nightly score sweep', err),
  );

  // Weekly habit/biometric correlation run. Weekly, not nightly: a pattern needs
  // new data between runs to be worth re-testing.
  scheduleWeeklyHabitCorrelationSweep().catch((err) =>
    console.error('Failed to schedule the weekly habit correlation sweep', err),
  );

  // Coach weekly digest (a no-op at run time unless COACH_ENABLED) and the daily
  // 90-day transcript retention job (runs regardless of the flag).
  scheduleWeeklyCoachDigest().catch((err) =>
    console.error('Failed to schedule the weekly coach digest', err),
  );
  scheduleDailyCoachRetention().catch((err) =>
    console.error('Failed to schedule the daily coach retention job', err),
  );
}
