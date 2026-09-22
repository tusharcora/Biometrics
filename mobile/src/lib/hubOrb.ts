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
//
// Off the Coach tab the orb is also paused, not just dimmed to 0.45 opacity:
// the vendored ThinkingOrb drives its animation with a 60 fps React setState
// (see components/orb/ThinkingOrb.tsx), and a barely-visible orb is not worth
// that cost running on every tab for as long as the coach stays enabled. This
// is a deliberate narrowing of spec 2.3 ("inactive it plays breathing
// dimmed"), traded for battery/CPU cost rather than a moving-but-faint orb.
export function hubOrbAppearance(status: CoachStatusDTO | null, coachTabActive: boolean): HubOrbAppearance {
  if (!status || !status.enabled) return { state: 'shaping', paused: true, dimmed: true };
  return { state: 'breathing', paused: !coachTabActive, dimmed: !coachTabActive };
}
