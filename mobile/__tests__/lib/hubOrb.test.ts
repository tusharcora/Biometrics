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

  it('breathes dimmed and paused while the coach is enabled and another tab is active', () => {
    // Paused, not just dimmed: a 60 fps Skia render loop on every tab is not
    // worth the cost for an orb that is already faded to 0.45 opacity.
    expect(hubOrbAppearance(enabled, false)).toEqual({ state: 'breathing', paused: true, dimmed: true });
  });

  it('breathes at full brightness, unpaused, on the Coach tab', () => {
    expect(hubOrbAppearance(enabled, true)).toEqual({ state: 'breathing', paused: false, dimmed: false });
  });

  it('treats an enabled-but-not-consented coach like an enabled one', () => {
    expect(hubOrbAppearance({ ...enabled, consented: false }, false)).toEqual({ state: 'breathing', paused: true, dimmed: true });
  });
});
