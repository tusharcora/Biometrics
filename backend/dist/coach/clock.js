"use strict";
// Injectable clock/timer so the latency budget is testable without sleeping.
Object.defineProperty(exports, "__esModule", { value: true });
exports.systemClock = void 0;
exports.systemClock = {
    now: () => Date.now(),
    setTimer(fn, ms) {
        const t = setTimeout(fn, ms);
        return { cancel: () => clearTimeout(t) };
    },
};
//# sourceMappingURL=clock.js.map