import express, { Express } from 'express';
import { authRouter } from './auth/routes';

export function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.use(authRouter);
  return app;
}
