import nock from 'nock';
import { registerWebhookSubscription } from '../../src/fitbit/subscription';

afterEach(() => nock.cleanAll());

describe('registerWebhookSubscription', () => {
  it('posts to the Fitbit subscriptions endpoint', async () => {
    const scope = nock('https://api.fitbit.com')
      .post('/1/user/-/apiSubscriptions/sub-1.json')
      .reply(201, {});

    await registerWebhookSubscription('fitbit-user-1', 'access-token', 'sub-1');
    expect(scope.isDone()).toBe(true);
  });

  it('throws when Fitbit rejects the subscription request', async () => {
    nock('https://api.fitbit.com').post('/1/user/-/apiSubscriptions/sub-1.json').reply(500);
    await expect(registerWebhookSubscription('fitbit-user-1', 'access-token', 'sub-1')).rejects.toThrow();
  });
});
