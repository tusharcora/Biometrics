import type { EvalFixture, NegativeFixture } from '../types';
import { digitScanFixtures } from './digitScan';
import { directionFixtures, directionNegativeFixtures } from './direction';
import { groundingFixtures } from './grounding';
import { memoryFixtures } from './memory';

/** Every fixture here must pass. */
export const FIXTURES: EvalFixture[] = [...groundingFixtures, ...digitScanFixtures, ...directionFixtures, ...memoryFixtures];

/** Every fixture here must FAIL on the check it names (proof the eval catches that class of error). */
export const NEGATIVE_FIXTURES: NegativeFixture[] = [...directionNegativeFixtures];
