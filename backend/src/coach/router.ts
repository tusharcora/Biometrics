import type { CoachTier } from './model/provider';

// Tier routing (spec section 2), chosen by the orchestrator, never by the user.
// Fast: single-turn factual Q&A. Synthesis: recap/summary requests and
// anything reaching across several weeks or months of history.
const SYNTHESIS_RE =
  /\b(recap|summary|summari[sz]e|overview|review\s+my\s+(week|month)|weekly|monthly|(last|past|previous|few|several)\s+(\w+\s+)?(weeks|months)|this\s+(week|month)\s+(in\s+)?review)\b/i;

export function routeTier(message: string): CoachTier {
  return SYNTHESIS_RE.test(message) ? 'synthesis' : 'fast';
}
