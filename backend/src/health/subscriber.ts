import fetch from 'node-fetch';
import { getServiceAccountToken } from './serviceAccount';

const SUBSCRIBER_ID = 'biometrics-subscriber';

function projectNumber(): string {
  const value = process.env.GOOGLE_CLOUD_PROJECT_NUMBER;
  if (!value) throw new Error('GOOGLE_CLOUD_PROJECT_NUMBER is not set');
  return value;
}

interface IdentityResponse {
  name: string;
  legacyUserId: string;
  healthUserId: string;
}

export async function getIdentity(userAccessToken: string): Promise<{ healthUserId: string }> {
  const res = await fetch('https://health.googleapis.com/v4/users/me/identity', {
    headers: { Authorization: `Bearer ${userAccessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Failed to resolve Google Health identity: ${res.status}`);
  }
  const json = (await res.json()) as IdentityResponse;
  return { healthUserId: json.healthUserId };
}

export async function registerUserSubscription(healthUserId: string): Promise<string> {
  const token = await getServiceAccountToken();
  const url = `https://health.googleapis.com/v4/projects/${projectNumber()}/subscribers/${SUBSCRIBER_ID}/subscriptions`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    // Note: only `steps` has been live-verified as a valid subscribable data type.
    // `sleep`, `heart-rate`, and `heartRateVariability` are requested per spec but
    // unconfirmed; if the API rejects one of these with an invalid-data-type error,
    // adjust this array rather than the overall approach.
    body: JSON.stringify({
      user: `users/${healthUserId}`,
      dataTypes: ['steps', 'sleep', 'heart-rate', 'heart-rate-variability'],
    }),
  });
  if (!res.ok) {
    throw new Error(`Failed to create Google Health subscription: ${res.status}`);
  }
  const json = (await res.json()) as { name: string };
  const parts = json.name.split('/');
  const subscriptionId = parts[parts.length - 1];
  if (!subscriptionId) {
    throw new Error('Unexpected subscription name format from Google Health API');
  }
  return subscriptionId;
}

export async function deleteUserSubscription(subscriptionId: string): Promise<void> {
  const token = await getServiceAccountToken();
  const url = `https://health.googleapis.com/v4/projects/${projectNumber()}/subscribers/${SUBSCRIBER_ID}/subscriptions/${subscriptionId}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Failed to delete Google Health subscription: ${res.status}`);
  }
}
