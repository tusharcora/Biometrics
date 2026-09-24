import express, { Express } from 'express';
import { toNodeHandler } from 'better-auth/node';
import { auth as defaultAuth, type Auth } from './auth/auth';
import { healthRouter } from './health/routes';
import { biometricsRouter } from './biometrics/routes';
import { usersRouter } from './users/routes';
import { scoresRouter } from './scoring/routes';
import { habitsRouter } from './habits/routes';
import { coachRouter } from './coach/routes';

export function createApp(options: { auth?: Auth } = {}): Express {
  const app = express();
  // Better Auth reads the raw request body itself, so its handler must run
  // before express.json consumes it.
  app.all('/auth/*splat', toNodeHandler(options.auth ?? defaultAuth));
  app.use(
    express.json({
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );
  app.get('/health-check', (_req, res) => res.json({ status: 'ok' })); // renamed from /health to avoid clashing with the new /health/* route prefix
  app.use(healthRouter);
  app.use(biometricsRouter);
  app.use(usersRouter);
  app.use(scoresRouter);
  app.use(habitsRouter);
  app.use(coachRouter);
  return app;
}
