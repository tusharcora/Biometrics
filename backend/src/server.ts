import { createApp } from './app';
import { startSyncWorker } from './sync/worker';
import { enqueueImmediateTokenRefreshSweep, scheduleTokenRefreshSweep } from './sync/queue';

const port = Number(process.env.PORT ?? 3000);

createApp().listen(port, () => {
  console.log(`Backend listening on port ${port}`);
});

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
