import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { CoachDigestCard } from '../../src/components/coach-digest-card';
import { CoachConsentRequiredError, CoachDisabledError, fetchLatestDigest } from '../../src/api/coach';

jest.mock('../../src/api/coach', () => ({
  ...jest.requireActual('../../src/api/coach'),
  fetchLatestDigest: jest.fn(),
}));

const digest = {
  id: 'd1',
  text: 'Your recovery held steady this week. Late nights on Tuesday and Thursday were the main drag.',
  createdAt: '2026-09-20T12:00:00.000Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  (fetchLatestDigest as jest.Mock).mockResolvedValue(digest);
});

describe('CoachDigestCard', () => {
  it('shows a loading placeholder first', async () => {
    const { getByTestId, findByTestId } = render(<CoachDigestCard />);
    expect(getByTestId('coach-digest-loading')).toBeTruthy();
    await findByTestId('coach-digest-card');
  });

  it('shows the latest digest text with its date', async () => {
    const { findByTestId, getByTestId } = render(<CoachDigestCard />);

    expect(await findByTestId('coach-digest-preview')).toHaveTextContent(/Your recovery held steady/);
    expect(getByTestId('coach-digest-date')).toHaveTextContent(/Sep 20/);
  });

  it('opens the full text when tapped, and closes again', async () => {
    const { findByTestId, getByTestId, queryByTestId } = render(<CoachDigestCard />);

    expect(queryByTestId('coach-digest-full')).toBeNull();
    fireEvent.press(await findByTestId('coach-digest-card'));

    expect(getByTestId('coach-digest-full')).toHaveTextContent(digest.text);
    fireEvent.press(getByTestId('coach-digest-close'));
    await waitFor(() => expect(queryByTestId('coach-digest-full')).toBeNull());
  });

  it('renders nothing when there is no digest', async () => {
    (fetchLatestDigest as jest.Mock).mockResolvedValue(null);
    const { queryByTestId, toJSON } = render(<CoachDigestCard />);

    await waitFor(() => expect(queryByTestId('coach-digest-loading')).toBeNull());
    expect(toJSON()).toBeNull();
  });

  it('shows a quiet error state when loading fails', async () => {
    (fetchLatestDigest as jest.Mock).mockRejectedValue(new Error('offline'));
    const { findByTestId, queryByTestId } = render(<CoachDigestCard />);

    expect(await findByTestId('coach-digest-error')).toBeTruthy();
    expect(queryByTestId('coach-digest-card')).toBeNull();
  });

  it('renders nothing when the server says the coach is disabled or unconsented', async () => {
    (fetchLatestDigest as jest.Mock).mockRejectedValueOnce(new CoachDisabledError());
    const first = render(<CoachDigestCard />);
    await waitFor(() => expect(first.queryByTestId('coach-digest-loading')).toBeNull());
    expect(first.toJSON()).toBeNull();
    first.unmount();

    (fetchLatestDigest as jest.Mock).mockRejectedValueOnce(new CoachConsentRequiredError());
    const second = render(<CoachDigestCard />);
    await waitFor(() => expect(second.queryByTestId('coach-digest-loading')).toBeNull());
    expect(second.toJSON()).toBeNull();
  });
});
