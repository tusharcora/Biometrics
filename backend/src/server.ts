import { createApp } from './app';
import { startSyncWorker } from './sync/worker';
import { runTokenRefreshSweep } from './sync/tokenRefreshJob';

const port = Number(process.env.PORT ?? 3000);
const TOKEN_REFRESH_INTERVAL_MS = 10 * 60 * 1000; // every 10 minutes

createApp().listen(port, () => {
  console.log(`Backend listening on port ${port}`);
});

startSyncWorker();
setInterval(() => {
  runTokenRefreshSweep().catch((err) => console.error('Token refresh sweep failed', err));
}, TOKEN_REFRESH_INTERVAL_MS);
