"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_PERSONA_ID = exports.LIVE_PERSONA_VERSION = exports.PERSONA_SETS = exports.REQUIRED_DISALLOWED_TOPICS = void 0;
exports.listPersonas = listPersonas;
exports.findPersona = findPersona;
exports.resolvePersona = resolvePersona;
const v1_1 = require("./v1");
var v1_2 = require("./v1");
Object.defineProperty(exports, "REQUIRED_DISALLOWED_TOPICS", { enumerable: true, get: function () { return v1_2.REQUIRED_DISALLOWED_TOPICS; } });
/** Every shipped version, by id. Add a new file and register it here; never edit an old one. */
exports.PERSONA_SETS = {
    [v1_1.v1Personas.version]: v1_1.v1Personas,
};
exports.LIVE_PERSONA_VERSION = 'v1';
function liveSet() {
    return exports.PERSONA_SETS[exports.LIVE_PERSONA_VERSION];
}
exports.DEFAULT_PERSONA_ID = liveSet().defaultPersonaId;
function listPersonas() {
    return liveSet().personas;
}
function findPersona(id) {
    return typeof id === 'string' ? listPersonas().find((p) => p.id === id) : undefined;
}
/** A stored id that no longer exists (persona retired in a later version) falls back to the default. */
function resolvePersona(id) {
    return findPersona(id) ?? findPersona(exports.DEFAULT_PERSONA_ID);
}
//# sourceMappingURL=index.js.map