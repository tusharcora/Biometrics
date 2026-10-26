import React from 'react';
import { render, fireEvent, waitFor, within } from '@testing-library/react-native';
import { Rect } from 'react-native-svg';
import { kipHeadRects } from '../../src/components/kip/KipHead';
import { CoachDigestCard } from '../../src/components/coach-digest-card';
import { CoachConsentRequiredError, CoachDisabledError, fetchLatestDigest } from '../../src/api/coach';
import { fetchRecaps } from '../../src/api/recaps';

jest.mock('../../src/api/coach', () => ({
  ...jest.requireActual('../../src/api/coach'),
  fetchLatestDigest: jest.fn(),
}));
jest.mock('../../src/api/recaps');

const digest = {
  id: 'd1',
  text: 'Your recovery held steady this week. Late nights on Tuesday and Thursday were the main drag.',
  createdAt: '2026-09-20T12:00:00.000Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  (fetchLatestDigest as jest.Mock).mockResolvedValue(digest);
  (fetchRecaps as jest.Mock).mockResolvedValue([]);
});

describe('CoachDigestCard', () => {
  it('shows a loading placeholder first', async () => {
    const { getByTestId, findByTestId } = render(<CoachDigestCard />);
    expect(getByTestId('coach-digest-loading')).toBeTruthy();
    await findByTestId('coach-digest-card');
  });

  it("is KIP's note: the latest digest text with its date, and a way to read it all", async () => {
    const { findByTestId, getByTestId, getByText } = render(<CoachDigestCard />);

    expect(await findByTestId('coach-digest-preview')).toHaveTextContent(/Your recovery held steady/);
    expect(getByText("KIP's note")).toBeTruthy();
    expect(getByTestId('coach-digest-date')).toHaveTextContent('· Sun, Sep 20');
    // Spoken without the middle dot.
    expect(getByTestId('coach-digest-date').props.accessibilityLabel).toBe('Sun, Sep 20');
    expect(getByText('Read it all →')).toBeTruthy();
  });

  it('opens the full text when tapped, and closes again', async () => {
    const { findByTestId, getByTestId, queryByTestId } = render(<CoachDigestCard />);

    expect(queryByTestId('coach-digest-full')).toBeNull();
    fireEvent.press(await findByTestId('coach-digest-card'));

    expect(getByTestId('coach-digest-full')).toHaveTextContent(digest.text);
    expect(getByTestId('coach-digest-title')).toHaveTextContent("KIP's note");
    // The server no longer appends the disclaimer to the recap; it is shown once, under it.
    expect(getByTestId('coach-digest-footnote')).toHaveTextContent('Comparisons against your own readings, not medical advice.');
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

  it("opens the week's recap instead of the sheet when the digest is that recap's story", async () => {
    (fetchRecaps as jest.Mock).mockResolvedValue([{ id: 'd1', kind: 'WEEK' }]);
    const onOpenRecap = jest.fn();
    const { findByTestId, queryByTestId } = render(<CoachDigestCard onOpenRecap={onOpenRecap} />);
    await waitFor(() => expect(fetchRecaps).toHaveBeenCalledWith({ kind: 'WEEK', limit: 1 }));
    fireEvent.press(await findByTestId('coach-digest-card'));
    await waitFor(() => expect(onOpenRecap).toHaveBeenCalledWith('d1'));
    expect(queryByTestId('coach-digest-full')).toBeNull();
  });
});

describe("CoachDigestCard KIP's head", () => {
  const fills = (utils: ReturnType<typeof render>) =>
    within(utils.getByTestId('coach-digest-kip', { includeHiddenElements: true })).UNSAFE_getAllByType(Rect).map((r) => r.props.fill);

  it('is idle by default', async () => {
    const utils = render(<CoachDigestCard />);
    await utils.findByTestId('coach-digest-card');

    expect(fills(utils)).toEqual(kipHeadRects({ mood: 'idle' }).map((r) => r.fill));
  });

  it("wears the day's mood", async () => {
    const utils = render(<CoachDigestCard mood="sleepy" />);
    await utils.findByTestId('coach-digest-card');

    expect(fills(utils)).toEqual(kipHeadRects({ mood: 'sleepy' }).map((r) => r.fill));
  });
});
