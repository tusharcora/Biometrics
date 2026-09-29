// Every user-facing forecast string, so the Dashboard card and the Forecast
// screen can never drift apart. Components import from here; they never inline copy.
export const FORECAST_MIN_DAYS = 21;

export const FORECAST_COPY = {
  noneYet: 'No measurable effect for you yet',
  disclaimer: 'An estimate from your own history — not medical advice.',
  effectOrder: 'Effects shown in order: recent trend, sleep, habits.',
  unlocksAfter: (days: number) => `Forecast unlocks after ${FORECAST_MIN_DAYS} days of data (${days}/${FORECAST_MIN_DAYS})`,
  lowConfidence: 'Today’s score isn’t confident enough to forecast from yet. Check back after tonight’s sync.',
  band: (lo: number, hi: number) => `Likely ${Math.round(lo)}–${Math.round(hi)}`,
  trackRecord: (within: number, hits: number, days: number) => `Within ±${within} on ${hits} of the last ${days} days`,
  loadError: 'Couldn’t load tomorrow’s forecast. Try again in a moment.',
  unavailable: 'Tomorrow’s forecast is unavailable right now.',
  planCta: 'Plan tomorrow →',
  title: 'Tomorrow',
} as const;
