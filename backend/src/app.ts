import express, { Express } from 'express';
import { authRouter } from './auth/routes';
import { fitbitRouter } from './fitbit/routes';
import { biometricsRouter } from './biometrics/routes';

export function createApp(): Express {
  const app = express();
  app.use(
    express.json({
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.use(authRouter);
  app.use(fitbitRouter);
  app.use(biometricsRouter);
  return app;
}
