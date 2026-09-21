import type { CoachEntryRoute } from '../lib/useCoachStatus';

interface Navigator {
  navigate: (...args: any[]) => void;
}

// The coach chat is a tab; consent is a stack screen pushed over the tabs. This
// is the one place that knows that, so entry points do not hardcode route names.
// `prefill` is only added to the params when defined, so callers that have none
// navigate with the plainest possible arguments.
export function navigateToCoachEntry(navigation: Navigator, route: CoachEntryRoute, prefill?: string): void {
  if (route === 'Coach') {
    navigation.navigate('Tabs', prefill === undefined ? { screen: 'Coach' } : { screen: 'Coach', params: { prefill } });
    return;
  }
  if (prefill === undefined) navigation.navigate('CoachConsent');
  else navigation.navigate('CoachConsent', { prefill });
}
