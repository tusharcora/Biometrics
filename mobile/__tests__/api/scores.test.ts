import { apiFetch, ApiError } from '../../src/api/client';
import { fetchScores, fetchScoreDetail } from '../../src/api/scores';

jest.mock('../../src/api/client', () => ({
  ...jest.requireActual('../../src/api/client'),
  apiFetch: jest.fn(),
}));

const score = {
  date: '2026-09-19',
  type: 'RECOVERY',
  score: 72,
  confidenceLevel: 'HIGH',
  algorithmVersion: 'v1',
  factors: [],
  coldStart: [],
};

beforeEach(() => jest.clearAllMocks());

describe('fetchScores', () => {
  it('requests the given number of days and unwraps the scores array', async () => {
    (apiFetch as jest.Mock).mockResolvedValue({ scores: [score] });

    await expect(fetchScores(14)).resolves.toEqual([score]);
    expect(apiFetch).toHaveBeenCalledWith('/me/scores?days=14');
  });

  it('adds the type filter only when one is given', async () => {
    (apiFetch as jest.Mock).mockResolvedValue({ scores: [] });

    await fetchScores(7, 'SLEEP');

    expect(apiFetch).toHaveBeenCalledWith('/me/scores?days=7&type=SLEEP');
  });

  it('returns both score types untouched when no type is given', async () => {
    const sleep = { ...score, type: 'SLEEP' };
    (apiFetch as jest.Mock).mockResolvedValue({ scores: [score, sleep] });

    await expect(fetchScores(7)).resolves.toEqual([score, sleep]);
  });

  it('returns an empty list when the response has no scores', async () => {
    (apiFetch as jest.Mock).mockResolvedValue({});

    await expect(fetchScores(7)).resolves.toEqual([]);
  });
});

describe('fetchScoreDetail', () => {
  it('requests the date with the score type', async () => {
    const detail = { score, baselines: [], previous: null };
    (apiFetch as jest.Mock).mockResolvedValue(detail);

    await expect(fetchScoreDetail('2026-09-19', 'RECOVERY')).resolves.toEqual(detail);
    expect(apiFetch).toHaveBeenCalledWith('/me/scores/2026-09-19?type=RECOVERY');
  });

  it('requests the SLEEP detail when asked', async () => {
    (apiFetch as jest.Mock).mockResolvedValue({ score: { ...score, type: 'SLEEP' }, baselines: [], previous: null });

    await fetchScoreDetail('2026-09-19', 'SLEEP');

    expect(apiFetch).toHaveBeenCalledWith('/me/scores/2026-09-19?type=SLEEP');
  });

  it('defaults to the RECOVERY type', async () => {
    (apiFetch as jest.Mock).mockResolvedValue({ score, baselines: [], previous: null });

    await fetchScoreDetail('2026-09-19');

    expect(apiFetch).toHaveBeenCalledWith('/me/scores/2026-09-19?type=RECOVERY');
  });

  it('returns null on a 404 (no score for that day)', async () => {
    (apiFetch as jest.Mock).mockRejectedValue(new ApiError(404, 'Request failed with 404'));

    await expect(fetchScoreDetail('2026-09-19')).resolves.toBeNull();
  });

  it('rethrows any other failure', async () => {
    (apiFetch as jest.Mock).mockRejectedValue(new ApiError(500, 'Request failed with 500'));

    await expect(fetchScoreDetail('2026-09-19')).rejects.toThrow('500');
  });
});
