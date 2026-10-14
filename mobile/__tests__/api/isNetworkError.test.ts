import { ApiError, apiResponse, isNetworkError } from '../../src/api/client';
import { CoachStreamAbortedError, CoachStreamInterruptedError } from '../../src/api/coachStream';

it('is true only when fetch itself rejected, before any response', async () => {
  const offline = jest.fn(() => Promise.reject(new TypeError('Network request failed')));
  const err = await apiResponse('/me/coach/status', {}, offline as unknown as typeof fetch).catch((e) => e);
  expect(isNetworkError(err)).toBe(true);
});

it.each([
  ['an HTTP error of any status', new ApiError(503, 'x')],
  ['an AbortError (Stop)', Object.assign(new Error('Aborted'), { name: 'AbortError' })],
  ['a stopped stream', new CoachStreamAbortedError()],
  ['a dropped stream', new CoachStreamInterruptedError()],
  ['anything else', new Error('boom')],
  ['a non-error', 'nope'],
])('is false for %s', (_label, err) => {
  expect(isNetworkError(err)).toBe(false);
});
