"use strict";
// The framing carried from Phase 1's metricInsights.ts: every coach reply ends
// with it, added by the server, never left to the model to remember (spec
// section 4, last bullet).
Object.defineProperty(exports, "__esModule", { value: true });
exports.COACH_DISCLAIMER = void 0;
exports.withDisclaimer = withDisclaimer;
exports.stripDisclaimer = stripDisclaimer;
exports.COACH_DISCLAIMER = 'This is a comparison against your own recent readings, not a medical assessment.';
function withDisclaimer(text) {
    return `${text.trimEnd()}\n\n${exports.COACH_DISCLAIMER}`;
}
/** Inverse of withDisclaimer, used when replaying stored replies to the model as history. */
function stripDisclaimer(text) {
    return text.endsWith(exports.COACH_DISCLAIMER) ? text.slice(0, -exports.COACH_DISCLAIMER.length).trimEnd() : text;
}
//# sourceMappingURL=disclaimer.js.map