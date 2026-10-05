import { apiFetch } from '../../src/api/client';
import { fetchRecap, fetchRecaps, markRecapOpened } from '../../src/api/recaps';
import { fetchNotificationSettings, saveNotificationSettings } from '../../src/api/notifications';

jest.mock('../../src/api/client');
const api = apiFetch as jest.Mock;

beforeEach(() => api.mockReset());

it('lists recaps with optional kind and limit, tolerating an unexpected body', async () => {
  api.mockResolvedValue({ recaps: [{ id: 'r1' }] });
  expect(await fetchRecaps()).toEqual([{ id: 'r1' }]);
  expect(api).toHaveBeenLastCalledWith('/me/recaps');
  await fetchRecaps({ kind: 'WEEK', limit: 1 });
  expect(api).toHaveBeenLastCalledWith('/me/recaps?kind=WEEK&limit=1');
  api.mockResolvedValue([]);
  expect(await fetchRecaps()).toEqual([]);
});

it('reads one recap and marks it opened with its own POST', async () => {
  api.mockResolvedValue({ id: 'r1' });
  await fetchRecap('r1');
  expect(api).toHaveBeenLastCalledWith('/me/recaps/r1');
  api.mockResolvedValue(undefined);
  await markRecapOpened('r1');
  expect(api).toHaveBeenLastCalledWith('/me/recaps/r1/opened', { method: 'POST' });
});

it('reads and saves the notification settings', async () => {
  api.mockResolvedValue({ recapPushEnabled: true });
  expect(await fetchNotificationSettings()).toEqual({ recapPushEnabled: true });
  expect(api).toHaveBeenLastCalledWith('/me/notifications');
  await saveNotificationSettings({ recapPushEnabled: false });
  expect(api).toHaveBeenLastCalledWith('/me/notifications', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recapPushEnabled: false }),
  });
});
