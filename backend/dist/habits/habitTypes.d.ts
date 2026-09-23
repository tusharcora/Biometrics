import { HabitTypeConfig } from './config';
/** Built-ins first, then this user's custom types in creation order. */
export declare function listHabitTypes(userId: string): Promise<HabitTypeConfig[]>;
/**
 * A stable id for a new custom type, generated once and stored. It carries a
 * readable slug for debugging but is never re-derived from the label, so a
 * future label edit cannot orphan the logs that reference it. The random
 * suffix keeps it from colliding with a built-in id or another custom type.
 */
export declare function newCustomTypeId(label: string): string;
//# sourceMappingURL=habitTypes.d.ts.map