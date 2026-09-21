import express, { Express } from 'express';
import { authRouter } from './auth/routes';
import { healthRouter } from './health/routes';
import { biometricsRouter } from './biometrics/routes';
import { usersRouter } from './users/routes';

export function createApp(): Express {
  const app = express();
  app.use(
    express.json({
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );
  app.get('/health-check', (_req, res) => res.json({ status: 'ok' })); // renamed from /health to avoid clashing with the new /health/* route prefix
  app.use(authRouter);
  app.use(healthRouter);
  app.use(biometricsRouter);
  app.use(usersRouter);
  return app;
}
