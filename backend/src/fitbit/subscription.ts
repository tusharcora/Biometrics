import fetch from 'node-fetch';

export async function registerWebhookSubscription(
  fitbitUserId: string,
  accessToken: string,
  subscriptionId: string,
): Promise<void> {
  const res = await fetch(`https://api.fitbit.com/1/user/-/apiSubscriptions/${subscriptionId}.json`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Failed to register Fitbit webhook subscription: ${res.status}`);
  }
}
