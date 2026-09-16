import request from 'supertest';
import { createApp } from '../src/app';

describe('GET /health-check', () => {
  it('returns 200 ok', async () => {
    const app = createApp();
    const res = await request(app).get('/health-check');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
