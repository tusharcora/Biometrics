import type { ThinkingStep } from '../../../lib/useCoachConversation';

/** What every thinking style is given. `paused` already includes Reduce Motion. */
export interface ThinkingStyleProps {
  steps: ThinkingStep[];
  paused: boolean;
}
