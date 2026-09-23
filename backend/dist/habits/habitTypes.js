"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listHabitTypes = listHabitTypes;
exports.newCustomTypeId = newCustomTypeId;
const crypto_1 = require("crypto");
const client_1 = require("../db/client");
const config_1 = require("./config");
/** Built-ins first, then this user's custom types in creation order. */
async function listHabitTypes(userId) {
    const custom = await client_1.prisma.habitType.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
    return [
        ...config_1.BUILT_IN_HABIT_TYPES,
        ...custom.map((c) => ({
            type: c.type,
            label: c.label,
            unit: c.unit,
            exposureThreshold: c.exposureThreshold,
            builtIn: false,
            createdAt: c.createdAt,
        })),
    ];
}
/**
 * A stable id for a new custom type, generated once and stored. It carries a
 * readable slug for debugging but is never re-derived from the label, so a
 * future label edit cannot orphan the logs that reference it. The random
 * suffix keeps it from colliding with a built-in id or another custom type.
 */
function newCustomTypeId(label) {
    const slug = label
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 16);
    return `CUSTOM_${slug || 'HABIT'}_${(0, crypto_1.randomBytes)(3).toString('hex').toUpperCase()}`;
}
//# sourceMappingURL=habitTypes.js.map