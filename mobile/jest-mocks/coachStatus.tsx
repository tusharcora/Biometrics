// Test helpers for components that read CoachStatusProvider. Kept out of __tests__ (jest would collect it).
import React from 'react';
import { CoachStatusContextForTests, type CoachStatusValue } from '../src/lib/coachStatus/CoachStatusProvider';

// KIP and other pixel art are decorative and hidden from screen readers, so
// queries for them must opt in to hidden elements. Lives here (ruling H6) so it
// outlives jest-mocks/characterContext.tsx.
export const HIDDEN_OK = { includeHiddenElements: true } as const;

export function fakeCoachStatus(overrides: Partial<CoachStatusValue> = {}): CoachStatusValue {
  return {
    status: null, statusLoaded: true, offline: false, thinkingText: 'steps',
    refreshStatus: jest.fn(async () => {}), setStatus: jest.fn(), setOffline: jest.fn(),
    chooseThinkingText: jest.fn(async () => {}),
    ...overrides,
  };
}

export function withCoachStatus(ui: React.ReactElement, overrides: Partial<CoachStatusValue> = {}): React.ReactElement {
  return <CoachStatusContextForTests.Provider value={fakeCoachStatus(overrides)}>{ui}</CoachStatusContextForTests.Provider>;
}
