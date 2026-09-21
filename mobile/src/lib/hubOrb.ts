import type { CoachStatusDTO } from '../api/coach';
import type { OrbState } from '../components/orb/types';

export interface HubOrbAppearance {
  state: OrbState;
  paused: boolean;
  dimmed: boolean;
}

// The centre orb of the floating bar. It is always drawn (spec 2.4); what it
// shows depends on the coach. An unknown status is treated exactly like a
// disabled coach so the hub never looks alive when the coach is not.
export function hubOrbAppearance(status: CoachStatusDTO | null, coachTabActive: boolean): HubOrbAppearance {
  if (!status || !status.enabled) return { state: 'shaping', paused: true, dimmed: true };
  return { state: 'breathing', paused: false, dimmed: !coachTabActive };
}
