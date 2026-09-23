import { Router } from 'express';
import { CoachClock } from './clock';
import type { CoachModelProvider } from './model/provider';
import { OrchestratorDeps } from './orchestrator';
import { CoachTelemetry } from './telemetry';
import type { CoachTools } from './tools';
export declare const MAX_MESSAGE_CHARS = 2000;
export declare const MAX_PUSH_TOKEN_CHARS = 512;
export interface CoachRouterDeps {
    getProvider: () => CoachModelProvider;
    telemetry: CoachTelemetry;
    clock: CoachClock;
    tools?: CoachTools;
    budgets?: OrchestratorDeps['budgets'];
}
export declare function createCoachRouter(overrides?: Partial<CoachRouterDeps>): Router;
export declare const coachRouter: Router;
//# sourceMappingURL=routes.d.ts.map