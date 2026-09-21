import { renderHook, waitFor, act } from '@testing-library/react-native';
import { coachEntryRoute, useCoachStatus } from '../../src/lib/useCoachStatus';
import { fetchCoachStatus, type CoachStatusDTO } from '../../src/api/coach';
import { scoreQuestion } from '../../src/lib/coachPrompts';

jest.mock('../../src/api/coach');

const base: CoachStatusDTO = {
  enabled: true,
  consented: true,
  consent: { version: 'v1', summary: 's', dataItems: ['x'] },
  personaId: 'a',
  personas: [],
};

beforeEach(() => jest.clearAllMocks());

describe('useCoachStatus', () => {
  it('is null until the server answers, then exposes the status', async () => {
    (fetchCoachStatus as jest.Mock).mockResolvedValue(base);
    const { result } = renderHook(() => useCoachStatus());

    expect(result.current.status).toBeNull();
    await waitFor(() => expect(result.current.status).toEqual(base));
  });

  it('stays null (coach invisible) when the status request fails', async () => {
    (fetchCoachStatus as jest.Mock).mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useCoachStatus());

    await waitFor(() => expect(fetchCoachStatus).toHaveBeenCalled());
    await act(async () => {});
    expect(result.current.status).toBeNull();
  });

  it('refetches when the screen regains focus', async () => {
    (fetchCoachStatus as jest.Mock).mockResolvedValue({ ...base, consented: false });
    let onFocus: () => void = () => {};
    const unsubscribe = jest.fn();
    const navigation = {
      addListener: jest.fn((_event: string, cb: () => void) => {
        onFocus = cb;
        return unsubscribe;
      }),
    };
    const { result, unmount } = renderHook(() => useCoachStatus(navigation));
    await waitFor(() => expect(result.current.status?.consented).toBe(false));

    (fetchCoachStatus as jest.Mock).mockResolvedValue(base);
    act(() => onFocus());
    await waitFor(() => expect(result.current.status?.consented).toBe(true));

    expect(navigation.addListener).toHaveBeenCalledWith('focus', expect.any(Function));
    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('lets a caller replace the status locally (e.g. after a persona change)', async () => {
    (fetchCoachStatus as jest.Mock).mockResolvedValue(base);
    const { result } = renderHook(() => useCoachStatus());
    await waitFor(() => expect(result.current.status).not.toBeNull());

    act(() => result.current.setStatus({ ...base, personaId: 'b' }));
    expect(result.current.status?.personaId).toBe('b');
  });
});

describe('coachEntryRoute', () => {
  it('is null (no entry point at all) when the coach is disabled or status is unknown', () => {
    expect(coachEntryRoute(null)).toBeNull();
    expect(coachEntryRoute({ ...base, enabled: false })).toBeNull();
    expect(coachEntryRoute({ ...base, enabled: false, consented: true })).toBeNull();
  });

  it('goes to consent when enabled but not consented', () => {
    expect(coachEntryRoute({ ...base, consented: false })).toBe('CoachConsent');
  });

  it('goes to the chat when enabled and consented', () => {
    expect(coachEntryRoute(base)).toBe('Coach');
  });
});

describe('scoreQuestion prefill', () => {
  it('contains no digits for either score type', () => {
    for (const type of ['RECOVERY', 'SLEEP'] as const) {
      expect(scoreQuestion(type)).not.toMatch(/\d/);
      expect(scoreQuestion(type).length).toBeGreaterThan(10);
    }
  });
});
