import { hubOrbAppearance } from '../../src/lib/hubOrb';
import type { CoachStatusDTO } from '../../src/api/coach';

const enabled: CoachStatusDTO = {
  enabled: true,
  consented: true,
  consent: { version: 'v1', summary: 's', dataItems: [] },
  personaId: 'encouraging',
  personas: [],
};

describe('hubOrbAppearance', () => {
  it('is dim, paused and shaping when the status is unknown', () => {
    expect(hubOrbAppearance(null, false)).toEqual({ state: 'shaping', paused: true, dimmed: true });
  });

  it('is dim, paused and shaping when the coach is disabled, even on the Coach tab', () => {
    expect(hubOrbAppearance({ ...enabled, enabled: false }, true)).toEqual({ state: 'shaping', paused: true, dimmed: true });
  });

  it('breathes dimmed while the coach is enabled and another tab is active', () => {
    expect(hubOrbAppearance(enabled, false)).toEqual({ state: 'breathing', paused: false, dimmed: true });
  });

  it('breathes at full brightness on the Coach tab', () => {
    expect(hubOrbAppearance(enabled, true)).toEqual({ state: 'breathing', paused: false, dimmed: false });
  });

  it('treats an enabled-but-not-consented coach like an enabled one', () => {
    expect(hubOrbAppearance({ ...enabled, consented: false }, false)).toEqual({ state: 'breathing', paused: false, dimmed: true });
  });
});
